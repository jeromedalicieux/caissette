import { Lucia } from 'lucia'
import { createMiddleware } from 'hono/factory'
import type { UserRole, UserId, ShopId } from '@rebond/types'

export { users, sessions } from './schema.js'

export type AuthVariables = {
  user: {
    id: UserId
    shopId: ShopId
    role: UserRole
    name: string
    email: string
  } | null
  session: { id: string; expiresAt: Date } | null
}

/**
 * Create Lucia auth instance for D1.
 * Adapter setup deferred to infra/workers where D1 binding is available.
 */
export function createAuth(adapter: ConstructorParameters<typeof Lucia>[0]) {
  return new Lucia(adapter, {
    sessionCookie: {
      attributes: {
        secure: true,
        sameSite: 'lax',
      },
    },
    getUserAttributes: (attributes) => ({
      shopId: attributes.shopId as ShopId,
      role: attributes.role as UserRole,
      name: attributes.name as string,
      email: attributes.email as string,
    }),
  })
}

declare module 'lucia' {
  interface Register {
    Auth: ReturnType<typeof createAuth>
    DatabaseUserAttributes: {
      shopId: string
      role: string
      name: string
      email: string
    }
  }
}

/**
 * Hono middleware that validates session and populates user context.
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  // Session validation will be implemented when Lucia adapter is configured
  c.set('user', null)
  c.set('session', null)
  await next()
})

/** RBAC roles hierarchy: owner > manager > cashier */
const ROLE_HIERARCHY: Record<string, number> = {
  owner: 3,
  manager: 2,
  cashier: 1,
}

/**
 * Check if a user role has at least the required permission level.
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0)
}

/**
 * Middleware that requires a minimum role level.
 */
export function requireRole(minRole: UserRole) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    if (!hasRole(user.role, minRole)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  })
}
