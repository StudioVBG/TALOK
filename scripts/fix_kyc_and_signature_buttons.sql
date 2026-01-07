-- ============================================================================
-- SCRIPT MANUEL : Correction KYC + Boutons Signature
-- À exécuter dans Supabase Studio > SQL Editor
-- ============================================================================

-- 1. Ajouter la colonne kyc_status si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_profiles' AND column_name = 'kyc_status'
  ) THEN
    ALTER TABLE tenant_profiles 
    ADD COLUMN kyc_status TEXT DEFAULT 'pending';
    
    -- Ajouter la contrainte CHECK séparément pour éviter les erreurs
    ALTER TABLE tenant_profiles 
    ADD CONSTRAINT tenant_profiles_kyc_status_check 
    CHECK (kyc_status IN ('pending', 'processing', 'verified', 'rejected'));
    
    RAISE NOTICE '✅ Colonne kyc_status ajoutée à tenant_profiles';
  ELSE
    RAISE NOTICE 'ℹ️ Colonne kyc_status existe déjà';
  END IF;
END $$;

-- 2. Marquer TOUS les locataires existants comme "verified"
-- (ils ont créé leur compte via invitation = identité vérifiée)
UPDATE tenant_profiles 
SET kyc_status = 'verified'
WHERE kyc_status IS NULL OR kyc_status = 'pending';

-- 3. Afficher les locataires mis à jour
SELECT 
  p.email,
  p.prenom || ' ' || p.nom as nom_complet,
  tp.kyc_status
FROM tenant_profiles tp
JOIN profiles p ON p.id = tp.profile_id;

