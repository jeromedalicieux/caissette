import type { VatRegime } from '@caissette/types'

export interface CartItem {
  itemId?: string
  type?: 'product' | 'service'
  name: string
  price: number // cents (unit price)
  quantity: number
  discount?: number // cents per unit
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
  let globalDiscountPercent = $state(0)
  let globalDiscountFixed = $state(0)

  function lineTotal(item: CartItem): number {
    return (item.price - (item.discount ?? 0)) * item.quantity
  }

  return {
    get items() {
      return items
    },
    get subtotal() {
      return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    },
    get itemDiscountTotal() {
      return items.reduce((sum, item) => sum + (item.discount ?? 0) * item.quantity, 0)
    },
    get subtotalAfterItemDiscounts() {
      return items.reduce((sum, item) => sum + lineTotal(item), 0)
    },
    get globalDiscountAmount() {
      const afterItems = items.reduce((sum, item) => sum + lineTotal(item), 0)
      if (globalDiscountPercent > 0) {
        return Math.round(afterItems * globalDiscountPercent / 100)
      }
      return globalDiscountFixed
    },
    get totalDiscount() {
      const itemDisc = items.reduce((sum, item) => sum + (item.discount ?? 0) * item.quantity, 0)
      const afterItems = items.reduce((sum, item) => sum + lineTotal(item), 0)
      const globalDisc = globalDiscountPercent > 0
        ? Math.round(afterItems * globalDiscountPercent / 100)
        : globalDiscountFixed
      return itemDisc + globalDisc
    },
    get total() {
      const sub = items.reduce((sum, item) => sum + lineTotal(item), 0)
      if (globalDiscountPercent > 0) {
        return sub - Math.round(sub * globalDiscountPercent / 100)
      }
      return Math.max(0, sub - globalDiscountFixed)
    },
    get count() {
      return items.reduce((sum, item) => sum + item.quantity, 0)
    },
    get lineCount() {
      return items.length
    },
    get globalDiscountPercent() {
      return globalDiscountPercent
    },
    get globalDiscountFixed() {
      return globalDiscountFixed
    },
    add(item: Omit<CartItem, 'quantity'> & { quantity?: number }) {
      // For services or items without ID, always merge if same name+price
      // For products with ID, merge if same itemId
      const existingIdx = items.findIndex(existing => {
        if (item.itemId && existing.itemId) return existing.itemId === item.itemId
        return existing.name === item.name && existing.price === item.price && !existing.itemId && !item.itemId
      })

      if (existingIdx >= 0 && (items[existingIdx]!.type === 'service' || !item.itemId)) {
        // Merge: increment quantity
        items = items.map((it, i) => i === existingIdx ? { ...it, quantity: it.quantity + (item.quantity ?? 1) } : it)
      } else {
        items = [...items, { ...item, quantity: item.quantity ?? 1 }]
      }
    },
    remove(index: number) {
      items = items.filter((_, i) => i !== index)
    },
    setQuantity(index: number, qty: number) {
      if (qty <= 0) {
        items = items.filter((_, i) => i !== index)
      } else {
        items = items.map((item, i) => i === index ? { ...item, quantity: qty } : item)
      }
    },
    incrementQuantity(index: number) {
      items = items.map((item, i) => i === index ? { ...item, quantity: item.quantity + 1 } : item)
    },
    decrementQuantity(index: number) {
      const item = items[index]
      if (!item) return
      if (item.quantity <= 1) {
        items = items.filter((_, i) => i !== index)
      } else {
        items = items.map((it, i) => i === index ? { ...it, quantity: it.quantity - 1 } : it)
      }
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
