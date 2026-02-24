-- ============================================================================
-- P0-4: Correction RLS vétusté et mobilier
-- properties.owner_id et lease_signers.profile_id sont des profiles.id,
-- alors que auth.uid() renvoie auth.users.id. Il faut joindre profiles
-- et comparer pr.user_id = auth.uid().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. furniture_inventories
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS furniture_inventories_owner_policy ON furniture_inventories;
CREATE POLICY furniture_inventories_owner_policy ON furniture_inventories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = furniture_inventories.lease_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS furniture_inventories_tenant_policy ON furniture_inventories;
CREATE POLICY furniture_inventories_tenant_policy ON furniture_inventories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE l.id = furniture_inventories.lease_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 2. furniture_items
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS furniture_items_owner_policy ON furniture_items;
CREATE POLICY furniture_items_owner_policy ON furniture_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE fi.id = furniture_items.inventory_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS furniture_items_tenant_policy ON furniture_items;
CREATE POLICY furniture_items_tenant_policy ON furniture_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE fi.id = furniture_items.inventory_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 3. vetusty_reports
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "vetusty_reports_select_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_select_policy" ON vetusty_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr_owner ON pr_owner.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND (
        pr_owner.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          JOIN profiles pr ON pr.id = ls.profile_id
          WHERE ls.lease_id = l.id
          AND pr.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "vetusty_reports_insert_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_insert_policy" ON vetusty_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_reports_update_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_update_policy" ON vetusty_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. vetusty_items
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "vetusty_items_select_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_select_policy" ON vetusty_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr_owner ON pr_owner.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND (
        pr_owner.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          JOIN profiles pr ON pr.id = ls.profile_id
          WHERE ls.lease_id = l.id
          AND pr.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "vetusty_items_insert_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_insert_policy" ON vetusty_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_items_update_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_update_policy" ON vetusty_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_items_delete_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_delete_policy" ON vetusty_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
      AND vr.status = 'draft'
    )
  );

-- vetusty_grid_versions reste en lecture publique (USING (true)), pas de modification.
