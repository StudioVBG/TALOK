# Diagnostic - Création de Logement

## Problème Signalé

Après une création réussie de draft (`POST /api/properties` retourne `201 Created`), les requêtes suivantes retournent `404 (Not Found)` ou `400 (Bad Request)` :
- `PATCH /api/properties/:id` 
- `POST /api/properties/:id/rooms`

## Corrections Appliquées

### 1. Ajout de `type_bien` dans `createDraftProperty`

**Fichier**: `app/api/properties/route.ts`

La fonction `createDraftProperty` inclut maintenant :
- `type_bien`: pour le modèle V3
- `type`: pour la rétrocompatibilité avec le modèle legacy
- `etat: "draft"`: pour garantir un état initial cohérent

```typescript
const insertPayload: Record<string, unknown> = {
  owner_id: profileId,
  type_bien: payload.type_bien,  // Support V3
  type: payload.type_bien,        // Support Legacy
  // ... autres champs
  etat: "draft",
};
```

### 2. Ajout de `studio` et `box` dans `typeBienEnum`

**Fichier**: `app/api/properties/route.ts`

Le schéma Zod `typeBienEnum` inclut maintenant tous les types V3 :
- `studio`
- `box`

### 3. Gestion Robuste des Colonnes Manquantes

Les routes `PATCH` et `POST /rooms` gèrent déjà les colonnes manquantes (`etat`, `type`) en :
- Tentant d'abord de sélectionner toutes les colonnes
- Réessayant avec des colonnes minimales si une colonne est manquante
- Utilisant des valeurs par défaut (`etat: "draft"`, `type: null`)

## Points de Vérification

### Dans la Console du Navigateur

1. **Création du draft** :
   ```
   [PropertyWizardV3] Création d'un draft avec type_bien=...
   [PropertyWizardV3] Draft créé avec succès: id=...
   ```

2. **Auto-save** :
   ```
   [PropertyWizardV3] Auto-save pour propertyId=...
   [PropertyWizardV3] Auto-save réussi pour propertyId=...
   ```

3. **Ajout de pièce** :
   ```
   [RoomsPhotosStep] Ajout d'une pièce pour propertyId=...
   [RoomsPhotosStep] Pièce ajoutée avec succès: id=...
   ```

### Dans les Logs Serveur

1. **Création du draft** :
   ```
   [POST /api/properties] Création d'un draft avec type_bien=...
   [POST /api/properties] Draft créé avec succès: id=..., owner_id=...
   [createDraftProperty] Draft créé: id=..., type_bien=...
   ```

2. **Mise à jour** :
   ```
   [PATCH /api/properties/:id] Propriété trouvée: owner_id=..., etat=..., type=...
   ```

3. **Ajout de pièce** :
   ```
   [POST /api/properties/:id/rooms] Propriété trouvée: owner_id=..., etat=..., type=...
   ```

## Tests à Effectuer

1. **Créer un nouveau logement** via le wizard (`/properties/new`)
2. **Sélectionner un type de bien** (ex: "appartement", "parking", "local_commercial")
3. **Vérifier que le draft est créé** (logs console + serveur)
4. **Remplir l'adresse** et vérifier l'auto-save
5. **Ajouter une pièce** et vérifier qu'elle est créée
6. **Continuer le wizard** jusqu'à la soumission

## Erreurs Possibles et Solutions

### Erreur 404 "Propriété non trouvée"

**Causes possibles** :
- La propriété n'a pas été créée dans la BDD
- Problème RLS empêchant l'accès
- L'ID retourné est incorrect

**Solutions** :
- Vérifier `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local`
- Vérifier les logs serveur pour voir si la création a réussi
- Vérifier dans Supabase Dashboard que la propriété existe

### Erreur 400 "Données invalides"

**Causes possibles** :
- Données manquantes ou invalides
- Colonnes manquantes dans la BDD
- Validation Zod échouée

**Solutions** :
- Vérifier les logs serveur pour voir l'erreur exacte
- Vérifier que la migration V3 a été appliquée
- Vérifier que les données envoyées sont conformes au schéma

### Erreur 500 "Erreur serveur"

**Causes possibles** :
- Colonne manquante dans la BDD
- Problème de connexion Supabase
- Erreur dans le code serveur

**Solutions** :
- Vérifier les logs serveur pour voir l'erreur exacte
- Vérifier que toutes les migrations ont été appliquées
- Vérifier la configuration Supabase

## Prochaines Étapes

Si les erreurs persistent :

1. **Vérifier la base de données** :
   - Connectez-vous à Supabase Dashboard
   - Vérifiez que la table `properties` existe
   - Vérifiez que les colonnes `type_bien`, `etat`, `type` existent
   - Vérifiez qu'une propriété a été créée avec l'ID retourné

2. **Vérifier les variables d'environnement** :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Vérifier les migrations** :
   - Exécutez `supabase migration list` pour voir les migrations appliquées
   - Appliquez la migration V3 si nécessaire

4. **Tester avec un script** :
   - Utilisez `scripts/test-property-api-flow.ts` pour tester le flux complet
   - Note: Ce script nécessite une authentification réelle

## Support

Si le problème persiste, fournissez :
- Les logs complets de la console du navigateur
- Les logs complets du serveur
- L'ID de la propriété créée
- Les erreurs exactes rencontrées

