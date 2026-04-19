import { getPendingCount, syncPendingSales } from '$lib/offline/sync'

interface QueuedAction {
  id: string
  type: string
  payload: Record<string, unknown>
  createdAt: number
  status: 'pending' | 'syncing' | 'failed'
}

function createSyncStore() {
  let queue = $state<QueuedAction[]>([])
  let online = $state(true)
  let offlineSalesCount = $state(0)
  let syncing = $state(false)

  if (typeof window !== 'undefined') {
    online = navigator.onLine
    window.addEventListener('online', () => {
      online = true
      // Auto-sync when back online
      syncOfflineSales()
    })
    window.addEventListener('offline', () => (online = false))

    // Check pending count on load
    refreshPendingCount()
  }

  async function refreshPendingCount() {
    try {
      offlineSalesCount = await getPendingCount()
    } catch {
      offlineSalesCount = 0
    }
  }

  async function syncOfflineSales() {
    if (syncing || !online) return
    syncing = true
    try {
      const result = await syncPendingSales()
      if (result.synced > 0) {
        console.log(`Synced ${result.synced} offline sales`)
      }
    } catch (e) {
      console.error('Sync failed:', e)
    }
    await refreshPendingCount()
    syncing = false
  }

  return {
    get queue() {
      return queue
    },
    get pendingCount() {
      return queue.filter((a) => a.status === 'pending').length + offlineSalesCount
    },
    get isOnline() {
      return online
    },
    get isSyncing() {
      return syncing
    },
    get offlineSalesCount() {
      return offlineSalesCount
    },
    enqueue(type: string, payload: Record<string, unknown>) {
      queue = [
        ...queue,
        {
          id: crypto.randomUUID(),
          type,
          payload,
          createdAt: Date.now(),
          status: 'pending',
        },
      ]
    },
    markSynced(id: string) {
      queue = queue.filter((a) => a.id !== id)
    },
    refreshPendingCount,
    syncOfflineSales,
  }
}

export const syncStore = createSyncStore()
