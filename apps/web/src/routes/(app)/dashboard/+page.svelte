<script lang="ts">
  import { dashboard } from '$lib/api/client'
  import { onMount } from 'svelte'

  let data = $state<any>(null)
  let loading = $state(true)

  onMount(async () => {
    try {
      data = await dashboard.get()
    } catch { /* ignore */ }
    loading = false
  })

  function formatPrice(cents: number) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' \u20AC'
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
  <title>Tableau de bord — Rebond</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Tableau de bord</h1>
    <p class="text-sm text-gray-500 mt-1">Vue d'ensemble de l'activite</p>
  </div>

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else if data}
    <!-- KPI Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500">CA aujourd'hui</div>
        <div class="mt-2 text-2xl font-bold text-gray-900">{formatPrice(data.today.ca)}</div>
        <div class="mt-1 text-xs text-gray-400">{data.today.count} vente{data.today.count > 1 ? 's' : ''}</div>
      </div>
      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500">Ventes aujourd'hui</div>
        <div class="mt-2 text-2xl font-bold text-blue-600">{data.today.count}</div>
      </div>
      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500">CA du mois</div>
        <div class="mt-2 text-2xl font-bold text-gray-900">{formatPrice(data.month.ca)}</div>
        <div class="mt-1 text-xs text-gray-400">{data.month.count} vente{data.month.count > 1 ? 's' : ''}</div>
      </div>
      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500">Ventes du mois</div>
        <div class="mt-2 text-2xl font-bold text-blue-600">{data.month.count}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Top articles -->
      <div class="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Top articles du mois</h2>
        {#if data.topArticles.length === 0}
          <p class="text-sm text-gray-400 py-4">Aucune vente ce mois</p>
        {:else}
          <div class="space-y-3">
            {#each data.topArticles as article, i}
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">{i + 1}</span>
                  <div>
                    <div class="text-sm font-medium text-gray-900">{article.name}</div>
                    <div class="text-xs text-gray-400">{article.count} vendu{article.count > 1 ? 's' : ''}</div>
                  </div>
                </div>
                <span class="text-sm font-semibold text-gray-900">{formatPrice(article.revenue)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Payment methods -->
      <div class="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Repartition par paiement</h2>
        {#if Object.keys(data.byPayment).length === 0}
          <p class="text-sm text-gray-400 py-4">Aucune donnee</p>
        {:else}
          <div class="space-y-3">
            {#each Object.entries(data.byPayment) as [method, amount]}
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700">{methodLabels[method] ?? method}</span>
                <span class="text-sm font-semibold text-gray-900">{formatPrice(amount as number)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
