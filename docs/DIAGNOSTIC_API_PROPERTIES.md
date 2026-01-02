# 🔍 Guide de diagnostic - Route /api/properties

## Problème
Erreur 500 sur `/api/properties` lors du chargement de la page "Mes biens".

## Méthode 1 : Script de diagnostic automatique

### Exécuter le script
```bash
npm run diagnose:properties
```

### Ce que le script vérifie
- ✅ Variables d'environnement (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- ✅ Connexion à Supabase
- ✅ Structure de la table `properties` (colonnes requises)
- ✅ Structure de la table `profiles`
- ✅ Requête complète (simulation de la route API)
- ⚠️ Politiques RLS (Row Level Security)

### Interpréter les résultats

#### ❌ Variables d'environnement manquantes
**Solution :**
1. Vérifiez votre fichier `.env.local`
2. Assurez-vous que les variables suivantes sont définies :
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key
   ```

#### ❌ Erreur de connexion Supabase
**Causes possibles :**
- URL Supabase incorrecte
- Clé service-role invalide ou expirée
- Problème réseau

**Solution :**
1. Vérifiez vos credentials dans Supabase Dashboard > Settings > API
2. Régénérez la clé service-role si nécessaire

#### ❌ Colonne manquante dans la table `properties`
**Erreur typique :** `column "X" does not exist`

**Solution :**
1. Vérifiez les migrations Supabase
2. Assurez-vous que toutes les colonnes suivantes existent :
   - `id`, `owner_id`, `type`, `type_bien`
   - `adresse_complete`, `code_postal`, `ville`
   - `surface`, `nb_pieces`, `loyer_base`
   - `created_at`, `etat`

#### ❌ Erreur lors de la requête complète
**Causes possibles :**
- Politiques RLS qui bloquent l'accès
- `owner_id` incorrect (doit être `profile.id`, pas `user.id`)
- Données corrompues

**Solution :**
1. Vérifiez les politiques RLS dans Supabase Dashboard
2. Vérifiez que `owner_id` correspond bien à `profiles.id`

## Méthode 2 : Logs serveur Next.js

### Étapes
1. **Démarrer le serveur en mode développement :**
   ```bash
   npm run dev
   ```

2. **Ouvrir la page problématique :**
   - Naviguez vers `/owner/properties`
   - Ou utilisez la console navigateur pour déclencher la requête

3. **Vérifier les logs dans le terminal :**
   Recherchez les lignes commençant par :
   ```
   [GET /api/properties] Error caught:
   [GET /api/properties] Query error:
   ```

### Logs à rechercher

#### Erreur d'authentification
```
[GET /api/properties] Error message: Non authentifié
```
**Solution :** Vérifiez que l'utilisateur est bien connecté

#### Erreur de profil
```
[GET /api/properties] Error message: Profil non trouvé
```
**Solution :** Vérifiez que le profil existe dans la table `profiles`

#### Erreur Supabase (code spécifique)
```
[GET /api/properties] Error code: 42501
```
**Code 42501 :** Permission refusée (RLS)
**Code 42P17 :** Récursion infinie RLS
**Code PGRST116 :** Ressource non trouvée

#### Erreur de colonne
```
column "X" of relation "properties" does not exist
```
**Solution :** Exécutez les migrations Supabase manquantes

## Méthode 3 : Test manuel avec curl

### Tester la route API directement
```bash
# Récupérer le cookie de session depuis le navigateur
# (Ouvrez DevTools > Application > Cookies > copiez la valeur de 'sb-xxx-auth-token')

curl -X GET http://localhost:3000/api/properties \
  -H "Cookie: sb-xxx-auth-token=VOTRE_TOKEN" \
  -v
```

### Interpréter la réponse
- **200 OK :** La route fonctionne, problème côté client
- **401 Unauthorized :** Problème d'authentification
- **500 Internal Server Error :** Vérifiez les logs serveur

## Solutions courantes

### 1. Problème d'authentification
```typescript
// Vérifier dans app/api/properties/route.ts
const { user, error, supabase } = await getAuthenticatedUser(request);
if (error || !user) {
  // Erreur ici
}
```

### 2. Problème de profil
```typescript
// Vérifier que le profil existe
const { data: profile } = await dbClient
  .from("profiles")
  .select("id, role")
  .eq("user_id", user.id)
  .single();
```

### 3. Problème RLS
- Vérifiez les politiques dans Supabase Dashboard
- Assurez-vous que la politique permet l'accès avec `service_role` key

### 4. Problème de colonnes
- Exécutez les migrations Supabase
- Vérifiez que toutes les colonnes existent dans la table `properties`

## Checklist de vérification

- [ ] Variables d'environnement définies (`.env.local`)
- [ ] Serveur Next.js redémarré après modification `.env.local`
- [ ] Connexion Supabase fonctionnelle
- [ ] Table `properties` existe avec toutes les colonnes
- [ ] Table `profiles` existe
- [ ] Politiques RLS configurées correctement
- [ ] Utilisateur connecté avec un profil `owner`
- [ ] `owner_id` dans `properties` correspond à `profiles.id`

## Support

Si le problème persiste après avoir suivi ce guide :
1. Exécutez `npm run diagnose:properties`
2. Copiez les logs complets (terminal + navigateur)
3. Partagez les logs pour diagnostic approfondi

