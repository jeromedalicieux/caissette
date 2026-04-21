# Contribuer a Caissette

Merci de votre interet pour Caissette ! Voici comment contribuer au projet.

## Mise en place

```bash
# Cloner le depot
git clone https://github.com/caissette/caissette.git
cd caissette

# Installer les dependances
pnpm install

# Lancer en dev
pnpm --filter @caissette/api-worker run dev  # Backend
pnpm --filter @caissette/web run dev         # Frontend
```

## Structure du monorepo

```
packages/shared/    Partage entre front et back (types, utils)
packages/core/      Logique metier fondamentale (auth, NF525, tenant)
packages/modules/   Modules fonctionnels (caisse, catalogue, depots)
packages/connectors/ Integrations externes (imprimante ESC/POS)
apps/web/           Application SvelteKit (PWA)
infra/workers/      API Hono (Cloudflare Workers)
infra/migrations/   Schemas Drizzle et migrations SQL
```

## Conventions de code

- **TypeScript strict** — pas de `any` sauf cas exceptionnels
- **Svelte 5** — utiliser les runes (`$state`, `$derived`, `$effect`, `$props()`)
- **Pas de sur-ingenierie** — le code le plus simple qui fonctionne
- **Tests** — `vitest` pour les packages, tester la logique metier

## Soumettre une PR

1. Creer une branche depuis `main`
2. Faire vos modifications
3. Verifier que le build passe : `pnpm run build`
4. Verifier que les tests passent : `pnpm run test`
5. Ouvrir une Pull Request avec une description claire

## Signaler un bug

Ouvrir une issue avec :
- Description du probleme
- Etapes pour reproduire
- Comportement attendu vs observe
- Navigateur et OS utilises

## Proposer une fonctionnalite

Ouvrir une issue "Feature request" en decrivant :
- Le besoin utilisateur
- La solution proposee
- Les alternatives envisagees

## Code de conduite

Ce projet suit le [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). En participant, vous vous engagez a respecter ses termes.

## Licence

En contribuant, vous acceptez que vos contributions soient publiees sous la licence AGPL-3.0.
