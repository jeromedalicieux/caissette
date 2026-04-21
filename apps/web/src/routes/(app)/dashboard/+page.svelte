<script lang="ts">
  import { dashboard } from '$lib/api/client'
  import { onMount } from 'svelte'
  import SectionGuide from '$lib/components/SectionGuide.svelte'

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
  <title>Tableau de bord — Caissette</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6">
    <div class="flex items-center gap-2">
      <h1 class="text-2xl font-bold text-gray-900">Tableau de bord</h1>
      <SectionGuide
        title="Votre tableau de bord"
        description="Vue d'ensemble de l'activite de votre boutique en temps reel. Les chiffres se mettent a jour a chaque nouvelle vente."
        tips={['Le CA et les ventes du jour se remettent a zero a minuit', 'Le top articles montre les 5 meilleures ventes du mois en cours', 'La repartition des paiements vous aide a anticiper vos encaissements']}
      />
    </div>
    <p class="text-sm text-gray-500 mt-1">Vue d'ensemble de l'activite</p>
  </div>

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else if data}
    <!-- KPI Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-1 h-full bg-green-500 rounded-r"></div>
        <div class="pl-3">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
              <svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">CA aujourd'hui</span>
          </div>
          <div class="mt-3 text-2xl font-bold text-gray-900">{formatPrice(data.today.ca)}</div>
          <div class="mt-1 text-xs text-gray-400">{data.today.count} vente{data.today.count > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-r"></div>
        <div class="pl-3">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <svg class="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            </div>
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Ventes aujourd'hui</span>
          </div>
          <div class="mt-3 text-2xl font-bold text-blue-600">{data.today.count}</div>
        </div>
      </div>

      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-r"></div>
        <div class="pl-3">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <svg class="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
            </div>
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">CA du mois</span>
          </div>
          <div class="mt-3 text-2xl font-bold text-gray-900">{formatPrice(data.month.ca)}</div>
          <div class="mt-1 text-xs text-gray-400">{data.month.count} vente{data.month.count > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-r"></div>
        <div class="pl-3">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
              <svg class="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Ventes du mois</span>
          </div>
          <div class="mt-3 text-2xl font-bold text-indigo-600">{data.month.count}</div>
        </div>
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
                  <span class="flex h-7 w-7 items-center justify-center rounded-full {i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'} text-xs font-bold">{i + 1}</span>
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
          <div class="space-y-4">
            {#each Object.entries(data.byPayment) as [method, amount]}
              {@const total = Object.values(data.byPayment).reduce((s: number, v) => s + (v as number), 0)}
              {@const pct = total > 0 ? ((amount as number) / total * 100) : 0}
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm text-gray-700">{methodLabels[method] ?? method}</span>
                  <span class="text-sm font-semibold text-gray-900">{formatPrice(amount as number)}</span>
                </div>
                <div class="h-2 rounded-full bg-gray-100">
                  <div class="h-full rounded-full bg-blue-500 transition-all duration-500" style="width: {pct}%"></div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
