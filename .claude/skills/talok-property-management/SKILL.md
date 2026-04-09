---
name: talok-property-management
description: >
  Architecture complète de la gestion des biens immobiliers Talok — wizard d'ajout,
  types de biens, constants.ts, guards.ts, conditional constants, photos, caractéristiques,
  équipements, pièces/espaces, publication, owner chain, feature gating PLAN_LIMITS.
  Utilise ce skill pour TOUTE tâche liée aux biens : ajout, modification, suppression,
  wizard, types de biens, photos, DPE, chauffage, pièces, équipements, publication,
  guards, constants, feature gates, property ownership, legal entities, draft creation.
  Déclenche dès que l'utilisateur mentionne biens, propriétés, wizard, type de bien,
  appartement, maison, studio, colocation, parking, box, immeuble, local commercial,
  bureaux, entrepôt, fonds de commerce, terrain agricole, exploitation agricole,
  saisonnier, photos, DPE, chauffage, pièces, surface, meublé, publication,
  canDeleteProperty, canCreateProperty, property_ownership, legal_entity_id,
  owner_profiles, draft, ou toute question sur l'architecture des biens.
---

# Talok — Gestion des biens immobiliers

## 1. Owner chain (schéma DB canonique)

```
profiles
  └─► owner_profiles (profile_id FK)
        └─► legal_entities (owner_profile_id FK)
              └─► property_ownership (legal_entity_id FK)

properties.owner_id → profiles.id
stripe_connect_accounts (profile_id FK) — table séparée, PAS de table property_owners
```

**Points critiques :**
- `owner_profiles` est créé au signup/onboarding owner — si absent → "Profil propriétaire requis" (403)
- Les routes API qui lisent `profiles` doivent utiliser `createServiceRoleClient()` (pas le client user-scoped) pour éviter la RLS recursion (42P17) sur les policies `profiles` qui font des JOINs complexes
- `legal_entities` = SCI, SARL, etc. Chaque entité peut posséder N biens via `property_ownership`
- `properties.owner_id` pointe vers `profiles.id` (pas owner_profiles)

## 2. Les types de biens

### Source unique : `lib/properties/constants.ts`

```typescript
// PROPERTY_TYPES array (13 types — manque saisonnier, bug connu)
export const PROPERTY_TYPES = [
  'appartement', 'maison', 'studio', 'colocation',
  'parking', 'box',
  'local_commercial', 'bureaux', 'entrepot', 'fonds_de_commerce',
  'immeuble', 'terrain_agricole', 'exploitation_agricole',
] as const;
```

**14 types canoniques** (incluant `saisonnier` présent dans PropertyTypeV3 et le z.enum API) :

```typescript
// lib/types/property-v3.ts — PropertyTypeV3
type PropertyTypeV3 =
  | 'appartement' | 'maison' | 'studio' | 'colocation' | 'saisonnier'
  | 'parking' | 'box'
  | 'local_commercial' | 'bureaux' | 'entrepot' | 'fonds_de_commerce'
  | 'terrain_agricole' | 'exploitation_agricole'
  | 'immeuble'   // ⚠️ PAS "immeuble_entier" — le label UI est "Immeuble entier" mais l'ID DB est "immeuble"
```

### Fichiers de constantes (2 fichiers, à reconcilier)

| Fichier | Contenu |
|---------|---------|
| `lib/properties/constants.ts` | PROPERTY_TYPES (13), labels, icons, catégories, FIELD_VISIBILITY matrix |
| `lib/constants/property-types.ts` | HABITATION_TYPES, PARKING_TYPES, PRO_TYPES, ALL_PROPERTY_TYPES (12), helpers |

### Catégories (`lib/properties/constants.ts`)

```typescript
PROPERTY_CATEGORIES = {
  habitation: ['appartement', 'maison', 'studio', 'saisonnier'],
  colocation: ['colocation'],
  annexe: ['parking', 'box'],
  professionnel: ['local_commercial', 'bureaux', 'entrepot', 'fonds_de_commerce'],
  foncier: ['terrain_agricole', 'exploitation_agricole'],
  ensemble: ['immeuble'],
}
```

### Champs conditionnels par catégorie (FIELD_VISIBILITY)

| Catégorie | surface | nb_pieces | DPE | chauffage | meublé | parking_type | nb_units |
|-----------|---------|-----------|-----|-----------|--------|--------------|----------|
| habitation | required | required | required | optional | required | hidden | hidden |
| colocation | required | required | required | optional | required | hidden | hidden |
| annexe | hidden | hidden | hidden | hidden | hidden | required | hidden |
| professionnel | required | optional | required | optional | hidden | hidden | hidden |
| foncier | optional | hidden | hidden | hidden | hidden | hidden | hidden |
| ensemble | required | hidden | optional | hidden | hidden | hidden | required |

### Types qui N'EXISTENT PAS dans Talok
- ~~cave~~ ~~garage~~ ~~terrain~~ (sans suffixe) ~~immeuble_entier~~ — NE PAS UTILISER

## 3. Wizard d'ajout de bien — Flow complet

### Architecture fichiers (chemins réels vérifiés)

```
app/owner/properties/new/
├── page.tsx                         # Page wrapper (server component)
├── NewPropertyClient.tsx            # Client component wrapper
└── loading.tsx                      # Loading skeleton

features/properties/
├── stores/
│   └── wizard-store.ts              # Zustand store (BUILDING_STEPS, formData, initializeDraft)
├── services/
│   ├── properties.service.ts        # API client (createDraftPropertyInit, updatePropertyGeneral)
│   └── buildings.service.ts         # API client buildings (CRUD, bulk, duplicate, stats)
└── components/v3/
    ├── property-wizard-v3.tsx       # Orchestrateur principal (steps, validation, publish)
    ├── property-type-selection.tsx   # Composant sélection type (icônes)
    └── immersive/
        ├── ImmersiveWizardLayout.tsx # Layout wrapper avec stepper
        ├── PreviewCard.tsx          # Aperçu latéral
        ├── RentEstimation.tsx       # Estimation loyer
        ├── SmartRoomSuggestions.tsx  # Suggestions pièces IA
        └── steps/
            ├── TypeStep.tsx         # Étape 1 : choix du type (featured "Immeuble entier")
            ├── AddressStep.tsx      # Étape 2 : adresse (autocomplétion)
            ├── DetailsStep.tsx      # Étape 3a : détails habitation
            ├── DetailsStepHabitation.tsx
            ├── DetailsStepParking.tsx
            ├── DetailsStepPro.tsx
            ├── BuildingConfigStep.tsx   # Étape 3b : config immeuble (lots, étages)
            ├── BuildingVisualizer.tsx   # Visualisation pseudo-3D CSS
            ├── RoomsStep.tsx        # Étape 4 : pièces (conditionnel)
            ├── PhotosStep.tsx       # Étape 5 : photos
            ├── FeaturesStep.tsx     # Étape 6 : caractéristiques/équipements
            ├── PublishStep.tsx      # Étape 7 : publication
            └── RecapStep.tsx        # Étape 8 : récapitulatif
```

### Wizard steps par type

| Étape | Individuel (full) | Individuel (fast) | Immeuble |
|-------|-------------------|-------------------|----------|
| 1 | `type_bien` | `type_bien` | `type_bien` |
| 2 | `address` | `address` | `address` |
| 3 | `details` | — | **`building_config`** |
| 4 | `rooms` | — | `photos` |
| 5 | `photos` | `photos` | `recap` |
| 6 | `features` | — | — |
| 7 | `publish` | — | — |
| 8 | `recap` | `recap` | — |

Types sans étape "rooms" : `parking`, `box`, `local_commercial`, `bureaux`, `entrepot`, `fonds_de_commerce`, `immeuble`

### Flow de création

1. **User clique un type** → `initializeDraft(type)` (wizard-store.ts, mutex via `isInitializing`)
2. **`POST /api/properties/init`** → crée un draft property en DB
   - Auth via `supabase.auth.getUser()`
   - Profil via `createServiceRoleClient()` → `profiles` (bypasse RLS)
   - Vérifie `withSubscriptionLimit(profile.id, "properties")`
   - Génère `unique_code`, déduit `usage_principal` depuis le type
   - Insert via service role client, retourne `{ propertyId, status: "draft" }`
3. **Étapes 2-7** → updates debounced (500ms) via `PATCH /api/properties/[id]`
4. **Étape publish** → pour immeuble : `POST /api/properties/{id}/building-units` puis PATCH publish

### Erreurs connues et fixes (avril 2026)

| Erreur | Cause | Fix |
|--------|-------|-----|
| "Profil propriétaire requis" (403) | Route `init` utilisait client user-scoped pour `profiles` → RLS recursion | `createServiceRoleClient()` pour la query profiles |
| 500 sur `/api/subscriptions/current` | Client user-scoped + JOIN `subscription_plans(*)` sur `subscriptions` | Toutes les queries DB en `serviceClient` |
| SubscriptionProvider cascade | 500 API → fallback `/api/subscriptions/current` échoue aussi | Migration SQL défensive `20260409120000` sur policies `subscriptions` |

## 4. Properties — Colonnes DB principales

```sql
id UUID PK, owner_id FK → profiles(id), legal_entity_id FK (nullable),
type TEXT, type_bien TEXT,   -- un des 14 types (les deux colonnes coexistent)
etat TEXT,                   -- 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived' | 'deleted'
unique_code TEXT UNIQUE,
adresse_complete TEXT, code_postal TEXT, ville TEXT, departement TEXT,
surface NUMERIC, surface_habitable_m2 NUMERIC,
nb_pieces INTEGER, nb_chambres INTEGER,
etage INTEGER, ascenseur BOOLEAN,
meuble BOOLEAN, usage_principal TEXT,
loyer_hc NUMERIC, charges_mensuelles NUMERIC,
dpe_classe_energie TEXT, dpe_classe_climat TEXT, dpe_consommation NUMERIC, dpe_emissions NUMERIC,
chauffage_type TEXT, chauffage_energie TEXT, eau_chaude_type TEXT,
description TEXT, latitude NUMERIC, longitude NUMERIC,
deleted_at TIMESTAMPTZ,
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

**⚠️ Colonne `etat`** (PAS `status`) pour l'état du bien. `statut` est sur `leases`.

## 5. Photos

- Table : `photos` avec `property_id` FK
- Storage Supabase : bucket `property-photos`
- Upload : multi-upload dans PhotosStep, import depuis URLs via `/api/properties/{id}/photos/import`
- Le wizard store gère `pendingPhotoUrls` et `importPendingPhotos()` pour l'import scraping

## 6. Guards (`lib/properties/guards.ts`)

4 guards disponibles :

```typescript
// 1. Création — vérifie limite du plan
canCreateProperty(supabase, ownerId): Promise<PropertyGuardResult>
// → { allowed, currentCount, maxAllowed, plan, message? }

// 2. Suppression — vérifie liaisons (baux actifs, documents, tickets)
canDeleteProperty(supabase, propertyId, ownerId): Promise<DeleteGuardResult>
// → { canDelete, canArchive, blockers[], warnings[], linkedData }
// Règles : bail actif → BLOQUEUR | baux terminés/docs/tickets → WARNING (archive OK)

// 3. Modification — vérifie l'état
canEditProperty(etat, isAdmin): EditGuardResult
// → { canEdit, reason? }
// Seuls 'draft' et 'rejected' sont modifiables (sauf admin)

// 4. Ownership — vérifie propriétaire ou admin
isPropertyOwnerOrAdmin(propertyOwnerId, profileId, profileRole): boolean
```

## 7. Feature gating (PLAN_LIMITS)

Source : `lib/subscriptions/plan-limits.ts`

| Plan | maxProperties | maxLeases | maxTenants | maxUsers |
|------|--------------|-----------|------------|----------|
| gratuit | 1 | 3 | 5 | 1 |
| starter | 3 | — | — | — |
| confort | 10 | — | — | — |
| pro | 50 | — | — | — |
| enterprise_s | 100 | — | — | — |
| enterprise_m | 200 | — | — | — |
| enterprise_l | 500 | — | — | — |
| enterprise_xl | -1 (∞) | -1 (∞) | -1 (∞) | -1 (∞) |
| enterprise | -1 (∞) | -1 (∞) | -1 (∞) | -1 (∞) |

Gates UI :
- `PlanGate` / `UpgradeGate` — composants React pour gater l'UI
- `usePlanAccess` — hook pour vérifier accès

Gates API :
- `withSubscriptionLimit(ownerId, "properties")` — middleware route
- `withFeatureAccess(ownerId, feature)` — middleware feature

Plans avec `extra_property_price > 0` : le backend autorise toujours la création (surcoût facturé via Stripe).

## 8. Immeuble entier (multi-lots) — Architecture complète

### 8.1 Schéma DB

```
profiles (owner_id)
  └─► buildings (owner_id FK, property_id FK optionnel)
        └─► building_units (building_id FK, current_lease_id FK)
              UNIQUE(building_id, floor, position)
```

Tables :
- **`buildings`** : `id`, `owner_id` FK, `property_id` FK (opt), `name`, `floors` (1-50), `has_ascenseur`, `has_gardien`, `has_interphone`, `has_digicode`, `has_local_velo`, `has_local_poubelles`, `has_parking_commun`, `has_jardin_commun`, `notes`
- **`building_units`** : `id`, `building_id` FK, `floor` (-5..50), `position` (A,B,C...), `type` (appartement|studio|local_commercial|parking|cave|bureau), `template` (studio|t1-t5|local|parking|cave), `surface`, `nb_pieces`, `loyer_hc`, `charges`, `depot_garantie`, `status` (vacant|occupe|travaux|reserve), `current_lease_id` FK
- **Vue SQL** : `building_stats` → `total_units`, `total_parkings`, `total_caves`, `surface_totale`, `revenus_potentiels`, `revenus_actuels`, `occupancy_rate`, `vacant_units`, `occupied_units`
- **SQL function** : `duplicate_unit_to_floors(p_unit_id UUID, p_target_floors INTEGER[])`
- **Migrations** : `20260107000000_building_support.sql` (schema), `20260318020000_buildings_rls_sota2026.sql` (RLS)
- **PAS de `parent_id` sur `properties`** — la relation passe par `buildings.property_id → properties.id`

### 8.2 Duplication des lots

**Client-side (BuildingConfigStep)** : Dialog multi-select étages cibles, auto-attribution position via `getNextPosition()`, IDs temporaires, persistence globale au publish.

**Templates rapides** : "2×T2/étage", "2×T3/étage", "4×Studio/étage", "T2+T3 mixte"

**SQL function** : `duplicate_unit_to_floors(p_unit_id, p_target_floors[])` — serveur-side

**⚠️ API endpoint `POST /api/buildings/[id]/units/[unitId]/duplicate` NON IMPLÉMENTÉ** — service method `buildingsService.duplicateUnitToFloors()` existe mais pas de route API.

### 8.3 Vue 3D → CSS pseudo-3D (PAS de vrai 3D)

- **Aucune lib 3D** — pas de three.js, babylon dans package.json
- Rendu HTML/CSS : Tailwind + Framer Motion + `skew-x-[-3deg]` sur le toit
- `BuildingVisualizer.tsx` : `flex flex-col-reverse`, cellules colorées par statut

### 8.4 Gating immeuble

**⚠️ AUCUN gating spécifique immeuble.** `maxProperties` s'applique à la property parente, pas aux lots. Les `building_units` ne sont PAS comptés dans les limites du plan.

### 8.5 Fichiers immeuble (exhaustif)

| Fichier | Rôle |
|---------|------|
| `features/properties/components/v3/immersive/steps/TypeStep.tsx` | Sélection type, "Immeuble entier" featured |
| `features/properties/components/v3/immersive/steps/BuildingConfigStep.tsx` | Config étages, lots, templates, duplication |
| `features/properties/components/v3/immersive/steps/BuildingVisualizer.tsx` | Visualisation CSS pseudo-3D |
| `features/properties/components/v3/immersive/steps/RecapStep.tsx` | Récap immeuble (stats, badges) |
| `features/properties/components/v3/property-wizard-v3.tsx` | Orchestrateur + persistence building_units |
| `features/properties/stores/wizard-store.ts` | BUILDING_STEPS, formData.building_units |
| `features/properties/services/buildings.service.ts` | Service API buildings (CRUD, bulk, duplicate, stats) |
| `lib/types/building-v3.ts` | Types TS (BuildingUnit, Building, templates, payloads) |
| `lib/types/property-v3.ts` | PropertyTypeV3 incluant `"immeuble"` |
| `app/api/buildings/route.ts` | API CRUD buildings |
| `app/api/buildings/[id]/route.ts` | API single building |
| `app/api/buildings/[id]/stats/route.ts` | API stats building |
| `app/api/buildings/[id]/units/route.ts` | API CRUD units (+bulk) |
| `app/api/buildings/[id]/units/[unitId]/route.ts` | API single unit |
| `app/api/properties/[id]/building-units/route.ts` | Bridge wizard → building+units (destructif) |
| `supabase/migrations/20260107000000_building_support.sql` | Schema + views + functions |
| `supabase/migrations/20260318020000_buildings_rls_sota2026.sql` | RLS policies |

### 8.6 Statut des features affichées dans TypeStep

| Badge | Status |
|-------|--------|
| **Multi-lots** | Implémenté (full CRUD, bulk, templates) |
| **Vue 3D** | Pseudo-3D CSS (pas de vrai 3D, pas de three.js) |
| **Duplication rapide** | Partiel (client OK, SQL OK, **API endpoint manquant**) |

## 9. Endpoints API biens

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/properties/init` | Créer un draft (wizard step 1) |
| GET | `/api/properties` | Liste des biens (filtré par owner) |
| GET | `/api/properties/[id]` | Détail d'un bien |
| PATCH | `/api/properties/[id]` | Update partiel (wizard steps 2-8) |
| PUT | `/api/properties/[id]` | Update complet |
| DELETE | `/api/properties/[id]` | Suppression (avec guards) |
| GET | `/api/properties/[id]/can-delete` | Vérification pre-suppression |
| POST | `/api/properties/[id]/building-units` | Bridge wizard → building+units (destructif) |
| GET/POST | `/api/buildings` | CRUD buildings |
| GET/PATCH/DELETE | `/api/buildings/[id]` | Single building |
| GET | `/api/buildings/[id]/stats` | Stats building (vue `building_stats`) |
| GET/POST | `/api/buildings/[id]/units` | CRUD units (+bulk create) |
| GET/PATCH/DELETE | `/api/buildings/[id]/units/[unitId]` | Single unit |

## 10. Règles Claude Code pour les biens

### NE JAMAIS
- Ajouter des types de biens sans mettre à jour `lib/properties/constants.ts` ET `lib/types/property-v3.ts`
- Utiliser `cave`, `garage`, `terrain` (sans suffixe), `immeuble_entier` comme types DB
- Requêter `profiles` ou `subscriptions` via le client user-scoped dans les routes API (RLS recursion 42P17)
- Utiliser `status` au lieu de `statut` sur les baux, ou `status` au lieu de `etat` sur properties
- Référencer une table `property_owners` (n'existe pas)
- Hardcoder des limites de plan (utiliser `PLAN_LIMITS` depuis `lib/subscriptions/plan-limits.ts`)
- Modifier `lib/subscriptions/plans.ts` directement

### TOUJOURS
- Sourcer les types depuis `lib/properties/constants.ts`
- Utiliser `createServiceRoleClient()` pour les queries `profiles` et `subscriptions` dans les API routes
- Vérifier `canDeleteProperty()` avant toute suppression de bien
- Vérifier `canCreateProperty()` ou `withSubscriptionLimit()` avant toute création
- Utiliser `legal_entity_id` (pas `entity_id`) dans les queries
- Couleur brand `#2563EB` (jamais indigo), `bg-card` (jamais `bg-white`)

## 11. Problèmes connus (avril 2026)

- `PROPERTY_TYPES` array dans `lib/properties/constants.ts` manque `saisonnier` (13 au lieu de 14)
- `ALL_PROPERTY_TYPES` dans `lib/constants/property-types.ts` manque `terrain_agricole` et `exploitation_agricole` (12 au lieu de 14)
- `building_units` non comptés dans PLAN_LIMITS — un user gratuit peut avoir ∞ lots dans 1 immeuble
- API endpoint `POST /api/buildings/[id]/units/[unitId]/duplicate` non implémenté (service method existe)
- `entities/` server actions bypass le gate API — free users peuvent créer des SCI
