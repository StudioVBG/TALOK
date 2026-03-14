# Runbook production paiements

## Endpoint webhook officiel

Utiliser un seul endpoint Stripe officiel :

- `POST /api/webhooks/stripe`

Les alias historiques `app/api/billing/webhook`, `app/api/webhooks/payments`, `app/api/subscriptions/webhook` et `app/api/v1/payments/webhook` doivent tous pointer vers cette logique canonique. Ne pas configurer plusieurs endpoints Stripe distincts pour la meme application.

## Variables obligatoires

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SEPA_CREDITOR_NAME`
- `SEPA_CREDITOR_IBAN`
- `SEPA_CREDITOR_BIC` optionnelle
- `CRON_SECRET`

## Checklist go-live

1. Lancer `GET /api/admin/payments/production-readiness` avec un compte admin.
2. Corriger les anomalies critiques avant ouverture :
   - `active_leases_without_initial_invoice`
   - `subscriptions_missing_stripe_subscription_id`
   - `succeeded_payments_without_transfer`
   - `sepa_schedules_without_mandate`
3. Vérifier que Stripe envoie bien les événements :
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.paid`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `account.updated`
   - `transfer.created`
   - `payout.created`
   - `payout.paid`
   - `payout.failed`
4. Vérifier que le scheduler SEPA exécute bien :
   - `sepa-prenotification`
   - `sepa-auto-collect`
5. Vérifier en back-office qu'un paiement locataire produit :
   - une ligne `payments`
   - un statut `invoices` cohérent
   - un `stripe_transfers`
   - puis un `stripe_payouts` quand Stripe vire la banque

## Réparations sûres

`POST /api/admin/payments/production-readiness`

Actions supportées :

- `sync_initial_invoice_markers`
- `sync_sepa_payment_method_links`

## Incidents fréquents

### Carte refusée

- Vérifier le message Stripe coté webhook et `webhook_logs`
- Vérifier que le client utilise une vraie carte live ou une carte de test valide en environnement test

### Bail actif sans facture initiale

- Vérifier `GET /api/admin/payments/production-readiness`
- Vérifier qu'aucun chemin legacy n'active le bail directement
- Vérifier les marqueurs `type` et `metadata.type` sur la facture initiale

### Mandat SEPA non créé

- Vérifier la présence de `SEPA_CREDITOR_NAME` et `SEPA_CREDITOR_IBAN`
- Vérifier que le locataire a un bail courant via `/api/tenant/lease`
- Vérifier `sepa_mandates`, `tenant_payment_methods`, `payment_schedules`

### Payout manquant

- Vérifier que le transfert Connect existe dans `stripe_transfers`
- Vérifier que l'account Connect est `charges_enabled` et `payouts_enabled`
- Vérifier les événements `payout.*` et la table `stripe_payouts`
