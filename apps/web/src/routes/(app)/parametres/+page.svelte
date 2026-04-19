<script lang="ts">
  import { shops } from '$lib/api/client'
  import { shopStore } from '$lib/stores/shop.svelte'
  import { onMount } from 'svelte'

  let loading = $state(true)
  let saving = $state(false)
  let error = $state('')
  let success = $state('')

  let name = $state('')
  let siret = $state('')
  let address = $state('')
  let phone = $state('')
  let email = $state('')
  let vatRegime = $state('margin')
  let togglingDeposit = $state(false)

  onMount(async () => {
    try {
      const shop = await shops.getCurrent()
      name = shop.name ?? ''
      siret = shop.siret ?? ''
      address = shop.address ?? ''
      phone = shop.phone ?? ''
      email = shop.email ?? ''
      vatRegime = shop.vat_regime ?? shop.vatRegime ?? 'margin'
    } catch (e: any) {
      error = e.message
    }
    loading = false
  })

  async function handleSave() {
    error = ''
    success = ''
    saving = true
    try {
      await shops.updateCurrent({ name, siret, address, phone, email, vatRegime })
      success = 'Parametres enregistres.'
    } catch (e: any) {
      error = e.message
    }
    saving = false
  }

  async function toggleDepositSale() {
    togglingDeposit = true
    error = ''
    try {
      const newValue = !shopStore.hasDepositSale
      await shopStore.updateSettings({ features: { depositSale: newValue } })
      success = newValue ? 'Module depot-vente active.' : 'Module depot-vente desactive.'
    } catch (e: any) {
      error = e.message
    }
    togglingDeposit = false
  }
</script>

<svelte:head>
  <title>Parametres -- Rebond</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Parametres de la boutique</h1>
    <p class="text-sm text-gray-500 mt-1">Configuration generale de votre espace de vente</p>
  </div>

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else}
    {#if error}
      <div class="mb-4 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
    {/if}
    {#if success}
      <div class="mb-4 rounded-lg bg-green-50 border border-green-100 p-4 text-sm text-green-700">{success}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleSave() }}
      class="max-w-2xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Informations de la boutique</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div class="sm:col-span-2">
          <label for="shop-name" class="block text-sm font-medium text-gray-700 mb-1.5">Nom de la boutique</label>
          <input type="text" id="shop-name" bind:value={name} required
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label for="shop-siret" class="block text-sm font-medium text-gray-700 mb-1.5">SIRET</label>
          <input type="text" id="shop-siret" bind:value={siret}
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label for="shop-phone" class="block text-sm font-medium text-gray-700 mb-1.5">Telephone</label>
          <input type="tel" id="shop-phone" bind:value={phone}
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label for="shop-email" class="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input type="email" id="shop-email" bind:value={email}
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label for="shop-vat" class="block text-sm font-medium text-gray-700 mb-1.5">Regime TVA</label>
          <select id="shop-vat" bind:value={vatRegime}
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="margin">TVA sur marge</option>
            <option value="normal">TVA normale</option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <label for="shop-address" class="block text-sm font-medium text-gray-700 mb-1.5">Adresse</label>
          <input type="text" id="shop-address" bind:value={address}
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
      </div>
      <div class="mt-6 flex justify-end">
        <button type="submit" disabled={saving}
          class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>

    <!-- Modules -->
    <div class="mt-8 max-w-2xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-1">Modules</h2>
      <p class="text-sm text-gray-500 mb-5">Activez ou desactivez les fonctionnalites optionnelles</p>

      <div class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-4">
        <div>
          <div class="text-sm font-medium text-gray-900">Depot-vente</div>
          <div class="text-xs text-gray-500 mt-0.5">Gestion des deposants, contrats, commissions et livre de police</div>
        </div>
        <button
          onclick={toggleDepositSale}
          disabled={togglingDeposit}
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 disabled:opacity-50
            {shopStore.hasDepositSale ? 'bg-blue-600' : 'bg-gray-200'}"
          role="switch"
          aria-checked={shopStore.hasDepositSale}
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200
              {shopStore.hasDepositSale ? 'translate-x-5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>
    </div>
  {/if}
</div>
