# Audit Inscription & Authentification — Talok

**Date :** 29/03/2026
**Scope :** Pages signup, login, invitation, confirmation email, sécurité auth
**Méthode :** Lecture exhaustive du code source (pas de test E2E)
**Branche :** main (commit 1847eba1)

---

## 1. Cartographie des pages d'inscription et login

### 1.1 Pages signup (nouveau flow optimisé)

| Page | URL | Champs | Validation | Gestion erreurs | Rôle ciblé |
|------|-----|--------|------------|-----------------|------------|
| `app/signup/role/page.tsx` | `/signup/role` | Sélection rôle (cards cliquables), champ code propriété optionnel | Vérification via `/api/public/code/verify` (POST) | Toast notifications (code invalide/expiré) | Tous sauf guarantor (invitation only) |
| `app/signup/account/page.tsx` | `/signup/account?role=X` | prenom, nom, email, telephone, phoneCountry, useMagicLink, password, confirmPassword, terms_accepted, privacy_accepted, cookies (3 checkboxes) | **Zod** (`accountCreationSchema` dans `lib/validations/onboarding.ts`) — pas de React Hook Form, validation manuelle | Toast + erreurs inline. Détection 429 (rate limit), email existant, force MDP affichée en temps réel | Tous (rôle passé en query param) |
| `app/signup/plan/page.tsx` | `/signup/plan?role=owner` | Sélection plan (radio), toggle mensuel/annuel | Restriction rôle : owner uniquement. Plan requis avant checkout | Toast erreurs Stripe | Owner uniquement |
| `app/signup/verify-email/page.tsx` | `/signup/verify-email?email=X&role=Y` | Aucun champ (affichage email read-only), bouton "Renvoyer", bouton "Vérifier" | Polling automatique toutes les 5s (`email_confirmed_at`). Redirect auto 1.5s après confirmation | Toast si renvoi échoue | Tous |

### 1.2 Pages auth (legacy + login)

| Page | URL | Champs | Validation | Gestion erreurs | Rôle ciblé |
|------|-----|--------|------------|-----------------|------------|
| `app/auth/signup/page.tsx` | `/auth/signup` | Aucun — **REDIRECT** vers `/signup/role` | N/A (redirection immédiate, préserve query params) | N/A | Tous |
| `app/auth/signin/page.tsx` + `features/auth/components/sign-in-form.tsx` | `/auth/signin` | email, password, boutons OAuth (Google, Apple) | Validation email format + credentials Supabase | Messages : "Email ou mot de passe incorrect", "Session expirée", "Lien invalide". Redirect vers `/auth/verify-email` si email non confirmé | Tous |
| `app/auth/verify-email/page.tsx` | `/auth/verify-email` | Aucun (legacy, affichage simple) | N/A | N/A | Tous |
| `app/auth/forgot-password/page.tsx` | `/auth/forgot-password` | email | POST `/api/auth/forgot-password` | Réponse générique (anti-énumération) : "Si le compte existe, vous recevrez un lien" | Tous |
| `app/auth/reset-password/page.tsx` | `/auth/reset-password` | Aucun — **DEPRECATED** (affiche info sécurité) | N/A | N/A | N/A |

### 1.3 Pages recovery & invitation

| Page | URL | Champs | Validation | Gestion erreurs | Rôle ciblé |
|------|-----|--------|------------|-----------------|------------|
| `app/recovery/password/[requestId]/page.tsx` + `PasswordRecoveryForm.tsx` | `/recovery/password/[requestId]` | password, confirmPassword | **Zod** (même schema signup : 12+ chars, complexité). Validation serveur : cookie HMAC-SHA256, TTL 1h, single-use | Erreurs : requête expirée, déjà utilisée, cookie invalide | Tous |
| `app/invite/[token]/page.tsx` | `/invite/[token]` | Aucun champ (affichage email + rôle read-only), boutons Accepter/Se connecter | GET `/api/invitations/validate?token=X` côté serveur | Token invalide/expiré : message générique + bouton demander nouveau lien | tenant, colocataire, guarantor |
| `app/invite/copro/page.tsx` | `/invite/copro?token=X` | Aucun champ (affichage copro, lot, rôle) | GET `/api/copro/invites/[token]`. Vérifie correspondance email si connecté | Email mismatch → prompt déconnexion. Token invalide → erreur | Copropriétaires |

### 1.4 API d'inscription

| Route | Méthode | Validation | Rate limit | Rôle |
|-------|---------|------------|------------|------|
| `app/api/v1/auth/register/route.ts` | POST | Zod schema. `supabase.auth.signUp()` avec metadata (role, prenom, nom) | 3 signups/heure par IP | Tous sauf agency (bug : rôle non validé dans schema) |
| `app/auth/callback/route.ts` | GET | PKCE (`exchangeCodeForSession`) ou OTP (`verifyOtp` avec `token_hash`) | Aucun (Supabase-side) | Tous |

---

## 2. Sélecteur de rôle

### 2.1 Mécanisme

Le rôle est sélectionné via **cards cliquables** sur `/signup/role` (pas de select/dropdown, pas de rôle dans l'URL path).

**Flow :**
1. L'utilisateur arrive sur `/signup/role`
2. Il clique sur une card : Owner, Tenant, Provider, Agency, Syndic
3. Le rôle est passé en **query param** : `/signup/account?role=owner`
4. Le rôle est aussi sauvegardé en **localStorage** (clé `onboarding_draft`)

### 2.2 Rôles disponibles

| Rôle | Card visible | Accès direct |
|------|-------------|--------------|
| `owner` | Oui | `/signup/account?role=owner` |
| `tenant` | Oui | `/signup/account?role=tenant` |
| `provider` | Oui | `/signup/account?role=provider` |
| `agency` | Oui | `/signup/account?role=agency` (mais API register **casse** : rôle non supporté) |
| `syndic` | Oui | `/signup/account?role=syndic` |
| `guarantor` | **Non** (info box "Utilisez votre lien sécurisé") | Uniquement via `/invite/[token]?role=guarantor` |

### 2.3 Accès sans rôle

| Scénario | Comportement |
|----------|-------------|
| GET `/signup` (sans sous-route) | Redirigé vers `/signup/role` |
| GET `/signup/account` (sans `?role=`) | Redirigé vers `/signup/role` (check ligne 93-95 de `account/page.tsx`) |
| GET `/signup/account?role=invalid` | Redirigé vers `/signup/role` |
| GET `/auth/signup` | Redirigé vers `/signup/role` (legacy redirect) |
| GET `/signup/account?role=guarantor` sans token | Formulaire s'affiche mais l'inscription échouera si pas d'invitation |

---

## 3. Flow d'invitation locataire

### 3.1 Comment le propriétaire invite un locataire

**3 méthodes coexistent :**

| Méthode | Point d'entrée | Type de lien | Expiration | Email envoyé | Cas d'usage |
|---------|---------------|-------------|------------|-------------|-------------|
| **Token invitation** | Dashboard proprio → Créer bail → Inviter | Magic link `/invite/[token]` (64 chars hex) | 7 jours (30 jours via lease invite) | Oui (Resend) | Bail formel, locataire unique |
| **Code propriété** | Dashboard proprio → Mon bien → Partager code | Code lisible `PROP-XXXX-XXXX` | Aucune (révocable manuellement) | Non (à partager manuellement) | Invitations ouvertes, QR code |
| **Lease invite bulk** | POST `/api/leases/invite` | Token par invité | 30 jours | Oui (Resend) | Colocation, invitations multiples |

### 3.2 Parcours du locataire invité (token)

```
1. Reçoit email avec lien /invite/[token]
2. Clique → page /invite/[token]
3. Validation serveur : GET /api/invitations/validate?token=X
4. Affichage : email destinataire, rôle, bouton "Accepter"
5. Si nouveau compte :
   → Redirect /signup/account?role=tenant&invite=[token]
   → Inscription classique (email, MDP, CGU)
   → Confirmation email
   → /tenant/onboarding/context (avec token pré-rempli)
6. Si compte existant :
   → Redirect /auth/signin?email=X&redirect=/invite/[token]
   → Connexion
   → POST /api/invitations/accept
   → Vérification : email connecté === email invitation (403 si mismatch)
   → Liaison profile_id → lease_signers
   → Notification au propriétaire
```

### 3.3 Parcours du locataire invité (code propriété)

```
1. Reçoit code PROP-XXXX-XXXX (SMS, email, papier)
2. Va sur /signup/role
3. Saisit le code dans le champ "Code propriété"
4. Validation : POST /api/public/code/verify
5. Si valide → /signup/account?role=tenant&propertyCode=PROP-XXXX
6. Après inscription → /tenant/onboarding/context (code pré-rempli)
```

### 3.4 Fichiers clés invitation

| Fichier | Rôle |
|---------|------|
| `features/onboarding/services/invitations.service.ts` | Service : create, validate, markAsUsed, resend |
| `features/onboarding/services/property-codes.service.ts` | Service : validatePropertyCode, getPropertyCode |
| `app/api/invites/route.ts` | API : création bulk + liste invitations |
| `app/api/invitations/validate/route.ts` | API : validation token (public, service_role) |
| `app/api/invitations/accept/route.ts` | API : acceptation + liaison profil ↔ bail |
| `app/api/properties/[id]/invitations/route.ts` | API : génération codes propriété |
| `app/api/leases/invite/route.ts` | API : création bail + envoi invitations |
| `lib/emails/templates.ts` | Templates : `propertyInvitation()`, `signatureRequest()` |
| `lib/emails/resend.service.ts:458-484` | `sendPropertyInvitation()` |
| `lib/services/lease-creation.service.ts` | Service création bail avec invitations |

### 3.5 Sécurité invitations

| Mesure | Statut | Détail |
|--------|--------|--------|
| Vérification email match à l'acceptation | ✅ | `app/api/invitations/accept/route.ts:96-111` — 403 si mismatch |
| Protection race condition (double acceptation) | ✅ | UPDATE WHERE `used_at IS NULL` + check `updatedRows.length === 0` → 409 |
| Token 128 bits d'entropie | ✅ | 64 chars hex via `crypto.getRandomValues()` |
| Expiration token | ✅ | 7j invitations standard, 30j lease invite |
| Rate limit génération codes | ✅ | 20 invitations/heure par user |
| Auto-link global (tous les baux avec même email) | ⚠️ | `invitations.service.ts:167-190` — potentiel lien non intentionnel |

---

## 4. Configuration Supabase Auth

### 4.1 Variables d'environnement

| Variable | Fichier | Usage |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.example` | URL publique Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.example` | Clé anonyme (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.example` | Clé admin (server-only, bypass RLS) |
| `SUPABASE_MANAGEMENT_API_TOKEN` | `.env.example` | Optionnel, migrations API |
| `ENCRYPTION_KEY` | `.env.example` | AES-256-GCM pour TOTP, IBAN, API keys |

**Pas de `config.toml`** dans le repo — configuration via Supabase Dashboard cloud.

### 4.2 Clients Supabase

| Client | Fichier | Usage | Sécurité |
|--------|---------|-------|----------|
| Server | `lib/supabase/server.ts` | Routes API, Server Components | Cookie-based, `@supabase/ssr` |
| Browser | `lib/supabase/client.ts` | Client Components | Singleton, `createBrowserClient` |
| Service Role | `lib/supabase/service-client.ts` | Opérations admin, bypass RLS | `autoRefreshToken: false`, `persistSession: false`. Throw si clé manquante |

### 4.3 Middleware (`middleware.ts`)

| Aspect | Détail |
|--------|--------|
| Auth check | Cookie presence only (`sb-xxxx-auth-token`). **Pas de validation signature** (Edge runtime limitation) |
| Routes publiques | `/`, `/auth/*`, `/signup/*`, `/pricing`, `/blog`, `/legal/*`, `/demo`, `/signature/*`, `/recovery/password/*` |
| Routes protégées | `/tenant/*`, `/owner/*`, `/provider/*`, `/agency/*`, `/guarantor/*`, `/copro/*`, `/syndic/*`, `/admin/*` |
| Redirect non-auth | → `/auth/signin?redirect=...` |
| Redirect auth sur signup/signin | → `/dashboard` |
| Open redirect prevention | Vérifie `startsWith("/")` ET `!startsWith("//")` |
| White-label | Détecte custom domains via header `Host` |

### 4.4 Callback auth (`app/auth/callback/route.ts`)

| Path | Méthode | Déclencheur |
|------|---------|-------------|
| Token hash | `supabase.auth.verifyOtp(token_hash, type)` | Password recovery (server-generated link) |
| PKCE | `supabase.auth.exchangeCodeForSession(code)` | Confirmation email, OAuth, Magic link |

**Redirections après callback :**

| Condition | Destination |
|-----------|------------|
| Password reset flow | `/recovery/password/[requestId]` (avec cookie HMAC) |
| Email non confirmé | `/signup/verify-email?email=X&role=Y` |
| Pas de rôle en DB | `/signup/role` |
| Owner, onboarding incomplet | `/signup/plan?role=owner` puis `/owner/onboarding/profile` |
| Tenant, onboarding incomplet | `/tenant/onboarding/context` |
| Provider, onboarding incomplet | `/provider/onboarding/profile` |
| Guarantor, onboarding incomplet | `/guarantor/onboarding/context` |
| Syndic, onboarding incomplet | `/syndic/onboarding/profile` |
| Agency, onboarding incomplet | `/agency/onboarding/profile` (route absente côté onboarding) |
| Onboarding complet | Dashboard du rôle ou `?redirect=` param |

### 4.5 Email de confirmation

| Aspect | État |
|--------|------|
| Provider | **Supabase Auth natif** pour l'envoi de confirmation email |
| Template custom Resend | **Non** pour la confirmation — Supabase envoie avec son template par défaut |
| Welcome email custom | **Oui** via `lib/emails/resend.service.ts` (`welcomeOnboarding()`) — envoyé en parallèle après `signUp()`, fire-and-forget |
| Polling vérification | Toutes les 5s sur `/signup/verify-email` (check `email_confirmed_at`) |
| Validité lien | 15 minutes (badge affiché sur la page) |

### 4.6 Trigger DB `handle_new_user()`

**Migration :** `supabase/migrations/20260312100000_fix_handle_new_user_all_roles.sql`

| Aspect | Détail |
|--------|--------|
| Déclencheur | `AFTER INSERT ON auth.users` |
| Données lues | `raw_user_meta_data` : role, prenom, nom, telephone |
| Rôles supportés | admin, owner, tenant, provider, guarantor, syndic |
| Rôle manquant | **agency** — fallback silencieux vers `tenant` |
| Action | INSERT INTO `profiles` avec `ON CONFLICT (user_id) DO UPDATE` |
| Profils spécialisés | `owner_profiles`, `tenant_profiles`, etc. créés via API register (pas le trigger) |

---

## 5. Sécurité inscription

### 5.1 Politique mots de passe

**Schema Zod** (`lib/validations/onboarding.ts:10-16`) :

| Critère | Requis | Regex |
|---------|--------|-------|
| Longueur minimale | 12 caractères | `.min(12)` |
| Majuscule | Au moins 1 | `/[A-Z]/` |
| Minuscule | Au moins 1 | `/[a-z]/` |
| Chiffre | Au moins 1 | `/[0-9]/` |
| Caractère spécial | Au moins 1 | `/[!@#$%^&*…]/` |

**Points d'application :**
- `/signup/account` — composant `PasswordStrength` avec feedback visuel en temps réel
- `/recovery/password/[requestId]` — même schema + même composant
- **Message d'erreur FR :** "Le mot de passe doit contenir au moins 12 caractères, 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial."

**Alternative passwordless :** Toggle "Magic link" sur `/signup/account` — saute la saisie MDP.

### 5.2 Consentements CGU / RGPD

| Checkbox | Libellé | Obligatoire | Version |
|----------|---------|-------------|---------|
| `terms_accepted` | "J'accepte les conditions d'utilisation" | **Oui** | v1.0 |
| `privacy_accepted` | "J'accepte la politique de confidentialité" | **Oui** | v1.0 |
| `cookies_necessary` | "Cookies essentiels" | Oui (locked `true`) | — |
| `cookies_analytics` | "Cookies analytics" | Non | — |
| `cookies_ads` | "Cookies publicitaires" | Non | — |

**Implémentation :** `app/signup/account/page.tsx:550-652`
- Liens vers `/legal/terms` et `/legal/privacy`
- Versions trackées en DB (`TERMS_VERSION`, `PRIVACY_VERSION`)
- Validation Zod : `consentsSchema` (`onboarding.ts:48`)
- Feedback visuel : bordure verte si accepté, ambre si manquant
- **Pas d'auto-acceptation** — clic explicite requis

### 5.3 Protection anti-spam / captcha

| Mesure | Statut | Détail |
|--------|--------|--------|
| CAPTCHA / reCAPTCHA / Turnstile | **ABSENT** | Aucune intégration trouvée dans le codebase |
| Rate limiting signup API | ✅ | 3 inscriptions/heure par IP (`lib/security/rate-limit.ts`) |
| Rate limiting login API | ✅ | 5 tentatives/15 min par IP |
| Rate limiting forgot-password | ✅ | 5/heure par IP + 5/heure par hash email |
| Rate limiting emails | ✅ | 5 emails/min par destinataire, 100/min global |
| Anti-énumération email | ✅ | Réponse générique sur forgot-password |
| Détection rate limit côté UI | ✅ | Status 429 détecté + message affiché |

**Presets rate limiting complets (`lib/security/rate-limit.ts:27-123`) :**

| Preset | Fenêtre | Limite |
|--------|---------|--------|
| `signup` | 1 heure | 3 |
| `auth` | 15 min | 5 |
| `email` | 1 min | 5 |
| `sms` | 1 min | 3 |
| `payment` | 1 min | 5 |
| `leaseInvite` | 1 heure | 10 |
| `api` (général) | 1 min | 60 |
| `adminCritical` | 1 min | 5 |

**Backend :** Upstash Redis (distribué) avec fallback in-memory.
**Headers renvoyés :** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.

### 5.4 Codes postaux France d'outre-mer

| Aspect | Statut | Détail |
|--------|--------|--------|
| Indicatifs téléphoniques DROM-COM | ✅ | 9 pays/territoires : FR, GP, MQ, GF, RE, YT, PM, BL, MF (`account/page.tsx:413-423`) |
| Normalisation E.164 | ✅ | `normalizePhoneToE164()` — gère +33, +596, 0696, etc. |
| Validation code postal 97x/98x | **ABSENT** | Pas de champ code postal dans le formulaire d'inscription |
| Adresse postale | N/A | Collectée dans l'onboarding propriété/profil, pas à l'inscription |

### 5.5 2FA et Passkeys

| Fonctionnalité | Statut | Fichiers |
|----------------|--------|----------|
| TOTP (RFC 6238) | ✅ Implémenté | `lib/auth/totp.ts` — 6 digits, 30s, ±1 period |
| Codes de récupération | ✅ | 10 codes `XXXX-XXXX-XXXX`, `crypto.randomBytes()` |
| Chiffrement secret TOTP | ✅ | AES-256-GCM (`lib/security/encryption.service.ts`) |
| Passkeys (WebAuthn) | ✅ Implémenté | `simplewebauthn`, RP="Talok", challenge 60s |
| Intégré au signup | **Non** | Post-signup uniquement (paramètres compte) |
| Requis pour opérations sensibles | **Non** | Optionnel partout |

**Routes API 2FA :** `/api/auth/2fa/setup`, `/api/auth/2fa/enable`, `/api/auth/2fa/disable`, `/api/auth/2fa/verify`, `/api/auth/2fa/status`
**Routes API Passkeys :** `/api/auth/passkeys/register/options`, `/api/auth/passkeys/register/verify`, `/api/auth/passkeys/authenticate/options`, `/api/auth/passkeys/authenticate/verify`

### 5.6 Password Recovery

| Aspect | Détail |
|--------|--------|
| Flow | Email → `admin.generateLink(type: recovery)` → callback avec `token_hash` → cookie HMAC → formulaire reset |
| TTL | 1 heure (`PASSWORD_RESET_TTL_MS = 3600000`) |
| Single-use | Oui (status `completed` après reset) |
| Cookie | HMAC-SHA256 signé, `timingSafeEqual` pour comparaison |
| Tracking | IP request + IP completion, user agent, timestamps |
| Anti-énumération | Réponse 200 OK systématique (même si email inexistant) |
| Table DB | `password_reset_requests` (migration `20260318010000`) |

### 5.7 Chiffrement données sensibles

| Donnée | Algorithme | Fichier |
|--------|-----------|---------|
| Secrets TOTP | AES-256-GCM | `lib/security/encryption.service.ts` |
| IBANs | AES-256-GCM + hash + mask last-4 | idem |
| API keys | AES-256-GCM | idem |
| Format stockage | `base64(IV):base64(TAG):base64(CIPHERTEXT)` | idem |
| Rotation clé | Utilitaire `rotateEncryption()` disponible | idem |

---

## 6. Charte graphique pages auth

| Page | Background | Couleur accent | Logo Talok SVG |
|------|-----------|---------------|----------------|
| `/signup/role` | `slate-950` (dark) | **indigo-400** | Absent (texte "Bienvenue sur Talok" + Sparkles icon) |
| `/signup/account` | `slate-900` (dark) | **indigo-200/300** | Absent |
| `/signup/plan` | `slate-900` (dark) | **indigo/violet** | Absent |
| `/signup/verify-email` | `slate-900` (dark) | **indigo** | Absent |
| `/auth/signin` | Light card (défaut) | N/A | Absent |
| `/auth/forgot-password` | Light card (défaut) | N/A | Absent |
| `/invite/[token]` | Light card (défaut) | N/A | Absent |
| `/invite/copro` | `slate-900` (dark) | cyan/blue-600 | Absent |

**Constat :** La couleur accent est **indigo** partout au lieu du **blue-600 (#2563EB)** de la charte Talok. Le composant `TalokLogo` SVG est absent de toutes les pages auth/signup.

---

## 7. Données créées à l'inscription

### 7.1 Trigger automatique (`handle_new_user`)

| Donnée | Table | Quand | Comment |
|--------|-------|-------|---------|
| Profil utilisateur | `profiles` | Toujours | Trigger DB `AFTER INSERT ON auth.users` |

### 7.2 Via API register (`/api/v1/auth/register`)

| Donnée | Table | Quand | Comment |
|--------|-------|-------|---------|
| Profil propriétaire | `owner_profiles` | `role=owner` | INSERT dans route API |
| Profil locataire | `tenant_profiles` | `role=tenant` | INSERT dans route API |
| Profil prestataire | `provider_profiles` | `role=provider` | INSERT dans route API |
| Profil garant | `guarantor_profiles` | `role=guarantor` | INSERT dans route API |
| Subscription gratuite | via trigger | `role=owner` | Trigger `create_owner_subscription()` |
| Entité légale (particulier) | `legal_entities` | `role=owner` | Migration backfill idempotente |

### 7.3 Tracking onboarding

| Colonne | Table | Usage |
|---------|-------|-------|
| `first_login_at` | `profiles` | Premier login |
| `login_count` | `profiles` | Compteur connexions |
| `last_login_at` | `profiles` | Dernier login |
| `onboarding_completed_at` | `profiles` | Fin onboarding |
| `onboarding_skipped_at` | `profiles` | Onboarding ignoré |
| `welcome_seen_at` | `profiles` | WelcomeModal vue |
| `tour_completed_at` | `profiles` | Tour guidé complété |

**Tables dédiées :** `onboarding_analytics` (parcours, temps, abandons, UTM), `onboarding_reminders` (relances 24h/72h/7j/14j/30j), `user_feature_discoveries` (interactions tooltips/tour).

---

## 8. OAuth et authentification sociale

| Provider | Statut | Fichier |
|----------|--------|---------|
| Google | ✅ Implémenté | `features/auth/components/sign-in-form.tsx:231-244` |
| Apple | ✅ Implémenté | `features/auth/components/sign-in-form.tsx:246-259` |
| Magic link | ✅ Toggle sur signup | `app/signup/account/page.tsx` |

**Limitation :** OAuth disponible uniquement sur `/auth/signin`, pas sur `/signup/account`. L'inscription OAuth passe par le login → callback → redirect onboarding si nouveau.

---

## 9. Synthèse

### Score global : 7/10

### Points forts

| # | Point fort | Justification |
|---|-----------|---------------|
| 1 | Flow multi-rôle structuré | 6 rôles avec parcours d'inscription dédiés |
| 2 | Politique MDP robuste | 12 chars minimum, 4 critères de complexité, feedback temps réel |
| 3 | Consentements RGPD versionnés | CGU + Privacy avec version tracking en DB |
| 4 | Rate limiting distribué | Upstash Redis, 18 presets, headers standards |
| 5 | Password recovery sécurisé | HMAC-SHA256, TTL 1h, single-use, anti-énumération, audit IP |
| 6 | Système d'invitation complet | Token 128-bit, code propriété, protection email mismatch, race condition |
| 7 | Chiffrement AES-256-GCM | Secrets TOTP, IBAN, API keys chiffrés au repos |
| 8 | 2FA + Passkeys disponibles | TOTP RFC 6238 + WebAuthn, codes de récupération |
| 9 | Magic link (passwordless) | Alternative sans mot de passe proposée à l'inscription |
| 10 | DROM-COM phone support | 9 indicatifs téléphoniques outre-mer |

### Manques identifiés

| # | Manque | Sévérité | Impact |
|---|--------|----------|--------|
| 1 | **Aucun CAPTCHA** (Turnstile, reCAPTCHA, hCaptcha) sur signup/signin/forgot-password | Haute | Bots peuvent créer des comptes en masse malgré le rate limit |
| 2 | **Inscription agency cassée** — rôle non supporté dans schema API + trigger DB | Haute | Les agences ne peuvent pas s'inscrire |
| 3 | **Logo Talok SVG absent** de toutes les pages auth/signup | Moyenne | Branding incomplet, pas de repère visuel |
| 4 | **Couleur indigo** au lieu de blue-600 (#2563EB) sur toutes les pages signup | Moyenne | Non-conformité charte graphique |
| 5 | **Email confirmation = template Supabase par défaut** (pas custom Resend) | Moyenne | Incohérence visuelle avec les autres emails (Manrope, branding) |
| 6 | **Pas de React Hook Form** — validation manuelle avec Zod | Basse | Fonctionne mais moins maintenable, pas de dirty tracking natif |
| 7 | **2FA/Passkeys non proposés à l'inscription** | Basse | Optionnel post-signup uniquement, pas de prompt |
| 8 | **Pas de validation code postal** dans signup (97x/98x) | Basse | Adresse collectée à l'onboarding, pas à l'inscription |
| 9 | **Auto-link global invitations** (tous les baux avec même email) | Basse | Potentiel lien non intentionnel si même email sur plusieurs propriétés |
| 10 | **Page `/auth/reset-password` deprecated** toujours accessible | Basse | Route morte, confusion possible |
| 11 | **Police Inter dans emails** au lieu de Manrope | Basse | `lib/emails/templates.ts:48` — non-conformité charte |
| 12 | **Middleware : cookie presence only** (pas de validation signature) | Info | By design (Edge runtime), validation déléguée aux routes API |
| 13 | **Pas de CSRF token explicite** | Info | Mitigé par SameSite cookies + session Supabase |
| 14 | **sessionStorage pour pending email** | Info | Modèle de sécurité sessionStorage acceptable pour ce cas |

### Priorités recommandées

1. **P0** — Corriger inscription agency (schema + trigger DB + onboarding)
2. **P0** — Ajouter Cloudflare Turnstile sur signup/signin/forgot-password
3. **P1** — Créer template email confirmation custom Resend (cohérence branding)
4. **P1** — Remplacer indigo → blue-600 sur toutes les pages signup
5. **P1** — Ajouter composant TalokLogo SVG sur toutes les pages auth/signup
6. **P2** — Corriger police Inter → Manrope dans `lib/emails/templates.ts`
7. **P2** — Supprimer page `/auth/reset-password` deprecated
8. **P3** — Proposer 2FA setup en fin d'onboarding
9. **P3** — Scope l'auto-link invitations à la propriété concernée
