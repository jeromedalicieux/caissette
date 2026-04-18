import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
    idDocumentNumber: text('id_document_number').notNull(), // encrypted
    birthDate: text('birth_date'),
    iban: text('iban'), // encrypted
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
