# 🧪 Guide de Test - Système de Récupération des Propriétés

## ✅ Checklist de Test

### 1. Prérequis

- [ ] Serveur Next.js en cours d'exécution (`npm run dev`)
- [ ] Compte propriétaire créé et connecté
- [ ] Au moins une propriété créée dans Supabase pour ce propriétaire

---

## 2. Test de la Route API

### Test manuel via navigateur

1. **Ouvrir la console du navigateur** (F12)
2. **Aller sur** `/app/owner/properties`
3. **Vérifier les logs dans la console** :
   ```
   [api-client] Request: GET /api/properties
   [api-client] GET /api/properties - 200
   [useProperties] Response received: { ... }
   [PropertiesPageClient] state: { ... }
   ```

### Test via terminal serveur

1. **Vérifier les logs serveur** dans le terminal où `npm run dev` tourne :
   ```
   [api/properties] ▶️ handler called
   [api/properties] 📦 Step 1: Creating Supabase client
   [api/properties] ✅ Step 1: Client created successfully
   [api/properties] 🔐 Step 2: Getting user
   [api/properties] ✅ Step 2: User authenticated
   [api/properties] 👤 Step 3: Fetching profile
   [api/properties] ✅ Step 3: Profile found
   [api/properties] 🔍 Step 4: Fetching properties
   [api/properties] DEBUG: auth.uid() = ...
   [api/properties] DEBUG: profile.id = ...
   [api/properties] DEBUG: owner_id filter = ...
   [api/properties] DEBUG: Nombre de propriétés trouvées: ...
   [api/properties] 🎨 Step 5: Enriching properties with status
   [api/properties] ✅ All steps completed successfully
   ```

---

## 3. Test des États de l'UI

### État 1: Loading (Chargement)

**Comportement attendu :**
- ✅ Le skeleton (`PropertyCardGridSkeleton`) s'affiche immédiatement
- ✅ Le header "Mes biens" est visible
- ✅ Le bouton "Ajouter un bien" est visible
- ✅ Les filtres ne sont PAS visibles pendant le chargement

**Vérification :**
```javascript
// Dans la console navigateur
console.log("[PropertiesPageClient] state", {
  propertiesCount: 0,
  isLoading: true,
  isError: false
});
```

---

### État 2: Success (Succès avec données)

**Comportement attendu :**
- ✅ Le skeleton disparaît
- ✅ Les filtres apparaissent (recherche, type, statut)
- ✅ La grille de propriétés s'affiche avec les cartes
- ✅ Chaque carte affiche :
  - Image de couverture (ou placeholder)
  - Adresse complète
  - Type de bien
  - Statut (Loué/En préavis/Vacant)
  - Surface et nombre de pièces
  - Loyer mensuel (si applicable)
  - Bouton "Voir la fiche"

**Vérification :**
```javascript
// Dans la console navigateur
console.log("[PropertiesPageClient] state", {
  propertiesCount: 3, // ou plus
  isLoading: false,
  isError: false
});
```

---

### État 3: Empty (Aucun bien)

**Comportement attendu :**
- ✅ Le skeleton disparaît
- ✅ Une carte "Aucun bien pour l'instant" s'affiche
- ✅ Le message : "Cliquez sur 'Ajouter un bien' pour enregistrer votre premier logement."
- ✅ Un bouton "Ajouter un bien" est visible

**Comment tester :**
- Créer un nouveau compte propriétaire sans propriétés
- Ou supprimer temporairement toutes les propriétés du propriétaire actuel

**Vérification :**
```javascript
// Dans la console navigateur
console.log("[PropertiesPageClient] state", {
  propertiesCount: 0,
  isLoading: false,
  isError: false
});
```

---

### État 4: Error (Erreur)

**Comportement attendu :**
- ✅ Le skeleton disparaît
- ✅ Une carte d'erreur rouge s'affiche
- ✅ Le titre : "Erreur de chargement"
- ✅ Le message d'erreur détaillé
- ✅ Deux boutons :
  - "Réessayer" (refetch)
  - "Recharger la page"

**Comment tester :**
- Déconnecter temporairement internet
- Ou modifier temporairement la route API pour retourner une erreur 500

**Vérification :**
```javascript
// Dans la console navigateur
console.log("[PropertiesPageClient] state", {
  isLoading: false,
  isError: true,
  error: "Erreur lors de la récupération des propriétés"
});
```

---

## 4. Test des Filtres

### Test de la Recherche

1. **Taper dans le champ de recherche** : "Paris"
2. **Vérifier** : Seules les propriétés contenant "Paris" dans l'adresse/code postal/ville s'affichent
3. **Effacer la recherche** : Toutes les propriétés réapparaissent

### Test du Filtre par Type

1. **Sélectionner** "Appartement" dans le filtre Type
2. **Vérifier** : Seuls les appartements s'affichent
3. **Sélectionner** "Tous les types" : Toutes les propriétés réapparaissent

### Test du Filtre par Statut

1. **Sélectionner** "Loué" dans le filtre Statut
2. **Vérifier** : Seules les propriétés avec un bail actif s'affichent
3. **Sélectionner** "Vacant" : Seules les propriétés sans bail actif s'affichent
4. **Sélectionner** "Tous les statuts" : Toutes les propriétés réapparaissent

### Test de Filtres Combinés

1. **Recherche** : "Paris"
2. **Type** : "Appartement"
3. **Statut** : "Loué"
4. **Vérifier** : Seules les propriétés correspondant aux 3 critères s'affichent

---

## 5. Test de Performance

### Temps de Chargement

**Objectif :** < 2 secondes pour charger les propriétés

**Vérification :**
- Ouvrir les DevTools → Network
- Filtrer sur "properties"
- Vérifier le temps de réponse de `/api/properties`
- Vérifier que le timeout de 20 secondes n'est pas atteint

### Nombre de Requêtes

**Objectif :** 1 seule requête à `/api/properties` au chargement initial

**Vérification :**
- Ouvrir les DevTools → Network
- Filtrer sur "properties"
- Vérifier qu'il n'y a qu'une seule requête GET `/api/properties`

---

## 6. Test des Erreurs Spécifiques

### Erreur 401 (Non authentifié)

**Comment tester :**
- Se déconnecter
- Essayer d'accéder à `/app/owner/properties`
- Vérifier la redirection vers `/auth/signin`

### Erreur 404 (Profil non trouvé)

**Comment tester :**
- Supprimer temporairement le profil du propriétaire dans Supabase
- Recharger la page
- Vérifier que l'erreur "Profil non trouvé" s'affiche

### Erreur 500 (Erreur serveur)

**Comment tester :**
- Modifier temporairement la route API pour lancer une erreur
- Recharger la page
- Vérifier que la carte d'erreur s'affiche avec le message détaillé

---

## 7. Vérification des Logs

### Logs Navigateur (Console)

**Logs attendus :**
```
[api-client] Request: GET /api/properties
[api-client] GET /api/properties - 200
[useProperties] Response received: {
  hasResponse: true,
  propertiesCount: 3,
  propertiesLength: 3,
  responseKeys: ["propertiesCount", "properties", "leasesCount"]
}
[PropertiesPageClient] state: {
  propertiesCount: 3,
  propertiesLength: 3,
  isLoading: false,
  isError: false,
  error: undefined
}
```

### Logs Serveur (Terminal)

**Logs attendus :**
```
[api/properties] ▶️ handler called
[api/properties] 📦 Step 1: Creating Supabase client
[api/properties] ✅ Step 1: Client created successfully
[api/properties] 🔐 Step 2: Getting user
[api/properties] Step 2 result: { hasUser: true, userId: '...', hasError: false }
[api/properties] ✅ Step 2: User authenticated
[api/properties] 👤 Step 3: Fetching profile
[api/properties] Step 3 result: { hasProfile: true, profileId: '...', role: 'owner' }
[api/properties] ✅ Step 3: Profile found
[api/properties] 🔍 Step 4: Fetching properties for role: owner
[api/properties] DEBUG: auth.uid() = ...
[api/properties] DEBUG: profile.id = ...
[api/properties] DEBUG: owner_id filter = ...
[api/properties] DEBUG: Nombre de propriétés trouvées: 3
[api/properties] 🎨 Step 5: Enriching properties with status
[api/properties] ✅ Step 5: Properties enriched
[api/properties] ✅ All steps completed successfully
```

---

## 8. Test de Réessai (Retry)

### Test du Bouton "Réessayer"

1. **Simuler une erreur** (déconnecter internet)
2. **Attendre** que l'erreur s'affiche
3. **Cliquer** sur "Réessayer"
4. **Vérifier** que la requête est relancée
5. **Reconnecter internet**
6. **Vérifier** que les propriétés se chargent

---

## 9. Test de Navigation

### Test du Bouton "Voir la fiche"

1. **Cliquer** sur "Voir la fiche" d'une propriété
2. **Vérifier** la redirection vers `/app/owner/properties/[id]`
3. **Revenir** en arrière
4. **Vérifier** que les propriétés sont toujours en cache (pas de rechargement)

### Test du Bouton "Ajouter un bien"

1. **Cliquer** sur "Ajouter un bien"
2. **Vérifier** la redirection vers `/app/owner/properties/new`
3. **Créer** une nouvelle propriété
4. **Revenir** à la liste
5. **Vérifier** que la nouvelle propriété apparaît (avec invalidation du cache)

---

## 10. Résolution de Problèmes

### Problème : Les propriétés ne s'affichent pas

**Vérifications :**
1. ✅ Vérifier les logs serveur pour voir où ça bloque
2. ✅ Vérifier que le profil existe dans Supabase
3. ✅ Vérifier que des propriétés existent avec `owner_id = profile.id`
4. ✅ Vérifier les logs navigateur pour voir la réponse API
5. ✅ Vérifier que le format de réponse est correct

### Problème : Le skeleton reste affiché

**Vérifications :**
1. ✅ Vérifier que `isLoading` passe à `false` dans les logs
2. ✅ Vérifier qu'il n'y a pas d'erreur silencieuse
3. ✅ Vérifier que la requête API se termine (pas de timeout)

### Problème : Erreur 500 persistante

**Vérifications :**
1. ✅ Vérifier les logs serveur pour l'erreur exacte
2. ✅ Vérifier que toutes les colonnes sélectionnées existent dans la table
3. ✅ Vérifier les politiques RLS sur la table `properties`
4. ✅ Vérifier que `user_profile_id()` fonctionne correctement

---

## ✅ Résultat Attendu Final

Après tous ces tests, vous devriez avoir :

- ✅ Une page qui charge rapidement (< 2s)
- ✅ Un skeleton pendant le chargement
- ✅ Les propriétés qui s'affichent correctement
- ✅ Les filtres qui fonctionnent
- ✅ Les états d'erreur et vide qui s'affichent correctement
- ✅ Des logs clairs pour le debug

---

**Date de création :** $(date)
**Dernière mise à jour :** $(date)

