import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { EventBus } from '@caissette/event-bus'
import type { AuditLogger } from '@caissette/audit-log'
import type { Cents, ClosureId, ClosureType, Hash, ShopId } from '@caissette/types'
import { computeChainedHash, generateUuidV7 } from '@caissette/utils'
import { closures } from './schema.js'

export { closures } from './schema.js'

export interface ClosureInput {
  shopId: ShopId
  type: ClosureType
  periodStart: number
  periodEnd: number
  salesCount: number
  totalAmount: Cents
  totalVat: Cents
  totalsByPaymentMethod: Record<string, Cents>
  totalsByVatRate: Record<string, Cents>
  firstReceiptNumber: number | null
  lastReceiptNumber: number | null
  previousClosureHash: Hash | null
}

/**
 * Generate a daily/monthly/yearly closure (Z-ticket).
 * Signs with Ed25519 key (placeholder — actual signing requires crypto key from Cloudflare Secrets).
 */
export async function generateClosure(
  db: DrizzleD1Database,
  eventBus: EventBus,
  auditLogger: AuditLogger,
  input: ClosureInput,
  signFn: (data: string) => Promise<string>,
): Promise<{ id: ClosureId; hash: Hash }> {
  const id = generateUuidV7() as ClosureId
  const now = Date.now()
  const previousHash = input.previousClosureHash ?? ('0'.repeat(64) as Hash)

  const payload = {
    shopId: input.shopId,
    type: input.type,
    salesCount: input.salesCount,
    totalAmount: input.totalAmount,
    totalVat: input.totalVat,
  }

  const hash = await computeChainedHash(
    previousHash,
    payload,
    input.lastReceiptNumber ?? 0,
    now,
  )

  const signature = await signFn(hash)

  await db.insert(closures).values({
    id,
    shopId: input.shopId,
    type: input.type,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    salesCount: input.salesCount,
    totalAmount: input.totalAmount,
    totalVat: input.totalVat,
    totalsByPaymentMethodJson: JSON.stringify(input.totalsByPaymentMethod),
    totalsByVatRateJson: JSON.stringify(input.totalsByVatRate),
    firstReceiptNumber: input.firstReceiptNumber,
    lastReceiptNumber: input.lastReceiptNumber,
    previousClosureHash: input.previousClosureHash,
    hash,
    signature,
    generatedAt: now,
    pdfR2Key: null,
  })

  await auditLogger.log({
    shopId: input.shopId,
    userId: null,
    eventType: 'closure.generated',
    entityType: 'closure',
    entityId: id,
    payload,
  })

  await eventBus.emit('daily_closure.generated', {
    closureId: id,
    date: new Date(input.periodStart).toISOString().split('T')[0]!,
    totals: {
      amount: input.totalAmount,
      vat: input.totalVat,
      salesCount: input.salesCount,
    },
    signature,
  })

  return { id, hash }
}

/**
 * Verify hash chain integrity for a sequence of records.
 * Returns the index of the first broken link, or -1 if chain is valid.
 */
export async function verifyHashChain(
  records: Array<{ hash: Hash; previousHash: Hash }>,
): Promise<number> {
  for (let i = 1; i < records.length; i++) {
    if (records[i]!.previousHash !== records[i - 1]!.hash) {
      return i
    }
  }
  return -1
}
