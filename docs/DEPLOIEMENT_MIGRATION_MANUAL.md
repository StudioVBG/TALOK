# 🚀 DÉPLOIEMENT MANUEL DE LA MIGRATION RLS

## Date : 2025-02-18

---

## ⚠️ IMPORTANT

Le CLI Supabase nécessite une authentification interactive. Voici les méthodes alternatives pour déployer la migration.

---

## 📋 MÉTHODE 1 : Interface Web Supabase (Recommandé)

### Étapes :

1. **Aller sur Supabase Dashboard** :
   - https://supabase.com/dashboard
   - Se connecter avec vos identifiants

2. **Sélectionner votre projet**

3. **Aller dans SQL Editor** :
   - Menu gauche → **SQL Editor**

4. **Créer une nouvelle requête** :
   - Cliquer sur **New Query**

5. **Copier-coller la migration** :
   - Ouvrir `supabase/migrations/202502180000_rls_properties_units.sql`
   - Copier tout le contenu
   - Coller dans l'éditeur SQL

6. **Exécuter la migration** :
   - Cliquer sur **Run** (ou `Cmd+Enter` / `Ctrl+Enter`)
   - Vérifier qu'il n'y a pas d'erreurs

7. **Vérifier le résultat** :
   - Le message devrait indiquer "Success. No rows returned"
   - Vérifier dans **Database** → **Policies** que les 6 politiques sont créées

---

## 📋 MÉTHODE 2 : Supabase CLI avec Token

### Étapes :

1. **Obtenir un access token** :
   - Aller sur https://supabase.com/dashboard/account/tokens
   - Créer un nouveau token (ou utiliser un existant)

2. **Exporter le token** :
   ```bash
   export SUPABASE_ACCESS_TOKEN="votre_token_ici"
   ```

3. **Lier le projet** (si pas déjà fait) :
   ```bash
   cd "/Users/kreyolinfluence/Desktop/Thomas/Gestion locative"
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. **Déployer la migration** :
   ```bash
   supabase db push
   ```

---

## 📋 MÉTHODE 3 : Via le Dashboard (Migration Files)

### Étapes :

1. **Aller sur Supabase Dashboard**
2. **Sélectionner votre projet**
3. **Aller dans Database** → **Migrations**
4. **Cliquer sur "New Migration"**
5. **Nommer la migration** : `202502180000_rls_properties_units`
6. **Copier le contenu** de `supabase/migrations/202502180000_rls_properties_units.sql`
7. **Coller dans l'éditeur**
8. **Cliquer sur "Apply Migration"**

---

## ✅ VÉRIFICATION POST-DÉPLOIEMENT

### 1. Vérifier RLS activé

Dans SQL Editor, exécuter :

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('properties', 'units');
```

**Résultat attendu** :
```
tablename  | rowsecurity
-----------|------------
properties | true
units      | true
```

### 2. Vérifier les politiques créées

```sql
-- Politiques sur properties
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'properties'
ORDER BY policyname;
```

**Résultat attendu** : 3 politiques
- `owner_insert_properties`
- `owner_select_properties`
- `owner_update_properties`

```sql
-- Politiques sur units
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'units'
ORDER BY policyname;
```

**Résultat attendu** : 3 politiques
- `owner_insert_units`
- `owner_select_units`
- `owner_update_units`

---

## 🧪 TEST RAPIDE

### Test création bien

1. Se connecter à l'application
2. Aller sur `/app/owner/property/new`
3. Créer un bien (mode FAST ou FULL)
4. **Vérifier** :
   - ✅ Le bien est créé avec succès
   - ✅ `property_id` et `unit_id` sont retournés
   - ✅ Le bien apparaît dans `/app/owner/properties` sans refresh
   - ✅ Aucune erreur dans la console

---

## 📊 CONTENU DE LA MIGRATION

La migration `202502180000_rls_properties_units.sql` :

1. ✅ Active RLS sur `properties` et `units`
2. ✅ Supprime les anciennes politiques (si existantes)
3. ✅ Crée 3 politiques pour `properties` :
   - INSERT : `owner_id = public.user_profile_id()`
   - SELECT : `owner_id = public.user_profile_id()`
   - UPDATE : `owner_id = public.user_profile_id()`
4. ✅ Crée 3 politiques pour `units` :
   - INSERT : Vérifie que la property appartient au propriétaire
   - SELECT : Vérifie que la property appartient au propriétaire
   - UPDATE : Vérifie que la property appartient au propriétaire

---

## ⚠️ PRÉREQUIS

Avant de déployer cette migration, vérifier que :

- ✅ La fonction `public.user_profile_id()` existe
- ✅ Cette fonction est créée dans `supabase/migrations/202411140001_fix_auth_helper_functions.sql`
- ✅ Si elle n'existe pas, créer-la d'abord :

```sql
CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

---

## 🎯 RÉSULTAT ATTENDU

Après déploiement :

- ✅ RLS activé sur `properties` et `units`
- ✅ 6 politiques créées
- ✅ Propriétaires isolés (ne voient que leurs biens)
- ✅ Sécurité renforcée (pas d'accès croisé)

---

**Date** : 2025-02-18  
**Statut** : ✅ **PRÊT POUR DÉPLOIEMENT MANUEL**

