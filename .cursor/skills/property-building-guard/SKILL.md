---
name: property-building-guard
description: >-
  Enforces SOTA 2026 rules for property and building code to prevent regressions.
  Use when creating, modifying, or reviewing any code that touches properties,
  buildings, building_units, property API routes, wizard store, RLS policies,
  or database types related to properties/buildings.
---

# Property & Building Guard — SOTA 2026

This skill enforces architectural rules and patterns for the property/building
system. It prevents regressions identified during the SOTA 2026 stabilization
sprint.

## When to Activate

Activate this skill when ANY of the following are true:

- Creating or modifying files in `app/api/properties/`, `app/api/buildings/`
- Editing `features/properties/` (stores, services, components)
- Modifying `lib/validations/property-v3.ts` or `lib/validations/property-validation.ts`
- Adding or changing RLS policies on `buildings`, `building_units`, or `properties`
- Modifying `lib/supabase/database.types.ts` (PropertyRow, BuildingRow, BuildingUnitRow)
- Creating new Supabase migrations for property/building tables

## Mandatory Rules

### 1. RLS Policies — Always use `user_profile_id()`

**NEVER** use `auth.uid()` or `(SELECT id FROM profiles WHERE user_id = auth.uid())`
in RLS policies. Always use the helper function:

```sql
-- CORRECT
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (owner_id = public.user_profile_id());

-- WRONG — will cause recursion or inconsistency
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT USING (
    owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
```

For admin access, use `public.user_role() = 'admin'`.
For tenant access, join through `lease_signers` + `leases` with `statut = 'active'`.

### 2. Rate Limiting — All mutation routes

Every `POST`, `PATCH`, `PUT`, `DELETE` handler in property/building routes MUST
start with:

```typescript
const rateLimitResponse = applyRateLimit(request, "property");
if (rateLimitResponse) return rateLimitResponse;
```

Import: `import { applyRateLimit } from "@/lib/middleware/rate-limit";`

Use preset `"upload"` for photo upload routes instead of `"property"`.

### 3. Type Safety — Zero `any`

- **NEVER** use `any` or `as any` in property/building files.
- Use `PropertyRow`, `BuildingUnitRow`, `BuildingRow` from `database.types.ts`.
- Use `SupabaseClient` from `@supabase/supabase-js` for typed Supabase params.
- Use `Partial<WizardFormData>` instead of `as any` for store updates.
- Use `Partial<RoomPayload>` for room updates.
- API error details: `details?: unknown` (not `any`).
- Auth user: `user: { id: string } | null | undefined` (not `any`).

### 4. Zod Validation — Strict enums

Property type fields MUST use a Zod enum, never `z.string().min(1)`:

```typescript
const propertyTypeEnum = z.enum([
  "appartement", "maison", "studio", "colocation", "saisonnier",
  "parking", "box",
  "local_commercial", "bureaux", "entrepot", "fonds_de_commerce",
  "immeuble", "terrain_agricole", "exploitation_agricole",
]);
```

Building unit types: `z.enum(["appartement", "studio", "local_commercial", "parking", "cave", "bureau"])`

### 5. Building Routes — Resolve IDs correctly

The URL pattern `/owner/buildings/[id]` uses `id` = **property_id** (not building_id).

In server components:
1. Query `properties` table with `.eq("id", id).eq("type", "immeuble")`
2. Query `buildings` table with `.eq("property_id", id)` to get the real `building_id`
3. Pass **both** `propertyId` and `buildingId` to client components

Client components that call building-specific APIs (like `/api/buildings/[id]/units`)
must use the real `buildingId` from the `buildings` table.

### 6. Wizard Stability

- `PropertyWizardV3` MUST be wrapped in `<ErrorBoundary>`.
- `buildingUnitSchema` fields `id`, `building_id`, `created_at`, `updated_at`
  MUST be `.optional()` (server-generated).
- `nextStep()` in wizard store MUST guard against missing required data
  before advancing.

### 7. Structured Logging — No raw console.*

Use the structured logger in all API routes:

```typescript
import { createLogger } from "@/lib/logging/structured-logger";

const log = createLogger("POST /api/properties");
log.info("Draft created", { id: property.id });
log.error("Insert failed", { error: insertError });
```

Never use `console.log`, `console.error`, or `console.warn` directly in API routes.

### 8. Building Units — Correct API endpoints

| Operation | Endpoint | Method |
|-----------|----------|--------|
| List units for a building | `/api/buildings/[buildingId]/units` | GET |
| Create single/bulk units | `/api/buildings/[buildingId]/units` | POST |
| Replace all units for property | `/api/properties/[propertyId]/building-units` | POST |

**NEVER** use `PUT` on `/api/buildings/[id]/units` — it does not exist.
**NEVER** call `/api/buildings/[id]/units/bulk` — it does not exist.

## Key Files Reference

| Domain | File |
|--------|------|
| Types | `lib/supabase/database.types.ts` |
| Validation V3 | `lib/validations/property-v3.ts` |
| Validation legacy | `lib/validations/property-validation.ts` |
| Wizard store | `features/properties/stores/wizard-store.ts` |
| Wizard UI | `features/properties/components/v3/property-wizard-v3.tsx` |
| Properties API | `app/api/properties/route.ts`, `app/api/properties/[id]/route.ts` |
| Buildings API | `app/api/buildings/route.ts`, `app/api/buildings/[id]/units/route.ts` |
| Building-units API | `app/api/properties/[id]/building-units/route.ts` |
| Rate limiting | `lib/middleware/rate-limit.ts` |
| Structured logger | `lib/logging/structured-logger.ts` |
| Error handling | `lib/helpers/api-error.ts` |
| RLS migration | `supabase/migrations/20260318020000_buildings_rls_sota2026.sql` |
