import { offlineDb, type CachedItem } from './db'
import { items } from '$lib/api/client'

/** Refresh the local items cache from the API */
export async function refreshItemsCache(): Promise<void> {
  try {
    const serverItems = await items.list('available')
    // Clear and replace
    await offlineDb.cachedItems.clear()
    const mapped: CachedItem[] = serverItems.map((item: any) => ({
      id: item.id,
      shopId: item.shop_id ?? item.shopId ?? '',
      type: item.type ?? 'product',
      name: item.name,
      sku: item.sku ?? null,
      category: item.category ?? null,
      brand: item.brand ?? null,
      size: item.size ?? null,
      currentPrice: item.current_price ?? item.currentPrice,
      vatRegime: item.vat_regime ?? item.vatRegime ?? 'normal',
      vatRate: item.vat_rate ?? item.vatRate ?? 2000,
      depositorId: item.depositor_id ?? item.depositorId ?? null,
      status: item.status ?? 'available',
      data: JSON.stringify(item),
    }))
    await offlineDb.cachedItems.bulkAdd(mapped)
  } catch {
    // Offline or error — keep existing cache
  }
}

/** Get items from local cache */
export async function getCachedItems(): Promise<any[]> {
  const cached = await offlineDb.cachedItems.where('status').equals('available').toArray()
  return cached.map((c) => ({
    ...JSON.parse(c.data),
    // Ensure normalized fields
    id: c.id,
    name: c.name,
    type: c.type,
    current_price: c.currentPrice,
    currentPrice: c.currentPrice,
    sku: c.sku,
    category: c.category,
    brand: c.brand,
    vat_regime: c.vatRegime,
    vatRegime: c.vatRegime,
    vat_rate: c.vatRate,
    vatRate: c.vatRate,
    depositor_id: c.depositorId,
    depositorId: c.depositorId,
    status: c.status,
  }))
}

/** Mark an item as sold in the local cache (for products only) */
export async function markItemSoldLocally(itemId: string): Promise<void> {
  await offlineDb.cachedItems.update(itemId, { status: 'sold' })
}

/** Get cache stats */
export async function getCacheStats(): Promise<{ items: number; lastRefresh: number | null }> {
  const count = await offlineDb.cachedItems.count()
  const lastRefresh = parseInt(localStorage.getItem('caissette_cache_refresh') ?? '0') || null
  return { items: count, lastRefresh }
}
