import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const sales = sqliteTable(
  'sales',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id').notNull(),
    receiptNumber: integer('receipt_number').notNull(),
    cashierId: text('cashier_id').notNull(),
    soldAt: integer('sold_at').notNull(),
    subtotal: integer('subtotal').notNull(),
    total: integer('total').notNull(),
    vatMarginAmount: integer('vat_margin_amount').notNull(),
    paymentMethod: text('payment_method').notNull(),
    paymentDetailsJson: text('payment_details_json'),
    customerNote: text('customer_note'),
    status: text('status').notNull(),
    previousHash: text('previous_hash').notNull(),
    hash: text('hash').notNull(),
    signedServerAt: integer('signed_server_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_sales_shop_receipt').on(table.shopId, table.receiptNumber),
    index('idx_sales_shop_date').on(table.shopId, table.soldAt),
  ],
)

export const saleItems = sqliteTable(
  'sale_items',
  {
    id: text('id').primaryKey(),
    saleId: text('sale_id').notNull(),
    itemId: text('item_id'),
    name: text('name').notNull(),
    price: integer('price').notNull(),
    costBasis: integer('cost_basis'),
    reversementAmount: integer('reversement_amount'),
    depositorId: text('depositor_id'),
    vatRegime: text('vat_regime').notNull(),
    vatRate: integer('vat_rate').notNull(),
    vatAmount: integer('vat_amount').notNull(),
  },
  (table) => [
    index('idx_sale_items_sale').on(table.saleId),
    index('idx_sale_items_depositor').on(table.depositorId),
  ],
)
