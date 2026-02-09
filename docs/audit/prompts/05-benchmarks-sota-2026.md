# Secteur 5 — Benchmarks SOTA 2026

## Prompt

> **Contexte** : TALOK est un SaaS de gestion locative français. Ce prompt compare les features visibles sur la capture d'écran avec l'état de l'art SaaS 2026 (Stripe, Notion, Vercel, Linear, et concurrents directs gestion locative).
>
> **Compare chaque feature présente ou absente sur la capture d'écran avec les leaders.**
>
> 1. **Inventaire des features visibles**
>    - Lister chaque fonctionnalité identifiable sur l'écran
>    - Classer par catégorie : navigation, data display, actions, feedback, settings
>
> 2. **Benchmark par catégorie**
>
> ### Navigation & Structure
> | Feature | Stripe | Notion | Vercel | Linear | TALOK |
> |---------|--------|--------|--------|--------|-------|
> | Breadcrumbs contextuels | ✅ | ✅ | ✅ | ✅ | ? |
> | Command palette (⌘K) | ✅ | ✅ | ✅ | ✅ | ? |
> | Sidebar collapsible | ✅ | ✅ | ✅ | ✅ | ? |
> | Multi-workspace switch | ❌ | ✅ | ✅ | ✅ | ? |
> | Deep linking / URL state | ✅ | ✅ | ✅ | ✅ | ? |
> | Quick actions / shortcuts | ✅ | ✅ | ✅ | ✅ | ? |
>
> ### Data Display
> | Feature | Stripe | Notion | Vercel | Linear | TALOK |
> |---------|--------|--------|--------|--------|-------|
> | Skeleton loaders | ✅ | ✅ | ✅ | ✅ | ? |
> | Empty states illustrés | ✅ | ✅ | ✅ | ✅ | ? |
> | Pagination / infinite scroll | ✅ | ✅ | ✅ | ✅ | ? |
> | Filtres avancés persistants | ✅ | ✅ | ❌ | ✅ | ? |
> | Export CSV/PDF | ✅ | ❌ | ❌ | ✅ | ? |
> | Tri multi-colonnes | ✅ | ✅ | ❌ | ✅ | ? |
> | Recherche full-text | ✅ | ✅ | ✅ | ✅ | ? |
>
> ### Feedback & Interactions
> | Feature | Stripe | Notion | Vercel | Linear | TALOK |
> |---------|--------|--------|--------|--------|-------|
> | Toast notifications | ✅ | ✅ | ✅ | ✅ | ? |
> | Optimistic updates | ✅ | ✅ | ✅ | ✅ | ? |
> | Undo action (Ctrl+Z) | ❌ | ✅ | ❌ | ✅ | ? |
> | Real-time updates | ✅ | ✅ | ✅ | ✅ | ? |
> | Inline editing | ✅ | ✅ | ❌ | ✅ | ? |
> | Drag & drop | ❌ | ✅ | ❌ | ✅ | ? |
>
> ### Settings & Account
> | Feature | Stripe | Notion | Vercel | Linear | TALOK |
> |---------|--------|--------|--------|--------|-------|
> | Dark mode | ❌ | ✅ | ✅ | ✅ | ? |
> | 2FA / Passkeys | ✅ | ✅ | ✅ | ✅ | ? |
> | Audit log | ✅ | ✅ | ✅ | ✅ | ? |
> | API keys management | ✅ | ✅ | ✅ | ✅ | ? |
> | Webhooks config | ✅ | ❌ | ✅ | ✅ | ? |
> | Team roles & permissions | ✅ | ✅ | ✅ | ✅ | ? |
>
> ### Gestion Locative (concurrents directs)
> | Feature | Rentila | Smovin | Qalimo | TALOK |
> |---------|---------|--------|--------|-------|
> | Quittances auto | ✅ | ✅ | ✅ | ? |
> | Relance impayés | ✅ | ✅ | ❌ | ? |
> | Révision loyer auto (IRL) | ✅ | ✅ | ✅ | ? |
> | EDL digital | ❌ | ✅ | ❌ | ? |
> | Signature électronique | ❌ | ❌ | ❌ | ? |
> | DPE / diagnostics | ❌ | ❌ | ❌ | ? |
> | Multi-entités | ❌ | ✅ | ❌ | ? |
> | Comptabilité SCI | ❌ | ✅ | ❌ | ? |
> | Assistant IA | ❌ | ❌ | ❌ | ? |
>
> 3. **Taux de couverture**
>    - Features présentes (✅) / Total features benchmarkées × 100
>    - Par catégorie et global
>
> 4. **Quick wins** — Features à fort impact et faible effort d'implémentation
>    - Identifie les features manquantes (❌) qui sont présentes chez 3+ leaders
>    - Estime l'effort : S (< 1 jour), M (1-3 jours), L (> 3 jours)
>
> 5. **Avantages compétitifs** — Features uniques TALOK absentes chez les concurrents

---

## Scoring

```
Taux de couverture = (✅ count / total features) × 100

> 85% : Best-in-class
70-85% : Compétitif
50-70% : Lacunes notables
< 50% : Retard significatif
```

---

## Format de sortie attendu

```markdown
## Audit Benchmarks SOTA 2026 — [Page]

### Taux de couverture global : X%

| Catégorie | ✅ | ⚠️ | ❌ | Couverture |
|-----------|---|---|---|-----------|
| Navigation | ... | ... | ... | ...% |
| Data Display | ... | ... | ... | ...% |
| Feedback | ... | ... | ... | ...% |
| Settings | ... | ... | ... | ...% |
| Gestion Locative | ... | ... | ... | ...% |

### Quick Wins (effort S/M)
1. [Feature] — Présente chez [N] leaders — Effort [S/M] — Impact [élevé/moyen]
2. ...

### Avantages compétitifs TALOK
1. ...

### Features à prioriser (effort L, impact élevé)
1. ...
```
