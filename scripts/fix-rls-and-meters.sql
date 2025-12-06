-- =============================================================
-- SCRIPT DE CORRECTION : RLS lease_signers + Schéma meters
-- Exécutez ce script dans Supabase Studio > SQL Editor
-- =============================================================

-- =============================================
-- PARTIE 1: CORRIGER LA RÉCURSION RLS lease_signers
-- =============================================

-- 1.1 Supprimer TOUTES les politiques existantes sur lease_signers
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'lease_signers'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON lease_signers', policy_name);
        RAISE NOTICE 'Supprimé: %', policy_name;
    END LOOP;
END $$;

-- 1.2 Créer des politiques SIMPLES sans récursion

-- Admin - accès total
CREATE POLICY "ls_admin_all" ON lease_signers
  FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Utilisateur voit sa propre ligne uniquement
CREATE POLICY "ls_user_own_select" ON lease_signers
  FOR SELECT
  USING (profile_id = public.user_profile_id());

-- Utilisateur peut mettre à jour sa propre signature
CREATE POLICY "ls_user_own_update" ON lease_signers
  FOR UPDATE
  USING (profile_id = public.user_profile_id())
  WITH CHECK (profile_id = public.user_profile_id());

-- Propriétaire voit les signataires de ses baux (via properties, pas lease_signers!)
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

-- Propriétaire peut insérer des signataires sur ses baux
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

-- Propriétaire peut supprimer des signataires sur ses baux
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
-- PARTIE 2: CORRIGER LE SCHÉMA meters
-- =============================================

-- 2.1 Rendre lease_id nullable
ALTER TABLE meters 
  ALTER COLUMN lease_id DROP NOT NULL;

-- 2.2 Ajouter les colonnes manquantes
DO $$ 
BEGIN
  -- serial_number
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'serial_number') THEN
    ALTER TABLE meters ADD COLUMN serial_number TEXT;
    UPDATE meters SET serial_number = meter_number WHERE serial_number IS NULL;
  END IF;
  
  -- location
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'location') THEN
    ALTER TABLE meters ADD COLUMN location TEXT;
  END IF;
  
  -- is_active
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'is_active') THEN
    ALTER TABLE meters ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  -- provider
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'provider') THEN
    ALTER TABLE meters ADD COLUMN provider TEXT;
  END IF;
  
  -- is_connected
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'is_connected') THEN
    ALTER TABLE meters ADD COLUMN is_connected BOOLEAN DEFAULT false;
  END IF;
  
  -- notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'notes') THEN
    ALTER TABLE meters ADD COLUMN notes TEXT;
  END IF;
END $$;

-- 2.3 Mettre à jour les contraintes
ALTER TABLE meters DROP CONSTRAINT IF EXISTS meters_type_check;
ALTER TABLE meters ADD CONSTRAINT meters_type_check 
  CHECK (type IN ('electricity', 'gas', 'water', 'heating'));

ALTER TABLE meters DROP CONSTRAINT IF EXISTS meters_unit_check;

-- =============================================
-- FIN DU SCRIPT
-- =============================================
SELECT 'Corrections appliquées avec succès!' AS status;

