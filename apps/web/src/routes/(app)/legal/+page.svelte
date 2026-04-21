<script lang="ts">
  import { shops } from '$lib/api/client'
  import { onMount } from 'svelte'

  let shop = $state<any>(null)
  let activeTab = $state<'mentions' | 'cgv' | 'rgpd'>('mentions')

  onMount(async () => {
    try {
      shop = await shops.getCurrent()
    } catch { /* ignore */ }
  })
</script>

<svelte:head>
  <title>Mentions legales -- Caissette</title>
</svelte:head>

<div class="p-6 lg:p-8">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Informations legales</h1>
    <p class="text-sm text-gray-500 mt-1">Mentions legales, conditions generales et politique de confidentialite</p>
  </div>

  <!-- Tabs -->
  <div class="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 max-w-lg">
    {#each [
      { id: 'mentions' as const, label: 'Mentions legales' },
      { id: 'cgv' as const, label: 'CGV' },
      { id: 'rgpd' as const, label: 'Confidentialite' },
    ] as tab}
      <button
        onclick={() => activeTab = tab.id}
        class="flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-all
          {activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}"
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="max-w-3xl rounded-xl bg-white p-8 shadow-sm border border-gray-100">
    {#if activeTab === 'mentions'}
      <h2 class="text-lg font-bold text-gray-900 mb-6">Mentions legales</h2>

      <div class="space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Editeur du logiciel</h3>
          <p>Caissette</p>
          <p>Logiciel de caisse certifie NF525</p>
          <p>Version 1.0.0</p>
        </section>

        {#if shop}
          <section>
            <h3 class="font-semibold text-gray-900 mb-2">Utilisateur / Commercant</h3>
            <p class="font-medium">{shop.name}</p>
            {#if shop.siret}<p>SIRET : {shop.siret}</p>{/if}
            {#if shop.address}<p>{shop.address}</p>{/if}
            {#if shop.email}<p>Email : {shop.email}</p>{/if}
            {#if shop.phone}<p>Telephone : {shop.phone}</p>{/if}
          </section>
        {/if}

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Hebergement</h3>
          <p>Cloudflare, Inc.</p>
          <p>101 Townsend Street, San Francisco, CA 94107, USA</p>
          <p>Donnees hebergees dans l'Union europeenne (region EU)</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Certification</h3>
          <p>Logiciel certifie conforme aux exigences de l'article 286, I-3 bis du Code General des Impots.</p>
          <p>Respect des conditions d'inalterabilite, de securisation, de conservation et d'archivage des donnees.</p>
          <p>L'attestation de conformite est disponible dans la page <a href="/parametres" class="text-blue-600 hover:underline">Parametres</a>.</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Propriete intellectuelle</h3>
          <p>L'ensemble du logiciel Caissette, incluant son code source, son interface et sa documentation, est la propriete exclusive de Caissette. Toute reproduction ou distribution non autorisee est interdite.</p>
        </section>
      </div>

    {:else if activeTab === 'cgv'}
      <h2 class="text-lg font-bold text-gray-900 mb-6">Conditions Generales de Vente</h2>

      <div class="space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Article 1 — Objet</h3>
          <p>Les presentes Conditions Generales de Vente (CGV) s'appliquent a l'ensemble des ventes realisees par le commercant via le logiciel de caisse Caissette. Elles ont pour objet de definir les droits et obligations des parties dans le cadre de la vente de produits et/ou services en magasin.</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Article 2 — Prix</h3>
          <p>Les prix des produits et services sont indiques en euros toutes taxes comprises (TTC). Le commercant se reserve le droit de modifier ses prix a tout moment, les produits etant factures sur la base des tarifs en vigueur au moment de la vente.</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Article 3 — Moyens de paiement</h3>
          <p>Le reglement peut s'effectuer par les moyens de paiement acceptes par le commercant : especes, carte bancaire, cheque, virement bancaire ou tout autre moyen convenu entre les parties.</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Article 4 — Ticket de caisse</h3>
          <p>Conformement au decret n.2023-51 du 31 janvier 2023, le ticket de caisse n'est pas imprime systematiquement. Il est remis au client sur sa demande. Le client peut a tout moment demander un duplicata du ticket.</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Article 5 — Retours et echanges</h3>
          <p>Les conditions de retour et d'echange sont fixees par le commercant et communiquees en magasin. Les avoirs emis sont enregistres dans le logiciel de caisse et sont tracables.</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Article 6 — Garanties</h3>
          <p>Les produits vendus beneficient des garanties legales de conformite (art. L217-4 du Code de la consommation) et des vices caches (art. 1641 du Code civil), dans les conditions et delais prevus par la loi.</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Article 7 — Donnees personnelles</h3>
          <p>Les donnees collectees dans le cadre de la vente sont traitees conformement a notre politique de confidentialite (onglet "Confidentialite"). Le client dispose d'un droit d'acces, de rectification et de suppression de ses donnees.</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Article 8 — Litiges</h3>
          <p>En cas de litige, une solution amiable sera recherchee. A defaut, le litige sera porte devant les juridictions competentes conformement au droit francais.</p>
        </section>
      </div>

    {:else if activeTab === 'rgpd'}
      <h2 class="text-lg font-bold text-gray-900 mb-6">Politique de confidentialite (RGPD)</h2>

      <div class="space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Responsable du traitement</h3>
          {#if shop}
            <p>{shop.name}</p>
            {#if shop.address}<p>{shop.address}</p>{/if}
            {#if shop.email}<p>Contact : {shop.email}</p>{/if}
          {:else}
            <p>Le proprietaire de la boutique (voir onglet "Mentions legales")</p>
          {/if}
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Donnees collectees</h3>
          <p>Dans le cadre de l'utilisation du logiciel de caisse, les donnees suivantes peuvent etre collectees :</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Utilisateurs :</strong> nom, email, role, historique de connexion</li>
            <li><strong>Deposants (depot-vente) :</strong> nom, prenom, adresse, telephone, piece d'identite</li>
            <li><strong>Ventes :</strong> montants, articles, mode de paiement, horodatage</li>
            <li><strong>Clients (facturation) :</strong> nom, adresse, SIRET (uniquement si facture demandee)</li>
          </ul>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Finalites du traitement</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li>Enregistrement des transactions commerciales (obligation legale)</li>
            <li>Gestion comptable et fiscale (obligation legale — art. L123-22 Code de commerce)</li>
            <li>Gestion du depot-vente et des reversements aux deposants</li>
            <li>Generation des documents obligatoires (FEC, tickets Z, factures)</li>
          </ul>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Base legale</h3>
          <p>Le traitement des donnees repose sur :</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Obligation legale :</strong> conservation des donnees comptables (6 ans minimum — art. L123-22 Code de commerce)</li>
            <li><strong>Execution contractuelle :</strong> gestion des contrats de depot-vente</li>
            <li><strong>Interet legitime :</strong> suivi de l'activite commerciale</li>
          </ul>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Duree de conservation</h3>
          <p><strong>6 ans</strong> pour les donnees comptables et fiscales (obligation legale — art. L123-22 du Code de commerce, art. L102 B du Livre des Procedures Fiscales).</p>
          <p class="mt-1">Les donnees des deposants sont conservees pendant la duree du contrat puis 6 ans apres la fin de la relation commerciale.</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Securite des donnees</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li>Donnees stockees sur l'infrastructure Cloudflare (chiffrement au repos et en transit)</li>
            <li>Acces restreint par authentification (email/mot de passe, codes PIN)</li>
            <li>Donnees de vente chainees cryptographiquement (SHA-256) — infalsifiables</li>
            <li>Clotures signees numeriquement (Ed25519)</li>
          </ul>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Vos droits</h3>
          <p>Conformement au RGPD (Reglement UE 2016/679), vous disposez des droits suivants :</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Acces :</strong> obtenir une copie de vos donnees personnelles</li>
            <li><strong>Rectification :</strong> corriger des donnees inexactes</li>
            <li><strong>Effacement :</strong> demander la suppression (sauf obligation legale de conservation)</li>
            <li><strong>Portabilite :</strong> recevoir vos donnees dans un format structure (export FEC/CSV)</li>
            <li><strong>Opposition :</strong> s'opposer au traitement dans certains cas</li>
          </ul>
          <p class="mt-2">Pour exercer vos droits, contactez le responsable du traitement a l'adresse indiquee ci-dessus.</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Transfert de donnees</h3>
          <p>Les donnees sont hebergees par Cloudflare, Inc. dans la region europeenne. Des clauses contractuelles types encadrent tout transfert eventuel hors UE, conformement aux exigences du RGPD.</p>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 mb-2">Reclamation</h3>
          <p>En cas de litige concernant le traitement de vos donnees, vous pouvez introduire une reclamation aupres de la CNIL (Commission Nationale de l'Informatique et des Libertes) — <span class="text-blue-600">www.cnil.fr</span>.</p>
        </section>
      </div>
    {/if}
  </div>
</div>
