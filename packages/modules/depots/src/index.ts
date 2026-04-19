import { Hono } from 'hono'
import { z } from 'zod'
import type { EventBus } from '@rebond/event-bus'
import type { DepositorId, ShopId, UserId } from '@rebond/types'
import { generateUuidV7 } from '@rebond/utils'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc } from 'drizzle-orm'
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

export const updateDepositorSchema = createDepositorSchema.partial()

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

  // Update depositor (no delete — legal obligation)
  app.patch('/:id', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const id = c.req.param('id')
    const existing = await db
      .select()
      .from(depositors)
      .where(and(eq(depositors.id, id), eq(depositors.shopId, shopId)))
    if (existing.length === 0) return c.json({ error: 'Not found' }, 404)

    const body = updateDepositorSchema.parse(await c.req.json())
    const updates: Record<string, unknown> = {}
    if (body.firstName !== undefined) updates.firstName = body.firstName
    if (body.lastName !== undefined) updates.lastName = body.lastName
    if (body.email !== undefined) updates.email = body.email
    if (body.phone !== undefined) updates.phone = body.phone
    if (body.address !== undefined) updates.address = body.address
    if (body.idDocumentType !== undefined) updates.idDocumentType = body.idDocumentType
    if (body.idDocumentNumber !== undefined) updates.idDocumentNumber = body.idDocumentNumber
    if (body.birthDate !== undefined) updates.birthDate = body.birthDate
    if (body.defaultCommissionRate !== undefined) updates.defaultCommissionRate = body.defaultCommissionRate

    if (Object.keys(updates).length === 0) return c.json({ error: 'Aucun champ à modifier' }, 400)
    await db.update(depositors).set(updates).where(eq(depositors.id, id))
    return c.json({ ok: true })
  })

  return app
}

// ─── Contracts ───

const createContractSchema = z.object({
  depositorId: z.string().min(1),
  commissionRate: z.number().int().min(0).max(10000),
  expiresAt: z.number().int().positive(),
})

const updateContractSchema = z.object({
  status: z.enum(['active', 'expired', 'cancelled']).optional(),
  commissionRate: z.number().int().min(0).max(10000).optional(),
  expiresAt: z.number().int().positive().optional(),
})

function generateContractNumber(): string {
  const now = new Date()
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `C-${ymd}-${rand}`
}

export function createContractsRoutes(db: DrizzleD1Database, eventBus: EventBus) {
  const app = new Hono()

  // List contracts with depositor name
  app.get('/', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const result = await db
      .select({
        id: contracts.id,
        shopId: contracts.shopId,
        depositorId: contracts.depositorId,
        number: contracts.number,
        signedAt: contracts.signedAt,
        expiresAt: contracts.expiresAt,
        commissionRate: contracts.commissionRate,
        status: contracts.status,
        createdAt: contracts.createdAt,
        depositorFirstName: depositors.firstName,
        depositorLastName: depositors.lastName,
      })
      .from(contracts)
      .leftJoin(depositors, eq(contracts.depositorId, depositors.id))
      .where(eq(contracts.shopId, shopId))
      .orderBy(desc(contracts.createdAt))
    return c.json(result)
  })

  // Create contract
  app.post('/', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const body = createContractSchema.parse(await c.req.json())
    const id = generateUuidV7()
    const now = Date.now()
    const number = generateContractNumber()

    await db.insert(contracts).values({
      id,
      shopId,
      depositorId: body.depositorId,
      number,
      signedAt: now,
      expiresAt: body.expiresAt,
      commissionRate: body.commissionRate,
      status: 'active',
      createdAt: now,
    })

    await eventBus.emit('deposit.contract.signed', {
      contractId: id,
      depositorId: body.depositorId as DepositorId,
      items: [],
    })

    return c.json({ id, number }, 201)
  })

  // Get single contract
  app.get('/:id', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const id = c.req.param('id')
    const result = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.shopId, shopId)))
    if (result.length === 0) return c.json({ error: 'Not found' }, 404)
    return c.json(result[0])
  })

  // Update contract
  app.patch('/:id', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const id = c.req.param('id')
    const existing = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.shopId, shopId)))
    if (existing.length === 0) return c.json({ error: 'Not found' }, 404)

    const body = updateContractSchema.parse(await c.req.json())
    const updates: Record<string, unknown> = {}
    if (body.status !== undefined) updates.status = body.status
    if (body.commissionRate !== undefined) updates.commissionRate = body.commissionRate
    if (body.expiresAt !== undefined) updates.expiresAt = body.expiresAt

    if (Object.keys(updates).length === 0) return c.json({ error: 'Aucun champ à modifier' }, 400)
    await db.update(contracts).set(updates).where(eq(contracts.id, id))
    return c.json({ ok: true })
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
