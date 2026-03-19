---
name: sota-property-system
description: >-
  Comprehensive SOTA 2026 reference for the property management system.
  Use when building new features on top of properties, buildings, quotas,
  the wizard, or when needing to understand the full architecture, data model,
  validation rules, permissions, or creation flow.
---

# Property System — SOTA 2026 Architecture Guide

Complete reference for the property management system, covering all 14 property
types, the creation wizard, buildings/lots, quotas, permissions, and validation.

## 1. Property Types (14 types, 3 categories)

### Habitation
| Type | Description |
|------|-------------|
| `appartement` | Appartement classique |
| `maison` | Maison individuelle |
| `studio` | Studio/T1 |
| `colocation` | Colocation (multi-locataires) |
| `saisonnier` | Location saisonnière |

### Parking
| Type | Description |
|------|-------------|
| `parking` | Place de stationnement |
| `box` | Box fermé |

### Professionnel
| Type | Description |
|------|-------------|
| `local_commercial` | Local commercial |
| `bureaux` | Bureau professionnel |
| `entrepot` | Entrepôt logistique |
| `fonds_de_commerce` | Fonds de commerce |
| `immeuble` | Immeuble entier (multi-lots) |
| `terrain_agricole` | Terrain agricole |
| `exploitation_agricole` | Exploitation agricole |

## 2. Database Schema

### Core Tables

```
properties
├── id (UUID, PK)
├── owner_id (FK profiles)
├── type (enum of 14 types)
├── adresse_complete, code_postal, ville, departement
├── surface, nb_pieces, etage, ascenseur
├── energie, ges, dpe_*
├── loyer_hc, charges_mensuelles, depot_garantie
├── unique_code (auto-generated, never reused)
├── etat (draft | incomplete | ready_to_let | active | archived)
├── deleted_at, deleted_by (soft delete)
└── created_at, updated_at

buildings
├── id (UUID, PK)
├── owner_id (FK profiles)
├── property_id (FK properties, type=immeuble)
├── floors, construction_year, surface_totale
├── has_ascenseur, has_gardien, has_interphone, has_digicode
├── has_local_velo, has_local_poubelles, has_parking_commun
└── created_at, updated_at

building_units
├── id (UUID, PK)
├── building_id (FK buildings)
├── property_id (FK properties, nullable)
├── floor, position (UNIQUE per building)
├── type (appartement|studio|local_commercial|parking|cave|bureau)
├── template (studio|t1|t2|t3|t4|t5|local|parking|cave)
├── surface, nb_pieces
├── loyer_hc, charges, depot_garantie
├── status (vacant|occupe|travaux|reserve)
├── current_lease_id (FK leases, nullable)
└── created_at, updated_at

rooms (per property)
├── id, property_id
├── type_piece, label_affiche
├── surface_m2
├── chauffage_present, clim_presente
└── created_at, updated_at

photos (per property)
├── id, property_id, room_id (nullable)
├── url, storage_path (bucket: property-photos)
├── tag (vue_generale|exterieur|interieur|detail|...)
├── ordre, is_main
└── created_at, updated_at
```

### TypeScript Types

Primary types in `lib/supabase/database.types.ts`:
- `PropertyRow` — all property columns
- `BuildingRow` — building metadata
- `BuildingUnitRow` — individual lot in a building
- `PhotoRow` — property photo
- `ProfileRow` — user profile

Building-specific types in `lib/types/building-v3.ts`:
- `Building`, `BuildingUnit`, `BuildingStats`
- `CreateBuildingPayload`, `CreateBuildingUnitPayload`, `BulkCreateUnitsPayload`

## 3. Creation Flow (Wizard V3)

### Steps

1. **type_bien** — Property type selection (14 types)
2. **address** — Address with autocomplete + coordinates
3. **details** — Type-specific details (surface, DPE, chauffage, etc.)
4. **rooms** — Rooms configuration (habitation only)
5. **photos** — Photo upload with tags and ordering
6. **features** — Equipment and amenities
7. **publish** — Visibility and listing options
8. **recap** — Final review and submission

For `immeuble` type, step 3 includes `BuildingConfigStep` for lot management.

### API Calls During Wizard

1. `POST /api/properties/init` — Create draft with type (returns `propertyId`)
2. `PATCH /api/properties/[id]` — Debounced updates as user fills fields
3. `POST /api/properties/[id]/rooms` — Add rooms
4. `POST /api/properties/[id]/photos/upload-url` — Get signed URL for photo
5. `POST /api/properties/[id]/building-units` — Save building lots (immeuble)
6. `POST /api/properties/[id]/submit` — Submit for review

### Wizard Store (Zustand)

File: `features/properties/stores/wizard-store.ts`

Key features:
- Persistent state via `zustand/middleware/persist`
- Debounced API sync (1000ms)
- Undo/redo history
- Optimistic UI updates
- Auto-calculation of `nb_pieces` / `nb_chambres` from rooms

## 4. Validation (Zod Schemas)

### V3 Discriminated Union

File: `lib/validations/property-v3.ts`

The main schema uses Zod's discriminated union on `type_bien`:

```typescript
propertySchemaV3 = z.discriminatedUnion("type_bien", [
  habitationSchemaV3,   // appartement, maison, studio, colocation
  parkingSchemaV3,      // parking, box
  localProSchemaV3,     // local_commercial, bureaux, entrepot, fonds_de_commerce
  immeubleSchemaV3Base, // immeuble
]);
```

### Business Rules Enforced

- **DPE G interdit** : Properties with `dpe_classe_energie = "G"` require
  justification (energy renovation plan) since 2025
- **Surface Carrez** : Required for apartments in copropriété
- **Encadrement des loyers** : `zone_encadrement` flag + `loyer_reference` validation
- **Immeuble lots** : Min 1 lot, floor values must be < `building_floors`

### Legacy Validation

File: `lib/validations/property-validation.ts`

Provides `validateProperty(property, rooms, photos)` for runtime validation
with field-level error reporting. Supports all 14 types including `saisonnier`
and `immeuble`.

## 5. Quotas & Billing

### Plans

File: `lib/subscriptions/plans.ts` — 8 plans from Gratuit to Enterprise XL

| Plan | Max Properties | Included | Extra Price |
|------|---------------|----------|-------------|
| Gratuit | 1 | 1 | — |
| Starter | 5 | 3 | 4.90€/mois |
| Confort | 15 | 10 | 3.90€/mois |
| Pro | 50 | 30 | 2.90€/mois |
| Enterprise S | 100 | 100 | — |
| Enterprise M | 250 | 250 | — |
| Enterprise L | 500 | 500 | — |
| Enterprise XL | 1000 | 1000 | — |

### Quota Check Flow

1. `withSubscriptionLimit("properties")` — API middleware (blocks if over limit)
2. `resolvePropertyCreationGate()` — UI gate (hides/shows "Add" button)
3. `buildPropertyQuotaSummary()` — UI display (progress bar, usage info)
4. `syncPropertyBillingToStripe()` — Stripe metered billing for extras

### Error Handling

`QuotaExceededError` returns:
```json
{
  "error": "Limite de 5 biens atteinte...",
  "details": {
    "code": "QUOTA_EXCEEDED",
    "resource_type": "properties",
    "current": 5,
    "max": 5,
    "upgrade_url": "/settings/billing"
  }
}
```

## 6. Permissions (RLS + API)

### RLS Policies

All property-related tables use `public.user_profile_id()` and `public.user_role()`.

| Table | Owner | Admin | Tenant |
|-------|-------|-------|--------|
| properties | CRUD via `owner_id` | ALL | SELECT via active lease |
| buildings | CRUD via `owner_id` | ALL | SELECT via active lease on unit |
| building_units | CRUD via building owner | ALL | SELECT via `current_lease_id` |
| rooms | CRUD via property owner | ALL | — |
| photos | CRUD via property owner | ALL | — |

### API-Level Checks

Every API route verifies:
1. Authentication (`getAuthenticatedUser`)
2. Profile existence and role
3. Ownership (`owner_id === profile.id`)
4. Rate limiting (`applyRateLimit`)
5. Subscription limits (`withSubscriptionLimit`)

## 7. Building System (Immeuble)

### Creation Flow

1. Wizard creates property with `type = "immeuble"`
2. `BuildingConfigStep` configures floors, communal features, and lots
3. `POST /api/properties/[id]/building-units` creates/replaces all units

### URL Pattern

`/owner/buildings/[id]` where `id` = **property_id** (not `building_id`).

Server components resolve the actual `building_id` from the `buildings` table.

### Templates

Building units support templates for quick creation:
`studio`, `t1`, `t2`, `t3`, `t4`, `t5`, `local`, `parking`, `cave`

### Duplication

SQL function `duplicate_unit_to_floors(unit_id, target_floors[])` copies a lot
to multiple floors with auto-generated positions.

## 8. Photo Upload

### Flow

1. Client calls `POST /api/properties/[id]/photos/upload-url` with `{ mime_type, tag?, room_id? }`
2. Server generates signed upload URL + inserts photo record
3. Client uploads directly to Supabase Storage using signed URL
4. Photo is available at public URL

### Constraints

- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Tags vary by property type (habitation needs room association for most)
- First photo auto-set as `is_main = true`
- Rate limited: 10 uploads/minute

## 9. Key Files Reference

| Domain | Files |
|--------|-------|
| Database types | `lib/supabase/database.types.ts` |
| Property types V3 | `lib/types/property-v3.ts` |
| Building types | `lib/types/building-v3.ts` |
| Zod validation V3 | `lib/validations/property-v3.ts` |
| Legacy validation | `lib/validations/property-validation.ts` |
| Wizard store | `features/properties/stores/wizard-store.ts` |
| Wizard component | `features/properties/components/v3/property-wizard-v3.tsx` |
| New property page | `app/owner/properties/new/NewPropertyClient.tsx` |
| Properties API | `app/api/properties/route.ts` |
| Property CRUD API | `app/api/properties/[id]/route.ts` |
| Property init API | `app/api/properties/init/route.ts` |
| Photo upload API | `app/api/properties/[id]/photos/upload-url/route.ts` |
| Building-units API | `app/api/properties/[id]/building-units/route.ts` |
| Buildings API | `app/api/buildings/route.ts` |
| Building units API | `app/api/buildings/[id]/units/route.ts` |
| Building service | `features/properties/services/buildings.service.ts` |
| Building detail page | `app/owner/buildings/[id]/BuildingDetailClient.tsx` |
| Units management | `app/owner/buildings/[id]/units/UnitsManagementClient.tsx` |
| Quota plans | `lib/subscriptions/plans.ts` |
| Quota gate | `lib/subscriptions/property-creation-gate.ts` |
| Subscription check | `lib/middleware/subscription-check.ts` |
| Rate limiting | `lib/middleware/rate-limit.ts` |
| Structured logger | `lib/logging/structured-logger.ts` |
| Error handling | `lib/helpers/api-error.ts` |
| RLS migration | `supabase/migrations/20260318020000_buildings_rls_sota2026.sql` |
| Building migration | `supabase/migrations/20260107000000_building_support.sql` |
| Guard skill | `.cursor/skills/property-building-guard/SKILL.md` |
