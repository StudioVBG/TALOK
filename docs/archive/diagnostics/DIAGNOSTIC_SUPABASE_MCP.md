# 🔍 Diagnostic et Corrections Supabase MCP

**Date** : Novembre 2025  
**Statut** : ✅ CORRECTIONS APPLIQUÉES

---

## 🎯 Problèmes Identifiés via MCP Supabase

### 1. RLS Policies Manquantes ❌ → ✅ CORRIGÉ

**Tables concernées** :
- `lease_signers` - Signataires de baux
- `leases` - Baux
- `owner_profiles` - Profils propriétaires
- `tenant_profiles` - Profils locataires

**Impact** : Les utilisateurs ne pouvaient pas accéder à leurs données car les RLS policies bloquaient toutes les requêtes.

**Solution** :
```sql
-- Migration: fix_missing_rls_policies_profiles_leases
-- Création de policies pour:
-- - SELECT (lecture) pour les utilisateurs concernés
-- - ALL (toutes opérations) pour les propriétaires/admins
```

---

### 2. Fonctions avec search_path Mutable ⚠️ → ✅ EN COURS

**Fonctions concernées** :
- `owner_dashboard(p_owner_id uuid)`
- `admin_overview()`
- `property_details(p_property_id uuid, p_owner_id uuid)`
- `lease_details(p_lease_id uuid, p_owner_id uuid)`
- `tenant_dashboard(p_tenant_user_id uuid)`
- `admin_stats()`

**Impact** : Risque de sécurité potentiel avec search_path mutable.

**Solution** :
```sql
-- Ajouter SET search_path = public, pg_temp à chaque fonction
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
$$;
```

---

### 3. Extension pg_trgm dans public schema ⚠️

**Impact** : Risque de sécurité mineur.

**Recommandation** : Déplacer l'extension dans un autre schema (extensions).

---

### 4. Leaked Password Protection Désactivée ⚠️

**Impact** : Les mots de passe compromis (présents dans des fuites de données) ne sont pas bloqués.

**Recommandation** : Activer la protection dans les paramètres Supabase Auth.

---

## 📊 Statistiques des Corrections

| Correction | Statut | Impact |
|------------|--------|--------|
| RLS policies (4 tables) | ✅ Appliqué | CRITIQUE |
| Fonctions search_path (6) | ⚠️ En cours | IMPORTANT |
| Extension pg_trgm | ⚠️ À faire | MINEUR |
| Password protection | ⚠️ À activer | IMPORTANT |

---

## 🛠️ Migrations Appliquées

1. **`fix_missing_rls_policies_profiles_leases`**
   - Date : Novembre 2025
   - Statut : ✅ Succès
   - Fichiers : `lease_signers`, `leases`, `owner_profiles`, `tenant_profiles`

2. **`fix_function_search_paths_with_params`**
   - Date : Novembre 2025
   - Statut : ⚠️ En cours
   - Fonctions : `admin_overview`, `admin_stats`

---

## 🎯 Résultat Attendu

Avant les corrections :
- ❌ "Propriété non trouvée - Ce bien n'existe pas ou vous n'avez pas les droits pour le voir"
- ❌ Erreur 403 sur toutes les requêtes RLS

Après les corrections :
- ✅ Les propriétaires peuvent voir leurs biens
- ✅ Les locataires peuvent voir leurs baux
- ✅ Les données sont correctement filtrées par RLS

---

## 📝 Commandes MCP Utilisées

```typescript
// Lister les tables
mcp_supabase_immo_list_tables({ schemas: ["public"] })

// Lister les migrations
mcp_supabase_immo_list_migrations()

// Obtenir les advisors (sécurité + performance)
mcp_supabase_immo_get_advisors({ type: "security" })
mcp_supabase_immo_get_advisors({ type: "performance" })

// Exécuter du SQL
mcp_supabase_immo_execute_sql({ query: "SELECT ..." })

// Appliquer une migration
mcp_supabase_immo_apply_migration({
  name: "fix_missing_rls_policies",
  query: "CREATE POLICY ..."
})
```

---

## 🚀 Prochaines Étapes

1. ✅ **Vérifier que les propriétés s'affichent** (localStorage:3000/owner/properties)
2. ⚠️ **Finaliser les corrections search_path** pour les autres fonctions
3. ⚠️ **Activer Leaked Password Protection** dans Supabase Dashboard
4. ⚠️ **Déplacer pg_trgm** dans un schema séparé (optionnel)

---

**Dernière mise à jour** : Novembre 2025  
**Commit** : `2d0cca3`

