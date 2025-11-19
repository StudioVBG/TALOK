# 🔧 CORRECTION COMPLÈTE - Visibilité des propriétés

**Date** : 2025-02-18  
**Problème** : Les biens créés n'apparaissent pas dans `/app/owner/properties` et `/app/owner/dashboard`  
**Statut** : ✅ Corrections appliquées - Tests requis

---

## 📋 ANALYSE SYSTÉMATIQUE EFFECTUÉE

### Étape 1 : Localisation de la page et composants ✅

**Page** : `app/app/owner/properties/page.tsx`
- Server Component qui utilise `PropertiesPageClient`
- Message "Aucun bien ne correspond à vos critères" : ligne 398

**Composant Client** : `app/app/owner/properties/PropertiesPageClient.tsx`
- Utilise `useOwnerData()` pour récupérer les données du Context
- Filtres : `searchQuery`, `typeFilter`, `statusFilter`
- Valeurs par défaut : `"all"` ✅ (correct)

**Fetch** : `app/app/owner/_data/fetchProperties.ts`
- Appelé depuis `app/app/owner/layout.tsx`
- Utilise `unstable_cache` avec tag `owner:properties`

### Étape 2 : Inspection du code de récupération ✅

**Requête Supabase** :
```typescript
.eq("owner_id", ownerId)  // ownerId = profile.id
```

**Table** : `properties` ✅  
**Colonne filtre** : `owner_id` ✅  
**Pas de filtre supplémentaire** sur `status`, `is_archived`, etc. ✅

### Étape 3 : Inspection des filtres frontend ✅

**Problème identifié** : Filtre `moduleFilter === "pro"` vérifiait seulement `"commercial"` et `"bureau"`, mais les types créés sont `"local_commercial"` et `"bureaux"`.

**Correction appliquée** :
```typescript
// Avant
return p.type === "commercial" || p.type === "bureau";

// Après
return p.type === "commercial" || p.type === "local_commercial" || 
       p.type === "bureau" || p.type === "bureaux" || 
       p.type === "entrepot" || p.type === "fonds_de_commerce";
```

**Logs ajoutés** : Console logs avant/après chaque filtre pour diagnostic.

### Étape 4 : Vérification du flux de création ✅

**INSERT** : `app/api/properties/route.ts`
- `owner_id: profileId` où `profileId = profile.id` ✅
- Table : `properties` ✅
- État : `etat = "draft"` (pas de filtre sur `etat` dans SELECT) ✅

**Mapping** : ✅ Cohérent
- INSERT : `owner_id = profile.id`
- SELECT : `.eq("owner_id", profile.id)`

### Étape 5 : Vérification du mapping user → owner ✅

**Création** :
- `profile.id` récupéré via `serviceClient.from("profiles").eq("user_id", user.id)`
- `owner_id = profile.id` ✅

**Récupération** :
- `profile.id` récupéré via `supabase.from("profiles").eq("user_id", user.id)`
- `.eq("owner_id", profile.id)` ✅

**Cohérence** : ✅ Parfaitement aligné

### Étape 6 : Vérification RLS ✅

**Migration** : `supabase/migrations/202502180000_rls_properties_units.sql`
- Policy SELECT : `USING (owner_id = public.user_profile_id())` ✅
- `user_profile_id()` retourne `profiles.id` ✅

**Migration de correction** : `supabase/migrations/202502180001_fix_rls_conflicts.sql`
- Supprime toutes les anciennes politiques en conflit
- Recrée les politiques standardisées

**⚠️ ACTION REQUISE** : Appliquer la migration `202502180001_fix_rls_conflicts.sql`

### Étape 7 : Vérification configuration Supabase ✅

**Variables d'environnement** :
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (pour INSERT)

**Cohérence** : ✅ Même projet Supabase utilisé

### Étape 8 : Correctifs appliqués ✅

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Logs de diagnostic complets

**Fichiers modifiés** :
- `app/app/owner/_data/fetchProperties.ts`
- `app/app/owner/layout.tsx`
- `app/app/owner/properties/PropertiesPageClient.tsx`

**Ajouts** :
- Logs à chaque étape de `fetchProperties`
- Diagnostic de `user_profile_id()` RPC
- Détection spécifique des erreurs RLS
- Logs avant/après chaque filtre frontend
- Logs des données brutes reçues du Context

### 2. Correction du filtre commercial

**Fichier** : `app/app/owner/properties/PropertiesPageClient.tsx`

**Problème** : Le filtre `moduleFilter === "pro"` ne matchait pas `"local_commercial"` et `"bureaux"`.

**Correction** : Ajout de tous les types commerciaux possibles.

### 3. Correction du cache Next.js

**Problème** : `unstable_cache` avec `revalidate: 0` ne se rafraîchit pas automatiquement même après `revalidateTag`.

**Solutions appliquées** :

**a) Route API de revalidation** : `app/api/revalidate/route.ts`
- Permet de forcer `revalidatePath` et `revalidateTag` côté serveur
- Appelée depuis le client après création

**b) `revalidatePath` dans POST /api/properties**
- Ajout de `revalidatePath("/app/owner/properties")`
- Ajout de `revalidatePath("/app/owner/dashboard")`
- Ajout de `revalidatePath("/app/owner")`

**c) Appel côté client après création**
- `router.refresh()`
- Appel à `/api/revalidate`
- Redirection avec timestamp pour forcer le rechargement

### 4. Migration SQL pour corriger RLS

**Fichier** : `supabase/migrations/202502180001_fix_rls_conflicts.sql`

**Corrections** :
- Suppression de toutes les anciennes politiques en conflit
- Recréation des politiques standardisées
- Ajout des politiques pour locataires et admins

---

## 🚀 DÉPLOIEMENT

### 1. Appliquer la migration SQL

```bash
# Via Supabase CLI
supabase migration up

# Ou via l'interface Supabase SQL Editor
# Exécuter le contenu de supabase/migrations/202502180001_fix_rls_conflicts.sql
```

### 2. Redémarrer le serveur

```bash
npm run dev
```

### 3. Tester le flux complet

1. **Créer un nouveau bien** via `/app/owner/property/new`
2. **Vérifier les logs serveur** :
   - Chercher `[fetchProperties]` dans la console serveur
   - Vérifier que les propriétés sont trouvées
   - Vérifier qu'il n'y a pas d'erreur RLS
3. **Vérifier les logs client** :
   - Ouvrir la console navigateur (F12)
   - Chercher `[PropertiesPageClient]`
   - Vérifier le nombre de propriétés reçues
   - Vérifier l'effet des filtres
4. **Vérifier l'affichage** :
   - Le bien doit apparaître dans la liste
   - Le bien doit apparaître dans le dashboard

---

## 🔍 DIAGNOSTIC AVEC LES LOGS

### Logs serveur attendus

```
[fetchProperties] Début - ownerId: xxx, options: {...}
[fetchProperties] Utilisateur authentifié: yyy
[fetchProperties] Profil trouvé: id=zzz, role=owner
[fetchProperties] user_profile_id() retourne: zzz
[fetchProperties] Tentative avec RPC owner_properties_with_status...
[fetchProperties] ✅ Requête directe réussie: 1 propriétés trouvées (total: 1)
[fetchProperties] Propriétés trouvées: [{ id: '...', owner_id: '...', adresse: '...' }]
[fetchProperties] ✅ Fin - 1 propriétés retournées (total: 1)
[OwnerLayout] ✅ Propriétés chargées: 1
```

### Logs client attendus

```
[PropertiesPageClient] Données reçues du Context: { propertiesCount: 1, ... }
[PropertiesPageClient] Avant filtrage: { totalProperties: 1, ... }
[PropertiesPageClient] ✅ Après tous les filtres: 1 propriétés affichées
```

### Si problème RLS

```
[fetchProperties] ❌ Erreur requête directe: row-level security policy violation
[fetchProperties] ⚠️ ERREUR RLS DÉTECTÉE
```

**Solution** : Vérifier que `user_profile_id()` retourne bien le bon ID et appliquer la migration RLS.

### Si aucune propriété trouvée

```
[fetchProperties] ⚠️ AUCUNE PROPRIÉTÉ TROUVÉE pour owner_id=xxx
[fetchProperties] Exemples de propriétés en base: [...]
```

**Solution** : Vérifier que `owner_id` du bien créé correspond bien à `profile.id`.

---

## 📊 FICHIERS MODIFIÉS

### Code modifié
- ✅ `app/app/owner/_data/fetchProperties.ts` - Logs détaillés + diagnostic RLS
- ✅ `app/app/owner/layout.tsx` - Logs d'erreur améliorés
- ✅ `app/app/owner/properties/PropertiesPageClient.tsx` - Logs + correction filtre
- ✅ `app/app/owner/property/new/_steps/SummaryStep.tsx` - Revalidation améliorée
- ✅ `app/api/properties/route.ts` - `revalidatePath` ajouté
- ✅ `app/api/revalidate/route.ts` - **NOUVEAU** - Route de revalidation

### Migrations SQL
- ✅ `supabase/migrations/202502180001_fix_rls_conflicts.sql` - **NOUVEAU** - Correction RLS

### Scripts de diagnostic
- ✅ `scripts/diagnose-properties-issue.sql` - **NOUVEAU** - Script SQL de diagnostic
- ✅ `scripts/test-properties-visibility.ts` - **NOUVEAU** - Script TypeScript de test

---

## 🎯 RÉSULTAT ATTENDU

Après application de toutes les corrections :

1. ✅ Les logs montrent clairement où se situe le problème
2. ✅ Les politiques RLS sont cohérentes et fonctionnent
3. ✅ Le cache Next.js est correctement invalidé après création
4. ✅ Les filtres frontend fonctionnent correctement
5. ✅ Les propriétés sont trouvées et affichées correctement

---

## ⚠️ ACTION REQUISE IMMÉDIATE

**APPLIQUER LA MIGRATION SQL** :
```bash
supabase migration up
```

Ou exécuter manuellement dans Supabase SQL Editor :
```sql
-- Contenu de supabase/migrations/202502180001_fix_rls_conflicts.sql
```

---

## 📝 NOTES

- Les logs détaillés permettront d'identifier rapidement la cause exacte si le problème persiste
- Le problème principal était probablement le cache Next.js qui n'était pas invalidé correctement
- La migration RLS corrige les conflits de politiques qui pourraient bloquer l'accès

---

**Prochaine étape** : Appliquer la migration SQL et tester le flux complet.

