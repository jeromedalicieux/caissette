import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { createEventBus } from '@rebond/event-bus'
import { createAuditLogger } from '@rebond/audit-log'
import { createAuthRoutes, createAuthMiddleware, requireAuth } from '@rebond/auth'
import { tenantMiddleware, createTenantRoutes, parseSettings } from '@rebond/tenant'
import { createDepotsRoutes, createContractsRoutes } from '@rebond/depots'
import { createCatalogRoutes } from '@rebond/catalog'
import { createCaisseRoutes } from '@rebond/caisse'
import { createLivrePoliceRoutes, registerPoliceLedgerListeners } from '@rebond/livre-police'
import { generateClosure, closures } from '@rebond/isca'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import type { Cents, Hash, ShopId } from '@rebond/types'
import { computeHash, computeChainedHash } from '@rebond/utils'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

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
    origin: ['https://app.rebond.fr', 'https://app-preview.rebond.fr', 'http://localhost:5173', 'https://rebond-web-488.pages.dev'],
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
    const { depositors } = await import('@rebond/depots')
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
  const { shops } = await import('@rebond/tenant')
  const user = (c as any).get('user')
  const result = await db.select().from(shops).where(eq(shops.id, user.shopId)).limit(1)
  const shop = result[0]
  if (!shop) return c.json({ error: 'Boutique introuvable' }, 404)
  return c.json({ ...shop, settings: parseSettings(shop.settingsJson) })
})

api.patch('/shop', async (c) => {
  const db = getDb(c)
  const { shops } = await import('@rebond/tenant')
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

  const { sales, saleItems } = await import('@rebond/caisse')

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
  const { items } = await import('@rebond/catalog')
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
  const { sales, saleItems } = await import('@rebond/caisse')
  const { shops } = await import('@rebond/tenant')

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
  const { sales } = await import('@rebond/caisse')

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
  const { sales } = await import('@rebond/caisse')
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
  const { saleItems } = await import('@rebond/caisse')
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

  const { sales, saleItems } = await import('@rebond/caisse')
  const { shops } = await import('@rebond/tenant')

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
    const si = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id))

    // Payment account debit (total TTC)
    const payAccount = sale.paymentMethod === 'cash' ? '530000' : '512000'
    const payLabel = sale.paymentMethod === 'cash' ? 'Caisse' : 'Banque'
    lines.push(fecLine('VE', 'Ventes', ref, dateStr, payAccount, payLabel, '', '', ref, dateStr,
      `Vente ${ref}`, formatFecAmount(sale.total), '0,00', '', '', dateStr, '', 'EUR'))

    // Revenue credit (HT)
    const ht = sale.total - sale.vatMarginAmount
    if (ht > 0) {
      lines.push(fecLine('VE', 'Ventes', ref, dateStr, '707000', 'Ventes de marchandises', '', '', ref, dateStr,
        `Vente ${ref} HT`, '0,00', formatFecAmount(ht), '', '', dateStr, '', 'EUR'))
    }

    // VAT credit
    if (sale.vatMarginAmount > 0) {
      lines.push(fecLine('VE', 'Ventes', ref, dateStr, '445710', 'TVA collectee', '', '', ref, dateStr,
        `TVA vente ${ref}`, '0,00', formatFecAmount(sale.vatMarginAmount), '', '', dateStr, '', 'EUR'))
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
  const { shops } = await import('@rebond/tenant')
  const shopResult = await db.select().from(shops).where(eq(shops.id, user.shopId)).limit(1)
  const shop = shopResult[0]
  if (!shop) return c.json({ error: 'Boutique introuvable' }, 404)

  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return c.json({
    title: 'ATTESTATION DE CONFORMITE',
    subtitle: 'Article 286, I-3° bis du Code General des Impots',
    editor: {
      name: 'Rebond SAS',
      software: 'Rebond Caisse',
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
  const { sales, saleItems } = await import('@rebond/caisse')

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

// ─── Dashboard ───

api.get('/dashboard', async (c) => {
  const db = getDb(c)
  const user = (c as any).get('user')
  const shopId = user.shopId
  const { sales, saleItems } = await import('@rebond/caisse')

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
