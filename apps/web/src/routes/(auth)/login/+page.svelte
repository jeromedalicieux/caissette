<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte'
  import { shops } from '$lib/api/client'
  import { goto } from '$app/navigation'

  let mode: 'login' | 'register' | 'onboarding' = $state('login')
  let email = $state('')
  let password = $state('')
  let name = $state('')
  let shopName = $state('')
  let siret = $state('')
  let address = $state('')
  let shopId = $state(localStorage.getItem('rebond_shop_id') ?? '')
  let error = $state('')
  let submitting = $state(false)

  async function handleLogin() {
    if (!shopId) { error = 'ID boutique requis'; return }
    error = ''
    submitting = true
    try {
      await authStore.login(email, password, shopId)
      goto('/caisse')
    } catch (e: any) {
      error = e.message
    }
    submitting = false
  }

  async function handleRegister() {
    if (!shopId) { error = 'Créez d\'abord une boutique'; return }
    error = ''
    submitting = true
    try {
      await authStore.register(name, email, password, shopId)
      goto('/caisse')
    } catch (e: any) {
      error = e.message
    }
    submitting = false
  }

  async function handleOnboarding() {
    error = ''
    submitting = true
    try {
      const shop = await shops.create({ name: shopName, siret, address })
      shopId = shop.id
      localStorage.setItem('rebond_shop_id', shop.id)
      await authStore.register(name, email, password, shop.id)
      goto('/caisse')
    } catch (e: any) {
      error = e.message
    }
    submitting = false
  }
</script>

<svelte:head>
  <title>Connexion — Rebond</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-gray-50">
  <div class="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
    <h1 class="mb-2 text-2xl font-bold text-gray-900">Rebond</h1>
    <p class="mb-6 text-sm text-gray-500">Caisse dépôt-vente</p>

    {#if error}
      <div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
    {/if}

    <!-- Tabs -->
    <div class="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
      <button class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium {mode === 'login' ? 'bg-white shadow' : ''}" onclick={() => mode = 'login'}>Connexion</button>
      <button class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium {mode === 'onboarding' ? 'bg-white shadow' : ''}" onclick={() => mode = 'onboarding'}>Nouvelle boutique</button>
    </div>

    {#if mode === 'login'}
      <form onsubmit={(e) => { e.preventDefault(); handleLogin() }} class="space-y-4">
        <div>
          <label for="shopId" class="block text-sm font-medium text-gray-700">ID Boutique</label>
          <input type="text" id="shopId" bind:value={shopId} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" id="email" bind:value={email} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">Mot de passe</label>
          <input type="password" id="password" bind:value={password} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={submitting} class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {submitting ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

    {:else}
      <form onsubmit={(e) => { e.preventDefault(); handleOnboarding() }} class="space-y-4">
        <div>
          <label for="shopName" class="block text-sm font-medium text-gray-700">Nom de la boutique</label>
          <input type="text" id="shopName" bind:value={shopName} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Ma Boutique" />
        </div>
        <div>
          <label for="siret" class="block text-sm font-medium text-gray-700">SIRET</label>
          <input type="text" id="siret" bind:value={siret} required pattern="\\d{14}" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="12345678901234" />
        </div>
        <div>
          <label for="address" class="block text-sm font-medium text-gray-700">Adresse</label>
          <input type="text" id="address" bind:value={address} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <hr class="my-2" />
        <div>
          <label for="name2" class="block text-sm font-medium text-gray-700">Votre nom</label>
          <input type="text" id="name2" bind:value={name} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label for="email2" class="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" id="email2" bind:value={email} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label for="password2" class="block text-sm font-medium text-gray-700">Mot de passe</label>
          <input type="password" id="password2" bind:value={password} required minlength="8" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={submitting} class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {submitting ? 'Création...' : 'Créer ma boutique'}
        </button>
      </form>
    {/if}
  </div>
</main>
