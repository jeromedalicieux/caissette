import { Hono } from 'hono'
import { z } from 'zod'
import type { EventBus } from '@rebond/event-bus'
import type { Cents, DepositorId, ItemId, ShopId } from '@rebond/types'
import { generateUuidV7 } from '@rebond/utils'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'
import { items, pricingRules } from './schema.js'

export { items, pricingRules } from './schema.js'

export const createItemSchema = z.object({
  contractId: z.string().optional(),
  depositorId: z.string().optional(),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  condition: z.enum(['new', 'excellent', 'good', 'fair']).optional(),
  initialPrice: z.number().int().positive(),
  costPrice: z.number().int().nonnegative().optional(),
  vatRegime: z.enum(['deposit', 'resale_item_by_item', 'resale_global_period', 'normal']),
  vatRate: z.number().int().min(0).max(10000),
})

/**
 * Generate a barcode SKU: RB-YYYYMMDD-XXXX
 */
export function generateBarcode(): string {
  const date = new Date()
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `RB-${ymd}-${rand}`
}

export function createCatalogRoutes(db: DrizzleD1Database, eventBus: EventBus) {
  const app = new Hono()

  // List items
  app.get('/', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const status = c.req.query('status') ?? 'available'
    const result = await db
      .select()
      .from(items)
      .where(and(eq(items.shopId, shopId), eq(items.status, status)))
    return c.json(result)
  })

  // Create item
  app.post('/', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const body = createItemSchema.parse(await c.req.json())
    const id = generateUuidV7() as ItemId
    const now = Date.now()
    const sku = generateBarcode()

    await db.insert(items).values({
      id,
      shopId,
      contractId: body.contractId ?? null,
      depositorId: body.depositorId ?? null,
      sku,
      name: body.name,
      description: body.description ?? null,
      category: body.category ?? null,
      brand: body.brand ?? null,
      size: body.size ?? null,
      condition: body.condition ?? null,
      photosR2Keys: null,
      initialPrice: body.initialPrice,
      currentPrice: body.initialPrice,
      costPrice: body.costPrice ?? null,
      vatRegime: body.vatRegime,
      vatRate: body.vatRate,
      status: 'available',
      statusChangedAt: now,
      enteredAt: now,
      soldAt: null,
      createdAt: now,
    })

    await eventBus.emit('item.created', {
      itemId: id,
      depositorId: (body.depositorId as DepositorId) ?? null,
      contractId: body.contractId ?? null,
      price: body.initialPrice as Cents,
    })

    return c.json({ id, sku }, 201)
  })

  // Get single item
  app.get('/:id', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const id = c.req.param('id')
    const result = await db
      .select()
      .from(items)
      .where(and(eq(items.id, id), eq(items.shopId, shopId)))
    if (result.length === 0) return c.json({ error: 'Not found' }, 404)
    return c.json(result[0])
  })

  return app
}

export const MODULE_DEFINITION = {
  id: 'catalog',
  version: '0.0.1',
  displayName: 'Catalogue & Articles',
  description: 'Gestion du catalogue articles, stock et codes-barres',
  dependencies: ['depots'],
  events: {
    emits: ['item.created'],
    listens: [],
  },
  pricing: { tier: 'core' as const },
}
