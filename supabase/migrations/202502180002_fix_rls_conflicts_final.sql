-- Migration : Correction FINALE des conflits de politiques RLS sur properties
-- Problème : Des politiques utilisent auth.uid() au lieu de user_profile_id()
-- Solution : Supprimer TOUTES les politiques problématiques et recréer uniquement celles correctes

BEGIN;

-- Supprimer TOUTES les politiques sur properties (peu importe leur nom)
DROP POLICY IF EXISTS "Owners can view own properties" ON properties;
DROP POLICY IF EXISTS "Owners can create own properties" ON properties;
DROP POLICY IF EXISTS "Owners can update own properties" ON properties;
DROP POLICY IF EXISTS "Tenants can view properties with active leases" ON properties;
DROP POLICY IF EXISTS "Admins can view all properties" ON properties;
DROP POLICY IF EXISTS "owner_insert_properties" ON properties;
DROP POLICY IF EXISTS "owner_select_properties" ON properties;
DROP POLICY IF EXISTS "owner_update_properties" ON properties;
DROP POLICY IF EXISTS "owners_can_delete_properties" ON properties;
DROP POLICY IF EXISTS "owners_can_insert_properties" ON properties;
DROP POLICY IF EXISTS "owners_can_select_properties" ON properties;
DROP POLICY IF EXISTS "owners_can_update_properties" ON properties;
DROP POLICY IF EXISTS "tenant_select_properties" ON properties;
DROP POLICY IF EXISTS "admin_select_properties" ON properties;
DROP POLICY IF EXISTS "owner_delete_properties" ON properties;

-- Recréer UNIQUEMENT les politiques correctes utilisant public.user_profile_id()
-- qui retourne le profiles.id de l'utilisateur connecté

-- INSERT : Les propriétaires peuvent créer leurs propres propriétés
CREATE POLICY "owner_insert_properties"
ON properties FOR INSERT
TO authenticated
WITH CHECK (owner_id = public.user_profile_id());

-- SELECT : Les propriétaires peuvent voir leurs propres propriétés
CREATE POLICY "owner_select_properties"
ON properties FOR SELECT
TO authenticated
USING (owner_id = public.user_profile_id());

-- UPDATE : Les propriétaires peuvent modifier leurs propres propriétés
CREATE POLICY "owner_update_properties"
ON properties FOR UPDATE
TO authenticated
USING (owner_id = public.user_profile_id())
WITH CHECK (owner_id = public.user_profile_id());

-- DELETE : Les propriétaires peuvent supprimer leurs propres propriétés
CREATE POLICY "owner_delete_properties"
ON properties FOR DELETE
TO authenticated
USING (owner_id = public.user_profile_id());

-- SELECT : Les locataires peuvent voir les propriétés avec baux actifs
CREATE POLICY "tenant_select_properties"
ON properties FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    WHERE l.property_id = properties.id
    AND ls.profile_id = public.user_profile_id()
    AND l.statut = 'active'
  )
);

-- SELECT : Les admins peuvent voir toutes les propriétés
CREATE POLICY "admin_select_properties"
ON properties FOR SELECT
TO authenticated
USING (public.user_role() = 'admin');

COMMIT;

