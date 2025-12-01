# 🚀 Guide d'Action Rapide - Réparation Propriétés

## ✅ État Actuel

**Code :** ✅ Déjà cohérent (utilise `profile.id` partout)  
**Problème :** Probablement des données existantes avec `owner_id` incorrect

---

## 📋 Actions Immédiates (5 minutes)

### Étape 1 : Diagnostic (2 min)

**Dans Supabase SQL Editor**, exécuter :
```sql
-- Fichier : supabase/migrations/202502190003_diagnostic_owner_id_quick.sql
```

**Vérifier :**
- Combien de propriétés ont `owner_id` incorrect ?
- Y a-t-il des propriétés orphelines ?

---

### Étape 2 : Correction (1 min)

**Si des propriétés ont `owner_id` incorrect**, exécuter :
```sql
-- Fichier : supabase/migrations/202502190002_fix_existing_owner_id.sql
```

**Ou via CLI :**
```bash
supabase db push
```

---

### Étape 3 : Test (2 min)

1. **Créer un nouveau bien** via `/app/owner/properties/new`
2. **Vérifier les logs serveur** :
   ```
   [createDraftProperty] ✅ Insert successful: {
     owner_id: "...",  ← Doit être égal à profileId
   }
   ```
3. **Recharger** `/app/owner/properties`
4. **Vérifier** que le bien s'affiche

---

## 🔍 En Cas de Problème

### Si `propertiesCount = 0` après création

1. **Vérifier dans Supabase** :
   ```sql
   SELECT id, owner_id, type_bien, etat, created_at
   FROM properties
   ORDER BY created_at DESC
   LIMIT 5;
   ```

2. **Vérifier que `owner_id` correspond à un `profile.id`** :
   ```sql
   SELECT p.id, p.owner_id, pr.id as profile_id
   FROM properties p
   LEFT JOIN profiles pr ON p.owner_id = pr.id
   ORDER BY p.created_at DESC
   LIMIT 5;
   ```

3. **Si `owner_id` ≠ `profile.id`** :
   - Exécuter la migration de correction
   - Recharger la page

---

## ✅ Checklist Finale

- [ ] Script de diagnostic exécuté
- [ ] Migration de correction exécutée (si nécessaire)
- [ ] Nouveau bien créé avec succès
- [ ] Logs serveur montrent `owner_id = profile.id`
- [ ] Page `/app/owner/properties` affiche les biens
- [ ] Propriétaire B ne voit pas les biens de A

---

**Temps estimé :** 5 minutes  
**Fichiers créés :** 2 migrations SQL + documentation complète

