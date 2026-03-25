-- ============================================================
-- CORRECTIONS CRITIQUES POUR PROCESSUS DE SIGNATURE
-- À EXÉCUTER DANS SUPABASE SQL EDITOR
-- ============================================================

BEGIN;

-- ============================================================
-- 1. AJOUTER LA COLONNE EMAIL À PROFILES (CRITIQUE)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email TEXT;
    RAISE NOTICE 'Colonne email ajoutée à profiles';
  ELSE
    RAISE NOTICE 'Colonne email existe déjà';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ============================================================
-- 2. METTRE À JOUR LA CONTRAINTE DE STATUT DES BAUX
-- ============================================================
ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;
ALTER TABLE leases ADD CONSTRAINT leases_statut_check 
  CHECK (statut IN (
    'draft', 
    'pending_signature', 
    'pending_owner_signature',  -- Nouveau
    'active', 
    'terminated', 
    'cancelled'                 -- Nouveau
  ));

-- ============================================================
-- 3. CRÉER LA TABLE SIGNATURE_PROOFS
-- ============================================================
CREATE TABLE IF NOT EXISTS signature_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES profiles(id),
  signature_type TEXT NOT NULL CHECK (signature_type IN ('draw', 'type')),
  signature_hash TEXT NOT NULL,
  document_hash TEXT NOT NULL,
  timestamp_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  timestamp_local TEXT,
  timezone TEXT,
  ip_address TEXT,
  user_agent TEXT,
  screen_size TEXT,
  is_touch_device BOOLEAN,
  signature_image_url TEXT,
  typed_name TEXT,
  font_family TEXT,
  certificate JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS pour signature_proofs
ALTER TABLE signature_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their signatures" ON signature_proofs;
CREATE POLICY "Users can view their signatures"
  ON signature_proofs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "System can insert signatures" ON signature_proofs;
CREATE POLICY "System can insert signatures"
  ON signature_proofs FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_signature_proofs_lease ON signature_proofs(lease_id);
CREATE INDEX IF NOT EXISTS idx_signature_proofs_signer ON signature_proofs(signer_id);

-- ============================================================
-- 4. CRÉER LA TABLE OTP_CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'signature' CHECK (type IN ('signature', 'login', 'verification')),
  method TEXT NOT NULL DEFAULT 'sms' CHECK (method IN ('sms', 'email')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_identifier ON otp_codes(identifier);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);

-- ============================================================
-- 5. AJOUTER LES COLONNES DOCUMENTS POUR CNI
-- ============================================================
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cni_modification_locked BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date) WHERE expiry_date IS NOT NULL;

-- ============================================================
-- 6. CRÉER LA TABLE NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(profile_id, read_at) WHERE read_at IS NULL;

-- ============================================================
-- 7. CRÉER LA VUE PROPERTY_PHOTOS (compatibilité)
-- ============================================================
CREATE OR REPLACE VIEW property_photos AS
SELECT 
  id,
  property_id,
  room_id,
  url,
  storage_path,
  is_main,
  tag,
  ordre,
  created_at,
  updated_at
FROM photos;

-- ============================================================
-- 8. VÉRIFICATION FINALE
-- ============================================================
DO $$
DECLARE
  v_email_exists BOOLEAN;
  v_statut_ok BOOLEAN;
BEGIN
  -- Vérifier colonne email
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) INTO v_email_exists;
  
  IF v_email_exists THEN
    RAISE NOTICE '✅ Colonne profiles.email: OK';
  ELSE
    RAISE WARNING '❌ Colonne profiles.email: MANQUANTE';
  END IF;
  
  -- Vérifier contrainte statut
  SELECT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'leases_statut_check'
  ) INTO v_statut_ok;
  
  IF v_statut_ok THEN
    RAISE NOTICE '✅ Contrainte leases_statut_check: OK';
  ELSE
    RAISE WARNING '❌ Contrainte leases_statut_check: MANQUANTE';
  END IF;
END $$;

COMMIT;

SELECT 'TOUTES LES CORRECTIONS ONT ÉTÉ APPLIQUÉES ✅' as resultat;


