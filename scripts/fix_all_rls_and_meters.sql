-- ========================================================
-- SCRIPT CONSOLIDÉ : Corriger RLS lease_signers + schéma meters + contraintes
-- À exécuter dans Supabase Studio > SQL Editor
-- ========================================================

BEGIN;

-- =============================================
-- PARTIE 0: CORRIGER LA CONTRAINTE TYPE_BAIL
-- =============================================

ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_type_bail_check;

ALTER TABLE leases ADD CONSTRAINT leases_type_bail_check
  CHECK (
    type_bail IN (
      'nu',
      'meuble',
      'colocation',
      'saisonnier',
      'bail_mobilite',
      'commercial_3_6_9',
      'commercial_derogatoire',
      'professionnel',
      'contrat_parking',
      'location_gerance',
      'etudiant'
    )
  );

-- Rendre departement nullable pour permettre création sans adresse
ALTER TABLE properties ALTER COLUMN departement DROP NOT NULL;

-- =============================================
-- PARTIE 1: CORRIGER LEASE_SIGNERS RLS
-- =============================================

-- 1.1 Supprimer TOUTES les politiques existantes
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
DROP POLICY IF EXISTS "ls_admin_all" ON lease_signers;
DROP POLICY IF EXISTS "ls_user_own_select" ON lease_signers;
DROP POLICY IF EXISTS "ls_user_own_update" ON lease_signers;
DROP POLICY IF EXISTS "ls_owner_view" ON lease_signers;
DROP POLICY IF EXISTS "ls_owner_insert" ON lease_signers;
DROP POLICY IF EXISTS "ls_owner_delete" ON lease_signers;

-- 1.2 Créer des politiques SIMPLES sans récursion

-- Admin - accès total
CREATE POLICY "ls_admin_all" ON lease_signers
  FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Utilisateur voit sa propre ligne
CREATE POLICY "ls_user_own_select" ON lease_signers
  FOR SELECT
  USING (profile_id = public.user_profile_id());

-- Utilisateur met à jour sa propre signature
CREATE POLICY "ls_user_own_update" ON lease_signers
  FOR UPDATE
  USING (profile_id = public.user_profile_id())
  WITH CHECK (profile_id = public.user_profile_id());

-- Propriétaire voit les signataires de ses baux (via properties, pas lease_signers)
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

-- Propriétaire peut insérer des signataires
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

-- Propriétaire peut supprimer des signataires
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
-- PARTIE 2: CORRIGER LE SCHÉMA METERS
-- =============================================

-- 2.1 Rendre lease_id nullable
ALTER TABLE meters 
  ALTER COLUMN lease_id DROP NOT NULL;

-- 2.2 Ajouter serial_number si absent
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'serial_number'
  ) THEN
    ALTER TABLE meters ADD COLUMN serial_number TEXT;
    UPDATE meters SET serial_number = meter_number WHERE serial_number IS NULL;
  END IF;
END $$;

-- 2.3 Ajouter location si absent
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'location'
  ) THEN
    ALTER TABLE meters ADD COLUMN location TEXT;
  END IF;
END $$;

-- 2.4 Ajouter is_active si absent
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE meters ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- 2.5 Ajouter notes si absent
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'notes'
  ) THEN
    ALTER TABLE meters ADD COLUMN notes TEXT;
  END IF;
END $$;

-- 2.6 Ajouter provider si absent
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'provider'
  ) THEN
    ALTER TABLE meters ADD COLUMN provider TEXT;
  END IF;
END $$;

-- 2.7 Ajouter is_connected si absent
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'is_connected'
  ) THEN
    ALTER TABLE meters ADD COLUMN is_connected BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2.8 Mettre à jour la contrainte de type
ALTER TABLE meters DROP CONSTRAINT IF EXISTS meters_type_check;
ALTER TABLE meters ADD CONSTRAINT meters_type_check 
  CHECK (type IN ('electricity', 'gas', 'water', 'heating'));

-- 2.9 Supprimer contrainte sur unit (plus flexible)
ALTER TABLE meters DROP CONSTRAINT IF EXISTS meters_unit_check;

-- =============================================
-- PARTIE 3: CRÉER property_photos SI MANQUANTE
-- =============================================

CREATE TABLE IF NOT EXISTS property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT,
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  room_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_property_photos_property_id ON property_photos(property_id);

-- RLS pour property_photos
ALTER TABLE property_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp_admin_all" ON property_photos;
DROP POLICY IF EXISTS "pp_public_select" ON property_photos;
DROP POLICY IF EXISTS "pp_owner_manage" ON property_photos;

CREATE POLICY "pp_admin_all" ON property_photos FOR ALL
  USING (public.user_role() = 'admin');

CREATE POLICY "pp_public_select" ON property_photos FOR SELECT
  USING (true);

CREATE POLICY "pp_owner_manage" ON property_photos FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = public.user_profile_id()
    )
  );

COMMIT;

-- Vérification
SELECT 'Contrainte type_bail:' as info, conname, consrc 
FROM pg_constraint WHERE conname = 'leases_type_bail_check';

SELECT 'RLS lease_signers corrigé:' as info, count(*) as policies 
FROM pg_policies WHERE tablename = 'lease_signers';

SELECT 'Colonnes meters:' as info, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'meters' 
ORDER BY ordinal_position;

SELECT 'Table property_photos:' as info, count(*) as exists 
FROM information_schema.tables 
WHERE table_name = 'property_photos';

