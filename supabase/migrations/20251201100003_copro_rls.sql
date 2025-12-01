-- =====================================================
-- MIGRATION: Row Level Security pour COPRO
-- Description: Politiques de sécurité pour toutes les tables COPRO
-- =====================================================

-- =====================================================
-- RLS: sites
-- =====================================================
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Lecture: sites accessibles
CREATE POLICY "sites_select_policy" ON sites
  FOR SELECT USING (
    id IN (SELECT accessible_site_ids())
    OR has_role('platform_admin')
  );

-- Insertion: syndic ou admin
CREATE POLICY "sites_insert_policy" ON sites
  FOR INSERT WITH CHECK (
    has_role('platform_admin')
    OR has_role('syndic')
  );

-- Modification: syndic du site ou admin
CREATE POLICY "sites_update_policy" ON sites
  FOR UPDATE USING (
    is_syndic_of(id)
    OR has_role('platform_admin')
  );

-- Suppression: admin uniquement
CREATE POLICY "sites_delete_policy" ON sites
  FOR DELETE USING (
    has_role('platform_admin')
  );

-- =====================================================
-- RLS: buildings
-- =====================================================
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- Lecture: si accès au site parent
CREATE POLICY "buildings_select_policy" ON buildings
  FOR SELECT USING (
    site_id IN (SELECT accessible_site_ids())
    OR has_role('platform_admin')
  );

-- Insertion: syndic du site ou admin
CREATE POLICY "buildings_insert_policy" ON buildings
  FOR INSERT WITH CHECK (
    is_syndic_of(site_id)
    OR has_role('platform_admin')
  );

-- Modification: syndic du site ou admin
CREATE POLICY "buildings_update_policy" ON buildings
  FOR UPDATE USING (
    is_syndic_of(site_id)
    OR has_role('platform_admin')
  );

-- Suppression: syndic du site ou admin
CREATE POLICY "buildings_delete_policy" ON buildings
  FOR DELETE USING (
    is_syndic_of(site_id)
    OR has_role('platform_admin')
  );

-- =====================================================
-- RLS: floors
-- =====================================================
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;

-- Lecture: si accès au building parent
CREATE POLICY "floors_select_policy" ON floors
  FOR SELECT USING (
    building_id IN (
      SELECT b.id FROM buildings b 
      WHERE b.site_id IN (SELECT accessible_site_ids())
    )
    OR has_role('platform_admin')
  );

-- Insertion/Modification/Suppression: syndic
CREATE POLICY "floors_insert_policy" ON floors
  FOR INSERT WITH CHECK (
    building_id IN (
      SELECT b.id FROM buildings b 
      WHERE is_syndic_of(b.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "floors_update_policy" ON floors
  FOR UPDATE USING (
    building_id IN (
      SELECT b.id FROM buildings b 
      WHERE is_syndic_of(b.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "floors_delete_policy" ON floors
  FOR DELETE USING (
    building_id IN (
      SELECT b.id FROM buildings b 
      WHERE is_syndic_of(b.site_id)
    )
    OR has_role('platform_admin')
  );

-- =====================================================
-- RLS: copro_units
-- =====================================================
ALTER TABLE copro_units ENABLE ROW LEVEL SECURITY;

-- Lecture: site accessible OU propriétaire du lot
CREATE POLICY "copro_units_select_policy" ON copro_units
  FOR SELECT USING (
    site_id IN (SELECT accessible_site_ids())
    OR id IN (SELECT owned_unit_ids())
    OR has_role('platform_admin')
  );

-- Insertion: syndic du site ou admin
CREATE POLICY "copro_units_insert_policy" ON copro_units
  FOR INSERT WITH CHECK (
    is_syndic_of(site_id)
    OR has_role('platform_admin')
  );

-- Modification: syndic du site ou admin
CREATE POLICY "copro_units_update_policy" ON copro_units
  FOR UPDATE USING (
    is_syndic_of(site_id)
    OR has_role('platform_admin')
  );

-- Suppression: admin uniquement (pour sécurité)
CREATE POLICY "copro_units_delete_policy" ON copro_units
  FOR DELETE USING (
    has_role('platform_admin')
  );

-- =====================================================
-- RLS: copro_lots (tantièmes détaillés)
-- =====================================================
ALTER TABLE copro_lots ENABLE ROW LEVEL SECURITY;

-- Lecture: si accès au lot parent
CREATE POLICY "copro_lots_select_policy" ON copro_lots
  FOR SELECT USING (
    unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE cu.site_id IN (SELECT accessible_site_ids())
    )
    OR unit_id IN (SELECT owned_unit_ids())
    OR has_role('platform_admin')
  );

-- Modification: syndic uniquement
CREATE POLICY "copro_lots_insert_policy" ON copro_lots
  FOR INSERT WITH CHECK (
    unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE is_syndic_of(cu.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "copro_lots_update_policy" ON copro_lots
  FOR UPDATE USING (
    unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE is_syndic_of(cu.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "copro_lots_delete_policy" ON copro_lots
  FOR DELETE USING (
    has_role('platform_admin')
  );

-- =====================================================
-- RLS: ownerships
-- =====================================================
ALTER TABLE ownerships ENABLE ROW LEVEL SECURITY;

-- Lecture: syndic du site, propriétaire concerné, ou admin
CREATE POLICY "ownerships_select_policy" ON ownerships
  FOR SELECT USING (
    unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE cu.site_id IN (SELECT accessible_site_ids())
    )
    OR profile_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
    OR has_role('platform_admin')
  );

-- Insertion: syndic ou admin
CREATE POLICY "ownerships_insert_policy" ON ownerships
  FOR INSERT WITH CHECK (
    unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE is_syndic_of(cu.site_id)
    )
    OR has_role('platform_admin')
  );

-- Modification: syndic ou admin
CREATE POLICY "ownerships_update_policy" ON ownerships
  FOR UPDATE USING (
    unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE is_syndic_of(cu.site_id)
    )
    OR has_role('platform_admin')
  );

-- Suppression: admin uniquement
CREATE POLICY "ownerships_delete_policy" ON ownerships
  FOR DELETE USING (
    has_role('platform_admin')
  );

-- =====================================================
-- RLS: ownership_history
-- =====================================================
ALTER TABLE ownership_history ENABLE ROW LEVEL SECURITY;

-- Lecture seule pour syndic/admin
CREATE POLICY "ownership_history_select_policy" ON ownership_history
  FOR SELECT USING (
    unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE is_syndic_of(cu.site_id)
    )
    OR has_role('platform_admin')
  );

-- Insertion: système uniquement (via triggers ou admin)
CREATE POLICY "ownership_history_insert_policy" ON ownership_history
  FOR INSERT WITH CHECK (
    has_role('platform_admin')
    OR unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE is_syndic_of(cu.site_id)
    )
  );

-- =====================================================
-- RLS: app_roles (lecture publique pour référence)
-- =====================================================
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_roles_select_policy" ON app_roles
  FOR SELECT USING (true);

-- Modification: admin uniquement
CREATE POLICY "app_roles_modify_policy" ON app_roles
  FOR ALL USING (has_role('platform_admin'));

-- =====================================================
-- RLS: app_permissions (lecture publique)
-- =====================================================
ALTER TABLE app_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_permissions_select_policy" ON app_permissions
  FOR SELECT USING (true);

CREATE POLICY "app_permissions_modify_policy" ON app_permissions
  FOR ALL USING (has_role('platform_admin'));

-- =====================================================
-- RLS: role_permissions (lecture publique)
-- =====================================================
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select_policy" ON role_permissions
  FOR SELECT USING (true);

CREATE POLICY "role_permissions_modify_policy" ON role_permissions
  FOR ALL USING (has_role('platform_admin'));

-- =====================================================
-- RLS: user_roles
-- =====================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Lecture: ses propres rôles ou syndic du site ou admin
CREATE POLICY "user_roles_select_policy" ON user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR (site_id IS NOT NULL AND is_syndic_of(site_id))
    OR has_role('platform_admin')
  );

-- Insertion: syndic du site ou admin
CREATE POLICY "user_roles_insert_policy" ON user_roles
  FOR INSERT WITH CHECK (
    (site_id IS NOT NULL AND is_syndic_of(site_id))
    OR has_role('platform_admin')
  );

-- Modification: syndic du site ou admin
CREATE POLICY "user_roles_update_policy" ON user_roles
  FOR UPDATE USING (
    (site_id IS NOT NULL AND is_syndic_of(site_id))
    OR has_role('platform_admin')
  );

-- Suppression: admin uniquement
CREATE POLICY "user_roles_delete_policy" ON user_roles
  FOR DELETE USING (
    has_role('platform_admin')
  );

-- =====================================================
-- GRANTS: Permissions Supabase
-- =====================================================

-- Tables principales
GRANT SELECT, INSERT, UPDATE, DELETE ON sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON buildings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON floors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON copro_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON copro_lots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ownerships TO authenticated;
GRANT SELECT, INSERT ON ownership_history TO authenticated;

-- Tables RBAC
GRANT SELECT ON app_roles TO authenticated;
GRANT SELECT ON app_permissions TO authenticated;
GRANT SELECT ON role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_roles TO authenticated;

-- Vues
GRANT SELECT ON v_copro_units_with_tantiemes TO authenticated;
GRANT SELECT ON v_current_ownerships TO authenticated;
GRANT SELECT ON v_site_structure TO authenticated;
GRANT SELECT ON v_user_roles_detailed TO authenticated;
GRANT SELECT ON v_user_permissions TO authenticated;

-- Séquences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Fonctions
GRANT EXECUTE ON FUNCTION has_role TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission TO authenticated;
GRANT EXECUTE ON FUNCTION accessible_site_ids TO authenticated;
GRANT EXECUTE ON FUNCTION owned_unit_ids TO authenticated;
GRANT EXECUTE ON FUNCTION is_owner_of_unit TO authenticated;
GRANT EXECUTE ON FUNCTION is_syndic_of TO authenticated;
GRANT EXECUTE ON FUNCTION get_highest_role TO authenticated;
GRANT EXECUTE ON FUNCTION assign_role TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_role TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_site_tantiemes TO authenticated;
GRANT EXECUTE ON FUNCTION validate_site_tantiemes TO authenticated;

