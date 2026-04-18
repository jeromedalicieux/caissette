/**
 * Consolidated schema for Drizzle Kit migration generation.
 * All tables defined here (single source for drizzle-kit which uses CJS resolution).
 * The individual packages re-use these via drizzle-orm references at runtime.
 */
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ─── Core: shops (tenant) ───
export const shops = sqliteTable('shops', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  siret: text('siret').notNull(),
  vatNumber: text('vat_number'),
  vatRegime: text('vat_regime').notNull(),
  vatDeclarationRegime: text('vat_declaration_regime').notNull().default('simplified'),
  address: text('address').notNull(),
  timezone: text('timezone').notNull().default('Europe/Paris'),
  currency: text('currency').notNull().default('EUR'),
  settingsJson: text('settings_json'),
  subscriptionTier: text('subscription_tier').notNull(),
  createdAt: integer('created_at').notNull(),
  deletedAt: integer('deleted_at'),
})

// ─── Core: users + sessions (auth) ───
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id').notNull(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    pinHash: text('pin_hash'),
    passwordHash: text('password_hash').notNull(),
    createdAt: integer('created_at').notNull(),
    lastLoginAt: integer('last_login_at'),
  },
  (table) => [uniqueIndex('idx_users_shop_email').on(table.shopId, table.email)],
)

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
})

// ─── Core: audit_log ───
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

// ─── Core: closures (isca) ───
export const closures = sqliteTable(
  'closures',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id').notNull(),
    type: text('type').notNull(),
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

// ─── Module: depositors + contracts ───
export const depositors = sqliteTable(
  'depositors',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id').notNull(),
    externalRef: text('external_ref'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    idDocumentType: text('id_document_type').notNull(),
    idDocumentNumber: text('id_document_number').notNull(),
    birthDate: text('birth_date'),
    iban: text('iban'),
    defaultCommissionRate: integer('default_commission_rate'),
    notes: text('notes'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_depositors_shop').on(table.shopId),
    index('idx_depositors_name').on(table.shopId, table.lastName),
  ],
)

export const contracts = sqliteTable(
  'contracts',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id').notNull(),
    depositorId: text('depositor_id').notNull(),
    number: text('number').notNull(),
    signedAt: integer('signed_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    commissionRate: integer('commission_rate').notNull(),
    status: text('status').notNull(),
    pdfR2Key: text('pdf_r2_key'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [uniqueIndex('idx_contracts_shop_number').on(table.shopId, table.number)],
)

// ─── Module: items + pricing_rules (catalog) ───
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

// ─── Module: sales + sale_items (caisse) ───
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

// ─── Module: police_ledger (livre-police) ───
export const policeLedger = sqliteTable(
  'police_ledger',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id').notNull(),
    entryNumber: integer('entry_number').notNull(),
    entryType: text('entry_type').notNull(),
    itemId: text('item_id'),
    depositorId: text('depositor_id'),
    description: text('description').notNull(),
    depositorName: text('depositor_name').notNull(),
    depositorIdDocument: text('depositor_id_document').notNull(),
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
