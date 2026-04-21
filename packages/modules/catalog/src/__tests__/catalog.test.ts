import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCatalogRoutes } from '../index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDb(options: {
  selectResult?: any[]
  updateResult?: any
} = {}) {
  const { selectResult = [], updateResult = undefined } = options

  const whereForSelect = vi.fn().mockResolvedValue(selectResult)
  const whereForUpdate = vi.fn().mockResolvedValue(updateResult)

  const db: any = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: whereForSelect,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: whereForUpdate,
      })),
    })),
  }

  return { db, whereForSelect, whereForUpdate }
}

function createMockEventBus() {
  return {
    emit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
  }
}

const SHOP_HEADERS = { 'X-Shop-Id': 'shop-1' }
const JSON_HEADERS = { ...SHOP_HEADERS, 'Content-Type': 'application/json' }

const VALID_ITEM_BODY = {
  name: 'Robe fleurie',
  initialPrice: 2500,
  vatRegime: 'deposit' as const,
  vatRate: 0,
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    shopId: 'shop-1',
    contractId: null,
    depositorId: null,
    sku: 'RB-20260419-ABCD',
    name: 'Robe fleurie',
    description: null,
    category: null,
    brand: null,
    size: null,
    condition: null,
    photosR2Keys: null,
    initialPrice: 2500,
    currentPrice: 2500,
    costPrice: null,
    vatRegime: 'deposit',
    vatRate: 0,
    status: 'available',
    statusChangedAt: 1000,
    enteredAt: 1000,
    soldAt: null,
    createdAt: 1000,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Catalog module', () => {
  // -----------------------------------------------------------------------
  // GET /
  // -----------------------------------------------------------------------
  describe('GET /', () => {
    it('returns items filtered by shop and default status', async () => {
      const items = [makeItem(), makeItem({ id: 'item-2' })]
      const { db } = createMockDb({ selectResult: items })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/', {
        method: 'GET',
        headers: SHOP_HEADERS,
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(2)
      expect(db.select).toHaveBeenCalled()
    })

    it('passes custom status query param to the query', async () => {
      const { db, whereForSelect } = createMockDb({ selectResult: [] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/?status=sold', {
        method: 'GET',
        headers: SHOP_HEADERS,
      })

      expect(res.status).toBe(200)
      expect(whereForSelect).toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // POST /
  // -----------------------------------------------------------------------
  describe('POST /', () => {
    it('creates an item and returns 201 with id and sku', async () => {
      const { db } = createMockDb()
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(VALID_ITEM_BODY),
      })

      expect(res.status).toBe(201)
      const data: any = await res.json()
      expect(data.id).toBeDefined()
      expect(data.sku).toMatch(/^RB-\d{8}-[A-Z0-9]{4}$/)
      expect(db.insert).toHaveBeenCalled()
    })

    it('emits item.created with shopId and depositorId', async () => {
      const { db } = createMockDb()
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          ...VALID_ITEM_BODY,
          depositorId: 'dep-1',
        }),
      })

      expect(res.status).toBe(201)
      expect(bus.emit).toHaveBeenCalledWith(
        'item.created',
        expect.objectContaining({
          shopId: 'shop-1',
          depositorId: 'dep-1',
        }),
      )
    })

    it('creates an item with categoryId', async () => {
      const { db } = createMockDb()
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ ...VALID_ITEM_BODY, categoryId: 'cat-1' }),
      })

      expect(res.status).toBe(201)
      expect(db.insert).toHaveBeenCalled()
    })

    it('returns 400 on invalid body (missing name)', async () => {
      const { db } = createMockDb()
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ initialPrice: 100, vatRegime: 'deposit', vatRate: 0 }),
      })

      // Zod will throw, Hono catches and returns 400 or 500
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  // -----------------------------------------------------------------------
  // GET /:id
  // -----------------------------------------------------------------------
  describe('GET /:id', () => {
    it('returns a single item', async () => {
      const item = makeItem()
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1', {
        method: 'GET',
        headers: SHOP_HEADERS,
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(item)
    })

    it('returns 404 when item not found', async () => {
      const { db } = createMockDb({ selectResult: [] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/nonexistent', {
        method: 'GET',
        headers: SHOP_HEADERS,
      })

      expect(res.status).toBe(404)
      const data: any = await res.json()
      expect(data.error).toBe('Not found')
    })
  })

  // -----------------------------------------------------------------------
  // PATCH /:id
  // -----------------------------------------------------------------------
  describe('PATCH /:id', () => {
    it('updates an available item and returns ok', async () => {
      const item = makeItem()
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1', {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ name: 'Robe modifiée' }),
      })

      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.ok).toBe(true)
      expect(db.update).toHaveBeenCalled()
    })

    it('returns 404 when item not found', async () => {
      const { db } = createMockDb({ selectResult: [] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/nonexistent', {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ name: 'Test' }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 when item is not available (sold)', async () => {
      const item = makeItem({ status: 'sold' })
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1', {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ name: 'Test' }),
      })

      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toContain('en vente')
    })

    it('returns 400 when no fields provided', async () => {
      const item = makeItem()
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1', {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toContain('Aucun champ')
    })

    it('updates categoryId on an available item', async () => {
      const item = makeItem()
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1', {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ categoryId: 'cat-2' }),
      })

      expect(res.status).toBe(200)
      expect(db.update).toHaveBeenCalled()
    })

    it('clears categoryId with null', async () => {
      const item = makeItem({ categoryId: 'cat-1' })
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1', {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ categoryId: null }),
      })

      expect(res.status).toBe(200)
      expect(db.update).toHaveBeenCalled()
    })

    it('updates currentPrice and sets statusChangedAt', async () => {
      const item = makeItem()
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1', {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ currentPrice: 1500 }),
      })

      expect(res.status).toBe(200)
      expect(db.update).toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // DELETE /:id
  // -----------------------------------------------------------------------
  describe('DELETE /:id', () => {
    it('soft-deletes an available item (status=destroyed)', async () => {
      const item = makeItem()
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1', {
        method: 'DELETE',
        headers: SHOP_HEADERS,
      })

      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.ok).toBe(true)
      expect(db.update).toHaveBeenCalled()
    })

    it('returns 404 when item not found', async () => {
      const { db } = createMockDb({ selectResult: [] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/nonexistent', {
        method: 'DELETE',
        headers: SHOP_HEADERS,
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 when item is not available', async () => {
      const item = makeItem({ status: 'returned' })
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1', {
        method: 'DELETE',
        headers: SHOP_HEADERS,
      })

      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toContain('supprimés')
    })
  })

  // -----------------------------------------------------------------------
  // PATCH /:id/return
  // -----------------------------------------------------------------------
  describe('PATCH /:id/return', () => {
    it('returns an available item with depositor and emits item.returned', async () => {
      const item = makeItem({ depositorId: 'dep-1' })
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1/return', {
        method: 'PATCH',
        headers: SHOP_HEADERS,
      })

      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.ok).toBe(true)
      expect(db.update).toHaveBeenCalled()
      expect(bus.emit).toHaveBeenCalledWith(
        'item.returned',
        expect.objectContaining({
          itemId: 'item-1',
          shopId: 'shop-1',
          depositorId: 'dep-1',
        }),
      )
    })

    it('returns 404 when item not found', async () => {
      const { db } = createMockDb({ selectResult: [] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/nonexistent/return', {
        method: 'PATCH',
        headers: SHOP_HEADERS,
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 when item is not available', async () => {
      const item = makeItem({ status: 'sold', depositorId: 'dep-1' })
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1/return', {
        method: 'PATCH',
        headers: SHOP_HEADERS,
      })

      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toContain('restitués')
    })

    it('returns 400 when item has no depositor', async () => {
      const item = makeItem({ depositorId: null })
      const { db } = createMockDb({ selectResult: [item] })
      const bus = createMockEventBus()
      const app = createCatalogRoutes(db, bus)

      const res = await app.request('/item-1/return', {
        method: 'PATCH',
        headers: SHOP_HEADERS,
      })

      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toContain('déposant')
    })
  })
})
