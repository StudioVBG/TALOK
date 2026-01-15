# Rapport d'Analyse des Fichiers Volumineux - TALOK

**Date:** 15 Janvier 2026
**Analyse réalisée sur:** 100+ fichiers de plus de 500 lignes

---

## Executive Summary

Le projet TALOK contient **100+ fichiers** dépassant 500 lignes de code. Les 20 plus gros fichiers représentent environ **25,000 lignes** qui nécessitent une refactorisation pour améliorer la maintenabilité, testabilité et performance.

### Statistiques Clés

| Métrique | Valeur |
|----------|--------|
| Fichiers > 500 lignes | 100+ |
| Fichiers > 1000 lignes | 25 |
| Fichiers > 1500 lignes | 6 |
| Plus gros fichier | 2,644 lignes |
| Total lignes à refactoriser | ~50,000 |

---

## Top 20 des Fichiers Critiques

| Rang | Fichier | Lignes | Catégorie | Urgence |
|------|---------|--------|-----------|---------|
| 1 | `app/admin/plans/page.tsx` | 2,644 | Admin UI | 🔴 Critique |
| 2 | `app/owner/properties/[id]/PropertyDetailsClient.tsx` | 1,958 | Property UI | 🔴 Critique |
| 3 | `features/leases/components/parking-lease-wizard/index.tsx` | 1,751 | Wizard | 🔴 Critique |
| 4 | `app/owner/inspections/new/CreateInspectionWizard.tsx` | 1,657 | Wizard | 🔴 Critique |
| 5 | `supabase/functions/process-outbox/index.ts` | 1,488 | Backend | 🔴 Critique |
| 6 | `app/owner/tickets/[id]/page.tsx` | 1,415 | Tickets UI | 🟠 Haut |
| 7 | `app/signature/[token]/SignatureFlow.tsx` | 1,383 | Signature | 🟠 Haut |
| 8 | `lib/templates/bail/bail-mobilite.template.ts` | 1,373 | Template | 🟡 Moyen |
| 9 | `app/owner/leases/[id]/LeaseDetailsClient.tsx` | 1,369 | Lease UI | 🟠 Haut |
| 10 | `lib/templates/edl/edl.template.ts` | 1,345 | Template | 🟡 Moyen |
| 11 | `features/accounting/services/accounting.service.ts` | 1,272 | Service | 🟠 Haut |
| 12 | `app/admin/providers/pending/page.tsx` | 1,252 | Admin UI | 🟠 Haut |
| 13 | `lib/subscriptions/plans.ts` | 1,243 | Config | 🟡 Moyen |
| 14 | `lib/templates/bail/bail-meuble.template.ts` | 1,177 | Template | 🟡 Moyen |
| 15 | `lib/emails/templates.ts` | 1,144 | Email | 🟠 Haut |
| 16 | `app/admin/moderation/page.tsx` | 1,114 | Admin UI | 🟠 Haut |
| 17 | `app/signature/[token]/CNIScanner.tsx` | 1,102 | OCR UI | 🟠 Haut |
| 18 | `app/admin/templates/TemplatesClient.tsx` | 1,081 | Admin UI | 🟠 Haut |
| 19 | `app/api/scrape/route.ts` | 1,070 | API | 🟠 Haut |
| 20 | `features/properties/components/v3/property-detail-premium.tsx` | 1,046 | Property UI | 🟠 Haut |

---

## Analyse Détaillée des Problèmes

### 1. Code Smells Identifiés

#### A. God Components (Composants Monolithiques)
- **Problème**: Composants avec trop de responsabilités
- **Fichiers affectés**: `admin/plans/page.tsx`, `PropertyDetailsClient.tsx`, tous les wizards
- **Impact**: Difficile à tester, maintenir et comprendre

#### B. Code Legacy Non Supprimé
- **Problème**: Fonctions marquées `@deprecated` toujours présentes
- **Exemple**: `PropertyDetailsClient.tsx` contient `_PropertyCharacteristicsBadges_LEGACY` et `_PropertyEditForm_LEGACY`
- **Impact**: Confusion, taille de bundle inutile

#### C. Switch Statements Géants
- **Problème**: `process-outbox/index.ts` contient un switch de 800+ lignes
- **Impact**: Violation Open/Closed Principle, difficile à étendre

#### D. Templates Email Inline
- **Problème**: HTML emails codés en dur dans le code TypeScript
- **Fichiers**: `lib/emails/templates.ts`, `process-outbox/index.ts`
- **Impact**: Difficile à maintenir, pas de réutilisation

#### E. Wizards Monolithiques
- **Problème**: Tous les steps dans un seul fichier
- **Fichiers**: `ParkingLeaseWizard`, `CreateInspectionWizard`, `LeaseWizard`
- **Impact**: Fichiers de 1500+ lignes

---

## Solutions SOTA de Refactorisation

### Pattern 1: Feature-Sliced Design (FSD)

Architecture moderne recommandée pour React/Next.js:

```
features/
├── plans/
│   ├── api/              # Appels API
│   ├── components/       # Composants UI
│   │   ├── PlanCard/
│   │   ├── PlanEditor/
│   │   ├── PlanSimulator/
│   │   └── index.ts
│   ├── hooks/            # Custom hooks
│   │   ├── usePlanMutations.ts
│   │   ├── usePlanQueries.ts
│   │   └── index.ts
│   ├── stores/           # State management
│   ├── types/            # TypeScript types
│   ├── utils/            # Helpers
│   └── index.ts          # Public API
```

### Pattern 2: Compound Components

Pour les wizards multi-étapes:

```tsx
// Avant (1700 lignes dans un fichier)
export function ParkingLeaseWizard() {
  // Tout le code ici...
}

// Après (fichiers séparés + composition)
// features/leases/components/parking-wizard/index.tsx
export function ParkingLeaseWizard({ children }) {
  return (
    <WizardProvider>
      <WizardContainer>{children}</WizardContainer>
    </WizardProvider>
  );
}

ParkingLeaseWizard.StepType = StepParkingType;
ParkingLeaseWizard.StepDetails = StepDetails;
ParkingLeaseWizard.StepConditions = StepConditions;
ParkingLeaseWizard.StepFinancial = StepFinancial;
ParkingLeaseWizard.StepParties = StepParties;
ParkingLeaseWizard.StepPreview = StepPreview;

// Usage
<ParkingLeaseWizard>
  <ParkingLeaseWizard.StepType />
  <ParkingLeaseWizard.StepDetails />
  ...
</ParkingLeaseWizard>
```

### Pattern 3: Strategy Pattern pour Event Processing

Pour `process-outbox/index.ts`:

```typescript
// Avant (switch géant)
async function processEvent(event: OutboxEvent) {
  switch (event.type) {
    case "lease_signed": // 50 lignes
    case "payment_received": // 40 lignes
    // ... 25+ cases
  }
}

// Après (Strategy Pattern)
// handlers/index.ts
export const eventHandlers: Record<EventType, EventHandler> = {
  lease_signed: new LeaseSignedHandler(),
  payment_received: new PaymentReceivedHandler(),
  // ...
};

// processor.ts
async function processEvent(event: OutboxEvent) {
  const handler = eventHandlers[event.type];
  if (!handler) throw new UnknownEventError(event.type);
  return handler.execute(event);
}
```

### Pattern 4: Template Builder pour Emails

```typescript
// Avant (HTML inline)
const emailHtml = `<html>...1000 lignes...</html>`;

// Après (Template Builder)
// lib/emails/builders/EmailBuilder.ts
export class EmailBuilder {
  private sections: EmailSection[] = [];

  addHeader(title: string) { /*...*/ }
  addBody(content: string) { /*...*/ }
  addButton(label: string, url: string) { /*...*/ }
  addFooter() { /*...*/ }

  build(): string { /*...*/ }
}

// Usage
const email = new EmailBuilder()
  .addHeader("Signature requise")
  .addBody(`Bonjour ${tenant.name}...`)
  .addButton("Signer le bail", signatureUrl)
  .addFooter()
  .build();
```

### Pattern 5: Composable Templates pour Bails

```typescript
// Avant (1300 lignes de texte légal)
export const bailMobiliteTemplate = `...tout le texte...`;

// Après (Composition de clauses)
// lib/templates/clauses/index.ts
export const CLAUSES = {
  parties: partiesClause,
  description: descriptionClause,
  duration: {
    mobilite: mobileDurationClause,
    meuble: meubleDurationClause,
    nu: nuDurationClause,
  },
  rent: rentClause,
  deposit: depositClause,
  // ...
};

// lib/templates/composers/BailComposer.ts
export class BailComposer {
  compose(type: BailType, data: LeaseData): string {
    return [
      CLAUSES.parties(data),
      CLAUSES.description(data),
      CLAUSES.duration[type](data),
      // ...
    ].join('\n\n');
  }
}
```

### Pattern 6: Custom Hooks pour State Management

```typescript
// Avant (state dans le composant)
function PropertyDetailsClient({ details }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState({});
  const [photos, setPhotos] = useState([]);
  const [pendingPhotos, setPendingPhotos] = useState([]);
  // ... 20+ useState

  const handleSave = async () => { /* 85 lignes */ };
  // ...
}

// Après (hooks extraits)
// hooks/usePropertyEdit.ts
export function usePropertyEdit(propertyId: string) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState({});

  const saveChanges = useMutation(/* ... */);

  return { isEditing, editedValues, setEditedValues, saveChanges };
}

// hooks/usePhotoManagement.ts
export function usePhotoManagement(propertyId: string) {
  const [photos, setPhotos] = useState([]);
  const [pending, setPending] = useState([]);

  const upload = useCallback(/* ... */);
  const remove = useCallback(/* ... */);

  return { photos, pending, upload, remove };
}
```

---

## Plan d'Action Priorisé

### Phase 1: Quick Wins (1-2 semaines)

1. **Supprimer le code legacy deprecated**
   - `PropertyDetailsClient.tsx`: Supprimer `_LEGACY` functions
   - Impact: -700 lignes immédiatement

2. **Extraire les constantes**
   - Déplacer `VEHICLE_TYPES`, `ACCESS_METHODS`, etc. vers des fichiers config
   - Impact: Réutilisabilité + -200 lignes par wizard

3. **Créer des barrel exports**
   - Organiser les imports/exports de manière cohérente

### Phase 2: Composants (2-4 semaines)

4. **Refactoriser les Wizards**
   - Extraire chaque Step en composant séparé
   - Créer un `WizardProvider` pour le state
   - Fichiers cibles:
     - `ParkingLeaseWizard` → 6 fichiers
     - `CreateInspectionWizard` → 7 fichiers
     - `LeaseWizard` → fichiers steps

5. **Extraire les composants réutilisables**
   - `PhotoGallery` component
   - `CharacteristicsBadges` component
   - `EntityNotes` component

### Phase 3: Services (2-4 semaines)

6. **Refactoriser process-outbox**
   - Implémenter Strategy Pattern
   - Créer handlers par type d'événement
   - Extraire email builders

7. **Créer EmailTemplateService**
   - Builder pattern pour emails
   - Templates réutilisables
   - Support i18n

### Phase 4: Templates (2-3 semaines)

8. **Modulariser les templates de bail**
   - Créer bibliothèque de clauses
   - Composer les bails à partir des clauses
   - Versioning des clauses légales

---

## Métriques de Succès

| Métrique | Avant | Objectif |
|----------|-------|----------|
| Plus gros fichier | 2,644 lignes | < 500 lignes |
| Fichiers > 500 lignes | 100+ | < 20 |
| Couverture de tests | ~10% | > 60% |
| Temps de build | N/A | -20% |
| Bundle size | N/A | -15% |

---

## Recommandations Outils SOTA

### 1. Analyse Statique
- **ESLint + @typescript-eslint** avec règles complexity
- **Knip** pour détecter le code mort
- **madge** pour visualiser les dépendances circulaires

### 2. Testing
- **Vitest** pour unit tests rapides
- **Testing Library** pour tests composants
- **MSW** pour mocks API

### 3. Documentation
- **TypeDoc** pour la documentation automatique
- **Storybook** pour les composants UI

### 4. Monitoring
- **Bundle Analyzer** pour surveiller la taille
- **Lighthouse CI** pour les performances

---

## Conclusion

La refactorisation de TALOK est un investissement nécessaire pour:
- **Maintenabilité**: Code plus facile à comprendre et modifier
- **Testabilité**: Composants isolés = tests unitaires possibles
- **Performance**: Bundles plus petits, lazy loading efficace
- **Scalabilité**: Architecture permettant d'ajouter des features

L'approche recommandée est **incrémentale**: commencer par les quick wins, puis attaquer les fichiers les plus critiques en priorité.
