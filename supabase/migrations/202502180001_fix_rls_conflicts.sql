-- Migration : Correction des conflits de politiques RLS sur properties
-- Problème : Plusieurs migrations créent des politiques avec des noms différents
-- Solution : Supprimer toutes les anciennes politiques et garder uniquement celles de 202502180000

BEGIN;

-- Supprimer TOUTES les anciennes politiques sur properties (peu importe leur nom)
DROP POLICY IF EXISTS "Owners can view own properties" ON properties;
DROP POLICY IF EXISTS "Owners can create own properties" ON properties;
DROP POLICY IF EXISTS "Owners can update own properties" ON properties;
DROP POLICY IF EXISTS "Tenants can view properties with active leases" ON properties;
DROP POLICY IF EXISTS "Admins can view all properties" ON properties;
DROP POLICY IF EXISTS "owner_insert_properties" ON properties;
DROP POLICY IF EXISTS "owner_select_properties" ON properties;
DROP POLICY IF EXISTS "owner_update_properties" ON properties;

-- Recréer les politiques avec les noms standardisés (comme dans 202502180000)
-- Utiliser public.user_profile_id() qui retourne le profiles.id de l'utilisateur connecté

CREATE POLICY "owner_insert_properties"
ON properties FOR INSERT
TO authenticated
WITH CHECK (owner_id = public.user_profile_id());

CREATE POLICY "owner_select_properties"
ON properties FOR SELECT
TO authenticated
USING (owner_id = public.user_profile_id());

CREATE POLICY "owner_update_properties"
ON properties FOR UPDATE
TO authenticated
USING (owner_id = public.user_profile_id());

-- Politique pour les locataires (voir les propriétés avec baux actifs)
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

-- Politique pour les admins (voir toutes les propriétés)
CREATE POLICY "admin_select_properties"
ON properties FOR SELECT
TO authenticated
USING (public.user_role() = 'admin');

COMMIT;

