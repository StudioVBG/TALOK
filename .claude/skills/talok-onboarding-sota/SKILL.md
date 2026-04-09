---
name: talok-onboarding-sota
description: >
  Architecture SOTA complète de l'inscription, onboarding, tour guidé et emails Talok.
  Utilise ce skill pour tout travail sur : création de compte, confirmation email,
  templates emails, onboarding par rôle, tour guidé, première connexion, WelcomeModal,
  données créées à l'inscription, charte graphique pages auth.
  Déclenche dès que la tâche touche à signup, register, onboarding, tour, welcome,
  invite, confirm, verify, agency, premier login.
---

# Talok — Inscription & Onboarding SOTA

## 1. État déployé (audit du 26/03/2026)

### Bugs confirmés et statuts

| # | Bug | Statut | Fichier |
|---|-----|--------|---------|
| 1 | Agency inscription cassée (schema, trigger, onboarding) | 🔴 À corriger | lib/api/schemas.ts + signup/account + trigger DB |
| 2 | Tour guidé en doublon (2 systèmes) | 🔴 À corriger | OnboardingTour.tsx + guided-tour.tsx |
| 3 | data-tour attrs manquants dans sidebars | 🔴 À corriger | Sidebars owner + tenant |
| 4 | Police Inter dans emails (doit être Manrope) | 🟠 À corriger | lib/emails/templates.ts:48 |
| 5 | Logo SVG absent pages auth (texte brut) | 🟠 À corriger | app/signup/*.tsx + app/auth/*.tsx |
| 6 | Progress bar absente pour Syndic + Agency | 🟠 À corriger | components/onboarding/onboarding-shell.tsx |
| 7 | Page legacy /auth/reset-password encore présente | 🟡 À nettoyer | app/auth/reset-password/page.tsx |
| 8 | Charte : indigo au lieu de blue-600 pages auth | 🟠 À corriger | app/signup/ + app/auth/ |
| 9 | Prix DB incohérents (19.90€/49.90€ vs grille officielle) | ✅ Corrigé | Migration 20260408130000_fix_subscription_plan_prices.sql |
| 10 | Tom AI onboarding owner à vérifier | 🟡 À vérifier | app/owner/onboarding/profile |

---

## 2. Cartographie des routes auth & signup

### Routes publiques existantes

| Route | Fichier | Statut |
|-------|---------|--------|
| /auth/signin | app/auth/signin/page.tsx | ✅ |
| /auth/signup | app/auth/signup/page.tsx | ✅ Redirige → /signup/role |
| /auth/verify-email | app/auth/verify-email/page.tsx | ✅ Legacy |
| /auth/forgot-password | app/auth/forgot-password/page.tsx | ✅ |
| /auth/reset-password | app/auth/reset-password/page.tsx | ⚠️ Deprecated → /recovery/password/[requestId] |
| /signup/role | app/signup/role/page.tsx | ✅ |
| /signup/account | app/signup/account/page.tsx | ✅ |
| /signup/plan | app/signup/plan/page.tsx | ✅ Owner uniquement |
| /signup/verify-email | app/signup/verify-email/page.tsx | ✅ |
| /recovery/password/[requestId] | app/recovery/password/[requestId]/page.tsx | ✅ |
| /invite/[token] | app/invite/[token]/page.tsx | ✅ |
| /invite/copro | app/invite/copro/page.tsx | ✅ |

### Callback API

| Route | Méthode | Notes |
|-------|---------|-------|
| /auth/callback | GET | PKCE + magic link + recovery |
| /api/v1/auth/register | POST | Manque rôle agency |
| /api/v1/auth/login | GET | Legacy |

### Middleware
- Routes publiques : /, /auth/*, /signup/*, /pricing, /blog, /legal, /demo, /signature, /recovery/password
- Routes protégées : /tenant, /owner, /provider, /agency, /guarantor, /copro, /syndic, /admin
- Utilisateur connecté sur /auth/signin ou /auth/signup → redirigé vers dashboard
- Non-connecté sur route protégée → redirigé vers /auth/signin?redirect=...
- Auth : cookie-based (edge-safe, pas d'appel Supabase dans middleware)

---

## 3. Flux inscription complet par rôle

```
PROPRIÉTAIRE :
/signup/role → /signup/account?role=owner → email → /signup/verify-email
→ /signup/plan → Stripe OU gratuit → /owner/onboarding/profile
→ /finance → /property → /review → Dashboard + WelcomeModal + Tour

LOCATAIRE :
/signup/role → /signup/account?role=tenant → email → /signup/verify-email
→ /tenant/onboarding/context → /file → /identity → /payments → /sign
→ Dashboard + WelcomeModal + Tour

PRESTATAIRE :
/signup/role → /signup/account?role=provider → email → /signup/verify-email
→ /provider/onboarding/profile → /services → /ops → /review
→ Dashboard + WelcomeModal + Tour

GARANT (invitation uniquement) :
/invite/[token] → /signup/account?role=guarantor&invite=token → email
→ /guarantor/onboarding/context → /financial → /sign
→ Dashboard + WelcomeModal + Tour

SYNDIC :
/signup/role → /signup/account?role=syndic → email → /signup/verify-email
→ /syndic/onboarding/profile → /site → /buildings → /units
→ /tantiemes → /owners → /complete → Dashboard + WelcomeModal + Tour

AGENCE (cassé, à corriger) :
/signup/role → /signup/account?role=agency → ÉCHEC API (rôle non validé)
Manque : schema, trigger DB, onboarding 4 étapes, redirection callback
```

---

## 4. Onboarding par rôle — étapes

### Owner (6 étapes, 4 principales + 2 optionnelles)
```
1. /owner/onboarding/profile     — Infos + type (particulier/société), Tom AI
2. /owner/onboarding/finance     — IBAN & coordonnées bancaires
3. /owner/onboarding/property    — Premier bien (adresse + type)
4. /owner/onboarding/review      — Validation finale
5. /owner/onboarding/invite      — Optionnel : inviter locataires
6. /owner/onboarding/automation  — Optionnel : automatisations
```

### Tenant (5 étapes)
```
1. /tenant/onboarding/context    — Code propriété ou token invitation
2. /tenant/onboarding/file       — Justificatifs emploi/revenus
3. /tenant/onboarding/identity   — CNI/Passeport (caméra)
4. /tenant/onboarding/payments   — Mode de paiement
5. /tenant/onboarding/sign       — Signature bail + vérification identité
```

### Provider (4 étapes)
```
1. /provider/onboarding/profile  — Infos professionnelles
2. /provider/onboarding/services — Services proposés
3. /provider/onboarding/ops      — Zone d'intervention
4. /provider/onboarding/review   — Validation
```

### Guarantor (3 étapes)
```
1. /guarantor/onboarding/context   — Identité
2. /guarantor/onboarding/financial — Capacité financière
3. /guarantor/onboarding/sign      — Signature acte de caution
```

### Syndic (7 étapes)
```
1. /syndic/onboarding/profile    — Infos syndic
2. /syndic/onboarding/site       — Configuration site
3. /syndic/onboarding/buildings  — Immeubles
4. /syndic/onboarding/units      — Lots
5. /syndic/onboarding/tantiemes  — Tantièmes
6. /syndic/onboarding/owners     — Copropriétaires
7. /syndic/onboarding/complete   — Finalisation
```

### Agency (à créer — 4 étapes)
```
1. /agency/onboarding/profile    — Infos agence (nom, SIRET, adresse, logo)
2. /agency/onboarding/mandates   — Types de mandats (gestion, location, mixte)
3. /agency/onboarding/team       — Invitation collaborateurs (optionnel, skip)
4. /agency/onboarding/review     — Validation finale
```

### Steps pour l'indicateur de progression (onboarding-shell.tsx)
```typescript
export const OWNER_ONBOARDING_STEPS = [
  { id: 'profile', label: 'Profil', path: '/owner/onboarding/profile' },
  { id: 'finance', label: 'Finances', path: '/owner/onboarding/finance' },
  { id: 'property', label: 'Logement', path: '/owner/onboarding/property' },
  { id: 'review', label: 'Validation', path: '/owner/onboarding/review' },
]
export const SYNDIC_ONBOARDING_STEPS = [
  { id: 'profile', label: 'Profil', path: '/syndic/onboarding/profile' },
  { id: 'site', label: 'Copropriété', path: '/syndic/onboarding/site' },
  { id: 'buildings', label: 'Immeubles', path: '/syndic/onboarding/buildings' },
  { id: 'units', label: 'Lots', path: '/syndic/onboarding/units' },
  { id: 'tantiemes', label: 'Tantièmes', path: '/syndic/onboarding/tantiemes' },
  { id: 'owners', label: 'Copropriétaires', path: '/syndic/onboarding/owners' },
  { id: 'complete', label: 'Finalisation', path: '/syndic/onboarding/complete' },
]
export const AGENCY_ONBOARDING_STEPS = [
  { id: 'profile', label: 'Profil', path: '/agency/onboarding/profile' },
  { id: 'mandates', label: 'Mandats', path: '/agency/onboarding/mandates' },
  { id: 'team', label: 'Équipe', path: '/agency/onboarding/team' },
  { id: 'review', label: 'Validation', path: '/agency/onboarding/review' },
]
```

---

## 5. Confirmation email

### Callback app/auth/callback/route.ts — logique
```
1. Magic link → verifyOtp(token_hash, type)
2. PKCE → exchangeCodeForSession(code)
3. Password recovery → validatePasswordResetRequestForCallback() → /recovery/password/[requestId]
4. Email non vérifié → /signup/verify-email?email=...&role=...
5. Pas de rôle → /signup/role
6. Onboarding incomplet → route par rôle (voir section 4)
7. Sinon → dashboard du rôle
```

### Redirection par rôle dans le callback
```typescript
switch (role) {
  case 'owner':     redirect('/signup/plan?role=owner')
  case 'tenant':    redirect('/tenant/onboarding/context')
  case 'provider':  redirect('/provider/onboarding/profile')
  case 'guarantor': redirect('/guarantor/onboarding/context')
  case 'syndic':    redirect('/syndic/onboarding/profile')
  case 'agency':    redirect('/agency/onboarding/profile')  // À ajouter
  default:          redirect('/owner/dashboard')
}
```

### Templates emails (lib/emails/templates.ts)
```
welcomeOnboarding()         — Email bienvenue par rôle (POLICE : Manrope, pas Inter)
onboardingReminder24h()     — Relance 24h
onboardingReminder72h()     — Relance 72h
onboardingReminder7d()      — Relance 7 jours
onboardingCompleted()       — Félicitations profil 100%
welcome()                   — Email bienvenue simple
passwordReset()             — Lien reset mot de passe
signatureRequest()          — Invitation signature bail
propertyInvitation()        — Invitation code propriété
```

**Police emails CORRECTE :**
```css
font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
```

---

## 6. Tour guidé — Système unifié

### Décision : garder OnboardingTour.tsx (780 lignes)
### Supprimer : guided-tour.tsx (473 lignes, sélecteurs cassés)

### Fichiers concernés
- GARDER : components/onboarding/OnboardingTour.tsx
- SUPPRIMER : components/onboarding/guided-tour.tsx
- Hook : useOnboardingTour() (OnboardingTour.tsx)
- Composants : StartTourButton, AutoTourPrompt
- Orchestrateur : FirstLoginOrchestrator.tsx

### Attributs data-tour obligatoires

**SIDEBAR OWNER (components/owner/Sidebar.tsx) :**
```tsx
data-tour="nav-properties"    // Lien "Mes biens"
data-tour="nav-leases"        // Lien "Mes baux"
data-tour="nav-money"         // Lien "Finances"
data-tour="nav-documents"     // Lien "Documents"
data-tour="nav-tickets"       // Lien "Tickets"
```

**DASHBOARD OWNER (app/owner/dashboard/DashboardClient.tsx) :**
```tsx
data-tour="dashboard-header"  // ✅ Déjà présent
data-tour="dashboard-kpis"    // KPIs revenus/biens/baux
data-tour="search-button"     // Bouton recherche
data-tour="notifications"     // Cloche notifications
```

**SIDEBAR TENANT (components/tenant/Sidebar.tsx) :**
```tsx
data-tour="tenant-lease"      // Lien "Mon bail"
data-tour="tenant-payments"   // Lien "Paiements"
data-tour="tenant-documents"  // Lien "Documents"
data-tour="tenant-requests"   // Lien "Demandes"
```

### Steps tour SOTA 2026

**OWNER — 8 steps :**
```typescript
const OWNER_TOUR_STEPS = [
  {
    target: '[data-tour="dashboard-header"]',
    title: "Votre tableau de bord",
    content: "Ici, vous voyez en un coup d'oeil vos revenus du mois, vos biens et vos baux actifs. Tout ce qu'il faut pour piloter vos locations.",
    placement: 'bottom',
  },
  {
    target: '[data-tour="nav-properties"]',
    title: "Gérez vos logements",
    content: "Ajoutez vos biens, renseignez les détails (surface, DPE, équipements) et suivez leur occupation. Commencez par votre premier logement.",
    placement: 'right',
    cta: "Ajouter mon premier bien →",
  },
  {
    target: '[data-tour="nav-leases"]',
    title: "Créez votre premier bail",
    content: "Générez un contrat conforme à la loi en 5 minutes. Votre locataire signe depuis son téléphone. Zéro paperasse.",
    placement: 'right',
  },
  {
    target: '[data-tour="nav-money"]',
    title: "Recevez vos loyers",
    content: "Connectez votre compte bancaire pour recevoir les paiements. Les reçus de loyer partent automatiquement.",
    placement: 'right',
  },
  {
    target: '[data-tour="nav-documents"]',
    title: "Tous vos documents au même endroit",
    content: "Baux signés, états des lieux, quittances, assurances — tout archivé ici. Cherchez en 1 clic, partagez en 1 clic.",
    placement: 'right',
  },
  {
    target: '[data-tour="nav-tickets"]',
    title: "Vos locataires vous signalent un problème ?",
    content: "Les demandes d'intervention arrivent ici. Assignez un prestataire, suivez l'avancement, validez la facture.",
    placement: 'right',
  },
  {
    target: '[data-tour="search-button"]',
    title: "Retrouvez tout instantanément",
    content: "Recherchez un locataire, un bien, un document, une facture. La recherche couvre toute votre gestion.",
    placement: 'bottom',
  },
  {
    target: '[data-tour="notifications"]',
    title: "Ne ratez rien",
    content: "Loyer en retard, bail à renouveler, document expirant — vous êtes alerté en temps réel.",
    placement: 'bottom',
    isLast: true,
    cta: "Commencer ma gestion →",
  },
]
```

**TENANT — 5 steps :**
```typescript
const TENANT_TOUR_STEPS = [
  {
    target: '[data-tour="tenant-onboarding"]',
    title: "Votre espace locataire",
    content: "Bienvenue ! Ici vous gérez tout ce qui concerne votre location depuis votre téléphone.",
  },
  {
    target: '[data-tour="tenant-lease"]',
    title: "Votre contrat de location",
    content: "Consultez votre bail, les conditions, et signez les documents directement depuis l'app.",
  },
  {
    target: '[data-tour="tenant-payments"]',
    title: "Payez votre loyer en 1 clic",
    content: "Réglez par carte bancaire ou prélèvement automatique. Votre reçu est généré instantanément.",
  },
  {
    target: '[data-tour="tenant-documents"]',
    title: "Vos documents accessibles partout",
    content: "Quittances, contrat signé, état des lieux — téléchargez-les à tout moment, même sur mobile.",
  },
  {
    target: '[data-tour="tenant-requests"]',
    title: "Signalez un problème",
    content: "Fuite, panne, travaux — signalez directement à votre propriétaire avec photos. Suivez l'avancement.",
    isLast: true,
  },
]
```

---

## 7. Première connexion — WelcomeModal

### Orchestrateur FirstLoginOrchestrator.tsx
```
login_count === 1               → WelcomeModal + proposer tour
login_count 2-3 + !tour_completed → WelcomeModal sans proposer tour
login_count > 3                 → Bannière subtile uniquement
tour_completed_at IS NOT NULL   → Ne jamais relancer le tour
tour_skipped_at IS NOT NULL ET login_count > 5 → Ne jamais relancer
```

### WelcomeModal par rôle
| Rôle | Emoji | CTA |
|------|-------|-----|
| Owner | 🏠 | "Configurer mon espace" |
| Tenant | 🔑 | "Compléter mon profil" |
| Provider | 🔧 | "Créer mon profil pro" |
| Guarantor | 🤝 | "Continuer" |
| Syndic | 🏢 | "Configurer mon espace" |
| Agency | 🏢 | "Configurer mon agence" |
| Admin | ⚙️ | "Accéder au tableau de bord" |

### Bouton relance manuelle
Ajouter dans /owner/settings ou /owner/support :
bouton "Relancer la visite guidée" → appelle startTour()

---

## 8. Données créées à l'inscription

### Trigger handle_new_user()
- Migration : supabase/migrations/20260312100000_fix_handle_new_user_all_roles.sql
- Déclenche AFTER INSERT ON auth.users
- Lit role, prenom, nom, telephone depuis raw_user_meta_data
- Fallback rôle → 'tenant' si non reconnu
- Rôles valides : admin, owner, tenant, provider, guarantor, syndic
- MANQUE : agency (à ajouter)

### Données auto-créées
| Donnée | Quand | Comment |
|--------|-------|---------|
| profiles | Toujours | Trigger handle_new_user() |
| owner_profiles | Owner | Trigger create_owner_subscription() |
| tenant_profiles | Tenant | Via /api/v1/auth/register |
| provider_profiles | Provider | Via /api/v1/auth/register |
| guarantor_profiles | Guarantor | Via /api/v1/auth/register |
| Subscription gratuite | Owner | Trigger create_owner_subscription() |
| legal_entities (particulier) | Owner | Backfill migration idempotent |

### Tracking en DB (colonnes profiles)
```sql
first_login_at, login_count, last_login_at
onboarding_completed_at, onboarding_skipped_at
welcome_seen_at, tour_completed_at
```

### Tables dédiées
```
onboarding_analytics    — parcours pas-à-pas, temps, abandons, UTM
onboarding_reminders    — relances planifiées (24h, 72h, 7j, 14j, 30j)
user_feature_discoveries — interactions tooltips/tour
```

### API onboarding
```
POST /api/me/onboarding-complete → set onboarding_completed_at
```

---

## 9. Plans tarifaires officiels (corriger DB)

Grille officielle Talok (source : skill talok-context) :

| Plan | Prix HT/mois | Biens | Signatures/mois | Stockage |
|------|-------------|-------|----------------|---------|
| Gratuit | 0€ | 1 | 0 | 100 MB |
| Starter | 9€ | 3 | 0 | 1 GB |
| Confort | 35€ | 10 | 2 | 5 GB |
| Pro | 69€ | 50 | 10 | 30 GB |
| Enterprise S | 249€ | 100 | 25 | 50 GB |

**Bug corrigé** par migration `20260408130000_fix_subscription_plan_prices.sql` (idempotente).
Vérifier que cette migration est bien appliquée en prod.

---

## 10. Charte graphique pages auth

### Correct (à maintenir)
- Background : bg-slate-950 (dark theme) sur toutes les pages signup
- Cards : bg-white/5 border-white/10 backdrop-blur
- Texte : text-white headers, text-slate-200/300 labels
- Police : Manrope chargée globalement via app/layout.tsx (--font-manrope, preload)

### À corriger
- Couleur accent : indigo-600/indigo-500 → bg-blue-600 (#2563EB) partout
- Logo : composant TalokLogo SVG (talok-logo-inverse-sombre.svg) sur TOUTES les pages auth
- Emails : police Inter → Manrope (lib/emails/templates.ts:48)

### Composant TalokLogo à créer
```tsx
// components/marketing/TalokLogo.tsx
export function TalokLogo({ size = 'md' }) {
  return (
    <Link href="/">
      <img
        src="/assets/logos/talok-logo-inverse-sombre.svg"
        alt="TALOK"
        className={size === 'md' ? 'h-8' : 'h-6'}
      />
    </Link>
  )
}
// Ajouter dans : app/signup/*.tsx + app/auth/*.tsx
```

---

## 11. Règles TOUJOURS / JAMAIS

### TOUJOURS
- Stocker le rôle sélectionné en localStorage (clé onboarding_draft) avant /signup/account
- Passer le rôle en query param ?role=... sur /signup/account
- Appeler POST /api/me/onboarding-complete à la fin de chaque flow onboarding
- Utiliser useOnboardingTour() (pas useTour() de guided-tour.tsx supprimé)
- Mettre data-tour="..." sur les éléments ciblés par le tour
- Afficher TalokLogo SVG sur toutes les pages auth/signup
- Police Manrope dans les emails (pas Inter)
- Vérifier que login_count est bien incrémenté à chaque connexion

### JAMAIS
- Utiliser guided-tour.tsx (supprimé, doublon)
- Relancer le tour si tour_completed_at IS NOT NULL
- Afficher le tour à la 4e connexion ou plus (sauf bouton manuel)
- Hardcoder les prix des plans (lire depuis la DB)
- Ajouter "agency" en fallback "tenant" (corriger le trigger DB)
