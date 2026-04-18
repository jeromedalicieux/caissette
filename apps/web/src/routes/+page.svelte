<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  onMount(() => {
    if (authStore.isAuthenticated) {
      goto('/caisse')
    } else {
      goto('/login')
    }
  })
</script>

<div class="flex min-h-screen items-center justify-center">
  <p class="text-gray-500">Redirection...</p>
</div>
