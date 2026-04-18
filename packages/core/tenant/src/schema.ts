import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

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
