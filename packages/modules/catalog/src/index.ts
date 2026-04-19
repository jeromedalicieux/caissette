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
  type: z.enum(['product', 'service']).default('product'),
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

export const updateItemSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  condition: z.enum(['new', 'excellent', 'good', 'fair']).optional(),
  currentPrice: z.number().int().positive().optional(),
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
    const type = c.req.query('type') // optional filter: 'product' | 'service'
    const conditions = [eq(items.shopId, shopId), eq(items.status, status)]
    if (type) conditions.push(eq(items.type, type))
    const result = await db
      .select()
      .from(items)
      .where(and(...conditions))
    return c.json(result)
  })

  // Create item
  app.post('/', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const body = createItemSchema.parse(await c.req.json())
    const id = generateUuidV7() as ItemId
    const now = Date.now()
    const isService = body.type === 'service'
    const sku = isService ? null : generateBarcode()

    await db.insert(items).values({
      id,
      shopId,
      type: body.type,
      contractId: body.contractId ?? null,
      depositorId: body.depositorId ?? null,
      sku,
      name: body.name,
      description: body.description ?? null,
      category: body.category ?? null,
      brand: isService ? null : (body.brand ?? null),
      size: isService ? null : (body.size ?? null),
      condition: isService ? null : (body.condition ?? null),
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
      shopId,
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

  // Update item (only if available)
  app.patch('/:id', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const id = c.req.param('id')
    const existing = await db
      .select()
      .from(items)
      .where(and(eq(items.id, id), eq(items.shopId, shopId)))
    const item = existing[0]
    if (!item) return c.json({ error: 'Not found' }, 404)
    if (item.status !== 'available') return c.json({ error: 'Seuls les articles en vente peuvent être modifiés' }, 400)

    const body = updateItemSchema.parse(await c.req.json())
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.category !== undefined) updates.category = body.category
    if (body.brand !== undefined) updates.brand = body.brand
    if (body.size !== undefined) updates.size = body.size
    if (body.condition !== undefined) updates.condition = body.condition
    if (body.currentPrice !== undefined) {
      updates.currentPrice = body.currentPrice
      updates.statusChangedAt = Date.now()
    }

    if (Object.keys(updates).length === 0) return c.json({ error: 'Aucun champ à modifier' }, 400)
    await db.update(items).set(updates).where(eq(items.id, id))
    return c.json({ ok: true })
  })

  // Soft-delete item (mark as destroyed)
  app.delete('/:id', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const id = c.req.param('id')
    const existing = await db
      .select()
      .from(items)
      .where(and(eq(items.id, id), eq(items.shopId, shopId)))
    const toDelete = existing[0]
    if (!toDelete) return c.json({ error: 'Not found' }, 404)
    if (toDelete.status !== 'available') return c.json({ error: 'Seuls les articles en vente peuvent être supprimés' }, 400)

    const now = Date.now()
    await db.update(items).set({ status: 'destroyed', statusChangedAt: now }).where(eq(items.id, id))
    return c.json({ ok: true })
  })

  // Return item to depositor
  app.patch('/:id/return', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const id = c.req.param('id')
    const existing = await db
      .select()
      .from(items)
      .where(and(eq(items.id, id), eq(items.shopId, shopId)))
    const toReturn = existing[0]
    if (!toReturn) return c.json({ error: 'Not found' }, 404)
    if (toReturn.status !== 'available') return c.json({ error: 'Seuls les articles en vente peuvent être restitués' }, 400)
    if (!toReturn.depositorId) return c.json({ error: 'Cet article n\'a pas de déposant' }, 400)

    const now = Date.now()
    await db.update(items).set({ status: 'returned', statusChangedAt: now }).where(eq(items.id, id))

    await eventBus.emit('item.returned', {
      itemId: id as ItemId,
      shopId,
      depositorId: toReturn.depositorId as DepositorId,
      reason: 'Restitution au déposant',
    })

    return c.json({ ok: true })
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
