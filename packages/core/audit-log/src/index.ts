import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { EventBus } from '@caissette/event-bus'
import type { Hash, ShopId, UserId } from '@caissette/types'
import { computeChainedHash, generateUuidV7 } from '@caissette/utils'
import { auditLog } from './schema.js'

export { auditLog } from './schema.js'

export interface AuditLogger {
  log(params: {
    shopId: ShopId | null
    userId: UserId | null
    eventType: string
    entityType?: string
    entityId?: string
    payload?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
  }): Promise<void>
}

/**
 * Create an audit logger bound to a D1 database and event bus.
 * Maintains hash chain integrity (ISCA compliance).
 */
export function createAuditLogger(
  db: DrizzleD1Database,
  eventBus: EventBus,
): AuditLogger {
  let lastHash: Hash | null = null

  return {
    async log(params) {
      const id = generateUuidV7()
      const now = Date.now()
      const previousHash = lastHash ?? ('0'.repeat(64) as Hash)

      const hash = await computeChainedHash(
        previousHash,
        { eventType: params.eventType, entityId: params.entityId ?? null },
        0,
        now,
      )

      await db.insert(auditLog).values({
        id,
        shopId: params.shopId,
        userId: params.userId,
        eventType: params.eventType,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        payloadJson: params.payload ? JSON.stringify(params.payload) : null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        occurredAt: now,
        previousHash,
        hash,
      })

      lastHash = hash

      await eventBus.emit('audit.entry', {
        eventType: params.eventType,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        shopId: params.shopId,
        userId: params.userId,
      })
    },
  }
}
