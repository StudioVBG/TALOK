-- ============================================
-- Migration : RLS SOTA 2026 pour buildings & building_units
-- Remplace auth.uid() par user_profile_id() / user_role()
-- Ajoute policies admin et tenant
-- ============================================

-- 1. DROP anciennes policies buildings
-- ============================================
DROP POLICY IF EXISTS "Owners can view their buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can create buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can update their buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can delete their buildings" ON buildings;

-- 2. DROP anciennes policies building_units
-- ============================================
DROP POLICY IF EXISTS "Owners can view their building units" ON building_units;
DROP POLICY IF EXISTS "Owners can create building units" ON building_units;
DROP POLICY IF EXISTS "Owners can update their building units" ON building_units;
DROP POLICY IF EXISTS "Owners can delete their building units" ON building_units;

-- 3. Nouvelles policies buildings (owner)
-- ============================================
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (owner_id = public.user_profile_id());

CREATE POLICY "buildings_owner_insert" ON buildings
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.user_profile_id());

CREATE POLICY "buildings_owner_update" ON buildings
  FOR UPDATE TO authenticated
  USING (owner_id = public.user_profile_id());

CREATE POLICY "buildings_owner_delete" ON buildings
  FOR DELETE TO authenticated
  USING (owner_id = public.user_profile_id());

-- 4. Policies buildings (admin)
-- ============================================
CREATE POLICY "buildings_admin_all" ON buildings
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');

-- 5. Policies buildings (tenant via bail actif)
-- ============================================
CREATE POLICY "buildings_tenant_select" ON buildings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM building_units bu
      JOIN leases l ON l.id = bu.current_lease_id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE bu.building_id = buildings.id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut = 'active'
    )
  );

-- 6. Nouvelles policies building_units (owner)
-- ============================================
CREATE POLICY "building_units_owner_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

CREATE POLICY "building_units_owner_insert" ON building_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

CREATE POLICY "building_units_owner_update" ON building_units
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

CREATE POLICY "building_units_owner_delete" ON building_units
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

-- 7. Policies building_units (admin)
-- ============================================
CREATE POLICY "building_units_admin_all" ON building_units
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');

-- 8. Policies building_units (tenant via bail actif)
-- ============================================
CREATE POLICY "building_units_tenant_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.id = building_units.current_lease_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut = 'active'
    )
  );

-- 9. Ajout property_id sur building_units si manquant
-- ============================================
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_building_units_property ON building_units(property_id);
