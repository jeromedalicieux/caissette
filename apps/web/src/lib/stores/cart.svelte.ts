import type { VatRegime } from '@rebond/types'

export interface CartItem {
  itemId?: string
  type?: 'product' | 'service'
  name: string
  price: number // cents (original price)
  discount?: number // cents (discount amount)
  costBasis?: number
  reversementAmount?: number
  depositorId?: string
  vatRegime: VatRegime
  vatRate: number // bps
  commissionTtc?: number
}

export interface PaymentSplit {
  method: 'cash' | 'card' | 'check' | 'transfer' | 'other'
  amount: number // cents
}

function createCart() {
  let items = $state<CartItem[]>([])
  let globalDiscountPercent = $state(0) // 0-100
  let globalDiscountFixed = $state(0) // cents

  return {
    get items() {
      return items
    },
    get subtotal() {
      return items.reduce((sum, item) => sum + item.price, 0)
    },
    get itemDiscountTotal() {
      return items.reduce((sum, item) => sum + (item.discount ?? 0), 0)
    },
    get subtotalAfterItemDiscounts() {
      return items.reduce((sum, item) => sum + item.price - (item.discount ?? 0), 0)
    },
    get globalDiscountAmount() {
      const afterItems = items.reduce((sum, item) => sum + item.price - (item.discount ?? 0), 0)
      if (globalDiscountPercent > 0) {
        return Math.round(afterItems * globalDiscountPercent / 100)
      }
      return globalDiscountFixed
    },
    get totalDiscount() {
      return items.reduce((sum, item) => sum + (item.discount ?? 0), 0) +
        (globalDiscountPercent > 0
          ? Math.round(items.reduce((sum, item) => sum + item.price - (item.discount ?? 0), 0) * globalDiscountPercent / 100)
          : globalDiscountFixed)
    },
    get total() {
      const sub = items.reduce((sum, item) => sum + item.price - (item.discount ?? 0), 0)
      if (globalDiscountPercent > 0) {
        return sub - Math.round(sub * globalDiscountPercent / 100)
      }
      return Math.max(0, sub - globalDiscountFixed)
    },
    get count() {
      return items.length
    },
    get globalDiscountPercent() {
      return globalDiscountPercent
    },
    get globalDiscountFixed() {
      return globalDiscountFixed
    },
    add(item: CartItem) {
      items = [...items, item]
    },
    remove(index: number) {
      items = items.filter((_, i) => i !== index)
    },
    setItemDiscount(index: number, discount: number) {
      items = items.map((item, i) => i === index ? { ...item, discount: Math.max(0, Math.min(discount, item.price)) } : item)
    },
    setGlobalDiscountPercent(percent: number) {
      globalDiscountPercent = Math.max(0, Math.min(100, percent))
      globalDiscountFixed = 0
    },
    setGlobalDiscountFixed(amount: number) {
      globalDiscountFixed = Math.max(0, amount)
      globalDiscountPercent = 0
    },
    clearGlobalDiscount() {
      globalDiscountPercent = 0
      globalDiscountFixed = 0
    },
    clear() {
      items = []
      globalDiscountPercent = 0
      globalDiscountFixed = 0
    },
  }
}

export const cart = createCart()
