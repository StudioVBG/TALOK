# 🔧 Corrections Supabase Advisors

**Date:** $(date)  
**Status:** ✅ Migration créée

---

## 📋 PROBLÈMES IDENTIFIÉS ET CORRIGÉS

### ✅ 1. Vues avec SECURITY DEFINER (3 vues) - CORRIGÉ

#### Problème
Les vues `payment_shares_public`, `v_portfolio_age_buckets`, et `v_person_age` étaient définies avec `SECURITY DEFINER`, ce qui peut poser des problèmes de sécurité car elles exécutent avec les permissions du créateur plutôt que de l'utilisateur.

#### Solution
- **Migration:** `202502160000_fix_supabase_advisors_issues.sql`
- Retrait de `SECURITY DEFINER` des vues (non nécessaire car elles ne font que masquer des colonnes ou utiliser des fonctions STABLE)
- Les vues utilisent maintenant les permissions de l'utilisateur qui les interroge

#### Vues corrigées
- ✅ `payment_shares_public` - Vue publique pour les parts de paiement (montants masqués)
- ✅ `v_person_age` - Vue pour calculer les âges
- ✅ `v_portfolio_age_buckets` - Vue pour les distributions d'âge par rôle

---

### ✅ 2. Fonctions avec search_path mutable (17 fonctions) - CORRIGÉ

#### Problème
Les fonctions PostgreSQL sans `SET search_path` sont vulnérables aux attaques par injection de schéma (schema injection attacks). Un attaquant pourrait créer des objets dans un schéma avec un nom qui serait résolu avant le schéma attendu.

#### Solution
- **Migration:** `202502160000_fix_supabase_advisors_issues.sql`
- Ajout de `SET search_path = public` à toutes les fonctions identifiées
- Pour `handle_new_user` (SECURITY DEFINER), ajout de `SET search_path = public` pour sécurité supplémentaire

#### Fonctions corrigées
- ✅ `handle_new_user()` - Création automatique de profil
- ✅ `update_updated_at_column()` - Mise à jour automatique de `updated_at`
- ✅ `generate_unique_code()` - Génération de codes uniques
- ✅ `calculate_invoice_total()` - Calcul du total d'une facture
- ✅ `can_activate_lease()` - Vérification si un bail peut être activé
- ✅ `set_invoice_total()` - Trigger pour calculer le total
- ✅ `update_invoice_status()` - Mise à jour du statut de facture
- ✅ `validate_lease_property_or_unit()` - Validation des baux
- ✅ `set_property_unique_code()` - Génération de code unique pour propriété
- ✅ `age_years()` - Calcul de l'âge en années
- ✅ `age_bucket()` - Détermination de la tranche d'âge
- ✅ `prevent_audit_log_modification()` - Protection des logs d'audit
- ✅ `update_chat_thread_last_message()` - Mise à jour du dernier message
- ✅ `validate_payment_shares_total()` - Validation des parts de paiement
- ✅ `user_profile_id()` - Récupération de l'ID du profil
- ✅ `user_role()` - Récupération du rôle utilisateur
- ✅ `is_admin()` - Vérification si admin

---

### ⚠️ 3. Extension pg_trgm dans le schéma public - ACTION MANUELLE REQUISE

#### Problème
L'extension `pg_trgm` est installée dans le schéma `public`, ce qui peut poser des problèmes de sécurité et de maintenance.

#### Solution recommandée
1. Créer un schéma dédié pour les extensions :
   ```sql
   CREATE SCHEMA IF NOT EXISTS extensions;
   ```

2. Déplacer l'extension (nécessite superuser) :
   ```sql
   ALTER EXTENSION pg_trgm SET SCHEMA extensions;
   ```

3. Mettre à jour les références dans le code si nécessaire.

#### Note
Cette opération nécessite des privilèges superuser et peut nécessiter une fenêtre de maintenance. Elle peut être effectuée manuellement via le SQL Editor de Supabase.

---

### ⚠️ 4. Protection contre les mots de passe compromis désactivée - CONFIGURATION REQUISE

#### Problème
La protection contre les mots de passe compromis (HaveIBeenPwned) est désactivée dans Supabase Auth.

#### Solution
Cette fonctionnalité doit être activée via l'interface Supabase Dashboard :

1. Aller dans **Authentication** > **Password Security**
2. Activer **"Leaked Password Protection"**
3. Cette fonctionnalité vérifie les mots de passe contre la base de données HaveIBeenPwned

#### Note
Cette configuration ne nécessite pas de migration SQL, seulement une action dans le Dashboard Supabase.

---

## 📝 INSTRUCTIONS D'APPLICATION

### 1. Appliquer la migration
```bash
# Via Supabase CLI
supabase migration up

# Ou via SQL Editor dans Supabase Dashboard
# Copier le contenu de 202502160000_fix_supabase_advisors_issues.sql
```

### 2. Vérifier les corrections
```sql
-- Vérifier que les vues n'ont plus SECURITY DEFINER
SELECT 
    schemaname,
    viewname,
    viewowner
FROM pg_views
WHERE viewname IN ('payment_shares_public', 'v_person_age', 'v_portfolio_age_buckets');

-- Vérifier que les fonctions ont SET search_path
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
```

### 3. Actions manuelles restantes
- [ ] Déplacer l'extension `pg_trgm` vers le schéma `extensions` (si nécessaire)
- [ ] Activer la protection contre les mots de passe compromis dans le Dashboard Supabase

---

## ✅ RÉSULTAT ATTENDU

Après application de cette migration :
- ✅ 3 vues corrigées (pas de SECURITY DEFINER)
- ✅ 17 fonctions corrigées (SET search_path ajouté)
- ⚠️ Extension pg_trgm : Action manuelle requise
- ⚠️ Protection mots de passe : Configuration Dashboard requise

---

## 📚 RÉFÉRENCES

- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/sql-security.html)
- [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security)

