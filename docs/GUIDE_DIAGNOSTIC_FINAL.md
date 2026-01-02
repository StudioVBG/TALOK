# 🔍 GUIDE DE DIAGNOSTIC FINAL - Propriétés non visibles

**Problème** : `OwnerDataProvider` reçoit toujours `propertiesCount: 0`  
**Cause probable** : `fetchProperties` retourne 0 ou échoue silencieusement dans le Server Component

---

## 📋 POINT DE BLOCAGE IDENTIFIÉ

### Flux de données actuel :

```
1. OwnerLayout (Server Component)
   └─> getCachedProperties(profile.id)
       └─> fetchProperties(profile.id)
           └─> SELECT ... WHERE owner_id = profile.id
               └─> ❓ Retourne 0 propriétés OU erreur silencieuse

2. OwnerLayout passe [] au OwnerDataProvider
   └─> [OwnerLayout] Données passées: { propertiesCount: 0 }

3. OwnerDataProvider (Client Component)
   └─> [OwnerDataProvider] Données reçues: { propertiesCount: 0 }

4. PropertiesPageClient (Client Component)
   └─> [PropertiesPageClient] Données reçues: { propertiesCount: 0 }
```

**Le problème est à l'étape 1** : `fetchProperties` ne retourne pas les propriétés.

---

## 🔍 VÉRIFICATIONS REQUISES

### 1. Vérifier les logs SERVEUR (CRITIQUE)

**Où** : Terminal où tourne `npm run dev`

**Logs à chercher après rechargement de `/owner/properties`** :

#### ✅ Si ça fonctionne :
```
[fetchProperties] Début - ownerId: 3b9280bc-061b-4880-a5e1-57d3f7ab06e5
[fetchProperties] Utilisateur authentifié: 5dc8def9-8b36-41d4-af81-e898fb893927
[fetchProperties] Profil trouvé: id=3b9280bc-061b-4880-a5e1-57d3f7ab06e5, role=owner
[fetchProperties] ✅ Requête directe réussie: 4 propriétés trouvées (total: 4)
[fetchProperties] Propriétés trouvées: [{ id: '...', owner_id: '...', adresse: '...' }, ...]
[OwnerLayout] ✅ Propriétés chargées: 4
[OwnerLayout] Données passées au OwnerDataProvider: { propertiesCount: 4, ... }
```

#### ❌ Si erreur RLS :
```
[fetchProperties] ❌ Erreur requête directe: row-level security policy violation
[fetchProperties] ⚠️ ERREUR RLS DÉTECTÉE
[OwnerLayout] ❌ ERREUR lors du chargement des propriétés: ...
```

#### ⚠️ Si 0 propriétés trouvées :
```
[fetchProperties] ⚠️ AUCUNE PROPRIÉTÉ TROUVÉE pour owner_id=3b9280bc-061b-4880-a5e1-57d3f7ab06e5
[fetchProperties] Exemples de propriétés en base: [{ id: '...', owner_id: '...' }, ...]
[OwnerLayout] ✅ Propriétés chargées: 0
[OwnerLayout] Données passées au OwnerDataProvider: { propertiesCount: 0 }
```

---

### 2. Exécuter le script de test serveur

**Commande** :
```bash
npx tsx scripts/test-fetch-properties-server.ts
```

**Ce script va** :
1. Vérifier l'authentification
2. Récupérer le profil
3. Tester `user_profile_id()` RPC
4. Tester la requête SQL directe
5. Tester `fetchProperties()`

**Résultat attendu** :
```
✅ Requête directe réussie: 4 propriétés (total: 4)
✅ Résultat fetchProperties: 4 propriétés
```

**Si erreur** :
```
❌ Erreur requête directe: row-level security policy violation
⚠️ ERREUR RLS DÉTECTÉE
```

---

### 3. Vérifier directement en base (via Supabase SQL Editor)

**Requête** :
```sql
-- Vérifier les propriétés avec le bon owner_id
SELECT 
  id,
  owner_id,
  type,
  adresse_complete,
  etat
FROM properties
WHERE owner_id = '3b9280bc-061b-4880-a5e1-57d3f7ab06e5'
ORDER BY created_at DESC;
```

**Résultat attendu** : 4 propriétés

**Si 0 résultat** :
- Les propriétés n'existent pas avec ce `owner_id`
- Vérifier que `owner_id` des propriétés = `profile.id`

---

## 🐛 SCÉNARIOS POSSIBLES

### Scénario A : RLS bloque toujours l'accès

**Symptôme** : Logs serveur montrent `row-level security policy violation`

**Cause** : `user_profile_id()` retourne NULL ou un ID différent

**Solution** :
1. Vérifier que la migration `202502180002_fix_rls_conflicts_final.sql` est appliquée
2. Vérifier que `user_profile_id()` retourne le bon ID :
   ```sql
   SELECT public.user_profile_id();
   ```
3. Comparer avec `profile.id` :
   ```sql
   SELECT id FROM profiles WHERE user_id = auth.uid();
   ```

---

### Scénario B : fetchProperties retourne 0 silencieusement

**Symptôme** : Logs serveur montrent `✅ Requête directe réussie: 0 propriétés trouvées`

**Cause** : Aucune propriété en base avec `owner_id = profile.id`

**Solution** :
1. Vérifier en base que les propriétés existent avec le bon `owner_id`
2. Vérifier que `profile.id` utilisé dans `fetchProperties` correspond bien à `owner_id` des propriétés

---

### Scénario C : Cache Next.js retourne vide

**Symptôme** : Logs serveur montrent des propriétés trouvées, mais le client reçoit 0

**Cause** : `unstable_cache` retourne un cache vide initial

**Solution** :
1. Vider le cache : `rm -rf .next`
2. Redémarrer : `npm run dev`
3. Vérifier que `revalidate: 60` est bien appliqué dans le layout

---

### Scénario D : Erreur silencieuse dans fetchProperties

**Symptôme** : Aucun log `[fetchProperties]` dans les logs serveur

**Cause** : `fetchProperties` échoue avant d'atteindre les logs

**Solution** :
1. Vérifier qu'il n'y a pas d'erreur dans le try/catch
2. Vérifier que `getOwnerProfile()` ne lance pas d'erreur
3. Vérifier les logs `[OwnerLayout]` pour voir si `propertiesResult.status === "rejected"`

---

## ✅ CHECKLIST DE DIAGNOSTIC

- [ ] Logs serveur `[fetchProperties]` vérifiés
- [ ] Logs serveur `[OwnerLayout]` vérifiés
- [ ] Script de test serveur exécuté (`npx tsx scripts/test-fetch-properties-server.ts`)
- [ ] Requête SQL directe testée dans Supabase SQL Editor
- [ ] `user_profile_id()` testé et retourne le bon ID
- [ ] Propriétés existent en base avec `owner_id = profile.id`
- [ ] Migration RLS appliquée (`202502180002_fix_rls_conflicts_final.sql`)
- [ ] Cache Next.js vidé (`rm -rf .next`)

---

## 🚀 ACTIONS IMMÉDIATES

1. **Copier TOUS les logs SERVEUR** (terminal `npm run dev`) après rechargement de `/owner/properties`
2. **Exécuter le script de test** : `npx tsx scripts/test-fetch-properties-server.ts`
3. **Partager les résultats** pour diagnostic précis

---

## 📊 RÉSULTATS ATTENDUS

### Si tout fonctionne :

**Logs serveur** :
```
[fetchProperties] ✅ Requête directe réussie: 4 propriétés trouvées
[OwnerLayout] ✅ Propriétés chargées: 4
[OwnerLayout] Données passées: { propertiesCount: 4 }
```

**Logs client** :
```
[OwnerDataProvider] Données reçues: { propertiesCount: 4 }
[PropertiesPageClient] Données reçues: { propertiesCount: 4 }
[PropertiesPageClient] ✅ Après tous les filtres: 4 propriétés affichées
```

---

**Les logs serveur sont CRITIQUES pour identifier la cause exacte du problème.**

