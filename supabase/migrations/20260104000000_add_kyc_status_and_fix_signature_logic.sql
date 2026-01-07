-- ============================================================================
-- MIGRATION: Ajouter kyc_status à tenant_profiles et corriger la logique
-- Date: 2026-01-04
-- Description: 
--   1. Ajoute la colonne kyc_status à tenant_profiles
--   2. Met à jour les locataires existants avec comptes créés comme "verified"
--   3. Corrige la logique pour que les locataires invités soient auto-vérifiés
-- ============================================================================

-- 1. Ajouter la colonne kyc_status si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_profiles' AND column_name = 'kyc_status'
  ) THEN
    ALTER TABLE tenant_profiles 
    ADD COLUMN kyc_status TEXT DEFAULT 'pending' 
    CHECK (kyc_status IN ('pending', 'processing', 'verified', 'rejected'));
    
    RAISE NOTICE 'Colonne kyc_status ajoutée à tenant_profiles';
  END IF;
END $$;

-- 2. Marquer comme "verified" tous les locataires qui ont :
--    - Un compte créé (profile_id existe)
--    - Signé un bail (lease_signers.signed_at IS NOT NULL)
UPDATE tenant_profiles tp
SET kyc_status = 'verified'
WHERE EXISTS (
  SELECT 1 FROM lease_signers ls
  WHERE ls.profile_id = tp.profile_id
  AND ls.signed_at IS NOT NULL
)
AND (tp.kyc_status IS NULL OR tp.kyc_status = 'pending');

-- 3. Marquer comme "verified" tous les locataires qui ont un compte actif
--    (ils se sont connectés, donc leur email est vérifié)
UPDATE tenant_profiles tp
SET kyc_status = 'verified'
WHERE tp.profile_id IN (
  SELECT p.id FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE u.email_confirmed_at IS NOT NULL
)
AND (tp.kyc_status IS NULL OR tp.kyc_status = 'pending');

-- 4. Créer un trigger pour auto-vérifier les nouveaux locataires qui acceptent une invitation
CREATE OR REPLACE FUNCTION auto_verify_tenant_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Si un locataire crée un compte via invitation, on le marque comme vérifié
  IF NEW.kyc_status IS NULL OR NEW.kyc_status = 'pending' THEN
    -- Vérifier si ce locataire a une invitation acceptée
    IF EXISTS (
      SELECT 1 FROM invitations i
      WHERE LOWER(i.email) = LOWER((SELECT email FROM auth.users WHERE id = (SELECT user_id FROM profiles WHERE id = NEW.profile_id)))
      AND i.status = 'accepted'
    ) THEN
      NEW.kyc_status := 'verified';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS tr_auto_verify_tenant ON tenant_profiles;

-- Créer le trigger
CREATE TRIGGER tr_auto_verify_tenant
BEFORE INSERT OR UPDATE ON tenant_profiles
FOR EACH ROW
EXECUTE FUNCTION auto_verify_tenant_on_signup();

-- 5. Mettre à jour la fonction tenant_dashboard pour récupérer correctement le kyc_status
-- Cette partie est informative - la RPC actuelle fait déjà un COALESCE sur kyc_status

COMMENT ON COLUMN tenant_profiles.kyc_status IS 
'Statut de vérification d''identité: pending (en attente), processing (en cours), verified (vérifié), rejected (rejeté). 
Un locataire est auto-vérifié s''il a créé un compte via invitation ou s''il a signé un bail.';

