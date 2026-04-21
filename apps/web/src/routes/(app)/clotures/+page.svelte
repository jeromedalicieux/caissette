<script lang="ts">
  import { closuresApi } from '$lib/api/client'
  import { authStore } from '$lib/stores/auth.svelte'
  import { onMount } from 'svelte'
  import SectionGuide from '$lib/components/SectionGuide.svelte'

  let list = $state<any[]>([])
  let loading = $state(true)
  let generating = $state(false)
  let error = $state('')
  let success = $state('')

  onMount(loadList)

  async function loadList() {
    loading = true
    try {
      list = await closuresApi.list()
    } catch (e: any) {
      error = e.message
    }
    loading = false
  }

  async function generate(type: 'daily' | 'monthly') {
    error = ''
    success = ''
    generating = true
    try {
      const result = await closuresApi.generate(type)
      success = `Cloture ${type === 'daily' ? 'journaliere' : 'mensuelle'} generee — ${result.salesCount} vente(s), ${formatPrice(result.totalAmount)} TTC`
      await loadList()
    } catch (e: any) {
      error = e.message
    }
    generating = false
  }

  function formatPrice(cents: number) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' \u20AC'
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  }

  function formatPeriod(start: number, end: number) {
    const s = new Date(start)
    const e = new Date(end)
    if (s.toDateString() === e.toDateString()) {
      return s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    }
    return `${s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — ${e.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }

  function typeLabel(type: string) {
    if (type === 'daily') return 'Z (jour)'
    if (type === 'monthly') return 'Mensuelle'
    if (type === 'yearly') return 'Annuelle'
    return type
  }

  function typeClass(type: string) {
    if (type === 'daily') return 'bg-blue-50 text-blue-700'
    if (type === 'monthly') return 'bg-purple-50 text-purple-700'
    return 'bg-gray-100 text-gray-600'
  }

  const isManager = $derived(authStore.user?.role === 'owner' || authStore.user?.role === 'manager')
</script>

<svelte:head>
  <title>Clotures de caisse -- Caissette</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold text-gray-900">Clotures de caisse</h1>
        <SectionGuide
          title="Clotures de caisse"
          description="Les clotures (tickets Z) sont obligatoires chaque jour ouvrable (art. 286 CGI). Elles scellent cryptographiquement toutes les ventes de la journee."
          tips={['La cloture Z est obligatoire chaque jour ouvrable (art. 286 CGI)', 'Elle scelle cryptographiquement toutes les ventes de la journee', 'Une cloture oubliee peut etre generee a posteriori', 'La cloture mensuelle regroupe toutes les Z du mois', 'Seuls les responsables (owner/manager) peuvent generer des clotures']}
        />
      </div>
      <p class="text-sm text-gray-500 mt-1">Tickets Z journaliers et clotures mensuelles</p>
    </div>
    {#if isManager}
      <div class="flex gap-2">
        <button onclick={() => generate('daily')} disabled={generating}
          class="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
          {generating ? 'Generation...' : 'Z Journalier'}
        </button>
        <button onclick={() => generate('monthly')} disabled={generating}
          class="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 transition-colors disabled:opacity-50">
          {generating ? 'Generation...' : 'Cloture mensuelle'}
        </button>
      </div>
    {/if}
  </div>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
  {/if}
  {#if success}
    <div class="mb-4 rounded-lg bg-green-50 border border-green-100 p-4 text-sm text-green-700">{success}</div>
  {/if}

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else if list.length === 0}
    <div class="text-center py-12">
      <p class="text-gray-500 mb-2">Aucune cloture generee.</p>
      {#if isManager}
        <p class="text-sm text-gray-400">Generez votre premier ticket Z pour cloturer la journee.</p>
      {/if}
    </div>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50/80">
          <tr class="text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th class="px-5 py-3.5">Type</th>
            <th class="px-5 py-3.5">Periode</th>
            <th class="px-5 py-3.5">Ventes</th>
            <th class="px-5 py-3.5">Total TTC</th>
            <th class="px-5 py-3.5">TVA</th>
            <th class="px-5 py-3.5">Tickets</th>
            <th class="px-5 py-3.5">Genere le</th>
            <th class="px-5 py-3.5">Hash</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each list as c}
            {@const start = c.period_start ?? c.periodStart}
            {@const end = c.period_end ?? c.periodEnd}
            {@const ctype = c.type}
            <tr class="hover:bg-gray-50/50 transition-colors">
              <td class="px-5 py-4">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {typeClass(ctype)}">
                  {typeLabel(ctype)}
                </span>
              </td>
              <td class="px-5 py-4 text-gray-600">{formatPeriod(start, end)}</td>
              <td class="px-5 py-4 font-medium">{c.sales_count ?? c.salesCount}</td>
              <td class="px-5 py-4 font-medium text-gray-900">{formatPrice(c.total_amount ?? c.totalAmount)}</td>
              <td class="px-5 py-4 text-gray-600">{formatPrice(c.total_vat ?? c.totalVat)}</td>
              <td class="px-5 py-4 font-mono text-xs text-gray-500">
                {#if (c.first_receipt_number ?? c.firstReceiptNumber) != null}
                  {c.first_receipt_number ?? c.firstReceiptNumber} — {c.last_receipt_number ?? c.lastReceiptNumber}
                {:else}
                  -
                {/if}
              </td>
              <td class="px-5 py-4 text-gray-600">{formatDate(c.generated_at ?? c.generatedAt)}</td>
              <td class="px-5 py-4 font-mono text-[10px] text-gray-400 max-w-[100px] truncate" title={c.hash}>{c.hash?.slice(0, 16)}...</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
