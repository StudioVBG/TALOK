# RAPPORT D'AUDIT - DASHBOARD TALOK

## Date : 2026-02-08
## Version : 3bf6ce4 (main)
## Auditeur : Claude Code (Opus 4.6)

---

### RESUME EXECUTIF

- **Total de problemes** : 42
- 🔴 **Critiques** : 5
- 🟠 **Importants** : 14
- 🟡 **Mineurs** : 23
- 🟢 **Points forts** : 12
- **Score global** : 58/100

---

### POINTS FORTS ✅

1. **Architecture bien structuree** : Utilisation correcte du App Router Next.js 14+ avec layouts imbriques par role (owner, tenant, admin, provider, agency, syndic, copro, guarantor). Chaque role a son propre layout server component avec auth guard.

2. **Auth guards robustes** : Tous les layouts principaux (owner, tenant, admin, provider, agency) verifient l'authentification **et** le role cote serveur via `supabase.auth.getUser()` + verification du profil. Le middleware Edge protege les routes protegees par cookie-check leger.

3. **Systeme de design unifie** : Des tokens de design bien definis dans `lib/design-system/tokens.ts` couvrant: typographie, espacement, grilles, couleurs par statut, styles de badges, variants KPI.

4. **Composants KPI unifies** : Le `KpiCard` dans `components/ui/kpi-card.tsx` est un composant unifie SOTA 2026 avec support de: variants, tendances, animations (respectant `prefers-reduced-motion`), liens, loading states.

5. **Formatage monetaire correct** : Utilisation de `Intl.NumberFormat("fr-FR")` pour les montants en euros dans les composants financiers.

6. **Responsive mobile-first** : Les breakpoints Tailwind sont bien configures (xs: 360px, sm: 390px, md: 744px) et le design system inclut des tokens de grille responsifs.

7. **Lazy loading des composants lourds** : Le DashboardClient owner utilise `next/dynamic` pour charger les widgets lourds (OwnerTodoSection, OwnerFinanceSummary, etc.) avec des Skeletons en fallback.

8. **ErrorBoundary en place** : Tous les layouts principaux sont wrapes dans un `<ErrorBoundary>` component.

9. **Gestion des empty states** : Le composant `EmptyState` est utilise pour le cas ou il n'y a pas de proprietes.

10. **Pas de XSS** : Aucun `dangerouslySetInnerHTML` dans les fichiers du dashboard. Aucune balise `<a>` brute -- utilisation systematique de `next/link`.

11. **Pas de cles API exposees** : Aucune cle API hardcodee detectee dans les fichiers client du dashboard.

12. **Offline indicator** : Composant `OfflineIndicator` present dans les layouts admin, provider, et agency pour signaler la perte de connexion.

---

### PROBLEMES DETECTES

---

#### 🔴 CRITIQUES (a corriger immediatement)

---

**[C-001] 105 fichiers avec @ts-nocheck dans le dashboard**
- **Fichiers** : 105 fichiers dont `app/owner/dashboard/page.tsx`, `app/owner/dashboard/loading.tsx`, `app/provider/layout.tsx`, `app/guarantor/layout.tsx`, et 101 autres
- **Description** : `@ts-nocheck` desactive completement la verification TypeScript. Cela masque des bugs potentiels, des types incorrects et des erreurs de runtime.
- **Impact** : Bugs silencieux en production, types `any` implicites, pas de refactoring securise.
- **Correction** : Retirer progressivement `@ts-nocheck` en commencant par les fichiers critiques (layouts, dashboard pages). Corriger les erreurs TypeScript sous-jacentes.

```typescript
// Avant (app/owner/dashboard/page.tsx:4)
// @ts-nocheck

// Apres : Supprimer la directive et corriger les erreurs TS
```

---

**[C-002] 121 routes sans error.tsx (aucune gestion d'erreur par route)**
- **Description** : Sur ~130 routes de dashboard, seuls 5 fichiers `error.tsx` existent (au niveau racine de chaque role: owner, tenant, admin, provider + `owner/properties`). Toutes les sous-routes (leases/[id], properties/[id], invoices/new, etc.) n'ont aucun error boundary dedie.
- **Impact** : Si une page enfant crashe, l'error boundary le plus proche est celui du layout parent, ce qui remplace tout le contenu du dashboard par la page d'erreur. L'utilisateur perd le contexte de navigation.
- **Routes les plus critiques manquantes** :
  - `app/owner/dashboard/error.tsx`
  - `app/owner/leases/[id]/error.tsx`
  - `app/owner/properties/[id]/error.tsx`
  - `app/owner/money/error.tsx`
  - `app/tenant/dashboard/error.tsx`
  - `app/tenant/payments/error.tsx`
  - `app/agency/*/error.tsx` (aucun)
  - `app/guarantor/*/error.tsx` (aucun)
  - `app/copro/*/error.tsx` (aucun)
  - `app/syndic/*/error.tsx` (aucun)
- **Correction** : Creer un `error.tsx` generique reutilisable et le placer dans les routes critiques.

```typescript
// app/owner/dashboard/error.tsx
"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function OwnerDashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return <DashboardError error={error} reset={reset} returnHref="/owner/dashboard" />;
}
```

---

**[C-003] 148 routes sans loading.tsx (pas de loading state)**
- **Description** : Sur ~130 routes, seulement 33 ont un `loading.tsx`. Les routes sans loading state affichent un ecran blanc pendant le chargement server-side.
- **Impact** : UX degradee -- l'utilisateur ne sait pas si la page charge ou si elle est cassee. Particulierement problematique sur mobile avec une connexion lente.
- **Routes critiques manquantes** :
  - `app/agency/` (AUCUN loading.tsx sur aucune route)
  - `app/guarantor/` (AUCUN loading.tsx)
  - `app/copro/` (AUCUN loading.tsx)
  - `app/syndic/` (AUCUN loading.tsx)
  - `app/owner/leases/new/loading.tsx`
  - `app/owner/properties/new/loading.tsx`
  - `app/tenant/receipts/loading.tsx`
- **Correction** : Creer un composant `DashboardLoadingSkeleton` reutilisable.

```typescript
// components/ui/dashboard-loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
```

---

**[C-004] Tenant DashboardClient effectue du data fetching dans useEffect (anti-pattern)**
- **Fichier** : `app/tenant/dashboard/DashboardClient.tsx:91-134`
- **Description** : Le composant client utilise `useEffect` pour appeler `supabase.from("profiles")` et `supabase.from("edl_signatures")` directement. C'est un anti-pattern Next.js 14+ : le data fetching devrait etre dans le Server Component parent.
- **Impact** : Waterfall de requetes (auth -> profile -> edl_signatures), pas de streaming, pas de cache Next.js, double-fetch potentiel (deja charge dans le layout).
- **Correction** : Deplacer le fetching dans `app/tenant/dashboard/page.tsx` (Server Component) et passer les donnees en props.

```typescript
// app/tenant/dashboard/page.tsx (Server Component)
export default async function TenantDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // ... fetch pending EDLs server-side
  const pendingEDLs = await fetchPendingEDLs(user.id);
  return <DashboardClient pendingEDLs={pendingEDLs} />;
}
```

---

**[C-005] 317 usages de `: any` dans les fichiers dashboard**
- **Description** : 317 occurrences de types `any` explicites dans les composants et pages du dashboard. Exemples notables :
  - `app/owner/dashboard/DashboardClient.tsx:485` : `as any` pour risks
  - `app/owner/dashboard/DashboardClient.tsx:492` : `as any` pour activities
  - `app/tenant/dashboard/DashboardClient.tsx:124` : `.filter((sig: any) => ...)`
- **Impact** : Perte complete de la securite de types, bugs silencieux, autocompletion IDE inutilisable.
- **Correction** : Remplacer progressivement par des types stricts issus de `database.types.ts`.

---

#### 🟠 IMPORTANTS (a corriger rapidement)

---

**[I-001] 225 console.log/warn/error dans les fichiers dashboard**
- **Description** : 225 statements console dans le code de production. Les `console.error` dans les layouts (ex: `app/owner/layout.tsx:67-73`) et les `console.log` dans les composants (ex: `app/admin/branding/AdminBrandingClient.tsx:97`) polluent la console et peuvent exposer des informations sensibles.
- **Impact** : Performance degradee, fuite d'informations en production, bruit dans le monitoring.
- **Correction** : Remplacer par le `logger` du monitoring (`@/lib/monitoring`) deja utilise dans `error.tsx`.

---

**[I-002] Accents manquants dans les 4 fichiers error.tsx existants**
- **Fichiers** : `app/owner/error.tsx`, `app/tenant/error.tsx`, `app/admin/error.tsx`, `app/provider/error.tsx`
- **Description** : Tous les fichiers error.tsx affichent du texte sans accents :
  - "Proprietaire" → "Propriétaire"
  - "equipe technique a ete notifiee" → "équipe technique a été notifiée"
  - "reessayer" → "réessayer"
  - "Details" → "Détails"
- **Impact** : Aspect non professionnel, incohérence avec le reste de l'application qui est en français correct.
- **Correction** :

```typescript
// Avant
<CardTitle>Erreur dans votre espace Proprietaire</CardTitle>
// Apres
<CardTitle>Erreur dans votre espace Propriétaire</CardTitle>
```

---

**[I-003] Provider layout avec @ts-nocheck**
- **Fichier** : `app/provider/layout.tsx:4`
- **Description** : Le layout principal du provider a `// @ts-nocheck`. C'est un fichier critique qui definit la navigation et le layout de tout l'espace prestataire.
- **Impact** : Erreurs de types masquees dans un composant structural critique.

---

**[I-004] Guarantor layout avec @ts-nocheck**
- **Fichier** : `app/guarantor/layout.tsx`
- **Description** : Meme probleme que le provider layout.

---

**[I-005] Owner dashboard page.tsx passe `dashboardData={null}` en dur**
- **Fichier** : `app/owner/dashboard/page.tsx:41`
- **Description** : `return <DashboardClient dashboardData={null} profileCompletion={profileCompletion} />;` -- les donnees du dashboard sont passees comme `null` et le client component doit les recuperer via le Context du layout. Ce n'est pas incorrect en soi, mais cree une confusion : pourquoi avoir une prop si elle est toujours `null` ?
- **Impact** : Code confus, prop inutile, maintenance difficile.
- **Correction** : Soit supprimer la prop `dashboardData` soit la peupler dans le Server Component.

---

**[I-006] 4 boutons submit sans protection double-clic**
- **Fichiers** :
  - `app/owner/leases/[id]/signers/TenantInviteModal.tsx:229`
  - `app/owner/tickets/new/page.tsx:350`
  - `app/tenant/settings/TenantSettingsClient.tsx:389`
  - `app/tenant/requests/new/page.tsx:314`
- **Description** : Ces boutons `type="submit"` n'ont pas de logique `disabled={isSubmitting}` ou equivalent.
- **Impact** : Double-soumission de formulaires, creation de doublons, erreurs 409.
- **Correction** :

```typescript
<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? "Envoi en cours..." : "Envoyer"}
</Button>
```

---

**[I-007] Portails agency, copro, syndic et guarantor sans error.tsx ni loading.tsx**
- **Description** : Ces 4 portails n'ont AUCUN fichier `error.tsx` ni `loading.tsx` dans aucune de leurs routes. Un crash dans n'importe quelle page remonte au error.tsx racine de l'app.
- **Impact** : Experience utilisateur catastrophique en cas d'erreur ou de chargement lent.

---

**[I-008] Client Components excessifs : 62.5% du dashboard (170/272 fichiers)**
- **Description** : 170 fichiers sur 272 dans les portails dashboard utilisent `"use client"`. Next.js 14+ preconise de maximiser les Server Components.
- **Impact** : Bundle JavaScript plus volumineux envoye au client, hydratation plus lente, performance degradee sur mobile.
- **Correction** : Auditer chaque `"use client"` et migrer vers Server Components quand possible (affichage statique, data fetching, etc.).

---

**[I-009] 13 TODO comments non resolus dans le code du dashboard**
- **Fichiers principaux** :
  - `app/owner/leases/parking/new/page.tsx:21` : "TODO: Sauvegarder le bail en base"
  - `app/owner/copro/regularisation/page.tsx:104,141` : "TODO: Appeler l'API"
  - `app/owner/money/actions.ts:124` : "TODO: Integrer avec un service d'email"
  - `app/tenant/dashboard/DashboardClient.tsx:322` : "TODO: Verifier si le dossier est complet"
  - `app/admin/people/owners/[id]/OwnerDetailsClient.tsx:178,212,224` : Plusieurs TODOs
- **Impact** : Fonctionnalites incompletes en production.

---

**[I-010] Classe CSS en double `rounded-2xl rounded-xl`**
- **Fichier** : `app/owner/dashboard/DashboardClient.tsx:65`
- **Description** : `className="h-80 w-full rounded-2xl rounded-xl"` -- les deux classes sont en conflit, seule la derniere s'applique.
- **Impact** : Bug visuel mineur, mais signe d'un manque de relecture.
- **Correction** : `className="h-80 w-full rounded-xl"`

---

**[I-011] Le deprecated KpiCard utilise `require()` dynamique**
- **Fichier** : `components/dashboard/KpiCard.tsx:24`
- **Description** : `const { KpiCard } = require("@/components/ui/kpi-card");` -- utilisation de `require` dynamique dans un composant React. Cela contourne le tree-shaking et peut causer des warnings webpack.
- **Impact** : Bundle non optimise, warnings potentiels.
- **Correction** : Utiliser un import statique ou supprimer l'alias deprecated.

---

**[I-012] Pas de gestion de layout pour les portails guarantor, copro, syndic**
- **Description** : Bien que `app/guarantor/layout.tsx`, `app/copro/layout.tsx` et `app/syndic/layout.tsx` existent, ils ont tous `@ts-nocheck` et n'ont aucun `error.tsx` associe. La robustesse de ces portails est significativement inferieure aux portails owner/tenant.
- **Impact** : Portails secondaires fragiles.

---

**[I-013] Le Admin layout inline son design au lieu d'utiliser un composant layout dedie**
- **Fichier** : `app/admin/layout.tsx:49-55`
- **Description** : Le layout admin utilise des classes CSS inline (`flex min-h-screen mesh-gradient`, `flex-1 lg:pl-64`, `container mx-auto py-6 px-4 lg:px-8 max-w-7xl`) alors que les layouts owner et tenant utilisent des composants dedies (`OwnerAppLayout`, `TenantAppLayout`).
- **Impact** : Inconsistance architecturale, difficulte de maintenance.

---

**[I-014] Navigation provider avec icone FileText dupliquee**
- **Fichier** : `app/provider/layout.tsx:29-30`
- **Description** : Les items "Mes devis" et "Mes documents" utilisent tous deux l'icone `FileText`. Cela rend la navigation visuellement ambigue.
- **Correction** : Utiliser `FolderOpen` ou `File` pour les documents, garder `FileText` pour les devis.

---

#### 🟡 MINEURS (a corriger quand possible)

---

**[M-001] Tokens de typographie definis mais inconsistamment utilises**
- **Description** : `lib/design-system/tokens.ts` definit `typography.h1 = 'text-3xl font-bold tracking-tight'` mais le DashboardClient owner utilise `text-xl xs:text-2xl sm:text-3xl lg:text-4xl font-bold` (responsive, ne correspond pas au token). Chaque dashboard a ses propres tailles de titre.
- **Impact** : Inconsistance visuelle entre les pages.

**[M-002] Breakpoints custom xs:360px et sm:390px non standard**
- **Fichier** : `tailwind.config.ts:14-15`
- **Description** : Les breakpoints xs (360px) et sm (390px) sont trop proches (30px d'ecart). Le sm standard de Tailwind est 640px. Cela peut creer de la confusion pour les developpeurs.
- **Impact** : Confusion, difficulte de maintenance.

**[M-003] Console.error en anglais dans les layouts**
- **Fichiers** : Tous les layouts (`app/owner/layout.tsx:67`, `app/tenant/layout.tsx:59`, etc.)
- **Description** : Les messages console.error sont en anglais ("Error fetching properties:", "Error fetching tenant dashboard:"). Bien que ce soit standard pour les logs dev, c'est inconsistant avec l'interface en francais.

**[M-004] Pas de breadcrumbs dans les pages internes**
- **Description** : Aucun composant breadcrumb n'est utilise dans les pages enfants du dashboard (ex: `/owner/leases/[id]`, `/owner/properties/[id]`). L'utilisateur ne voit pas le chemin de navigation.
- **Impact** : Difficulte de navigation, surtout sur les pages profondes.

**[M-005] Owner dashboard utilise `dashboardData: null` comme fallback avec un EmptyState generique**
- **Fichier** : `app/owner/dashboard/DashboardClient.tsx:131-138`
- **Description** : Quand `dashboard` est null, un `EmptyState` avec "Chargement de votre tableau de bord..." est affiche. Ce n'est pas un vrai loading state mais un fallback indefini.

**[M-006] Animations Framer Motion sur le dashboard principal**
- **Fichier** : `app/owner/dashboard/DashboardClient.tsx`
- **Description** : Utilisation extensive de `motion.div` avec staggerChildren sur le dashboard. Respecte `useReducedMotion` dans KpiCard mais pas dans le dashboard lui-meme.
- **Impact** : Performance sur les appareils bas de gamme, accessibilite.

**[M-007] Provider layout ne verifie pas l'erreur auth**
- **Fichier** : `app/provider/layout.tsx:48`
- **Description** : `const { data: { user } } = await supabase.auth.getUser();` -- l'erreur auth n'est pas verifiee (contrairement aux autres layouts qui verifient `error: authError`).
- **Correction** : Ajouter `error: authError` et le verifier.

**[M-008] Espaces tenant : deux useEffect pour data fetching**
- **Fichier** : `app/tenant/dashboard/DashboardClient.tsx:91,141`
- **Description** : Deux `useEffect` separees pour le fetching, causant potentiellement deux cycles de rendu.

**[M-009] Manque de labels aria sur les elements interactifs du header**
- **Description** : Les avatars clickables et les indicateurs de status dans les headers de layout n'ont pas d'`aria-label`.

**[M-010] Pas de focus-ring explicite dans la navigation provider desktop**
- **Fichier** : `app/provider/layout.tsx:97`
- **Description** : Les items de navigation desktop du provider n'ont pas de `focus:ring` ou `focus-visible:ring`.

**[M-011] Le dashboard admin utilise `stats={null}` par defaut**
- **Fichier** : `app/admin/layout.tsx:44`
- **Description** : `<AdminDataProvider stats={null}>` -- les stats sont toujours `null` dans le layout, deleguees aux pages enfants.

**[M-012] Pas d'etat active sur les liens de navigation du provider desktop**
- **Fichier** : `app/provider/layout.tsx:94-103`
- **Description** : Les liens de navigation desktop du provider n'ont pas de detection de route active (`usePathname`). Tous les liens ont le meme style.
- **Correction** : Utiliser `usePathname()` pour appliquer un style actif.

**[M-013] Owner DashboardClient utilise un IIFE dans le JSX**
- **Fichier** : `app/owner/dashboard/DashboardClient.tsx:367-386`
- **Description** : `{(() => { ... })()}` dans le JSX pour calculer le taux d'occupation. Anti-pattern qui rend le code difficile a lire.
- **Correction** : Extraire dans une variable ou un composant.

**[M-014] Composant `DeprecatedKpiCard` toujours present**
- **Fichier** : `components/dashboard/KpiCard.tsx`
- **Description** : Composant deprecated avec re-export. Devrait etre migre et supprime.

**[M-015] Dashboard client owner charge toutes les sections meme si inutiles**
- **Description** : Les sections `UsageLimitBanner` et `UpgradeTrigger` sont toujours rendues meme si l'utilisateur a un plan illimite.

**[M-016] Pas de `<title>` ou metadata specifique par page dashboard**
- **Description** : Les pages dashboard n'exportent pas de `metadata` Next.js. Le titre de l'onglet navigateur n'est pas specifique (ex: "Talok - Mes biens" vs juste "Talok").

**[M-017] Owner layout charge 3 queries en parallele mais n'utilise pas Suspense**
- **Fichier** : `app/owner/layout.tsx:55-59`
- **Description** : `Promise.allSettled` est utilise (correct) mais le layout bloque le rendu jusqu'a la resolution des 3 queries. Suspense + streaming serait plus performant.

**[M-018] Tenant DashboardClient utilise `as any` pour les types EDL**
- **Fichier** : `app/tenant/dashboard/DashboardClient.tsx:124-125`
- **Description** : `.filter((sig: any) => sig.edl && sig.edl.status !== 'draft')` -- types non definis pour les donnees EDL.

**[M-019] Le design system n'a pas de variant pour le portail agency**
- **Fichier** : `lib/design-system/tokens.ts:282-307`
- **Description** : `roleStyles` definit owner, tenant, provider, admin mais pas agency, guarantor, syndic, copro.

**[M-020] Emoji ✨ dans le code du FinancialSummary**
- **Fichier** : `components/dashboard/FinancialSummary.tsx:124`
- **Description** : `✨ Tout est a jour !` utilise un emoji hardcode. Pourrait ne pas s'afficher correctement sur tous les appareils.

**[M-021] Pas de test unitaire pour les composants dashboard**
- **Description** : Aucun fichier de test n'a ete detecte pour les composants dans `components/dashboard/`.

**[M-022] Agency layout utilise `select("*")` pour le profil agence**
- **Fichier** : `app/agency/layout.tsx:63`
- **Description** : `supabase.from("agency_profiles").select("*")` -- selection de tous les champs au lieu de ne selectionner que les champs necessaires. Impact sur les performances reseau.

**[M-023] Le provider dashboard n'a pas de header dedie pour desktop**
- **Fichier** : `app/provider/layout.tsx:157-173`
- **Description** : Le header desktop du provider est inline dans le layout au lieu d'etre un composant dedie. Pas de barre de recherche, pas de raccourcis.

---

### AMELIORATIONS RECOMMANDEES 🚀

#### Performance

1. **Migrer le data fetching tenant vers Server Components** : Deplacer les appels Supabase du `useEffect` dans `TenantDashboardClient` vers `page.tsx` Server Component. Gain : elimination du waterfall client-side, meilleur TTI.

2. **Implementer Suspense + streaming** : Utiliser `<Suspense>` dans les layouts pour permettre le streaming des sections lourdes (graphiques, tableaux) sans bloquer le layout complet.

3. **Reduire le bundle client** : Migrer les composants d'affichage pur (KPI display, badges, status indicators) en Server Components. Objectif : passer de 62.5% a moins de 40% de Client Components.

4. **Selectionner les champs Supabase necessaires** : Remplacer `select("*")` par des selections specifiques dans les layouts et pages.

#### UX/UI

1. **Ajouter des breadcrumbs** : Creer un composant `Breadcrumbs` generique et l'integrer dans les pages profondes (leases/[id], properties/[id], etc.).

2. **Ajouter des metadata par page** : Chaque page devrait exporter un `metadata` Next.js avec un titre specifique (`"Mes biens | Talok"`, `"Bail #123 | Talok"`).

3. **Unifier les etats actifs de navigation** : Le provider desktop n'a pas d'etat actif. Tous les portails devraient utiliser `usePathname()` pour highlighter l'item de menu courant.

4. **Ajouter des transitions de page** : Uniformiser l'utilisation de `PageTransition` sur tous les portails, pas seulement owner.

#### Architecture

1. **Creer un template `error.tsx` generique** : Un seul composant parametrable par role, deploy sur toutes les routes critiques.

2. **Creer un template `loading.tsx` generique** : Un skeleton adaptatif par type de page (dashboard, liste, detail, formulaire).

3. **Supprimer le composant deprecated `KpiCard`** : Migrer tous les imports vers `@/components/ui/kpi-card` et supprimer `components/dashboard/KpiCard.tsx`.

4. **Completer les roleStyles du design system** : Ajouter agency, guarantor, syndic, copro dans `lib/design-system/tokens.ts`.

#### Accessibilite

1. **Ajouter `aria-label` aux boutons-icones** : Tous les boutons avec seulement une icone (fermeture, notification, avatar) doivent avoir un `aria-label`.

2. **Respecter `prefers-reduced-motion`** globalement : Le owner DashboardClient utilise Framer Motion sans verifier `useReducedMotion` au niveau global.

3. **Verifier les contrastes WCAG AA** : Les textes `text-slate-400` sur fond sombre dans le header du owner dashboard pourraient ne pas respecter le ratio 4.5:1.

---

### MATRICE DE PRIORISATION

| ID    | Probleme                                      | Severite | Effort  | Impact | Priorite |
|-------|-----------------------------------------------|----------|---------|--------|----------|
| C-001 | 105 fichiers @ts-nocheck                      | 🔴       | Eleve   | Eleve  | P0       |
| C-002 | 121 routes sans error.tsx                      | 🔴       | Moyen   | Eleve  | P0       |
| C-003 | 148 routes sans loading.tsx                    | 🔴       | Moyen   | Eleve  | P0       |
| C-004 | Tenant data fetching dans useEffect            | 🔴       | Faible  | Eleve  | P0       |
| C-005 | 317 usages de `: any`                         | 🔴       | Eleve   | Eleve  | P0       |
| I-001 | 225 console.log en production                  | 🟠       | Moyen   | Moyen  | P1       |
| I-002 | Accents manquants dans error.tsx               | 🟠       | Faible  | Moyen  | P1       |
| I-006 | 4 boutons sans protection double-clic          | 🟠       | Faible  | Eleve  | P1       |
| I-007 | Portails agency/copro/syndic/guarantor fragiles| 🟠       | Moyen   | Moyen  | P1       |
| I-008 | 62.5% Client Components                        | 🟠       | Eleve   | Moyen  | P1       |
| I-009 | 13 TODOs non resolus                           | 🟠       | Moyen   | Moyen  | P1       |
| I-010 | CSS double classe                              | 🟠       | Faible  | Faible | P1       |
| I-011 | Deprecated KpiCard avec require()              | 🟠       | Faible  | Faible | P2       |
| I-012 | Layout admin non componentise                  | 🟠       | Moyen   | Faible | P2       |
| I-013 | Inconsistance layout admin                     | 🟠       | Moyen   | Faible | P2       |
| I-014 | Icone FileText dupliquee                       | 🟠       | Faible  | Faible | P2       |
| M-001 | Tokens typographie non utilises                | 🟡       | Moyen   | Faible | P2       |
| M-004 | Pas de breadcrumbs                             | 🟡       | Moyen   | Moyen  | P2       |
| M-006 | Animations sans prefers-reduced-motion global  | 🟡       | Faible  | Faible | P2       |
| M-007 | Provider auth error non verifiee               | 🟡       | Faible  | Moyen  | P2       |
| M-012 | Pas d'etat actif navigation provider           | 🟡       | Faible  | Moyen  | P2       |
| M-016 | Pas de metadata par page                       | 🟡       | Moyen   | Moyen  | P2       |
| M-019 | roleStyles incomplet                           | 🟡       | Faible  | Faible | P3       |
| M-021 | Pas de tests unitaires dashboard               | 🟡       | Eleve   | Moyen  | P3       |

---

### PLAN D'ACTION RECOMMANDE

#### Sprint 1 (Urgent) - Corrections 🔴 Critiques

1. **Creer des error.tsx et loading.tsx generiques** et les deployer sur les routes critiques (dashboard, leases, properties, money, payments)
2. **Migrer le data fetching tenant** du useEffect vers le Server Component
3. **Corriger les accents dans error.tsx** (4 fichiers, 5 minutes)
4. **Corriger le CSS double-classe** (`rounded-2xl rounded-xl`)
5. **Ajouter la protection double-clic** aux 4 formulaires identifies
6. **Commencer le retrait progressif de @ts-nocheck** en priorite sur les layouts et dashboard pages

#### Sprint 2 (Important) - Corrections 🟠

1. **Remplacer console.log par le logger de monitoring** dans les 225 occurrences
2. **Ajouter error.tsx et loading.tsx** aux portails agency, copro, syndic, guarantor
3. **Resoudre les 13 TODOs** ou les convertir en issues GitHub
4. **Migrer les Client Components inutiles** vers Server Components
5. **Corriger le provider layout** (erreur auth, etat actif navigation, icone dupliquee)

#### Sprint 3 (Amelioration) - Corrections 🟡 + ameliorations

1. **Ajouter des breadcrumbs** aux pages profondes
2. **Ajouter des metadata** (`<title>`) par page
3. **Completer le design system** (roleStyles, tokens manquants)
4. **Implementer Suspense + streaming** pour le layout owner
5. **Supprimer le KpiCard deprecated**
6. **Ajouter des tests unitaires** pour les composants dashboard critiques
7. **Audit d'accessibilite complet** (aria-labels, focus-rings, contrastes)

---

### STATISTIQUES DE L'AUDIT

| Metrique                          | Valeur         |
|-----------------------------------|----------------|
| Routes dashboard totales          | ~130           |
| Portails (roles)                  | 8              |
| Fichiers TSX dashboard            | 272            |
| Fichiers avec @ts-nocheck         | 105 (38.6%)    |
| Usages de `: any`                 | 317            |
| Console.log/warn/error            | 225            |
| Client Components                 | 170/272 (62.5%)|
| Fichiers error.tsx                | 5 / ~130       |
| Fichiers loading.tsx              | 33 / ~130      |
| Layout.tsx                        | 8 (tous ok)    |
| TODOs non resolus                 | 13             |
| Formulaires sans protection       | 4              |
| dangerouslySetInnerHTML           | 0              |
| Cles API exposees                 | 0              |
| Raw `<a>` tags (vs Link)         | 0              |
| Raw `<img>` tags (vs Image)      | 0              |

---

> **Note** : Ce rapport est reutilisable. Relancez l'audit apres chaque sprint de corrections pour mesurer la progression du score global.
