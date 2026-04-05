# Audit Dashboard Proprietaire Talok — 5 avril 2026

## Resume executif

| Metrique | Valeur |
|----------|--------|
| **Pages auditees** | 72 |
| **Pages reelles (hors redirects)** | 63 |
| **Redirects SOTA 2026** | 7 |
| **Doublons partiels** | 2 (work-orders, buildings/[id]) |
| Fonctionnel + gate | 18 |
| Fonctionnel, gate partiel | 12 |
| Gate manquant critique | 8 |
| Flags PLAN_LIMITS jamais utilises | 8 / 30 |

---

## CRITIQUES — A corriger immediatement

### 1. money/ + invoices/ : AUCUN gate hasRentCollection
- **Impact** : Un utilisateur Gratuit accede au hub finances complet, cree des factures, voit Stripe Connect. La collecte de loyers (commission SEPA) est le principal driver de revenus.
- **Fichiers** : `app/owner/money/FinancesClient.tsx`, `app/owner/invoices/new/page.tsx`, `app/owner/invoices/[id]/page.tsx`
- **Fix** : Wrapper les onglets Encaissements + Compte bancaire dans `<PlanGate feature="tenant_payment_online">`. Ajouter `withFeatureAccess` sur les API routes invoices.

### 2. entities/ : gate API contourne par server actions
- **Impact** : Le gate `withFeatureAccess("multi_mandants")` existe sur la route REST `/api/owner/legal-entities` mais les server actions dans `entities/actions.ts` (createEntity, updateEntity, deleteEntity, bulkDelete) passent directement par Supabase SANS check. Un utilisateur Gratuit peut creer des entites SCI.
- **Fichiers** : `app/owner/entities/actions.ts` (5 fonctions sans gate)
- **Fix** : Ajouter `withFeatureAccess(profileId, "multi_mandants")` dans chaque server action. Ajouter `<PlanGate feature="multi_mandants">` sur `entities/page.tsx` et `entities/new/page.tsx`.

### 3. taxes/ : AUCUN gate hasFiscalAI
- **Impact** : Le simulateur fiscal complet (micro-foncier vs reel, BIC meuble, export PDF) est accessible a tous. Feature Pro+ (valeur upgrade majeure).
- **Fichiers** : `app/owner/taxes/page.tsx`
- **Fix** : `<PlanGate feature="scoring_advanced" mode="blur">` + `withFeatureAccess` sur `/api/exports/tax-summary`.

### 4. invoices/new : safeDate() non utilise
- **Impact** : `new Date()` brut (ligne 40) peut causer un RangeError sur des donnees mal formatees — le meme bug deja corrige sur `invoices/[id]`.
- **Fichiers** : `app/owner/invoices/new/page.tsx:40-41`
- **Fix** : Remplacer `new Date()` par `safeDate()`.

### 5. Dashboard entityId non passe au serveur
- **Impact** : L'API `/api/owner/dashboard` supporte `?entityId=` mais `OwnerDataProvider.tsx:132` ne le passe jamais. Les KPIs agregent toutes les entites — problematique pour un Enterprise avec plusieurs SCI.
- **Fichiers** : `app/owner/_data/OwnerDataProvider.tsx:132`
- **Fix** : Passer `entityId` depuis `useEntityStore()` dans l'appel fetch.

### 6. Tenants : entityId non filtre + scoring affiche sans gate
- **Impact** : On voit TOUS les locataires de toutes les entites. Le badge scoring (etoiles) s'affiche meme en Gratuit.
- **Fichiers** : `app/owner/tenants/TenantsClient.tsx`
- **Fix** : Filtrer par `activeEntityId`. Wrapper le scoring dans `<PlanGate feature="scoring_tenant">`.

### 7. Documents : divergence complete avec l'architecture SOTA
- **Impact** : Le code n'utilise AUCUNE des fonctions/hooks documentes dans le skill talok-documents-sota.
- **Details** :

| SOTA (skill) | Code reel |
|-------------|-----------|
| `lib/documents/constants.ts` | `lib/owner/constants` |
| `getDisplayName()` | `formatDocumentTitle()` custom |
| `useDocumentSearch` hook | Filtrage client-side `.filter().includes()` |
| `groupDocuments()` | `DocumentGroups` component |
| Types importes de constants | Types hardcodes dans upload/page.tsx |

- **Fix** : Trancher — aligner le code sur le skill OU mettre a jour le skill sur le code reel. Puis standardiser.

---

## IMPORTANTS — A corriger avant prod

### 8. Providers/[id] : gate absent sur page detail
- Page liste gatee (`hasProvidersManagement`) mais detail `/[id]` accessible par URL directe.
- **Fix** : Ajouter `useSubscription().hasFeature("providers_management")` sur `providers/[id]/page.tsx`.

### 9. Signers : maxSignaturesPerMonth non verifie cote UI
- Le gate API bloque (403) mais l'utilisateur ne voit aucun upsell, juste une erreur.
- **Fichier** : `app/owner/leases/[id]/signers/SignersClient.tsx`
- **Fix** : Ajouter `useUsageLimit("signatures")` + `SignatureUsageBadge`.

### 10. 6 sections avec gate UI sans gate API
- Un utilisateur technique peut appeler les API directement et contourner le PlanGate front.

| Section | Gate UI | Gate API manquant |
|---------|---------|------------------|
| `indexation/` | PlanGate "irl_revision" | API indexation |
| `copro/` | PlanGate "copro_module" | API copro |
| `analytics/` | PlanGate "owner_reports" | API dashboard analytics |
| `providers/` | UpgradeModal | API providers |
| `settings/branding/` | planToWhiteLabelLevel | API branding |
| `end-of-lease/` | Aucun | Aucun |

- **Fix** : Ajouter `withFeatureAccess()` dans chaque API route correspondante.

### 11. invoices/[id] : 2 statuts manquants
- `viewed` et `cancelled` definis dans `lib/types/status.ts` mais absents du `statusConfig`. Tombent en fallback `draft`.
- **Fix** : Ajouter les 2 statuts dans le `statusConfig` de `invoices/[id]/page.tsx`.

### 12. Documents upload : maxStorageMB non verifie cote UI
- L'API bloque mais l'utilisateur n'a aucun avertissement avant upload.
- **Fix** : Ajouter `useUsageLimit("documents_gb")` avec `UsageLimitBanner` sur `documents/upload/page.tsx`.

### 13. Tickets + work-orders : guard propertyIds absent
- Pas de guard si aucune propriete -> potentielle liste vide sans EmptyState.
- **Fix** : Ajouter guard `properties.length === 0` avec EmptyState CTA.

### 14. Profile/emails : viewer de templates, pas de preferences
- La page emails affiche des templates mais ne permet pas de configurer les preferences de notification.
- **Impact** : L'utilisateur ne peut pas choisir quels emails recevoir.

### 15. Onboarding : 6 pages pour 4 etapes
- Le step-indicator montre 4 etapes mais `automation/` et `invite/` existent hors du flux. Incoherence UX.

---

## Feature gates — Tableau complet

### Gates completement absents (ni UI ni API)

| Flag PlanLimits | Feature source | Pages concernees | Plan requis |
|-----------------|---------------|-----------------|-------------|
| hasRentCollection | tenant_payment_online | money/, invoices/ | Starter+ |
| hasFiscalAI | scoring_advanced | taxes/ | Pro+ |
| hasScoringTenant | scoring_tenant | tenants/ (badge etoiles) | Confort+ |
| hasPrioritySupport | priority_support | support/ | Enterprise S+ |
| hasMultiEntity (UI) | multi_mandants | entities/ (4 pages) | Enterprise S+ |

### Flags JAMAIS utilises nulle part (ni UI ni API)

| Flag | Commentaire |
|------|-------------|
| hasFECExport | Jamais gate — l'export FEC est accessible sans restriction |
| hasAITalo | Jamais gate — pas de page Agent IA TALO visible |
| hasOpenBanking | Jamais gate — money/settings Open Banking accessible a tous |
| hasAutoReminders | Jamais gate — seul SMS est gate |
| hasMultiUsers | Jamais gate — invitation d'utilisateurs sans restriction |
| hasSSO | Pas de page SSO |
| hasPrioritySupport | Pas de differenciation support |
| hasAPI | settings hasFeature generique mais pas api_access specifiquement |

### Gates corrects (UI + API)

| Section | Gate | Statut |
|---------|------|--------|
| properties/ + properties/new/ | maxProperties | Complet |
| leases/ | maxLeases | Complet |
| inspections/ | hasEdlDigital | Complet |
| work-orders/ | hasWorkOrders | Complet |
| leases/new (colocation) | colocation | Complet |

---

## Doublons et redirections

### Redirections SOTA 2026 (consolidation — OK)

| Page | Redirige vers | Statut |
|------|--------------|--------|
| `invoices/page.tsx` | `/owner/money` | OK |
| `ged/page.tsx` | `/owner/documents?tab=coffre-fort` | OK |
| `buildings/page.tsx` | `/owner/properties?tab=immeubles` | OK |
| `profile/banking/` | `/owner/money?tab=banque` | OK |
| `settings/billing/` | `/owner/money?tab=forfait` | OK |
| `settings/payments/` | `/owner/money?tab=paiement` | OK |
| `owner/page.tsx` | `/owner/dashboard` | OK |

### Doublons a resoudre

| Page A | Page B | Verdict |
|--------|--------|---------|
| `work-orders/` | `tickets/` | Navigation partagee TicketsTabNav — les deux coexistent. Consolider ou clarifier la frontiere |
| `buildings/[id]/` | (liste redirige mais detail reste) | Incoherence : supprimer les pages detail orphelines ou retirer la redirection liste |

---

## Inventaire page par page — Statut final

| # | Section | Pages | Donnees | Gate UI | Gate API | Statut |
|---|---------|-------|---------|---------|----------|--------|
| 1 | dashboard/ | 2 | Reelles + Realtime | UsageLimitBanner | — | entityId non passe |
| 2 | properties/ | 10 | CRUD complet | useUsageLimit | withSubscriptionLimit | OK |
| 3 | leases/ | 8 | 12 statuts, wizard 3 etapes | useUsageLimit | withSubscriptionLimit | signers pas de badge signatures |
| 4 | tenants/ | 2 | Reelles | Non | Non | entityId + scoring |
| 5 | entities/ | 4 | CRUD + wizard 5 etapes | Non | Route REST OK mais server actions non | Gate contourne |
| 6 | invoices/ | 3 | Reelles | Non | Non | hasRentCollection |
| 7 | money/ | 2 | Stripe Connect | Non | Non | hasRentCollection |
| 8 | documents/ | 2 | Reelles | Non storage | Oui storage API | SOTA divergence |
| 9 | taxes/ | 1 | Calculateur reel | Non | Non | hasFiscalAI |
| 10 | indexation/ | 1 | Reelles | PlanGate | Non | Pas de gate API |
| 11 | analytics/ | 1 | Reelles + charts | PlanGate | Non | Pas de gate API |
| 12 | inspections/ | 6 | CRUD + signature + PDF | Oui | Oui | OK |
| 13 | end-of-lease/ | 2 | Workflow complet | Non | Non | Pas de gate |
| 14 | tickets/ | 4 | Reelles + devis | Non (gratuit OK) | Non | Guard propertyIds |
| 15 | work-orders/ | 1 | Reelles | PlanGate | Oui | Guard propertyIds |
| 16 | providers/ | 2 | Reelles | Liste seulement | Non | Detail non gate |
| 17 | messages/ | 1 | Reelles | — | — | Realtime non confirme |
| 18 | visits/ | 1 | Reelles | — | — | OK |
| 19 | buildings/ | 3 | Redirect + detail | — | — | Detail orphelin |
| 20 | copro/ | 2 | Reelles | PlanGate | Non | Pas de gate API |
| 21 | legal-protocols/ | 1 | Partiel (statique) | — | — | OK |
| 22 | support/ | 1 | Formulaire | Non | Non | hasPrioritySupport |
| 23 | profile/ | 4 | Reelles | — | — | Emails = viewer pas prefs |
| 24 | settings/ | 4 | Redirects | Branding | Non | Pas de gate API branding |
| 25 | onboarding/ | 6 | Tout connecte | — | — | 6 pages / 4 etapes |
| 26 | diagnostics/ | 1 | Hub | — | — | OK |

---

## Recommandations — Plan d'action priorise

### Sprint 1 — Securite monetisation (2-3 jours)

1. **Gate hasRentCollection** sur money/ et invoices/ (UI + API)
2. **Gate entities server actions** — ajouter withFeatureAccess dans actions.ts
3. **Gate hasFiscalAI** sur taxes/ (UI + API)
4. **Gate hasScoringTenant** sur tenants/ (UI)
5. **Fix safeDate()** dans invoices/new

### Sprint 2 — UX gating coherent (2 jours)

6. **Ajouter gate UI** la ou seul le gate API existe (entities, documents/upload, signers)
7. **Ajouter gate API** la ou seul le gate UI existe (indexation, copro, analytics, providers, branding)
8. **Gate providers/[id]** page detail
9. **Fix invoices/[id]** — ajouter statuts `viewed` et `cancelled`

### Sprint 3 — entityId + donnees (1-2 jours)

10. **Passer entityId** dans OwnerDataProvider -> dashboard API
11. **Filtrer tenants** par entityId
12. **Guard propertyIds** dans tickets/ et work-orders/

### Sprint 4 — Standardisation (2-3 jours)

13. **Trancher documents SOTA** — aligner code <-> skill
14. **Activer les 8 flags jamais utilises** ou les retirer de PlanLimits
15. **Consolider buildings/[id]** — supprimer ou unifier avec properties
16. **Mettre a jour le skill talok-stripe-pricing** avec les vraies valeurs PLAN_LIMITS

### Backlog

17. Preferences notifications dans profile/emails
18. Onboarding : harmoniser 6 pages / 4 etapes
19. Messages : confirmer Supabase Realtime
20. End-of-lease : decider si gate necessaire

---

## Annexe — Source de verite PLAN_LIMITS

Fichier : `lib/subscriptions/plan-limits.ts` (derive de `lib/subscriptions/plans.ts`)

| Limite / Feature | Gratuit | Starter | Confort | Pro | Ent. S | Ent. M | Ent. L | Ent. XL |
|---|---|---|---|---|---|---|---|---|
| maxProperties | 1 | 3 | 10 | 50 | 100 | 200 | 500 | -1 |
| maxLeases | 1 | 5 | 25 | -1 | -1 | -1 | -1 | -1 |
| maxTenants | 2 | 10 | 40 | -1 | -1 | -1 | -1 | -1 |
| maxUsers | 1 | 1 | 2 | 5 | -1 | -1 | -1 | -1 |
| maxStorageMB | 102 | 1024 | 5120 | 30720 | 51200 | 102400 | 204800 | -1 |
| maxSignaturesPerMonth | 0 | 0 | 2 | 10 | 25 | 40 | 60 | -1 |
| hasRentCollection | Non | Oui | Oui | Oui | Oui | Oui | Oui | Oui |
| hasAccounting | Non | Non | Oui | Oui | Oui | Oui | Oui | Oui |
| hasFECExport | Non | Non | Oui | Oui | Oui | Oui | Oui | Oui |
| hasFiscalAI | Non | Non | Non | Oui | Oui | Oui | Oui | Oui |
| hasAITalo | Non | Non | Non | Oui | Oui | Oui | Oui | Oui |
| hasMultiEntity | Non | Non | Non | Non | Oui | Oui | Oui | Oui |
| hasAPI | Non | Non | Non | Oui | Oui | Oui | Oui | Oui |
| hasOpenBanking | Non | Non | Oui | Oui | Oui | Oui | Oui | Oui |
| hasAutoReminders | Non | Oui | Oui | Oui | Oui | Oui | Oui | Oui |
| hasAutoRemindersSMS | Non | Non | Non | Oui | Oui | Oui | Oui | Oui |
| hasIRLRevision | Non | Non | Oui | Oui | Oui | Oui | Oui | Oui |
| hasEdlDigital | Non | Non | Oui | Oui | Oui | Oui | Oui | Oui |
| hasScoringTenant | Non | Non | Oui | Oui | Oui | Oui | Oui | Oui |
| hasWorkOrders | Non | Non | Oui | Oui | Oui | Oui | Oui | Oui |
| hasProvidersManagement | Non | Non | Non | Oui | Oui | Oui | Oui | Oui |
| hasMultiUsers | Non | Non | Oui | Oui | Oui | Oui | Oui | Oui |
| hasCoproModule | Non | Non | Non | Non | Non | Non | Oui | Oui |
| hasWhiteLabel | Non | Non | Non | Non | Non | Oui | Oui | Oui |
| hasSSO | Non | Non | Non | Non | Non | Non | Non | Oui |
| hasPrioritySupport | Non | Non | Non | Non | Oui | Oui | Oui | Oui |

### Note sur le mapping features

- `hasFiscalAI` et `hasAITalo` derivent TOUS LES DEUX de `scoring_advanced` (plan-limits.ts:85-86)
- `hasAccounting` et `hasFECExport` derivent tous les deux de `bank_reconciliation` (plan-limits.ts:83-84)
- `hasMultiEntity` derive de `multi_mandants` — disponible seulement a partir de Enterprise S (pas Confort)

---

## Composants d'upsell reutilisables

| Composant | Fichier | Role |
|-----------|---------|------|
| PlanGate | `components/subscription/plan-gate.tsx` | Bloque/blur/hide selon hasFeature(featureKey) |
| PlanGateInline | `components/subscription/plan-gate.tsx:155` | Version inline pour boutons |
| PlanGateTooltip | `components/subscription/plan-gate.tsx:212` | Tooltip sur hover si bloque |
| UpgradeGate | `components/upgrade-gate.tsx` | Wrapper universel PlanLimits -> FeatureKey -> PlanGate |
| UpgradeModal | `components/subscription/upgrade-modal.tsx` | Modal d'upgrade vers plan superieur |
| UsageLimitBanner | `components/subscription/usage-limit-banner.tsx` | Bandeau quand usage > 80% |
| SmartPaywall | `components/subscription/smart-paywall.tsx` | Paywall intelligent avec variantes |
| useSubscription() | `components/subscription/subscription-provider.tsx:484` | Hook central : hasFeature(), canUseMore(), currentPlan, usage |
| useUsageLimit() | `components/subscription/subscription-provider.tsx:507` | Hook : canAdd, remaining, percentage, isAtLimit |
| usePlanAccess() | `lib/hooks/use-plan-access.ts:41` | Hook combinant useSubscription + PLAN_LIMITS |

## Enforcement API

| Fonction | Fichier | Resources/Features supportees |
|----------|---------|-------------------------------|
| withSubscriptionLimit() | `lib/middleware/subscription-check.ts:51` | properties, leases, users, documents_gb, signatures |
| withFeatureAccess() | `lib/middleware/subscription-check.ts:277` | Toute FeatureKey (verifie hasPlanFeature()) |

## API routes actuellement protegees

| Route API | Type de check | Resource/Feature |
|-----------|--------------|-----------------|
| POST /api/properties/init | withSubscriptionLimit | properties |
| POST /api/properties | withSubscriptionLimit | properties |
| POST /api/signatures/requests | withSubscriptionLimit | signatures |
| POST /api/documents/upload | withSubscriptionLimit | documents_gb |
| POST /api/edl | withFeatureAccess | edl_digital |
| POST /api/work-orders | withFeatureAccess | work_orders |
| POST /api/stripe/collect-rent | withFeatureAccess | tenant_payment_online |
| POST /api/units | withFeatureAccess | colocation |
| POST /api/leases/[id]/roommates | withFeatureAccess | colocation |
| POST /api/notifications/sms/send | withFeatureAccess | auto_reminders_sms |
| POST /api/owner/legal-entities | withFeatureAccess | multi_mandants |
| Service lease-creation.service.ts | withSubscriptionLimit | leases |
