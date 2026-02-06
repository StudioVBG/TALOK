# AUDIT COMPLET — Routes, Navigation, Boutons & Bugs (Talok)

**Date** : 2026-02-06
**Stack** : Next.js 14+ App Router, Supabase, TypeScript, Tailwind CSS, Shadcn/UI
**Scope** : 191 pages, 320+ API routes, 14 layouts, 10 rôles utilisateur

---

## TABLE DES MATIÈRES

1. [Carte complète des routes](#1-carte-complète-des-routes)
2. [Carte des liens et navigation](#2-carte-des-liens-et-navigation)
3. [Audit des boutons d'action et formulaires](#3-audit-des-boutons-daction-et-formulaires)
4. [Bugs trouvés](#4-bugs-trouvés)
5. [Pages et composants manquants](#5-pages-et-composants-manquants)
6. [Incohérences](#6-incohérences)
7. [Audit sécurité authentification](#7-audit-sécurité-authentification)
8. [Audit API routes](#8-audit-api-routes)
9. [Audit responsive et mobile](#9-audit-responsive-et-mobile)
10. [Recommandations de correction](#10-recommandations-de-correction)

---

## 1. CARTE COMPLÈTE DES ROUTES

### 1.1 Statistiques générales

| Élément | Nombre |
|---------|--------|
| Pages (page.tsx) | 191 |
| Layouts (layout.tsx) | 14 |
| Routes API (route.ts) | 320+ |
| Route groups | 3 — `(dashboard)`, `(marketing)`, `(public)` |
| Error pages (error.tsx) | 6 |
| Not-found pages | 2 |
| Loading pages | 33 |
| Global error | 1 |
| Middleware | 1 |

### 1.2 Routes par rôle

#### Routes Authentification

| # | Route URL | Fichier | Protégée | Status |
|---|-----------|---------|----------|--------|
| 1 | `/auth/signin` | `app/auth/signin/page.tsx` | Non | ✅ |
| 2 | `/auth/signup` | `app/auth/signup/page.tsx` | Non | ✅ Redirige → `/signup/role` |
| 3 | `/auth/forgot-password` | `app/auth/forgot-password/page.tsx` | Non | ✅ |
| 4 | `/auth/reset-password` | `app/auth/reset-password/page.tsx` | Non | ✅ |
| 5 | `/auth/verify-email` | `app/auth/verify-email/page.tsx` | Non | ✅ |
| 6 | `/auth/callback` | `app/auth/callback/route.ts` | Non | ✅ API route |
| 7 | `/signup/role` | `app/signup/role/page.tsx` | Non | ✅ |
| 8 | `/signup/account` | `app/signup/account/page.tsx` | Non | ✅ |
| 9 | `/signup/plan` | `app/signup/plan/page.tsx` | Non | ✅ |
| 10 | `/signup/verify-email` | `app/signup/verify-email/page.tsx` | Non | ✅ |

#### Routes Owner (50+ pages)

| # | Route URL | Fichier | Layout | Status |
|---|-----------|---------|--------|--------|
| 1 | `/owner` | `app/owner/page.tsx` | `app/owner/layout.tsx` | ✅ |
| 2 | `/owner/dashboard` | `app/owner/dashboard/page.tsx` | owner | ✅ |
| 3 | `/owner/properties` | `app/owner/properties/page.tsx` | owner | ✅ |
| 4 | `/owner/properties/new` | `app/owner/properties/new/page.tsx` | owner | ✅ |
| 5 | `/owner/properties/[id]` | `app/owner/properties/[id]/page.tsx` | owner | ✅ |
| 6 | `/owner/properties/[id]/edit` | `app/owner/properties/[id]/edit/page.tsx` | owner | ✅ |
| 7 | `/owner/properties/[id]/diagnostics` | `app/owner/properties/[id]/diagnostics/page.tsx` | owner | ✅ |
| 8 | `/owner/leases` | `app/owner/leases/page.tsx` | owner | ✅ |
| 9 | `/owner/leases/new` | `app/owner/leases/new/page.tsx` | owner | ✅ |
| 10 | `/owner/leases/[id]` | `app/owner/leases/[id]/page.tsx` | owner | ✅ |
| 11 | `/owner/leases/[id]/edit` | `app/owner/leases/[id]/edit/page.tsx` | owner | ✅ |
| 12 | `/owner/leases/[id]/roommates` | `app/owner/leases/[id]/roommates/page.tsx` | owner | ✅ |
| 13 | `/owner/leases/[id]/signers` | `app/owner/leases/[id]/signers/page.tsx` | owner | ✅ |
| 14 | `/owner/leases/parking/new` | `app/owner/leases/parking/new/page.tsx` | owner | ✅ |
| 15 | `/owner/money` | `app/owner/money/page.tsx` | owner | ✅ |
| 16 | `/owner/money/settings` | `app/owner/money/settings/page.tsx` | owner | ✅ |
| 17 | `/owner/tenants` | `app/owner/tenants/page.tsx` | owner | ✅ |
| 18 | `/owner/tenants/[id]` | `app/owner/tenants/[id]/page.tsx` | owner | ✅ |
| 19 | `/owner/documents` | `app/owner/documents/page.tsx` | owner | ✅ |
| 20 | `/owner/documents/upload` | `app/owner/documents/upload/page.tsx` | owner | ✅ |
| 21 | `/owner/ged` | `app/owner/ged/page.tsx` | owner | ✅ |
| 22 | `/owner/inspections` | `app/owner/inspections/page.tsx` | owner | ✅ |
| 23 | `/owner/inspections/new` | `app/owner/inspections/new/page.tsx` | owner | ✅ |
| 24 | `/owner/inspections/[id]` | `app/owner/inspections/[id]/page.tsx` | owner | ✅ |
| 25 | `/owner/inspections/[id]/edit` | `app/owner/inspections/[id]/edit/page.tsx` | owner | ✅ |
| 26 | `/owner/inspections/[id]/photos` | `app/owner/inspections/[id]/photos/page.tsx` | owner | ✅ |
| 27 | `/owner/inspections/template` | `app/owner/inspections/template/page.tsx` | owner | ✅ |
| 28 | `/owner/end-of-lease` | `app/owner/end-of-lease/page.tsx` | owner | ✅ |
| 29 | `/owner/end-of-lease/[id]` | `app/owner/end-of-lease/[id]/page.tsx` | owner | ✅ |
| 30 | `/owner/entities` | `app/owner/entities/page.tsx` | owner | ✅ |
| 31 | `/owner/entities/new` | `app/owner/entities/new/page.tsx` | owner | ✅ |
| 32 | `/owner/entities/[entityId]` | `app/owner/entities/[entityId]/page.tsx` | owner | ✅ |
| 33 | `/owner/legal-protocols` | `app/owner/legal-protocols/page.tsx` | owner | ✅ |
| 34 | `/owner/tickets` | `app/owner/tickets/page.tsx` | owner | ✅ |
| 35 | `/owner/tickets/new` | `app/owner/tickets/new/page.tsx` | owner | ✅ |
| 36 | `/owner/tickets/[id]` | `app/owner/tickets/[id]/page.tsx` | owner | ✅ |
| 37 | `/owner/tickets/[id]/quotes` | `app/owner/tickets/[id]/quotes/page.tsx` | owner | ✅ |
| 38 | `/owner/profile` | `app/owner/profile/page.tsx` | owner | ✅ |
| 39 | `/owner/profile/identity` | `app/owner/profile/identity/page.tsx` | owner | ✅ |
| 40 | `/owner/profile/emails` | `app/owner/profile/emails/page.tsx` | owner | ✅ |
| 41 | `/owner/profile/banking` | `app/owner/profile/banking/page.tsx` | owner | ✅ |
| 42 | `/owner/providers` | `app/owner/providers/page.tsx` | owner | ✅ |
| 43 | `/owner/providers/[id]` | `app/owner/providers/[id]/page.tsx` | owner | ✅ |
| 44 | `/owner/support` | `app/owner/support/page.tsx` | owner | ✅ |
| 45 | `/owner/messages` | `app/owner/messages/page.tsx` | owner | ✅ |
| 46 | `/owner/buildings` | `app/owner/buildings/page.tsx` | owner | ✅ |
| 47 | `/owner/buildings/[id]` | `app/owner/buildings/[id]/page.tsx` | owner | ✅ |
| 48 | `/owner/analytics` | `app/owner/analytics/page.tsx` | owner | ✅ |
| 49 | `/owner/taxes` | `app/owner/taxes/page.tsx` | owner | ✅ |
| 50 | `/owner/diagnostics` | `app/owner/diagnostics/page.tsx` | owner | ✅ |
| 51 | `/owner/indexation` | `app/owner/indexation/page.tsx` | owner | ✅ |
| 52 | `/owner/visits` | `app/owner/visits/page.tsx` | owner | ✅ |
| 53 | `/owner/work-orders` | `app/owner/work-orders/page.tsx` | owner | ✅ |
| 54 | `/owner/invoices/new` | `app/owner/invoices/new/page.tsx` | owner | ✅ |
| 55 | `/owner/invoices/[id]` | `app/owner/invoices/[id]/page.tsx` | owner | ✅ |
| 56 | `/owner/settings/branding` | `app/owner/settings/branding/page.tsx` | owner | ✅ |
| 57 | `/owner/settings/billing` | `app/(dashboard)/owner/settings/billing/page.tsx` | dashboard | ✅ |
| 58 | `/owner/onboarding/*` | 6 pages (profile, property, finance, invite, automation, review) | owner | ✅ |
| 59 | `/owner/copro/charges` | `app/owner/copro/charges/page.tsx` | owner | ✅ |
| 60 | `/owner/copro/regularisation` | `app/owner/copro/regularisation/page.tsx` | owner | ✅ |

#### Routes Tenant (30+ pages)

| # | Route URL | Fichier | Status |
|---|-----------|---------|--------|
| 1 | `/tenant/dashboard` | `app/tenant/dashboard/page.tsx` | ✅ |
| 2 | `/tenant/lease` | `app/tenant/lease/page.tsx` | ✅ |
| 3 | `/tenant/payments` | `app/tenant/payments/page.tsx` | ✅ |
| 4 | `/tenant/documents` | `app/tenant/documents/page.tsx` | ✅ |
| 5 | `/tenant/requests` | `app/tenant/requests/page.tsx` | ✅ |
| 6 | `/tenant/requests/new` | `app/tenant/requests/new/page.tsx` | ✅ |
| 7 | `/tenant/messages` | `app/tenant/messages/page.tsx` | ✅ |
| 8 | `/tenant/meters` | `app/tenant/meters/page.tsx` | ✅ |
| 9 | `/tenant/signatures` | `app/tenant/signatures/page.tsx` | ✅ |
| 10 | `/tenant/colocation` | `app/tenant/colocation/page.tsx` | ✅ |
| 11 | `/tenant/help` | `app/tenant/help/page.tsx` | ✅ |
| 12 | `/tenant/settings` | `app/tenant/settings/page.tsx` | ✅ |
| 13 | `/tenant/identity` | `app/tenant/identity/page.tsx` | ✅ |
| 14 | `/tenant/inspections` | `app/tenant/inspections/page.tsx` | ✅ |
| 15 | `/tenant/receipts` | `app/tenant/receipts/page.tsx` | ✅ |
| 16 | `/tenant/visits` | `app/tenant/visits/page.tsx` | ✅ |
| 17 | `/tenant/rewards` | `app/tenant/rewards/page.tsx` | ✅ |
| 18 | `/tenant/marketplace` | `app/tenant/marketplace/page.tsx` | ✅ |
| 19 | `/tenant/legal-rights` | `app/tenant/legal-rights/page.tsx` | ✅ |
| 20 | `/tenant/notifications` | `app/tenant/notifications/page.tsx` | ✅ |
| 21 | `/tenant/onboarding/*` | 5 pages (context, file, identity, payments, sign) | ✅ |

#### Routes Provider (19 pages)

| # | Route URL | Status |
|---|-----------|--------|
| 1 | `/provider/dashboard` | ✅ |
| 2 | `/provider/jobs` | ✅ |
| 3 | `/provider/jobs/[id]` | ✅ |
| 4 | `/provider/calendar` | ✅ |
| 5 | `/provider/quotes` | ✅ |
| 6 | `/provider/quotes/new` | ✅ |
| 7 | `/provider/quotes/[id]` | ✅ |
| 8 | `/provider/invoices` | ✅ |
| 9 | `/provider/documents` | ✅ |
| 10 | `/provider/reviews` | ✅ |
| 11 | `/provider/compliance` | ✅ |
| 12 | `/provider/settings` | ✅ |
| 13 | `/provider/help` | ✅ |
| 14 | `/provider/portfolio` | ✅ |
| 15 | `/provider/onboarding/*` | 4 pages | ✅ |

#### Routes Admin (28 pages)

| # | Route URL | Status |
|---|-----------|--------|
| 1 | `/admin/dashboard` | ✅ |
| 2 | `/admin/people` | ✅ |
| 3 | `/admin/properties` | ✅ |
| 4 | `/admin/templates` | ✅ |
| 5 | `/admin/plans` | ✅ |
| 6 | `/admin/blog` | ✅ |
| 7 | `/admin/integrations` | ✅ |
| 8 | `/admin/moderation` | ✅ |
| 9 | `/admin/accounting` | ✅ |
| 10 | `/admin/privacy` | ✅ |
| 11 | `/admin/reports` | ✅ |
| 12 | `/admin/compliance` | ✅ |
| 13 | `/admin/emails` | ✅ |
| 14 | `/admin/branding` | ✅ |
| 15 | `/admin/subscriptions` | ✅ (route group dashboard) |
| 16 | `/admin/providers/pending` | ✅ |
| 17 | `/admin/tenants` | ✅ |

#### Autres rôles

| Rôle | Pages | Status |
|------|-------|--------|
| Agency | 13 pages (`/agency/*`) | ✅ |
| Syndic | 17 pages (`/syndic/*`) | ✅ |
| Copro | 5 pages (`/copro/*`) | ✅ |
| Guarantor | 6 pages (`/guarantor/*`) | ✅ |

#### Routes Marketing/Publiques

| # | Route URL | Status |
|---|-----------|--------|
| 1 | `/` (Home) | ✅ |
| 2 | `/pricing` | ✅ |
| 3 | `/blog` | ✅ |
| 4 | `/blog/[slug]` | ✅ |
| 5 | `/contact` | ✅ |
| 6 | `/faq` | ✅ |
| 7 | `/guides` | ✅ |
| 8 | `/a-propos` | ✅ |
| 9 | `/temoignages` | ✅ |
| 10 | `/modeles` | ✅ |
| 11 | `/fonctionnalites` | ✅ |
| 12 | `/fonctionnalites/*` | 7 sous-pages ✅ |
| 13 | `/solutions/*` | 5 sous-pages ✅ |
| 14 | `/outils/*` | 4 calculateurs ✅ |
| 15 | `/legal/privacy` | ✅ |
| 16 | `/legal/terms` | ✅ |

### 1.3 Pages d'erreur

| Type | Fichier | Scope |
|------|---------|-------|
| 404 global | `app/not-found.tsx` | ✅ Custom en français |
| 500 global | `app/error.tsx` | ✅ Error boundary |
| Global error | `app/global-error.tsx` | ✅ Layout root |
| Owner 404 (property) | `app/owner/properties/[id]/not-found.tsx` | ✅ |
| Owner error | `app/owner/error.tsx` | ✅ |
| Admin error | `app/admin/error.tsx` | ✅ |
| Provider error | `app/provider/error.tsx` | ✅ |
| Tenant error | `app/tenant/error.tsx` | ✅ |
| Properties error | `app/owner/properties/error.tsx` | ✅ |

### 1.4 Middleware

**Fichier** : `middleware.ts` (141 lignes)

| Vérification | Status |
|-------------|--------|
| Protège `/owner/*` | ✅ |
| Protège `/tenant/*` | ✅ |
| Protège `/admin/*` | ✅ |
| Protège `/provider/*` | ✅ |
| Protège `/agency/*`, `/copro/*`, `/syndic/*`, `/guarantor/*` | ✅ |
| NE protège PAS `/`, `/auth/*`, `/signup/*`, `/pricing`, `/blog` | ✅ |
| NE protège PAS `/api/*` | ✅ |
| Redirige non-auth vers `/auth/signin?redirect=...` | ✅ |
| Gère les tokens expirés | ⚠️ Cookie-presence only (validation in layouts) |
| Distingue les rôles | ❌ Fait dans les layouts, pas le middleware |
| Détection white-label | ✅ Via header Host |
| Legacy redirects (`/app/*`, `/tenant/home`) | ✅ |

---

## 2. CARTE DES LIENS ET NAVIGATION

### 2.1 Statistiques de navigation

| Type | Nombre |
|------|--------|
| `<Link href="...">` | 422 |
| `router.push()` / `router.replace()` | 231 |
| `redirect()` (server-side) | 144 |
| `window.location` | ~25 |
| `onClick` avec navigation | 100+ |

### 2.2 Sidebar Owner (composant principal)

**Fichier** : `components/layout/owner-app-layout.tsx:66-108`

| # | Label | Destination | page.tsx existe | Status |
|---|-------|-------------|-----------------|--------|
| 1 | Tableau de bord | `/owner/dashboard` | ✅ | ✅ |
| 2 | Mes biens | `/owner/properties` | ✅ | ✅ |
| 3 | Baux & locataires | `/owner/leases` | ✅ | ✅ |
| 4 | États des lieux | `/owner/inspections` | ✅ | ✅ |
| 5 | Fin de bail (Premium) | `/owner/end-of-lease` | ✅ | ✅ |
| 6 | Loyers & revenus | `/owner/money` | ✅ | ✅ |
| 7 | Facturation | `/settings/billing` | ✅ | ⚠️ Route hors `/owner/*` |
| 8 | Documents | `/owner/documents` | ✅ | ✅ |
| 9 | GED (Nouveau) | `/owner/ged` | ✅ | ✅ |
| 10 | Protocoles juridiques | `/owner/legal-protocols` | ✅ | ✅ |
| 11 | Tickets | `/owner/tickets` | ✅ | ✅ |
| 12 | Aide & services | `/owner/support` | ✅ | ✅ |

### 2.3 Sidebar Owner (AppShell, layout alternatif)

**Fichier** : `components/layout/AppShell.tsx:63-86`

| # | Label | Destination | page.tsx existe | Bug |
|---|-------|-------------|-----------------|-----|
| 1 | Tableau de bord | `/owner` | ✅ | — |
| 2 | Mes biens | `/owner/properties` | ✅ | — |
| 3 | Baux | `/owner/leases` | ✅ | — |
| 4 | Finances | `/owner/money` | ✅ | — |
| 5 | Tickets | `/owner/tickets` | ✅ | — |
| 6 | Documents | `/owner/documents` | ✅ | — |
| 7 | Inspections | `/owner/inspections` | ✅ | — |
| 8 | Aide | `/owner/support` | ✅ | — |
| 9 | Paramètres | `/owner/settings` | ❌ | 🔴 `/owner/settings/page.tsx` N'EXISTE PAS |

### 2.4 Header (AppHeader) — ROLE_CONFIG

**Fichier** : `components/layout/app-header.tsx:36-65`

| Rôle | profilePath | settingsPath | messagesPath | supportPath |
|------|------------|-------------|-------------|------------|
| owner | `/owner/profile` ✅ | `/owner/settings` ❌ | `/owner/messages` ✅ | `/owner/support` ✅ |
| tenant | `/tenant/settings` ✅ | `/tenant/settings` ✅ | `/tenant/messages` ✅ | `/tenant/help` ✅ |
| provider | `/provider/profile` ❌ | `/provider/settings` ✅ | `/provider/messages` ❌ | `/provider/help` ✅ |
| syndic | `/syndic/profile` ❌ | `/syndic/settings` ❌ | `/syndic/messages` ❌ | `/syndic/help` ❌ |

### 2.5 Bottom Navigation (Mobile)

**Owner** (`components/layout/owner-bottom-nav.tsx`) :
1. Accueil → `/owner/dashboard` ✅
2. Biens → `/owner/properties` ✅
3. Loyers → `/owner/money` ✅
4. Baux → `/owner/leases` ✅
5. Plus → `/owner/support` ✅

**Provider** (`components/layout/provider-bottom-nav.tsx`) :
1. Dashboard → `/provider/dashboard` ✅
2. Missions → `/provider/jobs` ✅
3. Calendrier → `/provider/calendar` ✅
4. Devis → `/provider/quotes` ✅

### 2.6 Navbar publique

**Fichier** : `components/layout/navbar.tsx`

Tous les liens du mega-menu vérifié ✅ sauf :
- `/guides/gestion-sci` — ❌ Page n'existe pas (lien dans `/solutions/sci-familiales`)
- `/guides/declaration-2044` — ❌ Page n'existe pas (lien dans `/fonctionnalites/comptabilite-fiscalite`)

---

## 3. AUDIT DES BOUTONS D'ACTION ET FORMULAIRES

### 3.1 Formulaires principaux

| Page | Formulaire | Soumission | Validation client | Validation serveur | Redirect après | Gestion erreur | Status |
|------|-----------|-----------|-------------------|-------------------|---------------|---------------|--------|
| `/auth/signin` | SignInForm | Supabase auth | ✅ Email + password requis | ✅ Supabase | Role-based redirect | ✅ Toast FR | ✅ |
| `/auth/forgot-password` | ForgotPasswordForm | Supabase auth | ✅ Email requis | ✅ | `/auth/signin` | ✅ Toast FR | ✅ |
| `/auth/reset-password` | ResetPasswordForm | Supabase auth | ✅ | ✅ | `/auth/signin` | ✅ Toast FR | ✅ |
| `/signup/account` | SignupForm | Supabase auth | ✅ | ✅ | `/signup/verify-email` | ✅ | ✅ |
| `/owner/profile` | ProfileForm | API call | ✅ | ✅ | Reste sur page | ✅ Toast FR | ✅ |
| `/owner/properties/new` | PropertyForm V3 | Server Action | ✅ Zod 82 champs | ✅ | `/owner/properties/[id]` | ✅ | ✅ |
| `/owner/leases/new` | LeaseForm | API call | ✅ | ✅ Zod | `/owner/leases/[id]` | ✅ Toast FR | ✅ |
| `/owner/entities/new` | EntityWizard (5 étapes) | Server Action | ✅ Par étape | ✅ | `/owner/entities/[id]` | ✅ Toast FR | ✅ |
| `/owner/inspections/new` | InspectionForm | Server Action | ✅ | ✅ | `/owner/inspections/[id]` | ✅ | ✅ |
| `/owner/tickets/new` | TicketForm | Server Action | ✅ Zod | ✅ | `/owner/tickets` | ✅ Toast FR | ✅ |
| `/owner/money` | InvoiceGenerate | Server Action | ✅ | ✅ | Reste sur page | ✅ Toast FR | ✅ |

### 3.2 Server Actions

| Fichier | Actions | Validation Zod | RLS |
|---------|---------|---------------|-----|
| `features/billing/actions/invoices.ts` | createInvoice, updateStatus, generateMonthly, send | ✅ | ✅ |
| `features/tickets/actions/tickets.ts` | createTicket, updateStatus, sendMessage | ✅ | ✅ |
| `app/owner/properties/actions.ts` | updateProperty, deleteProperty, updateStatus | ✅ (82 champs) | ✅ |
| `app/owner/money/actions.ts` | markAsPaid, sendReminder, generateMonthly, cancel | ✅ | ✅ |
| `app/owner/entities/actions.ts` | createEntity, updateEntity, deleteEntity | ✅ | ✅ |
| `app/owner/leases/actions.ts` | terminateLease, activateLease, updateRent | ✅ | ✅ |

### 3.3 Boutons d'action critiques

| Page | Bouton | Action attendue | Status |
|------|--------|----------------|--------|
| `/owner/properties` | "+ Ajouter un bien" | → `/owner/properties/new` | ✅ |
| `/owner/leases` | "Créer un bail" | → `/owner/leases/new` | ✅ |
| `/owner/inspections` | "Nouvel état des lieux" | → `/owner/inspections/new` | ✅ |
| `/owner/tickets` | "Créer un ticket" | → `/owner/tickets/new` | ✅ |
| `/owner/entities` | "Créer une entité" | → `/owner/entities/new` | ✅ |
| `/owner/money` | "Générer facture" | Server Action (toast succès) | ✅ |
| `/owner/documents` | "Ajouter un document" | Upload form (toast succès) | ✅ |
| Login | "Se connecter" | Supabase auth → redirect | ✅ |
| Login | "Continuer avec Google" | OAuth redirect | ✅ |
| Login | "Continuer avec Apple" | OAuth redirect | ✅ |
| Header | "Déconnexion" | signOut → `/auth/signin` | ✅ |

---

## 4. BUGS TROUVÉS

### 🔴 Critiques

| # | Bug | Fichier | Ligne | Impact |
|---|-----|---------|-------|--------|
| B1 | **Lien cassé `/settings/security`** — Le bouton 2FA redirige vers `/settings/security?setup=2fa` mais cette page N'EXISTE PAS | `components/security/TwoFactorBanner.tsx` | 102, 153 | Utilisateur voit une 404 quand il clique sur "Activer 2FA" |
| B2 | **Lien cassé `/provider/profile`** — L'AppHeader redirige vers `/provider/profile` qui n'existe pas | `components/layout/app-header.tsx` | 53 | Provider voit une 404 pour "Mon profil" |
| B3 | **Lien cassé `/provider/messages`** — L'AppHeader redirige vers `/provider/messages` qui n'existe pas | `components/layout/app-header.tsx` | 55 | Provider voit une 404 pour "Messages" |
| B4 | **Liens cassés Syndic** — `/syndic/profile`, `/syndic/settings`, `/syndic/messages`, `/syndic/help` n'existent pas | `components/layout/app-header.tsx` | 59-63 | Tout le dropdown syndic est cassé |
| B5 | **Email contient lien cassé `/tenant/invoices`** — Le template email pointe vers une page inexistante | `supabase/functions/process-outbox/index.ts` | 951 | Locataire clique dans l'email → 404 |
| B6 | **Cookie CSRF non HttpOnly** — Le token CSRF est lisible par JavaScript | `lib/security/csrf.ts` | 146 | Vulnérabilité XSS → vol du token CSRF |
| B7 | **Fallback plaintext dans le chiffrement** — Les données non chiffrées sont retournées en clair silencieusement | `lib/security/encryption.service.ts` | 91-94 | IBAN/secrets potentiellement stockés en clair |

### 🟠 Hauts

| # | Bug | Fichier | Ligne | Impact |
|---|-----|---------|-------|--------|
| B8 | **Lien cassé `/guides/gestion-sci`** — Référencé dans la page Solutions SCI | `app/solutions/sci-familiales/page.tsx` | ~119 | Utilisateur voit une 404 |
| B9 | **Lien cassé `/guides/declaration-2044`** — Référencé dans la page Comptabilité | `app/fonctionnalites/comptabilite-fiscalite/page.tsx` | — | Utilisateur voit une 404 |
| B10 | **`/owner/settings` dans la sidebar AppShell** — Pointe vers `/owner/settings` qui n'a pas de `page.tsx` | `components/layout/AppShell.tsx` | 83 | 404 si utilisateur accède via cette sidebar |
| B11 | **Email confirmation bypass possible** — La vérification email dans le callback OAuth se fait APRÈS la création de session | `app/auth/callback/route.ts` | 23-24 | Utilisateurs non confirmés pourraient accéder aux dashboards |
| B12 | **Pas de `not-found.tsx` pour `/owner/leases/[id]`** — Si l'ID est invalide, pas de page 404 custom | `app/owner/leases/[id]/` | — | Erreur technique au lieu d'un message utilisateur |
| B13 | **Pas de `loading.tsx` pour `/owner/tickets/[id]`** — Page de 1415 lignes sans suspense | `app/owner/tickets/[id]/` | — | Écran blanc pendant le chargement |
| B14 | **154 fichiers avec `@ts-nocheck`** — Dette technique massive | Multiples | — | Erreurs TypeScript masquées |
| B15 | **`ignoreBuildErrors: true` dans next.config** — Les erreurs TS ne bloquent pas le build | `next.config.js` | — | Bugs déployés en production |

### 🟡 Moyens

| # | Bug | Fichier | Impact |
|---|-----|---------|--------|
| B16 | Redirect parameter non validé dans le middleware — Open redirect potentiel | `middleware.ts:117` | Phishing |
| B17 | Pas de validation de complexité du mot de passe (seulement length >= 8) | `app/signup/account/page.tsx` | Mots de passe faibles |
| B18 | Recovery codes 2FA générés avec `Math.random()` au lieu de `crypto.randomBytes()` | `lib/auth/totp.ts:87-89` | Codes prédictibles |
| B19 | Double implémentation de toast (shadcn + sonner) | Multiples | Incohérence UX |
| B20 | Certains Dialog n'ont pas de bouton fermer (X) — uniquement clic extérieur | Multiples Dialog | Accessibilité réduite |
| B21 | Sidebar "Facturation" pointe vers `/settings/billing` au lieu de `/owner/settings/billing` | `owner-app-layout.tsx:85` | Navigation incohérente (sort du contexte owner) |

### 🟢 Bas

| # | Bug | Fichier | Impact |
|---|-----|---------|--------|
| B22 | `console.error` en production dans les handlers d'auth | Multiples | Stack traces visibles |
| B23 | 50+ TODO/FIXME dans le code (fonctionnalités non implémentées) | Multiples | Features incomplètes |
| B24 | Pas de rate limiting sur les endpoints OAuth 2FA | `app/api/auth/2fa/*` | Brute force possible |
| B25 | Impersonation session stockée en cookie JSON sans validation de schéma | `app/api/admin/impersonate/route.ts` | Parse error potentiel |

---

## 5. PAGES ET COMPOSANTS MANQUANTS

### 5.1 Pages manquantes (liens cassés confirmés)

| Page manquante | Référencé par | Recommandation |
|---------------|---------------|----------------|
| `/settings/security` | `TwoFactorBanner.tsx` | Créer `app/settings/security/page.tsx` avec formulaire 2FA |
| `/provider/profile` | `app-header.tsx` (ROLE_CONFIG) | Créer la page OU remapper vers `/provider/settings` |
| `/provider/messages` | `app-header.tsx` (ROLE_CONFIG) | Créer la page OU retirer du dropdown |
| `/syndic/profile` | `app-header.tsx` (ROLE_CONFIG) | Créer la page |
| `/syndic/settings` | `app-header.tsx` (ROLE_CONFIG) | Créer la page |
| `/syndic/messages` | `app-header.tsx` (ROLE_CONFIG) | Créer la page |
| `/syndic/help` | `app-header.tsx` (ROLE_CONFIG) | Créer la page |
| `/guides/gestion-sci` | `solutions/sci-familiales/page.tsx` | Créer la page guide OU mettre à jour le lien |
| `/guides/declaration-2044` | `fonctionnalites/comptabilite-fiscalite/page.tsx` | Créer la page guide OU mettre à jour le lien |
| `/tenant/invoices` | `process-outbox/index.ts` (email) | Remplacer par `/tenant/payments` dans le template |
| `/owner/settings` (page index) | `AppShell.tsx` | Remapper vers `/owner/profile` |

### 5.2 Loading.tsx manquants pour les routes avec données

| Route | A loading.tsx | Recommandation |
|-------|--------------|----------------|
| `/owner/tickets/[id]` | ❌ | Ajouter (page client 1415 lignes) |
| `/owner/settings/branding` | ❌ | Ajouter (fetch données branding) |
| `/owner/buildings/[id]/units` | ❌ | Ajouter (fetch données units) |
| `/owner/entities/[entityId]` | ❌ | Ajouter |
| `/owner/end-of-lease` | ❌ | Ajouter |
| `/owner/legal-protocols` | ❌ | Ajouter |
| `/owner/visits` | ❌ | Ajouter |
| `/owner/work-orders` | ❌ | Ajouter |

### 5.3 Not-found.tsx manquants pour routes dynamiques

| Route | A not-found.tsx | Recommandation |
|-------|----------------|----------------|
| `/owner/leases/[id]` | ❌ | Ajouter (comme `/owner/properties/[id]/not-found.tsx`) |
| `/owner/tickets/[id]` | ❌ | Ajouter |
| `/owner/entities/[entityId]` | ❌ | Ajouter |
| `/owner/inspections/[id]` | ❌ | Ajouter |
| `/owner/invoices/[id]` | ❌ | Ajouter |
| `/owner/providers/[id]` | ❌ | Ajouter |
| `/owner/buildings/[id]` | ❌ | Ajouter |
| `/owner/tenants/[id]` | ❌ | Ajouter |
| `/owner/end-of-lease/[id]` | ❌ | Ajouter |

---

## 6. INCOHÉRENCES

### 6.1 Navigation incohérente entre composants

| Incohérence | Détail |
|-------------|--------|
| AppShell vs OwnerAppLayout | AppShell a 9 items, OwnerAppLayout a 12 items. AppShell manque GED, EDL, Fin de bail, Protocoles juridiques |
| AppShell "Paramètres" | Pointe vers `/owner/settings` (404) alors que OwnerAppLayout n'a pas de lien Paramètres dans la sidebar |
| AppHeader "Paramètres" owner | Pointe vers `/owner/settings` alors que la page correcte est `/owner/profile` |
| Facturation route | Pointe vers `/settings/billing` (hors contexte `/owner/`) dans la sidebar owner |
| Sidebar Provider (AppShell vs layout) | AppShell a 3 items, Provider layout a 10+ items |

### 6.2 Labelling incohérent

| Élément | Valeur actuelle | Valeur attendue |
|---------|----------------|-----------------|
| EDL label sidebar | "États des lieux" | OK — cohérent avec la feature |
| Route EDL | `/owner/inspections` | ⚠️ Nom technique "inspections" vs FR "états des lieux" |
| Route fin de bail | `/owner/end-of-lease` | OK — cohérent |
| AppShell "Finances" | `/owner/money` | OK mais OwnerAppLayout dit "Loyers & revenus" |

### 6.3 Dual toast library

- **Shadcn toast** (`components/ui/use-toast.ts`) — utilisé dans 390+ endroits
- **Sonner** — utilisé dans 3 fichiers (`UnitsManagementClient`, `charge-regularisation-card`, `invoice-list-unified`)
- **Recommandation** : Consolider sur une seule librairie

---

## 7. AUDIT SÉCURITÉ AUTHENTIFICATION

### 7.1 Flux d'authentification

| Flux | Status | Détails |
|------|--------|---------|
| Inscription (signup) | ✅ | `/signup/role` → `/signup/account` → `/signup/verify-email` → role-based redirect |
| Connexion (signin) | ✅ | Email/password + redirect basé sur le rôle (admin/owner/tenant/provider) |
| Mot de passe oublié | ✅ | `/auth/forgot-password` → email → `/auth/reset-password` → `/auth/signin` |
| Déconnexion | ✅ | `useSignOut` hook avec cleanup complet (localStorage, sessionStorage, cookies) + `window.location.href` |
| OAuth Google | ✅ | Implémenté avec `access_type=offline`, `prompt=consent` |
| OAuth Apple | ✅ | Implémenté avec scopes `name email` |
| OAuth GitHub | ✅ | Implémenté |
| 2FA TOTP | ✅ | Setup + verify + recovery codes + audit logging |
| Passkeys (WebAuthn) | ✅ | Register + authenticate endpoints |

### 7.2 Protection des routes par rôle

| Vérification | Status |
|-------------|--------|
| Owner layout vérifie role === "owner" | ✅ `app/owner/layout.tsx:45` |
| Tenant layout vérifie role === "tenant" | ✅ `app/tenant/layout.tsx:44` |
| Admin layout vérifie role === "admin" | ✅ `app/admin/layout.tsx:33` |
| Provider layout vérifie role | ✅ `app/provider/layout.tsx:60` |
| TENANT accède `/owner/*` → redirigé | ✅ Redirect vers `/tenant` |
| OWNER accède `/tenant/*` → redirigé | ✅ Redirect vers `/dashboard` |
| Token expiré → refresh auto | ✅ Géré par Supabase SDK |

### 7.3 Vulnérabilités identifiées

| Sévérité | Vulnérabilité | Fichier |
|----------|--------------|---------|
| 🔴 Critique | CSRF cookie non HttpOnly | `lib/security/csrf.ts:146` |
| 🔴 Critique | Fallback plaintext dans encryption | `lib/security/encryption.service.ts:91-94` |
| 🟠 Haut | Email confirmation bypass dans OAuth callback | `app/auth/callback/route.ts:23-24` |
| 🟡 Moyen | Open redirect via paramètre `redirect` | `middleware.ts:117` |
| 🟡 Moyen | Password complexity faible (length >= 8 seulement) | `app/signup/account/page.tsx` |
| 🟡 Moyen | Recovery codes avec `Math.random()` | `lib/auth/totp.ts:87-89` |
| 🟢 Bas | Pas de rate limiting sur 2FA endpoints | `app/api/auth/2fa/*` |

---

## 8. AUDIT API ROUTES

### 8.1 Statistiques

| Métrique | Valeur |
|----------|--------|
| Total API routes | 320+ fichiers |
| Couverture try/catch | 98% (810 occurrences) |
| Couverture auth | 89% (651 occurrences) |
| Validation Zod | 29% (125 fichiers) |
| Routes publiques (pas d'auth) | 3 (code/verify, webhooks, cron) |

### 8.2 Routes API sans authentification (volontaire)

| Route | Raison |
|-------|--------|
| `/api/public/code/verify` | Vérification de code propriété (données limitées) |
| `/api/webhooks/stripe` | Webhook Stripe (vérification par signature Bearer) |
| `/api/cron/notifications` | CRON job (vérification CRON_SECRET) |
| `/api/signature/[token]/*` | Accès par token (signature électronique) |

### 8.3 Points d'attention API

| Problème | Routes | Recommandation |
|----------|--------|----------------|
| Validation input manquante | ~200 routes sans Zod | Ajouter validation pour tous les POST/PUT/PATCH |
| SSRF potentiel | `/api/scrape/route.ts` | Ajouter whitelist de domaines |
| PDF generation from URLs | `/api/properties/share/[token]/pdf` | Valider les URLs |

---

## 9. AUDIT RESPONSIVE ET MOBILE

### 9.1 Statistiques

| Métrique | Valeur |
|----------|--------|
| Fichiers avec classes responsive | 472 |
| Composants bottom nav | 3 (owner, provider, shared) |
| Touch targets 44px+ | ✅ Respecté dans les navs |
| Safe area support (iOS/Android) | ✅ `pb-safe` |

### 9.2 Breakpoints

| Breakpoint | Usage |
|-----------|-------|
| Mobile (< md) | Bottom navigation, sheet menus |
| Tablet (md-lg) | Rail nav (provider), adaptation |
| Desktop (lg+) | Full sidebar |

### 9.3 Points positifs

- ✅ Bottom nav mobile avec 5 items max (UX best practice)
- ✅ Sheet/Drawer pour la sidebar mobile
- ✅ Inputs full-width sur mobile
- ✅ Grids responsive (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- ✅ Overflow-x-auto sur les tableaux
- ✅ Safe area pour iOS notch/Android gesture nav
- ✅ ARIA labels pour accessibilité

### 9.4 Points d'attention

| Problème potentiel | Status |
|-------------------|--------|
| Double scrollbar | ✅ Non détecté |
| Formulaires hors écran | ✅ Gérés avec sticky buttons |
| LeaseWizard sur mobile | ✅ Navigable (steps) |
| Tables sur mobile | ✅ Scroll horizontal |
| Modals plein écran mobile | ⚠️ Certains dialogs ne sont pas `sm:max-w-full` |

---

## 10. RECOMMANDATIONS DE CORRECTION

### 10.1 Corrections immédiates (P0)

| # | Action | Fichier | Modification |
|---|--------|---------|-------------|
| 1 | Créer `/settings/security` page | `app/settings/security/page.tsx` | Nouvelle page avec formulaire 2FA |
| 2 | Corriger ROLE_CONFIG provider | `components/layout/app-header.tsx:53` | `profilePath: "/provider/settings"` |
| 3 | Corriger ROLE_CONFIG provider messages | `components/layout/app-header.tsx:55` | Retirer `messagesPath` ou créer page |
| 4 | Corriger ROLE_CONFIG syndic (4 liens) | `components/layout/app-header.tsx:59-63` | Créer les pages ou remapper |
| 5 | Fixer cookie CSRF HttpOnly | `lib/security/csrf.ts:146` | `httpOnly: true` |
| 6 | Supprimer fallback plaintext encryption | `lib/security/encryption.service.ts:91-94` | Throw error au lieu de return plaintext |
| 7 | Corriger lien email `/tenant/invoices` | `supabase/functions/process-outbox/index.ts:951` | Remplacer par `/tenant/payments` |
| 8 | Corriger AppShell "Paramètres" | `components/layout/AppShell.tsx:83` | `href: "/owner/profile"` |

### 10.2 Corrections court-terme (P1)

| # | Action | Fichier |
|---|--------|---------|
| 1 | Créer `/guides/gestion-sci` page OU corriger le lien | `app/solutions/sci-familiales/page.tsx` |
| 2 | Créer `/guides/declaration-2044` page OU corriger le lien | `app/fonctionnalites/comptabilite-fiscalite/page.tsx` |
| 3 | Ajouter `not-found.tsx` pour toutes les routes `[id]` owner | 9 routes dynamiques |
| 4 | Ajouter `loading.tsx` aux routes manquantes | 8 routes |
| 5 | Valider le paramètre `redirect` dans le middleware | `middleware.ts:117` |
| 6 | Ajouter validation de complexité du mot de passe | `app/signup/account/page.tsx` |
| 7 | Corriger `Math.random()` → `crypto.randomBytes()` pour recovery codes | `lib/auth/totp.ts:87-89` |
| 8 | Unifier sidebar owner (AppShell vs OwnerAppLayout) | `AppShell.tsx` + `owner-app-layout.tsx` |

### 10.3 Corrections moyen-terme (P2)

| # | Action |
|---|--------|
| 1 | Consolider sur une seule librairie de toast (retirer sonner OU migrer tout vers sonner) |
| 2 | Réduire les 154 fichiers `@ts-nocheck` progressivement |
| 3 | Retirer `ignoreBuildErrors: true` de `next.config.js` quand possible |
| 4 | Ajouter validation Zod aux ~200 routes API sans validation |
| 5 | Ajouter bouton fermer (X) aux Dialog qui en manquent |
| 6 | Ajouter rate limiting aux endpoints 2FA |
| 7 | Implémenter monitoring Sentry (TODO existant dans le code) |
| 8 | Compléter les 50+ TODO/FIXME (PDF generation, email service, Stripe integration, etc.) |

---

## ANNEXE : TODO/FIXME DANS LE CODE

| Fichier | TODO |
|---------|------|
| `supabase/functions/generate-pdf/index.ts` | TODO: Implement with native PDF library |
| `app/api/pdf/generate/route.ts` | TODO: Implement receipt and invoice templates |
| `supabase/functions/analyze-documents/index.ts` | TODO: Integrate with OCR provider |
| `app/owner/money/actions.ts` | TODO: Integrate email service |
| `app/api/leases/[id]/pay/route.ts` | TODO: Create Payment Intent Stripe |
| `lib/monitoring/index.ts` | TODO: Integrate @sentry/nextjs |
| `app/guarantor/onboarding/sign/page.tsx` | TODO: Integrate eIDAS signature service |
| `app/settings/billing/page.tsx` | TODO: Get real usage data |
| `lib/services/reminder-service.ts` | TODO: Integrate email/SMS services |
| ... et 40+ autres | ... |
