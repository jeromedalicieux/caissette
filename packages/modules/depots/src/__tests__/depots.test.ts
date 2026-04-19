import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createDepotsRoutes, createContractsRoutes } from '../index.js'

// ─── Mocks ───

function createMockDb(options: { selectResult?: any[] } = {}) {
  const { selectResult = [] } = options
  const db: any = {
    select: vi.fn(() => {
      const chain: any = {
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(selectResult),
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn().mockResolvedValue(selectResult),
            })),
          })),
          orderBy: vi.fn().mockResolvedValue(selectResult),
        })),
      }
      return chain
    }),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  }
  return db
}

function createMockEventBus() {
  return {
    emit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
  }
}

// ─── Depositors ───

describe('createDepotsRoutes', () => {
  let db: ReturnType<typeof createMockDb>
  let eventBus: ReturnType<typeof createMockEventBus>
  let app: Hono

  beforeEach(() => {
    db = createMockDb()
    eventBus = createMockEventBus()
    app = createDepotsRoutes(db, eventBus as any)
  })

  describe('GET /', () => {
    it('returns depositors for the shop', async () => {
      const depositor = {
        id: 'dep-1',
        shopId: 'shop-1',
        firstName: 'Jean',
        lastName: 'Dupont',
      }
      db = createMockDb({ selectResult: [depositor] })
      app = createDepotsRoutes(db, eventBus as any)

      const res = await app.request('/', {
        method: 'GET',
        headers: { 'X-Shop-Id': 'shop-1' },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual([depositor])
      expect(db.select).toHaveBeenCalled()
    })

    it('returns empty array when no depositors', async () => {
      const res = await app.request('/', {
        method: 'GET',
        headers: { 'X-Shop-Id': 'shop-1' },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual([])
    })
  })

  describe('POST /', () => {
    const validBody = {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean@example.com',
      phone: '+33612345678',
      idDocumentType: 'cni',
      idDocumentNumber: 'ABC123',
    }

    it('creates a depositor and returns 201 with id', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'X-Shop-Id': 'shop-1',
          'X-User-Id': 'user-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validBody),
      })

      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json).toHaveProperty('id')
      expect(typeof json.id).toBe('string')
      expect(db.insert).toHaveBeenCalled()
    })

    it('emits depositor.created event', async () => {
      await app.request('/', {
        method: 'POST',
        headers: {
          'X-Shop-Id': 'shop-1',
          'X-User-Id': 'user-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validBody),
      })

      expect(eventBus.emit).toHaveBeenCalledWith(
        'depositor.created',
        expect.objectContaining({
          shopId: 'shop-1',
          createdBy: 'user-1',
          depositorId: expect.any(String),
        }),
      )
    })

    it('rejects invalid body (missing required fields)', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'X-Shop-Id': 'shop-1',
          'X-User-Id': 'user-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName: 'Jean' }),
      })

      // Zod parse throws, Hono returns 500 by default
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('GET /:id', () => {
    it('returns a single depositor', async () => {
      const depositor = {
        id: 'dep-1',
        shopId: 'shop-1',
        firstName: 'Jean',
        lastName: 'Dupont',
      }
      db = createMockDb({ selectResult: [depositor] })
      app = createDepotsRoutes(db, eventBus as any)

      const res = await app.request('/dep-1', {
        method: 'GET',
        headers: { 'X-Shop-Id': 'shop-1' },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual(depositor)
    })

    it('returns 404 when depositor not found', async () => {
      const res = await app.request('/nonexistent', {
        method: 'GET',
        headers: { 'X-Shop-Id': 'shop-1' },
      })

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json).toEqual({ error: 'Not found' })
    })
  })

  describe('PATCH /:id', () => {
    it('updates a depositor', async () => {
      const depositor = { id: 'dep-1', shopId: 'shop-1', firstName: 'Jean' }
      db = createMockDb({ selectResult: [depositor] })
      app = createDepotsRoutes(db, eventBus as any)

      const res = await app.request('/dep-1', {
        method: 'PATCH',
        headers: {
          'X-Shop-Id': 'shop-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName: 'Pierre' }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual({ ok: true })
      expect(db.update).toHaveBeenCalled()
    })

    it('returns 404 when depositor not found', async () => {
      const res = await app.request('/nonexistent', {
        method: 'PATCH',
        headers: {
          'X-Shop-Id': 'shop-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName: 'Pierre' }),
      })

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json).toEqual({ error: 'Not found' })
    })

    it('returns 400 when body has no updatable fields', async () => {
      const depositor = { id: 'dep-1', shopId: 'shop-1', firstName: 'Jean' }
      db = createMockDb({ selectResult: [depositor] })
      app = createDepotsRoutes(db, eventBus as any)

      const res = await app.request('/dep-1', {
        method: 'PATCH',
        headers: {
          'X-Shop-Id': 'shop-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json).toEqual({ error: 'Aucun champ à modifier' })
    })
  })
})

// ─── Contracts ───

describe('createContractsRoutes', () => {
  let db: ReturnType<typeof createMockDb>
  let eventBus: ReturnType<typeof createMockEventBus>
  let app: Hono

  beforeEach(() => {
    db = createMockDb()
    eventBus = createMockEventBus()
    app = createContractsRoutes(db, eventBus as any)
  })

  describe('GET /', () => {
    it('returns contracts with depositor join', async () => {
      const contract = {
        id: 'ctr-1',
        shopId: 'shop-1',
        depositorId: 'dep-1',
        number: 'C-20260419-AB12',
        status: 'active',
        depositorFirstName: 'Jean',
        depositorLastName: 'Dupont',
      }
      db = createMockDb({ selectResult: [contract] })
      app = createContractsRoutes(db, eventBus as any)

      const res = await app.request('/', {
        method: 'GET',
        headers: { 'X-Shop-Id': 'shop-1' },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual([contract])
      expect(db.select).toHaveBeenCalled()
    })

    it('returns empty array when no contracts', async () => {
      const res = await app.request('/', {
        method: 'GET',
        headers: { 'X-Shop-Id': 'shop-1' },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual([])
    })
  })

  describe('POST /', () => {
    const validBody = {
      depositorId: 'dep-1',
      commissionRate: 3000,
      expiresAt: 1750000000000,
    }

    it('creates a contract and returns 201 with id and number', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'X-Shop-Id': 'shop-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validBody),
      })

      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json).toHaveProperty('id')
      expect(json).toHaveProperty('number')
      expect(json.number).toMatch(/^C-\d{8}-[A-Z0-9]{4}$/)
      expect(db.insert).toHaveBeenCalled()
    })

    it('emits deposit.contract.signed event', async () => {
      await app.request('/', {
        method: 'POST',
        headers: {
          'X-Shop-Id': 'shop-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validBody),
      })

      expect(eventBus.emit).toHaveBeenCalledWith(
        'deposit.contract.signed',
        expect.objectContaining({
          contractId: expect.any(String),
          depositorId: 'dep-1',
          items: [],
        }),
      )
    })

    it('rejects invalid body (missing required fields)', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'X-Shop-Id': 'shop-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ depositorId: 'dep-1' }),
      })

      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('GET /:id', () => {
    it('returns a single contract', async () => {
      const contract = {
        id: 'ctr-1',
        shopId: 'shop-1',
        depositorId: 'dep-1',
        number: 'C-20260419-XY78',
        status: 'active',
      }
      db = createMockDb({ selectResult: [contract] })
      app = createContractsRoutes(db, eventBus as any)

      const res = await app.request('/ctr-1', {
        method: 'GET',
        headers: { 'X-Shop-Id': 'shop-1' },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual(contract)
    })

    it('returns 404 when contract not found', async () => {
      const res = await app.request('/nonexistent', {
        method: 'GET',
        headers: { 'X-Shop-Id': 'shop-1' },
      })

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json).toEqual({ error: 'Not found' })
    })
  })

  describe('PATCH /:id', () => {
    it('updates a contract', async () => {
      const contract = { id: 'ctr-1', shopId: 'shop-1', status: 'active' }
      db = createMockDb({ selectResult: [contract] })
      app = createContractsRoutes(db, eventBus as any)

      const res = await app.request('/ctr-1', {
        method: 'PATCH',
        headers: {
          'X-Shop-Id': 'shop-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual({ ok: true })
      expect(db.update).toHaveBeenCalled()
    })

    it('returns 404 when contract not found', async () => {
      const res = await app.request('/nonexistent', {
        method: 'PATCH',
        headers: {
          'X-Shop-Id': 'shop-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      })

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json).toEqual({ error: 'Not found' })
    })

    it('returns 400 when body has no updatable fields', async () => {
      const contract = { id: 'ctr-1', shopId: 'shop-1', status: 'active' }
      db = createMockDb({ selectResult: [contract] })
      app = createContractsRoutes(db, eventBus as any)

      const res = await app.request('/ctr-1', {
        method: 'PATCH',
        headers: {
          'X-Shop-Id': 'shop-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json).toEqual({ error: 'Aucun champ à modifier' })
    })
  })
})
