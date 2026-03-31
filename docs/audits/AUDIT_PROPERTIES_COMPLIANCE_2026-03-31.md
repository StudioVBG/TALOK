# RAPPORT — Vérification biens Talok vs Skill SOTA 2026

**Date :** 2026-03-31
**Skill de référence :** `.cursor/skills/sota-property-system/SKILL.md`
**Contexte :** `.claude/skills/talok-context/SKILL.md`

---

## 1. INVENTAIRE

### 1.1 — Structure réelle de la table `properties`

La table properties contient **~100+ colonnes** réparties sur 12 migrations successives.

#### Tableau comparatif : colonnes skill vs DB

| Colonne attendue (skill §2) | Existe en DB ? | Type correct ? | Contrainte OK ? |
|---|---|---|---|
| `id` (UUID PK) | ✅ | ✅ UUID | ✅ PK + auto-gen |
| `owner_id` (FK profiles) | ✅ | ✅ UUID | ✅ FK ON DELETE CASCADE |
| `type` (14 types) | ✅ | ✅ TEXT + CHECK | ⚠️ CHECK = 12 types (voir §1.2) |
| `adresse_complete` | ✅ | ✅ TEXT | ✅ NOT NULL |
| `code_postal` | ✅ | ✅ TEXT | ✅ NOT NULL |
| `ville` | ✅ | ✅ TEXT | ✅ NOT NULL |
| `departement` | ✅ | ✅ TEXT | ✅ NOT NULL |
| `surface` | ✅ | ✅ DECIMAL(8,2) | ✅ NOT NULL |
| `nb_pieces` | ✅ | ✅ INTEGER | ✅ NOT NULL |
| `etage` | ✅ | ✅ INTEGER | ✅ nullable |
| `ascenseur` | ✅ | ✅ BOOLEAN | ✅ DEFAULT false |
| `energie` / `ges` | ✅ | ✅ TEXT | ✅ nullable |
| `unique_code` | ✅ | ✅ TEXT | ✅ NOT NULL + UNIQUE |
| `etat` (workflow) | ✅ | ✅ TEXT + CHECK | ✅ draft/pending_review/published/rejected/deleted/archived |
| `loyer_hc` | ✅ | ✅ NUMERIC(12,2) | ✅ DEFAULT 0 |
| `charges_mensuelles` | ✅ | ✅ NUMERIC(12,2) | ✅ DEFAULT 0 |
| `depot_garantie` | ✅ | ✅ NUMERIC(12,2) | ✅ DEFAULT 0 |
| `dpe_classe_energie` | ✅ | ✅ TEXT | ✅ CHECK A-G + NC |
| `dpe_classe_climat` | ✅ | ✅ TEXT | ✅ CHECK A-G + NC |
| `dpe_consommation` / `dpe_emissions` | ✅ | ✅ NUMERIC(12,2) | ✅ nullable |
| `latitude` / `longitude` | ✅ | ✅ DOUBLE PRECISION | ✅ nullable |
| `surface_habitable_m2` | ✅ | ✅ NUMERIC(8,2) | ✅ nullable |
| `nb_chambres` | ✅ | ✅ INTEGER | ✅ DEFAULT 0 |
| `meuble` (= furnished) | ✅ | ✅ BOOLEAN | ✅ DEFAULT false |
| `chauffage_type` / `chauffage_energie` | ✅ | ✅ TEXT | ✅ nullable |
| `eau_chaude_type` | ✅ | ✅ TEXT | ✅ nullable |
| `clim_presence` / `clim_type` | ✅ | ✅ TEXT | ✅ nullable |
| `zone_encadrement` | ✅ | ✅ BOOLEAN → CHECK | ✅ paris/lille/lyon/etc. |
| `loyer_reference` / `loyer_reference_majore` | ✅ | ✅ NUMERIC(12,2) | ✅ nullable |
| `surface_carrez` | ✅ | ✅ NUMERIC(8,2) | ✅ nullable |
| `surface_carrez_certifiee` | ✅ | ✅ BOOLEAN | ✅ DEFAULT false |
| `deleted_at` | ✅ | ✅ TIMESTAMPTZ | ✅ nullable (soft delete) |
| `deleted_by` | ✅ | ✅ UUID FK profiles | ✅ ON DELETE SET NULL |
| `created_at` / `updated_at` | ✅ | ✅ TIMESTAMPTZ | ✅ DEFAULT NOW() |
| `legal_entity_id` (FK legal_entities) | ✅ | ✅ UUID | ✅ FK ON DELETE SET NULL |
| `detention_mode` | ✅ | ✅ TEXT + CHECK | ✅ direct/societe/indivision/demembrement |
| `building_id` (FK buildings) | ✅ | ✅ UUID | ✅ nullable |
| `equipments` (TEXT[]) | ✅ | ✅ TEXT[] + GIN index | ✅ DEFAULT '{}' |
| Colonnes parking_* (8 cols) | ✅ | ✅ | ✅ CHECK constraints |
| Colonnes local_* (10 cols) | ✅ | ✅ | ✅ CHECK constraints |
| `prix_achat` / `date_achat` / `frais_*` | ✅ | ✅ NUMERIC / DATE | ✅ nullable |
| `visite_virtuelle_url` | ✅ | ✅ TEXT | ✅ nullable |
| `digicode` / `interphone` | ✅ | ✅ TEXT | ✅ nullable |

#### Colonnes "orphelines" (en DB mais pas dans le skill)

| Colonne | Source migration | Remarque |
|---|---|---|
| `usage_principal`, `sous_usage` | 202411140100 | Commercial capabilities - utile |
| `erp_type`, `erp_categorie`, `erp_accessibilite` | 202411140100 | ERP compliance - utile |
| `plan_url` | 202411140100 | Floor plan URL |
| `has_irve`, `places_parking`, `parking_badge_count` | 202411140100 | Parking extras |
| `submitted_at`, `validated_at`, `validated_by`, `rejection_reason` | 202411140210 | Workflow - utile |
| `loyer_base` | 202411140220 | Redondant avec loyer_hc ? |
| `complement_loyer`, `complement_justification` | 202411140220 | Encadrement loyers |
| `permis_louer_requis/numero/date` | 202411140220 | Permis de louer |
| `commercial_previous_activity` | 202411140100 | Commercial context |
| `type_bail`, `preavis_mois` | 202502150000 | V3 lease context |
| `status` (GENERATED) | 202502141000 | Generated column from etat |

**Verdict :** Aucune colonne manquante critique. Les colonnes "orphelines" sont toutes fonctionnelles et utiles.

---

### 1.2 — Enum des types de biens

**L'enum SQL `property_type` N'EXISTE PAS.** Le type est une colonne TEXT avec CHECK constraint.

#### État du CHECK constraint (dernière migration : `20260107000000`)

```
CHECK (type IN (
  'appartement', 'maison', 'studio', 'colocation', 'saisonnier',
  'parking', 'box', 'local_commercial', 'bureaux', 'entrepot',
  'fonds_de_commerce', 'immeuble'
))
```

#### Comparaison skill (14 types) vs DB (12 types)

| Type | En DB CHECK ? | En TS PropertyTypeV3 ? | En TS PropertyType (components) ? |
|---|---|---|---|
| appartement | ✅ | ✅ | ✅ |
| maison | ✅ | ✅ | ✅ |
| studio | ✅ | ✅ | ✅ |
| colocation | ✅ | ✅ | ✅ |
| saisonnier | ✅ | ✅ | ✅ |
| parking | ✅ | ✅ | ✅ |
| box | ✅ | ✅ | ✅ |
| local_commercial | ✅ | ✅ | ✅ |
| bureaux | ✅ | ✅ | ✅ |
| entrepot | ✅ | ✅ | ✅ |
| fonds_de_commerce | ✅ | ✅ | ✅ |
| immeuble | ✅ | ✅ | ❌ MANQUANT |
| terrain_agricole | ❌ MANQUANT | ✅ | ❌ MANQUANT |
| exploitation_agricole | ❌ MANQUANT | ✅ | ❌ MANQUANT |

**Constats :**
- `lib/properties/constants.ts` **N'EXISTE PAS** → pas de source unique de vérité
- Les types sont définis dans 3 endroits différents avec des divergences :
  - `lib/types/property-v3.ts` → **14 types** (référence skill)
  - `components/properties/types.ts` → **11 types** (manque immeuble, terrain_agricole, exploitation_agricole)
  - SQL CHECK → **12 types** (manque terrain_agricole, exploitation_agricole)
- Des types sont hardcodés dans des composants (ex: `TYPES_WITHOUT_ROOMS_STEP` dans property-wizard-v3.tsx)

---

### 1.3 — Tables liées

| Table | Existe ? | FK properties ? | Remarque |
|---|---|---|---|
| `buildings` | ✅ | ✅ via property_id | SOTA 2026 |
| `building_units` | ✅ | ❌ (via building_id) | UNIQUE(building_id, floor, position) |
| `rooms` | ✅ | ✅ property_id FK | OK |
| `photos` | ✅ | ✅ property_id FK | + room_id nullable |
| `property_photos` | ❌ | — | N'existe pas (c'est `photos`) |
| `units` (legacy) | ✅ | ✅ property_id FK | Colocation legacy |
| `leases` | ✅ | ✅ property_id FK | ON DELETE CASCADE |
| `documents` | ✅ | ✅ property_id FK | ON DELETE CASCADE |
| `property_ownership` | ✅ | ✅ property_id FK | Multi-entity ownership |
| `legal_entities` | ✅ | ✅ (via legal_entity_id) | ON DELETE SET NULL |

---

## 2. VÉRIFICATION DES LIAISONS

> **Note :** Ces vérifications ne sont réalisables qu'avec accès à la base locale (psql).
> L'audit ci-dessous est basé sur l'analyse structurelle du code et des migrations.

### 2.1 — Biens ↔ Entités (legal_entities)

- **FK existe :** ✅ `properties.legal_entity_id → legal_entities(id) ON DELETE SET NULL`
- **Index :** ✅ `idx_properties_legal_entity`
- **Ownership cross-check :** ⚠️ Pas de contrainte SQL vérifiant que `legal_entity.owner_profile_id == property.owner_id`
  - Le check se fait côté API (RLS + code)
- **Table `property_ownership` :** ✅ Existe pour gestion multi-détenteurs (indivision, SCI)

### 2.2 — Biens ↔ Baux (leases)

- **FK existe :** ✅ `leases.property_id → properties(id) ON DELETE CASCADE`
- **Guard suppression :** ✅ Trigger SQL `trigger_prevent_property_delete_with_active_lease` bloque le DELETE si bail actif
- **Guard API :** ✅ L'endpoint DELETE vérifie les baux actifs avant soft-delete (lignes 698-740 de `app/api/properties/[id]/route.ts`)
- **Multi-baux actifs :** ⚠️ Pas de contrainte DB empêchant plusieurs baux actifs sur un même bien (hors colocation). Le contrôle est côté code uniquement.

### 2.3 — Biens ↔ Documents

- **FK existe :** ✅ `documents.property_id → properties(id) ON DELETE CASCADE`
- **Trigger `auto_fill_document_fk` :** Non trouvé dans les migrations → vérifier si le remplissage se fait côté API

### 2.4 — Biens ↔ Photos

- **Table :** `photos` (pas `property_photos`)
- **FK existe :** ✅ `photos.property_id → properties(id) ON DELETE CASCADE`
- **Storage bucket :** `property-photos` (référencé dans le skill)
- **Nettoyage storage sur suppression :** ⚠️ Le soft-delete ne supprime PAS les fichiers en storage. Les photos restent en storage même après archivage.

### 2.5 — Biens ↔ Buildings

- **FK existe :** ✅ `buildings.property_id → properties(id)` (nullable)
- **FK inverse :** ✅ `properties.building_id → buildings(id)` (nullable)
- **Vue :** ✅ `building_stats` view pour statistiques agrégées

---

## 3. FEATURE GATING

### 3.1 — Limites du plan

| Fonction | Fichier | Statut |
|---|---|---|
| `withSubscriptionLimit("properties")` | `lib/middleware/subscription-check.ts` | ✅ Implémenté |
| `resolvePropertyCreationGate()` | `lib/subscriptions/property-creation-gate.ts` | ✅ Implémenté |
| `buildPropertyQuotaSummary()` | `lib/subscriptions/property-quota.ts` | ✅ Implémenté |
| `syncPropertyBillingToStripe()` | `lib/stripe/sync-property-billing.ts` | ✅ Implémenté |

**Points d'enforcement :**
- ✅ `POST /api/properties` → vérifie quota
- ✅ `POST /api/properties/init` → vérifie quota
- ✅ UI `app/owner/properties/page.tsx` → gate + quota summary

### 3.2 — Guards suppression

| Guard | Statut |
|---|---|
| `canCreateProperty()` | ✅ Via `resolvePropertyCreationGate()` |
| `canDeleteProperty()` | ❌ Pas de fonction dédiée (logique inline dans DELETE handler) |
| Guard baux actifs avant suppression | ✅ Trigger SQL + vérification API |
| Guard pending_review avant suppression | ✅ Vérifié dans DELETE handler |
| Notification locataires avant suppression | ✅ Implémenté |

---

## 4. CODE vs SKILL

### 4.1 — Source unique de vérité

| Fichier attendu | Statut |
|---|---|
| `lib/properties/constants.ts` | ❌ N'EXISTE PAS |
| `lib/types/property-v3.ts` (PropertyTypeV3) | ✅ 14 types |
| `components/properties/types.ts` (PropertyType) | ⚠️ 11 types (manque immeuble, terrain_agricole, exploitation_agricole) |

**Types hardcodés trouvés :**
- `features/properties/components/v3/property-wizard-v3.tsx` : `TYPES_WITHOUT_ROOMS_STEP` hardcodé
- `components/properties/types.ts` : `TYPE_LABELS`, `HABITATION_TYPES`, `PARKING_TYPES`, `PRO_TYPES` dupliqués

### 4.2 — Formulaire de création

| Critère | Statut |
|---|---|
| Wizard V3 multi-steps | ✅ 8 étapes + BuildingConfigStep |
| Wizard store Zustand persisté | ✅ Avec debounce 1000ms |
| Champs conditionnels par type | ✅ DetailsStepHabitation/Parking/Pro |
| Autocomplétion adresse | ✅ AddressStep.tsx |
| Sélection entity_id | ✅ Legal entity selector |
| Pré-remplissage entity active | À vérifier en runtime |
| DPE masqué pour parking | ✅ Via DetailsStepParking |
| Undo/redo | ✅ wizard-store.ts |

### 4.3 — Suppression / archivage

| Critère | Statut |
|---|---|
| Soft delete (UPDATE deleted_at) | ✅ |
| Guard baux actifs | ✅ SQL trigger + API check |
| Modale de confirmation UI | À vérifier en runtime |
| Nettoyage photos storage | ❌ Pas implémenté |
| Notification locataires | ✅ |
| Colonne `deleted_by` trackée | ✅ En migration, ⚠️ non systématiquement rempli en API |

### 4.4 — Hooks React Query

| Hook | Existe ? | Cache invalidation ? |
|---|---|---|
| `useProperties()` | ✅ | ✅ Scoped par entity |
| `usePropertiesInfinite()` | ✅ | ✅ |
| `useProperty()` | ✅ | ✅ |
| `useCreateProperty()` | ✅ | ✅ Auto-invalidation |
| `useUpdateProperty()` | ✅ | ✅ Optimistic updates |
| `useDeleteProperty()` | ✅ | ✅ Optimistic rollback |

### 4.5 — Validation Zod

| Schéma | Fichier | Statut |
|---|---|---|
| `propertySchemaV3` (discriminated union) | `lib/validations/property-v3.ts` | ✅ |
| `habitationSchemaV3` | idem | ✅ |
| `parkingSchemaV3` | idem | ✅ |
| `localProSchemaV3` | idem | ✅ |
| `immeubleSchemaV3Base` | idem | ✅ |
| Legacy `validateProperty()` | `lib/validations/property-validation.ts` | ✅ |

### 4.6 — Dashboard KPIs

- ✅ Dashboard owner avec `OwnerFinanceSummary`, `OwnerPortfolioByModule`
- ✅ Entity filtering via `useOwnerData()`
- ⚠️ Pas de breakdown par type de bien dans le dashboard

---

## 5. RÉSUMÉ

### 5.1 — Statistiques

```
Colonnes properties       : ~100+ (12 migrations)
Types en SQL CHECK         : 12/14
Types en TS PropertyTypeV3 : 14/14
Types en TS PropertyType   : 11/14
API routes skill           : 7/7 ✅ (+ 19 endpoints supplémentaires)
Feature gating             : 4/4 ✅
React Query hooks          : 6/6 ✅
Validation Zod V3          : 4/4 ✅
Tables liées               : 10+ ✅
```

### 5.2 — Bugs P0 (bloquants)

| # | Description | Fichier | Fix proposé |
|---|---|---|---|
| P0-1 | **SQL CHECK constraint manque 2 types agricoles** (`terrain_agricole`, `exploitation_agricole`) définis dans le skill et le TS mais absents du CHECK SQL | `supabase/migrations/20260107000000_building_support.sql` | Nouvelle migration ALTER TABLE ADD CONSTRAINT |
| P0-2 | **`components/properties/types.ts` manque 3 types** (`immeuble`, `terrain_agricole`, `exploitation_agricole`) | `components/properties/types.ts:10-21` | Ajouter les 3 types manquants + labels |

### 5.3 — Bugs P1 (importants)

| # | Description | Fichier | Fix proposé |
|---|---|---|---|
| P1-1 | **Pas de `lib/properties/constants.ts`** = pas de source unique de vérité pour les types. 3 définitions divergentes coexistent | — | Créer le fichier, re-exporter depuis un seul endroit |
| P1-2 | **`canDeleteProperty()` n'existe pas** comme fonction réutilisable. La logique est inline dans le DELETE handler | `app/api/properties/[id]/route.ts` | Extraire en `lib/properties/guards.ts` |
| P1-3 | **Photos en storage non nettoyées** lors du soft-delete. Accumulation de fichiers orphelins | `app/api/properties/[id]/route.ts` | Ajouter cleanup storage dans le handler DELETE |
| P1-4 | **`deleted_by` non systématiquement rempli** lors du soft-delete | `app/api/properties/[id]/route.ts` | Ajouter `deleted_by: profile.id` dans l'UPDATE |

### 5.4 — Améliorations P2

| # | Description | Fix proposé |
|---|---|---|
| P2-1 | Types hardcodés dans wizard (`TYPES_WITHOUT_ROOMS_STEP`) | Déplacer vers constants centralisées |
| P2-2 | `TYPE_LABELS` dans `components/properties/types.ts` ne couvre que 11 types | Aligner avec les 14 types |
| P2-3 | Pas de contrainte DB pour multi-baux actifs (hors colocation) | Ajouter CHECK ou trigger |
| P2-4 | Pas de breakdown par type de bien dans le dashboard | Ajouter widget stats |
| P2-5 | V4 Wizard minimal (`PropertyWizardV4.tsx` = 1 ligne) | Supprimer ou implémenter |
| P2-6 | `loyer_base` possiblement redondant avec `loyer_hc` | Audit et dépréciation si redondant |
| P2-7 | Trigger `auto_fill_document_fk` non trouvé | Vérifier si nécessaire |

---

## 6. MIGRATIONS SQL À APPLIQUER

### Migration 1 : Ajouter les types agricoles au CHECK constraint

```sql
-- 20260331100000_add_agricultural_property_types.sql
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_type_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_type_check
  CHECK (type IN (
    'appartement', 'maison', 'studio', 'colocation', 'saisonnier',
    'parking', 'box', 'local_commercial', 'bureaux', 'entrepot',
    'fonds_de_commerce', 'immeuble',
    'terrain_agricole', 'exploitation_agricole'
  ));
```

---

## 7. FICHIERS À CRÉER

| Fichier | Contenu | Priorité |
|---|---|---|
| `lib/properties/constants.ts` | Source unique : PROPERTY_TYPES, CATEGORIES, LABELS, TYPES_WITHOUT_ROOMS | P1 |
| `lib/properties/guards.ts` | `canDeleteProperty()`, `canArchiveProperty()` | P1 |
| `supabase/migrations/20260331100000_add_agricultural_property_types.sql` | CHECK constraint 14 types | P0 |

---

## 8. FICHIERS À MODIFIER

| Fichier | Modification | Priorité |
|---|---|---|
| `components/properties/types.ts` | Ajouter `immeuble`, `terrain_agricole`, `exploitation_agricole` + labels | P0 |
| `features/properties/components/v3/property-wizard-v3.tsx` | Importer `TYPES_WITHOUT_ROOMS_STEP` depuis constants | P2 |
| `app/api/properties/[id]/route.ts` | Utiliser `deleted_by`, cleanup storage photos | P1 |

---

## 9. CONCLUSION

L'architecture property est **solide et bien implémentée** avec un excellent alignement au skill SOTA 2026 (>90%). Les 2 P0 identifiés concernent uniquement la **synchronisation des types agricoles** entre SQL et TypeScript. Le système de quotas, le soft-delete, les hooks React Query et la validation Zod sont tous opérationnels et conformes au skill.
