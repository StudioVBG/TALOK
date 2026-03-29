# AUDIT COMPLET — Onboarding Locataire & Propriétaire
**Date** : 29 mars 2026
**Projet** : Talok — Plateforme SaaS de gestion locative
**Stack** : Next.js 14 App Router, Supabase Auth, TypeScript, Tailwind
**Auteur** : Claude (audit automatisé)

---

## Table des matières

1. [AXE 1 — Inscription (Signup)](#axe-1--inscription-signup)
2. [AXE 2 — Onboarding Propriétaire](#axe-2--onboarding-propriétaire)
3. [AXE 3 — Onboarding Locataire](#axe-3--onboarding-locataire)
4. [AXE 4 — Tours Guidés](#axe-4--tours-guidés)
5. [AXE 5 — Emails Transactionnels](#axe-5--emails-transactionnels)
6. [Synthèse des bugs & anomalies](#synthèse-des-bugs--anomalies)

---

## AXE 1 — Inscription (Signup)

### 1.1 Cartographie des routes

| Route | Fichier | Statut | Rôle |
|-------|---------|--------|------|
| `/signup` | `app/signup/page.tsx` | ✅ Redirige → `/signup/role` | Tous |
| `/signup/role` | `app/signup/role/page.tsx` | ✅ Opérationnel | Tous |
| `/signup/account` | `app/signup/account/page.tsx` | ✅ Opérationnel | Tous |
| `/signup/verify-email` | `app/signup/verify-email/page.tsx` | ✅ Opérationnel | Tous |
| `/signup/plan` | `app/signup/plan/page.tsx` | ✅ Opérationnel | Owner uniquement |
| `/auth/signup` | `app/auth/signup/page.tsx` | ✅ Redirige → `/signup/role` (rétrocompat) | — |
| `/auth/signin` | `app/auth/signin/page.tsx` | ✅ Opérationnel | Tous |
| `/auth/forgot-password` | `app/auth/forgot-password/page.tsx` | ✅ Opérationnel | Tous |
| `/auth/reset-password` | `app/auth/reset-password/page.tsx` | ⚠️ **Legacy** — remplacé par `/recovery/password/[requestId]` | — |
| `/auth/verify-email` | `app/auth/verify-email/page.tsx` | ⚠️ Legacy | — |
| `/auth/callback` | `app/auth/callback/route.ts` | ✅ PKCE + magic link + recovery | — |
| `/invite/[token]` | `app/invite/[token]/page.tsx` | ✅ Opérationnel | Tenant/Garant |
| `/invite/copro` | `app/invite/copro/page.tsx` | ✅ Opérationnel | Copro |
| `/recovery/password/[requestId]` | `app/recovery/password/[requestId]/page.tsx` | ✅ Opérationnel | Tous |

**API :**

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/v1/auth/register` | POST | Création de compte |
| `/api/invitations/validate` | GET | Validation token invitation |
| `/api/invitations/accept` | POST | Acceptation invitation |
| `/api/public/code/verify` | POST | Vérification code propriété |

### 1.2 Flow d'inscription par rôle

```
PROPRIÉTAIRE :
/signup/role → /signup/account?role=owner → email → /signup/verify-email
  → /signup/plan → Stripe OU gratuit → /owner/onboarding/profile → ... → Dashboard

LOCATAIRE :
/signup/role → /signup/account?role=tenant → email → /signup/verify-email
  → /tenant/onboarding/context → /file → /identity → /payments → /sign → Dashboard

PRESTATAIRE :
/signup/role → /signup/account?role=provider → email → /signup/verify-email
  → /provider/onboarding/profile → /services → /ops → /review → Dashboard

GARANT (invitation uniquement) :
/invite/[token] → /signup/account?role=guarantor&invite=token → email
  → /guarantor/onboarding/context → /financial → /sign → Dashboard

SYNDIC :
/signup/role → /signup/account?role=syndic → email → /signup/verify-email
  → /syndic/onboarding/profile → 6 étapes → Dashboard

AGENCE (🔴 CASSÉ) :
/signup/role → /signup/account?role=agency → ÉCHEC API (rôle non validé par le trigger DB)
```

### 1.3 Étape 1 — Sélection du rôle (`/signup/role`)

**Rôles proposés :** owner, tenant, provider, agency, syndic
**Garant :** invite-only (bouton désactivé sans `inviteToken`)
**Badge "Recommandé" :** sur le rôle owner
**Code propriété :** champ optionnel pour auto-rejoindre en tant que locataire
**Vérification code :** appel `/api/public/code/verify`
**Token invitation :** si présent dans l'URL, verrouille la sélection de rôle

**Transition :** → `/signup/account?role={role}&invite={token?}&code={code?}`

### 1.4 Étape 2 — Création du compte (`/signup/account`)

**Champs collectés :**

| Champ | Requis | Validation |
|-------|--------|------------|
| Prénom | ✅ | 1-80 chars, Unicode lettres/espaces/tirets |
| Nom | ✅ | 1-80 chars, Unicode lettres/espaces/tirets |
| Téléphone | ❌ optionnel | Sélecteur pays (9 options DOM-TOM), normalisation E.164 |
| Email | ✅ | RFC 5322 via Zod, lowercase |
| Mot de passe OU Magic Link | ✅ | Toggle entre les deux modes |
| CGU v1.0 | ✅ | Checkbox obligatoire |
| Politique de confidentialité | ✅ | Checkbox obligatoire |
| Cookies analytics/pub | ❌ optionnel | Essentiels toujours activés |

**Mot de passe (si mode classique) :**
- Minimum 12 caractères
- Au moins 1 majuscule (A-Z)
- Au moins 1 minuscule (a-z)
- Au moins 1 chiffre (0-9)
- Au moins 1 caractère spécial (!@#$%...)
- Indicateur de force en temps réel (Faible/Moyen/Bon/Fort)
- Confirmation obligatoire

**Magic Link (si mode alternatif) :**
- Pas de mot de passe requis
- Appel `authService.sendMagicLink(email)`
- Redirection vers `/signup/verify-email?magic=true`

**Validation côté client :** Zod schemas (`accountCreationSchema`, `passwordSchema`, `minimalProfileSchema`, `consentsSchema`)
**Validation côté serveur :** Zod `RegisterSchema` dans `/api/v1/auth/register`

**DOM-TOM supportés :** FR, GP (Guadeloupe), MQ (Martinique), GF (Guyane), RE (Réunion), YT (Mayotte), PM (St-Pierre), BL (St-Barthélemy), MF (St-Martin)

**Autosave :** Brouillon sauvegardé à chaque changement (localStorage + Supabase `onboarding_drafts`), mots de passe **jamais** persistés.

### 1.5 Gestion des erreurs

| Erreur | Déclencheur | Message utilisateur |
|--------|-------------|---------------------|
| Email existant | Doublon en DB | "Email déjà utilisé - Connexion ou réinitialisation nécessaire" |
| Rate limit | >3 inscriptions/h/IP | "Trop de tentatives. Veuillez patienter." |
| Mot de passe faible | Échec passwordSchema | "12+ caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 spécial" |
| Mots de passe différents | confirm ≠ password | "Les mots de passe ne correspondent pas" |
| Invitation expirée | expires_at < NOW() | "Cette invitation a expiré. Demandez un nouveau lien." |
| Invitation utilisée | used_at IS NOT NULL | "Cette invitation a déjà été utilisée." |
| Email ≠ invitation | Mismatch | "L'email ne correspond pas à l'invitation." |
| Rôle manquant | Pas de rôle sélectionné | Redirection → /signup/role |
| Téléphone invalide | Format incorrect | "Format téléphone invalide (E.164 requis)" |
| CGU non acceptées | Checkbox non cochée | "Acceptez les CGU et politique de confidentialité" |

### 1.6 Étape 3 — Vérification email (`/signup/verify-email`)

- Affiche l'email masqué
- **Polling automatique** toutes les 5 secondes (vérifie `email_confirmed_at`)
- Bouton "Renvoyer l'email" (rate-limited)
- Bouton "J'ai confirmé" (vérification manuelle)
- Lien support : support@talok.fr
- Validité du lien : 15 minutes

**Redirection post-confirmation :**

| Rôle | Destination |
|------|-------------|
| owner | `/signup/plan?role=owner` |
| tenant | `/tenant/onboarding/context?invite={token?}` |
| provider | `/provider/onboarding/profile` |
| guarantor | `/guarantor/onboarding/context?invite={token?}` |
| syndic | `/syndic/onboarding/profile` |
| agency | `/agency/onboarding/profile` (🔴 trigger DB manquant) |

### 1.7 Étape 4 — Sélection du plan (`/signup/plan`) — Owner uniquement

**Plans affichés :**

| Plan | Prix affiché | Biens | Badge |
|------|-------------|-------|-------|
| Gratuit | 0€ | 1 | — |
| Starter | Variable* | 3 | — |
| Confort | Variable* | 10 | ⭐ Recommandé |
| Pro | Variable* | 50 | — |

> ⚠️ *Les prix affichés viennent de la DB `subscription_plans` qui contient des valeurs **incohérentes** (19.90€/49.90€ au lieu de 9€/35€/69€ selon la grille officielle) — **Bug #9**

- Toggle mensuel/annuel (-17% de réduction)
- Badge "1er mois offert" sur tous les plans
- Gratuit → POST `/api/subscriptions/select-plan` → redirect immédiat
- Payant → POST `/api/subscriptions/checkout` → Stripe Checkout → retour `/owner/onboarding/profile?subscription=success`

### 1.8 API Register (`POST /api/v1/auth/register`)

**Actions serveur à l'inscription :**

1. Création user Supabase via `auth.signUp()`
2. Trigger DB `handle_new_user()` crée le profil de base
3. Création profil spécifique au rôle :
   - owner → `owner_profiles` (type: "particulier")
   - tenant → `tenant_profiles`
   - provider → `provider_profiles`
   - guarantor → `guarantor_profiles`
   - syndic → profil de base uniquement
   - **agency → 🔴 MANQUANT dans le trigger DB**
4. Envoi email de bienvenue (non-bloquant, via Resend)
5. Envoi email de confirmation Supabase (séparé)
6. Log audit `user.registered`

**Rate limiting :** 3 inscriptions/heure/IP
**Sécurité :** Mots de passe jamais en brouillon, tokens OAuth en localStorage `sb-*`, logout nettoie tout

### 1.9 Système d'invitations

**Table `invitations` :**

| Colonne | Type | Description |
|---------|------|-------------|
| token | TEXT (64 hex chars) | Crypto-random, unique |
| email | TEXT | Email invité |
| role | TEXT | locataire_principal / colocataire / garant |
| property_id | UUID | Bien concerné |
| lease_id | UUID | Bail concerné |
| expires_at | TIMESTAMPTZ | +7 jours |
| used_at | TIMESTAMPTZ | NULL = pas encore utilisé |
| used_by | UUID | Profil qui a accepté |

**Flow :**
1. Proprio crée invitation → email envoyé (template `propertyInvitation`)
2. Locataire clique le lien → `/invite/[token]`
3. Page valide le token (GET `/api/invitations/validate`)
4. Locataire clique "Accepter" → redirigé vers `/signup/role?invite={token}&role={role}`
5. Après signup + email → `/tenant/onboarding/context?invite={token}`
6. POST `/api/invitations/accept` : marque used, lie au bail via `lease_signers`

**Sécurité invitations :**
- Vérification email match (case-insensitive)
- Protection race condition : `WHERE used_at IS NULL`
- Expiration 7 jours
- Usage unique garanti

### 1.10 Config Supabase Auth & Middleware

**Variables d'environnement :** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**Middleware :**
- Routes publiques : `/`, `/auth/*`, `/signup/*`, `/pricing`, `/blog`, `/legal`, `/demo`, `/signature`, `/recovery/password`
- Routes protégées : `/tenant`, `/owner`, `/provider`, `/agency`, `/guarantor`, `/copro`, `/syndic`, `/admin`
- Auth : cookie-based (edge-safe, pas d'appel Supabase dans le middleware)
- Utilisateur connecté sur `/auth/signin` ou `/auth/signup` → redirigé vers dashboard
- Non-connecté sur route protégée → `/auth/signin?redirect=...`

**Templates email Supabase :** Migration custom (`20260212100002_email_templates_seed.sql`)

---

*Fin de l'Axe 1 — Suite : Axe 2 (Onboarding Propriétaire) dans la prochaine section.*
