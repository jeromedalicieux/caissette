/** Branded types for type-safe numeric values */

declare const __brand: unique symbol

type Brand<T, B extends string> = T & { readonly [__brand]: B }

/** Amount in cents (integer) */
export type Cents = Brand<number, 'Cents'>

/** Rate in basis points (1 bps = 0.01%) */
export type Bps = Brand<number, 'Bps'>

/** Shop identifier (UUID v7) */
export type ShopId = Brand<string, 'ShopId'>

/** User identifier (UUID v7) */
export type UserId = Brand<string, 'UserId'>

/** Depositor identifier (UUID v7) */
export type DepositorId = Brand<string, 'DepositorId'>

/** Contract identifier (UUID v7) */
export type ContractId = Brand<string, 'ContractId'>

/** Item identifier (UUID v7) */
export type ItemId = Brand<string, 'ItemId'>

/** Sale identifier (UUID v7) */
export type SaleId = Brand<string, 'SaleId'>

/** Closure identifier (UUID v7) */
export type ClosureId = Brand<string, 'ClosureId'>

/** SHA-256 hash string */
export type Hash = Brand<string, 'Hash'>

export function cents(value: number): Cents {
  return Math.round(value) as Cents
}

export function bps(value: number): Bps {
  return Math.round(value) as Bps
}
