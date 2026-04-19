<script lang="ts">
  import { sales } from '$lib/api/client'
  import { onMount } from 'svelte'

  let list = $state<any[]>([])
  let loading = $state(true)

  onMount(async () => {
    try {
      list = await sales.list()
    } catch { /* ignore */ }
    loading = false
  })

  function formatPrice(cents: number) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' \u20AC'
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  }

  const methodLabels: Record<string, string> = {
    cash: 'Especes',
    card: 'CB',
    check: 'Cheque',
    transfer: 'Virement',
    other: 'Autre',
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
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
