import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const policeLedger = sqliteTable(
  'police_ledger',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id').notNull(),
    entryNumber: integer('entry_number').notNull(),
    entryType: text('entry_type').notNull(), // 'entry' | 'exit'
    itemId: text('item_id'),
    depositorId: text('depositor_id'),
    description: text('description').notNull(),
    depositorName: text('depositor_name').notNull(),
    depositorIdDocument: text('depositor_id_document').notNull(), // encrypted
    saleId: text('sale_id'),
    exitReason: text('exit_reason'),
    recordedAt: integer('recorded_at').notNull(),
    previousHash: text('previous_hash').notNull(),
    hash: text('hash').notNull(),
  },
  (table) => [
    uniqueIndex('idx_police_shop_entry').on(table.shopId, table.entryNumber),
  ],
)
