<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte'
  import { syncStore } from '$lib/stores/sync.svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'

  let { children } = $props()

  $effect(() => {
    if (!authStore.loading && !authStore.isAuthenticated) {
      goto('/login')
    }
  })

  function isActive(path: string) {
    return page.url.pathname === path || page.url.pathname.startsWith(path + '/')
  }

  const navItems = [
    { href: '/caisse', label: 'Caisse', icon: '🏪' },
    { href: '/depots', label: 'Dépôts', icon: '👤' },
    { href: '/articles', label: 'Articles', icon: '📦' },
    { href: '/ventes', label: 'Ventes', icon: '📋' },
    { href: '/livre-police', label: 'Livre de police', icon: '📖' },
    { href: '/parametres', label: 'Paramètres', icon: '⚙️' },
  ]
</script>

{#if authStore.isAuthenticated}
  <div class="flex min-h-screen">
    <nav class="flex w-56 flex-col border-r bg-gray-900 text-white">
      <div class="border-b border-gray-700 p-4">
        <div class="text-lg font-bold">Rebond</div>
        <div class="mt-1 text-xs text-gray-400">{authStore.user?.name}</div>
      </div>

      <ul class="flex-1 space-y-1 p-3">
        {#each navItems as item}
          <li>
            <a href={item.href}
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors {isActive(item.href) ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}">
              <span>{item.icon}</span>
              {item.label}
            </a>
          </li>
        {/each}
      </ul>

      <div class="border-t border-gray-700 p-3">
        {#if !syncStore.isOnline}
          <div class="mb-2 rounded bg-yellow-600 px-2 py-1 text-xs">Hors ligne</div>
        {/if}
        {#if syncStore.pendingCount > 0}
          <div class="mb-2 rounded bg-orange-600 px-2 py-1 text-xs">{syncStore.pendingCount} en attente de sync</div>
        {/if}
        <button onclick={() => authStore.logout().then(() => goto('/login'))}
          class="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-white">
          Déconnexion
        </button>
      </div>
    </nav>

    <main class="flex-1 overflow-auto bg-gray-50">
      {@render children()}
    </main>
  </div>
{/if}
