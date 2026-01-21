-- ============================================================================
-- MIGRATION: Unified Signature System (SOTA 2026)
-- ============================================================================
--
-- Cette migration crée un système de signature unifié qui remplace progressivement:
-- - lease_signers (utilisé pour baux)
-- - signatures (eIDAS avancé)
-- - edl_signatures (états des lieux)
-- - signature_requests/signature_request_signers (demandes génériques)
--
-- Architecture:
-- 1. signature_sessions - Contexte et workflow de signature
-- 2. signature_participants - Signataires (flexibles: profile ou invitation)
-- 3. signature_proofs - Preuves cryptographiques eIDAS
-- 4. signature_audit_log - Journal d'audit immutable
--
-- IMPORTANT: Cette migration est NON-DESTRUCTIVE
-- Les anciennes tables restent fonctionnelles pendant la transition
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

-- Type de document signable
CREATE TYPE signature_document_type AS ENUM (
  'bail',
  'avenant',
  'edl_entree',
  'edl_sortie',
  'quittance',
  'caution',
  'devis',
  'facture',
  'note_service',
  'reglement_interieur',
  'autre'
);

-- Type d'entité liée
CREATE TYPE signature_entity_type AS ENUM (
  'lease',
  'edl',
  'quote',
  'invoice',
  'internal'
);

-- Statut de la session
CREATE TYPE signature_session_status AS ENUM (
  'draft',           -- Brouillon, pas encore envoyé
  'pending',         -- Prêt à être envoyé
  'ongoing',         -- En cours de signature
  'done',            -- Toutes signatures complètes
  'rejected',        -- Au moins un refus
  'expired',         -- Deadline dépassée
  'canceled'         -- Annulée manuellement
);

-- Statut du participant
CREATE TYPE signature_participant_status AS ENUM (
  'pending',         -- En attente de notification
  'notified',        -- Notifié (email envoyé)
  'opened',          -- A ouvert le document
  'signed',          -- A signé
  'refused',         -- A refusé
  'error'            -- Erreur technique
);

-- Rôle du signataire
CREATE TYPE signature_role AS ENUM (
  'proprietaire',
  'locataire_principal',
  'colocataire',
  'garant',
  'representant_legal',
  'temoin',
  'autre'
);

-- Niveau eIDAS
CREATE TYPE signature_level AS ENUM (
  'SES',  -- Simple Electronic Signature
  'AES',  -- Advanced Electronic Signature
  'QES'   -- Qualified Electronic Signature
);

-- Actions d'audit
CREATE TYPE signature_audit_action AS ENUM (
  'session_created',
  'session_sent',
  'session_completed',
  'session_rejected',
  'session_expired',
  'session_canceled',
  'participant_added',
  'participant_notified',
  'participant_opened',
  'participant_signed',
  'participant_refused',
  'proof_generated',
  'proof_verified'
);

-- ============================================================================
-- 2. TABLE: signature_sessions
-- ============================================================================

CREATE TABLE signature_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- CONTEXTE
  document_type signature_document_type NOT NULL,
  entity_type signature_entity_type NOT NULL,
  entity_id UUID NOT NULL,  -- ID du bail, EDL, devis, etc.

  -- DOCUMENTS
  source_document_id UUID,  -- Document à signer (dans documents table)
  signed_document_id UUID,  -- Document signé final
  proof_document_id UUID,   -- PDF de preuve consolidé

  -- METADATA
  name TEXT NOT NULL,
  description TEXT,

  -- WORKFLOW
  status signature_session_status NOT NULL DEFAULT 'draft',
  signature_level signature_level NOT NULL DEFAULT 'SES',
  is_ordered_signatures BOOLEAN DEFAULT false,  -- Signatures dans l'ordre
  otp_required BOOLEAN DEFAULT false,           -- OTP obligatoire

  -- OWNERSHIP
  created_by UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),

  -- DATES
  deadline TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche par entité
CREATE INDEX idx_signature_sessions_entity
ON signature_sessions(entity_type, entity_id);

-- Index pour recherche par statut et propriétaire
CREATE INDEX idx_signature_sessions_status_owner
ON signature_sessions(status, owner_id);

-- Index pour sessions actives
CREATE INDEX idx_signature_sessions_active
ON signature_sessions(status)
WHERE status IN ('pending', 'ongoing');

-- Commentaires
COMMENT ON TABLE signature_sessions IS 'Sessions de signature unifiées (SOTA 2026)';
COMMENT ON COLUMN signature_sessions.entity_id IS 'UUID de l''entité liée (lease.id, edl.id, etc.)';
COMMENT ON COLUMN signature_sessions.signature_level IS 'Niveau eIDAS: SES (simple), AES (avancé), QES (qualifié)';

-- ============================================================================
-- 3. TABLE: signature_participants
-- ============================================================================

CREATE TABLE signature_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- LIEN SESSION
  session_id UUID NOT NULL REFERENCES signature_sessions(id) ON DELETE CASCADE,

  -- IDENTITÉ (flexible: profil existant OU invitation)
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,

  -- RÔLE ET ORDRE
  role signature_role NOT NULL,
  signing_order INT,  -- NULL = pas d'ordre, sinon 1,2,3...

  -- STATUT
  status signature_participant_status NOT NULL DEFAULT 'pending',

  -- SIGNATURE
  signature_image_path TEXT,        -- Chemin storage (pas de base64!)
  signature_timestamp TIMESTAMPTZ,
  signature_ip INET,
  signature_user_agent TEXT,

  -- OTP (si requis)
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_verified BOOLEAN DEFAULT false,

  -- REFUS
  refused_reason TEXT,
  refused_at TIMESTAMPTZ,

  -- INVITATION
  invitation_token TEXT UNIQUE,
  invitation_token_expires_at TIMESTAMPTZ,
  invitation_sent_at TIMESTAMPTZ,

  -- TRACKING
  notified_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,

  -- DATES
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index unique partiel pour profiles
CREATE UNIQUE INDEX idx_signature_participants_session_profile
ON signature_participants(session_id, profile_id)
WHERE profile_id IS NOT NULL;

-- Index unique partiel pour emails (invitations)
CREATE UNIQUE INDEX idx_signature_participants_session_email
ON signature_participants(session_id, email)
WHERE profile_id IS NULL;

-- Index pour recherche par token
CREATE INDEX idx_signature_participants_token
ON signature_participants(invitation_token)
WHERE invitation_token IS NOT NULL;

-- Index pour recherche par email
CREATE INDEX idx_signature_participants_email
ON signature_participants(email);

-- Index pour statut
CREATE INDEX idx_signature_participants_status
ON signature_participants(status);

-- Index pour ordre de signature
CREATE INDEX idx_signature_participants_order
ON signature_participants(session_id, signing_order)
WHERE signing_order IS NOT NULL;

-- Commentaires
COMMENT ON TABLE signature_participants IS 'Participants aux sessions de signature';
COMMENT ON COLUMN signature_participants.profile_id IS 'NULL si invitation email (pas encore inscrit)';
COMMENT ON COLUMN signature_participants.signature_image_path IS 'Chemin Supabase Storage - jamais de base64!';

-- ============================================================================
-- 4. TABLE: signature_proofs
-- ============================================================================

CREATE TABLE signature_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- LIENS
  participant_id UUID NOT NULL REFERENCES signature_participants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES signature_sessions(id) ON DELETE CASCADE,

  -- IDENTIFIANT UNIQUE DE PREUVE
  proof_id TEXT UNIQUE NOT NULL,  -- Format: SIG-[timestamp]-[random]

  -- HASHES CRYPTOGRAPHIQUES (SHA-256)
  document_hash TEXT NOT NULL,    -- Hash du document signé
  signature_hash TEXT NOT NULL,   -- Hash de l'image de signature
  proof_hash TEXT NOT NULL,       -- Hash de toute la preuve

  -- MÉTADONNÉES COMPLÈTES (conforme eIDAS)
  metadata JSONB NOT NULL,
  /*
    Structure metadata:
    {
      "signer": {
        "name": "Jean Dupont",
        "email": "jean@example.com",
        "profileId": "uuid",
        "identityVerified": true,
        "identityMethod": "cni_scan"
      },
      "document": {
        "type": "bail",
        "id": "uuid",
        "name": "Bail appartement 123",
        "hash": "sha256..."
      },
      "signature": {
        "type": "draw" | "text",
        "imageData": "sha256...",
        "timestamp": "2026-01-21T10:00:00Z"
      },
      "technical": {
        "ipAddress": "1.2.3.4",
        "userAgent": "...",
        "screenSize": "1920x1080",
        "touchDevice": false,
        "geolocation": { "lat": 48.8, "lng": 2.3 }
      },
      "integrity": {
        "algorithm": "SHA-256",
        "proofHash": "sha256..."
      }
    }
  */

  -- VÉRIFICATION
  verified_at TIMESTAMPTZ,
  verification_errors TEXT[],  -- Erreurs si échec

  -- DATES
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche par proof_id
CREATE INDEX idx_signature_proofs_proof_id
ON signature_proofs(proof_id);

-- Index pour recherche par session
CREATE INDEX idx_signature_proofs_session
ON signature_proofs(session_id);

-- Index pour recherche par participant
CREATE INDEX idx_signature_proofs_participant
ON signature_proofs(participant_id);

-- Commentaires
COMMENT ON TABLE signature_proofs IS 'Preuves cryptographiques de signature (eIDAS)';
COMMENT ON COLUMN signature_proofs.proof_id IS 'Format: SIG-YYYYMMDD-HHMMSS-RANDOM';
COMMENT ON COLUMN signature_proofs.metadata IS 'Métadonnées complètes conformes eIDAS';

-- ============================================================================
-- 5. TABLE: signature_audit_log (IMMUTABLE)
-- ============================================================================

CREATE TABLE signature_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- RÉFÉRENCES
  session_id UUID NOT NULL REFERENCES signature_sessions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES signature_participants(id) ON DELETE SET NULL,

  -- ACTION
  action signature_audit_action NOT NULL,

  -- CONTEXTE
  actor_id UUID REFERENCES profiles(id),  -- Qui a effectué l'action
  ip_address INET,
  user_agent TEXT,

  -- DONNÉES SUPPLÉMENTAIRES
  metadata JSONB,

  -- TIMESTAMP (immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche par session
CREATE INDEX idx_signature_audit_session
ON signature_audit_log(session_id);

-- Index pour recherche par action
CREATE INDEX idx_signature_audit_action
ON signature_audit_log(action);

-- Index pour recherche temporelle
CREATE INDEX idx_signature_audit_created
ON signature_audit_log(created_at);

-- RÈGLES D'IMMUTABILITÉ
CREATE RULE signature_audit_log_no_update
AS ON UPDATE TO signature_audit_log DO INSTEAD NOTHING;

CREATE RULE signature_audit_log_no_delete
AS ON DELETE TO signature_audit_log DO INSTEAD NOTHING;

-- Commentaires
COMMENT ON TABLE signature_audit_log IS 'Journal d''audit immutable des signatures';

-- ============================================================================
-- 6. TRIGGERS: Auto-update et workflow
-- ============================================================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_signature_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur signature_sessions
CREATE TRIGGER tr_signature_sessions_updated
BEFORE UPDATE ON signature_sessions
FOR EACH ROW
EXECUTE FUNCTION update_signature_timestamp();

-- Trigger sur signature_participants
CREATE TRIGGER tr_signature_participants_updated
BEFORE UPDATE ON signature_participants
FOR EACH ROW
EXECUTE FUNCTION update_signature_timestamp();

-- ============================================================================
-- 7. FONCTION: Vérifier si session complète
-- ============================================================================

CREATE OR REPLACE FUNCTION check_signature_session_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id UUID;
  v_total_participants INT;
  v_signed_participants INT;
  v_refused_participants INT;
BEGIN
  -- Récupérer session_id
  v_session_id := NEW.session_id;

  -- Compter les participants
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'signed'),
    COUNT(*) FILTER (WHERE status = 'refused')
  INTO v_total_participants, v_signed_participants, v_refused_participants
  FROM signature_participants
  WHERE session_id = v_session_id;

  -- Mettre à jour le statut de la session
  IF v_refused_participants > 0 THEN
    -- Au moins un refus
    UPDATE signature_sessions
    SET status = 'rejected', updated_at = NOW()
    WHERE id = v_session_id AND status NOT IN ('rejected', 'canceled');

  ELSIF v_signed_participants = v_total_participants THEN
    -- Tous ont signé
    UPDATE signature_sessions
    SET status = 'done', completed_at = NOW(), updated_at = NOW()
    WHERE id = v_session_id AND status = 'ongoing';

  ELSIF v_signed_participants > 0 THEN
    -- Au moins un a signé (mais pas tous)
    UPDATE signature_sessions
    SET status = 'ongoing', updated_at = NOW()
    WHERE id = v_session_id AND status IN ('pending', 'draft');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour vérifier completion
CREATE TRIGGER tr_check_signature_session_completion
AFTER UPDATE OF status ON signature_participants
FOR EACH ROW
WHEN (NEW.status IN ('signed', 'refused'))
EXECUTE FUNCTION check_signature_session_completion();

-- ============================================================================
-- 8. FONCTION: Synchroniser avec entités liées (lease, edl)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_signature_session_to_entity()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand une session est complète (done)
  IF NEW.status = 'done' AND OLD.status != 'done' THEN

    -- Synchroniser avec bail
    IF NEW.entity_type = 'lease' THEN
      UPDATE leases
      SET
        statut = CASE
          WHEN NEW.document_type = 'bail' THEN 'fully_signed'
          ELSE statut
        END,
        signature_completed_at = NOW(),
        updated_at = NOW()
      WHERE id = NEW.entity_id;

    -- Synchroniser avec EDL
    ELSIF NEW.entity_type = 'edl' THEN
      UPDATE edl
      SET
        status = 'signed',
        updated_at = NOW()
      WHERE id = NEW.entity_id;

      -- Si EDL d'entrée signé, activer le bail
      UPDATE leases l
      SET statut = 'active', updated_at = NOW()
      FROM edl e
      WHERE e.id = NEW.entity_id
        AND e.lease_id = l.id
        AND e.type = 'entree'
        AND l.statut = 'fully_signed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour synchronisation
CREATE TRIGGER tr_sync_signature_to_entity
AFTER UPDATE OF status ON signature_sessions
FOR EACH ROW
EXECUTE FUNCTION sync_signature_session_to_entity();

-- ============================================================================
-- 9. FONCTION: Générer token d'invitation
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_signature_invitation_token()
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Générer un token unique de 32 caractères
  v_token := encode(gen_random_bytes(24), 'base64');
  -- Remplacer caractères problématiques pour URL
  v_token := replace(replace(v_token, '+', '-'), '/', '_');
  RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. RLS POLICIES
-- ============================================================================

-- Activer RLS
ALTER TABLE signature_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role a accès total
CREATE POLICY "service_all_signature_sessions" ON signature_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_signature_participants" ON signature_participants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_signature_proofs" ON signature_proofs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_signature_audit_log" ON signature_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Propriétaires voient leurs sessions
CREATE POLICY "owner_select_signature_sessions" ON signature_sessions
  FOR SELECT TO authenticated
  USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Participants voient leurs sessions
CREATE POLICY "participant_select_signature_sessions" ON signature_sessions
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT session_id FROM signature_participants
    WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ));

-- Participants voient leurs propres données
CREATE POLICY "participant_select_own" ON signature_participants
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Participants peuvent mettre à jour leur signature
CREATE POLICY "participant_update_own" ON signature_participants
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Preuves visibles par participants de la session
CREATE POLICY "participant_select_proofs" ON signature_proofs
  FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT session_id FROM signature_participants
    WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ));

-- Audit visible par propriétaire
CREATE POLICY "owner_select_audit" ON signature_audit_log
  FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT id FROM signature_sessions
    WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ));

-- ============================================================================
-- 11. VUES UTILITAIRES
-- ============================================================================

-- Vue des sessions avec compteurs
CREATE OR REPLACE VIEW v_signature_sessions_summary AS
SELECT
  s.*,
  COUNT(p.id) AS total_participants,
  COUNT(p.id) FILTER (WHERE p.status = 'signed') AS signed_count,
  COUNT(p.id) FILTER (WHERE p.status = 'refused') AS refused_count,
  COUNT(p.id) FILTER (WHERE p.status = 'pending') AS pending_count
FROM signature_sessions s
LEFT JOIN signature_participants p ON p.session_id = s.id
GROUP BY s.id;

-- Vue des signatures en attente par utilisateur
CREATE OR REPLACE VIEW v_pending_signatures AS
SELECT
  p.*,
  s.name AS session_name,
  s.document_type,
  s.entity_type,
  s.entity_id,
  s.deadline,
  s.signature_level
FROM signature_participants p
JOIN signature_sessions s ON s.id = p.session_id
WHERE p.status IN ('pending', 'notified', 'opened')
  AND s.status IN ('pending', 'ongoing');

COMMENT ON VIEW v_signature_sessions_summary IS 'Sessions avec compteurs de participants';
COMMENT ON VIEW v_pending_signatures IS 'Signatures en attente par utilisateur';

-- ============================================================================
-- 12. DEPRECATION: Colonnes obsolètes
-- ============================================================================

-- Marquer colonnes Yousign comme obsolètes (ne pas supprimer pour compatibilité)
COMMENT ON COLUMN leases.yousign_signature_request_id IS
  'DEPRECATED (SOTA 2026): Utiliser signature_sessions.id à la place';
COMMENT ON COLUMN leases.yousign_document_id IS
  'DEPRECATED (SOTA 2026): Utiliser signature_sessions.source_document_id';
COMMENT ON COLUMN leases.signature_started_at IS
  'DEPRECATED (SOTA 2026): Utiliser signature_sessions.sent_at';
COMMENT ON COLUMN leases.signature_completed_at IS
  'DEPRECATED (SOTA 2026): Utiliser signature_sessions.completed_at';

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- PROCHAINES ÉTAPES (à faire dans migrations séparées):
--
-- 1. Migration des données existantes:
--    - lease_signers → signature_sessions + signature_participants
--    - signatures → signature_proofs
--    - edl_signatures → signature_sessions + signature_participants
--    - signature_requests → signature_sessions
--
-- 2. Mise à jour du code application:
--    - Services: lib/signatures/service.ts
--    - Routes API: app/api/signature/**
--    - Types: lib/supabase/database.types.ts
--
-- 3. Tests de régression:
--    - Flux signature bail
--    - Flux signature EDL
--    - Activation automatique bail après EDL
--
-- 4. Suppression anciennes tables (après période de transition):
--    - DROP TABLE signatures CASCADE;
--    - DROP TABLE signature_requests CASCADE;
--    - DROP TABLE signature_request_signers CASCADE;
--    - ALTER TABLE leases DROP COLUMN yousign_*;
-- ============================================================================
