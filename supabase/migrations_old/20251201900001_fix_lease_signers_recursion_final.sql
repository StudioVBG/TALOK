-- Migration finale pour corriger la récursion infinie dans lease_signers
-- Problème: Les politiques RLS créent une boucle en vérifiant lease_signers depuis elle-même

BEGIN;

-- =============================================
-- 1. Supprimer TOUTES les politiques existantes
-- =============================================
DROP POLICY IF EXISTS "Admins can view all signers" ON lease_signers;
DROP POLICY IF EXISTS "Users can view own signer" ON lease_signers;
DROP POLICY IF EXISTS "Owners can view signers of own leases" ON lease_signers;
DROP POLICY IF EXISTS "Tenants can view signers of own leases" ON lease_signers;
DROP POLICY IF EXISTS "Users can update own signature" ON lease_signers;
DROP POLICY IF EXISTS "Owners can insert signers for own leases" ON lease_signers;
DROP POLICY IF EXISTS "Admins can manage all signers" ON lease_signers;
DROP POLICY IF EXISTS "Users can view signers of accessible leases" ON lease_signers;
DROP POLICY IF EXISTS "admin_all_signers" ON lease_signers;
DROP POLICY IF EXISTS "user_view_own_signer" ON lease_signers;
DROP POLICY IF EXISTS "owner_view_lease_signers" ON lease_signers;
DROP POLICY IF EXISTS "user_update_own_signature" ON lease_signers;
DROP POLICY IF EXISTS "owner_insert_signers" ON lease_signers;

-- =============================================
-- 2. Créer des politiques SIMPLES sans récursion
-- =============================================

-- Politique 1: Admin - accès total (pas de sous-requête sur lease_signers)
CREATE POLICY "ls_admin_all" ON lease_signers
  FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Politique 2: Utilisateur voit sa propre ligne uniquement (pas de récursion)
CREATE POLICY "ls_user_own_select" ON lease_signers
  FOR SELECT
  USING (profile_id = public.user_profile_id());

-- Politique 3: Utilisateur peut mettre à jour sa propre signature
CREATE POLICY "ls_user_own_update" ON lease_signers
  FOR UPDATE
  USING (profile_id = public.user_profile_id())
  WITH CHECK (profile_id = public.user_profile_id());

-- Politique 4: Propriétaire voit les signataires de ses baux
-- IMPORTANT: On passe par properties directement, JAMAIS par lease_signers
CREATE POLICY "ls_owner_view" ON lease_signers
  FOR SELECT
  USING (
    public.user_role() = 'owner' AND
    lease_id IN (
      SELECT l.id 
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = public.user_profile_id()
    )
  );

-- Politique 5: Propriétaire peut insérer des signataires sur ses baux
CREATE POLICY "ls_owner_insert" ON lease_signers
  FOR INSERT
  WITH CHECK (
    public.user_role() = 'owner' AND
    lease_id IN (
      SELECT l.id 
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = public.user_profile_id()
    )
  );

-- Politique 6: Propriétaire peut supprimer des signataires sur ses baux
CREATE POLICY "ls_owner_delete" ON lease_signers
  FOR DELETE
  USING (
    public.user_role() = 'owner' AND
    lease_id IN (
      SELECT l.id 
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = public.user_profile_id()
    )
  );

-- =============================================
-- 3. Commentaire explicatif
-- =============================================
COMMENT ON TABLE lease_signers IS 
'Table des signataires de baux. 
ATTENTION RLS: Les politiques NE DOIVENT JAMAIS référencer lease_signers 
dans leurs conditions pour éviter la récursion infinie.
Utiliser uniquement: leases -> properties -> owner_id';

COMMIT;

