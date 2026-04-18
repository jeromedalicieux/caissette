import type { EventMap, EventType, EventPayload } from '@rebond/types'

export type EventHandler<T extends EventType> = (payload: EventPayload<T>) => void | Promise<void>

export interface EventBus {
  emit<T extends EventType>(event: T, payload: EventPayload<T>): Promise<void>
  on<T extends EventType>(event: T, handler: EventHandler<T>): void
  off<T extends EventType>(event: T, handler: EventHandler<T>): void
}

/**
 * Create an in-memory event bus.
 * Handlers are invoked sequentially for predictable ordering.
 */
export function createEventBus(): EventBus {
  const handlers = new Map<string, Set<EventHandler<EventType>>>()

  return {
    async emit<T extends EventType>(event: T, payload: EventPayload<T>): Promise<void> {
      const eventHandlers = handlers.get(event)
      if (!eventHandlers) return
      for (const handler of eventHandlers) {
        await handler(payload as EventPayload<EventType>)
      }
    },

    on<T extends EventType>(event: T, handler: EventHandler<T>): void {
      if (!handlers.has(event)) {
        handlers.set(event, new Set())
      }
      handlers.get(event)!.add(handler as EventHandler<EventType>)
    },

    off<T extends EventType>(event: T, handler: EventHandler<T>): void {
      handlers.get(event)?.delete(handler as EventHandler<EventType>)
    },
  }
}
