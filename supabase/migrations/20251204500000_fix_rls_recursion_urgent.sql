-- ============================================
-- CORRECTION URGENTE : Récursion RLS lease_signers
-- Date: 2024-12-04
-- ============================================

BEGIN;

-- ============================================
-- 1. SUPPRIMER TOUTES les politiques sur lease_signers
-- ============================================
DROP POLICY IF EXISTS "ls_admin_all" ON lease_signers;
DROP POLICY IF EXISTS "ls_user_own_select" ON lease_signers;
DROP POLICY IF EXISTS "ls_user_own_update" ON lease_signers;
DROP POLICY IF EXISTS "ls_owner_view" ON lease_signers;
DROP POLICY IF EXISTS "ls_owner_insert" ON lease_signers;
DROP POLICY IF EXISTS "ls_owner_delete" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_admin_all" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_user_select_own" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_owner_select" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_user_update_own" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_owner_insert" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_owner_delete" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_select_own" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_admin" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_service" ON lease_signers;

-- ============================================
-- 2. RECRÉER les fonctions helper SANS récursion
-- ============================================

-- Fonction user_profile_id() avec bypass RLS complet
CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Fonction user_role() avec bypass RLS complet  
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================
-- 3. RÉACTIVER RLS avec politiques SIMPLES
-- ============================================
ALTER TABLE lease_signers DISABLE ROW LEVEL SECURITY;
ALTER TABLE lease_signers ENABLE ROW LEVEL SECURITY;

-- Politique 1: Service role a accès total (CRITIQUE pour les APIs)
CREATE POLICY "lease_signers_service_all" ON lease_signers
  FOR ALL TO service_role
  USING (true) 
  WITH CHECK (true);

-- Politique 2: Admin a accès total
CREATE POLICY "lease_signers_admin_full" ON lease_signers
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Politique 3: Utilisateur voit ses propres entrées (SELECT uniquement)
CREATE POLICY "lease_signers_own_select" ON lease_signers
  FOR SELECT TO authenticated
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Politique 4: Utilisateur peut modifier sa propre signature (UPDATE)
CREATE POLICY "lease_signers_own_update" ON lease_signers
  FOR UPDATE TO authenticated
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Politique 5: Owner peut voir les signataires de ses baux
CREATE POLICY "lease_signers_owner_view" ON lease_signers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() 
      AND p.role = 'owner'
    )
    AND
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties prop ON prop.id = l.property_id
      JOIN profiles owner_p ON owner_p.id = prop.owner_id
      WHERE l.id = lease_signers.lease_id
      AND owner_p.user_id = auth.uid()
    )
  );

-- Politique 6: Owner peut insérer des signataires
CREATE POLICY "lease_signers_owner_insert" ON lease_signers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties prop ON prop.id = l.property_id
      JOIN profiles owner_p ON owner_p.id = prop.owner_id
      WHERE l.id = lease_signers.lease_id
      AND owner_p.user_id = auth.uid()
    )
  );

-- ============================================
-- 4. LIER les profils aux comptes auth par email
-- ============================================
UPDATE profiles p
SET user_id = u.id
FROM auth.users u
WHERE p.email = u.email
  AND p.user_id IS NULL;

-- ============================================
-- 5. CORRIGER aussi les politiques documents
-- ============================================
DROP POLICY IF EXISTS "documents_tenant_select" ON documents;
DROP POLICY IF EXISTS "documents_service" ON documents;

-- Service role pour documents
CREATE POLICY "documents_service_all" ON documents
  FOR ALL TO service_role
  USING (true) 
  WITH CHECK (true);

-- Locataire voit ses documents
CREATE POLICY "documents_tenant_view" ON documents
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    lease_id IN (
      SELECT ls.lease_id FROM lease_signers ls
      JOIN profiles p ON p.id = ls.profile_id
      WHERE p.user_id = auth.uid()
    )
  );

COMMIT;

-- ============================================
-- VÉRIFICATION (à exécuter après)
-- ============================================
-- SELECT p.id, p.user_id, p.email, p.nom, p.role,
--        ls.lease_id, ls.signature_status
-- FROM profiles p
-- LEFT JOIN lease_signers ls ON ls.profile_id = p.id
-- WHERE p.role = 'tenant';

