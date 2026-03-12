# Rapport d’audit Talok — État des lieux et recommandations

**Date** : Mars 2026  
**Périmètre** : Complexité produit et technique, architecture, UX user-first, priorités de simplification.

---

## 1. Mise à jour factuelle de ce qui a été construit

### 1.1 Stack et livrables techniques

| Élément | État |
|--------|------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript strict, Tailwind CSS, Radix/shadcn-style (`components/ui/*`), Framer Motion, Recharts |
| **Backend / données** | Supabase (PostgreSQL, Auth, RLS, Storage), ~283 migrations SQL, 10 Edge Functions (monthly-invoicing, bank-sync, generate-pdf, sepa-auto-collect, payment-reminders, etc.) |
| **Auth** | Email/password, magic links, reset password, OAuth, passkeys (WebAuthn), 2FA (OTP), redirections par rôle |
| **Paiements** | Stripe (PaymentIntent, Connect), intégration factures/paiements, relances |
| **Communications** | Resend (emails), Twilio (SMS), templates brandés |
| **Observabilité** | Sentry, PostHog, (Langfuse côté IA) |
| **Mobile / PWA** | Capacitor (android/, ios/), next-pwa (désactivé en dev et sur Netlify) |
| **IA** | Assistant multi-agents (LangGraph), RAG légal, scoring locataire, analyse documents, maintenance/tickets |

### 1.2 Surface applicative

- **Pages (App Router)** : ~263 `page.tsx` (owner, tenant, admin, provider, agency, copro, syndic, guarantor, auth, marketing, settings, blog, etc.).
- **Routes API** : ~477 fichiers sous `app/api/**` (handlers par domaine : auth, properties, leases, invoices, payments, tickets, documents, signatures, admin, cron, webhooks, etc.).
- **Composants** : ~333 sous `components/**`, ~254 sous `features/**`, ~338 sous `lib/**`.
- **Rôles avec espace dédié** : owner, tenant, admin, provider, agency, syndic, guarantor, copro (avec sous-routes).

### 1.3 Fonctionnalités par domaine (résumé)

| Domaine | Niveau | Preuves principales |
|---------|--------|----------------------|
| Auth & profils | Avancé | `features/auth`, `features/profiles`, `features/identity-verification`, 2FA, passkeys, KYC |
| Propriétés | Avancé | Wizard v3, CRUD, units/colocation, diagnostics DPE, `app/owner/properties/*` |
| Baux | Avancé | Création, signataires, signatures électroniques, EDL, `features/leases`, API signatures |
| Facturation / loyers | Avancé | Factures, périodes, statuts, API invoices, dashboard owner (impayés, revenus) |
| Paiements | Partiel | Stripe CB, confirmation, mise à jour factures ; virement/SEPA partiellement couverts |
| Tickets / maintenance | Avancé | Crud, priorités, work-orders, devis, `features/tickets` |
| Documents | Avancé | Upload, types, signed URLs, centre documents locataire, GED, recherche |
| Blog / aide | Partiel | `app/blog`, `features/blog`, admin blog ; simple CMS |
| Admin | Avancé | Dashboard, stats, modération, plans/abonnements, intégrations, compliance |
| Onboarding | Partiel | Services multi-rôles, checklist locataire aboutie ; provider/copro moins finis |
| Fin de bail | Présent | EDL sortie, dépôt de garantie, inventaire, rénovation (modules dédiés) |
| Copro / syndic | Présent | Sites, charges, assemblées, dépenses ; surface importante mais à part du cœur |

### 1.4 Qualité et CI

- **Tests** : Vitest (unitaires dans `tests/unit/**`), Playwright (E2E dans `tests/e2e/**`). CI : lint, type-check, unit tests (avec coverage), build, E2E sur PR (Chromium), npm audit, notification Slack sur main.
- **TypeScript** : Build sans `ignoreBuildErrors` ; ~77 fichiers avec `@ts-nocheck` encore recensés (plan de migration dans `next.config.js`).
- **Dette visible** : Nombreuses redirections (legacy, doublons, anglais → français) dans `next.config.js` ; ESLint désactivé au build (RAM Netlify).

### 1.5 Historique récent (ordre de priorité perçu)

Les derniers commits concernent surtout : signature EDL, vérification identité locataire, upload CNI, URLs signées média, 2FA/emails, Resend, notifications (dont expiration CNI). Aucun nouveau grand module récent : consolidation du flux EDL + identité + emails.

---

## 2. Complexité produit et architecture : dispersé ou maîtrisable ?

### 2.1 Verdict

**Le projet n’est pas un “fourre-tout” sans structure**, mais il est **large et accumulatif**. La complexité est **encore maîtrisable** si on fixe des frontières claires entre cœur et extensions.

### 2.2 Points forts

- **Cœur métier net** : Auth → Propriétés → Baux → Documents → Facturation / Loyers → Dashboards owner/tenant. Chaîne couverte par les features, les API et les tests.
- **Stack cohérente** : App Router, Supabase, RLS, Zod, layouts par rôle, conventions `app/` / `features/` / `lib/` / `components/`.
- **Sécurité** : RLS, policies, audit, middleware (with-security, idempotency), pas d’exposition directe du service role côté client.

### 2.3 Risques de dispersion

| Risque | Détail |
|--------|--------|
| **Multi-rôles** | 8+ surfaces (owner, tenant, admin, provider, agency, syndic, guarantor, copro) avec niveaux de finition très inégaux. |
| **Surface API** | ~477 routes ; logique parfois dans les handlers plutôt que dans `features/` ou `lib/`, duplication possible. |
| **Legacy** | ~25 redirections (anciennes URLs, /dashboard/*, /properties, /tenants, /settings, /profile) à maintenir et à documenter. |
| **Dette TypeScript** | Fichiers avec `@ts-nocheck` (dont pages critiques : signature, provider, admin, ged, syndic). |
| **Tests** | E2E dépendent d’un Supabase réel (credentials en dur dans README) ; stratégie unit vs E2E à clarifier. |

### 2.4 Recommandation architecture

- **Considérer le cœur** : owner + tenant + admin (opérations) comme “produit principal”.
- **Traiter comme extensions** (documentation, roadmap, priorisation séparée) : provider, agency, syndic, guarantor, copro, assistant IA avancé.
- **Consolidation progressive** : déplacer la logique métier des routes API vers `features/*/services` et `lib/` ; réduire les redirections en dépréciant les anciennes URLs de façon contrôlée.

---

## 3. UX user-first : niveau et incohérences

### 3.1 Verdict global

**Bonne base user-first** sur owner et tenant (navigation, dashboards, priorités métier). **Incohérence de maturité** selon les rôles et les parcours (onboarding, formulaires, première visite).

### 3.2 Ce qui fonctionne bien

- **Segmentation par rôle** : `lib/helpers/role-redirects.ts`, `/signup/role` (propriétaire, locataire, prestataire, garant, code logement).
- **Navigation owner** : `components/layout/owner-app-layout.tsx` — sidebar/bottom nav adaptative, groupes métier (biens, baux, finances, documents, tickets), recherche ⌘K, notifications, tour guidé, FirstLoginOrchestrator.
- **Navigation tenant** : `components/layout/tenant-app-layout.tsx` — structure claire (Mon espace, Documents, Finances, Assistance).
- **Dashboards orientés action** :
  - **Owner** : `app/owner/dashboard/DashboardClient.tsx` — actions urgentes (impayés, signatures, EDL, tickets, factures à envoyer, DPE), puis KPIs et conformité.
  - **Tenant** : `app/tenant/dashboard/DashboardClient.tsx` — bloc onboarding avec progression et checklist (compte créé, logement lié, assurance, identité, bail signé), puis contenu principal.
- **États d’interface** : empty-state, error-state, loading, data-states, feedback d’action ; nombreux `loading.tsx` / `error.tsx` par zone.
- **Landing** : `app/home-client.tsx` — sections par rôle (propriétaire, locataire, prestataire), avantages différenciants (scoring IA, Open Banking, DROM), CTA vers `/signup/role`.

### 3.3 Incohérences et risques UX

| Problème | Détail |
|----------|--------|
| **Home encore owner-first** | Titre “Gérez vos locations”, CTA “Créer mon 1er bail gratuitement” ; un locataire ou prestataire peut se sentir secondaire. |
| **Provider moins abouti** | Onboarding review (`app/provider/onboarding/review/page.tsx`) : récap non implémenté, message “Dans une version complète…” ; pas de FirstLoginOrchestrator équivalent. |
| **Formulaires onboarding** | Beaucoup de pages (tenant/owner/provider) en state manuel + toast plutôt qu’un shell commun (react-hook-form + validated-input partout) ; validation inline inégale. |
| **Welcome flow** | FirstLoginOrchestrator utilisé côté owner uniquement ; pas d’équivalent systématique tenant/provider. |
| **Progression onboarding** | Pages plein écran parfois isolées (owner/tenant/provider) sans barre de progression ou étapes clairement affichées ; le tenant compense via la checklist du dashboard. |

### 3.4 Recommandation UX

- Homogénéiser l’onboarding (même shell, étapes visibles, validation cohérente) pour owner, tenant, provider.
- Étendre le “welcome flow” (FirstLoginOrchestrator ou équivalent) à tenant et provider.
- Adapter la home et les CTAs pour équilibrer l’entrée selon le rôle (ou après choix explicite sur `/signup/role`).
- Finir la page récap provider (ou la marquer clairement “à venir”) et aligner le parcours prestataire sur le niveau owner/tenant.

---

## 4. Priorités de simplification et recommandation stratégique

### 4.1 Priorités à court terme

1. **Périmètre “visible”**  
   - Mettre en avant 3 parcours : **Propriétaire**, **Locataire**, **Admin**.  
   - Ne pas cacher provider/copro/syndic/guarantor, mais les positionner comme “modules complémentaires” (menu secondaire, docs, roadmap).

2. **Onboarding et formulaires**  
   - Unifier les parcours d’onboarding (owner, tenant, provider) avec un même shell (étapes, validation, feedback).  
   - Généraliser react-hook-form + validated-input sur les écrans critiques.

3. **Cohérence première visite**  
   - Déployer un welcome flow (type FirstLoginOrchestrator) pour tenant et provider.  
   - Réduire l’écart de maturité entre owner et autres rôles sur la première connexion.

4. **Marketing / home**  
   - Ajuster titres et CTAs pour refléter “une plateforme, trois portails” sans sur-promettre un rôle au détriment des autres.  
   - Garder une entrée unique forte sur `/signup/role` puis redirection vers le bon espace.

### 4.2 Priorités à moyen terme

5. **Consolidation technique**  
   - Réduire les `@ts-nocheck` (cibles prioritaires : signature, provider, admin, ged).  
   - Documenter et, si possible, réduire progressivement les redirections legacy (sans casser les liens existants).

6. **API et métier**  
   - Centraliser la logique métier dans `features/*/services` et `lib/` ; garder les routes API fines (validation, appels services).  
   - Renforcer les tests unitaires sur la logique critique (facturation, signatures, limites abonnement).

7. **Tests**  
   - Clarifier la stratégie : quels E2E contre environnement réel vs mocks ; périmètre des tests “réels” (voir `tests/README.md`).  
   - Unifier les emplacements de tests (Vitest inclut `tests/unit/**` ; vérifier s’il existe des `__tests__` non couverts).

### 4.3 Recommandation stratégique globale

- **Ne pas réduire la vision produit** : la couverture (France + DROM, multi-rôles, baux, documents, paiements, tickets, admin) est un atout.  
- **Réduire la dispersion perçue** :  
  - Cœur = owner + tenant + admin.  
  - Extensions = provider, agency, syndic, guarantor, copro, assistant avancé ; les traiter en “v2” ou “modules” avec une roadmap lisible.  
- **Stabiliser l’expérience** : même niveau de finition (navigation, dashboards, onboarding, formulaires) sur le cœur avant d’enrichir les modules secondaires.  
- **Documenter l’état des lieux** : ce rapport peut servir de référence pour les décisions produit et technique ; à mettre à jour à chaque grosse évolution de périmètre ou d’architecture.

---

## Annexes

### A. Chiffres clés (approximatifs)

| Indicateur | Valeur |
|------------|--------|
| Pages (page.tsx) | ~263 |
| Routes API (fichiers) | ~477 |
| Composants (components/) | ~333 |
| Fichiers features | ~254 |
| Fichiers lib | ~338 |
| Migrations SQL | ~283 |
| Edge Functions | 10 |
| Redirections next.config | ~25 règles |
| Fichiers avec @ts-nocheck | ~75+ |
| Tests unitaires (tests/unit) | ~25+ fichiers |
| Tests E2E (tests/e2e) | ~15+ specs |

### B. Fichiers de preuve cités

- UX owner : `components/layout/owner-app-layout.tsx`
- Home / acquisition : `app/home-client.tsx`
- Dashboard owner (urgences) : `app/owner/dashboard/DashboardClient.tsx`
- Dashboard tenant (onboarding) : `app/tenant/dashboard/DashboardClient.tsx`
- Onboarding provider incomplet : `app/provider/onboarding/review/page.tsx`
- Redirections / dette : `next.config.js`
- Stack / scripts : `package.json`
- Structure projet : `README.md`
