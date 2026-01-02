# 📋 INSTRUCTIONS - Application de la Migration SQL

**Date** : 2025-02-18  
**Migration** : `202502180003_ensure_user_profile_id_works.sql`

---

## 🎯 OBJECTIF

Appliquer la migration SQL sur votre projet Supabase Cloud pour corriger la fonction `user_profile_id()` et permettre à `fetchProperties` de retourner les propriétés.

---

## 📝 ÉTAPES À SUIVRE

### Étape 1 : Se connecter au CLI Supabase

```bash
supabase login
```

**Action** :
- Le CLI va ouvrir votre navigateur ou vous demander un access token
- Coller votre access token Supabase (disponible dans Supabase Dashboard → Settings → Access Tokens)
- Une fois connecté, vous verrez un message de confirmation

---

### Étape 2 : Lier le projet local au projet cloud

```bash
supabase link --project-ref poeijjosocmqlhgsacud
```

**Action** :
- Le CLI va vous demander de sélectionner le projet ou de confirmer la liaison
- Confirmer avec `Y` ou sélectionner le projet dans la liste
- Une fois lié, vous verrez un message de confirmation

**Note** : Si le projet est déjà lié, cette étape peut être ignorée.

---

### Étape 3 : Appliquer les migrations

```bash
supabase db push
```

**Action** :
- Le CLI va appliquer toutes les migrations du dossier `supabase/migrations/` qui ne sont pas encore appliquées
- Vous verrez la progression de chaque migration
- La migration `202502180003_ensure_user_profile_id_works.sql` sera appliquée

**Résultat attendu** :
```
Applying migration 202502180003_ensure_user_profile_id_works.sql...
Migration applied successfully
```

---

## ✅ VÉRIFICATION

### 1. Vérifier que la fonction fonctionne

Dans **Supabase Studio → SQL Editor**, exécuter :

```sql
SELECT auth.uid(), user_profile_id(), user_role();
```

**Résultat attendu** :
- `auth.uid()` : UUID de l'utilisateur connecté
- `user_profile_id()` : UUID du profil (pas NULL) ✅
- `user_role()` : "owner" ou "admin" (pas NULL) ✅

**Si `user_profile_id()` retourne NULL** :
- Vérifier que vous êtes bien connecté avec un utilisateur qui a un profil dans la table `profiles`
- Vérifier que `profiles.user_id = auth.uid()` pour votre utilisateur

---

### 2. Vérifier les propriétés en base

Dans **Supabase Studio → Table Editor → properties**, vérifier :

- ✅ Il y a bien des lignes dans la table `properties`
- ✅ La colonne `owner_id` correspond au `profile.id` de votre compte
- ✅ Les propriétés ont bien `owner_id = 3b9280bc-061b-4880-a5e1-57d3f7ab06e5` (ou votre profil)

---

### 3. Recharger la page et vérifier les logs

1. **Dans le terminal où tourne `npm run dev`**, vous devriez voir :

```
[OwnerLayout] Profile ID utilisé pour charger les données: <UUID>
[fetchProperties] Début - ownerId: <UUID>
[fetchProperties] ✅ Requête directe réussie: X propriétés trouvées
[OwnerLayout] ✅ Propriétés chargées: X
[OwnerLayout] Données passées au OwnerDataProvider: { propertiesCount: X, ... }
```

2. **Dans le navigateur (console)**, vous devriez voir :

```javascript
[OwnerDataProvider] Données reçues: { propertiesCount: X, properties: Array(X), leasesCount: 0 }
```

---

## 🎯 RÉSULTAT ATTENDU

Après application de la migration :

1. ✅ `user_profile_id()` fonctionne correctement (ne retourne plus NULL)
2. ✅ `fetchProperties` retourne les propriétés (X > 0)
3. ✅ `OwnerDataProvider` reçoit `propertiesCount > 0`
4. ✅ Les propriétés apparaissent dans `/owner/properties`

---

## ⚠️ CAS D'ERREUR

### Erreur : "Project not linked"

**Solution** : Exécuter `supabase link --project-ref poeijjosocmqlhgsacud`

### Erreur : "Not authenticated"

**Solution** : Exécuter `supabase login` et coller votre access token

### Erreur : "Migration already applied"

**Solution** : C'est normal, la migration est déjà appliquée. Passer à la vérification.

### Erreur : "Function already exists"

**Solution** : La migration va remplacer la fonction existante, c'est normal.

---

## 📊 DIAGNOSTIC SI LE PROBLÈME PERSISTE

Si après la migration, `fetchProperties` retourne toujours 0 :

1. **Vérifier les logs serveur** :
   - `[fetchProperties] ⚠️ Profil utilisé: id=<UUID>, user_id=<UUID>`
   - `[fetchProperties] ⚠️ Profil attendu (avec 5 biens): 3b9280bc-061b-4880-a5e1-57d3f7ab06e5`
   - Comparer les deux UUIDs

2. **Si les UUIDs ne correspondent pas** :
   - Vous êtes connecté avec un autre compte
   - Se connecter avec le compte correspondant au profil `3b9280bc-061b-4880-a5e1-57d3f7ab06e5`

3. **Si les UUIDs correspondent mais toujours 0 propriétés** :
   - Vérifier dans Supabase Studio que les propriétés ont bien `owner_id = <UUID du profil>`
   - Vérifier que les propriétés ne sont pas supprimées ou archivées

---

**Une fois la migration appliquée, recharger `/owner/properties` et vérifier les logs serveur.**

