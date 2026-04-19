import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { createEventBus } from '@rebond/event-bus'
import { createAuthRoutes, createAuthMiddleware, requireAuth } from '@rebond/auth'
import { tenantMiddleware, createTenantRoutes, parseSettings } from '@rebond/tenant'
import { createDepotsRoutes, createContractsRoutes } from '@rebond/depots'
import { createCatalogRoutes } from '@rebond/catalog'
import { createCaisseRoutes } from '@rebond/caisse'
import { createLivrePoliceRoutes, registerPoliceLedgerListeners } from '@rebond/livre-police'
import { eq } from 'drizzle-orm'

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

// Sales
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

app.route('/api', api)

export default app
