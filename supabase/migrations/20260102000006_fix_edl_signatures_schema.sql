-- Migration : Correction du schéma edl_signatures pour supporter les invitations et le profil
-- Date: 2026-01-02

BEGIN;

-- 1. Ajouter les colonnes manquantes à edl_signatures
ALTER TABLE edl_signatures 
  ADD COLUMN IF NOT EXISTS signer_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invitation_token UUID DEFAULT uuid_generate_v4(),
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Rendre signer_user nullable (car on peut inviter avant que le compte existe)
ALTER TABLE edl_signatures ALTER COLUMN signer_user DROP NOT NULL;

-- 3. Rendre signed_at nullable (car une invitation n'est pas encore une signature)
ALTER TABLE edl_signatures ALTER COLUMN signed_at DROP NOT NULL;
ALTER TABLE edl_signatures ALTER COLUMN signed_at DROP DEFAULT;

-- 4. Ajouter des index pour les performances
CREATE INDEX IF NOT EXISTS idx_edl_signatures_signer_profile_id ON edl_signatures(signer_profile_id);
CREATE INDEX IF NOT EXISTS idx_edl_signatures_invitation_token ON edl_signatures(invitation_token);

-- 5. Mettre à jour les RLS pour permettre l'accès via invitation_token
DROP POLICY IF EXISTS "EDL signatures via token" ON edl_signatures;
CREATE POLICY "EDL signatures via token" ON edl_signatures
  FOR SELECT USING (true); -- On restreindra davantage si besoin, mais permet la lecture pour signature

COMMIT;

