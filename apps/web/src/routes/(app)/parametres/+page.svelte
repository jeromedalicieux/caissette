<script lang="ts">
  import { shops } from '$lib/api/client'
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
      success = 'Paramètres enregistrés.'
    } catch (e: any) {
      error = e.message
    }
    saving = false
  }
</script>

<svelte:head>
  <title>Paramètres — Rebond</title>
</svelte:head>

<div class="p-6">
  <h1 class="mb-6 text-2xl font-bold text-gray-900">Paramètres de la boutique</h1>

  {#if loading}
    <p class="text-gray-500">Chargement...</p>
  {:else}
    {#if error}
      <div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
    {/if}
    {#if success}
      <div class="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleSave() }}
      class="max-w-2xl rounded-xl bg-white p-6 shadow-sm">
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2">
          <label for="shop-name" class="block text-sm font-medium text-gray-700">Nom de la boutique</label>
          <input type="text" id="shop-name" bind:value={name} required
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label for="shop-siret" class="block text-sm font-medium text-gray-700">SIRET</label>
          <input type="text" id="shop-siret" bind:value={siret}
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label for="shop-phone" class="block text-sm font-medium text-gray-700">Téléphone</label>
          <input type="tel" id="shop-phone" bind:value={phone}
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label for="shop-email" class="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" id="shop-email" bind:value={email}
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label for="shop-vat" class="block text-sm font-medium text-gray-700">Régime TVA</label>
          <select id="shop-vat" bind:value={vatRegime}
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="margin">TVA sur marge</option>
            <option value="normal">TVA normale</option>
          </select>
        </div>
        <div class="col-span-2">
          <label for="shop-address" class="block text-sm font-medium text-gray-700">Adresse</label>
          <input type="text" id="shop-address" bind:value={address}
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <button type="submit" disabled={saving}
        class="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  {/if}
</div>
