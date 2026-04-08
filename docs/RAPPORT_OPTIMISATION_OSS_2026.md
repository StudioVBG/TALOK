# Rapport : Repos Open-Source pour Optimiser Talok

**Date** : 8 avril 2026
**Stack actuelle** : Next.js 14 / React 18 / TypeScript / Supabase / Tailwind v3 / Capacitor v8 / Netlify
**Dependances actuelles** : 91 dependencies, 19 devDependencies

---

## PRIORITE 1 — Impact immediat, effort minimal

| Repo | Stars | Ce que ca fait | Gain pour Talok | Effort |
|------|-------|----------------|-----------------|--------|
| [Valibot](https://github.com/fabian-hiller/valibot) | ~7k | Validation schemas comme Zod, mais modulaire | **-15 kB gzip** (vs Zod). Migration progressive schema par schema. Compatible `@hookform/resolvers` | 2-4h/module |
| [supabase-cache-helpers](https://github.com/psteinroe/supabase-cache-helpers) | ~1.5k | Connecte Supabase a React Query automatiquement | Elimine le boilerplate cache, invalidation auto apres mutations, -50% requetes redondantes | 1 jour |
| [Knip](https://github.com/webpro-nl/knip) | ~8.7k | Detecte fichiers, deps et exports inutilises | Nettoyage code mort. Un `npx knip` suffit. A suprime ~300k lignes chez Vercel | 1h |
| [Biome](https://github.com/biomejs/biome) | ~23.8k | Remplace ESLint + Prettier (Rust, 15x plus rapide) | ESLint v8 actuel est ancien. Biome = 1 outil, 200ms vs 3-5s. Migration auto disponible | 2-4h |
| [MSW](https://github.com/mswjs/msw) | ~17.7k | Mock d'APIs via Service Worker | Manque critique : 457 routes API sans mocks de test. Compatible Vitest + Playwright deja en place | 1 jour |
| [React Email](https://github.com/resend/react-email) | ~18k | Composants React pour emails HTML | 20+ templates en strings HTML brutes a migrer. Cree par l'equipe Resend (deja utilise). Preview live | 2-3 jours |

### Optimisations zero-install

| Action | Gain | Effort |
|--------|------|--------|
| Activer `LazyMotion` + `domAnimation` (Framer Motion) | **-35 kB gzip** | 1-2h |
| Optimiser RLS : index B-tree sur `user_id`, wrapper `(select auth.uid())` | **10-100x** sur requetes volumineuses | 2h |
| Activer `pg_stat_statements` dans Supabase | Identifier les requetes lentes | 15 min |
| Verifier URL pooling Supavisor (`pooler.supabase.co:6543`) | Eviter saturation connexions | 15 min |
| Supprimer SWR (1 seul usage dans `use-accounting.ts`) | -1 dependance redondante | 30 min |

---

## PRIORITE 2 — Impact fort, effort moyen

| Repo | Stars | Ce que ca fait | Gain pour Talok | Effort |
|------|-------|----------------|-----------------|--------|
| [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | ~14.2k | Background jobs TypeScript sans timeout | Resout le probleme Netlify (fonctions limitees a 10-26s). OCR, PDF, emails en batch, analyse IA | 1 semaine |
| [Tailwind CSS v4](https://github.com/tailwindlabs/tailwindcss) | ~86k | Moteur Oxide (Rust), CSS-first config | Builds incrementaux **100x plus rapides** (44ms -> 5ms). Outil migration auto `npx @tailwindcss/upgrade` | 2-4h |
| [@tanstack/react-virtual](https://github.com/TanStack/virtual) | ~7k | Virtualisation de listes (headless, ~2.5 kB) | Performance sur longues listes de biens/locataires/paiements. Deja dans ecosysteme TanStack | 1-2h/composant |
| [pdfme](https://github.com/pdfme/pdfme) | ~3.4k | Generateur PDF avec editeur WYSIWYG de templates | Remplace html2pdf.js. Templates editables pour quittances, appels de charges, mandats | 3-5 jours |
| [ts-pattern](https://github.com/gvergnaud/ts-pattern) | ~14.8k | Pattern matching exhaustif TypeScript | Logique metier complexe : roles (7), statuts bail, paiements. Remplace cascades if/else | 1h/module |
| [AutoAnimate](https://github.com/formkit/auto-animate) | ~13k | Animations auto en 1 ligne (~2 kB) | Remplace Framer Motion sur les listes simples. **-48 kB** par page ou FM n'est plus necessaire | 1h |
| [next-safe-action](https://github.com/next-safe-action/next-safe-action) | ~3.5k | Server Actions type-safe + validation Zod | Unifie validation des mutations (bail, paiement, ticket). Securite + DX | 3 jours |
| [Mastra](https://github.com/mastra-ai/mastra) | ~22.3k | Framework agents IA TypeScript-first | Alternative a LangChain. Model routing = GPT-4o-mini pour le simple, GPT-4o pour le complexe. **-60% couts IA** | 1 semaine |

---

## PRIORITE 3 — Strategique, moyen/long terme

| Repo | Stars | Ce que ca fait | Gain pour Talok | Effort |
|------|-------|----------------|-----------------|--------|
| [PowerSync](https://github.com/powersync-ja/powersync-js) | ~1.8k | Sync offline Postgres-SQLite | Support offline mobile (visites terrain). Partenaire officiel Supabase. Plan gratuit | 2 semaines |
| [Serwist](https://github.com/serwist/serwist) | ~2.5k | Successeur de next-pwa (plus maintenu) | next-pwa actuel date de 2+ ans. Serwist = compatible Turbopack, perenne | 1 jour |
| [OpenTelemetry](https://opentelemetry.io/) | Standard | Traces distribuees, metriques, logs | Visibilite sur les 457 routes. Compatible Sentry comme backend. Support Next.js natif | 2 jours |
| [pg-boss](https://github.com/timgit/pg-boss) | ~3.1k | File de jobs sur PostgreSQL (SKIP LOCKED) | Jobs cron sans Redis : quittances mensuelles, relances, rapprochement bancaire | 3 jours |
| [unpdf](https://github.com/unjs/unpdf) | ~500 | Extraction texte/images depuis PDF en JS pur | Pipeline OCR comptable : extraire texte des factures PDF avant analyse IA | 2h |
| [@react-pdf/renderer](https://github.com/diegomura/react-pdf) | ~15k | Generation PDF en JSX | PDFs natifs cote serveur. Meilleure qualite que html2pdf.js pour baux, etats des lieux | 1 semaine |
| [supabase-to-zod](https://github.com/psteinroe/supabase-to-zod) | ~200 | Genere schemas Zod depuis types Supabase | Coherence DB <-> validation front. Elimine schemas manuels | 2h |
| [Arcjet](https://github.com/arcjet/arcjet-js) | ~650 | Securite Next.js : bots, WAF, rate limiting | Complement au rate limiter custom actuel. Detection bots + WAF OWASP en 1 ligne de middleware | 1 jour |
| [@axe-core/react](https://github.com/dequelabs/axe-core) | ~7k | Audit accessibilite en temps reel (dev only) | 0 impact production. Detecte violations WCAG pendant le dev | 30 min |

---

## PRIORITE 4 — A surveiller (pas urgent)

| Repo | Stars | Pourquoi surveiller |
|------|-------|---------------------|
| [React Compiler](https://github.com/facebook/react) | ~236k | Memoisation automatique. Necessite React 19 + Next.js 15 (migration lourde) |
| [Legend-State](https://github.com/LegendApp/legend-state) | ~4k | State le plus rapide. Plugin Supabase integre. Ecosysteme encore jeune |
| [MapLibre GL](https://github.com/maplibre/maplibre-gl-js) | ~10.3k | WebGL, 3D. Pertinent si carte marche immobilier (>10k biens). Leaflet suffit actuellement |
| [Turborepo](https://github.com/vercel/turborepo) | ~30.1k | Monorepo. Pertinent quand separation en packages sera necessaire |
| [oRPC](https://github.com/unnoq/orpc) | ~3k | RPC + OpenAPI. Pertinent si API publique pour agences partenaires |
| [View Transitions API](https://developer.chrome.com/docs/web-platform/view-transitions) | Natif | 0 kB, transitions navigateur natives. Attendre stabilisation Next.js |

---

## NE PAS UTILISER

| Repo | Raison |
|------|--------|
| Partytown | Incompatible App Router Next.js 13+ |
| next-optimized-images | Pages Router only, plus maintenu. `next/image` + `sharp` (deja en place) suffit |
| Highlight.io | **Ferme le 28 fev 2026** (acquis par LaunchDarkly). Rester sur Sentry |
| depcheck | **Archive juin 2025**. Utiliser Knip a la place |
| Lucia Auth | Adaptateur Supabase deprecie. Garder Supabase Auth |
| million.js | Experimental, problemes avec App Router + Server Components |

---

## GAINS ESTIMES CUMULES

### Bundle size
| Action | Reduction |
|--------|-----------|
| LazyMotion + domAnimation | -35 kB |
| Valibot (remplace Zod progressif) | -15 kB |
| AutoAnimate (remplace FM sur listes) | -48 kB/page |
| **Total potentiel** | **~50-80 kB gzip** |

### Performance runtime
| Action | Amelioration |
|--------|-------------|
| Tailwind v4 builds | 100x plus rapide (incremental) |
| supabase-cache-helpers | -50% requetes redondantes |
| Index RLS + wrapper auth.uid() | 10-100x sur requetes volumineuses |
| @tanstack/react-virtual | 60 FPS sur listes de 1000+ items |

### Couts IA
| Action | Reduction |
|--------|-----------|
| Model routing (Mastra) | -60% couts API |
| Prompt caching (OpenAI natif) | -50% tokens input |
| Semantic caching (Upstash Redis) | -73% appels repetitifs |

### DX
| Action | Amelioration |
|--------|-------------|
| Biome (remplace ESLint) | 15x plus rapide |
| Knip | Elimination code mort |
| MSW | Tests fiables sur 457 routes |
| React Email | Templates testables, preview live |

---

## PLAN D'ACTION RECOMMANDE

### Semaine 1 — Quick wins
1. `npx knip` — identifier le code mort
2. Supprimer SWR, migrer vers TanStack Query
3. Activer LazyMotion dans Framer Motion
4. Activer pg_stat_statements + verifier URL pooling
5. Installer @axe-core/react en dev

### Semaine 2 — Outillage
6. Migrer ESLint v8 vers Biome
7. Installer MSW pour les tests
8. Migrer Tailwind v3 vers v4

### Semaine 3-4 — Performance
9. Integrer supabase-cache-helpers
10. Ajouter @tanstack/react-virtual sur les listes longues
11. Migrer les templates emails vers React Email
12. Commencer migration Zod -> Valibot

### Mois 2 — Infrastructure
13. Integrer Trigger.dev pour les jobs lourds
14. Evaluer Mastra vs LangChain
15. Migrer next-pwa vers Serwist
16. Remplacer html2pdf.js par pdfme ou @react-pdf/renderer

### Mois 3+ — Mobile & strategique
17. Integrer PowerSync pour offline mobile
18. Ajouter OpenTelemetry
19. Evaluer migration Next.js 15 + React 19 (React Compiler)
