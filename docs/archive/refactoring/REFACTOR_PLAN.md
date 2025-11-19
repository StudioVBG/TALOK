# 🎯 Plan de Refactor - Gestion Locative

## 📊 Diagnostic Global

### Stack Technique
- **Frontend** : Next.js 14 (App Router), React 18, TypeScript
- **Backend** : Next.js API Routes + Supabase (PostgreSQL)
- **State Management** : TanStack Query (React Query)
- **Validation** : Zod
- **UI** : Tailwind CSS + shadcn/ui

### Problèmes Identifiés (par priorité)

#### 🔴 CRITIQUE - Sécurité & Fiabilité
1. **Services mixtes** : `leases.service.ts` et `invoices.service.ts` utilisent encore Supabase directement
   - Risque : Bypass des validations API, problèmes RLS, incohérences
   - Impact : Erreurs 400/500, données corrompues

2. **Validations manquantes** : Beaucoup d'API routes sans validation Zod stricte
   - Risque : Données invalides en base, erreurs runtime
   - Impact : Erreurs 500, corruption de données

3. **Gestion d'erreurs inconsistante** : Codes HTTP et messages variables
   - Risque : Debug difficile, UX dégradée
   - Impact : Erreurs utilisateur non claires

#### 🟡 IMPORTANT - Qualité & Maintenabilité
4. **Hooks dupliqués** : 3 variantes de `use-properties` avec logiques différentes
   - Impact : Confusion, bugs, maintenance difficile

5. **Usage excessif de `any`** : 1335 occurrences dans les API routes
   - Impact : Perte de type-safety, bugs runtime

6. **Relations entre entités** : Vérification nécessaire des FK et IDs
   - Impact : Données orphelines, erreurs de cohérence

#### 🟢 AMÉLIORATION - Nettoyage
7. **Code mort** : Fichiers non utilisés, composants dupliqués
8. **Conventions** : Normalisation des noms (anglais/français mixte)
9. **Documentation** : Consolidation des nombreux fichiers MD

---

## 🗺️ Plan d'Action par Étapes

### **ÉTAPE 1 : Migration Services → API Routes** (Priorité CRITIQUE)

**Objectif** : Tous les services doivent utiliser uniquement les API routes, jamais Supabase directement.

**Fichiers à modifier** :
- `features/leases/services/leases.service.ts`
  - `updateLease()` → utiliser `PATCH /api/leases/[id]`
  - `deleteLease()` → utiliser `DELETE /api/leases/[id]`
  - `getLeaseSigners()` → créer `GET /api/leases/[id]/signers`
  - `addSigner()` → créer `POST /api/leases/[id]/signers`
  - `removeSigner()` → créer `DELETE /api/leases/[id]/signers/[signerId]`
  - `signLease()` → utiliser `POST /api/leases/[id]/sign` (existe déjà)

- `features/billing/services/invoices.service.ts`
  - `generateMonthlyInvoice()` → créer `POST /api/invoices/generate-monthly`
  - Vérifier que toutes les méthodes utilisent les API routes

**Fichiers à créer** :
- `app/api/leases/[id]/signers/route.ts` (GET, POST)
- `app/api/leases/[id]/signers/[signerId]/route.ts` (DELETE)
- `app/api/invoices/generate-monthly/route.ts` (POST)

**Tests** :
- Vérifier que toutes les opérations passent par les API routes
- Tester les validations côté API
- Vérifier les permissions RLS

---

### **ÉTAPE 2 : Consolidation des Hooks** (Priorité IMPORTANTE)

**Objectif** : Un seul hook `useProperties` avec options pour optimistic/infinite.

**Stratégie** :
- Garder `use-properties.ts` comme hook principal (utilise API routes)
- Supprimer `use-properties-optimistic.ts` et `use-properties-infinite.ts`
- Ajouter options `optimistic` et `infinite` à `useProperties`

**Fichiers à modifier** :
- `lib/hooks/use-properties.ts` → ajouter options
- `lib/hooks/index.ts` → retirer les exports dupliqués

**Fichiers à supprimer** :
- `lib/hooks/use-properties-optimistic.ts`
- `lib/hooks/use-properties-infinite.ts`

**Migration** :
- Remplacer tous les usages de `usePropertiesOptimistic` et `usePropertiesInfinite` par `useProperties`

---

### **ÉTAPE 3 : Validations Zod Strictes** (Priorité CRITIQUE)

**Objectif** : Toutes les API routes doivent valider leurs entrées avec Zod.

**Méthode** :
1. Identifier les routes sans validation
2. Créer/améliorer les schémas Zod dans `lib/validations/`
3. Ajouter validation dans chaque route API

**Routes prioritaires** :
- `/api/properties/*` (création, mise à jour)
- `/api/leases/*` (création, mise à jour, signers)
- `/api/invoices/*` (création, génération)
- `/api/tickets/*`
- `/api/documents/*`

**Pattern à suivre** :
```typescript
import { z } from "zod";
import { NextResponse } from "next/server";

const schema = z.object({ ... });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = schema.parse(body);
    // ... traitement
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    // ... autres erreurs
  }
}
```

---

### **ÉTAPE 4 : Réduction de `any`** (Priorité IMPORTANTE)

**Objectif** : Utiliser les types générés depuis Supabase, éviter `any`.

**Méthode** :
1. Vérifier que `lib/supabase/database.types.ts` est à jour
2. Remplacer `as any` par les types appropriés
3. Créer des types intermédiaires si nécessaire

**Priorités** :
- Routes API critiques (properties, leases, invoices)
- Services
- Hooks

---

### **ÉTAPE 5 : Gestion d'Erreurs Standardisée** (Priorité CRITIQUE)

**Objectif** : Codes HTTP cohérents et messages clairs.

**Standard à suivre** :
- `200` : Succès GET/PATCH
- `201` : Succès POST (création)
- `400` : Données invalides (validation Zod)
- `401` : Non authentifié
- `403` : Accès refusé (permissions)
- `404` : Ressource introuvable
- `409` : Conflit (ex: email déjà utilisé)
- `500` : Erreur serveur (avec message générique côté client)

**Helper à créer** :
```typescript
// lib/helpers/api-error.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: error.statusCode }
    );
  }
  // ... autres cas
}
```

---

### **ÉTAPE 6 : Vérification Relations & FK** (Priorité IMPORTANTE)

**Objectif** : S'assurer que toutes les relations sont correctes.

**Vérifications** :
- `properties.owner_id` → `profiles.id`
- `leases.property_id` → `properties.id`
- `leases.unit_id` → `units.id` (nullable)
- `invoices.lease_id` → `leases.id`
- `invoices.owner_id` → `profiles.id`
- `invoices.tenant_id` → `profiles.id`
- `lease_signers.lease_id` → `leases.id`
- `lease_signers.profile_id` → `profiles.id`

**Actions** :
- Vérifier les migrations SQL
- Tester les contraintes FK
- Vérifier les suppressions en cascade

---

### **ÉTAPE 7 : Nettoyage Code Mort** (Priorité AMÉLIORATION)

**Méthode** :
1. Identifier les fichiers non importés
2. Vérifier les composants non utilisés
3. Supprimer les fichiers de documentation obsolètes

**Outils** :
- `grep -r "import.*from"` pour trouver les imports
- Vérifier les exports non utilisés

---

### **ÉTAPE 8 : Normalisation Conventions** (Priorité AMÉLIORATION)

**Objectifs** :
- Noms de fichiers : kebab-case
- Fonctions : camelCase
- Types/Interfaces : PascalCase
- Constantes : UPPER_SNAKE_CASE
- Uniformiser anglais/français (préférer anglais pour le code)

---

## 📋 Checklist de Vérification

### Avant chaque commit :
- [ ] Tests passent (`npm test`)
- [ ] Build réussit (`npm run build`)
- [ ] Lint OK (`npm run lint`)
- [ ] Type-check OK (`npm run type-check`)

### Après chaque étape :
- [ ] Vérifier que les fonctionnalités existantes fonctionnent toujours
- [ ] Tester les cas d'erreur (400, 401, 403, 404, 500)
- [ ] Vérifier les logs console pour les erreurs
- [ ] Documenter les changements

---

## 🚀 Ordre d'Exécution Recommandé

1. **ÉTAPE 1** : Migration Services → API Routes (CRITIQUE)
2. **ÉTAPE 3** : Validations Zod (CRITIQUE)
3. **ÉTAPE 5** : Gestion d'Erreurs (CRITIQUE)
4. **ÉTAPE 2** : Consolidation Hooks (IMPORTANT)
5. **ÉTAPE 4** : Réduction `any` (IMPORTANT)
6. **ÉTAPE 6** : Vérification Relations (IMPORTANT)
7. **ÉTAPE 7** : Nettoyage Code Mort (AMÉLIORATION)
8. **ÉTAPE 8** : Normalisation (AMÉLIORATION)

---

## 📝 Notes

- Chaque étape doit être testée individuellement avant de passer à la suivante
- En cas de problème, rollback immédiat et analyse
- Documenter tous les changements dans ce fichier

