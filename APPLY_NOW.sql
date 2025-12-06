-- ============================================================
-- SCRIPT À EXÉCUTER DANS SUPABASE SQL EDITOR
-- Copiez-collez ce script dans l'éditeur SQL de Supabase
-- ============================================================

-- 1. Créer la vue property_photos (corrige l'erreur dans tenant_dashboard)
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

-- 2. S'assurer que la colonne email existe dans profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email TEXT;
    CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
  END IF;
END $$;

-- 3. S'assurer que les colonnes CNI existent dans documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'expiry_date'
  ) THEN
    ALTER TABLE documents ADD COLUMN expiry_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE documents ADD COLUMN is_archived BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE documents ADD COLUMN verification_status TEXT DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'cni_modification_locked'
  ) THEN
    ALTER TABLE documents ADD COLUMN cni_modification_locked BOOLEAN DEFAULT true;
  END IF;
END $$;

-- 4. Créer la table signature_proofs pour les preuves cryptographiques
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

DROP POLICY IF EXISTS "Users can view their own signatures" ON signature_proofs;
CREATE POLICY "Users can view their own signatures"
  ON signature_proofs FOR SELECT
  USING (
    signer_id = public.user_profile_id()
    OR EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE l.id = signature_proofs.lease_id
      AND p.owner_id = public.user_profile_id()
    )
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "System can insert signature proofs" ON signature_proofs;
CREATE POLICY "System can insert signature proofs"
  ON signature_proofs FOR INSERT
  WITH CHECK (true);

-- 5. Créer la table otp_codes
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

-- 6. Créer la table notifications si elle n'existe pas
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

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;  
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (profile_id = public.user_profile_id());

CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(profile_id, read_at);

-- 7. Mettre à jour la RPC tenant_dashboard avec multi-baux
CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_leases JSONB;
  v_lease JSONB;
  v_properties JSONB;
  v_property JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_stats JSONB;
  v_result JSONB;
BEGIN
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_tenant_user_id;

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Récupérer TOUS les baux actifs (multi-baux)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'property_id', l.property_id,
      'type_bail', l.type_bail,
      'loyer', l.loyer,
      'charges_forfaitaires', COALESCE(l.charges_forfaitaires, 0),
      'depot_de_garantie', COALESCE(l.depot_de_garantie, 0),
      'date_debut', l.date_debut,
      'date_fin', l.date_fin,
      'statut', l.statut,
      'created_at', l.created_at,
      'property', jsonb_build_object(
        'id', p.id,
        'adresse_complete', p.adresse_complete,
        'ville', p.ville,
        'code_postal', p.code_postal,
        'type', p.type,
        'surface', p.surface,
        'nb_pieces', p.nb_pieces,
        'cover_url', (SELECT url FROM photos WHERE property_id = p.id AND is_main = true LIMIT 1)
      ),
      'owner', jsonb_build_object(
        'id', pr.id,
        'name', concat(pr.prenom, ' ', pr.nom),
        'email', pr.email
      )
    ) ORDER BY l.created_at DESC
  ) INTO v_leases
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  JOIN properties p ON p.id = l.property_id
  JOIN profiles pr ON pr.id = p.owner_id
  WHERE ls.profile_id = v_profile_id
  AND l.statut IN ('active', 'pending_signature');

  IF v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN
    v_lease := v_leases->0;
    v_property := v_lease->'property';
    SELECT jsonb_agg(lease->'property') INTO v_properties
    FROM jsonb_array_elements(v_leases) AS lease;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'lease_id', i.lease_id,
      'periode', i.periode,
      'montant_total', i.montant_total,
      'montant_loyer', i.montant_loyer,
      'montant_charges', i.montant_charges,
      'statut', i.statut,
      'due_date', i.due_date,
      'property_type', p.type,
      'property_address', p.adresse_complete
    ) ORDER BY i.periode DESC
  ) INTO v_invoices
  FROM invoices i
  JOIN leases l ON l.id = i.lease_id
  JOIN properties p ON p.id = l.property_id
  WHERE i.tenant_id = v_profile_id
  LIMIT 10;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'titre', t.titre,
      'description', t.description,
      'priorite', t.priorite,
      'statut', t.statut,
      'created_at', t.created_at,
      'property_id', t.property_id,
      'property_address', p.adresse_complete,
      'property_type', p.type
    ) ORDER BY t.created_at DESC
  ) INTO v_tickets
  FROM tickets t
  LEFT JOIN properties p ON p.id = t.property_id
  WHERE t.created_by_profile_id = v_profile_id
  LIMIT 5;

  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(montant_total), 0),
    'unpaid_count', COUNT(*),
    'total_monthly_rent', (
      SELECT COALESCE(SUM(l.loyer + COALESCE(l.charges_forfaitaires, 0)), 0)
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = v_profile_id AND l.statut = 'active'
    ),
    'active_leases_count', (
      SELECT COUNT(*)
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = v_profile_id AND l.statut = 'active'
    )
  ) INTO v_stats
  FROM invoices
  WHERE tenant_id = v_profile_id AND statut IN ('sent', 'late');

  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'properties', COALESCE(v_properties, '[]'::jsonb),
    'lease', v_lease,
    'property', v_property,
    'invoices', COALESCE(v_invoices, '[]'::jsonb),
    'tickets', COALESCE(v_tickets, '[]'::jsonb),
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- 8. Index pour performance
CREATE INDEX IF NOT EXISTS idx_leases_statut ON leases(statut);
CREATE INDEX IF NOT EXISTS idx_lease_signers_profile ON lease_signers(profile_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);

-- ============================================================
-- FIN DU SCRIPT - Exécutez ce script dans Supabase SQL Editor
-- ============================================================
SELECT 'Migration complète ! ✅' as status;

