<script lang="ts">
  import { contracts, depositors } from '$lib/api/client'
  import { shopStore } from '$lib/stores/shop.svelte'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let list = $state<any[]>([])
  let depList = $state<any[]>([])
  let showForm = $state(false)
  let loading = $state(true)
  let error = $state('')

  // Form
  let depositorId = $state('')
  let commissionRate = $state(4000)
  let expiresInDays = $state(90)

  onMount(async () => {
    if (!shopStore.hasDepositSale) { goto('/caisse'); return }
    await Promise.all([loadList(), loadDepositors()])
  })

  async function loadList() {
    loading = true
    try {
      list = await contracts.list()
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

  async function handleCreate() {
    error = ''
    try {
      const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000
      await contracts.create({
        depositorId,
        commissionRate,
        expiresAt,
      })
      showForm = false
      depositorId = ''
      commissionRate = 4000
      expiresInDays = 90
      await loadList()
    } catch (e: any) {
      error = e.message
    }
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('fr-FR')
  }

  function statusLabel(status: string) {
    if (status === 'active') return 'Actif'
    if (status === 'expired') return 'Expire'
    if (status === 'cancelled') return 'Annule'
    return status
  }

  function statusClass(status: string) {
    if (status === 'active') return 'bg-green-50 text-green-700'
    if (status === 'expired') return 'bg-amber-50 text-amber-700'
    return 'bg-gray-100 text-gray-600'
  }
</script>

<svelte:head>
  <title>Contrats -- Caissette</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Contrats de depot</h1>
      <p class="text-sm text-gray-500 mt-1">Suivi des contrats entre la boutique et les deposants</p>
    </div>
    <button onclick={() => showForm = !showForm}
      class="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
      {showForm ? 'Annuler' : '+ Nouveau contrat'}
    </button>
  </div>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
  {/if}

  {#if showForm}
    <form onsubmit={(e) => { e.preventDefault(); handleCreate() }}
      class="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Nouveau contrat</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div class="sm:col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Deposant *</label>
          <select bind:value={depositorId} required class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="">Selectionner...</option>
            {#each depList as dep}
              <option value={dep.id}>{dep.first_name ?? dep.firstName} {dep.last_name ?? dep.lastName}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Commission (%)</label>
          <input type="number" min="0" max="100" step="1" value={commissionRate / 100}
            onchange={(e) => commissionRate = Number(e.currentTarget.value) * 100}
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Duree (jours)</label>
          <input type="number" min="1" bind:value={expiresInDays}
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
      </div>
      <div class="mt-6 flex justify-end">
        <button type="submit" class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
          Creer le contrat
        </button>
      </div>
    </form>
  {/if}

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else if list.length === 0}
    <p class="text-center py-12 text-gray-500">Aucun contrat enregistre.</p>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50/80">
          <tr class="text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th class="px-5 py-3.5">N. contrat</th>
            <th class="px-5 py-3.5">Deposant</th>
            <th class="px-5 py-3.5">Commission</th>
            <th class="px-5 py-3.5">Signe le</th>
            <th class="px-5 py-3.5">Expire le</th>
            <th class="px-5 py-3.5">Statut</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each list as c}
            <tr class="hover:bg-gray-50/50 transition-colors">
              <td class="px-5 py-4 font-mono text-xs text-gray-500">{c.number}</td>
              <td class="px-5 py-4 font-medium text-gray-900">
                {c.depositorFirstName ?? c.depositor_first_name ?? ''} {c.depositorLastName ?? c.depositor_last_name ?? ''}
              </td>
              <td class="px-5 py-4">{(c.commission_rate ?? c.commissionRate ?? 0) / 100}%</td>
              <td class="px-5 py-4 text-gray-600">{formatDate(c.signed_at ?? c.signedAt)}</td>
              <td class="px-5 py-4 text-gray-600">{formatDate(c.expires_at ?? c.expiresAt)}</td>
              <td class="px-5 py-4">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {statusClass(c.status)}">
                  {statusLabel(c.status)}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
