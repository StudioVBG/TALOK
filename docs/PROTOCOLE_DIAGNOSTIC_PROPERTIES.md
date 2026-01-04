# 🔍 PROTOCOLE DE DIAGNOSTIC - Propriétés non affichées

**Date** : 2025-02-18  
**Objectif** : Ne plus tourner en rond - Diagnostic structuré étape par étape

---

## Étape 0 : Vérifier la base de données

**Question** : Est-ce qu'une ligne existe dans `properties` avec le bon `owner_id` ?

**Action** : Dans Supabase Studio → SQL Editor :

```sql
SELECT id, owner_id, adresse_complete, etat, created_at
FROM properties
WHERE owner_id = '3b9280bc-061b-4880-a5e1-57d3f7ab06e5'
ORDER BY created_at DESC;
```

**Si 0 lignes** → Problème de création/wizard → Corriger ça d'abord  
**Si >0 lignes** → Passer à l'étape 1

---

## Étape 1 : Vérifier RLS / fonctions helpers

**Question** : Est-ce que `user_profile_id()` renvoie quelque chose pour ce user ?

### Action 1 : Tester user_profile_id()

Dans Supabase Studio → SQL Editor (connecté avec votre compte) :

```sql
SELECT 
  auth.uid() as current_user_id,
  user_profile_id() as current_profile_id,
  user_role() as current_role;
```

**Si `user_profile_id()` = NULL** :
- La migration `202502180003_ensure_user_profile_id_works.sql` n'est pas appliquée
- **Solution** : `supabase db push`

### Action 2 : Tester la requête avec RLS

```sql
SELECT * 
FROM properties 
WHERE owner_id = user_profile_id();
```

**Si cette requête retourne des lignes** → RLS OK, passer à l'étape 2  
**Si cette requête retourne 0 lignes** → Problème de policy RLS

### Action 3 : Vérifier les policies RLS

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'properties'
ORDER BY policyname;
```

**Policies attendues** :
- `owner_select_properties` : `USING (owner_id = public.user_profile_id())`
- `admin_select_properties` : `USING (public.user_role() = 'admin')`

**Si policies manquantes ou incorrectes** :
- Appliquer la migration `202502180002_fix_rls_conflicts_final.sql`
- Ou créer manuellement les policies correctes

---

## Étape 2 : Vérifier fetchProperties

**Question** : Le log serveur montre `[fetchProperties] count = ?`

**Action** : Dans le terminal `npm run dev`, chercher :

```
[fetchProperties] Result: {
  user_id: ...,
  profile_id: ...,
  count: X,
  properties_returned: Y,
}
```

**Si count = 0 mais SQL brut retourne des lignes** :
- Problème de filtre/ownerId côté code
- Vérifier que `profile.id === ownerId` dans les logs
- Vérifier les logs `[OwnerLayout] Match: ✅ OUI` ou `❌ NON`

**Si count > 0** → La data arrive au server, passer à l'étape 3

**Si erreur RLS détectée** :
```
[fetchProperties] ❌ RLS BLOCKED - Diagnostic:
```
- Suivre les instructions dans les logs
- Vérifier que `user_profile_id()` retourne bien le `profile.id`

---

## Étape 3 : Vérifier OwnerDataProvider / mapping UI

**Question** : `OwnerDataProvider` reçoit-il bien ce que `fetchProperties` renvoie ?

**Action** : Vérifier les logs navigateur :

```javascript
[OwnerDataProvider] Données reçues: { propertiesCount: X, ... }
```

**Si X = 0 mais fetchProperties retourne >0** :
- Problème de mapping/serialization
- Vérifier que `OwnerLayout` passe bien `properties` au Provider
- Vérifier les logs `[OwnerLayout] Données passées au OwnerDataProvider`

**Si X > 0** → Les propriétés devraient s'afficher dans l'UI

---

## Checklist rapide

- [ ] Migration `202502180003` appliquée (`supabase db push`)
- [ ] `user_profile_id()` ne retourne pas NULL en SQL
- [ ] SQL brut retourne des lignes : `SELECT * FROM properties WHERE owner_id = ...`
- [ ] Logs serveur montrent `count > 0`
- [ ] `OwnerDataProvider` reçoit `propertiesCount > 0`
- [ ] `.env.local` pointe vers le bon projet Supabase
- [ ] `supabase/config.toml` a le bon `project_ref`

---

## Diagnostic automatique

Pour un diagnostic automatique, ouvrir dans le navigateur :

```
http://localhost:3000/api/debug/properties
```

Cela retournera un JSON avec :
- Le profil actuel utilisé
- Le nombre de propriétés pour ce profil
- Le nombre de propriétés pour le profil attendu
- Une recommandation automatique

---

## Solutions selon le diagnostic

### Cas 1 : Mismatch de profil

**Symptôme** : `profile.id !== "3b9280bc-061b-4880-a5e1-57d3f7ab06e5"`

**Solution** :
- Se connecter avec le compte correspondant au profil attendu
- Ou créer de nouvelles propriétés avec le profil actuel

### Cas 2 : user_profile_id() retourne NULL

**Symptôme** : `SELECT user_profile_id();` retourne NULL

**Solution** :
- Appliquer la migration : `supabase db push`
- Vérifier que la fonction existe : `SELECT proname FROM pg_proc WHERE proname = 'user_profile_id';`

### Cas 3 : RLS bloque l'accès

**Symptôme** : SQL brut retourne des lignes, mais fetchProperties retourne 0

**Solution** :
- Vérifier les policies RLS
- S'assurer que `owner_select_properties` utilise `user_profile_id()` et non `auth.uid()`
- Appliquer la migration `202502180002_fix_rls_conflicts_final.sql`

### Cas 4 : Migration non appliquée

**Symptôme** : Code à jour mais base de données utilise l'ancienne logique

**Solution** :
```bash
supabase login
supabase link --project-ref $SUPABASE_PROJECT_REF
supabase db push
```

---

**Suivre ce protocole étape par étape évite de tourner en rond.**

