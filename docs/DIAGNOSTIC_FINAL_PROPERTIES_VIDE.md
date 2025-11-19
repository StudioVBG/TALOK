# 🔍 DIAGNOSTIC FINAL - Properties vide dans OwnerDataProvider

**Date** : 2025-02-18  
**Problème** : `OwnerDataProvider` reçoit toujours `propertiesCount: 0, properties: []` malgré les patches appliqués

---

## 📋 CHAÎNE COMPLÈTE VÉRIFIÉE

### 1. Flux de données

```
OwnerLayout (Server Component)
  ↓
getOwnerProfile() → profile.id
  ↓
getCachedProperties(profile.id)
  ↓
unstable_cache(["owner-properties-${profile.id}"], { tags: ["owner:properties"], revalidate: 0 })
  ↓
fetchProperties(ownerId = profile.id)
  ↓
serviceClient.from("properties").eq("owner_id", ownerId)
  ↓
properties[] → OwnerDataProvider
  ↓
PropertiesPageClient
```

---

## 🔍 POINTS DE VÉRIFICATION

### 1. Vérifier les logs serveur

Après avoir rechargé `/app/owner/properties`, chercher dans les logs serveur :

```
[OwnerLayout] Profile ID utilisé pour charger les données: <UUID>
[OwnerLayout] getCachedProperties appelé avec ownerId: <UUID>
[fetchProperties] Début - ownerId: <UUID>
[fetchProperties] Profil trouvé: id=<UUID>, role=owner
[fetchProperties] 🔍 Vérification préalable: X biens trouvés pour owner_id=<UUID>
[fetchProperties] ✅ Requête directe réussie: X propriétés trouvées
[OwnerLayout] ✅ Propriétés chargées: X
[OwnerLayout] Données passées au OwnerDataProvider: { propertiesCount: X, ... }
```

**Si les logs montrent `X > 0` mais `OwnerDataProvider` reçoit `0`** :
- Problème de cache Next.js côté client
- Problème de sérialisation des données

**Si les logs montrent `X = 0`** :
- Vérifier que les biens sont bien créés avec `owner_id = profile.id`
- Vérifier que `profile.id` utilisé dans `fetchProperties` = `profile.id` utilisé lors de la création

---

### 2. Vérifier l'alignement owner_id

**Création** (`app/api/properties/route.ts`, ligne 507) :
```typescript
owner_id: profileId, // où profileId = profile.id depuis getOwnerProfile()
```

**Lecture** (`app/app/owner/layout.tsx`, ligne 66) :
```typescript
getCachedProperties(profile.id) // où profile.id vient de getOwnerProfile()
```

**Requête** (`app/app/owner/_data/fetchProperties.ts`, ligne 173) :
```typescript
.eq("owner_id", ownerId) // où ownerId = profile.id passé depuis OwnerLayout
```

**Vérification** : Les trois doivent utiliser le même `profile.id`

---

### 3. Vérifier le cache Next.js

**Problème potentiel** : `unstable_cache` avec `revalidate: 0` peut quand même servir un cache vide dans certains cas.

**Solution appliquée** :
- Clé de cache inclut `profile.id` : `["owner-properties-${profile.id}"]`
- Logs ajoutés pour détecter les cas où `fetchProperties` réussit mais retourne 0

---

### 4. Vérifier les erreurs silencieuses

**Dans `fetchProperties.ts`** :
- Si une erreur survient dans le `try/catch`, elle est loggée mais peut retourner `[]`
- Vérifier les logs pour `[fetchProperties] ❌ Exception` ou `[fetchProperties] ❌ Erreur`

---

## 🛠️ PATCH APPLIQUÉ

### Changements dans `app/app/owner/layout.tsx`

1. **Clé de cache améliorée** :
   ```typescript
   [`owner-properties-${profile.id}`] // Inclut profile.id pour éviter les collisions
   ```

2. **Logs de diagnostic améliorés** :
   ```typescript
   console.log(`[OwnerLayout] Profile user_id: ${profile.user_id}`);
   if (!profile.id) {
     console.error("[OwnerLayout] ❌ ERREUR CRITIQUE: profile.id est undefined/null");
     throw new Error("Profile ID manquant");
   }
   ```

3. **Vérification post-fetch** :
   ```typescript
   if (propertiesResult.status === "fulfilled" && properties.length === 0) {
     console.warn("[OwnerLayout] ⚠️ ATTENTION: fetchProperties a réussi mais retourne 0 propriétés");
   }
   ```

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Vérifier les logs serveur

1. Créer un bien via le wizard
2. Recharger `/app/owner/properties`
3. Vérifier les logs serveur :
   - `[OwnerLayout] Profile ID utilisé pour charger les données: <UUID>`
   - `[fetchProperties] ✅ Requête directe réussie: X propriétés trouvées`
   - `[OwnerLayout] ✅ Propriétés chargées: X`
   - `[OwnerLayout] Données passées au OwnerDataProvider: { propertiesCount: X, ... }`

### Test 2 : Vérifier l'alignement owner_id

1. Dans les logs serveur, noter le `profile.id` utilisé
2. Dans Supabase Dashboard, vérifier que les biens créés ont `owner_id = <profile.id>`
3. Si mismatch, corriger la création ou la lecture

### Test 3 : Vérifier le cache

1. Vider le cache Next.js : `rm -rf .next`
2. Redémarrer le serveur : `npm run dev`
3. Recharger `/app/owner/properties`
4. Vérifier si les propriétés apparaissent maintenant

---

## 🎯 RÉSULTAT ATTENDU

Après application du patch :

1. ✅ Les logs serveur montrent `propertiesCount > 0`
2. ✅ `OwnerDataProvider` reçoit `propertiesCount > 0`
3. ✅ Les propriétés apparaissent dans `/app/owner/properties`

---

## 📝 PROCHAINES ÉTAPES SI LE PROBLÈME PERSISTE

1. **Vérifier les logs serveur** : Si `fetchProperties` retourne 0, vérifier pourquoi
2. **Vérifier la base de données** : Vérifier que les biens existent avec le bon `owner_id`
3. **Vérifier le cache** : Vider `.next` et redémarrer
4. **Vérifier les politiques RLS** : S'assurer qu'elles permettent bien la lecture avec `service_role`

---

**Le patch est appliqué. Vérifier les logs serveur pour identifier la cause exacte.**

