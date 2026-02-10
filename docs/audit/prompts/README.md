# Prompts Audit UX/UI — Sectorisés

**Projet :** TALOK — SaaS de Gestion Locative
**Version :** 1.0
**Date :** Février 2026
**Stack :** Next.js 14 · Tailwind + shadcn/ui · Supabase · Stripe

---

## Principe

Chaque prompt ci-dessous audite **un secteur précis** à partir d'une capture d'écran de l'interface TALOK. Les secteurs sont **cumulables** : vous pouvez en utiliser un seul ou les combiner en une seule passe.

### Utilisation

1. Fournir une **capture d'écran** de la page ou du composant à auditer
2. Copier le(s) prompt(s) du/des secteur(s) souhaité(s)
3. Envoyer screenshot + prompt(s) à l'IA

### Niveaux de sévérité

| Icône | Niveau | SLA recommandé |
|-------|--------|----------------|
| 🔴 | Critique | Sprint en cours |
| 🟠 | Majeur | Sprint suivant |
| 🟡 | Mineur | Backlog priorisé |

---

## Secteurs disponibles

| # | Secteur | Fichier | Description |
|---|---------|---------|-------------|
| 1 | Données & Cohérence | [`01-donnees-coherence.md`](./01-donnees-coherence.md) | Cohérence logique entre éléments affichés |
| 2 | Logique Tarifaire | [`02-logique-tarifaire.md`](./02-logique-tarifaire.md) | Pricing, forfaits, positionnement marché |
| 3 | Design & UI | [`03-design-ui.md`](./03-design-ui.md) | Visuel, palette, layout, design system |
| 4 | Conformité Légale FR | [`04-conformite-legale-fr.md`](./04-conformite-legale-fr.md) | Code Commerce, RGPD, LCEN, RGAA |
| 5 | Benchmarks SOTA 2026 | [`05-benchmarks-sota-2026.md`](./05-benchmarks-sota-2026.md) | Comparaison leaders SaaS |
| 6 | Accessibilité WCAG 2.2 | [`06-accessibilite-wcag22.md`](./06-accessibilite-wcag22.md) | Conformité WCAG critère par critère |
| 7 | Roadmap | [`07-roadmap.md`](./07-roadmap.md) | Synthèse et planification sprints |

---

## Combinaisons recommandées

| Cas d'usage | Secteurs | Objectif |
|-------------|----------|----------|
| Quick check | 1 | Vérifier la cohérence des données affichées |
| Audit design | 3 + 6 | UI complète + accessibilité |
| Audit légal complet | 4 + 2 | Conformité FR + cohérence tarifaire |
| Audit complet pré-release | 1 + 2 + 3 + 4 + 5 + 6 + 7 | Tous les secteurs, roadmap de sortie |
| Benchmark concurrentiel | 5 + 2 | Positionnement marché + pricing |

---

## Contexte TALOK embarqué

Chaque prompt inclut le contexte métier TALOK :

- **Rôles** : Propriétaire, Locataire, Prestataire, Garant, Agence, Syndic, Admin
- **Pages clés** : Dashboard (par rôle), Properties, Leases, Invoices, Tickets, Documents, Pricing, Settings
- **Stack UI** : shadcn/ui (63 composants Radix), Tailwind CSS 3.4, Lucide Icons, Recharts
- **Paiement** : Stripe (forfaits Essentiel / Pro / Entreprise)
- **Juridiction** : Droit français — Code Commerce, Code Consommation, RGPD, LCEN, RGAA
- **Territoires** : France métropolitaine + DROM (TVA spécifique : 8.5% Martinique/Guadeloupe/Réunion)
