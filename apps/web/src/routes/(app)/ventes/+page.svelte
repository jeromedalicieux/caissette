<script lang="ts">
  import { sales } from '$lib/api/client'
  import { onMount } from 'svelte'

  let list = $state<any[]>([])
  let loading = $state(true)
  let selectedSale = $state<any>(null)
  let loadingDetail = $state(false)

  onMount(async () => {
    try {
      list = await sales.list()
    } catch { /* ignore */ }
    loading = false
  })

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
</script>

<svelte:head>
  <title>Ventes -- Rebond</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Historique des ventes</h1>
    <p class="text-sm text-gray-500 mt-1">Toutes les transactions realisees depuis la caisse</p>
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
                <button onclick={() => viewReceipt(sale.id)}
                  class="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                  Ticket
                </button>
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
              Genere par logiciel certifie Rebond Caisse v1.0.0
            </div>
          </div>
        </div>

        <!-- Close button -->
        <div class="border-t px-6 py-3 flex justify-end">
          <button onclick={() => selectedSale = null}
            class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
            Fermer
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
