<script lang="ts">
  import { sales, invoiceApi } from '$lib/api/client'
  import { authStore } from '$lib/stores/auth.svelte'
  import { printer, printReceipt } from '$lib/printer/escpos'
  import { onMount } from 'svelte'
  import SectionGuide from '$lib/components/SectionGuide.svelte'

  let list = $state<any[]>([])
  let loading = $state(true)
  let selectedSale = $state<any>(null)
  let loadingDetail = $state(false)
  let refunding = $state('')
  let printing = $state(false)
  let error = $state('')
  let success = $state('')
  let showInvoice = $state(false)
  let invoiceData = $state<any>(null)
  let invoiceLoading = $state(false)
  let clientName = $state('')
  let clientAddress = $state('')
  let clientSiret = $state('')
  let showInvoiceForm = $state(false)
  let invoiceSaleId = $state('')

  // Filters
  let filterStart = $state('')
  let filterEnd = $state('')
  let filterPayment = $state('')

  onMount(loadSales)

  async function loadSales() {
    loading = true
    try {
      const params: any = {}
      if (filterStart) params.start = filterStart
      if (filterEnd) params.end = filterEnd
      if (filterPayment) params.payment = filterPayment
      list = await sales.list(params)
    } catch { /* ignore */ }
    loading = false
  }

  async function viewReceipt(saleId: string) {
    loadingDetail = true
    try {
      selectedSale = await sales.get(saleId)
    } catch { /* ignore */ }
    loadingDetail = false
  }

  function formatPrice(cents: number) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' \u20AC'
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  }

  function formatDateLong(ts: number) {
    return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'medium' })
  }

  const methodLabels: Record<string, string> = {
    cash: 'Especes',
    card: 'CB',
    check: 'Cheque',
    transfer: 'Virement',
    other: 'Autre',
  }

  const vatRegimeLabels: Record<string, string> = {
    deposit: 'TVA marge (depot)',
    resale_item_by_item: 'TVA marge (revente)',
    normal: 'TVA normale',
  }

  async function handleRefund(saleId: string) {
    if (!confirm('Confirmer le remboursement (avoir) de cette vente ?')) return
    refunding = saleId
    error = ''
    try {
      const result = await sales.refund(saleId)
      success = `Avoir #${result.receiptNumber} cree avec succes`
      await loadSales()
    } catch (e: any) {
      error = e.message
    }
    refunding = ''
  }

  async function handlePrint() {
    if (!selectedSale) return
    printing = true
    try {
      const success = await printReceipt({
        shop: selectedSale.shop ?? { name: '', address: '', siret: '' },
        receiptNumber: selectedSale.receipt_number ?? selectedSale.receiptNumber,
        date: formatDateLong(selectedSale.sold_at ?? selectedSale.soldAt),
        items: (selectedSale.items ?? []).map((i: any) => ({
          name: i.name,
          price: i.price,
          vatRegime: i.vat_regime ?? i.vatRegime,
          vatRate: i.vat_rate ?? i.vatRate ?? 0,
        })),
        total: selectedSale.total,
        vatAmount: selectedSale.vat_margin_amount ?? selectedSale.vatMarginAmount,
        paymentMethod: selectedSale.payment_method ?? selectedSale.paymentMethod,
        hash: selectedSale.hash,
      })
      if (!success) {
        error = 'Impossible d\'imprimer. Verifiez la connexion imprimante.'
      }
    } catch (e: any) {
      error = e.message
    }
    printing = false
  }

  function openInvoiceForm(saleId: string) {
    invoiceSaleId = saleId
    clientName = ''
    clientAddress = ''
    clientSiret = ''
    showInvoiceForm = true
  }

  async function generateInvoice(saleId: string) {
    invoiceLoading = true
    try {
      invoiceData = await invoiceApi.generate(saleId, {
        name: clientName || undefined,
        address: clientAddress || undefined,
        siret: clientSiret || undefined,
      })
      showInvoiceForm = false
      showInvoice = true
    } catch (e: any) {
      error = e.message
    }
    invoiceLoading = false
  }

  const isManager = $derived(authStore.user?.role === 'owner' || authStore.user?.role === 'manager')
</script>

<svelte:head>
  <title>Ventes -- Caissette</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6">
    <div class="flex items-center gap-2">
      <h1 class="text-2xl font-bold text-gray-900">Historique des ventes</h1>
      <SectionGuide
        title="Historique des ventes"
        description="Retrouvez toutes vos transactions. Chaque vente est enregistree de maniere infalsifiable avec un hash cryptographique."
        tips={['Les ventes sont infalsifiables — obligation NF525', 'Vous pouvez reimprimer un ticket a tout moment depuis le bouton Ticket', 'Les avoirs (remboursements) sont aussi chaines et tracables', 'L\'export FEC se fait depuis la page Comptabilite', 'Les ventes ne peuvent pas etre modifiees ni supprimees (obligation legale)']}
      />
    </div>
    <p class="text-sm text-gray-500 mt-1">Toutes les transactions realisees depuis la caisse</p>
  </div>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
  {/if}
  {#if success}
    <div class="mb-4 rounded-lg bg-green-50 border border-green-100 p-4 text-sm text-green-700">{success}</div>
  {/if}

  <!-- Filters -->
  <div class="mb-6 rounded-xl bg-white p-5 shadow-sm border border-gray-100">
    <div class="flex flex-wrap items-end gap-4">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1.5">Date debut</label>
        <input type="date" bind:value={filterStart}
          class="block rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1.5">Date fin</label>
        <input type="date" bind:value={filterEnd}
          class="block rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1.5">Paiement</label>
        <select bind:value={filterPayment}
          class="block rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
          <option value="">Tous</option>
          <option value="cash">Especes</option>
          <option value="card">CB</option>
          <option value="check">Cheque</option>
          <option value="transfer">Virement</option>
          <option value="other">Autre</option>
        </select>
      </div>
      <button onclick={loadSales}
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
        Filtrer
      </button>
    </div>
  </div>

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else if list.length === 0}
    <p class="text-center py-12 text-gray-500">Aucune vente enregistree.</p>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50/80">
          <tr class="text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th class="px-5 py-3.5">N.</th>
            <th class="px-5 py-3.5">Date</th>
            <th class="px-5 py-3.5">Total TTC</th>
            <th class="px-5 py-3.5">TVA marge</th>
            <th class="px-5 py-3.5">Paiement</th>
            <th class="px-5 py-3.5">Statut</th>
            <th class="px-5 py-3.5">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each list as sale}
            <tr class="hover:bg-gray-50/50 transition-colors">
              <td class="px-5 py-4 font-mono text-xs text-gray-500">{sale.receipt_number ?? sale.receiptNumber}</td>
              <td class="px-5 py-4 text-gray-600">{formatDate(sale.sold_at ?? sale.soldAt)}</td>
              <td class="px-5 py-4 font-medium text-gray-900">{formatPrice(sale.total)}</td>
              <td class="px-5 py-4 text-gray-600">{formatPrice(sale.vat_margin_amount ?? sale.vatMarginAmount)}</td>
              <td class="px-5 py-4">{methodLabels[sale.payment_method ?? sale.paymentMethod] ?? sale.payment_method}</td>
              <td class="px-5 py-4">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-50 text-green-700">
                  {sale.status}
                </span>
              </td>
              <td class="px-5 py-4">
                <div class="flex gap-3">
                  <button onclick={() => viewReceipt(sale.id)}
                    class="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                    Ticket
                  </button>
                  {#if isManager && sale.status === 'completed'}
                    <button onclick={() => handleRefund(sale.id)}
                      disabled={refunding === sale.id}
                      class="text-sm font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50">
                      {refunding === sale.id ? '...' : 'Rembourser'}
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Receipt modal -->
{#if selectedSale}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={() => selectedSale = null}>
    <div class="mx-4 w-full max-w-md rounded-2xl bg-white p-0 shadow-xl" onclick={(e) => e.stopPropagation()}>
      {#if loadingDetail}
        <div class="p-8 text-center text-gray-400">Chargement...</div>
      {:else}
        <!-- Receipt content -->
        <div class="p-6">
          <!-- Header -->
          <div class="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
            {#if selectedSale.shop}
              <div class="text-lg font-bold text-gray-900">{selectedSale.shop.name}</div>
              <div class="text-xs text-gray-500 mt-1">{selectedSale.shop.address}</div>
              <div class="text-xs text-gray-500">SIRET: {selectedSale.shop.siret}</div>
              {#if selectedSale.shop.vatNumber}
                <div class="text-xs text-gray-500">TVA: {selectedSale.shop.vatNumber}</div>
              {/if}
            {/if}
          </div>

          <!-- Receipt info -->
          <div class="flex justify-between text-xs text-gray-500 mb-3">
            <span>Ticket N. {selectedSale.receipt_number ?? selectedSale.receiptNumber}</span>
            <span>{formatDateLong(selectedSale.sold_at ?? selectedSale.soldAt)}</span>
          </div>

          <!-- Items -->
          <div class="border-b border-dashed border-gray-300 pb-3 mb-3">
            {#if selectedSale.items}
              {#each selectedSale.items as item}
                <div class="flex justify-between py-1 text-sm">
                  <div class="flex-1">
                    <span class="text-gray-900">{item.name}</span>
                    <span class="text-[10px] text-gray-400 ml-1">({vatRegimeLabels[item.vat_regime ?? item.vatRegime] ?? 'TVA'})</span>
                  </div>
                  <span class="font-medium text-gray-900 ml-3">{formatPrice(item.price)}</span>
                </div>
              {/each}
            {/if}
          </div>

          <!-- Totals -->
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Total HT</span>
              <span class="text-gray-900">{formatPrice((selectedSale.total) - (selectedSale.vat_margin_amount ?? selectedSale.vatMarginAmount))}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">TVA</span>
              <span class="text-gray-900">{formatPrice(selectedSale.vat_margin_amount ?? selectedSale.vatMarginAmount)}</span>
            </div>
            <div class="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-2">
              <span>TOTAL TTC</span>
              <span>{formatPrice(selectedSale.total)}</span>
            </div>
          </div>

          <!-- Payment method -->
          <div class="mt-3 text-center text-xs text-gray-500">
            Paye par {methodLabels[selectedSale.payment_method ?? selectedSale.paymentMethod] ?? 'autre'}
          </div>

          <!-- Hash signature -->
          <div class="mt-4 border-t border-dashed border-gray-300 pt-3 text-center">
            <div class="font-mono text-[9px] text-gray-400 break-all">
              {selectedSale.hash}
            </div>
            <div class="text-[10px] text-gray-400 mt-1">
              Genere par logiciel certifie Caissette v1.0.0
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="border-t px-6 py-3 flex justify-end gap-2">
          {#if isManager}
            <button onclick={() => openInvoiceForm(selectedSale.id)}
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Facture
            </button>
          {/if}
          <button onclick={handlePrint} disabled={printing}
            class="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 transition-colors disabled:opacity-50">
            {printing ? 'Impression...' : 'Imprimer'}
          </button>
          <button onclick={() => selectedSale = null}
            class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
            Fermer
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Invoice client form modal -->
{#if showInvoiceForm}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={() => showInvoiceForm = false}>
    <div class="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Generer une facture</h2>
      <p class="text-sm text-gray-500 mb-4">Informations client (optionnel)</p>
      <div class="space-y-3">
        <div>
          <label for="inv-name" class="block text-sm font-medium text-gray-700 mb-1">Nom / Raison sociale</label>
          <input type="text" id="inv-name" bind:value={clientName} placeholder="Particulier"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label for="inv-address" class="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
          <input type="text" id="inv-address" bind:value={clientAddress} placeholder=""
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label for="inv-siret" class="block text-sm font-medium text-gray-700 mb-1">SIRET</label>
          <input type="text" id="inv-siret" bind:value={clientSiret} placeholder=""
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button onclick={() => showInvoiceForm = false}
          class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
          Annuler
        </button>
        <button onclick={() => generateInvoice(invoiceSaleId)} disabled={invoiceLoading}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
          {invoiceLoading ? 'Generation...' : 'Generer'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Invoice display modal -->
{#if showInvoice && invoiceData}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={() => showInvoice = false}>
    <div class="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl print:shadow-none print:rounded-none" onclick={(e) => e.stopPropagation()}>
      <div class="p-8" id="invoice-print">
        <!-- Invoice header -->
        <div class="flex justify-between items-start mb-8">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">FACTURE</h2>
            <p class="text-sm text-gray-500 mt-1">N. {invoiceData.invoiceNumber ?? invoiceData.number ?? '-'}</p>
            <p class="text-sm text-gray-500">Date : {invoiceData.date ?? new Date().toLocaleDateString('fr-FR')}</p>
          </div>
          <div class="text-right text-sm text-gray-600">
            {#if invoiceData.seller}
              <div class="font-semibold text-gray-900">{invoiceData.seller.name}</div>
              <div>{invoiceData.seller.address}</div>
              <div>SIRET : {invoiceData.seller.siret}</div>
              {#if invoiceData.seller.vatNumber}
                <div>TVA : {invoiceData.seller.vatNumber}</div>
              {/if}
            {/if}
          </div>
        </div>

        <!-- Client info -->
        {#if invoiceData.client && (invoiceData.client.name || invoiceData.client.address || invoiceData.client.siret)}
          <div class="mb-6 rounded-lg bg-gray-50 p-4">
            <div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Client</div>
            {#if invoiceData.client.name}<div class="text-sm font-medium text-gray-900">{invoiceData.client.name}</div>{/if}
            {#if invoiceData.client.address}<div class="text-sm text-gray-600">{invoiceData.client.address}</div>{/if}
            {#if invoiceData.client.siret}<div class="text-sm text-gray-600">SIRET : {invoiceData.client.siret}</div>{/if}
          </div>
        {/if}

        <!-- Items table -->
        {#if invoiceData.items}
          <div class="overflow-hidden rounded-lg border border-gray-200 mb-6">
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr class="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th class="px-4 py-3 text-left">Designation</th>
                  <th class="px-4 py-3 text-right">Prix HT</th>
                  <th class="px-4 py-3 text-right">TVA</th>
                  <th class="px-4 py-3 text-right">Prix TTC</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each invoiceData.items as item}
                  <tr>
                    <td class="px-4 py-3 text-gray-900">{item.name}</td>
                    <td class="px-4 py-3 text-right">{formatPrice(item.priceHT ?? item.price_ht ?? 0)}</td>
                    <td class="px-4 py-3 text-right text-amber-700">{formatPrice(item.vatAmount ?? item.vat_amount ?? 0)}</td>
                    <td class="px-4 py-3 text-right font-medium">{formatPrice(item.priceTTC ?? item.price_ttc ?? item.price ?? 0)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        <!-- Totals -->
        <div class="flex justify-end mb-8">
          <div class="w-64 space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Total HT</span>
              <span class="font-medium">{formatPrice(invoiceData.totalHT ?? invoiceData.total_ht ?? 0)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">TVA</span>
              <span class="font-medium text-amber-700">{formatPrice(invoiceData.totalVAT ?? invoiceData.total_vat ?? 0)}</span>
            </div>
            <div class="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
              <span>Total TTC</span>
              <span>{formatPrice(invoiceData.totalTTC ?? invoiceData.total_ttc ?? 0)}</span>
            </div>
          </div>
        </div>

        <!-- Legal mentions -->
        <div class="border-t border-gray-200 pt-4 text-[10px] text-gray-400 space-y-1">
          {#if invoiceData.legalMentions}
            {#each invoiceData.legalMentions as mention}
              <p>{mention}</p>
            {/each}
          {:else}
            <p>TVA sur la marge - Articles 297 A du CGI</p>
            <p>En cas de retard de paiement, une penalite de 3 fois le taux d'interet legal sera appliquee.</p>
            <p>Indemnite forfaitaire pour frais de recouvrement : 40 EUR (art. D.441-5 du Code de commerce).</p>
          {/if}
        </div>
      </div>

      <!-- Print/Close actions -->
      <div class="border-t px-6 py-3 flex justify-end gap-2 print:hidden">
        <button onclick={() => window.print()}
          class="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 transition-colors">
          Imprimer
        </button>
        <button onclick={() => showInvoice = false}
          class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
          Fermer
        </button>
      </div>
    </div>
  </div>
{/if}
