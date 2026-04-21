# Caissette

**Logiciel de caisse open source, eco-responsable, certifie NF525. Made in France.**

Caissette est un logiciel de caisse moderne, leger et gratuit. Il tourne dans un navigateur, fonctionne hors-ligne, et respecte toutes les obligations fiscales francaises. Pas de materiel impose, pas de serveur gourmand — juste l'essentiel.

---

## Pourquoi Caissette ?

| | |
|---|---|
| **Open source** | Code source auditable, licence AGPL-3.0 |
| **Certifie NF525** | Chainages SHA-256, signatures Ed25519, export FEC |
| **Eco-responsable** | Leger, sobre, tourne sur du vieux materiel |
| **Made in France** | Concu et developpe en France |
| **Mode hors-ligne** | PWA — fonctionne sans internet |
| **Zero dependance materielle** | Un navigateur web suffit |

---

## Fonctionnalites

| Module | Description |
|--------|-------------|
| Caisse (POS) | Ventes, multi-paiement, remises, avoirs, scan code-barres |
| Certification NF525 | Hash chaine, signatures numeriques, inalterable |
| Clotures Z | Tickets Z journaliers et clotures mensuelles signees |
| Export FEC | Fichier des Ecritures Comptables (art. A47 A-1 LPF) |
| Depot-vente | Gestion deposants, contrats, commissions, reversements |
| Livre de police | Registre reglementaire pour les biens d'occasion |
| TVA sur marge | Calcul automatique pour les biens d'occasion |
| Imprimante thermique | ESC/POS via WebUSB (80mm) |
| Multi-utilisateur | Roles (proprietaire, manager, caissier, comptable), PIN |
| Tableau de bord | Statistiques temps reel, CA, top produits |
| Comptabilite | Grand livre, journal, recap TVA, exports |
| Conformite | Guide interactif des obligations legales |

---

## Stack technique

```
Frontend :  SvelteKit (Svelte 5) + TailwindCSS
Backend :   Hono sur Cloudflare Workers (edge computing)
Base :      Cloudflare D1 (SQLite distribue)
ORM :       Drizzle
Monorepo :  pnpm workspaces + Turborepo
```

### Architecture

```
packages/
  shared/     types, utils, testing
  core/       auth, tenant, event-bus, audit-log, isca (NF525)
  modules/    caisse, catalog, depots, livre-police, tva-marge
  connectors/ printer-escpos
apps/
  web/        SvelteKit PWA
infra/
  workers/    API Hono (Cloudflare Workers)
  migrations/ Schema Drizzle + migrations SQL
```

---

## Eco-responsabilite

Caissette est concu pour minimiser son empreinte :

- **Edge computing** — le code tourne au plus pres de l'utilisateur sur le reseau Cloudflare, pas sur un serveur dedie 24/7
- **PWA legere** — pas d'app native lourde a telecharger depuis un store
- **Fonctionne sur du vieux materiel** — un navigateur moderne suffit, pas besoin de racheter du materiel
- **Bundle minimal** — pas de librairies inutiles, pas de tracking, pas de bloat
- **Donnees sobres** — on ne collecte que le strict necessaire

---

## Installation (self-hosted)

### Pre-requis

- Node.js 20+
- pnpm 9+
- Un compte Cloudflare (gratuit)

### Etapes

```bash
# 1. Cloner le depot
git clone https://github.com/caissette/caissette.git
cd caissette

# 2. Installer les dependances
pnpm install

# 3. Configurer Cloudflare
cp infra/workers/wrangler.example.jsonc infra/workers/wrangler.jsonc
# Editer wrangler.jsonc avec vos IDs Cloudflare (D1, KV, R2)

# 4. Appliquer les migrations
pnpm --filter @caissette/migrations run migrate

# 5. Deployer
pnpm --filter @caissette/api-worker run deploy
pnpm --filter @caissette/web run deploy
```

### Developpement local

```bash
# Lancer le backend (Workers local)
pnpm --filter @caissette/api-worker run dev

# Lancer le frontend (Vite)
pnpm --filter @caissette/web run dev
```

---

## Service manage

Vous ne voulez pas gerer l'hebergement vous-meme ? Un service d'hebergement manage est disponible :

- Installation et configuration incluses
- Mises a jour automatiques
- Sauvegardes quotidiennes
- Support prioritaire

Contact : [caissette.fr](https://caissette.fr)

---

## Contribuer

Les contributions sont les bienvenues ! Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour commencer.

---

## Licence

[AGPL-3.0](LICENSE) — libre d'utiliser, modifier et distribuer. Si vous modifiez le code et proposez le service, vous devez partager vos modifications.

---

Fait avec soin en France
