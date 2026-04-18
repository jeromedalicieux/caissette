<script lang="ts">
  import { depositors } from '$lib/api/client'
  import { onMount } from 'svelte'

  let list = $state<any[]>([])
  let showForm = $state(false)
  let loading = $state(true)
  let error = $state('')

  // Form fields
  let firstName = $state('')
  let lastName = $state('')
  let email = $state('')
  let phone = $state('')
  let address = $state('')
  let idDocType = $state('cni')
  let idDocNumber = $state('')
  let commissionRate = $state(4000)

  onMount(loadList)

  async function loadList() {
    loading = true
    try {
      list = await depositors.list()
    } catch (e: any) {
      error = e.message
    }
    loading = false
  }

  async function handleCreate() {
    error = ''
    try {
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
      showForm = false
      firstName = lastName = email = phone = address = idDocNumber = ''
      await loadList()
    } catch (e: any) {
      error = e.message
    }
  }
</script>

<svelte:head>
  <title>Déposants — Rebond</title>
</svelte:head>

<div class="p-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold text-gray-900">Déposants</h1>
    <button onclick={() => showForm = !showForm}
      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
      {showForm ? 'Annuler' : '+ Nouveau déposant'}
    </button>
  </div>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
  {/if}

  {#if showForm}
    <form onsubmit={(e) => { e.preventDefault(); handleCreate() }}
      class="mb-6 rounded-xl bg-white p-6 shadow-sm">
      <h2 class="mb-4 text-lg font-semibold">Nouveau déposant</h2>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Prénom *</label>
          <input type="text" bind:value={firstName} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Nom *</label>
          <input type="text" bind:value={lastName} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" bind:value={email} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Téléphone</label>
          <input type="tel" bind:value={phone} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700">Adresse</label>
          <input type="text" bind:value={address} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Pièce d'identité *</label>
          <select bind:value={idDocType} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="cni">Carte d'identité</option>
            <option value="passport">Passeport</option>
            <option value="driver_license">Permis de conduire</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">N° pièce *</label>
          <input type="text" bind:value={idDocNumber} required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Commission (%)</label>
          <input type="number" min="0" max="100" step="1" value={commissionRate / 100}
            onchange={(e) => commissionRate = Number(e.currentTarget.value) * 100}
            class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <button type="submit" class="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">
        Créer le déposant
      </button>
    </form>
  {/if}

  {#if loading}
    <p class="text-gray-500">Chargement...</p>
  {:else if list.length === 0}
    <p class="text-gray-500">Aucun déposant enregistré.</p>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th class="px-4 py-3">Réf</th>
            <th class="px-4 py-3">Nom</th>
            <th class="px-4 py-3">Email</th>
            <th class="px-4 py-3">Téléphone</th>
            <th class="px-4 py-3">Commission</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          {#each list as dep}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 font-mono text-xs">{dep.external_ref ?? dep.externalRef ?? '-'}</td>
              <td class="px-4 py-3 font-medium">{dep.first_name ?? dep.firstName} {dep.last_name ?? dep.lastName}</td>
              <td class="px-4 py-3 text-gray-600">{dep.email ?? '-'}</td>
              <td class="px-4 py-3 text-gray-600">{dep.phone ?? '-'}</td>
              <td class="px-4 py-3">{((dep.default_commission_rate ?? dep.defaultCommissionRate ?? 0) / 100)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
