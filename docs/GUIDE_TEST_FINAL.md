# 🧪 GUIDE DE TEST FINAL

**Date** : 2025-02-18  
**Objectif** : Tester le refactoring complet et identifier le problème restant

---

## ✅ CE QUI A ÉTÉ FAIT

1. ✅ Bug `PUT /owner/property/undefined` corrigé
2. ✅ `fetchProperties.ts` refactorisé (version canonical SOTA 2025)
3. ✅ Migration SQL appliquée (`202502180003_ensure_user_profile_id_works.sql`)
4. ✅ Outils de diagnostic créés
5. ✅ Logs de diagnostic dans `OwnerLayout`

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Diagnostic Automatique

**Action** : Ouvrir dans le navigateur :
```
http://localhost:3000/api/debug/properties
```

**Résultat attendu** : JSON avec :
```json
{
  "current_user": {
    "user_id": "...",
    "profile_id": "...",
    "role": "owner"
  },
  "diagnosis": {
    "profile_match": true/false,
    "has_properties": true/false,
    "recommendation": "..."
  }
}
```

**Interprétation** :
- Si `profile_match: false` → Se connecter avec le bon compte
- Si `has_properties: false` mais `expected_has_properties: true` → Mismatch de profil
- Si `has_properties: true` → Les propriétés devraient s'afficher

---

### Test 2 : Logs Serveur

**Action** : Recharger `/owner/properties` (hard refresh: `Cmd+Shift+R`)

**Vérifier dans le terminal `npm run dev`** :

```
================================================================================
[OwnerLayout] 🔍 DIAGNOSTIC COMPLET DU PROFIL
[OwnerLayout] Profile ID: <UUID>
[OwnerLayout] Profile user_id: <UUID>
[OwnerLayout] Profile role: owner
[OwnerLayout] Profil attendu (avec biens): 3b9280bc-061b-4880-a5e1-57d3f7ab06e5
[OwnerLayout] Match: ✅ OUI ou ❌ NON
================================================================================
[OwnerLayout] 🔍 Vérification directe: X propriétés trouvées pour profile.id=...
[fetchProperties] Result: {
  user_id: ...,
  profile_id: ...,
  count: X,
  properties_returned: Y
}
```

**Interprétation** :
- Si `Match: ❌ NON` → Mismatch de profil (se connecter avec le bon compte)
- Si `count: 0` mais vérification directe > 0 → Problème RLS
- Si `count > 0` → Les propriétés devraient s'afficher

---

### Test 3 : Vérification SQL Directe

**Action** : Dans Supabase Studio → SQL Editor

**Requête 1** : Vérifier user_profile_id()
```sql
SELECT 
  auth.uid() as current_user_id,
  user_profile_id() as current_profile_id,
  user_role() as current_role;
```

**Résultat attendu** :
- `current_profile_id` ne doit pas être NULL
- `current_profile_id` doit correspondre au profil qui a créé les biens

**Requête 2** : Vérifier les propriétés
```sql
SELECT id, owner_id, adresse_complete, etat
FROM properties
WHERE owner_id = user_profile_id()
ORDER BY created_at DESC;
```

**Résultat attendu** :
- Si des lignes sont retournées → RLS OK
- Si 0 lignes mais des propriétés existent avec d'autres owner_id → Mismatch de profil

---

## 📊 SCÉNARIOS POSSIBLES

### Scénario A : Mismatch de Profil

**Symptômes** :
- `[OwnerLayout] Match: ❌ NON`
- `/api/debug/properties` montre `profile_match: false`
- Propriétés existent avec `owner_id = 3b9280bc-061b-4880-a5e1-57d3f7ab06e5`

**Solution** :
- Se connecter avec le compte correspondant au profil `3b9280bc-061b-4880-a5e1-57d3f7ab06e5`
- Ou créer de nouvelles propriétés avec le profil actuel

---

### Scénario B : RLS Bloque l'Accès

**Symptômes** :
- SQL brut retourne des lignes
- Mais `fetchProperties` retourne `count: 0`
- Logs montrent `[fetchProperties] ❌ RLS BLOCKED`

**Solution** :
- Vérifier que `user_profile_id()` retourne bien le `profile.id`
- Vérifier les policies RLS : `SELECT * FROM pg_policies WHERE tablename = 'properties';`
- Appliquer la migration `202502180002_fix_rls_conflicts_final.sql` si nécessaire

---

### Scénario C : Migration Non Appliquée

**Symptômes** :
- `SELECT user_profile_id();` retourne NULL
- Code à jour mais base utilise l'ancienne logique

**Solution** :
```bash
supabase login
supabase link --project-ref $SUPABASE_PROJECT_REF
supabase db push
```

---

### Scénario D : Tout Fonctionne

**Symptômes** :
- `[OwnerLayout] Match: ✅ OUI`
- `[fetchProperties] Result: { count: X }` avec X > 0
- `[OwnerDataProvider] Données reçues: { propertiesCount: X }` avec X > 0

**Résultat** : Les propriétés devraient s'afficher dans `/owner/properties` ✅

---

## 🎯 CHECKLIST FINALE

- [ ] Testé `/api/debug/properties` → Résultat ?
- [ ] Rechargé `/owner/properties` → Logs serveur ?
- [ ] Vérifié SQL brut → Propriétés trouvées ?
- [ ] Vérifié `user_profile_id()` → Retourne bien le profil ?
- [ ] Identifié le scénario (A/B/C/D) → Solution appliquée ?

---

**Suivre ce guide étape par étape permettra d'identifier et résoudre le problème rapidement.**

