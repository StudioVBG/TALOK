# 📊 Tracking Plan - Talok SaaS

**Version**: 1.0  
**Date**: 6 Décembre 2025  
**Outil**: PostHog (EU Cloud ou Self-hosted)

---

## 📑 Table des matières

1. [Configuration](#configuration)
2. [Événements Acquisition](#événements-acquisition)
3. [Événements Propriétaire](#événements-propriétaire)
4. [Événements Locataire](#événements-locataire)
5. [Événements Conversion](#événements-conversion)
6. [Événements Engagement](#événements-engagement)
7. [Propriétés utilisateur](#propriétés-utilisateur)
8. [Funnels à configurer](#funnels-à-configurer)
9. [Dashboards recommandés](#dashboards-recommandés)

---

## Configuration

### Variables d'environnement

```bash
# .env.local
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com  # EU pour RGPD
```

### Intégration

```tsx
// app/layout.tsx
import { PostHogProvider } from "@/components/analytics/posthog-provider";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
```

---

## Événements Acquisition

### Inscription

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Signup.Started` | Clic sur "S'inscrire" | - |
| `Signup.Completed` | Compte créé | `method: email\|google\|magic_link` |
| `Email.Verified` | Email confirmé | - |

### Onboarding

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Onboarding.Started` | Début wizard onboarding | `role: owner\|tenant\|provider` |
| `Onboarding.StepCompleted` | Étape validée | `step: 1-5`, `step_name: string` |
| `Onboarding.Completed` | Onboarding terminé | `role`, `duration_seconds` |
| `Onboarding.Abandoned` | Abandon en cours | `step`, `step_name` |

---

## Événements Propriétaire

### Gestion des biens

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Property.Created` | Bien créé (brouillon) | `type: appartement\|maison\|...` |
| `Property.Published` | Bien publié | `property_id` |
| `Property.Updated` | Bien modifié | `property_id`, `fields_changed[]` |
| `Property.Deleted` | Bien supprimé | `property_id` |
| `Property.PhotoUploaded` | Photo ajoutée | `property_id`, `photo_count` |

### Gestion des baux

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Lease.Created` | Bail créé | `lease_type: nu\|meuble\|colocation\|saisonnier` |
| `Lease.Signed` | Bail signé | `lease_id`, `signers_count` |
| `Lease.Activated` | Bail actif | `lease_id` |
| `Lease.Terminated` | Bail résilié | `lease_id`, `reason` |

### Gestion des locataires

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Tenant.Invited` | Invitation envoyée | `property_id` |
| `Tenant.Accepted` | Invitation acceptée | `property_id` |
| `Tenant.Rejected` | Candidature refusée | `property_id`, `reason` |

### Facturation

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Invoice.Generated` | Facture créée | `amount`, `type: loyer\|charges\|...` |
| `Invoice.Sent` | Facture envoyée | `invoice_id`, `method: email\|sms` |
| `Payment.Received` | Paiement reçu | `amount`, `method: cb\|sepa\|virement\|cash` |
| `Payment.Late` | Retard de paiement | `invoice_id`, `days_late` |
| `Reminder.Sent` | Relance envoyée | `invoice_id`, `reminder_number` |

### Documents

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Document.Generated` | Document généré | `document_type: quittance\|bail\|edl\|...` |
| `Document.Downloaded` | Document téléchargé | `document_type` |
| `Document.Signed` | Document signé | `document_type`, `signature_provider` |

---

## Événements Locataire

### Candidature

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Application.Started` | Début candidature | `property_id` |
| `Application.DocumentUploaded` | Document fourni | `document_type` |
| `Application.Completed` | Dossier complet | `property_id`, `score` |

### Paiements

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Payment.Made` | Paiement effectué | `amount`, `method` |
| `Payment.Failed` | Paiement échoué | `amount`, `error_type` |
| `Payment.Scheduled` | Prélèvement programmé | `amount`, `date` |

### Tickets

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Ticket.Created` | Ticket créé | `priority: basse\|normale\|haute`, `category` |
| `Ticket.Resolved` | Ticket résolu | `ticket_id`, `resolution_time_hours` |

---

## Événements Conversion

### Pricing

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Plan.Viewed` | Page pricing vue | `plan: gratuit\|starter\|confort\|pro\|enterprise` |
| `Plan.Selected` | Plan choisi | `plan`, `billing: monthly\|yearly` |
| `Plan.Compared` | Comparaison plans | `plans_compared[]` |

### Checkout

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Checkout.Started` | Début paiement | `plan`, `amount` |
| `Checkout.Completed` | Paiement réussi | `plan`, `amount`, `billing` |
| `Checkout.Abandoned` | Abandon checkout | `plan`, `step`, `reason?` |

### Abonnement

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Subscription.Activated` | Abo activé | `plan` |
| `Subscription.Upgraded` | Upgrade plan | `from_plan`, `to_plan` |
| `Subscription.Downgraded` | Downgrade plan | `from_plan`, `to_plan` |
| `Subscription.Cancelled` | Annulation | `plan`, `reason`, `feedback?` |
| `Subscription.Renewed` | Renouvellement | `plan`, `amount` |

---

## Événements Engagement

### Navigation

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Feature.Used` | Feature utilisée | `feature: analytics\|documents\|tickets\|...` |
| `Search.Performed` | Recherche effectuée | `query_length`, `results_count` |
| `Filter.Applied` | Filtre appliqué | `filter_type`, `value` |

### Support

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Help.ArticleViewed` | Article d'aide vu | `article_id`, `article_title` |
| `Support.Contacted` | Contact support | `method: chat\|email\|phone` |
| `Feedback.Submitted` | Feedback envoyé | `rating`, `category` |

### Export

| Événement | Quand | Propriétés |
|-----------|-------|------------|
| `Export.Downloaded` | Export téléchargé | `format: pdf\|csv\|excel`, `data_type` |
| `Report.Generated` | Rapport généré | `report_type`, `period` |

---

## Propriétés utilisateur

Propriétés à enregistrer sur chaque utilisateur identifié :

| Propriété | Type | Description |
|-----------|------|-------------|
| `email` | string | Email de l'utilisateur |
| `role` | string | owner, tenant, provider, admin |
| `plan` | string | Plan actuel (gratuit, starter, etc.) |
| `properties_count` | number | Nombre de biens |
| `tenants_count` | number | Nombre de locataires |
| `created_at` | date | Date d'inscription |
| `last_login` | date | Dernière connexion |
| `company_name` | string? | Nom société (si applicable) |
| `region` | string | Région (FR métropole ou DROM) |

---

## Funnels à configurer

### 1. Funnel d'acquisition

```
Signup.Started → Signup.Completed → Email.Verified → Onboarding.Completed
```

**Objectif**: Taux de conversion > 60%

### 2. Funnel d'activation propriétaire

```
Onboarding.Completed → Property.Created → Property.Published → Tenant.Invited → Lease.Created
```

**Objectif**: Time-to-value < 48h

### 3. Funnel de conversion payant

```
Plan.Viewed → Plan.Selected → Checkout.Started → Checkout.Completed
```

**Objectif**: Taux de conversion > 5%

### 4. Funnel de rétention

```
Monthly Login → Invoice.Generated → Payment.Received → Feature.Used
```

**Objectif**: Rétention M1 > 80%

---

## Dashboards recommandés

### 1. Dashboard Acquisition

- Signups par jour/semaine
- Taux de conversion signup → verified
- Sources d'acquisition
- Temps moyen onboarding

### 2. Dashboard Activation

- Time-to-first-property
- Time-to-first-lease
- Taux d'activation par cohort

### 3. Dashboard Revenue

- MRR / ARR
- Répartition par plan
- Churn rate
- LTV / CAC

### 4. Dashboard Engagement

- DAU / WAU / MAU
- Features les plus utilisées
- Temps moyen par session
- Pages les plus visitées

### 5. Dashboard Support

- Tickets par catégorie
- Temps de résolution
- NPS / CSAT
- Articles help les plus lus

---

## Implémentation

### Exemple tracking propriétaire

```typescript
import { OwnerEvents } from "@/lib/analytics/posthog";

// Création d'un bien
async function createProperty(data: PropertyData) {
  const property = await api.createProperty(data);
  OwnerEvents.propertyCreated(property.type);
  return property;
}

// Réception paiement
async function onPaymentReceived(payment: Payment) {
  OwnerEvents.paymentReceived(payment.amount, payment.method);
}
```

### Exemple tracking conversion

```typescript
import { ConversionEvents } from "@/lib/analytics/posthog";

// Page pricing
function PricingPage() {
  useEffect(() => {
    ConversionEvents.planViewed("confort");
  }, []);
  
  const handleSelectPlan = (plan: string, billing: "monthly" | "yearly") => {
    ConversionEvents.planSelected(plan, billing);
    router.push(`/checkout?plan=${plan}&billing=${billing}`);
  };
}
```

---

## Checklist d'implémentation

- [ ] Configurer PostHog (EU cloud)
- [ ] Ajouter PostHogProvider dans layout.tsx
- [ ] Implémenter événements Acquisition
- [ ] Implémenter événements Propriétaire
- [ ] Implémenter événements Locataire
- [ ] Implémenter événements Conversion
- [ ] Configurer funnels dans PostHog
- [ ] Créer dashboards
- [ ] Vérifier conformité RGPD (cookie banner)
- [ ] Former l'équipe à l'utilisation

---

*Document à mettre à jour à chaque ajout de fonctionnalité*

