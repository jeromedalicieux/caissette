import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id').notNull(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(), // 'owner' | 'manager' | 'cashier' | 'accountant'
    pinHash: text('pin_hash'),
    passwordHash: text('password_hash').notNull(),
    active: integer('active').notNull().default(1),
    permissionsJson: text('permissions_json'),
    createdAt: integer('created_at').notNull(),
    lastLoginAt: integer('last_login_at'),
  },
  (table) => [uniqueIndex('idx_users_shop_email').on(table.shopId, table.email)],
)

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  shopId: text('shop_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
})
