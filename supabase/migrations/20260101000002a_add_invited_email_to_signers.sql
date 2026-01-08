-- Migration : Ajouter les colonnes invited_email et invited_name à lease_signers
-- Ces colonnes sont nécessaires pour le flux d'invitation des locataires

-- 1. Rendre profile_id nullable (pour permettre les invitations avant création de compte)
ALTER TABLE lease_signers 
  ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Ajouter les colonnes d'invitation
ALTER TABLE lease_signers 
  ADD COLUMN IF NOT EXISTS invited_email TEXT,
  ADD COLUMN IF NOT EXISTS invited_name TEXT;

-- 3. Créer un index sur invited_email pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email 
  ON lease_signers(invited_email) 
  WHERE invited_email IS NOT NULL;

-- 4. Modifier la contrainte unique pour permettre soit profile_id soit invited_email
-- D'abord supprimer l'ancienne contrainte
ALTER TABLE lease_signers 
  DROP CONSTRAINT IF EXISTS lease_signers_lease_id_profile_id_key;

-- 5. Ajouter une nouvelle contrainte qui vérifie la cohérence
-- Un signataire doit avoir soit un profile_id, soit un invited_email
ALTER TABLE lease_signers 
  ADD CONSTRAINT lease_signers_has_identity 
  CHECK (profile_id IS NOT NULL OR invited_email IS NOT NULL);

-- 6. Créer un index unique partiel pour éviter les doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_lease_signers_unique_profile 
  ON lease_signers(lease_id, profile_id) 
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lease_signers_unique_email 
  ON lease_signers(lease_id, invited_email) 
  WHERE invited_email IS NOT NULL AND profile_id IS NULL;

-- 7. Mettre à jour les RLS pour permettre aux propriétaires de voir les signataires invités
DROP POLICY IF EXISTS "lease_signers_owner_view_invited" ON lease_signers;
CREATE POLICY "lease_signers_owner_view_invited" ON lease_signers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties prop ON prop.id = l.property_id
      JOIN profiles owner_p ON owner_p.id = prop.owner_id
      WHERE l.id = lease_signers.lease_id 
        AND owner_p.user_id = auth.uid()
    )
  );

-- 8. Créer un trigger pour lier automatiquement profile_id quand le locataire crée son compte
CREATE OR REPLACE FUNCTION public.auto_link_signer_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand un profil est créé, chercher les invitations par email
  UPDATE lease_signers ls
  SET profile_id = NEW.id,
      updated_at = NOW()
  FROM auth.users u
  WHERE u.id = NEW.user_id
    AND ls.invited_email = u.email
    AND ls.profile_id IS NULL;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_auto_link ON profiles;
CREATE TRIGGER on_profile_created_auto_link
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_signer_profile();

COMMENT ON COLUMN lease_signers.invited_email IS 'Email du locataire invité avant création de son compte';
COMMENT ON COLUMN lease_signers.invited_name IS 'Nom du locataire invité (optionnel)';

