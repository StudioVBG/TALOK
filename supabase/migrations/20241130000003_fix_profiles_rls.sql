-- Migration: Corriger les RLS policies sur la table profiles
-- S'assurer que les utilisateurs peuvent lire leur propre profil

-- Supprimer les anciennes policies si elles existent (pour éviter les conflits)
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "service_role_all_profiles" ON profiles;

-- Policy: Les utilisateurs peuvent lire leur propre profil
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent mettre à jour leur propre profil
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Les admins peuvent tout voir
CREATE POLICY "admins_read_all_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Les propriétaires peuvent voir les profils de leurs locataires
CREATE POLICY "owners_read_tenant_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM roommates r
      JOIN leases l ON r.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles owner_profile ON p.owner_id = owner_profile.id
      WHERE owner_profile.user_id = auth.uid()
        AND profiles.id = r.profile_id
    )
  );

-- S'assurer que RLS est activé
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Commentaire
COMMENT ON POLICY "users_read_own_profile" ON profiles IS 'Permet aux utilisateurs de lire leur propre profil';

