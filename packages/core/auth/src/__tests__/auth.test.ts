import { describe, it, expect, vi } from 'vitest'
import { hasRole, validateSession } from '../index.js'
import type { UserRole } from '@caissette/types'

// ---------------------------------------------------------------------------
// hasRole
// ---------------------------------------------------------------------------

describe('hasRole', () => {
  it('owner has all roles', () => {
    expect(hasRole('owner' as UserRole, 'owner' as UserRole)).toBe(true)
    expect(hasRole('owner' as UserRole, 'manager' as UserRole)).toBe(true)
    expect(hasRole('owner' as UserRole, 'cashier' as UserRole)).toBe(true)
    expect(hasRole('owner' as UserRole, 'accountant' as UserRole)).toBe(true)
  })

  it('manager has manager, cashier and accountant roles', () => {
    expect(hasRole('manager' as UserRole, 'owner' as UserRole)).toBe(false)
    expect(hasRole('manager' as UserRole, 'manager' as UserRole)).toBe(true)
    expect(hasRole('manager' as UserRole, 'cashier' as UserRole)).toBe(true)
    expect(hasRole('manager' as UserRole, 'accountant' as UserRole)).toBe(true)
  })

  it('cashier has only cashier role', () => {
    expect(hasRole('cashier' as UserRole, 'owner' as UserRole)).toBe(false)
    expect(hasRole('cashier' as UserRole, 'manager' as UserRole)).toBe(false)
    expect(hasRole('cashier' as UserRole, 'cashier' as UserRole)).toBe(true)
  })

  it('accountant has same level as cashier', () => {
    expect(hasRole('accountant' as UserRole, 'owner' as UserRole)).toBe(false)
    expect(hasRole('accountant' as UserRole, 'manager' as UserRole)).toBe(false)
    expect(hasRole('accountant' as UserRole, 'cashier' as UserRole)).toBe(true)
    expect(hasRole('accountant' as UserRole, 'accountant' as UserRole)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validateSession — active check
// ---------------------------------------------------------------------------

describe('validateSession', () => {
  function createMockDb(rows: any[]) {
    const db: any = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue(rows),
            })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    }
    return db
  }

  it('returns null for nonexistent session', async () => {
    const db = createMockDb([])
    const result = await validateSession(db, 'nonexistent-token')
    expect(result).toBeNull()
  })

  it('returns null and deletes session for expired session', async () => {
    const db = createMockDb([{
      sessionId: 'sess-1',
      expiresAt: Date.now() - 1000, // expired
      userId: 'user-1',
      shopId: 'shop-1',
      email: 'test@test.com',
      name: 'Test',
      role: 'owner',
      active: 1,
      permissionsJson: null,
    }])
    const result = await validateSession(db, 'sess-1')
    expect(result).toBeNull()
    expect(db.delete).toHaveBeenCalled()
  })

  it('returns null and deletes session for inactive user', async () => {
    const db = createMockDb([{
      sessionId: 'sess-1',
      expiresAt: Date.now() + 100000,
      userId: 'user-1',
      shopId: 'shop-1',
      email: 'test@test.com',
      name: 'Test',
      role: 'cashier',
      active: 0, // disabled
      permissionsJson: null,
    }])
    const result = await validateSession(db, 'sess-1')
    expect(result).toBeNull()
    expect(db.delete).toHaveBeenCalled()
  })

  it('returns user with permissionsJson for valid active session', async () => {
    const perms = JSON.stringify({ canViewSales: true, canExport: false })
    const db = createMockDb([{
      sessionId: 'sess-1',
      expiresAt: Date.now() + 100000,
      userId: 'user-1',
      shopId: 'shop-1',
      email: 'comptable@test.com',
      name: 'Comptable',
      role: 'accountant',
      active: 1,
      permissionsJson: perms,
    }])
    const result = await validateSession(db, 'sess-1')
    expect(result).not.toBeNull()
    expect(result!.user.role).toBe('accountant')
    expect(result!.user.permissionsJson).toBe(perms)
    expect(result!.user.email).toBe('comptable@test.com')
  })

  it('returns permissionsJson as null when not set', async () => {
    const db = createMockDb([{
      sessionId: 'sess-1',
      expiresAt: Date.now() + 100000,
      userId: 'user-1',
      shopId: 'shop-1',
      email: 'owner@test.com',
      name: 'Owner',
      role: 'owner',
      active: 1,
      permissionsJson: null,
    }])
    const result = await validateSession(db, 'sess-1')
    expect(result).not.toBeNull()
    expect(result!.user.permissionsJson).toBeNull()
  })
})
