# RECOMMANDATIONS DE REFACTORING - TALOK

> **Generated**: 2026-01-17
> **Status**: PHASE 1 COMPLÈTE - En attente de validation

---

## RÉSUMÉ EXÉCUTIF

| Métrique | Valeur |
|----------|--------|
| Routes totales | 652 |
| Event handlers critiques | 200+ |
| Imports non utilisés | 2 |
| Patterns dupliqués | 8 majeurs |
| Améliorations TypeScript | 75+ |
| Gros fichiers à splitter | 9 |

---

## ZONES INTERDITES (NE JAMAIS TOUCHER)

Ces fichiers contiennent de la logique critique et NE DOIVENT PAS être modifiés:

### Server Actions
- `/app/owner/leases/actions.ts`
- `/app/owner/money/actions.ts`
- `/app/owner/properties/actions.ts`

### Signature & Paiement
- `/app/signature/[token]/SignatureFlow.tsx`
- `/app/signature-edl/[token]/EDLSignatureClient.tsx`
- `/features/billing/components/payment-checkout.tsx`
- `/components/payments/ManualPaymentDialog.tsx`
- `/components/payments/CashReceiptFlow.tsx`
- `/components/payments/SignaturePad.tsx`

### Authentication
- `/features/auth/components/sign-in-form.tsx`
- `/components/white-label/branded-login.tsx`
- `/middleware.ts`
- Tous les fichiers dans `/app/auth/*`

### Webhooks & API Critiques
- `/api/webhooks/stripe`
- `/api/webhooks/payments`
- `/api/subscriptions/webhook`

---

## RECOMMANDATIONS PAR NIVEAU DE RISQUE

---

## 🟢 LOW RISK - Quick Wins (À faire maintenant)

### 1. Supprimer les imports non utilisés

**Fichiers concernés:**

#### `/app/tenant/onboarding/context/page.tsx` - Ligne 15
```typescript
// AVANT
import { Home, Key, ArrowRight, Mail } from "lucide-react";

// APRÈS
import { Home, Key, ArrowRight } from "lucide-react";
```

#### `/app/messages/page.tsx` - Ligne 38
```typescript
// AVANT
import {
  Search, MessageSquare, Home, Users, Wrench, Building2,
  Filter, RefreshCw, Send, Paperclip, MoreVertical, Plus,
  ArrowLeft, Check, CheckCheck,
} from "lucide-react";

// APRÈS (supprimer Paperclip)
import {
  Search, MessageSquare, Home, Users, Wrench, Building2,
  Filter, RefreshCw, Send, MoreVertical, Plus,
  ArrowLeft, Check, CheckCheck,
} from "lucide-react";
```

**Effort**: 5 minutes
**Risque**: Aucun

---

### 2. Créer des composants Loading/Empty réutilisables

**Pattern dupliqué trouvé dans:**
- `/components/admin/owner-activity-feed.tsx` (lignes 217-240)
- `/components/provider/provider-reviews.tsx` (lignes 200-209)
- Et 10+ autres composants

**Action proposée:**
Créer `/components/ui/data-states.tsx`:

```typescript
// Composants à créer
export function DataLoadingSkeleton({ message = "Chargement..." }) {...}
export function DataEmptyState({ icon, title, description, action }) {...}
export function DataErrorState({ error, onRetry }) {...}
```

**Effort**: 2 heures
**Risque**: Aucun (nouveaux composants, refactoring opt-in)

---

### 3. Améliorer le typage des erreurs (catch blocks)

**Pattern problématique (30+ occurrences):**
```typescript
// MAUVAIS
} catch (error: any) {
  toast({ description: error.message });
}

// BON
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inconnue";
  toast({ description: message });
}
```

**Fichiers prioritaires:**
- `/features/auth/components/sign-in-form.tsx` (4 occurrences)
- `/features/billing/components/charge-form.tsx` (1 occurrence)
- `/components/settings/security-settings.tsx` (4 occurrences)

**Effort**: 3 heures
**Risque**: Très faible (amélioration du typage uniquement)

---

## 🟡 MEDIUM RISK - Consolidation (Après validation)

### 4. Créer une classe de service base Supabase

**Pattern dupliqué dans:**
- `/features/billing/services/charges.service.ts`
- `/features/billing/services/payments.service.ts`
- `/features/documents/services/documents.service.ts`
- `/features/copro/services/sites.service.ts`
- Et 15+ autres services

**Action proposée:**
Créer `/lib/services/base-supabase.service.ts`:

```typescript
export abstract class BaseSupabaseService<T> {
  protected supabase = createClient();
  protected abstract tableName: string;

  protected async handleQuery<R>(
    query: Promise<{ data: R | null; error: any }>
  ): Promise<R> {
    const { data, error } = await query;
    if (error) throw error;
    return data as R;
  }

  async getById(id: string): Promise<T> {
    return this.handleQuery(
      this.supabase.from(this.tableName).select("*").eq("id", id).single()
    );
  }

  // ... autres méthodes CRUD
}
```

**Effort**: 1 jour
**Risque**: Moyen - Nécessite tests unitaires

### 5. Standardiser l'utilisation des hooks existants

**Hooks existants sous-utilisés:**
- `/lib/hooks/use-api.ts` → `useApiQuery`, `useApiMutation`
- `/lib/hooks/use-form-with-validation.ts` → `useFormWithValidation`

**Composants à migrer (non-exhaustif):**
- `/features/billing/components/charge-form.tsx` → utiliser `useFormWithValidation`
- `/features/documents/components/document-upload-form.tsx` → utiliser `useApiMutation`
- `/components/provider/provider-reviews.tsx` → utiliser `useApiQuery`

**Effort**: 2 jours
**Risque**: Moyen - Garder les signatures identiques

---

## 🟠 HIGH RISK - Splitting de fichiers (Planification requise)

### 6. Splitter `/app/admin/plans/page.tsx` (2,644 lignes)

**Structure actuelle:** Monolithe avec 15+ responsabilités
**Impact:** Admin seulement, pas de routes publiques affectées

**Structure proposée:**
```
/features/admin/plans/
├── components/
│   ├── PlanCard.tsx
│   ├── PlanEditor.tsx
│   ├── RevenueSimulator.tsx
│   ├── BulkActionsToolbar.tsx
│   ├── EmailPreviewModal.tsx
│   └── PlanDistributionChart.tsx
├── hooks/
│   ├── usePlanEditor.ts
│   ├── usePlanDragDrop.ts
│   └── usePlanFilters.ts
├── services/
│   └── planStorage.service.ts
└── page.tsx (<1000 lignes)
```

**Effort**: 3-4 jours
**Risque**: Élevé - Fonctionnalité admin critique

### 7. Splitter `/app/owner/properties/[id]/PropertyDetailsClient.tsx` (1,958 lignes)

**Structure proposée:**
```
/app/owner/properties/[id]/
├── components/
│   ├── PropertyPhotosSection.tsx
│   ├── PropertyCharacteristicsSection.tsx
│   ├── PropertyFinancialSection.tsx
│   ├── PropertyLeaseSection.tsx
│   ├── PropertyMapSection.tsx
│   └── PropertyGalleryModal.tsx
├── hooks/
│   ├── usePropertyEditing.ts
│   └── usePropertyPhotos.ts
└── PropertyDetailsClient.tsx (<600 lignes)
```

**Effort**: 3-4 jours
**Risque**: Élevé - Feature owner utilisée quotidiennement

### 8. Splitter `/app/owner/inspections/new/CreateInspectionWizard.tsx` (1,786 lignes)

**Structure proposée:**
```
/features/end-of-lease/components/
├── CreateInspectionWizard.tsx (<500 lignes)
├── steps/
│   ├── LeaseSelectionStep.tsx
│   ├── InspectionTypeStep.tsx
│   ├── MeterReadingsStep.tsx
│   ├── RoomSelectionStep.tsx
│   ├── InspectionDetailsStep.tsx
│   ├── KeyManagementStep.tsx
│   └── SummaryStep.tsx
└── hooks/
    ├── useWizardState.ts
    └── useMeterReadings.ts
```

**Effort**: 4-5 jours
**Risque**: Élevé - Workflow EDL critique

---

## 🔴 CRITICAL - À discuter avant action

### 9. Refactorer `/features/accounting/services/accounting.service.ts` (1,272 lignes)

Ce service gère:
- Calculs d'honoraires
- Génération CRG (Compte Rendu de Gestion)
- Export FEC (Fichier des Écritures Comptables)
- Régularisation des charges

**⚠️ ATTENTION**: Ce fichier touche aux calculs financiers et fiscaux.
Toute modification doit être validée par tests de régression complets.

**Structure proposée (si validé):**
```
/features/accounting/services/
├── accounting.service.ts (facade)
├── calculators/
│   ├── honorairesCalculator.ts
│   ├── prorataCalculator.ts
│   └── chargeRegularizationCalculator.ts
├── generators/
│   ├── crgGenerator.ts
│   ├── grandLivreGenerator.ts
│   └── fecGenerator.ts
└── processors/
    ├── tenantSituationProcessor.ts
    └── fiscalSummaryProcessor.ts
```

**Effort**: 5-7 jours
**Risque**: CRITIQUE - Impact fiscal/comptable

---

## PLAN D'EXÉCUTION SUGGÉRÉ

### Phase 1: Quick Wins (Cette semaine)
1. ✅ Supprimer imports non utilisés (5 min)
2. ✅ Créer composants Loading/Empty (2h)
3. ✅ Améliorer typage erreurs (3h)

### Phase 2: Consolidation (Semaine prochaine)
4. ⬜ Créer BaseSupabaseService (1 jour)
5. ⬜ Migrer vers hooks existants (2 jours)

### Phase 3: Splitting (Après validation)
6. ⬜ Splitter admin/plans (3-4 jours)
7. ⬜ Splitter PropertyDetailsClient (3-4 jours)
8. ⬜ Splitter CreateInspectionWizard (4-5 jours)

### Phase 4: Critique (Après tests de régression)
9. ⬜ Refactorer accounting.service (5-7 jours)

---

## PROCESSUS DE VALIDATION

Avant chaque modification:

1. **Build check**: `npm run build`
2. **Type check**: `npm run type-check`
3. **Tests**: `npm run test`
4. **Commit**: Un fichier = Un commit
5. **Si erreur**: `git checkout -- <fichier>` immédiat

---

## MÉTRIQUES DE SUCCÈS

| Métrique | Avant | Objectif |
|----------|-------|----------|
| Lignes max/fichier | 2,644 | < 800 |
| `any` types | 75+ | < 20 |
| Imports non utilisés | 2 | 0 |
| Patterns dupliqués | 8 | 3 |
| Temps de build | ? | -10% |

---

## QUESTIONS POUR VALIDATION

1. **Priorité 1**: Dois-je commencer par les Quick Wins (risque 0)?
2. **Splitting**: Quelle feature splitter en premier (admin/plans ou PropertyDetails)?
3. **Accounting**: Ce service nécessite-t-il des tests de régression avant toute modification?
4. **TypeScript**: Quel niveau de strictness viser pour les `any` types?

---

**En attente de ta validation avant de procéder à la Phase 2.**
