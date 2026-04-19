<script lang="ts">
  import { policeLedger } from '$lib/api/client'
  import { shopStore } from '$lib/stores/shop.svelte'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let list = $state<any[]>([])
  let loading = $state(true)

  onMount(async () => {
    if (!shopStore.hasDepositSale) { goto('/caisse'); return }
    try {
      list = await policeLedger.list()
    } catch { /* ignore */ }
    loading = false
  })

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  }

  const typeLabels: Record<string, string> = {
    entry: 'Entree',
    exit: 'Sortie',
  }

  const exitReasonLabels: Record<string, string> = {
    sold: 'Vendu',
    returned: 'Restitue',
    destroyed: 'Detruit',
    shop_owned: 'Stock propre',
  }

  function typeClass(type: string) {
    if (type === 'entry') return 'bg-green-50 text-green-700'
    return 'bg-amber-50 text-amber-700'
  }
</script>

<svelte:head>
  <title>Livre de police -- Rebond</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Livre de police</h1>
    <p class="text-sm text-gray-500 mt-1">Registre reglementaire -- art. 321-7 du Code penal</p>
  </div>

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else if list.length === 0}
    <p class="text-center py-12 text-gray-500">Aucune entree dans le registre.</p>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50/80">
          <tr class="text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th class="px-5 py-3.5">N.</th>
            <th class="px-5 py-3.5">Date</th>
            <th class="px-5 py-3.5">Type</th>
            <th class="px-5 py-3.5">Description</th>
            <th class="px-5 py-3.5">Deposant</th>
            <th class="px-5 py-3.5">Piece d'identite</th>
            <th class="px-5 py-3.5">Motif sortie</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each list as entry}
            <tr class="hover:bg-gray-50/50 transition-colors">
              <td class="px-5 py-4 font-mono text-xs text-gray-500">{entry.entry_number ?? entry.entryNumber}</td>
              <td class="px-5 py-4 text-gray-600">{formatDate(entry.recorded_at ?? entry.recordedAt)}</td>
              <td class="px-5 py-4">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {typeClass(entry.entry_type ?? entry.entryType)}">
                  {typeLabels[entry.entry_type ?? entry.entryType] ?? entry.entry_type}
                </span>
              </td>
              <td class="px-5 py-4 text-gray-900">{entry.description}</td>
              <td class="px-5 py-4 text-gray-600">{entry.depositor_name ?? entry.depositorName ?? '-'}</td>
              <td class="px-5 py-4 font-mono text-xs text-gray-500">{entry.depositor_id_document ?? entry.depositorIdDocument ?? '-'}</td>
              <td class="px-5 py-4 text-gray-600">{exitReasonLabels[entry.exit_reason ?? entry.exitReason] ?? '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
