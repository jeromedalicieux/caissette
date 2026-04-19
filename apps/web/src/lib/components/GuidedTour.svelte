<script lang="ts">
  import { onboarding } from '$lib/stores/onboarding.svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'

  interface TourStep {
    title: string
    description: string
    route: string
    position: 'right' | 'bottom' | 'center'
    highlight?: string
  }

  const steps: TourStep[] = [
    {
      title: 'Tableau de bord',
      description: 'Votre vue d\'ensemble : chiffre d\'affaires du jour et du mois, top articles vendus, repartition par moyen de paiement.',
      route: '/dashboard',
      position: 'center',
    },
    {
      title: 'Caisse',
      description: 'L\'ecran principal de vente. Cliquez sur un article pour l\'ajouter au panier, choisissez le mode de paiement, puis encaissez. Simple et rapide.',
      route: '/caisse',
      position: 'center',
    },
    {
      title: 'Articles',
      description: 'Gerez votre inventaire ici. Ajoutez des articles, modifiez les prix, suivez les statuts (en vente, vendu, restitue).',
      route: '/articles',
      position: 'center',
    },
    {
      title: 'Ventes',
      description: 'Historique complet de toutes vos transactions. Filtrez par date ou moyen de paiement, consultez les tickets, et effectuez des avoirs si necessaire.',
      route: '/ventes',
      position: 'center',
    },
    {
      title: 'Clotures de caisse',
      description: 'Generez vos clotures Z (journalieres) et mensuelles. Obligatoire legalement — chaque cloture est signee et infalsifiable.',
      route: '/clotures',
      position: 'center',
    },
    {
      title: 'Parametres',
      description: 'Configurez votre boutique, activez le module depot-vente, exportez votre FEC comptable, et generez votre attestation de conformite.',
      route: '/parametres',
      position: 'center',
    },
  ]

  const currentStep = $derived(steps[onboarding.tourStep])
  const isLastStep = $derived(onboarding.tourStep >= steps.length - 1)
  const progress = $derived(((onboarding.tourStep + 1) / steps.length) * 100)

  $effect(() => {
    if (onboarding.showTour && currentStep && page.url.pathname !== currentStep.route) {
      goto(currentStep.route)
    }
  })

  function next() {
    if (isLastStep) {
      onboarding.completeTour()
    } else {
      onboarding.nextStep()
    }
  }

  function prev() {
    onboarding.prevStep()
  }

  function skip() {
    onboarding.dismiss()
  }
</script>

{#if onboarding.showTour && currentStep}
  <!-- Overlay -->
  <div class="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[2px]"></div>

  <!-- Tour tooltip -->
  <div class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pointer-events-none">
    <div class="pointer-events-auto w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
      <!-- Progress bar -->
      <div class="h-1 bg-gray-100">
        <div class="h-full bg-blue-600 transition-all duration-300" style="width: {progress}%"></div>
      </div>

      <!-- Content -->
      <div class="p-6">
        <!-- Step indicator -->
        <div class="flex items-center gap-2 mb-3">
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            {onboarding.tourStep + 1}
          </span>
          <span class="text-xs font-medium text-gray-400">Etape {onboarding.tourStep + 1} sur {steps.length}</span>
        </div>

        <h3 class="text-lg font-bold text-gray-900">{currentStep.title}</h3>
        <p class="mt-2 text-sm text-gray-600 leading-relaxed">{currentStep.description}</p>
      </div>

      <!-- Navigation -->
      <div class="border-t px-6 py-3 flex items-center justify-between">
        <button onclick={skip}
          class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Quitter le tour
        </button>
        <div class="flex gap-2">
          {#if onboarding.tourStep > 0}
            <button onclick={prev}
              class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Precedent
            </button>
          {/if}
          <button onclick={next}
            class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            {isLastStep ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
