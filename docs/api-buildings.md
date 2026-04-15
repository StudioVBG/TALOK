# API Buildings — Référence

> Module immeubles et lots. Mise à jour Phase 5 audit building-module (2026-04).

## Endpoint canonique (wizard + hub)

### `POST /api/properties/[id]/building-units`

**Statut** : actif — source de vérité du module immeuble côté client.

Upsert atomique (via RPC `upsert_building_with_units`) de l'immeuble + lots
d'un `property.type='immeuble'`. Utilisé par :

- `property-wizard-v3.tsx` (création initiale)
- `UnitsManagementClient.tsx` (édition groupée)

**Body** (Zod) :

```ts
{
  name?: string;
  building_floors?: number;
  construction_year?: number;
  surface_totale?: number;
  notes?: string;
  ownership_type?: 'full' | 'partial';
  total_lots_in_building?: number; // obligatoire si ownership_type='partial'
  has_ascenseur?: boolean;
  has_gardien?: boolean;
  has_interphone?: boolean;
  has_digicode?: boolean;
  has_local_velo?: boolean;
  has_local_poubelles?: boolean;
  has_parking_commun?: boolean;
  has_jardin_commun?: boolean;
  units: Array<{
    floor: number;      // -5..50
    position: string;   // "A", "B", ...
    type: 'appartement'|'studio'|'local_commercial'|'parking'|'cave'|'bureau';
    surface: number;
    nb_pieces: number;
    template?: string | null;
    loyer_hc: number;
    charges: number;
    depot_garantie: number;
    status?: 'vacant'|'occupe'|'travaux'|'reserve';
    meuble?: boolean;
  }>;
}
```

**Garde** : refuse (409) si au moins un lot a un bail bloquant (statut
`active`, `pending_signature`, `fully_signed`, `notice_given`).

---

## Endpoints actifs sur le hub

| Endpoint | Méthodes | Consommé par |
|---|---|---|
| `/api/buildings/[id]` | `PATCH`, `DELETE` | `BuildingDetailClient.tsx` |
| `/api/buildings/[id]/units/[unitId]` | `PATCH`, `DELETE` | `BuildingDetailClient.tsx` (status + delete) |
| `/api/buildings/[id]/units/[unitId]/duplicate` | `POST` | `BuildingDetailClient.tsx` (dialog Phase 4) |
| `/api/buildings/[id]/stats` | `GET` | `BuildingDetailClient.tsx` (Phase 4) |
| `/api/properties/[id]/building-unit` | `GET` | `LeaseWizard.tsx` (priorité loyer lot, Phase 5) |
| `/api/properties/[id]/building` | `GET` | `buildings.service.ts` (loadProperty wizard) |
| `/api/properties/[id]/building-units` | `POST` | wizard + UnitsManagement |

---

## Endpoints conservés mais non consommés par le frontend

Ces endpoints sont fonctionnels et restent disponibles pour :
- usage programmatique externe (scripts, intégrations futures)
- tests E2E
- évolution vers une API publique

Ils sont marqués par un commentaire en tête `// NOT CONSUMED BY FRONTEND —
kept for API programmatic use`.

| Endpoint | Méthodes | Pourquoi non consommé ? |
|---|---|---|
| `/api/buildings` | `GET` | Remplacé par query directe côté SSR via `/api/buildings/[id]/stats` et page SSR |
| `/api/buildings` | `POST` | Remplacé par `POST /api/properties/[id]/building-units` (wizard) |
| `/api/buildings/[id]` | `GET` | Remplacé par fetch SSR dans `app/owner/buildings/[id]/page.tsx` |
| `/api/buildings/[id]/units` | `GET` | Remplacé par fetch SSR |
| `/api/buildings/[id]/units` | `POST` (single + bulk) | Remplacé par `POST /api/properties/[id]/building-units` |
| `/api/buildings/[id]/units/[unitId]` | `GET` | Remplacé par fetch SSR |

---

## Règles de développement

1. **Toute mutation building/units passe par la RPC transactionnelle** (via
   `POST /api/properties/[id]/building-units`). Ne PAS appeler
   `POST /api/buildings` ou `POST /api/buildings/[id]/units` depuis le wizard.

2. **Garde baux actifs** : toute route qui remplace ou supprime des `building_units`
   doit appeler `public.building_active_lease_units(buildingId)` avant. La RPC
   et `DELETE /api/buildings/[id]` le font déjà.

3. **Service client** : toutes les lectures/écritures côté API utilisent
   `getServiceClient()` (bypass RLS). Pas de `createClient()` user-scoped
   dans les routes building.

4. **RLS** : les policies `buildings_owner_*` et `building_units_owner_*`
   incluent maintenant le support `entity_members` (Phase 5). Un membre SCI
   a accès aux immeubles de son entité via
   `public.user_in_entity_of_property(property_id)`.

5. **URL `/owner/buildings/[id]`** : utilise `property_id` du wrapper (pas
   `building_id`). Le server component résout `building_id` via
   `buildings.property_id`.
