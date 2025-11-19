# 📋 Guide des Conventions de Nommage

**Version:** 1.0  
**Date:** $(date)  
**Status:** ✅ Actif

---

## 🎯 Objectif

Ce guide définit les conventions de nommage à suivre dans le projet pour garantir la cohérence et la maintenabilité du code.

---

## 📁 CONVENTIONS DE FICHIERS

### Fichiers TypeScript/React

#### Composants React
- **Format:** `kebab-case.tsx`
- **Exemple:** `property-card.tsx`, `lease-form.tsx`, `invoice-detail.tsx`
- **Règle:** Toujours utiliser kebab-case pour les fichiers de composants

#### Services
- **Format:** `kebab-case.service.ts`
- **Exemple:** `properties.service.ts`, `invoices.service.ts`, `auth.service.ts`
- **Règle:** Suffixe `.service.ts` pour les services métier

#### Types/Interfaces
- **Format:** `kebab-case.ts` ou `index.ts`
- **Exemple:** `property-v3.ts`, `compatibility.ts`, `index.ts`
- **Règle:** kebab-case pour les fichiers de types spécifiques

#### Helpers/Utils
- **Format:** `kebab-case.ts` ou `kebab-case-helper.ts`
- **Exemple:** `auth-helper.ts`, `api-error.ts`, `code-generator.ts`
- **Règle:** kebab-case avec suffixe `-helper` si nécessaire pour clarifier

#### Hooks React
- **Format:** `use-kebab-case.ts`
- **Exemple:** `use-auth.ts`, `use-properties.ts`, `use-invoices.ts`
- **Règle:** Préfixe `use-` obligatoire pour les hooks

#### Validations Zod
- **Format:** `kebab-case.ts` ou `kebab-case-validation.ts`
- **Exemple:** `property-v3.ts`, `params.ts`, `schemas-shared.ts`
- **Règle:** kebab-case, suffixe optionnel pour clarifier

#### Configurations
- **Format:** `kebab-case.ts` ou `kebab-case-config.ts`
- **Exemple:** `property-wizard-loader.ts`, `owner-routes.ts`
- **Règle:** kebab-case avec suffixe optionnel

---

## 🔤 CONVENTIONS DE NOM DE VARIABLES/FONCTIONS

### Variables et Constantes

#### Variables locales
- **Format:** `camelCase`
- **Exemple:** `formData`, `isLoading`, `currentStep`
- **Règle:** camelCase pour les variables et constantes

#### Constantes globales
- **Format:** `UPPER_SNAKE_CASE`
- **Exemple:** `MAX_REQUEST_TIME`, `AUTH_TIMEOUT`, `QUERY_TIMEOUT`
- **Règle:** UPPER_SNAKE_CASE pour les constantes globales

#### Enums
- **Format:** `PascalCase` pour le type, valeurs en `snake_case` ou `camelCase`
- **Exemple:** 
  ```typescript
  enum PropertyStatus {
    DRAFT = "draft",
    PENDING_REVIEW = "pending_review",
    PUBLISHED = "published"
  }
  ```

### Fonctions

#### Fonctions nommées
- **Format:** `camelCase`
- **Exemple:** `fetchProperty`, `validatePropertyData`, `handleSubmit`
- **Règle:** camelCase, verbe d'action en premier

#### Fonctions utilitaires
- **Format:** `camelCase` avec préfixe si nécessaire
- **Exemple:** `toPropertyV3`, `fromPropertyTypeV3`, `getValidationMessage`
- **Règle:** Préfixes `to`, `from`, `get`, `set`, `is`, `has` pour clarifier l'intention

#### Fonctions async
- **Format:** `camelCase` (pas de suffixe spécial)
- **Exemple:** `fetchProperty`, `createProperty`, `updateProperty`
- **Règle:** Pas de suffixe `Async`, le type de retour indique si c'est async

---

## 🏗️ CONVENTIONS DE CLASSES/INTERFACES/TYPES

### Classes
- **Format:** `PascalCase`
- **Exemple:** `ApiError`, `PropertyWizardV3`
- **Règle:** PascalCase, nom descriptif

### Interfaces
- **Format:** `PascalCase` (sans préfixe `I`)
- **Exemple:** `Property`, `PropertyV3`, `CreatePropertyData`
- **Règle:** PascalCase, nom descriptif, pas de préfixe `I`

### Types
- **Format:** `PascalCase` avec suffixe `Type` si nécessaire
- **Exemple:** `PropertyType`, `PropertyTypeV3`, `PropertyStatus`
- **Règle:** PascalCase, suffixe `Type` pour les types union/enum

### Props d'interfaces
- **Format:** `PascalCase` avec suffixe `Props`
- **Exemple:** `PropertyFormProps`, `PropertyWizardV3Props`
- **Règle:** PascalCase + suffixe `Props` pour les props de composants

---

## 📦 CONVENTIONS DE MODULES/IMPORTS

### Exports nommés
- **Format:** `camelCase` pour fonctions/variables, `PascalCase` pour types/classes
- **Exemple:** 
  ```typescript
  export function validateProperty() {}
  export const propertySchema = z.object({});
  export type Property = {...};
  export class ApiError extends Error {}
  ```

### Exports par défaut
- **Format:** `PascalCase` pour composants React
- **Exemple:** 
  ```typescript
  export default function PropertyCard() {}
  ```

### Imports
- **Format:** Grouper par type (React, libs externes, internes)
- **Exemple:**
  ```typescript
  // React & Next.js
  import { useState, useEffect } from "react";
  import { useRouter } from "next/navigation";
  
  // UI Components
  import { Button } from "@/components/ui/button";
  
  // Types
  import type { Property } from "@/lib/types";
  
  // Services
  import { propertiesService } from "@/features/properties/services/properties.service";
  
  // Helpers
  import { handleApiError } from "@/lib/helpers/api-error";
  ```

---

## 🗂️ CONVENTIONS DE STRUCTURE DE DOSSIERS

### Structure recommandée

```
/app                    # Routes Next.js (App Router)
  /[feature]            # Routes par feature (kebab-case)
    /[id]               # Routes dynamiques
      page.tsx          # Page principale
      edit/             # Sous-routes
        page.tsx

/features               # Logique métier par domaine
  /[feature]           # Feature (kebab-case)
    /components/        # Composants spécifiques à la feature
      [component].tsx  # kebab-case.tsx
    /services/         # Services métier
      [feature].service.ts  # kebab-case.service.ts

/components             # Composants UI réutilisables
  /ui                  # Composants shadcn/ui
  /layout              # Composants de layout
  /[category]          # Catégories (kebab-case)

/lib                    # Utilitaires et configurations
  /helpers             # Helpers (kebab-case.ts)
  /hooks               # Hooks React (use-kebab-case.ts)
  /types               # Types TypeScript
  /validations         # Schémas Zod
  /config              # Configurations
  /supabase            # Clients Supabase
```

---

## 🎨 CONVENTIONS SPÉCIFIQUES PAR TYPE

### Composants React

#### Composants fonctionnels
```typescript
// Format: PascalCase pour le nom du composant
export function PropertyCard({ property }: PropertyCardProps) {
  // ...
}

// Props: PascalCase + suffixe Props
interface PropertyCardProps {
  property: Property;
  onEdit?: () => void;
}
```

#### Composants avec export default
```typescript
// Format: PascalCase pour le nom du composant
export default function PropertyCard({ property }: PropertyCardProps) {
  // ...
}
```

### Services

```typescript
// Format: camelCase pour le nom du service
export const propertiesService = {
  async getPropertyById(id: string): Promise<Property> {
    // ...
  },
  
  async createProperty(data: CreatePropertyData): Promise<Property> {
    // ...
  }
};
```

### Helpers

```typescript
// Format: camelCase pour les fonctions
export function validatePropertyData(data: unknown): PropertyV3 {
  // ...
}

// Format: PascalCase pour les classes
export class ApiError extends Error {
  // ...
}
```

### Hooks

```typescript
// Format: camelCase avec préfixe use-
export function useProperties() {
  // ...
}

export function useAuth() {
  // ...
}
```

---

## ✅ CHECKLIST DE CONFORMITÉ

Avant de créer un nouveau fichier, vérifier :

- [ ] Le nom du fichier est en `kebab-case`
- [ ] Les composants React sont en `PascalCase`
- [ ] Les fonctions sont en `camelCase`
- [ ] Les types/interfaces sont en `PascalCase`
- [ ] Les constantes globales sont en `UPPER_SNAKE_CASE`
- [ ] Les hooks ont le préfixe `use-`
- [ ] Les services ont le suffixe `.service.ts`
- [ ] Les imports sont groupés et ordonnés

---

## 📝 EXEMPLES CONCRETS

### ✅ BONNES PRATIQUES

```typescript
// Fichier: lib/helpers/auth-helper.ts
export function getAuthenticatedUser(request: Request) {
  // ...
}

export class AuthError extends Error {
  // ...
}

// Fichier: features/properties/components/property-card.tsx
interface PropertyCardProps {
  property: Property;
  onEdit?: () => void;
}

export function PropertyCard({ property, onEdit }: PropertyCardProps) {
  // ...
}

// Fichier: features/properties/services/properties.service.ts
export const propertiesService = {
  async getPropertyById(id: string): Promise<Property> {
    // ...
  }
};

// Fichier: lib/hooks/use-properties.ts
export function useProperties() {
  // ...
}
```

### ❌ MAUVAISES PRATIQUES

```typescript
// ❌ Mauvais: PascalCase pour fichier
// PropertyCard.tsx

// ❌ Mauvais: snake_case pour fonction
function get_property_by_id() {}

// ❌ Mauvais: Préfixe I pour interface
interface IProperty {}

// ❌ Mauvais: Pas de préfixe use- pour hook
function properties() {}

// ❌ Mauvais: camelCase pour constante globale
const maxRequestTime = 15000;
```

---

## 🔄 MIGRATION PROGRESSIVE

Les conventions suivantes sont recommandées pour les nouveaux fichiers :

1. **Nouveaux fichiers:** Toujours suivre ces conventions
2. **Fichiers existants:** Migrer progressivement lors des modifications
3. **Refactoring:** Prioriser les fichiers les plus utilisés

---

## 📚 RÉFÉRENCES

- [TypeScript Style Guide](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [React Style Guide](https://react.dev/learn/thinking-in-react)
- [Next.js App Router](https://nextjs.org/docs/app)

---

**Dernière mise à jour:** $(date)

