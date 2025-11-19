# ✅ Résumé Final : Alignement owner_id entre Création et Lecture

## 📋 Constat

- ✅ L'API `/api/properties` répond en 200
- ✅ Le hook `useProperties` reçoit bien la réponse
- ❌ Mais `propertiesCount = 0` pour le propriétaire connecté

**Conclusion :** Le problème n'est PAS dans le pipeline API/UI, mais dans les données ou le mapping `owner_id`.

---

## ✅ Vérifications Effectuées

### 1. Structure de la Base de Données

**Table `profiles` :**
- `id` (UUID) : Clé primaire métier ✅
- `user_id` (UUID) : Référence vers `auth.users` ✅

**Table `properties` :**
- `owner_id UUID NOT NULL REFERENCES profiles(id)` ✅
- **Conclusion :** `owner_id` doit être `profiles.id`, pas `profiles.user_id`

### 2. Code de Création (POST /api/properties)

**Fichier :** `app/api/properties/route.ts`

- ✅ Ligne 492 : `profileId: profile.id` (pas `user.id`)
- ✅ Ligne 377 : `owner_id: profileId` dans `createDraftProperty`
- ✅ Ligne 558 : `owner_id: profile.id` pour les propriétés complètes

**✅ CORRECT :** La création utilise bien `profile.id`.

### 3. Code de Lecture (GET /api/properties)

**Fichier :** `app/api/properties/route.ts`

- ✅ Ligne 127 : `.eq("owner_id", profile.id)` (pas `user.id`)

**✅ CORRECT :** La lecture utilise bien `profile.id`.

### 4. Helper fetchProperties

**Fichier :** `app/app/owner/_data/fetchProperties.ts`

- ✅ Ligne 38 : `.eq("owner_id", ownerId)` où `ownerId` est passé en paramètre
- ⚠️ **À VÉRIFIER :** S'assurer que l'appelant passe `profile.id` et non `user.id`

**Note :** `fetchProperties` n'est pas utilisé dans `/app/owner/properties` qui utilise directement `useProperties()` → `/api/properties`.

---

## 🔍 Logs de Debug Ajoutés

### Dans la Création

```typescript
[POST /api/properties] DEBUG: {
  authUserId: "...",
  profileId: "...",
  profileRole: "owner"
}

[createDraftProperty] DEBUG: {
  profileId: "...",
  type_bien: "..."
}

[createDraftProperty] Insert payload owner_id: "..."

[createDraftProperty] ✅ Insert successful: {
  id: "...",
  owner_id: "...",
  type_bien: "...",
  etat: "draft"
}
```

### Dans la Lecture (GET /api/properties)

```typescript
[api/properties] DEBUG: auth.uid() = "..."
[api/properties] DEBUG: profile.id = "..."
[api/properties] DEBUG: owner_id filter = "..."
[api/properties] DEBUG: Nombre de propriétés trouvées: ...
```

### Dans fetchProperties (si utilisé ailleurs)

```typescript
[fetchProperties] DEBUG: {
  authUserId: "...",
  profileId: "...",
  profileUserId: "...",
  ownerIdParam: "...",
  ownerIdMatchesProfileId: true/false,
  ownerIdMatchesUserId: true/false
}

[fetchProperties] ⚠️ ATTENTION: ownerId ne correspond pas à profile.id! (si problème détecté)
```

---

## 🧪 Scripts SQL de Diagnostic

### Script 1 : Vérifier les Profils

```sql
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
SELECT 
  pr.id as property_id,
  pr.owner_id,
  pr.type_bien,
  pr.adresse_complete,
  pr.etat,
  pr.created_at,
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
SELECT 
  pr.id as property_id,
  pr.owner_id as current_owner_id,
  pr.adresse_complete,
  pr.created_at,
  p.id as correct_profile_id,
  p.user_id as auth_user_id
FROM properties pr
INNER JOIN profiles p ON pr.owner_id = p.user_id
WHERE p.role = 'owner'
ORDER BY pr.created_at DESC;
```

### Script 4 : Compter les Propriétés par Propriétaire

```sql
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

**Fichier complet :** `supabase/migrations/202502190000_diagnostic_owner_id.sql`

---

## 🔧 Migration de Correction (si nécessaire)

**Fichier :** `supabase/migrations/202502190001_fix_owner_id_mismatch.sql`

**⚠️ À exécuter UNIQUEMENT si le diagnostic montre que des propriétés ont `owner_id = user_id`**

```sql
UPDATE properties pr
SET owner_id = p.id
FROM profiles p
WHERE pr.owner_id = p.user_id
  AND p.role = 'owner'
  AND p.id != pr.owner_id;
```

---

## ✅ Actions Immédiates

1. **Exécuter les scripts SQL de diagnostic** dans Supabase SQL Editor
2. **Créer un nouveau bien** et vérifier les logs serveur
3. **Vérifier les logs de lecture** lors du chargement de `/app/owner/properties`
4. **Si problème détecté**, exécuter la migration de correction
5. **Vérifier que la page affiche bien les biens**

---

## 📝 Fichiers Modifiés

1. ✅ `app/api/properties/route.ts` - Logs de debug ajoutés dans création et lecture
2. ✅ `app/app/owner/_data/fetchProperties.ts` - Logs de debug améliorés
3. ✅ `supabase/migrations/202502190000_diagnostic_owner_id.sql` - Scripts SQL de diagnostic
4. ✅ `supabase/migrations/202502190001_fix_owner_id_mismatch.sql` - Migration de correction

---

## 🎯 Résultat Attendu

Après vérification et correction :

- ✅ Les logs montrent que `owner_id = profile.id` partout
- ✅ Les propriétés créées ont le bon `owner_id`
- ✅ Les propriétés sont trouvées lors de la lecture
- ✅ La page `/app/owner/properties` affiche les biens

---

**Prochaine étape :** Exécuter les scripts SQL de diagnostic et partager les résultats ! 🚀

