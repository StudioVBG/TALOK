# ⚠️ Actions Manuelles Restantes - Supabase Advisors

**Date:** $(date)  
**Status:** ⚠️ Actions requises

---

## 📋 ACTIONS MANUELLES À EFFECTUER

### 1. ⚠️ Extension pg_trgm dans le schéma public

#### Problème
L'extension `pg_trgm` est installée dans le schéma `public`, ce qui peut poser des problèmes de sécurité et de maintenance.

#### Solution
**Action requise:** Déplacer l'extension vers un schéma dédié

#### Instructions

1. **Via SQL Editor dans Supabase Dashboard:**

```sql
-- 1. Créer un schéma pour les extensions (si pas déjà créé)
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Déplacer l'extension (nécessite superuser)
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 3. Vérifier le déplacement
SELECT 
    extname,
    extnamespace::regnamespace AS schema
FROM pg_extension
WHERE extname = 'pg_trgm';
```

2. **Mettre à jour les références dans le code si nécessaire:**

Si vous utilisez des fonctions de `pg_trgm` directement dans vos requêtes, vous devrez peut-être qualifier les fonctions avec le schéma :
- Avant: `similarity(text1, text2)`
- Après: `extensions.similarity(text1, text2)` (si nécessaire)

#### Note
Cette opération nécessite des privilèges superuser et peut nécessiter une fenêtre de maintenance. Elle peut être effectuée manuellement via le SQL Editor de Supabase.

---

### 2. ⚠️ Protection contre les mots de passe compromis désactivée

#### Problème
La protection contre les mots de passe compromis (HaveIBeenPwned) est désactivée dans Supabase Auth.

#### Solution
**Action requise:** Activer via l'interface Supabase Dashboard

#### Instructions

1. **Accéder au Dashboard Supabase:**
   - Aller sur https://supabase.com/dashboard
   - Sélectionner votre projet

2. **Activer la protection:**
   - Aller dans **Authentication** > **Password Security**
   - Activer **"Leaked Password Protection"**
   - Cette fonctionnalité vérifie les mots de passe contre la base de données HaveIBeenPwned

3. **Vérifier l'activation:**
   - La protection devrait maintenant être active
   - Les nouveaux utilisateurs avec des mots de passe compromis seront rejetés

#### Note
Cette configuration ne nécessite pas de migration SQL, seulement une action dans le Dashboard Supabase. Aucun changement de code n'est requis.

---

## ✅ VÉRIFICATIONS POST-MIGRATION

### Vérifier que les corrections sont appliquées

```sql
-- 1. Vérifier que les vues n'ont plus SECURITY DEFINER
SELECT 
    schemaname,
    viewname,
    viewowner
FROM pg_views
WHERE viewname IN ('payment_shares_public', 'v_person_age', 'v_portfolio_age_buckets');

-- 2. Vérifier que les fonctions ont SET search_path
SELECT 
    proname,
    prosecdef,
    proconfig
FROM pg_proc
WHERE proname IN (
    'handle_new_user',
    'update_updated_at_column',
    'generate_unique_code',
    'calculate_invoice_total',
    'can_activate_lease',
    'set_invoice_total',
    'update_invoice_status',
    'validate_lease_property_or_unit',
    'set_property_unique_code',
    'age_years',
    'age_bucket',
    'prevent_audit_log_modification',
    'update_chat_thread_last_message',
    'validate_payment_shares_total',
    'user_profile_id',
    'user_role',
    'is_admin'
)
ORDER BY proname;

-- 3. Vérifier l'extension pg_trgm (devrait être dans 'extensions' après déplacement)
SELECT 
    extname,
    extnamespace::regnamespace AS schema
FROM pg_extension
WHERE extname = 'pg_trgm';
```

---

## 📝 CHECKLIST

### Corrections automatiques (via migration)
- [x] 3 vues avec SECURITY DEFINER corrigées
- [x] 17 fonctions avec search_path mutable corrigées

### Actions manuelles requises
- [ ] Déplacer l'extension `pg_trgm` vers le schéma `extensions`
- [ ] Activer la protection contre les mots de passe compromis dans le Dashboard Supabase

---

## 🔗 RÉFÉRENCES

- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/sql-security.html)
- [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security)
- [PostgreSQL Extensions](https://www.postgresql.org/docs/current/extend-extensions.html)

---

**Note:** Les corrections automatiques ont été appliquées avec succès. Les actions manuelles peuvent être effectuées à votre convenance.

