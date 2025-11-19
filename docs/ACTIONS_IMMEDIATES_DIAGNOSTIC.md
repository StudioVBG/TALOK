# 🚀 Actions Immédiates - Diagnostic owner_id

## ✅ Ce qui a été fait

1. **Logs de debug ajoutés dans la création** (`app/api/properties/route.ts`)
2. **Logs de debug améliorés dans fetchProperties** (`app/app/owner/_data/fetchProperties.ts`)
3. **Scripts SQL de diagnostic créés** (`supabase/migrations/202502190000_diagnostic_owner_id.sql`)
4. **Migration de correction créée** (`supabase/migrations/202502190001_fix_owner_id_mismatch.sql`)

---

## 🎯 Actions Immédiates à Effectuer

### Étape 1 : Exécuter les Scripts SQL de Diagnostic

1. **Ouvrir Supabase Dashboard** → SQL Editor
2. **Exécuter le script de diagnostic** : `supabase/migrations/202502190000_diagnostic_owner_id.sql`
3. **Analyser les résultats** :
   - Y a-t-il des propriétés dans la table `properties` ?
   - Si oui, est-ce que `owner_id` correspond à `profiles.id` ou `profiles.user_id` ?
   - Combien de propriétés par propriétaire ?

### Étape 2 : Vérifier les Logs lors de la Création

1. **Créer un nouveau bien** via le wizard (`/app/owner/properties/new`)
2. **Vérifier les logs serveur** dans le terminal où `npm run dev` tourne :
   ```
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
     ...
   }
   ```
3. **Vérifier que** :
   - `profileId` dans les logs = `owner_id` dans la réponse
   - `owner_id` n'est PAS égal à `authUserId`

### Étape 3 : Vérifier les Logs lors de la Lecture

1. **Recharger la page** `/app/owner/properties`
2. **Vérifier les logs serveur** :
   ```
   [fetchProperties] DEBUG: {
     authUserId: "...",
     profileId: "...",
     ownerIdParam: "...",
     ownerIdMatchesProfileId: true/false,
     ownerIdMatchesUserId: true/false
   }
   [fetchProperties] DEBUG: Nombre de propriétés trouvées: ...
   ```
3. **Vérifier que** :
   - `ownerIdParam === profileId` (pas `authUserId`)
   - Si `ownerIdMatchesProfileId: false`, c'est le problème !

### Étape 4 : Corriger les Données Existantes (si nécessaire)

**⚠️ UNIQUEMENT si le diagnostic montre que des propriétés ont `owner_id = user_id`**

1. **Exécuter la migration de correction** : `supabase/migrations/202502190001_fix_owner_id_mismatch.sql`
2. **Vérifier le résultat** avec les scripts de diagnostic

---

## 📊 Résultats Attendus

### Si tout est correct :

- ✅ Les logs montrent `ownerIdParam === profileId`
- ✅ Les propriétés créées ont `owner_id = profile.id`
- ✅ Les propriétés sont trouvées lors de la lecture
- ✅ La page `/app/owner/properties` affiche les biens

### Si problème détecté :

- ❌ Les logs montrent `ownerIdParam !== profileId`
- ❌ Les propriétés créées ont `owner_id = user.id` au lieu de `profile.id`
- ❌ Les propriétés ne sont pas trouvées lors de la lecture
- ❌ La page `/app/owner/properties` reste vide

---

## 🔧 Solutions selon le Problème

### Problème 1 : ownerId passé en paramètre est user.id au lieu de profile.id

**Où chercher :** L'appelant de `fetchProperties(ownerId)`

**Solution :** S'assurer que l'appelant passe `profile.id` et non `user.id`

### Problème 2 : Propriétés créées avec owner_id = user.id

**Où chercher :** `createDraftProperty` ou `insertPropertyRecord`

**Solution :** Vérifier que `profileId` passé est bien `profile.id`

### Problème 3 : Propriétés existantes avec owner_id incorrect

**Solution :** Exécuter la migration de correction SQL

---

## 📝 Checklist Finale

- [ ] Scripts SQL de diagnostic exécutés
- [ ] Logs de création vérifiés (owner_id correct)
- [ ] Logs de lecture vérifiés (ownerIdParam === profileId)
- [ ] Nouveau bien créé et visible dans `/app/owner/properties`
- [ ] Si problème détecté, migration de correction exécutée
- [ ] Page `/app/owner/properties` affiche bien les biens

---

**Prochaine étape :** Exécuter les scripts SQL et partager les résultats ! 🚀

