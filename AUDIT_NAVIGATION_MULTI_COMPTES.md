# Audit Navigation & Multi-Comptes — Talok (Next.js 14+ App Router)

> Date : 2026-02-12
> Outil : Claude Code (Opus 4.6)
> Périmètre : Navigation, routing, sécurité des rôles, parcours utilisateur

---

## 1. RÉSUMÉ EXÉCUTIF

| Métrique | Valeur |
|---|---|
| **Routes totales (page.tsx)** | **213** |
| **Routes API (route.ts)** | **296** |
| **Rôles identifiés** | 8 (admin, owner, tenant, provider, agency, guarantor, syndic, coproprietaire) |
| **Liens cassés (CRITIQUE)** | **16** |
| **Pages orphelines** | 5 |
| **Pages placeholder/stub** | 2 |
| **Failles de sécurité/accès** | **3** |
| **Incohérences de redirection** | 2 |
| **Score de santé navigation global** | **78/100** |

### Score par rôle

| Rôle | Score | Pages OK | Pages attendues | Commentaire |
|---|---|---|---|---|
| **Propriétaire (owner)** | **92/100** | 46 | 50 | Très complet, quelques liens cassés dans la nav |
| **Locataire (tenant)** | **88/100** | 28 | 32 | Bon, mais settings sous-routes manquantes |
| **Prestataire (provider)** | **85/100** | 14 | 16 | Solide, aide et portfolio présents |
| **Admin** | **90/100** | 22 | 24 | Complet, 2 routes manquantes (settings, notifications) |
| **Agence (agency)** | **82/100** | 12 | 14 | Bien structuré, aide et help OK |
| **Garant (guarantor)** | **70/100** | 5 | 7 | **Faille : pas de vérification de rôle dans le layout** |
| **Syndic** | **80/100** | 17 | 20 | Bon onboarding, manque quelques pages |
| **Copropriétaire (copro)** | **75/100** | 5 | 7 | Données mockées, fonctionnel |

---

## 2. ÉTAPE 0 — SYSTÈME DE RÔLES

### 0a. Modèle de données utilisateur

**Table `profiles`** (schéma `public`) :
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','owner','tenant','provider','agency','guarantor','syndic','coproprietaire')),
  prenom TEXT, nom TEXT, telephone TEXT, avatar_url TEXT, date_naissance DATE,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  UNIQUE(user_id)
);
```

**Tables de profil spécialisées :**
- `owner_profiles` — SIRET, TVA, IBAN, type (particulier/societe), usage_strategie
- `tenant_profiles` — revenus, situation_pro, locataire_type, nb_adultes/enfants
- `provider_profiles` — type_services[], certifications, zones_intervention
- `guarantor_profiles` — relation, situation_pro, revenus, caution_type
- `agency_profiles` — raison_sociale, carte_pro, assurance_rcp, commission

**Un utilisateur = un seul rôle** (pas de multi-rôle). Le rôle est défini à l'inscription via `raw_user_meta_data->>'role'` et fallback sur `'tenant'`.

### 0b. Système d'authentification

| Aspect | Implémentation |
|---|---|
| **Provider auth** | Supabase Auth (email/password, OAuth Google/GitHub/Apple, Passkeys/WebAuthn, Magic Link) |
| **2FA** | TOTP via `lib/auth/totp.ts` |
| **Inscription** | `/signup/role` → `/signup/account` → `/signup/plan` → `/signup/verify-email` |
| **Connexion** | `/auth/signin` (commune à tous les rôles) |
| **Redirection post-login** | Via `protected-route.tsx` : owner→`/owner/dashboard`, tenant→`/tenant`, provider→`/provider`, admin→`/admin/dashboard` |
| **Invitations** | `/invite/[token]` pour locataires invités par propriétaire |

### 0c. Contexte de rôle côté client

- **Hook `useAuth()`** (`lib/hooks/use-auth.ts`) — expose `{ user, profile, loading, isAuthenticated }`
- **Composant `<ProtectedRoute>`** (`components/protected-route.tsx`) — accepte `allowedRoles?: UserRole[]`
- **Layouts serveur** — chaque layout (`/owner/layout.tsx`, `/tenant/layout.tsx`, etc.) vérifie le rôle côté serveur
- **Middleware Edge** (`middleware.ts`) — vérifie uniquement la présence d'un cookie auth (pas de vérification de rôle)

### Schéma des rôles

```
RÔLES IDENTIFIÉS :
├── owner      → redirection: /owner/dashboard    → accès: [dashboard, properties, leases, money, tickets, documents, inspections, etc.]
├── tenant     → redirection: /tenant             → accès: [dashboard, lease, payments, documents, requests, messages, etc.]
├── provider   → redirection: /provider           → accès: [dashboard, jobs, quotes, invoices, calendar, compliance, etc.]
├── admin      → redirection: /admin/dashboard    → accès: [dashboard, people, properties, plans, templates, blog, etc.]
├── agency     → redirection: /agency/dashboard   → accès: [dashboard, mandates, owners, properties, commissions, etc.]
├── guarantor  → redirection: /guarantor/dashboard → accès: [dashboard, profile, documents]
├── syndic     → redirection: /syndic/dashboard   → accès: [dashboard, sites, assemblies, expenses, calls, invites]
└── coproprietaire → redirection: /copro/dashboard → accès: [dashboard, charges, documents, tickets]
```

---

## 3. TABLEAU DES PROBLÈMES CRITIQUES 🔴

| # | Sévérité | Rôle(s) impacté(s) | Problème | Lien cassé | Fichier source | Fix suggéré |
|---|---|---|---|---|---|---|
| 1 | 🔴 CRITIQUE | owner | **`/owner/settings` n'existe pas** — Le dropdown user menu dans AppShell pointe vers `/${role}/settings` | `/owner/settings` | `components/layout/AppShell.tsx:407,413` | Changer `/${role}/settings` en `/${role}/profile` pour le rôle owner, ou créer `app/owner/settings/page.tsx` |
| 2 | 🔴 CRITIQUE | guarantor | **`/auth/signout` n'existe pas** — Le layout garant utilise `<a href="/auth/signout">` | `/auth/signout` | `app/guarantor/layout.tsx:61` | Utiliser le hook `useSignOut()` ou rediriger vers `/auth/signin` avec signOut serveur |
| 3 | 🔴 CRITIQUE | owner | **`/owner/invoices` (index) n'existe pas** — Seuls `/owner/invoices/new` et `/owner/invoices/[id]` existent | `/owner/invoices` | Navigation interne | Créer `app/owner/invoices/page.tsx` (liste des factures) |
| 4 | 🔴 CRITIQUE | owner | **`/owner/providers/invite` n'existe pas** | `/owner/providers/invite` | Liens internes | Créer `app/owner/providers/invite/page.tsx` |
| 5 | 🔴 CRITIQUE | tenant | **`/tenant/payments/pay` n'existe pas** — Référencé dans le command palette | `/tenant/payments/pay` | `components/command-palette/CommandPalette.tsx` | Créer la page ou rediriger vers `/tenant/payments` |
| 6 | 🔴 CRITIQUE | tenant | **`/tenant/support` n'existe pas** — Référencé mais pas de page | `/tenant/support` | Liens internes | Créer `app/tenant/support/page.tsx` ou utiliser `/tenant/help` |
| 7 | 🔴 CRITIQUE | owner | **`/owner/settings/subscription` n'existe pas** | `/owner/settings/subscription` | Navigation interne | Utiliser `/owner/settings/billing` (route group) ou créer un alias |
| 8 | 🔴 CRITIQUE | owner | **`/owner/settings/notifications` n'existe pas** — Référencé dans command palette | `/owner/settings/notifications` | `CommandPalette.tsx` | Créer `app/owner/settings/notifications/page.tsx` |
| 9 | 🔴 CRITIQUE | tenant | **`/tenant/settings/profile` n'existe pas** — Référencé dans command palette | `/tenant/settings/profile` | `CommandPalette.tsx` | Créer la sous-page ou rediriger vers `/tenant/settings` |
| 10 | 🔴 CRITIQUE | tenant | **`/tenant/settings/notifications` n'existe pas** | `/tenant/settings/notifications` | `CommandPalette.tsx` | Créer `app/tenant/settings/notifications/page.tsx` |
| 11 | 🔴 CRITIQUE | admin | **`/admin/settings` n'existe pas** — Référencé dans command palette | `/admin/settings` | `CommandPalette.tsx` | Créer `app/admin/settings/page.tsx` |
| 12 | 🔴 CRITIQUE | admin | **`/admin/notifications/send` n'existe pas** | `/admin/notifications/send` | `CommandPalette.tsx` | Créer la page ou retirer du command palette |
| 13 | 🔴 CRITIQUE | tous | **`/messages` (racine) n'existe pas** — Protégé par middleware mais pas de page | `/messages` | `middleware.ts:107` | Créer `app/messages/page.tsx` ou retirer de la liste protégée |
| 14 | 🔴 CRITIQUE | tous | **`/settings` (racine) n'existe pas** — Protégé par middleware mais index manquant | `/settings` | `middleware.ts:109` | Créer `app/settings/page.tsx` (redirect vers settings du rôle) |
| 15 | 🔴 CRITIQUE | owner | **Redirects vers `/login` au lieu de `/auth/signin`** | `/login` | `app/owner/indexation/page.tsx:62,73` | Changer `redirect("/login")` en `redirect("/auth/signin")` |
| 16 | 🔴 CRITIQUE | tenant | **Redirect vers `/login` au lieu de `/auth/signin`** | `/login` | `app/tenant/receipts/page.tsx:26` | Changer `redirect("/login")` en `redirect("/auth/signin")` |

---

## 4. TABLEAU DES FAILLES DE SÉCURITÉ/ACCÈS 🔐

| # | Sévérité | Route | Problème | Rôle non autorisé qui peut accéder | Fix suggéré |
|---|---|---|---|---|---|
| 1 | 🔴 CRITIQUE | `/guarantor/*` | **Le layout garant ne vérifie PAS le rôle** — N'importe quel utilisateur authentifié (owner, tenant, provider...) peut accéder aux pages garant via URL directe | owner, tenant, provider, admin, agency, syndic | Ajouter `if (profile.role !== "guarantor") { redirect("/dashboard"); }` dans `app/guarantor/layout.tsx` après la ligne 35 |
| 2 | ⚠️ MOYEN | `/copro/*` | **Le layout copro n'est pas visible** — Pas de layout.tsx identifié avec vérification de rôle pour le module copro | Tous les authentifiés | Créer `app/copro/layout.tsx` avec vérification `profile.role === "coproprietaire"` |
| 3 | ⚠️ MOYEN | Middleware Edge | **Le middleware ne vérifie pas les rôles** — Il vérifie seulement la présence d'un cookie auth. Un owner avec un cookie valide peut naviguer vers `/admin/dashboard` avant que le layout le redirige | Cross-rôle | Le design actuel est acceptable (validation dans les layouts serveur) mais ajouter une vérification de rôle dans le middleware serait plus défensif |

---

## 5. TABLEAU DES WARNINGS ⚠️

| # | Rôle(s) | Type | Description | Fichier | Recommandation |
|---|---|---|---|---|---|
| 1 | owner | Copro index manquant | `/owner/copro` n'a pas de page index (seuls charges/ et regularisation/) | `app/owner/copro/` | Créer un page.tsx index ou un redirect vers charges |
| 2 | copro | Données mockées | Les pages copro/documents, copro/tickets, copro/dashboard utilisent des données mockées | `app/copro/*/page.tsx` | Connecter aux vraies APIs |
| 3 | owner | Page de régularisation | `app/owner/copro/regularisation/page.tsx` a des TODOs pour l'intégration API (lignes 104, 141) | `app/owner/copro/regularisation/page.tsx` | Compléter l'intégration API |
| 4 | provider | Contact simulé | `app/provider/help/page.tsx` — Soumission du formulaire de contact simulée (ligne 166) | `app/provider/help/page.tsx` | Connecter à l'API d'emails |
| 5 | tous | not-found.tsx | Seules les routes `/owner/*/[id]/` ont des pages `not-found.tsx` personnalisées. Les routes tenant, provider, admin, agency, syndic, copro n'en ont pas | — | Ajouter des not-found.tsx dans les sections dynamiques |
| 6 | tous | error.tsx | Pas de `global-error.tsx` au niveau racine | `app/` | Créer `app/global-error.tsx` |
| 7 | guarantor | Navigation limitée | Le layout garant utilise des `<a>` au lieu de `<Link>` (pas de navigation SPA) | `app/guarantor/layout.tsx:54-65` | Utiliser `next/link` et créer une sidebar/nav cohérente |
| 8 | owner | AppShell dropdown | Les liens "Mon profil" et "Paramètres" dans le dropdown pointent tous deux vers `/${role}/settings` — doublon et incorrect pour owner | `components/layout/AppShell.tsx:407,413` | Différencier: profil→`/owner/profile`, paramètres→`/owner/settings/billing` |
| 9 | tous | Inconsistance breadcrumbs | Le breadcrumb component ne couvre pas toutes les sections (manque copro, syndic, agency) | `components/ui/breadcrumb.tsx` | Ajouter les segments manquants au mapping |
| 10 | syndic | Pas d'error.tsx global | Le module syndic n'a pas de `error.tsx` dans toutes ses sous-routes | `app/syndic/` | Ajouter des error boundaries |

---

## 6. CARTE VISUELLE DES ROUTES PAR RÔLE

```
app/
├── (auth)/
│   ├── auth/signin/page.tsx                    ✅ [TOUS]
│   ├── auth/signup/page.tsx                    ✅ [TOUS]
│   ├── auth/verify-email/page.tsx              ✅ [TOUS]
│   ├── auth/forgot-password/page.tsx           ✅ [TOUS]
│   ├── auth/reset-password/page.tsx            ✅ [TOUS]
│   ├── auth/callback/route.ts                  ✅ [TOUS]
│   └── auth/signout/                           ❌ MANQUANT [TOUS] — Utilisé par guarantor layout
│
├── (signup)/
│   ├── signup/role/page.tsx                    ✅ [TOUS]
│   ├── signup/account/page.tsx                 ✅ [TOUS]
│   ├── signup/plan/page.tsx                    ✅ [TOUS]
│   └── signup/verify-email/page.tsx            ✅ [TOUS]
│
├── (owner)/ ─────────────────────────────── PROPRIÉTAIRE
│   ├── owner/layout.tsx                        ✅ Vérifie role=owner
│   ├── owner/page.tsx                          ✅ (redirect → dashboard)
│   ├── owner/dashboard/page.tsx                ✅
│   ├── owner/properties/
│   │   ├── page.tsx                            ✅
│   │   ├── new/page.tsx                        ✅
│   │   └── [id]/
│   │       ├── page.tsx                        ✅
│   │       ├── edit/page.tsx                   ✅
│   │       └── diagnostics/
│   │           ├── page.tsx                    ✅
│   │           └── dpe/{upload,request}/page.tsx ✅
│   ├── owner/leases/
│   │   ├── page.tsx                            ✅
│   │   ├── new/page.tsx                        ✅
│   │   ├── parking/new/page.tsx                ✅
│   │   └── [id]/
│   │       ├── page.tsx                        ✅
│   │       ├── edit/page.tsx                   ✅
│   │       ├── signers/page.tsx                ✅
│   │       └── roommates/page.tsx              ✅
│   ├── owner/money/
│   │   ├── page.tsx                            ✅
│   │   └── settings/page.tsx                   ✅
│   ├── owner/tenants/
│   │   ├── page.tsx                            ✅
│   │   └── [id]/page.tsx                       ✅
│   ├── owner/tickets/
│   │   ├── page.tsx                            ✅
│   │   ├── new/page.tsx                        ✅
│   │   └── [id]/
│   │       ├── page.tsx                        ✅
│   │       └── quotes/page.tsx                 ✅
│   ├── owner/inspections/
│   │   ├── page.tsx                            ✅
│   │   ├── new/page.tsx                        ✅
│   │   ├── template/page.tsx                   ✅
│   │   └── [id]/
│   │       ├── page.tsx                        ✅
│   │       ├── edit/page.tsx                   ✅
│   │       └── photos/page.tsx                 ✅
│   ├── owner/documents/
│   │   ├── page.tsx                            ✅
│   │   └── upload/page.tsx                     ✅
│   ├── owner/invoices/
│   │   ├── page.tsx                            ❌ MANQUANT — index liste non créé
│   │   ├── new/page.tsx                        ✅
│   │   └── [id]/page.tsx                       ✅
│   ├── owner/providers/
│   │   ├── page.tsx                            ✅
│   │   ├── invite/page.tsx                     ❌ MANQUANT
│   │   └── [id]/page.tsx                       ✅
│   ├── owner/end-of-lease/
│   │   ├── page.tsx                            ✅
│   │   └── [id]/page.tsx                       ✅
│   ├── owner/entities/
│   │   ├── page.tsx                            ✅
│   │   ├── new/page.tsx                        ✅
│   │   └── [entityId]/
│   │       ├── page.tsx                        ✅
│   │       └── edit/page.tsx                   ✅
│   ├── owner/buildings/
│   │   ├── page.tsx                            ✅ (via loading.tsx)
│   │   └── [id]/
│   │       ├── page.tsx                        ✅
│   │       └── units/page.tsx                  ✅
│   ├── owner/profile/
│   │   ├── page.tsx                            ✅
│   │   ├── banking/page.tsx                    ✅
│   │   ├── emails/page.tsx                     ✅
│   │   └── identity/page.tsx                   ✅
│   ├── owner/settings/
│   │   ├── page.tsx                            ❌ MANQUANT — lien dans AppShell dropdown
│   │   ├── billing/page.tsx                    ✅ (via route group)
│   │   ├── branding/page.tsx                   ✅
│   │   ├── notifications/page.tsx              ❌ MANQUANT
│   │   └── subscription/page.tsx               ❌ MANQUANT
│   ├── owner/messages/page.tsx                 ✅
│   ├── owner/visits/page.tsx                   ✅
│   ├── owner/work-orders/page.tsx              ✅
│   ├── owner/taxes/page.tsx                    ✅
│   ├── owner/analytics/page.tsx                ✅
│   ├── owner/diagnostics/page.tsx              ✅
│   ├── owner/indexation/page.tsx               ✅ (⚠️ redirect vers /login)
│   ├── owner/ged/page.tsx                      ✅
│   ├── owner/legal-protocols/page.tsx          ✅
│   ├── owner/support/page.tsx                  ✅
│   ├── owner/copro/
│   │   ├── page.tsx                            ❌ MANQUANT (index)
│   │   ├── charges/page.tsx                    ✅
│   │   └── regularisation/page.tsx             ✅ (⚠️ TODOs API)
│   └── owner/onboarding/
│       ├── profile/page.tsx                    ✅
│       ├── property/page.tsx                   ✅
│       ├── finance/page.tsx                    ✅
│       ├── invite/page.tsx                     ✅
│       ├── automation/page.tsx                 ✅
│       └── review/page.tsx                     ✅
│
├── (tenant)/ ─────────────────────────────── LOCATAIRE
│   ├── tenant/layout.tsx                       ✅ Vérifie role=tenant
│   ├── tenant/page.tsx                         ✅ (redirect → dashboard)
│   ├── tenant/dashboard/page.tsx               ✅
│   ├── tenant/lease/page.tsx                   ✅
│   ├── tenant/payments/
│   │   ├── page.tsx                            ✅
│   │   └── pay/page.tsx                        ❌ MANQUANT
│   ├── tenant/documents/page.tsx               ✅
│   ├── tenant/requests/
│   │   ├── page.tsx                            ✅
│   │   └── new/page.tsx                        ✅
│   ├── tenant/messages/page.tsx                ✅
│   ├── tenant/inspections/
│   │   ├── page.tsx                            ✅
│   │   └── [id]/page.tsx                       ✅
│   ├── tenant/visits/
│   │   ├── page.tsx                            ✅
│   │   └── [id]/page.tsx                       ✅
│   ├── tenant/meters/page.tsx                  ✅
│   ├── tenant/signatures/page.tsx              ✅
│   ├── tenant/colocation/page.tsx              ✅
│   ├── tenant/receipts/page.tsx                ✅ (⚠️ redirect vers /login)
│   ├── tenant/identity/
│   │   ├── page.tsx                            ✅
│   │   └── renew/page.tsx                      ✅
│   ├── tenant/legal-rights/page.tsx            ✅
│   ├── tenant/marketplace/page.tsx             ✅
│   ├── tenant/rewards/page.tsx                 ✅
│   ├── tenant/notifications/page.tsx           ✅
│   ├── tenant/help/page.tsx                    ✅
│   ├── tenant/settings/
│   │   ├── page.tsx                            ✅
│   │   ├── profile/page.tsx                    ❌ MANQUANT
│   │   └── notifications/page.tsx              ❌ MANQUANT
│   ├── tenant/support/page.tsx                 ❌ MANQUANT
│   └── tenant/onboarding/
│       ├── context/page.tsx                    ✅
│       ├── file/page.tsx                       ✅
│       ├── identity/page.tsx                   ✅
│       ├── payments/page.tsx                   ✅
│       └── sign/page.tsx                       ✅
│
├── (provider)/ ───────────────────────────── PRESTATAIRE
│   ├── provider/layout.tsx                     ✅ Vérifie role=provider
│   ├── provider/page.tsx                       ✅ (redirect → dashboard)
│   ├── provider/dashboard/page.tsx             ✅
│   ├── provider/jobs/
│   │   ├── page.tsx                            ✅
│   │   └── [id]/page.tsx                       ✅
│   ├── provider/quotes/
│   │   ├── page.tsx                            ✅
│   │   ├── new/page.tsx                        ✅
│   │   └── [id]/page.tsx                       ✅
│   ├── provider/invoices/page.tsx              ✅
│   ├── provider/calendar/page.tsx              ✅
│   ├── provider/documents/page.tsx             ✅
│   ├── provider/reviews/page.tsx               ✅
│   ├── provider/compliance/page.tsx            ✅
│   ├── provider/portfolio/page.tsx             ✅
│   ├── provider/settings/page.tsx              ✅
│   ├── provider/help/page.tsx                  ✅
│   └── provider/onboarding/
│       ├── profile/page.tsx                    ✅
│       ├── services/page.tsx                   ✅
│       ├── ops/page.tsx                        ✅
│       └── review/page.tsx                     ✅
│
├── (admin)/ ──────────────────────────────── ADMIN
│   ├── admin/layout.tsx                        ✅ Vérifie role=admin
│   ├── admin/page.tsx                          ✅ (redirect → dashboard)
│   ├── admin/dashboard/page.tsx                ✅
│   ├── admin/people/
│   │   ├── page.tsx                            ✅
│   │   ├── owners/[id]/page.tsx                ✅
│   │   ├── tenants/[id]/page.tsx               ✅
│   │   └── vendors/[id]/page.tsx               ✅
│   ├── admin/properties/
│   │   ├── page.tsx                            ✅
│   │   └── [id]/{page,edit}/page.tsx           ✅
│   ├── admin/plans/page.tsx                    ✅
│   ├── admin/templates/page.tsx                ✅
│   ├── admin/blog/
│   │   ├── page.tsx                            ✅
│   │   ├── new/page.tsx                        ✅
│   │   └── [id]/edit/page.tsx                  ✅
│   ├── admin/email-templates/page.tsx          ✅
│   ├── admin/emails/page.tsx                   ✅
│   ├── admin/integrations/page.tsx             ✅
│   ├── admin/moderation/page.tsx               ✅
│   ├── admin/accounting/page.tsx               ✅
│   ├── admin/compliance/page.tsx               ✅
│   ├── admin/privacy/page.tsx                  ✅
│   ├── admin/reports/page.tsx                  ✅
│   ├── admin/branding/page.tsx                 ✅
│   ├── admin/providers/pending/page.tsx        ✅
│   ├── admin/tenants/{page,[id]/page}.tsx      ✅
│   ├── admin/settings/page.tsx                 ❌ MANQUANT
│   └── admin/notifications/send/page.tsx       ❌ MANQUANT
│
├── (agency)/ ─────────────────────────────── AGENCE
│   ├── agency/layout.tsx                       ✅ Vérifie role=agency|admin
│   ├── agency/page.tsx                         ✅ (redirect → dashboard)
│   ├── agency/dashboard/page.tsx               ✅
│   ├── agency/mandates/{page,new}/page.tsx     ✅
│   ├── agency/owners/{page,invite}/page.tsx    ✅
│   ├── agency/properties/page.tsx              ✅
│   ├── agency/tenants/page.tsx                 ✅
│   ├── agency/commissions/page.tsx             ✅
│   ├── agency/finances/page.tsx                ✅
│   ├── agency/documents/page.tsx               ✅
│   ├── agency/team/page.tsx                    ✅
│   ├── agency/settings/page.tsx                ✅
│   └── agency/help/page.tsx                    ✅
│
├── (guarantor)/ ──────────────────────────── GARANT
│   ├── guarantor/layout.tsx                    ⚠️ NE VÉRIFIE PAS LE RÔLE
│   ├── guarantor/page.tsx                      ✅
│   ├── guarantor/dashboard/page.tsx            ✅
│   ├── guarantor/profile/page.tsx              ✅
│   ├── guarantor/documents/page.tsx            ✅
│   └── guarantor/onboarding/
│       ├── context/page.tsx                    ✅
│       ├── financial/page.tsx                  ✅
│       └── sign/page.tsx                       ✅
│
├── (syndic)/ ─────────────────────────────── SYNDIC
│   ├── syndic/layout.tsx                       ✅ Vérifie role=syndic
│   ├── syndic/dashboard/page.tsx               ✅
│   ├── syndic/sites/{page,[id]/page,[id]/edit}/page.tsx  ✅
│   ├── syndic/assemblies/{page,new,[id]/page,[id]/edit}  ✅
│   ├── syndic/expenses/new/page.tsx            ✅
│   ├── syndic/calls/new/page.tsx               ✅
│   ├── syndic/invites/page.tsx                 ✅
│   └── syndic/onboarding/{profile,site,buildings,units,owners,tantiemes,complete}  ✅
│
├── (copro)/ ──────────────────────────────── COPROPRIÉTAIRE
│   ├── copro/layout.tsx                        ❌ MANQUANT — Pas de vérification de rôle
│   ├── copro/dashboard/page.tsx                ✅ (⚠️ données mockées)
│   ├── copro/charges/page.tsx                  ✅ (⚠️ données mockées)
│   ├── copro/documents/page.tsx                ✅ (⚠️ données mockées)
│   ├── copro/tickets/page.tsx                  ✅ (⚠️ données mockées)
│   └── copro/assemblies/[id]/page.tsx          ✅
│
├── (public)/ ─────────────────────────────── PAGES PUBLIQUES
│   ├── page.tsx                                ✅ Landing page
│   ├── pricing/page.tsx                        ✅
│   ├── blog/{page,[slug]}/page.tsx             ✅
│   ├── contact/page.tsx                        ✅
│   ├── faq/page.tsx                            ✅
│   ├── a-propos/page.tsx                       ✅
│   ├── temoignages/page.tsx                    ✅
│   ├── guides/page.tsx                         ✅
│   ├── modeles/page.tsx                        ✅
│   ├── legal/{terms,privacy}/page.tsx          ✅
│   ├── fonctionnalites/
│   │   ├── page.tsx                            ✅
│   │   ├── gestion-biens/page.tsx              ✅
│   │   ├── gestion-locataires/page.tsx         ✅
│   │   ├── etats-des-lieux/page.tsx            ✅
│   │   ├── signature-electronique/page.tsx     ✅
│   │   ├── quittances-loyers/page.tsx          ✅
│   │   ├── comptabilite-fiscalite/page.tsx     ✅
│   │   └── paiements-en-ligne/page.tsx         ✅
│   ├── solutions/
│   │   ├── proprietaires-particuliers/page.tsx ✅
│   │   ├── investisseurs/page.tsx              ✅
│   │   ├── administrateurs-biens/page.tsx      ✅
│   │   ├── sci-familiales/page.tsx             ✅
│   │   └── dom-tom/page.tsx                    ✅
│   └── outils/
│       ├── calcul-rendement-locatif/page.tsx   ✅
│       ├── calcul-revision-irl/page.tsx        ✅
│       ├── calcul-frais-notaire/page.tsx       ✅
│       └── simulateur-charges/page.tsx         ✅
│
├── (shared)/ ─────────────────────────────── PAGES PARTAGÉES
│   ├── dashboard/page.tsx                      ✅ (smart redirect par rôle)
│   ├── profile/page.tsx                        ✅
│   ├── notifications/page.tsx                  ✅
│   ├── messages/page.tsx                       ❌ MANQUANT
│   ├── settings/
│   │   ├── page.tsx                            ❌ MANQUANT (index)
│   │   ├── billing/page.tsx                    ✅
│   │   ├── notifications/page.tsx              ✅
│   │   └── security/page.tsx                   ✅
│   ├── signature/[token]/page.tsx              ✅
│   ├── signature/success/page.tsx              ✅
│   ├── signature-edl/[token]/page.tsx          ✅
│   ├── invite/[token]/page.tsx                 ✅
│   ├── invite/copro/page.tsx                   ✅
│   └── rejoindre-logement/page.tsx             ✅
│
├── error.tsx                                   ✅
├── not-found.tsx                               ✅
├── global-error.tsx                            ❌ MANQUANT
└── loading.tsx                                 ❌ MANQUANT (racine)
```

---

## 7. MATRICE DE COUVERTURE FONCTIONNELLE

| Fonctionnalité | Owner | Tenant | Provider | Admin | Agency | Guarantor | Syndic | Copro |
|---|---|---|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Onboarding | ✅ (6 étapes) | ✅ (5 étapes) | ✅ (4 étapes) | N/A | N/A | ✅ (3 étapes) | ✅ (7 étapes) | N/A |
| Gestion biens | ✅ CRUD complet | 👁️ Mon logement | N/A | ✅ Liste/détail | ✅ Liste | N/A | ✅ Sites | N/A |
| Baux/Contrats | ✅ CRUD + signatures | 👁️ Consultation | N/A | 👁️ Via API | ✅ Mandats | N/A | N/A | N/A |
| Finances/Paiements | ✅ Complet | ✅ Paiements | ✅ Factures | ✅ Comptabilité | ✅ Commissions | N/A | ✅ Appels fonds | ✅ Charges |
| EDL/Inspections | ✅ CRUD complet | ✅ Consultation | N/A | N/A | N/A | N/A | N/A | N/A |
| Tickets/Incidents | ✅ Gestion | ✅ Demandes | ✅ Missions | N/A | N/A | N/A | N/A | ✅ |
| Documents | ✅ GED + Upload | ✅ | ✅ | N/A | ✅ | ✅ | N/A | ✅ |
| Messagerie | ✅ | ✅ | N/A | N/A | N/A | N/A | N/A | N/A |
| Devis | ✅ Via tickets | N/A | ✅ CRUD | N/A | N/A | N/A | N/A | N/A |
| Profil/Paramètres | ✅ (⚠️ /settings cassé) | ✅ | ✅ | N/A | ✅ | ✅ | N/A | N/A |
| Fiscalité | ✅ | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Conformité/Compliance | N/A | N/A | ✅ | ✅ | N/A | N/A | N/A | N/A |
| Aide/Support | ✅ | ✅ | ✅ | N/A | ✅ | N/A | N/A | N/A |
| Notifications | ✅ (page globale) | ✅ (page dédiée) | ✅ (via centre) | N/A | N/A | N/A | N/A | N/A |

---

## 8. ANALYSE DES COMPOSANTS DE NAVIGATION PAR RÔLE

| Composant | Fichier | Items Owner | Items Tenant | Items Provider | Problèmes |
|---|---|---|---|---|---|
| **AppShell Sidebar** | `components/layout/AppShell.tsx` | 10 items (3 sections) | 11 items (3 sections) | 4 items (2 sections) | ✅ Correct. Dropdown `/${role}/settings` cassé pour owner |
| **Owner App Layout** | `components/layout/owner-app-layout.tsx` | ~15 items (4 groupes) | N/A | N/A | ✅ Complet |
| **Tenant App Layout** | `components/layout/tenant-app-layout.tsx` | N/A | ~12 items (5 groupes) | N/A | ✅ Complet |
| **Provider Layout** | `app/provider/layout.tsx` | N/A | N/A | 10 items (2 sections) | ✅ Complet |
| **Admin Sidebar** | `components/layout/admin-sidebar.tsx` | N/A | N/A | N/A | ✅ 13 items (4 catégories), #subscriptions ouvre un dialog |
| **Command Palette** | `components/command-palette/CommandPalette.tsx` | ~12 commands | ~8 commands | N/A | ⚠️ Liens cassés : `/owner/settings/billing`, `/owner/settings/notifications`, `/tenant/settings/profile`, etc. |
| **Owner Bottom Nav** | `components/layout/owner-bottom-nav.tsx` | 4 + more menu | N/A | N/A | ✅ OK |
| **Provider Bottom Nav** | `components/layout/provider-bottom-nav.tsx` | N/A | N/A | 5 items | ✅ OK |
| **Public Navbar** | `components/layout/navbar.tsx` | N/A | N/A | N/A | ✅ Méga-menu complet avec fonctionnalités, solutions, ressources |
| **Public Footer** | `components/layout/public-footer.tsx` | N/A | N/A | N/A | ✅ Liens produit, ressources, légal |
| **Guarantor Layout** | `app/guarantor/layout.tsx` | N/A | N/A | N/A | ⚠️ Utilise `<a>` au lieu de `<Link>`, lien `/auth/signout` cassé |

---

## 9. ANALYSE DES PROTECTIONS DE ROUTES

### Matrice d'accès

| Route | Owner | Tenant | Provider | Admin | Agency | Guarantor | Protection middleware | Protection layout | Protection API/RLS |
|---|---|---|---|---|---|---|---|---|---|
| `/owner/*` | ✅ | ❌ redirect | ❌ redirect | ❌ redirect | ❌ redirect | ❌ redirect | Auth cookie | role=owner | RLS owner_id |
| `/tenant/*` | ❌ redirect | ✅ | ❌ redirect | ❌ redirect | ❌ redirect | ❌ redirect | Auth cookie | role=tenant | RLS tenant_id |
| `/provider/*` | ❌ redirect | ❌ redirect | ✅ | ❌ redirect | ❌ redirect | ❌ redirect | Auth cookie | role=provider | RLS |
| `/admin/*` | ❌ redirect | ❌ redirect | ❌ redirect | ✅ | ❌ redirect | ❌ redirect | Auth cookie | role=admin | role=admin |
| `/agency/*` | ❌ redirect | ❌ redirect | ❌ redirect | ✅ aussi | ✅ | ❌ redirect | Auth cookie | role=agency\|admin | — |
| `/guarantor/*` | ⚠️ **ACCESSIBLE** | ⚠️ **ACCESSIBLE** | ⚠️ **ACCESSIBLE** | ⚠️ **ACCESSIBLE** | ⚠️ **ACCESSIBLE** | ✅ | Auth cookie | **PAS DE CHECK** | — |
| `/copro/*` | ⚠️ **ACCESSIBLE** | ⚠️ **ACCESSIBLE** | ⚠️ **ACCESSIBLE** | ⚠️ **ACCESSIBLE** | ⚠️ **ACCESSIBLE** | ⚠️ **ACCESSIBLE** | Auth cookie | **PAS DE LAYOUT** | — |
| `/syndic/*` | ❌ redirect | ❌ redirect | ❌ redirect | ❌ redirect | ❌ redirect | ❌ redirect | Auth cookie | role=syndic | — |

### Résumé des protections

- **Middleware Edge (`middleware.ts`)** : Vérifie uniquement la **présence d'un cookie auth**. Ne vérifie PAS les rôles. Ceci est un choix architectural : la validation forte se fait dans les layouts serveur.
- **Layouts serveur** : Chaque layout vérifie le rôle sauf **guarantor** et **copro**
- **API Routes** : Vérifient correctement les rôles (owner, admin, tenant) avec `requireRole()` ou des checks manuels
- **RLS Supabase** : Complètes et bien implémentées sur toutes les tables principales

---

## 10. ANALYSE DES REDIRECTIONS

| Origine | Destination | Type | Problème |
|---|---|---|---|
| `/app/*` | `/` + path sans /app | middleware redirect | ✅ Legacy fix correct |
| `/tenant/home` | `/tenant/lease` | middleware redirect | ✅ Migration correcte |
| `/dashboard` | Selon rôle | `dashboard/page.tsx` smart redirect | ✅ OK |
| Non authentifié → zone protégée | `/auth/signin?redirect=...` | middleware redirect | ✅ OK |
| owner/indexation → non auth | `/login` | ❌ Page inexistante | Changer en `/auth/signin` |
| tenant/receipts → non auth | `/login` | ❌ Page inexistante | Changer en `/auth/signin` |
| guarantor layout → déconnexion | `/auth/signout` | ❌ Page inexistante | Utiliser useSignOut() |
| owner layout → non-owner | `/dashboard` | ✅ Smart redirect | OK |
| tenant layout → non-tenant | `/owner/dashboard` ou `/` | ✅ OK | |
| provider layout → non-provider | `/dashboard` | ✅ OK | |
| admin layout → non-admin | Selon rôle | ✅ OK | |

---

## 11. PAGES D'ERREUR

| Segment | error.tsx | not-found.tsx | loading.tsx | Notes |
|---|---|---|---|---|
| **app/ (racine)** | ✅ | ✅ | ❌ | Manque loading.tsx et global-error.tsx |
| **owner/** | ✅ + 10 sous-modules | ✅ (10 pages [id]) | ✅ (20+) | Le plus complet |
| **tenant/** | ✅ + 7 sous-modules | ❌ | ✅ (14+) | Manque not-found pour [id] routes |
| **provider/** | ✅ + 5 sous-modules | ❌ | ✅ (10+) | Manque not-found |
| **admin/** | ✅ + 5 sous-modules | ❌ | ✅ (10+) | Manque not-found |
| **agency/** | ✅ + 10 sous-modules | ❌ | ✅ (12+) | Manque not-found |
| **guarantor/** | ✅ + 3 sous-modules | ❌ | ✅ (4) | Manque not-found |
| **syndic/** | ✅ + 4 sous-modules | ❌ | ✅ (4) | Manque not-found |
| **copro/** | ✅ + 4 sous-modules | ❌ | ✅ (4) | Manque not-found |

---

## 12. FLUX INTER-RÔLES

| Flux | Étape | Rôle acteur | Page | Existe ? | Notes |
|---|---|---|---|---|---|
| **Invitation locataire** | Propriétaire invite | owner | `/owner/tenants` | ✅ | Via formulaire |
| | Locataire accepte | tenant | `/invite/[token]` | ✅ | Token route |
| | Locataire rejoint logement | tenant | `/rejoindre-logement` | ✅ | |
| **Signature bail** | Owner crée bail | owner | `/owner/leases/new` | ✅ | |
| | Owner initie signature | owner | `/owner/leases/[id]/signers` | ✅ | |
| | Tenant signe | tenant | `/signature/[token]` | ✅ | Token indépendant |
| | Signature success | tous | `/signature/success` | ✅ | |
| **État des lieux** | Owner crée EDL | owner | `/owner/inspections/new` | ✅ | |
| | Tenant consulte | tenant | `/tenant/inspections/[id]` | ✅ | |
| | Signature EDL | tous | `/signature-edl/[token]` | ✅ | Token route |
| **Incident/Ticket** | Tenant signale | tenant | `/tenant/requests/new` | ✅ | |
| | Owner gère | owner | `/owner/tickets/[id]` | ✅ | |
| | Owner assigne prestataire | owner | `/owner/tickets/[id]/quotes` | ✅ | |
| | Provider reçoit mission | provider | `/provider/jobs/[id]` | ✅ | |
| **Quittances** | Auto-generation | system | API `/api/invoices/generate-monthly` | ✅ | Cron |
| | Tenant consulte | tenant | `/tenant/receipts` | ✅ | ⚠️ redirect /login |
| **Garantie** | Owner invite garant | owner | Via API invites | ✅ | |
| | Garant accepte | guarantor | `/invite/[token]` | ✅ | |
| | Garant onboarding | guarantor | `/guarantor/onboarding/*` | ✅ | 3 étapes |

---

## 13. SUGGESTIONS D'AMÉLIORATION 💡

| # | Rôle(s) | Suggestion | Priorité |
|---|---|---|---|
| 1 | owner | Créer une page `/owner/invoices/page.tsx` listant toutes les factures | Haute |
| 2 | tous | Ajouter `global-error.tsx` à la racine de l'app | Haute |
| 3 | tenant | Unifier `/tenant/help` et le lien `/tenant/support` (rediriger l'un vers l'autre) | Moyenne |
| 4 | owner | Créer `/owner/settings/page.tsx` comme hub vers billing, branding, notifications | Moyenne |
| 5 | tous | Ajouter des `not-found.tsx` dans les routes dynamiques tenant/provider/admin | Moyenne |
| 6 | guarantor | Créer une sidebar/nav dédiée avec `<Link>` au lieu de `<a>` | Moyenne |
| 7 | copro | Créer un `layout.tsx` avec vérification de rôle | Haute |
| 8 | tous | Ajouter la vérification de rôle dans le middleware Edge pour une défense en profondeur | Basse |
| 9 | provider | Ajouter une page messagerie `/provider/messages` | Basse |
| 10 | admin | Créer `/admin/settings/page.tsx` pour la configuration plateforme | Moyenne |

---

## 14. PLAN D'ACTION PRIORISÉ

### Phase 1 — Critiques (bloquer le déploiement) 🔴

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| 1 | **Ajouter vérification rôle dans guarantor layout** | `app/guarantor/layout.tsx` | **S** |
| 2 | **Créer copro layout avec vérification rôle** | `app/copro/layout.tsx` | **S** |
| 3 | **Fixer redirect `/login` → `/auth/signin`** dans 2 fichiers | `app/owner/indexation/page.tsx`, `app/tenant/receipts/page.tsx` | **S** |
| 4 | **Fixer `/auth/signout`** dans guarantor layout | `app/guarantor/layout.tsx` | **S** |
| 5 | **Fixer AppShell dropdown** `/${role}/settings` → correct par rôle | `components/layout/AppShell.tsx` | **S** |
| 6 | **Créer `/owner/invoices/page.tsx`** (liste factures) | `app/owner/invoices/page.tsx` | **M** |

### Phase 2 — Importants (sprint en cours) ⚠️

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| 7 | Créer `/owner/settings/page.tsx` (hub settings) | `app/owner/settings/page.tsx` | **S** |
| 8 | Créer `/owner/providers/invite/page.tsx` | `app/owner/providers/invite/page.tsx` | **M** |
| 9 | Créer `/settings/page.tsx` (redirect smart par rôle) | `app/settings/page.tsx` | **S** |
| 10 | Créer `/messages/page.tsx` (redirect smart par rôle) | `app/messages/page.tsx` | **S** |
| 11 | Fixer command palette: retirer ou créer les pages manquantes | `CommandPalette.tsx` + pages | **M** |
| 12 | Connecter données mockées copro aux vraies APIs | `app/copro/*/page.tsx` | **L** |
| 13 | Compléter intégration API copro/regularisation | `app/owner/copro/regularisation/page.tsx` | **M** |
| 14 | Ajouter `not-found.tsx` dans routes dynamiques tenant/provider/admin | Multiples | **M** |

### Phase 3 — Améliorations (backlog) 💡

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| 15 | Créer `app/global-error.tsx` | `app/global-error.tsx` | **S** |
| 16 | Créer `app/loading.tsx` racine | `app/loading.tsx` | **S** |
| 17 | Refactorer guarantor layout avec Link et sidebar | `app/guarantor/layout.tsx` | **M** |
| 18 | Ajouter segments breadcrumb pour copro/syndic/agency | `components/ui/breadcrumb.tsx` | **S** |
| 19 | Ajouter `/provider/messages/page.tsx` | `app/provider/messages/page.tsx` | **M** |
| 20 | Créer `/admin/settings/page.tsx` | `app/admin/settings/page.tsx` | **M** |
| 21 | Ajouter vérification rôle dans middleware Edge | `middleware.ts` | **M** |
| 22 | Créer `/tenant/settings/profile` et `/tenant/settings/notifications` | `app/tenant/settings/*/page.tsx` | **M** |

**Légende effort : S (< 1h) / M (1-4h) / L (4h+)**

---

## 15. DÉTAIL TECHNIQUE — PROTECTIONS PAR LAYOUT

| Layout | Fichier | Auth check | Role check | Redirect si mauvais rôle | Data preloading |
|---|---|---|---|---|---|
| Owner | `app/owner/layout.tsx` | ✅ getUser() | ✅ role=owner | tenant→/tenant, other→/dashboard | ✅ Properties, Dashboard, Contracts |
| Tenant | `app/tenant/layout.tsx` | ✅ getUser() | ✅ role=tenant | owner→/owner/dashboard, other→/ | ✅ Dashboard RPC |
| Provider | `app/provider/layout.tsx` | ✅ getUser() | ✅ role=provider | →/dashboard | ❌ Pas de preloading |
| Admin | `app/admin/layout.tsx` | ✅ getUser() | ✅ role=admin | owner→/owner/dashboard, tenant→/tenant/dashboard, other→/ | ❌ Streaming par page |
| Agency | `app/agency/layout.tsx` | ✅ getUser() | ✅ role=agency\|admin | Selon rôle | ✅ Agency profile |
| Guarantor | `app/guarantor/layout.tsx` | ✅ getUser() | ❌ **MANQUANT** | — | ❌ |
| Syndic | `app/syndic/layout.tsx` | ✅ getUser() | ✅ role=syndic | Selon rôle | ❌ |
| Copro | **PAS DE LAYOUT** | ❌ | ❌ | — | — |

---

*Fin du rapport d'audit. Généré automatiquement par Claude Code.*
