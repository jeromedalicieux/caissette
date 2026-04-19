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
</script>

{#if authStore.isAuthenticated}
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <nav class="flex w-60 flex-col bg-gradient-to-b from-gray-900 to-gray-950">
      <!-- Logo area -->
      <div class="border-b border-gray-800 px-5 py-5">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <span class="text-sm font-bold text-white">R</span>
          </div>
          <span class="text-lg font-semibold tracking-tight text-white">Rebond</span>
        </div>
        {#if authStore.user?.name}
          <div class="mt-3 text-xs font-medium text-gray-500">{authStore.user.name}</div>
        {/if}
      </div>

      <!-- Navigation -->
      <ul class="flex-1 space-y-0.5 px-3 py-4">
        <!-- Caisse -->
        <li>
          <a href="/caisse"
            class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
              {isActive('/caisse')
                ? 'border-l-2 border-blue-500 bg-blue-600/15 text-white'
                : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'}">
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25v-.008Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007v-.008Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008v-.008Zm2.498 0h.008v.008H15.75v-.008Zm0 2.25h.008v.008H15.75v-.008ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z" />
            </svg>
            Caisse
          </a>
        </li>

        <!-- Depots -->
        <li>
          <a href="/depots"
            class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
              {isActive('/depots')
                ? 'border-l-2 border-blue-500 bg-blue-600/15 text-white'
                : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'}">
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            Depots
          </a>
        </li>

        <!-- Contrats -->
        <li>
          <a href="/contrats"
            class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
              {isActive('/contrats')
                ? 'border-l-2 border-blue-500 bg-blue-600/15 text-white'
                : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'}">
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Contrats
          </a>
        </li>

        <!-- Articles -->
        <li>
          <a href="/articles"
            class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
              {isActive('/articles')
                ? 'border-l-2 border-blue-500 bg-blue-600/15 text-white'
                : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'}">
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
            Articles
          </a>
        </li>

        <!-- Ventes -->
        <li>
          <a href="/ventes"
            class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
              {isActive('/ventes')
                ? 'border-l-2 border-blue-500 bg-blue-600/15 text-white'
                : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'}">
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185ZM9.75 9h.008v.008H9.75V9Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 4.5h.008v.008h-.008V13.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            Ventes
          </a>
        </li>

        <!-- Livre de police -->
        <li>
          <a href="/livre-police"
            class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
              {isActive('/livre-police')
                ? 'border-l-2 border-blue-500 bg-blue-600/15 text-white'
                : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'}">
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            Livre de police
          </a>
        </li>

        <!-- Parametres -->
        <li>
          <a href="/parametres"
            class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
              {isActive('/parametres')
                ? 'border-l-2 border-blue-500 bg-blue-600/15 text-white'
                : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'}">
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Parametres
          </a>
        </li>
      </ul>

      <!-- Footer -->
      <div class="border-t border-gray-800 px-3 py-4">
        <!-- Status indicators -->
        {#if !syncStore.isOnline}
          <div class="mb-2 flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400">
            <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
            Hors ligne
          </div>
        {/if}
        {#if syncStore.pendingCount > 0}
          <div class="mb-2 flex items-center gap-2 rounded-md bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-400">
            <span class="h-1.5 w-1.5 rounded-full bg-orange-400"></span>
            {syncStore.pendingCount} en attente de sync
          </div>
        {/if}

        <!-- Logout button -->
        <button
          onclick={() => authStore.logout().then(() => goto('/login'))}
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-all duration-150 hover:bg-white/5 hover:text-gray-300">
          <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
          </svg>
          Deconnexion
        </button>
      </div>
    </nav>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto bg-gray-50">
      {@render children()}
    </main>
  </div>
{/if}
