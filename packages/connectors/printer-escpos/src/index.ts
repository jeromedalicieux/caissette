import type { Sale, SaleItem, Shop } from '@rebond/types'

/** ESC/POS command bytes */
const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

/** ESC/POS printer interface for WebUSB */
export class ESCPOSPrinter {
  private encoder = new TextEncoder()

  /** Initialize printer */
  init(): Uint8Array {
    return new Uint8Array([ESC, 0x40]) // ESC @
  }

  /** Set text alignment */
  align(mode: 'left' | 'center' | 'right'): Uint8Array {
    const n = mode === 'left' ? 0 : mode === 'center' ? 1 : 2
    return new Uint8Array([ESC, 0x61, n])
  }

  /** Set bold mode */
  bold(on: boolean): Uint8Array {
    return new Uint8Array([ESC, 0x45, on ? 1 : 0])
  }

  /** Set double-height text */
  doubleHeight(on: boolean): Uint8Array {
    return new Uint8Array([GS, 0x21, on ? 0x10 : 0x00])
  }

  /** Print text and line feed */
  text(str: string): Uint8Array {
    const encoded = this.encoder.encode(str)
    const result = new Uint8Array(encoded.length + 1)
    result.set(encoded)
    result[encoded.length] = LF
    return result
  }

  /** Feed n lines */
  feed(n: number): Uint8Array {
    return new Uint8Array([ESC, 0x64, n])
  }

  /** Cut paper */
  cut(): Uint8Array {
    return new Uint8Array([GS, 0x56, 0x00])
  }

  /** Open cash drawer */
  openDrawer(): Uint8Array {
    return new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xfa])
  }
}

/** Format a sale receipt per CDC 2.5.1 */
export function formatReceipt(
  sale: Pick<Sale, 'receiptNumber' | 'soldAt' | 'total' | 'paymentMethod' | 'vatMarginAmount'>,
  saleItems: Pick<SaleItem, 'name' | 'price' | 'vatRegime'>[],
  shop: Pick<Shop, 'name' | 'siret' | 'address'>,
): Uint8Array[] {
  const printer = new ESCPOSPrinter()
  const commands: Uint8Array[] = []

  const push = (...cmds: Uint8Array[]) => commands.push(...cmds)
  const formatEuros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €'
  const pad = (left: string, right: string, width = 42) => {
    const spaces = Math.max(1, width - left.length - right.length)
    return left + ' '.repeat(spaces) + right
  }

  // Header
  push(printer.init())
  push(printer.align('center'))
  push(printer.bold(true))
  push(printer.doubleHeight(true))
  push(printer.text(shop.name))
  push(printer.doubleHeight(false))
  push(printer.bold(false))
  push(printer.text(shop.address))
  push(printer.text(`SIRET: ${shop.siret}`))
  push(printer.text(''))

  // Receipt info
  push(printer.align('left'))
  const date = new Date(sale.soldAt)
  push(printer.text(`Ticket N° ${sale.receiptNumber}`))
  push(
    printer.text(
      `Date: ${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR')}`,
    ),
  )
  push(printer.text('-'.repeat(42)))

  // Items
  const hasMarginVat = saleItems.some((i) => i.vatRegime !== 'normal')

  for (const item of saleItems) {
    push(printer.text(pad(item.name, formatEuros(item.price))))
  }

  push(printer.text('-'.repeat(42)))

  // Total
  push(printer.bold(true))
  push(printer.text(pad('TOTAL TTC', formatEuros(sale.total))))
  push(printer.bold(false))

  // Payment method
  const methodLabels: Record<string, string> = {
    cash: 'Espèces',
    card: 'Carte bancaire',
    check: 'Chèque',
    transfer: 'Virement',
    other: 'Autre',
  }
  push(printer.text(pad('Payé par', methodLabels[sale.paymentMethod] ?? sale.paymentMethod)))
  push(printer.text(''))

  // VAT mention (CDC 2.5.1)
  if (hasMarginVat) {
    push(printer.text('TVA calculée sur marge,'))
    push(printer.text('art. 297 A du CGI'))
  }

  // Footer
  push(printer.text(''))
  push(printer.align('center'))
  push(printer.text('Logiciel Rebond'))
  push(printer.text('Attestation disponible sur demande'))
  push(printer.feed(3))
  push(printer.cut())

  return commands
}
