-- ============================================
-- Migration: Supprimer la dépendance owner_profiles des policies RLS
-- Date: 2026-03-03
-- Description:
--   Les policies RLS sur legal_entities, entity_associates et
--   property_ownership passaient par owner_profiles :
--     owner_profile_id IN (SELECT profile_id FROM owner_profiles WHERE ...)
--   Si owner_profiles n'a pas de row pour un owner, les entités sont
--   invisibles → "Aucune entité juridique" même si les données existent.
--
--   Fix: accès direct via profiles.id (= legal_entities.owner_profile_id),
--   sans transiter par owner_profiles.
-- ============================================

-- ============================================
-- 1. LEGAL_ENTITIES — 4 policies
-- ============================================

DROP POLICY IF EXISTS "Users can view their own entities" ON legal_entities;
CREATE POLICY "Users can view their own entities"
  ON legal_entities FOR SELECT
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own entities" ON legal_entities;
CREATE POLICY "Users can insert their own entities"
  ON legal_entities FOR INSERT
  WITH CHECK (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own entities" ON legal_entities;
CREATE POLICY "Users can update their own entities"
  ON legal_entities FOR UPDATE
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own entities" ON legal_entities;
CREATE POLICY "Users can delete their own entities"
  ON legal_entities FOR DELETE
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 2. ENTITY_ASSOCIATES — 2 policies
-- ============================================

DROP POLICY IF EXISTS "Users can view associates of their entities" ON entity_associates;
CREATE POLICY "Users can view associates of their entities"
  ON entity_associates FOR SELECT
  USING (
    legal_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage associates of their entities" ON entity_associates;
CREATE POLICY "Users can manage associates of their entities"
  ON entity_associates FOR ALL
  USING (
    legal_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================
-- 3. PROPERTY_OWNERSHIP — SELECT policy (branche legal_entity_id)
-- ============================================

DROP POLICY IF EXISTS "Users can view ownership of their properties" ON property_ownership;
CREATE POLICY "Users can view ownership of their properties"
  ON property_ownership FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
    OR
    legal_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );
