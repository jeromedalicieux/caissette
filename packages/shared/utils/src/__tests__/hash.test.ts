import { describe, expect, it } from 'vitest'
import { computeHash, computeChainedHash, genesisHash } from '../hash.js'
import type { Hash, ShopId } from '@rebond/types'

describe('computeHash', () => {
  it('returns a 64-char hex string', async () => {
    const hash = await computeHash('test')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', async () => {
    const h1 = await computeHash('hello')
    const h2 = await computeHash('hello')
    expect(h1).toBe(h2)
  })

  it('produces different hashes for different inputs', async () => {
    const h1 = await computeHash('a')
    const h2 = await computeHash('b')
    expect(h1).not.toBe(h2)
  })
})

describe('genesisHash', () => {
  it('produces a valid hash from shop ID', async () => {
    const shopId = 'shop-123' as ShopId
    const hash = await genesisHash(shopId)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for same shop', async () => {
    const shopId = 'shop-abc' as ShopId
    const h1 = await genesisHash(shopId)
    const h2 = await genesisHash(shopId)
    expect(h1).toBe(h2)
  })
})

describe('computeChainedHash', () => {
  it('chains correctly with previous hash', async () => {
    const previous = await computeHash('genesis')
    const hash = await computeChainedHash(previous, { total: 6000 }, 1, 1700000000)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toBe(previous)
  })

  it('is deterministic', async () => {
    const prev = 'abc123' as Hash
    const payload = { a: 1, b: 2 }
    const h1 = await computeChainedHash(prev, payload, 1, 1700000000)
    const h2 = await computeChainedHash(prev, payload, 1, 1700000000)
    expect(h1).toBe(h2)
  })

  it('produces different hash with different receipt number', async () => {
    const prev = 'abc123' as Hash
    const payload = { total: 100 }
    const h1 = await computeChainedHash(prev, payload, 1, 1700000000)
    const h2 = await computeChainedHash(prev, payload, 2, 1700000000)
    expect(h1).not.toBe(h2)
  })
})
