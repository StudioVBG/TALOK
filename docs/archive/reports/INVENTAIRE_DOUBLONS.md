# Inventaire Complet des Doublons

## 🔍 Méthodologie

Analyse systématique de tous les fichiers pour identifier :
- Types/interfaces dupliqués
- Fonctions/services dupliqués
- Composants dupliqués
- Configurations dupliquées
- Validations dupliquées

---

## 1. TYPES PROPERTY DUPLIQUÉS

### 1.1 PropertyType

**Définitions trouvées**:

1. **`lib/types/index.ts` (ligne 5-14)**
```typescript
export type PropertyType =
  | "appartement"
  | "maison"
  | "colocation"
  | "saisonnier"
  | "local_commercial"
  | "bureaux"
  | "entrepot"
  | "parking"
  | "fonds_de_commerce";
```
**Manque**: `studio`, `box`

2. **`lib/types/property-v3.ts` (ligne 28-38)**
```typescript
export type PropertyTypeV3 =
  | "appartement"
  | "maison"
  | "studio"              // Nouveau
  | "colocation"
  | "parking"
  | "box"                 // Nouveau
  | "local_commercial"
  | "bureaux"
  | "entrepot"
  | "fonds_de_commerce";
```
**Complet et à jour**

3. **`lib/config/property-wizard-loader.ts` (ligne 23-25)**
```typescript
export type PropertyType = 
  | "appartement"
  | "maison"
  | "studio"
  | "colocation"
  | "parking"
  | "box"
  | "local_commercial"
  | "bureaux"
  | "entrepot"
  | "fonds_de_commerce";
```
**Dupliqué depuis JSON config**

**Action**: 
- ✅ Utiliser `PropertyTypeV3` comme source unique
- ✅ Créer alias `PropertyType = PropertyTypeV3` dans `index.ts`
- ✅ Importer depuis V3 dans `property-wizard-loader.ts`

---

### 1.2 Property Interface

**Définitions trouvées**:

1. **`lib/types/index.ts` (ligne 226-287)**
```typescript
export interface Property {
  id: string;
  owner_id: string;
  type: PropertyType;  // Legacy
  // ... 50+ champs
}
```

2. **`lib/types/property-v3.ts` (ligne 280-399)**
```typescript
export interface PropertyV3 {
  id: string;
  owner_id: string;
  type_bien: PropertyTypeV3;  // Nouveau champ
  type: PropertyTypeV3;        // Compatibilité
  // ... 80+ champs (inclut nouveaux champs V3)
}
```

**Différences**:
- `PropertyV3` inclut `type_bien` (nouveau)
- `PropertyV3` inclut champs parking (`parking_*`)
- `PropertyV3` inclut champs locaux (`local_*`)
- `PropertyV3` inclut `equipments` (array)

**Action**:
- ✅ Migrer progressivement vers `PropertyV3`
- ✅ Marquer `Property` comme deprecated
- ✅ Créer mapper `Property → PropertyV3` pour compatibilité

---

### 1.3 RoomType

**Définitions trouvées**:

1. **`lib/types/index.ts` (ligne 32-43)**
```typescript
export type RoomType =
  | "sejour"
  | "chambre"
  | "cuisine"
  | "salle_de_bain"
  | "wc"
  | "entree"
  | "couloir"
  | "balcon"
  | "terrasse"
  | "cave"
  | "autre";
```

2. **`lib/types/property-v3.ts` (ligne 180-195)**
```typescript
export type RoomTypeV3 =
  | "sejour"
  | "chambre"
  | "cuisine"
  | "salle_de_bain"
  | "wc"
  | "entree"
  | "couloir"
  | "balcon"
  | "terrasse"
  | "cave"
  | "jardin"        // Nouveau
  | "bureau"        // Nouveau
  | "dressing"      // Nouveau
  | "autre";
```

**Action**: Unifier vers `RoomTypeV3`

---

### 1.4 PhotoTag

**Définitions trouvées**:

1. **`lib/types/index.ts` (ligne 45)**
```typescript
export type PhotoTag = "vue_generale" | "plan" | "detail" | "exterieur" | null;
```

2. **`lib/types/property-v3.ts` (ligne 197-210)**
```typescript
export type PhotoTagV3 =
  | "vue_generale"
  | "exterieur"
  | "interieur"
  | "detail"
  | "autre"
  | null;
```

**Différences**:
- `PhotoTag` a `plan` (non dans V3)
- `PhotoTagV3` a `interieur`, `autre` (non dans legacy)

**Action**: Unifier vers `PhotoTagV3`, mapper `plan` → `detail`

---

## 2. VALIDATION DUPLIQUÉE

### 2.1 Schémas Zod

**Fichiers**:
1. **`lib/validations/index.ts`**
   - `propertySchema` (legacy, marqué deprecated)
   - `propertyGeneralUpdateSchema`
   - `roomSchema`

2. **`lib/validations/property-v3.ts`**
   - `propertySchemaV3` (nouveau)
   - `habitationSchemaV3`
   - `parkingSchemaV3`
   - `localSchemaV3`

3. **`lib/validations/property-validator.ts`**
   - Bridge entre legacy et V3
   - `validatePropertyData()`
   - `safeValidatePropertyData()`
   - `isPropertyV3()`

**Action**: 
- ✅ Migrer progressivement vers `propertySchemaV3`
- ✅ Supprimer `propertySchema` une fois migration complète
- ✅ Garder `property-validator.ts` pour transition

---

### 2.2 Fonctions de Validation Custom

**Fichiers**:
1. **`lib/validations/property-validation.ts`**
   - `validateHabitation()`
   - `validateParking()`
   - `validateCommercial()`
   - `validateProperty()`

**Utilisation**: 
- Validation UI avec messages contextuels
- Navigation vers étape avec erreurs

**Action**:
- ✅ Garder pour UI uniquement
- ✅ Utiliser Zod pour validation backend
- ✅ Convertir erreurs Zod en format UI

---

## 3. COMPOSANTS WIZARD DUPLIQUÉS

### 3.1 Wizard Principal

**Fichiers**:
1. **`features/properties/components/property-wizard.tsx`** ❌ SUPPRIMÉ
2. **`features/properties/components/v3/property-wizard-v3.tsx`** ✅ ACTIF

**Status**: Migration en cours, legacy supprimé ✅

---

### 3.2 Étapes du Wizard

**Composants Legacy (à migrer)**:
1. **`features/properties/components/v3/address-step.tsx`**
   - Rendu manuel des champs
   - **Action**: Migrer vers `DynamicStep` + config JSON

2. **`features/properties/components/v3/equipments-info-step.tsx`**
   - Logique conditionnelle hardcodée
   - **Action**: Migrer vers `DynamicStep` + config JSON

3. **`features/properties/components/v3/conditions-step.tsx`**
   - Sections conditionnelles hardcodées
   - **Action**: Migrer vers `DynamicStep` + config JSON

**Composants Spéciaux (à garder)**:
1. **`features/properties/components/v3/property-type-selection.tsx`**
   - UI spéciale avec groupes visuels
   - **Action**: Garder, utilisé pour mode `select-card`

2. **`features/properties/components/v3/rooms-photos-step.tsx`**
   - Mode custom avec drag & drop
   - **Action**: Garder, utilisé pour mode `custom`

3. **`features/properties/components/v3/recap-step.tsx`**
   - Mode summary avec ExecutiveSummary
   - **Action**: Garder, utilisé pour mode `summary`

---

### 3.3 Configuration Wizard

**Fichiers**:
1. **`config/propertyWizardV3.ts`** (TypeScript)
   - `WIZARD_STEPS_V3` (array)
   - `PROPERTY_TYPE_GROUPS` (dupliqué depuis V3 types)
   - **Status**: Partiellement utilisé

2. **`config/property-wizard-config.json`** (JSON)
   - Configuration complète
   - **Status**: Source de vérité

**Action**:
- ✅ Utiliser uniquement JSON config
- ✅ Supprimer `propertyWizardV3.ts` après migration complète
- ✅ `PROPERTY_TYPE_GROUPS` déjà dans `property-v3.ts` ✅

---

## 4. SERVICES DUPLIQUÉS

### 4.1 Properties Service

**Fichiers**:
1. **`features/properties/services/properties.service.ts`**
   - Méthodes legacy + V3
   - `createProperty()` (legacy)
   - `createDraftProperty()` (V3)
   - `updateProperty()` (legacy)
   - `updatePropertyGeneral()` (V3)

**Action**:
- ✅ Unifier méthodes (garder V3 uniquement)
- ✅ Créer mapper pour compatibilité legacy si nécessaire

---

## 5. CONSTANTES DUPLIQUÉES

### 5.1 Room Types

**Définitions**:
1. **`lib/types/property-v3.ts` (ligne 180-195)**
   - `ROOM_TYPES` array avec labels

2. **Utilisé dans**: `rooms-photos-step.tsx`

**Status**: ✅ Déjà unifié

---

### 5.2 Photo Tags

**Définitions**:
1. **`lib/types/property-v3.ts` (ligne 197-210)**
   - `PHOTO_TAGS` array avec labels

2. **Utilisé dans**: `rooms-photos-step.tsx`

**Status**: ✅ Déjà unifié

---

### 5.3 Property Type Groups

**Définitions**:
1. **`lib/types/property-v3.ts` (ligne 48-70)**
   - `PROPERTY_TYPE_GROUPS` avec groupes visuels

2. **`config/propertyWizardV3.ts`**
   - Dupliqué (à supprimer)

**Action**: ✅ Utiliser uniquement depuis `property-v3.ts`

---

## 6. HOOKS DUPLIQUÉS

### 6.1 Properties Hooks

**Fichiers**:
1. **`lib/hooks/use-properties.ts`** ✅ Principal
2. **`lib/hooks/use-properties-optimistic.ts`** ✅ Optimistic updates
3. **`lib/hooks/use-properties-infinite.ts`** ✅ Infinite scroll

**Status**: ✅ Pas de duplication, spécialisations différentes

---

## 7. HELPERS DUPLIQUÉS

### 7.1 Validation Helpers

**Fichiers**:
1. **`lib/validations/property-validator.ts`**
   - `validatePropertyData()`
   - `safeValidatePropertyData()`
   - `isPropertyV3()`

2. **`lib/validations/property-validation.ts`**
   - `validateProperty()` (UI-focused)

**Action**: 
- ✅ Garder les deux (rôles différents)
- ✅ `property-validator.ts` : Bridge backend
- ✅ `property-validation.ts` : UI messages

---

## 📊 RÉSUMÉ DES DOUBLONS

| Catégorie | Doublons Identifiés | Action | Priorité |
|-----------|---------------------|--------|----------|
| **Types Property** | 3 définitions | Unifier vers V3 | 🔴 HAUTE |
| **Interfaces Property** | 2 (Property vs PropertyV3) | Migrer vers V3 | 🔴 HAUTE |
| **RoomType** | 2 (RoomType vs RoomTypeV3) | Unifier vers V3 | 🟡 MOYENNE |
| **PhotoTag** | 2 (PhotoTag vs PhotoTagV3) | Unifier vers V3 | 🟡 MOYENNE |
| **Validation Zod** | 2 schémas (legacy + V3) | Migrer vers V3 | 🟡 MOYENNE |
| **Validation Custom** | 2 systèmes (Zod + custom) | Unifier sur Zod | 🟡 MOYENNE |
| **Composants Wizard** | 3 étapes à migrer | Migrer vers DynamicStep | 🟢 BASSE |
| **Config Wizard** | 2 (TS + JSON) | Utiliser JSON uniquement | 🟢 BASSE |
| **Constantes** | Déjà unifiées ✅ | - | - |

---

## 🎯 PLAN DE NETTOYAGE

### Étape 1 : Types (1 jour)
1. Créer alias `PropertyType = PropertyTypeV3`
2. Marquer legacy comme deprecated
3. Migrer imports progressivement
4. Supprimer définitions legacy

### Étape 2 : Validation (2 jours)
1. Migrer validations custom vers Zod `.superRefine()`
2. Garder fonctions custom pour UI uniquement
3. Centraliser messages d'erreur
4. Tester tous les cas

### Étape 3 : Composants (3 jours)
1. Migrer `address-step.tsx` → `DynamicStep`
2. Migrer `equipments-info-step.tsx` → `DynamicStep`
3. Migrer `conditions-step.tsx` → `DynamicStep`
4. Supprimer `propertyWizardV3.ts`

### Étape 4 : Services (1 jour)
1. Unifier méthodes properties service
2. Supprimer méthodes legacy
3. Tester compatibilité

**Total Estimation**: 7 jours de travail

---

## ✅ DOUBLONS DÉJÀ RÉSOLUS

- ✅ `property-wizard.tsx` (legacy) → Supprimé
- ✅ `config/propertyWizard.ts` (legacy) → Supprimé
- ✅ `ROOM_TYPES` → Unifié dans `property-v3.ts`
- ✅ `PHOTO_TAGS` → Unifié dans `property-v3.ts`
- ✅ `PROPERTY_TYPE_GROUPS` → Unifié dans `property-v3.ts`

---

## 📝 NOTES

- Les doublons sont principalement dus à la migration progressive Legacy → V3
- La stratégie de migration progressive est correcte (évite breaking changes)
- Il est temps de finaliser la migration et supprimer le code legacy
- Les composants spéciaux (type-selection, rooms-photos, recap) doivent être conservés

