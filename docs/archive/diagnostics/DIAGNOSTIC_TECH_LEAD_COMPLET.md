# 🔍 DIAGNOSTIC TECH LEAD COMPLET - Talok SaaS

**Date:** $(date)  
**Tech Lead:** Analyse complète du codebase  
**Objectif:** Fiabilisation et nettoyage du projet

---

## 📋 1. ANALYSE DE LA STACK

### Stack Technique Identifié

**Frontend:**
- Framework: Next.js 14.0.4 (App Router)
- UI: React 18.2.0, Tailwind CSS, shadcn/ui (Radix UI)
- State Management: TanStack Query (React Query)
- Validation: Zod 3.22.4
- Types: TypeScript 5.3.3 (strict mode activé)

**Backend:**
- API Routes: Next.js API Routes (app/api)
- Base de données: Supabase (PostgreSQL)
- Auth: Supabase Auth (@supabase/ssr, @supabase/supabase-js)
- ORM: Supabase Client (pas d'ORM traditionnel)

**Infrastructure:**
- Déploiement: Vercel
- Tests: Vitest (unit), Playwright (e2e)
- Linting: ESLint (Next.js config)

---

## 📁 2. STRUCTURE DU PROJET

### Dossiers Clés

```
/app                    # Pages Next.js (App Router)
  /api                  # Routes API (146 fichiers)
  /admin                # Pages admin
  /owner            # Pages propriétaire
  /auth                 # Pages authentification
  /properties           # Pages logements
  /leases               # Pages baux
  /tickets              # Pages tickets
  /invoices             # Pages factures

/components            # Composants UI réutilisables
  /ui                  # Composants shadcn/ui
  /owner                # Composants spécifiques propriétaire
  /layout               # Layouts (navbar, sidebar)

/lib                   # Code partagé
  /helpers             # Helpers utilitaires (9 fichiers)
  /hooks               # Hooks React (13 hooks)
  /validations         # Schémas Zod (6 fichiers)
  /types               # Types TypeScript (2 fichiers)
  /supabase            # Clients Supabase
  /services            # Services métier

/features              # Features organisées par domaine
  /properties          # Feature logements
  /leases              # Feature baux
  /billing             # Feature facturation
  /tickets             # Feature tickets
  /auth                # Feature authentification
  /admin               # Feature admin

/supabase              # Migrations et config Supabase
/tests                 # Tests unitaires et e2e
/scripts               # Scripts utilitaires
```

---

## 🔴 3. PROBLÈMES CRITIQUES IDENTIFIÉS

### 3.1 DOUBLONS MAJEURS (Priorité: 🔴 CRITIQUE)

#### A. Types Property Dupliqués
**Impact:** Confusion, bugs potentiels, maintenance difficile

**Problèmes:**
1. `PropertyType` défini dans 3 endroits différents:
   - `lib/types/index.ts` (legacy, manque `studio`, `box`)
   - `lib/types/property-v3.ts` (complet)
   - `lib/config/property-wizard-loader.ts` (dupliqué)

2. `Property` vs `PropertyV3` interfaces:
   - `lib/types/index.ts`: `Property` (legacy, ~50 champs)
   - `lib/types/property-v3.ts`: `PropertyV3` (nouveau, ~80 champs)
   - Migration incomplète, casts `as PropertyV3` partout

3. `RoomType` vs `RoomTypeV3`:
   - Legacy: 11 valeurs
   - V3: 14 valeurs (ajoute `jardin`, `bureau`, `dressing`)

4. `PhotoTag` vs `PhotoTagV3`:
   - Legacy: 4 valeurs
   - V3: 9 valeurs (plus complet)

**Action requise:**
- ✅ Unifier vers V3 comme source unique
- ✅ Créer fonctions de compatibilité
- ✅ Marquer legacy comme `@deprecated`

---

#### B. Schémas de Validation Dupliqués
**Impact:** Validation incohérente, bugs silencieux

**Problèmes:**
1. `propertySchema` (legacy) vs `propertySchemaV3`:
   - `lib/validations/index.ts`: `propertySchema` (marqué deprecated)
   - `lib/validations/property-v3.ts`: `propertySchemaV3` (discriminated union)
   - `lib/validations/onboarding.ts`: `firstPropertySchema` (partiel)

2. Validation custom vs Zod:
   - `lib/validations/property-validation.ts`: Validation custom pour UI
   - `lib/validations/property-validator.ts`: Bridge legacy/V3
   - Logique de validation dupliquée

**Action requise:**
- ✅ Unifier vers `propertySchemaV3`
- ✅ Créer schémas partiels avec `.pick()` pour onboarding
- ✅ Centraliser messages d'erreur

---

#### C. Composants Wizard Dupliqués
**Impact:** Maintenance x4, UX incohérente

**Problèmes:**
1. Wizards multiples:
   - `property-wizard.tsx` (legacy, supprimé ✅)
   - `property-wizard-v3.tsx` (actif)
   - `parking-wizard.tsx` (spécialisé)
   - `app/owner/onboarding/property/page.tsx` (logique inline)

2. Configurations dupliquées:
   - `config/propertyWizard.ts` (legacy)
   - `config/propertyWizardV3.ts` (partiellement utilisé)
   - `config/property-wizard-config.json` (source de vérité)

**Action requise:**
- ✅ Unifier vers `PropertyWizardV3`
- ✅ Utiliser uniquement JSON config
- ✅ Supprimer configurations TS dupliquées

---

### 3.2 CODE MORT / NON UTILISÉ (Priorité: 🟡 IMPORTANT)

#### A. Fichiers Markdown Obsolètes
**Impact:** Pollution du repo, confusion

**Problème:**
- **123 fichiers markdown** dans le projet
- Beaucoup sont des rapports temporaires:
  - `RAPPORT_*.md` (20+ fichiers)
  - `RESUME_*.md` (10+ fichiers)
  - `DEPLOYMENT_*.md` (15+ fichiers)
  - `STATUS_*.md` (8+ fichiers)
  - `IMPLEMENTATION_*.md` (12+ fichiers)

**Action requise:**
- ✅ Archiver dans `/docs/archive/`
- ✅ Garder uniquement documentation essentielle
- ✅ Créer `/docs/guides/` pour guides permanents

---

#### B. Pages Vendor Non Complètes
**Impact:** Code mort, confusion

**Problème:**
- `app/vendor/invoices/page.tsx` - Pas de route API associée
- `app/vendor/jobs/page.tsx` - Fonctionnalité incomplète
- `app/vendor/dashboard/page.tsx` - Non utilisé dans navigation

**Action requise:**
- ✅ Vérifier si fonctionnalité prévue
- ✅ Compléter ou supprimer

---

#### C. Routes API Mockées
**Impact:** Fonctionnalités non opérationnelles

**Problème:**
- `app/api/emails/send/route.ts` - Mock (TODO: Resend/SendGrid)
- `app/api/payments/create-intent/route.ts` - Mock (TODO: Stripe)
- `app/api/meters/[id]/photo-ocr/route.ts` - Mock (TODO: Edge Function)

**Action requise:**
- ✅ Documenter comme "en développement"
- ✅ Améliorer gestion d'erreurs
- ✅ Ajouter tests de non-régression

---

### 3.3 SÉCURITÉ & VALIDATION (Priorité: 🔴 CRITIQUE)

#### A. Utilisation Excessive de `any`
**Impact:** Perte de sécurité de type, bugs potentiels

**Problème:**
- **1386 occurrences** de `any`/`unknown`/`as any` dans `/app/api`
- Exemples critiques:
  - `app/api/properties/route.ts`: 43 occurrences
  - `app/api/admin/stats/route.ts`: 40 occurrences
  - `app/api/leases/[id]/route.ts`: 27 occurrences

**Action requise:**
- ✅ Typage strict de tous les endpoints
- ✅ Utiliser types Supabase générés
- ✅ Éliminer `as any` progressivement

---

#### B. Gestion d'Erreurs Incomplète
**Impact:** Erreurs 500 non gérées, UX dégradée

**Problème:**
- Certains endpoints n'ont pas de `try/catch`
- Messages d'erreur génériques ("Erreur serveur")
- Pas de validation systématique des paramètres

**Exemples:**
```typescript
// ❌ MAUVAIS: Pas de validation
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { data } = await supabase.from("properties").select("*").eq("id", params.id);
  return NextResponse.json({ data });
}

// ✅ BON: Validation + gestion erreurs
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const uuidSchema = z.string().uuid();
    const { id } = uuidSchema.parse(params.id);
    
    const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
    }
    
    return NextResponse.json({ property: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "ID invalide", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
```

**Action requise:**
- ✅ Ajouter validation Zod sur tous les paramètres
- ✅ Gestion d'erreurs uniforme avec `handleApiError`
- ✅ Messages d'erreur clairs et contextuels

---

#### C. Vérification des Permissions Incomplète
**Impact:** Risques de sécurité, accès non autorisé

**Problème:**
- Certaines routes API ne vérifient pas les permissions RLS
- Utilisation inconsistante de `requireAdmin` vs `getAuthenticatedUser`
- Pas de vérification systématique `owner_id` pour les propriétés

**Action requise:**
- ✅ Vérifier permissions sur toutes les routes critiques
- ✅ Utiliser service role uniquement quand nécessaire
- ✅ Ajouter tests de sécurité

---

### 3.4 RELATIONS & INTÉGRITÉ DES DONNÉES (Priorité: 🟡 IMPORTANT)

#### A. Types Incohérents entre Code et Base
**Impact:** Erreurs runtime, perte de données

**Problème:**
- `PropertyStatus` a des valeurs dupliquées (fr/en):
  - `"brouillon"` vs `"draft"`
  - `"publie"` vs `"published"`
  - `"rejete"` vs `"rejected"`
- `PropertyType` legacy manque `studio` et `box`
- Casts `as any` masquent les incohérences

**Action requise:**
- ✅ Unifier vers valeurs anglaises (V3)
- ✅ Créer fonctions de migration
- ✅ Vérifier contraintes base de données

---

#### B. Clés Étrangères Non Vérifiées
**Impact:** Données orphelines, intégrité compromise

**Problème:**
- Création de `lease` sans vérifier `property_id` existe
- Création de `invoice` sans vérifier `lease_id` existe
- Pas de vérification systématique des FK avant insertion

**Action requise:**
- ✅ Ajouter vérifications FK avant insertions
- ✅ Utiliser transactions Supabase pour intégrité
- ✅ Ajouter contraintes FK en base si manquantes

---

### 3.5 CONVENTIONS & NORMALISATION (Priorité: 🟡 IMPORTANT)

#### A. Mélange Français/Anglais
**Impact:** Confusion, maintenance difficile

**Problème:**
- Types: `PropertyType` (anglais) mais valeurs en français
- Variables: `adresse_complete` (français) vs `created_at` (anglais)
- Fonctions: `getAuthenticatedUser` (anglais) vs `creerPropriete` (français)

**Action requise:**
- ✅ Standardiser: Types/Variables en anglais, Labels UI en français
- ✅ Créer guide de conventions
- ✅ Migration progressive

---

#### B. Noms de Fichiers Incohérents
**Impact:** Difficulté à trouver le code

**Problème:**
- `property-wizard-v3.tsx` vs `PropertyWizardV3.tsx`
- `use-properties.ts` vs `useProperties.ts`
- Mélange kebab-case et PascalCase

**Action requise:**
- ✅ Standardiser: kebab-case pour fichiers, PascalCase pour composants
- ✅ Renommer fichiers progressivement

---

## 📊 4. STATISTIQUES & MÉTRIQUES

### Codebase
- **Routes API:** 146 fichiers
- **Composants:** ~50+ composants
- **Hooks:** 13 hooks
- **Types:** 2 fichiers principaux (+ doublons)
- **Validations:** 6 fichiers Zod
- **Helpers:** 9 fichiers

### Problèmes Quantifiés
- **Doublons critiques:** 28 occurrences
- **Code mort:** 123 fichiers markdown + 3 pages vendor
- **Utilisation `any`:** 1386 occurrences dans `/app/api`
- **Routes API sans validation:** ~30% estimé
- **Routes API sans gestion erreurs:** ~20% estimé

---

## 🎯 5. PLAN D'ACTION PAR PRIORITÉ

### PHASE 1: CRITIQUE - Sécurité & Types (Semaine 1-2)

#### Étape 1.1: Unification Types Property
**Durée:** 2 jours

**Actions:**
1. Créer alias `PropertyType = PropertyTypeV3` dans `lib/types/index.ts`
2. Marquer `PropertyType` legacy comme `@deprecated`
3. Créer fonctions de compatibilité:
   ```typescript
   export function toPropertyTypeV3(oldType: PropertyType): PropertyTypeV3
   export function toPropertyV3(property: Property): PropertyV3
   ```
4. Migrer imports progressivement
5. Supprimer définitions legacy

**Fichiers à modifier:**
- `lib/types/index.ts`
- `lib/types/property-v3.ts`
- `lib/config/property-wizard-loader.ts`
- Tous les fichiers utilisant `PropertyType`

**Tests:**
```bash
npm run type-check
npm run test
```

---

#### Étape 1.2: Sécurisation Routes API Critiques
**Durée:** 3 jours

**Actions:**
1. Ajouter validation Zod sur tous les paramètres
2. Ajouter gestion d'erreurs uniforme
3. Vérifier permissions sur routes critiques
4. Éliminer `as any` progressivement

**Routes prioritaires:**
- `app/api/properties/route.ts` (GET, POST)
- `app/api/properties/[id]/route.ts` (GET, PATCH, DELETE)
- `app/api/leases/route.ts` (GET, POST)
- `app/api/invoices/route.ts` (GET, POST)
- `app/api/tickets/route.ts` (GET, POST)

**Fichiers à créer:**
- `lib/validations/params.ts` - Schémas pour paramètres API
- `lib/helpers/api-validation.ts` - Helpers validation API

**Tests:**
```bash
npm run test
npm run test:e2e
```

---

#### Étape 1.3: Unification Schémas Validation
**Durée:** 2 jours

**Actions:**
1. Migrer vers `propertySchemaV3` comme source unique
2. Créer schémas partiels avec `.pick()` pour onboarding
3. Centraliser messages d'erreur dans `lib/validations/messages.ts`
4. Supprimer `propertySchema` legacy

**Fichiers à modifier:**
- `lib/validations/index.ts`
- `lib/validations/property-v3.ts`
- `lib/validations/onboarding.ts`
- Tous les fichiers utilisant `propertySchema`

**Tests:**
```bash
npm run test
npm run type-check
```

---

### PHASE 2: IMPORTANT - Nettoyage & Code Mort (Semaine 3)

#### Étape 2.1: Nettoyage Documentation
**Durée:** 1 jour

**Actions:**
1. Créer `/docs/archive/`
2. Déplacer rapports temporaires dans archive
3. Créer `/docs/guides/` pour guides permanents
4. Garder uniquement:
   - `README.md`
   - `docs/architecture-fonctionnelle.md`
   - `docs/guides/*.md`

**Fichiers à archiver:**
- `RAPPORT_*.md` (20+ fichiers)
- `RESUME_*.md` (10+ fichiers)
- `DEPLOYMENT_*.md` (sauf le plus récent)
- `STATUS_*.md`
- `IMPLEMENTATION_*.md` (sauf guides essentiels)

---

#### Étape 2.2: Suppression Code Mort
**Durée:** 2 jours

**Actions:**
1. Vérifier utilisation pages vendor
2. Compléter ou supprimer routes API mockées
3. Supprimer composants debug non utilisés
4. Vérifier imports non utilisés

**Fichiers à vérifier:**
- `app/vendor/*/page.tsx`
- `components/debug/properties-debug.tsx`
- `app/api/properties/test/route.ts`

**Outils:**
```bash
npm run lint
npx ts-prune  # Détecter exports non utilisés
```

---

#### Étape 2.3: Unification Wizards
**Durée:** 2 jours

**Actions:**
1. Unifier vers `PropertyWizardV3` uniquement
2. Supprimer `parking-wizard.tsx`
3. Utiliser `PropertyWizardV3` dans onboarding
4. Utiliser uniquement JSON config

**Fichiers à modifier:**
- `features/properties/components/v3/property-wizard-v3.tsx`
- `app/owner/onboarding/property/page.tsx`
- Supprimer: `features/properties/components/parking-wizard.tsx`
- Supprimer: `config/propertyWizardV3.ts` (garder JSON uniquement)

---

### PHASE 3: AMÉLIORATION - Qualité & Consistance (Semaine 4)

#### Étape 3.1: Normalisation Conventions
**Durée:** 2 jours

**Actions:**
1. Créer guide de conventions (`docs/CONVENTIONS.md`)
2. Standardiser noms de fichiers (kebab-case)
3. Standardiser types/variables (anglais)
4. Migration progressive

**Fichiers à créer:**
- `docs/CONVENTIONS.md`

---

#### Étape 3.2: Amélioration Types TypeScript
**Durée:** 3 jours

**Actions:**
1. Éliminer `any` progressivement
2. Utiliser types Supabase générés
3. Créer types stricts pour API
4. Ajouter JSDoc sur fonctions publiques

**Outils:**
```bash
npm run type-check
npx eslint --rule '@typescript-eslint/no-explicit-any: error'
```

---

#### Étape 3.3: Vérification Relations & Intégrité
**Durée:** 2 jours

**Actions:**
1. Vérifier toutes les FK avant insertions
2. Ajouter transactions pour opérations critiques
3. Vérifier contraintes en base de données
4. Ajouter tests d'intégrité

---

## ✅ 6. CHECKLIST DE VÉRIFICATION

### Avant chaque modification
- [ ] Tests passent: `npm run test`
- [ ] Type-check passe: `npm run type-check`
- [ ] Lint passe: `npm run lint`
- [ ] Build passe: `npm run build`

### Après chaque phase
- [ ] Tests e2e passent: `npm run test:e2e`
- [ ] Aucune régression fonctionnelle
- [ ] Documentation mise à jour
- [ ] Code review effectué

---

## 📝 7. COMMANDES UTILES

### Vérification
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Tests unitaires
npm run test

# Tests e2e
npm run test:e2e

# Build
npm run build

# Détecter exports non utilisés
npx ts-prune

# Analyser taille bundle
npm run build -- --analyze
```

### Nettoyage
```bash
# Nettoyer cache Next.js
rm -rf .next

# Nettoyer node_modules
rm -rf node_modules package-lock.json && npm install
```

---

## 🎯 MÉTRIQUES DE SUCCÈS

### Objectifs Phase 1 (Critique)
- [ ] 0 doublon critique de types
- [ ] 100% routes API critiques avec validation
- [ ] 100% routes API critiques avec gestion erreurs
- [ ] Réduction `any` de 50% dans `/app/api`

### Objectifs Phase 2 (Important)
- [ ] 0 fichier markdown temporaire à la racine
- [ ] 0 code mort identifié
- [ ] 1 seul wizard Property (V3)

### Objectifs Phase 3 (Amélioration)
- [ ] Guide de conventions créé
- [ ] Réduction `any` de 80% dans `/app/api`
- [ ] 100% relations FK vérifiées

---

## 📚 RESSOURCES & RÉFÉRENCES

### Documentation Existante
- `INVENTAIRE_DOUBLONS.md` - Inventaire complet des doublons
- `RAPPORT_DOUBLONS.md` - Rapport détaillé des doublons
- `DEAD_CODE_ANALYSIS.md` - Analyse du code mort
- `FK_RELATIONS_ANALYSIS.md` - Analyse des relations FK

### Standards à Suivre
- Next.js App Router: https://nextjs.org/docs/app
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Zod Validation: https://zod.dev
- TypeScript Best Practices: https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html

---

**Prochaine étape:** Commencer Phase 1, Étape 1.1 - Unification Types Property

