<script lang="ts">
  import { items, depositors } from '$lib/api/client'
  import { shopStore } from '$lib/stores/shop.svelte'
  import { onMount } from 'svelte'
  import SectionGuide from '$lib/components/SectionGuide.svelte'

  let list = $state<any[]>([])
  let depList = $state<any[]>([])
  let showForm = $state(false)
  let loading = $state(true)
  let error = $state('')
  let statusFilter = $state('available')
  let typeFilter = $state<string>('')
  let editingId = $state<string | null>(null)

  // Form
  let itemType = $state<'product' | 'service'>('product')
  let name = $state('')
  let description = $state('')
  let category = $state('')
  let brand = $state('')
  let size = $state('')
  let initialPrice = $state('')
  let currentPrice = $state('')
  let depositorId = $state('')
  let vatRegime = $state(shopStore.hasDepositSale ? 'deposit' : 'normal')
  let vatRate = $state(2000)

  onMount(async () => {
    const promises: Promise<void>[] = [loadList()]
    if (shopStore.hasDepositSale) promises.push(loadDepositors())
    await Promise.all(promises)
  })

  async function loadList() {
    loading = true
    try {
      list = await items.list(statusFilter, typeFilter || undefined)
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

  function resetForm() {
    itemType = 'product'
    name = description = category = brand = size = initialPrice = currentPrice = depositorId = ''
    vatRegime = shopStore.hasDepositSale ? 'deposit' : 'normal'
    vatRate = 2000
    editingId = null
  }

  function startEdit(item: any) {
    editingId = item.id
    itemType = item.type ?? 'product'
    name = item.name ?? ''
    description = item.description ?? ''
    category = item.category ?? ''
    brand = item.brand ?? ''
    size = item.size ?? ''
    const price = item.current_price ?? item.currentPrice ?? 0
    currentPrice = (price / 100).toFixed(2)
    initialPrice = ''
    depositorId = item.depositor_id ?? item.depositorId ?? ''
    vatRegime = item.vat_regime ?? item.vatRegime ?? 'deposit'
    vatRate = item.vat_rate ?? item.vatRate ?? 2000
    showForm = true
  }

  async function handleSubmit() {
    error = ''
    try {
      if (editingId) {
        const data: Record<string, unknown> = {}
        if (name) data.name = name
        if (description) data.description = description
        if (category) data.category = category
        if (brand) data.brand = brand
        if (size) data.size = size
        if (currentPrice) data.currentPrice = Math.round(parseFloat(currentPrice) * 100)
        await items.update(editingId, data)
      } else {
        const priceInCents = Math.round(parseFloat(initialPrice) * 100)
        await items.create({
          type: itemType,
          name,
          description: description || undefined,
          category: category || undefined,
          brand: itemType === 'service' ? undefined : (brand || undefined),
          size: itemType === 'service' ? undefined : (size || undefined),
          initialPrice: priceInCents,
          depositorId: depositorId || undefined,
          vatRegime,
          vatRate,
        })
      }
      showForm = false
      resetForm()
      await loadList()
    } catch (e: any) {
      error = e.message
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet article ? (il sera marque comme detruit)')) return
    try {
      await items.remove(id)
      await loadList()
    } catch (e: any) {
      error = e.message
    }
  }

  async function handleReturn(id: string) {
    if (!confirm('Restituer cet article au deposant ?')) return
    try {
      await items.returnItem(id)
      await loadList()
    } catch (e: any) {
      error = e.message
    }
  }

  function formatPrice(cents: number) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' \u20AC'
  }

  function statusLabel(status: string) {
    if (status === 'available') return 'En vente'
    if (status === 'sold') return 'Vendu'
    if (status === 'returned') return 'Restitue'
    if (status === 'destroyed') return 'Supprime'
    return status
  }

  function statusClass(status: string) {
    if (status === 'available') return 'bg-green-50 text-green-700'
    if (status === 'sold') return 'bg-blue-50 text-blue-700'
    if (status === 'returned') return 'bg-amber-50 text-amber-700'
    return 'bg-gray-100 text-gray-600'
  }
</script>

<svelte:head>
  <title>Articles -- Rebond</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6 flex items-center justify-between">
    <div class="flex items-center gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-gray-900">Articles</h1>
          <SectionGuide
            title="Gestion des articles"
            description="Gerez votre inventaire complet. Ajoutez de nouveaux articles, modifiez les prix, et suivez leur statut."
            tips={['Filtrez par statut : en vente, vendus, restitues, supprimes', 'Un code SKU unique est genere automatiquement', 'Les articles vendus changent de statut automatiquement', 'Si le depot-vente est actif, vous pouvez associer un deposant']}
          />
        </div>
        <p class="text-sm text-gray-500 mt-1">{shopStore.hasDepositSale ? 'Inventaire et gestion des articles en depot' : 'Inventaire et gestion des articles'}</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button onclick={() => { typeFilter = ''; loadList() }}
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {typeFilter === '' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
            Tous
          </button>
          <button onclick={() => { typeFilter = 'product'; loadList() }}
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {typeFilter === 'product' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
            Produits
          </button>
          <button onclick={() => { typeFilter = 'service'; loadList() }}
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {typeFilter === 'service' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
            Services
          </button>
        </div>
        <select bind:value={statusFilter} onchange={() => loadList()}
          class="rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
          <option value="available">En vente</option>
          <option value="sold">Vendus</option>
          <option value="returned">Restitues</option>
          <option value="destroyed">Supprimes</option>
        </select>
      </div>
    </div>
    <button onclick={() => { if (showForm) { showForm = false; resetForm() } else { showForm = true } }}
      class="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
      {showForm ? 'Annuler' : '+ Nouvel article'}
    </button>
  </div>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
  {/if}

  {#if showForm}
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit() }}
      class="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">{editingId ? 'Modifier l\'article' : 'Nouvel article'}</h2>
      {#if !editingId}
        <div class="mb-5">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
          <div class="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 w-fit">
            <button type="button" onclick={() => itemType = 'product'}
              class="rounded-md px-4 py-2 text-sm font-medium transition-colors {itemType === 'product' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
              Produit
            </button>
            <button type="button" onclick={() => itemType = 'service'}
              class="rounded-md px-4 py-2 text-sm font-medium transition-colors {itemType === 'service' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
              Service
            </button>
          </div>
          {#if itemType === 'service'}
            <p class="mt-2 text-xs text-purple-600 font-medium">Service (stock illimite) — pas de code SKU, reste disponible apres chaque vente</p>
          {/if}
        </div>
      {/if}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div class="sm:col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
          <input type="text" bind:value={name} required class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Categorie</label>
          <input type="text" bind:value={category} class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" placeholder="{itemType === 'service' ? 'Reparation, Location...' : 'Vetements, Meubles...'}" />
        </div>
        {#if itemType !== 'service'}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Marque</label>
            <input type="text" bind:value={brand} class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Taille</label>
            <input type="text" bind:value={size} class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" placeholder="M, 42..." />
          </div>
        {/if}
        {#if editingId}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Prix actuel (EUR)</label>
            <input type="number" step="0.01" min="0" bind:value={currentPrice} class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          </div>
        {:else}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Prix (EUR) *</label>
            <input type="number" step="0.01" min="0" bind:value={initialPrice} required class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          </div>
          {#if shopStore.hasDepositSale}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Deposant</label>
              <select bind:value={depositorId} class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
                <option value="">Stock propre</option>
                {#each depList as dep}
                  <option value={dep.id}>{dep.first_name ?? dep.firstName} {dep.last_name ?? dep.lastName}</option>
                {/each}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Regime TVA</label>
              <select bind:value={vatRegime} class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
                <option value="deposit">TVA sur marge (depot)</option>
                <option value="resale_item_by_item">TVA marge (achat/revente)</option>
                <option value="normal">TVA normale</option>
              </select>
            </div>
          {/if}
        {/if}
      </div>
      <div class="mt-6 flex justify-end">
        <button type="submit" class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
          {editingId ? 'Enregistrer' : 'Ajouter l\'article'}
        </button>
      </div>
    </form>
  {/if}

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else if list.length === 0}
    <div class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
      <p class="mt-3 text-sm font-medium text-gray-500">Aucun article</p>
      <p class="mt-1 text-xs text-gray-400">Cliquez sur "+ Nouvel article" pour ajouter votre premier article</p>
    </div>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50/80">
          <tr class="text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th class="px-5 py-3.5">Code</th>
            <th class="px-5 py-3.5">Article</th>
            <th class="px-5 py-3.5">Categorie</th>
            <th class="px-5 py-3.5">Prix</th>
            <th class="px-5 py-3.5">Statut</th>
            {#if statusFilter === 'available'}
              <th class="px-5 py-3.5">Actions</th>
            {/if}
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each list as item}
            <tr class="hover:bg-gray-50/50 transition-colors">
              <td class="px-5 py-4 font-mono text-xs text-gray-500">{item.sku ?? '-'}</td>
              <td class="px-5 py-4">
                <span class="font-medium text-gray-900">{item.name}</span>
                {#if item.type === 'service'}
                  <span class="ml-1.5 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">Service</span>
                {/if}
              </td>
              <td class="px-5 py-4 text-gray-600">{item.category ?? '-'}</td>
              <td class="px-5 py-4 font-medium">{formatPrice(item.current_price ?? item.currentPrice)}</td>
              <td class="px-5 py-4">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {statusClass(item.status)}">
                  {statusLabel(item.status)}
                </span>
              </td>
              {#if statusFilter === 'available'}
                <td class="px-5 py-4">
                  <div class="flex gap-3">
                    <button onclick={() => startEdit(item)}
                      class="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">Modifier</button>
                    {#if shopStore.hasDepositSale && (item.depositor_id ?? item.depositorId)}
                      <button onclick={() => handleReturn(item.id)}
                        class="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors">Restituer</button>
                    {/if}
                    <button onclick={() => handleDelete(item.id)}
                      class="text-sm font-medium text-red-600 hover:text-red-700 transition-colors">Supprimer</button>
                  </div>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
