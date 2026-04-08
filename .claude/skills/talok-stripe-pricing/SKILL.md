---
name: talok-stripe-pricing
description: >
  Architecture complète Stripe, pricing, plans et feature gating de Talok.
  Utilise ce skill pour TOUT travail sur : abonnements, plans tarifaires,
  Stripe Checkout/Connect/Webhooks, feature gating, PLAN_LIMITS, signatures,
  paiements CB/SEPA, commissions, add-ons, upgrade/downgrade.
  Declenche des que la tache touche pricing, subscription, stripe, plan, gating.
  NE JAMAIS modifier lib/subscriptions/plans.ts.
---

# Talok — Stripe, Pricing & Feature Gating

## 1. Vue d'ensemble

### 1.1 Architecture Stripe

Talok utilise Stripe pour 3 flux principaux :

| Flux | Produit Stripe | Usage |
|------|---------------|-------|
| Abonnements SaaS | Checkout + Billing | Souscription/changement de plan |
| Paiement des loyers | Connect Express + PaymentIntents | CB/SEPA du locataire vers propriétaire |
| Signatures électroniques | Checkout (one-time) | Achat de signatures hors quota |

### 1.2 Fichiers source de vérité

| Fichier | Rôle | Modifiable ? |
|---------|------|-------------|
| `lib/subscriptions/plans.ts` | Définition des 9 plans (slugs, features, limits) | **NON — NE JAMAIS MODIFIER** |
| `lib/subscriptions/pricing-config.ts` | Prix en centimes, frais, quotas, commissions | Oui (avec prudence) |
| `lib/subscriptions/plan-limits.ts` | Interface PlanLimits + matrice pré-calculée | Oui |
| `lib/hooks/use-plan-access.ts` | Hook React `usePlanAccess()` pour le gating UI | Oui |
| `components/subscription/subscription-provider.tsx` | Context React `useSubscription()` | Oui |

### 1.3 Architecture add-ons

Voir skill `talok-addons` pour l'architecture complète :
table `subscription_addons`, flux Checkout, webhooks, `checkLimit()` unifié, composants `UpsellModal`.

---

## 2. Grille tarifaire complète

### 2.1 Forfaits standard

| Plan | Prix HT/mois | Annuel (-20%) | Biens | Users | Signatures/mois | Stockage | Bien suppl. |
|------|-------------|---------------|-------|-------|----------------|----------|-------------|
| Gratuit | 0 | 0 | 1 | 1 | 0 | 100 Mo | -- |
| Starter | 9 | 7,50/mois | 3 | 1 | 0 | 1 Go | +3/bien |
| Confort | 35 | 28/mois | 10 | 2 | 2 | 5 Go | +2,50/bien |
| Pro | 69 | 55/mois | 50 | 5 | 10 | 30 Go | +2/bien |

### 2.2 Forfaits Enterprise

| Plan | Prix HT/mois | Annuel (-20%) | Biens | Signatures | AM | White Label | SLA |
|------|-------------|---------------|-------|-----------|-----|------------|-----|
| Enterprise S | 249 | 199/mois | 50-100 | 25 | Partage | Non | 99% |
| Enterprise M | 349 | 279/mois | 100-200 | 40 | Partage | Basique | 99% |
| Enterprise L | 499 | 399/mois | 200-500 | 60 | Dedie | Complet | 99,5% |
| Enterprise XL | 799 | 639/mois | 500+ | Illimite | Dedie+formations | Complet | 99,9% |

**1er mois offert** sur Starter, Confort, Pro (trial_days: 30).

### 2.3 Frais de paiement

| Type | Standard | Enterprise | Cout Stripe | Marge |
|------|----------|-----------|-------------|-------|
| CB | 2,2% | 1,9% | 1,5% + 0,25 | ~31% / ~21% |
| SEPA | 0,50 | 0,40 | 0,35 | 30% / 12,5% |
| Virement | Gratuit | Gratuit | -- | -- |

### 2.4 Signatures electroniques

| Plan | Incluses/mois | Prix hors quota | Cout reel |
|------|--------------|----------------|-----------|
| Gratuit | 0 | 5,90 | ~1,50 |
| Starter | 0 | 4,90 | ~1,50 |
| Confort | 2 | 3,90 | ~1,50 |
| Pro | 10 | 2,50 | ~1,50 |
| Enterprise S/M/L | 25/40/60 | 1,90 | ~1,50 |
| Enterprise XL | Illimite | Inclus | -- |

---

## 3. Feature Gating (PLAN_LIMITS)

### 3.1 Interface PlanLimits

Definie dans `lib/subscriptions/plan-limits.ts` :

```typescript
interface PlanLimits {
  // Quantitatifs (-1 = illimite)
  maxProperties: number;
  maxLeases: number;
  maxTenants: number;
  maxUsers: number;
  maxStorageMB: number;
  maxSignaturesPerMonth: number;

  // Booleens
  hasRentCollection: boolean;   // Paiement en ligne CB/SEPA
  hasAccounting: boolean;       // Comptabilite / rapprochement
  hasFECExport: boolean;        // Export FEC comptable
  hasFiscalAI: boolean;         // Aide fiscale / scoring avance
  hasAITalo: boolean;           // Agent IA TALO
  hasMultiEntity: boolean;      // Multi-mandants / SCI
  hasAPI: boolean;              // Acces API
  hasOpenBanking: boolean;      // Open Banking
  hasAutoReminders: boolean;    // Relances automatiques email
  hasAutoRemindersSMS: boolean; // Relances SMS
  hasIRLRevision: boolean;      // Revision IRL automatique
  hasEdlDigital: boolean;       // EDL numerique
  hasScoringTenant: boolean;    // Scoring locataire IA
  hasWorkOrders: boolean;       // Ordres de travaux
  hasProvidersManagement: boolean; // Gestion prestataires
  hasMultiUsers: boolean;       // Multi-utilisateurs
  hasCoproModule: boolean;      // Module copropriete
  hasWhiteLabel: boolean;       // Marque blanche
  hasSSO: boolean;              // SSO
  hasPrioritySupport: boolean;  // Support prioritaire
}
```

### 3.2 Matrice par plan

| Feature | Gratuit | Starter | Confort | Pro | Ent. S | Ent. M | Ent. L | Ent. XL |
|---------|---------|---------|---------|-----|--------|--------|--------|---------|
| maxProperties | 1 | 3 | 10 | 50 | 100 | 200 | 500 | -1 |
| maxLeases | 1 | 5 | 25 | -1 | -1 | -1 | -1 | -1 |
| maxTenants | 2 | 10 | 40 | -1 | -1 | -1 | -1 | -1 |
| maxUsers | 1 | 1 | 2 | 5 | -1 | -1 | -1 | -1 |
| maxStorageMB | 102 | 1024 | 5120 | 30720 | 51200 | 102400 | 204800 | -1 |
| maxSignatures/mois | 0 | 0 | 2 | 10 | 25 | 40 | 60 | -1 |
| hasRentCollection | -- | oui | oui | oui | oui | oui | oui | oui |
| hasAccounting | -- | -- | oui | oui | oui | oui | oui | oui |
| hasFECExport | -- | -- | oui | oui | oui | oui | oui | oui |
| hasFiscalAI | -- | -- | -- | oui | oui | oui | oui | oui |
| hasAITalo | -- | -- | -- | oui | oui | oui | oui | oui |
| hasMultiEntity | -- | -- | -- | -- | oui | oui | oui | oui |
| hasAPI | -- | -- | -- | oui | oui | oui | oui | oui |
| hasOpenBanking | -- | -- | oui | oui | oui | oui | oui | oui |
| hasAutoReminders | -- | email | oui | oui | oui | oui | oui | oui |
| hasAutoRemindersSMS | -- | -- | -- | oui | oui | oui | oui | oui |
| hasIRLRevision | -- | -- | oui | oui | oui | oui | oui | oui |
| hasEdlDigital | -- | -- | oui | oui | oui | oui | oui | oui |
| hasScoringTenant | -- | -- | oui | oui | oui | oui | oui | oui |
| hasWorkOrders | -- | -- | oui | oui | oui | oui | oui | oui |
| hasProvidersManagement | -- | -- | -- | oui | oui | oui | oui | oui |
| hasMultiUsers | -- | -- | oui | oui | oui | oui | oui | oui |
| hasCoproModule | -- | -- | -- | -- | -- | -- | -- | oui |
| hasWhiteLabel | -- | -- | -- | -- | -- | oui | oui | oui |
| hasSSO | -- | -- | -- | -- | -- | -- | -- | oui |
| hasPrioritySupport | -- | -- | -- | -- | oui | oui | oui | oui |

### 3.3 Hook usePlanAccess()

```typescript
import { usePlanAccess } from '@/lib/hooks/use-plan-access';

const { limits, hasFeature, canAddProperty, upgradeCTA } = usePlanAccess();

// Verif booleenne
if (!hasFeature('hasAccounting')) return <UpgradeGate feature="hasAccounting" />;

// Verif quantitative
if (!canAddProperty(currentCount)) return <UpgradeGate feature="maxProperties" />;
```

### 3.4 Flags documentes dans d'autres skills

Les flags suivants sont documentes dans des skills dedies et ne sont **pas** dans `PlanLimits` actuel.
Ne pas modifier `plans.ts` — documentation de reference uniquement :

```typescript
// Flags a ajouter (sans modifier plans.ts) — documentation
// hasColocation: true   -> Confort+ (voir skill talok-colocation)
// hasProviders: true    -> Confort+ (voir skill talok-providers)
// hasMarketplace: true  -> Pro+ (voir skill talok-providers)
// hasSMS: true          -> via add-on (voir skill talok-addons)
```

---

## 4. Stripe Checkout (Abonnements)

### 4.1 Flux souscription

1. User clique "Passer au plan X" dans `/owner/billing` ou `/pricing`
2. API cree une Checkout Session (`mode: 'subscription'`)
3. Redirect Stripe Hosted Checkout
4. Webhook `checkout.session.completed` -> update `subscriptions` table
5. Webhook `customer.subscription.updated` -> sync plan + status

### 4.2 Flux signature hors quota

1. User clique "Acheter X signatures"
2. API cree une Checkout Session (`mode: 'payment'`)
3. Webhook `checkout.session.completed` -> credit `signature_credits`

---

## 5. Stripe Connect (Paiements locataires)

### 5.1 Flux Express

1. Proprietaire active "Paiement en ligne" dans `/owner/billing/connect`
2. API cree un compte Express via `stripe.accounts.create({ type: 'express' })`
3. Redirect onboarding Stripe (`stripe.accountLinks.create()`)
4. Webhook `account.updated` -> sync `stripe_connect_accounts`
5. Quand `charges_enabled = true` -> proprietaire peut recevoir des paiements

### 5.2 Flux paiement loyer

1. Locataire paie via `/tenant/payments`
2. API cree un PaymentIntent avec `transfer_data.destination = stripe_account_id`
3. Stripe preleve le locataire (CB ou SEPA)
4. Webhook `payment_intent.succeeded` -> update `payments`, genere quittance
5. Stripe transfere au proprietaire (moins `application_fee_amount`)

---

## 6. Webhooks Stripe

### 6.1 Evenements geres

| Evenement | Action |
|-----------|--------|
| `checkout.session.completed` | Sync abonnement / credit signatures |
| `payment_intent.succeeded` | Update payment, genere quittance PDF, email locataire |
| `payment_intent.payment_failed` | Update payment status, notif proprietaire |
| `invoice.paid` | Sync facture abonnement |
| `customer.subscription.updated` | Sync plan + status + features |
| `customer.subscription.deleted` | Annulation -> downgrade gratuit |
| `account.updated` | Sync compte Connect (charges/payouts enabled) |
| `transfer.created` / `transfer.paid` | Sync transfert proprietaire |
| `payout.paid` / `payout.failed` | Sync virement bancaire Connect |
| `charge.dispute.created` | Notification litige |

### 6.2 Idempotence

- Table `webhook_logs` avec `stripe_event_id` UNIQUE
- Chaque handler verifie si l'event a deja ete traite
- Outbox pattern pour les notifications async

### 6.3 Fichier webhook

`app/api/webhooks/stripe/route.ts` (~1200 lignes)

Imports cles :
- `reconcileOwnerTransfer` : reversement proprietaire
- `ensureReceiptDocument` : generation quittance PDF
- `syncInvoiceStatusFromPayments` : sync statut facture
- `buildSubscriptionUpdateFromStripe` : mapping plan Stripe -> Talok

### 6.4 Tables Supabase liees a Stripe

| Table | Colonnes cles |
|-------|--------------|
| `subscriptions` | `profile_id`, `stripe_subscription_id`, `stripe_customer_id`, `plan_slug`, `status` |
| `stripe_connect_accounts` | `profile_id` (FK), `stripe_account_id`, `stripe_account_status`, `charges_enabled`, `payouts_enabled` |
| `stripe_transfers` | `connect_account_id`, `stripe_transfer_id`, `amount`, `platform_fee`, `net_amount`, `status` |
| `payments` | `stripe_payment_intent_id`, `amount`, `status`, `payment_method` |
| `invoices` | `stripe_invoice_id`, `subscription_id`, `amount_due`, `status` |
| `webhook_logs` | `stripe_event_id`, `event_type`, `processed_at` |
| `signature_credits` | `profile_id`, `credits_remaining`, `credits_used` |

**IMPORTANT :** La table `property_owners` N'EXISTE PAS.
Schema reel : `profiles` -> `owner_profiles` -> `legal_entities` -> `property_ownership` -> `properties`.
Le `stripe_account_id` est sur `stripe_connect_accounts` (FK `profile_id`).

---

## 7. Commissions et revenus

### 7.1 GLI (Garantie Loyers Impayes)

| Plan | Reduction GLI |
|------|--------------|
| Gratuit | 0% |
| Starter | -5% |
| Confort | -10% |
| Pro | -15% |
| Enterprise S | -18% |
| Enterprise M | -20% |
| Enterprise L | -22% |
| Enterprise XL | -25% |

### 7.2 Commissions partenaires

| Partenaire | Commission |
|-----------|-----------|
| GLI | 25% de la prime |
| PNO | 20% de la prime |
| Diagnostics | 15% du prix |
| Artisans | 8% du devis |
| Credit | 5% des frais de dossier |

### 7.3 Documents premium

| Document | Prix |
|----------|------|
| Bail ALUR / Meuble | 19 |
| Bail Colocation | 24 |
| Bail Commercial | 29 |
| EDL Numerique | 29 |
| Regularisation charges | 15 |
| Attestation fiscale | 9 |
| Attestation loyer | 5 |
| Lettre simple | 3 |
| Lettre recommandee | 9 |

---

## 8. Composants UI cles

| Composant | Fichier | Role |
|-----------|---------|------|
| `SubscriptionProvider` | `components/subscription/subscription-provider.tsx` | Context `useSubscription()` |
| `usePlanAccess` | `lib/hooks/use-plan-access.ts` | Hook de gating unifie |
| `UpgradeGate` | Utilise dans les pages owner | Bloque + affiche CTA upgrade |
| Pricing page | `app/(marketing)/pricing/` | Grille tarifaire publique |
| Billing page | `app/owner/billing/` | Gestion abonnement proprietaire |

---

## 9. Regles obligatoires

1. **NE JAMAIS modifier `lib/subscriptions/plans.ts`** — source de verite BDD
2. Tous les prix en **centimes** dans `pricing-config.ts`
3. Utiliser `usePlanAccess()` pour le gating UI, jamais de conditions hardcodees
4. Les webhooks doivent etre **idempotents** (verifier `webhook_logs`)
5. Stripe Connect : toujours verifier `charges_enabled` avant de creer un PaymentIntent
6. Les transferts passent par `reconcileOwnerTransfer()`, jamais d'appel direct Stripe
7. Les quittances sont generees par `ensureReceiptDocument()` dans le webhook

---

## 10. Renvois croises entre skills

| Sujet | Skill |
|-------|-------|
| Grille tarifaire (resume) | `talok-context` section 6 |
| Feature gating comptabilite | `talok-accounting` section 9 |
| Documents, quittances, GED | `talok-documents-sota` |
| Onboarding, emails confirmation | `talok-onboarding-sota` |
| Add-ons (SMS, relances, scoring) | `talok-addons` |
| Colocation avancee | `talok-colocation` |
| Prestataires et marketplace | `talok-providers` |
