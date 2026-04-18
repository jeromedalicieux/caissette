import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, desc } from 'drizzle-orm'
import type { EventBus } from '@rebond/event-bus'
import type { Hash, ShopId } from '@rebond/types'
import { computeChainedHash, generateUuidV7 } from '@rebond/utils'
import { policeLedger } from './schema.js'

export { policeLedger } from './schema.js'

export interface PoliceLedgerInput {
  shopId: ShopId
  entryType: 'entry' | 'exit'
  itemId: string
  depositorId: string | null
  description: string
  depositorName: string
  depositorIdDocument: string
  saleId?: string
  exitReason?: 'sold' | 'returned' | 'destroyed' | 'shop_owned'
}

/**
 * Register event listeners on the event bus to auto-create police ledger entries.
 * - item.created → entry
 * - item.sold → exit
 */
export function registerPoliceLedgerListeners(
  db: DrizzleD1Database,
  eventBus: EventBus,
  resolveDepositorInfo: (
    depositorId: string,
  ) => Promise<{ name: string; idDocument: string } | null>,
) {
  eventBus.on('item.created', async (payload) => {
    if (!payload.depositorId) return
    const depositor = await resolveDepositorInfo(payload.depositorId)
    if (!depositor) return

    await createPoliceLedgerEntry(db, {
      shopId: '' as ShopId, // Will be resolved from item context
      entryType: 'entry',
      itemId: payload.itemId,
      depositorId: payload.depositorId,
      description: `Article déposé — prix: ${payload.price}`,
      depositorName: depositor.name,
      depositorIdDocument: depositor.idDocument,
    })
  })

  eventBus.on('item.sold', async (payload) => {
    await createPoliceLedgerEntry(db, {
      shopId: '' as ShopId,
      entryType: 'exit',
      itemId: payload.itemId,
      depositorId: null,
      description: `Article vendu — prix: ${payload.price}`,
      depositorName: 'N/A',
      depositorIdDocument: 'N/A',
      saleId: payload.saleId,
      exitReason: 'sold',
    })
  })
}

/**
 * Create a police ledger entry with hash chain integrity.
 */
export async function createPoliceLedgerEntry(
  db: DrizzleD1Database,
  input: PoliceLedgerInput,
): Promise<string> {
  const id = generateUuidV7()
  const now = Date.now()

  // Get previous entry for hash chain
  const lastEntry = await db
    .select({ hash: policeLedger.hash, entryNumber: policeLedger.entryNumber })
    .from(policeLedger)
    .where(eq(policeLedger.shopId, input.shopId))
    .orderBy(desc(policeLedger.entryNumber))
    .limit(1)

  const previousHash = (lastEntry[0]?.hash ?? '0'.repeat(64)) as Hash
  const entryNumber = (lastEntry[0]?.entryNumber ?? 0) + 1

  const hash = await computeChainedHash(
    previousHash,
    {
      entryType: input.entryType,
      itemId: input.itemId,
      description: input.description,
    },
    entryNumber,
    now,
  )

  await db.insert(policeLedger).values({
    id,
    shopId: input.shopId,
    entryNumber,
    entryType: input.entryType,
    itemId: input.itemId,
    depositorId: input.depositorId ?? null,
    description: input.description,
    depositorName: input.depositorName,
    depositorIdDocument: input.depositorIdDocument,
    saleId: input.saleId ?? null,
    exitReason: input.exitReason ?? null,
    recordedAt: now,
    previousHash,
    hash,
  })

  return id
}

export const MODULE_DEFINITION = {
  id: 'livre-police',
  version: '0.0.1',
  displayName: 'Livre de Police',
  description: 'Tenue automatique du livre de police (art. 321-7 CP)',
  dependencies: ['catalog', 'depots'],
  events: {
    emits: [],
    listens: ['item.created', 'item.sold'],
  },
  pricing: { tier: 'core' as const },
}
