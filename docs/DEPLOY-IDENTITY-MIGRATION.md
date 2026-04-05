# Déploiement Migration identity_status / onboarding_step

## Ordre de déploiement

### 1. Déployer le code FIRST
Le code gère déjà le fallback `NULL → unverified` dans `lib/helpers/identity-gate.ts:75`.
Les pages onboarding (`/onboarding/phone`, `/onboarding/profile`, etc.) existent.

### 2. Appliquer les migrations SQL
```bash
# Migration 1 : Créer les enums + colonnes
supabase db push --include 20260401000000_add_identity_status_onboarding_step.sql

# Migration 2 : Backfill les profils existants  
supabase db push --include 20260401000001_backfill_identity_status.sql
```

### 3. Vérifier la distribution
```sql
SELECT identity_status, COUNT(*) FROM profiles GROUP BY identity_status ORDER BY 2 DESC;
SELECT onboarding_step, COUNT(*) FROM profiles GROUP BY onboarding_step ORDER BY 2 DESC;
```

### 4. Vérifier les comptes test
| Compte | Rôle | identity_status attendu | onboarding_step attendu |
|--------|------|------------------------|------------------------|
| contact.explore.mq@gmail.com | owner | identity_verified | complete |
| volberg.thomas@hotmail.fr | tenant | identity_verified | complete |
| Nouveau compte | any | unverified | account_created |

### Rollback
Si problème, les colonnes ont des defaults (`unverified`, `account_created`).
Le code fallback `NULL → unverified` protège même si les colonnes sont supprimées.

## Migrations liées (sprint T33nc)
- `20260404100000_rls_push_subscriptions.sql`
- `20260404100100_fix_tenant_docs_view_visible_tenant.sql`
- `20260404100200_fix_ticket_messages_rls_lease_signers.sql`
