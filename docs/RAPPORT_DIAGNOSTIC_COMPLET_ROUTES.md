# Rapport de Diagnostic Complet : Routes API et Connexions aux Données

**Date** : 2025-01-XX  
**Objectif** : Vérifier toutes les routes API et leurs connexions aux données pour identifier les problèmes

---

## 📊 Comparaison des Routes API

### **Routes Fonctionnelles** ✅

#### 1. `/api/owner/dashboard` - ✅ FONCTIONNE

**Fichier** : `app/api/owner/dashboard/route.ts`

**Méthode de connexion** :
```typescript
const supabase = await createClient(); // lib/supabase/server.ts
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase.from("profiles").select("id, role").eq("user_id", user.id).single();
const { data: properties } = await supabase.from("properties").select("id, type, type_bien, adresse_complete, surface, nb_pieces").eq("owner_id", ownerId);
```

**Caractéristiques** :
- ✅ Utilise `createClient()` de `lib/supabase/server.ts`
- ✅ Pas de service role client
- ✅ RLS activé (utilise l'anon key)
- ✅ Sélectionne les mêmes colonnes que `/api/properties` pour les propriétés
- ✅ Pas de logs détaillés

**Statut** : ✅ FONCTIONNE

---

#### 2. `/api/search` - ✅ FONCTIONNE

**Fichier** : `app/api/search/route.ts`

**Méthode de connexion** :
```typescript
const supabase = await createClient(); // lib/supabase/server.ts
const supabaseClient = getTypedSupabaseClient(supabase);
const { data: { user } } = await supabaseClient.auth.getUser();
const { data: profile } = await supabaseClient.from("profiles").select("id, role").eq("user_id", user.id as any).single();
```

**Caractéristiques** :
- ✅ Utilise `createClient()` de `lib/supabase/server.ts`
- ✅ Utilise `getTypedSupabaseClient()` pour le typage
- ✅ Pas de service role client
- ✅ RLS activé

**Statut** : ✅ FONCTIONNE

---

#### 3. `/api/charges` - ✅ FONCTIONNE

**Fichier** : `app/api/charges/route.ts`

**Méthode de connexion** :
```typescript
const supabase = await createClient(); // lib/supabase/server.ts
const { data: { user } } = await supabase.auth.getUser();
let query = supabase.from("charges").select("*").order("created_at", { ascending: false });
```

**Caractéristiques** :
- ✅ Utilise `createClient()` de `lib/supabase/server.ts`
- ✅ Pas de service role client
- ✅ RLS activé
- ✅ Gestion d'erreur avec `handleApiError()`

**Statut** : ✅ FONCTIONNE

---

### **Routes avec Service Role** ⚠️

#### 4. `/api/leases` - ⚠️ UTILISE SERVICE ROLE

**Fichier** : `app/api/leases/route.ts`

**Méthode de connexion** :
```typescript
const { user, error, supabase } = await getAuthenticatedUser(request);
const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const { data: profile } = await serviceClient.from("profiles").select("id, role").eq("user_id", user.id as any).single();
```

**Caractéristiques** :
- ⚠️ Utilise `getAuthenticatedUser()` puis crée un service client
- ⚠️ Contourne RLS avec service role
- ⚠️ Plus complexe mais fonctionne

**Statut** : ⚠️ FONCTIONNE MAIS UTILISE SERVICE ROLE

---

#### 5. `/api/properties/[id]` - ⚠️ UTILISE SERVICE ROLE

**Fichier** : `app/api/properties/[id]/route.ts`

**Méthode de connexion** :
```typescript
const { user, error: authError, supabase } = await getAuthenticatedUser(request);
const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const { data: property } = await serviceClient.from("properties").select("*").eq("id", propertyId).single();
```

**Caractéristiques** :
- ⚠️ Utilise `getAuthenticatedUser()` puis crée un service client
- ⚠️ Contourne RLS avec service role

**Statut** : ⚠️ FONCTIONNE MAIS UTILISE SERVICE ROLE

---

### **Route Problématique** ❌

#### 6. `/api/properties` - ❌ ERREUR 500

**Fichier** : `app/api/properties/route.ts`

**Méthode de connexion** :
```typescript
const supabase = await createClient(); // lib/supabase/server.ts
const { data: { user }, error: authError } = await supabase.auth.getUser();
const { data: profile, error: profileError } = await supabase.from("profiles").select("id, role").eq("user_id", user.id).single();
const { data, error, count } = await query; // query construit selon le rôle
```

**Caractéristiques** :
- ✅ Utilise `createClient()` de `lib/supabase/server.ts` (comme les routes fonctionnelles)
- ✅ Pas de service role client (comme les routes fonctionnelles)
- ✅ RLS activé (comme les routes fonctionnelles)
- ✅ Logs très détaillés (6 étapes)
- ❌ **ERREUR 500**

**Différences avec les routes fonctionnelles** :
1. ✅ Même méthode de connexion que `/api/owner/dashboard` et `/api/search`
2. ✅ Même sélection de colonnes que `/api/owner/dashboard` pour les propriétés
3. ❌ **SEULE DIFFÉRENCE** : Logs très détaillés (mais cela ne devrait pas causer d'erreur)

**Statut** : ❌ ERREUR 500 - CAUSE INCONNUE

---

## 🔍 Analyse des Connexions Supabase

### **Client Supabase Serveur**

**Fichier** : `lib/supabase/server.ts`

**Fonction `createClient()`** :
```typescript
export async function createClient() {
  const cookieStore = await cookies(); // Next.js cookies()
  const { url, anonKey } = getSupabaseConfig();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: any) {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Ignore si appelé depuis Server Component
        }
      },
      remove(name: string, options?: any) {
        try {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        } catch {
          // Ignore
        }
      },
    },
  });
}
```

**Utilisé par** :
- ✅ `/api/owner/dashboard` - FONCTIONNE
- ✅ `/api/search` - FONCTIONNE
- ✅ `/api/charges` - FONCTIONNE
- ❌ `/api/properties` - ERREUR 500

**Conclusion** : Le client Supabase serveur fonctionne correctement pour les autres routes.

---

### **Client Supabase avec Service Role**

**Utilisé par** :
- ⚠️ `/api/leases` - FONCTIONNE
- ⚠️ `/api/properties/[id]` - FONCTIONNE
- ⚠️ `/api/debug/properties` - FONCTIONNE

**Méthode** :
```typescript
const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

**Conclusion** : Les routes utilisant le service role fonctionnent, mais contournent RLS.

---

## 🎯 Hypothèses sur l'Erreur 500

### **Hypothèse 1 : Erreur RLS sur la Table `properties`**

**Symptômes** :
- Les autres routes fonctionnent avec `createClient()`
- `/api/properties` utilise la même méthode
- `/api/owner/dashboard` interroge aussi `properties` et fonctionne

**Vérification** :
- Comparer les requêtes entre `/api/owner/dashboard` et `/api/properties`
- `/api/owner/dashboard` : `.select("id, type, type_bien, adresse_complete, surface, nb_pieces")`
- `/api/properties` (owner) : `.select("id, owner_id, type, type_bien, adresse_complete, surface, nb_pieces, created_at")`

**Différence** : `/api/properties` sélectionne `owner_id` et `created_at` en plus

**Test** : Simplifier la requête `/api/properties` pour utiliser exactement les mêmes colonnes que `/api/owner/dashboard`

---

### **Hypothèse 2 : Erreur lors de la Construction de la Requête**

**Symptômes** :
- Les logs détaillés peuvent révéler où l'erreur se produit
- L'erreur peut se produire avant l'exécution de la requête

**Vérification** :
- Vérifier les logs serveur pour identifier l'étape exacte qui échoue
- Les logs doivent montrer : `[api/properties] ▶️`, `📦`, `🔐`, `👤`, `🔍`, `🚀`

**Action** : Demander les logs serveur complets

---

### **Hypothèse 3 : Colonnes Manquantes dans la Table `properties`**

**Symptômes** :
- Supabase retourne une erreur si une colonne n'existe pas
- L'erreur serait visible dans les logs

**Vérification** :
- Vérifier que toutes les colonnes sélectionnées existent dans la table `properties`
- Colonnes sélectionnées : `id, owner_id, type, type_bien, adresse_complete, surface, nb_pieces, created_at`

**Action** : Vérifier le schéma de la table `properties` dans Supabase

---

### **Hypothèse 4 : Erreur RLS pour les Locataires**

**Symptômes** :
- La logique pour les locataires est plus complexe (3 sous-étapes)
- L'erreur peut se produire lors de la récupération des `lease_signers` ou `leases`

**Vérification** :
- Vérifier les logs pour les étapes `4a`, `4b`, `4c`
- Vérifier les policies RLS sur `lease_signers` et `leases`

**Action** : Tester avec un utilisateur propriétaire vs locataire

---

## 📋 Checklist de Diagnostic

### **1. Vérifier les Logs Serveur**

**Action** : Dans le terminal où `npm run dev` tourne, rechercher :
```
[api/properties] ▶️ handler called
[api/properties] 📦 Step 1: Creating Supabase client
[api/properties] ✅ Step 1: Client created successfully
[api/properties] 🔐 Step 2: Getting user
[api/properties] Step 2 result:
[api/properties] 👤 Step 3: Fetching profile
[api/properties] Step 3 result:
[api/properties] 🔍 Step 4: Building query
[api/properties] 🚀 Step 5: Executing properties query
[api/properties] Supabase response
```

**Résultat attendu** : Identifier l'étape exacte qui échoue

---

### **2. Comparer avec `/api/owner/dashboard`**

**Action** : Simplifier `/api/properties` pour utiliser exactement les mêmes colonnes que `/api/owner/dashboard`

**Modification proposée** :
```typescript
// Avant
.select("id, owner_id, type, type_bien, adresse_complete, surface, nb_pieces, created_at")

// Après (comme /api/owner/dashboard)
.select("id, type, type_bien, adresse_complete, surface, nb_pieces")
```

---

### **3. Tester l'Endpoint de Diagnostic**

**Action** : Accéder à `http://localhost:3000/api/debug/properties` dans le navigateur (avec authentification)

**Résultat attendu** : JSON avec les informations de diagnostic

---

### **4. Vérifier les Variables d'Environnement**

**Action** : Vérifier que les variables suivantes sont définies :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (optionnel pour `/api/properties`)

---

### **5. Vérifier le Schéma de la Table `properties`**

**Action** : Vérifier dans Supabase que toutes les colonnes sélectionnées existent :
- `id` ✅
- `owner_id` ✅
- `type` ✅
- `type_bien` ⚠️ (peut ne pas exister dans certaines bases)
- `adresse_complete` ✅
- `surface` ✅
- `nb_pieces` ✅
- `created_at` ✅

---

## 🚨 Actions Immédiates Requises

1. **PARTAGER LES LOGS SERVEUR** : Les logs du terminal où `npm run dev` tourne sont essentiels pour identifier l'étape exacte qui échoue

2. **TESTER L'ENDPOINT DE DIAGNOSTIC** : Accéder à `http://localhost:3000/api/debug/properties` dans le navigateur (avec authentification)

3. **SIMPLIFIER LA REQUÊTE** : Modifier `/api/properties` pour utiliser exactement les mêmes colonnes que `/api/owner/dashboard` qui fonctionne

4. **VÉRIFIER LE SCHÉMA** : Vérifier dans Supabase que toutes les colonnes sélectionnées existent dans la table `properties`

---

## 📊 Résumé des Différences

| Route | Client | Service Role | RLS | Statut |
|-------|--------|--------------|-----|--------|
| `/api/owner/dashboard` | `createClient()` | ❌ | ✅ | ✅ FONCTIONNE |
| `/api/search` | `createClient()` | ❌ | ✅ | ✅ FONCTIONNE |
| `/api/charges` | `createClient()` | ❌ | ✅ | ✅ FONCTIONNE |
| `/api/properties` | `createClient()` | ❌ | ✅ | ❌ ERREUR 500 |
| `/api/leases` | `getAuthenticatedUser()` + service | ✅ | ❌ | ⚠️ FONCTIONNE |
| `/api/properties/[id]` | `getAuthenticatedUser()` + service | ✅ | ❌ | ⚠️ FONCTIONNE |

**Conclusion** : `/api/properties` utilise la même méthode que les routes fonctionnelles, mais échoue. La cause doit être identifiée via les logs serveur.

---

**Fin du Rapport**

