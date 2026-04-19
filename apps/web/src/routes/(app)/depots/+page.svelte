<script lang="ts">
  import { depositors } from '$lib/api/client'
  import { shopStore } from '$lib/stores/shop.svelte'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let list = $state<any[]>([])
  let showForm = $state(false)
  let loading = $state(true)
  let error = $state('')
  let editingId = $state<string | null>(null)

  // Form fields
  let firstName = $state('')
  let lastName = $state('')
  let email = $state('')
  let phone = $state('')
  let address = $state('')
  let idDocType = $state('cni')
  let idDocNumber = $state('')
  let commissionRate = $state(4000)

  onMount(() => {
    if (!shopStore.hasDepositSale) { goto('/caisse'); return }
    loadList()
  })

  async function loadList() {
    loading = true
    try {
      list = await depositors.list()
    } catch (e: any) {
      error = e.message
    }
    loading = false
  }

  function resetForm() {
    firstName = lastName = email = phone = address = idDocNumber = ''
    idDocType = 'cni'
    commissionRate = 4000
    editingId = null
  }

  function startEdit(dep: any) {
    editingId = dep.id
    firstName = dep.first_name ?? dep.firstName ?? ''
    lastName = dep.last_name ?? dep.lastName ?? ''
    email = dep.email ?? ''
    phone = dep.phone ?? ''
    address = dep.address ?? ''
    idDocType = dep.id_document_type ?? dep.idDocumentType ?? 'cni'
    idDocNumber = dep.id_document_number ?? dep.idDocumentNumber ?? ''
    commissionRate = dep.default_commission_rate ?? dep.defaultCommissionRate ?? 4000
    showForm = true
  }

  async function handleSubmit() {
    error = ''
    try {
      if (editingId) {
        await depositors.update(editingId, {
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          address: address || undefined,
          idDocumentType: idDocType,
          idDocumentNumber: idDocNumber,
          defaultCommissionRate: commissionRate,
        })
      } else {
        await depositors.create({
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          address: address || undefined,
          idDocumentType: idDocType,
          idDocumentNumber: idDocNumber,
          defaultCommissionRate: commissionRate,
        })
      }
      showForm = false
      resetForm()
      await loadList()
    } catch (e: any) {
      error = e.message
    }
  }
</script>

<svelte:head>
  <title>Deposants -- Rebond</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Deposants</h1>
      <p class="text-sm text-gray-500 mt-1">Gestion des deposants et de leurs informations</p>
    </div>
    <button onclick={() => { if (showForm) { showForm = false; resetForm() } else { showForm = true } }}
      class="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
      {showForm ? 'Annuler' : '+ Nouveau deposant'}
    </button>
  </div>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
  {/if}

  {#if showForm}
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit() }}
      class="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">{editingId ? 'Modifier le deposant' : 'Nouveau deposant'}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Prenom *</label>
          <input type="text" bind:value={firstName} required class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
          <input type="text" bind:value={lastName} required class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input type="email" bind:value={email} class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Telephone</label>
          <input type="tel" bind:value={phone} class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div class="sm:col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Adresse</label>
          <input type="text" bind:value={address} class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Piece d'identite *</label>
          <select bind:value={idDocType} class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="cni">Carte d'identite</option>
            <option value="passport">Passeport</option>
            <option value="driver_license">Permis de conduire</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">N. piece *</label>
          <input type="text" bind:value={idDocNumber} required class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Commission (%)</label>
          <input type="number" min="0" max="100" step="1" value={commissionRate / 100}
            onchange={(e) => commissionRate = Number(e.currentTarget.value) * 100}
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
      </div>
      <div class="mt-6 flex justify-end">
        <button type="submit" class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
          {editingId ? 'Enregistrer' : 'Creer le deposant'}
        </button>
      </div>
    </form>
  {/if}

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else if list.length === 0}
    <p class="text-center py-12 text-gray-500">Aucun deposant enregistre.</p>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50/80">
          <tr class="text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th class="px-5 py-3.5">Ref</th>
            <th class="px-5 py-3.5">Nom</th>
            <th class="px-5 py-3.5">Email</th>
            <th class="px-5 py-3.5">Telephone</th>
            <th class="px-5 py-3.5">Commission</th>
            <th class="px-5 py-3.5">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each list as dep}
            <tr class="hover:bg-gray-50/50 transition-colors">
              <td class="px-5 py-4 font-mono text-xs text-gray-500">{dep.external_ref ?? dep.externalRef ?? '-'}</td>
              <td class="px-5 py-4 font-medium text-gray-900">{dep.first_name ?? dep.firstName} {dep.last_name ?? dep.lastName}</td>
              <td class="px-5 py-4 text-gray-600">{dep.email ?? '-'}</td>
              <td class="px-5 py-4 text-gray-600">{dep.phone ?? '-'}</td>
              <td class="px-5 py-4">{((dep.default_commission_rate ?? dep.defaultCommissionRate ?? 0) / 100)}%</td>
              <td class="px-5 py-4">
                <button onclick={() => startEdit(dep)}
                  class="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">Modifier</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
