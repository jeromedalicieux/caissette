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
    return (cents / 100).toFixed(2).replace('.', ',') + ' €'
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  }

  const methodLabels: Record<string, string> = {
    cash: 'Espèces',
    card: 'CB',
    check: 'Chèque',
    transfer: 'Virement',
    other: 'Autre',
  }
</script>

<svelte:head>
  <title>Ventes — Rebond</title>
</svelte:head>

<div class="p-6">
  <h1 class="mb-6 text-2xl font-bold text-gray-900">Historique des ventes</h1>

  {#if loading}
    <p class="text-gray-500">Chargement...</p>
  {:else if list.length === 0}
    <p class="text-gray-500">Aucune vente enregistrée.</p>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th class="px-4 py-3">N°</th>
            <th class="px-4 py-3">Date</th>
            <th class="px-4 py-3">Total TTC</th>
            <th class="px-4 py-3">TVA marge</th>
            <th class="px-4 py-3">Paiement</th>
            <th class="px-4 py-3">Statut</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          {#each list as sale}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 font-mono font-medium">{sale.receipt_number ?? sale.receiptNumber}</td>
              <td class="px-4 py-3 text-gray-600">{formatDate(sale.sold_at ?? sale.soldAt)}</td>
              <td class="px-4 py-3 font-medium">{formatPrice(sale.total)}</td>
              <td class="px-4 py-3 text-gray-600">{formatPrice(sale.vat_margin_amount ?? sale.vatMarginAmount)}</td>
              <td class="px-4 py-3">{methodLabels[sale.payment_method ?? sale.paymentMethod] ?? sale.payment_method}</td>
              <td class="px-4 py-3">
                <span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
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
