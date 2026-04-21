<script lang="ts">
  import { onboarding } from '$lib/stores/onboarding.svelte'
</script>

{#if onboarding.showWelcome}
  <div class="mx-6 mt-4 lg:mx-8">
    <div class="flex items-center gap-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 px-5 py-4">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
        <span class="text-lg font-bold">C</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-gray-900">Bienvenue sur Caissette !</p>
        <p class="text-xs text-gray-500 mt-0.5">
          Cliquez sur les boutons
          <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600 mx-0.5 align-middle">i</span>
          a cote de chaque section pour decouvrir les fonctionnalites.
        </p>
      </div>
      <button onclick={() => onboarding.completeWelcome()}
        class="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
        Compris
      </button>
    </div>
  </div>
{/if}
