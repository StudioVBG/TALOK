# 🏦 Guide d'Installation : Open Banking Gratuit (GoCardless)

Ce guide vous permet d'activer la connexion bancaire gratuite pour automatiser le rapprochement des loyers.

## 1. Base de données (Supabase)

Appliquez la migration SQL qui crée les tables `bank_connections` et `bank_transactions`.

```bash
supabase migration up
# Ou copiez le contenu de supabase/migrations/20250220000000_add_open_banking_tables.sql dans l'éditeur SQL Supabase
```

## 2. Obtenir les clés API GoCardless (Gratuit)

1. Créez un compte développeur sur [GoCardless Bank Account Data](https://bankaccountdata.gocardless.com/overview/).
2. Allez dans **Developers > User Secrets**.
3. Créez une nouvelle paire de clés `Secret ID` et `Secret Key`.

## 3. Configurer l'Edge Function

Cette fonction sert de pont sécurisé entre votre frontend et GoCardless pour ne jamais exposer vos clés secrètes.

1. Ajoutez les clés dans votre fichier `.env.local` ou directement dans Supabase Vault :

```bash
# Dans Supabase Dashboard > Settings > Edge Functions > Secrets
supabase secrets set GOCARDLESS_SECRET_ID="votre_secret_id"
supabase secrets set GOCARDLESS_SECRET_KEY="votre_secret_key"
```

2. Déployez la fonction :

```bash
supabase functions deploy bank-sync
```

## 4. Test du Flux

1. Lancez l'application : `npm run dev`.
2. Allez dans **Espace Propriétaire > Finances > Paramètres (icône engrenage)**.
3. Cliquez sur **"Connecter une banque"**.
4. Sélectionnez "Banque de Démo (Sandbox)" pour tester sans frais.
5. Suivez le flux (vous serez redirigé vers GoCardless puis reviendrez sur l'app).

## 5. Prochaines étapes (Roadmap)

Une fois la connexion active, la fonction de synchronisation (Cron Job) doit être activée pour :
1. Récupérer les transactions chaque nuit.
2. Lancer l'algorithme de matching (Loyer = Virement entrant).
3. Marquer les factures comme payées.

**Architecture du Matching :**
- **Edge Function** `bank-reconcile` (à créer).
- Déclencheur : `pg_cron` toutes les nuits à 02h00.

