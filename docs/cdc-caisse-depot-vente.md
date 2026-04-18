# Cahier des charges — Logiciel de caisse SaaS pour dépôt-vente

> **Nom de code projet :** Rebond *(à valider, vérifier disponibilité domaines .fr / .com et INPI classe 9 + 42)*
> **Statut :** Spécification v0.2 — conformité & tests renforcés
> **Auteur :** Jerome Dalicieux (Daidyl)
> **Date :** Avril 2026
> **Contexte :** Édition d'un logiciel de caisse SaaS auto-certifié, niche dépôt-vente, architecture PWA offline-first sur stack Cloudflare.

---

## Table des matières

1. [Vision et positionnement](#1-vision-et-positionnement)
2. [Contexte réglementaire](#2-contexte-réglementaire)
3. [Architecture globale](#3-architecture-globale)
4. [Architecture modulaire](#4-architecture-modulaire)
5. [Modèle de données (core)](#5-modèle-de-données-core)
6. [Modules fonctionnels](#6-modules-fonctionnels)
7. [Spécifications ISCA](#7-spécifications-isca)
8. [Stack technique](#8-stack-technique)
9. [Flux utilisateurs clés](#9-flux-utilisateurs-clés)
10. [API et conventions de connecteurs](#10-api-et-conventions-de-connecteurs)
11. [Sécurité et conformité](#11-sécurité-et-conformité)
12. [Phases de développement](#12-phases-de-développement)
13. [Tests et qualité](#13-tests-et-qualité)
14. [Déploiement et ops](#14-déploiement-et-ops)
15. [Roadmap produit](#15-roadmap-produit)
16. [Annexes](#16-annexes)

---

## 1. Vision et positionnement

### 1.1 Problème utilisateur

Les gérants de dépôts-ventes (textile, meubles, puériculture, généralistes) gèrent aujourd'hui leur activité avec :
- **Caisses manuscrites + Excel** (30-40% du marché) — 0€/mois mais aucune conformité fiscale réelle.
- **Logiciels desktop vieillissants** (Polaris, Aurore, DVMaster) — 40-80€/mois, Windows uniquement, UX datée de 2005, support approximatif.
- **Caisses grand public** (SumUp, Square, Zettle) — incapables de gérer la TVA sur marge, le livre de police et le workflow déposant/contrat/reversement.

### 1.2 Proposition de valeur

> Une caisse moderne, web, offline-first, spécialement conçue pour la mécanique dépôt-vente, conforme fiscalement (auto-certifiée ISCA + TVA sur marge), accessible pour 29 à 49€/mois.

**Promesses clés :**
- Installation en 2 minutes, fonctionne sur toute tablette/PC/Mac.
- TVA sur marge calculée automatiquement sur chaque vente.
- Livre de police tenu automatiquement, exportable à la demande.
- Fonctionne même sans internet.
- Archivage légal 6 ans garanti côté serveur.
- Support en français, par un éditeur local unique.

### 1.3 Cible prioritaire

- **Cœur de cible (year 1) :** dépôts-ventes indépendants textile et puériculture, 1 à 3 salariés, 200-800 articles en stock rotatif, CA 80-300k€/an.
- **Extension (year 2) :** brocanteurs/antiquaires, dépôts-ventes meubles, friperies vintage, librairies d'occasion.
- **Hors cible :** enseignes franchisées (Easy Cash, Cash Converters, Troc.com) — besoins trop spécifiques, appels d'offres.

### 1.4 Non-objectifs (scope out explicite)

- ❌ Pas de gestion e-commerce intégrée (viendra via connecteur Prestashop/Shopify/Woo).
- ❌ Pas de gestion paie / RH.
- ❌ Pas de compta complète (export vers Pennylane/Dougs/Cegid, pas de plan comptable interne).
- ❌ Pas de certification NF525 en v1 (auto-certification suffisante, upgrade NF525 optionnel si volume le justifie).
- ❌ Pas de version desktop installable — PWA uniquement.

---

## 2. Contexte réglementaire et conformité

Cette section est **critique** : une erreur d'interprétation ici et le produit expose l'éditeur (Daidyl) à sa responsabilité, et les clients à 7 500€ d'amende par caisse. Chaque obligation est traduite en exigences produit testables.

### 2.1 Cadre légal applicable — matrice complète

| Obligation | Texte légal | Applicable à | Exigence produit |
|---|---|---|---|
| ISCA (Inaltérabilité, Sécurisation, Conservation, Archivage) | Art. 286-I-3°bis CGI, BOI-TVA-DECLA-30-10-30 | Tout logiciel enregistrant règlements B2C | Cf. §7 spécifications ISCA complètes |
| TVA sur marge | Art. 297 A CGI, BOI-TVA-SECT-90 | Revendeurs biens d'occasion | Module `mod_tva_marge` |
| Livre de police | Art. 321-7 Code pénal, décret 88-1040 | Tout achat/vente biens mobiliers d'occasion | Module `mod_livre_police` |
| Mentions obligatoires facture | Art. 242 nonies A annexe II CGI | Toute facture | Génération PDF + ticket |
| Mentions ticket de caisse | Art. L441-3 Code commerce | Ticket au-delà de 25€ à la demande | Template ticket |
| Seuils de paiement espèces | Art. L112-6 Code monétaire | Pro : 1 000€ max / particulier | Blocage applicatif |
| Numérotation facture continue | Art. 289 CGI | Toute facture | Séquence par shop |
| Conservation pièces | Art. L102 B LPF, L123-22 Code commerce | 6 ans fiscal, 10 ans commercial | Archivage R2 |
| Facturation électronique | Art. 289 bis CGI, Ord. 2021-1190 | B2B à partir sept. 2026 | Module v2 `einvoice` |
| RGPD | Règlement UE 2016/679 | Données personnelles déposants | Chiffrement + droits |
| Lutte anti-blanchiment (LCB-FT) | Art. L561-2 CMF | Si > 10k€ / transaction (rare) | Signalement manuel |
| Attestation ISCA éditeur | Modèle BOI fixé | Logiciel auto-certifié | Module `admin-attestations` |

### 2.2 Statut auto-certification au 18 avril 2026

**Historique législatif :**
- **Loi de finances 2016** (art. 88) : instauration de l'obligation logiciels certifiés + mécanisme d'auto-certification par attestation individuelle de l'éditeur.
- **Loi n° 2025-127 du 14 février 2025** (art. 43) : suppression de l'auto-certification, obligation de certification par organisme accrédité (NF525/LNE) à compter du 1er septembre 2026.
- **Loi n° 2026-103 du 19 février 2026** : annulation de la suppression, **rétablissement de l'auto-certification**.

**Conséquences produit :**
- Jerome (Daidyl) peut légalement émettre une **attestation individuelle de conformité** à chaque client sur modèle fixé par l'administration fiscale.
- Cette attestation doit être générée automatiquement depuis le back-office admin (module `admin-attestations`) avec : identification éditeur, identification client, nom/version logiciel, date, signature (scan ou signature électronique eIDAS simple suffisante).
- **L'auto-certification n'exonère pas** des obligations techniques ISCA : attester un logiciel non conforme = fraude fiscale, responsabilité civile et pénale de l'éditeur.
- Sanction pour le commerçant utilisant un logiciel non conforme : **7 500€ d'amende par système d'encaissement**, renouvelable, + redressement fiscal possible si suspicion de fraude.
- Upgrade vers certification NF525 (Infocert/AFNOR) ou LNE envisageable en v3+ : coût audit ~15-25k€, délai 3-6 mois, utile pour crédibilité commerciale si concurrence l'utilise comme différenciant.

### 2.3 TVA sur marge — spécifications complètes (art. 297 A CGI)

**Principe :** Pour la revente de biens d'occasion, la TVA se calcule sur la **marge** (différence entre prix de vente et prix d'achat) et non sur le prix total. Évite la double taxation puisque la TVA a déjà été collectée lors de la vente initiale.

#### 2.3.1 Conditions d'éligibilité

Le régime TVA sur marge s'applique si :
- Le bien est un **bien d'occasion** (bien meuble corporel ayant eu un usage).
- Le bien a été **acheté auprès d'un non-redevable TVA** : particulier, assujetti franchisé, autre revendeur en TVA sur marge, ou auto-entrepreneur en franchise.
- Le bien n'est pas exclu du régime (les œuvres d'art, antiquités et objets de collection ont des règles spécifiques — à gérer en v2 si demande).

**Non-éligible :**
- Bien acheté TTC à un fournisseur assujetti ayant facturé avec TVA déductible → régime normal obligatoire.
- Bien neuf → régime normal.

#### 2.3.2 Deux modalités — option exclusive par période

**Option A : TVA sur marge au coup par coup (opération par opération)**
- Obligation pour les véhicules d'occasion.
- Recommandée pour dépôt-vente textile / généraliste.
- Formule : pour chaque vente, `marge = prix_vente_TTC − prix_achat_TTC`.
- Si marge ≤ 0 : TVA = 0 (pas de TVA négative récupérable).
- TVA = `marge × (taux / (100 + taux))`.
- Suivi individuel : registre de revente liant chaque achat à sa revente.

**Option B : TVA sur marge globale (par période)**
- Optionnelle, sur option auprès du SIE, période 5 ans minimum.
- Pertinente pour brocanteurs, friperies en lots, revendeurs de gros volumes à petit prix unitaire.
- Formule mensuelle/trimestrielle : `marge_globale = Σ prix_vente − Σ prix_achat` sur la période.
- Si marge négative → reportable sur période suivante.
- Pas de suivi individuel achat-revente, mais comptabilité par nature d'opération.

**Choix produit :** le paramétrage `vat_regime` sur `shops` fixe le régime par défaut. Override possible par article (cas mixtes). Module `mod_tva_marge` implémente les deux calculs avec tests unitaires séparés.

#### 2.3.3 Cas spécifique dépôt-vente (intermédiaire opaque)

**Qualification fiscale :** Le dépôt-vente peut relever de deux régimes selon le contrat :

**Régime 1 — Intermédiaire opaque (mandataire ducroire, art. 256 V du CGI) :**
- Le dépositaire vend en son nom propre pour le compte du déposant.
- Il est réputé acheter au déposant puis revendre au client final.
- **Base TVA = commission perçue** (différence entre prix encaissé et prix reversé).
- Configuration par défaut dans Rebond (la plus courante en pratique).

**Régime 2 — Intermédiaire transparent (courtier, art. 256 V-I) :**
- Le dépositaire est clairement identifié comme intermédiaire, le déposant reste vendeur.
- La facture au client final est émise au nom du déposant.
- Commission facturée séparément au déposant (avec TVA standard sur la prestation).
- Plus rare, plus lourd administrativement. **Non prioritaire v1.**

**Exemple concret régime 1 :**

```
Article : robe, déposée par Mme Martin
Prix vente TTC        : 60,00 €
Commission 40%        : 24,00 €
Reversement Mme Martin: 36,00 €

Base TVA sur marge    : 24,00 € (la commission TTC)
TVA collectée (20%)   : 24 × 20 / 120 = 4,00 €
Commission HT         : 24 - 4 = 20,00 €

Ticket client :
  Robe ........... 60,00 € TTC
  Total .......... 60,00 € TTC
  Mention : "TVA sur marge, article 297 A du CGI"
  (pas de ligne TVA détaillée)

Déclaration CA3 :
  Base HT ........ 20,00 €
  TVA ............  4,00 €
```

#### 2.3.4 Cas particulier — vente à perte (achat/revente)

Si un revendeur (non dépôt-vente) revend un article en dessous de son prix d'achat :
- Marge = 0 (pas négative).
- TVA = 0.
- Doit quand même être enregistré avec `cost_basis` pour traçabilité.
- L'article apparaît dans le registre de revente avec marge 0.
- **Test unitaire obligatoire :** vente à perte ne génère pas de TVA négative.

#### 2.3.5 Cas mixte — une vente avec articles à régimes différents

Un ticket peut contenir :
- Article A : dépôt → TVA sur marge (base = commission).
- Article B : achat/revente d'occasion → TVA sur marge (base = marge).
- Article C : produit neuf (ex: accessoire boutique) → TVA normale.

Chaque ligne `sale_items` porte son propre `vat_regime` et `vat_rate`. Le total TVA du ticket est la somme ligne à ligne.

**Impact ticket :**
- Si tous articles en TVA sur marge → mention unique, pas de détail TVA.
- Si au moins un article en TVA normale → ticket détaillé avec ligne TVA pour les articles concernés, mention TVA marge pour les autres.

### 2.4 Livre de police — spécifications complètes (art. 321-7 CP)

**Personnes assujetties :**
- Brocanteurs, antiquaires, revendeurs d'objets mobiliers usagés.
- **Dépôts-ventes** : oui, considérés comme assujettis par la jurisprudence constante (ils reçoivent des objets d'occasion).
- Commerces occasionnels (vide-greniers pro) : oui.

**Contenu obligatoire (décret n° 88-1040 du 14 novembre 1988) :**

| Champ | Description | Source Rebond |
|---|---|---|
| Numéro d'ordre | Continue, ininterrompue | `police_ledger.entry_number` (séquence par shop) |
| Date d'entrée | Jour de la remise | `police_ledger.recorded_at` |
| Nature de l'objet | Description précise | `police_ledger.description` |
| Nombre | Si lot | Inclus dans description ou entrée par unité |
| Prix d'achat ou dépôt | En euros | Depuis `items.cost_price` ou `items.initial_price` |
| Nom et prénom du vendeur/déposant | | `police_ledger.depositor_name` (snapshot) |
| Adresse du vendeur/déposant | Complète | Snapshot dans `police_ledger` |
| Nature, numéro et date de la pièce d'identité | CNI/passeport/permis | Snapshot chiffré |
| Date de sortie | Vente, restitution, destruction | `police_ledger.recorded_at` (entrée de sortie) |
| Prix de vente ou motif de sortie | | `exit_reason` + lien `sale_id` |

**Contraintes techniques :**
- **Tenue informatique autorisée** depuis 2004, sous conditions : intégrité garantie, pas de modification a posteriori, impression possible à tout moment.
- **Écriture chronologique stricte** : numérotation dans l'ordre d'enregistrement, pas de saut, pas de trou.
- Présentation sur demande : forces de l'ordre, agents préfecture, DGCCRF.

**Sanctions :**
- Absence ou tenue défectueuse : **6 mois d'emprisonnement + 30 000€ d'amende** (art. 321-7 CP).
- Si recel involontaire facilité : peines bien plus lourdes.

**Exigences produit strictes :**
- Création automatique de l'entrée dès le dépôt/achat, impossible à différer.
- Création automatique de l'entrée de sortie à la vente.
- Impossibilité technique de modifier une entrée (append-only DB + applicatif).
- Export PDF à tout moment, signé et horodaté.
- Si destruction d'un article (état trop dégradé) : workflow obligatoire avec photo + motif avant passage en statut `destroyed`, entrée de sortie correspondante.

### 2.5 Mentions légales obligatoires — tickets et factures

#### 2.5.1 Ticket de caisse

**Obligatoire :** remise à la demande du client (loi Hamon, décret 2022).

**Mentions minimales :**
- Nom commercial du commerçant + SIRET.
- Adresse du commerçant.
- Date et heure de la vente.
- Numéro de ticket (continu par shop).
- Désignation des articles ou référence.
- Prix unitaire TTC et quantité.
- Prix total TTC.
- Mode de paiement (« Espèces », « Carte bancaire », etc.).
- Si TVA sur marge : mention **« TVA calculée sur marge, art. 297 A du CGI »** (ou équivalent explicite).
- Si régime normal : détail TVA par taux, HT, TTC.
- Mention éditeur logiciel (recommandé, pas obligatoire) : « Logiciel Rebond – Attestation disponible sur demande ».

**Non obligatoire mais recommandé :**
- QR code renvoyant vers une preuve d'authenticité en ligne.
- Numéro de contrat de dépôt (pour traçabilité client).

#### 2.5.2 Facture (B2B ou demande client particulier)

**Mentions additionnelles (art. 242 nonies A ann. II CGI) :**
- Numéro de facture (séquence continue).
- Date de facture (≠ date de vente possible).
- Identification acheteur : nom, adresse, SIRET si pro, numéro TVA intra si UE.
- Identification vendeur : raison sociale, forme juridique, SIRET, RCS, capital social, adresse siège, numéro TVA intra.
- Désignation précise des biens/services.
- Date de la vente ou prestation.
- Prix unitaire HT.
- Taux TVA (sauf régime TVA marge, mention spécifique).
- Montant total HT.
- Montant total TVA.
- Montant total TTC.
- Réductions éventuelles.
- Date de paiement prévue et conditions.
- Mention pénalités de retard (« Tout retard de paiement entraîne l'application d'intérêts au taux légal… »).
- Indemnité forfaitaire 40€ pour frais de recouvrement (B2B).

**Module `mod_caisse` doit :**
- Générer tickets conformes par défaut.
- Proposer conversion ticket → facture pour toute vente.
- Permettre édition post-vente de la facture (adresse, nom client) **sans** modifier la vente sous-jacente.

### 2.6 Seuils de paiement espèces (art. L112-6 Code monétaire)

| Type d'acheteur | Plafond paiement espèces |
|---|---|
| Particulier résidant fiscal France | 1 000 € |
| Particulier non-résident fiscal France | 15 000 € |
| Professionnel (B2B) | 1 000 € |

**Exigence produit :**
- Champ booléen `customer_is_nonresident` dans le panier (par défaut false).
- Si paiement espèces sur montant > 1 000€ et non-résident à false → alerte bloquante.
- Si non-résident à true → demander pièce d'identité étrangère (pas de vérification automatique, responsabilité commerçant).

### 2.7 Régimes TVA du commerçant — paramétrage shop

| Régime | Seuils 2026 | Impact produit |
|---|---|---|
| Franchise en base de TVA | CA < 85 800€ (ventes) / 34 400€ (services) | Pas de TVA collectée, mention « TVA non applicable art. 293 B CGI » sur tickets |
| Régime réel simplifié | 85 800€ ≤ CA ≤ 840 000€ | TVA sur marge ou normal, déclarations CA12 annuelles |
| Régime réel normal | CA > 840 000€ ou option | Déclarations CA3 mensuelles/trimestrielles |

**Seuils à vérifier et mettre à jour annuellement** dans le fichier `packages/shared/fiscal/thresholds.ts`.

**Exigences :**
- Champ `vat_regime_declaration` sur `shops` : `franchise | simplified | normal`.
- Si franchise : aucune TVA ajoutée aux tickets, mention obligatoire.
- Alerte automatique à 90% du seuil : « Vous approchez du seuil de franchise TVA, anticipez la bascule avec votre comptable. »

### 2.8 Conservation et archivage — durées légales

| Type document | Durée | Base légale |
|---|---|---|
| Livres comptables, pièces justificatives | 10 ans | Art. L123-22 Code commerce |
| Pièces et données fiscales | 6 ans | Art. L102 B LPF |
| Livre de police | 5 ans après dernière écriture | Décret 88-1040 |
| Données personnelles déposants | Durée relation + 3 ans | CNIL |
| Contrats de dépôt | 5 ans après fin contrat | Prescription contractuelle |

**Stratégie Rebond :**
- **10 ans** minimum par défaut sur toutes les données ISCA (couvre la durée la plus longue).
- Archivage automatique dans R2 Archive class après 12 mois.
- Suppression automatique à 10 ans + 1 an de grâce (11 ans), sauf opposition client.
- Notification au client 3 mois avant suppression.

### 2.9 RGPD — obligations spécifiques

**Base légale des traitements :**
- Déposants : exécution du contrat (art. 6.1.b RGPD) pour les données opérationnelles, obligation légale (art. 6.1.c) pour les données livre de police.
- Clients finaux : base légale obligation légale pour conservation fiscale, intérêt légitime pour analytics agrégés.

**Droits des personnes :**
- **Accès** : export des données personnelles en JSON sur demande (endpoint `/account/data-export`).
- **Rectification** : possible via interface, trace dans audit log.
- **Effacement** : possible sauf si conservation légale impose le maintien (livre de police, facturation). Dans ce cas, anonymisation partielle possible à l'issue du délai légal.
- **Portabilité** : export structuré JSON + CSV.
- **Opposition** : opt-out des communications non essentielles (notifications vente non obligatoires).

**Exigences techniques :**
- Chiffrement au repos des PII (numéro pièce d'identité, IBAN) : AES-256-GCM, clés dans Cloudflare Secrets, rotation annuelle.
- Chiffrement en transit : TLS 1.3 uniquement, HSTS preload.
- Logs sans PII (masquage automatique des champs sensibles).
- DPA (Data Processing Agreement) fourni à chaque tenant à la signature.
- Registre des traitements interne à Daidyl, mis à jour à chaque nouveau module.
- Nomination d'un DPO externe si > 250 clients (prévoir budget ~1-2k€/an).

**Sous-traitants à déclarer dans le DPA :**
- Cloudflare (hébergement, UE + US transit) — SCC signées.
- Stripe (paiements) — DPA public.
- Resend (emails transactionnels) — DPA public.
- Sentry (monitoring) — DPA public, config avec scrubbing des PII.

### 2.10 Facturation électronique B2B (roadmap v2)

**Calendrier officiel (au 18 avril 2026) :**
- **1er septembre 2026** : obligation pour toutes les entreprises d'être capables de **recevoir** des factures électroniques (Factur-X, UBL).
- **1er septembre 2026** : obligation d'**émettre** en factures électroniques pour les grandes entreprises (+ 5 000 salariés ou CA > 1,5 Mds€).
- **1er septembre 2027** : extension ETI (250-4 999 salariés).
- **1er septembre 2027** : extension PME et TPE.

**Impact dépôts-ventes :**
- Majoritairement B2C → peu impactés sur émission.
- Mais réception B2B obligatoire (factures fournisseurs : loyers, fournitures) dès sept. 2026.
- Nos clients en mode mixte (boutiques qui vendent aussi à des pros occasionnels) devront émettre en v2.

**Exigence produit v1 :**
- Ne pas bloquer l'évolution : architecture prête à accueillir un module `einvoice`.
- Stocker les données nécessaires (identifiants Chorus Pro/PPF, adresses électroniques de facturation des clients pro).

**Exigence produit v2 :**
- Connecteur PDP (Plateforme de Dématérialisation Partenaire) : probablement Pennylane Connect, Iopole, ou équivalent.
- Génération Factur-X (PDF A/3 avec XML embarqué).
- Cycle de vie de facture : émise / reçue / approuvée / payée / refusée / etc.

### 2.11 Matrice exigences légales → tests produit

Chaque obligation réglementaire se traduit en **test automatisé** :

| Obligation | Test produit | Criticité |
|---|---|---|
| ISCA — Inaltérabilité sales | Tentative UPDATE rejetée en SQL + API | P0 |
| ISCA — Chaînage hash | Vérification séquence sur 10 000 ventes simulées | P0 |
| ISCA — Clôture signée | Signature Ed25519 vérifiable | P0 |
| TVA marge dépôt | Calcul commission × taux / (100+taux) | P0 |
| TVA marge vente à perte | Marge = 0, TVA = 0 (pas négative) | P0 |
| TVA marge cas mixte | Ticket avec 3 régimes différents somme correcte | P0 |
| Livre de police — entrée auto | `item.created` → entrée livre de police instantanée | P0 |
| Livre de police — sortie auto | `item.sold` → entrée sortie instantanée | P0 |
| Livre de police — numérotation | Aucun trou dans la séquence | P0 |
| Ticket — mentions TVA marge | Test de rendu ticket vérifie mention art. 297 A | P0 |
| Espèces — plafond 1 000€ | Paiement espèces > 1 000€ bloqué sans flag non-résident | P1 |
| Franchise TVA — alerte seuil | Alerte à 90% du seuil déclenchée | P1 |
| Conservation — archivage R2 | Clôture auto-archivée après génération | P1 |
| RGPD — export données | Endpoint export retourne toutes données utilisateur | P1 |
| RGPD — effacement | Suppression déposant respecte conservation légale | P1 |
| Numérotation facture — continuité | Pas de trou dans `receipt_number` | P0 |
| Numérotation facture — unicité | Séquence unique par shop | P0 |
| Export FEC | Fichier valide à l'outil de test DGFiP | P0 |

**P0** = bloquant release production. **P1** = bloquant release v1 publique.

---

## 3. Architecture globale

### 3.1 Principes directeurs

1. **Offline-first** — la caisse doit encaisser sans internet. Non négociable.
2. **Edge-first** — tout Cloudflare (Pages, Workers, D1, R2, Queues). Pas de serveur à gérer.
3. **Multi-tenant strict** — isolation logique par `shop_id`, mais base physique partagée pour économie d'échelle (passage à D1 par tenant possible en v3 si besoin).
4. **Modulaire** — noyau minimal + modules optionnels activables par tenant.
5. **Event-driven** — toute action métier émet un événement, les modules secondaires s'y abonnent (facilite connecteurs et audit).
6. **Source of truth serveur** — le client local est un cache optimiste, le serveur arbitre en cas de conflit.
7. **Tests automatisés sur le critique** — tout ce qui touche ISCA, TVA marge, clôtures : tests unitaires obligatoires, coverage ≥ 90% sur ces modules.

### 3.2 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    Tablette / PC / Mac                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PWA Rebond (SvelteKit | Remix)                       │  │
│  │  ├─ Service Worker (cache + offline)                  │  │
│  │  ├─ IndexedDB (articles, déposants, queue sync)       │  │
│  │  └─ UI modulaire (îlots par feature)                  │  │
│  └───────────────────────────────────────────────────────┘  │
│         │                │                    │              │
│         ▼                ▼                    ▼              │
│  [WebUSB printer]  [Stripe Terminal]  [Camera (scan)]       │
└──────────┬──────────────────────────────────────────────────┘
           │ HTTPS (sync différée)
           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare edge network                    │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌────────┐  ┌──────────┐  │
│  │  Pages   │  │   Workers    │  │   D1   │  │    R2    │  │
│  │ (PWA +   │◄─┤  API + core  │──┤SQLite  │  │ Archives │  │
│  │ admin)   │  │  modules     │  │multi-  │  │ long term│  │
│  └──────────┘  └──────┬───────┘  │tenant  │  │ (6 ans)  │  │
│                       │          └────────┘  └──────────┘  │
│                       │                                     │
│              ┌────────┴────────┐                            │
│              ▼                 ▼                            │
│        ┌─────────┐       ┌──────────┐                       │
│        │ Queues  │       │   KV     │                       │
│        │(events, │       │(sessions,│                       │
│        │ hooks)  │       │ config)  │                       │
│        └─────────┘       └──────────┘                       │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│  Services tiers                                             │
│  Stripe (Terminal + Billing) | Resend (emails)              │
│  Sentry (monitoring) | Clerk ou Lucia (auth)                │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Mode offline-first — mécanique détaillée

**Ce qui doit fonctionner offline (100%) :**
- Consultation stock et fiches déposants.
- Création de vente (hors encaissement CB).
- Encaissement espèces, chèque, autre mode manuel.
- Impression ticket.
- Chaînage hash local (signature optimiste).

**Ce qui nécessite la connectivité :**
- Encaissement CB via Stripe Terminal (SDK requiert connexion).
- Création de nouveau déposant (validation KYC doublon serveur).
- Sync articles/prix modifiés depuis le back-office.
- Clôture journalière signée (la signature Z est émise côté serveur).

**Mécanique de synchronisation :**
- Chaque mutation côté client est stockée dans IndexedDB avec un `local_id` (UUID v7) et un statut `pending_sync`.
- Un Service Worker en background tente de pousser la queue dès que connectivité détectée.
- Le serveur attribue un `server_id` et une position dans le chaînage hash définitif.
- En cas de conflit (ex: 2 postes vendent le même article unique), règle last-write-wins sur les métadonnées, mais les ventes sont immuables une fois validées côté serveur.
- Une alerte visible s'affiche tant que la queue > 0 items ou > 5 minutes de retard de sync.

---

## 4. Architecture modulaire

### 4.1 Philosophie

Le produit est décomposé en **Core** (obligatoire) + **Modules métier** (activables par tenant) + **Connecteurs** (intégrations tierces). Chaque module :
- Expose une API interne typée (TypeScript).
- S'abonne / émet des événements via un bus interne (`EventBus`).
- Possède son propre schéma de données (tables préfixées `mod_<nom>_...`).
- Peut être désactivé sans casser le core.

### 4.2 Arborescence cible

```
/apps
  /web                    # PWA principale (SvelteKit/Remix)
  /admin                  # Back-office éditeur (gestion tenants, attestations, SAV)
  /docs                   # Documentation publique (Astro, ton stack maison)

/packages
  /core
    /auth                 # Sessions, RBAC
    /tenant               # Multi-tenancy, isolation
    /event-bus            # Pub/sub interne
    /audit-log            # Append-only log + chaînage hash
    /isca                 # Inaltérabilité, clôtures, archivage
    /ui-kit               # Composants communs (Tailwind + shadcn-svelte)

  /modules
    /depots               # Déposants + contrats
    /catalog              # Articles + catégories + stock
    /caisse               # POS, panier, paiement
    /tva-marge            # Calcul TVA sur marge
    /livre-police         # Tenue + export
    /reversements         # Calcul + suivi reversements déposants
    /reporting            # Z-tickets, stats, exports
    /notifications        # Emails déposants (vente, fin de contrat)

  /connectors
    /printer-escpos       # Impression USB/réseau
    /stripe-terminal      # CB physique
    /stripe-billing       # Facturation SaaS
    /accounting-export    # FEC + formats Pennylane/Dougs
    /ecommerce-sync       # (v2) Prestashop, Shopify, Woo
    /einvoice             # (v2) Factur-X, PDP
    /sms                  # (v2) Notifications SMS déposants

  /shared
    /types                # Types TS partagés
    /utils                # Utilitaires (dates, fiscal, hashing)
    /testing              # Helpers de tests

/infra
  /migrations             # D1 migrations SQL
  /workers                # Workers config wrangler
  /scripts                # Scripts ops (seed, backup, etc.)
```

### 4.3 Contrat module

Chaque module respecte cette interface minimale :

```typescript
// packages/core/types/module.ts
export interface ModuleDefinition {
  id: string;                      // ex: "livre-police"
  version: string;                 // semver
  displayName: string;
  description: string;
  dependencies: string[];          // autres modules requis
  migrations?: Migration[];        // SQL à appliquer
  events: {
    emits: EventType[];
    listens: EventListener[];
  };
  api?: Router;                    // routes HTTP exposées
  ui?: {
    routes?: UIRoute[];
    widgets?: WidgetDefinition[];
  };
  featureFlag?: string;            // pour activation progressive
  pricing?: {
    tier: 'core' | 'standard' | 'pro' | 'addon';
    monthlyPrice?: number;
  };
}
```

### 4.4 EventBus — événements clés du core

Liste non exhaustive, à étendre par module :

| Événement | Émetteur | Payload principal |
|---|---|---|
| `depositor.created` | mod_depots | `{ depositor_id, shop_id, created_by }` |
| `deposit.contract.signed` | mod_depots | `{ contract_id, depositor_id, items[] }` |
| `item.created` | mod_catalog | `{ item_id, depositor_id, contract_id, price }` |
| `item.sold` | mod_caisse | `{ sale_id, item_id, price, payment_method }` |
| `item.returned` | mod_depots | `{ item_id, reason }` |
| `sale.completed` | mod_caisse | `{ sale_id, total, vat_margin_amount, hash }` |
| `sale.refunded` | mod_caisse | `{ sale_id, original_sale_id, amount }` |
| `daily_closure.generated` | mod_isca | `{ closure_id, date, totals, signature }` |
| `reversement.due` | mod_reversements | `{ depositor_id, amount, period }` |
| `reversement.paid` | mod_reversements | `{ reversement_id, method }` |
| `audit.entry` | core | *(toute action critique)* |

Un nouveau connecteur (ex: export vers Pennylane) s'abonne aux événements pertinents sans que les modules émetteurs le sachent.

---

## 5. Modèle de données (core)

### 5.1 Entités principales

```sql
-- Multi-tenant
CREATE TABLE shops (
  id TEXT PRIMARY KEY,               -- UUID v7
  name TEXT NOT NULL,
  siret TEXT NOT NULL,
  vat_number TEXT,
  vat_regime TEXT NOT NULL,          -- 'margin_item' | 'margin_global' | 'normal'
  address TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  currency TEXT NOT NULL DEFAULT 'EUR',
  settings_json TEXT,                -- JSON de config (commissions par défaut, etc.)
  subscription_tier TEXT NOT NULL,   -- 'starter' | 'standard' | 'pro'
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,                -- 'owner' | 'manager' | 'cashier'
  pin_hash TEXT,                     -- PIN 4 chiffres pour bascule rapide en caisse
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  UNIQUE(shop_id, email)
);

-- Déposants
CREATE TABLE depositors (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  external_ref TEXT,                 -- Numéro client custom (ex: "D00123")
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  id_document_type TEXT NOT NULL,    -- 'cni' | 'passport' | 'driver_license'
  id_document_number TEXT NOT NULL,  -- Chiffré au repos
  birth_date TEXT,
  iban TEXT,                          -- Chiffré, pour virements reversement
  default_commission_rate INTEGER,   -- en centièmes de % (ex: 4000 = 40%)
  notes TEXT,
  created_at INTEGER NOT NULL,
  INDEX idx_depositors_shop (shop_id),
  INDEX idx_depositors_name (shop_id, last_name)
);

-- Contrats de dépôt
CREATE TABLE contracts (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  depositor_id TEXT NOT NULL REFERENCES depositors(id),
  number TEXT NOT NULL,              -- Numérotation visible (ex: "2026-0042")
  signed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,       -- typ. +90 jours
  commission_rate INTEGER NOT NULL,  -- figé au moment de la signature
  status TEXT NOT NULL,              -- 'active' | 'expired' | 'closed'
  pdf_r2_key TEXT,                   -- Contrat signé archivé dans R2
  created_at INTEGER NOT NULL,
  UNIQUE(shop_id, number)
);

-- Catalogue articles
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  contract_id TEXT REFERENCES contracts(id),    -- NULL si stock propre boutique
  depositor_id TEXT REFERENCES depositors(id),  -- NULL si stock propre
  sku TEXT,                          -- Code-barre interne (souvent généré)
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  brand TEXT,
  size TEXT,
  condition TEXT,                    -- 'new' | 'excellent' | 'good' | 'fair'
  photos_r2_keys TEXT,               -- JSON array de clés R2
  initial_price INTEGER NOT NULL,    -- centimes
  current_price INTEGER NOT NULL,    -- centimes (peut baisser via dégressivité)
  cost_price INTEGER,                -- centimes, NULL si dépôt pur
  vat_regime TEXT NOT NULL,          -- 'margin_item' | 'normal'
  vat_rate INTEGER NOT NULL,         -- en centièmes (2000 = 20%)
  status TEXT NOT NULL,              -- 'available' | 'sold' | 'returned' | 'shop_owned' | 'destroyed'
  status_changed_at INTEGER NOT NULL,
  entered_at INTEGER NOT NULL,
  sold_at INTEGER,
  created_at INTEGER NOT NULL,
  INDEX idx_items_shop_status (shop_id, status),
  INDEX idx_items_depositor (depositor_id),
  INDEX idx_items_contract (contract_id)
);

-- Règles de dégressivité par contrat ou boutique
CREATE TABLE pricing_rules (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  scope TEXT NOT NULL,               -- 'shop' | 'contract' | 'category'
  scope_id TEXT,
  step_days INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL, -- en centièmes
  max_steps INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

-- Ventes
CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  receipt_number INTEGER NOT NULL,   -- Numérotation continue par shop
  cashier_id TEXT NOT NULL REFERENCES users(id),
  sold_at INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,         -- centimes TTC
  total INTEGER NOT NULL,            -- centimes TTC (après remise éventuelle)
  vat_margin_amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL,      -- 'cash' | 'card' | 'check' | 'transfer' | 'other'
  payment_details_json TEXT,         -- détails Stripe, numéro chèque, etc.
  customer_note TEXT,
  status TEXT NOT NULL,              -- 'completed' | 'refunded' | 'partial_refund'
  previous_hash TEXT NOT NULL,       -- Hash de la vente précédente (chaînage ISCA)
  hash TEXT NOT NULL,                -- SHA-256 de cette vente
  signed_server_at INTEGER,          -- NULL si pas encore synchro
  created_at INTEGER NOT NULL,
  UNIQUE(shop_id, receipt_number),
  INDEX idx_sales_shop_date (shop_id, sold_at)
);

CREATE TABLE sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  item_id TEXT REFERENCES items(id), -- peut être NULL pour vente libre
  name TEXT NOT NULL,                -- snapshotée au moment de la vente
  price INTEGER NOT NULL,            -- centimes
  cost_basis INTEGER,                -- prix d'achat pour calcul marge
  reversement_amount INTEGER,        -- montant à reverser au déposant
  depositor_id TEXT REFERENCES depositors(id),
  vat_regime TEXT NOT NULL,
  vat_rate INTEGER NOT NULL,
  vat_amount INTEGER NOT NULL,       -- montant TVA calculé
  INDEX idx_sale_items_sale (sale_id),
  INDEX idx_sale_items_depositor (depositor_id)
);

-- Reversements aux déposants
CREATE TABLE reversements (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  depositor_id TEXT NOT NULL REFERENCES depositors(id),
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  total_sales INTEGER NOT NULL,
  total_commission INTEGER NOT NULL,
  total_reversement INTEGER NOT NULL,
  status TEXT NOT NULL,              -- 'pending' | 'paid' | 'cancelled'
  payment_method TEXT,               -- 'cash' | 'transfer' | 'check'
  paid_at INTEGER,
  paid_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at INTEGER NOT NULL
);

-- Clôtures (Z journalier, mensuel, annuel)
CREATE TABLE closures (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  type TEXT NOT NULL,                -- 'daily' | 'monthly' | 'yearly'
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  sales_count INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  total_vat INTEGER NOT NULL,
  totals_by_payment_method_json TEXT,
  totals_by_vat_rate_json TEXT,
  first_receipt_number INTEGER,
  last_receipt_number INTEGER,
  previous_closure_hash TEXT,
  hash TEXT NOT NULL,
  signature TEXT NOT NULL,           -- signature serveur
  generated_at INTEGER NOT NULL,
  pdf_r2_key TEXT,
  UNIQUE(shop_id, type, period_start)
);

-- Livre de police (auto-alimenté par triggers/event handlers)
CREATE TABLE police_ledger (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  entry_number INTEGER NOT NULL,     -- Numérotation continue par shop
  entry_type TEXT NOT NULL,          -- 'entry' | 'exit'
  item_id TEXT REFERENCES items(id),
  depositor_id TEXT REFERENCES depositors(id),
  description TEXT NOT NULL,
  depositor_name TEXT NOT NULL,      -- snapshot
  depositor_id_document TEXT NOT NULL, -- snapshot chiffré
  sale_id TEXT REFERENCES sales(id), -- si sortie par vente
  exit_reason TEXT,                  -- 'sold' | 'returned' | 'destroyed' | 'shop_owned'
  recorded_at INTEGER NOT NULL,
  previous_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  UNIQUE(shop_id, entry_number)
);

-- Audit log global (tout événement critique)
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  shop_id TEXT REFERENCES shops(id),
  user_id TEXT REFERENCES users(id),
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  occurred_at INTEGER NOT NULL,
  previous_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  INDEX idx_audit_shop_date (shop_id, occurred_at)
);
```

### 5.2 Règles d'immutabilité

Les tables suivantes sont **append-only strict** (aucun UPDATE/DELETE autorisé après insertion) :
- `sales` (sauf champs techniques : `signed_server_at`)
- `sale_items`
- `closures`
- `police_ledger`
- `audit_log`

Toute « correction » passe par une vente de sens inverse (remboursement) ou une nouvelle entrée au livre de police. Implémentation : triggers SQL `BEFORE UPDATE` qui lèvent une erreur, + validation applicative.

---

## 6. Modules fonctionnels

### 6.1 `core/isca` — Inaltérabilité & archivage (CRITIQUE)

**Responsabilités :**
- Calcul et vérification du chaînage hash sur sales, closures, police_ledger, audit_log.
- Génération des clôtures Z (journalière forcée, mensuelle/annuelle automatique).
- Signature serveur des clôtures (clé asymétrique Ed25519, clé privée dans Cloudflare Secrets).
- Export FEC (Fichier des Écritures Comptables) sur demande.
- Archivage long terme dans R2 (PDF clôtures, JSONL de toutes les transactions, sauvegardes chiffrées).

**Algorithme de chaînage :**
```
hash(N) = SHA-256(
  hash(N-1)
  || canonical_json(payload)
  || receipt_number
  || timestamp_utc
)
```
Le premier enregistrement utilise `hash(-1) = SHA-256("<shop_id>:genesis")`.

**Vérification :**
- Audit complet déclenchable depuis le back-office éditeur (pour SAV / contrôle fiscal).
- Re-calcul séquentiel de tous les hash, comparaison avec stockés, détection de la première divergence.

### 6.2 `mod_depots` — Déposants & contrats

**Fonctionnalités :**
- CRUD déposants avec validation KYC (nom + pièce identité obligatoires avant création de contrat).
- Recherche rapide par nom, téléphone, numéro client.
- Création de contrat de dépôt avec sélection commission (par défaut du déposant ou par défaut boutique).
- Saisie rapide articles (formulaire répétable : nom, prix, catégorie, taille, photo).
- Génération automatique contrat PDF avec liste d'articles, à signer sur écran (tactile) ou imprimer.
- Consultation historique par déposant : articles en cours, vendus, invendus, reversements en attente.

**Edge cases à couvrir :**
- Déposant mineur → tuteur légal à renseigner.
- Duplicat détecté (même nom + date de naissance) → alerte, force la confirmation.
- Contrat expiré → workflow de restitution / bascule en stock boutique / destruction.

### 6.3 `mod_catalog` — Articles & stock

**Fonctionnalités :**
- Génération code-barre automatique (format Code128, 8-10 chiffres avec checksum).
- Impression étiquette avec nom, prix, code-barre, date d'entrée (format 50mm).
- Moteur de dégressivité : tâche CRON quotidienne qui recalcule `current_price` selon règles.
- Photos : upload direct R2 via URL signées (pas de transit par le Worker).
- Recherche full-text via index D1.

### 6.4 `mod_caisse` — Point de vente

**Fonctionnalités :**
- Interface tactile optimisée tablette (cible iPad 10" / Galaxy Tab A).
- Scan code-barre via caméra (lib `@zxing/browser`) ou lecteur USB HID.
- Panier avec multi-articles, remise ligne, remise globale (avec justification obligatoire > 10%).
- Choix mode de paiement avec split possible (moitié cash, moitié CB).
- Intégration Stripe Terminal : émission de `PaymentIntent` puis envoi au lecteur.
- Confirmation sonore + visuelle à la validation.
- Impression ticket en < 2 secondes.
- Mode « vente libre » : article non référencé, prix libre, pour petits accessoires.

**Performances cible :**
- Ajout article au panier : < 100ms.
- Validation vente (hors CB) : < 300ms.
- Impression ticket : < 2s.

### 6.5 `mod_tva_marge` — Calcul fiscal

**Fonctionnalités :**
- Calcul automatique base + TVA pour chaque ligne de vente selon régime de l'article.
- Dépôt-vente : base = commission seulement.
- Achat/revente : base = `prix_vente - prix_achat`, zéro si négatif.
- Gestion mixte : une vente peut contenir des articles à régimes différents (TVA sur marge + TVA normale).
- Mention légale automatique sur ticket selon régime.
- Rapport mensuel : récap TVA par taux, par régime, prêt pour déclaration CA3.

**Tests obligatoires :**
- Tous les cas de calcul (achat, dépôt, mixte, vente à perte, remboursement) ont des tests unitaires avec jeu de données réel. Coverage 100% sur ce module.

### 6.6 `mod_livre_police` — Registre légal

**Fonctionnalités :**
- Insertion automatique à chaque entrée/sortie article, via event listeners.
- Numérotation continue inaltérable (séquence par shop).
- Export PDF (format conforme usages préfecture) et CSV.
- Recherche par déposant, date, description.

### 6.7 `mod_reversements` — Paiement déposants

**Fonctionnalités :**
- Calcul automatique en continu : pour chaque vente liée à un déposant, calcul du dû.
- Vue « Reversements dus » par déposant.
- Génération batch de virements SEPA (fichier XML pain.001) à importer dans la banque.
- Marquage `paid` avec méthode + date.
- Notification email/SMS au déposant (module `notifications`).

### 6.8 `mod_reporting` — Tableaux de bord

**Fonctionnalités :**
- Dashboard journalier : CA, nombre de ventes, panier moyen, top articles, top déposants.
- Vues hebdo/mensuelle/annuelle.
- Export CSV de toute vue.
- Graphiques légers (pas de dataviz lourde, le core reste léger).

### 6.9 `mod_notifications` — Communications déposants

**Fonctionnalités :**
- Emails transactionnels (via Resend) : article vendu, fin de contrat, reversement effectué.
- Templates personnalisables par boutique (le nom de la boutique, logo, signature).
- Opt-out RGPD géré.
- Extension SMS via connecteur `connector_sms` (Twilio ou OVH Telecom).

### 6.10 `admin` — Back-office éditeur (Daidyl)

**Ce que seul Jerome voit :**
- Liste de tous les tenants + MRR, statut abonnement, santé technique.
- Génération d'attestations individuelles ISCA à la demande d'un client (PDF signé).
- Outil de diagnostic : audit chaînage hash d'un tenant, visualisation queue sync, logs Sentry par tenant.
- Feature flags : activation progressive de modules pour un tenant spécifique.
- Impersonation sécurisée (pour SAV, avec trace dans audit log du tenant).

---

## 7. Spécifications ISCA

### 7.1 Inaltérabilité

- Contrainte SQL : triggers `BEFORE UPDATE/DELETE` lèvent exception sur tables append-only.
- Contrainte applicative : aucune route API ne modifie ces tables.
- Chaînage hash côté client ET serveur. Le serveur re-signe définitivement à la sync.
- Horodatage : utilisation de `Date.now()` côté serveur uniquement (le client peut mentir). Le client envoie un timestamp local **indicatif**, le serveur inscrit le timestamp officiel. Écart tolérable client/serveur : ±15 minutes, au-delà alerte.

### 7.2 Sécurisation

- Données au repos chiffrées par Cloudflare (natif D1/R2).
- PII sensibles (numéro pièce d'identité, IBAN) chiffrées **applicativement** avec AES-256-GCM (clés dans Cloudflare Secrets, rotation annuelle).
- Transport : HTTPS uniquement, HSTS, CSP strict.
- Auth : sessions courtes (8h), refresh tokens pour les cashiers via PIN.
- RBAC : `owner` > `manager` > `cashier`. Les clôtures sont réservées owner/manager.

### 7.3 Conservation

- **6 ans minimum** sur toutes les tables ISCA (sales, closures, police_ledger, audit_log).
- Archivage R2 des clôtures en PDF + JSONL, classe `Infrequent Access` après 1 an.
- Script de purge automatique sur 7 ans (avec préavis d'1 an).
- Si un tenant résilie : archives conservées 6 ans minimum + 1 an de grâce (contractuel).

### 7.4 Archivage

**Exports disponibles à tout moment par le client :**
- FEC (norme DGFIP) format ASCII texte, séparateur `|`, encoding UTF-8 BOM.
- Export global JSONL chiffré (backup complet tenant).
- PDFs des clôtures journalières/mensuelles/annuelles.
- Livre de police PDF et CSV.

**Remise en cas de contrôle fiscal :**
- Procédure documentée à destination du client.
- Génération du dossier complet en < 5 minutes depuis le back-office.

---

## 8. Stack technique

### 8.1 Frontend

**Choix recommandé : SvelteKit 2 + TypeScript**
- Pros : excellent support PWA, bundle léger, DX productive pour solo dev, SSR+CSR natif.
- Contras : écosystème plus petit que React.
- Alternative : Remix / React Router v7 si préférence React.
- **Non recommandé : Astro** malgré ta maîtrise. Astro est optimisé pour du statique/éditorial (ce que tu fais sur tes 200 sites), mais une app POS stateful avec state management complexe et offline-first est plus naturelle en SvelteKit.

**Librairies :**
- UI : `shadcn-svelte` + Tailwind CSS 4.
- State : store natif Svelte + `@tanstack/svelte-query` pour data fetching.
- Validation : Zod.
- Formulaires : Superforms.
- Offline : `workbox-sw` pour le Service Worker, Dexie.js pour IndexedDB.
- Scan code-barre : `@zxing/browser`.
- Print : Web USB API + lib ESC/POS maison (ou `node-thermal-printer` port).
- Graphiques : Chart.js.

### 8.2 Backend

- Runtime : Cloudflare Workers.
- Framework : Hono (léger, typé, excellent sur Workers).
- ORM/Query builder : Drizzle ORM (excellent support D1).
- Validation : Zod partagé frontend/backend.

### 8.3 Data

- **D1 (SQLite)** : données transactionnelles (toutes les tables ci-dessus). Limite actuelle ~10GB par base, largement suffisant pour plusieurs centaines de tenants partageant une base.
- **R2** : photos articles, PDFs (contrats, tickets, clôtures), exports.
- **KV** : sessions, cache de config tenant, feature flags.
- **Queues** : traitement asynchrone (emails, génération PDF, webhooks).
- **Durable Objects** : si multi-poste temps réel nécessaire (v2, pas MVP).

### 8.4 Auth

- Choix : **Lucia Auth** (self-hosted, léger, compatible Workers/D1).
- Alternative si Lucia trop lourde à maintenir : **Clerk** (payant à partir de X users mais zero-ops).
- 2FA (TOTP) obligatoire pour rôle `owner`.

### 8.5 Paiement

- **Stripe Terminal** : encaissement CB (SDK JS, lecteur BBPOS WisePOS E ou Stripe Reader S700).
- **Stripe Billing** : abonnement SaaS (Starter 29€, Standard 39€, Pro 59€ — à affiner).

### 8.6 Observabilité

- **Sentry** : erreurs JS + serveur, breadcrumbs, sessions.
- **Axiom** ou **Cloudflare Logpush → R2** : logs structurés.
- **UptimeRobot** ou **BetterStack** : monitoring uptime + statuspage public.

### 8.7 Emails

- **Resend** : transactionnels (templates React Email, domaine custom `noreply@rebond.fr`).

### 8.8 CI/CD

- GitHub Actions.
- Tests unitaires (Vitest) sur chaque PR.
- Déploiement preview automatique sur Cloudflare Pages.
- Déploiement prod sur merge main, après validation manuelle.

---

## 9. Flux utilisateurs clés

### 9.1 Entrée de dépôt

1. Cashier / manager ouvre module Dépôts.
2. Recherche déposant existant ou crée nouveau (KYC si création).
3. Lance « Nouveau contrat », saisit commission si différente du défaut.
4. Mode saisie rapide : pour chaque article, remplir (nom, catégorie, taille, condition, prix), photo optionnelle, `Enter` pour l'article suivant.
5. Validation → génération code-barres, création entrées en livre de police, impression étiquettes (une par article), génération PDF contrat.
6. Signature tactile du déposant (ou impression papier + signature manuelle, scan plus tard).
7. Articles immédiatement en statut `available`, prêts à vendre.

### 9.2 Vente standard

1. Cashier scanne code-barre article.
2. Article ajouté au panier, prix `current_price` affiché.
3. Répéter pour tous les articles.
4. (Optionnel) remise globale.
5. Validation → choix mode de paiement.
   - Si CB → emission `PaymentIntent`, envoi au lecteur Stripe Terminal, attente tap/puce/contactless.
   - Si espèces → saisie montant reçu, calcul rendu.
6. Impression ticket + ouverture tiroir-caisse (si configuré).
7. Articles passent en `sold`, entrées de sortie livre de police, calcul reversements mis à jour.

### 9.3 Vente offline (fallback)

1. Cashier scanne, ajoute, valide.
2. Détection `navigator.onLine === false`.
3. Mode dégradé : CB désactivée, badge rouge « Hors ligne » visible.
4. Saisie paiement espèces/chèque.
5. Calcul hash local provisoire, écriture IndexedDB `pending_sync`.
6. Impression ticket mentionnant « Signature serveur en attente ».
7. Dès reconnexion : sync automatique, serveur attribue receipt_number définitif, recalcule hash si nécessaire.

### 9.4 Remboursement

1. Owner/manager scanne ticket d'origine ou le retrouve par numéro.
2. Sélection des lignes à rembourser (total ou partiel).
3. Saisie motif obligatoire (pour audit).
4. Choix mode de remboursement (mêmes moyens que la vente).
5. Génération d'une « vente » en négatif, article(s) repasse(nt) en `available` (ou en statut `damaged` si ne peut pas être remis en vente), entrée d'annulation au livre de police.
6. Ticket de remboursement imprimé.
7. Si reversement déjà payé au déposant → alerte manager, régularisation manuelle.

### 9.5 Clôture journalière

1. Automatique à minuit heure boutique, ou manuelle depuis le dashboard.
2. Calcul totaux (CA, nb ventes, par mode paiement, par taux TVA, par régime).
3. Génération hash de clôture chaîné avec la précédente.
4. Signature serveur Ed25519.
5. Génération PDF Z-ticket.
6. Archivage R2.
7. Notification email owner (optionnel, paramétrable).

### 9.6 Contrôle fiscal (export)

1. Owner demande « Export contrôle fiscal » sur période X.
2. Génération en arrière-plan : FEC, PDFs clôtures, livre de police.
3. Packagé dans un ZIP chiffré (mot de passe généré aléatoire).
4. Lien de téléchargement temporaire (24h) envoyé par email.
5. Mot de passe envoyé séparément (SMS ou second email).

---

## 10. API et conventions de connecteurs

### 10.1 API interne (entre modules)

- Toutes les communications inter-modules passent par l'EventBus **ou** par des fonctions exportées du module cible.
- Conventions :
  - Types partagés dans `/packages/shared/types`.
  - Pas d'import croisé `modules/A` → `modules/B` sans passer par une interface publique.
  - Chaque module exporte uniquement via son `index.ts` (ce qui n'y est pas = privé).

### 10.2 API externe (REST)

- Base : `https://api.rebond.fr/v1/`
- Authentification : API keys scopées par tenant + permissions granulaires.
- Rate limiting : 100 req/min par défaut, up à 1000 sur plan Pro.

**Endpoints prioritaires à exposer :**
```
GET  /items                   # Liste articles (filtres statut, catégorie, etc.)
POST /items                   # Créer article (pour connecteur import en masse)
GET  /sales                   # Historique ventes
GET  /depositors              # Liste déposants
GET  /reversements            # Reversements dus
GET  /reports/vat             # Rapport TVA sur période
GET  /export/fec?from=&to=    # Export FEC
```

### 10.3 Webhooks sortants

Configurables par tenant : URL(s) cible + événements souscrits + secret de signature (HMAC SHA-256).

**Événements disponibles :**
- `item.created`, `item.sold`, `item.returned`
- `sale.completed`, `sale.refunded`
- `depositor.created`
- `reversement.due`, `reversement.paid`
- `contract.expiring` (J-7), `contract.expired`

### 10.4 Convention de développement d'un connecteur

Un connecteur est un module qui :
1. S'abonne à des événements du core (pas à des modules métier directement — toujours passer par EventBus).
2. Expose éventuellement des routes HTTP (UI de config, OAuth callback, etc.).
3. Possède sa propre table de config tenant (`conn_<nom>_config`).
4. Est activable/désactivable par tenant sans redémarrage.
5. Respecte l'interface `ModuleDefinition` (cf §4.3).

**Connecteurs prévus v1 :**
- `printer-escpos` (core, activé par défaut)
- `stripe-terminal` (core)
- `stripe-billing` (admin only)
- `accounting-export` (manuel, export FEC + formats spécifiques Pennylane, Dougs, Cegid)

**Connecteurs roadmap v2+ :**
- `ecommerce-sync-prestashop` : push stock sur site Presta
- `ecommerce-sync-shopify`
- `ecommerce-sync-woocommerce`
- `einvoice-pdp` : connexion à une Plateforme Agréée pour facturation électronique
- `sms-twilio` / `sms-ovh` : notifications SMS
- `marketplace-vinted` : cross-posting automatique (si API Vinted ouvre)
- `label-zebra` : impression étiquettes Zebra ZD220 et similaires
- `scale-integration` : balance connectée pour friperies au poids

---

## 11. Sécurité et conformité

### 11.1 Surface d'attaque et mitigations

| Risque | Mitigation |
|---|---|
| SQLi | ORM Drizzle, requêtes paramétrées uniquement |
| XSS | Svelte échappe par défaut, CSP strict, pas de `{@html}` sur input utilisateur |
| CSRF | Tokens SameSite strict + header `Origin` vérifié |
| Session hijacking | Sessions httpOnly+secure+SameSite=strict, TTL court |
| Brute force login | Rate limiting IP + captcha après 5 échecs |
| Fuite données tenant | Isolation `shop_id` dans CHAQUE requête (middleware obligatoire) |
| Exfiltration PII | Chiffrement applicatif, logs sans PII |
| Compromission lecteur CB | Stripe gère PCI, aucun numéro carte ne transite chez nous |
| Prompt injection (si IA) | AI dans admin uniquement, pas exposée utilisateur final en v1 |

### 11.2 Audit de sécurité

- Audit automatique bi-annuel (checklist OWASP ASVS niveau 2).
- Pentest externe avant v1.0 public (budget ~3-5k€).
- Politique divulgation responsable publiée sur `/security.txt`.

### 11.3 Conformité légale

- CGV et CGU spécifiques éditeur de logiciel (rédigées avec avocat, budget ~1.5k€).
- DPA type (Data Processing Agreement) disponible.
- Registre des traitements interne.
- Nomination DPO externe si > 250 clients.

---

## 12. Phases de développement

### 12.1 Phase 0 — Validation marché (2 semaines)

**Avant d'écrire du code :**
- 5 entretiens terrain avec dépôts-ventes (Landes/Pays Basque, Bordeaux, autres via ton réseau).
- Validation pricing (29/39/59€).
- Signature de lettres d'intention pilote (3 minimum).
- Réservation noms : domaine, compte Stripe, Twitter/X, INPI.

### 12.2 Phase 1 — MVP démontrable (3 semaines)

**Scope :**
- Core `auth`, `tenant`, `audit-log`, `isca` (basique).
- Modules `depots`, `catalog`, `caisse`, `tva-marge`, `livre-police` (minimal).
- Connecteur `printer-escpos` (impression ticket).
- UI web minimale, pas encore optimisée tablette.
- **Pas encore de Stripe Terminal** — caisse cash/chèque/CB manuelle uniquement.
- Déploiement sur `app-preview.rebond.fr`.

**Critère de sortie :** Jerome peut faire une vente de bout en bout pour son client test.

### 12.3 Phase 2 — Production-ready pilote (5 semaines)

**Scope :**
- Offline-first robuste (Service Worker + IndexedDB + queue sync).
- Connecteur `stripe-terminal` complet (tous cas : refus, annulation, remboursement).
- Module `reversements` complet avec export SEPA.
- Module `reporting` basique (dashboard journalier + exports).
- Module `notifications` (emails transactionnels Resend).
- Clôtures journalières signées + archivage R2.
- UI optimisée tablette (iPad + Android).
- Back-office admin avec génération attestations ISCA.
- Onboarding guidé (wizard 5 étapes).
- Documentation utilisateur (Astro, sur `docs.rebond.fr`).
- Déploiement prod sur `app.rebond.fr`.

**Critère de sortie :** 1er pilote en caisse réelle, 1 semaine de tests live sans bug bloquant.

### 12.4 Phase 3 — Industrialisation & lancement (8 semaines)

**Scope :**
- Facturation SaaS via Stripe Billing.
- Connecteur `accounting-export` (FEC + Pennylane + Dougs).
- Tests de charge (100 ventes/min par tenant).
- Pentest externe.
- Monitoring production complet (Sentry + Axiom + BetterStack).
- Procédures SAV documentées.
- Site commercial (Astro — ton stack habituel, pas de raison de changer).
- Stratégie SEO local dépôt-vente (ton terrain de jeu naturel).

**Critère de sortie :** Ouverture inscriptions publiques, objectif 10 clients payants en 3 mois post-lancement.

### 12.5 Phase 4+ — Évolution (continuous)

Priorisation selon retour pilotes et signal marché. Candidats :
- Module e-commerce sync (Prestashop en premier si demande forte).
- Connecteur SMS déposants.
- App mobile native pour consultation stock (PWA peut suffire en fait).
- Support multi-boutiques pour franchises naissantes.
- Module RFID pour inventaire rapide (si un pilote le demande).
- Connecteur facturation électronique (obligation qui monte).
- Certification NF525 officielle (si >200 clients, ROI justifié).

---

## 13. Tests et qualité

Les tests ne sont pas négociables sur ce produit. Une erreur dans `mod_tva_marge`, `core/isca` ou `mod_livre_police` expose directement Jerome (éditeur attestant) et le client (redressement fiscal 7 500€ par caisse). Cette section définit la stratégie, les seuils, les jeux de données, et fournit des implémentations de référence.

### 13.1 Philosophie

1. **Pas de déploiement production sans tests verts.** Le pipeline CI bloque le merge sur échec.
2. **Tests comme spécification exécutable** : chaque exigence fiscale de la §2 a un test correspondant qui documente le comportement attendu.
3. **Jeux de données réels ou représentatifs** : on ne teste pas avec des valeurs jouets, on teste avec des prix en centimes, des dates avec fuseaux, des arrondis bancaires.
4. **Mutation testing** sur les modules critiques (ISCA, TVA marge) : l'outil Stryker modifie le code source, les tests doivent détecter la mutation. Score cible : ≥ 85%.
5. **Tests déterministes** : injection systématique de l'horloge, du RNG, des générateurs d'ID. Aucun `Date.now()` ou `Math.random()` dans le code de production testable.

### 13.2 Pyramide de tests — seuils et outils

| Niveau | Outil | Cible coverage | Vitesse | Fréquence |
|---|---|---|---|---|
| Unit | Vitest | ≥ 80% global, **100% ISCA/TVA marge/livre police** | < 30s total | Chaque `save` |
| Integration | Vitest + Miniflare + D1 local | Tous endpoints API critiques | < 3 min | Chaque PR |
| Mutation | Stryker | ≥ 85% sur critiques | 10-15 min | Nightly |
| E2E | Playwright | Flows critiques (8-10 scénarios) | < 5 min | Chaque PR sur `main` |
| Charge | k6 | 100 ventes/min × 10 tenants | Manuel | Avant release majeure |
| Sécurité | OWASP ZAP + audit manuel | Checklist OWASP ASVS 2 | Manuel | Trimestriel |
| Offline | Checklist manuelle | 100% points critiques | ~2h | Avant release |
| FEC | Outil DGFIP officiel | Fichier valide sur jeu d'1 an | Manuel | Avant release et à chaque changement FEC |

### 13.3 Structure et conventions

```
packages/modules/tva-marge/
├── src/
│   ├── calculator.ts           # Logique pure
│   ├── types.ts
│   └── index.ts
├── tests/
│   ├── calculator.test.ts      # Tests unitaires
│   ├── integration.test.ts     # Tests d'intégration module
│   ├── fixtures/
│   │   ├── sales.json          # Cas de vente réels
│   │   ├── deposits.json
│   │   └── expected-vat.json   # Résultats attendus (source de vérité)
│   └── __mutation__.config.js  # Config Stryker
```

**Conventions :**
- Fichiers de test : suffixe `.test.ts`.
- Un test = **un comportement** vérifié. Pas de tests qui testent 5 choses.
- Nommage : `describe('<module/fonction>')` + `it('should <comportement attendu dans le cas X>')`.
- Fixtures JSON versionnées pour les cas fiscaux (référence légale en commentaire).
- AAA : Arrange, Act, Assert — structure claire.

### 13.4 Tests du module `mod_tva_marge` — 100% coverage obligatoire

**Jeu de données de référence** — `fixtures/vat-margin-cases.json` :

```json
{
  "cases": [
    {
      "id": "deposit-standard-20",
      "description": "Dépôt standard, commission 40%, TVA 20%",
      "legalRef": "Art. 297 A CGI, régime intermédiaire opaque",
      "input": {
        "regime": "deposit",
        "salePriceCents": 6000,
        "commissionRateBps": 4000,
        "vatRateBps": 2000
      },
      "expected": {
        "commissionCents": 2400,
        "reversementCents": 3600,
        "vatBaseTtcCents": 2400,
        "vatAmountCents": 400,
        "commissionHtCents": 2000
      }
    },
    {
      "id": "deposit-commission-50",
      "description": "Dépôt textile haut de gamme, commission 50%",
      "input": {
        "regime": "deposit",
        "salePriceCents": 12000,
        "commissionRateBps": 5000,
        "vatRateBps": 2000
      },
      "expected": {
        "commissionCents": 6000,
        "reversementCents": 6000,
        "vatBaseTtcCents": 6000,
        "vatAmountCents": 1000,
        "commissionHtCents": 5000
      }
    },
    {
      "id": "resale-occasion-profit",
      "description": "Achat/revente occasion avec marge",
      "legalRef": "Art. 297 A CGI, régime revendeur biens d'occasion",
      "input": {
        "regime": "resale_item_by_item",
        "costPriceCents": 3000,
        "salePriceCents": 8000,
        "vatRateBps": 2000
      },
      "expected": {
        "marginCents": 5000,
        "vatBaseTtcCents": 5000,
        "vatAmountCents": 833,
        "marginHtCents": 4167
      }
    },
    {
      "id": "resale-at-loss",
      "description": "Vente à perte — pas de TVA négative",
      "legalRef": "Art. 297 A CGI : marge ≤ 0 → TVA = 0",
      "input": {
        "regime": "resale_item_by_item",
        "costPriceCents": 5000,
        "salePriceCents": 4000,
        "vatRateBps": 2000
      },
      "expected": {
        "marginCents": 0,
        "vatBaseTtcCents": 0,
        "vatAmountCents": 0,
        "marginHtCents": 0
      }
    },
    {
      "id": "resale-equal-price",
      "description": "Vente au prix d'achat — marge nulle",
      "input": {
        "regime": "resale_item_by_item",
        "costPriceCents": 5000,
        "salePriceCents": 5000,
        "vatRateBps": 2000
      },
      "expected": {
        "marginCents": 0,
        "vatAmountCents": 0
      }
    },
    {
      "id": "deposit-rounding-case",
      "description": "Cas d'arrondi — commission 33,33% sur 99€",
      "input": {
        "regime": "deposit",
        "salePriceCents": 9900,
        "commissionRateBps": 3333,
        "vatRateBps": 2000
      },
      "expected": {
        "commissionCents": 3300,
        "reversementCents": 6600,
        "vatBaseTtcCents": 3300,
        "vatAmountCents": 550,
        "commissionHtCents": 2750
      }
    },
    {
      "id": "vat-reduced-rate-55",
      "description": "Livre d'occasion TVA sur marge taux 5,5%",
      "input": {
        "regime": "resale_item_by_item",
        "costPriceCents": 500,
        "salePriceCents": 1200,
        "vatRateBps": 550
      },
      "expected": {
        "marginCents": 700,
        "vatAmountCents": 36,
        "marginHtCents": 664
      }
    },
    {
      "id": "global-margin-positive",
      "description": "TVA marge globale mensuelle positive",
      "input": {
        "regime": "resale_global_period",
        "purchasesCents": 50000,
        "salesCents": 85000,
        "vatRateBps": 2000
      },
      "expected": {
        "globalMarginCents": 35000,
        "vatAmountCents": 5833
      }
    },
    {
      "id": "global-margin-negative-carryover",
      "description": "TVA marge globale négative — report sur période suivante",
      "input": {
        "regime": "resale_global_period",
        "purchasesCents": 80000,
        "salesCents": 50000,
        "vatRateBps": 2000,
        "carryoverPreviousCents": 0
      },
      "expected": {
        "globalMarginCents": -30000,
        "vatAmountCents": 0,
        "carryoverToNextCents": -30000
      }
    }
  ]
}
```

**Implémentation de test référence** — `packages/modules/tva-marge/tests/calculator.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { calculateVatMargin } from '../src/calculator';
import cases from './fixtures/vat-margin-cases.json';

describe('TVA sur marge — calculateur', () => {
  describe.each(cases.cases)('Cas $id: $description', (testCase) => {
    it(`doit calculer correctement selon ${testCase.legalRef ?? 'cas standard'}`, () => {
      const result = calculateVatMargin(testCase.input);

      for (const [key, expectedValue] of Object.entries(testCase.expected)) {
        expect(result[key], `champ "${key}" incorrect`).toBe(expectedValue);
      }
    });
  });

  describe('Cas limites', () => {
    it('refuse un taux de commission > 100%', () => {
      expect(() =>
        calculateVatMargin({
          regime: 'deposit',
          salePriceCents: 1000,
          commissionRateBps: 10001,
          vatRateBps: 2000,
        })
      ).toThrow(/taux de commission invalide/i);
    });

    it('refuse un taux TVA négatif', () => {
      expect(() =>
        calculateVatMargin({
          regime: 'deposit',
          salePriceCents: 1000,
          commissionRateBps: 4000,
          vatRateBps: -1,
        })
      ).toThrow(/taux tva invalide/i);
    });

    it('gère prix de vente à 0 centime', () => {
      const result = calculateVatMargin({
        regime: 'deposit',
        salePriceCents: 0,
        commissionRateBps: 4000,
        vatRateBps: 2000,
      });
      expect(result.vatAmountCents).toBe(0);
      expect(result.commissionCents).toBe(0);
    });

    it('arrondit les centimes au plus proche (banker\'s rounding)', () => {
      const result = calculateVatMargin({
        regime: 'deposit',
        salePriceCents: 333,
        commissionRateBps: 5000,
        vatRateBps: 2000,
      });
      expect(result.commissionCents).toBe(167);
      expect(result.vatAmountCents).toBe(28);
    });
  });

  describe('Invariants', () => {
    it('commission HT + TVA = commission TTC (toujours)', () => {
      for (const c of cases.cases) {
        if (c.input.regime !== 'deposit') continue;
        const result = calculateVatMargin(c.input);
        expect(result.commissionHtCents + result.vatAmountCents).toBe(result.commissionCents);
      }
    });

    it('reversement + commission = prix de vente (dépôt-vente)', () => {
      for (const c of cases.cases) {
        if (c.input.regime !== 'deposit') continue;
        const result = calculateVatMargin(c.input);
        expect(result.reversementCents + result.commissionCents).toBe(c.input.salePriceCents);
      }
    });

    it('TVA n\'est jamais négative', () => {
      for (const c of cases.cases) {
        const result = calculateVatMargin(c.input);
        expect(result.vatAmountCents).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
```

**Règles d'arithmétique critiques à tester :**
- Tous les montants sont en **centimes entiers** (jamais de `number` flottant dans la logique métier).
- Arrondi bancaire (`half-to-even`) pour la TVA : conforme à la doctrine administrative.
- Utilisation de `BigInt` pour les agrégats mensuels/annuels (risque de dépassement `Number.MAX_SAFE_INTEGER` au-delà de 90 000 000 000 centimes = 900 millions €, peu probable mais sûr).
- Le taux TVA est stocké en **basis points** (bps) : 20% = 2000, 5,5% = 550. Évite les erreurs de virgule flottante.
- Le taux de commission est stocké en basis points : 40% = 4000.

### 13.5 Tests du module `core/isca` — chaînage hash et immutabilité

**Test de chaînage — simulation 10 000 ventes** :

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createHashChain, verifyHashChain } from '../src/hash-chain';
import { generateFakeSales } from './fixtures/sale-generator';

describe('ISCA — chaînage hash des ventes', () => {
  it('chaîne 10 000 ventes consécutives sans dérive', () => {
    const shopId = 'shop_test_hash';
    const sales = generateFakeSales(10_000, shopId);
    let previousHash = getGenesisHash(shopId);
    const chain = [];

    for (const sale of sales) {
      const hash = createHashChain({ ...sale, previousHash });
      chain.push({ ...sale, previousHash, hash });
      previousHash = hash;
    }

    const result = verifyHashChain(chain, shopId);
    expect(result.valid).toBe(true);
    expect(result.firstDivergenceAt).toBeNull();
  });

  it('détecte une altération sur la vente #4273', () => {
    const shopId = 'shop_test_alter';
    const sales = generateFakeSales(10_000, shopId);
    const chain = buildChain(sales, shopId);

    chain[4272].total += 1;

    const result = verifyHashChain(chain, shopId);
    expect(result.valid).toBe(false);
    expect(result.firstDivergenceAt).toBe(4272);
  });

  it('détecte une insertion frauduleuse au milieu de la chaîne', () => {
    const shopId = 'shop_test_insert';
    const sales = generateFakeSales(1000, shopId);
    const chain = buildChain(sales, shopId);

    const fakeSale = {
      ...sales[500],
      id: 'fake-inserted',
      total: 9999,
      previousHash: chain[499].hash,
    };
    chain.splice(500, 0, { ...fakeSale, hash: createHashChain(fakeSale) });

    const result = verifyHashChain(chain, shopId);
    expect(result.valid).toBe(false);
    expect(result.firstDivergenceAt).toBe(501);
  });

  it('détecte une suppression de vente', () => {
    const shopId = 'shop_test_delete';
    const sales = generateFakeSales(1000, shopId);
    const chain = buildChain(sales, shopId);

    chain.splice(500, 1);

    const result = verifyHashChain(chain, shopId);
    expect(result.valid).toBe(false);
  });

  it('chaîne reste valide après clôture journalière', () => {
    const chain = buildChain(generateFakeSales(200, 'shop_closure'), 'shop_closure');
    const closure = generateDailyClosure(chain);

    expect(verifyHashChain([...chain, closure], 'shop_closure').valid).toBe(true);
  });
});
```

**Tests d'immutabilité SQL (niveau base de données) :**

```typescript
import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers/test-db';

describe('ISCA — immutabilité au niveau D1', () => {
  let db;
  beforeEach(async () => { db = await getTestDb(); });

  it('UPDATE sur sales après insertion est rejeté', async () => {
    await db.exec(`INSERT INTO sales (id, shop_id, receipt_number, total, hash, previous_hash, sold_at, created_at, cashier_id, subtotal, vat_margin_amount, payment_method, status) VALUES ('sale_1', 'shop_1', 1, 10000, 'hash1', 'genesis', ${Date.now()}, ${Date.now()}, 'u1', 10000, 1667, 'cash', 'completed')`);

    await expect(
      db.exec(`UPDATE sales SET total = 20000 WHERE id = 'sale_1'`)
    ).rejects.toThrow(/immutable/i);
  });

  it('DELETE sur police_ledger est rejeté', async () => {
    await db.exec(`INSERT INTO police_ledger (...) VALUES (...)`);
    await expect(
      db.exec(`DELETE FROM police_ledger WHERE id = 'entry_1'`)
    ).rejects.toThrow(/immutable/i);
  });

  it('UPDATE sur le champ signed_server_at est autorisé (exception documentée)', async () => {
    await db.exec(`INSERT INTO sales (...) VALUES (...)`);
    await expect(
      db.exec(`UPDATE sales SET signed_server_at = ${Date.now()} WHERE id = 'sale_1'`)
    ).resolves.toBeDefined();
  });
});
```

**Tests de clôture journalière :**

```typescript
describe('ISCA — clôtures journalières', () => {
  it('signature Ed25519 vérifiable avec clé publique', async () => {
    const closure = await generateDailyClosure(shopId, '2026-04-15');
    const isValid = await verifySignature(
      closure.data,
      closure.signature,
      getPublicKey(shopId)
    );
    expect(isValid).toBe(true);
  });

  it('impossible de générer 2 clôtures pour le même jour', async () => {
    await generateDailyClosure(shopId, '2026-04-15');
    await expect(
      generateDailyClosure(shopId, '2026-04-15')
    ).rejects.toThrow(/déjà clôturé/i);
  });

  it('totaux de clôture correspondent à la somme des ventes du jour', async () => {
    const sales = await getSalesByDay(shopId, '2026-04-15');
    const expectedTotal = sales.reduce((sum, s) => sum + s.total, 0);

    const closure = await generateDailyClosure(shopId, '2026-04-15');
    expect(closure.totalAmount).toBe(expectedTotal);
    expect(closure.salesCount).toBe(sales.length);
  });
});
```

### 13.6 Tests du module `mod_livre_police`

**Jeu de cas d'entrée et de sortie** :

```typescript
describe('Livre de police — obligations art. 321-7 CP', () => {
  it('crée automatiquement une entrée quand un article est déposé', async () => {
    const depositor = await createDepositor({ firstName: 'Marie', lastName: 'Martin', idNumber: '...' });
    const contract = await createContract({ depositorId: depositor.id });
    const item = await addItemToContract({ contractId: contract.id, name: 'Veste cuir' });

    const entries = await getLedgerEntries({ itemId: item.id });
    expect(entries).toHaveLength(1);
    expect(entries[0].entryType).toBe('entry');
    expect(entries[0].depositorName).toBe('MARTIN Marie');
    expect(entries[0].depositorIdDocument).toBeDefined();
  });

  it('crée automatiquement une entrée de sortie à la vente', async () => {
    const item = await setupItemInStock();
    await sellItem({ itemId: item.id });

    const entries = await getLedgerEntries({ itemId: item.id });
    expect(entries).toHaveLength(2);
    expect(entries[1].entryType).toBe('exit');
    expect(entries[1].exitReason).toBe('sold');
  });

  it('numérotation continue sans trou sur 1000 opérations', async () => {
    const shopId = 'shop_ledger_test';
    for (let i = 0; i < 1000; i++) {
      await addItemToStock({ shopId });
    }

    const entries = await getAllLedgerEntries({ shopId });
    const numbers = entries.map(e => e.entryNumber).sort((a, b) => a - b);

    for (let i = 0; i < numbers.length; i++) {
      expect(numbers[i]).toBe(i + 1);
    }
  });

  it('entrée contient tous les champs obligatoires du décret 88-1040', async () => {
    const entry = await createLedgerEntry();
    expect(entry).toMatchObject({
      entryNumber: expect.any(Number),
      recordedAt: expect.any(Number),
      description: expect.any(String),
      depositorName: expect.any(String),
      depositorIdDocument: expect.any(String),
      hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      previousHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('export PDF contient toutes les entrées d\'une période', async () => {
    const pdfBuffer = await exportLedgerPdf({
      shopId: 'shop_1',
      from: '2026-01-01',
      to: '2026-03-31',
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    const text = await extractPdfText(pdfBuffer);
    expect(text).toContain('Livre de police');
    expect(text).toContain('SIRET');
  });

  it('tentative de modification d\'une entrée est bloquée', async () => {
    const entry = await createLedgerEntry();
    await expect(
      updateLedgerEntry(entry.id, { description: 'nouveau' })
    ).rejects.toThrow();
  });

  it('rejette création d\'entrée sans pièce d\'identité', async () => {
    await expect(
      createDepositor({ firstName: 'Jean', lastName: 'Sans-Papier' })
    ).rejects.toThrow(/pièce d'identité.*obligatoire/i);
  });
});
```

### 13.7 Tests d'intégration — flux complets

```typescript
describe('Flux complet — dépôt, vente, clôture, export', () => {
  it('scénario e2e : dépôt → vente → reversement → clôture → export FEC', async () => {
    const shop = await createShop({ vatRegime: 'margin_item' });
    const cashier = await createUser({ shopId: shop.id, role: 'cashier' });

    const depositor = await createDepositor({
      shopId: shop.id,
      firstName: 'Marie',
      lastName: 'Martin',
      idDocumentType: 'cni',
      idDocumentNumber: '123456789',
    });

    const contract = await createContract({
      shopId: shop.id,
      depositorId: depositor.id,
      commissionRateBps: 4000,
    });

    const item = await addItemToContract({
      contractId: contract.id,
      name: 'Robe',
      priceCents: 6000,
    });

    const sale = await createSale({
      shopId: shop.id,
      cashierId: cashier.id,
      items: [{ itemId: item.id, priceCents: 6000 }],
      paymentMethod: 'cash',
    });

    expect(sale.total).toBe(6000);
    expect(sale.vatMarginAmount).toBe(400);

    const reversement = await getReversementForSale(sale.id);
    expect(reversement.amountCents).toBe(3600);
    expect(reversement.status).toBe('pending');

    const ledgerEntries = await getLedgerEntries({ shopId: shop.id });
    expect(ledgerEntries).toHaveLength(2);

    const closure = await generateDailyClosure(shop.id, today());
    expect(closure.totalAmount).toBe(6000);
    expect(closure.totalVat).toBe(400);

    const fecFile = await exportFec({ shopId: shop.id, year: 2026 });
    expect(fecFile).toContain('JournalCode');
    expect(fecFile).toContain('6000');
  });
});
```

### 13.8 Tests offline — checklist obligatoire

À exécuter manuellement avant chaque release majeure, sur vraie tablette connectée à wifi puis déconnectée :

- [ ] **Coupure réseau pendant vente CB** : la vente est rollback proprement, message clair au cashier.
- [ ] **Coupure réseau avant paiement cash** : paiement accepté, mise en queue, visible dans indicateur "X ventes en attente de sync".
- [ ] **50 ventes consécutives en mode avion** : toutes enregistrées localement, numérotation locale temporaire.
- [ ] **Retour online après 2h offline** : sync automatique, numérotation serveur re-attribuée, aucune perte.
- [ ] **Horloge client avec 1h d'avance** : serveur détecte le drift, normalise, alerte si > 15 min.
- [ ] **Horloge client avec 24h de retard** : rejet de la transaction avec message d'erreur clair.
- [ ] **2 tablettes connectées, 1 article unique, tentative de vente simultanée offline** : à la sync, une seule vente retenue, l'autre en erreur "déjà vendu".
- [ ] **Fermeture brutale du navigateur pendant sync** : reprise propre au redémarrage, pas de double-envoi.
- [ ] **Impression ticket en mode offline** : fonctionne, mention "Signature serveur en attente" sur le ticket.
- [ ] **Stockage IndexedDB rempli à 80%** : alerte visible, purge auto des données synchronisées > 7 jours.

### 13.9 Tests de conformité FEC

Le Fichier des Écritures Comptables doit être valide selon la spécification DGFiP (formulaire 229-F-SD).

**Outil officiel :** `Test Compta Demat` (téléchargeable sur impots.gouv.fr).

**Test automatisé :**

```typescript
describe('Export FEC — conformité DGFiP', () => {
  it('format de fichier conforme', async () => {
    const fec = await exportFec({ shopId: 'shop_test', year: 2026 });
    const lines = fec.split('\n');

    // En-tête obligatoire, 18 colonnes séparées par |
    expect(lines[0].split('|')).toHaveLength(18);
    expect(lines[0]).toContain('JournalCode|JournalLib|EcritureNum');
  });

  it('toutes les lignes ont 18 colonnes', async () => {
    const fec = await exportFec({ shopId: 'shop_test', year: 2026 });
    const lines = fec.split('\n').filter(l => l.trim());

    for (const [i, line] of lines.entries()) {
      expect(line.split('|'), `ligne ${i + 1}`).toHaveLength(18);
    }
  });

  it('encoding UTF-8 avec BOM', async () => {
    const fec = await exportFecBuffer({ shopId: 'shop_test', year: 2026 });
    expect(fec[0]).toBe(0xEF);
    expect(fec[1]).toBe(0xBB);
    expect(fec[2]).toBe(0xBF);
  });

  it('équilibre débit/crédit par écriture', async () => {
    const fec = await exportFec({ shopId: 'shop_test', year: 2026 });
    const parsed = parseFec(fec);

    const byEntry = groupBy(parsed.lines, 'ecritureNum');
    for (const [num, lines] of Object.entries(byEntry)) {
      const totalDebit = sumBy(lines, 'debit');
      const totalCredit = sumBy(lines, 'credit');
      expect(totalDebit, `écriture ${num} non équilibrée`).toBeCloseTo(totalCredit, 2);
    }
  });

  it('chronologie respectée', async () => {
    const fec = await exportFec({ shopId: 'shop_test', year: 2026 });
    const parsed = parseFec(fec);

    for (let i = 1; i < parsed.lines.length; i++) {
      expect(parsed.lines[i].ecritureDate)
        .toBeGreaterThanOrEqual(parsed.lines[i - 1].ecritureDate);
    }
  });
});
```

### 13.10 Mutation testing — détection des trous de couverture

Un coverage à 100% ne garantit pas que les tests sont efficaces. Un test peut exécuter une ligne sans vérifier son comportement. Stryker modifie le code source (remplace `>` par `>=`, inverse booléens, etc.) et vérifie que les tests détectent la mutation.

**Configuration `stryker.conf.js` pour modules critiques :**

```javascript
module.exports = {
  mutate: [
    'packages/modules/tva-marge/src/**/*.ts',
    'packages/core/isca/src/**/*.ts',
    'packages/modules/livre-police/src/**/*.ts',
  ],
  testRunner: 'vitest',
  thresholds: { high: 90, low: 85, break: 80 },
  reporters: ['html', 'clear-text', 'progress'],
};
```

Score cible : **≥ 85%** sur ces modules. En dessous → les tests sont insuffisants, il faut en ajouter avant release.

### 13.11 CI/CD — pipeline GitHub Actions

```yaml
name: CI
on: [pull_request, push]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit --coverage
      - uses: codecov/codecov-action@v4
      - name: Vérif coverage critiques
        run: |
          pnpm coverage:check --module mod_tva_marge --min 100
          pnpm coverage:check --module core_isca --min 100
          pnpm coverage:check --module mod_livre_police --min 100

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install --with-deps
      - run: pnpm test:e2e

  mutation-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:mutation
      - uses: actions/upload-artifact@v4
        with: { name: mutation-report, path: reports/mutation/ }
```

### 13.12 Release checklist — obligatoire avant déploiement production

À valider manuellement avant chaque déploiement en production :

**Tests automatisés :**
- [ ] CI verte sur `main`, tous les jobs.
- [ ] Coverage ≥ 80% global, 100% sur modules critiques.
- [ ] Score mutation ≥ 85% sur modules critiques.
- [ ] Aucun test flaky détecté sur les 20 dernières runs.

**Conformité fiscale :**
- [ ] Export FEC validé par l'outil DGFiP sur jeu de données d'1 an.
- [ ] Livre de police testé par export PDF + vérification visuelle des champs obligatoires.
- [ ] Attestation ISCA générée et validée juridiquement (lecture avocat au moins 1 fois).
- [ ] Calculs TVA marge comparés manuellement sur 10 cas avec un expert-comptable (validation one-shot puis mise à jour si réglementation change).

**Conformité technique :**
- [ ] Pentest externe réalisé < 6 mois (phase 3 et ultérieures).
- [ ] Backup D1 testé par restauration complète.
- [ ] Chaînage hash vérifié sur 100 000 ventes simulées (perf + exactitude).
- [ ] Migration DB dry-run sur staging sans erreur.

**Conformité RGPD :**
- [ ] DPA à jour avec la liste actuelle des sous-traitants.
- [ ] Registre des traitements à jour.
- [ ] Procédure d'export données personnelles testée.
- [ ] Procédure d'effacement testée (avec respect conservation légale).

**Ops :**
- [ ] Runbook à jour pour les incidents P0/P1.
- [ ] Monitoring Sentry actif, alertes configurées.
- [ ] Statuspage publique mise à jour.
- [ ] Rollback testé et documenté.

---

## 14. Déploiement et ops

### 14.1 Environnements

- `local` : Miniflare + D1 local + R2 émulé (Wrangler dev).
- `preview` : déploiement automatique par PR sur `*.rebond-preview.dev`.
- `staging` : `staging.rebond.fr`, base D1 séparée, Stripe test mode.
- `production` : `app.rebond.fr`, base D1 prod, Stripe live.

### 14.2 Migrations DB

- Une migration = un fichier numéroté `NNNN_nom.sql`.
- Appliquées séquentiellement via `wrangler d1 migrations apply`.
- Jamais de migration destructive sur prod sans sauvegarde R2 préalable.
- Dry-run obligatoire sur staging avant prod.

### 14.3 Sauvegardes

- Dump D1 quotidien chiffré dans R2 (classe Archive, conservation 90 jours).
- Dump hebdomadaire conservé 2 ans.
- Dump mensuel conservé 7 ans.
- Procédure de restauration testée trimestriellement.

### 14.4 Monitoring et alerting

| Métrique | Seuil alerte | Canal |
|---|---|---|
| Taux d'erreur API > 1% sur 5min | Warning | Email |
| Taux d'erreur API > 5% sur 5min | Critical | SMS + ntfy.sh |
| Latence p95 > 1s sur 10min | Warning | Email |
| Queue sync en attente > 100 items | Warning | Email |
| Échec clôture journalière tenant | Critical | SMS |
| Divergence chaînage hash détectée | Critical | SMS + appel |

### 14.5 Plan de réponse à incident

- Runbook par type d'incident (corruption DB, indisponibilité Stripe, etc.).
- Communication : statuspage + email aux tenants impactés.
- Post-mortem obligatoire pour tout incident P1.
- Engagement contractuel : 99% uptime (standard), 99.5% (Pro), crédit d'abonnement en cas de manquement.

---

## 15. Roadmap produit (indicative)

```
Q2 2026 (avril-juin)
├── Phase 0 : validation marché (2 sem)
├── Phase 1 : MVP démontrable (3 sem)
└── Phase 2 : production-ready pilote (5 sem)

Q3 2026 (juillet-sept)
├── Phase 3 : industrialisation (8 sem)
├── Lancement public fin août
└── Objectif : 5-10 clients payants

Q4 2026 (oct-déc)
├── Connecteur accounting-export (Pennylane + Dougs)
├── Module reporting avancé (stats multi-mois)
├── Objectif : 20-30 clients

Q1 2027
├── Connecteur e-commerce Prestashop
├── Connecteur SMS
├── Support multi-boutiques
├── Objectif : 50 clients

Q2-Q4 2027
├── Connecteur facturation électronique (PDP)
├── Extension verticales (brocante, antiquité)
├── Certification NF525 si ROI justifié
└── Objectif : 100+ clients
```

---

## 16. Annexes

### 16.1 Glossaire

| Terme | Définition |
|---|---|
| **ISCA** | Inaltérabilité, Sécurisation, Conservation, Archivage (obligations du CGI 286-I-3°bis) |
| **FEC** | Fichier des Écritures Comptables (format DGFiP) |
| **NF525** | Certification AFNOR/Infocert des logiciels de caisse |
| **LNE** | Laboratoire National de métrologie et d'Essais (alt à NF525) |
| **PA/PDP** | Plateforme Agréée / Plateforme de Dématérialisation Partenaire (facturation électronique) |
| **TVA sur marge** | Régime art. 297 A CGI, base = marge seulement |
| **Livre de police** | Registre obligatoire des objets d'occasion (art. 321-7 CP) |
| **Z-ticket** | Clôture journalière signée |
| **KYC** | Know Your Customer (identification) |
| **PWA** | Progressive Web App (app web installable, offline-capable) |

### 16.2 Références légales

- Article 286-I-3°bis CGI → obligations ISCA
- Article 297 A CGI → TVA sur marge
- Article 321-7 Code pénal → livre de police
- BOI-TVA-DECLA-30-10-30 → doctrine administrative logiciels de caisse
- Loi n° 2025-127 du 14 février 2025 → suppression auto-certification (annulée)
- Loi n° 2026-103 du 19 février 2026 → rétablissement auto-certification
- Règlement UE 2016/679 → RGPD

### 16.3 Exemple de calcul TVA sur marge dépôt-vente

**Contexte :** dépôt-vente textile, commission standard 40%.

**Article A :** veste, déposé par Mme Martin, prix de vente 60€ TTC.
- Vente encaissée : 60€
- Commission boutique : `60 × 40% = 24€`
- Reversement dû à Mme Martin : `60 − 24 = 36€`
- Base TVA (sur commission) : 24€ TTC
- TVA (20%) : `24 × 20 / 120 = 4€`
- Commission HT : `24 − 4 = 20€`
- Mention ticket : *« TVA sur marge, article 297 A du CGI »*, pas de TVA affichée.

**Sur la déclaration CA3 mensuelle :**
- Base imposable = somme des commissions TTC / 1,2
- TVA collectée = Base × 20%

### 16.4 Ressources externes

- Stripe Terminal SDK JS : https://docs.stripe.com/terminal/payments/setup-reader
- Cloudflare D1 : https://developers.cloudflare.com/d1/
- SvelteKit PWA guide : https://kit.svelte.dev
- Spécification FEC : https://www.economie.gouv.fr/dgfip/controle-fiscal-des-comptabilites-informatisees
- Norme NF525 : https://infocert.org/nf525/

---

## Notes de travail

**Hypothèses implicites à valider avec Jerome :**
- Le premier client pilote accepte d'être pilote gratuit 3 mois avec feedback structuré.
- Le budget avocat (CGV/CGU) de ~1.5k€ est acceptable.
- Le budget pentest (~3-5k€) est intégré à la roadmap avant phase 3.
- Jerome tient l'astreinte samedi/dimanche au moins 1 an (phase critique pour réputation).
- Le support est mutualisé avec le SaaS Swello/Peako si lancé en parallèle.
- Le nom « Rebond » est disponible commercialement — sinon candidats : Consign, Stellair, Dépôt+, ReMarket, Tock (à vérifier INPI).

**Questions ouvertes :**
- Faut-il un mode « vente directe » sans déposant (pour les commerces hybrides qui achètent aussi du stock) dès le MVP ou seulement en v1 ? → recommandation : dès MVP car cas fréquent.
- Quel partenaire TPE physique privilégier ? Stripe Terminal est un choix simple, mais SumUp a aussi un SDK et pourrait être pertinent pour les petits commerces qui l'ont déjà. → À arbitrer après retour pilotes.
- Licence open source d'une partie du code (core ISCA par exemple) pour crédibiliser la sécurité ? → À réfléchir en phase 3.
