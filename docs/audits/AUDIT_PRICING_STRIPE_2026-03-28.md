# Audit Pricing × UI × Documents × Stripe Integration

**Date** : 2026-03-28
**Branche** : `claude/audit-pricing-stripe-integration-qU3Hn`

---

## PART 1 — Feature Gating (Pricing × UI)

| Élément | Statut | Détails |
|---------|--------|---------|
| `lib/subscriptions/plans.ts` | ✅ OK | 9 plans (gratuit→enterprise_xl), ~35 FeatureKeys, PlanLimits complets. **Non modifié (règle Talok).** |
| `lib/subscriptions/pricing-config.ts` | ✅ OK | PAYMENT_FEES, SIGNATURE_PRICES, SIGNATURE_QUOTAS, EXTRA_PROPERTY_FEES, ADDON_PRICES cohérents |
| `lib/subscriptions/plan-limits.ts` | ✅ OK | **Créé** — PlanLimits interface (quantitative + boolean), buildLimitsForPlan(), PLAN_LIMITS pré-calculés, getMinimumPlanForFeature(), getUpgradeTarget(), getUpgradeCTA() |
| `lib/hooks/use-plan-access.ts` | ✅ OK | **Créé** — usePlanAccess() hook : canAddProperty, canAddUser, canSign, canUpload, hasFeature, upgradeTarget, upgradeCTA, upgradeReason |
| `lib/hooks/use-signature-quota.ts` | ✅ OK | **Créé** — Re-export standalone de useSignatureQuota |
| `components/upgrade-gate.tsx` | ✅ OK | **Créé** — UpgradeGate (lock/limit/hide), mappe PlanLimits→FeatureKey→PlanGate, QuantitativeGate pour limites |
| `components/subscription/plan-gate.tsx` | ✅ OK | PlanGate (block/blur/hide), PlanGateInline, PlanGateTooltip — déjà complet |
| `components/subscription/upgrade-modal.tsx` | ✅ OK | Modal upgrade avec cards plans, toggle mensuel/annuel, features gagnées, HT/TTC, extra-property — complet |
| `components/subscription/subscription-provider.tsx` | ✅ OK | SubscriptionProvider, useFeature, useUsageLimit, useCurrentPlan, useSignatureQuota — complet |
| `components/subscription/usage-limit-banner.tsx` | ✅ OK | Bandeau d'avertissement limites (properties, leases, users, signatures) |
| Sidebar gating (`AppShell.tsx`) | ✅ OK | **Amélioré** — buildOwnerNavigation vérifie hasFeature, items conditionnels (Inspections, Prestataires, etc.) avec feature gating |
| Backend gating middleware | ✅ OK | `withSubscriptionLimit` (5 types) + `withFeatureAccess` (FeatureKey) dans `lib/middleware/subscription-check.ts` |
| Routes API protégées | ✅ OK | 12+ routes protégées : properties, leases, documents, signatures, work-orders, edl, sms, SEPA collect-rent, legal-entities |

---

## PART 2 — Stripe (Checkout, Webhooks, Connect, SEPA)

| Élément | Statut | Détails |
|---------|--------|---------|
| **Checkout** (`/api/subscriptions/checkout`) | ✅ OK | Crée session Stripe Checkout, metadata complètes, trial 30j, allow_promotion_codes, payment_method: card |
| **Webhook handler** (`/api/webhooks/stripe`) | ✅ OK | ~1200 lignes, 15+ event types gérés, idempotency via webhook_logs |
| `checkout.session.completed` | ✅ OK | Sync subscription, update profiles, crée customer record |
| `payment_intent.succeeded` | ✅ OK | Sync paiement, génère quittance (ensureReceiptDocument), reconciliation |
| `payment_intent.payment_failed` | ✅ OK | Marque paiement failed, notification outbox |
| `invoice.paid` / `invoice.payment_failed` | ✅ OK | Sync facturation Stripe, action_required pour 3D Secure |
| `customer.subscription.*` (created/updated/deleted) | ✅ OK | Sync complète de l'abonnement, gestion trial_will_end |
| `account.updated` (Connect) | ✅ OK | Sync statut compte Connect Express |
| `transfer.*` / `payout.*` | ✅ OK | Suivi transferts et virements propriétaires |
| `charge.dispute.created` | ✅ OK | **Ajouté** — Log litige, marque paiement "disputed", notifie propriétaire via outbox |
| **Stripe Connect** (`lib/stripe/connect.service.ts`) | ✅ OK | Service complet : createExpressAccount, createAccountLink, dashboard, createTransfer, getBalance |
| **SEPA** (`lib/stripe/sepa.service.ts`) | ✅ OK | Service complet : createCustomer, setupMandate, createSepaPayment, cancelMandate |
| **Setup SEPA** (`/api/payments/setup-sepa`) | ✅ OK | Route existante complète |
| **Collect Rent** (`/api/stripe/collect-rent`) | ✅ OK | **Créé** — Prélèvement SEPA avec vérif plan (tenant_payment_online), mandat actif, metadata, DB sync |
| Idempotency webhook | ✅ OK | Table webhook_logs, vérification avant traitement |
| Outbox notifications | ✅ OK | Pattern outbox pour emails/notifications asynchrones |

---

## PART 3 — Quittances (Receipts)

| Élément | Statut | Détails |
|---------|--------|---------|
| `lib/services/receipt-generator.ts` | ✅ OK | PDF A4 via pdf-lib, mentions ALUR (article 21 loi 89-462, Décret 2015-587) |
| Séparation loyer / charges | ✅ OK | loyer_principal + provisions_charges distingués (exigence ALUR) |
| `ensureReceiptDocument` | ✅ OK | Appelé dans webhook (payment_intent.succeeded), mark-paid, confirm-payment |
| Pipeline webhook → quittance | ✅ OK | payment_intent.succeeded → ensureReceiptDocument → stockage Supabase Storage |
| Endpoint génération manuelle | ✅ OK | `/api/leases/[id]/receipts` et `/api/payments/[pid]/receipt` |
| `final-documents.service.ts` | ✅ OK | Service centralisé pour génération et stockage des documents finaux |

---

## PART 4 — Signatures électroniques

| Élément | Statut | Détails |
|---------|--------|---------|
| `lib/subscriptions/signature-tracking.ts` | ✅ OK | getSignatureUsageByOwner, canUseSignature, checkSignatureQuota, incrementSignatureUsage, recordSignatureUsage, getSignatureHistory, calculateExtraSignatureCost |
| RPC Supabase signatures | ✅ OK | get_signature_usage_by_owner, get_signature_usage, increment_signature_usage |
| Quota par plan | ✅ OK | gratuit:0, starter:5, confort:15, pro:50, enterprise:illimité (dans plans.ts) |
| Hook useSignatureQuota | ✅ OK | used, limit, remaining, percentage, isUnlimited, canSign, isAtLimit, pricePerExtra |
| Backend gating signatures | ✅ OK | withSubscriptionLimit(ownerId, "signatures") dans `/api/signatures/requests` |
| Incrémentation à la signature | ✅ OK | incrementSignatureUsage appelé dans `/api/leases/[id]/sign` |
| Comptage mensuel | ✅ OK | Compteur mensuel avec reset automatique |
| Surcoût extra-signature | ✅ OK | calculateExtraSignatureCost dans signature-tracking.ts, prix dans SIGNATURE_PRICES |

---

## PART 5 — Création de bail (Lease Wizard)

| Élément | Statut | Détails |
|---------|--------|---------|
| `app/owner/leases/new/LeaseWizard.tsx` | ✅ OK | Wizard multi-étapes existant |
| `features/leases/stores/lease-wizard.store.ts` | ✅ OK | Store Zustand pour état du wizard |
| `lib/mappers/lease-wizard-to-preview.ts` | ✅ OK | Mapping wizard → preview PDF |
| Types de bail spécialisés | ✅ OK | Champs Furnished, Commercial, Professional, LocationGerance, Parking |
| Wizard parking dédié | ✅ OK | `features/leases/components/parking-lease-wizard` |
| Wizard renouvellement | ✅ OK | `features/leases/components/lease-renewal-wizard.tsx` |
| Wizard fin de bail | ✅ OK | `features/end-of-lease/components/lease-end-wizard.tsx` |
| Génération PDF bail | ✅ OK | Via pdf.service.ts et generate-pdf edge function |
| Flow signature post-création | ✅ OK | `/api/leases/[id]/sign` avec guard signature quota |

---

## PART 6 — Checklist finale

| Vérification | Statut | Notes |
|-------------|--------|-------|
| `plans.ts` non modifié | ✅ OK | Aucune modification — règle Talok respectée |
| Gating frontend (PlanGate + UpgradeGate) | ✅ OK | Composants en place, modes block/blur/hide/lock/limit |
| Gating backend (middleware) | ✅ OK | withSubscriptionLimit + withFeatureAccess sur routes critiques |
| Webhook idempotent | ✅ OK | webhook_logs table |
| Quittances ALUR | ✅ OK | Mentions légales, séparation loyer/charges |
| Signatures avec quota | ✅ OK | Tracking mensuel, hook client, backend check |
| SEPA Direct Debit | ✅ OK | Service complet + route collect-rent |
| Stripe Connect Express | ✅ OK | Service complet, webhook account.updated |
| Dispute handling | ✅ OK | charge.dispute.created handler ajouté |
| Notifications outbox | ✅ OK | Pattern outbox pour événements async |
| Sidebar conditionnelle | ✅ OK | Items verrouillés selon plan |
| Upgrade modal | ✅ OK | Avec comparaison plans et CTA |

---

## Fichiers créés / modifiés

### Nouveaux fichiers
- `lib/subscriptions/plan-limits.ts` — Interface PlanLimits, PLAN_LIMITS pré-calculés, helpers upgrade
- `lib/hooks/use-plan-access.ts` — Hook usePlanAccess()
- `lib/hooks/use-signature-quota.ts` — Re-export useSignatureQuota
- `components/upgrade-gate.tsx` — Composant wrapper universel gating
- `app/api/stripe/collect-rent/route.ts` — Endpoint prélèvement SEPA loyer

### Fichiers modifiés
- `app/api/webhooks/stripe/route.ts` — Ajout handler `charge.dispute.created`
- `components/layout/AppShell.tsx` — Gating conditionnel sidebar amélioré
- `app/api/owner/legal-entities/route.ts` — Ajout withFeatureAccess("multi_mandants")

---

## Résumé

| Section | Score |
|---------|-------|
| PART 1 — Feature Gating | ✅ 13/13 |
| PART 2 — Stripe | ✅ 16/16 |
| PART 3 — Quittances | ✅ 6/6 |
| PART 4 — Signatures | ✅ 8/8 |
| PART 5 — Lease Wizard | ✅ 9/9 |
| PART 6 — Checklist | ✅ 12/12 |
| **TOTAL** | **✅ 64/64** |
