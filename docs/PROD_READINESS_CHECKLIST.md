# TALOK — Checklist de Production Readiness

> Audit complet réalisé le 30/03/2026
> Couvre : Inscription, Authentification, Baux, Factures, Quittances, PDF, Paiements, Dashboard, Documents, Notifications, Sécurité, Build

---

## TABLEAU DE SYNTHÈSE

| Module | Prêt Prod ? | Bugs critiques | Bugs moyens | Notes |
|--------|:-----------:|:--------------:|:-----------:|-------|
| Inscription / Signup | ✅ OUI | 0 | 0 | 7 rôles, auto-save, consents RGPD |
| Connexion / Login | ✅ OUI | 0 | 0 | Email/mdp + Google + Apple OAuth |
| Mot de passe oublié | ✅ OUI | 0 | 0 | HMAC, one-time token, audit trail |
| 2FA / TOTP | ✅ OUI | 0 | 1 | Pas de page UI login 2FA (API prête) |
| Passkeys / WebAuthn | ⚠️ PARTIEL | 0 | 1 | API prête, pas de bouton dans SignInForm |
| Middleware auth | ✅ OUI | 1 | 0 | Open redirect potentiel sur `?redirect=` |
| Onboarding (7 rôles) | ✅ OUI | 0 | 0 | Owner 6 étapes, Tenant 5, Syndic 7 |
| Baux (13 types) | ⚠️ PARTIEL | 1 | 3 | Activation manuelle, Visale non branché |
| Factures | ⚠️ PARTIEL | 1 | 2 | RangeError date, pas de PDF facture |
| Quittances PDF | ✅ OUI | 0 | 1 | Conforme ALUR, 605 lignes pdf-lib |
| Paiements Stripe | ⚠️ PARTIEL | 1 | 2 | Erreurs Stripe pas traduites FR |
| Paiements manuels | ✅ OUI | 0 | 0 | Cash/chèque/virement + quittance auto |
| Anti-doublon paiement | ✅ OUI | 0 | 0 | UNIQUE constraint DB + API check |
| Dashboard owner | ⚠️ PARTIEL | 0 | 3 | Compteurs invoice incohérents |
| Dashboard tenant | ⚠️ PARTIEL | 0 | 1 | Race condition 1500ms |
| Documents / GED | ✅ OUI | 0 | 2 | 37 types, upload, preview, AI |
| Email (Resend) | ⚠️ PARTIEL | 1 | 1 | `/api/emails/send` SANS AUTH |
| SMS (Twilio) | ⚠️ PARTIEL | 0 | 1 | Installé mais quasi inutilisé |
| Push (Firebase/VAPID) | ✅ OUI | 0 | 1 | Fonctionnel, Firebase env-only |
| Cron jobs (15) | ⚠️ PARTIEL | 0 | 2 | 3 crons bypass dev, outbox dupliqué |
| Sentry monitoring | ❌ NON | 1 | 0 | Installé mais ErrorBoundary pas branché |
| Sécurité API | ⚠️ PARTIEL | 2 | 3 | Routes sans auth, routes /dev en prod |
| Build / TypeScript | ✅ OUI | 0 | 3 | 54 @ts-nocheck, 2426 `as any`, 133 console.log |

---

## 🔴 BUGS CRITIQUES — À CORRIGER AVANT PROD (P0)

### C1. Routes API sans authentification
**Sévérité : CRITIQUE — Sécurité**

| Route | Risque |
|-------|--------|
| `POST /api/chat` | N'importe qui peut modifier des biens, créer des tickets via l'IA |
| `POST /api/threads` | Accès non authentifié aux threads de conversation |
| `POST /api/work-orders` | Création d'ordres de travaux sans auth |
| `POST /api/tenant-applications` | Accès aux candidatures locataires |
| `POST /api/emails/send` | Envoi d'emails arbitraires sans auth |

**Fichiers :**
- `app/api/chat/route.ts` — Aucun appel à `supabase.auth.getUser()`
- `app/api/threads/route.ts`
- `app/api/work-orders/route.ts`
- `app/api/tenant-applications/route.ts`
- `app/api/emails/send/route.ts`

**Fix :** Ajouter auth check en début de chaque route.

---

### C2. `/owner/invoices/[id]` crash — RangeError sur dates null
**Sévérité : CRITIQUE — Page cassée**

**Fichier :** `app/owner/invoices/[id]/page.tsx`

**Lignes fautives :**
```
Ligne 355: format(new Date(payment.date_paiement), ...)   // null → RangeError
Ligne 383: format(new Date(invoice.date_emission), ...)    // null → RangeError
Ligne 390: format(new Date(invoice.date_echeance), ...)    // null → RangeError
Ligne 397: format(new Date(invoice.date_paiement), ...)    // null → RangeError
```

**Cause :** `new Date(null)` → Invalid Date → `format()` lance RangeError.
**Aucune fonction `safeDate()` n'existe dans le codebase.**

**Fix :** Ajouter un guard `value && format(new Date(value), ...)` ou créer un utilitaire `safeFormatDate()`.

---

### C3. Open Redirect dans le middleware
**Sévérité : CRITIQUE — Sécurité**

**Fichier :** `middleware.ts` lignes 114-119

```typescript
const redirectParam = request.nextUrl.searchParams.get("redirect");
const safeRedirect = redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
  ? redirectParam : "/dashboard";
```

**Problème :** Ne bloque pas `/\evil.com` ou des URLs normalisées par le navigateur.
**Fix :** Utiliser `new URL(redirectParam, request.url).origin === request.nextUrl.origin`.

---

### C4. Sentry ErrorBoundary non branché
**Sévérité : CRITIQUE — Monitoring aveugle**

**Fichiers concernés :**
- `components/error-boundary.tsx:45-48` — Code Sentry **commenté**
- `app/global-error.tsx:17` — TODO commenté
- `lib/monitoring/index.ts:81-94` — `console.error` au lieu de `Sentry.captureException()`

**Conséquence :** Les erreurs React côté client ne remontent **jamais** à Sentry. Seules les erreurs API sont capturées.

**Fix :** Décommenter les 3 blocs Sentry et tester.

---

### C5. Routes `/dev/` et `/debug/` accessibles en production
**Sévérité : CRITIQUE — Sécurité**

| Route | Risque |
|-------|--------|
| `app/api/dev/reset-password/route.ts` | Reset mot de passe admin sans vérification |
| `app/api/debug/assistant-config/route.ts` | Exposition config IA |
| `app/api/debug/fix-lease-status/route.ts` | Modification statuts baux |

**Protection actuelle :** Seul check `NODE_ENV === "production"` — fragile.
**Fix :** Supprimer ces routes ou ajouter `requireAdminPermissions()`.

---

### C6. Erreurs Stripe affichées en anglais brut
**Sévérité : CRITIQUE — UX cassée pour le locataire**

**Fichier :** `features/billing/components/payment-checkout.tsx:126`

```typescript
error instanceof Error ? error.message : "Une erreur est survenue"
```

**Problème :** Le dictionnaire de 25 codes Stripe FR mentionné dans le contexte **n'existe pas dans le code**. Les locataires voient "Your card has insufficient funds" en anglais.

**Fix :** Créer `lib/stripe/error-dictionary.ts` avec les 25 codes traduits.

---

## 🟠 BUGS IMPORTANTS — À CORRIGER RAPIDEMENT (P1)

### M1. Activation de bail manuelle obligatoire
**Fichier :** Migration `20260314020000_canonical_lease_activation_flow.sql`

La migration a **supprimé** l'auto-activation depuis l'EDL. Un bail peut rester bloqué en `fully_signed` indéfiniment sans trigger admin via `/api/admin/sync-edl-lease-status`.

**Impact :** Aucune facture générée si le bail n'est pas activé manuellement.

---

### M2. Deux processeurs d'outbox concurrents
**Fichiers :**
- `app/api/cron/process-outbox/route.ts` (batch 20)
- `supabase/functions/process-outbox/index.ts` (batch 50)

**Risque :** Emails/notifications envoyés en double. Pas de protection d'idempotence.
**Fix :** Supprimer l'Edge Function et garder uniquement la route API.

---

### M3. Pas de notification au locataire si paiement échoué
**Fichier :** `app/api/webhooks/stripe/route.ts:746-769`

Le webhook `payment_intent.payment_failed` met à jour le statut mais **n'envoie aucune notification** (ni email, ni push, ni in-app).

---

### M4. 3 cron jobs bypassent l'auth en dev
**Routes concernées :**
- `app/api/cron/lease-expiry-alerts/route.ts:14-19`
- `app/api/cron/irl-indexation/route.ts`
- `app/api/cron/subscription-alerts/route.ts`

**Code fautif :**
```typescript
if (!process.env.CRON_SECRET) {
  return process.env.NODE_ENV === "development"; // BYPASS
}
```

**Fix :** `return process.env.NODE_ENV !== "production" && !process.env.CRON_SECRET`.

---

### M5. Token expiration incohérent (signature bail)
**Fichier :** `app/signature/[token]/page.tsx`
- Ligne 39 : affiche "30 jours"
- Ligne 142 : vérifie "7 jours"

---

### M6. EDL document UPDATE race condition
**Fichier :** `lib/services/edl-post-signature.service.ts`

Si deux signatures arrivent quasi simultanément, l'UPDATE peut écraser les données de l'autre signataire.

---

### M7. Receipt generation silencieuse
**Fichier :** `lib/services/final-documents.service.ts:87-94`

Si la génération de quittance échoue, l'erreur est catchée et ignorée silencieusement. Aucun mécanisme de retry.

---

### M8. `visible_tenant` non filtré partout
**Fichier :** `lib/hooks/use-documents.ts`

Certains chemins d'accès aux documents ne vérifient pas le flag `visible_tenant`, exposant potentiellement des documents internes au locataire.

---

### M9. Dashboard invoice count mismatch
**Fichier :** `app/owner/_data/fetchDashboard.ts:202`

Le dashboard compte `pending = statut === "sent"` mais l'API utilise `sent || draft`. Décalage cosmétique mais confus.

---

### M10. Tenant name split on null
**Fichier :** `app/signature/[token]/page.tsx:108`

Si le nom du locataire est null, `split()` crash.

---

## 🟡 BUGS MINEURS — Post-lancement (P2)

| # | Bug | Fichier | Impact |
|---|-----|---------|--------|
| L1 | Signed URLs expirent (3600s) sans refresh | Documents storage | Liens cassés après 1h |
| L2 | Pas de rate limiting sur download documents | API documents | Risque d'abus |
| L3 | Activité récente sans contexte (adresse/montant) | Dashboard owner | Confusion utilisateur |
| L4 | `/owner/invoices` redirect perd les query params | Redirect route | Filtres perdus |
| L5 | EDL `status` vs `statut` naming inconsistency | Tables DB | Confusion dev |
| L6 | Pas de refund flow Stripe | Paiements | Remboursements manuels |
| L7 | Receipt uniquement si 100% payé | Quittances | Pas de quittance partielle |
| L8 | Bail commercial triennal — table sans API | DB only | Notifications triennales absentes |
| L9 | Calcul retenue dépôt de garantie incomplet | AI deposit analysis | PDF non généré |
| L10 | Visale — vérification API externe non branchée | Lease creation | TODO dans le code |
| L11 | `/pricing` pas de redirect si connecté | Middleware | UX marketing vs app |
| L12 | CNI recto/verso groupement non raccordé | documents-list.tsx | Affichage séparé |
| L13 | Titres documents bruts (migration SQL manquante) | DB documents | Labels techniques |
| L14 | Performance metrics vides si `prix_achat` absent | Dashboard owner | Section vide |
| L15 | Cache-Control mal configuré | API dashboard | Headers incorrects |
| L16 | Tenant multi-bail pas entièrement supporté | Dashboard tenant | Widgets ignorent `selectedLeaseIndex` |

---

## 🔧 DETTE TECHNIQUE

| Catégorie | Compteur | Impact |
|-----------|----------|--------|
| `@ts-nocheck` directives | **54 fichiers** | Types non vérifiés |
| `@ts-ignore` directives | **27 instances** | Suppressions ponctuelles |
| `as any` type assertions | **2 426 instances** | Sécurité types compromise |
| `console.log` restants | **133 instances** | Pollution logs prod |
| TODO/FIXME dans le code | **43 instances** | Fonctionnalités incomplètes |
| Routes sans rate limiting | **~10 routes sensibles** | Risque d'abus |

---

## ✅ CE QUI FONCTIONNE BIEN (Prêt Prod)

| Module | Détail |
|--------|--------|
| **Inscription** | 7 rôles, magic link, OAuth Google/Apple, auto-save draft, consents RGPD |
| **Auth complète** | Login, reset password (HMAC + one-time + audit), 2FA TOTP, Passkeys API |
| **Middleware** | Edge-safe, RBAC, white-label, pas de boucle redirect |
| **Onboarding** | 6 flows role-specific complets |
| **13 types de baux** | Nu, meublé, étudiant, colocation, saisonnier, mobilité, commercial 3/6/9, dérogatoire, professionnel, location-gérance, parking, mixte, rural |
| **Templates bail** | 12 templates HTML complets avec données juridiques |
| **PDF bail** | Scellé avec signatures embarquées base64, preuves eIDAS |
| **Signature** | Multi-signataire, token OTP, preuves IP/user-agent/hash |
| **Quittances PDF** | Conforme ALUR (Art. 21, loi 89-462), pdf-lib, 605 lignes |
| **Paiements Stripe** | Connect, SEPA via Stripe, webhooks, PaymentIntent |
| **Paiements manuels** | Cash + chèque + virement, quittance auto-générée |
| **Anti-doublon** | UNIQUE constraint DB + vérification API |
| **Factures auto** | Cron mensuel + facture initiale à activation |
| **Documents / GED** | 37 types, 11 catégories, upload batch, signed URLs, AI OCR |
| **EDL** | Création, conduction, signature, HTML, inventaire meublé |
| **Tickets** | CRUD, stats, chat, ordres de travaux |
| **Entités / SCI** | Multi-entité, auto-provision, couleurs, stats par entité |
| **Notifications** | In-app + email + push (VAPID + FCM), préférences granulaires |
| **Cron jobs** | 15 jobs, auth CRON_SECRET + timing-safe, SSRF protection |
| **Export** | CSV, comptabilité FEC, PDF CRG/Balance |
| **Impersonation admin** | Sécurisé (RBAC, 1h expiry, audit, HttpOnly cookie) |
| **Scraping** | Protection SSRF complète (IP privées, metadata) |
| **Revalidation** | Token timing-safe, paths et tags validés, rate limited |

---

## 📋 PLAN D'ACTION RECOMMANDÉ

### Semaine 1 — Sécurité (P0)
- [ ] Ajouter auth sur les 5 routes API non protégées (C1)
- [ ] Fix open redirect middleware (C3)
- [ ] Supprimer/protéger routes `/dev/` et `/debug/` (C5)
- [ ] Brancher Sentry sur ErrorBoundary + global-error (C4)
- [ ] Créer `safeFormatDate()` et fixer `/owner/invoices/[id]` (C2)
- [ ] Créer dictionnaire erreurs Stripe FR (C6)

### Semaine 2 — Fiabilité (P1)
- [ ] Choisir UN processeur outbox (supprimer le doublon) (M2)
- [ ] Automatiser l'activation bail après EDL signé (M1)
- [ ] Ajouter notification échec paiement au locataire (M3)
- [ ] Fixer bypass auth cron en dev (M4)
- [ ] Corriger expiration token signature (M5 : 30j vs 7j)
- [ ] Ajouter logging + retry sur génération quittance (M7)

### Semaine 3 — UX & Polish (P2)
- [ ] Filtrer `visible_tenant` partout (M8)
- [ ] Fixer dashboard invoice count (M9)
- [ ] Ajouter rate limiting sur routes sensibles
- [ ] Nettoyer 133 console.log restants
- [ ] Réduire les `as any` dans les chemins critiques

### Backlog post-lancement
- [ ] Implémenter PDF facture (template dédié)
- [ ] Brancher Visale API externe
- [ ] Ajouter notifications triennales bail commercial
- [ ] Compléter calcul retenue dépôt de garantie
- [ ] Migrer 54 fichiers @ts-nocheck
- [ ] Implémenter UI passkeys dans SignInForm
- [ ] Implémenter page login 2FA
- [ ] Ajouter flow de remboursement Stripe

---

## VARIABLES D'ENVIRONNEMENT REQUISES EN PROD

### Obligatoires
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY              (sk_live_*)
STRIPE_WEBHOOK_SECRET          (whsec_*)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_live_*)
NEXT_PUBLIC_APP_URL
API_KEY_MASTER_KEY             (32+ chars)
CSRF_SECRET                    (32+ chars)
ENCRYPTION_KEY                 (32+ chars)
CRON_SECRET
REVALIDATION_SECRET
PASSWORD_RESET_COOKIE_SECRET
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

### Recommandées
```
NEXT_PUBLIC_SENTRY_DSN
RESEND_API_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
FIREBASE_SERVICE_ACCOUNT       (JSON string)
OPENAI_API_KEY
```

### Optionnelles
```
TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
FRANCECONNECT_CLIENT_ID / FRANCECONNECT_REDIRECT_URI
GOOGLE_PLACES_API_KEY
SUPABASE_FUNCTIONS_URL
```

---

## VERDICT FINAL

**TALOK n'est PAS prêt pour la production en l'état.**

Les 6 bugs critiques (P0) doivent être corrigés avant tout déploiement public :
1. 5 routes API sans authentification (faille sécurité majeure)
2. Page facture qui crash sur dates null
3. Open redirect dans le middleware
4. Sentry non branché (monitoring aveugle)
5. Routes debug accessibles en prod
6. Erreurs Stripe en anglais brut pour les locataires

**Estimation de correction P0 : 2-3 jours de travail.**

Après correction des P0, la plateforme est fonctionnellement complète et peut être lancée en beta avec les P1 dans le backlog immédiat.
