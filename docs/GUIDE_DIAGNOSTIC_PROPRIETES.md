# 🔍 GUIDE DE DIAGNOSTIC - Propriétés non visibles

## Problème
Les propriétés créées n'apparaissent pas dans `/app/owner/properties` malgré une création réussie.

---

## ✅ ÉTAPES DE DIAGNOSTIC

### 1. Vérifier les logs SERVEUR (Terminal Next.js)

**Action** : Ouvrir le terminal où tourne `npm run dev` et recharger `/app/owner/properties`

**Logs à chercher** :

```
[fetchProperties] Début - ownerId: ...
[fetchProperties] Utilisateur authentifié: ...
[fetchProperties] Profil trouvé: id=..., role=...
[fetchProperties] ✅ Requête directe réussie: X propriétés trouvées
```

**OU si erreur** :
```
[fetchProperties] ⚠️ AUCUNE PROPRIÉTÉ TROUVÉE pour owner_id=...
[fetchProperties] Exemples de propriétés en base: [...]
```

**OU si erreur RLS** :
```
[fetchProperties] ❌ Erreur requête directe: row-level security policy violation
[fetchProperties] ⚠️ ERREUR RLS DÉTECTÉE
```

**Action** : Copier tous les logs `[fetchProperties]` et `[OwnerLayout]` depuis le terminal serveur.

---

### 2. Exécuter le script SQL de diagnostic

**Fichier** : `scripts/diagnose-properties-complete.sql`

**Action** : 
1. Ouvrir Supabase Dashboard → SQL Editor
2. Coller le contenu de `scripts/diagnose-properties-complete.sql`
3. Exécuter le script
4. Analyser les résultats

**Points clés à vérifier** :
- **Section 1** : `profile_id_from_function` doit correspondre à `profile_id` de la section 2
- **Section 3** : Vérifier que des propriétés existent en base
- **Section 4** : Vérifier que les propriétés sont visibles avec RLS
- **Section 5** : Vérifier que `owner_id` des propriétés = `current_profile_id`
- **Section 6** : Vérifier que les politiques RLS sont actives
- **Section 7** : Vérifier que `user_profile_id()` fonctionne correctement

---

### 3. Vérifier la création d'une propriété

**Action** : Créer un nouveau bien via le formulaire et vérifier les logs serveur :

**Logs attendus lors de la création** :
```
[POST /api/properties] Création d'un draft avec type_bien=...
[POST /api/properties] Draft créé avec succès: id=..., owner_id=...
[createDraftProperty] Draft créé: id=..., type_bien=...
[POST /api/properties] Cache invalidé: tags + paths
```

**Vérifier** :
- Le `owner_id` dans les logs correspond au `profile_id` de l'utilisateur connecté
- Aucune erreur lors de l'insertion

---

### 4. Vérifier la migration RLS

**Fichier** : `supabase/migrations/202502180001_fix_rls_conflicts.sql`

**Action** : Vérifier que cette migration a été appliquée :

```sql
-- Dans Supabase SQL Editor
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'properties'
ORDER BY policyname;
```

**Politiques attendues** :
- `owner_insert_properties`
- `owner_select_properties`
- `owner_update_properties`
- `tenant_select_properties`
- `admin_select_properties`

**Si les politiques manquent** : Appliquer la migration `202502180001_fix_rls_conflicts.sql`

---

## 🔧 CORRECTIONS POSSIBLES

### Scénario A : Le bien n'existe pas en base

**Symptôme** : Section 3 du script SQL retourne 0 lignes

**Cause** : L'INSERT a échoué silencieusement

**Solution** :
1. Vérifier les logs serveur lors de la création
2. Vérifier que `owner_id` est bien défini dans `createDraftProperty()`
3. Vérifier les contraintes de la table `properties`

---

### Scénario B : Le bien existe mais avec un mauvais owner_id

**Symptôme** : Section 3 retourne des biens, mais Section 4 retourne 0

**Cause** : `owner_id` ne correspond pas à `profile.id`

**Solution** :
1. Comparer `owner_id` des propriétés avec `profile_id` de l'utilisateur
2. Vérifier que `createDraftProperty()` utilise bien `profile.id` comme `owner_id`
3. Corriger les propriétés existantes si nécessaire :

```sql
-- ATTENTION : À utiliser avec précaution, uniquement pour corriger des données incorrectes
UPDATE properties
SET owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
WHERE owner_id != (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
AND id IN (SELECT id FROM properties ORDER BY created_at DESC LIMIT 1);
```

---

### Scénario C : RLS bloque l'accès

**Symptôme** : Section 7 montre que `user_profile_id()` retourne NULL ou un ID différent

**Cause** : La fonction RLS ne fonctionne pas correctement

**Solution** :
1. Appliquer la migration `202502180001_fix_rls_conflicts.sql`
2. Vérifier que la fonction `user_profile_id()` existe et fonctionne :

```sql
SELECT public.user_profile_id();
```

3. Si la fonction retourne NULL, vérifier que l'utilisateur a un profil :

```sql
SELECT id, role FROM profiles WHERE user_id = auth.uid();
```

---

### Scénario D : Cache Next.js

**Symptôme** : Les logs serveur montrent des propriétés trouvées, mais le client reçoit 0

**Cause** : `unstable_cache` retourne un ancien résultat vide

**Solution** :
1. Vérifier que `revalidateTag` et `revalidatePath` sont appelés après création
2. Vider le cache Next.js :

```bash
# Supprimer le dossier .next
rm -rf .next

# Redémarrer le serveur
npm run dev
```

3. Forcer un rechargement complet de la page avec `?refresh=${Date.now()}`

---

## 📋 CHECKLIST COMPLÈTE

- [ ] Logs serveur `[fetchProperties]` vérifiés
- [ ] Logs serveur `[OwnerLayout]` vérifiés
- [ ] Script SQL de diagnostic exécuté
- [ ] Section 1 : `user_profile_id()` fonctionne
- [ ] Section 2 : Profil utilisateur trouvé
- [ ] Section 3 : Propriétés existent en base
- [ ] Section 4 : Propriétés visibles avec RLS
- [ ] Section 5 : `owner_id` correspond à `profile_id`
- [ ] Section 6 : Politiques RLS actives
- [ ] Section 7 : Fonction `user_profile_id()` correcte
- [ ] Migration RLS appliquée (`202502180001_fix_rls_conflicts.sql`)
- [ ] Cache Next.js vidé et serveur redémarré
- [ ] Test de création d'un nouveau bien effectué

---

## 🚨 ACTION IMMÉDIATE

1. **Ouvrir le terminal serveur** (où tourne `npm run dev`)
2. **Recharger la page** `/app/owner/properties`
3. **Copier tous les logs** qui commencent par `[fetchProperties]` et `[OwnerLayout]`
4. **Exécuter le script SQL** `scripts/diagnose-properties-complete.sql` dans Supabase SQL Editor
5. **Partager les résultats** pour diagnostic précis

---

**Les résultats de ces vérifications permettront d'identifier précisément la cause du problème.**

