# 🔍 DEBUG - Erreur "Auth session missing!"

**Date** : 2025-02-18  
**Problème** : Le bouton "Créer le bien" ne fonctionne pas avec l'erreur `{"error":"Auth session missing!"}`

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Parsing des cookies amélioré (`lib/supabase/server.ts`)

**Changements** :
- Utilisation de `Map` pour meilleure performance et recherche O(1)
- Gestion des valeurs URL-encodées avec `decodeURIComponent`
- Parsing plus robuste des cookies avec gestion d'erreurs

**Code** :
```typescript
const parsedCookies = new Map<string, string>();

if (cookieHeader) {
  cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .forEach((cookie) => {
      const separatorIndex = cookie.indexOf("=");
      if (separatorIndex === -1) return;
      
      const name = cookie.substring(0, separatorIndex).trim();
      let value = cookie.substring(separatorIndex + 1).trim();
      
      // Décoder les valeurs URL-encodées si nécessaire
      if (value.includes("%")) {
        value = decodeURIComponent(value);
      }
      
      parsedCookies.set(name, value);
    });
}
```

### 2. Gestion d'erreur améliorée (`lib/helpers/auth-helper.ts`)

**Changements** :
- Logs de débogage en développement pour détecter les cookies manquants
- Message d'erreur plus explicite quand l'utilisateur n'est pas trouvé
- Retour d'erreur structuré avec `status` et `message`

**Code** :
```typescript
// Debug en développement
if (process.env.NODE_ENV === "development") {
  const cookieHeader = request.headers.get("cookie") || "";
  const hasSupabaseCookies = cookieHeader.includes("supabase");
  if (!hasSupabaseCookies) {
    console.warn("[getAuthenticatedUser] Aucun cookie Supabase détecté dans la requête");
  }
}

// Si toujours pas d'utilisateur, retourner une erreur explicite
if (!user) {
  return {
    user: null,
    error: {
      message: authError?.message || "Auth session missing!",
      status: authError?.status || 401,
    },
    supabase: null,
  };
}
```

### 3. Transmission des cookies (`lib/api.ts`)

**Déjà présent** :
- `credentials: "include"` est déjà configuré dans `lib/api.ts`
- Les cookies devraient être transmis automatiquement

---

## 🧪 ÉTAPES DE DÉBOGAGE

### Étape 1 : Vérifier les cookies dans le navigateur

1. Ouvrir les DevTools (F12)
2. Aller dans **Application** > **Cookies** > `http://localhost:3000`
3. Vérifier la présence des cookies Supabase :
   - `sb-<project-ref>-auth-token`
   - `sb-<project-ref>-auth-token-code-verifier`
   - Autres cookies `sb-*`

**Si les cookies sont absents** :
- L'utilisateur n'est pas connecté
- Se reconnecter et réessayer

### Étape 2 : Vérifier les logs serveur

Après avoir redémarré le serveur (`npm run dev`), regarder les logs dans le terminal :

**Logs attendus en cas de problème** :
```
[getAuthenticatedUser] Aucun cookie Supabase détecté dans la requête
[getAuthenticatedUser] Error from getUser(): { message: "...", status: ... }
```

**Si ces logs apparaissent** :
- Les cookies ne sont pas transmis correctement
- Vérifier que `credentials: "include"` est présent dans `lib/api.ts` ✅ (déjà fait)

### Étape 3 : Vérifier la requête réseau

1. Ouvrir les DevTools (F12)
2. Aller dans **Network**
3. Filtrer par "properties"
4. Cliquer sur "Créer le bien"
5. Vérifier la requête `POST /api/properties` :
   - **Request Headers** : Vérifier la présence de `Cookie: ...`
   - **Response** : Vérifier le message d'erreur exact

### Étape 4 : Vérifier la session Supabase côté client

Dans la console du navigateur, exécuter :

```javascript
// Vérifier la session
const { createClient } = await import('/lib/supabase/client');
const supabase = createClient();
const { data: { session }, error } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('Error:', error);
```

**Si `session` est `null`** :
- L'utilisateur n'est pas connecté
- Se reconnecter et réessayer

---

## 🔧 SOLUTIONS POSSIBLES

### Solution 1 : Redémarrer le serveur

Les changements dans `next.config.js` (CSP) nécessitent un redémarrage complet :

```bash
# Arrêter le serveur (Ctrl+C)
npm run dev
```

### Solution 2 : Vérifier la configuration Supabase

Vérifier que les variables d'environnement sont correctes :

```bash
# Vérifier les variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Solution 3 : Nettoyer les cookies et se reconnecter

1. Ouvrir les DevTools > Application > Cookies
2. Supprimer tous les cookies Supabase (`sb-*`)
3. Se déconnecter et se reconnecter
4. Réessayer la création d'un bien

### Solution 4 : Vérifier le middleware

Le middleware Next.js doit être configuré pour gérer les cookies. Vérifier `middleware.ts` :

```typescript
// Le middleware doit créer un client Supabase avec les cookies
const supabase = createServerClient(url, anonKey, {
  cookies: {
    get(name: string) {
      return request.cookies.get(name)?.value;
    },
    set(name: string, value: string, options?: any) {
      request.cookies.set(name, value);
      response.cookies.set(name, value, options);
    },
    remove(name: string) {
      request.cookies.delete(name);
      response.cookies.delete(name);
    },
  },
});
```

---

## 📊 CHECKLIST DE DÉBOGAGE

- [ ] Serveur redémarré après les modifications
- [ ] Cookies Supabase présents dans le navigateur
- [ ] Session Supabase valide côté client
- [ ] Headers `Cookie` présents dans la requête réseau
- [ ] Logs serveur vérifiés pour les erreurs
- [ ] Variables d'environnement Supabase correctes
- [ ] Middleware configuré correctement

---

## 🚨 SI LE PROBLÈME PERSISTE

### Option A : Utiliser `cookies()` de Next.js dans la route API

Modifier `app/api/properties/route.ts` pour utiliser `cookies()` au lieu de `createClientFromRequest` :

```typescript
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // Utiliser cookies() de Next.js directement
    const cookieStore = await cookies();
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new ApiError(authError?.status || 401, authError?.message || "Non authentifié");
    }
    
    // ... rest of the code
  }
}
```

### Option B : Ajouter des logs détaillés

Ajouter des logs dans `lib/supabase/server.ts` pour voir exactement ce qui est reçu :

```typescript
export function createClientFromRequest(request: Request | NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";
  
  console.log("[DEBUG] Cookie header:", cookieHeader.substring(0, 500));
  
  // ... rest of the code
}
```

---

**Note** : Les corrections appliquées devraient résoudre le problème dans la plupart des cas. Si le problème persiste, suivre les étapes de débogage ci-dessus pour identifier la cause exacte.

