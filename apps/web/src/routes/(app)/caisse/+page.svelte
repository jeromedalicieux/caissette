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

  onMount(loadItems)

  async function loadItems() {
    try {
      availableItems = await items.list('available')
    } catch (e: any) {
      error = e.message
    }
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
    return (cents / 100).toFixed(2).replace('.', ',') + ' €'
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

      success = `Vente #${result.receiptNumber} enregistrée — ${formatPrice(cart.total)}`
      cart.clear()
      await loadItems()
    } catch (e: any) {
      error = e.message
    }
    processing = false
  }
</script>

<svelte:head>
  <title>Caisse — Rebond</title>
</svelte:head>

<div class="flex h-[calc(100vh)] gap-0">
  <!-- Left: Article search & selection -->
  <div class="flex w-1/2 flex-col border-r">
    <div class="border-b p-4">
      <input type="text" bind:value={search} placeholder="Rechercher un article (nom, code-barre...)"
        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm" />
    </div>

    <div class="flex-1 overflow-auto p-4">
      {#if filteredItems().length === 0}
        <p class="text-center text-gray-400">Aucun article trouvé</p>
      {:else}
        <div class="grid grid-cols-2 gap-2">
          {#each filteredItems() as item}
            <button onclick={() => addToCart(item)}
              class="rounded-lg border bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50">
              <div class="text-sm font-medium text-gray-900 truncate">{item.name}</div>
              <div class="mt-1 flex items-center justify-between">
                <span class="text-xs text-gray-500">{item.sku ?? ''}</span>
                <span class="font-semibold text-blue-600">{formatPrice(item.current_price ?? item.currentPrice)}</span>
              </div>
              {#if item.category}
                <span class="mt-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{item.category}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Right: Cart & Payment -->
  <div class="flex w-1/2 flex-col bg-white">
    <div class="border-b p-4">
      <h2 class="text-lg font-bold text-gray-900">Panier</h2>
    </div>

    <div class="flex-1 overflow-auto p-4">
      {#if error}
        <div class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      {/if}
      {#if success}
        <div class="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
      {/if}

      {#if cart.count === 0}
        <p class="text-center text-gray-400">Panier vide</p>
      {:else}
        <div class="space-y-2">
          {#each cart.items as item, i}
            <div class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <div class="flex-1">
                <div class="text-sm font-medium">{item.name}</div>
                <div class="text-xs text-gray-500">
                  {item.vatRegime === 'deposit' ? 'Dépôt' : item.vatRegime === 'normal' ? 'TVA normale' : 'Marge'}
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="font-semibold">{formatPrice(item.price)}</span>
                <button onclick={() => cart.remove(i)} class="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Payment footer -->
    <div class="border-t bg-gray-50 p-4">
      <div class="mb-4 flex items-center justify-between text-xl font-bold">
        <span>Total TTC</span>
        <span class="text-blue-700">{formatPrice(cart.total)}</span>
      </div>

      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-gray-700">Mode de paiement</label>
        <div class="flex gap-2">
          {#each [{ v: 'cash', l: 'Espèces' }, { v: 'card', l: 'CB' }, { v: 'check', l: 'Chèque' }, { v: 'other', l: 'Autre' }] as opt}
            <button onclick={() => paymentMethod = opt.v}
              class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors
                {paymentMethod === opt.v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}">
              {opt.l}
            </button>
          {/each}
        </div>
      </div>

      <button onclick={handlePayment} disabled={cart.count === 0 || processing}
        class="w-full rounded-lg bg-green-600 px-4 py-3 text-lg font-bold text-white hover:bg-green-700 disabled:opacity-50">
        {processing ? 'Traitement...' : `Encaisser ${formatPrice(cart.total)}`}
      </button>
    </div>
  </div>
</div>
