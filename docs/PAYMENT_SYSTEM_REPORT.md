# Rapport Complet - Systeme de Paiements TALOK

**Date:** 13 Janvier 2026
**Version:** 1.0
**Auteur:** Analyse automatique

---

## Table des Matieres

1. [Vue d'Ensemble](#1-vue-densemble)
2. [Qui Paie Qui](#2-qui-paie-qui)
3. [Moyens de Paiement](#3-moyens-de-paiement)
4. [Integration Stripe](#4-integration-stripe)
5. [Configuration Technique](#5-configuration-technique)
6. [Grille Tarifaire](#6-grille-tarifaire)
7. [Analyse UX/UI](#7-analyse-uxui)
8. [Points d'Amelioration](#8-points-damelioration)
9. [Recommandations](#9-recommandations)

---

## 1. Vue d'Ensemble

TALOK dispose d'un systeme de paiement complet et mature base sur **Stripe** comme processeur principal. Le systeme gere deux types de flux financiers distincts:

### Flux Principaux

```
+-------------------+         +------------------+         +------------------+
|    LOCATAIRES     |  ---->  |    PLATEFORME    |  ---->  |  PROPRIETAIRES   |
| (Paiement loyer)  |  Stripe |  (Frais deduits) |         | (Net recu)       |
+-------------------+         +------------------+         +------------------+

+-------------------+         +------------------+
|   PROPRIETAIRES   |  ---->  |    PLATEFORME    |
|  (Abonnements)    |  Stripe |    (Revenue)     |
+-------------------+         +------------------+
```

### Statistiques Cles

| Metrique | Valeur |
|----------|--------|
| Nombre de tables de paiement | 7 |
| Types de paiement supportes | 6 |
| Plans d'abonnement | 8 |
| Webhooks configures | 6 evenements |

---

## 2. Qui Paie Qui

### 2.1 Locataire → Proprietaire (Loyer)

Le flux principal de l'application. Le locataire paie son loyer qui transite par Stripe avant d'arriver au proprietaire.

| Acteur | Role | Montant Exemple |
|--------|------|-----------------|
| Locataire | Emetteur | 800€ |
| Stripe | Processeur | -12.25€ (1.5% + 0.25€) |
| Plateforme | Commission | -5.35€ (reste 2.2%) |
| Proprietaire | Beneficiaire | ~782.40€ net |

**Fichiers impliques:**
- `app/api/payments/create-intent/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `features/billing/components/payment-checkout.tsx`

### 2.2 Proprietaire → Plateforme (Abonnements)

Les proprietaires paient un abonnement mensuel/annuel pour acceder aux fonctionnalites.

| Plan | Prix Mensuel | Marge Plateforme |
|------|-------------|------------------|
| Gratuit | 0€ | - |
| Starter | 9€ | ~98% |
| Confort | 35€ | ~98% |
| Pro | 69€ | ~98% |
| Enterprise S | 249€ | ~98% |
| Enterprise L | 499€ | ~98% |

**Fichiers impliques:**
- `app/api/subscriptions/checkout/route.ts`
- `lib/subscriptions/subscription-service.ts`
- `app/settings/billing/page.tsx`

### 2.3 Proprietaire ← Prestataire (Factures travaux)

Les prestataires envoient leurs factures aux proprietaires pour les travaux realises.

**Tables impliquees:**
- `provider_invoices`
- `provider_invoice_payments`

---

## 3. Moyens de Paiement

### 3.1 Tableau Comparatif

| Moyen | Code | Frais Factures | Frais Stripe | Marge | Disponibilite |
|-------|------|----------------|--------------|-------|---------------|
| **Carte Bancaire** | `cb` | 2.2% | 1.5% + 0.25€ | ~31% | Tous |
| **SEPA Prelevement** | `prelevement` | 0.50€ | 0.35€ | ~30% | Tous |
| **Virement** | `virement` | Gratuit | N/A | 0% | Manuel |
| **Especes** | `especes` | Gratuit | N/A | 0% | Manuel + Signatures |
| **Cheque** | `cheque` | Gratuit | N/A | 0% | Manuel |
| **Autre** | `autre` | Variable | N/A | Variable | Manuel |

### 3.2 Carte Bancaire (CB)

**Implementation:** Stripe Elements avec `PaymentElement`

```typescript
// features/billing/components/payment-checkout.tsx:113
<PaymentElement
  options={{
    layout: "tabs",
  }}
/>
```

**Points forts UX:**
- Interface native Stripe reconnue
- Support Apple Pay / Google Pay automatique
- Animations de feedback (succes/echec)
- Theming personnalise (couleur primaire #2563eb)

**Limitations:**
- Frais les plus eleves (2.2%)
- Redirection possible pour 3D Secure

### 3.3 Prelevement SEPA

**Implementation:** Service dedie `lib/stripe/sepa.service.ts`

```typescript
// Fonctions disponibles:
- createSepaSetupIntent()  // Creer un mandat
- confirmSepaSetupIntent() // Valider avec IBAN
- createSepaPayment()      // Prelever
- refundSepaPayment()      // Rembourser
```

**Points forts:**
- Frais fixes faibles (0.50€)
- Ideal pour gros montants
- Prelevement automatique possible
- Mandat reutilisable

**Points faibles:**
- Delai de traitement (3-5 jours)
- Configuration plus complexe
- Rejet possible (provisions insuffisantes)

### 3.4 Paiement en Especes

**Implementation:** Flux complet avec double signature

```typescript
// components/payments/CashReceiptFlow.tsx
Etapes:
1. Info (montant, notes)
2. Signature proprietaire (tactile)
3. Signature locataire (tactile)
4. Generation PDF avec hash crypto
```

**Caracteristiques SOTA 2025:**
- Geolocalisation du paiement
- Signatures numeriques tactiles
- Hash SHA-256 pour integrite
- PDF genere automatiquement
- Envoi email aux deux parties

**Champs captures:**
```sql
-- Table cash_receipts
owner_signature     -- Base64 PNG
tenant_signature    -- Base64 PNG
latitude, longitude -- Position GPS
device_info         -- JSONB (UA, ecran, etc.)
document_hash       -- SHA-256
signature_chain     -- Chaine de verification
```

### 3.5 Cheque et Virement

**Implementation:** Enregistrement manuel par le proprietaire

```typescript
// components/payments/ManualPaymentDialog.tsx
Champs:
- Montant recu
- Date de reception
- Reference (numero cheque / ref virement)
- Banque emettrice
- Notes
```

---

## 4. Integration Stripe

### 4.1 Configuration

**Variables d'environnement requises:**
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

**Fichiers de configuration:**
- `lib/stripe/index.ts` - Initialisation lazy server-side
- `lib/stripe/client.ts` - Configuration client-side
- `lib/services/stripe.service.ts` - Operations API

### 4.2 Webhooks Geres

| Evenement | Action | Fichier |
|-----------|--------|---------|
| `checkout.session.completed` | Marque facture payee, genere quittance | `route.ts:319` |
| `payment_intent.succeeded` | Cree enregistrement paiement | `route.ts:439` |
| `payment_intent.payment_failed` | Marque facture en retard | `route.ts:494` |
| `invoice.paid` | Met a jour abonnement actif | `route.ts:523` |
| `customer.subscription.updated` | Synchronise dates abonnement | `route.ts:567` |
| `customer.subscription.deleted` | Marque abonnement annule | `route.ts:590` |

### 4.3 Securite Webhook

```typescript
// Verification signature HMAC-SHA256
event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

### 4.4 Stripe Billing Portal

Les proprietaires peuvent gerer leur abonnement via le portail Stripe natif:
- Modifier moyen de paiement
- Telecharger factures
- Annuler abonnement

---

## 5. Configuration Technique

### 5.1 Schema Base de Donnees

#### Table `payments`
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id),
  montant NUMERIC NOT NULL,
  moyen TEXT CHECK (moyen IN ('cb', 'virement', 'prelevement', 'especes', 'cheque', 'autre')),
  provider_ref TEXT,  -- Stripe Payment Intent ID
  statut TEXT CHECK (statut IN ('pending', 'succeeded', 'failed')),
  date_paiement DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table `invoices`
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  lease_id UUID REFERENCES leases(id),
  owner_id UUID,
  tenant_id UUID,
  montant_loyer NUMERIC,
  montant_charges NUMERIC,
  montant_total NUMERIC,
  periode TEXT,  -- "2024-12"
  statut TEXT CHECK (statut IN ('draft', 'pending', 'paid', 'late', 'cancelled')),
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  date_paiement DATE
);
```

#### Table `subscriptions`
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  owner_id UUID,
  plan_id UUID REFERENCES subscription_plans(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ
);
```

### 5.2 API Routes

| Route | Methode | Description |
|-------|---------|-------------|
| `/api/payments/create-intent` | POST | Creer Payment Intent Stripe |
| `/api/payments/setup-intent` | POST | Configurer moyen de paiement |
| `/api/payments/calculate-fees` | GET | Calculer frais |
| `/api/payments/cash-receipt` | POST | Generer recu especes |
| `/api/invoices/[id]/mark-paid` | POST | Marquer paye manuellement |
| `/api/subscriptions/checkout` | POST | Creer session checkout abo |
| `/api/subscriptions/portal` | POST | Ouvrir portail Stripe |
| `/api/webhooks/stripe` | POST | Recevoir evenements Stripe |

---

## 6. Grille Tarifaire

### 6.1 Frais de Paiement

**Source:** `lib/subscriptions/pricing-config.ts`

| Type | Standard | Enterprise | Cout Reel Stripe | Marge |
|------|----------|------------|------------------|-------|
| CB | 2.2% | 1.9% | 1.5% + 0.25€ | ~31% / ~21% |
| SEPA | 0.50€ | 0.40€ | 0.35€ | ~30% / ~12.5% |

### 6.2 Plans d'Abonnement

| Plan | Prix/mois | Biens | Signatures/mois | Frais CB |
|------|-----------|-------|-----------------|----------|
| Gratuit | 0€ | 1 | 0 (5.90€/u) | 2.2% |
| Starter | 9€ | 3 | 0 (4.90€/u) | 2.2% |
| Confort | 35€ | 10 | 2 incluses | 2.2% |
| Pro | 69€ | 50 | 10 incluses | 2.2% |
| Enterprise S | 249€ | 100 | 25 incluses | 1.9% |
| Enterprise M | 349€ | 200 | 40 incluses | 1.9% |
| Enterprise L | 499€ | 500 | 60 incluses | 1.9% |
| Enterprise XL | 799€ | Illimite | Illimitees | 1.9% |

### 6.3 Frais par Bien Supplementaire

| Plan | Prix/bien supp. |
|------|-----------------|
| Starter | +3€/mois |
| Confort | +2.50€/mois |
| Pro | +2€/mois |
| Enterprise | Inclus dans plage |

---

## 7. Analyse UX/UI

### 7.1 Parcours Locataire

```
Dashboard Locataire
      │
      ▼
Facture en attente (Badge rouge)
      │
      ▼
Clic "Payer maintenant"
      │
      ▼
┌─────────────────────────────────┐
│  PaymentCheckout Component      │
│  ┌───────────────────────────┐  │
│  │ Stripe PaymentElement     │  │
│  │ (CB / Apple Pay / etc)    │  │
│  └───────────────────────────┘  │
│                                 │
│  [Annuler]  [Payer 800.00€]    │
└─────────────────────────────────┘
      │
      ▼
Animation succes/echec
      │
      ▼
Quittance PDF generee + Email
```

**Points positifs:**
- Interface Stripe reconnue = confiance
- Animations Framer Motion
- Feedback immediat (toast)
- Redirection minimale (`redirect: "if_required"`)

**Points a ameliorer:**
- Pas de choix du moyen de paiement cote locataire (CB uniquement dans le flow actuel)
- Pas d'affichage des frais au locataire

### 7.2 Parcours Proprietaire - Enregistrement Manuel

```
Page Facture
      │
      ▼
Bouton "Marquer comme paye"
      │
      ▼
┌─────────────────────────────────┐
│  ManualPaymentDialog            │
│                                 │
│  [Especes]  [Cheque]  [Virement]│
│                                 │
└─────────────────────────────────┘
      │
      ├──── Especes ────┐
      │                 ▼
      │    ┌─────────────────────┐
      │    │ CashReceiptFlow     │
      │    │ 1. Infos            │
      │    │ 2. Sign proprio     │
      │    │ 3. Sign locataire   │
      │    │ 4. Generation PDF   │
      │    └─────────────────────┘
      │
      └──── Cheque/Virement ────┐
                                ▼
                   ┌─────────────────────┐
                   │ Formulaire simple   │
                   │ - Montant           │
                   │ - Date              │
                   │ - Reference         │
                   │ - Banque            │
                   └─────────────────────┘
```

**Points positifs:**
- Distinction claire des moyens de paiement
- Icones et couleurs differenciees
- Flow especes tres complet (signatures tactiles)
- Geolocalisation pour securite

**Points a ameliorer:**
- Le flux especes est long (4 etapes)
- Pas de QR code pour partager au locataire

### 7.3 Parcours Proprietaire - Abonnement

```
/settings/billing
      │
      ▼
┌─────────────────────────────────┐
│  Plan actuel + Usage            │
│  ┌───────────────────────────┐  │
│  │ Biens: ████████░░ 8/10    │  │
│  │ Baux:  ██████░░░░ 15/25   │  │
│  │ Stock: ████░░░░░░ 2Go/5Go │  │
│  └───────────────────────────┘  │
│                                 │
│  [Changer forfait]              │
│  [Gerer paiement] → Stripe Portal│
│  [Mes factures]                 │
└─────────────────────────────────┘
```

**Points positifs:**
- Visualisation claire de l'usage (Progress bars)
- Alerte changement de prix avec grandfathering
- Integration Stripe Billing Portal native
- Gestion du trial affichee

### 7.4 Onboarding Locataire - Configuration Paiement

```
/tenant/onboarding/payments
      │
      ▼
┌─────────────────────────────────┐
│  Choix du mode de reglement     │
│                                 │
│  ○ Prelevement SEPA (Auto)      │
│  ○ Carte Bancaire / Apple Pay   │
│  ○ Virement Bancaire (Manuel)   │
│  ○ Virement Instantane          │
│                                 │
│  ┌───────────────────────────┐  │
│  │ PaymentMethodSetup        │  │
│  │ (Stripe Elements)         │  │
│  └───────────────────────────┘  │
│                                 │
│  □ J'autorise le prelevement... │
│                                 │
│  [Continuer vers la signature]  │
└─────────────────────────────────┘
```

**Points positifs:**
- Choix multiple de moyens de paiement
- Configuration SEPA proactive
- Mandat accepte explicitement
- Support colocation (part %)

---

## 8. Points d'Amelioration

### 8.1 Problemes Identifies

| # | Probleme | Severite | Impact |
|---|----------|----------|--------|
| 1 | Pas de PayPal | Moyenne | ~15% utilisateurs potentiels |
| 2 | Pas de paiement fractionne | Basse | Experience utilisateur |
| 3 | Flow especes trop long | Moyenne | Friction proprietaires |
| 4 | Frais non affiches au locataire | Haute | Transparence |
| 5 | Pas de relance auto pre-echeance | Moyenne | Taux de paiement |
| 6 | Pas d'export comptable direct | Moyenne | B2B |
| 7 | Pas de rapprochement bancaire auto | Haute | Temps proprietaire |
| 8 | UI PaymentElement non traduite | Basse | Experience FR |

### 8.2 Bugs Potentiels

```typescript
// features/billing/components/payment-checkout.tsx:162
useState(() => {
  // PROBLEME: useState avec callback n'est pas le bon pattern
  // Devrait etre useEffect
  async function createIntent() { ... }
  createIntent();
});
```

### 8.3 Securite

| Point | Statut | Commentaire |
|-------|--------|-------------|
| Webhook signature | ✅ | HMAC-SHA256 verifie |
| RLS Policies | ✅ | Filtrage par role |
| Rate limiting | ⚠️ | Non visible dans le code |
| PCI Compliance | ✅ | Via Stripe Elements |
| Audit logs | ✅ | Table webhook_logs |

---

## 9. Recommandations

### 9.1 Court Terme (1-2 semaines)

1. **Corriger le bug useState/useEffect** dans `payment-checkout.tsx`
2. **Afficher les frais au locataire** avant paiement
3. **Ajouter traduction FR** aux elements Stripe
4. **Simplifier flow especes** (2 etapes max si meme appareil)

### 9.2 Moyen Terme (1-2 mois)

1. **Integrer PayPal** comme alternative
2. **Ajouter paiement fractionne** (3x sans frais)
3. **Open Banking** pour rapprochement auto
4. **Relances automatiques** J-3 avant echeance
5. **QR Code** pour paiement especes a distance

### 9.3 Long Terme (3-6 mois)

1. **Multi-devises** (CHF, GBP pour frontaliers)
2. **Stripe Connect** pour paiement direct proprio
3. **Crypto-paiements** (USDC stablecoin)
4. **Scoring paiement** base sur historique

---

## Annexes

### A. Arborescence Fichiers Paiement

```
TALOK/
├── app/
│   ├── api/
│   │   ├── payments/
│   │   │   ├── create-intent/
│   │   │   ├── setup-intent/
│   │   │   ├── cash-receipt/
│   │   │   └── calculate-fees/
│   │   ├── invoices/[id]/
│   │   │   ├── mark-paid/
│   │   │   ├── receipt/
│   │   │   └── remind/
│   │   ├── subscriptions/
│   │   │   ├── checkout/
│   │   │   ├── portal/
│   │   │   └── invoices/
│   │   └── webhooks/
│   │       └── stripe/
│   ├── settings/billing/
│   └── tenant/onboarding/payments/
├── components/payments/
│   ├── stripe-checkout.tsx
│   ├── payment-fees-display.tsx
│   ├── ManualPaymentDialog.tsx
│   ├── CashReceiptFlow.tsx
│   └── SignaturePad.tsx
├── features/billing/
│   ├── components/
│   │   └── payment-checkout.tsx
│   └── services/
│       └── payments.service.ts
├── lib/
│   ├── stripe/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   └── sepa.service.ts
│   ├── subscriptions/
│   │   ├── pricing-config.ts
│   │   ├── payment-fees.ts
│   │   └── subscription-service.ts
│   └── services/
│       ├── stripe.service.ts
│       └── receipt-generator.ts
└── supabase/migrations/
    ├── 20241129000001_subscriptions.sql
    ├── 20241129000002_cash_payments.sql
    └── 20251231000007_invoices_stripe_fields.sql
```

### B. Variables d'Environnement

```bash
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Optionnel - Credentials service
STRIPE_CREDENTIALS_ENCRYPTED=true
```

### C. Evenements Outbox Emis

| Event | Payload | Usage |
|-------|---------|-------|
| `Payment.Succeeded` | payment_id, amount, tenant_id | Notif locataire |
| `Payment.Received` | payment_id, amount, owner_id | Notif proprio |

---

**Fin du rapport**
