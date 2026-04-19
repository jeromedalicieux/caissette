<script lang="ts">
  import { reversementsApi, depositors } from '$lib/api/client'
  import { shopStore } from '$lib/stores/shop.svelte'
  import { authStore } from '$lib/stores/auth.svelte'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let list = $state<any[]>([])
  let depList = $state<any[]>([])
  let loading = $state(true)
  let showForm = $state(false)
  let error = $state('')
  let success = $state('')
  let creating = $state(false)

  // Form
  let selectedDepositor = $state('')
  let periodStart = $state('')
  let periodEnd = $state('')

  onMount(async () => {
    if (!shopStore.hasDepositSale) { goto('/caisse'); return }
    await Promise.all([loadList(), loadDepositors()])
  })

  async function loadList() {
    loading = true
    try {
      list = await reversementsApi.list()
    } catch (e: any) {
      error = e.message
    }
    loading = false
  }

  async function loadDepositors() {
    try {
      depList = await depositors.list()
    } catch { /* ignore */ }
  }

  function depositorName(id: string) {
    const dep = depList.find(d => d.id === id)
    if (!dep) return id.slice(0, 8)
    return `${dep.first_name ?? dep.firstName} ${dep.last_name ?? dep.lastName}`
  }

  async function handleCreate() {
    if (!selectedDepositor || !periodStart || !periodEnd) {
      error = 'Selectionnez un deposant et une periode'
      return
    }
    error = ''
    creating = true
    try {
      const result = await reversementsApi.create({
        depositorId: selectedDepositor,
        periodStart: new Date(periodStart).getTime(),
        periodEnd: new Date(periodEnd + 'T23:59:59.999').getTime(),
      })
      success = `Reversement cree : ${formatPrice(result.totalReversement)} a reverser`
      showForm = false
      selectedDepositor = ''
      periodStart = ''
      periodEnd = ''
      await loadList()
    } catch (e: any) {
      error = e.message
    }
    creating = false
  }

  async function markPaid(id: string) {
    error = ''
    try {
      await reversementsApi.markPaid(id, 'transfer')
      success = 'Reversement marque comme paye'
      await loadList()
    } catch (e: any) {
      error = e.message
    }
  }

  async function cancel(id: string) {
    if (!confirm('Annuler ce reversement ?')) return
    error = ''
    try {
      await reversementsApi.cancel(id)
      await loadList()
    } catch (e: any) {
      error = e.message
    }
  }

  function formatPrice(cents: number) {
    return (Math.abs(cents) / 100).toFixed(2).replace('.', ',') + ' \u20AC'
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('fr-FR', { dateStyle: 'short' })
  }

  function statusLabel(s: string) {
    if (s === 'pending') return 'En attente'
    if (s === 'paid') return 'Paye'
    if (s === 'cancelled') return 'Annule'
    return s
  }

  function statusClass(s: string) {
    if (s === 'pending') return 'bg-amber-50 text-amber-700'
    if (s === 'paid') return 'bg-green-50 text-green-700'
    if (s === 'cancelled') return 'bg-gray-100 text-gray-500'
    return 'bg-gray-100 text-gray-600'
  }

  const isManager = $derived(authStore.user?.role === 'owner' || authStore.user?.role === 'manager')
</script>

<svelte:head>
  <title>Reversements — Rebond</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Reversements</h1>
      <p class="text-sm text-gray-500 mt-1">Paiements dus aux deposants</p>
    </div>
    {#if isManager}
      <button onclick={() => showForm = !showForm}
        class="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
        {showForm ? 'Annuler' : '+ Nouveau reversement'}
      </button>
    {/if}
  </div>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
  {/if}
  {#if success}
    <div class="mb-4 rounded-lg bg-green-50 border border-green-100 p-4 text-sm text-green-700">{success}</div>
  {/if}

  {#if showForm}
    <form onsubmit={(e) => { e.preventDefault(); handleCreate() }}
      class="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Calculer un reversement</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Deposant</label>
          <select bind:value={selectedDepositor} required
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="">Choisir...</option>
            {#each depList as dep}
              <option value={dep.id}>{dep.first_name ?? dep.firstName} {dep.last_name ?? dep.lastName}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Debut</label>
          <input type="date" bind:value={periodStart} required
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Fin</label>
          <input type="date" bind:value={periodEnd} required
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
      </div>
      <div class="mt-5 flex justify-end">
        <button type="submit" disabled={creating}
          class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
          {creating ? 'Calcul...' : 'Calculer et creer'}
        </button>
      </div>
    </form>
  {/if}

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else if list.length === 0}
    <p class="text-center py-12 text-gray-500">Aucun reversement.</p>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50/80">
          <tr class="text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th class="px-5 py-3.5">Deposant</th>
            <th class="px-5 py-3.5">Periode</th>
            <th class="px-5 py-3.5">Ventes</th>
            <th class="px-5 py-3.5">Commission</th>
            <th class="px-5 py-3.5">A reverser</th>
            <th class="px-5 py-3.5">Statut</th>
            {#if isManager}
              <th class="px-5 py-3.5">Actions</th>
            {/if}
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each list as rev}
            <tr class="hover:bg-gray-50/50 transition-colors">
              <td class="px-5 py-4 font-medium text-gray-900">{depositorName(rev.depositor_id ?? rev.depositorId)}</td>
              <td class="px-5 py-4 text-gray-600 text-xs">
                {formatDate(rev.period_start ?? rev.periodStart)} — {formatDate(rev.period_end ?? rev.periodEnd)}
              </td>
              <td class="px-5 py-4 text-gray-600">{formatPrice(rev.total_sales ?? rev.totalSales)}</td>
              <td class="px-5 py-4 text-gray-600">{formatPrice(rev.total_commission ?? rev.totalCommission)}</td>
              <td class="px-5 py-4 font-semibold text-gray-900">{formatPrice(rev.total_reversement ?? rev.totalReversement)}</td>
              <td class="px-5 py-4">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {statusClass(rev.status)}">
                  {statusLabel(rev.status)}
                </span>
              </td>
              {#if isManager}
                <td class="px-5 py-4">
                  {#if rev.status === 'pending'}
                    <div class="flex gap-3">
                      <button onclick={() => markPaid(rev.id)}
                        class="text-sm font-medium text-green-600 hover:text-green-800 transition-colors">Payer</button>
                      <button onclick={() => cancel(rev.id)}
                        class="text-sm font-medium text-red-600 hover:text-red-700 transition-colors">Annuler</button>
                    </div>
                  {:else if rev.status === 'paid'}
                    <span class="text-xs text-gray-400">Paye le {formatDate(rev.paid_at ?? rev.paidAt)}</span>
                  {/if}
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
