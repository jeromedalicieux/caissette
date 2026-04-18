import type { VatRegime } from '@rebond/types'

export interface CartItem {
  itemId?: string
  name: string
  price: number // cents
  costBasis?: number
  reversementAmount?: number
  depositorId?: string
  vatRegime: VatRegime
  vatRate: number // bps
  commissionTtc?: number
}

function createCart() {
  let items = $state<CartItem[]>([])

  return {
    get items() {
      return items
    },
    get total() {
      return items.reduce((sum, item) => sum + item.price, 0)
    },
    get count() {
      return items.length
    },
    add(item: CartItem) {
      items = [...items, item]
    },
    remove(index: number) {
      items = items.filter((_, i) => i !== index)
    },
    clear() {
      items = []
    },
  }
}

export const cart = createCart()
