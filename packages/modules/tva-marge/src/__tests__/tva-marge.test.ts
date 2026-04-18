import { describe, expect, it } from 'vitest'
import { calculateVatMargin } from '../index.js'

describe('calculateVatMargin', () => {
  describe('deposit regime (intermédiaire opaque)', () => {
    it('calculates TVA on commission — CDC example: robe 60€, commission 40%', () => {
      // CDC 2.3.3: robe 60€ TTC, commission 24€ TTC, TVA 20%
      const result = calculateVatMargin({
        regime: 'deposit',
        salePriceTtc: 6000, // 60.00€
        commissionTtc: 2400, // 24.00€ (40% of 60€)
        vatRate: 2000, // 20%
      })

      expect(result.regime).toBe('deposit')
      expect(result.taxableBase).toBe(2400) // commission TTC
      expect(result.vatAmount).toBe(400) // 24 × 20/120 = 4.00€
      expect(result.amountHt).toBe(2000) // 24 - 4 = 20.00€
    })

    it('handles zero commission', () => {
      const result = calculateVatMargin({
        regime: 'deposit',
        salePriceTtc: 5000,
        commissionTtc: 0,
        vatRate: 2000,
      })

      expect(result.vatAmount).toBe(0)
      expect(result.amountHt).toBe(0)
    })

    it('handles missing commissionTtc (defaults to 0)', () => {
      const result = calculateVatMargin({
        regime: 'deposit',
        salePriceTtc: 5000,
        vatRate: 2000,
      })

      expect(result.vatAmount).toBe(0)
      expect(result.amountHt).toBe(0)
    })

    it('handles reduced VAT rate (5.5%)', () => {
      const result = calculateVatMargin({
        regime: 'deposit',
        salePriceTtc: 10000,
        commissionTtc: 3000, // 30€ commission
        vatRate: 550, // 5.5%
      })

      // 3000 × 550 / (10000 + 550) = 3000 × 550 / 10550 = 156.39... → 156
      expect(result.vatAmount).toBe(156)
      expect(result.amountHt).toBe(2844) // 3000 - 156
    })
  })

  describe('resale_item_by_item regime', () => {
    it('calculates TVA on positive margin', () => {
      const result = calculateVatMargin({
        regime: 'resale_item_by_item',
        salePriceTtc: 8000, // sold 80€
        costBasisTtc: 5000, // bought 50€
        vatRate: 2000, // 20%
      })

      expect(result.taxableBase).toBe(3000) // margin = 80 - 50 = 30€
      // 3000 × 2000 / 12000 = 500
      expect(result.vatAmount).toBe(500) // 5.00€
      expect(result.amountHt).toBe(2500) // 25.00€
    })

    it('handles missing costBasisTtc (defaults to 0)', () => {
      const result = calculateVatMargin({
        regime: 'resale_item_by_item',
        salePriceTtc: 8000,
        vatRate: 2000,
      })

      // margin = 8000 - 0 = 8000
      expect(result.taxableBase).toBe(8000)
      expect(result.vatAmount).toBe(1333) // 8000 × 2000 / 12000 = 1333.33 → 1333
    })

    it('handles sale at loss — margin = 0, TVA = 0 (CDC 2.3.4)', () => {
      const result = calculateVatMargin({
        regime: 'resale_item_by_item',
        salePriceTtc: 3000, // sold 30€
        costBasisTtc: 5000, // bought 50€
        vatRate: 2000,
      })

      expect(result.taxableBase).toBe(0)
      expect(result.vatAmount).toBe(0)
      expect(result.amountHt).toBe(0)
    })

    it('handles sale at exact cost — margin = 0', () => {
      const result = calculateVatMargin({
        regime: 'resale_item_by_item',
        salePriceTtc: 5000,
        costBasisTtc: 5000,
        vatRate: 2000,
      })

      expect(result.taxableBase).toBe(0)
      expect(result.vatAmount).toBe(0)
    })
  })

  describe('resale_global_period regime', () => {
    it('calculates TVA on period margin', () => {
      // Period totals: sold 50000€, bought 35000€
      const result = calculateVatMargin({
        regime: 'resale_global_period',
        salePriceTtc: 5000000,
        costBasisTtc: 3500000,
        vatRate: 2000,
      })

      expect(result.taxableBase).toBe(1500000) // margin 15000€
      // 1500000 × 2000 / 12000 = 250000
      expect(result.vatAmount).toBe(250000) // 2500€
      expect(result.amountHt).toBe(1250000) // 12500€
    })

    it('handles missing costBasisTtc for period (defaults to 0)', () => {
      const result = calculateVatMargin({
        regime: 'resale_global_period',
        salePriceTtc: 5000000,
        vatRate: 2000,
      })

      expect(result.taxableBase).toBe(5000000)
    })

    it('handles negative period margin — capped to 0', () => {
      const result = calculateVatMargin({
        regime: 'resale_global_period',
        salePriceTtc: 2000000,
        costBasisTtc: 3000000,
        vatRate: 2000,
      })

      expect(result.taxableBase).toBe(0)
      expect(result.vatAmount).toBe(0)
    })
  })

  describe('normal regime', () => {
    it('calculates standard TVA on full price', () => {
      const result = calculateVatMargin({
        regime: 'normal',
        salePriceTtc: 12000, // 120€ TTC
        vatRate: 2000, // 20%
      })

      expect(result.taxableBase).toBe(12000)
      // 12000 × 2000 / 12000 = 2000
      expect(result.vatAmount).toBe(2000) // 20.00€
      expect(result.amountHt).toBe(10000) // 100.00€
    })

    it('handles 10% rate', () => {
      const result = calculateVatMargin({
        regime: 'normal',
        salePriceTtc: 11000, // 110€ TTC
        vatRate: 1000, // 10%
      })

      // 11000 × 1000 / 11000 = 1000
      expect(result.vatAmount).toBe(1000) // 10.00€
      expect(result.amountHt).toBe(10000) // 100.00€
    })
  })
})
