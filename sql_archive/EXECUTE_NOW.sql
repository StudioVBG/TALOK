-- ============================================
-- 🚨 EXÉCUTEZ CE SCRIPT DANS SUPABASE SQL EDITOR
-- ============================================
-- Allez sur: https://supabase.com/dashboard
-- Ouvrez votre projet → SQL Editor → New Query
-- Collez tout ce contenu et cliquez "Run"
-- ============================================

-- 1. SUPPRIMER les politiques problématiques
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
DROP POLICY IF EXISTS "lease_signers_service_all" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_admin_full" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_own_select" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_own_update" ON lease_signers;
DROP POLICY IF EXISTS "lease_signers_owner_view" ON lease_signers;

-- 2. DÉSACTIVER puis RÉACTIVER RLS
ALTER TABLE lease_signers DISABLE ROW LEVEL SECURITY;
ALTER TABLE lease_signers ENABLE ROW LEVEL SECURITY;

-- 3. CRÉER des politiques SIMPLES
CREATE POLICY "lease_signers_service_all" ON lease_signers
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "lease_signers_admin_full" ON lease_signers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "lease_signers_own_select" ON lease_signers
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "lease_signers_own_update" ON lease_signers
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "lease_signers_owner_view" ON lease_signers
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
    AND EXISTS (
      SELECT 1 FROM leases l
      JOIN properties prop ON prop.id = l.property_id
      JOIN profiles owner_p ON owner_p.id = prop.owner_id
      WHERE l.id = lease_signers.lease_id AND owner_p.user_id = auth.uid()
    )
  );

CREATE POLICY "lease_signers_owner_insert" ON lease_signers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties prop ON prop.id = l.property_id
      JOIN profiles owner_p ON owner_p.id = prop.owner_id
      WHERE l.id = lease_signers.lease_id AND owner_p.user_id = auth.uid()
    )
  );

-- 4. LIER les profils locataires aux comptes auth
UPDATE profiles p
SET user_id = u.id
FROM auth.users u
WHERE p.email = u.email
  AND p.user_id IS NULL;

-- 5. CORRIGER les politiques documents aussi
DROP POLICY IF EXISTS "documents_tenant_select" ON documents;
DROP POLICY IF EXISTS "documents_service" ON documents;
DROP POLICY IF EXISTS "documents_service_all" ON documents;
DROP POLICY IF EXISTS "documents_tenant_view" ON documents;

CREATE POLICY "documents_service_all" ON documents
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "documents_tenant_view" ON documents
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR lease_id IN (
      SELECT ls.lease_id FROM lease_signers ls
      JOIN profiles p ON p.id = ls.profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- 6. VÉRIFICATION - Affiche les profils liés
SELECT 
  p.id as profile_id,
  p.user_id,
  p.email,
  p.nom,
  p.prenom,
  p.role,
  ls.lease_id,
  ls.signature_status,
  ls.signed_at
FROM profiles p
LEFT JOIN lease_signers ls ON ls.profile_id = p.id
WHERE p.role = 'tenant'
ORDER BY p.created_at DESC;

