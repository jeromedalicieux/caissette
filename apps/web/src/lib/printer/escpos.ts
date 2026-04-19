/**
 * ESC/POS thermal printer driver via WebUSB
 * Compatible with most 80mm thermal printers (Epson, Star, etc.)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const navigator: any

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

// ESC/POS commands
const COMMANDS = {
  INIT: new Uint8Array([ESC, 0x40]), // Initialize printer
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT: new Uint8Array([ESC, 0x21, 0x10]),
  NORMAL_SIZE: new Uint8Array([ESC, 0x21, 0x00]),
  CUT: new Uint8Array([GS, 0x56, 0x00]), // Full cut
  PARTIAL_CUT: new Uint8Array([GS, 0x56, 0x01]),
  FEED_LINES: (n: number) => new Uint8Array([ESC, 0x64, n]),
}

const PRINTER_WIDTH = 48 // characters for 80mm paper

class EscPosPrinter {
  private device: any = null
  private endpoint: number = 0
  private buffer: Uint8Array[] = []

  /** Check if WebUSB is available */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator
  }

  /** Request and connect to a USB printer */
  async connect(): Promise<boolean> {
    if (!EscPosPrinter.isSupported()) return false

    try {
      this.device = await navigator.usb.requestDevice({
        filters: [
          { classCode: 7 }, // Printer class
        ],
      })

      await this.device.open()

      // Select configuration and claim interface
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1)
      }

      const iface = this.device.configuration!.interfaces[0]!
      await this.device.claimInterface(iface.interfaceNumber)

      // Find OUT endpoint
      const alt = iface.alternates[0]!
      const ep = alt.endpoints.find((e: any) => e.direction === 'out')
      if (!ep) throw new Error('No OUT endpoint found')
      this.endpoint = ep.endpointNumber

      return true
    } catch (e) {
      console.error('Printer connection failed:', e)
      return false
    }
  }

  /** Disconnect from the printer */
  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.close()
      } catch { /* ignore */ }
      this.device = null
    }
  }

  get isConnected(): boolean {
    return this.device !== null && this.device.opened
  }

  // --- Buffer commands ---

  private push(...chunks: Uint8Array[]): this {
    this.buffer.push(...chunks)
    return this
  }

  private text(str: string): this {
    const encoder = new TextEncoder()
    // ESC/POS uses CP437/Latin1, but UTF-8 works for basic French chars
    this.buffer.push(encoder.encode(str))
    return this
  }

  private newline(): this {
    this.buffer.push(new Uint8Array([LF]))
    return this
  }

  /** Initialize printer */
  init(): this {
    this.buffer = []
    return this.push(COMMANDS.INIT)
  }

  /** Center aligned text */
  center(str: string): this {
    return this.push(COMMANDS.ALIGN_CENTER).text(str).newline()
  }

  /** Left aligned text */
  left(str: string): this {
    return this.push(COMMANDS.ALIGN_LEFT).text(str).newline()
  }

  /** Right aligned text */
  right(str: string): this {
    return this.push(COMMANDS.ALIGN_RIGHT).text(str).newline()
  }

  /** Bold text */
  bold(str: string): this {
    return this.push(COMMANDS.BOLD_ON).text(str).push(COMMANDS.BOLD_OFF).newline()
  }

  /** Enable bold */
  boldOn(): this {
    return this.push(COMMANDS.BOLD_ON)
  }

  /** Disable bold */
  boldOff(): this {
    return this.push(COMMANDS.BOLD_OFF)
  }

  /** Large centered text (double height) */
  large(str: string): this {
    return this.push(COMMANDS.ALIGN_CENTER, COMMANDS.DOUBLE_HEIGHT)
      .text(str)
      .newline()
      .push(COMMANDS.NORMAL_SIZE, COMMANDS.ALIGN_LEFT)
  }

  /** Two-column line (left + right justified) */
  columns(left: string, right: string): this {
    const space = PRINTER_WIDTH - left.length - right.length
    const line = left + ' '.repeat(Math.max(1, space)) + right
    return this.push(COMMANDS.ALIGN_LEFT).text(line).newline()
  }

  /** Dashed separator */
  separator(): this {
    return this.push(COMMANDS.ALIGN_LEFT).text('-'.repeat(PRINTER_WIDTH)).newline()
  }

  /** Empty line */
  empty(): this {
    return this.newline()
  }

  /** Feed n lines */
  feed(n: number = 3): this {
    return this.push(COMMANDS.FEED_LINES(n))
  }

  /** Cut paper */
  cut(): this {
    return this.feed(3).push(COMMANDS.PARTIAL_CUT)
  }

  /** Send buffer to printer */
  async print(): Promise<boolean> {
    if (!this.device || !this.device.opened) return false

    try {
      // Concatenate all buffers
      const totalLength = this.buffer.reduce((sum, b) => sum + b.length, 0)
      const data = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of this.buffer) {
        data.set(chunk, offset)
        offset += chunk.length
      }

      // Send in chunks (some printers have small buffers)
      const CHUNK_SIZE = 64
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE)
        await this.device.transferOut(this.endpoint, chunk)
      }

      this.buffer = []
      return true
    } catch (e) {
      console.error('Print failed:', e)
      return false
    }
  }
}

export const printer = new EscPosPrinter()

// --- Receipt formatting ---

interface ReceiptData {
  shop: { name: string; address: string; siret: string; vatNumber?: string }
  receiptNumber: number
  date: string
  items: Array<{ name: string; price: number; vatRegime?: string }>
  total: number
  vatAmount: number
  paymentMethod: string
  hash: string
}

function formatPrice(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2).replace('.', ',') + ' EUR'
}

const methodLabels: Record<string, string> = {
  cash: 'Especes',
  card: 'CB',
  check: 'Cheque',
  transfer: 'Virement',
  other: 'Autre',
}

/** Format and print a receipt */
export async function printReceipt(data: ReceiptData): Promise<boolean> {
  if (!printer.isConnected) {
    const connected = await printer.connect()
    if (!connected) return false
  }

  printer
    .init()
    // Header
    .large(data.shop.name)
    .center(data.shop.address)
    .center(`SIRET: ${data.shop.siret}`)

  if (data.shop.vatNumber) {
    printer.center(`TVA: ${data.shop.vatNumber}`)
  }

  printer
    .separator()
    .columns(`Ticket #${data.receiptNumber}`, data.date)
    .separator()

  // Items
  for (const item of data.items) {
    printer.columns(
      item.name.slice(0, PRINTER_WIDTH - 12),
      formatPrice(item.price),
    )
  }

  printer
    .separator()
    // Totals
    .columns('Total HT', formatPrice(data.total - data.vatAmount))
    .columns('TVA', formatPrice(data.vatAmount))
    .boldOn()
    .columns('TOTAL TTC', formatPrice(data.total))
    .boldOff()
    .empty()
    .center(`Paye par ${methodLabels[data.paymentMethod] ?? data.paymentMethod}`)
    .separator()
    // Hash
    .center(data.hash.slice(0, PRINTER_WIDTH))
    .center('Rebond Caisse v1.0.0')
    .cut()

  return printer.print()
}
