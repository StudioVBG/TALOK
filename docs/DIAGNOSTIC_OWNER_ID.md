# 🔍 Diagnostic : Alignement owner_id entre Création et Lecture

## 📋 Problème Identifié

L'API `/api/properties` répond en 200 avec `propertiesCount: 0`, ce qui signifie :
- ✅ Le pipeline API/UI fonctionne correctement
- ❌ Soit aucune propriété n'est créée
- ❌ Soit les propriétés sont créées avec un mauvais `owner_id`

## 🔎 Analyse de la Structure

### Structure des Tables

**Table `profiles` :**
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,           -- ✅ Clé métier du profil
  user_id UUID REFERENCES auth.users(id),  -- Référence vers auth.users
  role TEXT NOT NULL,
  ...
);
```

**Table `properties` :**
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES profiles(id),  -- ✅ Référence profiles.id (pas user_id)
  ...
);
```

**Conclusion :** `owner_id` doit être `profiles.id`, pas `profiles.user_id`.

---

## ✅ Vérification du Code

### 1. Création (POST /api/properties)

**Fichier :** `app/api/properties/route.ts`

**Ligne 492 :** `profileId: profile.id` ✅
**Ligne 377 :** `owner_id: profileId` ✅
**Ligne 558 :** `owner_id: profile.id` ✅

**✅ CORRECT :** La création utilise bien `profile.id`.

### 2. Lecture (GET /api/properties)

**Fichier :** `app/api/properties/route.ts`

**Ligne 127 :** `.eq("owner_id", profile.id)` ✅

**✅ CORRECT :** La lecture utilise bien `profile.id`.

### 3. Helper fetchProperties

**Fichier :** `app/app/owner/_data/fetchProperties.ts`

**Ligne 30 :** `.eq("owner_id", ownerId)` où `ownerId` est passé en paramètre

**⚠️ À VÉRIFIER :** S'assurer que `ownerId` passé en paramètre est bien `profile.id` et non `user.id`.

---

## 🧪 Scripts SQL de Diagnostic

### Script 1 : Vérifier les Profils

```sql
-- Voir les profils propriétaires
SELECT 
  p.id as profile_id,
  p.user_id as auth_user_id,
  p.role,
  p.created_at
FROM profiles p
WHERE p.role = 'owner'
ORDER BY p.created_at DESC
LIMIT 10;
```

### Script 2 : Vérifier les Propriétés

```sql
-- Voir les propriétés et vérifier leur owner_id
SELECT 
  pr.id as property_id,
  pr.owner_id,
  pr.type_bien,
  pr.adresse_complete,
  pr.etat,
  pr.created_at,
  -- Vérifier si owner_id correspond à un profiles.id
  CASE 
    WHEN EXISTS (SELECT 1 FROM profiles WHERE id = pr.owner_id) THEN '✅ owner_id = profiles.id'
    WHEN EXISTS (SELECT 1 FROM profiles WHERE user_id = pr.owner_id) THEN '❌ owner_id = profiles.user_id (MAUVAIS)'
    ELSE '❌ owner_id ne correspond à aucun profil'
  END as owner_id_status
FROM properties pr
ORDER BY pr.created_at DESC
LIMIT 20;
```

### Script 3 : Trouver les Propriétés avec owner_id Incorrect

```sql
-- Trouver les propriétés où owner_id = user_id au lieu de profile.id
SELECT 
  pr.id as property_id,
  pr.owner_id as current_owner_id,
  pr.adresse_complete,
  pr.created_at,
  p.id as correct_profile_id,
  p.user_id as auth_user_id
FROM properties pr
INNER JOIN profiles p ON pr.owner_id = p.user_id  -- Trouver les propriétés où owner_id = user_id
WHERE p.role = 'owner'
ORDER BY pr.created_at DESC;
```

### Script 4 : Compter les Propriétés par Propriétaire

```sql
-- Compter les propriétés par propriétaire (en utilisant profiles.id)
SELECT 
  p.id as profile_id,
  p.user_id as auth_user_id,
  COUNT(pr.id) as properties_count
FROM profiles p
LEFT JOIN properties pr ON pr.owner_id = p.id
WHERE p.role = 'owner'
GROUP BY p.id, p.user_id
ORDER BY properties_count DESC;
```

---

## 🔧 Correction des Données Existantes (si nécessaire)

Si le diagnostic montre que des propriétés ont `owner_id = user_id` au lieu de `profile.id`, exécuter :

```sql
-- Migration : Corriger les propriétés avec owner_id incorrect
UPDATE properties pr
SET owner_id = p.id
FROM profiles p
WHERE pr.owner_id = p.user_id  -- Trouver les propriétés où owner_id = user_id
  AND p.role = 'owner'         -- Uniquement pour les propriétaires
  AND p.id != pr.owner_id;     -- Éviter les mises à jour inutiles
```

**⚠️ ATTENTION :** Ne l'exécuter QUE si le diagnostic confirme qu'il y a des propriétés à corriger.

---

## 📝 Logs de Debug Ajoutés

### Dans la Création (POST /api/properties)

```typescript
console.log("[POST /api/properties] DEBUG:", {
  authUserId: user.id,
  profileId: profile.id,
  profileRole: profile.role,
});

console.log("[createDraftProperty] DEBUG:", {
  profileId,
  type_bien: payload.type_bien,
});

console.log("[createDraftProperty] Insert payload owner_id:", insertPayload.owner_id);

console.log("[createDraftProperty] ✅ Insert successful:", {
  id: data.id,
  owner_id: data.owner_id,
  type_bien: data.type_bien,
  etat: data.etat,
});
```

### Dans la Lecture (fetchProperties)

```typescript
console.log("[fetchProperties] DEBUG:", {
  authUserId: user?.id,
  profileId: profile?.id,
  profileUserId: profile?.user_id,
  ownerIdParam: ownerId,
  ownerIdMatchesProfileId: ownerId === profile?.id,
  ownerIdMatchesUserId: ownerId === user?.id,
});

console.log("[fetchProperties] DEBUG: Nombre de propriétés trouvées:", properties?.length || 0);

if (properties && properties.length > 0) {
  console.log("[fetchProperties] DEBUG: Première propriété:", {
    id: properties[0].id,
    owner_id: properties[0].owner_id,
    owner_id_matches_filter: properties[0].owner_id === ownerId,
  });
}
```

---

## ✅ Checklist de Vérification

1. **Exécuter les scripts SQL de diagnostic** dans Supabase SQL Editor
2. **Vérifier les logs serveur** lors de la création d'un bien :
   - `[POST /api/properties] DEBUG` doit montrer `profileId` (pas `user.id`)
   - `[createDraftProperty] Insert payload owner_id` doit être égal à `profileId`
   - `[createDraftProperty] ✅ Insert successful` doit confirmer que `owner_id` est correct
3. **Vérifier les logs serveur** lors de la lecture :
   - `[fetchProperties] DEBUG` doit montrer que `ownerIdParam === profileId`
   - `[fetchProperties] DEBUG: Nombre de propriétés trouvées` doit être > 0 si des propriétés existent
4. **Créer un nouveau bien** via le wizard et vérifier :
   - Les logs de création dans le terminal serveur
   - La propriété apparaît dans Supabase avec le bon `owner_id`
   - La propriété apparaît dans `/app/owner/properties`

---

## 🎯 Prochaines Étapes

1. **Exécuter les scripts SQL de diagnostic** pour identifier le problème exact
2. **Créer un nouveau bien** et vérifier les logs pour confirmer que `owner_id` est correct
3. **Si des propriétés existantes ont un mauvais owner_id**, exécuter la migration de correction
4. **Vérifier que la page `/app/owner/properties` affiche bien les biens**

---

**Date de création :** $(date)
**Fichiers modifiés :**
- `app/api/properties/route.ts` - Logs de debug ajoutés
- `app/app/owner/_data/fetchProperties.ts` - Logs de debug améliorés
- `supabase/migrations/202502190000_diagnostic_owner_id.sql` - Scripts de diagnostic
- `supabase/migrations/202502190001_fix_owner_id_mismatch.sql` - Migration de correction

