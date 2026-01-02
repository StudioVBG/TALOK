# Rapport Final de Diagnostic : Erreur 500 sur GET /api/properties

**Date** : 2025-01-XX  
**Problème** : Erreur 500 persistante sur `GET /api/properties`  
**Statut** : En attente des logs serveur pour diagnostic précis

---

## 📋 Résumé Exécutif

L'endpoint `GET /api/properties` retourne une erreur 500 alors que d'autres routes API utilisant la même méthode de connexion (`createClient()` de `lib/supabase/server.ts`) fonctionnent correctement.

**Routes fonctionnelles utilisant la même méthode** :
- ✅ `/api/owner/dashboard` - FONCTIONNE
- ✅ `/api/search` - FONCTIONNE  
- ✅ `/api/charges` - FONCTIONNE

**Route problématique** :
- ❌ `/api/properties` - ERREUR 500

---

## 🔍 Analyse Comparative des Routes

### **Architecture Commune**

Toutes les routes fonctionnelles utilisent :
```typescript
const supabase = await createClient(); // lib/supabase/server.ts
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase.from("profiles").select("id, role").eq("user_id", user.id).single();
```

**`/api/properties` utilise exactement la même méthode**, donc le problème n'est pas dans la création du client.

---

## 📊 Comparaison Détaillée des Requêtes

### **`/api/owner/dashboard` (FONCTIONNE)**

```typescript
const { data: properties } = await supabase
  .from("properties")
  .select("id, type, type_bien, adresse_complete, surface, nb_pieces")
  .eq("owner_id", ownerId);
```

**Colonnes sélectionnées** : `id, type, type_bien, adresse_complete, surface, nb_pieces`

---

### **`/api/properties` (ERREUR 500)**

```typescript
query = supabase
  .from("properties")
  .select("id, owner_id, type, type_bien, adresse_complete, surface, nb_pieces, created_at")
  .eq("owner_id", profile.id)
  .order("created_at", { ascending: false });
```

**Colonnes sélectionnées** : `id, owner_id, type, type_bien, adresse_complete, surface, nb_pieces, created_at`

**Différences** :
- ✅ `/api/properties` sélectionne `owner_id` et `created_at` en plus
- ⚠️ Ces colonnes devraient exister dans toutes les bases de données

---

## 🎯 Points de Défaillance Potentiels

### **1. Colonnes Manquantes**

**Hypothèse** : Une des colonnes sélectionnées n'existe pas dans la table `properties`

**Colonnes à vérifier** :
- `id` ✅ (doit exister)
- `owner_id` ✅ (doit exister)
- `type` ✅ (doit exister)
- `type_bien` ⚠️ (peut ne pas exister dans certaines bases)
- `adresse_complete` ✅ (doit exister)
- `surface` ✅ (doit exister)
- `nb_pieces` ✅ (doit exister)
- `created_at` ✅ (doit exister)

**Action** : Vérifier le schéma de la table `properties` dans Supabase

---

### **2. Erreur RLS (Row Level Security)**

**Hypothèse** : Les policies RLS bloquent l'accès aux propriétés

**Vérification** :
- Les autres routes fonctionnent avec RLS activé
- `/api/owner/dashboard` interroge aussi `properties` et fonctionne
- La différence peut être dans l'ordre des colonnes ou la requête `.order()`

**Action** : Vérifier les policies RLS sur la table `properties`

---

### **3. Erreur lors de l'Exécution de la Requête**

**Hypothèse** : L'erreur se produit lors de l'exécution de la requête Supabase

**Vérification** : Les logs serveur doivent révéler l'erreur exacte

**Action** : **PARTAGER LES LOGS SERVEUR** du terminal où `npm run dev` tourne

---

## 📝 Logs Attendus dans le Terminal Serveur

Quand vous accédez à `/api/properties`, vous devriez voir dans le terminal où `npm run dev` tourne :

```
[api/properties] ▶️ handler called
[api/properties] 📦 Step 1: Creating Supabase client
[api/properties] ✅ Step 1: Client created successfully
[api/properties] 🔐 Step 2: Getting user
[api/properties] Step 2 result: { hasUser: true, userId: '...', hasError: false, errorMessage: undefined }
[api/properties] ✅ Step 2: User authenticated
[api/properties] 👤 Step 3: Fetching profile for user: ...
[api/properties] Step 3 result: { hasProfile: true, profileId: '...', role: 'owner', hasError: false, ... }
[api/properties] ✅ Step 3: Profile found
[api/properties] 🔍 Step 4: Building query for role: owner
[api/properties] Step 4: Building owner query with ownerId: ...
[api/properties] 🚀 Step 5: Executing properties query
[api/properties] Supabase response { dataLength: ..., hasError: true, error: { message: '...', code: '...', ... } }
[api/properties] ❌ Step 5 failed: Supabase error
```

**OU** (si erreur avant l'étape 5) :
```
[api/properties] ❌ Step X failed: ...
```

---

## 🚨 Actions Immédiates Requises

### **Action 1 : Partager les Logs Serveur** ⚠️ CRITIQUE

**Comment faire** :
1. Ouvrir le terminal où `npm run dev` tourne
2. Accéder à `http://localhost:3000/owner/properties` dans le navigateur
3. Copier TOUS les logs qui commencent par `[api/properties]`
4. Partager ces logs

**Sans ces logs, il est impossible d'identifier précisément où l'erreur se produit.**

---

### **Action 2 : Tester l'Endpoint de Diagnostic**

**URL** : `http://localhost:3000/api/debug/properties`

**Comment faire** :
1. Ouvrir cette URL dans le navigateur (avec authentification)
2. Copier le JSON retourné
3. Partager ce JSON

**Ce endpoint teste chaque étape isolément et retourne des informations détaillées.**

---

### **Action 3 : Simplifier la Requête pour Test**

**Modification proposée** dans `app/api/properties/route.ts` :

```typescript
// Ligne 125-129 : Modifier pour utiliser exactement les mêmes colonnes que /api/owner/dashboard
query = supabase
  .from("properties")
  .select("id, type, type_bien, adresse_complete, surface, nb_pieces") // Retirer owner_id et created_at
  .eq("owner_id", profile.id)
  .order("created_at", { ascending: false }); // Garder l'ordre même si created_at n'est pas sélectionné
```

**OU** (test encore plus simple) :
```typescript
query = supabase
  .from("properties")
  .select("id, adresse_complete") // Colonnes minimales
  .eq("owner_id", profile.id);
```

---

### **Action 4 : Vérifier le Schéma de la Table**

**Dans Supabase Dashboard** :
1. Aller dans "Table Editor"
2. Ouvrir la table `properties`
3. Vérifier que toutes les colonnes suivantes existent :
   - `id`
   - `owner_id`
   - `type`
   - `type_bien` (peut ne pas exister)
   - `adresse_complete`
   - `surface`
   - `nb_pieces`
   - `created_at`

---

## 📋 Checklist de Diagnostic

- [ ] **Logs serveur partagés** - ⚠️ CRITIQUE
- [ ] **Endpoint `/api/debug/properties` testé** - JSON partagé
- [ ] **Schéma de la table `properties` vérifié** - Toutes les colonnes existent
- [ ] **Requête simplifiée testée** - Utiliser les mêmes colonnes que `/api/owner/dashboard`
- [ ] **Policies RLS vérifiées** - Sur la table `properties`

---

## 🔧 Solutions Proposées

### **Solution 1 : Simplifier la Requête (Test)**

Modifier `/api/properties` pour utiliser exactement les mêmes colonnes que `/api/owner/dashboard` qui fonctionne.

**Avantage** : Test rapide pour identifier si le problème vient des colonnes

**Inconvénient** : Perd certaines informations (owner_id, created_at)

---

### **Solution 2 : Ajouter Gestion d'Erreur pour Colonnes Manquantes**

Ajouter un try/catch autour de la requête et détecter les erreurs de colonnes manquantes.

**Avantage** : Gestion robuste des différences de schéma

**Inconvénient** : Ne résout pas le problème racine

---

### **Solution 3 : Utiliser Service Role (Comme `/api/leases`)**

Utiliser un service client au lieu du client utilisateur pour contourner RLS.

**Avantage** : Contourne les problèmes RLS

**Inconvénient** : Contourne la sécurité RLS (non recommandé)

---

## 📊 Fichiers Créés pour le Diagnostic

1. **`docs/RAPPORT_CHAINE_FICHIERS_PROPERTIES.md`** - Chaîne complète des fichiers impliqués
2. **`docs/RAPPORT_DIAGNOSTIC_COMPLET_ROUTES.md`** - Comparaison de toutes les routes API
3. **`scripts/diagnostic-routes-api.ts`** - Script de diagnostic automatique
4. **`docs/RAPPORT_FINAL_DIAGNOSTIC_PROPERTIES.md`** - Ce rapport

---

## 🎯 Conclusion

**Le problème n'est PAS dans** :
- ✅ La création du client Supabase (`createClient()` fonctionne pour les autres routes)
- ✅ L'authentification (les autres routes fonctionnent)
- ✅ La récupération du profil (les autres routes fonctionnent)

**Le problème est probablement dans** :
- ❓ La requête Supabase elle-même (colonnes manquantes ou erreur RLS)
- ❓ Une erreur non catchée dans le code

**Action immédiate requise** :
1. **PARTAGER LES LOGS SERVEUR** du terminal où `npm run dev` tourne
2. Tester l'endpoint `/api/debug/properties` et partager le JSON
3. Vérifier le schéma de la table `properties` dans Supabase

**Sans les logs serveur, il est impossible d'identifier précisément la cause de l'erreur 500.**

---

**Fin du Rapport**

