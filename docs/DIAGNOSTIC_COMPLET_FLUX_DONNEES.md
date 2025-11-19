# 🔍 DIAGNOSTIC COMPLET - Flux de Données Propriétés

**Date** : 2025-02-18  
**Problème** : `OwnerDataProvider` reçoit `propertiesCount: 0` alors que des biens sont créés

---

## 📊 CHAÎNE DE DONNÉES IDENTIFIÉE

### Flux complet :

```
1. OwnerLayout (Server Component)
   ↓ profile = await getOwnerProfile()
   ↓ profile.id = "3b9280bc-061b-4880-a5e1-57d3f7ab06e5" (exemple)
   
2. getCachedProperties(profile.id)
   ↓ unstable_cache avec tag "owner:properties"
   ↓ revalidate: 0 (désactivé temporairement pour debug)
   
3. fetchProperties(ownerId, { limit: 50 })
   ↓ supabase = await createClient() (client utilisateur)
   ↓ profile = await supabase.from("profiles").select(...).eq("user_id", user.id)
   ↓ Vérification: profile.id === ownerId
   
4. Requête DB effective :
   ↓ serviceClient = supabaseAdmin() (bypass RLS)
   ↓ serviceClient.from("properties")
     .select("id, owner_id, type, ...")
     .eq("owner_id", ownerId)  ← ICI LE FILTRE
     .order("created_at", { ascending: false })
     .range(0, 49)
   
5. Résultat retourné à OwnerLayout
   ↓ propertiesResult.value.properties = [...]
   
6. OwnerDataProvider reçoit properties[]
   ↓ console.log("[OwnerDataProvider] Données reçues: { propertiesCount: X }")
```

---

## 🔍 POINTS DE VÉRIFICATION

### 1. Vérifier le `owner_id` utilisé lors de la création

**Fichier** : `app/api/properties/route.ts` (POST)

```typescript
const property = await createDraftProperty({
  payload: draftPayload.data,
  profileId: profile.id,  // ← owner_id = profile.id
  serviceClient,
});
```

**Log attendu** :
```
[POST /api/properties] Draft créé avec succès: id=..., owner_id=...
```

### 2. Vérifier le `owner_id` utilisé lors du fetch

**Fichier** : `app/app/owner/layout.tsx`

```typescript
const profile = await getOwnerProfile();
const propertiesResult = await getCachedProperties(profile.id);  // ← ownerId = profile.id
```

**Log attendu** :
```
[OwnerLayout] Profile ID utilisé pour charger les données: ...
[fetchProperties] Début - ownerId: ..., options: { limit: 50 }
[fetchProperties] Profil trouvé: id=..., role=...
[fetchProperties] Filtres appliqués: { owner_id: ..., profile_id: ..., match: "✅ MATCH" }
```

### 3. Vérifier la requête DB effective

**Fichier** : `app/app/owner/_data/fetchProperties.ts`

```typescript
const { data: directData, error: directError, count } = await serviceClient
  .from("properties")
  .select("...")
  .eq("owner_id", ownerId)  // ← Filtre sur owner_id
  ...
```

**Logs attendus** :
```
[fetchProperties] 🔍 Vérification préalable: X biens trouvés pour owner_id=...
[fetchProperties] ✅ Requête directe réussie: X propriétés trouvées
```

---

## 🐛 PROBLÈMES POSSIBLES

### Problème 1 : Cache Next.js vide

**Symptôme** : `getCachedProperties` retourne toujours un résultat vide même après création

**Solution appliquée** : `revalidate: 0` pour désactiver le cache temporairement

### Problème 2 : `owner_id` différent entre création et fetch

**Symptôme** : Le bien est créé avec `owner_id = A` mais le fetch cherche `owner_id = B`

**Vérification** : Comparer les logs :
- `[POST /api/properties] owner_id=...`
- `[fetchProperties] owner_id=...`

**Solution** : S'assurer que `profile.id` est le même dans les deux cas

### Problème 3 : Requête DB ne trouve pas les biens

**Symptôme** : `[fetchProperties] 🔍 Vérification préalable: 0 biens trouvés`

**Causes possibles** :
- Le bien n'existe pas en base
- Le `owner_id` du bien ne correspond pas au `ownerId` utilisé dans la requête
- La requête est exécutée avant que le bien soit créé (race condition)

**Solution** : Vérifier directement en SQL :
```sql
SELECT id, owner_id, adresse_complete, etat, created_at
FROM properties
ORDER BY created_at DESC
LIMIT 10;
```

---

## ✅ CORRECTIONS APPLIQUÉES

1. **Logs de diagnostic ajoutés** :
   - `[OwnerLayout] Profile ID utilisé pour charger les données`
   - `[fetchProperties] Filtres appliqués: { owner_id, profile_id, match }`
   - `[fetchProperties] 🔍 Vérification préalable: X biens trouvés`

2. **Cache désactivé temporairement** :
   - `revalidate: 0` dans `getCachedProperties` pour forcer le rechargement

3. **Vérification préalable** :
   - Requête de comptage avant la requête principale pour diagnostiquer

---

## 🧪 TESTS À EFFECTUER

1. **Créer un bien** et vérifier les logs :
   ```
   [POST /api/properties] Draft créé avec succès: id=..., owner_id=...
   ```

2. **Recharger `/app/owner/properties`** et vérifier les logs :
   ```
   [OwnerLayout] Profile ID utilisé: ...
   [fetchProperties] Début - ownerId: ...
   [fetchProperties] 🔍 Vérification préalable: X biens trouvés
   [fetchProperties] ✅ Requête directe réussie: X propriétés trouvées
   [OwnerLayout] ✅ Propriétés chargées: X
   [OwnerDataProvider] Données reçues: { propertiesCount: X }
   ```

3. **Si toujours 0** :
   - Vérifier que `owner_id` du bien créé = `ownerId` utilisé dans le fetch
   - Vérifier directement en SQL que le bien existe
   - Vérifier les logs d'erreur dans `[fetchProperties]`

---

**Les logs détaillés permettront d'identifier précisément où le problème se situe dans la chaîne.**

