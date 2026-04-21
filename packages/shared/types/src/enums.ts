/** VAT regime for a shop or item */
export const VatRegime = {
  /** Deposit: TVA on commission (intermédiaire opaque) */
  Deposit: 'deposit',
  /** Resale item by item: TVA on margin per item */
  ResaleItemByItem: 'resale_item_by_item',
  /** Resale global per period */
  ResaleGlobalPeriod: 'resale_global_period',
  /** Standard VAT on full price */
  Normal: 'normal',
} as const
export type VatRegime = (typeof VatRegime)[keyof typeof VatRegime]

/** VAT declaration regime for a shop */
export const VatDeclarationRegime = {
  Franchise: 'franchise',
  Simplified: 'simplified',
  Normal: 'normal',
} as const
export type VatDeclarationRegime =
  (typeof VatDeclarationRegime)[keyof typeof VatDeclarationRegime]

/** Payment method */
export const PaymentMethod = {
  Cash: 'cash',
  Card: 'card',
  Check: 'check',
  Transfer: 'transfer',
  Other: 'other',
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

/** Item type */
export const ItemType = {
  Product: 'product',
  Service: 'service',
} as const
export type ItemType = (typeof ItemType)[keyof typeof ItemType]

/** Item status */
export const ItemStatus = {
  Available: 'available',
  Sold: 'sold',
  Returned: 'returned',
  ShopOwned: 'shop_owned',
  Destroyed: 'destroyed',
} as const
export type ItemStatus = (typeof ItemStatus)[keyof typeof ItemStatus]

/** Item condition */
export const ItemCondition = {
  New: 'new',
  Excellent: 'excellent',
  Good: 'good',
  Fair: 'fair',
} as const
export type ItemCondition = (typeof ItemCondition)[keyof typeof ItemCondition]

/** Sale status */
export const SaleStatus = {
  Completed: 'completed',
  Refunded: 'refunded',
  PartialRefund: 'partial_refund',
} as const
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus]

/** User role */
export const UserRole = {
  Owner: 'owner',
  Manager: 'manager',
  Cashier: 'cashier',
  Accountant: 'accountant',
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

/** Cash movement type */
export const CashMovementType = {
  OpeningFloat: 'opening_float',
  ClosingCount: 'closing_count',
  Deposit: 'deposit',
  Withdrawal: 'withdrawal',
} as const
export type CashMovementType = (typeof CashMovementType)[keyof typeof CashMovementType]

/** Contract status */
export const ContractStatus = {
  Active: 'active',
  Expired: 'expired',
  Closed: 'closed',
} as const
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus]

/** Closure type */
export const ClosureType = {
  Daily: 'daily',
  Monthly: 'monthly',
  Yearly: 'yearly',
} as const
export type ClosureType = (typeof ClosureType)[keyof typeof ClosureType]

/** Identity document type */
export const IdDocumentType = {
  CNI: 'cni',
  Passport: 'passport',
  DriverLicense: 'driver_license',
} as const
export type IdDocumentType = (typeof IdDocumentType)[keyof typeof IdDocumentType]

/** Police ledger entry type */
export const PoliceLedgerEntryType = {
  Entry: 'entry',
  Exit: 'exit',
} as const
export type PoliceLedgerEntryType =
  (typeof PoliceLedgerEntryType)[keyof typeof PoliceLedgerEntryType]

/** Police ledger exit reason */
export const ExitReason = {
  Sold: 'sold',
  Returned: 'returned',
  Destroyed: 'destroyed',
  ShopOwned: 'shop_owned',
} as const
export type ExitReason = (typeof ExitReason)[keyof typeof ExitReason]

/** Reversement status */
export const ReversementStatus = {
  Pending: 'pending',
  Paid: 'paid',
  Cancelled: 'cancelled',
} as const
export type ReversementStatus = (typeof ReversementStatus)[keyof typeof ReversementStatus]

/** Subscription tier */
export const SubscriptionTier = {
  Starter: 'starter',
  Standard: 'standard',
  Pro: 'pro',
} as const
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier]

/** Pricing rule scope */
export const PricingRuleScope = {
  Shop: 'shop',
  Contract: 'contract',
  Category: 'category',
} as const
export type PricingRuleScope = (typeof PricingRuleScope)[keyof typeof PricingRuleScope]
