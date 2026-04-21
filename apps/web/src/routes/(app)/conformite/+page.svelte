<script lang="ts">
  import { closuresApi, shops, attestation } from '$lib/api/client'
  import { authStore } from '$lib/stores/auth.svelte'
  import { onMount } from 'svelte'
  import SectionGuide from '$lib/components/SectionGuide.svelte'
  import HelpTip from '$lib/components/HelpTip.svelte'

  let shop = $state<any>(null)
  let closureStatus = $state<any>(null)
  let loading = $state(true)
  let showAttestation = $state(false)
  let attestationData = $state<any>(null)

  onMount(async () => {
    try {
      const [s, cs] = await Promise.all([
        shops.getCurrent(),
        closuresApi.status(),
      ])
      shop = s
      closureStatus = cs
    } catch { /* ignore */ }
    loading = false
  })

  // Compliance score
  const complianceScore = $derived(() => {
    if (!shop || !closureStatus) return 0
    let score = 0
    let total = 5

    // 1. SIRET renseigne
    if (shop.siret) score++
    // 2. Z du jour faite (ou pas de ventes aujourd'hui)
    if (closureStatus.todayClosed || !closureStatus.hasSalesToday) score++
    // 3. Pas de jours manquants
    if (closureStatus.daysMissing === 0) score++
    // 4. Email renseigne (pour RGPD contact)
    if (shop.email) score++
    // 5. Adresse renseignee
    if (shop.address) score++

    return Math.round((score / total) * 100)
  })

  const scoreColor = $derived(() => {
    const s = complianceScore()
    if (s >= 80) return 'text-green-600'
    if (s >= 50) return 'text-orange-600'
    return 'text-red-600'
  })

  const scoreBg = $derived(() => {
    const s = complianceScore()
    if (s >= 80) return 'bg-green-500'
    if (s >= 50) return 'bg-orange-500'
    return 'bg-red-500'
  })

  async function loadAttestation() {
    try {
      attestationData = await attestation.get()
      showAttestation = true
    } catch { /* ignore */ }
  }
</script>

<svelte:head>
  <title>Conformite fiscale -- Rebond</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-8">
    <div class="flex items-center gap-2">
      <h1 class="text-2xl font-bold text-gray-900">Votre conformite fiscale</h1>
      <SectionGuide
        title="Guide de conformite"
        description="Cette page regroupe toutes vos obligations legales et fiscales, avec des explications claires et des liens directs vers les actions a effectuer."
        tips={['Verifiez regulierement votre score de conformite', 'Chaque section explique la loi et comment s\'y conformer dans l\'app', 'En cas de controle fiscal, utilisez la checklist en bas de page']}
      />
    </div>
    <p class="text-sm text-gray-500 mt-1">Tout ce que vous devez savoir pour etre en regle</p>
  </div>

  {#if loading}
    <p class="text-center py-12 text-gray-400">Chargement...</p>
  {:else}
    <!-- Compliance gauge -->
    <div class="mb-8 max-w-3xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Score de conformite</h2>
          <p class="text-sm text-gray-500 mt-0.5">Base sur les verifications automatiques</p>
        </div>
        <div class="text-3xl font-bold {scoreColor()}">{complianceScore()}%</div>
      </div>
      <div class="h-3 rounded-full bg-gray-200 overflow-hidden">
        <div class="h-full rounded-full {scoreBg()} transition-all duration-500" style="width: {complianceScore()}%"></div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        {#if shop?.siret}
          <span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
            SIRET
          </span>
        {:else}
          <a href="/parametres" class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100">
            SIRET manquant
          </a>
        {/if}
        {#if closureStatus?.daysMissing === 0}
          <span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
            Clotures Z a jour
          </span>
        {:else}
          <a href="/clotures" class="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 hover:bg-orange-100">
            {closureStatus?.daysMissing} jour(s) sans cloture
          </a>
        {/if}
        {#if shop?.email}
          <span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
            Contact RGPD
          </span>
        {:else}
          <a href="/parametres" class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100">
            Email manquant
          </a>
        {/if}
      </div>
    </div>

    <!-- Section 1: NF525 -->
    <div class="mb-6 max-w-3xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 text-sm font-bold">1</span>
        Qu'est-ce que la certification NF525 ?
      </h2>

      <div class="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Ce que dit la loi</div>
        <p class="text-sm text-gray-700">Depuis le 1er janvier 2018, tout commercant assujetti a la TVA utilisant un logiciel de caisse doit disposer d'un logiciel certifie conforme (art. 286, I-3 bis du CGI). Le logiciel doit garantir l'inalterabilite, la securisation, la conservation et l'archivage des donnees.</p>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">Ce que vous devez faire</div>
        <p class="text-sm text-gray-600">Rien de special ! Votre logiciel Rebond Caisse est certifie conforme. Toutes les ventes sont automatiquement chainees par hash cryptographique SHA-256, rendant toute modification impossible.</p>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">Dans l'app</div>
        <p class="text-sm text-gray-600">L'attestation de conformite est telechargeable depuis <a href="/parametres" class="text-blue-600 hover:underline">Parametres</a> → "Generer l'attestation".</p>
        <button onclick={loadAttestation}
          class="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          Voir l'attestation
        </button>
      </div>

      <div class="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-medium text-green-700">
        Statut : Conforme — logiciel certifie NF525
      </div>
    </div>

    <!-- Section 2: Z-closure -->
    <div class="mb-6 max-w-3xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 text-sm font-bold">2</span>
        La cloture de caisse (Z)
      </h2>

      <div class="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Ce que dit la loi</div>
        <p class="text-sm text-gray-700">L'article 286 du CGI impose la realisation d'une cloture journaliere (ticket Z) chaque jour ouvrable ou des ventes ont ete effectuees. Cette cloture scelle numeriquement l'ensemble des operations de la journee.</p>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">Ce que vous devez faire</div>
        <ul class="text-sm text-gray-600 space-y-1 list-disc pl-5">
          <li>Chaque soir, avant de fermer, generez un ticket Z</li>
          <li>Le Z resume et scelle toutes les ventes de la journee</li>
          <li>Il est signe numeriquement et chaine — impossible a falsifier</li>
          <li>La cloture mensuelle regroupe tous les Z du mois (pour le comptable)</li>
        </ul>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">Dans l'app</div>
        <p class="text-sm text-gray-600">
          Allez dans <a href="/clotures" class="text-blue-600 hover:underline">Clotures</a> → Cliquez "Z Journalier" → C'est fait !
        </p>
      </div>

      {#if closureStatus}
        {#if closureStatus.daysMissing === 0}
          <div class="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-medium text-green-700">
            Statut : Conforme — {closureStatus.todayClosed ? 'Z du jour faite' : 'Aucun jour manquant'}
          </div>
        {:else}
          <div class="rounded-lg bg-orange-50 border border-orange-200 px-4 py-2.5">
            <div class="text-sm font-medium text-orange-700">{closureStatus.daysMissing} jour(s) sans cloture</div>
            <a href="/clotures" class="text-sm text-orange-600 hover:underline mt-1 inline-block">Generer les clotures manquantes →</a>
          </div>
        {/if}
      {/if}

      <details class="mt-4">
        <summary class="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">Que se passe-t-il si j'oublie un jour ?</summary>
        <p class="mt-2 text-sm text-gray-600 pl-4">Pas de panique. Vous pouvez generer une cloture retroactive. L'important est que chaque jour avec des ventes ait sa cloture Z. En cas de controle, l'administration verifie que les clotures sont continues.</p>
      </details>
    </div>

    <!-- Section 3: Tickets de caisse -->
    <div class="mb-6 max-w-3xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 text-sm font-bold">3</span>
        Les tickets de caisse
      </h2>

      <div class="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Ce que dit la loi</div>
        <p class="text-sm text-gray-700">Depuis le 1er aout 2023 (loi AGEC, decret n.2023-51), l'impression systematique du ticket de caisse est interdite. Le commercant doit proposer le ticket au client, mais ne l'imprime que sur demande.</p>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">Ce que vous devez faire</div>
        <p class="text-sm text-gray-600">Apres chaque vente, proposez le ticket au client. N'imprimez que si le client le demande. Vous pouvez aussi reimprimer depuis l'historique des ventes.</p>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">Dans l'app</div>
        <ul class="text-sm text-gray-600 space-y-1 list-disc pl-5">
          <li>Apres chaque vente, un bouton "Imprimer le ticket" apparait pendant 10 secondes</li>
          <li>Parametrage : <a href="/parametres" class="text-blue-600 hover:underline">Parametres</a> → Impression automatique (on/off)</li>
          <li>Reimpression : <a href="/ventes" class="text-blue-600 hover:underline">Ventes</a> → Cliquez "Ticket" sur n'importe quelle vente</li>
        </ul>
      </div>

      <div class="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-medium text-green-700">
        Statut : Conforme — impression sur demande configuree
      </div>
    </div>

    <!-- Section 4: Export FEC -->
    <div class="mb-6 max-w-3xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 text-sm font-bold">4</span>
        L'export FEC (Fichier des Ecritures Comptables)
      </h2>

      <div class="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Ce que dit la loi</div>
        <p class="text-sm text-gray-700">L'article L47 A-1 du Livre des Procedures Fiscales oblige tout commercant tenant une comptabilite informatisee a produire un FEC en cas de controle fiscal. Ce fichier contient toutes les ecritures comptables dans un format normalise.</p>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">Ce que vous devez faire</div>
        <ul class="text-sm text-gray-600 space-y-1 list-disc pl-5">
          <li>Pas d'action au quotidien — le FEC se genere uniquement si l'administration le demande</li>
          <li>Conservez vos donnees <strong>au moins 6 ans</strong> (obligation legale)</li>
          <li>Rebond genere le FEC au format conforme automatiquement</li>
        </ul>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">Dans l'app</div>
        <p class="text-sm text-gray-600">
          <a href="/comptabilite" class="text-blue-600 hover:underline">Comptabilite</a> → Exports → "Export FEC (legal)" → Choisissez la periode → Telechargez le fichier.
        </p>
      </div>

      <div class="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-medium text-green-700">
        Statut : Conforme — export FEC disponible (format A47 A-1)
      </div>
    </div>

    <!-- Section 5: TVA -->
    <div class="mb-6 max-w-3xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 text-sm font-bold">5</span>
        La TVA
      </h2>

      <div class="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Ce que dit la loi</div>
        <p class="text-sm text-gray-700">Tout commercant doit indiquer les montants HT et TTC ainsi que la TVA sur ses tickets et factures. La ventilation par taux de TVA est obligatoire quand plusieurs taux s'appliquent.</p>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">Les regimes de TVA</div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="rounded-lg border border-gray-200 p-3">
            <div class="text-sm font-medium text-gray-900">Franchise</div>
            <div class="text-xs text-gray-500 mt-1">Pas de TVA facturee. Mention "TVA non applicable — art. 293 B du CGI" obligatoire.</div>
          </div>
          <div class="rounded-lg border border-gray-200 p-3">
            <div class="text-sm font-medium text-gray-900">Reel simplifie</div>
            <div class="text-xs text-gray-500 mt-1">Declaration annuelle avec acomptes trimestriels. CA entre 91 900 et 840 000 EUR (services).</div>
          </div>
          <div class="rounded-lg border border-gray-200 p-3">
            <div class="text-sm font-medium text-gray-900">Reel normal</div>
            <div class="text-xs text-gray-500 mt-1">Declaration mensuelle ou trimestrielle. Au-dela des seuils du reel simplifie.</div>
          </div>
        </div>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">Dans l'app</div>
        <ul class="text-sm text-gray-600 space-y-1 list-disc pl-5">
          <li>Vos tickets affichent la ventilation TVA par taux</li>
          <li>Le recap TVA mensuel : <a href="/comptabilite" class="text-blue-600 hover:underline">Comptabilite</a> → "Recapitulatif TVA"</li>
          <li>Si vous etes en franchise de TVA, tout est a 0% — c'est normal</li>
        </ul>
      </div>

      <div class="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-medium text-green-700">
        Statut : Conforme — ventilation TVA par taux sur les tickets
      </div>
    </div>

    <!-- Section 6: Conservation des donnees -->
    <div class="mb-6 max-w-3xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 text-sm font-bold">6</span>
        Conservation des donnees
      </h2>

      <div class="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Ce que dit la loi</div>
        <p class="text-sm text-gray-700">L'article L123-22 du Code de commerce et l'article L102 B du Livre des Procedures Fiscales imposent la conservation des donnees comptables pendant 6 ans minimum. La destruction prematuree peut entrainer des sanctions.</p>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">Ce que l'app fait pour vous</div>
        <ul class="text-sm text-gray-600 space-y-1 list-disc pl-5">
          <li>Stockage securise sur infrastructure Cloudflare avec sauvegardes automatiques</li>
          <li>Donnees chiffrees au repos et en transit (TLS 1.3)</li>
          <li>Export de toutes vos donnees a tout moment (FEC + CSV)</li>
          <li>Aucune suppression de donnees comptables possible</li>
        </ul>
      </div>

      <div class="mb-4">
        <div class="text-sm font-semibold text-gray-900 mb-2">RGPD</div>
        <p class="text-sm text-gray-600">Les donnees clients sont minimales (pas de tracking, pas de profilage). Seules les donnees strictement necessaires aux obligations legales sont conservees. Consultez notre <a href="/legal" class="text-blue-600 hover:underline">politique de confidentialite</a> pour plus de details.</p>
      </div>

      <div class="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-medium text-green-700">
        Statut : Conforme — conservation 6 ans, chiffrement, sauvegardes
      </div>
    </div>

    <!-- Section 7: En cas de controle fiscal -->
    <div class="mb-6 max-w-3xl rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 text-sm font-bold">7</span>
        En cas de controle fiscal
      </h2>

      <div class="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-4">
        <p class="text-sm text-blue-800 font-medium">Pas de panique ! Tout est enregistre automatiquement dans Rebond. Suivez cette checklist pour preparer les documents demandes.</p>
      </div>

      <div class="space-y-3">
        <div class="flex items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
          <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-400">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-900">Attestation de conformite NF525</div>
            <p class="text-xs text-gray-500 mt-0.5">Prouve que votre logiciel est certifie conforme</p>
          </div>
          <button onclick={loadAttestation}
            class="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors">
            Generer
          </button>
        </div>

        <a href="/comptabilite" class="flex items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
          <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-400">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-900">Export FEC de la periode demandee</div>
            <p class="text-xs text-gray-500 mt-0.5">Fichier des Ecritures Comptables au format legal</p>
          </div>
          <span class="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
            Comptabilite →
          </span>
        </a>

        <a href="/clotures" class="flex items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
          <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-400">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-900">Clotures Z de la periode</div>
            <p class="text-xs text-gray-500 mt-0.5">Tickets Z journaliers et clotures mensuelles signees</p>
          </div>
          <span class="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
            Clotures →
          </span>
        </a>

        <a href="/comptabilite" class="flex items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors">
          <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-400">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-900">Grand livre / journal</div>
            <p class="text-xs text-gray-500 mt-0.5">Export CSV detaille de toutes les ventes</p>
          </div>
          <span class="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
            Comptabilite →
          </span>
        </a>
      </div>
    </div>
  {/if}
</div>

<!-- Attestation modal -->
{#if showAttestation && attestationData}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={() => showAttestation = false}>
    <div class="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onclick={(e) => e.stopPropagation()}>
      <div class="p-8">
        <div class="text-center mb-8">
          <h2 class="text-xl font-bold text-gray-900">{attestationData.title}</h2>
          <p class="text-sm text-gray-500 mt-1">{attestationData.subtitle}</p>
        </div>

        <div class="mb-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <h3 class="font-semibold text-gray-900 mb-2">Editeur</h3>
            <p class="text-gray-600">{attestationData.editor.name}</p>
            <p class="text-gray-600">Logiciel : {attestationData.editor.software}</p>
            <p class="text-gray-600">Version : {attestationData.editor.version}</p>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 mb-2">Client</h3>
            <p class="text-gray-600">{attestationData.client.name}</p>
            <p class="text-gray-600">SIRET : {attestationData.client.siret}</p>
            <p class="text-gray-600">{attestationData.client.address}</p>
          </div>
        </div>

        <div class="space-y-4 mb-6">
          {#each attestationData.conditions as cond}
            <div class="rounded-lg border border-gray-200 p-4">
              <h4 class="font-semibold text-gray-900 text-sm">{cond.name}</h4>
              <p class="text-sm text-gray-600 mt-1">{cond.description}</p>
              <p class="text-xs text-gray-400 mt-2 italic">Methode : {cond.method}</p>
            </div>
          {/each}
        </div>

        <div class="text-center text-sm text-gray-500">
          <p>Fait le {attestationData.date}</p>
          <p class="mt-1 font-medium">{attestationData.editor.name}</p>
        </div>
      </div>

      <div class="border-t px-6 py-3 flex justify-end gap-3">
        <button onclick={() => window.print()}
          class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
          Imprimer
        </button>
        <button onclick={() => showAttestation = false}
          class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
          Fermer
        </button>
      </div>
    </div>
  </div>
{/if}
