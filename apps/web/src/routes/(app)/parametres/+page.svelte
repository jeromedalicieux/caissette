<script lang="ts">
  import { shops, exportApi, attestation, categoriesApi } from '$lib/api/client'
  import { shopStore } from '$lib/stores/shop.svelte'
  import { authStore } from '$lib/stores/auth.svelte'
  import { onMount } from 'svelte'
  import SectionGuide from '$lib/components/SectionGuide.svelte'

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
  let savingDisplay = $state(false)
  let exportingFec = $state(false)
  let fecStart = $state('')
  let fecEnd = $state('')
  let attestationData = $state<any>(null)
  let showAttestation = $state(false)

  // Categories
  let catList = $state<any[]>([])
  let catLoading = $state(false)
  let showCatForm = $state(false)
  let catEditId = $state<string | null>(null)
  let catName = $state('')
  let catColor = $state('')
  let catSubmitting = $state(false)

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
    loadCategories()
  })

  async function loadCategories() {
    catLoading = true
    try {
      catList = await categoriesApi.list(true)
    } catch { /* ignore */ }
    catLoading = false
  }

  async function seedCategories() {
    try {
      await categoriesApi.seed()
      await loadCategories()
      success = 'Categories par defaut creees.'
    } catch (e: any) {
      error = e.message
    }
  }

  async function handleCatSubmit() {
    if (!catName.trim()) return
    catSubmitting = true
    error = ''
    try {
      if (catEditId) {
        await categoriesApi.update(catEditId, { name: catName, color: catColor || null })
      } else {
        await categoriesApi.create({ name: catName, color: catColor || undefined })
      }
      catName = ''; catColor = ''; catEditId = null; showCatForm = false
      await loadCategories()
    } catch (e: any) {
      error = e.message
    }
    catSubmitting = false
  }

  async function toggleCatActive(cat: any) {
    try {
      await categoriesApi.update(cat.id, { active: !cat.active })
      await loadCategories()
    } catch (e: any) { error = e.message }
  }

  async function toggleCatFilter(cat: any) {
    const current = cat.show_in_filters ?? cat.showInFilters
    try {
      await categoriesApi.update(cat.id, { showInFilters: !current })
      await loadCategories()
    } catch (e: any) { error = e.message }
  }

  async function deleteCat(id: string) {
    if (!confirm('Supprimer cette categorie ?')) return
    try {
      await categoriesApi.remove(id)
      await loadCategories()
    } catch (e: any) { error = e.message }
  }

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

  async function handleExportFec() {
    if (!fecStart || !fecEnd) { error = 'Selectionnez une periode pour l\'export FEC'; return }
    error = ''
    exportingFec = true
    try {
      await exportApi.downloadFec(fecStart, fecEnd)
      success = 'Export FEC telecharge.'
    } catch (e: any) {
      error = e.message
    }
    exportingFec = false
  }

  async function loadAttestation() {
    try {
      attestationData = await attestation.get()
      showAttestation = true
    } catch (e: any) {
      error = e.message
    }
  }

  // Default FEC period: current year
  $effect(() => {
    if (!fecStart) {
      const now = new Date()
      fecStart = `${now.getFullYear()}-01-01`
      fecEnd = now.toISOString().split('T')[0]!
    }
  })

  const isManager = $derived(authStore.user?.role === 'owner' || authStore.user?.role === 'manager')

  async function updateDisplay(key: string, value: any) {
    savingDisplay = true
    error = ''
    try {
      await shopStore.updateSettings({ display: { ...shopStore.display, [key]: value } } as any)
      success = 'Affichage mis a jour.'
    } catch (e: any) {
      error = e.message
    }
    savingDisplay = false
  }
</script>

<svelte:head>
  <title>Parametres -- Caissette</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6">
    <div class="flex items-center gap-2">
      <h1 class="text-2xl font-bold text-gray-900">Parametres de la boutique</h1>
      <SectionGuide
        title="Parametres"
        description="Configurez les informations de votre boutique, activez des modules optionnels, et accedez aux outils de conformite."
        tips={['Le SIRET et l\'adresse apparaissent sur vos tickets de caisse', 'Le module depot-vente ajoute la gestion des deposants et commissions', 'L\'export FEC est obligatoire en cas de controle fiscal', 'L\'attestation de conformite est demandable par l\'administration']}
      />
    </div>
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
      <div class="flex items-center gap-2 mb-1">
        <h2 class="text-lg font-semibold text-gray-900">Modules</h2>
        <SectionGuide
          title="Modules optionnels"
          description="Activez ou desactivez des fonctionnalites supplementaires. Le depot-vente ajoute la gestion des deposants, contrats, commissions et reversements."
          tips={['Le depot-vente ajoute 4 pages dans le menu : Deposants, Contrats, Livre de police, Reversements', 'Desactiver un module masque les pages mais ne supprime pas les donnees']}
        />
      </div>
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

    <!-- Categories -->
    {#if isManager}
      <div class="mt-8 max-w-2xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Categories</h2>
            <p class="text-sm text-gray-500 mt-0.5">Gerez les categories d'articles et leur affichage dans les filtres de la caisse</p>
          </div>
          <div class="flex gap-2">
            {#if catList.length === 0}
              <button onclick={seedCategories}
                class="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors">
                Categories par defaut
              </button>
            {/if}
            <button onclick={() => { showCatForm = !showCatForm; catEditId = null; catName = ''; catColor = '' }}
              class="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
              {showCatForm ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>
        </div>

        {#if showCatForm}
          <form onsubmit={(e) => { e.preventDefault(); handleCatSubmit() }}
            class="mb-4 flex items-end gap-3 rounded-lg bg-gray-50 p-3">
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-600 mb-1">Nom</label>
              <input type="text" bind:value={catName} required placeholder="Ex: Vetements"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
            </div>
            <div class="w-24">
              <label class="block text-xs font-medium text-gray-600 mb-1">Couleur</label>
              <input type="color" bind:value={catColor}
                class="block w-full h-[38px] rounded-lg border border-gray-300 cursor-pointer" />
            </div>
            <button type="submit" disabled={catSubmitting}
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
              {catEditId ? 'Modifier' : 'Ajouter'}
            </button>
          </form>
        {/if}

        {#if catLoading}
          <p class="text-center py-4 text-gray-400 text-sm">Chargement...</p>
        {:else if catList.length === 0}
          <p class="text-center py-4 text-sm text-gray-400">Aucune categorie. Utilisez "Categories par defaut" pour commencer.</p>
        {:else}
          <div class="space-y-1">
            {#each catList as cat}
              <div class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5 {cat.active ? '' : 'opacity-50'}">
                <div class="flex items-center gap-3">
                  {#if cat.color}
                    <div class="h-4 w-4 rounded-full" style="background-color: {cat.color}"></div>
                  {:else}
                    <div class="h-4 w-4 rounded-full bg-gray-300"></div>
                  {/if}
                  <span class="text-sm font-medium text-gray-900">{cat.name}</span>
                </div>
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-1.5 text-xs text-gray-500" title="Visible dans les filtres caisse">
                    <input type="checkbox"
                      checked={cat.show_in_filters ?? cat.showInFilters}
                      onchange={() => toggleCatFilter(cat)}
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Filtres
                  </label>
                  <button onclick={() => toggleCatActive(cat)}
                    class="text-xs font-medium {cat.active ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'} transition-colors">
                    {cat.active ? 'Desactiver' : 'Activer'}
                  </button>
                  <button onclick={() => { catEditId = cat.id; catName = cat.name; catColor = cat.color ?? ''; showCatForm = true }}
                    class="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">Modifier</button>
                  <button onclick={() => deleteCat(cat.id)}
                    class="text-xs font-medium text-red-600 hover:text-red-700 transition-colors">Supprimer</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Affichage -->
    <div class="mt-8 max-w-2xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div class="flex items-center gap-2 mb-1">
        <h2 class="text-lg font-semibold text-gray-900">Affichage</h2>
        <SectionGuide
          title="Options d'affichage"
          description="Personnalisez l'apparence de votre caisse et de l'interface."
          tips={['Les colonnes de la grille s\'adaptent a la taille de l\'ecran', 'Le tri par defaut determine l\'ordre des articles a l\'ouverture de la caisse', 'Les options sont sauvegardees automatiquement']}
        />
      </div>
      <p class="text-sm text-gray-500 mb-5">Personnalisez l'interface de votre caisse</p>

      <div class="space-y-5">
        <!-- Colonnes grille caisse -->
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-900">Colonnes de la grille (caisse)</div>
            <div class="text-xs text-gray-500 mt-0.5">Nombre de colonnes sur grand ecran</div>
          </div>
          <div class="flex gap-1.5">
            {#each [2, 3, 4] as cols}
              <button
                onclick={() => updateDisplay('posColumns', cols)}
                class="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors
                  {shopStore.display.posColumns === cols ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
              >
                {cols}
              </button>
            {/each}
          </div>
        </div>

        <!-- Tri par defaut -->
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-900">Tri par defaut</div>
            <div class="text-xs text-gray-500 mt-0.5">Ordre des articles a l'ouverture de la caisse</div>
          </div>
          <div class="flex gap-1.5">
            {#each [
              { v: 'popular', l: 'Populaires' },
              { v: 'favorites', l: 'Favoris' },
              { v: 'default', l: 'Ordre normal' },
            ] as opt}
              <button
                onclick={() => updateDisplay('posDefaultSort', opt.v)}
                class="rounded-lg px-3 py-2 text-sm font-medium transition-colors
                  {shopStore.display.posDefaultSort === opt.v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
              >
                {opt.l}
              </button>
            {/each}
          </div>
        </div>

        <!-- Toggles -->
        {#each [
          { key: 'posShowSku', label: 'Afficher les codes SKU', desc: 'Codes articles visibles sur les cartes de la caisse' },
          { key: 'posShowUsageCount', label: 'Compteur d\'utilisation', desc: 'Nombre de fois qu\'un article a ete vendu' },
          { key: 'posCompactCards', label: 'Cartes compactes', desc: 'Reduit l\'espacement pour afficher plus d\'articles' },
          { key: 'showCategories', label: 'Afficher les categories', desc: 'Badge de categorie sur les cartes articles' },
        ] as toggle}
          <div class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <div class="text-sm font-medium text-gray-900">{toggle.label}</div>
              <div class="text-xs text-gray-500 mt-0.5">{toggle.desc}</div>
            </div>
            <button
              onclick={() => updateDisplay(toggle.key, !(shopStore.display as any)[toggle.key])}
              disabled={savingDisplay}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 disabled:opacity-50
                {(shopStore.display as any)[toggle.key] ? 'bg-blue-600' : 'bg-gray-200'}"
              role="switch"
              aria-checked={(shopStore.display as any)[toggle.key]}
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200
                  {(shopStore.display as any)[toggle.key] ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </div>
        {/each}

        <!-- Couleur d'accent -->
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-900">Couleur d'accent</div>
            <div class="text-xs text-gray-500 mt-0.5">Couleur principale de l'interface</div>
          </div>
          <div class="flex gap-2">
            {#each [
              { v: 'blue', bg: 'bg-blue-500' },
              { v: 'indigo', bg: 'bg-indigo-500' },
              { v: 'emerald', bg: 'bg-emerald-500' },
              { v: 'rose', bg: 'bg-rose-500' },
              { v: 'amber', bg: 'bg-amber-500' },
            ] as color}
              <button
                onclick={() => updateDisplay('accentColor', color.v)}
                class="h-8 w-8 rounded-full {color.bg} transition-transform hover:scale-110
                  {shopStore.display.accentColor === color.v ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : ''}"
                aria-label="Couleur {color.v}"
              ></button>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Impression ticket -->
    <div class="mt-8 max-w-2xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div class="flex items-center gap-2 mb-1">
        <h2 class="text-lg font-semibold text-gray-900">Impression des tickets</h2>
        <SectionGuide
          title="Impression des tickets"
          description="Depuis aout 2023, le ticket de caisse ne doit etre imprime que si le client le demande (loi anti-gaspillage AGEC)."
          tips={['Par defaut, le ticket n\'est pas imprime automatiquement', 'Apres chaque vente, un bouton permet d\'imprimer si le client le demande', 'Vous pouvez reimprimer un ticket depuis l\'historique des ventes', 'Activez l\'impression automatique si vous etes dans un secteur ou le ticket est obligatoire']}
        />
      </div>
      <p class="text-sm text-gray-500 mb-5">Conformite decret n.2023-51 du 31 janvier 2023</p>

      <div class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-4">
        <div>
          <div class="text-sm font-medium text-gray-900">Impression automatique apres chaque vente</div>
          <div class="text-xs text-gray-500 mt-0.5">Desactive par defaut — le ticket sera propose mais pas imprime automatiquement</div>
        </div>
        <button
          onclick={() => {
            const current = localStorage.getItem('caissette_auto_print') === '1'
            localStorage.setItem('caissette_auto_print', current ? '0' : '1')
            success = current ? 'Impression automatique desactivee.' : 'Impression automatique activee.'
          }}
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2
            {typeof localStorage !== 'undefined' && localStorage.getItem('caissette_auto_print') === '1' ? 'bg-blue-600' : 'bg-gray-200'}"
          role="switch"
          aria-checked={typeof localStorage !== 'undefined' && localStorage.getItem('caissette_auto_print') === '1'}
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200
              {typeof localStorage !== 'undefined' && localStorage.getItem('caissette_auto_print') === '1' ? 'translate-x-5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>
    </div>

    {#if isManager}
      <!-- Export FEC -->
      <div class="mt-8 max-w-2xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-900 mb-1">Export comptable (FEC)</h2>
        <p class="text-sm text-gray-500 mb-5">Fichier des Ecritures Comptables — art. A47 A-1 du LPF</p>

        <div class="flex items-end gap-4">
          <div>
            <label for="fec-start" class="block text-sm font-medium text-gray-700 mb-1.5">Debut</label>
            <input type="date" id="fec-start" bind:value={fecStart}
              class="rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          </div>
          <div>
            <label for="fec-end" class="block text-sm font-medium text-gray-700 mb-1.5">Fin</label>
            <input type="date" id="fec-end" bind:value={fecEnd}
              class="rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          </div>
          <button onclick={handleExportFec} disabled={exportingFec}
            class="rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-900 transition-colors disabled:opacity-50">
            {exportingFec ? 'Export...' : 'Telecharger FEC'}
          </button>
        </div>
      </div>

      <!-- Attestation -->
      <div class="mt-8 max-w-2xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-900 mb-1">Attestation de conformite</h2>
        <p class="text-sm text-gray-500 mb-5">Art. 286, I-3° bis du CGI — obligatoire en cas de controle fiscal</p>

        <button onclick={loadAttestation}
          class="rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-900 transition-colors">
          Generer l'attestation
        </button>
      </div>
    {/if}
  {/if}
</div>

<!-- Attestation modal -->
{#if showAttestation && attestationData}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={() => showAttestation = false}>
    <div class="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onclick={(e) => e.stopPropagation()}>
      <div class="p-8">
        <div class="text-center mb-8">
          <h2 class="text-xl font-bold text-gray-900">{attestationData.title}</h2>
          <p class="text-sm text-gray-500 mt-1">{attestationData.subtitle}</p>
        </div>

        <div class="mb-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <h3 class="font-semibold text-gray-900 mb-2">Editeur</h3>
            <p class="text-gray-600">{attestationData.editor.name}</p>
            <p class="text-gray-600">Logiciel : {attestationData.editor.software}</p>
            <p class="text-gray-600">Version : {attestationData.editor.version}</p>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 mb-2">Client</h3>
            <p class="text-gray-600">{attestationData.client.name}</p>
            <p class="text-gray-600">SIRET : {attestationData.client.siret}</p>
            <p class="text-gray-600">{attestationData.client.address}</p>
          </div>
        </div>

        <div class="space-y-4 mb-6">
          {#each attestationData.conditions as cond}
            <div class="rounded-lg border border-gray-200 p-4">
              <h4 class="font-semibold text-gray-900 text-sm">{cond.name}</h4>
              <p class="text-sm text-gray-600 mt-1">{cond.description}</p>
              <p class="text-xs text-gray-400 mt-2 italic">Methode : {cond.method}</p>
            </div>
          {/each}
        </div>

        <div class="text-center text-sm text-gray-500">
          <p>Fait le {attestationData.date}</p>
          <p class="mt-1 font-medium">{attestationData.editor.name}</p>
        </div>
      </div>

      <div class="border-t px-6 py-3 flex justify-end gap-3">
        <button onclick={() => window.print()}
          class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
          Imprimer
        </button>
        <button onclick={() => showAttestation = false}
          class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
          Fermer
        </button>
      </div>
    </div>
  </div>
{/if}
