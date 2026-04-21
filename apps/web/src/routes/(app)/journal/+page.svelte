<script lang="ts">
  import { journalApi, cashMovementsApi } from '$lib/api/client'
  import { authStore } from '$lib/stores/auth.svelte'
  import { onMount } from 'svelte'
  import SectionGuide from '$lib/components/SectionGuide.svelte'

  let loading = $state(true)
  let error = $state('')
  let selectedDate = $state(new Date().toISOString().slice(0, 10))
  let journal = $state<any>(null)

  // Cash float form
  let showCashForm = $state(false)
  let cashFormType = $state<string>('opening_float')
  let cashFormAmount = $state('')
  let cashFormNote = $state('')
  let submitting = $state(false)

  onMount(() => { loadJournal() })

  async function loadJournal() {
    loading = true
    error = ''
    try {
      journal = await journalApi.get(selectedDate)
    } catch (e: any) {
      error = e.message
    }
    loading = false
  }

  async function submitCashMovement() {
    if (!cashFormAmount) return
    submitting = true
    error = ''
    try {
      const amount = Math.round(parseFloat(cashFormAmount.replace(',', '.')) * 100)
      await cashMovementsApi.create({
        type: cashFormType,
        amount,
        note: cashFormNote || undefined,
      })
      showCashForm = false
      cashFormAmount = ''
      cashFormNote = ''
      await loadJournal()
    } catch (e: any) {
      error = e.message
    }
    submitting = false
  }

  function formatPrice(cents: number) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' \u20AC'
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  function paymentLabel(method: string) {
    const map: Record<string, string> = { cash: 'Especes', card: 'Carte', check: 'Cheque', transfer: 'Virement', other: 'Autre' }
    return map[method] ?? method
  }

  function movementLabel(type: string) {
    const map: Record<string, string> = {
      opening_float: 'Fond de caisse',
      closing_count: 'Comptage fermeture',
      deposit: 'Depot en caisse',
      withdrawal: 'Retrait de caisse',
    }
    return map[type] ?? type
  }

  const isManager = $derived(authStore.user?.role === 'owner' || authStore.user?.role === 'manager')
</script>

<svelte:head>
  <title>Journal de caisse -- Caissette</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold text-gray-900">Journal de caisse</h1>
        <SectionGuide
          title="Journal de caisse"
          description="Vue complete de toutes les operations d'une journee : ventes, avoirs, mouvements de caisse et ecarts."
          tips={['Le journal retrace chronologiquement toutes les operations', 'L\'ecart de caisse = especes comptees - especes attendues', 'Un ecart de quelques centimes est normal (arrondis)', 'Utilisez le fond de caisse pour demarrer chaque journee', 'Les mouvements de caisse (depots, retraits) sont traces']}
        />
      </div>
      <p class="text-sm text-gray-500 mt-1">Vue unifiee des operations journalieres</p>
    </div>
    <div class="flex items-center gap-3">
      {#if isManager}
        <button onclick={() => { showCashForm = !showCashForm }}
          class="rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-900 transition-colors">
          + Mouvement de caisse
        </button>
      {/if}
      <input type="date" bind:value={selectedDate} onchange={() => loadJournal()}
        class="rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
    </div>
  </div>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
  {/if}

  <!-- Cash movement form -->
  {#if showCashForm}
    <div class="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Nouveau mouvement de caisse</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
          <select bind:value={cashFormType}
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="opening_float">Fond de caisse (ouverture)</option>
            <option value="closing_count">Comptage (fermeture)</option>
            <option value="deposit">Depot en caisse</option>
            <option value="withdrawal">Retrait de caisse</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Montant (EUR)</label>
          <input type="text" bind:value={cashFormAmount} placeholder="0,00"
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Note</label>
          <input type="text" bind:value={cashFormNote} placeholder="Optionnel"
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
      </div>
      <div class="mt-4 flex justify-end gap-3">
        <button onclick={() => showCashForm = false}
          class="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
          Annuler
        </button>
        <button onclick={submitCashMovement} disabled={submitting || !cashFormAmount}
          class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
          {submitting ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else if journal}
    <!-- Summary cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <div class="text-xs font-medium uppercase tracking-wider text-gray-500">Ventes</div>
        <div class="mt-2 text-2xl font-bold text-gray-900">{formatPrice(journal.summary.totalSales)}</div>
        <div class="mt-1 text-xs text-gray-500">{journal.summary.salesCount} ticket(s)</div>
      </div>
      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <div class="text-xs font-medium uppercase tracking-wider text-gray-500">Avoirs</div>
        <div class="mt-2 text-2xl font-bold text-red-600">{journal.summary.totalRefunds > 0 ? '-' : ''}{formatPrice(journal.summary.totalRefunds)}</div>
        <div class="mt-1 text-xs text-gray-500">{journal.summary.refundsCount} avoir(s)</div>
      </div>
      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <div class="text-xs font-medium uppercase tracking-wider text-gray-500">Especes attendu</div>
        <div class="mt-2 text-2xl font-bold text-gray-900">{formatPrice(journal.summary.cashExpected)}</div>
        <div class="mt-1 text-xs text-gray-500">Fond: {formatPrice(journal.summary.openingFloat)}</div>
      </div>
      <div class="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <div class="text-xs font-medium uppercase tracking-wider text-gray-500">Ecart</div>
        {#if journal.summary.cashDiscrepancy !== null}
          <div class="mt-2 text-2xl font-bold {journal.summary.cashDiscrepancy === 0 ? 'text-green-600' : journal.summary.cashDiscrepancy > 0 ? 'text-blue-600' : 'text-red-600'}">
            {journal.summary.cashDiscrepancy > 0 ? '+' : ''}{formatPrice(journal.summary.cashDiscrepancy)}
          </div>
          <div class="mt-1 text-xs text-gray-500">Compte: {formatPrice(journal.summary.cashCounted)}</div>
        {:else}
          <div class="mt-2 text-xl font-medium text-gray-400">--</div>
          <div class="mt-1 text-xs text-gray-400">Pas de comptage</div>
        {/if}
      </div>
    </div>

    <!-- Payment method totals -->
    {#if Object.keys(journal.summary.totalByPaymentMethod).length > 0}
      <div class="mb-6 rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h2 class="text-sm font-semibold text-gray-900 mb-3">Totaux par moyen de paiement</h2>
        <div class="flex flex-wrap gap-4">
          {#each Object.entries(journal.summary.totalByPaymentMethod) as [method, total]}
            <div class="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-2">
              <span class="text-sm font-medium text-gray-700">{paymentLabel(method)}</span>
              <span class="text-sm font-bold text-gray-900">{formatPrice(total as number)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Cash movements -->
    {#if journal.cashMovements.length > 0}
      <div class="mb-6 rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h2 class="text-sm font-semibold text-gray-900 mb-3">Mouvements de caisse</h2>
        <div class="space-y-2">
          {#each journal.cashMovements as m}
            <div class="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
              <div class="flex items-center gap-3">
                <span class="text-xs text-gray-500">{formatTime(m.recorded_at ?? m.recordedAt)}</span>
                <span class="text-sm font-medium text-gray-900">{movementLabel(m.type)}</span>
                {#if m.note}
                  <span class="text-xs text-gray-500">— {m.note}</span>
                {/if}
              </div>
              <span class="text-sm font-bold {m.type === 'withdrawal' ? 'text-red-600' : 'text-gray-900'}">
                {m.type === 'withdrawal' ? '-' : ''}{formatPrice(m.amount)}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Sales timeline -->
    <div class="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div class="border-b bg-gray-50/80 px-5 py-3">
        <h2 class="text-sm font-semibold text-gray-900">Operations du jour ({journal.sales.length})</h2>
      </div>
      {#if journal.sales.length === 0}
        <div class="text-center py-12">
          <p class="text-sm text-gray-400">Aucune operation ce jour</p>
        </div>
      {:else}
        <table class="w-full text-left text-sm">
          <thead class="border-b bg-gray-50/50">
            <tr class="text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th class="px-5 py-3">Heure</th>
              <th class="px-5 py-3">Ticket</th>
              <th class="px-5 py-3">Paiement</th>
              <th class="px-5 py-3">Statut</th>
              <th class="px-5 py-3 text-right">Montant</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each journal.sales as s}
              <tr class="hover:bg-gray-50/50 transition-colors">
                <td class="px-5 py-3 text-gray-500">{formatTime(s.soldAt)}</td>
                <td class="px-5 py-3 font-medium">#{s.receiptNumber}</td>
                <td class="px-5 py-3 text-gray-600">{paymentLabel(s.paymentMethod)}</td>
                <td class="px-5 py-3">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                    {s.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
                    {s.status === 'completed' ? 'OK' : 'Avoir'}
                  </span>
                </td>
                <td class="px-5 py-3 text-right font-mono font-medium {s.total < 0 ? 'text-red-600' : 'text-gray-900'}">
                  {formatPrice(s.total)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/if}
</div>
