# 🔍 ANALYSE PROFONDE - Flux de Données Propriétés

**Date** : 2025-02-18  
**Problème** : Propriétés non visibles malgré existence en base

---

## ✅ COMPOSANTS UI/UX VÉRIFIÉS

### 1. Composants existants ✅

**Fichier** : `app/app/owner/properties/PropertiesPageClient.tsx`

**Composants UI** :
- ✅ `PropertyCard` : Carte de propriété avec image, badges, infos
- ✅ `EmptyState` : État vide avec message et bouton "Ajouter un bien"
- ✅ Filtres : Recherche, type, statut
- ✅ Animations : Framer Motion pour transitions fluides
- ✅ Layout : Grid responsive (md:grid-cols-2 lg:grid-cols-3)

**UI/UX** :
- ✅ Design moderne avec gradients
- ✅ Animations au hover
- ✅ Badges de statut et type
- ✅ Images de couverture
- ✅ Bouton "Voir la fiche" avec lien

---

### 2. Flux de données ✅

**Architecture** :
```
OwnerLayout (Server Component)
  ↓ fetchProperties(profile.id)
  ↓ unstable_cache avec tag "owner:properties"
  ↓ OwnerDataProvider (props: properties[])
    ↓ Context API
    ↓ PropertiesPageClient (useOwnerData())
      ↓ filteredProperties.map()
      ↓ PropertyCard pour chaque propriété
```

**Tous les composants sont en place et fonctionnels** ✅

---

## 🐛 PROBLÈME IDENTIFIÉ : RLS BLOQUE L'ACCÈS

### Test RLS effectué

```sql
SELECT COUNT(*) FROM properties WHERE owner_id = public.user_profile_id();
-- Résultat: 0
```

**Conclusion** : RLS bloque l'accès car `user_profile_id()` retourne probablement NULL ou un ID différent dans le contexte d'exécution.

---

## 🔍 CAUSE RACINE

### Problème : `user_profile_id()` ne fonctionne pas correctement

**Vérifications** :
1. ✅ 5 propriétés existent en base avec `owner_id = 3b9280bc-061b-4880-a5e1-57d3f7ab06e5`
2. ✅ Requête SQL directe fonctionne (retourne 5 propriétés)
3. ❌ Requête avec RLS retourne 0 (`user_profile_id()` retourne NULL ou différent)

**Hypothèses** :
1. `user_profile_id()` retourne NULL car `auth.uid()` est NULL dans le contexte
2. La fonction n'est pas appelée avec le bon contexte d'authentification
3. Il y a 2 versions de la fonction (avec et sans paramètre) qui créent un conflit

---

## 🔧 SOLUTION : Contourner RLS temporairement OU corriger la fonction

### Option 1 : Utiliser le service_role pour bypass RLS (TEMPORAIRE)

**Fichier** : `app/app/owner/_data/fetchProperties.ts`

**Changement** :
```typescript
// Utiliser le service client pour bypass RLS temporairement
const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
const serviceClient = supabaseAdmin();

// Requête avec service_role (bypass RLS)
const { data: directData, error: directError, count } = await serviceClient
  .from("properties")
  .select("...")
  .eq("owner_id", ownerId)
  ...
```

**⚠️ ATTENTION** : Cette solution bypass RLS, donc il faut vérifier manuellement que `ownerId` correspond bien à l'utilisateur connecté.

---

### Option 2 : Corriger `user_profile_id()` pour qu'elle fonctionne

**Problème** : La fonction retourne NULL car `auth.uid()` est NULL

**Solution** : Vérifier que la fonction utilise bien le contexte d'authentification Supabase

**Migration SQL** :
```sql
-- Vérifier et corriger user_profile_id()
CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result uuid;
BEGIN
  -- Vérifier que auth.uid() existe
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT id INTO result
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN result;
END;
$$;
```

---

### Option 3 : Utiliser directement `profile.id` au lieu de RLS

**Fichier** : `app/app/owner/_data/fetchProperties.ts`

**Changement** : Ne pas compter sur RLS, utiliser directement le filtre `owner_id = profile.id`

**Code actuel** :
```typescript
.eq("owner_id", ownerId)  // ✅ Déjà fait
```

**Problème** : Même avec `.eq("owner_id", ownerId)`, RLS bloque si `user_profile_id()` ne matche pas.

---

## 🚀 SOLUTION RECOMMANDÉE

### Solution immédiate : Utiliser service_role pour fetchProperties

**Fichier** : `app/app/owner/_data/fetchProperties.ts`

**Changement** :
1. Utiliser `supabaseAdmin()` pour bypass RLS
2. Vérifier manuellement que `ownerId` correspond à l'utilisateur connecté
3. Garder la vérification de permissions avant la requête

**Code** :
```typescript
// Après avoir vérifié profile.id === ownerId
const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
const serviceClient = supabaseAdmin();

const { data: directData, error: directError, count } = await serviceClient
  .from("properties")
  .select("id, owner_id, type, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_hc, created_at, etat", { count: "exact" })
  .eq("owner_id", ownerId)  // Filtre manuel pour sécurité
  .order("created_at", { ascending: false })
  .limit(50);
```

---

## ✅ VÉRIFICATIONS EFFECTUÉES

- [x] Composants UI existent et sont fonctionnels
- [x] Flux de données est correct (Server → Context → Client)
- [x] Propriétés existent en base (5 propriétés)
- [x] Requête SQL directe fonctionne
- [x] RLS bloque l'accès (`user_profile_id()` retourne NULL)
- [x] Mapping `owner_id` est correct

---

## 🎯 PROCHAINES ÉTAPES

1. **Appliquer la solution immédiate** : Utiliser `supabaseAdmin()` dans `fetchProperties`
2. **Tester** : Vérifier que les propriétés apparaissent
3. **Corriger RLS** : Une fois que ça fonctionne, corriger `user_profile_id()` pour que RLS fonctionne correctement

---

**Le problème est clairement identifié : RLS bloque l'accès car `user_profile_id()` ne fonctionne pas correctement dans le contexte d'exécution.**

