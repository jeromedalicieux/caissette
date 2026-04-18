import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const closures = sqliteTable(
  'closures',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id').notNull(),
    type: text('type').notNull(), // 'daily' | 'monthly' | 'yearly'
    periodStart: integer('period_start').notNull(),
    periodEnd: integer('period_end').notNull(),
    salesCount: integer('sales_count').notNull(),
    totalAmount: integer('total_amount').notNull(),
    totalVat: integer('total_vat').notNull(),
    totalsByPaymentMethodJson: text('totals_by_payment_method_json'),
    totalsByVatRateJson: text('totals_by_vat_rate_json'),
    firstReceiptNumber: integer('first_receipt_number'),
    lastReceiptNumber: integer('last_receipt_number'),
    previousClosureHash: text('previous_closure_hash'),
    hash: text('hash').notNull(),
    signature: text('signature').notNull(),
    generatedAt: integer('generated_at').notNull(),
    pdfR2Key: text('pdf_r2_key'),
  },
  (table) => [
    uniqueIndex('idx_closures_shop_type_period').on(table.shopId, table.type, table.periodStart),
  ],
)
