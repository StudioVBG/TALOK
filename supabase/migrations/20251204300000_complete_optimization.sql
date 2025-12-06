-- Migration complète d'optimisation
-- Corrige les problèmes identifiés et ajoute les fonctionnalités manquantes
BEGIN;

-- ============================================
-- 1. Créer la vue property_photos (alias vers photos)
-- ============================================
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

COMMENT ON VIEW property_photos IS 'Vue de compatibilité pour les photos de propriétés';

-- ============================================
-- 2. Corriger la RPC tenant_dashboard pour multi-baux
-- ============================================
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
  -- 1. Récupérer l'ID du profil à partir du user_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_tenant_user_id;

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Récupérer TOUS les baux actifs (multi-baux)
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

  -- 3. Pour rétro-compatibilité, garder le premier bail
  IF v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN
    v_lease := v_leases->0;
    v_property := v_lease->'property';
    
    -- Extraire les propriétés en array séparé
    SELECT jsonb_agg(lease->'property') INTO v_properties
    FROM jsonb_array_elements(v_leases) AS lease;
  END IF;

  -- 4. Récupérer les dernières factures (toutes propriétés)
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

  -- 5. Récupérer les tickets récents
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

  -- 6. Stats globales (tous baux)
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(montant_total), 0),
    'unpaid_count', COUNT(*),
    'total_monthly_rent', (
      SELECT COALESCE(SUM(l.loyer + COALESCE(l.charges_forfaitaires, 0)), 0)
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = v_profile_id
      AND l.statut = 'active'
    ),
    'active_leases_count', (
      SELECT COUNT(*)
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = v_profile_id
      AND l.statut = 'active'
    )
  ) INTO v_stats
  FROM invoices
  WHERE tenant_id = v_profile_id
  AND statut IN ('sent', 'late');

  -- Assembler le résultat avec support multi-baux
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

-- ============================================
-- 3. S'assurer que la colonne email existe dans profiles
-- ============================================
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

-- ============================================
-- 4. Créer la table signature_proofs si elle n'existe pas
-- ============================================
CREATE TABLE IF NOT EXISTS signature_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES profiles(id),
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

ALTER TABLE signature_proofs ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "System can insert signature proofs"
  ON signature_proofs FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_signature_proofs_lease ON signature_proofs(lease_id);
CREATE INDEX IF NOT EXISTS idx_signature_proofs_signer ON signature_proofs(signer_id);

-- ============================================
-- 5. Ajouter les colonnes manquantes à otp_codes
-- ============================================
-- Note: la table otp_codes peut avoir été créée avec des colonnes différentes dans une migration antérieure
DO $$
BEGIN
  -- Ajouter les colonnes si elles n'existent pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_codes' AND column_name = 'identifier') THEN
    ALTER TABLE otp_codes ADD COLUMN identifier TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_codes' AND column_name = 'code') THEN
    ALTER TABLE otp_codes ADD COLUMN code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_codes' AND column_name = 'type') THEN
    ALTER TABLE otp_codes ADD COLUMN type TEXT DEFAULT 'signature';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_codes' AND column_name = 'method') THEN
    ALTER TABLE otp_codes ADD COLUMN method TEXT DEFAULT 'sms';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_codes' AND column_name = 'used_at') THEN
    ALTER TABLE otp_codes ADD COLUMN used_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_codes' AND column_name = 'max_attempts') THEN
    ALTER TABLE otp_codes ADD COLUMN max_attempts INTEGER DEFAULT 3;
  END IF;
END$$;

-- Index conditionnel
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_codes' AND column_name = 'identifier') THEN
    CREATE INDEX IF NOT EXISTS idx_otp_codes_identifier ON otp_codes(identifier);
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);

-- Nettoyer les OTP expirés automatiquement (via CRON ou trigger)
CREATE OR REPLACE FUNCTION cleanup_expired_otp()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 hour';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_otp ON otp_codes;
CREATE TRIGGER trigger_cleanup_otp
  AFTER INSERT ON otp_codes
  EXECUTE FUNCTION cleanup_expired_otp();

-- ============================================
-- 6. Ajouter les colonnes manquantes à notifications
-- ============================================
-- Note: la table notifications peut avoir été créée avec des colonnes différentes (user_id vs profile_id)
DO $$
BEGIN
  -- Ajouter profile_id si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'profile_id') THEN
    ALTER TABLE notifications ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  -- Ajouter message si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'message') THEN
    ALTER TABLE notifications ADD COLUMN message TEXT;
  END IF;
  -- Ajouter data si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'data') THEN
    ALTER TABLE notifications ADD COLUMN data JSONB;
  END IF;
END$$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies basées sur user_id (qui existe toujours dans la table d'origine)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications(profile_id) WHERE profile_id IS NOT NULL;

-- ============================================
-- 7. Améliorer la table documents pour CNI
-- ============================================
DO $$
BEGIN
  -- Ajouter les colonnes manquantes à documents
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

-- ============================================
-- 8. Créer la fonction de vérification expiration CNI
-- ============================================
CREATE OR REPLACE FUNCTION check_cni_expiry_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_doc RECORD;
BEGIN
  -- Trouver les CNI qui expirent dans 30 jours
  FOR v_doc IN
    SELECT 
      d.id,
      d.tenant_id,
      d.expiry_date,
      p.email,
      p.prenom,
      p.nom
    FROM documents d
    JOIN profiles p ON p.id = d.tenant_id
    WHERE d.type IN ('cni_recto', 'cni_verso')
    AND d.is_archived = false
    AND d.expiry_date IS NOT NULL
    AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    AND d.expiry_date > CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.profile_id = d.tenant_id
      AND n.type = 'cni_expiry_warning'
      AND n.data->>'document_id' = d.id::text
      AND n.created_at > NOW() - INTERVAL '7 days'
    )
  LOOP
    -- Créer notification pour le locataire
    INSERT INTO notifications (profile_id, type, title, message, data)
    VALUES (
      v_doc.tenant_id,
      'cni_expiry_warning',
      'Votre pièce d''identité expire bientôt',
      'Votre CNI expire le ' || to_char(v_doc.expiry_date, 'DD/MM/YYYY') || '. Veuillez la renouveler.',
      jsonb_build_object('document_id', v_doc.id, 'expiry_date', v_doc.expiry_date)
    );
    
    -- Débloquer la modification
    UPDATE documents SET cni_modification_locked = false WHERE id = v_doc.id;
    
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================
-- 9. Créer les triggers pour mise à jour automatique
-- ============================================

-- Trigger pour updated_at sur les tables principales
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'properties', 'leases', 'documents', 'photos', 'rooms']
  LOOP
    BEGIN
      EXECUTE format('
        DROP TRIGGER IF EXISTS update_%s_updated_at ON %I;
        CREATE TRIGGER update_%s_updated_at
          BEFORE UPDATE ON %I
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      ', t, t, t, t);
    EXCEPTION WHEN undefined_table THEN
      -- Table n'existe pas, ignorer
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================
-- 10. Créer des index pour performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leases_statut ON leases(statut);
CREATE INDEX IF NOT EXISTS idx_leases_property_id ON leases(property_id);
CREATE INDEX IF NOT EXISTS idx_lease_signers_profile ON lease_signers(profile_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_statut ON invoices(statut);

COMMIT;

