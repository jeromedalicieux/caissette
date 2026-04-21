<script lang="ts">
  import { vatApi, csvExport, exportApi } from '$lib/api/client'
  import { authStore } from '$lib/stores/auth.svelte'
  import SectionGuide from '$lib/components/SectionGuide.svelte'

  let loading = $state(false)
  let error = $state('')
  let success = $state('')
  let exportingCsv = $state(false)
  let exportingFec = $state(false)
  let exportingJournal = $state(false)
  let exportingClosures = $state(false)
  let exportingMovements = $state(false)

  // Period defaults to current month
  const now = new Date()
  let startDate = $state(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
  let endDate = $state(now.toISOString().split('T')[0]!)

  let vatData = $state<any>(null)

  const isManager = $derived(authStore.user?.role === 'owner' || authStore.user?.role === 'manager')

  function formatPrice(cents: number) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' \u20AC'
  }

  function paymentLabel(method: string) {
    if (method === 'cash') return 'Especes'
    if (method === 'card') return 'Carte bancaire'
    if (method === 'check') return 'Cheque'
    return 'Autre'
  }

  function regimeLabel(regime: string) {
    if (regime === 'deposit') return 'Marge (depot)'
    if (regime === 'normal') return 'TVA normale'
    if (regime === 'resale_item_by_item') return 'Marge (achat/revente)'
    return regime
  }

  async function loadVatSummary() {
    if (!startDate || !endDate) { error = 'Selectionnez une periode'; return }
    error = ''
    loading = true
    try {
      vatData = await vatApi.summary(startDate, endDate)
    } catch (e: any) {
      error = e.message
    }
    loading = false
  }

  async function handleCsvExport() {
    if (!startDate || !endDate) { error = 'Selectionnez une periode'; return }
    error = ''
    exportingCsv = true
    try {
      await csvExport.download(startDate, endDate)
      success = 'Export CSV telecharge.'
    } catch (e: any) {
      error = e.message
    }
    exportingCsv = false
  }

  async function handleFecExport() {
    if (!startDate || !endDate) { error = 'Selectionnez une periode'; return }
    error = ''
    exportingFec = true
    try {
      await exportApi.downloadFec(startDate, endDate)
      success = 'Export FEC telecharge.'
    } catch (e: any) {
      error = e.message
    }
    exportingFec = false
  }

  async function handleJournalExport() {
    if (!startDate || !endDate) { error = 'Selectionnez une periode'; return }
    error = ''
    exportingJournal = true
    try {
      await csvExport.downloadJournal(startDate, endDate)
      success = 'Journal de caisse CSV telecharge.'
    } catch (e: any) {
      error = e.message
    }
    exportingJournal = false
  }

  async function handleClosuresExport() {
    if (!startDate || !endDate) { error = 'Selectionnez une periode'; return }
    error = ''
    exportingClosures = true
    try {
      await csvExport.downloadClosures(startDate, endDate)
      success = 'Clotures CSV telecharge.'
    } catch (e: any) {
      error = e.message
    }
    exportingClosures = false
  }

  async function handleMovementsExport() {
    if (!startDate || !endDate) { error = 'Selectionnez une periode'; return }
    error = ''
    exportingMovements = true
    try {
      await csvExport.downloadMovements(startDate, endDate)
      success = 'Mouvements de caisse CSV telecharge.'
    } catch (e: any) {
      error = e.message
    }
    exportingMovements = false
  }
</script>

<svelte:head>
  <title>Comptabilite — Caissette</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6">
    <div class="flex items-center gap-2">
      <h1 class="text-2xl font-bold text-gray-900">Comptabilite</h1>
      <SectionGuide
        title="Outils comptables"
        description="Consultez le recapitulatif TVA, exportez vos donnees pour le comptable, et generez des factures depuis les ventes."
        tips={['L\'export FEC est obligatoire en cas de controle fiscal (art. L47 A-1 LPF)', 'Conservez vos donnees au moins 6 ans (obligation legale)', 'Le recap TVA vous aide a preparer vos declarations', 'Tout est explique en detail dans la page Conformite', 'L\'export CSV est importable dans Excel ou Google Sheets']}
      />
    </div>
    <p class="text-sm text-gray-500 mt-1">Recapitulatifs, exports et outils pour votre comptable</p>
  </div>

  {#if !isManager}
    <div class="rounded-lg bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">
      Acces reserve aux responsables (owner/manager).
    </div>
  {:else}
    {#if error}
      <div class="mb-4 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
    {/if}
    {#if success}
      <div class="mb-4 rounded-lg bg-green-50 border border-green-100 p-4 text-sm text-green-700">{success}</div>
    {/if}

    <!-- Period selector (shared) -->
    <div class="mb-6 flex flex-wrap items-end gap-4">
      <div>
        <label for="compta-start" class="block text-sm font-medium text-gray-700 mb-1.5">Debut</label>
        <input type="date" id="compta-start" bind:value={startDate}
          class="rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
      </div>
      <div>
        <label for="compta-end" class="block text-sm font-medium text-gray-700 mb-1.5">Fin</label>
        <input type="date" id="compta-end" bind:value={endDate}
          class="rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
      </div>
      <!-- Quick period buttons -->
      <div class="flex gap-2">
        <button onclick={() => { const d = new Date(); startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; endDate = d.toISOString().split('T')[0]! }}
          class="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Ce mois</button>
        <button onclick={() => { const d = new Date(); const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1); startDate = prev.toISOString().split('T')[0]!; endDate = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]! }}
          class="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Mois precedent</button>
        <button onclick={() => { const d = new Date(); const q = Math.floor(d.getMonth() / 3); startDate = `${d.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`; endDate = d.toISOString().split('T')[0]! }}
          class="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Ce trimestre</button>
        <button onclick={() => { const d = new Date(); startDate = `${d.getFullYear()}-01-01`; endDate = d.toISOString().split('T')[0]! }}
          class="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cette annee</button>
      </div>
    </div>

    <!-- Recap TVA -->
    <div class="max-w-4xl rounded-xl bg-white p-6 shadow-sm border border-gray-100 mb-8">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <h2 class="text-lg font-semibold text-gray-900">Recapitulatif TVA</h2>
          <SectionGuide
            title="Recap TVA"
            description="Ce tableau ventile la TVA collectee par taux et par regime (marge ou normale). Utile pour la declaration de TVA mensuelle ou trimestrielle."
            tips={['Les montants negatifs correspondent aux avoirs/remboursements', 'Le regime \"marge\" s\'applique aux articles en depot-vente', 'Ce recap est a transmettre a votre comptable']}
          />
        </div>
        <button onclick={loadVatSummary} disabled={loading}
          class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Calcul...' : 'Calculer'}
        </button>
      </div>

      {#if vatData}
        <!-- Summary cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div class="rounded-lg bg-gray-50 p-4">
            <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Ventes</div>
            <div class="mt-1 text-xl font-bold text-gray-900">{vatData.salesCount}</div>
          </div>
          <div class="rounded-lg bg-blue-50 p-4">
            <div class="text-xs font-medium text-blue-600 uppercase tracking-wide">Total HT</div>
            <div class="mt-1 text-xl font-bold text-gray-900">{formatPrice(vatData.totalHT)}</div>
          </div>
          <div class="rounded-lg bg-amber-50 p-4">
            <div class="text-xs font-medium text-amber-600 uppercase tracking-wide">TVA collectee</div>
            <div class="mt-1 text-xl font-bold text-gray-900">{formatPrice(vatData.totalVAT)}</div>
          </div>
          <div class="rounded-lg bg-green-50 p-4">
            <div class="text-xs font-medium text-green-600 uppercase tracking-wide">Total TTC</div>
            <div class="mt-1 text-xl font-bold text-gray-900">{formatPrice(vatData.totalTTC)}</div>
          </div>
        </div>

        <!-- VAT breakdown table -->
        {#if vatData.vatBreakdown && vatData.vatBreakdown.length > 0}
          <div class="overflow-hidden rounded-lg border border-gray-200 mb-6">
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr class="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th class="px-4 py-3 text-left">Regime</th>
                  <th class="px-4 py-3 text-left">Taux</th>
                  <th class="px-4 py-3 text-right">Base HT</th>
                  <th class="px-4 py-3 text-right">TVA</th>
                  <th class="px-4 py-3 text-right">Total TTC</th>
                  <th class="px-4 py-3 text-right">Articles</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each vatData.vatBreakdown as row}
                  <tr class="hover:bg-gray-50/50">
                    <td class="px-4 py-3 font-medium text-gray-900">{regimeLabel(row.regime)}</td>
                    <td class="px-4 py-3 text-gray-600">{row.rateLabel}</td>
                    <td class="px-4 py-3 text-right font-medium">{formatPrice(row.baseHT)}</td>
                    <td class="px-4 py-3 text-right font-medium text-amber-700">{formatPrice(row.vatAmount)}</td>
                    <td class="px-4 py-3 text-right font-medium">{formatPrice(row.totalTTC)}</td>
                    <td class="px-4 py-3 text-right text-gray-600">{row.count}</td>
                  </tr>
                {/each}
              </tbody>
              <tfoot class="bg-gray-50 font-semibold">
                <tr>
                  <td class="px-4 py-3" colspan="2">Total</td>
                  <td class="px-4 py-3 text-right">{formatPrice(vatData.totalHT)}</td>
                  <td class="px-4 py-3 text-right text-amber-700">{formatPrice(vatData.totalVAT)}</td>
                  <td class="px-4 py-3 text-right">{formatPrice(vatData.totalTTC)}</td>
                  <td class="px-4 py-3 text-right">{vatData.vatBreakdown.reduce((s: number, r: any) => s + r.count, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        {:else}
          <p class="text-sm text-gray-400 mb-6">Aucune vente sur cette periode.</p>
        {/if}

        <!-- Payment breakdown -->
        {#if vatData.byPayment && Object.keys(vatData.byPayment).length > 0}
          <h3 class="text-sm font-semibold text-gray-700 mb-3">Ventilation par moyen de paiement</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {#each Object.entries(vatData.byPayment) as [method, amount]}
              <div class="rounded-lg border border-gray-200 p-3">
                <div class="text-xs text-gray-500">{paymentLabel(method)}</div>
                <div class="mt-1 text-sm font-bold text-gray-900">{formatPrice(amount as number)}</div>
              </div>
            {/each}
          </div>
        {/if}
      {:else if !loading}
        <p class="text-sm text-gray-400 py-8 text-center">Cliquez sur "Calculer" pour generer le recapitulatif TVA de la periode.</p>
      {/if}
    </div>

    <!-- Exports -->
    <div class="max-w-4xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div class="flex items-center gap-2 mb-1">
        <h2 class="text-lg font-semibold text-gray-900">Exports</h2>
        <SectionGuide
          title="Exports comptables"
          description="Telechargez vos donnees de vente dans differents formats pour votre comptable ou en cas de controle fiscal."
          tips={['Le CSV s\'ouvre dans Excel et contient le detail de chaque article vendu', 'Le FEC (Fichier des Ecritures Comptables) est le format legal obligatoire', 'Les deux exports utilisent la meme periode selectionnee ci-dessus']}
        />
      </div>
      <p class="text-sm text-gray-500 mb-5">Telechargez vos donnees pour le comptable</p>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button onclick={handleCsvExport} disabled={exportingCsv}
          class="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-900 transition-colors disabled:opacity-50">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {exportingCsv ? 'Export...' : 'Ventes detail (CSV)'}
        </button>
        <button onclick={handleJournalExport} disabled={exportingJournal}
          class="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-900 transition-colors disabled:opacity-50">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
          {exportingJournal ? 'Export...' : 'Journal de caisse (CSV)'}
        </button>
        <button onclick={handleClosuresExport} disabled={exportingClosures}
          class="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-900 transition-colors disabled:opacity-50">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          {exportingClosures ? 'Export...' : 'Clotures Z (CSV)'}
        </button>
        <button onclick={handleMovementsExport} disabled={exportingMovements}
          class="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-900 transition-colors disabled:opacity-50">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
          {exportingMovements ? 'Export...' : 'Mouvements de caisse (CSV)'}
        </button>
        <button onclick={handleFecExport} disabled={exportingFec}
          class="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-800 transition-colors disabled:opacity-50">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          {exportingFec ? 'Export...' : 'FEC legal (obligatoire)'}
        </button>
      </div>
    </div>
  {/if}
</div>
