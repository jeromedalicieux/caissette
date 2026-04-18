import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id'),
    userId: text('user_id'),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    payloadJson: text('payload_json'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    occurredAt: integer('occurred_at').notNull(),
    previousHash: text('previous_hash').notNull(),
    hash: text('hash').notNull(),
  },
  (table) => [index('idx_audit_shop_date').on(table.shopId, table.occurredAt)],
)
