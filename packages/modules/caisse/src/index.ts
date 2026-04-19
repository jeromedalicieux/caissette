import { Hono } from 'hono'
import { z } from 'zod'
import type { EventBus } from '@rebond/event-bus'
import type { Cents, Hash, ItemId, PaymentMethod, SaleId, ShopId, UserId } from '@rebond/types'
import { computeChainedHash, generateUuidV7 } from '@rebond/utils'
import { calculateVatMargin, type VatMarginInput } from '@rebond/tva-marge'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc } from 'drizzle-orm'
import { sales, saleItems } from './schema.js'

export { sales, saleItems } from './schema.js'

/** Cart item for sale creation */
export interface CartItem {
  itemId?: string
  name: string
  price: number // cents
  costBasis?: number // cents
  reversementAmount?: number // cents
  depositorId?: string
  vatRegime: VatMarginInput['regime']
  vatRate: number // bps
  commissionTtc?: number // cents, for deposit regime
}

export const createSaleSchema = z.object({
  cashierId: z.string(),
  paymentMethod: z.enum(['cash', 'card', 'check', 'transfer', 'other']),
  items: z.array(
    z.object({
      itemId: z.string().optional(),
      type: z.enum(['product', 'service']).default('product'),
      name: z.string(),
      price: z.number().int().positive(),
      costBasis: z.number().int().nonnegative().optional(),
      reversementAmount: z.number().int().nonnegative().optional(),
      depositorId: z.string().optional(),
      vatRegime: z.enum(['deposit', 'resale_item_by_item', 'resale_global_period', 'normal']),
      vatRate: z.number().int().min(0).max(10000),
      commissionTtc: z.number().int().nonnegative().optional(),
    }),
  ),
  customerNote: z.string().optional(),
})

export function createCaisseRoutes(db: DrizzleD1Database, eventBus: EventBus) {
  const app = new Hono()

  // List sales
  app.get('/', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const result = await db
      .select()
      .from(sales)
      .where(eq(sales.shopId, shopId))
      .orderBy(desc(sales.soldAt))
      .limit(50)
    return c.json(result)
  })

  // Create sale
  app.post('/', async (c) => {
    const shopId = c.req.header('X-Shop-Id') as ShopId
    const body = createSaleSchema.parse(await c.req.json())
    const saleId = generateUuidV7() as SaleId
    const now = Date.now()

    // Calculate totals and VAT for each item
    let subtotal = 0
    let totalVatMargin = 0
    const processedItems = body.items.map((item) => {
      subtotal += item.price
      const vatResult = calculateVatMargin({
        regime: item.vatRegime,
        salePriceTtc: item.price,
        costBasisTtc: item.costBasis,
        commissionTtc: item.commissionTtc,
        vatRate: item.vatRate,
      })
      totalVatMargin += vatResult.vatAmount
      return {
        id: generateUuidV7(),
        saleId,
        itemId: item.itemId ?? null,
        name: item.name,
        price: item.price,
        costBasis: item.costBasis ?? null,
        reversementAmount: item.reversementAmount ?? null,
        depositorId: item.depositorId ?? null,
        vatRegime: item.vatRegime,
        vatRate: item.vatRate,
        vatAmount: vatResult.vatAmount,
      }
    })

    // Get previous hash for chaining (ISCA)
    const lastSale = await db
      .select({ hash: sales.hash })
      .from(sales)
      .where(eq(sales.shopId, shopId))
      .orderBy(desc(sales.receiptNumber))
      .limit(1)

    const previousHash = (lastSale[0]?.hash ?? '0'.repeat(64)) as Hash

    // Get next receipt number
    const lastReceipt = await db
      .select({ receiptNumber: sales.receiptNumber })
      .from(sales)
      .where(eq(sales.shopId, shopId))
      .orderBy(desc(sales.receiptNumber))
      .limit(1)

    const receiptNumber = (lastReceipt[0]?.receiptNumber ?? 0) + 1

    const hash = await computeChainedHash(
      previousHash,
      { total: subtotal, items: processedItems.length },
      receiptNumber,
      now,
    )

    // Insert sale
    await db.insert(sales).values({
      id: saleId,
      shopId,
      receiptNumber,
      cashierId: body.cashierId,
      soldAt: now,
      subtotal,
      total: subtotal,
      vatMarginAmount: totalVatMargin,
      paymentMethod: body.paymentMethod,
      paymentDetailsJson: null,
      customerNote: body.customerNote ?? null,
      status: 'completed',
      previousHash,
      hash,
      signedServerAt: null,
      createdAt: now,
    })

    // Insert sale items
    for (const item of processedItems) {
      await db.insert(saleItems).values(item)
    }

    // Emit events
    await eventBus.emit('sale.completed', {
      saleId,
      total: subtotal as Cents,
      vatMarginAmount: totalVatMargin as Cents,
      hash,
    })

    for (const item of body.items) {
      if (item.itemId) {
        // For services, don't emit item.sold (they stay available, infinite stock)
        const isService = item.type === 'service'
        if (!isService) {
          await eventBus.emit('item.sold', {
            saleId,
            shopId,
            itemId: item.itemId as ItemId,
            price: item.price as Cents,
            paymentMethod: body.paymentMethod as PaymentMethod,
          })
        }
      }
    }

    return c.json({ id: saleId, receiptNumber, hash }, 201)
  })

  return app
}

export const MODULE_DEFINITION = {
  id: 'caisse',
  version: '0.0.1',
  displayName: 'Caisse',
  description: 'Point de vente, panier et paiements',
  dependencies: ['catalog', 'tva-marge'],
  events: {
    emits: ['sale.completed', 'sale.refunded', 'item.sold'],
    listens: [],
  },
  pricing: { tier: 'core' as const },
}
