import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { createEventBus } from '@caissette/event-bus'
import { createAuditLogger } from '@caissette/audit-log'
import { createAuthRoutes, createAuthMiddleware, requireAuth, hasRole } from '@caissette/auth'
import { tenantMiddleware, createTenantRoutes, parseSettings } from '@caissette/tenant'
import { createDepotsRoutes, createContractsRoutes } from '@caissette/depots'
import { createCatalogRoutes } from '@caissette/catalog'
import { createCaisseRoutes } from '@caissette/caisse'
import { createLivrePoliceRoutes, registerPoliceLedgerListeners } from '@caissette/livre-police'
import { generateClosure, closures } from '@caissette/isca'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import type { Cents, Hash, ShopId } from '@caissette/types'
import { computeHash, computeChainedHash, generateUuidV7, hashPassword } from '@caissette/utils'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// categories table reference
const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  shopId: text('shop_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active').notNull().default(1),
  showInFilters: integer('show_in_filters').notNull().default(1),
  createdAt: integer('created_at').notNull(),
})

// cash_movements table reference
const cashMovements = sqliteTable('cash_movements', {
  id: text('id').primaryKey(),
  shopId: text('shop_id').notNull(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(),
  amount: integer('amount').notNull(),
  note: text('note'),
  recordedAt: integer('recorded_at').notNull(),
  createdAt: integer('created_at').notNull(),
})

// users table reference for user management
const usersTable = sqliteTable('users', {
  id: text('id').primaryKey(),
  shopId: text('shop_id').notNull(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  pinHash: text('pin_hash'),
  passwordHash: text('password_hash').notNull(),
  active: integer('active').notNull().default(1),
  permissionsJson: text('permissions_json'),
  createdAt: integer('created_at').notNull(),
  lastLoginAt: integer('last_login_at'),
})

// reversements table reference (mirrors infra/migrations/src/schema.ts)
const reversements = sqliteTable('reversements', {
  id: text('id').primaryKey(),
  shopId: text('shop_id').notNull(),
  depositorId: text('depositor_id').notNull(),
  periodStart: integer('period_start').notNull(),
  periodEnd: integer('period_end').notNull(),
  totalSales: integer('total_sales').notNull(),
  totalCommission: integer('total_commission').notNull(),
  totalReversement: integer('total_reversement').notNull(),
  status: text('status').notNull(),
  paymentMethod: text('payment_method'),
  paidAt: integer('paid_at'),
  paidBy: text('paid_by'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
})

type Env = {
  DB: D1Database
  KV: KVNamespace
  SIGNING_KEY?: string
}

const app = new Hono<{ Bindings: Env }>()

const getDb = (c: any): DrizzleD1Database => drizzle(c.env.DB)

// ─── Global middleware ───
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['https://app.caissette.fr', 'https://app-preview.caissette.fr', 'http://localhost:5173', 'https://rebond-web-488.pages.dev'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Shop-Id', 'X-User-Id'],
    credentials: true,
  }),
)

// ─── Health ───
app.get('/health', (c) => c.json({ status: 'ok', version: '0.0.1' }))

// ─── Public routes ───
app.route('/auth', createAuthRoutes(getDb))

// Onboarding: create shop (no auth needed for initial setup)
app.route('/shops', createTenantRoutes(getDb))

// ─── Helper: create a shared eventBus with police ledger listeners ───
function createWiredEventBus(db: DrizzleD1Database) {
  const eventBus = createEventBus()

  // Resolve depositor info for police ledger entries
  const resolveDepositorInfo = async (depositorId: string) => {
    const { depositors } = await import('@caissette/depots')
    const result = await db.select().from(depositors).where(eq(depositors.id, depositorId)).limit(1)
    const d = result[0]
    if (!d) return null
    return {
      name: `${d.firstName} ${d.lastName}`,
      idDocument: `${d.idDocumentType}: ${d.idDocumentNumber}`,
    }
  }

  registerPoliceLedgerListeners(db, eventBus, resolveDepositorInfo)
  return eventBus
}

// ─── Helper: forward request to a sub-app ───
function forwardToSubApp(c: any, routes: any, prefix: string) {
  const url = new URL(c.req.url)
  const path = url.pathname.replace(prefix, '') || '/'
  const newUrl = new URL(path, url.origin)
  newUrl.search = url.search
  const req = new Request(newUrl.toString(), c.req.raw)
  req.headers.set('X-Shop-Id', (c as any).get('user').shopId)
  return routes.fetch(req)
}

// ─── Ed25519 signature for closures ───
async function signData(data: string, env: Env): Promise<string> {
  // Try to use Ed25519 key from environment secret
  const signingKey = (env as any).SIGNING_KEY as string | undefined

  if (signingKey) {
    // Ed25519 signing with stored private key
    try {
      const keyBytes = base64ToBytes(signingKey)
      const key = await crypto.subtle.importKey(
        'pkcs8',
        keyBytes.buffer as ArrayBuffer,
        { name: 'Ed25519' },
        false,
        ['sign'],
      )
      const dataBytes = new TextEncoder().encode(data)
      const signature = await crypto.subtle.sign('Ed25519', key, dataBytes)
      return bytesToHex(new Uint8Array(signature))
    } catch (e) {
      console.error('Ed25519 signing failed, falling back to HMAC:', e)
    }
  }

  // Fallback: HMAC-based signature (for development / when no key configured)
  return computeHash(`sign:${data}`)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Protected API ───
const api = new Hono<{ Bindings: Env }>()
api.use('*', createAuthMiddleware(getDb))
api.use('*', requireAuth)

// Shop settings (needs auth)
api.get('/shop', async (c) => {
  const db = getDb(c)
  const { shops } = await import('@caissette/tenant')
  const user = (c as any).get('user')
  const result = await db.select().from(shops).where(eq(shops.id, user.shopId)).limit(1)
  const shop = result[0]
  if (!shop) return c.json({ error: 'Boutique introuvable' }, 404)
  return c.json({ ...shop, settings: parseSettings(shop.settingsJson) })
})

api.patch('/shop', async (c) => {
  const db = getDb(c)
  const { shops } = await import('@caissette/tenant')
  const user = (c as any).get('user')
  const body = await c.req.json()

  // If settings is provided, merge with existing and serialize
  if (body.settings) {
    const current = await db.select().from(shops).where(eq(shops.id, user.shopId)).limit(1)
    const currentShop = current[0]
    if (!currentShop) return c.json({ error: 'Boutique introuvable' }, 404)
    const existing = parseSettings(currentShop.settingsJson)
    const merged = {
      ...existing,
      ...body.settings,
      features: { ...existing.features, ...(body.settings.features ?? {}) },
      display: { ...(existing.display ?? {}), ...(body.settings.display ?? {}) },
    }
    delete body.settings
    body.settingsJson = JSON.stringify(merged)
  }

  await db.update(shops).set(body).where(eq(shops.id, user.shopId))
  return c.json({ ok: true })
})

// Depositors
api.all('/depositors/*', async (c) => {
  const db = getDb(c)
  const eventBus = createWiredEventBus(db)
  const routes = createDepotsRoutes(db, eventBus)
  return forwardToSubApp(c, routes, '/api/depositors')
})

api.all('/depositors', async (c) => {
  const db = getDb(c)
  const eventBus = createWiredEventBus(db)
  const routes = createDepotsRoutes(db, eventBus)
  const url = new URL(c.req.url)
  const newUrl = new URL('/', url.origin)
  newUrl.search = url.search
  const req = new Request(newUrl.toString(), c.req.raw)
  req.headers.set('X-Shop-Id', (c as any).get('user').shopId)
  return routes.fetch(req)
})

// Contracts
api.all('/contracts/*', async (c) => {
  const db = getDb(c)
  const eventBus = createWiredEventBus(db)
  const routes = createContractsRoutes(db, eventBus)
  return forwardToSubApp(c, routes, '/api/contracts')
})

api.all('/contracts', async (c) => {
  const db = getDb(c)
  const eventBus = createWiredEventBus(db)
  const routes = createContractsRoutes(db, eventBus)
  const url = new URL(c.req.url)
  const newUrl = new URL('/', url.origin)
  newUrl.search = url.search
  const req = new Request(newUrl.toString(), c.req.raw)
  req.headers.set('X-Shop-Id', (c as any).get('user').shopId)
  return routes.fetch(req)
})

// Items
api.all('/items/*', async (c) => {
  const db = getDb(c)
  const eventBus = createWiredEventBus(db)
  const routes = createCatalogRoutes(db, eventBus)
  return forwardToSubApp(c, routes, '/api/items')
})

api.all('/items', async (c) => {
  const db = getDb(c)
  const eventBus = createWiredEventBus(db)
  const routes = createCatalogRoutes(db, eventBus)
  const url = new URL(c.req.url)
  const newUrl = new URL('/', url.origin)
  newUrl.search = url.search
  const req = new Request(newUrl.toString(), c.req.raw)
  req.headers.set('X-Shop-Id', (c as any).get('user').shopId)
  return routes.fetch(req)
})

// ─── Sales (with immutability guards) ───

// Refund (avoir) — must be before the immutability guard
api.post('/sales/:id/refund', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const saleId = c.req.param('id')

  if (user.role === 'cashier') {
    return c.json({ error: 'Seul un responsable peut effectuer un avoir' }, 403)
  }

  const { sales, saleItems } = await import('@caissette/caisse')

  // Get original sale
  const original = await db.select().from(sales)
    .where(and(eq(sales.id, saleId), eq(sales.shopId, user.shopId)))
    .limit(1)
  const sale = original[0]
  if (!sale) return c.json({ error: 'Vente introuvable' }, 404)
  if (sale.status === 'refunded') return c.json({ error: 'Cette vente a deja ete remboursee' }, 409)

  // Get original items
  const origItems = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId))

  // Get previous hash for chaining
  const lastSale = await db.select({ hash: sales.hash }).from(sales)
    .where(eq(sales.shopId, user.shopId))
    .orderBy(desc(sales.receiptNumber))
    .limit(1)
  const previousHash = (lastSale[0]?.hash ?? '0'.repeat(64)) as Hash

  // Get next receipt number
  const lastReceipt = await db.select({ receiptNumber: sales.receiptNumber }).from(sales)
    .where(eq(sales.shopId, user.shopId))
    .orderBy(desc(sales.receiptNumber))
    .limit(1)
  const receiptNumber = (lastReceipt[0]?.receiptNumber ?? 0) + 1

  const now = Date.now()
  const refundId = crypto.randomUUID()
  const refundTotal = -sale.total

  const hash = await computeChainedHash(
    previousHash,
    { total: refundTotal, items: origItems.length },
    receiptNumber,
    now,
  )

  // Create refund sale (negative amounts)
  await db.insert(sales).values({
    id: refundId,
    shopId: user.shopId,
    receiptNumber,
    cashierId: user.id,
    soldAt: now,
    subtotal: refundTotal,
    total: refundTotal,
    vatMarginAmount: -sale.vatMarginAmount,
    paymentMethod: sale.paymentMethod,
    paymentDetailsJson: JSON.stringify({ refundOf: saleId }),
    customerNote: `Avoir pour vente #${sale.receiptNumber}`,
    status: 'refunded',
    previousHash,
    hash,
    signedServerAt: null,
    createdAt: now,
  })

  // Create refund sale items (negative)
  for (const item of origItems) {
    await db.insert(saleItems).values({
      id: crypto.randomUUID(),
      saleId: refundId,
      itemId: item.itemId,
      name: `[AVOIR] ${item.name}`,
      price: -item.price,
      costBasis: item.costBasis ? -item.costBasis : null,
      reversementAmount: item.reversementAmount ? -item.reversementAmount : null,
      depositorId: item.depositorId,
      vatRegime: item.vatRegime,
      vatRate: item.vatRate,
      vatAmount: -item.vatAmount,
    })
  }

  // Mark original sale as refunded
  await db.update(sales).set({ status: 'refunded' }).where(eq(sales.id, saleId))

  // Restore items to 'available' status
  const { items } = await import('@caissette/catalog')
  for (const item of origItems) {
    if (item.itemId) {
      await db.update(items).set({ status: 'available', soldAt: null }).where(eq(items.id, item.itemId))
    }
  }

  return c.json({ id: refundId, receiptNumber, hash }, 201)
})

// Explicit rejection: sales cannot be modified or deleted (legal requirement)
api.patch('/sales/:id', (c) => {
  return c.json({ error: 'Les ventes ne peuvent pas etre modifiees (obligation legale NF525)' }, 403)
})
api.delete('/sales/:id', (c) => {
  return c.json({ error: 'Les ventes ne peuvent pas etre supprimees (obligation legale NF525)' }, 403)
})

// Sale detail with items (for receipt)
api.get('/sales/:id', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const saleId = c.req.param('id')
  const { sales, saleItems } = await import('@caissette/caisse')
  const { shops } = await import('@caissette/tenant')

  const saleResult = await db.select().from(sales)
    .where(and(eq(sales.id, saleId), eq(sales.shopId, user.shopId)))
    .limit(1)
  const sale = saleResult[0]
  if (!sale) return c.json({ error: 'Vente introuvable' }, 404)

  const itemsResult = await db.select().from(saleItems)
    .where(eq(saleItems.saleId, saleId))

  const shopResult = await db.select().from(shops)
    .where(eq(shops.id, user.shopId)).limit(1)
  const shop = shopResult[0]

  return c.json({
    ...sale,
    items: itemsResult,
    shop: shop ? { name: shop.name, siret: shop.siret, address: shop.address, vatNumber: shop.vatNumber } : null,
  })
})

// Enhanced sales list with filters (must be before the catch-all)
api.get('/sales', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const { sales } = await import('@caissette/caisse')

  const startDate = c.req.query('start')
  const endDate = c.req.query('end')
  const payment = c.req.query('payment')
  const status = c.req.query('status')
  const limitParam = parseInt(c.req.query('limit') ?? '50')

  const conditions = [eq(sales.shopId, user.shopId)]

  if (startDate) {
    conditions.push(gte(sales.soldAt, new Date(startDate).getTime()))
  }
  if (endDate) {
    conditions.push(lte(sales.soldAt, new Date(endDate + 'T23:59:59.999').getTime()))
  }
  if (payment) {
    conditions.push(eq(sales.paymentMethod, payment))
  }
  if (status) {
    conditions.push(eq(sales.status, status))
  }

  const result = await db.select().from(sales)
    .where(and(...conditions))
    .orderBy(desc(sales.soldAt))
    .limit(Math.min(limitParam, 200))

  return c.json(result)
})

// Forward list + create to caisse module
api.all('/sales/*', async (c) => {
  const db = getDb(c)
  const eventBus = createWiredEventBus(db)
  const routes = createCaisseRoutes(db, eventBus)
  return forwardToSubApp(c, routes, '/api/sales')
})

api.all('/sales', async (c) => {
  const db = getDb(c)
  const eventBus = createWiredEventBus(db)
  const routes = createCaisseRoutes(db, eventBus)
  const url = new URL(c.req.url)
  const newUrl = new URL('/', url.origin)
  newUrl.search = url.search
  const req = new Request(newUrl.toString(), c.req.raw)
  req.headers.set('X-Shop-Id', (c as any).get('user').shopId)
  return routes.fetch(req)
})

// Police ledger
api.all('/police-ledger/*', async (c) => {
  const db = getDb(c)
  const routes = createLivrePoliceRoutes(db)
  return forwardToSubApp(c, routes, '/api/police-ledger')
})

api.all('/police-ledger', async (c) => {
  const db = getDb(c)
  const routes = createLivrePoliceRoutes(db)
  const url = new URL(c.req.url)
  const newUrl = new URL('/', url.origin)
  newUrl.search = url.search
  const req = new Request(newUrl.toString(), c.req.raw)
  req.headers.set('X-Shop-Id', (c as any).get('user').shopId)
  return routes.fetch(req)
})

// ─── Closures (Z-ticket) ───

// Status endpoint: check if Z-closure is missing
api.get('/closures/status', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const shopId = user.shopId as ShopId

  const { sales } = await import('@caissette/caisse')

  // Find last daily closure
  const lastDailyClosure = await db.select({
    periodStart: closures.periodStart,
    periodEnd: closures.periodEnd,
    generatedAt: closures.generatedAt,
  }).from(closures)
    .where(and(eq(closures.shopId, shopId), eq(closures.type, 'daily')))
    .orderBy(desc(closures.generatedAt))
    .limit(1)

  const lastClosureDate = lastDailyClosure[0]
    ? new Date(lastDailyClosure[0].periodStart).toISOString().split('T')[0]
    : null

  // Check days with sales but no closure
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000)

  // Get all sales in last 7 days
  const recentSales = await db.select({
    soldAt: sales.soldAt,
  }).from(sales)
    .where(and(
      eq(sales.shopId, shopId),
      gte(sales.soldAt, sevenDaysAgo.getTime()),
    ))

  // Get all daily closures in last 7 days
  const recentClosures = await db.select({
    periodStart: closures.periodStart,
  }).from(closures)
    .where(and(
      eq(closures.shopId, shopId),
      eq(closures.type, 'daily'),
      gte(closures.periodStart, sevenDaysAgo.getTime()),
    ))

  // Find days with sales but no closure
  const closureDates = new Set(
    recentClosures.map(cl => new Date(cl.periodStart).toISOString().split('T')[0])
  )

  const salesDates = new Set(
    recentSales.map(s => {
      const d = new Date(s.soldAt)
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split('T')[0]
    })
  )

  // Don't count today (closure is done at end of day)
  const todayStr = today.toISOString().split('T')[0]!
  const missingDays: string[] = []
  for (const salesDate of salesDates) {
    if (salesDate !== todayStr && !closureDates.has(salesDate)) {
      missingDays.push(salesDate!)
    }
  }

  // Check if today has sales (for "has sales since last closure")
  const hasSalesToday = salesDates.has(todayStr!)
  const todayClosed = closureDates.has(todayStr!)

  return c.json({
    lastClosureDate,
    daysMissing: missingDays.length,
    missingDays: missingDays.sort(),
    hasSalesToday,
    todayClosed,
  })
})

api.get('/closures', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const result = await db.select().from(closures)
    .where(eq(closures.shopId, user.shopId))
    .orderBy(desc(closures.generatedAt))
    .limit(100)
  return c.json(result)
})

api.post('/closures', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const shopId = user.shopId as ShopId

  // Only owner/manager can generate closures
  if (user.role === 'cashier') {
    return c.json({ error: 'Seul un responsable peut generer une cloture' }, 403)
  }

  const body = await c.req.json()
  const type = body.type ?? 'daily' // 'daily' | 'monthly'

  // Calculate period bounds
  const tz = 'Europe/Paris'
  const now = new Date()
  let periodStart: number
  let periodEnd: number

  if (type === 'monthly') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    periodStart = firstDay.getTime()
    periodEnd = lastDay.getTime()
  } else {
    // Daily: today 00:00 to 23:59:59
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    periodStart = today.getTime()
    periodEnd = today.getTime() + 86400000 - 1
  }

  // Check if closure already exists for this period
  const existing = await db.select().from(closures)
    .where(and(
      eq(closures.shopId, shopId),
      eq(closures.type, type),
      eq(closures.periodStart, periodStart),
    ))
    .limit(1)
  if (existing.length > 0) {
    return c.json({ error: `Une cloture ${type === 'daily' ? 'journaliere' : 'mensuelle'} existe deja pour cette periode` }, 409)
  }

  // Aggregate sales for the period
  const { sales } = await import('@caissette/caisse')
  const periodSales = await db.select().from(sales)
    .where(and(
      eq(sales.shopId, shopId),
      gte(sales.soldAt, periodStart),
      lte(sales.soldAt, periodEnd),
    ))
    .orderBy(sales.receiptNumber)

  const salesCount = periodSales.length
  let totalAmount = 0
  let totalVat = 0
  const byPayment: Record<string, number> = {}
  const byVatRate: Record<string, number> = {}
  let firstReceiptNumber: number | null = null
  let lastReceiptNumber: number | null = null

  for (const s of periodSales) {
    totalAmount += s.total
    totalVat += s.vatMarginAmount
    byPayment[s.paymentMethod] = (byPayment[s.paymentMethod] ?? 0) + s.total
    if (firstReceiptNumber === null) firstReceiptNumber = s.receiptNumber
    lastReceiptNumber = s.receiptNumber
  }

  // Get VAT breakdown from sale_items
  const { saleItems } = await import('@caissette/caisse')
  if (periodSales.length > 0) {
    const saleIds = periodSales.map(s => s.id)
    for (const sId of saleIds) {
      const si = await db.select().from(saleItems).where(eq(saleItems.saleId, sId))
      for (const item of si) {
        const rateKey = String(item.vatRate)
        byVatRate[rateKey] = (byVatRate[rateKey] ?? 0) + item.vatAmount
      }
    }
  }

  // Get previous closure hash
  const lastClosure = await db.select({ hash: closures.hash }).from(closures)
    .where(and(eq(closures.shopId, shopId), eq(closures.type, type)))
    .orderBy(desc(closures.generatedAt))
    .limit(1)
  const previousClosureHash = (lastClosure[0]?.hash ?? null) as Hash | null

  const eventBus = createEventBus()
  const auditLogger = createAuditLogger(db, eventBus)

  const result = await generateClosure(db, eventBus, auditLogger, {
    shopId,
    type: type as any,
    periodStart,
    periodEnd,
    salesCount,
    totalAmount: totalAmount as Cents,
    totalVat: totalVat as Cents,
    totalsByPaymentMethod: byPayment as Record<string, Cents>,
    totalsByVatRate: byVatRate as Record<string, Cents>,
    firstReceiptNumber,
    lastReceiptNumber,
    previousClosureHash,
  }, (data: string) => signData(data, c.env))

  return c.json({
    id: result.id,
    hash: result.hash,
    type,
    salesCount,
    totalAmount,
    totalVat,
    periodStart,
    periodEnd,
  }, 201)
})

// ─── FEC Export (Fichier des Ecritures Comptables) ───

api.get('/export/fec', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const shopId = user.shopId as ShopId

  if (user.role === 'cashier') {
    return c.json({ error: 'Acces reserve aux responsables' }, 403)
  }

  const startParam = c.req.query('start')
  const endParam = c.req.query('end')
  if (!startParam || !endParam) {
    return c.json({ error: 'Parametres start et end requis (YYYY-MM-DD)' }, 400)
  }

  const start = new Date(startParam).getTime()
  const end = new Date(endParam + 'T23:59:59.999').getTime()

  const { sales, saleItems } = await import('@caissette/caisse')
  const { shops } = await import('@caissette/tenant')

  const shopResult = await db.select().from(shops).where(eq(shops.id, shopId)).limit(1)
  const shop = shopResult[0]
  const siren = shop?.siret?.slice(0, 9) ?? ''

  const periodSales = await db.select().from(sales)
    .where(and(eq(sales.shopId, shopId), gte(sales.soldAt, start), lte(sales.soldAt, end)))
    .orderBy(sales.receiptNumber)

  // FEC header (Art. A47 A-1 LPF)
  const header = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
    'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
    'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
    'EcrtureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
  ].join('\t')

  const lines: string[] = [header]

  for (const sale of periodSales) {
    const dateStr = formatFecDate(sale.soldAt)
    const ref = `T${sale.receiptNumber}`
    const isRefund = sale.status === 'refunded'
    const label = isRefund ? `AVOIR ${ref}` : `Vente ${ref}`
    const journal = isRefund ? 'AV' : 'VE'
    const journalLib = isRefund ? 'Avoirs' : 'Ventes'
    const amount = Math.abs(sale.total)
    const vatAmount = Math.abs(sale.vatMarginAmount)

    // Payment account: debit for sales, credit for refunds
    const payAccount = sale.paymentMethod === 'cash' ? '530000' : '512000'
    const payLabel = sale.paymentMethod === 'cash' ? 'Caisse' : 'Banque'
    lines.push(fecLine(journal, journalLib, ref, dateStr, payAccount, payLabel, '', '', ref, dateStr,
      label, isRefund ? '0,00' : formatFecAmount(amount), isRefund ? formatFecAmount(amount) : '0,00', '', '', dateStr, '', 'EUR'))

    // Revenue: credit for sales, debit for refunds
    const ht = amount - vatAmount
    if (ht > 0) {
      lines.push(fecLine(journal, journalLib, ref, dateStr, '707000', 'Ventes de marchandises', '', '', ref, dateStr,
        `${label} HT`, isRefund ? formatFecAmount(ht) : '0,00', isRefund ? '0,00' : formatFecAmount(ht), '', '', dateStr, '', 'EUR'))
    }

    // VAT: credit for sales, debit for refunds
    if (vatAmount > 0) {
      lines.push(fecLine(journal, journalLib, ref, dateStr, '445710', 'TVA collectee', '', '', ref, dateStr,
        `TVA ${label}`, isRefund ? formatFecAmount(vatAmount) : '0,00', isRefund ? '0,00' : formatFecAmount(vatAmount), '', '', dateStr, '', 'EUR'))
    }
  }

  const content = lines.join('\n')
  const filename = `FEC${siren}${startParam.replace(/-/g, '')}.txt`

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

// ─── Attestation editeur ───

api.get('/attestation', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const { shops } = await import('@caissette/tenant')
  const shopResult = await db.select().from(shops).where(eq(shops.id, user.shopId)).limit(1)
  const shop = shopResult[0]
  if (!shop) return c.json({ error: 'Boutique introuvable' }, 404)

  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return c.json({
    title: 'ATTESTATION DE CONFORMITE',
    subtitle: 'Article 286, I-3° bis du Code General des Impots',
    editor: {
      name: 'Caissette',
      software: 'Caissette',
      version: '1.0.0',
    },
    client: {
      name: shop.name,
      siret: shop.siret,
      address: shop.address,
    },
    date: dateStr,
    conditions: [
      {
        name: 'Inalterabilite',
        description: 'Les donnees de reglement sont enregistrees de maniere definitive. Aucune modification ni suppression des ventes n\'est possible apres enregistrement.',
        method: 'Chainages de hash SHA-256 sur les ventes, clotures et livre de police.',
      },
      {
        name: 'Securisation',
        description: 'Les donnees sont securisees par un procede de chainage cryptographique conforme au CDC 7.1.',
        method: 'Hash chaine SHA-256 : hash(N) = SHA-256(hash(N-1) || payload || N° ticket || timestamp).',
      },
      {
        name: 'Conservation',
        description: 'Les donnees sont conservees sur une duree minimale de 6 ans dans un format non modifiable.',
        method: 'Stockage Cloudflare D1 avec sauvegardes automatiques. Export FEC disponible.',
      },
      {
        name: 'Archivage',
        description: 'Des clotures periodiques (journalieres et mensuelles) sont generees et signees.',
        method: 'Clotures Z (journalieres) et mensuelles avec hash chaine et signature numerique.',
      },
    ],
  })
})

// ─── Reversements (depositor payments) ───

api.get('/reversements', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const depositorId = c.req.query('depositorId')

  let query = db.select().from(reversements)
    .where(eq(reversements.shopId, user.shopId))
    .orderBy(desc(reversements.createdAt))
    .limit(100)

  if (depositorId) {
    query = db.select().from(reversements)
      .where(and(eq(reversements.shopId, user.shopId), eq(reversements.depositorId, depositorId)))
      .orderBy(desc(reversements.createdAt))
      .limit(100)
  }

  const result = await query
  return c.json(result)
})

api.post('/reversements', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')

  if (user.role === 'cashier') {
    return c.json({ error: 'Seul un responsable peut creer un reversement' }, 403)
  }

  const body = await c.req.json()
  const { depositorId, periodStart, periodEnd } = body

  if (!depositorId || !periodStart || !periodEnd) {
    return c.json({ error: 'depositorId, periodStart et periodEnd requis' }, 400)
  }

  // Calculate from sale_items for this depositor in the period
  const { sales, saleItems } = await import('@caissette/caisse')

  const periodSales = await db.select().from(sales)
    .where(and(
      eq(sales.shopId, user.shopId),
      gte(sales.soldAt, periodStart),
      lte(sales.soldAt, periodEnd),
    ))

  let totalSales = 0
  let totalCommission = 0
  let totalReversement = 0

  for (const sale of periodSales) {
    const si = await db.select().from(saleItems)
      .where(and(eq(saleItems.saleId, sale.id), eq(saleItems.depositorId, depositorId)))

    for (const item of si) {
      totalSales += item.price
      const rev = item.reversementAmount ?? 0
      totalReversement += rev
      totalCommission += item.price - rev
    }
  }

  const id = crypto.randomUUID()
  await db.insert(reversements).values({
    id,
    shopId: user.shopId,
    depositorId,
    periodStart,
    periodEnd,
    totalSales,
    totalCommission,
    totalReversement,
    status: 'pending',
    createdAt: Date.now(),
  })

  return c.json({ id, totalSales, totalCommission, totalReversement }, 201)
})

api.patch('/reversements/:id', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const id = c.req.param('id')

  if (user.role === 'cashier') {
    return c.json({ error: 'Seul un responsable peut modifier un reversement' }, 403)
  }

  const body = await c.req.json()
  const updates: Record<string, any> = {}

  if (body.status === 'paid') {
    updates.status = 'paid'
    updates.paidAt = Date.now()
    updates.paidBy = user.id
    if (body.paymentMethod) updates.paymentMethod = body.paymentMethod
  } else if (body.status === 'cancelled') {
    updates.status = 'cancelled'
  }

  if (body.notes !== undefined) updates.notes = body.notes

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'Aucune modification' }, 400)
  }

  await db.update(reversements)
    .set(updates)
    .where(and(eq(reversements.id, id), eq(reversements.shopId, user.shopId)))

  return c.json({ ok: true })
})

// ─── Categories ───

function slugify(str: string): string {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

api.get('/categories', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const showAll = c.req.query('all') === '1'

  const conditions = [eq(categories.shopId, user.shopId)]
  if (!showAll) {
    conditions.push(eq(categories.active, 1))
  }

  const result = await db.select().from(categories)
    .where(and(...conditions))
    .orderBy(categories.sortOrder)
  return c.json(result)
})

api.post('/categories', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  if (!hasRole(user.role, 'manager')) return c.json({ error: 'Acces refuse' }, 403)

  const body = await c.req.json()
  if (!body.name?.trim()) return c.json({ error: 'Nom requis' }, 400)

  const id = crypto.randomUUID()
  const slug = slugify(body.name)
  const now = Date.now()

  // Get max sortOrder
  const last = await db.select({ max: sql`MAX(sort_order)` }).from(categories)
    .where(eq(categories.shopId, user.shopId))
  const sortOrder = body.sortOrder ?? ((last[0]?.max as number ?? 0) + 1)

  await db.insert(categories).values({
    id,
    shopId: user.shopId,
    name: body.name.trim(),
    slug,
    color: body.color ?? null,
    sortOrder,
    active: 1,
    showInFilters: 1,
    createdAt: now,
  })

  return c.json({ id, slug }, 201)
})

api.patch('/categories/:id', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  if (!hasRole(user.role, 'manager')) return c.json({ error: 'Acces refuse' }, 403)

  const id = c.req.param('id')
  const body = await c.req.json()
  const updates: Record<string, any> = {}

  if (body.name !== undefined) { updates.name = body.name; updates.slug = slugify(body.name) }
  if (body.color !== undefined) updates.color = body.color
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder
  if (body.active !== undefined) updates.active = body.active ? 1 : 0
  if (body.showInFilters !== undefined) updates.showInFilters = body.showInFilters ? 1 : 0

  if (Object.keys(updates).length === 0) return c.json({ error: 'Aucune modification' }, 400)

  await db.update(categories).set(updates)
    .where(and(eq(categories.id, id), eq(categories.shopId, user.shopId)))
  return c.json({ ok: true })
})

api.delete('/categories/:id', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  if (!hasRole(user.role, 'manager')) return c.json({ error: 'Acces refuse' }, 403)

  const id = c.req.param('id')
  await db.delete(categories)
    .where(and(eq(categories.id, id), eq(categories.shopId, user.shopId)))
  return c.json({ ok: true })
})

api.post('/categories/seed', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  if (!hasRole(user.role, 'manager')) return c.json({ error: 'Acces refuse' }, 403)

  const defaults = [
    'Vetements', 'Chaussures', 'Accessoires', 'Maison', 'Livres',
    'Jouets', 'Electronique', 'Sport', 'Decoration', 'Sacs',
    'Service', 'Location', 'Reparation',
  ]
  const now = Date.now()
  let order = 0

  for (const name of defaults) {
    const slug = slugify(name)
    const existing = await db.select({ id: categories.id }).from(categories)
      .where(and(eq(categories.shopId, user.shopId), eq(categories.slug, slug)))
      .limit(1)
    if (existing.length === 0) {
      await db.insert(categories).values({
        id: crypto.randomUUID(),
        shopId: user.shopId,
        name,
        slug,
        color: null,
        sortOrder: order,
        active: 1,
        showInFilters: 1,
        createdAt: now,
      })
    }
    order++
  }

  return c.json({ ok: true, count: defaults.length }, 201)
})

// ─── Users Management ───

api.get('/users', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  if (!hasRole(user.role, 'manager')) return c.json({ error: 'Acces refuse' }, 403)

  const result = await db.select({
    id: usersTable.id,
    shopId: usersTable.shopId,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    active: usersTable.active,
    permissionsJson: usersTable.permissionsJson,
    createdAt: usersTable.createdAt,
    lastLoginAt: usersTable.lastLoginAt,
  }).from(usersTable)
    .where(eq(usersTable.shopId, user.shopId))
    .orderBy(usersTable.createdAt)

  return c.json(result)
})

api.post('/users', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  if (user.role !== 'owner') return c.json({ error: 'Seul le proprietaire peut creer des utilisateurs' }, 403)

  const body = await c.req.json()
  if (!body.email || !body.name || !body.password) {
    return c.json({ error: 'email, name et password requis' }, 400)
  }

  const role = body.role ?? 'cashier'
  if (!['owner', 'manager', 'cashier', 'accountant'].includes(role)) {
    return c.json({ error: 'Role invalide' }, 400)
  }

  // Check for duplicate email
  const existing = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.shopId, user.shopId), eq(usersTable.email, body.email)))
    .limit(1)
  if (existing.length > 0) return c.json({ error: 'Cet email est deja utilise' }, 409)

  const id = generateUuidV7()
  const passwordHashValue = await hashPassword(body.password)
  const now = Date.now()

  await db.insert(usersTable).values({
    id,
    shopId: user.shopId,
    email: body.email,
    name: body.name,
    role,
    passwordHash: passwordHashValue,
    active: 1,
    permissionsJson: body.permissions ? JSON.stringify(body.permissions) : null,
    createdAt: now,
  })

  return c.json({ id, email: body.email, name: body.name, role }, 201)
})

api.patch('/users/:id', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  if (user.role !== 'owner') return c.json({ error: 'Seul le proprietaire peut modifier les utilisateurs' }, 403)

  const id = c.req.param('id')
  const body = await c.req.json()
  const updates: Record<string, any> = {}

  if (body.name !== undefined) updates.name = body.name
  if (body.email !== undefined) updates.email = body.email
  if (body.role !== undefined) {
    if (!['owner', 'manager', 'cashier', 'accountant'].includes(body.role)) {
      return c.json({ error: 'Role invalide' }, 400)
    }
    updates.role = body.role
  }
  if (body.active !== undefined) updates.active = body.active ? 1 : 0
  if (body.permissions !== undefined) updates.permissionsJson = JSON.stringify(body.permissions)
  if (body.password) updates.passwordHash = await hashPassword(body.password)

  if (Object.keys(updates).length === 0) return c.json({ error: 'Aucune modification' }, 400)

  await db.update(usersTable).set(updates)
    .where(and(eq(usersTable.id, id), eq(usersTable.shopId, user.shopId)))
  return c.json({ ok: true })
})

api.delete('/users/:id', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  if (user.role !== 'owner') return c.json({ error: 'Seul le proprietaire peut supprimer des utilisateurs' }, 403)

  const id = c.req.param('id')
  if (id === user.id) return c.json({ error: 'Vous ne pouvez pas vous desactiver vous-meme' }, 400)

  // Check not the last owner
  const target = await db.select({ role: usersTable.role }).from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.shopId, user.shopId)))
    .limit(1)
  if (target[0]?.role === 'owner') {
    const ownerCount = await db.select({ count: sql`COUNT(*)` }).from(usersTable)
      .where(and(eq(usersTable.shopId, user.shopId), eq(usersTable.role, 'owner'), eq(usersTable.active, 1)))
    if ((ownerCount[0]?.count as number) <= 1) {
      return c.json({ error: 'Impossible de desactiver le dernier proprietaire' }, 400)
    }
  }

  // Soft delete (set active=0)
  await db.update(usersTable).set({ active: 0 })
    .where(and(eq(usersTable.id, id), eq(usersTable.shopId, user.shopId)))
  return c.json({ ok: true })
})

api.post('/users/:id/reset-password', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  if (user.role !== 'owner') return c.json({ error: 'Seul le proprietaire peut reinitialiser les mots de passe' }, 403)

  const id = c.req.param('id')
  const body = await c.req.json()
  if (!body.password) return c.json({ error: 'Nouveau mot de passe requis' }, 400)

  const passwordHashValue = await hashPassword(body.password)
  await db.update(usersTable).set({ passwordHash: passwordHashValue })
    .where(and(eq(usersTable.id, id), eq(usersTable.shopId, user.shopId)))
  return c.json({ ok: true })
})

// ─── Cash Movements ───

api.post('/cash-movements', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')

  const body = await c.req.json()
  if (!body.type || body.amount === undefined) {
    return c.json({ error: 'type et amount requis' }, 400)
  }

  const validTypes = ['opening_float', 'closing_count', 'deposit', 'withdrawal']
  if (!validTypes.includes(body.type)) {
    return c.json({ error: 'Type invalide' }, 400)
  }

  const id = crypto.randomUUID()
  const now = Date.now()

  await db.insert(cashMovements).values({
    id,
    shopId: user.shopId,
    userId: user.id,
    type: body.type,
    amount: body.amount,
    note: body.note ?? null,
    recordedAt: body.recordedAt ?? now,
    createdAt: now,
  })

  return c.json({ id }, 201)
})

api.get('/cash-movements', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')

  if (!hasRole(user.role, 'manager') && user.role !== 'accountant') {
    return c.json({ error: 'Acces refuse' }, 403)
  }

  const dateParam = c.req.query('date')
  const conditions = [eq(cashMovements.shopId, user.shopId)]

  if (dateParam) {
    const dayStart = new Date(dateParam).getTime()
    const dayEnd = dayStart + 86400000 - 1
    conditions.push(gte(cashMovements.recordedAt, dayStart))
    conditions.push(lte(cashMovements.recordedAt, dayEnd))
  }

  const result = await db.select().from(cashMovements)
    .where(and(...conditions))
    .orderBy(cashMovements.recordedAt)

  return c.json(result)
})

// ─── Journal de Caisse ───

api.get('/journal', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')

  if (!hasRole(user.role, 'manager') && user.role !== 'accountant') {
    return c.json({ error: 'Acces refuse' }, 403)
  }

  const dateParam = c.req.query('date')
  if (!dateParam) return c.json({ error: 'Parametre date requis (YYYY-MM-DD)' }, 400)

  const dayStart = new Date(dateParam).getTime()
  const dayEnd = dayStart + 86400000 - 1

  // Get sales for the day
  const { sales, saleItems } = await import('@caissette/caisse')
  const daySales = await db.select().from(sales)
    .where(and(
      eq(sales.shopId, user.shopId),
      gte(sales.soldAt, dayStart),
      lte(sales.soldAt, dayEnd),
    ))
    .orderBy(sales.soldAt)

  // Get cash movements for the day
  const dayMovements = await db.select().from(cashMovements)
    .where(and(
      eq(cashMovements.shopId, user.shopId),
      gte(cashMovements.recordedAt, dayStart),
      lte(cashMovements.recordedAt, dayEnd),
    ))
    .orderBy(cashMovements.recordedAt)

  // Build sales summary
  const totalByPaymentMethod: Record<string, number> = {}
  let totalSales = 0
  let totalRefunds = 0
  let salesCount = 0
  let refundsCount = 0

  const salesList = daySales.map((s: any) => {
    totalByPaymentMethod[s.paymentMethod] = (totalByPaymentMethod[s.paymentMethod] ?? 0) + s.total
    if (s.total >= 0) { totalSales += s.total; salesCount++ }
    else { totalRefunds += Math.abs(s.total); refundsCount++ }
    return {
      id: s.id,
      receiptNumber: s.receiptNumber,
      soldAt: s.soldAt,
      cashierId: s.cashierId,
      total: s.total,
      paymentMethod: s.paymentMethod,
      status: s.status,
    }
  })

  // Cash calculation
  let openingFloat = 0
  let closingCount = 0
  let depositsTotal = 0
  let withdrawalsTotal = 0
  let hasClosing = false

  for (const m of dayMovements) {
    if (m.type === 'opening_float') openingFloat = m.amount
    if (m.type === 'closing_count') { closingCount = m.amount; hasClosing = true }
    if (m.type === 'deposit') depositsTotal += m.amount
    if (m.type === 'withdrawal') withdrawalsTotal += m.amount
  }

  const cashSales = totalByPaymentMethod['cash'] ?? 0
  const cashExpected = openingFloat + cashSales + depositsTotal - withdrawalsTotal
  const cashDiscrepancy = hasClosing ? closingCount - cashExpected : null

  return c.json({
    date: dateParam,
    sales: salesList,
    cashMovements: dayMovements,
    summary: {
      totalByPaymentMethod,
      totalSales,
      totalRefunds,
      cashExpected,
      cashCounted: hasClosing ? closingCount : null,
      cashDiscrepancy,
      salesCount,
      refundsCount,
      openingFloat,
    },
  })
})

// ─── Dashboard ───

api.get('/dashboard', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const shopId = user.shopId
  const { sales, saleItems } = await import('@caissette/caisse')

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  // Today's sales
  const todaySales = await db.select().from(sales)
    .where(and(eq(sales.shopId, shopId), gte(sales.soldAt, todayStart), eq(sales.status, 'completed')))

  const caToday = todaySales.reduce((sum: number, s: any) => sum + s.total, 0)
  const countToday = todaySales.length

  // Month's sales
  const monthSales = await db.select().from(sales)
    .where(and(eq(sales.shopId, shopId), gte(sales.soldAt, monthStart), eq(sales.status, 'completed')))

  const caMonth = monthSales.reduce((sum: number, s: any) => sum + s.total, 0)
  const countMonth = monthSales.length

  // Top 5 articles sold this month
  const monthSaleIds = monthSales.map((s: any) => s.id)
  const topItems: Record<string, { name: string; count: number; revenue: number }> = {}

  for (const sId of monthSaleIds) {
    const si = await db.select().from(saleItems).where(eq(saleItems.saleId, sId))
    for (const item of si) {
      if (item.price > 0) {
        const key = item.name
        if (!topItems[key]) topItems[key] = { name: key, count: 0, revenue: 0 }
        topItems[key].count++
        topItems[key].revenue += item.price
      }
    }
  }

  const topArticles = Object.values(topItems)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Payment method breakdown (month)
  const byPayment: Record<string, number> = {}
  for (const s of monthSales) {
    byPayment[(s as any).paymentMethod] = (byPayment[(s as any).paymentMethod] ?? 0) + (s as any).total
  }

  return c.json({
    today: { ca: caToday, count: countToday },
    month: { ca: caMonth, count: countMonth },
    topArticles,
    byPayment,
  })
})

// ─── Invoices ───

api.post('/invoices', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const body = await c.req.json()
  const { saleId, clientName, clientAddress, clientSiret } = body

  if (!saleId) return c.json({ error: 'saleId requis' }, 400)

  const { sales, saleItems } = await import('@caissette/caisse')
  const { shops } = await import('@caissette/tenant')

  // Get sale
  const saleResult = await db.select().from(sales)
    .where(and(eq(sales.id, saleId), eq(sales.shopId, user.shopId)))
    .limit(1)
  const sale = saleResult[0]
  if (!sale) return c.json({ error: 'Vente introuvable' }, 404)

  // Get sale items
  const itemsResult = await db.select().from(saleItems)
    .where(eq(saleItems.saleId, saleId))

  // Get shop info
  const shopResult = await db.select().from(shops)
    .where(eq(shops.id, user.shopId)).limit(1)
  const shop = shopResult[0]

  // Generate sequential invoice number (FACT-YYYY-NNNN)
  // Count existing invoices this year by counting sales with invoiceNumber set
  // Since we don't have an invoices table, we'll generate the number from receipt
  const year = new Date(sale.soldAt).getFullYear()
  const invoiceNumber = `FACT-${year}-${String(sale.receiptNumber).padStart(4, '0')}`

  const ht = sale.total - sale.vatMarginAmount

  return c.json({
    invoiceNumber,
    date: new Date(sale.soldAt).toISOString(),
    seller: {
      name: shop?.name ?? '',
      siret: shop?.siret ?? '',
      vatNumber: shop?.vatNumber ?? '',
      address: shop?.address ?? '',
    },
    client: {
      name: clientName ?? 'Client comptoir',
      address: clientAddress ?? '',
      siret: clientSiret ?? '',
    },
    items: itemsResult.map((item: any) => ({
      name: item.name,
      quantity: 1,
      unitPriceHT: item.vatRegime === 'normal'
        ? Math.round(item.price / (1 + item.vatRate / 10000))
        : item.price - item.vatAmount,
      vatRate: item.vatRate / 100,
      vatAmount: item.vatAmount,
      totalTTC: item.price,
    })),
    totalHT: ht,
    totalVAT: sale.vatMarginAmount,
    totalTTC: sale.total,
    paymentMethod: sale.paymentMethod,
    receiptNumber: sale.receiptNumber,
    legalMentions: [
      shop?.vatNumber ? `TVA intracommunautaire : ${shop.vatNumber}` : null,
      'Conditions de paiement : comptant',
      'Pas d\'escompte pour paiement anticipe',
      'En cas de retard de paiement, indemnite forfaitaire de 40 EUR pour frais de recouvrement (art. L.441-10 C. com.)',
    ].filter(Boolean),
  })
})

// ─── VAT Summary ───

api.get('/vat-summary', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')

  if (user.role === 'cashier') {
    return c.json({ error: 'Acces reserve aux responsables' }, 403)
  }

  const startParam = c.req.query('start')
  const endParam = c.req.query('end')
  if (!startParam || !endParam) {
    return c.json({ error: 'Parametres start et end requis (YYYY-MM-DD)' }, 400)
  }

  const start = new Date(startParam).getTime()
  const end = new Date(endParam + 'T23:59:59.999').getTime()

  const { sales, saleItems } = await import('@caissette/caisse')

  const periodSales = await db.select().from(sales)
    .where(and(
      eq(sales.shopId, user.shopId),
      gte(sales.soldAt, start),
      lte(sales.soldAt, end),
      // Include both completed and refunded
    ))
    .orderBy(sales.receiptNumber)

  // Aggregate by VAT rate and regime
  const byRate: Record<string, { baseHT: number; vatAmount: number; totalTTC: number; count: number }> = {}
  const byPayment: Record<string, number> = {}
  let totalHT = 0
  let totalVAT = 0
  let totalTTC = 0
  let salesCount = 0
  let refundsCount = 0

  for (const sale of periodSales) {
    if (sale.status === 'completed') salesCount++
    if (sale.status === 'refunded') refundsCount++

    byPayment[sale.paymentMethod] = (byPayment[sale.paymentMethod] ?? 0) + sale.total
    totalTTC += sale.total
    totalVAT += sale.vatMarginAmount
    totalHT += sale.total - sale.vatMarginAmount

    const si = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id))
    for (const item of si) {
      const rateKey = `${item.vatRegime}:${item.vatRate}`
      if (!byRate[rateKey]) {
        byRate[rateKey] = { baseHT: 0, vatAmount: 0, totalTTC: 0, count: 0 }
      }
      byRate[rateKey].baseHT += item.price - item.vatAmount
      byRate[rateKey].vatAmount += item.vatAmount
      byRate[rateKey].totalTTC += item.price
      byRate[rateKey].count++
    }
  }

  // Format the rate breakdown
  const vatBreakdown = Object.entries(byRate).map(([key, data]) => {
    const [regime, rateStr = '0'] = key.split(':')
    return {
      regime,
      rate: parseInt(rateStr) / 100,
      rateLabel: `${(parseInt(rateStr) / 100).toFixed(1)}%`,
      ...data,
    }
  }).sort((a, b) => b.totalTTC - a.totalTTC)

  return c.json({
    period: { start: startParam, end: endParam },
    salesCount,
    refundsCount,
    totalHT,
    totalVAT,
    totalTTC,
    vatBreakdown,
    byPayment,
  })
})

// ─── CSV Export ───

api.get('/export/csv', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')

  if (user.role === 'cashier') {
    return c.json({ error: 'Acces reserve aux responsables' }, 403)
  }

  const startParam = c.req.query('start')
  const endParam = c.req.query('end')
  if (!startParam || !endParam) {
    return c.json({ error: 'Parametres start et end requis (YYYY-MM-DD)' }, 400)
  }

  const start = new Date(startParam).getTime()
  const end = new Date(endParam + 'T23:59:59.999').getTime()

  const { sales, saleItems } = await import('@caissette/caisse')

  const periodSales = await db.select().from(sales)
    .where(and(eq(sales.shopId, user.shopId), gte(sales.soldAt, start), lte(sales.soldAt, end)))
    .orderBy(sales.receiptNumber)

  // CSV header
  const header = 'Date;N° Ticket;Article;Quantite;Prix TTC;TVA;Regime TVA;Taux TVA;Moyen de paiement;Statut'
  const lines: string[] = [header]

  for (const sale of periodSales) {
    const si = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id))
    const dateStr = new Date(sale.soldAt).toLocaleDateString('fr-FR')
    const payment = sale.paymentMethod === 'cash' ? 'Especes' : sale.paymentMethod === 'card' ? 'Carte' : sale.paymentMethod === 'check' ? 'Cheque' : 'Autre'
    const status = sale.status === 'completed' ? 'Terminee' : sale.status === 'refunded' ? 'Remboursee' : sale.status

    for (const item of si) {
      const regime = item.vatRegime === 'deposit' ? 'Marge (depot)' : item.vatRegime === 'normal' ? 'Normale' : 'Marge'
      lines.push([
        dateStr,
        sale.receiptNumber,
        `"${item.name.replace(/"/g, '""')}"`,
        1,
        (item.price / 100).toFixed(2).replace('.', ','),
        (item.vatAmount / 100).toFixed(2).replace('.', ','),
        regime,
        `${(item.vatRate / 100).toFixed(1)}%`,
        payment,
        status,
      ].join(';'))
    }
  }

  const content = lines.join('\n')
  const filename = `ventes_${startParam}_${endParam}.csv`

  return new Response(content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

app.route('/api', api)

// ─── FEC helpers ───

function formatFecDate(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function formatFecAmount(cents: number): string {
  const euros = Math.abs(cents) / 100
  return euros.toFixed(2).replace('.', ',')
}

function fecLine(...fields: string[]): string {
  return fields.join('\t')
}

export default app
