import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { drizzle } from 'drizzle-orm/d1'
import { createEventBus } from '@rebond/event-bus'
import { createAuditLogger } from '@rebond/audit-log'
import { tenantMiddleware } from '@rebond/tenant'
import { authMiddleware } from '@rebond/auth'
import { createDepotsRoutes } from '@rebond/depots'
import { createCatalogRoutes } from '@rebond/catalog'
import { createCaisseRoutes } from '@rebond/caisse'

type Env = {
  DB: D1Database
  R2: R2Bucket
  KV: KVNamespace
  EVENTS_QUEUE: Queue
}

const app = new Hono<{ Bindings: Env }>()

// Global middleware
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['https://app.rebond.fr', 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Shop-Id', 'X-User-Id'],
    credentials: true,
  }),
)

// Health check
app.get('/health', (c) => c.json({ status: 'ok', version: '0.0.1' }))

// API routes — tenant + auth required
app.use('/api/*', tenantMiddleware)
app.use('/api/*', authMiddleware)

app.route(
  '/api/depositors',
  (() => {
    // Lazy init per request to bind D1
    const router = new Hono<{ Bindings: Env }>()
    router.all('/*', async (c) => {
      const db = drizzle(c.env.DB)
      const eventBus = createEventBus()
      const routes = createDepotsRoutes(db, eventBus)
      return routes.fetch(c.req.raw)
    })
    return router
  })(),
)

app.route(
  '/api/items',
  (() => {
    const router = new Hono<{ Bindings: Env }>()
    router.all('/*', async (c) => {
      const db = drizzle(c.env.DB)
      const eventBus = createEventBus()
      const routes = createCatalogRoutes(db, eventBus)
      return routes.fetch(c.req.raw)
    })
    return router
  })(),
)

app.route(
  '/api/sales',
  (() => {
    const router = new Hono<{ Bindings: Env }>()
    router.all('/*', async (c) => {
      const db = drizzle(c.env.DB)
      const eventBus = createEventBus()
      const routes = createCaisseRoutes(db, eventBus)
      return routes.fetch(c.req.raw)
    })
    return router
  })(),
)

export default app
