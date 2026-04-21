import Dexie, { type Table } from 'dexie'

export interface PendingSale {
  id?: number
  tempId: string
  cashierId: string
  paymentMethod: string
  items: Array<{
    itemId?: string
    name: string
    price: number
    depositorId?: string
    vatRegime: string
    vatRate: number
    commissionTtc?: number
    reversementAmount?: number
  }>
  customerNote?: string
  total: number
  createdAt: number
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'
  error?: string
  serverSaleId?: string
}

export interface CachedItem {
  id: string
  shopId: string
  type: string // 'product' | 'service'
  name: string
  sku: string | null
  category: string | null
  brand: string | null
  size: string | null
  currentPrice: number
  vatRegime: string
  vatRate: number
  depositorId: string | null
  status: string
  data: string // full JSON of the item for any other fields
}

class CaissetteOfflineDB extends Dexie {
  pendingSales!: Table<PendingSale>
  cachedItems!: Table<CachedItem>

  constructor() {
    super('caissette-offline')
    this.version(1).stores({
      pendingSales: '++id, tempId, status, createdAt',
    })
    this.version(2).stores({
      pendingSales: '++id, tempId, status, createdAt',
      cachedItems: 'id, shopId, status, type',
    })
  }
}

export const offlineDb = new CaissetteOfflineDB()
