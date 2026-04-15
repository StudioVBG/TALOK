-- ============================================================================
-- Migration : RLS Support entity_members pour buildings et building_units
--
-- Item #18 de l'audit building-module : actuellement les policies owner_* sur
-- buildings et building_units ne vérifient que `owner_id = user_profile_id()`.
-- Les membres d'une SCI (via entity_members) n'ont pas accès aux immeubles
-- de leur entité, alors que la page /owner/buildings/[id] les autorise déjà
-- au niveau SSR.
--
-- Cette migration étend les policies pour inclure ce cas :
--   Un user est autorisé sur un building si :
--     (a) il est l'owner direct (pattern existant)
--     (b) OU il est membre de l'entité légale associée à la property parent
--         (via entity_members.user_id = auth.uid())
--
-- Les policies tenant/admin ne sont pas touchées.
-- ============================================================================

-- ============================================================================
-- 1. Fonction helper : user_in_entity_of_property(property_id)
--    Retourne true si l'utilisateur courant est membre de l'entité légale
--    rattachée à la property. Encapsule le pattern pour éviter les sous-
--    requêtes répétées dans chaque policy.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_in_entity_of_property(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM properties p
    JOIN entity_members em ON em.entity_id = p.legal_entity_id
    WHERE p.id = p_property_id
      AND p.legal_entity_id IS NOT NULL
      AND em.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.user_in_entity_of_property(UUID) IS
  'Retourne true si auth.uid() est membre (entity_members) de l''entité légale de la property. Utilisé par les RLS policies buildings/building_units pour le cas SCI.';

-- ============================================================================
-- 2. Recréer les policies owner sur buildings pour inclure entity_members
-- ============================================================================
DROP POLICY IF EXISTS "buildings_owner_select" ON buildings;
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (
    buildings.deleted_at IS NULL
    AND (
      owner_id = public.user_profile_id()
      OR (
        property_id IS NOT NULL
        AND public.user_in_entity_of_property(property_id)
      )
    )
  );

DROP POLICY IF EXISTS "buildings_owner_update" ON buildings;
CREATE POLICY "buildings_owner_update" ON buildings
  FOR UPDATE TO authenticated
  USING (
    buildings.deleted_at IS NULL
    AND (
      owner_id = public.user_profile_id()
      OR (
        property_id IS NOT NULL
        AND public.user_in_entity_of_property(property_id)
      )
    )
  );

DROP POLICY IF EXISTS "buildings_owner_delete" ON buildings;
CREATE POLICY "buildings_owner_delete" ON buildings
  FOR DELETE TO authenticated
  USING (
    buildings.deleted_at IS NULL
    AND (
      owner_id = public.user_profile_id()
      OR (
        property_id IS NOT NULL
        AND public.user_in_entity_of_property(property_id)
      )
    )
  );

-- INSERT : seul le propriétaire direct peut créer un building. Un membre SCI
-- ne doit pas pouvoir créer un building hors du flux wizard. On garde la
-- contrainte restrictive sur INSERT (owner_id = user_profile_id()).

-- ============================================================================
-- 3. Recréer les policies owner sur building_units pour inclure entity_members
--    via buildings.property_id → properties.legal_entity_id
-- ============================================================================
DROP POLICY IF EXISTS "building_units_owner_select" ON building_units;
CREATE POLICY "building_units_owner_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
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
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
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
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
    )
  );

DROP POLICY IF EXISTS "building_units_owner_insert" ON building_units;
CREATE POLICY "building_units_owner_insert" ON building_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
    )
  );
