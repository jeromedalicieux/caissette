import { describe, it, expect } from 'vitest'
import { parseSettings } from '../index.js'
import { DEFAULT_SHOP_SETTINGS } from '@rebond/types'

describe('parseSettings', () => {
  it('returns defaults for null', () => {
    const result = parseSettings(null)
    expect(result.features.depositSale).toBe(false)
    expect(result.defaultCommissionRate).toBe(4000)
    expect(result.receiptFooter).toBe('')
  })

  it('returns defaults for empty object', () => {
    const result = parseSettings('{}')
    expect(result.features.depositSale).toBe(false)
    expect(result.defaultCommissionRate).toBe(DEFAULT_SHOP_SETTINGS.defaultCommissionRate)
    expect(result.receiptFooter).toBe('')
  })

  it('returns defaults for invalid JSON', () => {
    const result = parseSettings('not json')
    expect(result.features.depositSale).toBe(false)
  })

  it('infers depositSale=true when defaultCommissionRate exists but no features (retrocompat)', () => {
    const result = parseSettings('{"defaultCommissionRate":5000}')
    expect(result.features.depositSale).toBe(true)
    expect(result.defaultCommissionRate).toBe(5000)
  })

  it('respects explicit features.depositSale=true', () => {
    const result = parseSettings('{"features":{"depositSale":true}}')
    expect(result.features.depositSale).toBe(true)
  })

  it('respects explicit features.depositSale=false', () => {
    const result = parseSettings('{"features":{"depositSale":false}}')
    expect(result.features.depositSale).toBe(false)
  })

  it('respects features.depositSale=false even with defaultCommissionRate', () => {
    const result = parseSettings('{"features":{"depositSale":false},"defaultCommissionRate":3000}')
    expect(result.features.depositSale).toBe(false)
    expect(result.defaultCommissionRate).toBe(3000)
  })

  it('preserves receiptFooter when provided', () => {
    const result = parseSettings('{"receiptFooter":"Merci!"}')
    expect(result.receiptFooter).toBe('Merci!')
  })
})
