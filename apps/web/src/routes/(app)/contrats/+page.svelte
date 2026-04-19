<script lang="ts">
  import { contracts, depositors } from '$lib/api/client'
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
    if (status === 'expired') return 'Expiré'
    if (status === 'cancelled') return 'Annulé'
    return status
  }

  function statusClass(status: string) {
    if (status === 'active') return 'bg-green-100 text-green-700'
    if (status === 'expired') return 'bg-orange-100 text-orange-700'
    return 'bg-gray-100 text-gray-700'
  }
</script>

<svelte:head>
  <title>Contrats — Rebond</title>
</svelte:head>

<div class="p-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold text-gray-900">Contrats de dépôt</h1>
    <button onclick={() => showForm = !showForm}
      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
      {showForm ? 'Annuler' : '+ Nouveau contrat'}
    </button>
  </div>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
  {/if}

  {#if showForm}
    <form onsubmit={(e) => { e.preventDefault(); handleCreate() }}
      class="mb-6 rounded-xl bg-white p-6 shadow-sm">
      <h2 class="mb-4 text-lg font-semibold">Nouveau contrat</h2>
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700">Déposant *</label>
          <select bind:value={depositorId} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Sélectionner...</option>
            {#each depList as dep}
              <option value={dep.id}>{dep.first_name ?? dep.firstName} {dep.last_name ?? dep.lastName}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Commission (%)</label>
          <input type="number" min="0" max="100" step="1" value={commissionRate / 100}
            onchange={(e) => commissionRate = Number(e.currentTarget.value) * 100}
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Durée (jours)</label>
          <input type="number" min="1" bind:value={expiresInDays}
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <button type="submit" class="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">
        Créer le contrat
      </button>
    </form>
  {/if}

  {#if loading}
    <p class="text-gray-500">Chargement...</p>
  {:else if list.length === 0}
    <p class="text-gray-500">Aucun contrat enregistré.</p>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th class="px-4 py-3">N° contrat</th>
            <th class="px-4 py-3">Déposant</th>
            <th class="px-4 py-3">Commission</th>
            <th class="px-4 py-3">Signé le</th>
            <th class="px-4 py-3">Expire le</th>
            <th class="px-4 py-3">Statut</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          {#each list as c}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 font-mono text-xs">{c.number}</td>
              <td class="px-4 py-3 font-medium">
                {c.depositorFirstName ?? c.depositor_first_name ?? ''} {c.depositorLastName ?? c.depositor_last_name ?? ''}
              </td>
              <td class="px-4 py-3">{(c.commission_rate ?? c.commissionRate ?? 0) / 100}%</td>
              <td class="px-4 py-3 text-gray-600">{formatDate(c.signed_at ?? c.signedAt)}</td>
              <td class="px-4 py-3 text-gray-600">{formatDate(c.expires_at ?? c.expiresAt)}</td>
              <td class="px-4 py-3">
                <span class="rounded-full px-2 py-0.5 text-xs font-medium {statusClass(c.status)}">
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
