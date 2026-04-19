import type { Cents, DepositorId, Hash, ItemId, SaleId, ShopId, UserId } from './branded.js'
import type { PaymentMethod } from './enums.js'

/** Core event types emitted across modules */
export interface EventMap {
  'depositor.created': { depositorId: DepositorId; shopId: ShopId; createdBy: UserId }
  'deposit.contract.signed': {
    contractId: string
    depositorId: DepositorId
    items: ItemId[]
  }
  'item.created': {
    itemId: ItemId
    shopId: ShopId
    depositorId: DepositorId | null
    contractId: string | null
    price: Cents
  }
  'item.sold': {
    saleId: SaleId
    shopId: ShopId
    itemId: ItemId
    price: Cents
    paymentMethod: PaymentMethod
  }
  'item.returned': { itemId: ItemId; shopId: ShopId; depositorId: DepositorId | null; reason: string }
  'sale.completed': {
    saleId: SaleId
    total: Cents
    vatMarginAmount: Cents
    hash: Hash
  }
  'sale.refunded': {
    saleId: SaleId
    originalSaleId: SaleId
    amount: Cents
  }
  'daily_closure.generated': {
    closureId: string
    date: string
    totals: { amount: Cents; vat: Cents; salesCount: number }
    signature: string
  }
  'reversement.due': {
    depositorId: DepositorId
    amount: Cents
    period: string
  }
  'reversement.paid': {
    reversementId: string
    method: PaymentMethod
  }
  'audit.entry': {
    eventType: string
    entityType: string | null
    entityId: string | null
    shopId: ShopId | null
    userId: UserId | null
  }
}

export type EventType = keyof EventMap
export type EventPayload<T extends EventType> = EventMap[T]
