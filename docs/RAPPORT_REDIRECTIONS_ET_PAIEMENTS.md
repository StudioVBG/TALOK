# Rapport détaillé — Redirections, encaissements virement & paiement CB (SOTA TALOK)

**Date :** 24 février 2026  
**Contexte :** Vérification post-push (commit `50dd6d59`) — redirections, virements, paiements CB.

---

## 1. État du dépôt et build

| Élément | Statut |
|--------|--------|
| **Branch** | `main` |
| **Dernier commit** | `50dd6d59` — refactor: remove lease validation tests and update dialog components |
| **Push** | Effectué vers `origin/main` (github.com/StudioVBG/TALOK.git) |
| **Build Next.js** | ✅ Réussi (`npm run build` OK) |

---

## 2. Redirections (flux complets)

### 2.1 Facturation propriétaire (canonique)

| URL | Comportement |
|-----|--------------|
| `/parametres/facturation` | **Redirection 302** vers `/owner/settings/billing` (page canonique). |
| `/owner/settings/billing` | Page principale : forfait, usage, factures, moyens de paiement. |

**Fichier :** `app/(dashboard)/parametres/facturation/page.tsx` — `redirect("/owner/settings/billing")`.

### 2.2 Abonnement (Checkout Stripe) — Propriétaire

| Contexte | Success URL | Cancel URL |
|----------|-------------|------------|
| **API** `POST /api/subscriptions/checkout` | `NEXT_PUBLIC_APP_URL/owner/settings/billing?success=true` (ou body `success_url`) | `NEXT_PUBLIC_APP_URL/pricing?canceled=true` (ou body `cancel_url`) |
| **Inscription** `signup/plan` | `origin/owner/onboarding/profile?subscription=success` | `origin/signup/plan?role=...&canceled=true` |
| **Page Pricing** (après succès) | Toast + `router.replace("/owner/dashboard?subscription=success")` | Toast sur `/pricing` |

**Fichiers :**
- `app/api/subscriptions/checkout/route.ts` (l.152–156)
- `app/signup/plan/page.tsx` (l.109–111)
- `app/pricing/page.tsx` (l.442–460)
- `app/owner/settings/billing/page.tsx` (l.633–649) : lecture `success` / `canceled` → toast + `router.replace("/owner/settings/billing")` + `refresh()` si success.

### 2.3 Portail facturation Stripe (gestion abo / moyen de paiement)

| API | Return URL |
|-----|------------|
| `POST /api/subscriptions/portal` | `NEXT_PUBLIC_APP_URL/owner/settings/billing` |

**Fichier :** `app/api/subscriptions/portal/route.ts` (l.51).

### 2.4 Paiement de loyer (locataire) — Checkout session

| API | Success URL | Cancel URL |
|-----|-------------|------------|
| `POST /api/payments/checkout` | `NEXT_PUBLIC_APP_URL/tenant/payments?success=true&session_id={CHECKOUT_SESSION_ID}` | `NEXT_PUBLIC_APP_URL/tenant/payments?canceled=true` |

**Fichier :** `app/api/payments/checkout/route.ts` (l.94–95).

### 2.5 Paiement in-app (Payment Intent — locataire)

| Composant | Return URL (confirmPayment) |
|-----------|-----------------------------|
| `PaymentCheckout` (loyer) | `origin/tenant/payments?success=true&invoice={invoiceId}` |

**Fichier :** `features/billing/components/payment-checkout.tsx` (l.117).

### 2.6 Moyen de paiement propriétaire (ajout carte)

| API | Usage |
|-----|--------|
| `POST /api/owner/payment-methods/setup-intent` | Crée un SetupIntent (pas de redirect ; formulaire in-app Stripe Elements). |
| Lien « Moyens de paiement » | `/owner/settings/payments`. |
| `GET /api/billing/payment-method` (portal) | `return_url`: `APP_URL/owner/settings/billing`. |

---

## 3. Moyens de paiement supportés (CB & virement / SEPA)

### 3.1 Carte bancaire (CB) et SEPA dans Stripe

| Endpoint / flux | `payment_method_types` | Rôle |
|-----------------|------------------------|------|
| **Abonnement** `POST /api/subscriptions/checkout` | `["card", "sepa_debit"]` | CB + prélèvement SEPA pour l’abonnement. |
| **Paiement loyer (checkout)** `POST /api/payments/checkout` | `["card", "sepa_debit"]` | CB + SEPA pour une session Checkout loyer. |
| **SetupIntent propriétaire** `POST /api/owner/payment-methods/setup-intent` | `["card", "sepa_debit"]` | Ajout carte ou mandat SEPA pour l’abonnement. |

**Fichiers :**
- `app/api/subscriptions/checkout/route.ts` (l.151)
- `app/api/payments/checkout/route.ts` (l.79)
- `app/api/owner/payment-methods/setup-intent/route.ts` (l.65)

### 3.2 Encaissement « virement » côté métier

- **Virement manuel (hors Stripe)** : enregistrement manuel par le propriétaire (chèque / virement) via `ManualPaymentDialog` — type `"virement"` ou `"cheque"`.
- **Modes de paiement bail** : `mode_paiement` peut être `virement`, `prelevement`, `cb`, etc. (formulaires bail, factures, quittances).
- **Locataire** : choix moyen d’encaissement (SEPA, virement SCT, virement instantané, carte, etc.) dans l’onboarding et les paramètres ; Stripe gère CB et SEPA ; le virement « manuel » reste côté app (pas de redirect Stripe).

### 3.3 Webhook Stripe — Paiement loyer réussi

- **Événement** : `checkout.session.completed`.
- **Actions** : mise à jour facture (`statut: "paid"`), création entrée `payments` (`moyen: "cb"`), génération quittance si configuré.
- **Fichier** : `app/api/webhooks/stripe/route.ts` (l.319–370).

---

## 4. Points de vigilance (configuration requise)

| Élément | Condition | Impact si manquant |
|--------|-----------|--------------------|
| **NEXT_PUBLIC_APP_URL** | Doit être défini (ex. `https://talok.fr` en prod). | Toutes les `success_url` / `cancel_url` / `return_url` seraient incorrectes. |
| **STRIPE_SECRET_KEY** | Requise pour Checkout, Portal, SetupIntent, webhooks. | 503 sur setup-intent, checkout et portail inutilisables. |
| **STRIPE_WEBHOOK_SECRET** | Requise pour `POST /api/webhooks/stripe`. | Événements Stripe non traités (factures non mises à jour, pas de quittance auto). |
| **Table owner_payment_audit_log** | Migration `20260225000000_owner_payment_audit_log.sql` appliquée. | 500 sur `GET /api/owner/payment-methods/audit`. |

---

## 5. Synthèse

- **Redirections** : Cohérentes ; une seule page canonique facturation propriétaire (`/owner/settings/billing`) ; paramètres `success` / `canceled` gérés ; portail Stripe renvoie bien sur cette page.
- **CB** : Supportée partout (checkout abonnement, checkout loyer, SetupIntent propriétaire).
- **Virement / SEPA** : `sepa_debit` proposé dans les mêmes flux Stripe ; virement « manuel » géré en app (saisie par le propriétaire).
- **Build** : OK. **Push** : effectué sur `main`.

Rien à committer de plus : working tree clean. Pour un environnement 100 % opérationnel, vérifier les variables d’environnement et la migration d’audit (voir section 4).
