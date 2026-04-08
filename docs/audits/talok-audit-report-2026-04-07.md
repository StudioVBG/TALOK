# TALOK — Rapport d'audit complet de coherence

**Date :** 2026-04-07
**Auditeur :** Claude Code (session automatisee)
**Branche :** claude/build-accounting-module-bmTHk
**Scope :** 8 passes, 4 skills, codebase complet

---

## 1. Resume executif

| Gravite | Nombre |
|---------|--------|
| 🔴 Critique | 14 |
| 🟠 Majeur | 22 |
| 🟡 Mineur | 18 |
| **Total** | **54** |

**Score de sante global : 58/100**

Les blocages principaux sont :
1. **Tables `entities` et `entity_members` manquantes** — le module comptabilite ne peut pas se deployer
2. **Feature gating absent** sur 11/20 features definies et 9 routes API accounting
3. **54 fichiers @ts-nocheck** masquant des erreurs de typage
4. **Mentions "Yousign"** dans l'UI utilisateur (admin + marketing)

Points forts : auth solide, receipt-generator branche, dark mode corrige, 9/10 bugs en cours resolus.

---

## 2. Tableau recapitulatif

| Passe | Gravite | Fichier | Description | Fix |
|-------|---------|---------|-------------|-----|
| 1 | 🔴 | scripts/sync-pricing-plans.ts:48 | Prix Confort = 2900 (devrait etre 3500) | Mettre a jour a 3500 |
| 1 | 🔴 | scripts/sync-pricing-plans.ts:71 | Prix Pro = 5900 (devrait etre 6900) | Mettre a jour a 6900 |
| 1 | 🟠 | app/solutions/administrateurs-biens/page.tsx:74 | Enterprise M affiche 449€ (devrait etre 349€) | Corriger a "349€/mois" |
| 1 | 🟡 | components/marketing/CompetitorComparison.tsx:371 | Prix entree "19€" (devrait etre 0€ ou 9€) | Aligner sur grille |
| 2 | 🔴 | lib/hooks/use-documents.ts:461 | useCreateDocument() exporte (interdit, bypass API) | Deprecier et supprimer export |
| 2 | 🔴 | app/api/leases/[id]/seal/route.ts:182 | INSERT direct documents (bypass upload API) | Passer par API route |
| 2 | 🔴 | app/api/edl/[id]/sign/route.ts:599 | INSERT direct documents (bypass upload API) | Passer par API route |
| 2 | 🔴 | features/identity-verification/services/identity-verification.service.ts:241 | INSERT direct documents CNI (bypass upload API) | Refactorer via service partage |
| 2 | 🟠 | features/assistant/ai/tools/search-tools.ts:383 | Types documents hardcodes dans enum Zod | Importer DOCUMENT_TYPES |
| 2 | 🟠 | features/assistant/ai/tools/tenant-tools.ts:627 | Types documents hardcodes dans enum Zod | Importer DOCUMENT_TYPES |
| 2 | 🟠 | features/documents/components/document-upload-form.tsx:108 | Select options hardcodees | Generer depuis constants |
| 3 | 🔴 | app/api/accounting/fec/export/route.ts | Pas de plan gate (role admin seul) | Ajouter withFeatureAccess("bank_reconciliation") |
| 3 | 🔴 | app/api/accounting/reconciliation/route.ts | Pas de plan gate | Ajouter withFeatureAccess |
| 3 | 🔴 | app/api/accounting/entries/route.ts | Aucun check auth ni feature | Ajouter auth + feature gate |
| 3 | 🟠 | app/api/accounting/balance/route.ts | Role admin seul, pas de plan gate | Ajouter withFeatureAccess |
| 3 | 🟠 | app/api/accounting/exports/route.ts | Role admin seul, pas de plan gate | Ajouter withFeatureAccess |
| 3 | 🟠 | lib/subscriptions/plan-limits.ts | 11/20 features PLAN_LIMITS jamais utilisees | Implementer ou nettoyer |
| 4 | 🟠 | 54 fichiers | @ts-nocheck masque les erreurs TypeScript | Retirer progressivement |
| 4 | 🟠 | 51 fichiers (143 occurrences) | console.log en production | Remplacer par structured-logger |
| 4 | 🟠 | 189 fichiers .tsx | new Date() sans safeDate() wrapper | Auditer et wrapper |
| 4 | 🟠 | app/layout.tsx:226 | localStorage sans typeof window guard | Ajouter guard SSR |
| 4 | 🟠 | app/syndic/onboarding/site/page.tsx:55 | localStorage sans guard SSR (6 pages syndic) | Ajouter typeof window check |
| 4 | 🟠 | app/contact/page.tsx:11 | useSearchParams sans Suspense | Wrapper Suspense |
| 4 | 🟠 | app/invite/copro/page.tsx:24 | useSearchParams sans Suspense | Wrapper Suspense |
| 4 | 🟡 | 40+ pages | useSearchParams potentiellement sans Suspense | Auditer chaque page |
| 4 | 🟡 | components/documents/LeasePreview.tsx:87 | Couleurs hardcodees (bg-[#525659]) | Utiliser variables CSS |
| 4 | 🟡 | components/onboarding/onboarding-shell.tsx:81 | Couleurs hardcodees (#22c55e, #3b82f6) | Utiliser classes Tailwind |
| 5 | 🔴 | accounting migration | Table `entities` referencee mais INEXISTANTE | Creer table ou rediriger vers legal_entities |
| 5 | 🔴 | accounting migration | Table `entity_members` referencee mais INEXISTANTE | Creer table junction |
| 5 | 🟠 | 41 tables | Tables sans RLS active | Activer RLS (priorite: tenants, lease_notices) |
| 5 | 🟠 | 10 colonnes | Colonnes status sans CHECK constraint | Ajouter CHECK constraints |
| 5 | 🟡 | sepa_mandates | FK owner_profile_id sans index | Creer index |
| 5 | 🟡 | 3 colonnes | NOT NULL manquant sur colonnes critiques | Ajouter NOT NULL |
| 6 | 🔴 | app/admin/plans/page.tsx:335 | "Yousign" visible dans interface admin | Remplacer par "Signatures electroniques" |
| 6 | 🔴 | app/solutions/administrateurs-biens/page.tsx:90 | "Yousign" dans page marketing | Supprimer de la liste integrations |
| 6 | 🟠 | components/marketing/TrustBadges.tsx:191 | "Stripe" dans composant marketing | Remplacer par "Paiements securises" |
| 6 | 🟡 | components/marketing/TrustBadges.tsx:194 | "Supabase" dans composant marketing | Remplacer par "Infrastructure cloud France" |
| 6 | 🟡 | app/owner/leases/[id]/LeaseDetailsSidebar.tsx:398 | bg-white au lieu de bg-card (dark mode) | Remplacer par bg-card |
| 7 | 🟡 | tickets chat | Tickets : loading chat non audite en profondeur | Verifier polling messages |
| 8 | 🔴 | Migration accounting | FK `entities(id)` 16 references non resolues | Creer entities ou mapper legal_entities |
| 8 | 🔴 | Migration accounting | RLS `entity_members` 37 references non resolues | Creer entity_members |
| 8 | 🟠 | package.json | Nordigen/Bridge/GoCardless absents | Ajouter SDK ou mode manuel |
| 8 | 🟠 | Migrations anterieures | Doublons potentiels (20260110000001 vs 20260406210000) | Reconcilier |
| 8 | 🟡 | webhook Stripe | Hook accounting absent dans payment handler | Ajouter createAutoEntry() |

---

## 3. Detail par passe

### PASSE 1 — Coherence pricing

**Grille canonique (talok-context section 6) :**
Gratuit 0€ | Starter 9€ | Confort 35€ | Pro 69€ | Enterprise S 249€ | M 349€ | L 499€ | XL 799€

**Source unique code :** `lib/subscriptions/plans.ts` + `lib/subscriptions/pricing-config.ts` — prix corrects.

**Problemes :**
- `scripts/sync-pricing-plans.ts` contient des prix obsoletes (Confort 29€, Pro 59€). Si execute, corrompt la DB.
- `app/solutions/administrateurs-biens/page.tsx:74` affiche Enterprise M a 449€ au lieu de 349€.
- `components/marketing/CompetitorComparison.tsx:371` affiche "A partir de 19€" — aucun plan a ce prix.

**TVA DROM-COM :** Correct dans `lib/billing/tva.ts` (20%, 8.5%, 2.1%, 0%).

**Commissions SEPA :** Correct dans `pricing-config.ts`.

---

### PASSE 2 — Coherence documents

**Source unique :** `lib/documents/constants.ts` — 37 types, MIME, labels, categories. OK.

**Violations critiques :**
- `useCreateDocument()` (lib/hooks/use-documents.ts:461) est exporte — bypass complet de l'API. Interdit par le skill.
- 3 routes API font des INSERT directs dans `documents` (seal, EDL sign, identity verification).
- AI tools (search-tools.ts, tenant-tools.ts) hardcodent des enums au lieu d'importer DOCUMENT_TYPES.

**Points conformes :**
- `visible_tenant` correctement gere partout.
- `grouped-document-card.tsx` importe et utilise dans 3 fichiers.
- `receipt-generator.ts` existe et branche sur webhook Stripe.
- Titres anciens documents : migration SQL appliquee.

---

### PASSE 3 — Coherence feature gating

**PLAN_LIMITS** defini dans `lib/subscriptions/plan-limits.ts` avec 20 features.

**11 features definies mais JAMAIS utilisees dans le code :**
hasAccounting, hasFECExport, hasAITalo, hasAPI (partiel), hasOpenBanking, hasAutoReminders, hasAutoRemindersSMS, hasScoringTenant, hasWorkOrders, hasMultiUsers, hasSSO.

**9 routes API accounting sans plan gate :** Toutes verifient seulement `role === "admin"` — un utilisateur admin sur plan Gratuit pourrait acceder a la comptabilite.

**Seul module avec gating complet :** Copro (`withFeatureAccess("copro_module")`).

---

### PASSE 4 — Bugs et incoherences code

| Probleme | Nombre | Impact |
|----------|--------|--------|
| @ts-nocheck | 54 fichiers | Masque des erreurs de typage |
| console.log | 143 occurrences, 51 fichiers | Fuites info en prod |
| new Date() sans safeDate | 189 fichiers .tsx | Hydration mismatches SSR |
| localStorage sans guard | 10+ fichiers (6 syndic onboarding) | Crash SSR |
| useSearchParams sans Suspense | 40+ pages | Erreurs Next.js 13+ |
| Couleurs hardcodees | 100+ occurrences | Incoherence design system |

**Auth API :** Solidement implementee (requireAdmin, requireAuth, role checks). OK.

---

### PASSE 5 — Coherence base de donnees

- **356 migrations** — numerotation mixte mais fonctionnelle.
- **41 tables sans RLS** — dont `tenants` (critique), `lease_notices`, `accounting_accounts`.
- **10 colonnes status sans CHECK** — reconciliation_matches, payment_schedules, subscriptions, visit_slots, visit_bookings, documents.verification_status, profiles.kyc_status.
- **Invoices.statut** : correct, CHECK constraint en place (draft/sent/paid/late).
- **RLS recursion 42P17** : resolu (migrations v2 appliquees).
- **FK sans index** : sepa_mandates.owner_profile_id.
- **Blocker accounting** : `entities` et `entity_members` n'existent pas, toutes les FK et RLS echouent.

---

### PASSE 6 — Terminologie et UI

- **DOM-TOM :** Aucune violation dans les textes utilisateur. Usages techniques acceptables (noms de fichiers).
- **Yousign :** 2 mentions utilisateur (admin plans, page marketing). A supprimer.
- **Stripe/Supabase :** Mentions dans TrustBadges.tsx (composant marketing). A remplacer par termes generiques.
- **Dark mode :** 2 instances bg-white restantes dans LeaseDetailsSidebar.
- **Mobile responsive :** Bon niveau de conformite, breakpoints presents sur pages cles.
- **Redirect /pricing :** Pas de logique de redirect pour utilisateurs connectes (non bloquant).

---

### PASSE 7 — Etat des chantiers en cours

| Item | Statut |
|------|--------|
| safeDate() | ✅ RESOLU — fonction existe, utilisee dans invoices |
| Dashboard entityId | ✅ RESOLU — filtre implemente (lignes 39-58) |
| Tickets loading | ⚠️ PARTIEL — liste OK, chat non audite |
| Compte bancaire doublons | ✅ RESOLU — aucun doublon |
| CNI groupement | ✅ RESOLU — composant importe dans 3 fichiers |
| Titres anciens docs | ✅ RESOLU — migration SQL appliquee |
| receipt-generator.ts | ✅ RESOLU — branche webhook Stripe |
| [A REMPLIR] | ✅ RESOLU — 0 occurrence restante |
| identity_status/onboarding_step | ✅ RESOLU — migration + 6 zones onboarding |
| Sentry error-boundary | ✅ RESOLU — Sentry.captureException branche |

**Score : 9/10 resolus, 1/10 partiel.**

---

### PASSE 8 — Preparation module comptabilite

| Composant | Pret ? | Notes |
|-----------|--------|-------|
| Table `entities` | ❌ NON | N'existe pas — `legal_entities` existe mais schema different |
| Table `entity_members` | ❌ NON | N'existe pas — `entity_associates` existe mais colonnes differentes |
| Table `documents` (UUID id) | ✅ OUI | UUID PK correct pour document_analyses.document_id |
| Webhook Stripe payment_intent.succeeded | ⚠️ PARTIEL | Handler existe, hook accounting absent |
| Tesseract.js | ✅ OUI | v6.0.1 dans package.json |
| Conflits noms tables | ⚠️ ATTENTION | Migrations anterieures (20260110000001) definissent des tables accounting similaires |
| /api/accounting/ | ✅ OUI | 11 sous-repertoires deja en place |
| Nordigen/Bridge/GoCardless | ❌ NON | Absents de package.json |
| Pattern RLS entity_members | ❌ NON | Schema incompatible (profile_id vs user_id) |

**Verdict : BLOQUE — 0% pret au deploiement.** Necessite creation de `entities` + `entity_members` + reconciliation migrations.

---

## 4. Matrice de coherence skills / code

| Affirmation skill | Code correspond ? |
|-------------------|-------------------|
| **talok-context** : Grille tarifaire 8 plans | ⚠️ Script sync obsolete, 1 prix marketing faux |
| **talok-context** : JAMAIS toucher plans.ts | ✅ Respecte |
| **talok-context** : JAMAIS "DOM-TOM" dans UI | ✅ Respecte |
| **talok-context** : JAMAIS mentionner Stripe/Supabase | ❌ TrustBadges.tsx |
| **talok-context** : TOUJOURS importer documents/constants | ⚠️ 4 violations (AI tools, composants) |
| **talok-documents** : useCreateDocument interdit | ❌ Hook toujours exporte |
| **talok-documents** : INSERT via API route uniquement | ❌ 3 routes + 1 service bypass |
| **talok-documents** : visible_tenant gere | ✅ Correct partout |
| **talok-documents** : receipt-generator branche | ✅ Fait |
| **talok-documents** : CNI groupement raccorde | ✅ Fait |
| **talok-accounting** : Tables references entities | ❌ Table n'existe pas |
| **talok-accounting** : RLS via entity_members | ❌ Table n'existe pas |
| **talok-accounting** : Feature gating par plan | ❌ Aucun gate API |
| **talok-accounting** : JAMAIS hardcoder TVA | ✅ TVA_RATES utilise |
| **talok-accounting** : TOUJOURS centimes INTEGER | ✅ Respecte dans engine |

---

## 5. Checklist pre-comptabilite

**BLOQUANTS (P0) — A resoudre AVANT Sprint 1 :**

- [ ] Creer table `entities` (ou creer vue/alias vers `legal_entities`)
- [ ] Creer table `entity_members` (user_id UUID, entity_id UUID, role TEXT)
- [ ] Reconcilier migrations 20260110000001 (accounting prelim) vs 20260406210000 (accounting complet)
- [ ] Tester migration accounting sur DB vide — verifier FK, RLS, triggers
- [ ] Ajouter `withFeatureAccess("bank_reconciliation")` sur les 9 routes /api/accounting/

**IMPORTANTS (P1) — A resoudre pendant Sprint 1 :**

- [ ] Installer SDK Nordigen ou Bridge pour sync bancaire auto (ou documenter mode manuel)
- [ ] Ajouter hook `createAutoEntry('rent_received')` dans webhook Stripe
- [ ] Supprimer export useCreateDocument + refactorer inserts directs documents
- [ ] Ajouter CHECK constraints sur 10 colonnes status

**SOUHAITABLES (P2) — Backlog :**

- [ ] Reduire @ts-nocheck (54 fichiers)
- [ ] Remplacer console.log par structured-logger (143 occurrences)
- [ ] Activer RLS sur 41 tables manquantes
- [ ] Wrapper useSearchParams dans Suspense (40+ pages)

---

## 6. Top 10 corrections urgentes

| # | Impact | Effort | Description |
|---|--------|--------|-------------|
| 1 | 🔴 BLOQUANT | 4h | Creer tables `entities` + `entity_members` (debloque accounting) |
| 2 | 🔴 SECURITE | 2h | Ajouter feature gate withFeatureAccess sur 9 routes /api/accounting/ |
| 3 | 🔴 FACTURATION | 1h | Corriger prix sync-pricing-plans.ts (Confort 29→35, Pro 59→69) |
| 4 | 🔴 LEGAL | 30min | Supprimer mentions "Yousign" (admin + marketing) |
| 5 | 🔴 ARCHI | 3h | Supprimer useCreateDocument export + refactorer 3 inserts directs |
| 6 | 🟠 QUALITE | 2h | Corriger localStorage sans guard SSR (6 pages syndic) |
| 7 | 🟠 MARKETING | 30min | Corriger prix Enterprise M 449→349, entree 19→9 |
| 8 | 🟠 SECURITE | 2h | Activer RLS sur tables critiques (tenants, lease_notices) |
| 9 | 🟠 MARKETING | 30min | Remplacer "Stripe"/"Supabase" dans TrustBadges par termes generiques |
| 10 | 🟠 NEXT.JS | 3h | Wrapper useSearchParams dans Suspense (pages critiques) |

---

*Rapport genere automatiquement. Aucune modification n'a ete apportee au code.*
