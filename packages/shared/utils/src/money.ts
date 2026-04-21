import { type Bps, type Cents, cents } from '@caissette/types'

/**
 * Banker's rounding (round half to even).
 * Used for all financial calculations per French accounting rules.
 */
export function bankersRound(value: number): number {
  const rounded = Math.round(value)
  // If exactly at .5, round to even
  if (Math.abs(value - (rounded - 0.5)) < Number.EPSILON) {
    return rounded % 2 === 0 ? rounded : rounded - 1
  }
  return rounded
}

/** Convert cents (integer) to euros (decimal) */
export function centsToEuros(amount: Cents): number {
  return amount / 100
}

/** Convert euros (decimal) to cents (integer) with banker's rounding */
export function eurosToCents(euros: number): Cents {
  return cents(bankersRound(euros * 100))
}

/** Convert basis points to percentage (e.g., 2000 bps -> 20%) */
export function bpsToPercent(rate: Bps): number {
  return rate / 100
}
