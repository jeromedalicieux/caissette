<script lang="ts">
  import { onboarding } from '$lib/stores/onboarding.svelte'

  function startTour() {
    onboarding.completeWelcome()
  }

  function skip() {
    onboarding.dismiss()
  }
</script>

{#if onboarding.showWelcome}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-br from-blue-600 to-blue-700 px-8 py-8 text-white text-center">
        <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <span class="text-2xl font-bold">R</span>
        </div>
        <h1 class="text-2xl font-bold">Bienvenue sur Rebond</h1>
        <p class="mt-2 text-blue-100 text-sm">Votre logiciel de caisse simple, conforme et complet</p>
      </div>

      <!-- Features -->
      <div class="px-8 py-6">
        <div class="grid grid-cols-2 gap-4">
          <div class="rounded-xl border border-gray-100 p-4">
            <div class="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25v-.008Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007v-.008Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008v-.008Zm2.498 0h.008v.008H15.75v-.008Zm0 2.25h.008v.008H15.75v-.008ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-gray-900">Caisse</h3>
            <p class="mt-1 text-xs text-gray-500">Encaissez en quelques clics avec calcul TVA automatique</p>
          </div>

          <div class="rounded-xl border border-gray-100 p-4">
            <div class="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
              <svg class="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-gray-900">Tableau de bord</h3>
            <p class="mt-1 text-xs text-gray-500">Suivez votre CA, ventes et top articles en temps reel</p>
          </div>

          <div class="rounded-xl border border-gray-100 p-4">
            <div class="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
              <svg class="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-gray-900">Conforme NF525</h3>
            <p class="mt-1 text-xs text-gray-500">Clotures Z, tickets, FEC, attestation — tout est inclus</p>
          </div>

          <div class="rounded-xl border border-gray-100 p-4">
            <div class="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <svg class="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-gray-900">Depot-vente</h3>
            <p class="mt-1 text-xs text-gray-500">Module optionnel : deposants, contrats, reversements</p>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="border-t px-8 py-4 flex justify-between items-center">
        <button onclick={skip}
          class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Passer
        </button>
        <button onclick={startTour}
          class="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
          Decouvrir l'application
        </button>
      </div>
    </div>
  </div>
{/if}
