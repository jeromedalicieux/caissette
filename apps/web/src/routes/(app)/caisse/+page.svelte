<script lang="ts">
  import { items, sales } from '$lib/api/client'
  import { cart, type CartItem } from '$lib/stores/cart.svelte'
  import { authStore } from '$lib/stores/auth.svelte'
  import { shopStore } from '$lib/stores/shop.svelte'
  import { syncStore } from '$lib/stores/sync.svelte'
  import { queueOfflineSale } from '$lib/offline/sync'
  import { refreshItemsCache, getCachedItems, markItemSoldLocally } from '$lib/offline/items-cache'
  import { printer, printReceipt } from '$lib/printer/escpos'
  import { onMount } from 'svelte'
  import SectionGuide from '$lib/components/SectionGuide.svelte'

  let availableItems = $state<any[]>([])
  let search = $state('')
  let paymentMethod = $state('cash')
  let error = $state('')
  let success = $state('')
  let processing = $state(false)
  let printing = $state(false)
  let loading = $state(true)
  let usingCache = $state(false)
  let lastSaleId = $state<string | null>(null)

  // Quick add (montant libre)
  let showQuickAdd = $state(false)
  let quickName = $state('')
  let quickPrice = $state('')

  // Favorites (localStorage)
  let favorites = $state<Set<string>>(new Set())
  // Usage counter (localStorage)
  let usageCount = $state<Record<string, number>>({})
  // Sort mode
  let sortMode = $state<'default' | 'popular' | 'favorites'>(shopStore.display.posDefaultSort)
  // View mode: grid (default cards), list (compact rows), tiles (large touch-friendly)
  let viewMode = $state<'grid' | 'list' | 'tiles'>('grid')

  onMount(() => {
    // Load favorites & usage from localStorage
    try {
      const fav = localStorage.getItem('rebond_favorites')
      if (fav) favorites = new Set(JSON.parse(fav))
      const usage = localStorage.getItem('rebond_usage')
      if (usage) usageCount = JSON.parse(usage)
      const savedView = localStorage.getItem('rebond_view_mode')
      if (savedView && ['grid', 'list', 'tiles'].includes(savedView)) viewMode = savedView as any
    } catch { /* ignore */ }
    loadItems()
  })

  function saveFavorites() {
    localStorage.setItem('rebond_favorites', JSON.stringify([...favorites]))
  }

  function toggleFavorite(e: Event, itemId: string) {
    e.stopPropagation()
    if (favorites.has(itemId)) {
      favorites.delete(itemId)
    } else {
      favorites.add(itemId)
    }
    favorites = new Set(favorites) // trigger reactivity
    saveFavorites()
  }

  function trackUsage(itemId: string) {
    usageCount[itemId] = (usageCount[itemId] ?? 0) + 1
    usageCount = { ...usageCount }
    localStorage.setItem('rebond_usage', JSON.stringify(usageCount))
  }

  async function loadItems() {
    loading = true
    usingCache = false
    try {
      availableItems = await items.list('available')
      // Refresh cache in background
      refreshItemsCache()
      localStorage.setItem('rebond_cache_refresh', String(Date.now()))
    } catch (e: any) {
      // Offline — try local cache
      try {
        const cached = await getCachedItems()
        if (cached.length > 0) {
          availableItems = cached
          usingCache = true
        } else {
          error = 'Hors ligne — aucun article en cache'
        }
      } catch {
        error = e.message
      }
    }
    loading = false
  }

  function filteredItems() {
    let result = availableItems
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (i: any) =>
          i.name.toLowerCase().includes(q) ||
          (i.sku ?? '').toLowerCase().includes(q) ||
          (i.category ?? '').toLowerCase().includes(q),
      )
    }

    // Sort
    if (sortMode === 'favorites') {
      result = [...result].sort((a, b) => {
        const aFav = favorites.has(a.id) ? 1 : 0
        const bFav = favorites.has(b.id) ? 1 : 0
        return bFav - aFav
      })
    } else if (sortMode === 'popular') {
      result = [...result].sort((a, b) => {
        return (usageCount[b.id] ?? 0) - (usageCount[a.id] ?? 0)
      })
    }

    return result
  }

  function addQuickItem() {
    const price = Math.round(parseFloat(quickPrice) * 100)
    if (!quickName || isNaN(price) || price <= 0) return
    cart.add({
      itemId: undefined,
      name: quickName,
      price,
      vatRegime: 'normal',
      vatRate: 2000,
    })
    quickName = ''
    quickPrice = ''
    showQuickAdd = false
  }

  function addToCart(item: any) {
    const price = item.current_price ?? item.currentPrice
    const depositorId = item.depositor_id ?? item.depositorId
    let commissionTtc: number | undefined
    let reversementAmount: number | undefined
    let vatRegimeValue = item.vat_regime ?? item.vatRegime ?? 'normal'

    if (shopStore.hasDepositSale && depositorId) {
      const commissionRate = 4000 // 40% default, TODO: from depositor/contract
      commissionTtc = Math.round(price * commissionRate / 10000)
      reversementAmount = price - commissionTtc
      vatRegimeValue = item.vat_regime ?? item.vatRegime ?? 'deposit'
    }

    const isService = item.type === 'service'
    trackUsage(item.id)

    cart.add({
      itemId: item.id,
      name: item.name,
      price,
      type: item.type ?? 'product',
      depositorId: shopStore.hasDepositSale ? depositorId : undefined,
      vatRegime: vatRegimeValue,
      vatRate: item.vat_rate ?? item.vatRate ?? 2000,
      commissionTtc,
      reversementAmount,
    })

    // Remove from available list (services stay available — infinite stock)
    if (!isService) {
      availableItems = availableItems.filter((i: any) => i.id !== item.id)
      markItemSoldLocally(item.id)
    }
    search = ''
  }

  function formatPrice(cents: number) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' \u20AC'
  }

  function vatLabel(regime: string) {
    if (regime === 'deposit') return 'D\u00E9p\u00F4t'
    if (regime === 'normal') return 'TVA normale'
    return 'Marge'
  }

  async function handlePayment() {
    if (cart.count === 0) return
    error = ''
    success = ''
    processing = true

    try {
      const result = await sales.create({
        cashierId: authStore.user!.id,
        paymentMethod,
        items: cart.items.map((item: CartItem) => ({
          itemId: item.itemId,
          name: item.name,
          price: item.price,
          type: item.type ?? 'product',
          depositorId: item.depositorId,
          vatRegime: item.vatRegime,
          vatRate: item.vatRate,
          commissionTtc: item.commissionTtc,
          reversementAmount: item.reversementAmount,
        })),
      })

      success = `Vente #${result.receiptNumber} enregistr\u00E9e -- ${formatPrice(cart.total)}`
      lastSaleId = result.id
      cart.clear()
      await loadItems()
    } catch (e: any) {
      // If offline, queue the sale for later sync
      if (!navigator.onLine || e.message?.includes('Failed to fetch') || e.message?.includes('Hors ligne')) {
        try {
          const total = cart.items.reduce((sum: number, item: any) => sum + item.price, 0)
          await queueOfflineSale({
            tempId: crypto.randomUUID(),
            cashierId: authStore.user!.id,
            paymentMethod,
            items: cart.items.map((item: CartItem) => ({
              itemId: item.itemId,
              name: item.name,
              price: item.price,
              type: item.type ?? 'product',
              depositorId: item.depositorId,
              vatRegime: item.vatRegime,
              vatRate: item.vatRate,
              commissionTtc: item.commissionTtc,
              reversementAmount: item.reversementAmount,
            })),
            total,
          })
          success = `Vente enregistree hors-ligne (${formatPrice(total)}) — sera synchronisee automatiquement`
          cart.clear()
          await syncStore.refreshPendingCount()
        } catch (offlineErr: any) {
          error = `Erreur: ${offlineErr.message}`
        }
      } else {
        error = e.message
      }
    }
    processing = false
  }

  async function printLastReceipt() {
    if (!lastSaleId) return
    printing = true
    try {
      const sale = await sales.get(lastSaleId)
      await printReceipt({
        shop: sale.shop ?? { name: '', address: '', siret: '' },
        receiptNumber: sale.receipt_number ?? sale.receiptNumber,
        date: new Date(sale.sold_at ?? sale.soldAt).toLocaleString('fr-FR'),
        items: (sale.items ?? []).map((i: any) => ({
          name: i.name,
          price: i.price,
        })),
        total: sale.total,
        vatAmount: sale.vat_margin_amount ?? sale.vatMarginAmount,
        paymentMethod: sale.payment_method ?? sale.paymentMethod,
        hash: sale.hash,
      })
    } catch (e: any) {
      error = e.message
    }
    printing = false
  }

  const paymentOptions = [
    { v: 'cash', l: 'Esp\u00E8ces' },
    { v: 'card', l: 'Carte' },
    { v: 'check', l: 'Ch\u00E8que' },
    { v: 'other', l: 'Autre' },
  ]
</script>

<svelte:head>
  <title>Caisse — Rebond</title>
</svelte:head>

<div class="flex h-[calc(100vh)] flex-col md:flex-row">
  <!-- Left panel: Catalog -->
  <div class="flex min-h-0 flex-1 flex-col bg-gray-50">
    <!-- Search bar + controls -->
    <div class="p-4 pb-2">
      <div class="flex items-center gap-2 mb-2">
        <SectionGuide
          title="Ecran de caisse"
          description="Cliquez sur un article a gauche pour l'ajouter au panier. Choisissez le moyen de paiement, puis appuyez sur Encaisser."
          tips={['Utilisez \"Montant libre\" pour encaisser sans article', 'Cliquez l\'etoile pour mettre un article en favori', 'Triez par popularite pour voir les plus vendus en premier', 'En cas de coupure internet, la vente est sauvegardee hors-ligne']}
        />
      </div>
      {#if usingCache}
        <div class="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700">
          <span class="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          Mode hors-ligne — articles depuis le cache local
        </div>
      {/if}
      <div class="flex gap-2">
        <div class="relative flex-1">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            bind:value={search}
            placeholder="Rechercher un article..."
            class="w-full rounded-full bg-white py-2.5 pl-11 pr-4 text-sm shadow-sm outline-none ring-1 ring-gray-200 transition-shadow placeholder:text-gray-400 focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <button
          onclick={() => showQuickAdd = !showQuickAdd}
          class="shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-colors
            {showQuickAdd ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'}"
          title="Montant libre"
        >
          + Libre
        </button>
      </div>

      <!-- Sort + View mode buttons -->
      <div class="mt-2 flex items-center justify-between">
        <div class="flex gap-1.5">
          <button onclick={() => sortMode = 'default'}
            class="rounded-full px-3 py-1 text-xs font-medium transition-colors
              {sortMode === 'default' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50'}">
            Tous
          </button>
          <button onclick={() => sortMode = 'favorites'}
            class="rounded-full px-3 py-1 text-xs font-medium transition-colors
              {sortMode === 'favorites' ? 'bg-amber-500 text-white' : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50'}">
            Favoris
          </button>
          <button onclick={() => sortMode = 'popular'}
            class="rounded-full px-3 py-1 text-xs font-medium transition-colors
              {sortMode === 'popular' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50'}">
            Populaires
          </button>
        </div>
        <!-- View mode switcher -->
        <div class="flex rounded-lg bg-white ring-1 ring-gray-200 overflow-hidden">
          <button
            onclick={() => { viewMode = 'grid'; localStorage.setItem('rebond_view_mode', 'grid') }}
            class="p-1.5 transition-colors {viewMode === 'grid' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-600'}"
            title="Grille"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </button>
          <button
            onclick={() => { viewMode = 'list'; localStorage.setItem('rebond_view_mode', 'list') }}
            class="p-1.5 transition-colors {viewMode === 'list' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-600'}"
            title="Liste"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </button>
          <button
            onclick={() => { viewMode = 'tiles'; localStorage.setItem('rebond_view_mode', 'tiles') }}
            class="p-1.5 transition-colors {viewMode === 'tiles' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-600'}"
            title="Grandes tuiles"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h12A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h12a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18v-2.25Z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Quick add form -->
      {#if showQuickAdd}
        <div class="mt-2 flex gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
          <input
            type="text"
            bind:value={quickName}
            placeholder="Libelle (ex: Reparation)"
            class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            bind:value={quickPrice}
            placeholder="Prix EUR"
            class="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          />
          <button
            onclick={addQuickItem}
            disabled={!quickName || !quickPrice}
            class="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            Ajouter
          </button>
        </div>
      {/if}
    </div>

    <!-- Product grid -->
    <div class="flex-1 overflow-auto p-4 pt-2">
      {#if loading}
        <!-- Loading skeleton -->
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {#each Array(6) as _}
            <div class="animate-pulse rounded-xl bg-white p-4 shadow-sm">
              <div class="mb-3 h-4 w-3/4 rounded bg-gray-200"></div>
              <div class="mb-2 h-3 w-1/3 rounded bg-gray-100"></div>
              <div class="h-5 w-1/2 rounded bg-gray-200"></div>
            </div>
          {/each}
        </div>
      {:else if filteredItems().length === 0}
        <!-- Empty state -->
        <div class="flex flex-col items-center justify-center py-16 text-gray-400">
          <svg class="mb-3 h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 11.625l2.25-2.25M12 11.625l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p class="text-sm font-medium">Aucun article en vente</p>
          <p class="mt-1 text-xs text-gray-400">Ajoutez des articles depuis la page Articles pour les voir ici</p>
        </div>
      {:else if viewMode === 'list'}
        <!-- LIST VIEW: compact rows -->
        <div class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          {#each filteredItems() as item, idx}
            <div
              class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-blue-50 {idx > 0 ? 'border-t border-gray-100' : ''} {item.type === 'service' ? 'bg-purple-50/30' : ''}"
              onclick={() => addToCart(item)}
              onkeydown={(e) => { if (e.key === 'Enter') addToCart(item) }}
              role="button"
              tabindex="0"
            >
              <!-- Favorite star -->
              <button
                onclick={(e) => toggleFavorite(e, item.id)}
                class="shrink-0 p-0.5 transition-colors {favorites.has(item.id) ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}"
                aria-label="Favori"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clip-rule="evenodd" />
                </svg>
              </button>
              <span class="flex-1 truncate text-sm font-medium text-gray-900">{item.name}</span>
              {#if item.type === 'service'}
                <span class="shrink-0 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-700">Service</span>
              {/if}
              {#if shopStore.display.showCategories && item.category}
                <span class="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{item.category}</span>
              {/if}
              {#if shopStore.display.posShowSku && item.sku}
                <span class="shrink-0 text-xs text-gray-400">{item.sku}</span>
              {/if}
              {#if shopStore.display.posShowUsageCount && usageCount[item.id]}
                <span class="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-500">{usageCount[item.id]}x</span>
              {/if}
              <span class="shrink-0 text-sm font-bold text-blue-600">{formatPrice(item.current_price ?? item.currentPrice)}</span>
            </div>
          {/each}
        </div>
      {:else if viewMode === 'tiles'}
        <!-- TILES VIEW: large touch-friendly cards -->
        <div class="grid grid-cols-2 gap-4">
          {#each filteredItems() as item}
            <div
              class="group relative rounded-2xl bg-white text-left shadow-sm transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer p-5 {item.type === 'service' ? 'ring-2 ring-purple-200' : ''} {favorites.has(item.id) ? 'ring-2 ring-amber-300' : ''}"
              onclick={() => addToCart(item)}
              onkeydown={(e) => { if (e.key === 'Enter') addToCart(item) }}
              role="button"
              tabindex="0"
            >
              <!-- Favorite star -->
              <button
                onclick={(e) => toggleFavorite(e, item.id)}
                class="absolute top-3 right-3 p-1.5 rounded-full transition-colors
                  {favorites.has(item.id) ? 'text-amber-400 hover:text-amber-500' : 'text-gray-200 hover:text-amber-300'}"
                aria-label="Favori"
              >
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clip-rule="evenodd" />
                </svg>
              </button>

              {#if item.type === 'service'}
                <span class="mb-2 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold uppercase text-purple-700">Service</span>
              {/if}
              <div class="pr-8">
                <h3 class="text-base font-semibold text-gray-900 leading-tight">{item.name}</h3>
              </div>
              {#if shopStore.display.showCategories && item.category}
                <span class="mt-2 inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{item.category}</span>
              {/if}
              <div class="mt-3 flex items-end justify-between">
                <div class="flex items-center gap-2">
                  {#if shopStore.display.posShowSku && item.sku}
                    <span class="text-xs text-gray-400">{item.sku}</span>
                  {/if}
                  {#if shopStore.display.posShowUsageCount && usageCount[item.id]}
                    <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">{usageCount[item.id]}x</span>
                  {/if}
                </div>
                <span class="text-2xl font-bold text-blue-600">{formatPrice(item.current_price ?? item.currentPrice)}</span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <!-- GRID VIEW: default cards -->
        <div class="grid gap-3 {shopStore.display.posColumns === 2 ? 'grid-cols-2' : shopStore.display.posColumns === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}">
          {#each filteredItems() as item}
            <div
              class="group relative rounded-xl bg-white text-left shadow-sm transition-shadow hover:shadow-md cursor-pointer {shopStore.display.posCompactCards ? 'p-3' : 'p-4'} {item.type === 'service' ? 'ring-1 ring-purple-200' : ''} {favorites.has(item.id) ? 'ring-1 ring-amber-300' : ''}"
              onclick={() => addToCart(item)}
              onkeydown={(e) => { if (e.key === 'Enter') addToCart(item) }}
              role="button"
              tabindex="0"
            >
              <!-- Favorite star -->
              <button
                onclick={(e) => toggleFavorite(e, item.id)}
                class="absolute top-2 right-2 p-1 rounded-full transition-colors
                  {favorites.has(item.id) ? 'text-amber-400 hover:text-amber-500' : 'text-gray-200 hover:text-amber-300'}"
                aria-label={favorites.has(item.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clip-rule="evenodd" />
                </svg>
              </button>

              <div class="flex items-center gap-1.5 pr-6">
                <span class="truncate text-sm font-medium text-gray-900">{item.name}</span>
                {#if item.type === 'service'}
                  <span class="shrink-0 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-700">Service</span>
                {/if}
              </div>
              {#if shopStore.display.showCategories && item.category}
                <span class="mt-1.5 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{item.category}</span>
              {/if}
              <div class="mt-2 flex items-end justify-between">
                <div class="flex items-center gap-1.5">
                  {#if shopStore.display.posShowSku}
                    <span class="text-xs text-gray-400">{item.sku ?? ''}</span>
                  {/if}
                  {#if shopStore.display.posShowUsageCount && usageCount[item.id]}
                    <span class="rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-500">{usageCount[item.id]}x</span>
                  {/if}
                </div>
                <span class="text-lg font-semibold text-blue-600">{formatPrice(item.current_price ?? item.currentPrice)}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Right panel: Cart + Payment -->
  <div class="flex w-full flex-col border-t bg-white md:w-[400px] md:border-l md:border-t-0 lg:w-[440px]">
    <!-- Cart header -->
    <div class="flex items-center gap-2 border-b px-5 py-4">
      <h2 class="text-lg font-bold text-gray-900">Panier</h2>
      {#if cart.count > 0}
        <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-semibold text-blue-700">
          {cart.count}
        </span>
      {/if}
    </div>

    <!-- Messages -->
    <div class="px-5">
      {#if success}
        <div class="mt-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          <svg class="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{success}</span>
          <button onclick={printLastReceipt} disabled={printing}
            class="ml-2 text-xs font-medium text-green-800 underline hover:text-green-900">
            {printing ? 'Impression...' : 'Imprimer'}
          </button>
        </div>
      {/if}
      {#if error}
        <div class="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <svg class="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      {/if}
    </div>

    <!-- Cart items -->
    <div class="flex-1 overflow-auto px-5 py-4">
      {#if cart.count === 0}
        <p class="py-8 text-center text-sm text-gray-400">Panier vide</p>
      {:else}
        <ul class="space-y-1">
          {#each cart.items as item, i}
            <li class="flex items-center justify-between py-2">
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-gray-900">{item.name}</div>
                {#if shopStore.hasDepositSale}
                  <span class="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    {vatLabel(item.vatRegime)}
                  </span>
                {/if}
              </div>
              <div class="flex items-center gap-3 pl-3">
                <span class="text-sm font-semibold text-gray-900">{formatPrice(item.price)}</span>
                <button
                  onclick={() => cart.remove(i)}
                  class="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  aria-label="Retirer {item.name} du panier"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Payment footer -->
    <div class="border-t px-5 py-4">
      <!-- Total -->
      <div class="mb-4 flex items-baseline justify-between">
        <span class="text-sm font-medium text-gray-500">Total TTC</span>
        <span class="text-2xl font-bold text-gray-900">{formatPrice(cart.total)}</span>
      </div>

      <!-- Divider -->
      <hr class="mb-4 border-gray-100" />

      <!-- Payment method -->
      <div class="mb-4 grid grid-cols-2 gap-2">
        {#each paymentOptions as opt}
          <button
            onclick={() => paymentMethod = opt.v}
            class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors
              {paymentMethod === opt.v
                ? 'border-blue-500 bg-blue-600 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'}"
          >
            {opt.l}
          </button>
        {/each}
      </div>

      <!-- Submit -->
      <button
        onclick={handlePayment}
        disabled={cart.count === 0 || processing}
        class="w-full rounded-xl bg-green-600 py-3 text-lg font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {processing ? 'Traitement...' : 'Encaisser'}
      </button>
    </div>
  </div>
</div>
