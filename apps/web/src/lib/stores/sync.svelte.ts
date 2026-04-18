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

  if (typeof window !== 'undefined') {
    online = navigator.onLine
    window.addEventListener('online', () => (online = true))
    window.addEventListener('offline', () => (online = false))
  }

  return {
    get queue() {
      return queue
    },
    get pendingCount() {
      return queue.filter((a) => a.status === 'pending').length
    },
    get isOnline() {
      return online
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
  }
}

export const syncStore = createSyncStore()
