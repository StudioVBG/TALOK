# 🚀 ACTION IMMÉDIATE - Guide Rapide

**Date** : 2025-02-18  
**Objectif** : Tester le refactoring et identifier le problème restant

---

## ✅ CE QUI A ÉTÉ FAIT

1. ✅ Bug `PUT /app/owner/property/undefined` corrigé
2. ✅ `fetchProperties.ts` refactorisé (version canonical SOTA 2025)
3. ✅ Migration SQL appliquée (`202502180003_ensure_user_profile_id_works.sql`)
4. ✅ Outils de diagnostic créés
5. ✅ Logs de diagnostic dans `OwnerLayout`

---

## 🎯 ACTIONS À EFFECTUER MAINTENANT

### Action 1 : Diagnostic Automatique (30 secondes)

**Ouvrir dans le navigateur** :
```
http://localhost:3000/api/debug/properties
```

**Résultat attendu** : JSON avec :
```json
{
  "diagnosis": {
    "profile_match": true/false,
    "has_properties": true/false,
    "recommendation": "..."
  }
}
```

**Interprétation** :
- `profile_match: false` → Se connecter avec le bon compte
- `has_properties: false` mais `expected_has_properties: true` → Mismatch de profil
- `has_properties: true` → Les propriétés devraient s'afficher

---

### Action 2 : Vérifier les Logs Serveur (1 minute)

**Recharger** : `/app/owner/properties` (hard refresh: `Cmd+Shift+R`)

**Vérifier dans le terminal `npm run dev`** :

```
================================================================================
[OwnerLayout] 🔍 DIAGNOSTIC COMPLET DU PROFIL
[OwnerLayout] Profile ID: <UUID>
[OwnerLayout] Match: ✅ OUI ou ❌ NON
================================================================================
[OwnerLayout] 🔍 Vérification directe: X propriétés trouvées
[fetchProperties] Result: {
  user_id: ...,
  profile_id: ...,
  count: X,
  properties_returned: Y
}
```

**Interprétation** :
- `Match: ❌ NON` → Mismatch de profil (se connecter avec le bon compte)
- `count: 0` mais vérification directe > 0 → Problème RLS
- `count > 0` → Les propriétés devraient s'afficher

---

### Action 3 : Si Problème Persiste

**Suivre le protocole** : `docs/PROTOCOLE_DIAGNOSTIC_PROPERTIES.md`

**Étape 0** : Vérifier en SQL brut
```sql
SELECT * FROM properties WHERE owner_id = '3b9280bc-061b-4880-a5e1-57d3f7ab06e5';
```

**Étape 1** : Vérifier user_profile_id()
```sql
SELECT user_profile_id(), user_role();
```

**Étape 2** : Vérifier les policies RLS
```sql
SELECT * FROM pg_policies WHERE tablename = 'properties';
```

---

## 📊 SCÉNARIOS POSSIBLES

### ✅ Scénario A : Tout Fonctionne

**Symptômes** :
- `[OwnerLayout] Match: ✅ OUI`
- `[fetchProperties] Result: { count: X }` avec X > 0
- `/api/debug/properties` montre `has_properties: true`

**Résultat** : Les propriétés s'affichent dans `/app/owner/properties` ✅

---

### ❌ Scénario B : Mismatch de Profil

**Symptômes** :
- `[OwnerLayout] Match: ❌ NON`
- `/api/debug/properties` montre `profile_match: false`
- Propriétés existent avec `owner_id = 3b9280bc-061b-4880-a5e1-57d3f7ab06e5`

**Solution** :
- Se connecter avec le compte correspondant au profil `3b9280bc-061b-4880-a5e1-57d3f7ab06e5`
- Ou créer de nouvelles propriétés avec le profil actuel

---

### ❌ Scénario C : RLS Bloque l'Accès

**Symptômes** :
- SQL brut retourne des lignes
- Mais `fetchProperties` retourne `count: 0`
- Logs montrent `[fetchProperties] ❌ RLS BLOCKED`

**Solution** :
- Vérifier que `user_profile_id()` retourne bien le `profile.id`
- Vérifier les policies RLS
- Appliquer la migration `202502180002_fix_rls_conflicts_final.sql` si nécessaire

---

## 🎯 CHECKLIST RAPIDE

- [ ] Testé `/api/debug/properties` → Résultat ?
- [ ] Rechargé `/app/owner/properties` → Logs serveur ?
- [ ] Identifié le scénario (A/B/C) → Solution appliquée ?

---

**Suivre ces actions dans l'ordre permettra d'identifier rapidement le problème.**

