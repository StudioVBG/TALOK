# AUDIT COMPLET : Loyers Impayés, Recouvrement & Notifications Push

**Date** : 3 mars 2026
**Version** : SOTA 2026
**Statut** : Analyse exhaustive du codebase TALOK

---

## Table des matières

1. [Synthèse exécutive](#1-synthèse-exécutive)
2. [Comment savoir qu'un loyer est impayé ?](#2-comment-savoir-quun-loyer-est-impayé)
3. [Analyse des paiements réalisés](#3-analyse-des-paiements-réalisés)
4. [Système de relances (recouvrement)](#4-système-de-relances-recouvrement)
5. [Notifications push](#5-notifications-push)
6. [Problèmes identifiés et lacunes](#6-problèmes-identifiés-et-lacunes)
7. [Recommandations](#7-recommandations)

---

## 1. Synthèse exécutive

### Constats principaux

| Domaine | Statut | Commentaire |
|---------|--------|-------------|
| Détection des impayés | Implémenté | Basée sur le `statut` de la facture (`sent`, `late`) et le calcul de `days_late` |
| Affichage "impayé" au locataire | Partiellement visible | Le mot "impayé" n'est **jamais affiché explicitement** au locataire. Il voit "À régler" |
| Affichage "impayé" au propriétaire | Implémenté | Le propriétaire voit "En retard", montants impayés, et alertes |
| Système de relances | Triple implémentation | 3 systèmes parallèles et non coordonnés (risque de doublons) |
| Notifications push | Web Push uniquement | Pas de FCM/APNs natif. Push Web via VAPID |
| Recouvrement contentieux | Non implémenté | Aucune procédure judiciaire automatisée, seulement des emails |
| Tableau de bord impayés | Fragmenté | Données dispersées entre plusieurs pages/services |

---

## 2. Comment savoir qu'un loyer est impayé ?

### 2.1 Cycle de vie d'une facture (statut)

Le statut d'une facture dans la table `invoices` suit ce cycle :

```
draft → sent → pending → late → paid
                  │         │
                  │         └─ Mis à jour automatiquement quand days_late ≥ 1 à 15 (selon le système)
                  └─ Facture envoyée au locataire, en attente de paiement
```

**Statuts possibles** : `draft`, `sent`, `pending`, `late`, `paid`, `overdue`, `succeeded`

**Fichier source** : `supabase/migrations/20240101000000_initial_schema.sql`

### 2.2 Logique de détection des impayés

La détection repose sur **3 critères** :

1. **Le statut n'est pas `paid` ni `succeeded`**
2. **La date d'échéance (`due_date`) est dépassée**
3. **Le nombre de jours de retard (`days_late`) dépasse un seuil minimum (5 jours)**

**Fichier principal** : `lib/services/payment-reminder.service.ts:122-183`

```typescript
// Extrait de detectLateInvoices()
for (const inv of invoices) {
  if (inv.statut === "paid" || inv.statut === "succeeded") continue;
  if (!inv.due_date) continue;

  const dueDate = new Date(inv.due_date);
  const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLate < 5) continue; // Seuil minimum : 5 jours
  // ...
}
```

### 2.3 Classification des niveaux de retard

| Niveau | Jours de retard | Priorité |
|--------|-----------------|----------|
| Amiable | 5-14 jours | Medium |
| Formelle | 15-29 jours | High |
| Mise en demeure | 30+ jours | Critical |

**Fichier** : `lib/services/payment-reminder.service.ts:38-42`

### 2.4 Requêtes SQL pour identifier les impayés

```sql
-- Index optimisé existant
CREATE INDEX idx_invoices_unpaid ON invoices(owner_id, statut)
WHERE statut IN ('sent', 'late');

-- Requête RPC du tableau de bord
SELECT
  COALESCE(SUM(montant_total) FILTER (WHERE statut IN ('sent', 'late')), 0) AS unpaid_amount,
  COUNT(*) FILTER (WHERE statut IN ('sent', 'late')) AS unpaid_count
FROM invoices WHERE owner_id = ?;
```

**Fichiers** :
- `supabase/migrations/20241201000001_performance_indexes.sql:94-182`
- `supabase/migrations/20251119080000_tenant_dashboard_rpc.sql:65-66`

### 2.5 Ce que voit le locataire

**Fichier** : `app/tenant/payments/TenantPaymentsClient.tsx`

Le locataire voit :
- **"Total à régulariser"** : montant total des factures non payées (ligne 228)
- **"Score de ponctualité"** : pourcentage calculé `(totalCount - lateCount) / totalCount * 100` (ligne 106)
- **StatusBadge** : affiche "Payé" (vert) ou **"À régler"** (rouge) — **jamais "Impayé"** (ligne 356-358)
- **Barre colorée** : vert si payé, rouge si non payé (ligne 328-330)

**PROBLEME IDENTIFIE** : Le statut `late` n'est pas différencié de `sent` dans l'interface locataire. Un loyer en retard de 30 jours affiche le même "À régler" qu'un loyer de 2 jours. Le locataire n'a **aucune indication visuelle de l'urgence**.

### 2.6 Ce que voit le propriétaire

**Fichier** : `app/owner/money/MoneyClient.tsx`

Le propriétaire voit :
- **Badge "En retard"** pour les factures avec `statut === "late"` (ligne 206)
- **Graphique à barres** : Collecté (vert), En attente (jaune), En retard (rouge) (lignes 477-512)
- **Bouton "Relancer"** : pour envoyer une relance manuellement
- **Bouton "Marquer payé"** : pour enregistrer un paiement manuel

**Fichier** : `app/owner/leases/[id]/tabs/LeasePaymentsTab.tsx`

- **Alerte destructive** : "X facture(s) en retard — Y€ impayés" (lignes 144-153)
- **Badges de statut** : Payée (vert), Envoyée (bleu), En retard (rouge), Brouillon (gris)

---

## 3. Analyse des paiements réalisés

### 3.1 Table `payments`

**Fichier** : `features/billing/services/payments.service.ts`

```typescript
// Statuts de paiement
type PaymentStatus = 'pending' | 'succeeded' | 'failed';

// Moyens de paiement
type PaymentMethod = 'cb' | 'virement' | 'prelevement' | 'cheque' | 'especes';
```

### 3.2 Flux de paiement

```
Locataire clique "Payer"
  → PaymentCheckout component ouvert
  → Paiement Stripe (CB) ou enregistrement manuel
  → PaymentsService.createPayment() → statut = "pending"
  → Webhook Stripe ou action manuelle
  → PaymentsService.markPaymentAsSucceeded()
  → Invoice.statut mis à jour vers "paid"
```

### 3.3 Calcul du montant total payé par facture

```typescript
// features/billing/services/payments.service.ts:110-120
async getTotalPaidForInvoice(invoiceId: string): Promise<number> {
  const { data } = await this.supabase
    .from("payments")
    .select("montant")
    .eq("invoice_id", invoiceId)
    .eq("statut", "succeeded");
  return dataArray.reduce((sum, p) => sum + Number(p.montant), 0);
}
```

### 3.4 PROBLEME : Aucun rapprochement automatique paiement/facture

Le système ne vérifie **jamais automatiquement** si le montant payé correspond au montant dû. Il n'y a pas de logique de rapprochement qui dirait :

- "Ce paiement de 800€ couvre la facture de 800€ → marquer comme payée"
- "Ce paiement partiel de 400€ sur 800€ → solde restant 400€"

Le passage de `sent`/`late` vers `paid` est soit :
1. **Manuel** : le propriétaire clique "Marquer payé"
2. **Via Stripe webhook** : si le paiement Stripe réussit
3. **Jamais automatique** pour les virements bancaires

---

## 4. Système de relances (recouvrement)

### 4.1 PROBLEME CRITIQUE : Triple implémentation

Il existe **3 systèmes de relance indépendants et non coordonnés** :

| Système | Fichier | Déclencheur | Base de calcul |
|---------|---------|-------------|----------------|
| Cron payment-reminders | `app/api/cron/payment-reminders/route.ts` | Cron quotidien | `due_date` de la facture |
| Cron rent-reminders | `app/api/cron/rent-reminders/route.ts` | Cron quotidien | `created_at` de la facture |
| Edge Function | `supabase/functions/payment-reminders/index.ts` | Cron Supabase | `created_at` de la facture |

De plus, il existe un service autonome : `lib/automations/rent-reminders.ts`

**RISQUE** : Un locataire peut recevoir **jusqu'à 3 relances le même jour** provenant de 3 systèmes différents.

### 4.2 Système 1 : Cron payment-reminders

**Fichier** : `app/api/cron/payment-reminders/route.ts`

**Calendrier de relance** :
| Étape | Délai | Type d'événement | Urgence |
|-------|-------|-------------------|---------|
| J-3 | 3 jours avant échéance | `Payment.ReminderFriendly` | Low |
| J-1 | 1 jour avant échéance | `Payment.ReminderUrgent` | Medium |
| J+1 | 1 jour après échéance | `Payment.Late` | High |
| J+7 | 7 jours après échéance | `Payment.LateFormal` | Critical |

**Particularités** :
- Utilise `due_date` comme référence
- Écrit dans la table `outbox` (pattern événementiel)
- Notifie le propriétaire uniquement pour J+1 et J+7 (`Owner.TenantPaymentLate`)
- Met à jour `reminder_count` et `last_reminder_sent_at`
- Marque la facture `late` à J+1
- Anti-doublon basé sur `reminder_count` (<1, <2, <3, <4)

### 4.3 Système 2 : Cron rent-reminders

**Fichier** : `app/api/cron/rent-reminders/route.ts`

**Calendrier de relance** :
| Étape | Délai | Niveau |
|-------|-------|--------|
| J+5 à J+9 | 5-9 jours après création | Rappel de paiement |
| J+10 à J+14 | 10-14 jours | Second rappel |
| J+15 à J+29 | 15-29 jours | Mise en demeure |
| J+30+ | 30+ jours | Dernier avertissement |

**Particularités** :
- Utilise `created_at` comme référence (pas `due_date`)
- Écrit directement dans la table `notifications` (pas `outbox`)
- Crée une notification locataire ET propriétaire
- Marque la facture `late` à J+15 (pas J+1)
- Log dans `audit_log` pour traçabilité
- **AUCUN anti-doublon** — relance tous les jours tant que la facture est `sent`

### 4.4 Système 3 : Edge Function Supabase

**Fichier** : `supabase/functions/payment-reminders/index.ts`

**Seuils de relance** :
| Seuil | Niveau | Sujet |
|-------|--------|-------|
| 3 jours | friendly | "Rappel paiement loyer" |
| 7 jours | reminder | "Rappel : Loyer en attente" |
| 14 jours | urgent | "Impayé : Action requise" |
| 30 jours | final | "URGENT : Impayé de loyer" |

**Particularités** :
- Utilise `created_at` comme référence
- Minimum 3 jours entre relances (anti-spam)
- Écrit dans `outbox`
- Notifie le propriétaire à partir de 14 jours
- Marque `late` après 7 jours
- Met à jour `reminder_count` et `last_reminder_at`
- Log dans `audit_log`

### 4.5 Service de relance manuelle

**Fichier** : `app/api/invoices/reminders/route.ts`

**API REST** :
- `GET /api/invoices/reminders` : Liste les factures en retard avec le niveau de relance
- `POST /api/invoices/reminders` : Envoie une relance manuelle pour une facture

**Retour du GET** :
```json
{
  "late_invoices": [...],
  "total": 5,
  "summary": {
    "amiable": 3,
    "formelle": 1,
    "mise_en_demeure": 1,
    "total_amount": 4200
  }
}
```

### 4.6 Templates d'emails de relance

**Fichier** : `lib/services/payment-reminder.service.ts:47-116`

3 niveaux de templates légalement conformes :

1. **Amiable** : "Rappel : Loyer en attente" — ton poli, "Il peut s'agir d'un oubli"
2. **Formelle** : "Relance : Impayé de loyer" — mention du retard en jours, délai de 8 jours
3. **Mise en demeure** : "MISE EN DEMEURE" — Référence article 24, loi n°89-462 du 6 juillet 1989, menace de saisine de la commission de surendettement

### 4.7 Flux complet du recouvrement

```
Facture créée (statut = "draft")
    │
    ▼
Facture envoyée (statut = "sent")
    │
    ├── J-3 : Rappel amical (pré-échéance) [Système 1 uniquement]
    ├── J-1 : Rappel urgent [Système 1 uniquement]
    │
    ▼ Échéance dépassée
    │
    ├── J+1 : Notification retard [Système 1] → statut = "late"
    ├── J+3 : Rappel friendly [Système 3]
    ├── J+5 : Premier rappel [Système 2]
    ├── J+7 : Relance formelle [Systèmes 1 + 3]
    ├── J+10 : Second rappel [Système 2]
    ├── J+14 : Rappel urgent + alerte propriétaire [Système 3]
    ├── J+15 : Mise en demeure [Système 2] → statut = "late" (si pas déjà)
    ├── J+30 : Dernier avertissement [Systèmes 2 + 3 + Service Manuel]
    │
    ▼
    FIN — Aucune procédure contentieuse automatisée
```

### 4.8 PROBLEMES DU SYSTEME DE RECOUVREMENT

1. **Triple exécution** : 3 crons/edge functions peuvent tourner en parallèle
2. **Base de calcul incohérente** : Système 1 utilise `due_date`, Systèmes 2 et 3 utilisent `created_at`
3. **Seuils incohérents** : Le passage à `late` se fait à J+1 (S1), J+7 (S3), ou J+15 (S2)
4. **Pas de déduplication** : Le Système 2 n'a aucun mécanisme anti-doublon
5. **Pas de contentieux** : Aucune procédure automatisée après la mise en demeure
6. **Pas de suivi courrier recommandé** : La table `invoice_reminders` existe avec `method = 'courrier'` mais n'est jamais utilisée
7. **Pas d'échéancier** : Le template de mise en demeure mentionne "convenir d'un échéancier" mais aucune fonctionnalité d'échéancier n'existe

---

## 5. Notifications Push

### 5.1 Architecture des notifications

TALOK dispose de **4 canaux de notification** :

| Canal | Technologie | Statut | Fichier principal |
|-------|------------|--------|-------------------|
| In-app | Supabase Realtime + table `notifications` | Fonctionnel | `lib/services/notification-service.ts` |
| Email | Resend API | Fonctionnel | `lib/services/email-service.ts` |
| SMS | Twilio | Configuré, pas systématiquement utilisé | `lib/services/sms.service.ts` |
| Push Web | Web Push API + VAPID | Implémenté | `lib/hooks/use-push-notifications.ts` |

### 5.2 Notifications In-App

**Fichier** : `lib/services/notification-service.ts`

**Types de notifications** :
```
payment_received, payment_due, payment_late, lease_signed,
lease_ending, document_uploaded, document_signed, ticket_created,
ticket_updated, ticket_resolved, message_received,
maintenance_scheduled, rent_revision, system, custom
```

**Configuration par défaut pour les impayés** :
| Type | Priorité | Canaux |
|------|----------|--------|
| `payment_due` | high | in_app, email, push |
| `payment_late` | urgent | in_app, email, push, sms |
| `payment_received` | normal | in_app, email |

**Fonctions prédéfinies** :
- `notifyPaymentLate(tenantId, amount, daysLate, invoiceId)` — envoie sur tous les canaux
- `notifyPaymentReceived(ownerId, tenantName, amount, period, invoiceId)`

### 5.3 Push Web (VAPID)

**Fichier** : `lib/hooks/use-push-notifications.ts`

**Fonctionnement** :
1. Le hook `usePushNotifications()` vérifie le support du navigateur
2. `requestPermission()` demande l'autorisation au locataire
3. L'abonnement est stocké dans la table `push_subscriptions`
4. Les notifications push sont envoyées via l'API `web-push` (Node.js)

**Limitations** :
- **Pas de FCM** (Firebase Cloud Messaging) — pas de push natif Android
- **Pas d'APNs** (Apple Push Notification service) — pas de push natif iOS
- Fonctionne uniquement quand le navigateur est ouvert (PWA en arrière-plan)
- Auto-fermeture après 5 secondes

**Variables d'environnement requises** :
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:support@talok.fr
```

### 5.4 Notifications en temps réel

**Fichier** : `lib/hooks/use-realtime-tenant.ts` (utilisé dans `TenantPaymentsClient.tsx`)

- Utilise Supabase Realtime (WebSocket)
- Écoute les changements sur la table `invoices` en temps réel
- Met à jour `unpaidAmount` et `hasRecentInvoice` automatiquement
- Affiche un badge "Live" vert quand la connexion est active

### 5.5 Préférences de notification

**Table** : `notification_preferences`

Chaque utilisateur peut configurer :
- Activation/désactivation par canal (in_app, email, sms, push)
- Heures calmes (quiet hours)
- Mode digest (instant, quotidien, hebdomadaire)
- Préférences par catégorie
- Templates désactivés

### 5.6 Service d'alertes intelligentes

**Fichier** : `lib/services/alerts-service.ts`

Système d'alertes proactives pour le propriétaire :

| Type d'alerte | Seuils | Priorité |
|---------------|--------|----------|
| Loyer impayé | 5j → medium, 15j → high, 30j → critical | Progressive |
| Fin de bail | 90j → low, 60j → medium, 30j → high | Progressive |
| DPE expirant | 60 jours avant | Variable |
| Révision loyer IRL | 30 jours avant | Medium |
| Assurance expirant | 30 jours avant | Variable |

**Appel** : `getAllAlerts(ownerId)` retourne toutes les alertes triées par priorité.

---

## 6. Problèmes identifiés et lacunes

### 6.1 Problèmes critiques

| # | Problème | Impact | Fichiers concernés |
|---|----------|--------|--------------------|
| 1 | **Triple système de relance** | Locataires spammés, confusion | 3 fichiers cron + 1 edge function |
| 2 | **Base de calcul incohérente** | Dates de retard différentes selon le système | `due_date` vs `created_at` |
| 3 | **Pas de déduplication** dans rent-reminders | Relance quotidienne sans contrôle | `app/api/cron/rent-reminders/route.ts` |
| 4 | **Le locataire ne voit jamais "Impayé"** | Minimise l'urgence de la situation | `TenantPaymentsClient.tsx:356-358` |
| 5 | **Pas de rapprochement automatique paiement/facture** | Virements non automatiquement réconciliés | `payments.service.ts` |

### 6.2 Problèmes importants

| # | Problème | Impact |
|---|----------|--------|
| 6 | Pas de procédure contentieuse après mise en demeure | Le recouvrement s'arrête à l'email |
| 7 | Pas de génération de courrier recommandé | La table `invoice_reminders.method = 'courrier'` existe mais n'est pas utilisée |
| 8 | Pas de fonctionnalité d'échéancier de paiement | Mentionné dans la mise en demeure mais non implémenté |
| 9 | Pas de FCM/APNs pour les apps mobiles | Les notifications push ne fonctionnent pas sur les apps Capacitor |
| 10 | SMS désactivé par défaut | `enableSms: false` dans la config par défaut |

### 6.3 Lacunes fonctionnelles

| # | Fonctionnalité manquante |
|---|--------------------------|
| 11 | Tableau de bord unifié des impayés (vue consolidée propriétaire) |
| 12 | Historique des relances par locataire (timeline) |
| 13 | Calcul des pénalités de retard (intérêts légaux) |
| 14 | Intégration avec les services de recouvrement externe |
| 15 | Génération automatique de lettres de mise en demeure PDF |
| 16 | Suivi du taux de recouvrement (KPI) |
| 17 | Paiement partiel / échéancier |
| 18 | Rappel avant échéance pour le locataire dans l'app (pas seulement email) |

---

## 7. Recommandations

### 7.1 Priorité 1 — Unifier le système de relances

**Action** : Fusionner les 3 systèmes en un seul système canonique.

- Utiliser `due_date` comme seule base de calcul
- Centraliser dans `lib/automations/rent-reminders.ts`
- Supprimer `app/api/cron/rent-reminders/route.ts` et l'edge function
- Conserver uniquement `app/api/cron/payment-reminders/route.ts` comme point d'entrée cron

### 7.2 Priorité 2 — Afficher clairement l'état "Impayé" au locataire

**Action** : Modifier `TenantPaymentsClient.tsx` pour différencier :
- "À régler" (statut `sent`, pas encore en retard)
- "En retard" (statut `late`, avec le nombre de jours)
- "Impayé urgent" (30+ jours, avec alerte visuelle forte)

### 7.3 Priorité 3 — Implémenter le rapprochement bancaire automatique

**Action** : Connecter le module `features/finance/` (connexions bancaires) aux factures pour détecter automatiquement les paiements par virement.

### 7.4 Priorité 4 — Activer les notifications push mobiles

**Action** : Intégrer FCM pour Android et APNs pour iOS via les plugins Capacitor :
- `@capacitor/push-notifications`
- Configuration Firebase dans `android/app/google-services.json`
- Configuration APNs dans le projet Xcode

### 7.5 Priorité 5 — Compléter la chaîne de recouvrement

**Action** : Après la mise en demeure (J+30), ajouter :
- J+60 : Génération automatique de la lettre de mise en demeure PDF (AR)
- J+90 : Proposition d'échéancier de paiement
- J+120 : Orientation vers un service de recouvrement partenaire
- Calcul automatique des pénalités de retard au taux légal

---

## 8. Audit connexion Front-End / Back-End

### 8.1 Matrice de connexion — Locataire

| Composant | Connecté ? | Preuve |
|-----------|-----------|--------|
| Affichage factures | **OUI** | `getTenantInvoices()` → vraie requête Supabase |
| Bouton "Payer" | **OUI** | `PaymentCheckout` → Stripe Elements, `POST /api/payments/create-intent` |
| Quick Pay (carte sauvée) | **OUI** | `SavedMethodQuickPay` → Stripe `confirmPayment()` |
| Temps réel WebSocket | **OUI** | `useTenantRealtime()` → 7 channels Postgres Changes |
| Montant impayé live | **OUI** | `realtime.unpaidAmount` dans carte "Total à régulariser" |
| Score ponctualité | **OUI** | Calculé : `(total - late) / total * 100` |
| Alerte impayé dashboard | **OUI** | Bloc rouge "Impayé en cours" + CTA "Régulariser" |
| Cloche notifications | **OUI** | `NotificationBell` → `GET /api/notifications` polling 30s |
| Statut "Impayé" visible | **NON** | Affiche "À régler" pour TOUT (`TenantPaymentsClient.tsx:356`) |
| Jours de retard affichés | **NON** | Jamais montré au locataire |
| Push Web navigateur | **NON** | `PushNotificationPrompt` absent du layout locataire |
| Historique relances | **NON** | Aucun historique des relances reçues |

### 8.2 Matrice de connexion — Propriétaire

| Composant | Connecté ? | Preuve |
|-----------|-----------|--------|
| Affichage factures | **OUI** | `getOwnerInvoices()` → vraie requête Supabase |
| Badge "En retard" | **OUI** | `statut === "late"` correctement affiché |
| Graphique Collecté/Attente/Retard | **OUI** | Données réelles agrégées par mois |
| Dashboard alertes impayés | **OUI** | "X loyer(s) en retard" + lien Money |
| Cloche notifications | **OUI** | `NotificationBell` dans header |
| Push Web navigateur | **OUI** | `PushNotificationPrompt` dans `DashboardClient.tsx:406` |
| Bouton "Relancer" | **PARTIEL** | Insère en DB, **email = TODO** (`actions.ts:124`) |
| Bouton "Marquer payé" | **OUI** | `ManualPaymentDialog` → `invoices.statut = 'paid'` |
| API `/api/invoices/reminders` | **JAMAIS APPELÉE** | Existe mais aucun composant UI ne l'invoque |

### 8.3 Matrice de connexion — Automatisations

| Système | Planifié ? | Exécuté ? | Raison |
|---------|-----------|-----------|--------|
| `cron/payment-reminders` | **NON** | **JAMAIS** | Pas de `vercel.json` |
| `cron/rent-reminders` | **NON** | **JAMAIS** | Pas de `vercel.json` |
| `cron/generate-invoices` | **NON** | **JAMAIS** | Pas de `vercel.json` |
| `cron/process-outbox` | **NON** | **JAMAIS** | Pas de `vercel.json` |
| Edge Function `payment-reminders` | **NON** | **JAMAIS** | Pas de schedule Supabase, non déployé |
| Edge Function `process-outbox` | **NON** | **JAMAIS** | Pas de schedule Supabase, non déployé |
| Edge Function `monthly-invoicing` | **NON** | **JAMAIS** | Non déployé |

### 8.4 Matrice de connexion — Services de notification

| Service | Code réel ? | API connectée ? | Utilisé ? |
|---------|------------|----------------|-----------|
| Email (Resend) | **OUI** | `https://api.resend.com/emails` | **NON** — jamais appelé depuis les relances |
| SMS (Twilio) | **OUI** | Twilio API réelle | **NON** — `enableSms: false` |
| Push Web (VAPID) | **OUI** | `web-push` library | **PARTIEL** — browser-only, serveur = TODO |
| In-app | **OUI** | Table `notifications` | **OUI** — si quelqu'un insère dedans |
| `notification-service.ts` | **OUI** | DB uniquement | **JAMAIS APPELÉ** — fonctions exportées mais jamais importées |

### 8.5 Schéma de la chaîne cassée

```
CRON payment-reminders ──→ PAS DE VERCEL.JSON ──→ ❌ Jamais exécuté
                                                        │
                                                        ▼ (si exécuté manuellement)
                                                  Écrit dans table outbox
                                                        │
                                                        ▼
process-outbox ─────────→ PAS DE SCHEDULE ───→ ❌ Jamais exécuté
                                                        │
                                                        ▼ (si exécuté manuellement)
                                          sendPaymentReminderEmail() → Resend API ✅
                                          sendNotification() → table notifications ✅
                                          Push → console.log("TODO") ❌
                                                        │
                                                        ▼
                                          NotificationBell → polling /api/notifications ✅

═══════════════════════════════════════════════════════════════════
Bouton "Relancer" (propriétaire)
       │
       ▼
sendPaymentReminder() → INSERT invoice_reminders ✅
       │
       ▼
Email au locataire → ❌ TODO (commentaire dans le code ligne 124)
```

### 8.6 Analyse cause racine

**Pourquoi rien ne fonctionne malgré le code complet :**

1. **Pas de scheduler** : `vercel.json` n'existe pas → aucun cron Vercel
2. **Edge functions non déployées** : Instructions "À déployer avec supabase functions deploy" jamais exécutées
3. **Configuration manquante** : `CRON_SECRET` absent de `.env.example`, `EMAIL_SERVICE_URL` non défini
4. **Architecture fragmentée** : 3 systèmes de relance indépendants, aucun branché
5. **Server action incomplète** : Le bouton "Relancer" appelle une server action avec un TODO au lieu de l'API route complète
6. **Push serveur = TODO** : Le process-outbox a `console.log("Push notification à envoyer...")` au lieu du code réel

### 8.7 Verdict

| Couche | Note | Commentaire |
|--------|------|-------------|
| UI/UX (composants) | A | Design SOTA, bonne ergonomie |
| Requêtes de lecture Supabase | A | Données réelles, temps réel fonctionnel |
| Paiement Stripe | A | Intégration complète, quick-pay, cartes sauvées |
| Notifications in-app (cloche) | B | Fonctionne mais dépend de données insérées manuellement |
| Relance automatique | F | Code mort — aucun scheduler configuré |
| Envoi d'emails de relance | F | Code complet mais jamais déclenché |
| Push notifications serveur | F | Infrastructure VAPID prête, envoi = TODO |
| SMS | F | Twilio intégré mais désactivé |
| Détection impayé côté locataire | D | Le locataire ne voit jamais "Impayé", seulement "À régler" |

---

## Annexe : Cartographie des fichiers

### Fichiers de détection des impayés
```
lib/services/payment-reminder.service.ts       — Service principal de détection
lib/services/alerts-service.ts                 — Alertes intelligentes pour propriétaire
lib/automations/rent-reminders.ts              — Automation des relances
```

### Fichiers de relance (cron/edge)
```
app/api/cron/payment-reminders/route.ts        — Cron J-3/J-1/J+1/J+7
app/api/cron/rent-reminders/route.ts           — Cron J+5/J+10/J+15/J+30
supabase/functions/payment-reminders/index.ts  — Edge Function J+3/J+7/J+14/J+30
app/api/invoices/reminders/route.ts            — API REST relance manuelle
```

### Fichiers de paiement
```
features/billing/services/payments.service.ts  — CRUD paiements
features/billing/components/payment-checkout.tsx — UI de paiement Stripe
app/tenant/payments/TenantPaymentsClient.tsx   — Dashboard locataire
app/owner/money/MoneyClient.tsx                — Dashboard propriétaire
```

### Fichiers de notification
```
lib/services/notification-service.ts           — Service de notifications multi-canal
lib/hooks/use-push-notifications.ts            — Hook push Web (VAPID)
lib/hooks/use-notifications.ts                 — Hook temps réel Supabase
lib/services/email-service.ts                  — Service email (Resend)
lib/services/sms.service.ts                    — Service SMS (Twilio)
components/notifications/notification-center.tsx — Centre de notifications UI
components/notifications/push-notification-prompt.tsx — Prompt permission push
```

### Fichiers de base de données
```
supabase/migrations/20240101000000_initial_schema.sql         — Schéma initial (invoices, payments)
supabase/migrations/20241201000001_performance_indexes.sql     — Index optimisés impayés
supabase/migrations/20260219000000_missing_tables_and_rag.sql  — Table invoice_reminders
supabase/migrations/20251205100000_notifications_system.sql    — Système de notifications
supabase/migrations/20251205600000_notifications_centralized.sql — Préférences centralisées
```
