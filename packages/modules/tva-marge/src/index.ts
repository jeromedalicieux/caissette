import { z } from 'zod'
import type { Bps, Cents, VatRegime } from '@rebond/types'
import { bankersRound } from '@rebond/utils'

/** Input for VAT margin calculation */
export const vatMarginInputSchema = z.object({
  regime: z.enum(['deposit', 'resale_item_by_item', 'resale_global_period', 'normal']),
  /** Sale price TTC in cents */
  salePriceTtc: z.number().int().nonnegative(),
  /** Cost basis / purchase price TTC in cents (for resale regimes) */
  costBasisTtc: z.number().int().nonnegative().optional(),
  /** Commission amount TTC in cents (for deposit regime) */
  commissionTtc: z.number().int().nonnegative().optional(),
  /** VAT rate in basis points (e.g., 2000 = 20%) */
  vatRate: z.number().int().min(0).max(10000),
})

export type VatMarginInput = z.infer<typeof vatMarginInputSchema>

export interface VatMarginResult {
  regime: VatRegime
  /** Taxable base in cents (margin or commission) */
  taxableBase: Cents
  /** VAT amount in cents */
  vatAmount: Cents
  /** Amount HT in cents */
  amountHt: Cents
}

/**
 * Calculate VAT on margin per article 297 A CGI.
 *
 * Regimes:
 * - deposit: TVA on commission (intermédiaire opaque). Base = commission TTC.
 * - resale_item_by_item: TVA on margin per item. Base = sale - cost.
 * - resale_global_period: TVA on aggregated margin per period.
 * - normal: Standard TVA on full price.
 */
export function calculateVatMargin(input: VatMarginInput): VatMarginResult {
  const parsed = vatMarginInputSchema.parse(input)
  const rate = parsed.vatRate // in bps

  switch (parsed.regime) {
    case 'deposit': {
      // TVA on commission (deposit-vente, intermédiaire opaque)
      const commission = parsed.commissionTtc ?? 0
      const vatAmount = bankersRound((commission * rate) / (10000 + rate)) as Cents
      const amountHt = (commission - vatAmount) as unknown as Cents
      return {
        regime: 'deposit' as VatRegime,
        taxableBase: commission as Cents,
        vatAmount,
        amountHt,
      }
    }

    case 'resale_item_by_item': {
      // TVA on margin per item
      const margin = Math.max(0, parsed.salePriceTtc - (parsed.costBasisTtc ?? 0))
      const vatAmount = bankersRound((margin * rate) / (10000 + rate)) as Cents
      const amountHt = (margin - vatAmount) as unknown as Cents
      return {
        regime: 'resale_item_by_item' as VatRegime,
        taxableBase: margin as Cents,
        vatAmount,
        amountHt,
      }
    }

    case 'resale_global_period': {
      // TVA on global margin (aggregated — input here is the period margin)
      const margin = Math.max(0, parsed.salePriceTtc - (parsed.costBasisTtc ?? 0))
      const vatAmount = bankersRound((margin * rate) / (10000 + rate)) as Cents
      const amountHt = (margin - vatAmount) as unknown as Cents
      return {
        regime: 'resale_global_period' as VatRegime,
        taxableBase: margin as Cents,
        vatAmount,
        amountHt,
      }
    }

    case 'normal': {
      // Standard VAT on full price
      const vatAmount = bankersRound(
        (parsed.salePriceTtc * rate) / (10000 + rate),
      ) as Cents
      const amountHt = (parsed.salePriceTtc - vatAmount) as unknown as Cents
      return {
        regime: 'normal' as VatRegime,
        taxableBase: parsed.salePriceTtc as Cents,
        vatAmount,
        amountHt,
      }
    }
  }
}
