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
  let shopId = $state(localStorage.getItem('caissette_shop_id') ?? '')

  function fillDemo() {
    shopId = '019da1b8-2037-78cd-a172-f2fb78276c1a'
    email = 'demo@caissette.fr'
    password = 'demo1234'
    mode = 'login'
    error = ''
  }
  let error = $state('')
  let submitting = $state(false)

  async function handleLogin() {
    if (!shopId) { error = 'ID boutique requis'; return }
    error = ''
    submitting = true
    try {
      await authStore.login(email, password, shopId)
      goto('/dashboard')
    } catch (e: any) {
      error = e.message
    }
    submitting = false
  }

  async function handleRegister() {
    if (!shopId) { error = 'Creez d\'abord une boutique'; return }
    error = ''
    submitting = true
    try {
      await authStore.register(name, email, password, shopId)
      goto('/dashboard')
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
      localStorage.setItem('caissette_shop_id', shop.id)
      await authStore.register(name, email, password, shop.id)
      goto('/dashboard')
    } catch (e: any) {
      error = e.message
    }
    submitting = false
  }

  const tabs = [
    { id: 'login' as const, label: 'Connexion' },
    { id: 'register' as const, label: 'Inscription' },
    { id: 'onboarding' as const, label: 'Nouvelle boutique' },
  ]

  const features = [
    { title: 'Encaissement rapide', desc: 'Interface de caisse intuitive, multi-paiements, ticket instantane', icon: 'cash' },
    { title: 'Conforme NF525', desc: 'Clotures Z, export FEC, attestation — conformite legale integree', icon: 'shield' },
    { title: 'Tableau de bord', desc: 'CA en temps reel, top articles, repartition des paiements', icon: 'chart' },
    { title: 'Mode depot-vente', desc: 'Module optionnel : deposants, contrats, commissions, reversements', icon: 'users' },
  ]
</script>

<svelte:head>
  <title>Connexion — Caissette</title>
</svelte:head>

<main class="flex min-h-screen">
  <!-- Brand panel — hidden on mobile -->
  <div class="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white flex-col justify-between p-12 relative overflow-hidden">
    <!-- Decorative circles -->
    <div class="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5"></div>
    <div class="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-white/5"></div>

    <div class="relative">
      <div class="flex items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
          <span class="text-xl font-bold">C</span>
        </div>
        <div>
          <h1 class="text-3xl font-bold tracking-tight">Caissette</h1>
          <p class="text-sm text-blue-200">Logiciel de caisse simple et conforme</p>
        </div>
      </div>
    </div>

    <div class="relative space-y-5">
      {#each features as feature}
        <div class="flex items-start gap-4 rounded-xl bg-white/5 backdrop-blur-sm p-4 transition-all hover:bg-white/10">
          <div class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
            <svg class="h-5 w-5 text-blue-100" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <p class="font-semibold text-white">{feature.title}</p>
            <p class="text-sm text-blue-200/80">{feature.desc}</p>
          </div>
        </div>
      {/each}
    </div>

    <p class="relative text-xs text-blue-300/60">Caissette — Caisse certifiee NF525</p>
  </div>

  <!-- Form panel -->
  <div class="flex w-full flex-col items-center justify-center bg-white px-6 py-12 lg:w-1/2 xl:w-[45%]">
    <!-- Mobile-only brand header -->
    <div class="mb-8 text-center lg:hidden">
      <h1 class="text-3xl font-bold text-gray-900">Caissette</h1>
      <p class="mt-1 text-sm text-gray-500">Logiciel de caisse simple et conforme</p>
    </div>

    <div class="w-full max-w-sm">
      <!-- Error banner -->
      {#if error}
        <div class="mb-6 flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 transition-all duration-200">
          <svg class="h-5 w-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      {/if}

      <!-- Tab switcher -->
      <div class="mb-8 flex rounded-lg bg-gray-100 p-1">
        {#each tabs as tab}
          <button
            type="button"
            class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 {mode === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
            onclick={() => { mode = tab.id; error = '' }}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <!-- Login form -->
      {#if mode === 'login'}
        <form onsubmit={(e) => { e.preventDefault(); handleLogin() }} class="space-y-5">
          <div>
            <label for="shopId" class="block text-sm font-medium text-gray-700 mb-1.5">ID Boutique</label>
            <input
              type="text"
              id="shopId"
              bind:value={shopId}
              required
              class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
              placeholder="ex: shop_abc123"
            />
          </div>
          <div>
            <label for="login-email" class="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              id="login-email"
              bind:value={email}
              required
              class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
              placeholder="vous@exemple.fr"
            />
          </div>
          <div>
            <label for="login-password" class="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
            <input
              type="password"
              id="login-password"
              bind:value={password}
              required
              class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
              placeholder="Votre mot de passe"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {submitting ? 'Connexion en cours...' : 'Se connecter'}
          </button>

          <div class="relative my-4">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200"></div></div>
            <div class="relative flex justify-center text-xs"><span class="bg-white px-2 text-gray-400">ou</span></div>
          </div>

          <button
            type="button"
            onclick={fillDemo}
            class="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-150"
          >
            Essayer avec le compte demo
          </button>
        </form>

      <!-- Register form -->
      {:else if mode === 'register'}
        <form onsubmit={(e) => { e.preventDefault(); handleRegister() }} class="space-y-5">
          <div>
            <label for="reg-shopId" class="block text-sm font-medium text-gray-700 mb-1.5">ID Boutique</label>
            <input
              type="text"
              id="reg-shopId"
              bind:value={shopId}
              required
              class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
              placeholder="ID fourni par le gerant"
            />
          </div>
          <div>
            <label for="reg-name" class="block text-sm font-medium text-gray-700 mb-1.5">Votre nom</label>
            <input
              type="text"
              id="reg-name"
              bind:value={name}
              required
              class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
              placeholder="Jean Dupont"
            />
          </div>
          <div>
            <label for="reg-email" class="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              id="reg-email"
              bind:value={email}
              required
              class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
              placeholder="vous@exemple.fr"
            />
          </div>
          <div>
            <label for="reg-password" class="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
            <input
              type="password"
              id="reg-password"
              bind:value={password}
              required
              minlength="8"
              class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
              placeholder="8 caracteres minimum"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {submitting ? 'Inscription...' : 'S\'inscrire'}
          </button>
        </form>

      <!-- Onboarding form -->
      {:else}
        <form onsubmit={(e) => { e.preventDefault(); handleOnboarding() }} class="space-y-5">
          <fieldset class="space-y-4">
            <legend class="text-sm font-semibold text-gray-900 mb-1">Informations boutique</legend>
            <div>
              <label for="ob-shopName" class="block text-sm font-medium text-gray-700 mb-1.5">Nom de la boutique</label>
              <input
                type="text"
                id="ob-shopName"
                bind:value={shopName}
                required
                class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
                placeholder="Ma Boutique"
              />
            </div>
            <div>
              <label for="ob-siret" class="block text-sm font-medium text-gray-700 mb-1.5">SIRET</label>
              <input
                type="text"
                id="ob-siret"
                bind:value={siret}
                required
                pattern={"\\d{14}"}
                class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
                placeholder="12345678901234"
              />
            </div>
            <div>
              <label for="ob-address" class="block text-sm font-medium text-gray-700 mb-1.5">Adresse</label>
              <input
                type="text"
                id="ob-address"
                bind:value={address}
                required
                class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
                placeholder="12 rue du Commerce, 33000 Bordeaux"
              />
            </div>
          </fieldset>

          <div class="border-t border-gray-200"></div>

          <fieldset class="space-y-4">
            <legend class="text-sm font-semibold text-gray-900 mb-1">Votre compte administrateur</legend>
            <div>
              <label for="ob-name" class="block text-sm font-medium text-gray-700 mb-1.5">Votre nom</label>
              <input
                type="text"
                id="ob-name"
                bind:value={name}
                required
                class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
                placeholder="Jean Dupont"
              />
            </div>
            <div>
              <label for="ob-email" class="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                id="ob-email"
                bind:value={email}
                required
                class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
                placeholder="vous@exemple.fr"
              />
            </div>
            <div>
              <label for="ob-password" class="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
              <input
                type="password"
                id="ob-password"
                bind:value={password}
                required
                minlength="8"
                class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow duration-150"
                placeholder="8 caracteres minimum"
              />
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={submitting}
            class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {submitting ? 'Creation en cours...' : 'Creer ma boutique'}
          </button>
        </form>
      {/if}
    </div>
  </div>
</main>
