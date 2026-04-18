<script lang="ts">
  import { policeLedger } from '$lib/api/client'
  import { onMount } from 'svelte'

  let list = $state<any[]>([])
  let loading = $state(true)

  onMount(async () => {
    try {
      list = await policeLedger.list()
    } catch { /* ignore */ }
    loading = false
  })

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  }

  const typeLabels: Record<string, string> = {
    entry: 'Entrée',
    exit: 'Sortie',
  }

  const exitReasonLabels: Record<string, string> = {
    sold: 'Vendu',
    returned: 'Restitué',
    destroyed: 'Détruit',
    shop_owned: 'Stock propre',
  }
</script>

<svelte:head>
  <title>Livre de police — Rebond</title>
</svelte:head>

<div class="p-6">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Livre de police</h1>
    <p class="mt-1 text-sm text-gray-500">Registre réglementaire — art. 321-7 du Code pénal</p>
  </div>

  {#if loading}
    <p class="text-gray-500">Chargement...</p>
  {:else if list.length === 0}
    <p class="text-gray-500">Aucune entrée dans le registre.</p>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th class="px-4 py-3">N°</th>
            <th class="px-4 py-3">Date</th>
            <th class="px-4 py-3">Type</th>
            <th class="px-4 py-3">Description</th>
            <th class="px-4 py-3">Déposant</th>
            <th class="px-4 py-3">Pièce d'identité</th>
            <th class="px-4 py-3">Motif sortie</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          {#each list as entry}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 font-mono font-medium">{entry.entry_number ?? entry.entryNumber}</td>
              <td class="px-4 py-3 text-gray-600">{formatDate(entry.recorded_at ?? entry.recordedAt)}</td>
              <td class="px-4 py-3">
                <span class="rounded-full px-2 py-0.5 text-xs font-medium
                  {(entry.entry_type ?? entry.entryType) === 'entry' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
                  {typeLabels[entry.entry_type ?? entry.entryType] ?? entry.entry_type}
                </span>
              </td>
              <td class="px-4 py-3">{entry.description}</td>
              <td class="px-4 py-3">{entry.depositor_name ?? entry.depositorName ?? '-'}</td>
              <td class="px-4 py-3 font-mono text-xs">{entry.depositor_id_document ?? entry.depositorIdDocument ?? '-'}</td>
              <td class="px-4 py-3 text-gray-600">{exitReasonLabels[entry.exit_reason ?? entry.exitReason] ?? '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
