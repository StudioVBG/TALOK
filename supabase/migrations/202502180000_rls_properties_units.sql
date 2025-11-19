-- Migration : RLS pour properties et units
-- But : autoriser le propriétaire authentifié à voir/insérer/mettre à jour ses données
-- Note: owner_id référence profiles.id, pas auth.uid() directement

BEGIN;

-- Activer RLS sur properties (si pas déjà activé)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "owner_insert_properties" ON properties;
DROP POLICY IF EXISTS "owner_select_properties" ON properties;
DROP POLICY IF EXISTS "owner_update_properties" ON properties;
DROP POLICY IF EXISTS "owner_select_units" ON units;
DROP POLICY IF EXISTS "owner_update_units" ON units;
DROP POLICY IF EXISTS "owner_insert_units" ON units;

-- Policies properties
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

-- Policies units (reliées à la property du même owner)
CREATE POLICY "owner_select_units"
ON units FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties p 
    WHERE p.id = units.property_id 
    AND p.owner_id = public.user_profile_id()
  )
);

CREATE POLICY "owner_update_units"
ON units FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties p 
    WHERE p.id = units.property_id 
    AND p.owner_id = public.user_profile_id()
  )
);

CREATE POLICY "owner_insert_units"
ON units FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM properties p 
    WHERE p.id = units.property_id 
    AND p.owner_id = public.user_profile_id()
  )
);

COMMIT;

