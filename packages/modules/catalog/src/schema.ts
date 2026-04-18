import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id').notNull(),
    contractId: text('contract_id'),
    depositorId: text('depositor_id'),
    sku: text('sku'),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),
    brand: text('brand'),
    size: text('size'),
    condition: text('condition'),
    photosR2Keys: text('photos_r2_keys'),
    initialPrice: integer('initial_price').notNull(),
    currentPrice: integer('current_price').notNull(),
    costPrice: integer('cost_price'),
    vatRegime: text('vat_regime').notNull(),
    vatRate: integer('vat_rate').notNull(),
    status: text('status').notNull(),
    statusChangedAt: integer('status_changed_at').notNull(),
    enteredAt: integer('entered_at').notNull(),
    soldAt: integer('sold_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_items_shop_status').on(table.shopId, table.status),
    index('idx_items_depositor').on(table.depositorId),
    index('idx_items_contract').on(table.contractId),
  ],
)

export const pricingRules = sqliteTable('pricing_rules', {
  id: text('id').primaryKey(),
  shopId: text('shop_id').notNull(),
  scope: text('scope').notNull(),
  scopeId: text('scope_id'),
  stepDays: integer('step_days').notNull(),
  discountPercent: integer('discount_percent').notNull(),
  maxSteps: integer('max_steps').notNull(),
  active: integer('active').notNull().default(1),
})
