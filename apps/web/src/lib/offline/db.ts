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
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  error?: string
  serverSaleId?: string
}

class RebondOfflineDB extends Dexie {
  pendingSales!: Table<PendingSale>

  constructor() {
    super('rebond-offline')
    this.version(1).stores({
      pendingSales: '++id, tempId, status, createdAt',
    })
  }
}

export const offlineDb = new RebondOfflineDB()
