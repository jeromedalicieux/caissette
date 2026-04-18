<script lang="ts">
  import { items, depositors } from '$lib/api/client'
  import { onMount } from 'svelte'

  let list = $state<any[]>([])
  let depList = $state<any[]>([])
  let showForm = $state(false)
  let loading = $state(true)
  let error = $state('')
  let statusFilter = $state('available')

  // Form
  let name = $state('')
  let description = $state('')
  let category = $state('')
  let brand = $state('')
  let size = $state('')
  let initialPrice = $state('')
  let depositorId = $state('')
  let vatRegime = $state('deposit')
  let vatRate = $state(2000)

  onMount(async () => {
    await Promise.all([loadList(), loadDepositors()])
  })

  async function loadList() {
    loading = true
    try {
      list = await items.list(statusFilter)
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
      const priceInCents = Math.round(parseFloat(initialPrice) * 100)
      await items.create({
        name,
        description: description || undefined,
        category: category || undefined,
        brand: brand || undefined,
        size: size || undefined,
        initialPrice: priceInCents,
        depositorId: depositorId || undefined,
        vatRegime,
        vatRate,
      })
      showForm = false
      name = description = category = brand = size = initialPrice = depositorId = ''
      await loadList()
    } catch (e: any) {
      error = e.message
    }
  }

  function formatPrice(cents: number) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €'
  }
</script>

<svelte:head>
  <title>Articles — Rebond</title>
</svelte:head>

<div class="p-6">
  <div class="mb-6 flex items-center justify-between">
    <div class="flex items-center gap-4">
      <h1 class="text-2xl font-bold text-gray-900">Articles</h1>
      <select bind:value={statusFilter} onchange={() => loadList()}
        class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
        <option value="available">En vente</option>
        <option value="sold">Vendus</option>
        <option value="returned">Restitués</option>
      </select>
    </div>
    <button onclick={() => showForm = !showForm}
      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
      {showForm ? 'Annuler' : '+ Nouvel article'}
    </button>
  </div>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
  {/if}

  {#if showForm}
    <form onsubmit={(e) => { e.preventDefault(); handleCreate() }}
      class="mb-6 rounded-xl bg-white p-6 shadow-sm">
      <h2 class="mb-4 text-lg font-semibold">Nouvel article</h2>
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700">Nom *</label>
          <input type="text" bind:value={name} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Catégorie</label>
          <input type="text" bind:value={category} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Vêtements, Meubles..." />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Marque</label>
          <input type="text" bind:value={brand} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Taille</label>
          <input type="text" bind:value={size} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="M, 42..." />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Prix (€) *</label>
          <input type="number" step="0.01" min="0" bind:value={initialPrice} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Déposant</label>
          <select bind:value={depositorId} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Stock propre</option>
            {#each depList as dep}
              <option value={dep.id}>{dep.first_name ?? dep.firstName} {dep.last_name ?? dep.lastName}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Régime TVA</label>
          <select bind:value={vatRegime} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="deposit">TVA sur marge (dépôt)</option>
            <option value="resale_item_by_item">TVA marge (achat/revente)</option>
            <option value="normal">TVA normale</option>
          </select>
        </div>
      </div>
      <button type="submit" class="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">
        Ajouter l'article
      </button>
    </form>
  {/if}

  {#if loading}
    <p class="text-gray-500">Chargement...</p>
  {:else if list.length === 0}
    <p class="text-gray-500">Aucun article.</p>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th class="px-4 py-3">Code</th>
            <th class="px-4 py-3">Article</th>
            <th class="px-4 py-3">Catégorie</th>
            <th class="px-4 py-3">Prix</th>
            <th class="px-4 py-3">Statut</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          {#each list as item}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 font-mono text-xs">{item.sku ?? '-'}</td>
              <td class="px-4 py-3 font-medium">{item.name}</td>
              <td class="px-4 py-3 text-gray-600">{item.category ?? '-'}</td>
              <td class="px-4 py-3">{formatPrice(item.current_price ?? item.currentPrice)}</td>
              <td class="px-4 py-3">
                <span class="rounded-full px-2 py-0.5 text-xs font-medium
                  {item.status === 'available' ? 'bg-green-100 text-green-700' : item.status === 'sold' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}">
                  {item.status}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
