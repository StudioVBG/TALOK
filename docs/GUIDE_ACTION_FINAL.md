# 🎯 Guide d'Action Final - Résolution du Problème propertiesCount = 0

## ✅ État Actuel

- ✅ Code vérifié : création et lecture utilisent bien `profile.id`
- ✅ Logs de debug ajoutés partout
- ✅ Scripts SQL de diagnostic créés
- ✅ Migration de correction prête (si nécessaire)

---

## 🚀 Actions à Effectuer MAINTENANT

### Étape 1 : Diagnostic SQL (5 minutes)

1. **Ouvrir Supabase Dashboard** → SQL Editor
2. **Copier-coller et exécuter** cette requête :

```sql
-- Diagnostic complet owner_id
SELECT 
  'Profils propriétaires' as section,
  p.id as profile_id,
  p.user_id as auth_user_id,
  COUNT(pr.id) as properties_count,
  CASE 
    WHEN COUNT(pr.id) = 0 THEN '❌ Aucune propriété'
    WHEN COUNT(pr.id) > 0 THEN '✅ Propriétés trouvées'
  END as status
FROM profiles p
LEFT JOIN properties pr ON pr.owner_id = p.id
WHERE p.role = 'owner'
GROUP BY p.id, p.user_id
ORDER BY properties_count DESC;
```

3. **Exécuter cette requête** pour voir les propriétés :

```sql
-- Voir toutes les propriétés et leur owner_id
SELECT 
  pr.id,
  pr.owner_id,
  pr.adresse_complete,
  pr.etat,
  pr.created_at,
  p.id as profile_id_match,
  p.user_id as auth_user_id_match,
  CASE 
    WHEN pr.owner_id = p.id THEN '✅ CORRECT (owner_id = profile.id)'
    WHEN pr.owner_id = p.user_id THEN '❌ INCORRECT (owner_id = user_id)'
    ELSE '❌ AUCUN MATCH'
  END as match_status
FROM properties pr
LEFT JOIN profiles p ON pr.owner_id = p.id OR pr.owner_id = p.user_id
ORDER BY pr.created_at DESC
LIMIT 20;
```

**Résultats attendus :**
- Si `properties_count = 0` → Aucune propriété créée pour ce propriétaire
- Si `match_status = '❌ INCORRECT'` → Propriétés avec mauvais owner_id

---

### Étape 2 : Créer un Nouveau Bien (5 minutes)

1. **Ouvrir** `/owner/properties/new`
2. **Créer un bien** (même minimal)
3. **Vérifier les logs serveur** dans le terminal :

```
[POST /api/properties] DEBUG: {
  authUserId: "...",
  profileId: "...",  ← Doit être différent de authUserId
  profileRole: "owner"
}
[createDraftProperty] Insert payload owner_id: "..."  ← Doit être égal à profileId
[createDraftProperty] ✅ Insert successful: {
  id: "...",
  owner_id: "...",  ← Doit être égal à profileId
  ...
}
```

4. **Vérifier dans Supabase** que la propriété a été créée avec le bon `owner_id`

---

### Étape 3 : Vérifier la Lecture (2 minutes)

1. **Recharger** `/owner/properties`
2. **Vérifier les logs serveur** :

```
[api/properties] DEBUG: auth.uid() = "..."
[api/properties] DEBUG: profile.id = "..."  ← Doit être différent de auth.uid()
[api/properties] DEBUG: owner_id filter = "..."  ← Doit être égal à profile.id
[api/properties] DEBUG: Nombre de propriétés trouvées: X
```

3. **Vérifier la console navigateur** :

```
[useProperties] Response received: {
  propertiesCount: X,
  propertiesLength: X
}
[PropertiesPageClient] state: {
  propertiesCount: X,
  isLoading: false,
  isError: false
}
```

---

### Étape 4 : Corriger les Données Existantes (si nécessaire)

**⚠️ UNIQUEMENT si le diagnostic SQL montre des propriétés avec `owner_id = user_id`**

1. **Exécuter cette migration** dans Supabase SQL Editor :

```sql
-- Corriger les propriétés avec owner_id incorrect
UPDATE properties pr
SET owner_id = p.id
FROM profiles p
WHERE pr.owner_id = p.user_id
  AND p.role = 'owner'
  AND p.id != pr.owner_id;

-- Vérifier le résultat
SELECT 
  'Après correction' as status,
  COUNT(*) as properties_with_correct_owner_id
FROM properties pr
INNER JOIN profiles p ON pr.owner_id = p.id
WHERE p.role = 'owner';
```

---

## 🔍 Scénarios Possibles

### Scénario 1 : Aucune Propriété dans la Base

**Symptôme :** `properties_count = 0` pour tous les propriétaires

**Cause :** Le wizard de création n'insère rien ou échoue silencieusement

**Solution :**
1. Créer un nouveau bien et vérifier les logs
2. Si erreur dans les logs, corriger le problème
3. Si pas d'erreur mais pas d'insertion, vérifier les RLS policies

---

### Scénario 2 : Propriétés avec owner_id = user_id

**Symptôme :** Des propriétés existent mais `match_status = '❌ INCORRECT'`

**Cause :** Propriétés créées avec `owner_id = user.id` au lieu de `profile.id`

**Solution :**
1. Exécuter la migration de correction SQL
2. Vérifier que les nouvelles propriétés utilisent `profile.id`

---

### Scénario 3 : Propriétés avec owner_id Correct mais Non Trouvées

**Symptôme :** Propriétés existent avec `owner_id = profile.id` mais `propertiesCount = 0`

**Cause :** Problème de RLS ou de requête Supabase

**Solution :**
1. Vérifier les logs pour voir si la requête retourne des erreurs
2. Vérifier les RLS policies sur la table `properties`
3. Tester la requête directement dans Supabase SQL Editor

---

## ✅ Checklist Finale

- [ ] Scripts SQL de diagnostic exécutés
- [ ] Résultats analysés (propriétés existantes ? owner_id correct ?)
- [ ] Nouveau bien créé et logs vérifiés
- [ ] Propriété visible dans Supabase avec bon `owner_id`
- [ ] Page `/owner/properties` rechargée
- [ ] Logs de lecture vérifiés (`owner_id filter = profile.id`)
- [ ] Si problème détecté, migration de correction exécutée
- [ ] Page `/owner/properties` affiche les biens ✅

---

## 📞 Support

Si le problème persiste après ces étapes :

1. **Partager les résultats des scripts SQL**
2. **Partager les logs serveur** (création + lecture)
3. **Partager les logs navigateur** (console F12)

---

**Date :** $(date)
**Status :** Prêt pour diagnostic et correction

