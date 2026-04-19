import { eq } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { Hono } from 'hono'
import { z } from 'zod'
import { createMiddleware } from 'hono/factory'
import { type ShopId, type ShopSettings, DEFAULT_SHOP_SETTINGS, DEFAULT_SHOP_DISPLAY } from '@rebond/types'
import { generateUuidV7 } from '@rebond/utils'
import { shops } from './schema.js'

export { shops } from './schema.js'

export type TenantVariables = {
  shopId: ShopId
}

/**
 * Hono middleware that extracts tenant (shop) from the authenticated user
 * or from X-Shop-Id header.
 */
export const tenantMiddleware = createMiddleware<{ Variables: TenantVariables }>(
  async (c, next) => {
    // Try from authenticated user first, then header
    const user = (c as any).get?.('user')
    const shopId = user?.shopId ?? c.req.header('X-Shop-Id')

    if (!shopId) {
      return c.json({ error: 'Boutique non identifiée' }, 400)
    }

    c.set('shopId', shopId as ShopId)
    await next()
  },
)

// ─── Settings parser ───

export function parseSettings(json: string | null): ShopSettings {
  if (!json) return { ...DEFAULT_SHOP_SETTINGS, features: { ...DEFAULT_SHOP_SETTINGS.features } }

  let raw: Record<string, any>
  try {
    raw = JSON.parse(json)
  } catch {
    return { ...DEFAULT_SHOP_SETTINGS, features: { ...DEFAULT_SHOP_SETTINGS.features } }
  }

  // Retrocompat: if defaultCommissionRate exists but no features → was a deposit-sale shop
  const hasFeatures = raw.features && typeof raw.features === 'object'
  const depositSale = hasFeatures
    ? Boolean(raw.features.depositSale)
    : raw.defaultCommissionRate != null

  return {
    features: { depositSale },
    display: {
      ...DEFAULT_SHOP_DISPLAY,
      ...(raw.display && typeof raw.display === 'object' ? raw.display : {}),
    },
    defaultCommissionRate: typeof raw.defaultCommissionRate === 'number'
      ? raw.defaultCommissionRate
      : DEFAULT_SHOP_SETTINGS.defaultCommissionRate,
    receiptFooter: typeof raw.receiptFooter === 'string'
      ? raw.receiptFooter
      : DEFAULT_SHOP_SETTINGS.receiptFooter,
  }
}

// ─── Schemas ───

const createShopSchema = z.object({
  name: z.string().trim().min(1),
  siret: z.string().regex(/^\d{14}$/),
  vatNumber: z.string().optional(),
  vatRegime: z.enum(['deposit', 'resale_item_by_item', 'resale_global_period', 'normal']).default('deposit'),
  vatDeclarationRegime: z.enum(['franchise', 'simplified', 'normal']).default('simplified'),
  address: z.string().trim().min(1),
  timezone: z.string().default('Europe/Paris'),
  subscriptionTier: z.enum(['starter', 'standard', 'pro']).default('standard'),
})

const updateShopSchema = createShopSchema.partial()

// ─── Routes ───

export function createTenantRoutes(getDb: (c: any) => DrizzleD1Database) {
  const app = new Hono()

  // Create shop (used during onboarding)
  app.post('/', async (c) => {
    const db = getDb(c)
    const body = createShopSchema.parse(await c.req.json())
    const id = generateUuidV7() as ShopId

    await db.insert(shops).values({
      id,
      name: body.name,
      siret: body.siret,
      vatNumber: body.vatNumber ?? null,
      vatRegime: body.vatRegime,
      vatDeclarationRegime: body.vatDeclarationRegime,
      address: body.address,
      timezone: body.timezone,
      currency: 'EUR',
      settingsJson: JSON.stringify(DEFAULT_SHOP_SETTINGS),
      subscriptionTier: body.subscriptionTier,
      createdAt: Date.now(),
      deletedAt: null,
    })

    return c.json({ id }, 201)
  })

  // Get current shop
  app.get('/current', async (c) => {
    const db = getDb(c)
    const user = (c as any).get?.('user')
    if (!user?.shopId) return c.json({ error: 'Non authentifié' }, 401)

    const result = await db.select().from(shops).where(eq(shops.id, user.shopId)).limit(1)
    if (result.length === 0) return c.json({ error: 'Boutique introuvable' }, 404)
    return c.json(result[0])
  })

  // Update shop settings
  app.patch('/current', async (c) => {
    const db = getDb(c)
    const user = (c as any).get?.('user')
    if (!user?.shopId) return c.json({ error: 'Non authentifié' }, 401)

    const body = updateShopSchema.parse(await c.req.json())
    await db.update(shops).set(body).where(eq(shops.id, user.shopId))
    return c.json({ ok: true })
  })

  return app
}
