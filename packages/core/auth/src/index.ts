import { Hono } from 'hono'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { createMiddleware } from 'hono/factory'
import type { UserRole, UserId, ShopId } from '@caissette/types'
import { generateUuidV7, hashPassword, verifyPassword, hashPin, verifyPin } from '@caissette/utils'
import { users, sessions } from './schema.js'

export { users, sessions } from './schema.js'

// ─── Types ───

export interface SessionUser {
  id: UserId
  shopId: ShopId
  role: UserRole
  name: string
  email: string
  permissionsJson: string | null
}

export type AuthVariables = {
  user: SessionUser | null
  session: { id: string; expiresAt: number } | null
  db: DrizzleD1Database
}

// ─── Session management ───

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function createSession(
  db: DrizzleD1Database,
  userId: string,
  shopId: string,
): Promise<{ id: string; expiresAt: number }> {
  const id = generateSessionId()
  const now = Date.now()
  const expiresAt = now + SESSION_DURATION_MS

  await db.insert(sessions).values({
    id,
    userId,
    shopId,
    expiresAt,
    createdAt: now,
  })

  return { id, expiresAt }
}

export async function validateSession(
  db: DrizzleD1Database,
  sessionId: string,
): Promise<{ user: SessionUser; session: { id: string; expiresAt: number } } | null> {
  const result = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      shopId: users.shopId,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      permissionsJson: users.permissionsJson,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1)

  const row = result[0]
  if (!row) return null
  if (row.expiresAt < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
    return null
  }

  // Reject disabled users
  if (row.active === 0) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
    return null
  }

  return {
    user: {
      id: row.userId as UserId,
      shopId: row.shopId as ShopId,
      role: row.role as UserRole,
      name: row.name,
      email: row.email,
      permissionsJson: row.permissionsJson ?? null,
    },
    session: { id: row.sessionId, expiresAt: row.expiresAt },
  }
}

export async function invalidateSession(db: DrizzleD1Database, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}

// ─── Middleware ───

/**
 * Auth middleware — extracts session from Authorization header or cookie,
 * validates it, and sets user/session in context.
 */
export function createAuthMiddleware(getDb: (c: any) => DrizzleD1Database) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const db = getDb(c)
    c.set('db', db)

    // Extract session token from Authorization header or cookie
    const authHeader = c.req.header('Authorization')
    let token: string | undefined

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    } else {
      // Parse cookie
      const cookie = c.req.header('Cookie')
      if (cookie) {
        const match = cookie.match(/caissette_session=([^;]+)/)
        token = match?.[1]
      }
    }

    if (!token) {
      c.set('user', null)
      c.set('session', null)
      await next()
      return
    }

    const result = await validateSession(db, token)
    if (!result) {
      c.set('user', null)
      c.set('session', null)
      await next()
      return
    }

    c.set('user', result.user)
    c.set('session', result.session)
    await next()
  })
}

/**
 * Guard middleware — returns 401 if not authenticated.
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Non authentifié' }, 401)
  }
  await next()
})

// ─── RBAC ───

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 3,
  manager: 2,
  cashier: 1,
  accountant: 1,
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0)
}

export function requireRole(minRole: UserRole) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Non authentifié' }, 401)
    if (!hasRole(user.role, minRole)) return c.json({ error: 'Accès refusé' }, 403)
    await next()
  })
}

// ─── Auth Routes ───

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1),
  shopId: z.string(),
  role: z.enum(['owner', 'manager', 'cashier', 'accountant']).default('cashier'),
  pin: z.string().length(4).regex(/^\d{4}$/).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  shopId: z.string(),
})

const pinLoginSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/),
  shopId: z.string(),
})

export function createAuthRoutes(getDb: (c: any) => DrizzleD1Database) {
  const app = new Hono()

  // Register
  app.post('/register', async (c) => {
    const db = getDb(c)
    const body = registerSchema.parse(await c.req.json())

    // Check if user already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.shopId, body.shopId), eq(users.email, body.email)))
      .limit(1)

    if (existing.length > 0) {
      return c.json({ error: 'Cet email est déjà utilisé' }, 409)
    }

    const id = generateUuidV7()
    const passwordHash = await hashPassword(body.password)
    const pinHash = body.pin ? await hashPin(body.pin) : null

    await db.insert(users).values({
      id,
      shopId: body.shopId,
      email: body.email,
      name: body.name,
      role: body.role,
      passwordHash,
      pinHash,
      createdAt: Date.now(),
    })

    const session = await createSession(db, id, body.shopId)

    return c.json(
      {
        user: { id, shopId: body.shopId, email: body.email, name: body.name, role: body.role, permissionsJson: null },
        token: session.id,
        expiresAt: session.expiresAt,
      },
      201,
    )
  })

  // Login with email/password
  app.post('/login', async (c) => {
    const db = getDb(c)
    const body = loginSchema.parse(await c.req.json())

    const result = await db
      .select()
      .from(users)
      .where(and(eq(users.shopId, body.shopId), eq(users.email, body.email)))
      .limit(1)

    const user = result[0]
    if (!user) {
      return c.json({ error: 'Email ou mot de passe incorrect' }, 401)
    }

    if (user.active === 0) {
      return c.json({ error: 'Ce compte est desactive' }, 403)
    }

    const valid = await verifyPassword(body.password, user.passwordHash)
    if (!valid) {
      return c.json({ error: 'Email ou mot de passe incorrect' }, 401)
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: Date.now() })
      .where(eq(users.id, user.id))

    const session = await createSession(db, user.id, user.shopId)

    return c.json({
      user: {
        id: user.id,
        shopId: user.shopId,
        email: user.email,
        name: user.name,
        role: user.role,
        permissionsJson: user.permissionsJson ?? null,
      },
      token: session.id,
      expiresAt: session.expiresAt,
    })
  })

  // Login with PIN (cashier quick-switch)
  app.post('/pin-login', async (c) => {
    const db = getDb(c)
    const body = pinLoginSchema.parse(await c.req.json())

    // Find all users in this shop with a PIN
    const shopUsers = await db
      .select()
      .from(users)
      .where(eq(users.shopId, body.shopId))

    for (const user of shopUsers) {
      if (!user.pinHash) continue
      const valid = await verifyPin(body.pin, user.pinHash)
      if (valid) {
        await db
          .update(users)
          .set({ lastLoginAt: Date.now() })
          .where(eq(users.id, user.id))

        const session = await createSession(db, user.id, user.shopId)
        return c.json({
          user: {
            id: user.id,
            shopId: user.shopId,
            email: user.email,
            name: user.name,
            role: user.role,
            permissionsJson: user.permissionsJson ?? null,
          },
          token: session.id,
          expiresAt: session.expiresAt,
        })
      }
    }

    return c.json({ error: 'PIN incorrect' }, 401)
  })

  // Logout
  app.post('/logout', async (c) => {
    const db = getDb(c)
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      await invalidateSession(db, authHeader.slice(7))
    }
    return c.json({ ok: true })
  })

  // Get current user
  app.get('/me', async (c) => {
    const db = getDb(c)
    const authHeader = c.req.header('Authorization')
    let token: string | undefined

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    } else {
      const cookie = c.req.header('Cookie')
      if (cookie) {
        const match = cookie.match(/caissette_session=([^;]+)/)
        token = match?.[1]
      }
    }

    if (!token) return c.json({ error: 'Non authentifié' }, 401)

    const result = await validateSession(db, token)
    if (!result) return c.json({ error: 'Session expirée' }, 401)

    return c.json({ user: result.user })
  })

  return app
}
