-- ============================================================================
-- Migration : Buildings SOTA Fix — Vague 1 (Sécurité & intégrité)
--
-- Consolide les items P0 de l'audit building-module :
--   #22 — DROP policies "Service role full access" (dangereuses)
--   #7  — ADD COLUMN ownership_type + total_lots_in_building
--   #9  — ADD COLUMN deleted_at (buildings + building_units)
--   #11 — Étendre le trigger sync lease → building_unit.status à INSERT
--         + backfill des building_units déjà liés à des baux actifs
--   #21 — UNIQUE INDEX partiel sur building_units.property_id
--   #8  — Helper SQL `building_has_active_leases(building_id)` réutilisé
--         par la RPC transactionnelle de la Phase 2
--
-- La vue `building_stats` est aussi étendue pour exposer ownership_type /
-- total_lots_in_building et filtrer les soft-deleted.
-- ============================================================================

-- ============================================================================
-- 1. [#22] Supprimer les policies "Service role full access" sur buildings
--    et building_units (court-circuit RLS dangereux en production).
--    Les API routes utilisent déjà createServiceRoleClient() qui bypass RLS
--    nativement via le service_role JWT — aucune policy n'est nécessaire.
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access buildings" ON buildings;
DROP POLICY IF EXISTS "Service role full access building_units" ON building_units;

-- ============================================================================
-- 2. [#7] ownership_type + total_lots_in_building sur buildings
--    full    = le propriétaire possède tous les lots physiques
--    partial = copropriété (quelques lots dans un immeuble plus grand)
--    total_lots_in_building n'a de sens que si ownership_type = 'partial'
-- ============================================================================
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'full'
    CHECK (ownership_type IN ('full', 'partial'));

ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS total_lots_in_building INTEGER
    CHECK (total_lots_in_building IS NULL OR total_lots_in_building > 0);

-- Cohérence : si full → total_lots_in_building doit être NULL
-- (un immeuble "full" ne dépend pas d'un nombre de lots extérieurs).
-- On ne pose pas de contrainte stricte NULL=full pour ne pas bloquer les
-- backfills futurs — les API/UI doivent enforce. Un commentaire documente.
COMMENT ON COLUMN buildings.ownership_type IS
  'full = immeuble entier possédé, partial = quelques lots dans une copropriété';
COMMENT ON COLUMN buildings.total_lots_in_building IS
  'Nombre total de lots dans l''immeuble physique (renseigné uniquement si ownership_type = partial)';

-- ============================================================================
-- 3. [#9] Soft-delete sur buildings ET building_units
--    La route DELETE /api/buildings/[id] tentait déjà `SET deleted_at = NOW()`
--    mais la colonne n'existait pas → fallback hard-delete silencieux.
-- ============================================================================
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE building_units
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index partiels : la majorité des records ont deleted_at = NULL.
-- Un index partiel est bien plus efficace qu'un index plein.
CREATE INDEX IF NOT EXISTS idx_buildings_active
  ON buildings (id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_building_units_active
  ON building_units (building_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN buildings.deleted_at IS
  'Soft-delete timestamp. Les records non-null sont filtrés des queries applicatives et RLS.';
COMMENT ON COLUMN building_units.deleted_at IS
  'Soft-delete timestamp. Cascade depuis buildings.deleted_at.';

-- ============================================================================
-- 4. [#21] Index UNIQUE partiel sur building_units.property_id
--    Empêche qu'un même lot-property soit lié à plusieurs building_units.
--    L'index est partiel (WHERE property_id IS NOT NULL) car les parkings /
--    caves / lots pas encore individualisés peuvent ne pas avoir de property.
--
--    Détection préalable des doublons (fail loud si incohérence existante).
-- ============================================================================
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT property_id
    FROM building_units
    WHERE property_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY property_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add UNIQUE index : % property_id(s) are linked to multiple building_units. Resolve manually before rerunning.',
      dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_building_units_property_id
  ON building_units (property_id)
  WHERE property_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- 5. [#8] Helper SQL réutilisable : compter / lister les lots d'un immeuble
--    qui ont un bail actif. Utilisé par la RPC transactionnelle de Phase 2
--    (upsert_building_with_units) et par l'API route DELETE.
--
--    Statuts considérés comme "actifs" (doivent bloquer DELETE/REPLACE) :
--      active, pending_signature, fully_signed, notice_given
--    Statuts NON bloquants : draft, cancelled, terminated, archived
-- ============================================================================
CREATE OR REPLACE FUNCTION public.building_active_lease_units(p_building_id UUID)
RETURNS TABLE (
  unit_id UUID,
  floor INTEGER,
  "position" TEXT,
  lease_id UUID,
  lease_statut TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bu.id AS unit_id,
    bu.floor,
    bu.position,
    l.id AS lease_id,
    l.statut::TEXT AS lease_statut
  FROM building_units bu
  LEFT JOIN leases l
    ON l.building_unit_id = bu.id
   AND l.statut IN ('active', 'pending_signature', 'fully_signed', 'notice_given')
  WHERE bu.building_id = p_building_id
    AND bu.deleted_at IS NULL
    AND (
      bu.current_lease_id IS NOT NULL
      OR l.id IS NOT NULL
    )
$$;

COMMENT ON FUNCTION public.building_active_lease_units(UUID) IS
  'Retourne les building_units d''un immeuble qui ont un bail bloquant (active / pending_signature / fully_signed / notice_given). Utilisé pour garder DELETE/REPLACE.';

-- ============================================================================
-- 6. [#11] Étendre le trigger sync_building_unit_status_from_lease à INSERT
--    + backfill des building_units dont le bail actif n'était pas synchronisé.
--
--    Comportement :
--      INSERT lease (statut='active', building_unit_id != NULL)
--         → UPDATE building_units.status='occupe', current_lease_id=lease.id
--      UPDATE lease.statut : draft/... → active
--         → UPDATE building_units.status='occupe', current_lease_id=lease.id
--      UPDATE lease.statut : active → terminated/archived/cancelled
--         → UPDATE building_units.status='vacant', current_lease_id=NULL
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_building_unit_status_from_lease()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT : un bail est créé directement actif avec un lot associé
  IF TG_OP = 'INSERT' THEN
    IF NEW.building_unit_id IS NOT NULL AND NEW.statut = 'active' THEN
      UPDATE building_units
         SET status = 'occupe',
             current_lease_id = NEW.id
       WHERE id = NEW.building_unit_id
         AND deleted_at IS NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE : traiter les transitions de statut
  IF TG_OP = 'UPDATE' THEN
    -- Transition vers 'active'
    IF NEW.statut = 'active'
       AND (OLD.statut IS DISTINCT FROM NEW.statut)
       AND NEW.building_unit_id IS NOT NULL THEN
      UPDATE building_units
         SET status = 'occupe',
             current_lease_id = NEW.id
       WHERE id = NEW.building_unit_id
         AND deleted_at IS NULL;
    END IF;

    -- Transition sortant de 'active' vers terminaison
    IF OLD.statut = 'active'
       AND NEW.statut IN ('terminated', 'archived', 'cancelled')
       AND NEW.building_unit_id IS NOT NULL THEN
      UPDATE building_units
         SET status = 'vacant',
             current_lease_id = NULL
       WHERE id = NEW.building_unit_id
         AND current_lease_id = NEW.id
         AND deleted_at IS NULL;
    END IF;

    -- Réassignation : le bail change de building_unit_id
    IF OLD.building_unit_id IS DISTINCT FROM NEW.building_unit_id THEN
      -- Ancien lot : libérer si c'était ce bail qui l'occupait
      IF OLD.building_unit_id IS NOT NULL THEN
        UPDATE building_units
           SET status = 'vacant',
               current_lease_id = NULL
         WHERE id = OLD.building_unit_id
           AND current_lease_id = NEW.id
           AND deleted_at IS NULL;
      END IF;
      -- Nouveau lot : occuper si bail actif
      IF NEW.building_unit_id IS NOT NULL AND NEW.statut = 'active' THEN
        UPDATE building_units
           SET status = 'occupe',
               current_lease_id = NEW.id
         WHERE id = NEW.building_unit_id
           AND deleted_at IS NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recréer le trigger pour couvrir INSERT + UPDATE
DROP TRIGGER IF EXISTS trigger_sync_unit_status_on_lease ON leases;
CREATE TRIGGER trigger_sync_unit_status_on_lease
  AFTER INSERT OR UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_building_unit_status_from_lease();

-- Backfill : synchroniser les building_units dont un bail actif existe déjà
-- mais dont le status / current_lease_id n'a pas été mis à jour.
UPDATE building_units bu
   SET status = 'occupe',
       current_lease_id = l.id
  FROM leases l
 WHERE l.building_unit_id = bu.id
   AND l.statut = 'active'
   AND bu.deleted_at IS NULL
   AND (bu.status IS DISTINCT FROM 'occupe' OR bu.current_lease_id IS DISTINCT FROM l.id);

-- Backfill inverse : libérer les building_units dont le bail n'est plus actif
UPDATE building_units bu
   SET status = 'vacant',
       current_lease_id = NULL
  FROM leases l
 WHERE bu.current_lease_id = l.id
   AND l.statut IN ('terminated', 'archived', 'cancelled')
   AND bu.deleted_at IS NULL;

-- ============================================================================
-- 7. Étendre les RLS policies pour filtrer les soft-deleted
--    Les policies owner_* existantes (migration 20260318020000) sont
--    reconstruites pour inclure `AND deleted_at IS NULL`.
--    Les admin_all et tenant_select laissent voir le soft-deleted (audit).
-- ============================================================================

-- buildings : recréer les policies owner avec filtre deleted_at
DROP POLICY IF EXISTS "buildings_owner_select" ON buildings;
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (
    owner_id = public.user_profile_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "buildings_owner_update" ON buildings;
CREATE POLICY "buildings_owner_update" ON buildings
  FOR UPDATE TO authenticated
  USING (
    owner_id = public.user_profile_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "buildings_owner_delete" ON buildings;
CREATE POLICY "buildings_owner_delete" ON buildings
  FOR DELETE TO authenticated
  USING (
    owner_id = public.user_profile_id()
    AND deleted_at IS NULL
  );
-- INSERT policy inchangée (un nouveau record a forcément deleted_at = NULL).

-- building_units : filtrer via le building parent non-soft-deleted
DROP POLICY IF EXISTS "building_units_owner_select" ON building_units;
CREATE POLICY "building_units_owner_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "building_units_owner_update" ON building_units;
CREATE POLICY "building_units_owner_update" ON building_units
  FOR UPDATE TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "building_units_owner_delete" ON building_units;
CREATE POLICY "building_units_owner_delete" ON building_units
  FOR DELETE TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

-- INSERT policy : idem, filtrer via building non-soft-deleted
DROP POLICY IF EXISTS "building_units_owner_insert" ON building_units;
CREATE POLICY "building_units_owner_insert" ON building_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

-- ============================================================================
-- 8. Mettre à jour la vue building_stats pour exposer ownership_type
--    et filtrer les soft-deleted.
-- ============================================================================
CREATE OR REPLACE VIEW building_stats AS
SELECT
  b.id,
  b.name,
  b.owner_id,
  b.adresse_complete,
  b.ville,
  b.floors,
  b.ownership_type,
  b.total_lots_in_building,

  -- Comptages par type (uniquement lots actifs)
  COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave') AND bu.deleted_at IS NULL) AS total_units,
  COUNT(bu.id) FILTER (WHERE bu.type = 'parking' AND bu.deleted_at IS NULL) AS total_parkings,
  COUNT(bu.id) FILTER (WHERE bu.type = 'cave' AND bu.deleted_at IS NULL) AS total_caves,

  -- Surface
  COALESCE(SUM(bu.surface) FILTER (WHERE bu.deleted_at IS NULL), 0) AS surface_totale,

  -- Revenus
  COALESCE(SUM(bu.loyer_hc + bu.charges) FILTER (WHERE bu.deleted_at IS NULL), 0) AS revenus_potentiels,
  COALESCE(
    SUM(bu.loyer_hc + bu.charges) FILTER (WHERE bu.status = 'occupe' AND bu.deleted_at IS NULL),
    0
  ) AS revenus_actuels,

  -- Taux d'occupation (uniquement logements habitables, hors parking/cave)
  ROUND(
    COUNT(bu.id) FILTER (
      WHERE bu.status = 'occupe'
        AND bu.type NOT IN ('parking', 'cave')
        AND bu.deleted_at IS NULL
    )::DECIMAL /
    NULLIF(
      COUNT(bu.id) FILTER (
        WHERE bu.type NOT IN ('parking', 'cave')
          AND bu.deleted_at IS NULL
      ),
      0
    ) * 100,
    1
  ) AS occupancy_rate,

  COUNT(bu.id) FILTER (
    WHERE bu.status = 'vacant'
      AND bu.type NOT IN ('parking', 'cave')
      AND bu.deleted_at IS NULL
  ) AS vacant_units,
  COUNT(bu.id) FILTER (
    WHERE bu.status = 'occupe'
      AND bu.type NOT IN ('parking', 'cave')
      AND bu.deleted_at IS NULL
  ) AS occupied_units,
  COUNT(bu.id) FILTER (WHERE bu.status = 'travaux' AND bu.deleted_at IS NULL) AS units_en_travaux

FROM buildings b
LEFT JOIN building_units bu ON bu.building_id = b.id
WHERE b.deleted_at IS NULL
GROUP BY b.id;

COMMENT ON VIEW building_stats IS
  'Vue agrégée des stats par immeuble. Expose ownership_type et total_lots_in_building. Exclut les soft-deleted.';

-- ============================================================================
-- 9. Ajuster get_building_stats() pour filtrer les soft-deleted
-- ============================================================================
CREATE OR REPLACE FUNCTION get_building_stats(p_building_id UUID)
RETURNS TABLE (
  total_units INTEGER,
  total_parkings INTEGER,
  total_caves INTEGER,
  surface_totale DECIMAL,
  revenus_potentiels DECIMAL,
  revenus_actuels DECIMAL,
  occupancy_rate DECIMAL,
  vacant_units INTEGER,
  occupied_units INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave'))::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.type = 'parking')::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.type = 'cave')::INTEGER,
    COALESCE(SUM(bu.surface), 0)::DECIMAL,
    COALESCE(SUM(bu.loyer_hc + bu.charges), 0)::DECIMAL,
    COALESCE(SUM(bu.loyer_hc + bu.charges) FILTER (WHERE bu.status = 'occupe'), 0)::DECIMAL,
    ROUND(
      COUNT(bu.id) FILTER (WHERE bu.status = 'occupe' AND bu.type NOT IN ('parking', 'cave'))::DECIMAL /
      NULLIF(COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave')), 0) * 100,
      1
    )::DECIMAL,
    COUNT(bu.id) FILTER (WHERE bu.status = 'vacant' AND bu.type NOT IN ('parking', 'cave'))::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.status = 'occupe' AND bu.type NOT IN ('parking', 'cave'))::INTEGER
  FROM building_units bu
  WHERE bu.building_id = p_building_id
    AND bu.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_building_stats IS
  'Stats détaillées d''un immeuble — exclut les lots soft-deleted (deleted_at IS NULL).';
