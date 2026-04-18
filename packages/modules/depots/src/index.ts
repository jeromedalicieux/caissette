import { Hono } from 'hono'
import { z } from 'zod'
import type { EventBus } from '@rebond/event-bus'
import type { DepositorId, ShopId, UserId } from '@rebond/types'
import { generateUuidV7 } from '@rebond/utils'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'
import { depositors, contracts } from './schema.js'

export { depositors, contracts } from './schema.js'

export const createDepositorSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  idDocumentType: z.enum(['cni', 'passport', 'driver_license']),
  idDocumentNumber: z.string().min(1),
  birthDate: z.string().optional(),
  defaultCommissionRate: z.number().int().min(0).max(10000).optional(),
})

export function createDepotsRoutes(db: DrizzleD1Database, eventBus: EventBus) {
  const app = new Hono()

  // List depositors for a shop
  app.get('/', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const result = await db.select().from(depositors).where(eq(depositors.shopId, shopId))
    return c.json(result)
  })

  // Create depositor
  app.post('/', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const userId = c.req.header('X-User-Id') as UserId
    const body = createDepositorSchema.parse(await c.req.json())
    const id = generateUuidV7() as DepositorId

    await db.insert(depositors).values({
      id,
      shopId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      idDocumentType: body.idDocumentType,
      idDocumentNumber: body.idDocumentNumber,
      birthDate: body.birthDate ?? null,
      defaultCommissionRate: body.defaultCommissionRate ?? null,
      createdAt: Date.now(),
    })

    await eventBus.emit('depositor.created', {
      depositorId: id,
      shopId,
      createdBy: userId,
    })

    return c.json({ id }, 201)
  })

  // Get single depositor
  app.get('/:id', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const id = c.req.param('id')
    const result = await db
      .select()
      .from(depositors)
      .where(and(eq(depositors.id, id), eq(depositors.shopId, shopId)))
    if (result.length === 0) return c.json({ error: 'Not found' }, 404)
    return c.json(result[0])
  })

  return app
}

export const MODULE_DEFINITION = {
  id: 'depots',
  version: '0.0.1',
  displayName: 'Dépôts & Contrats',
  description: 'Gestion des déposants et contrats de dépôt-vente',
  dependencies: [],
  events: {
    emits: ['depositor.created', 'deposit.contract.signed', 'item.returned'],
    listens: [],
  },
  pricing: { tier: 'core' as const },
}
