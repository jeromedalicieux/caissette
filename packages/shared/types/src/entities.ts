import type {
  Bps,
  Cents,
  ClosureId,
  ContractId,
  DepositorId,
  Hash,
  ItemId,
  SaleId,
  ShopId,
  UserId,
} from './branded.js'
import type {
  CashMovementType,
  ClosureType,
  ContractStatus,
  ExitReason,
  IdDocumentType,
  ItemCondition,
  ItemStatus,
  ItemType,
  PaymentMethod,
  PoliceLedgerEntryType,
  PricingRuleScope,
  ReversementStatus,
  SaleStatus,
  SubscriptionTier,
  UserRole,
  VatDeclarationRegime,
  VatRegime,
} from './enums.js'

export interface Shop {
  id: ShopId
  name: string
  siret: string
  vatNumber: string | null
  vatRegime: VatRegime
  vatDeclarationRegime: VatDeclarationRegime
  address: string
  timezone: string
  currency: string
  settingsJson: string | null
  subscriptionTier: SubscriptionTier
  createdAt: number
  deletedAt: number | null
}

export interface User {
  id: UserId
  shopId: ShopId
  email: string
  name: string
  role: UserRole
  pinHash: string | null
  active: number
  permissionsJson: string | null
  createdAt: number
  lastLoginAt: number | null
}

export interface UserPermissions {
  canViewSales: boolean
  canViewJournal: boolean
  canViewClosures: boolean
  canViewAccounting: boolean
  canExport: boolean
  canGenerateClosures: boolean
  canViewDashboard: boolean
}

export interface Depositor {
  id: DepositorId
  shopId: ShopId
  externalRef: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  address: string | null
  idDocumentType: IdDocumentType
  idDocumentNumber: string
  birthDate: string | null
  iban: string | null
  defaultCommissionRate: Bps | null
  notes: string | null
  createdAt: number
}

export interface Contract {
  id: ContractId
  shopId: ShopId
  depositorId: DepositorId
  number: string
  signedAt: number
  expiresAt: number
  commissionRate: Bps
  status: ContractStatus
  pdfR2Key: string | null
  createdAt: number
}

export interface Item {
  id: ItemId
  shopId: ShopId
  type: ItemType
  contractId: ContractId | null
  depositorId: DepositorId | null
  sku: string | null
  name: string
  description: string | null
  category: string | null
  categoryId: string | null
  brand: string | null
  size: string | null
  condition: ItemCondition | null
  photosR2Keys: string | null
  initialPrice: Cents
  currentPrice: Cents
  costPrice: Cents | null
  vatRegime: VatRegime
  vatRate: Bps
  status: ItemStatus
  statusChangedAt: number
  enteredAt: number
  soldAt: number | null
  createdAt: number
}

export interface PricingRule {
  id: string
  shopId: ShopId
  scope: PricingRuleScope
  scopeId: string | null
  stepDays: number
  discountPercent: Bps
  maxSteps: number
  active: boolean
}

export interface Sale {
  id: SaleId
  shopId: ShopId
  receiptNumber: number
  cashierId: UserId
  soldAt: number
  subtotal: Cents
  total: Cents
  vatMarginAmount: Cents
  paymentMethod: PaymentMethod
  paymentDetailsJson: string | null
  customerNote: string | null
  status: SaleStatus
  previousHash: Hash
  hash: Hash
  signedServerAt: number | null
  createdAt: number
}

export interface SaleItem {
  id: string
  saleId: SaleId
  itemId: ItemId | null
  name: string
  price: Cents
  costBasis: Cents | null
  reversementAmount: Cents | null
  depositorId: DepositorId | null
  vatRegime: VatRegime
  vatRate: Bps
  vatAmount: Cents
}

export interface Reversement {
  id: string
  shopId: ShopId
  depositorId: DepositorId
  periodStart: number
  periodEnd: number
  totalSales: Cents
  totalCommission: Cents
  totalReversement: Cents
  status: ReversementStatus
  paymentMethod: PaymentMethod | null
  paidAt: number | null
  paidBy: UserId | null
  notes: string | null
  createdAt: number
}

export interface Closure {
  id: ClosureId
  shopId: ShopId
  type: ClosureType
  periodStart: number
  periodEnd: number
  salesCount: number
  totalAmount: Cents
  totalVat: Cents
  totalsByPaymentMethodJson: string | null
  totalsByVatRateJson: string | null
  firstReceiptNumber: number | null
  lastReceiptNumber: number | null
  previousClosureHash: Hash | null
  hash: Hash
  signature: string
  generatedAt: number
  pdfR2Key: string | null
}

export interface PoliceLedgerEntry {
  id: string
  shopId: ShopId
  entryNumber: number
  entryType: PoliceLedgerEntryType
  itemId: ItemId | null
  depositorId: DepositorId | null
  description: string
  depositorName: string
  depositorIdDocument: string
  saleId: SaleId | null
  exitReason: ExitReason | null
  recordedAt: number
  previousHash: Hash
  hash: Hash
}

// ─── Shop Settings ───

export interface ShopFeatures {
  depositSale: boolean
}

export interface ShopDisplay {
  posColumns: 2 | 3 | 4           // colonnes grille caisse
  posDefaultSort: 'popular' | 'favorites' | 'default'  // tri par defaut
  posShowSku: boolean              // afficher les codes SKU
  posShowUsageCount: boolean       // afficher le compteur d'utilisation
  posCompactCards: boolean         // cartes compactes
  showCategories: boolean          // afficher les categories sur les cartes
  accentColor: 'blue' | 'indigo' | 'emerald' | 'rose' | 'amber' // couleur d'accent
}

export interface ShopSettings {
  features: ShopFeatures
  display: ShopDisplay
  defaultCommissionRate: number // Bps (basis points, e.g. 4000 = 40%)
  receiptFooter: string
}

export const DEFAULT_SHOP_DISPLAY: ShopDisplay = {
  posColumns: 3,
  posDefaultSort: 'popular',
  posShowSku: false,
  posShowUsageCount: true,
  posCompactCards: false,
  showCategories: true,
  accentColor: 'blue',
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  features: { depositSale: false },
  display: { ...DEFAULT_SHOP_DISPLAY },
  defaultCommissionRate: 4000,
  receiptFooter: '',
}

export interface Category {
  id: string
  shopId: ShopId
  name: string
  slug: string
  color: string | null
  sortOrder: number
  active: number
  showInFilters: number
  createdAt: number
}

export interface CashMovement {
  id: string
  shopId: ShopId
  userId: UserId
  type: CashMovementType
  amount: Cents
  note: string | null
  recordedAt: number
  createdAt: number
}

export interface AuditLogEntry {
  id: string
  shopId: ShopId | null
  userId: UserId | null
  eventType: string
  entityType: string | null
  entityId: string | null
  payloadJson: string | null
  ipAddress: string | null
  userAgent: string | null
  occurredAt: number
  previousHash: Hash
  hash: Hash
}
