<script lang="ts">
  import { items, sales } from '$lib/api/client'
  import { cart, type CartItem } from '$lib/stores/cart.svelte'
  import { authStore } from '$lib/stores/auth.svelte'
  import { onMount } from 'svelte'

  let availableItems = $state<any[]>([])
  let search = $state('')
  let paymentMethod = $state('cash')
  let error = $state('')
  let success = $state('')
  let processing = $state(false)
  let loading = $state(true)

  onMount(loadItems)

  async function loadItems() {
    loading = true
    try {
      availableItems = await items.list('available')
    } catch (e: any) {
      error = e.message
    }
    loading = false
  }

  function filteredItems() {
    if (!search) return availableItems
    const q = search.toLowerCase()
    return availableItems.filter(
      (i: any) =>
        i.name.toLowerCase().includes(q) ||
        (i.sku ?? '').toLowerCase().includes(q) ||
        (i.category ?? '').toLowerCase().includes(q),
    )
  }

  function addToCart(item: any) {
    const commissionRate = 4000 // 40% default, TODO: from depositor/contract
    const commissionTtc = item.depositor_id
      ? Math.round((item.current_price ?? item.currentPrice) * commissionRate / 10000)
      : undefined

    cart.add({
      itemId: item.id,
      name: item.name,
      price: item.current_price ?? item.currentPrice,
      depositorId: item.depositor_id ?? item.depositorId,
      vatRegime: item.vat_regime ?? item.vatRegime ?? 'deposit',
      vatRate: item.vat_rate ?? item.vatRate ?? 2000,
      commissionTtc,
      reversementAmount: commissionTtc
        ? (item.current_price ?? item.currentPrice) - commissionTtc
        : undefined,
    })

    // Remove from available list
    availableItems = availableItems.filter((i: any) => i.id !== item.id)
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
          depositorId: item.depositorId,
          vatRegime: item.vatRegime,
          vatRate: item.vatRate,
          commissionTtc: item.commissionTtc,
          reversementAmount: item.reversementAmount,
        })),
      })

      success = `Vente #${result.receiptNumber} enregistr\u00E9e -- ${formatPrice(cart.total)}`
      cart.clear()
      await loadItems()
    } catch (e: any) {
      error = e.message
    }
    processing = false
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
    <!-- Search bar -->
    <div class="p-4 pb-2">
      <div class="relative">
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
        </div>
      {:else}
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {#each filteredItems() as item}
            <button
              onclick={() => addToCart(item)}
              class="group rounded-xl bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div class="truncate text-sm font-medium text-gray-900">{item.name}</div>
              {#if item.category}
                <span class="mt-1.5 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{item.category}</span>
              {/if}
              <div class="mt-2 flex items-end justify-between">
                <span class="text-xs text-gray-400">{item.sku ?? ''}</span>
                <span class="text-lg font-semibold text-blue-600">{formatPrice(item.current_price ?? item.currentPrice)}</span>
              </div>
            </button>
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
                <span class="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  {vatLabel(item.vatRegime)}
                </span>
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
