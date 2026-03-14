# 📋 Système de Paiement Stripe - TALOK

> Documentation complète du flux de paiement, génération des quittances et architecture technique.

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Parcours du locataire](#2-parcours-du-locataire)
3. [Flux de données pour les quittances](#3-flux-de-données-pour-les-quittances)
4. [Architecture technique](#4-architecture-technique)
5. [Tables de données](#5-tables-de-données)
6. [Fonctionnalités existantes](#6-fonctionnalités-existantes)
7. [Fonctionnalités manquantes](#7-fonctionnalités-manquantes)
8. [Configuration](#8-configuration)
9. [Recommandations](#9-recommandations)

---

## 1. Vue d'ensemble

Le flux canonique de paiement locataire TALOK repose desormais sur une seule chaine :

`/tenant/payments` -> `/api/payments/create-intent` -> `stripe.confirmPayment()` -> webhook Stripe -> synchronisation `payments` / `invoices` -> quittance dans `documents`

Les routes historiques `POST /api/payments/checkout`, `POST /api/v1/invoices/:iid/payments` et `POST /api/leases/:id/pay` sont maintenues uniquement pour compatibilite et sont considerees comme legacy.

Le système de paiement de TALOK intègre Stripe pour les paiements en ligne, avec support produit pour :

| Mode de paiement | Description | Implémentation |
|------------------|-------------|----------------|
| **Carte bancaire (CB)** | Paiement immédiat via Stripe Elements | ✅ Complet |
| **Prélèvement SEPA** | Débit automatique sur compte bancaire | ✅ Complet |
| **Espèces** | Avec signature numérique et géolocalisation | ✅ Complet |
| **Virement** | Enregistrement manuel | ✅ Complet |
| **Chèque** | Enregistrement manuel | ✅ Complet |

### Cadrage produit cote proprietaire

- `Finances > Compte bancaire` correspond au compte `Stripe Connect` utilise pour recevoir les paiements en ligne et consulter les reversements.
- `owner_profiles.iban` reste un champ metier interne et n'est pas la source de verite du compte externe Stripe.
- `Open Banking` ou `Connexions bancaires` via GoCardless sert uniquement a la lecture des transactions bancaires pour le rapprochement des virements.
- Ces trois briques doivent rester distinctes dans les ecrans, les messages utilisateur et les integrations techniques.

### Schéma global

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   LOCATAIRE     │────▶│    STRIPE       │────▶│    SERVEUR      │
│   (Frontend)    │     │    (API)        │     │    (Backend)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  1. Initie paiement   │                       │
        │──────────────────────▶│                       │
        │                       │  2. PaymentIntent     │
        │                       │──────────────────────▶│
        │                       │                       │
        │  3. Formulaire carte  │                       │
        │◀──────────────────────│                       │
        │                       │                       │
        │  4. Confirme paiement │                       │
        │──────────────────────▶│                       │
        │                       │  5. Webhook canonique │
        │                       │──────────────────────▶│
        │                       │                       │
        │  6. Succès + Quittance│                       │
        │◀──────────────────────────────────────────────│
```

---

## 2. Parcours du locataire

### 2.1 Où le locataire voit ses charges

**Dashboard du locataire** (`/app/tenant/dashboard/DashboardClient.tsx`)

La carte "Situation financière" affiche :
- Montant du loyer mensuel
- Montant impayé (en rouge si existant)
- Indicateur de statut : "À jour de vos loyers" ✓ ou montant dû

```tsx
// DashboardClient.tsx:547-597
<Card>
  <CardHeader>
    <CardTitle>Situation financière</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">
      {formatCurrency(lease.loyer + lease.charges_forfaitaires)}
    </div>
    {unpaidAmount > 0 && (
      <Badge variant="destructive">
        {formatCurrency(unpaidAmount)} impayé
      </Badge>
    )}
  </CardContent>
</Card>
```

**Page du bail** (`/app/tenant/lease/page.tsx`)

Détail des composantes :
- Loyer principal (`loyer`)
- Charges forfaitaires (`charges_forfaitaires`)
- Total charges comprises (CC)

### 2.2 Comment le locataire initie un paiement

#### Étape 1 : Accès à la page des paiements

```
URL: /tenant/payments
Composant: TenantPaymentsClient.tsx
```

#### Étape 2 : Visualisation des factures impayées

Liste des factures avec statut (badge coloré) :
- `draft` : Brouillon (gris)
- `sent` : Envoyée (bleu)
- `paid` : Payée (vert)
- `late` : En retard (rouge)

Pour chaque facture impayée : bouton **"Payer"**

#### Étape 3 : Ouverture du dialogue de paiement

```tsx
// TenantPaymentsClient.tsx:143-219
<PaymentCheckout
  invoiceId={selectedInvoice.id}
  amount={selectedInvoice.montant_total}
  description={`Loyer ${formatPeriod(selectedInvoice.periode)}`}
  onSuccess={handlePaymentSuccess}
  onCancel={() => setShowPayment(false)}
/>
```

### 2.3 Flux de paiement par carte bancaire

```
┌─────────────────────────────────────────────────────────────────────┐
│  LOCATAIRE                      │  SERVEUR                         │
├─────────────────────────────────┼───────────────────────────────────┤
│ 1. Clique "Payer"               │                                   │
│         ↓                       │                                   │
│ 2. PaymentCheckout s'ouvre      │                                   │
│         ↓                       │                                   │
│ 3. Formulaire Stripe affiché    │←── clientSecret reçu             │
│         ↓                       │                                   │
│ 4. Entre infos carte            │                                   │
│         ↓                       │                                   │
│ 5. Clique "Confirmer"           │                                   │
│                                 │→── POST /api/payments/create-intent│
│                                 │    • Crée PaymentIntent Stripe    │
│                                 │    • Stocke payment "pending" en DB│
│                                 │←── Retourne clientSecret          │
│         ↓                       │                                   │
│ 6. stripe.confirmPayment()      │                                   │
│                                 │→── Stripe traite le paiement      │
│                                 │                                   │
│         ↓                       │                                   │
│ 7. Retour / redirection         │                                   │
│                                 │→── webhook Stripe                 │
│                                 │    • Met à jour payment           │
│                                 │    • Recalcule invoice            │
│                                 │    • Genere la quittance          │
│                                 │    • Emet les notifications       │
│         ↓                       │                                   │
│ 8. Animation succès ✓           │                                   │
└─────────────────────────────────┴───────────────────────────────────┘
```

### 2.4 Fichiers clés du parcours paiement

| Composant | Fichier | Description |
|-----------|---------|-------------|
| Formulaire paiement | `/features/billing/components/payment-checkout.tsx` | UI Stripe Elements |
| Création PaymentIntent | `/app/api/payments/create-intent/route.ts` | Création intent Stripe |
| Webhook Stripe | `/app/api/webhooks/stripe/route.ts` | Synchronisation canonique post-paiement |
| Confirmation legacy | `/app/api/payments/confirm/route.ts` | Route de secours / reconciliation legacy |
| Checkout Session legacy | `/app/api/payments/checkout/route.ts` | Ancien mode Checkout hébergé |

### 2.5 Statuts payables cote locataire

Le locataire peut initier un paiement uniquement pour les statuts :

- `sent`
- `late`
- `overdue`
- `partial`
- `unpaid`

Les statuts `draft`, `cancelled` et `paid` ne doivent jamais ouvrir le checkout.

---

## 3. Flux de données pour les quittances

### 3.1 Architecture du système de quittances

```
┌──────────────────────────────────────────────────────────────────────┐
│                    GÉNÉRATION DES QUITTANCES                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PAIEMENT REÇU                                                       │
│       │                                                              │
│       ▼                                                              │
│  ┌────────────────────┐                                              │
│  │ WEBHOOK STRIPE     │  /app/webhooks/stripe/route.ts               │
│  │ checkout.session   │                                              │
│  │ .completed         │                                              │
│  └─────────┬──────────┘                                              │
│            │                                                         │
│            ▼                                                         │
│  ┌────────────────────┐                                              │
│  │ processReceipt     │  route.ts:34-182                             │
│  │ Generation()       │                                              │
│  └─────────┬──────────┘                                              │
│            │                                                         │
│            ▼                                                         │
│  ┌────────────────────┐                                              │
│  │ receipt-generator  │  /lib/services/receipt-generator.ts          │
│  │ .ts                │                                              │
│  │ • Charge données   │  Récupère: owner, tenant, property, lease    │
│  │ • Génère PDF       │  Via pdf-lib                                 │
│  │ • Upload Supabase  │  Stockage: quittances/{invoiceId}.pdf        │
│  └─────────┬──────────┘                                              │
│            │                                                         │
│            ▼                                                         │
│  ┌────────────────────┐                                              │
│  │ Table documents    │  type='quittance'                            │
│  │ + Storage          │  category='finance'                          │
│  └────────────────────┘                                              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Structure des données de la quittance

```typescript
// receipt-generator.ts
interface ReceiptData {
  // Propriétaire
  ownerName: string;
  ownerAddress: string;
  ownerSiret?: string;

  // Locataire
  tenantName: string;

  // Bien
  propertyAddress: string;

  // Période et montants
  period: string;           // Format "YYYY-MM"
  rentAmount: number;       // Loyer hors charges
  chargesAmount: number;    // Charges
  totalAmount: number;      // Total

  // Paiement
  paymentMethod: string;    // 'cb', 'virement', etc.
  paymentDate: string;      // Date du paiement

  // Références
  invoiceNumber?: string;
  paymentReference?: string;
}
```

### 3.3 Contenu du PDF généré

Le PDF de quittance contient :

| Section | Contenu |
|---------|---------|
| **En-tête** | "QUITTANCE DE LOYER" |
| **Bailleur** | Nom, adresse, SIRET (si professionnel) |
| **Locataire** | Nom complet |
| **Bien** | Adresse complète du bien loué |
| **Détail montants** | Tableau: Loyer + Charges = Total |
| **Attestation** | Texte légal de reconnaissance de paiement |
| **Signature** | Zone signature bailleur |
| **Pied de page** | Date de génération |

### 3.4 Téléchargement par le locataire

**Page des quittances** : `/tenant/receipts`

**API de téléchargement** (`/app/api/payments/[pid]/receipt/route.ts`) :

1. Vérifie les permissions (propriétaire, locataire, admin)
2. Cherche le PDF en cache dans le storage
3. Si non trouvé → génère le PDF
4. Stocke dans Supabase storage
5. Retourne URL signée (expiration 1h)

```typescript
// Exemple de réponse
{
  url: "https://xxx.supabase.co/storage/v1/object/sign/quittances/inv_xxx.pdf?token=xxx",
  expiresAt: "2024-01-15T12:00:00Z"
}
```

---

## 4. Architecture technique

### 4.1 Composants frontend

```
/features/billing/
├── components/
│   ├── payment-checkout.tsx      # Formulaire paiement Stripe
│   ├── payment-form.tsx          # Formulaire générique
│   ├── payment-history.tsx       # Historique des paiements
│   └── invoice-card.tsx          # Carte facture
├── hooks/
│   └── use-payment.ts            # Hook paiement
└── services/
    └── payment.service.ts        # Service API paiement
```

### 4.2 Endpoints API

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/payments/create-intent` | POST | Crée un PaymentIntent Stripe |
| `/api/payments/checkout` | POST | Crée une Checkout Session |
| `/api/payments/confirm` | POST | Confirme un paiement |
| `/api/payments/[pid]/receipt` | GET | Télécharge la quittance |
| `/api/payments/cash-receipt` | POST | Enregistre un paiement espèces |
| `/api/webhooks/stripe` | POST | Webhook Stripe |

### 4.3 Services backend

```
/lib/
├── stripe/
│   ├── stripe.service.ts         # Service principal Stripe
│   ├── sepa.service.ts           # Service SEPA
│   └── webhook.service.ts        # Gestion webhooks
├── services/
│   ├── receipt-generator.ts      # Génération PDF quittances
│   ├── payment.service.ts        # Logique métier paiements
│   └── credentials-service.ts    # Gestion clés API chiffrées
└── types/
    └── invoicing.ts              # Types factures/paiements
```

---

## 5. Tables de données

### 5.1 Schéma relationnel

```
PROFILES (utilisateurs)
    ├── owner_id
    ├── tenant_id
    └── provider_profile_id

PROPERTIES
    ├── owner_id → PROFILES
    └── [lease configurations]

LEASES
    ├── property_id → PROPERTIES
    ├── unit_id → UNITS
    └── Paramètres paiement:
       ├── charges_type (forfait/provisions)
       ├── mode_paiement (virement/prelevement/cheque/especes)
       └── jour_paiement (1-28)

INVOICES (Factures mensuelles locataires)
    ├── lease_id → LEASES
    ├── owner_id → PROFILES
    ├── tenant_id → PROFILES
    ├── stripe_payment_intent_id
    ├── stripe_session_id
    └── PAYMENTS (enregistrements paiements)
        └── CASH_RECEIPTS (reçus espèces signés)

PAYMENT_SHARES (Colocation)
    ├── lease_id → LEASES
    ├── roommate_id → ROOMMATES
    └── Répartition des parts
```

### 5.2 Table INVOICES

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  -- Période
  periode TEXT NOT NULL,                    -- Format "YYYY-MM"

  -- Montants
  montant_total DECIMAL(10, 2) NOT NULL,
  montant_loyer DECIMAL(10, 2) NOT NULL,
  montant_charges DECIMAL(10, 2) DEFAULT 0,

  -- Statut
  statut TEXT NOT NULL DEFAULT 'draft'
    CHECK (statut IN ('draft', 'sent', 'paid', 'late')),

  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,

  -- Rappels
  last_reminder_sent_at TIMESTAMPTZ,
  reminder_count INT DEFAULT 0,

  -- Paiement
  date_paiement DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lease_id, periode)
);
```

### 5.3 Table PAYMENTS

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),

  -- Montant
  montant DECIMAL(10, 2) NOT NULL,

  -- Méthode
  moyen TEXT NOT NULL CHECK (moyen IN (
    'cb', 'virement', 'prelevement', 'especes', 'cheque', 'autre'
  )),

  -- Référence externe
  provider_ref TEXT,              -- stripe_pi_xxx

  -- Statut
  statut TEXT NOT NULL DEFAULT 'pending'
    CHECK (statut IN ('pending', 'succeeded', 'failed')),

  date_paiement DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.4 Table CASH_RECEIPTS (Paiements espèces)

```sql
CREATE TABLE cash_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Liens
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  payment_id UUID REFERENCES payments(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  property_id UUID NOT NULL REFERENCES properties(id),

  -- Montant
  amount NUMERIC(10,2) NOT NULL,
  amount_words TEXT NOT NULL,         -- "Huit cents euros"

  -- Signatures numériques (base64 PNG)
  owner_signature TEXT NOT NULL,
  tenant_signature TEXT NOT NULL,
  owner_signed_at TIMESTAMPTZ NOT NULL,
  tenant_signed_at TIMESTAMPTZ NOT NULL,

  -- Géolocalisation
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  address_reverse TEXT,

  -- Intégrité
  document_hash TEXT NOT NULL,        -- SHA256
  signature_chain TEXT,

  -- PDF généré
  pdf_path TEXT,
  pdf_url TEXT,

  -- Référence unique
  receipt_number TEXT NOT NULL UNIQUE, -- "REC-2024-12-001"

  -- Statut
  status TEXT DEFAULT 'signed' CHECK (status IN (
    'draft', 'signed', 'sent', 'archived', 'disputed', 'cancelled'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Fonctionnalités existantes

### ✅ Paiements

| Fonctionnalité | Fichier | Status |
|----------------|---------|--------|
| Paiement CB via Stripe | `/api/payments/create-intent/route.ts` | ✅ |
| Checkout Session Stripe | `/api/payments/checkout/route.ts` | ✅ |
| Prélèvement SEPA | `/lib/stripe/sepa.service.ts` | ✅ |
| Paiement espèces avec signatures | `/api/payments/cash-receipt/route.ts` | ✅ |
| Confirmation de paiement | `/api/payments/confirm/route.ts` | ✅ |
| Webhook Stripe | `/app/webhooks/stripe/route.ts` | ✅ |

### ✅ Quittances

| Fonctionnalité | Fichier | Status |
|----------------|---------|--------|
| Génération PDF | `/lib/services/receipt-generator.ts` | ✅ |
| Téléchargement | `/api/payments/[pid]/receipt/route.ts` | ✅ |
| Cache PDF storage | Supabase Storage | ✅ |
| Montant en lettres | `amount_to_french_words()` SQL | ✅ |
| Numéro unique auto | `generate_receipt_number()` SQL | ✅ |

### ✅ Sécurité

| Fonctionnalité | Description | Status |
|----------------|-------------|--------|
| Signature webhook | HMAC-SHA256 | ✅ |
| Chiffrement clés API | AES-256-GCM | ✅ |
| Hash intégrité document | SHA256 | ✅ |
| Row Level Security | Supabase RLS | ✅ |

### ✅ Interface locataire

| Page | URL | Status |
|------|-----|--------|
| Dashboard financier | `/tenant/dashboard` | ✅ |
| Liste factures | `/tenant/payments` | ✅ |
| Page quittances | `/tenant/receipts` | ✅ |

---

## 7. Fonctionnalités manquantes

### 🔴 Priorité haute

| Fonctionnalité | Description | Impact |
|----------------|-------------|--------|
| **Envoi auto quittance email** | Après paiement réussi, envoyer la quittance par email | Expérience utilisateur |
| **Rappels automatiques** | Cron job pour envoyer rappels sur factures en retard | Recouvrement |
| **Prélèvement SEPA récurrent** | Job automatique pour déclencher les prélèvements | Automatisation |

### 🟡 Priorité moyenne

| Fonctionnalité | Description |
|----------------|-------------|
| **Historique paiements proprio** | Vue consolidée des paiements reçus côté propriétaire |
| **Export comptable** | Export FEC ou CSV pour la comptabilité |
| **Consolidation webhooks** | Un seul endpoint webhook au lieu de plusieurs |

### 🟢 Priorité basse

| Fonctionnalité | Description |
|----------------|-------------|
| **Paiement partiel** | Permettre au locataire de payer partiellement |
| **Échelonnement** | Plans de paiement échelonnés |
| **Multi-devises** | Support autres devises que EUR |

---

## 8. Configuration

### 8.1 Variables d'environnement

```env
# Stripe - Clés publiques
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Stripe - Clés secrètes (ou stockées chiffrées en DB)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 8.2 Configuration Stripe Dashboard

#### Webhooks à configurer

| URL | Événements |
|-----|------------|
| `https://votredomaine.com/api/webhooks/stripe` | Voir liste ci-dessous |

**Événements requis :**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### 8.3 Stockage des clés API

Les clés Stripe peuvent être :
1. **Variables d'environnement** (recommandé pour dev)
2. **Stockées chiffrées en DB** via Admin > Intégrations (recommandé pour prod)

```typescript
// Récupération automatique
const stripeService = new StripeService();
const stripe = await stripeService.getStripeClient(ownerId);
```

---

## 9. Recommandations

### 9.1 Améliorations prioritaires

#### 1. Envoi automatique de quittance par email

```typescript
// Dans processReceiptGeneration()
async function processReceiptGeneration(invoiceId: string) {
  // ... génération PDF existante ...

  // AJOUTER : Envoi email
  await sendReceiptEmail({
    to: tenant.email,
    subject: `Quittance de loyer - ${formatPeriod(invoice.periode)}`,
    attachments: [{ filename: 'quittance.pdf', content: pdfBuffer }]
  });
}
```

#### 2. Cron job pour rappels automatiques

```typescript
// /app/api/cron/payment-reminders/route.ts
export async function GET() {
  const overdueInvoices = await db.invoices.findMany({
    where: {
      statut: 'sent',
      date_echeance: { lt: new Date() },
      reminder_count: { lt: 3 }
    }
  });

  for (const invoice of overdueInvoices) {
    await sendPaymentReminder(invoice);
    await db.invoices.update({
      where: { id: invoice.id },
      data: {
        reminder_count: { increment: 1 },
        last_reminder_sent_at: new Date()
      }
    });
  }
}
```

### 9.2 Bonnes pratiques

1. **Idempotence des webhooks** : Vérifier si le paiement n'a pas déjà été traité
2. **Logs détaillés** : Logger chaque étape du flux de paiement
3. **Retry logic** : Implémenter des retries pour les appels Stripe
4. **Monitoring** : Alertes sur les échecs de paiement répétés

### 9.3 Sécurité

1. **Ne jamais logger les données de carte**
2. **Valider systématiquement les signatures webhook**
3. **Utiliser HTTPS uniquement**
4. **Limiter les tentatives de paiement (rate limiting)**

---

## Annexe : Flux complet détaillé

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUX COMPLET DE PAIEMENT                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. LOCATAIRE ACCÈDE À /tenant/payments                                │
│     └─ Voit liste des factures impayées                                │
│                                                                         │
│  2. CLIC SUR "PAYER" (facture spécifique)                              │
│     └─ Ouvre PaymentCheckout modal                                      │
│                                                                         │
│  3. CRÉATION PAYMENT INTENT                                            │
│     │  POST /api/payments/create-intent                                │
│     │  Body: { invoiceId, amount }                                     │
│     │                                                                   │
│     ├─ Vérifie que l'utilisateur est bien le locataire                 │
│     ├─ Appelle Stripe: stripe.paymentIntents.create()                  │
│     ├─ Insère dans DB: payments (statut: 'pending')                    │
│     └─ Retourne: { clientSecret }                                       │
│                                                                         │
│  4. AFFICHAGE FORMULAIRE STRIPE                                        │
│     └─ PaymentElement avec clientSecret                                │
│                                                                         │
│  5. LOCATAIRE ENTRE INFOS CARTE + VALIDE                               │
│     └─ stripe.confirmPayment(clientSecret)                             │
│                                                                         │
│  6. STRIPE TRAITE LE PAIEMENT                                          │
│     ├─ Succès → Redirige vers success_url                              │
│     └─ Échec → Affiche erreur                                          │
│                                                                         │
│  7. CONFIRMATION CÔTÉ SERVEUR                                          │
│     │  POST /api/payments/confirm                                       │
│     │                                                                   │
│     ├─ Vérifie avec Stripe: paymentIntent.status === 'succeeded'       │
│     ├─ Met à jour DB: payments.statut = 'succeeded'                    │
│     ├─ Met à jour DB: invoices.statut = 'paid'                         │
│     └─ Envoie email de confirmation                                    │
│                                                                         │
│  8. WEBHOOK STRIPE (parallèle/backup)                                  │
│     │  POST /api/webhooks/stripe                                        │
│     │                                                                   │
│     ├─ Vérifie signature HMAC-SHA256                                   │
│     ├─ Confirme le paiement (idempotent)                               │
│     │                                                                   │
│     │  GÉNÉRATION QUITTANCE:                                           │
│     ├─ Appelle processReceiptGeneration()                              │
│     │   ├─ Récupère données complètes                                  │
│     │   ├─ Génère PDF via pdf-lib                                      │
│     │   ├─ Upload vers Supabase Storage                                │
│     │   └─ Insère dans table documents                                 │
│     │                                                                   │
│     └─ Émet événement: Payment.Succeeded                               │
│                                                                         │
│  9. TÉLÉCHARGEMENT QUITTANCE                                           │
│     │  GET /api/payments/{paymentId}/receipt                           │
│     │                                                                   │
│     ├─ Vérifie permissions                                             │
│     ├─ Cherche PDF en cache ou génère                                  │
│     └─ Retourne URL signée (1h)                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

*Document généré le 2026-01-11 - TALOK v1.0*
