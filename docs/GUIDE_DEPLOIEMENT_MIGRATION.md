# 🚀 GUIDE DE DÉPLOIEMENT - Migration RLS Properties & Units

## Date : 2025-02-18

---

## 📋 MIGRATION À DÉPLOYER

**Fichier** : `supabase/migrations/202502180000_rls_properties_units.sql`

**Contenu** :
- Active RLS sur `properties` et `units`
- Crée 6 politiques RLS (INSERT, SELECT, UPDATE pour chaque table)
- Utilise `public.user_profile_id()` pour vérifier les permissions

---

## 🔧 MÉTHODES DE DÉPLOIEMENT

### Option 1 : Supabase CLI (Recommandé)

```bash
# 1. Se connecter à Supabase
supabase login

# 2. Lier le projet (si pas déjà fait)
supabase link --project-ref YOUR_PROJECT_REF

# 3. Déployer la migration
supabase db push
```

### Option 2 : Interface Web Supabase

1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet
3. Aller dans **SQL Editor**
4. Copier le contenu de `supabase/migrations/202502180000_rls_properties_units.sql`
5. Coller dans l'éditeur SQL
6. Cliquer sur **Run**

### Option 3 : Déploiement automatique

Si vous utilisez un pipeline CI/CD :
- La migration sera appliquée automatiquement lors du prochain déploiement
- Vérifier que le dossier `supabase/migrations/` est bien inclus dans le déploiement

---

## ✅ VÉRIFICATION POST-DÉPLOIEMENT

### 1. Vérifier que RLS est activé

```sql
-- Vérifier que RLS est activé sur properties
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('properties', 'units');

-- Résultat attendu :
-- properties | true
-- units      | true
```

### 2. Vérifier les politiques créées

```sql
-- Lister les politiques sur properties
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'properties';

-- Résultat attendu : 3 politiques
-- owner_insert_properties
-- owner_select_properties
-- owner_update_properties
```

```sql
-- Lister les politiques sur units
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'units';

-- Résultat attendu : 3 politiques
-- owner_select_units
-- owner_update_units
-- owner_insert_units
```

### 3. Tester les permissions

```sql
-- Tester en tant que propriétaire authentifié
-- (remplacer USER_ID par un user_id réel)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'USER_ID';

-- Devrait réussir : SELECT sur ses propres properties
SELECT id FROM properties WHERE owner_id = public.user_profile_id();

-- Devrait échouer : SELECT sur les properties d'un autre propriétaire
SELECT id FROM properties WHERE owner_id != public.user_profile_id();
```

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Création d'un bien

1. Se connecter en tant que propriétaire
2. Aller sur `/owner/property/new`
3. Compléter le wizard (mode FAST ou FULL)
4. Cliquer sur "Créer le bien"
5. **Vérifier** :
   - ✅ Le bien est créé avec `property_id` et `unit_id`
   - ✅ Le code unique est généré rapidement (< 200ms)
   - ✅ Le bien apparaît dans `/owner/properties` sans refresh
   - ✅ Aucune erreur 404/500 dans la console

### Test 2 : Vérification RLS

1. Créer un bien avec le compte Propriétaire A
2. Se connecter avec le compte Propriétaire B
3. **Vérifier** :
   - ✅ Propriétaire B ne voit PAS le bien du Propriétaire A
   - ✅ Propriétaire B ne peut PAS modifier le bien du Propriétaire A
   - ✅ Propriétaire B ne peut PAS créer d'unit pour le bien du Propriétaire A

### Test 3 : Performance

1. Ouvrir les DevTools (Network tab)
2. Créer un bien
3. **Vérifier** :
   - ✅ `POST /api/properties` retourne `{property_id, unit_id}` en < 1s
   - ✅ Génération code unique : 1 seule requête RPC
   - ✅ Temps total création : < 5s (mode FAST) ou < 15s (mode FULL)

---

## 📊 MÉTRIQUES DE SUCCÈS

### Performance
- ✅ Temps création bien : **< 5s** (mode FAST)
- ✅ Génération code unique : **< 200ms**
- ✅ Requêtes réseau : **1 requête** pour code unique

### Sécurité
- ✅ RLS activé sur `properties` et `units`
- ✅ Propriétaires ne voient que leurs biens
- ✅ Units liées aux properties du même propriétaire

### Fonctionnalités
- ✅ Création property + unit par défaut
- ✅ Code unique généré automatiquement
- ✅ Revalidation automatique (bien apparaît sans refresh)

---

## ⚠️ PROBLÈMES POTENTIELS

### Problème 1 : `public.user_profile_id()` n'existe pas

**Solution** :
- Vérifier que la migration `202411140001_fix_auth_helper_functions.sql` a été appliquée
- Cette migration crée la fonction `public.user_profile_id()`

### Problème 2 : Erreur "policy already exists"

**Solution** :
- La migration utilise `DROP POLICY IF EXISTS` pour éviter les conflits
- Si erreur persiste, supprimer manuellement les anciennes politiques

### Problème 3 : Propriétaires ne voient pas leurs biens

**Solution** :
- Vérifier que `public.user_profile_id()` retourne bien le `profiles.id`
- Vérifier que `owner_id` dans `properties` correspond bien à `profiles.id`

---

## 📝 CHECKLIST DE DÉPLOIEMENT

- [ ] Migration SQL créée et vérifiée
- [ ] Connexion Supabase configurée
- [ ] Migration déployée (CLI ou interface web)
- [ ] RLS vérifié sur `properties` et `units`
- [ ] Politiques vérifiées (6 politiques créées)
- [ ] Test création bien effectué
- [ ] Test RLS effectué (propriétaires isolés)
- [ ] Performance vérifiée (< 5s création)
- [ ] Aucune erreur dans les logs

---

**Date** : 2025-02-18  
**Statut** : ✅ **PRÊT POUR DÉPLOIEMENT**

