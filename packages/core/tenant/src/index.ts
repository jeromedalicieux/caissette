import { eq } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { createMiddleware } from 'hono/factory'
import type { ShopId } from '@rebond/types'
import { shops } from './schema.js'

export { shops } from './schema.js'

export type TenantVariables = {
  shopId: ShopId
}

/**
 * Hono middleware that extracts and validates tenant (shop) from request.
 * Expects X-Shop-Id header or shopId query parameter.
 */
export const tenantMiddleware = createMiddleware<{ Variables: TenantVariables }>(
  async (c, next) => {
    const shopId = (c.req.header('X-Shop-Id') ?? c.req.query('shopId')) as ShopId | undefined

    if (!shopId) {
      return c.json({ error: 'Missing shop identifier' }, 400)
    }

    c.set('shopId', shopId)
    await next()
  },
)

/**
 * Helper to scope queries by tenant.
 * Returns a where clause filter for shop_id.
 */
export function withTenant<T extends { shopId: string }>(
  _db: DrizzleD1Database,
  shopId: ShopId,
) {
  return eq(shops.id, shopId)
}
