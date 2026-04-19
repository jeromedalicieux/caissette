import { offlineDb, type PendingSale } from './db'
import { sales } from '$lib/api/client'

/** Add a sale to the offline queue */
export async function queueOfflineSale(sale: Omit<PendingSale, 'id' | 'status' | 'createdAt'>): Promise<string> {
  const tempId = sale.tempId
  await offlineDb.pendingSales.add({
    ...sale,
    status: 'pending',
    createdAt: Date.now(),
  })
  return tempId
}

/** Get count of pending sales */
export async function getPendingCount(): Promise<number> {
  return offlineDb.pendingSales.where('status').equals('pending').count()
}

/** Get all pending sales */
export async function getPendingSales(): Promise<PendingSale[]> {
  return offlineDb.pendingSales.where('status').anyOf(['pending', 'failed']).toArray()
}

/** Sync all pending sales to the server */
export async function syncPendingSales(): Promise<{ synced: number; failed: number }> {
  const pending = await offlineDb.pendingSales
    .where('status')
    .anyOf(['pending', 'failed'])
    .sortBy('createdAt')

  let synced = 0
  let failed = 0

  for (const sale of pending) {
    try {
      // Mark as syncing
      await offlineDb.pendingSales.update(sale.id!, { status: 'syncing' })

      // Send to server
      const result = await sales.create({
        cashierId: sale.cashierId,
        paymentMethod: sale.paymentMethod,
        items: sale.items,
        customerNote: sale.customerNote,
      })

      // Mark as synced
      await offlineDb.pendingSales.update(sale.id!, {
        status: 'synced',
        serverSaleId: result.id,
      })
      synced++
    } catch (e: any) {
      // Mark as failed
      await offlineDb.pendingSales.update(sale.id!, {
        status: 'failed',
        error: e.message,
      })
      failed++
    }
  }

  // Clean up synced entries older than 24h
  const cutoff = Date.now() - 86400000
  await offlineDb.pendingSales
    .where('status')
    .equals('synced')
    .filter((s) => s.createdAt < cutoff)
    .delete()

  return { synced, failed }
}
