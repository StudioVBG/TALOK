# 🔍 DEBUG FLUX DE DONNÉES - Propriétés non visibles

**Problème** : Les logs client montrent toujours `0 propriétés affichées` malgré les corrections

---

## 📋 POINTS DE VÉRIFICATION

### 1. Logs SERVEUR (Terminal `npm run dev`)

**À chercher après rechargement de `/app/owner/properties`** :

```
[fetchProperties] Début - ownerId: ...
[fetchProperties] Utilisateur authentifié: ...
[fetchProperties] Profil trouvé: id=..., role=...
[fetchProperties] ✅ Requête directe réussie: X propriétés trouvées
[OwnerLayout] ✅ Propriétés chargées: X
[OwnerLayout] Données passées au OwnerDataProvider: { propertiesCount: X, ... }
```

**OU si erreur** :
```
[fetchProperties] ❌ Erreur requête directe: ...
[OwnerLayout] ❌ ERREUR lors du chargement des propriétés: ...
```

---

### 2. Logs CLIENT (Console navigateur)

**Logs attendus** :

```
[OwnerDataProvider] Données reçues: { propertiesCount: X, ... }
[PropertiesPageClient] Données reçues du Context: { propertiesCount: X, ... }
[PropertiesPageClient] Avant filtrage: { totalProperties: X, ... }
[PropertiesPageClient] ✅ Après tous les filtres: X propriétés affichées
```

**Si `propertiesCount: 0`** :
- Le Context reçoit un tableau vide du layout
- Vérifier les logs serveur pour voir si `fetchProperties` retourne des données

---

## 🔍 DIAGNOSTIC PAR ÉTAPE

### Étape 1 : fetchProperties (Server Component)

**Fichier** : `app/app/owner/_data/fetchProperties.ts`

**Logs attendus** :
```
[fetchProperties] ✅ Requête directe réussie: X propriétés trouvées
```

**Si erreur** :
- Vérifier que `loyer_hc` existe (corrigé)
- Vérifier que RLS autorise l'accès (corrigé)
- Vérifier que `owner_id` matche `profile.id`

---

### Étape 2 : OwnerLayout (Server Component)

**Fichier** : `app/app/owner/layout.tsx`

**Logs attendus** :
```
[OwnerLayout] ✅ Propriétés chargées: X
[OwnerLayout] Données passées au OwnerDataProvider: { propertiesCount: X, ... }
```

**Si `propertiesCount: 0`** :
- `fetchProperties` retourne un tableau vide
- Vérifier les logs `[fetchProperties]` pour identifier la cause

---

### Étape 3 : OwnerDataProvider (Client Component)

**Fichier** : `app/app/owner/_data/OwnerDataProvider.tsx`

**Logs attendus** :
```
[OwnerDataProvider] Données reçues: { propertiesCount: X, ... }
```

**Si `propertiesCount: 0`** :
- Le layout passe un tableau vide au Provider
- Vérifier les logs `[OwnerLayout]` pour identifier la cause

---

### Étape 4 : PropertiesPageClient (Client Component)

**Fichier** : `app/app/owner/properties/PropertiesPageClient.tsx`

**Logs attendus** :
```
[PropertiesPageClient] Données reçues du Context: { propertiesCount: X, ... }
[PropertiesPageClient] ✅ Après tous les filtres: X propriétés affichées
```

**Si `propertiesCount: 0`** :
- Le Context ne reçoit pas de données du Provider
- Vérifier les logs `[OwnerDataProvider]` pour identifier la cause

---

## 🐛 SCÉNARIOS POSSIBLES

### Scénario A : fetchProperties retourne 0

**Symptôme** : `[fetchProperties] ✅ Requête directe réussie: 0 propriétés trouvées`

**Causes possibles** :
1. Aucune propriété en base avec `owner_id = profile.id`
2. RLS bloque toujours l'accès (malgré la correction)
3. `user_profile_id()` retourne NULL ou un ID différent

**Solution** :
- Vérifier en base : `SELECT * FROM properties WHERE owner_id = '...'`
- Vérifier RLS : `SELECT public.user_profile_id()`
- Comparer avec `profile.id`

---

### Scénario B : Cache Next.js retourne vide

**Symptôme** : `[OwnerLayout] ✅ Propriétés chargées: 0` mais propriétés existent en base

**Causes possibles** :
1. `unstable_cache` retourne un cache vide initial
2. `revalidateTag` ne fonctionne pas
3. Le cache n'a pas été invalidé après création

**Solution** :
- Vider le cache : `rm -rf .next`
- Redémarrer le serveur : `npm run dev`
- Vérifier que `revalidateTag` est appelé après création

---

### Scénario C : Context ne reçoit pas les données

**Symptôme** : `[OwnerDataProvider] Données reçues: { propertiesCount: 0 }` mais layout logge des données

**Causes possibles** :
1. Problème de sérialisation Next.js
2. Erreur dans le Provider
3. Données perdues entre Server et Client Component

**Solution** :
- Vérifier que les données sont bien passées au Provider
- Vérifier qu'il n'y a pas d'erreur de sérialisation

---

## ✅ CHECKLIST DE DEBUG

- [ ] Logs serveur `[fetchProperties]` vérifiés
- [ ] Logs serveur `[OwnerLayout]` vérifiés
- [ ] Logs client `[OwnerDataProvider]` vérifiés
- [ ] Logs client `[PropertiesPageClient]` vérifiés
- [ ] Propriétés existent en base avec `owner_id = profile.id`
- [ ] RLS autorise l'accès (`user_profile_id()` fonctionne)
- [ ] Cache Next.js vidé et serveur redémarré
- [ ] Aucune erreur dans la console serveur
- [ ] Aucune erreur dans la console client

---

## 🚀 ACTIONS IMMÉDIATES

1. **Recharger `/app/owner/properties`**
2. **Copier TOUS les logs serveur** (terminal `npm run dev`)
3. **Copier TOUS les logs client** (console navigateur)
4. **Partager les logs** pour diagnostic précis

---

**Les logs permettront d'identifier exactement où le flux se casse.**

