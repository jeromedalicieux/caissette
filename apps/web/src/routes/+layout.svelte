<script>
  import '../app.css'
  import { authStore } from '$lib/stores/auth.svelte'
  import { onMount } from 'svelte'

  let { children } = $props()

  onMount(() => {
    authStore.init()
  })
</script>

{#if authStore.loading}
  <div class="flex min-h-screen items-center justify-center">
    <p class="text-gray-500">Chargement...</p>
  </div>
{:else}
  {@render children()}
{/if}
