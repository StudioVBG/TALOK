# Audit des Dashboards TALOK

**Date** : 3 mars 2026
**Portée** : Tableaux de bord Owner, Tenant et Provider
**Stack** : Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, Prisma, Supabase

---

## Table des matières

1. [Vue d'ensemble de l'architecture](#1-vue-densemble-de-larchitecture)
2. [Dashboard Owner](#2-dashboard-owner)
3. [Dashboard Tenant](#3-dashboard-tenant)
4. [Dashboard Provider](#4-dashboard-provider)
5. [Composants UI partagés](#5-composants-ui-partagés)
6. [Performance](#6-performance)
7. [Accessibilité](#7-accessibilité)
8. [Responsive / Mobile](#8-responsive--mobile)
9. [Sécurité](#9-sécurité)
10. [Gestion d'erreurs et états de chargement](#10-gestion-derreurs-et-états-de-chargement)
11. [Qualité du code](#11-qualité-du-code)
12. [Constats positifs](#12-constats-positifs)
13. [Problèmes identifiés et recommandations](#13-problèmes-identifiés-et-recommandations)
14. [Résumé par priorité](#14-résumé-par-priorité)

---

## 1. Vue d'ensemble de l'architecture

### Structure des routes

```
app/
├── owner/dashboard/       → Tableau de bord propriétaire
│   ├── page.tsx           → Page serveur (RSC)
│   ├── loading.tsx        → Skeleton loading
│   └── error.tsx          → Error boundary
├── tenant/dashboard/      → Tableau de bord locataire
│   ├── page.tsx           → Page serveur (RSC)
│   ├── loading.tsx        → Skeleton loading
│   └── error.tsx          → Error boundary
└── provider/dashboard/    → Tableau de bord prestataire
    ├── page.tsx           → Page serveur (RSC)
    ├── loading.tsx        → Skeleton loading
    └── error.tsx          → Error boundary
```

### Pattern architectural commun

Les trois dashboards suivent le même pattern :

1. **Page serveur (RSC)** : Authentification via `getSessionUser()`, récupération des données Prisma, rendu côté serveur
2. **Composant client wrapper** : Un composant `"use client"` qui orchestre les widgets et la mise en page
3. **Widgets atomiques** : Composants client individuels pour chaque section du dashboard
4. **Loading/Error boundaries** : Fichiers `loading.tsx` et `error.tsx` de Next.js pour la gestion des états

### Flux de données

```
getSessionUser() → Prisma queries (serveur) → Props sérialisées → Client components → Widgets
```

Les données sont récupérées côté serveur et transmises en props aux composants clients. Aucun `useEffect` de fetch côté client n'a été observé dans les dashboards eux-mêmes — c'est une bonne pratique.

---

## 2. Dashboard Owner

### Fichiers

| Fichier | Type | Rôle |
|---------|------|------|
| `app/owner/dashboard/page.tsx` | Server | Auth + data fetching + rendu |
| `app/owner/dashboard/loading.tsx` | Server | Skeleton loading |
| `app/owner/dashboard/error.tsx` | Client | Error boundary |
| `features/owner/dashboard/owner-dashboard-client.tsx` | Client | Orchestrateur des widgets |
| `features/owner/dashboard/widgets/` | Client | 7 widgets individuels |

### Données récupérées (page.tsx)

La page serveur effectue **une seule grosse requête Prisma** avec des `include` imbriqués pour récupérer :

- Propriétés de l'utilisateur avec baux actifs et locataires
- Tickets (incidents) récents
- Factures récentes
- Compteurs financiers agrégés

Le résultat est transformé en `DashboardData` et passé au composant client.

### Widgets

| Widget | Fichier | Fonction |
|--------|---------|----------|
| `WelcomeWidget` | `welcome-widget.tsx` | Message de bienvenue personnalisé + progression du profil |
| `FinancialSummaryWidget` | `financial-summary-widget.tsx` | Résumé financier : revenus, dépenses, impayés |
| `OccupancyWidget` | `occupancy-widget.tsx` | Taux d'occupation avec mini-graphique donut |
| `PropertiesWidget` | `properties-widget.tsx` | Liste des propriétés avec statut et rendement |
| `TicketsWidget` | `tickets-widget.tsx` | Tickets récents avec filtre par priorité |
| `RecentPaymentsWidget` | `recent-payments-widget.tsx` | Paiements récents avec statuts |
| `QuickActionsWidget` | `quick-actions-widget.tsx` | Actions rapides contextuelles |

### Observations

- **Bonne séparation** : Chaque widget est un composant autonome avec des responsabilités claires
- **Données typées** : L'interface `DashboardData` est bien définie avec des types stricts
- **Calculs serveur** : Les agrégations financières (somme des loyers, impayés) sont faites côté serveur avant envoi au client
- **Actions contextuelles** : `QuickActionsWidget` adapte les actions affichées selon le contexte (ex: pas de "Ajouter un bien" si l'utilisateur en a déjà)

---

## 3. Dashboard Tenant

### Fichiers

| Fichier | Type | Rôle |
|---------|------|------|
| `app/tenant/dashboard/page.tsx` | Server | Auth + data fetching |
| `app/tenant/dashboard/loading.tsx` | Server | Skeleton loading |
| `app/tenant/dashboard/error.tsx` | Client | Error boundary |
| `features/tenant/dashboard/tenant-dashboard-client.tsx` | Client | Orchestrateur |
| `features/tenant/dashboard/widgets/` | Client | 6 widgets |

### Données récupérées

La page récupère :
- Le bail actif du locataire avec ses détails (propriété, propriétaire)
- L'historique des paiements
- Les tickets soumis par le locataire
- Les documents partagés

### Widgets

| Widget | Fichier | Fonction |
|--------|---------|----------|
| `TenantWelcomeWidget` | `tenant-welcome-widget.tsx` | Bienvenue + infos du bail |
| `RentStatusWidget` | `rent-status-widget.tsx` | Statut du loyer avec prochain paiement et historique |
| `TenantTicketsWidget` | `tenant-tickets-widget.tsx` | Tickets ouverts du locataire |
| `TenantDocumentsWidget` | `tenant-documents-widget.tsx` | Documents partagés (bail, quittances) |
| `TenantMessagesWidget` | `tenant-messages-widget.tsx` | Messages récents avec le propriétaire |
| `TenantQuickActionsWidget` | `tenant-quick-actions-widget.tsx` | Actions rapides (payer, signaler, contacter) |

### Observations

- **Données bien scoped** : Le locataire ne voit que ses propres données (bail, paiements, tickets)
- **Statut du loyer visuellement clair** : Utilisation de badges colorés (vert/orange/rouge) selon le statut
- **Bon UX pour les messages** : Compteur de messages non lus affiché

---

## 4. Dashboard Provider

### Fichiers

| Fichier | Type | Rôle |
|---------|------|------|
| `app/provider/dashboard/page.tsx` | Server | Auth + data fetching |
| `app/provider/dashboard/loading.tsx` | Server | Skeleton loading |
| `app/provider/dashboard/error.tsx` | Client | Error boundary |
| `features/provider/dashboard/provider-dashboard-client.tsx` | Client | Orchestrateur |
| `features/provider/dashboard/widgets/` | Client | 6 widgets |

### Widgets

| Widget | Fichier | Fonction |
|--------|---------|----------|
| `ProviderWelcomeWidget` | `provider-welcome-widget.tsx` | Bienvenue + score/réputation |
| `ActiveJobsWidget` | `active-jobs-widget.tsx` | Interventions en cours |
| `PendingQuotesWidget` | `pending-quotes-widget.tsx` | Devis en attente de réponse |
| `ProviderRevenueWidget` | `provider-revenue-widget.tsx` | Chiffre d'affaires et statistiques |
| `ProviderCalendarWidget` | `provider-calendar-widget.tsx` | Prochains rendez-vous |
| `ProviderQuickActionsWidget` | `provider-quick-actions-widget.tsx` | Actions rapides |

### Observations

- **Même pattern cohérent** que les deux autres dashboards
- **Données métier bien ciblées** : Focus sur les interventions, devis, et revenus du prestataire

---

## 5. Composants UI partagés

### Composants communs utilisés par les dashboards

| Composant | Fichier | Usage |
|-----------|---------|-------|
| `DashboardShell` | `components/ui/dashboard-shell.tsx` | Layout wrapper commun aux 3 dashboards |
| `DashboardError` | `components/ui/dashboard-error.tsx` | Error boundary réutilisable |
| `PageLoading` | `components/ui/page-loading.tsx` | Loading state réutilisable |
| `Card`, `Badge`, `Button` | `components/ui/` | Composants shadcn/ui |
| `DashboardSkeleton` | Utilisé dans `loading.tsx` | Squelette de chargement |

### Observations

- **Bonne factorisation** : Les composants structurels (`DashboardShell`, `DashboardError`) sont partagés et paramétrés via props
- **shadcn/ui bien intégré** : Utilisation cohérente des primitives shadcn (`Card`, `Badge`, `Button`, `Tooltip`)
- **Design tokens CSS** : Les couleurs et ombres passent par des variables CSS (`--primary`, `--shadow-md`, etc.)

---

## 6. Performance

### Points positifs

| Aspect | Détail |
|--------|--------|
| **Server Components** | Les pages dashboards sont des RSC → pas de JS envoyé au client pour le data-fetching |
| **Pas de cascade côté client** | Toutes les données sont fetchées en une seule passe serveur, pas de waterfalls côté client |
| **Skeleton loading** | Chaque dashboard a un `loading.tsx` → l'UI apparaît progressivement (Streaming SSR) |
| **Pas de bibliothèque de charting lourde** | Les mini-graphiques (donut d'occupation, etc.) sont rendus en CSS/SVG inline, pas via Chart.js/Recharts |

### Points d'attention

| Problème | Sévérité | Détail |
|----------|----------|--------|
| **Requête Prisma monolithique** | Moyenne | Le dashboard Owner fait une requête avec des `include` profondément imbriqués. Pour un propriétaire avec beaucoup de biens/baux, cette requête peut devenir lente. Envisager des requêtes parallèles avec `Promise.all` ou du data-splitting avec `Suspense` boundaries. |
| **Pas de mise en cache** | Moyenne | Aucun usage de `unstable_cache` ou `revalidate` de Next.js. Chaque visite du dashboard re-fetch tout depuis la base. Pour les données qui changent rarement (liste des propriétés), un cache de quelques minutes serait bénéfique. |
| **Pas de pagination** | Faible | Les listes (paiements, tickets) sont limitées par `take` dans Prisma (ex: `take: 5`), ce qui est correct. Mais il n'y a pas de "Voir plus" avec pagination paresseuse. |

### Recommandations performance

1. **Diviser la requête monolithique Owner** en requêtes parallèles :
   ```tsx
   const [properties, tickets, payments] = await Promise.all([
     prisma.property.findMany({ where: { ownerId } }),
     prisma.ticket.findMany({ where: { ownerId }, take: 5 }),
     prisma.payment.findMany({ where: { ownerId }, take: 10 }),
   ]);
   ```

2. **Ajouter des Suspense boundaries par widget** pour le streaming :
   ```tsx
   <Suspense fallback={<FinancialSkeleton />}>
     <FinancialSummaryWidget />
   </Suspense>
   ```

3. **Envisager `unstable_cache`** pour les données peu volatiles (liste des propriétés, profil utilisateur).

---

## 7. Accessibilité

### Points positifs

| Aspect | Détail |
|--------|--------|
| **Focus visible** | `globals.css` définit des styles `:focus-visible` cohérents avec `ring-2 ring-ring ring-offset-2` |
| **Skip links** | Classe `.skip-links` définie dans les CSS globaux |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` désactive les animations |
| **High contrast** | `@media (prefers-contrast: more)` ajuste les bordures et anneaux de focus |
| **Sémantique HTML** | Utilisation de `<main>`, `<section>`, `<h1>`-`<h3>` dans les dashboards |
| **Attributs ARIA** | Les badges de statut utilisent `aria-label` pour décrire le contexte |

### Points d'attention

| Problème | Sévérité | Détail |
|----------|----------|--------|
| **Graphiques sans alternative textuelle** | Moyenne | Le donut SVG dans `OccupancyWidget` n'a pas de `role="img"` ni d'`aria-label` décrivant le taux d'occupation. Les lecteurs d'écran ne peuvent pas interpréter ce graphique. |
| **Badges colorés seuls** | Faible | Certains badges de statut (vert/orange/rouge) reposent uniquement sur la couleur. L'ajout d'icônes ou de texte complémentaire renforcerait l'accessibilité pour les daltoniens. |
| **Liens "Voir tout" génériques** | Faible | Les liens "Voir tout" dans les widgets manquent de contexte. Un `aria-label="Voir tous les tickets"` serait préférable à un simple "Voir tout". |

### Recommandations accessibilité

1. Ajouter `role="img"` et `aria-label="Taux d'occupation : 85%"` au SVG donut
2. Ajouter des `aria-label` descriptifs aux liens "Voir tout" (ex: `aria-label="Voir tous les paiements récents"`)
3. Compléter les badges colorés avec une icône ou un texte pour ne pas dépendre uniquement de la couleur

---

## 8. Responsive / Mobile

### Configuration Tailwind

Le projet définit des breakpoints modernes adaptés 2025-2026 :

```
xs: 360px   → Petits smartphones
sm: 390px   → Smartphones standards
md: 744px   → Tablettes portrait
lg: 1024px  → Tablettes paysage / petits laptops
xl: 1280px  → Laptops
2xl: 1536px → Desktop standard
3xl: 1920px → Grands écrans
```

### Points positifs

| Aspect | Détail |
|--------|--------|
| **Safe area support** | Support complet `env(safe-area-inset-*)` pour notch/Dynamic Island |
| **Grille responsive** | Les dashboards utilisent des grilles CSS qui passent de 1 colonne (mobile) à 2-3 colonnes (desktop) |
| **Container responsive** | Padding adaptatif par breakpoint (`1rem` mobile → `2rem` desktop) |

### Points d'attention

| Problème | Sévérité | Détail |
|----------|----------|--------|
| **Breakpoint `xs: 360px` custom** | Faible | Les breakpoints Tailwind standards sont remplacés. Cela peut surprendre un nouveau développeur. C'est documenté en commentaire dans `tailwind.config.ts`, ce qui est bien. |
| **Pas de test d'overflow horizontal** | Faible | Les widgets avec des tableaux ou listes de données (paiements, propriétés) pourraient déborder sur des petits écrans. Vérifier que `overflow-x-auto` est appliqué là où nécessaire. |

---

## 9. Sécurité

### Points positifs

| Aspect | Détail |
|--------|--------|
| **Authentification systématique** | Chaque `page.tsx` appelle `getSessionUser()` et redirige vers `/login` si non authentifié |
| **Isolation des données** | Les requêtes Prisma filtrent toujours par `userId` / `ownerId` / `tenantId` — pas de données cross-tenant |
| **Pas d'exposition de secrets** | Les requêtes Prisma sont côté serveur uniquement. Pas de token ou clé API dans le code client |
| **Props sérialisées** | Seules les données nécessaires sont transmises au client via les props (pas d'objets Prisma bruts avec métadonnées) |

### Points d'attention

| Problème | Sévérité | Détail |
|----------|----------|--------|
| **Pas de vérification de rôle explicite** | Moyenne | Les pages dashboard vérifient l'authentification mais pas le rôle (owner vs tenant vs provider). La protection par rôle est probablement dans le middleware ou le layout, mais cela devrait être vérifié. Si un tenant accède directement à `/owner/dashboard`, la requête Prisma retournerait probablement des données vides, mais une vérification explicite du rôle serait plus robuste. |
| **Données sérialisées volumineuses** | Faible | Les propriétés avec baux imbriqués sont passées en entier au client. Pour un propriétaire avec beaucoup de biens, cela pourrait exposer plus de données que nécessaire dans le HTML source. Envisager de ne transmettre que les champs affichés. |

### Recommandations sécurité

1. **Vérifier la protection par rôle** : S'assurer que le middleware ou le layout vérifie `user.role === 'OWNER'` avant d'accéder au dashboard owner (et idem pour tenant/provider)
2. **Sélection minimale des champs** : Utiliser `select` dans Prisma plutôt que `include` complet pour ne transmettre que les champs nécessaires à l'affichage

---

## 10. Gestion d'erreurs et états de chargement

### Couverture

| Dashboard | `loading.tsx` | `error.tsx` | `not-found.tsx` |
|-----------|:---:|:---:|:---:|
| Owner | Oui | Oui | Non |
| Tenant | Oui | Oui | Non |
| Provider | Oui | Oui | Non |

### Points positifs

| Aspect | Détail |
|--------|--------|
| **Error boundaries** | Chaque dashboard a un `error.tsx` client avec bouton de retry et lien retour |
| **Loading skeletons** | Chaque dashboard a un `loading.tsx` avec skeleton adapté au layout |
| **Composant `DashboardError` réutilisable** | Centralisé dans `components/ui/dashboard-error.tsx`, paramétré par section |
| **Message d'erreur localisé** | Les messages d'erreur sont en français, cohérents avec l'interface |

### Points d'attention

| Problème | Sévérité | Détail |
|----------|----------|--------|
| **Pas de `not-found.tsx` dans les dashboards** | Faible | Le dashboard owner a 10 fichiers `not-found.tsx` dans ses sous-routes, mais pas dans le dashboard lui-même. Tenant et provider n'en ont aucun. Ce n'est pas critique car le dashboard est une route fixe (pas de `[id]`). |
| **Pas de gestion d'état vide** | Moyenne | Si un propriétaire n'a aucune propriété, aucun paiement, et aucun ticket, les widgets affichent-ils un état vide élégant ? Les widgets incluent des conditions `data.length === 0` avec des messages, ce qui est bien géré. |
| **Pas de try/catch dans page.tsx** | Moyenne | Les requêtes Prisma dans les pages serveur ne sont pas wrappées dans un try/catch. Une erreur de base de données remonte directement à l'error boundary. C'est fonctionnel grâce à l'error boundary, mais un try/catch permettrait un logging structuré ou une réponse plus granulaire. |

### Recommandation

Ajouter un try/catch dans les `page.tsx` pour capturer les erreurs Prisma et les logger avant de les propager :

```tsx
try {
  const data = await prisma.property.findMany(...)
  return <OwnerDashboardClient data={data} />
} catch (error) {
  console.error('[Owner Dashboard] Data fetch failed:', error)
  throw error // L'error boundary le capte
}
```

---

## 11. Qualité du code

### Points positifs

| Aspect | Détail |
|--------|--------|
| **TypeScript strict** | Toutes les interfaces sont explicitement typées. Pas de `any` observé. |
| **Naming cohérent** | Convention `feature-name-widget.tsx` respectée partout |
| **Séparation des responsabilités** | Server → data, Client wrapper → layout, Widget → UI atomique |
| **Structure `features/`** | Les composants métier sont dans `features/{role}/dashboard/` et non dans `components/`, ce qui est une bonne pratique de co-location |
| **Pas de logique métier dans les composants** | Les calculs (agrégations, formatage de dates) sont faits avant le rendu, pas en inline |

### Points d'attention

| Problème | Sévérité | Détail |
|----------|----------|--------|
| **Duplication entre dashboards** | Faible | Les trois `error.tsx` sont quasi identiques (seuls les textes changent). Le composant `DashboardError` partagé gère déjà la factorisation, donc la duplication résiduelle est minimale et acceptable. |
| **Pas de tests unitaires dédiés** | Moyenne | Aucun fichier de test `*.test.tsx` n'a été trouvé dans les dossiers dashboard. Les widgets devraient avoir des tests de rendu basiques (données vides, données normales, données limites). |
| **Localisation en dur** | Faible | Les textes français sont codés en dur dans les composants. Si une internationalisation est envisagée, il faudra extraire ces chaînes. Pour un produit exclusivement francophone, ce n'est pas un problème. |

---

## 12. Constats positifs

Le code des dashboards TALOK est **globalement bien structuré et suit les bonnes pratiques modernes** :

1. **Architecture RSC correcte** : Server components pour le data-fetching, client components uniquement pour l'interactivité
2. **Pas de waterfalls client** : Toutes les données sont fetchées côté serveur en une passe
3. **Composants atomiques** : Chaque widget est indépendant et réutilisable
4. **Accessibilité de base** : Focus visible, reduced motion, high contrast, skip links
5. **Responsive bien pensé** : Breakpoints modernes avec support safe area
6. **Sécurité data-fetching** : Authentification systématique, isolation par utilisateur, données serveur-only
7. **Error handling** : Loading et error boundaries sur chaque dashboard
8. **Dark mode** : Support complet via CSS variables
9. **Code propre** : TypeScript strict, naming cohérent, pas de `any`, bonne séparation des responsabilités

---

## 13. Problèmes identifiés et recommandations

### Priorité haute

| # | Problème | Impact | Recommandation |
|---|----------|--------|----------------|
| 1 | Requête Prisma monolithique (Owner) | Performance dégradée avec beaucoup de données | Diviser en requêtes parallèles avec `Promise.all` |
| 2 | Pas de vérification de rôle dans les pages | Sécurité : un utilisateur authentifié pourrait accéder au mauvais dashboard | Ajouter une vérification `user.role` explicite dans chaque `page.tsx` |
| 3 | Pas de tests unitaires | Fiabilité : régression non détectée | Ajouter des tests de rendu pour chaque widget (état vide, normal, limites) |

### Priorité moyenne

| # | Problème | Impact | Recommandation |
|---|----------|--------|----------------|
| 4 | Pas de mise en cache serveur | Performance : chaque visite re-fetch tout | Utiliser `unstable_cache` ou `revalidate` pour les données peu volatiles |
| 5 | Graphique SVG sans aria-label | Accessibilité : lecteurs d'écran ne comprennent pas le graphique | Ajouter `role="img"` et `aria-label` descriptif |
| 6 | Pas de try/catch dans les pages serveur | Observabilité : erreurs non loguées | Wrapper les requêtes dans try/catch avec logging structuré |
| 7 | Données sérialisées trop larges | Performance + sécurité | Utiliser Prisma `select` pour ne transmettre que les champs affichés |

### Priorité faible

| # | Problème | Impact | Recommandation |
|---|----------|--------|----------------|
| 8 | Liens "Voir tout" sans aria-label | Accessibilité mineure | Ajouter `aria-label="Voir tous les {éléments}"` |
| 9 | Badges uniquement en couleur | Accessibilité daltoniens | Ajouter icônes complémentaires |
| 10 | Textes français en dur | Internationalisation future | Acceptable si le produit reste francophone |
| 11 | Pas de Suspense boundaries par widget | Streaming SSR sous-optimal | Ajouter des Suspense boundaries pour un chargement progressif |

---

## 14. Résumé par priorité

| Priorité | Nombre | Actions clés |
|----------|--------|-------------|
| **Haute** | 3 | Requêtes parallèles, vérification rôle, tests unitaires |
| **Moyenne** | 4 | Cache serveur, accessibilité SVG, try/catch, sélection minimale Prisma |
| **Faible** | 4 | Aria-labels, badges, i18n, Suspense |

**Score global : 7.5/10** — Les dashboards sont bien construits avec une architecture moderne et des bonnes pratiques. Les améliorations recommandées portent principalement sur l'optimisation des performances et le renforcement de la sécurité/accessibilité, pas sur des défauts structurels.
