import type {
  Shop,
  User,
  Depositor,
  Sale,
  SaleItem,
  ShopId,
  UserId,
  DepositorId,
  SaleId,
  Cents,
  Bps,
  Hash,
} from '@caissette/types'

let counter = 0
function nextId(): string {
  counter++
  return `00000000-0000-7000-8000-${String(counter).padStart(12, '0')}`
}

export function createTestShop(overrides?: Partial<Shop>): Shop {
  return {
    id: nextId() as ShopId,
    name: 'Boutique Test',
    siret: '12345678901234',
    vatNumber: null,
    vatRegime: 'deposit',
    vatDeclarationRegime: 'simplified',
    address: '1 rue du Test, 31000 Toulouse',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    settingsJson: null,
    subscriptionTier: 'standard',
    createdAt: Date.now(),
    deletedAt: null,
    ...overrides,
  }
}

export function createTestUser(overrides?: Partial<User>): User {
  return {
    id: nextId() as UserId,
    shopId: nextId() as ShopId,
    email: `user-${counter}@test.caissette.fr`,
    name: 'Caissier Test',
    role: 'cashier',
    pinHash: null,
    createdAt: Date.now(),
    lastLoginAt: null,
    ...overrides,
  }
}

export function createTestDepositor(overrides?: Partial<Depositor>): Depositor {
  return {
    id: nextId() as DepositorId,
    shopId: nextId() as ShopId,
    externalRef: `D${String(counter).padStart(5, '0')}`,
    firstName: 'Marie',
    lastName: 'Martin',
    email: `depositor-${counter}@test.caissette.fr`,
    phone: '0612345678',
    address: '10 rue des Déposants, 31000 Toulouse',
    idDocumentType: 'cni',
    idDocumentNumber: 'ENCRYPTED_CNI_123',
    birthDate: '1985-06-15',
    iban: null,
    defaultCommissionRate: 4000 as Bps, // 40%
    notes: null,
    createdAt: Date.now(),
    ...overrides,
  }
}

export function createTestSale(overrides?: Partial<Sale>): Sale {
  return {
    id: nextId() as SaleId,
    shopId: nextId() as ShopId,
    receiptNumber: counter,
    cashierId: nextId() as UserId,
    soldAt: Date.now(),
    subtotal: 6000 as Cents,
    total: 6000 as Cents,
    vatMarginAmount: 400 as Cents,
    paymentMethod: 'card',
    paymentDetailsJson: null,
    customerNote: null,
    status: 'completed',
    previousHash: '0'.repeat(64) as Hash,
    hash: 'a'.repeat(64) as Hash,
    signedServerAt: null,
    createdAt: Date.now(),
    ...overrides,
  }
}

export function generateFakeSales(count: number, shopId: ShopId): Sale[] {
  return Array.from({ length: count }, (_, i) =>
    createTestSale({
      shopId,
      receiptNumber: i + 1,
      total: (Math.floor(Math.random() * 10000) + 500) as Cents,
    }),
  )
}
