# Guide de Test - Création d'un Logement

Ce guide décrit les étapes pour tester le flux complet de création d'un logement et vérifier que les corrections apportées fonctionnent correctement.

## Prérequis

1. ✅ Serveur Next.js en cours d'exécution (`npm run dev`)
2. ✅ Base de données Supabase accessible
3. ✅ Compte utilisateur avec le rôle "owner" créé
4. ✅ Variables d'environnement configurées (`.env.local`)

## Étapes de Test

### 1. Création d'un Draft de Logement

1. Ouvrir le navigateur et aller sur `http://localhost:3000/properties/new`
2. Sélectionner un type de bien (ex: "Appartement")
3. **Vérifier dans la console du navigateur** :
   - ✅ `POST /api/properties` retourne `201 Created`
   - ✅ La réponse contient `property.id`
   - ✅ Aucune erreur `500` ou `404`

4. **Vérifier dans les logs serveur** :
   ```
   [GET /api/properties/{id}] Propriété trouvée: owner_id=...
   ```

### 2. Test de l'Auto-save (PATCH)

1. Après la sélection du type de bien, remplir le formulaire d'adresse :
   - Adresse complète
   - Code postal
   - Ville

2. **Vérifier dans la console du navigateur** :
   - ✅ `PATCH /api/properties/{id}` est appelé automatiquement (après 2 secondes de debounce)
   - ✅ Le statut de la réponse est `200 OK`
   - ✅ Aucune erreur `404` ou `400`

3. **Vérifier dans les logs serveur** :
   ```
   [PATCH /api/properties/{id}] Propriété trouvée: owner_id=..., etat=..., type=...
   ```
   - Si la colonne `etat` n'existe pas, vous verrez :
     ```
     [PATCH /api/properties/{id}] Colonne manquante détectée, réessai avec colonnes minimales
     ```

### 3. Test de l'Ajout de Pièces (POST /rooms)

1. Aller à l'étape "Pièces & photos"
2. Cliquer sur "Ajouter une pièce"
3. Remplir le formulaire :
   - Type de pièce (ex: "Séjour")
   - Surface (m²)
   - Chauffage présent (oui/non)
   - Climatisation présente (oui/non)

4. Cliquer sur "Ajouter"

5. **Vérifier dans la console du navigateur** :
   - ✅ `POST /api/properties/{id}/rooms` retourne `201 Created`
   - ✅ La réponse contient `room.id`
   - ✅ Aucune erreur `404` ou `400`
   - ✅ Le toast affiche "Pièce ajoutée avec succès"

6. **Vérifier dans les logs serveur** :
   ```
   [POST /api/properties/{id}/rooms] Propriété trouvée: owner_id=..., etat=..., type=...
   ```
   - Si la colonne `etat` n'existe pas, vous verrez :
     ```
     [POST /api/properties/{id}/rooms] Colonne manquante détectée, réessai avec colonnes minimales
     ```

### 4. Test de la Soumission Finale

1. Compléter toutes les étapes du wizard
2. Cliquer sur "Valider le logement"

3. **Vérifier dans la console du navigateur** :
   - ✅ `POST /api/properties/{id}/submit` retourne `200 OK`
   - ✅ Redirection vers `/properties/{id}`
   - ✅ Aucune erreur `404` ou `400`

## Vérification des Logs Serveur

Les logs suivants devraient apparaître dans la console du serveur Next.js :

### Logs de Création (POST)
```
[api-client] Request: POST /api/properties
[api-client] Response: { endpoint: '/properties', status: 201, dataCount: 'N/A' }
```

### Logs d'Auto-save (PATCH)
```
[PATCH /api/properties/{id}] Propriété trouvée: owner_id=..., etat=draft, type=appartement
```
ou si colonnes manquantes :
```
[PATCH /api/properties/{id}] Colonne manquante détectée, réessai avec colonnes minimales
[PATCH /api/properties/{id}] Propriété trouvée: owner_id=..., etat=N/A, type=N/A
```

### Logs d'Ajout de Pièces (POST /rooms)
```
[POST /api/properties/{id}/rooms] Propriété trouvée: owner_id=..., etat=draft, type=appartement
```
ou si colonnes manquantes :
```
[POST /api/properties/{id}/rooms] Colonne manquante détectée, réessai avec colonnes minimales
[POST /api/properties/{id}/rooms] Propriété trouvée: owner_id=..., etat=N/A, type=N/A
```

## Problèmes Potentiels et Solutions

### Erreur 404 "Propriété non trouvée"

**Cause** : La propriété n'existe pas ou n'est pas accessible via RLS.

**Solution** : Vérifier que :
- ✅ Le `savedDraftId` est correctement défini dans le wizard
- ✅ Les logs serveur montrent que la propriété est trouvée
- ✅ Le `serviceClient` est utilisé pour contourner RLS

### Erreur 400 "Données invalides"

**Cause** : Les données envoyées ne respectent pas le schéma Zod.

**Solution** : Vérifier que :
- ✅ Tous les champs obligatoires sont remplis
- ✅ Les types de données sont corrects (nombres, chaînes, etc.)
- ✅ Les validations Zod sont respectées

### Erreur "Colonne manquante"

**Cause** : Une colonne attendue n'existe pas dans la base de données.

**Solution** : 
- ✅ Les handlers gèrent automatiquement les colonnes manquantes
- ✅ Les logs indiquent qu'un fallback est utilisé
- ✅ La fonctionnalité continue de fonctionner avec les colonnes disponibles

## Résultat Attendu

Après avoir suivi toutes ces étapes, vous devriez avoir :

1. ✅ Un logement créé avec succès
2. ✅ L'auto-save fonctionne sans erreur
3. ✅ Les pièces peuvent être ajoutées sans erreur
4. ✅ Le logement peut être soumis pour validation
5. ✅ Tous les logs serveur montrent des opérations réussies

## Notes

- Les logs de debug sont temporaires et peuvent être retirés une fois que tout fonctionne correctement
- Si des colonnes manquantes sont détectées, considérez d'appliquer les migrations Supabase correspondantes
- Les erreurs `content_script.js` dans la console du navigateur sont normales et proviennent d'extensions de navigateur

