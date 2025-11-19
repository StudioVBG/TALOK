# Intégration de la Configuration Wizard Property

## Fichiers Créés

### 1. `config/property-wizard-config.json`
Configuration JSON complète du wizard avec :
- **propertyTypes** : Liste des 10 types de biens avec leurs groupes
- **steps** : 7 étapes du wizard avec leurs champs et sections conditionnelles

### 2. `lib/validations/property-validation.ts`
Fonctions de validation par type de bien :
- `validateHabitation()` : Pour appartement, maison, studio, colocation
- `validateParking()` : Pour parking et box
- `validateCommercial()` : Pour locaux commerciaux
- `validateProperty()` : Fonction principale qui route vers la bonne validation

### 3. `lib/config/property-wizard-loader.ts`
Chargeur TypeScript typé pour la configuration :
- Types TypeScript pour la configuration
- Fonctions utilitaires :
  - `getStepsForType()` : Récupère les étapes visibles pour un type
  - `getFieldsForStep()` : Récupère les champs visibles pour une étape
  - `getPropertyTypeById()` : Récupère un type par ID
  - `getPropertyTypesByGroup()` : Récupère les types d'un groupe

## Structure de la Configuration

### Étapes du Wizard

1. **type_bien** : Sélection du type avec groupes visuels
2. **adresse** : Adresse complète du bien
3. **infos_essentielles** : Sections conditionnelles selon le type :
   - `habitation_base` + `habitation_confort` : Pour habitation
   - `parking_base` + `parking_securite` : Pour parking/box
   - `local_commercial_base` + `local_commercial_equipements` : Pour locaux
4. **equipements** : Grille d'équipements (checkbox-grid)
5. **pieces_photos** : Mode custom pour habitation
6. **photos_simple** : Mode simple pour parking/local
7. **conditions_location** : Sections conditionnelles selon le type
8. **recap** : Récapitulatif avant soumission

### Validation

Chaque étape/section peut avoir :
- `requiredFields` : Champs obligatoires
- `conditional` : Validations conditionnelles (ex: si chauffage != "aucun", alors énergie requise)

## Utilisation

### Dans les Composants

```typescript
import { getStepsForType, getFieldsForStep } from "@/lib/config/property-wizard-loader";
import { validateProperty } from "@/lib/validations/property-validation";

// Récupérer les étapes pour un type
const steps = getStepsForType("appartement");

// Récupérer les champs d'une étape
const fields = getFieldsForStep(steps[2], "appartement");

// Valider une propriété
const validation = validateProperty(propertyData, rooms, photos);
if (!validation.isValid) {
  // Afficher les erreurs
  console.log(validation.fieldErrors);
  console.log(validation.globalErrors);
  // Naviguer vers l'étape avec erreurs
  goToStep(validation.stepId);
}
```

## Prochaines Étapes

1. **Adapter `PropertyWizardV3`** pour utiliser cette nouvelle configuration
2. **Créer des composants génériques** pour rendre les champs dynamiquement
3. **Intégrer la validation** dans le flux du wizard
4. **Tester** avec chaque type de bien

## Compatibilité

Cette configuration est compatible avec :
- Le modèle Property V3 existant
- Les schémas Zod existants (`propertySchemaV3`)
- Les composants React existants (à adapter progressivement)

