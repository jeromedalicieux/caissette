<script lang="ts">
  import { usersApi } from '$lib/api/client'
  import { authStore } from '$lib/stores/auth.svelte'
  import { onMount } from 'svelte'
  import SectionGuide from '$lib/components/SectionGuide.svelte'

  let list = $state<any[]>([])
  let loading = $state(true)
  let error = $state('')
  let success = $state('')

  // Form
  let showForm = $state(false)
  let editingId = $state<string | null>(null)
  let formName = $state('')
  let formEmail = $state('')
  let formPassword = $state('')
  let formRole = $state<string>('cashier')
  let formPermissionPreset = $state<string>('readonly')
  let formPermissions = $state({
    canViewSales: true,
    canViewJournal: true,
    canViewClosures: true,
    canViewAccounting: true,
    canExport: false,
    canGenerateClosures: false,
    canViewDashboard: true,
  })
  let submitting = $state(false)

  // Reset password
  let resetId = $state<string | null>(null)
  let resetPassword = $state('')

  const isOwner = $derived(authStore.user?.role === 'owner')

  onMount(() => { loadUsers() })

  async function loadUsers() {
    loading = true
    error = ''
    try {
      list = await usersApi.list()
    } catch (e: any) {
      error = e.message
    }
    loading = false
  }

  function resetForm() {
    editingId = null
    formName = formEmail = formPassword = ''
    formRole = 'cashier'
    formPermissionPreset = 'readonly'
    applyPreset('readonly')
    showForm = false
  }

  function applyPreset(preset: string) {
    if (preset === 'readonly') {
      formPermissions = {
        canViewSales: true, canViewJournal: true, canViewClosures: true,
        canViewAccounting: true, canExport: false, canGenerateClosures: false, canViewDashboard: true,
      }
    } else if (preset === 'full') {
      formPermissions = {
        canViewSales: true, canViewJournal: true, canViewClosures: true,
        canViewAccounting: true, canExport: true, canGenerateClosures: true, canViewDashboard: true,
      }
    }
    // 'custom' does nothing — keeps current values
  }

  function startEdit(u: any) {
    editingId = u.id
    formName = u.name
    formEmail = u.email
    formRole = u.role
    formPassword = ''
    if (u.permissionsJson) {
      try { formPermissions = { ...formPermissions, ...JSON.parse(u.permissionsJson) } } catch {}
      formPermissionPreset = 'custom'
    }
    showForm = true
  }

  async function handleSubmit() {
    error = ''
    submitting = true
    try {
      if (editingId) {
        const data: Record<string, any> = { name: formName, email: formEmail, role: formRole }
        if (formPassword) data.password = formPassword
        if (formRole === 'accountant') data.permissions = formPermissions
        await usersApi.update(editingId, data)
        success = 'Utilisateur modifie.'
      } else {
        if (!formEmail || !formName || !formPassword) { error = 'Tous les champs sont requis'; submitting = false; return }
        const data: any = { email: formEmail, name: formName, password: formPassword, role: formRole }
        if (formRole === 'accountant') data.permissions = formPermissions
        await usersApi.create(data)
        success = 'Utilisateur cree.'
      }
      resetForm()
      await loadUsers()
    } catch (e: any) {
      error = e.message
    }
    submitting = false
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Desactiver cet utilisateur ?')) return
    try {
      await usersApi.remove(id)
      await loadUsers()
      success = 'Utilisateur desactive.'
    } catch (e: any) {
      error = e.message
    }
  }

  async function handleReactivate(id: string) {
    try {
      await usersApi.update(id, { active: true })
      await loadUsers()
      success = 'Utilisateur reactive.'
    } catch (e: any) {
      error = e.message
    }
  }

  async function handleResetPassword() {
    if (!resetId || !resetPassword) return
    try {
      await usersApi.resetPassword(resetId, resetPassword)
      resetId = null
      resetPassword = ''
      success = 'Mot de passe reinitialise.'
    } catch (e: any) {
      error = e.message
    }
  }

  function roleLabel(role: string) {
    const map: Record<string, string> = { owner: 'Proprietaire', manager: 'Responsable', cashier: 'Caissier', accountant: 'Comptable' }
    return map[role] ?? role
  }

  function roleClass(role: string) {
    const map: Record<string, string> = {
      owner: 'bg-purple-50 text-purple-700',
      manager: 'bg-blue-50 text-blue-700',
      cashier: 'bg-green-50 text-green-700',
      accountant: 'bg-amber-50 text-amber-700',
    }
    return map[role] ?? 'bg-gray-100 text-gray-600'
  }
</script>

<svelte:head>
  <title>Utilisateurs -- Rebond</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold text-gray-900">Utilisateurs</h1>
        <SectionGuide
          title="Gestion des utilisateurs"
          description="Gerez les comptes, les roles et les permissions de votre equipe."
          tips={['Chaque utilisateur a un code PIN pour le changement rapide de caissier', 'Le role Comptable a un acces en lecture seule configurable', 'Un utilisateur desactive ne peut plus se connecter', 'Seul le proprietaire peut creer ou supprimer des comptes']}
        />
      </div>
      <p class="text-sm text-gray-500 mt-1">Gestion des comptes et des roles</p>
    </div>
    {#if isOwner}
      <button onclick={() => { if (showForm) resetForm(); else showForm = true }}
        class="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
        {showForm ? 'Annuler' : '+ Nouvel utilisateur'}
      </button>
    {/if}
  </div>

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
  {/if}
  {#if success}
    <div class="mb-4 rounded-lg bg-green-50 border border-green-100 p-4 text-sm text-green-700">{success}</div>
  {/if}

  <!-- Create/Edit form -->
  {#if showForm && isOwner}
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit() }}
      class="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">{editingId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
          <input type="text" bind:value={formName} required
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
          <input type="email" bind:value={formEmail} required
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">{editingId ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe *'}</label>
          <input type="password" bind:value={formPassword} minlength="8" required={!editingId}
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Role *</label>
          <select bind:value={formRole}
            class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="owner">Proprietaire</option>
            <option value="manager">Responsable</option>
            <option value="cashier">Caissier</option>
            <option value="accountant">Comptable</option>
          </select>
        </div>
      </div>

      <!-- Permissions for accountant -->
      {#if formRole === 'accountant'}
        <div class="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 class="text-sm font-semibold text-amber-900 mb-3">Permissions du comptable</h3>
          <div class="mb-3 flex gap-2">
            {#each [
              { v: 'readonly', l: 'Lecture seule' },
              { v: 'full', l: 'Comptable complet' },
              { v: 'custom', l: 'Personnalise' },
            ] as preset}
              <button type="button"
                onclick={() => { formPermissionPreset = preset.v; applyPreset(preset.v) }}
                class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors
                  {formPermissionPreset === preset.v ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-amber-100'}">
                {preset.l}
              </button>
            {/each}
          </div>
          <div class="grid grid-cols-2 gap-2">
            {#each [
              { key: 'canViewDashboard', label: 'Tableau de bord' },
              { key: 'canViewSales', label: 'Ventes (lecture)' },
              { key: 'canViewJournal', label: 'Journal de caisse' },
              { key: 'canViewClosures', label: 'Clotures' },
              { key: 'canViewAccounting', label: 'Comptabilite' },
              { key: 'canExport', label: 'Exports FEC/CSV' },
              { key: 'canGenerateClosures', label: 'Generer clotures' },
            ] as perm}
              <label class="flex items-center gap-2 text-sm text-amber-900">
                <input type="checkbox"
                  checked={(formPermissions as any)[perm.key]}
                  onchange={() => { (formPermissions as any)[perm.key] = !(formPermissions as any)[perm.key]; formPermissionPreset = 'custom' }}
                  class="rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                {perm.label}
              </label>
            {/each}
          </div>
        </div>
      {/if}

      <div class="mt-6 flex justify-end">
        <button type="submit" disabled={submitting}
          class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
          {submitting ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Creer'}
        </button>
      </div>
    </form>
  {/if}

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else if list.length === 0}
    <div class="text-center py-12">
      <p class="text-sm text-gray-400">Aucun utilisateur</p>
    </div>
  {:else}
    <div class="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50/80">
          <tr class="text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th class="px-5 py-3.5">Nom</th>
            <th class="px-5 py-3.5">Email</th>
            <th class="px-5 py-3.5">Role</th>
            <th class="px-5 py-3.5">Statut</th>
            <th class="px-5 py-3.5">Derniere connexion</th>
            {#if isOwner}
              <th class="px-5 py-3.5">Actions</th>
            {/if}
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each list as u}
            <tr class="hover:bg-gray-50/50 transition-colors {u.active === 0 ? 'opacity-50' : ''}">
              <td class="px-5 py-4 font-medium text-gray-900">{u.name}</td>
              <td class="px-5 py-4 text-gray-600">{u.email}</td>
              <td class="px-5 py-4">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {roleClass(u.role)}">
                  {roleLabel(u.role)}
                </span>
              </td>
              <td class="px-5 py-4">
                {#if u.active === 0}
                  <span class="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">Desactive</span>
                {:else}
                  <span class="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">Actif</span>
                {/if}
              </td>
              <td class="px-5 py-4 text-gray-500 text-xs">
                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('fr-FR') : 'Jamais'}
              </td>
              {#if isOwner}
                <td class="px-5 py-4">
                  <div class="flex gap-2">
                    <button onclick={() => startEdit(u)}
                      class="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">Modifier</button>
                    <button onclick={() => { resetId = u.id; resetPassword = '' }}
                      class="text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">MdP</button>
                    {#if u.id !== authStore.user?.id}
                      {#if u.active === 0}
                        <button onclick={() => handleReactivate(u.id)}
                          class="text-sm font-medium text-green-600 hover:text-green-800 transition-colors">Reactiver</button>
                      {:else}
                        <button onclick={() => handleDeactivate(u.id)}
                          class="text-sm font-medium text-red-600 hover:text-red-700 transition-colors">Desactiver</button>
                      {/if}
                    {/if}
                  </div>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Reset password modal -->
{#if resetId}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={() => resetId = null}>
    <div class="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Reinitialiser le mot de passe</h3>
      <input type="password" bind:value={resetPassword} placeholder="Nouveau mot de passe (min. 8 car.)" minlength="8"
        class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
      <div class="mt-4 flex justify-end gap-3">
        <button onclick={() => resetId = null}
          class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
          Annuler
        </button>
        <button onclick={handleResetPassword} disabled={resetPassword.length < 8}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
          Reinitialiser
        </button>
      </div>
    </div>
  </div>
{/if}
