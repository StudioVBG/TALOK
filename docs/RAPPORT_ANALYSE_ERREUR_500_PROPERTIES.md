# Rapport d'Analyse : Erreur 500 sur GET /api/properties

**Date** : 2025-01-XX  
**Auteur** : Assistant IA  
**Problème** : Erreur 500 persistante sur `GET /api/properties` malgré multiples modifications

---

## 🔍 Résumé Exécutif

L'endpoint `GET /api/properties` retourne systématiquement une erreur 500 Internal Server Error, empêchant l'affichage des propriétés sur le frontend. Malgré plusieurs tentatives de correction (ajout de logs, simplification du code, gestion d'erreur améliorée), l'erreur persiste.

**Symptômes observés** :
- Frontend : `GET http://localhost:3000/api/properties 500 (Internal Server Error)`
- Message d'erreur : `{ error: 'Erreur lors de la récupération des propriétés', details: {…} }`
- Aucun log serveur visible dans les messages utilisateur

---

## 📋 Modifications Appliquées

### 1. Ajout de Logs Détaillés

**Fichier** : `app/api/properties/route.ts`

**Modifications** :
- Ajout de `console.log` à chaque étape critique (lignes 25, 33, 40, 76, 118, 125, 155, 166, 180, 186, 205, 213, 230, 238, 276, 286, 319, 373, 399)
- Ajout de `console.error` pour toutes les erreurs (lignes 49, 63, 83, 107, 137, 189, 298, 321, 360, 376, 423)

**Justification** : Permettre de tracer l'exécution et identifier précisément où l'erreur se produit.

**Résultat** : ❌ Les logs serveur ne sont pas disponibles dans les retours utilisateur, donc impossible de savoir où l'erreur se produit.

---

### 2. Simplification de la Gestion des Promises

**Fichier** : `app/api/properties/route.ts`

**Modifications** :
- **Avant** : Utilisation de `Promise.race` avec timeouts complexes (lignes 48-55, 95-104, 143-153, 160-170, 213-218)
- **Après** : Requêtes Supabase directes avec destructuration `{ data, error }` (lignes 119-123, 206-211, 223-228, 284)

**Code avant** :
```typescript
const authPromise = getAuthenticatedUser(request);
const authTimeout = new Promise<{ user: null; error: { message: string; status: number }; supabase: null }>((resolve) => {
  setTimeout(() => {
    resolve({ user: null, error: { message: "Auth timeout", status: 504 }, supabase: null });
  }, AUTH_TIMEOUT);
});

const { user, error, supabase } = await Promise.race([authPromise, authTimeout]);
```

**Code après** :
```typescript
const authResult = await getAuthenticatedUser(request);
user = authResult.user;
const authError = authResult.error;
supabase = authResult.supabase;
```

**Justification** : Les `Promise.race` avec structures différentes causaient des problèmes de typage et d'extraction de données. La destructuration directe est plus simple et alignée avec les autres routes API du projet.

**Résultat** : ❌ L'erreur 500 persiste toujours.

---

### 3. Alignement avec les Autres Routes API

**Fichier** : `app/api/properties/route.ts`

**Comparaison avec** : `app/api/search/route.ts`, `app/api/charges/route.ts`, `app/api/tickets/[id]/route.ts`

**Modifications** :
- Utilisation de la destructuration directe `{ data, error }` au lieu de `(queryResult as any)?.data`
- Suppression des try/catch inutiles autour des requêtes Supabase
- Gestion d'erreur via le champ `error` de la réponse Supabase

**Exemple de code aligné** :
```typescript
// Ligne 119-123 : Récupération du profil
const { data: profile, error: profileError } = await dbClient
  .from("profiles")
  .select("id, role")
  .eq("user_id", user.id)
  .single();
```

**Justification** : Cohérence avec le reste du codebase. Les autres routes API utilisent cette approche et fonctionnent correctement.

**Résultat** : ❌ L'erreur 500 persiste toujours.

---

### 4. Correction des Types TypeScript

**Fichier** : `app/api/properties/route.ts`

**Modifications** :
- Ligne 237 : Correction de `[...new Set(...)]` en `Array.from(new Set(...))` pour éviter les erreurs de compilation TypeScript avec `--downlevelIteration`

**Code corrigé** :
```typescript
const propertyIds = Array.from(new Set(leases.map((l) => l.property_id).filter(Boolean) as string[]));
```

**Justification** : Erreur de compilation TypeScript détectée lors de la vérification.

**Résultat** : ✅ Erreur de compilation corrigée, mais l'erreur 500 runtime persiste.

---

### 5. Amélioration de la Gestion d'Erreur Globale

**Fichier** : `app/api/properties/route.ts`

**Modifications** :
- Lignes 421-455 : Ajout d'une gestion d'erreur globale avec capture de toutes les propriétés de l'erreur
- Retour d'un JSON détaillé avec `errorDetails` incluant `message`, `code`, `details`, `hint`, `stack`, `allProperties`

**Code ajouté** :
```typescript
const errorDetails = {
  message: error instanceof Error ? error.message : String(error),
  name: error instanceof Error ? error.name : undefined,
  code: (error as any)?.code,
  details: (error as any)?.details,
  hint: (error as any)?.hint,
  stack: error instanceof Error ? error.stack : undefined,
  allProperties: error instanceof Error ? Object.getOwnPropertyNames(error).reduce((acc, key) => {
    acc[key] = (error as any)[key];
    return acc;
  }, {} as Record<string, any>) : undefined,
};
```

**Justification** : Capturer tous les détails de l'erreur pour faciliter le diagnostic.

**Résultat** : ❌ L'erreur 500 persiste, mais maintenant avec plus de détails théoriquement disponibles (non visibles dans les logs navigateur).

---

## 🔎 Analyse Comparative avec les Routes Fonctionnelles

### Route Fonctionnelle : `app/api/search/route.ts`

**Points clés** :
1. Utilise `createClient()` de `@/lib/supabase/server` (ligne 10)
2. Utilise `getTypedSupabaseClient()` pour obtenir un client typé (ligne 11)
3. Pas de service role key explicite
4. Requêtes simples avec destructuration directe

**Code** :
```typescript
const supabase = await createClient();
const supabaseClient = getTypedSupabaseClient(supabase);
const { data: profile } = await supabaseClient
  .from("profiles")
  .select("id, role")
  .eq("user_id", user.id as any)
  .single();
```

### Route Problématique : `app/api/properties/route.ts`

**Points clés** :
1. Crée un client avec `SUPABASE_SERVICE_ROLE_KEY` (lignes 98-104)
2. Bypass RLS avec service role
3. Même structure de requête que les autres routes

**Code** :
```typescript
const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
dbClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

**Différence critique** : La route `/api/properties` utilise un **service client** (bypass RLS) alors que les autres routes utilisent le **client utilisateur** (avec RLS).

---

## 🎯 Hypothèses sur la Cause Racine

### Hypothèse 1 : Erreur lors de la Création du Client Supabase

**Évidence** :
- Ligne 98-104 : Création dynamique du client avec `await import("@supabase/supabase-js")`
- Si l'import échoue ou si la création du client échoue, cela pourrait causer une erreur 500

**Test suggéré** : Vérifier si `@supabase/supabase-js` est bien installé et accessible

---

### Hypothèse 2 : Erreur lors de la Requête Properties

**Évidence** :
- Ligne 284 : `await baseQuery.range(offset, offset + limit - 1)`
- Si la requête Supabase échoue (RLS, colonne manquante, etc.), cela retourne une erreur 500

**Test suggéré** : Vérifier les logs serveur pour voir le message d'erreur exact de Supabase

---

### Hypothèse 3 : Erreur dans la Validation des Query Params

**Évidence** :
- Lignes 31-37 : Validation avec `validateQueryParams(propertiesQuerySchema, url.searchParams)`
- Si la validation échoue de manière inattendue, cela pourrait causer une erreur

**Test suggéré** : Tester avec des query params vides pour isoler le problème

---

### Hypothèse 4 : Problème avec le Type `ProfileData`

**Évidence** :
- Ligne 119 : `const { data: profile, error: profileError } = await dbClient.from("profiles").select("id, role").eq("user_id", user.id).single()`
- Le type `ProfileData` attend `user_id` mais on sélectionne seulement `id, role`
- Type mismatch possible

**Test suggéré** : Vérifier si le type retourné correspond au type attendu

---

## 🔧 Solution Proposée : Approche Radicalement Différente

### Option A : Utiliser le Client Utilisateur au lieu du Service Client

**Justification** : Toutes les autres routes API fonctionnent avec le client utilisateur. Le service client pourrait causer des problèmes inattendus.

**Code proposé** :
```typescript
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    let query = supabase
      .from("properties")
      .select("id, owner_id, type, type_bien, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_base, created_at, etat")
      .order("created_at", { ascending: false });

    if (profile.role === "owner") {
      query = query.eq("owner_id", profile.id);
    }

    const { data: properties, error } = await query;

    if (error) {
      console.error("[GET /api/properties] Supabase error:", error);
      return NextResponse.json(
        {
          error: "Erreur lors de la récupération des propriétés",
          details: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        properties: properties || [],
        pagination: {
          page: 1,
          limit: properties?.length || 0,
          total: properties?.length || 0,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[GET /api/properties] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
```

**Avantages** :
- ✅ Cohérent avec les autres routes API
- ✅ Plus simple (moins de code)
- ✅ Utilise RLS au lieu de bypasser avec service role
- ✅ Moins de points de défaillance

---

### Option B : Endpoint de Diagnostic Complet

**Fichier** : `app/api/properties/test/route.ts` (déjà créé)

**Utilisation** : Tester chaque étape isolément pour identifier où ça bloque

**Accès** : `http://localhost:3000/api/properties/test`

---

## 📊 Tableau Récapitulatif des Modifications

| # | Modification | Justification | Résultat |
|---|-------------|--------------|----------|
| 1 | Ajout de logs détaillés | Tracer l'exécution | ❌ Logs serveur non disponibles |
| 2 | Suppression de `Promise.race` | Simplifier et corriger le typage | ❌ Erreur 500 persiste |
| 3 | Alignement avec autres routes | Cohérence du codebase | ❌ Erreur 500 persiste |
| 4 | Correction TypeScript `Set` | Erreur de compilation | ✅ Compilation OK, runtime ❌ |
| 5 | Gestion d'erreur améliorée | Capturer tous les détails | ❌ Erreur 500 persiste |

---

## 🎯 Conclusion et Recommandations

### Problème Identifié

Toutes les modifications appliquées n'ont pas résolu l'erreur 500 car **la cause racine n'a pas été identifiée**. Sans accès aux logs serveur, il est impossible de savoir où exactement l'erreur se produit.

### Actions Immédiates Requises

1. **Vérifier les logs serveur** : Dans le terminal où `npm run dev` est lancé, rechercher les logs `[GET /api/properties]`
2. **Tester l'endpoint de diagnostic** : Accéder à `http://localhost:3000/api/properties/test` pour isoler le problème
3. **Comparer avec une route fonctionnelle** : Vérifier pourquoi `/api/search` fonctionne mais `/api/properties` ne fonctionne pas

### Solution Recommandée

**Réécrire complètement le handler GET** en utilisant l'approche de `app/api/search/route.ts` :
- Utiliser `createClient()` au lieu de créer un service client
- Laisser RLS gérer les permissions au lieu de bypasser avec service role
- Simplifier au maximum le code

### Fichiers à Modifier

1. `app/api/properties/route.ts` - Réécrire la fonction `GET` avec l'approche simplifiée
2. Tester avec l'endpoint `/api/properties/test` pour valider chaque étape

---

## 📝 Notes Techniques

### Points d'Attention

1. **Service Role vs User Client** : Le service role bypass RLS, ce qui peut causer des problèmes si les policies RLS sont mal configurées
2. **Type Safety** : Les types `ProfileData` et `PropertyData` doivent correspondre exactement aux données retournées par Supabase
3. **Gestion d'Erreur** : Toutes les erreurs doivent être catchées et retournées avec un JSON clair

### Prochaines Étapes

1. Obtenir les logs serveur pour identifier la cause exacte
2. Implémenter la solution Option A (client utilisateur)
3. Tester avec différents rôles (admin, owner, tenant)
4. Vérifier que les propriétés s'affichent correctement sur le frontend

---

**Fin du Rapport**

