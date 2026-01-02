# 🔍 RAPPORT DE DIAGNOSTIC COMPLET - GESTION LOCATIVE

**Date** : 19 novembre 2025  
**Utilisateur** : contact.explore.mq@gmail.com  
**Profile ID** : `3b9280bc-061b-4880-a5e1-57d3f7ab06e5`  
**User ID** : `5dc8def9-8b36-41d4-af81-e898fb893927`

---

## ✅ CE QUI FONCTIONNE

### 1. Authentification ✅
- ✅ Utilisateur connecté avec succès
- ✅ Session Supabase active
- ✅ Dernière connexion : 19 novembre 2025 18:46:48 UTC
- ✅ Email confirmé

### 2. Profil utilisateur ✅
- ✅ Profile existe dans la base
- ✅ Rôle : `owner` (propriétaire)
- ⚠️ **Prénom et nom** : NULL (pas renseignés)

### 3. Propriétés dans la base ✅
- ✅ **10 propriétés** créées pour cet utilisateur
- ✅ `owner_id` correctement assigné : `3b9280bc-061b-4880-a5e1-57d3f7ab06e5`
- ✅ Toutes les propriétés ont le statut `draft`

**Liste des propriétés** :
1. `23aa5434-6543-4581-952e-2d176b6ff4c3` - Maison (19/11/2025 20:00)
2. `be18c3ad-2926-42b7-98e7-4589889841c3` - Appartement (19/11/2025 07:13)
3. `11232d26-9501-439d-8604-19b115ea77f3` - Appartement (19/11/2025 07:12)
4. `57f730e4-d01b-4014-a6cc-4ca1ef79bbdb` - Appartement (19/11/2025 05:06)
5. `a99c73dc-e86b-4462-af41-0f3e2976fb7b` - Entrepôt - La Trinité (19/11/2025 02:08)
6. `f472e2d5-9ba7-457b-9026-d8ae6730e1f6` - Parking - La Trinité (19/11/2025 01:38)
7. `ecb45b83-4f82-4afa-b780-a1c124102ffc` - Box - La Trinité (19/11/2025 01:19)
8. `353f270e-5783-4b2b-848a-8fd0f3bdf020` - Local commercial - La Trinité (19/11/2025 00:52)
9. `d924c091-6937-4081-83ed-30819cf0937a` - Local commercial (19/11/2025 00:49)
10. `54b0fa90-b10b-453a-ba51-c512986f768d` - Local commercial (19/11/2025 00:49)

### 4. RLS Policies ✅
- ✅ 6 politiques RLS actives sur la table `properties`
- ✅ Fonction `user_profile_id()` définie correctement
- ✅ Fonction `user_role()` définie correctement
- ✅ Les politiques utilisent `public.user_profile_id()` au lieu de `auth.uid()`

### 5. APIs Backend ✅
- ✅ API `/api/owner/properties` fonctionne (retourne 200)
- ✅ API `/api/properties` fonctionne (retourne 200)
- ✅ Les propriétés sont bien récupérées via l'API
- ✅ Les photos sont récupérées via la table `photos` (retourne 200)

---

## ❌ PROBLÈMES CRITIQUES IDENTIFIÉS

### 🔴 PROBLÈME #1 : Colonnes manquantes dans le schéma de la base

#### Table `properties`
L'API essaie de récupérer des colonnes qui **N'EXISTENT PAS** dans le schéma :

**Colonnes demandées par l'API** (dans `fetchPropertyDetails.ts`) :
```typescript
const essentialColumns = "id, owner_id, type, adresse_complete, code_postal, ville, 
surface, nb_pieces, loyer_hc, created_at, etat, 
nb_chambres, meuble, dpe_classe_energie, dpe_classe_climat";
```

**Colonnes qui EXISTENT dans la base** :
- ✅ `nb_chambres` (existe)
- ✅ `meuble` (existe)
- ❌ `dpe_classe_energie` (N'EXISTE PAS !)
- ❌ `dpe_classe_climat` (N'EXISTE PAS !)

**Colonnes qui existent à la place** :
- ✅ `energie` (type TEXT)
- ✅ `ges` (type TEXT)

**Impact** : Les requêtes SQL retournent **400 Bad Request** car elles référencent des colonnes inexistantes.

---

#### Table `documents`
L'API essaie de récupérer des colonnes qui **N'EXISTENT PAS** dans le schéma :

**Colonnes demandées par l'API** (dans `fetchPropertyMedia`) :
```typescript
.select("id, property_id, preview_url, is_cover, created_at")
.eq("collection", "property_media")
```

**Colonnes qui EXISTENT réellement dans la base** :
```
id, type, owner_id, tenant_id, property_id, lease_id, 
storage_path, metadata, created_at, updated_at
```

**Colonnes manquantes** :
- ❌ `preview_url` (N'EXISTE PAS !)
- ❌ `is_cover` (N'EXISTE PAS !)
- ❌ `collection` (N'EXISTE PAS !)
- ❌ `position` (N'EXISTE PAS !)

**Impact** : Les requêtes SQL retournent **400 Bad Request**.

---

### 🔴 PROBLÈME #2 : Erreurs 500 sur la table `leases`

Les logs Supabase montrent :
```
GET /rest/v1/leases?select=*&order=created_at.desc&property_id=in.(...)
→ 500 Internal Server Error
```

**Cause probable** : 
- RLS policy sur la table `leases` qui cause une récursion infinie
- OU erreur dans une politique RLS qui bloque l'accès

---

### 🔴 PROBLÈME #3 : Page de détail d'une propriété spécifique

L'utilisateur essaie d'accéder à :
```
/owner/properties/23aa5434-6543-4581-952e-2d176b6ff4c3
```

Cette page appelle `fetchPropertyDetails()` qui essaie de :
1. ✅ Récupérer la propriété (FONCTIONNE)
2. ❌ Récupérer les baux → **500 Error**
3. ❌ Récupérer les documents avec `preview_url`, `is_cover`, `collection` → **400 Error**
4. ❌ Récupérer les propriétés avec `dpe_classe_energie`, `dpe_classe_climat` → **400 Error**

**Résultat** : La page affiche "Propriété non trouvée" alors que la propriété existe.

---

### ⚠️ PROBLÈME #4 : Liste des propriétés (`/owner/properties`)

La page `/owner/properties` (liste de tous les biens) devrait afficher les 10 propriétés mais :
- ✅ Les propriétés sont récupérées via `/api/owner/properties`
- ✅ Les photos sont récupérées
- ❌ Les baux (`leases`) retournent une erreur 500
- ❌ Les documents retournent une erreur 400

**Résultat probable** : La liste s'affiche mais avec des erreurs en cascade dans la console et potentiellement des données manquantes (statut "loué/vacant" incorrect).

---

## 🔧 SOLUTIONS DÉTAILLÉES

### ✅ SOLUTION #1 : Corriger les colonnes dans `fetchPropertyDetails.ts`

**Fichier** : `/app/owner/_data/fetchPropertyDetails.ts`

**Ligne 22** - Remplacer :
```typescript
const essentialColumns = "id, owner_id, type, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_hc, created_at, etat, nb_chambres, meuble, dpe_classe_energie, dpe_classe_climat";
```

**Par** :
```typescript
const essentialColumns = "id, owner_id, type, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_hc, created_at, etat, nb_chambres, meuble, energie, ges";
```

---

### ✅ SOLUTION #2 : Supprimer la récupération des documents avec colonnes inexistantes

**Fichier** : `/app/owner/_data/fetchPropertyDetails.ts`

**Lignes 55-56** - Commenter ou supprimer :
```typescript
// Documents (table documents - pour fallback photos)
// supabase.from("documents").select("*").eq("property_id", propertyId).eq("collection", "property_media")
```

**Ou créer les colonnes manquantes** dans la table `documents` via une migration SQL :
```sql
-- Migration : Ajouter les colonnes manquantes à documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS preview_url TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_cover BOOLEAN DEFAULT FALSE;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS collection TEXT DEFAULT 'general';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
```

---

### ✅ SOLUTION #3 : Corriger les colonnes dans l'API `/api/owner/properties`

**Fichier** : `/app/api/owner/properties/route.ts`

Pas de problème ici, l'API utilise déjà les bonnes colonnes.

---

### ✅ SOLUTION #4 : Diagnostiquer l'erreur 500 sur `leases`

**Action** : Activer les logs SQL détaillés pour identifier la politique RLS problématique.

**Vérifier** :
```sql
-- Lister toutes les politiques sur leases
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'leases'
ORDER BY policyname;
```

**Cause probable** : Politique RLS avec une sous-requête récursive ou qui appelle une fonction qui elle-même interroge `leases`.

---

### ✅ SOLUTION #5 : Ajouter les colonnes DPE manquantes (optionnel)

Si vous préférez utiliser `dpe_classe_energie` et `dpe_classe_climat` au lieu de `energie` et `ges` :

```sql
-- Migration : Ajouter les colonnes DPE
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS dpe_classe_energie TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS dpe_classe_climat TEXT;

-- Optionnel : Migrer les données existantes
UPDATE public.properties SET dpe_classe_energie = energie, dpe_classe_climat = ges;
```

---

## 📊 RÉSUMÉ DES ACTIONS À PRENDRE

| # | Action | Fichier | Priorité | Impact |
|---|--------|---------|----------|--------|
| 1 | Remplacer `dpe_classe_energie, dpe_classe_climat` par `energie, ges` | `app/owner/_data/fetchPropertyDetails.ts` ligne 22 | 🔴 CRITIQUE | Corrige l'erreur 400 sur la page de détail |
| 2 | Supprimer ou corriger la requête `documents` avec `preview_url`, `is_cover`, `collection` | `app/owner/_data/fetchPropertyDetails.ts` lignes 55-56 | 🔴 CRITIQUE | Corrige l'erreur 400 sur les documents |
| 3 | Diagnostiquer l'erreur 500 sur `leases` | Base de données Supabase | 🔴 CRITIQUE | Permet de récupérer les baux |
| 4 | Ajouter les colonnes manquantes à `documents` (optionnel) | Migration SQL | 🟡 MOYEN | Permet de réutiliser les documents comme fallback |
| 5 | Ajouter les colonnes DPE (optionnel) | Migration SQL | 🟢 FAIBLE | Alignement du code avec le schéma |

---

## 🧪 TESTS À EFFECTUER APRÈS CORRECTION

### Test 1 : Page de détail d'une propriété
```
URL : http://localhost:3000/owner/properties/23aa5434-6543-4581-952e-2d176b6ff4c3
Résultat attendu : Affichage des détails de la propriété (pas "Propriété non trouvée")
```

### Test 2 : Liste des propriétés
```
URL : http://localhost:3000/owner/properties
Résultat attendu : Affichage des 10 propriétés avec leurs photos
```

### Test 3 : Console du navigateur
```
Résultat attendu : Aucune erreur 400 ou 500 dans la console
```

---

## 📌 CONCLUSION

**Cause racine du problème** : **Décalage entre le schéma de la base de données et le code TypeScript**.

Le code essaie d'accéder à des colonnes qui n'existent pas (`dpe_classe_energie`, `dpe_classe_climat`, `preview_url`, `is_cover`, `collection`), ce qui provoque des erreurs 400.

**Les données EXISTENT** (10 propriétés), mais **le code ne peut pas les récupérer correctement** à cause de ces erreurs SQL.

**Solution rapide** (15 minutes) :
1. Corriger les noms de colonnes dans `fetchPropertyDetails.ts`
2. Commenter la récupération des documents
3. Redémarrer le serveur Next.js

**Solution complète** (1 heure) :
1. Appliquer toutes les corrections ci-dessus
2. Créer une migration SQL pour ajouter les colonnes manquantes
3. Diagnostiquer l'erreur 500 sur les baux
4. Tester toutes les pages

---

**Statut** : 🔴 **Application non fonctionnelle** - Nécessite des corrections CRITIQUES.

