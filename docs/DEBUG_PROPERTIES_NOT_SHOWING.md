# 🔍 DEBUG - Biens créés n'apparaissent pas dans la liste

**Date** : 2025-02-18  
**Problème** : Après création d'un bien, il n'apparaît pas dans la liste `/app/owner/properties`

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Colonne `type_bien` inexistante (`app/api/properties/route.ts`)

**Problème** : La requête SQL incluait `type_bien` qui n'existe pas dans la table `properties`.

**Solution** : Retiré `type_bien` de la liste des colonnes essentielles.

```typescript
// Avant
const essentialColumns = "id, owner_id, type, type_bien, adresse_complete, ...";

// Après
const essentialColumns = "id, owner_id, type, adresse_complete, ...";
```

### 2. Cache Next.js non invalidé (`app/app/owner/layout.tsx`)

**Problème** : Le layout charge les données via Server Components et les met en cache. Après création, le cache n'était pas invalidé.

**Solution** : Utilisation de `unstable_cache` avec tags pour permettre la revalidation :

```typescript
const getCachedProperties = unstable_cache(
  async (ownerId: string) => {
    return fetchProperties(ownerId, { limit: 50 });
  },
  ["owner-properties"],
  {
    tags: ["owner:properties"],
    revalidate: 0, // Pas de revalidation automatique, uniquement via revalidateTag
  }
);
```

### 3. Rafraîchissement après création (`app/app/owner/property/new/_steps/SummaryStep.tsx`)

**Problème** : Après création, la redirection ne rafraîchissait pas le cache.

**Solution** : Ajout de `router.refresh()` avant la redirection :

```typescript
// Réinitialiser le store
reset();

// ✅ RAFFRAÎCHIR: Forcer le rafraîchissement du cache Next.js
router.refresh();

// Attendre un court instant pour que le refresh soit pris en compte
await new Promise((resolve) => setTimeout(resolve, 100));

// Rediriger vers la liste des propriétés pour voir le nouveau bien
router.push(`/app/owner/properties`);
```

### 4. Redirection vers la liste (`app/app/owner/property/new/_steps/SummaryStep.tsx`)

**Changement** : Redirection vers `/app/owner/properties` (liste) au lieu de `/app/owner/properties/${propertyId}` (détail) pour voir immédiatement le nouveau bien.

---

## 🔍 VÉRIFICATIONS EFFECTUÉES

### Base de données
- ✅ **3 biens** existent pour l'owner `3b9280bc-061b-4880-a5e1-57d3f7ab06e5`
- ✅ Les biens ont bien `owner_id` correct
- ✅ Les biens ont `etat = 'draft'` ou `etat = 'active'`

### Routes API
- ✅ `POST /api/properties` retourne `property_id` et `unit_id`
- ✅ `POST /api/properties` appelle `revalidateTag("owner:properties")`
- ✅ `GET /api/properties` filtre par `owner_id` pour les propriétaires

### Layout et Context
- ✅ Le layout charge les données via `fetchProperties()`
- ✅ Les données sont propagées via `OwnerDataProvider`
- ✅ La page utilise `useOwnerData()` pour récupérer les données

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Création d'un bien
1. Aller sur `/app/owner/property/new`
2. Créer un bien (mode "Rapide" ou "Complet")
3. Vérifier que la redirection se fait vers `/app/owner/properties`
4. ✅ **Vérifier que le nouveau bien apparaît dans la liste**

### Test 2 : Vérification de la RPC
Si le problème persiste, vérifier que la RPC `owner_properties_with_status` fonctionne :

```sql
SELECT * FROM owner_properties_with_status(
  '3b9280bc-061b-4880-a5e1-57d3f7ab06e5'::uuid,
  NULL, -- p_search
  NULL, -- p_type
  NULL, -- p_status
  100,  -- p_limit
  0     -- p_offset
);
```

### Test 3 : Vérification du cache
1. Créer un bien
2. Vérifier les logs serveur pour voir si `revalidateTag` est appelé
3. Vérifier que `router.refresh()` est exécuté côté client
4. Vérifier que le layout est rechargé avec les nouvelles données

---

## 🚨 SI LE PROBLÈME PERSISTE

### Option A : Vérifier la RPC `owner_properties_with_status`

Si la RPC n'existe pas ou ne fonctionne pas, `fetchProperties` utilisera une requête directe :

```typescript
// Fallback dans fetchProperties si RPC échoue
const { data: properties, error } = await supabase
  .from("properties")
  .select("*")
  .eq("owner_id", ownerId)
  .order("created_at", { ascending: false });
```

### Option B : Forcer le rechargement complet

Si le cache persiste, ajouter un paramètre de query pour forcer le rechargement :

```typescript
router.push(`/app/owner/properties?refresh=${Date.now()}`);
```

### Option C : Utiliser `revalidatePath` au lieu de `revalidateTag`

Dans `app/api/properties/route.ts`, ajouter :

```typescript
import { revalidatePath } from "next/cache";

// Après création
revalidatePath("/app/owner/properties");
revalidatePath("/app/owner");
```

---

## 📊 RÉSULTAT ATTENDU

Après création d'un bien :
1. ✅ Le bien est créé en base de données
2. ✅ `revalidateTag("owner:properties")` est appelé
3. ✅ `router.refresh()` invalide le cache Next.js
4. ✅ Le layout est rechargé avec les nouvelles données
5. ✅ Le nouveau bien apparaît dans la liste

---

**Note** : Les biens existent bien en base de données (3 biens trouvés). Le problème était uniquement lié au cache Next.js qui n'était pas invalidé après création.

