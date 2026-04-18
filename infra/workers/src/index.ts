import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { createEventBus } from '@rebond/event-bus'
import { createAuthRoutes, createAuthMiddleware, requireAuth } from '@rebond/auth'
import { tenantMiddleware, createTenantRoutes } from '@rebond/tenant'
import { createDepotsRoutes } from '@rebond/depots'
import { createCatalogRoutes } from '@rebond/catalog'
import { createCaisseRoutes } from '@rebond/caisse'
import { createLivrePoliceRoutes } from '@rebond/livre-police'

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
    origin: ['https://app.rebond.fr', 'https://app-preview.rebond.fr', 'http://localhost:5173'],
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

// ─── Protected API ───
const api = new Hono<{ Bindings: Env }>()
api.use('*', createAuthMiddleware(getDb))
api.use('*', requireAuth)

// Shop settings (needs auth)
api.get('/shop', async (c) => {
  const db = getDb(c)
  const { shops } = await import('@rebond/tenant')
  const { eq } = await import('drizzle-orm')
  const user = (c as any).get('user')
  const result = await db.select().from(shops).where(eq(shops.id, user.shopId)).limit(1)
  if (result.length === 0) return c.json({ error: 'Boutique introuvable' }, 404)
  return c.json(result[0])
})

api.patch('/shop', async (c) => {
  const db = getDb(c)
  const { shops } = await import('@rebond/tenant')
  const { eq } = await import('drizzle-orm')
  const user = (c as any).get('user')
  const body = await c.req.json()
  await db.update(shops).set(body).where(eq(shops.id, user.shopId))
  return c.json({ ok: true })
})

// Depositors
api.all('/depositors/*', async (c) => {
  const db = getDb(c)
  const eventBus = createEventBus()
  const routes = createDepotsRoutes(db, eventBus)
  const url = new URL(c.req.url)
  const path = url.pathname.replace('/api/depositors', '') || '/'
  const newUrl = new URL(path, url.origin)
  newUrl.search = url.search
  const req = new Request(newUrl.toString(), c.req.raw)
  req.headers.set('X-Shop-Id', (c as any).get('user').shopId)
  return routes.fetch(req)
})

api.all('/depositors', async (c) => {
  const db = getDb(c)
  const eventBus = createEventBus()
  const routes = createDepotsRoutes(db, eventBus)
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
  const eventBus = createEventBus()
  const routes = createCatalogRoutes(db, eventBus)
  const url = new URL(c.req.url)
  const path = url.pathname.replace('/api/items', '') || '/'
  const newUrl = new URL(path, url.origin)
  newUrl.search = url.search
  const req = new Request(newUrl.toString(), c.req.raw)
  req.headers.set('X-Shop-Id', (c as any).get('user').shopId)
  return routes.fetch(req)
})

api.all('/items', async (c) => {
  const db = getDb(c)
  const eventBus = createEventBus()
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
  const eventBus = createEventBus()
  const routes = createCaisseRoutes(db, eventBus)
  const url = new URL(c.req.url)
  const path = url.pathname.replace('/api/sales', '') || '/'
  const newUrl = new URL(path, url.origin)
  newUrl.search = url.search
  const req = new Request(newUrl.toString(), c.req.raw)
  req.headers.set('X-Shop-Id', (c as any).get('user').shopId)
  return routes.fetch(req)
})

api.all('/sales', async (c) => {
  const db = getDb(c)
  const eventBus = createEventBus()
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
  const url = new URL(c.req.url)
  const path = url.pathname.replace('/api/police-ledger', '') || '/'
  const newUrl = new URL(path, url.origin)
  newUrl.search = url.search
  const req = new Request(newUrl.toString(), c.req.raw)
  req.headers.set('X-Shop-Id', (c as any).get('user').shopId)
  return routes.fetch(req)
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
