# 📋 RAPPORT COMPLET DES DOUBLONS DANS LE CODE

**Date**: 2025-02-15  
**Version**: 1.0  
**Analyse**: Codebase complète - Talok SaaS

---

## 🔴 CRITIQUES - Doublons majeurs nécessitant une action immédiate

### 1. **Types PropertyType dupliqués** ⚠️ CRITIQUE

**Problème**: Deux définitions distinctes de `PropertyType` avec des valeurs différentes.

#### Fichier 1: `lib/types/index.ts` (lignes 5-14)
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

#### Fichier 2: `lib/types/property-v3.ts` (lignes 19-29)
```typescript
export type PropertyTypeV3 =
  | "appartement"
  | "maison"
  | "studio"              // ❌ Nouveau
  | "colocation"
  | "parking"
  | "box"                 // ❌ Nouveau (distinct de parking)
  | "local_commercial"
  | "bureaux"
  | "entrepot"
  | "fonds_de_commerce";
```

**Impact**: 
- Confusion entre `PropertyType` et `PropertyTypeV3`
- Incompatibilité entre ancien et nouveau modèle
- Migration nécessaire de tous les usages

**Recommandation**: 
- ✅ Migrer progressivement vers `PropertyTypeV3`
- ✅ Créer une fonction de compatibilité `toPropertyTypeV3(oldType: PropertyType): PropertyTypeV3`
- ✅ Déprécier `PropertyType` avec un `@deprecated` tag

---

### 2. **Schémas de validation Zod dupliqués** ⚠️ CRITIQUE

**Problème**: Trois schémas de validation différents pour les propriétés.

#### Fichier 1: `lib/validations/index.ts` (lignes 185-278)
```typescript
export const propertySchema = z.object({
  type: z.enum(["appartement", "maison", "colocation", "saisonnier", ...]),
  // ... 50+ champs
});
```

#### Fichier 2: `lib/validations/property-v3.ts` (lignes 263-284)
```typescript
export const propertySchemaV3 = z.discriminatedUnion("type_bien", [
  habitationSchemaV3,
  parkingSchemaV3,
  localProSchemaV3,
]);
```

#### Fichier 3: `lib/validations/onboarding.ts` (lignes 104-142)
```typescript
export const firstPropertySchema = z.object({
  adresse_complete: z.string().min(1, "L'adresse est requise"),
  // ... champs similaires mais partiels
});
```

**Impact**:
- Validation incohérente selon le contexte
- Maintenance triplée
- Risques de bugs si les règles divergent

**Recommandation**:
- ✅ Unifier vers `propertySchemaV3` comme source unique
- ✅ Créer des schémas partiels (`propertySchemaV3.pick()`) pour onboarding
- ✅ Retirer `propertySchema` progressivement

---

### 3. **Interfaces Property dupliquées** ⚠️ CRITIQUE

**Problème**: Deux interfaces principales pour représenter un bien.

#### Fichier 1: `lib/types/index.ts` (lignes 223-287)
```typescript
export interface Property {
  id: string;
  owner_id: string;
  type: PropertyType;  // ❌ Ancien type
  // ... ~50 champs
  parking_details: ParkingDetails | null;  // JSONB
}
```

#### Fichier 2: `lib/types/property-v3.ts` (lignes 130-227)
```typescript
export interface PropertyV3 {
  id: string;
  owner_id: string;
  type_bien: PropertyTypeV3;  // ❌ Nouveau type
  // ... ~60 champs (nouvelles colonnes structurées)
  parking_type?: ParkingTypeV3;  // ✅ Colonne dédiée au lieu de JSONB
}
```

**Impact**:
- Casts TypeScript nécessaires (`as PropertyV3`)
- Risques de perte de données lors des conversions
- Code fragile

**Recommandation**:
- ✅ Migrer progressivement vers `PropertyV3`
- ✅ Créer une fonction de conversion `toPropertyV3(property: Property): PropertyV3`
- ✅ Utiliser des types union temporaires : `type Property = PropertyLegacy | PropertyV3`

---

### 4. **Wizards de création dupliqués** ⚠️ CRITIQUE

**Problème**: Trois wizards différents pour créer un bien.

#### Fichier 1: `features/properties/components/property-wizard.tsx`
- Wizard original (ancien modèle)
- Configuration: `config/propertyWizard.ts`
- Utilise `PropertyType` et `propertySchema`

#### Fichier 2: `features/properties/components/v3/property-wizard-v3.tsx`
- Wizard V3 (nouveau modèle)
- Configuration: `config/propertyWizardV3.ts`
- Utilise `PropertyTypeV3` et `propertySchemaV3`

#### Fichier 3: `features/properties/components/parking-wizard.tsx`
- Wizard spécialisé pour parking uniquement
- Logique similaire mais isolée

#### Fichier 4: `app/owner/onboarding/property/page.tsx`
- Page d'onboarding avec logique inline
- Pas de réutilisation des wizards

**Impact**:
- Maintenance x4
- UX incohérente
- Bugs potentiels dans un wizard mais pas dans l'autre

**Recommandation**:
- ✅ Unifier vers `PropertyWizardV3` comme source unique
- ✅ Retirer `PropertyWizard` et `ParkingWizard`
- ✅ Utiliser `PropertyWizardV3` dans l'onboarding
- ✅ Routes: `/properties/new` → `/properties/new-v3` (redirection temporaire)

---

### 5. **Constantes ROOM_TYPES / PHOTO_TAGS dupliquées**

#### Constantes ROOM_TYPES

**Fichier 1: `lib/types/index.ts` (lignes 32-43)**
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

**Fichier 2: `lib/types/property-v3.ts` (lignes 189-202)**
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
  | "jardin"      // ❌ Nouveau
  | "autre";
```

**Fichier 3: `features/properties/components/v3/rooms-photos-step.tsx` (lignes 51-63)**
```typescript
const ROOM_TYPES: { value: RoomTypeV3; label: string; icon: typeof Home }[] = [
  { value: "sejour", label: "Séjour", icon: Home },
  // ... définitions locales
];
```

**Recommandation**:
- ✅ Extraire `ROOM_TYPES` dans `lib/types/property-v3.ts` comme constante exportée
- ✅ Retirer la définition locale dans `rooms-photos-step.tsx`
- ✅ Créer une fonction de compatibilité `toRoomTypeV3(oldType: RoomType): RoomTypeV3`

#### Constantes PHOTO_TAGS

**Fichier 1: `lib/types/index.ts` (ligne 45)**
```typescript
export type PhotoTag = "vue_generale" | "plan" | "detail" | "exterieur" | null;
```

**Fichier 2: `lib/types/property-v3.ts` (lignes 209-221)**
```typescript
export type PhotoTagV3 =
  | "vue_generale"
  | "plan"
  | "detail"
  | "exterieur"
  | "emplacement"    // ❌ Nouveaux tags
  | "acces"
  | "façade"
  | "interieur"
  | "vitrine"
  | "autre";
```

**Fichier 3: `features/properties/components/v3/rooms-photos-step.tsx` (lignes 66-74)**
```typescript
const PHOTO_TAGS: { value: string; label: string }[] = [
  { value: "emplacement", label: "Emplacement" },
  // ... définitions locales (utilise string au lieu de PhotoTagV3)
];
```

**Recommandation**:
- ✅ Extraire `PHOTO_TAGS` dans `lib/types/property-v3.ts`
- ✅ Utiliser `PhotoTagV3` au lieu de `string`
- ✅ Créer une fonction de compatibilité `toPhotoTagV3(oldTag: PhotoTag): PhotoTagV3`

---

## 🟡 IMPORTANTS - Doublons à surveiller

### 6. **Configurations Wizard dupliquées**

**Fichier 1: `config/propertyWizard.ts`**
- Configuration pour `PropertyWizard` (ancien)
- Structure: `QuestionnaireConfig` avec `steps` et `fieldsByType`

**Fichier 2: `config/propertyWizardV3.ts`**
- Configuration pour `PropertyWizardV3` (nouveau)
- Structure similaire mais adaptée au modèle V3

**Impact**:
- Maintenance double
- Risque de divergence

**Recommandation**:
- ✅ Migrer vers `propertyWizardV3.ts` uniquement
- ✅ Déprécier `propertyWizard.ts`

---

### 7. **Interfaces CreatePropertyData dupliquées**

**Fichier 1: `features/properties/services/properties.service.ts` (lignes 14-53)**
```typescript
export interface CreatePropertyData {
  type: PropertyType;  // ❌ Ancien
  // ... ~40 champs
}
```

**Problème**: Utilise `PropertyType` (ancien) au lieu de `PropertyTypeV3`

**Recommandation**:
- ✅ Créer `CreatePropertyDataV3` basé sur `PropertyV3`
- ✅ Déprécier `CreatePropertyData`
- ✅ Migrer les services vers V3

---

### 8. **Schémas ParkingDetails dupliqués**

**Fichier 1: `lib/types/index.ts` (lignes 70-84)**
```typescript
export interface ParkingDetails {
  placement_type: ParkingPlacementType;  // "outdoor" | "covered" | "box" | "underground"
  // ... JSONB structure
}
```

**Fichier 2: `lib/types/property-v3.ts` (lignes 79-97)**
```typescript
export type ParkingTypeV3 = "place_exterieure" | "place_couverte" | "box" | "souterrain";
export type ParkingGabaritV3 = "citadine" | "berline" | "suv" | "utilitaire" | "2_roues";
// ... Colonnes structurées au lieu de JSONB
```

**Impact**:
- Modèle V3 utilise des colonnes dédiées (meilleur pour la BDD)
- Ancien modèle utilise JSONB (flexible mais moins performant)

**Recommandation**:
- ✅ Continuer la migration vers colonnes structurées V3
- ✅ Créer une fonction de conversion `toParkingV3Columns(details: ParkingDetails)`

---

### 9. **Enums PropertyStatus dupliqués**

**Fichier 1: `lib/types/index.ts` (ligne 24)**
```typescript
export type PropertyStatus = 
  | "brouillon" 
  | "en_attente" 
  | "published" 
  | "publie"      // ❌ Doublon
  | "rejete" 
  | "rejected"    // ❌ Doublon
  | "archive" 
  | "archived";   // ❌ Doublon
```

**Fichier 2: `lib/types/property-v3.ts` (lignes 65-70)**
```typescript
export type PropertyStatusV3 =
  | "draft"
  | "pending_review"   // ✅ Unifié
  | "published"
  | "rejected"
  | "archived";
```

**Impact**:
- Valeurs dupliquées en français/anglais dans `PropertyStatus`
- Incohérence

**Recommandation**:
- ✅ Utiliser uniquement `PropertyStatusV3` (valeurs anglaises)
- ✅ Corriger les valeurs dupliquées dans `PropertyStatus`

---

### 10. **Types de bail dupliqués**

**Fichier 1: `lib/types/index.ts` (lignes 86-96)**
```typescript
export type LeaseType =
  | "nu"
  | "meuble"
  | "colocation"
  | "saisonnier"
  | "bail_mobilite"
  | "commercial_3_6_9"
  | "commercial_derogatoire"
  | "professionnel"
  | "contrat_parking"
  | "location_gerance";
```

**Fichier 2: `lib/types/property-v3.ts` (lignes 103-130)**
```typescript
export type TypeBailHabitation = "vide" | "meuble" | "colocation";
export type TypeBailParking = "parking_seul" | "accessoire_logement";
export type TypeBailPro = "3_6_9" | "derogatoire" | "precaire" | "professionnel" | "autre";
export type TypeBailV3 = TypeBailHabitation | TypeBailParking | TypeBailPro;
```

**Impact**:
- V3 structure mieux selon le type de bien
- Ancien modèle mélange tout

**Recommandation**:
- ✅ Utiliser `TypeBailV3` (discriminé par type de bien)
- ✅ Créer une fonction de compatibilité

---

## 🟢 MINEURS - Doublons avec faible impact

### 11. **Options de sélection de type de bien**

**Fichier 1: `features/properties/components/property-form.tsx` (lignes 22-32)**
```typescript
const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string; defaultUsage: PropertyUsage }[] = [
  { value: "appartement", label: "Appartement", defaultUsage: "habitation" },
  // ...
];
```

**Fichier 2: `lib/types/property-v3.ts` (lignes 39-56)**
```typescript
export const PROPERTY_TYPE_GROUPS = {
  habitation: [
    { value: "appartement" as const, label: "Appartement", icon: "🏠" },
    // ...
  ],
  // ...
};
```

**Recommandation**:
- ✅ Utiliser `PROPERTY_TYPE_GROUPS` partout
- ✅ Retirer `PROPERTY_TYPE_OPTIONS`

---

### 12. **Schémas de validation d'adresse dupliqués**

**Problème**: La validation d'adresse est répétée dans :
- `lib/validations/index.ts` (propertySchema)
- `lib/validations/property-v3.ts` (basePropertySchemaV3)
- `lib/validations/onboarding.ts` (firstPropertySchema)

**Recommandation**:
- ✅ Créer `addressSchema` réutilisable
- ✅ Importer dans tous les schémas

---

### 13. **Schémas DPE dupliqués**

**Problème**: Validation DPE répétée dans :
- `lib/validations/index.ts`
- `lib/validations/property-v3.ts`
- `lib/validations/onboarding.ts`

**Recommandation**:
- ✅ Créer `dpeSchema` réutilisable

---

## 📊 STATISTIQUES

### Résumé par catégorie

| Catégorie | Nombre de doublons | Priorité |
|-----------|-------------------|----------|
| Types/Interfaces | 8 | 🔴 Critique |
| Schémas Validation | 6 | 🔴 Critique |
| Composants Wizard | 4 | 🔴 Critique |
| Constantes/Enums | 5 | 🟡 Important |
| Services/Utils | 3 | 🟡 Important |
| Configurations | 2 | 🟡 Important |
| **TOTAL** | **28** | |

### Fichiers les plus dupliqués

1. `lib/types/index.ts` - 12 occurrences
2. `lib/types/property-v3.ts` - 10 occurrences
3. `lib/validations/index.ts` - 8 occurrences
4. `lib/validations/property-v3.ts` - 6 occurrences
5. `features/properties/components/property-wizard.tsx` - 4 occurrences

---

## ✅ PLAN D'ACTION RECOMMANDÉ

### Phase 1: Migration V3 (URGENT - 2 semaines)

1. ✅ Unifier `PropertyTypeV3` comme source unique
   - Créer fonctions de compatibilité
   - Marquer `PropertyType` comme `@deprecated`
   - Migration progressive

2. ✅ Unifier `propertySchemaV3` comme source unique
   - Retirer `propertySchema` (ancien)
   - Créer schémas partiels pour onboarding

3. ✅ Unifier `PropertyV3` comme interface principale
   - Fonction de conversion `toPropertyV3()`
   - Migration progressive des composants

### Phase 2: Nettoyage des Wizards (IMPORTANT - 1 semaine)

4. ✅ Unifier vers `PropertyWizardV3`
   - Retirer `PropertyWizard` et `ParkingWizard`
   - Utiliser `PropertyWizardV3` partout
   - Redirection `/properties/new` → `/properties/new-v3`

### Phase 3: Nettoyage des constantes (MOYEN - 3 jours)

5. ✅ Extraire constantes dupliquées
   - `ROOM_TYPES` → `lib/types/property-v3.ts`
   - `PHOTO_TAGS` → `lib/types/property-v3.ts`
   - `PROPERTY_TYPE_GROUPS` → utilisé partout

### Phase 4: Schémas réutilisables (FAIBLE - 2 jours)

6. ✅ Créer schémas de base réutilisables
   - `addressSchema`
   - `dpeSchema`
   - `parkingSchema`

---

## 🎯 MÉTRIQUES DE SUCCÈS

- [ ] 0 doublon critique (Phase 1)
- [ ] 0 doublon important (Phase 2)
- [ ] 90% réduction des doublons mineurs (Phase 3-4)
- [ ] 100% des composants utilisent V3 (Phase 2)
- [ ] 0 fichier `@deprecated` restant (Phase 1)

---

## 📝 NOTES

- Ce rapport a été généré par analyse automatique du codebase
- Certains doublons peuvent être intentionnels (compatibilité temporaire)
- Les recommandations doivent être validées par l'équipe avant implémentation
- Migration progressive recommandée pour éviter les régressions

---

**Généré le**: 2025-02-15  
**Version du rapport**: 1.0

