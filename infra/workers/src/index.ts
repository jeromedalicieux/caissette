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
import { computeHash } from '@rebond/utils'

type Env = {
  DB: D1Database
  KV: KVNamespace
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

// ─── HMAC signature for closures (no Ed25519 keys yet) ───
async function hmacSign(data: string): Promise<string> {
  return computeHash(`sign:${data}`)
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
  }, hmacSign)

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
