import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEventBus } from '@rebond/event-bus'
import type { EventBus } from '@rebond/event-bus'
import type { Cents, DepositorId, ItemId, SaleId, ShopId } from '@rebond/types'

vi.mock('@rebond/utils', () => ({
  generateUuidV7: vi.fn(() => 'mock-uuid'),
  computeChainedHash: vi.fn().mockResolvedValue('mock-hash-value'),
}))

import {
  createLivrePoliceRoutes,
  registerPoliceLedgerListeners,
  createPoliceLedgerEntry,
} from '../index.js'

// ---------------------------------------------------------------------------
// Mock DB factory
// ---------------------------------------------------------------------------
function createMockDb(options: { lastEntry?: any; listResult?: any[] } = {}) {
  const insertValues = vi.fn().mockResolvedValue(undefined)
  const db: any = {
    select: vi.fn((fields?: any) => {
      // If fields are specified (hash, entryNumber), it's for hash chain lookup
      if (fields) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue(options.lastEntry ? [options.lastEntry] : []),
              })),
            })),
          })),
        }
      }
      // Otherwise it's for listing
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue(options.listResult ?? []),
          })),
        })),
      }
    }),
    insert: vi.fn(() => ({
      values: insertValues,
    })),
  }
  return { db, insertValues }
}

// ---------------------------------------------------------------------------
// GET / — list entries
// ---------------------------------------------------------------------------
describe('createLivrePoliceRoutes', () => {
  it('GET / returns police ledger entries for the shop', async () => {
    const entries = [
      { id: '1', entryNumber: 2, entryType: 'exit' },
      { id: '2', entryNumber: 1, entryType: 'entry' },
    ]
    const { db } = createMockDb({ listResult: entries })
    const app = createLivrePoliceRoutes(db)

    const res = await app.request('/', {
      headers: { 'X-Shop-Id': 'shop-1' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(entries)
  })

  it('GET / returns 400 when X-Shop-Id header is missing', async () => {
    const { db } = createMockDb()
    const app = createLivrePoliceRoutes(db)

    const res = await app.request('/')

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'Shop ID requis' })
  })
})

// ---------------------------------------------------------------------------
// registerPoliceLedgerListeners — item.created
// ---------------------------------------------------------------------------
describe('registerPoliceLedgerListeners', () => {
  let eventBus: EventBus
  let resolveDepositorInfo: ReturnType<typeof vi.fn>

  beforeEach(() => {
    eventBus = createEventBus()
    resolveDepositorInfo = vi.fn()
  })

  describe('item.created', () => {
    it('creates an entry when depositor exists', async () => {
      const { db, insertValues } = createMockDb()
      resolveDepositorInfo.mockResolvedValue({
        name: 'Jean Dupont',
        idDocument: 'CNI-12345',
      })

      registerPoliceLedgerListeners(db, eventBus, resolveDepositorInfo)

      await eventBus.emit('item.created', {
        itemId: 'item-1' as ItemId,
        shopId: 'shop-1' as ShopId,
        depositorId: 'dep-1' as DepositorId,
        contractId: null,
        price: 2500 as Cents,
      })

      expect(resolveDepositorInfo).toHaveBeenCalledWith('dep-1')
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mock-uuid',
          shopId: 'shop-1',
          entryType: 'entry',
          itemId: 'item-1',
          depositorId: 'dep-1',
          description: 'Article déposé — prix: 2500',
          depositorName: 'Jean Dupont',
          depositorIdDocument: 'CNI-12345',
          hash: 'mock-hash-value',
        }),
      )
    })

    it('skips when depositorId is null', async () => {
      const { db, insertValues } = createMockDb()

      registerPoliceLedgerListeners(db, eventBus, resolveDepositorInfo)

      await eventBus.emit('item.created', {
        itemId: 'item-1' as ItemId,
        shopId: 'shop-1' as ShopId,
        depositorId: null,
        contractId: null,
        price: 2500 as Cents,
      })

      expect(resolveDepositorInfo).not.toHaveBeenCalled()
      expect(insertValues).not.toHaveBeenCalled()
    })

    it('skips when depositor info cannot be resolved', async () => {
      const { db, insertValues } = createMockDb()
      resolveDepositorInfo.mockResolvedValue(null)

      registerPoliceLedgerListeners(db, eventBus, resolveDepositorInfo)

      await eventBus.emit('item.created', {
        itemId: 'item-1' as ItemId,
        shopId: 'shop-1' as ShopId,
        depositorId: 'dep-unknown' as DepositorId,
        contractId: null,
        price: 1000 as Cents,
      })

      expect(resolveDepositorInfo).toHaveBeenCalledWith('dep-unknown')
      expect(insertValues).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // item.sold
  // ---------------------------------------------------------------------------
  describe('item.sold', () => {
    it('creates an exit entry with sold reason', async () => {
      const { db, insertValues } = createMockDb()

      registerPoliceLedgerListeners(db, eventBus, resolveDepositorInfo)

      await eventBus.emit('item.sold', {
        saleId: 'sale-1' as SaleId,
        shopId: 'shop-1' as ShopId,
        itemId: 'item-2' as ItemId,
        price: 5000 as Cents,
        paymentMethod: 'cash',
      })

      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: 'exit',
          itemId: 'item-2',
          shopId: 'shop-1',
          depositorId: null,
          description: 'Article vendu — prix: 5000',
          depositorName: 'N/A',
          depositorIdDocument: 'N/A',
          saleId: 'sale-1',
          exitReason: 'sold',
          hash: 'mock-hash-value',
        }),
      )
    })
  })

  // ---------------------------------------------------------------------------
  // item.returned
  // ---------------------------------------------------------------------------
  describe('item.returned', () => {
    it('creates an exit entry with returned reason and depositor info', async () => {
      const { db, insertValues } = createMockDb()
      resolveDepositorInfo.mockResolvedValue({
        name: 'Marie Martin',
        idDocument: 'PASSPORT-67890',
      })

      registerPoliceLedgerListeners(db, eventBus, resolveDepositorInfo)

      await eventBus.emit('item.returned', {
        itemId: 'item-3' as ItemId,
        shopId: 'shop-1' as ShopId,
        depositorId: 'dep-2' as DepositorId,
        reason: 'Demande du déposant',
      })

      expect(resolveDepositorInfo).toHaveBeenCalledWith('dep-2')
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: 'exit',
          itemId: 'item-3',
          shopId: 'shop-1',
          depositorId: 'dep-2',
          description: 'Article restitué — Demande du déposant',
          depositorName: 'Marie Martin',
          depositorIdDocument: 'PASSPORT-67890',
          exitReason: 'returned',
          hash: 'mock-hash-value',
        }),
      )
    })

    it('creates an exit entry with N/A depositor when depositorId is null', async () => {
      const { db, insertValues } = createMockDb()

      registerPoliceLedgerListeners(db, eventBus, resolveDepositorInfo)

      await eventBus.emit('item.returned', {
        itemId: 'item-4' as ItemId,
        shopId: 'shop-1' as ShopId,
        depositorId: null,
        reason: 'Article défectueux',
      })

      expect(resolveDepositorInfo).not.toHaveBeenCalled()
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: 'exit',
          depositorId: null,
          depositorName: 'N/A',
          depositorIdDocument: 'N/A',
          exitReason: 'returned',
          description: 'Article restitué — Article défectueux',
        }),
      )
    })
  })
})

// ---------------------------------------------------------------------------
// createPoliceLedgerEntry — hash chain & auto-increment
// ---------------------------------------------------------------------------
describe('createPoliceLedgerEntry', () => {
  it('creates first entry with default previous hash and entryNumber 1', async () => {
    const { db, insertValues } = createMockDb()

    const id = await createPoliceLedgerEntry(db, {
      shopId: 'shop-1' as ShopId,
      entryType: 'entry',
      itemId: 'item-1',
      depositorId: 'dep-1',
      description: 'Premier article',
      depositorName: 'Jean Dupont',
      depositorIdDocument: 'CNI-12345',
    })

    expect(id).toBe('mock-uuid')
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mock-uuid',
        shopId: 'shop-1',
        entryNumber: 1,
        entryType: 'entry',
        itemId: 'item-1',
        depositorId: 'dep-1',
        description: 'Premier article',
        depositorName: 'Jean Dupont',
        depositorIdDocument: 'CNI-12345',
        previousHash: '0'.repeat(64),
        hash: 'mock-hash-value',
        saleId: null,
        exitReason: null,
      }),
    )
  })

  it('chains from previous entry hash and increments entry number', async () => {
    const { db, insertValues } = createMockDb({
      lastEntry: { hash: 'abc123' + '0'.repeat(58), entryNumber: 5 },
    })

    const id = await createPoliceLedgerEntry(db, {
      shopId: 'shop-1' as ShopId,
      entryType: 'exit',
      itemId: 'item-10',
      depositorId: null,
      description: 'Article vendu',
      depositorName: 'N/A',
      depositorIdDocument: 'N/A',
      saleId: 'sale-5',
      exitReason: 'sold',
    })

    expect(id).toBe('mock-uuid')
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entryNumber: 6,
        previousHash: 'abc123' + '0'.repeat(58),
        hash: 'mock-hash-value',
        saleId: 'sale-5',
        exitReason: 'sold',
      }),
    )
  })
})
