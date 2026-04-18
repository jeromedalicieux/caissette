import { describe, expect, it } from 'vitest'
import { bankersRound, centsToEuros, eurosToCents } from '../money.js'
import type { Cents } from '@rebond/types'

describe('bankersRound', () => {
  it('rounds down when below .5', () => {
    expect(bankersRound(2.3)).toBe(2)
    expect(bankersRound(2.49)).toBe(2)
  })

  it('rounds up when above .5', () => {
    expect(bankersRound(2.6)).toBe(3)
    expect(bankersRound(2.51)).toBe(3)
  })

  it('rounds to even when exactly at .5', () => {
    expect(bankersRound(0.5)).toBe(0) // even
    expect(bankersRound(1.5)).toBe(2) // even
    expect(bankersRound(2.5)).toBe(2) // even
    expect(bankersRound(3.5)).toBe(4) // even
    expect(bankersRound(4.5)).toBe(4) // even
  })

  it('handles negative values', () => {
    expect(bankersRound(-2.3)).toBe(-2)
    expect(bankersRound(-2.6)).toBe(-3)
  })

  it('handles zero', () => {
    expect(bankersRound(0)).toBe(0)
  })
})

describe('centsToEuros', () => {
  it('converts cents to euros', () => {
    expect(centsToEuros(6000 as Cents)).toBe(60)
    expect(centsToEuros(199 as Cents)).toBe(1.99)
    expect(centsToEuros(0 as Cents)).toBe(0)
  })
})

describe('eurosToCents', () => {
  it('converts euros to cents with rounding', () => {
    expect(eurosToCents(60)).toBe(6000)
    expect(eurosToCents(1.99)).toBe(199)
    expect(eurosToCents(0)).toBe(0)
  })
})
