<script lang="ts">
  import { items, sales, categoriesApi, cashMovementsApi } from '$lib/api/client'
  import { cart, type CartItem, type PaymentSplit } from '$lib/stores/cart.svelte'
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
  let paymentMethod = $state<string>('cash')
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
  // View mode
  let viewMode = $state<'grid' | 'list' | 'tiles'>('grid')
  // Category filter
  let selectedCategory = $state<string>('')
  // Discount UI
  let discountItemIndex = $state<number>(-1)
  let discountInput = $state('')
  let discountType = $state<'percent' | 'fixed'>('percent')
  let showGlobalDiscount = $state(false)
  let globalDiscountInput = $state('')
  let globalDiscountType = $state<'percent' | 'fixed'>('percent')
  // Multi-payment
  let useMultiPayment = $state(false)
  let payments = $state<PaymentSplit[]>([])
  let multiPaymentInput = $state('')
  let multiPaymentMethod = $state<string>('cash')
  // Change calculator
  let showChangeModal = $state(false)
  let cashGiven = $state('')
  let changeAmount = $derived(
    cashGiven ? Math.round(parseFloat(cashGiven) * 100) - cart.total : 0
  )

  // Barcode scanner (USB scanner = rapid keystrokes ending with Enter)
  let scanBuffer = $state('')
  let scanTimeout: ReturnType<typeof setTimeout> | null = null
  let scanFeedback = $state('')

  // Print toast
  let showPrintToast = $state(false)
  let printToastTimeout: ReturnType<typeof setTimeout> | null = null

  // Cash float (fond de caisse)
  let showCashFloat = $state(false)
  let cashFloatInput = $state('')
  let cashFloat = $state(0) // cents
  let todayKey = $derived(new Date().toISOString().slice(0, 10))

  // Categories from API (with fallback to item extraction)
  let apiCategories = $state<any[]>([])
  let categories = $derived(() => {
    if (apiCategories.length > 0) {
      return apiCategories.map((c: any) => c.name)
    }
    // Fallback: extract from items
    const cats = new Set<string>()
    for (const item of availableItems) {
      if (item.category) cats.add(item.category)
    }
    return [...cats].sort()
  })

  async function loadCashFloatAndCategories() {
    try {
      const movements = await cashMovementsApi.list(todayKey)
      const opening = movements.find((m: any) => m.type === 'opening_float')
      if (opening) cashFloat = opening.amount
    } catch { /* offline — keep localStorage value */ }
    try {
      apiCategories = await categoriesApi.list()
    } catch { /* offline fallback — categories extracted from items */ }
  }

  onMount(() => {
    try {
      const fav = localStorage.getItem('caissette_favorites')
      if (fav) favorites = new Set(JSON.parse(fav))
      const usage = localStorage.getItem('caissette_usage')
      if (usage) usageCount = JSON.parse(usage)
      const savedView = localStorage.getItem('caissette_view_mode')
      if (savedView && ['grid', 'list', 'tiles'].includes(savedView)) viewMode = savedView as any
      // Load cash float for today (localStorage first, then API upgrade)
      const floatData = localStorage.getItem(`caissette_cash_float_${todayKey}`)
      if (floatData) cashFloat = parseInt(floatData)
    } catch { /* ignore */ }

    // Async: load cash float from API and categories
    loadCashFloatAndCategories()

    // Barcode scanner listener (USB scanners type fast then press Enter)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Enter' && scanBuffer.length >= 3) {
        e.preventDefault()
        handleBarcodeScan(scanBuffer)
        scanBuffer = ''
        return
      }

      if (e.key.length === 1) {
        scanBuffer += e.key
        if (scanTimeout) clearTimeout(scanTimeout)
        scanTimeout = setTimeout(() => { scanBuffer = '' }, 100)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    loadItems()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (scanTimeout) clearTimeout(scanTimeout)
    }
  })

  function handleBarcodeScan(code: string) {
    // Search by SKU first, then by name
    const item = availableItems.find((i: any) =>
      (i.sku ?? '').toLowerCase() === code.toLowerCase() ||
      (i.sku ?? '') === code
    )
    if (item) {
      addToCart(item)
      scanFeedback = `${item.name} ajoute`
      setTimeout(() => { scanFeedback = '' }, 2000)
    } else {
      // Try partial match
      const partial = availableItems.find((i: any) =>
        (i.sku ?? '').includes(code) || i.name.toLowerCase().includes(code.toLowerCase())
      )
      if (partial) {
        addToCart(partial)
        scanFeedback = `${partial.name} ajoute`
        setTimeout(() => { scanFeedback = '' }, 2000)
      } else {
        scanFeedback = `Code "${code}" non trouve`
        setTimeout(() => { scanFeedback = '' }, 3000)
      }
    }
  }

  async function setCashFloat() {
    const val = parseFloat(cashFloatInput.replace(',', '.'))
    if (isNaN(val) || val < 0) return
    cashFloat = Math.round(val * 100)
    // Save to API (with localStorage fallback)
    try {
      await cashMovementsApi.create({ type: 'opening_float', amount: cashFloat })
    } catch {
      // Fallback to localStorage if offline
      localStorage.setItem(`caissette_cash_float_${todayKey}`, String(cashFloat))
    }
    showCashFloat = false
    cashFloatInput = ''
  }

  // Estimated cash in drawer
  let cashInDrawer = $derived(() => {
    // This is a rough estimate — cash float + cash sales today
    // We can't track all cash sales without API call, so just show the float
    return cashFloat
  })

  function saveFavorites() {
    localStorage.setItem('caissette_favorites', JSON.stringify([...favorites]))
  }

  function toggleFavorite(e: Event, itemId: string) {
    e.stopPropagation()
    if (favorites.has(itemId)) {
      favorites.delete(itemId)
    } else {
      favorites.add(itemId)
    }
    favorites = new Set(favorites)
    saveFavorites()
  }

  function trackUsage(itemId: string) {
    usageCount[itemId] = (usageCount[itemId] ?? 0) + 1
    usageCount = { ...usageCount }
    localStorage.setItem('caissette_usage', JSON.stringify(usageCount))
  }

  async function loadItems() {
    loading = true
    usingCache = false
    try {
      availableItems = await items.list('available')
      refreshItemsCache()
      localStorage.setItem('caissette_cache_refresh', String(Date.now()))
    } catch (e: any) {
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

    // Category filter
    if (selectedCategory) {
      result = result.filter((i: any) => i.category === selectedCategory)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (i: any) =>
          i.name.toLowerCase().includes(q) ||
          (i.sku ?? '').toLowerCase().includes(q) ||
          (i.category ?? '').toLowerCase().includes(q),
      )
    }

    if (sortMode === 'favorites') {
      result = [...result].sort((a, b) => {
        return (favorites.has(b.id) ? 1 : 0) - (favorites.has(a.id) ? 1 : 0)
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
      const commissionRate = 4000
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
    if (regime === 'deposit') return 'Depot'
    if (regime === 'normal') return 'TVA normale'
    return 'Marge'
  }

  // --- Discount functions ---
  function applyItemDiscount(index: number) {
    const val = parseFloat(discountInput.replace(',', '.'))
    if (isNaN(val) || val <= 0) { discountItemIndex = -1; return }
    const item = cart.items[index]
    if (!item) { discountItemIndex = -1; return }
    if (discountType === 'percent') {
      cart.setItemDiscount(index, Math.round(item.price * Math.min(val, 100) / 100))
    } else {
      cart.setItemDiscount(index, Math.round(Math.min(val, item.price / 100) * 100))
    }
    discountItemIndex = -1
    discountInput = ''
  }

  function applyGlobalDiscount() {
    const val = parseFloat(globalDiscountInput.replace(',', '.'))
    if (isNaN(val) || val <= 0) { showGlobalDiscount = false; return }
    if (globalDiscountType === 'percent') {
      cart.setGlobalDiscountPercent(Math.min(val, 100))
    } else {
      cart.setGlobalDiscountFixed(Math.round(val * 100))
    }
    showGlobalDiscount = false
    globalDiscountInput = ''
  }

  // --- Multi-payment functions ---
  function addPaymentSplit() {
    const amount = Math.round(parseFloat(multiPaymentInput.replace(',', '.')) * 100)
    if (isNaN(amount) || amount <= 0) return
    payments = [...payments, { method: multiPaymentMethod as any, amount }]
    multiPaymentInput = ''
  }

  function removePaymentSplit(index: number) {
    payments = payments.filter((_, i) => i !== index)
  }

  let multiPaymentRemaining = $derived(
    cart.total - payments.reduce((sum, p) => sum + p.amount, 0)
  )

  // --- Payment ---
  async function handlePayment() {
    if (cart.count === 0) return
    error = ''
    success = ''
    processing = true

    // Determine payment method and splits
    let finalPaymentMethod = paymentMethod
    let paymentSplits: PaymentSplit[] | undefined
    if (useMultiPayment && payments.length > 0) {
      finalPaymentMethod = 'multi'
      // Add remaining to last method if any
      if (multiPaymentRemaining > 0) {
        paymentSplits = [...payments, { method: multiPaymentMethod as any, amount: multiPaymentRemaining }]
      } else {
        paymentSplits = payments
      }
    }

    try {
      const result = await sales.create({
        cashierId: authStore.user!.id,
        paymentMethod: finalPaymentMethod,
        payments: paymentSplits,
        discountAmount: cart.globalDiscountAmount,
        items: cart.items.map((item: CartItem) => ({
          itemId: item.itemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          discount: item.discount ?? 0,
          type: item.type ?? 'product',
          depositorId: item.depositorId,
          vatRegime: item.vatRegime,
          vatRate: item.vatRate,
          commissionTtc: item.commissionTtc,
          reversementAmount: item.reversementAmount,
        })),
      })

      const totalPaid = cart.total
      success = `Vente #${result.receiptNumber} enregistree -- ${formatPrice(totalPaid)}`
      lastSaleId = result.id

      // Update cash float tracking
      if (paymentMethod === 'cash' || (useMultiPayment && payments.some(p => p.method === 'cash'))) {
        const cashAmount = useMultiPayment
          ? payments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
          : totalPaid
        cashFloat += cashAmount
        localStorage.setItem(`caissette_cash_float_${todayKey}`, String(cashFloat))
      }

      // Show change modal for cash payments
      if (paymentMethod === 'cash' && !useMultiPayment) {
        showChangeModal = true
        cashGiven = ''
      }

      cart.clear()
      payments = []
      useMultiPayment = false

      // Ticket impression opt-in (decret 2023)
      const autoPrint = localStorage.getItem('caissette_auto_print') === '1'
      if (autoPrint && lastSaleId) {
        printLastReceipt()
      } else if (lastSaleId) {
        showPrintToast = true
        if (printToastTimeout) clearTimeout(printToastTimeout)
        printToastTimeout = setTimeout(() => { showPrintToast = false }, 10000)
      }

      await loadItems()
    } catch (e: any) {
      if (!navigator.onLine || e.message?.includes('Failed to fetch') || e.message?.includes('Hors ligne')) {
        try {
          const total = cart.total
          await queueOfflineSale({
            tempId: crypto.randomUUID(),
            cashierId: authStore.user!.id,
            paymentMethod: finalPaymentMethod,
            items: cart.items.map((item: CartItem) => ({
              itemId: item.itemId,
              name: item.name,
              price: item.price - (item.discount ?? 0),
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
          payments = []
          useMultiPayment = false
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
        items: (sale.items ?? []).map((i: any) => ({ name: i.name, price: i.price, vatRate: i.vat_rate ?? i.vatRate ?? 0 })),
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
    { v: 'cash', l: 'Especes' },
    { v: 'card', l: 'Carte' },
    { v: 'check', l: 'Cheque' },
    { v: 'other', l: 'Autre' },
  ]

  const methodLabels: Record<string, string> = {
    cash: 'Especes', card: 'Carte', check: 'Cheque', transfer: 'Virement', other: 'Autre',
  }
</script>

<svelte:head>
  <title>Caisse — Caissette</title>
</svelte:head>

<div class="flex h-full flex-col lg:flex-row">
  <!-- Left panel: Catalog -->
  <div class="flex min-h-0 flex-1 flex-col bg-gray-50">
    <!-- Search bar + controls -->
    <div class="p-4 pb-2">
      <div class="flex items-center gap-2 mb-2">
        <SectionGuide
          title="Ecran de caisse"
          description="Cliquez sur un article pour l'ajouter au panier. Appliquez des remises, choisissez le paiement, puis encaissez."
          tips={['Chaque vente est horodatee et chainee cryptographiquement — elle ne peut pas etre modifiee', 'Le ticket n\'est imprime que si le client le demande (loi anti-gaspillage 2023)', 'Pensez a faire votre cloture Z en fin de journee', 'Le fond de caisse se parametre au debut de chaque journee', 'Multi-paiement : payez une partie en carte, le reste en especes', 'Filtrez par categorie avec les onglets']}
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

      <!-- Category tabs -->
      {#if categories().length > 0}
        <div class="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button onclick={() => selectedCategory = ''}
            class="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors
              {selectedCategory === '' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50'}">
            Toutes
          </button>
          {#each categories() as cat}
            <button onclick={() => selectedCategory = cat}
              class="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors
                {selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50'}">
              {cat}
            </button>
          {/each}
        </div>
      {/if}

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
        <div class="flex rounded-lg bg-white ring-1 ring-gray-200 overflow-hidden">
          <button
            onclick={() => { viewMode = 'grid'; localStorage.setItem('caissette_view_mode', 'grid') }}
            class="p-1.5 transition-colors {viewMode === 'grid' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-600'}"
            title="Grille"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </button>
          <button
            onclick={() => { viewMode = 'list'; localStorage.setItem('caissette_view_mode', 'list') }}
            class="p-1.5 transition-colors {viewMode === 'list' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-600'}"
            title="Liste"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </button>
          <button
            onclick={() => { viewMode = 'tiles'; localStorage.setItem('caissette_view_mode', 'tiles') }}
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
          <input type="text" bind:value={quickName} placeholder="Libelle (ex: Reparation)"
            class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          <input type="number" step="0.01" min="0" bind:value={quickPrice} placeholder="Prix EUR"
            class="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          <button onclick={addQuickItem} disabled={!quickName || !quickPrice}
            class="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
            Ajouter
          </button>
        </div>
      {/if}
    </div>

    <!-- Product grid -->
    <div class="flex-1 overflow-auto p-4 pt-2">
      {#if loading}
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
        <div class="flex flex-col items-center justify-center py-16 text-gray-400">
          <svg class="mb-3 h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 11.625l2.25-2.25M12 11.625l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p class="text-sm font-medium">Aucun article {selectedCategory ? `dans "${selectedCategory}"` : 'en vente'}</p>
          <p class="mt-1 text-xs text-gray-400">Ajoutez des articles depuis la page Articles</p>
        </div>
      {:else if viewMode === 'list'}
        <!-- LIST VIEW -->
        <div class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          {#each filteredItems() as item, idx}
            <div
              class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-blue-50 {idx > 0 ? 'border-t border-gray-100' : ''} {item.type === 'service' ? 'bg-purple-50/30' : ''}"
              onclick={() => addToCart(item)} onkeydown={(e) => { if (e.key === 'Enter') addToCart(item) }} role="button" tabindex="0"
            >
              <button onclick={(e) => toggleFavorite(e, item.id)}
                class="shrink-0 p-0.5 transition-colors {favorites.has(item.id) ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}" aria-label="Favori">
                <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clip-rule="evenodd" /></svg>
              </button>
              <span class="flex-1 truncate text-sm font-medium text-gray-900">{item.name}</span>
              {#if item.type === 'service'}
                <span class="shrink-0 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-700">Service</span>
              {/if}
              {#if item.category}
                <span class="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{item.category}</span>
              {/if}
              <span class="shrink-0 text-sm font-bold text-blue-600">{formatPrice(item.current_price ?? item.currentPrice)}</span>
            </div>
          {/each}
        </div>
      {:else if viewMode === 'tiles'}
        <!-- TILES VIEW -->
        <div class="grid grid-cols-2 gap-4">
          {#each filteredItems() as item}
            <div
              class="group relative rounded-2xl bg-white text-left shadow-sm transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer p-5 {item.type === 'service' ? 'ring-2 ring-purple-200' : ''} {favorites.has(item.id) ? 'ring-2 ring-amber-300' : ''}"
              onclick={() => addToCart(item)} onkeydown={(e) => { if (e.key === 'Enter') addToCart(item) }} role="button" tabindex="0"
            >
              <button onclick={(e) => toggleFavorite(e, item.id)}
                class="absolute top-3 right-3 p-1.5 rounded-full transition-colors {favorites.has(item.id) ? 'text-amber-400 hover:text-amber-500' : 'text-gray-200 hover:text-amber-300'}" aria-label="Favori">
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clip-rule="evenodd" /></svg>
              </button>
              {#if item.type === 'service'}
                <span class="mb-2 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold uppercase text-purple-700">Service</span>
              {/if}
              <div class="pr-8">
                <h3 class="text-base font-semibold text-gray-900 leading-tight">{item.name}</h3>
              </div>
              {#if item.category}
                <span class="mt-2 inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{item.category}</span>
              {/if}
              <div class="mt-3 flex items-end justify-between">
                <span class="text-2xl font-bold text-blue-600">{formatPrice(item.current_price ?? item.currentPrice)}</span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <!-- GRID VIEW -->
        <div class="grid gap-3 {shopStore.display.posColumns === 2 ? 'grid-cols-2' : shopStore.display.posColumns === 4 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3'}">
          {#each filteredItems() as item}
            <div
              class="group relative rounded-xl bg-white text-left shadow-sm transition-shadow hover:shadow-md cursor-pointer {shopStore.display.posCompactCards ? 'p-3' : 'p-4'} {item.type === 'service' ? 'ring-1 ring-purple-200' : ''} {favorites.has(item.id) ? 'ring-1 ring-amber-300' : ''}"
              onclick={() => addToCart(item)} onkeydown={(e) => { if (e.key === 'Enter') addToCart(item) }} role="button" tabindex="0"
            >
              <button onclick={(e) => toggleFavorite(e, item.id)}
                class="absolute top-2 right-2 p-1 rounded-full transition-colors {favorites.has(item.id) ? 'text-amber-400 hover:text-amber-500' : 'text-gray-200 hover:text-amber-300'}" aria-label="Favori">
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clip-rule="evenodd" /></svg>
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
  <div class="flex w-full flex-col border-t bg-white max-h-[50vh] lg:max-h-none lg:w-[380px] lg:border-l lg:border-t-0 xl:w-[420px]">
    <!-- Cart header -->
    <div class="flex items-center justify-between border-b px-5 py-4">
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-bold text-gray-900">Panier</h2>
        {#if cart.count > 0}
          <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-semibold text-blue-700">
            {cart.count}
          </span>
        {/if}
      </div>
      <div class="flex items-center gap-3">
        <!-- Cash float button -->
        <button
          onclick={() => showCashFloat = !showCashFloat}
          class="text-xs font-medium transition-colors {cashFloat > 0 ? 'text-green-600' : 'text-gray-400 hover:text-green-500'}"
          title="Fond de caisse"
        >
          {#if cashFloat > 0}
            Caisse: {formatPrice(cashFloat)}
          {:else}
            Fond de caisse
          {/if}
        </button>
        {#if cart.count > 0}
          <button
            onclick={() => showGlobalDiscount = !showGlobalDiscount}
            class="text-xs font-medium transition-colors {cart.totalDiscount > 0 ? 'text-red-600' : 'text-gray-400 hover:text-blue-600'}"
            title="Remise globale"
          >
            {#if cart.totalDiscount > 0}
              -{formatPrice(cart.totalDiscount)}
            {:else}
              % Remise
            {/if}
          </button>
        {/if}
      </div>
    </div>

    <!-- Scan feedback -->
    {#if scanFeedback}
      <div class="mx-5 mt-2 rounded-lg px-3 py-2 text-xs font-medium {scanFeedback.includes('non trouve') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}">
        {scanFeedback}
      </div>
    {/if}

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

    <!-- Cash float form -->
    {#if showCashFloat}
      <div class="mx-5 mt-3 rounded-lg bg-green-50 border border-green-200 p-3">
        <div class="text-xs font-semibold text-green-700 mb-2">Fond de caisse (especes en caisse)</div>
        <div class="flex gap-2">
          <input type="text" inputmode="decimal" bind:value={cashFloatInput}
            placeholder="Montant en EUR"
            class="flex-1 rounded-lg border border-green-200 px-3 py-1.5 text-sm focus:border-green-400 focus:outline-none"
            onkeydown={(e) => { if (e.key === 'Enter') setCashFloat() }}
          />
          <button onclick={setCashFloat}
            class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
            OK
          </button>
          {#if cashFloat > 0}
            <button onclick={() => { cashFloat = 0; localStorage.removeItem(`caissette_cash_float_${todayKey}`); showCashFloat = false }}
              class="rounded-lg bg-gray-100 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-200" title="Remettre a zero">
              RAZ
            </button>
          {/if}
        </div>
        {#if cashFloat > 0}
          <div class="mt-2 text-xs text-green-600">Actuellement : <span class="font-semibold">{formatPrice(cashFloat)}</span></div>
        {/if}
      </div>
    {/if}

    <!-- Global discount form -->
    {#if showGlobalDiscount}
      <div class="mx-5 mt-3 rounded-lg bg-red-50 border border-red-200 p-3">
        <div class="text-xs font-semibold text-red-700 mb-2">Remise globale</div>
        <div class="flex gap-2">
          <div class="flex rounded-lg overflow-hidden ring-1 ring-red-200">
            <button onclick={() => globalDiscountType = 'percent'}
              class="px-2 py-1.5 text-xs font-medium {globalDiscountType === 'percent' ? 'bg-red-600 text-white' : 'bg-white text-red-600'}">%</button>
            <button onclick={() => globalDiscountType = 'fixed'}
              class="px-2 py-1.5 text-xs font-medium {globalDiscountType === 'fixed' ? 'bg-red-600 text-white' : 'bg-white text-red-600'}">EUR</button>
          </div>
          <input type="text" inputmode="decimal" bind:value={globalDiscountInput}
            placeholder={globalDiscountType === 'percent' ? 'Ex: 10' : 'Ex: 5,00'}
            class="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm focus:border-red-400 focus:outline-none"
            onkeydown={(e) => { if (e.key === 'Enter') applyGlobalDiscount() }}
          />
          <button onclick={applyGlobalDiscount}
            class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
            OK
          </button>
          {#if cart.globalDiscountPercent > 0 || cart.globalDiscountFixed > 0}
            <button onclick={() => cart.clearGlobalDiscount()}
              class="rounded-lg bg-gray-100 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-200" title="Annuler">
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Cart items -->
    <div class="flex-1 overflow-auto px-5 py-4">
      {#if cart.count === 0}
        <p class="py-8 text-center text-sm text-gray-400">Panier vide</p>
      {:else}
        <ul class="space-y-1">
          {#each cart.items as item, i}
            <li class="py-2">
              <div class="flex items-center justify-between">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-gray-900">{item.name}</div>
                  <div class="flex items-center gap-2 mt-0.5">
                    {#if shopStore.hasDepositSale}
                      <span class="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        {vatLabel(item.vatRegime)}
                      </span>
                    {/if}
                    <!-- Quantity controls -->
                    <div class="flex items-center gap-0.5">
                      <button onclick={() => cart.decrementQuantity(i)}
                        class="flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors">-</button>
                      <span class="min-w-[1.5rem] text-center text-xs font-semibold text-gray-700">{item.quantity}</span>
                      <button onclick={() => cart.incrementQuantity(i)}
                        class="flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors">+</button>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2 pl-3">
                  <!-- Per-item discount button -->
                  <button
                    onclick={() => { discountItemIndex = discountItemIndex === i ? -1 : i; discountInput = '' }}
                    class="text-[10px] font-medium transition-colors {item.discount ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}"
                    title="Remise"
                  >
                    {#if item.discount}
                      -{formatPrice(item.discount)}/u
                    {:else}
                      %
                    {/if}
                  </button>
                  <div class="text-right">
                    {#if item.discount}
                      <span class="text-xs text-gray-400 line-through">{formatPrice(item.price * item.quantity)}</span>
                      <span class="text-sm font-semibold text-red-600">{formatPrice((item.price - item.discount) * item.quantity)}</span>
                    {:else}
                      <span class="text-sm font-semibold text-gray-900">
                        {formatPrice(item.price * item.quantity)}
                        {#if item.quantity > 1}<span class="text-[10px] text-gray-400 font-normal ml-0.5">({formatPrice(item.price)}/u)</span>{/if}
                      </span>
                    {/if}
                  </div>
                  <button onclick={() => cart.remove(i)}
                    class="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    aria-label="Retirer">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <!-- Inline discount input -->
              {#if discountItemIndex === i}
                <div class="mt-1.5 flex gap-1.5">
                  <div class="flex rounded-lg overflow-hidden ring-1 ring-gray-200">
                    <button onclick={() => discountType = 'percent'}
                      class="px-2 py-1 text-[10px] font-medium {discountType === 'percent' ? 'bg-red-600 text-white' : 'bg-white text-gray-500'}">%</button>
                    <button onclick={() => discountType = 'fixed'}
                      class="px-2 py-1 text-[10px] font-medium {discountType === 'fixed' ? 'bg-red-600 text-white' : 'bg-white text-gray-500'}">EUR</button>
                  </div>
                  <input type="text" inputmode="decimal" bind:value={discountInput}
                    placeholder={discountType === 'percent' ? '10' : '5,00'}
                    class="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-red-400 focus:outline-none"
                    onkeydown={(e) => { if (e.key === 'Enter') applyItemDiscount(i) }}
                  />
                  <button onclick={() => applyItemDiscount(i)}
                    class="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-red-700">OK</button>
                  {#if item.discount}
                    <button onclick={() => { cart.setItemDiscount(i, 0); discountItemIndex = -1 }}
                      class="text-[10px] text-gray-400 hover:text-gray-600">Annuler</button>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Payment footer -->
    <div class="border-t px-5 py-4">
      <!-- Totals -->
      {#if cart.totalDiscount > 0}
        <div class="mb-1 flex items-baseline justify-between">
          <span class="text-xs text-gray-400">Sous-total</span>
          <span class="text-sm text-gray-400">{formatPrice(cart.subtotal)}</span>
        </div>
        <div class="mb-1 flex items-baseline justify-between">
          <span class="text-xs text-red-500">Remise</span>
          <span class="text-sm font-medium text-red-500">-{formatPrice(cart.totalDiscount)}</span>
        </div>
      {/if}
      <div class="mb-4 flex items-baseline justify-between">
        <span class="text-sm font-medium text-gray-500">Total TTC</span>
        <span class="text-2xl font-bold text-gray-900">{formatPrice(cart.total)}</span>
      </div>

      <hr class="mb-4 border-gray-100" />

      <!-- Payment method -->
      {#if !useMultiPayment}
        <div class="mb-3 grid grid-cols-2 gap-2">
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
      {/if}

      <!-- Multi-payment toggle -->
      <div class="mb-3">
        <button
          onclick={() => { useMultiPayment = !useMultiPayment; payments = [] }}
          class="text-xs font-medium transition-colors {useMultiPayment ? 'text-blue-600' : 'text-gray-400 hover:text-blue-500'}"
        >
          {useMultiPayment ? 'Annuler multi-paiement' : 'Multi-paiement'}
        </button>
      </div>

      <!-- Multi-payment splits -->
      {#if useMultiPayment}
        <div class="mb-3 space-y-2">
          {#each payments as payment, idx}
            <div class="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm">
              <span class="font-medium text-blue-800">{methodLabels[payment.method]}</span>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-blue-900">{formatPrice(payment.amount)}</span>
                <button onclick={() => removePaymentSplit(idx)} class="text-blue-400 hover:text-red-500">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          {/each}

          {#if multiPaymentRemaining > 0}
            <div class="flex gap-2">
              <select bind:value={multiPaymentMethod}
                class="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
                {#each paymentOptions as opt}
                  <option value={opt.v}>{opt.l}</option>
                {/each}
              </select>
              <input type="text" inputmode="decimal" bind:value={multiPaymentInput}
                placeholder={`Max ${(multiPaymentRemaining / 100).toFixed(2)}`}
                class="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                onkeydown={(e) => { if (e.key === 'Enter') addPaymentSplit() }}
              />
              <button onclick={addPaymentSplit}
                class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">+</button>
            </div>
            <div class="text-xs text-gray-500">
              Reste a repartir : <span class="font-semibold">{formatPrice(multiPaymentRemaining)}</span>
            </div>
          {:else}
            <div class="text-xs font-medium text-green-600">Montant entierement reparti</div>
          {/if}
        </div>
      {/if}

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

<!-- Change calculator modal -->
{#if showChangeModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={() => showChangeModal = false}>
    <div class="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-bold text-gray-900 mb-1">Rendu monnaie</h2>
      <p class="text-sm text-gray-500 mb-4">{success}</p>

      <div class="mb-4">
        <label for="cash-given" class="block text-sm font-medium text-gray-700 mb-1">Montant donne par le client</label>
        <div class="relative">
          <input
            type="text"
            inputmode="decimal"
            id="cash-given"
            bind:value={cashGiven}
            placeholder="0,00"
            class="w-full rounded-xl border border-gray-300 px-4 py-3 text-2xl font-bold text-center focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
          />
          <span class="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-gray-400">EUR</span>
        </div>
      </div>

      {#if cashGiven && changeAmount >= 0}
        <div class="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <div class="text-sm text-green-700 mb-1">A rendre</div>
          <div class="text-3xl font-bold text-green-800">{formatPrice(changeAmount)}</div>
        </div>
      {:else if cashGiven && changeAmount < 0}
        <div class="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
          <div class="text-sm text-red-700 mb-1">Montant insuffisant</div>
          <div class="text-xl font-bold text-red-800">Il manque {formatPrice(Math.abs(changeAmount))}</div>
        </div>
      {/if}

      <!-- Quick cash buttons -->
      <div class="mt-4 grid grid-cols-4 gap-2">
        {#each [5, 10, 20, 50] as amount}
          <button
            onclick={() => cashGiven = String(amount)}
            class="rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {amount} EUR
          </button>
        {/each}
      </div>

      <button onclick={() => showChangeModal = false}
        class="mt-4 w-full rounded-xl bg-gray-800 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 transition-colors">
        Fermer
      </button>
    </div>
  </div>
{/if}

<!-- Print toast (ticket opt-in) -->
{#if showPrintToast}
  <div class="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-gray-900 px-5 py-3.5 text-white shadow-xl animate-slide-up">
    <svg class="h-5 w-5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
    <span class="text-sm font-medium">Vente enregistree</span>
    <button
      onclick={() => { showPrintToast = false; printLastReceipt() }}
      disabled={printing}
      class="ml-2 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/30 transition-colors disabled:opacity-50"
    >
      {printing ? 'Impression...' : 'Imprimer le ticket'}
    </button>
    <button onclick={() => showPrintToast = false} class="ml-1 text-gray-400 hover:text-white transition-colors">
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
{/if}

<style>
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  :global(.animate-slide-up) {
    animation: slide-up 250ms ease-out both;
  }
</style>
