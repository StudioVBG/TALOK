-- =====================================================
-- SCRIPT CONSOLIDÉ — 15 MIGRATIONS EN ATTENTE
-- Date de génération: 2026-03-06
-- 
-- INSTRUCTIONS:
-- 1. Ouvrir Supabase Dashboard → SQL Editor
-- 2. Créer un "New Query"
-- 3. Coller CE FICHIER ENTIER
-- 4. Cliquer "Run"
-- 5. Vérifier les NOTICES dans l'onglet "Messages" en bas
--
-- CONTENU (15 migrations, du 29/02 au 06/03):
--
-- 1.  20260229100000_identity_2fa_requests.sql
-- 2.  20260230100000_create_notification_resolve_profile_id.sql
-- 3.  20260301000000_create_key_handovers.sql
-- 4.  20260301100000_entity_audit_and_propagation.sql
-- 5.  20260303000000_backfill_uploaded_by.sql
-- 6.  20260303100000_entity_rls_fix_and_optimize.sql
-- 7.  20260304000000_fix_invoice_generation_jour_paiement.sql
-- 8.  20260304000001_sync_sepa_collection_day.sql
-- 9.  20260304100000_activate_pg_cron_schedules.sql
-- 10. 20260304200000_auto_mark_late_invoices.sql
-- 11. 20260305000001_invoice_engine_fields.sql
-- 12. 20260305000002_payment_crons.sql
-- 13. 20260305100000_fix_invoice_draft_notification.sql
-- 14. 20260305100001_add_missing_notification_triggers.sql
-- 15. 20260306000000_lease_documents_visible_tenant.sql
-- =====================================================


-- ======================================================
-- [1/15] SOURCE: 20260229100000_identity_2fa_requests.sql
-- ======================================================

-- Migration: Table pour les demandes 2FA (SMS + email) lors des changements d'identité
-- SOTA 2026 - Vérification à deux facteurs pour renouvellement / mise à jour CNI

CREATE TABLE IF NOT EXISTS identity_2fa_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('renew', 'initial', 'update')),
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  otp_hash TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_token ON identity_2fa_requests(token);
CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_profile_id ON identity_2fa_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_expires_at ON identity_2fa_requests(expires_at) WHERE verified_at IS NULL;

ALTER TABLE identity_2fa_requests ENABLE ROW LEVEL SECURITY;

-- Le locataire ne peut voir que ses propres demandes
DROP POLICY IF EXISTS "identity_2fa_requests_tenant_own" ON identity_2fa_requests;
CREATE POLICY "identity_2fa_requests_tenant_own"
  ON identity_2fa_requests FOR ALL TO authenticated
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

COMMENT ON TABLE identity_2fa_requests IS 'Demandes 2FA (OTP SMS + lien email) pour changement d''identité CNI';


-- ======================================================
-- [2/15] SOURCE: 20260230100000_create_notification_resolve_profile_id.sql
-- ======================================================

-- =====================================================
-- MIGRATION: create_notification — résolution profile_id → user_id
-- Date: 2026-02-30
--
-- OBJECTIF:
--   p_recipient_id peut être un profile_id (ex: triggers tenant) ou un user_id
--   (ex: triggers owner). Si c'est un profile_id, on résout user_id et on
--   insère les deux pour que la RLS (user_id = auth.uid()) et les vues
--   par profile_id fonctionnent.
-- =====================================================

DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_user_id UUID;
  v_is_profile BOOLEAN := false;
BEGIN
  -- Si p_recipient_id correspond à un profil, récupérer le user_id
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE id = p_recipient_id
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    v_is_profile := true;
  ELSE
    -- Rétrocompat : considérer p_recipient_id comme user_id
    v_user_id := p_recipient_id;
  END IF;

  -- Insérer avec user_id (obligatoire pour RLS) et optionnellement profile_id
  IF v_is_profile THEN
    INSERT INTO notifications (
      user_id,
      profile_id,
      type,
      title,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_recipient_id,
      p_type,
      p_title,
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  ELSE
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_type,
      p_title,
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN v_notification_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_notification] Erreur: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) IS
'Crée une notification. p_recipient_id peut être un profile_id (résolution user_id) ou un user_id (rétrocompat).';


-- ======================================================
-- [3/15] SOURCE: 20260301000000_create_key_handovers.sql
-- ======================================================

-- Migration: Create key_handovers table for digital key handover with QR code proof
-- This table records the formal handover of keys from owner to tenant,
-- with cryptographic proof, geolocation, and signature.

CREATE TABLE IF NOT EXISTS key_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,

  -- Participants
  owner_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- QR token
  token text NOT NULL,
  expires_at timestamptz NOT NULL,

  -- Keys handed over (JSON array from EDL)
  keys_list jsonb DEFAULT '[]'::jsonb,

  -- Tenant confirmation
  confirmed_at timestamptz,
  tenant_signature_path text,
  tenant_ip text,
  tenant_user_agent text,
  geolocation jsonb,

  -- Proof
  proof_id text,
  proof_metadata jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_key_handovers_lease_id ON key_handovers(lease_id);
CREATE INDEX IF NOT EXISTS idx_key_handovers_token ON key_handovers(token);
CREATE INDEX IF NOT EXISTS idx_key_handovers_confirmed ON key_handovers(lease_id) WHERE confirmed_at IS NOT NULL;

-- RLS
ALTER TABLE key_handovers ENABLE ROW LEVEL SECURITY;

-- Owner can see and create handovers for their leases
CREATE POLICY "owner_key_handovers" ON key_handovers
  FOR ALL
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Tenant can see and confirm handovers for their leases
CREATE POLICY "tenant_key_handovers" ON key_handovers
  FOR ALL
  USING (
    tenant_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR
    lease_id IN (
      SELECT lease_id FROM lease_signers
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Updated at trigger
CREATE OR REPLACE TRIGGER set_key_handovers_updated_at
  BEFORE UPDATE ON key_handovers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE key_handovers IS 'Remise des clés digitale avec preuve QR code, signature et géolocalisation';


-- ======================================================
-- [4/15] SOURCE: 20260301100000_entity_audit_and_propagation.sql
-- ======================================================

-- ============================================================================
-- Migration: Entity Audit Trail, Propagation, Contraintes SIRET, Guards
-- Date: 2026-03-01
-- Description:
--   1. Table entity_audit_log (historique des modifications)
--   2. Trigger propagation: UPDATE legal_entities → leases/invoices dénormalisés
--   3. Contrainte UNIQUE sur SIRET (actif uniquement)
--   4. Vérification bail actif avant transfert de bien (RPC)
-- Idempotent: peut être exécutée plusieurs fois sans effet secondaire.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLE: entity_audit_log (historique des modifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'deactivate', 'reactivate')),
  changed_fields JSONB,           -- {"nom": {"old": "SCI A", "new": "SCI B"}}
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_audit_log_entity ON entity_audit_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_audit_log_action ON entity_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_entity_audit_log_date ON entity_audit_log(created_at);

-- RLS pour entity_audit_log
ALTER TABLE entity_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs of their entities"
  ON entity_audit_log FOR SELECT
  USING (
    entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert audit logs for their entities"
  ON entity_audit_log FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Admins can do everything on entity_audit_log"
  ON entity_audit_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 2. TRIGGER: Propager les modifications d'entité aux tables dénormalisées
-- ============================================================================
-- Quand nom/adresse/siret changent sur legal_entities,
-- mettre à jour les champs dénormalisés sur leases et invoices.

CREATE OR REPLACE FUNCTION propagate_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
  full_address TEXT;
BEGIN
  -- Construire l'adresse complète
  full_address := COALESCE(NEW.adresse_siege, '');
  IF NEW.code_postal_siege IS NOT NULL OR NEW.ville_siege IS NOT NULL THEN
    full_address := full_address || ', ' || COALESCE(NEW.code_postal_siege, '') || ' ' || COALESCE(NEW.ville_siege, '');
  END IF;

  -- Propager vers leases si nom, adresse ou siret a changé
  IF (OLD.nom IS DISTINCT FROM NEW.nom)
     OR (OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege)
     OR (OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege)
     OR (OLD.ville_siege IS DISTINCT FROM NEW.ville_siege)
     OR (OLD.siret IS DISTINCT FROM NEW.siret) THEN

    UPDATE leases SET
      bailleur_nom = CASE WHEN OLD.nom IS DISTINCT FROM NEW.nom THEN NEW.nom ELSE bailleur_nom END,
      bailleur_adresse = CASE
        WHEN (OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege)
             OR (OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege)
             OR (OLD.ville_siege IS DISTINCT FROM NEW.ville_siege)
        THEN full_address
        ELSE bailleur_adresse
      END,
      bailleur_siret = CASE WHEN OLD.siret IS DISTINCT FROM NEW.siret THEN NEW.siret ELSE bailleur_siret END
    WHERE signatory_entity_id = NEW.id;

    -- Propager vers invoices
    UPDATE invoices SET
      issuer_nom = CASE WHEN OLD.nom IS DISTINCT FROM NEW.nom THEN NEW.nom ELSE issuer_nom END,
      issuer_adresse = CASE
        WHEN (OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege)
             OR (OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege)
             OR (OLD.ville_siege IS DISTINCT FROM NEW.ville_siege)
        THEN full_address
        ELSE issuer_adresse
      END,
      issuer_siret = CASE WHEN OLD.siret IS DISTINCT FROM NEW.siret THEN NEW.siret ELSE issuer_siret END,
      issuer_tva = CASE WHEN OLD.numero_tva IS DISTINCT FROM NEW.numero_tva THEN NEW.numero_tva ELSE issuer_tva END
    WHERE issuer_entity_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_propagate_entity_changes ON legal_entities;
CREATE TRIGGER trg_propagate_entity_changes
  AFTER UPDATE ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION propagate_entity_changes();

-- ============================================================================
-- 3. TRIGGER: Audit trail automatique sur modifications d'entité
-- ============================================================================

CREATE OR REPLACE FUNCTION log_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes JSONB := '{}';
  action_type TEXT;
  user_profile_id UUID;
BEGIN
  -- Déterminer l'ID du profil qui fait la modification
  SELECT id INTO user_profile_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    action_type := 'create';
    changes := jsonb_build_object(
      'entity_type', NEW.entity_type,
      'nom', NEW.nom,
      'regime_fiscal', NEW.regime_fiscal
    );

    INSERT INTO entity_audit_log (entity_id, action, changed_fields, changed_by)
    VALUES (NEW.id, action_type, changes, user_profile_id);

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Détecter les champs modifiés
    IF OLD.nom IS DISTINCT FROM NEW.nom THEN
      changes := changes || jsonb_build_object('nom', jsonb_build_object('old', OLD.nom, 'new', NEW.nom));
    END IF;
    IF OLD.entity_type IS DISTINCT FROM NEW.entity_type THEN
      changes := changes || jsonb_build_object('entity_type', jsonb_build_object('old', OLD.entity_type, 'new', NEW.entity_type));
    END IF;
    IF OLD.forme_juridique IS DISTINCT FROM NEW.forme_juridique THEN
      changes := changes || jsonb_build_object('forme_juridique', jsonb_build_object('old', OLD.forme_juridique, 'new', NEW.forme_juridique));
    END IF;
    IF OLD.regime_fiscal IS DISTINCT FROM NEW.regime_fiscal THEN
      changes := changes || jsonb_build_object('regime_fiscal', jsonb_build_object('old', OLD.regime_fiscal, 'new', NEW.regime_fiscal));
    END IF;
    IF OLD.siret IS DISTINCT FROM NEW.siret THEN
      changes := changes || jsonb_build_object('siret', jsonb_build_object('old', OLD.siret, 'new', NEW.siret));
    END IF;
    IF OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege THEN
      changes := changes || jsonb_build_object('adresse_siege', jsonb_build_object('old', OLD.adresse_siege, 'new', NEW.adresse_siege));
    END IF;
    IF OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege THEN
      changes := changes || jsonb_build_object('code_postal_siege', jsonb_build_object('old', OLD.code_postal_siege, 'new', NEW.code_postal_siege));
    END IF;
    IF OLD.ville_siege IS DISTINCT FROM NEW.ville_siege THEN
      changes := changes || jsonb_build_object('ville_siege', jsonb_build_object('old', OLD.ville_siege, 'new', NEW.ville_siege));
    END IF;
    IF OLD.capital_social IS DISTINCT FROM NEW.capital_social THEN
      changes := changes || jsonb_build_object('capital_social', jsonb_build_object('old', OLD.capital_social, 'new', NEW.capital_social));
    END IF;
    IF OLD.iban IS DISTINCT FROM NEW.iban THEN
      changes := changes || jsonb_build_object('iban', jsonb_build_object('old', 'MASKED', 'new', 'MASKED'));
    END IF;
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      action_type := CASE WHEN NEW.is_active THEN 'reactivate' ELSE 'deactivate' END;
      changes := changes || jsonb_build_object('is_active', jsonb_build_object('old', OLD.is_active, 'new', NEW.is_active));
    ELSE
      action_type := 'update';
    END IF;

    -- Ne loguer que s'il y a des changements
    IF changes != '{}' THEN
      INSERT INTO entity_audit_log (entity_id, action, changed_fields, changed_by)
      VALUES (NEW.id, action_type, changes, user_profile_id);
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    action_type := 'delete';
    changes := jsonb_build_object('nom', OLD.nom, 'entity_type', OLD.entity_type);

    INSERT INTO entity_audit_log (entity_id, action, changed_fields, changed_by)
    VALUES (OLD.id, action_type, changes, user_profile_id);

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_entity_changes ON legal_entities;
CREATE TRIGGER trg_log_entity_changes
  AFTER INSERT OR UPDATE OR DELETE ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION log_entity_changes();

-- ============================================================================
-- 4. CONTRAINTE UNIQUE sur SIRET (actif uniquement)
-- ============================================================================
-- Un même SIRET ne peut être utilisé que par une seule entité active

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_entities_siret_unique
  ON legal_entities (siret)
  WHERE siret IS NOT NULL AND is_active = true;

-- ============================================================================
-- 5. RPC: Vérifier si un transfert de bien est possible (bail actif ?)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_property_transfer_feasibility(
  p_property_id UUID,
  p_from_entity_id UUID,
  p_to_entity_id UUID
) RETURNS TABLE (
  can_transfer BOOLEAN,
  blocking_reason TEXT,
  active_lease_count BIGINT,
  pending_signature_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH lease_checks AS (
    SELECT
      COUNT(*) FILTER (WHERE l.statut = 'active') AS active_count,
      COUNT(*) FILTER (WHERE l.statut IN ('pending_signature', 'fully_signed')) AS pending_count
    FROM leases l
    WHERE l.property_id = p_property_id
      AND l.signatory_entity_id = p_from_entity_id
  )
  SELECT
    (lc.active_count = 0 AND lc.pending_count = 0) AS can_transfer,
    CASE
      WHEN lc.pending_count > 0 THEN
        'Transfert impossible : ' || lc.pending_count || ' bail(aux) en cours de signature. Finalisez ou annulez les signatures avant de transférer.'
      WHEN lc.active_count > 0 THEN
        'Transfert avec bail(aux) actif(s) : ' || lc.active_count || ' bail(aux) devront être mis à jour avec la nouvelle entité signataire.'
      ELSE NULL
    END AS blocking_reason,
    lc.active_count AS active_lease_count,
    lc.pending_count AS pending_signature_count
  FROM lease_checks lc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 6. Backfill bailleur_nom/adresse/siret sur les baux existants qui en manquent
-- ============================================================================

UPDATE leases l
SET
  bailleur_nom = COALESCE(l.bailleur_nom, le.nom),
  bailleur_adresse = COALESCE(l.bailleur_adresse,
    COALESCE(le.adresse_siege, '') ||
    CASE WHEN le.code_postal_siege IS NOT NULL OR le.ville_siege IS NOT NULL
      THEN ', ' || COALESCE(le.code_postal_siege, '') || ' ' || COALESCE(le.ville_siege, '')
      ELSE ''
    END
  ),
  bailleur_siret = COALESCE(l.bailleur_siret, le.siret)
FROM legal_entities le
WHERE l.signatory_entity_id = le.id
  AND (l.bailleur_nom IS NULL OR l.bailleur_adresse IS NULL OR l.bailleur_siret IS NULL);

-- Même chose pour invoices
UPDATE invoices i
SET
  issuer_nom = COALESCE(i.issuer_nom, le.nom),
  issuer_adresse = COALESCE(i.issuer_adresse,
    COALESCE(le.adresse_siege, '') ||
    CASE WHEN le.code_postal_siege IS NOT NULL OR le.ville_siege IS NOT NULL
      THEN ', ' || COALESCE(le.code_postal_siege, '') || ' ' || COALESCE(le.ville_siege, '')
      ELSE ''
    END
  ),
  issuer_siret = COALESCE(i.issuer_siret, le.siret),
  issuer_tva = COALESCE(i.issuer_tva, le.numero_tva)
FROM legal_entities le
WHERE i.issuer_entity_id = le.id
  AND (i.issuer_nom IS NULL OR i.issuer_adresse IS NULL OR i.issuer_siret IS NULL);

COMMIT;


-- ======================================================
-- [5/15] SOURCE: 20260303000000_backfill_uploaded_by.sql
-- ======================================================

-- =====================================================
-- MIGRATION: Backfill uploaded_by pour documents existants
-- Date: 2026-03-03
--
-- PROBLÈME:
--   - /api/documents/upload ne renseignait pas uploaded_by
--   - /api/documents/upload-batch ne le faisait que pour les galeries
--   => Les documents existants n'ont pas uploaded_by, ce qui empêche
--      la détection de source inter-compte (locataire vs propriétaire).
--
-- FIX:
--   Backfill uploaded_by en se basant sur le type de document et les FK.
--   Heuristique :
--     1. Types locataire (assurance, CNI, etc.) → uploaded_by = tenant_id
--     2. Types propriétaire (bail, quittance, etc.) → uploaded_by = owner_id
--     3. Documents avec owner_id seul (sans tenant) → uploaded_by = owner_id
--
-- SÉCURITÉ:
--   - UPDATE conditionnel (WHERE uploaded_by IS NULL)
--   - Ne touche pas aux documents déjà renseignés
--   - Non-bloquant : si aucune ligne à MAJ, pas d'effet
-- =====================================================

BEGIN;

-- 1. Documents typiquement uploadés par le locataire
UPDATE public.documents
SET uploaded_by = tenant_id
WHERE uploaded_by IS NULL
  AND tenant_id IS NOT NULL
  AND type IN (
    'attestation_assurance', 'cni_recto', 'cni_verso', 'piece_identite',
    'passeport', 'justificatif_revenus', 'avis_imposition', 'bulletin_paie',
    'rib', 'titre_sejour', 'cni', 'justificatif_domicile'
  );

-- 2. Documents typiquement générés/uploadés par le propriétaire
UPDATE public.documents
SET uploaded_by = owner_id
WHERE uploaded_by IS NULL
  AND owner_id IS NOT NULL
  AND type IN (
    'bail', 'quittance', 'avenant', 'appel_loyer', 'releve_charges',
    'dpe', 'erp', 'crep', 'amiante', 'electricite', 'gaz',
    'diagnostic', 'diagnostic_gaz', 'diagnostic_electricite',
    'diagnostic_plomb', 'diagnostic_amiante', 'diagnostic_termites',
    'diagnostic_performance', 'reglement_copro', 'notice_information',
    'EDL_entree', 'EDL_sortie', 'edl', 'edl_entree', 'edl_sortie',
    'assurance_pno', 'facture', 'contrat', 'engagement_garant'
  );

-- 3. Restant : documents owner sans tenant → attribuer au propriétaire
UPDATE public.documents
SET uploaded_by = owner_id
WHERE uploaded_by IS NULL
  AND owner_id IS NOT NULL
  AND tenant_id IS NULL;

-- 4. Restant : documents avec tenant et owner mais type inconnu → attribuer au tenant
--    (hypothèse : si un tenant est lié, c'est probablement lui qui a uploadé)
UPDATE public.documents
SET uploaded_by = tenant_id
WHERE uploaded_by IS NULL
  AND tenant_id IS NOT NULL
  AND owner_id IS NOT NULL;

COMMIT;


-- ======================================================
-- [6/15] SOURCE: 20260303100000_entity_rls_fix_and_optimize.sql
-- ======================================================

-- ============================================================================
-- Migration: Fix RLS policies for entity system
-- Date: 2026-03-03
-- Description:
--   1. Supprime la policy SELECT redondante sur entity_associates
--      (la policy FOR ALL couvre déjà SELECT)
--   2. Crée une fonction helper get_current_owner_profile_id()
--      pour optimiser les sous-requêtes RLS (3 niveaux → 1 appel)
--   3. Remplace les policies legal_entities par des versions optimisées
--   4. Remplace les policies entity_associates par une version optimisée
--   5. Remplace les policies property_ownership par des versions optimisées
-- Idempotent: peut être exécutée plusieurs fois sans effet secondaire.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Fonction helper: get_current_owner_profile_id()
-- ============================================================================
-- Retourne le profile_id du propriétaire connecté (ou NULL si non-propriétaire).
-- Utilisée par toutes les policies RLS pour éviter les sous-requêtes imbriquées.

CREATE OR REPLACE FUNCTION get_current_owner_profile_id()
RETURNS UUID AS $$
  SELECT op.profile_id
  FROM owner_profiles op
  INNER JOIN profiles p ON p.id = op.profile_id
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. Fix entity_associates: supprimer la policy SELECT redondante
-- ============================================================================

DROP POLICY IF EXISTS "Users can view associates of their entities" ON entity_associates;

-- Recréer la policy FOR ALL avec la fonction optimisée
DROP POLICY IF EXISTS "Users can manage associates of their entities" ON entity_associates;
CREATE POLICY "Users can manage associates of their entities"
  ON entity_associates FOR ALL
  USING (
    legal_entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

-- ============================================================================
-- 3. Optimiser les policies legal_entities
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own entities" ON legal_entities;
CREATE POLICY "Users can view their own entities"
  ON legal_entities FOR SELECT
  USING (owner_profile_id = get_current_owner_profile_id());

DROP POLICY IF EXISTS "Users can insert their own entities" ON legal_entities;
CREATE POLICY "Users can insert their own entities"
  ON legal_entities FOR INSERT
  WITH CHECK (owner_profile_id = get_current_owner_profile_id());

DROP POLICY IF EXISTS "Users can update their own entities" ON legal_entities;
CREATE POLICY "Users can update their own entities"
  ON legal_entities FOR UPDATE
  USING (owner_profile_id = get_current_owner_profile_id());

DROP POLICY IF EXISTS "Users can delete their own entities" ON legal_entities;
CREATE POLICY "Users can delete their own entities"
  ON legal_entities FOR DELETE
  USING (owner_profile_id = get_current_owner_profile_id());

-- ============================================================================
-- 4. Optimiser les policies property_ownership
-- ============================================================================

DROP POLICY IF EXISTS "Users can view ownership of their properties" ON property_ownership;
CREATE POLICY "Users can view ownership of their properties"
  ON property_ownership FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties
      WHERE owner_id = get_current_owner_profile_id()
    )
    OR legal_entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

DROP POLICY IF EXISTS "Users can manage ownership of their properties" ON property_ownership;
CREATE POLICY "Users can manage ownership of their properties"
  ON property_ownership FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties
      WHERE owner_id = get_current_owner_profile_id()
    )
    OR legal_entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

-- ============================================================================
-- 5. Optimiser les policies entity_audit_log
-- ============================================================================

DROP POLICY IF EXISTS "Users can view audit logs of their entities" ON entity_audit_log;
CREATE POLICY "Users can view audit logs of their entities"
  ON entity_audit_log FOR SELECT
  USING (
    entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

DROP POLICY IF EXISTS "Users can insert audit logs for their entities" ON entity_audit_log;
CREATE POLICY "Users can insert audit logs for their entities"
  ON entity_audit_log FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

-- ============================================================================
-- 6. Ajouter les types micro_entrepreneur et association
-- ============================================================================

ALTER TABLE legal_entities DROP CONSTRAINT IF EXISTS legal_entities_entity_type_check;
ALTER TABLE legal_entities ADD CONSTRAINT legal_entities_entity_type_check CHECK (entity_type IN (
  'particulier',
  'sci_ir',
  'sci_is',
  'sci_construction_vente',
  'sarl',
  'sarl_famille',
  'eurl',
  'sas',
  'sasu',
  'sa',
  'snc',
  'indivision',
  'demembrement_usufruit',
  'demembrement_nue_propriete',
  'holding',
  'micro_entrepreneur',
  'association'
));

COMMIT;


-- ======================================================
-- [7/15] SOURCE: 20260304000000_fix_invoice_generation_jour_paiement.sql
-- ======================================================

-- ============================================
-- Migration : Corriger generate_monthly_invoices pour utiliser jour_paiement
-- Date : 2026-03-04
-- Description : La fonction SQL de génération de factures n'utilisait pas
--   le champ leases.jour_paiement pour calculer la date_echeance.
--   Elle n'insérait pas non plus date_echeance ni invoice_number.
-- ============================================

CREATE OR REPLACE FUNCTION generate_monthly_invoices(p_target_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_lease RECORD;
  v_result JSONB;
  v_days_in_month INT;
  v_jour_paiement INT;
  v_date_echeance DATE;
BEGIN
  -- Vérifier le format du mois (YYYY-MM)
  IF p_target_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Format de mois invalide. Attendu: YYYY-MM';
  END IF;

  -- Calculer le nombre de jours dans le mois cible
  v_days_in_month := EXTRACT(DAY FROM ((p_target_month || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day'));

  -- Parcourir tous les baux actifs qui n'ont pas encore de facture pour ce mois
  FOR v_lease IN
    SELECT
      l.id as lease_id,
      l.property_id,
      p.owner_id,
      ls.profile_id as tenant_id,
      l.loyer,
      l.charges_forfaitaires,
      COALESCE(l.jour_paiement, 5) as jour_paiement
    FROM leases l
    JOIN properties p ON p.id = l.property_id
    JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role IN ('locataire', 'locataire_principal')
    WHERE l.statut = 'active'
    AND l.date_debut <= (p_target_month || '-01')::DATE
    AND (l.date_fin IS NULL OR l.date_fin >= (p_target_month || '-01')::DATE)
    AND NOT EXISTS (
      SELECT 1 FROM invoices
      WHERE lease_id = l.id
      AND periode = p_target_month
    )
  LOOP
    -- Clamper jour_paiement au dernier jour du mois (ex: 30 → 28 en février)
    v_jour_paiement := LEAST(v_lease.jour_paiement, v_days_in_month);
    v_date_echeance := (p_target_month || '-' || LPAD(v_jour_paiement::TEXT, 2, '0'))::DATE;

    INSERT INTO invoices (
      lease_id,
      owner_id,
      tenant_id,
      periode,
      montant_loyer,
      montant_charges,
      montant_total,
      date_echeance,
      invoice_number,
      statut,
      created_at
    ) VALUES (
      v_lease.lease_id,
      v_lease.owner_id,
      v_lease.tenant_id,
      p_target_month,
      v_lease.loyer,
      v_lease.charges_forfaitaires,
      v_lease.loyer + v_lease.charges_forfaitaires,
      v_date_echeance,
      'QUI-' || REPLACE(p_target_month, '-', '') || '-' || UPPER(LEFT(v_lease.lease_id::TEXT, 8)),
      'sent',
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'month', p_target_month,
    'generated_count', v_count
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_monthly_invoices IS 'Génère les factures de loyer pour tous les baux actifs pour un mois donné (YYYY-MM). Utilise leases.jour_paiement pour la date d''échéance.';


-- ======================================================
-- [8/15] SOURCE: 20260304000001_sync_sepa_collection_day.sql
-- ======================================================

-- ============================================
-- Migration : Synchroniser payment_schedules.collection_day avec leases.jour_paiement
-- Date : 2026-03-04
-- Description : Quand leases.jour_paiement est mis à jour, propager la valeur
--   vers payment_schedules.collection_day pour les prélèvements SEPA.
-- ============================================

-- Trigger function : propager jour_paiement vers payment_schedules
CREATE OR REPLACE FUNCTION sync_lease_jour_paiement_to_schedules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Seulement si jour_paiement a changé
  IF NEW.jour_paiement IS DISTINCT FROM OLD.jour_paiement THEN
    UPDATE payment_schedules
    SET collection_day = COALESCE(NEW.jour_paiement, 5)
    WHERE lease_id = NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trg_sync_jour_paiement ON leases;
CREATE TRIGGER trg_sync_jour_paiement
  AFTER UPDATE OF jour_paiement ON leases
  FOR EACH ROW
  EXECUTE FUNCTION sync_lease_jour_paiement_to_schedules();

COMMENT ON FUNCTION sync_lease_jour_paiement_to_schedules IS 'Propage leases.jour_paiement vers payment_schedules.collection_day';


-- ======================================================
-- [9/15] SOURCE: 20260304100000_activate_pg_cron_schedules.sql
-- ======================================================

-- ============================================
-- Migration : Activer pg_cron + pg_net et planifier tous les crons
-- Date : 2026-03-04
-- Description : Configure le scheduling automatique des API routes cron
--   via Supabase pg_cron + pg_net. Zéro service externe requis.
--
-- Prérequis (à configurer dans le dashboard Supabase > SQL Editor) :
--   ALTER DATABASE postgres SET app.settings.app_url = 'https://votre-site.netlify.app';
--   ALTER DATABASE postgres SET app.settings.cron_secret = 'votre-cron-secret';
-- ============================================

-- Activer les extensions (déjà disponibles sur Supabase Pro)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Supprimer les anciens jobs s'ils existent (idempotent)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'payment-reminders',
  'generate-monthly-invoices',
  'generate-invoices',
  'process-webhooks',
  'lease-expiry-alerts',
  'check-cni-expiry',
  'irl-indexation',
  'visit-reminders',
  'cleanup-exports',
  'cleanup-webhooks',
  'subscription-alerts',
  'notifications'
);

-- ===== CRONS CRITIQUES =====

-- Relances de paiement : quotidien à 8h UTC
SELECT cron.schedule('payment-reminders', '0 8 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/payment-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Génération factures mensuelles (route API) : 1er du mois à 6h
SELECT cron.schedule('generate-monthly-invoices', '0 6 1 * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/generate-monthly-invoices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Génération factures (RPC SQL) : 1er du mois à 6h30
SELECT cron.schedule('generate-invoices', '30 6 1 * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/generate-invoices',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Process webhooks : toutes les 5 min
SELECT cron.schedule('process-webhooks', '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/process-webhooks',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ===== CRONS SECONDAIRES =====

-- Alertes fin de bail : lundi 8h
SELECT cron.schedule('lease-expiry-alerts', '0 8 * * 1',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/lease-expiry-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Vérif CNI expirées : quotidien 10h
SELECT cron.schedule('check-cni-expiry', '0 10 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/check-cni-expiry',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Alertes abonnements : quotidien 10h
SELECT cron.schedule('subscription-alerts', '0 10 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/subscription-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Indexation IRL : 1er du mois 7h
SELECT cron.schedule('irl-indexation', '0 7 1 * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/irl-indexation',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- Rappels de visites : toutes les 30 min
SELECT cron.schedule('visit-reminders', '*/30 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/visit-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ===== NETTOYAGE =====

-- Nettoyage exports expirés : quotidien 3h
SELECT cron.schedule('cleanup-exports', '0 3 * * *',
  $$SELECT cleanup_expired_exports()$$
);

-- Nettoyage webhooks anciens : quotidien 4h
SELECT cron.schedule('cleanup-webhooks', '0 4 * * *',
  $$SELECT cleanup_old_webhooks()$$
);

COMMENT ON EXTENSION pg_cron IS 'Scheduling automatique des crons via Supabase pg_cron + pg_net';


-- ======================================================
-- [10/15] SOURCE: 20260304200000_auto_mark_late_invoices.sql
-- ======================================================

-- ============================================
-- Migration : Transition automatique des factures en retard
-- Date : 2026-03-04
-- Description : Crée une fonction qui marque automatiquement les factures
--   dont la date d'échéance est dépassée comme "late" (en retard).
--   Planifié via pg_cron pour tourner chaque jour à 00h05.
--   Filet de sécurité : même si le cron payment-reminders rate un jour,
--   les factures passent quand même en "late".
-- ============================================

CREATE OR REPLACE FUNCTION mark_overdue_invoices_late()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE invoices
  SET
    statut = 'late',
    updated_at = NOW()
  WHERE statut IN ('sent', 'pending')
    AND due_date < CURRENT_DATE
    AND due_date IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    RAISE NOTICE '[mark_overdue_invoices_late] % factures marquées en retard', v_count;
  END IF;

  RETURN v_count;
END;
$$;

-- Supprimer l'ancien job s'il existe
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'mark-overdue-invoices';

-- Planifier : quotidien à 00h05 UTC
SELECT cron.schedule('mark-overdue-invoices', '5 0 * * *',
  $$SELECT mark_overdue_invoices_late()$$
);

COMMENT ON FUNCTION mark_overdue_invoices_late IS 'Marque automatiquement les factures dont due_date < aujourd''hui comme "late"';


-- ======================================================
-- [11/15] SOURCE: 20260305000001_invoice_engine_fields.sql
-- ======================================================

-- ============================================
-- Migration : Moteur de facturation locative — Champs, tables et triggers
-- Date : 2026-03-05
-- Description :
--   1. Ajout des champs manquants dans leases (grace_period_days, invoice_engine_started, first_invoice_date, late_fee_rate)
--   2. Ajout des champs manquants dans invoices (period_start, period_end, generated_at, sent_at, paid_at, stripe_payment_intent_id, notes)
--   3. Extension des statuts invoices (partial, overdue, unpaid, cancelled)
--   4. Ajout colonne tenant_id dans payments (dénormalisation pour RLS)
--   5. Création tables : payment_reminders, late_fees, receipts, tenant_credit_score
--   6. RLS sur les nouvelles tables
--   7. DB trigger sur leases.statut → 'active' → appel invoice-engine-start
-- ============================================

-- =====================
-- 1. Champs manquants leases
-- =====================

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 3;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS invoice_engine_started BOOLEAN DEFAULT false;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS first_invoice_date DATE;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS late_fee_rate DECIMAL(10,6) DEFAULT 0.002740;

COMMENT ON COLUMN leases.grace_period_days IS 'Nombre de jours de grâce avant relance (défaut: 3)';
COMMENT ON COLUMN leases.invoice_engine_started IS 'Indique si le moteur de facturation a été déclenché pour ce bail';
COMMENT ON COLUMN leases.first_invoice_date IS 'Date de la première facture à générer (calculée au prorata si bail en cours de mois)';
COMMENT ON COLUMN leases.late_fee_rate IS 'Taux journalier de pénalité de retard (défaut: taux légal / 365 ≈ 0.00274)';

-- =====================
-- 2. Champs manquants invoices
-- =====================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS period_start DATE;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS period_end DATE;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Étendre les statuts possibles des invoices
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_statut_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_statut_check
  CHECK (statut IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'unpaid', 'cancelled', 'late'));

-- Index pour la recherche de factures en retard
CREATE INDEX IF NOT EXISTS idx_invoices_date_echeance ON invoices(date_echeance) WHERE statut IN ('sent', 'late', 'overdue');
CREATE INDEX IF NOT EXISTS idx_invoices_period_start ON invoices(period_start);

-- =====================
-- 3. Champ tenant_id dans payments (dénormalisation pour RLS directe)
-- =====================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES profiles(id);

-- Étendre les statuts possibles des payments
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_statut_check;
ALTER TABLE payments ADD CONSTRAINT payments_statut_check
  CHECK (statut IN ('pending', 'succeeded', 'failed', 'refunded'));

-- =====================
-- 4. Table payment_reminders
-- =====================

CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('friendly', 'reminder', 'urgent', 'formal_notice', 'lrec', 'final')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'lrec', 'courrier')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_invoice ON payment_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_tenant ON payment_reminders(tenant_id);

COMMENT ON TABLE payment_reminders IS 'Historique des relances envoyées pour factures impayées';

-- =====================
-- 5. Table late_fees
-- =====================

CREATE TABLE IF NOT EXISTS late_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  rate DECIMAL(10, 6) NOT NULL,
  days_late INTEGER NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  waived BOOLEAN NOT NULL DEFAULT false,
  waived_reason TEXT,
  waived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_late_fees_invoice ON late_fees(invoice_id);

COMMENT ON TABLE late_fees IS 'Pénalités de retard calculées conformément à la loi du 6 juillet 1989';

-- =====================
-- 6. Table receipts (quittances de loyer)
-- =====================

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- Format YYYY-MM
  period_start DATE,
  period_end DATE,
  montant_loyer DECIMAL(10, 2) NOT NULL,
  montant_charges DECIMAL(10, 2) NOT NULL DEFAULT 0,
  montant_total DECIMAL(10, 2) NOT NULL,
  pdf_url TEXT,
  pdf_storage_path TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_lease ON receipts(lease_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_period ON receipts(period);

COMMENT ON TABLE receipts IS 'Quittances de loyer générées après paiement (art. 21 loi 6 juillet 1989)';

-- =====================
-- 7. Table tenant_credit_score
-- =====================

CREATE TABLE IF NOT EXISTS tenant_credit_score (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER, -- NULL = pas encore de données
  on_time_count INTEGER NOT NULL DEFAULT 0,
  late_count INTEGER NOT NULL DEFAULT 0,
  missed_count INTEGER NOT NULL DEFAULT 0,
  early_count INTEGER NOT NULL DEFAULT 0,
  total_payments INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_credit_score_tenant ON tenant_credit_score(tenant_id);

COMMENT ON TABLE tenant_credit_score IS 'Score de ponctualité du locataire (cache calculé après chaque paiement)';

-- =====================
-- 8. RLS Policies
-- =====================

-- payment_reminders
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own reminders"
  ON payment_reminders FOR SELECT
  USING (tenant_id = public.user_profile_id());

CREATE POLICY "Owners can view reminders of own invoices"
  ON payment_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payment_reminders.invoice_id
      AND i.owner_id = public.user_profile_id()
    )
  );

CREATE POLICY "Admins can view all reminders"
  ON payment_reminders FOR SELECT
  USING (public.user_role() = 'admin');

-- late_fees
ALTER TABLE late_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view late fees of accessible invoices"
  ON late_fees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = late_fees.invoice_id
      AND (
        i.owner_id = public.user_profile_id()
        OR i.tenant_id = public.user_profile_id()
        OR public.user_role() = 'admin'
      )
    )
  );

-- receipts
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own receipts"
  ON receipts FOR SELECT
  USING (tenant_id = public.user_profile_id());

CREATE POLICY "Owners can view receipts of own properties"
  ON receipts FOR SELECT
  USING (owner_id = public.user_profile_id());

CREATE POLICY "Admins can view all receipts"
  ON receipts FOR SELECT
  USING (public.user_role() = 'admin');

-- tenant_credit_score
ALTER TABLE tenant_credit_score ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own credit score"
  ON tenant_credit_score FOR SELECT
  USING (tenant_id = public.user_profile_id());

CREATE POLICY "Admins can view all credit scores"
  ON tenant_credit_score FOR SELECT
  USING (public.user_role() = 'admin');

-- =====================
-- 9. DB Trigger : Bail activé → démarrer le moteur de facturation
-- =====================

CREATE OR REPLACE FUNCTION trigger_invoice_engine_on_lease_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_signer RECORD;
  v_owner_id UUID;
  v_property_address TEXT;
BEGIN
  -- Ne déclencher que si le statut passe à 'active' et que le moteur n'a pas déjà été démarré
  IF NEW.statut = 'active' AND (OLD.statut IS DISTINCT FROM 'active') AND (NEW.invoice_engine_started IS NOT TRUE) THEN

    -- Trouver le locataire principal
    SELECT ls.profile_id INTO v_tenant_signer
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.id
    AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
    LIMIT 1;

    -- Trouver le propriétaire
    SELECT p.owner_id, p.adresse_complete INTO v_owner_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    IF v_tenant_signer.profile_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      -- Émettre un événement outbox pour que le process-outbox le traite
      INSERT INTO outbox (event_type, payload)
      VALUES ('Lease.InvoiceEngineStart', jsonb_build_object(
        'lease_id', NEW.id,
        'tenant_id', v_tenant_signer.profile_id,
        'owner_id', v_owner_id,
        'property_id', NEW.property_id,
        'property_address', COALESCE(v_property_address, ''),
        'loyer', NEW.loyer,
        'charges_forfaitaires', NEW.charges_forfaitaires,
        'date_debut', NEW.date_debut,
        'jour_paiement', COALESCE(NEW.jour_paiement, 5),
        'grace_period_days', COALESCE(NEW.grace_period_days, 3)
      ));

      -- Générer immédiatement la première facture (prorata si nécessaire)
      PERFORM generate_first_invoice(NEW.id, v_tenant_signer.profile_id, v_owner_id);

      -- Marquer le moteur comme démarré
      NEW.invoice_engine_started := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fonction pour générer la première facture avec calcul prorata
CREATE OR REPLACE FUNCTION generate_first_invoice(
  p_lease_id UUID,
  p_tenant_id UUID,
  p_owner_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_now DATE := CURRENT_DATE;
  v_jour_paiement INT;
  v_days_in_month INT;
  v_date_debut DATE;
  v_first_full_month DATE;
  v_prorata_amount DECIMAL(10,2);
  v_prorata_days INT;
  v_total_days INT;
  v_loyer DECIMAL(10,2);
  v_charges DECIMAL(10,2);
  v_prorata_charges DECIMAL(10,2);
  v_current_month TEXT;
  v_invoice_exists BOOLEAN;
BEGIN
  -- Récupérer les données du bail
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_loyer := v_lease.loyer;
  v_charges := v_lease.charges_forfaitaires;
  v_jour_paiement := COALESCE(v_lease.jour_paiement, 5);
  v_date_debut := v_lease.date_debut;

  -- Mois du début de bail
  v_current_month := TO_CHAR(v_date_debut, 'YYYY-MM');

  -- Vérifier si une facture existe déjà pour ce mois
  SELECT EXISTS(
    SELECT 1 FROM invoices WHERE lease_id = p_lease_id AND periode = v_current_month
  ) INTO v_invoice_exists;
  IF v_invoice_exists THEN RETURN; END IF;

  -- Calculer le prorata si le bail ne commence pas le 1er du mois
  v_total_days := EXTRACT(DAY FROM (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_prorata_days := v_total_days - EXTRACT(DAY FROM v_date_debut)::INT + 1;

  IF v_prorata_days < v_total_days THEN
    -- Facture prorata
    v_prorata_amount := ROUND((v_loyer * v_prorata_days / v_total_days), 2);
    v_prorata_charges := ROUND((v_charges * v_prorata_days / v_total_days), 2);

    INSERT INTO invoices (
      lease_id, owner_id, tenant_id, periode,
      montant_loyer, montant_charges, montant_total,
      date_echeance, period_start, period_end,
      invoice_number, statut, generated_at, notes
    ) VALUES (
      p_lease_id, p_owner_id, p_tenant_id, v_current_month,
      v_prorata_amount, v_prorata_charges, v_prorata_amount + v_prorata_charges,
      v_date_debut, v_date_debut, (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
      'QUI-' || REPLACE(v_current_month, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
      'sent', NOW(),
      'Facture prorata du ' || v_date_debut || ' au ' || (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE || ' (' || v_prorata_days || '/' || v_total_days || ' jours)'
    );
  ELSE
    -- Bail commence le 1er → facture complète
    v_days_in_month := v_total_days;

    INSERT INTO invoices (
      lease_id, owner_id, tenant_id, periode,
      montant_loyer, montant_charges, montant_total,
      date_echeance, period_start, period_end,
      invoice_number, statut, generated_at
    ) VALUES (
      p_lease_id, p_owner_id, p_tenant_id, v_current_month,
      v_loyer, v_charges, v_loyer + v_charges,
      (v_current_month || '-' || LPAD(LEAST(v_jour_paiement, v_days_in_month)::TEXT, 2, '0'))::DATE,
      v_date_debut, (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
      'QUI-' || REPLACE(v_current_month, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
      'sent', NOW()
    );
  END IF;

  -- Mettre à jour first_invoice_date
  UPDATE leases SET first_invoice_date = v_date_debut WHERE id = p_lease_id;
END;
$$;

-- Installer le trigger (BEFORE UPDATE pour pouvoir modifier NEW)
DROP TRIGGER IF EXISTS trg_invoice_engine_on_lease_active ON leases;
CREATE TRIGGER trg_invoice_engine_on_lease_active
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invoice_engine_on_lease_active();

COMMENT ON FUNCTION trigger_invoice_engine_on_lease_active IS 'Déclenche la génération de la première facture quand un bail passe à actif';
COMMENT ON FUNCTION generate_first_invoice IS 'Génère la première facture avec calcul prorata conforme loi 6 juillet 1989';


-- ======================================================
-- [12/15] SOURCE: 20260305000002_payment_crons.sql
-- ======================================================

-- ============================================
-- Migration : Ajouter overdue-check au pg_cron
-- Date : 2026-03-05
-- Description : Planifie le cron overdue-check quotidien à 9h UTC
--   pour détecter les retards, calculer les pénalités légales,
--   et mettre à jour les statuts des factures.
-- ============================================

-- Supprimer l'ancien job s'il existe (idempotent)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'overdue-check';

-- Cron overdue-check : quotidien à 9h UTC
SELECT cron.schedule('overdue-check', '0 9 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/overdue-check',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);


-- ======================================================
-- [13/15] SOURCE: 20260305100000_fix_invoice_draft_notification.sql
-- ======================================================

-- =====================================================
-- FIX: Corriger la logique inversée dans notify_tenant_invoice_created
--
-- BUG: La condition `NOT IN ('sent', 'draft')` retournait NEW pour tout
-- sauf 'sent' et 'draft', ce qui inclut les brouillons dans les notifications.
-- Le commentaire dit "pas les brouillons" mais la logique fait le contraire.
--
-- FIX: Ne notifier que pour les factures envoyées ('sent'), pas les brouillons.
-- =====================================================

CREATE OR REPLACE FUNCTION notify_tenant_invoice_created()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
BEGIN
  -- Seulement pour les factures envoyées (pas les brouillons ni autres statuts)
  IF NEW.statut != 'sent' THEN
    RETURN NEW;
  END IF;

  -- Récupérer l'adresse via le bail
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = NEW.lease_id;

  -- Notifier tous les locataires du bail
  FOR v_tenant IN
    SELECT DISTINCT ls.profile_id
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire')
      AND ls.profile_id IS NOT NULL
  LOOP
    INSERT INTO notifications (
      profile_id,
      type,
      title,
      message,
      link,
      metadata
    ) VALUES (
      v_tenant.profile_id,
      'invoice',
      'Nouvelle quittance disponible',
      'Quittance pour ' || v_property_address || ' - ' || COALESCE(NEW.montant_total::text, '0') || '€',
      '/tenant/invoices/' || NEW.id,
      jsonb_build_object(
        'invoice_id', NEW.id,
        'lease_id', NEW.lease_id,
        'montant', NEW.montant_total,
        'periode', NEW.periode
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ======================================================
-- [14/15] SOURCE: 20260305100001_add_missing_notification_triggers.sql
-- ======================================================

-- =====================================================
-- Ajout des triggers de notification manquants
-- Identifiés lors de l'audit de propagation inter-comptes
-- =====================================================

-- =====================================================
-- TRIGGER 1: Notifier le propriétaire quand un ticket est créé
-- par un locataire sur l'un de ses biens
-- =====================================================
CREATE OR REPLACE FUNCTION notify_owner_on_ticket_created()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_address TEXT;
BEGIN
  -- Récupérer le propriétaire et l'adresse du bien
  SELECT p.owner_id, COALESCE(p.adresse_complete, 'Logement')
  INTO v_owner_id, v_property_address
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Si pas de propriétaire trouvé, on sort
  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Créer la notification pour le propriétaire
  INSERT INTO notifications (
    profile_id,
    type,
    title,
    message,
    link,
    metadata
  ) VALUES (
    v_owner_id,
    'ticket',
    'Nouveau signalement',
    'Un signalement a été créé pour ' || v_property_address || ' : ' || COALESCE(NEW.title, NEW.titre, 'Sans titre'),
    '/owner/tickets/' || NEW.id,
    jsonb_build_object(
      'ticket_id', NEW.id,
      'property_id', NEW.property_id,
      'priority', COALESCE(NEW.priority, NEW.priorite, 'normal')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger seulement s'il n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_owner_on_ticket_created'
  ) THEN
    CREATE TRIGGER trg_notify_owner_on_ticket_created
      AFTER INSERT ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION notify_owner_on_ticket_created();
  END IF;
END;
$$;

-- =====================================================
-- TRIGGER 2: Notifier le prestataire quand un ticket lui est assigné
-- (work order / intervention assignée)
-- =====================================================
CREATE OR REPLACE FUNCTION notify_provider_on_work_order()
RETURNS TRIGGER AS $$
DECLARE
  v_property_address TEXT;
BEGIN
  -- Seulement si un prestataire est assigné
  IF NEW.provider_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Seulement si l'assignation est nouvelle (INSERT ou UPDATE avec changement de provider)
  IF TG_OP = 'UPDATE' AND OLD.provider_id = NEW.provider_id THEN
    RETURN NEW;
  END IF;

  -- Récupérer l'adresse du bien
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Créer la notification pour le prestataire
  INSERT INTO notifications (
    profile_id,
    type,
    title,
    message,
    link,
    metadata
  ) VALUES (
    NEW.provider_id,
    'work_order',
    'Nouvelle intervention assignée',
    'Intervention sur ' || COALESCE(v_property_address, 'un bien') || ' : ' || COALESCE(NEW.title, NEW.titre, 'Sans titre'),
    '/provider/interventions/' || NEW.id,
    jsonb_build_object(
      'ticket_id', NEW.id,
      'property_id', NEW.property_id,
      'priority', COALESCE(NEW.priority, NEW.priorite, 'normal')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger seulement s'il n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_provider_on_work_order'
  ) THEN
    CREATE TRIGGER trg_notify_provider_on_work_order
      AFTER INSERT OR UPDATE OF provider_id ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION notify_provider_on_work_order();
  END IF;
END;
$$;


-- ======================================================
-- [15/15] SOURCE: 20260306000000_lease_documents_visible_tenant.sql
-- ======================================================

-- Migration: Add visible_tenant column to documents table
-- Allows owners to control which documents are visible to tenants

ALTER TABLE documents ADD COLUMN IF NOT EXISTS visible_tenant BOOLEAN NOT NULL DEFAULT true;

-- Index for tenant document visibility queries
CREATE INDEX IF NOT EXISTS idx_documents_lease_visible_tenant
  ON documents(lease_id, visible_tenant) WHERE lease_id IS NOT NULL;

-- RLS policy: tenants can only see documents marked as visible_tenant = true
-- (Updates existing tenant read policy to add visible_tenant check)
DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON documents;
CREATE POLICY "Tenants can read visible lease documents"
  ON documents FOR SELECT
  USING (
    tenant_id = public.user_profile_id()
    OR (
      visible_tenant = true
      AND lease_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM lease_signers ls
        JOIN profiles p ON p.id = ls.profile_id
        WHERE ls.lease_id = documents.lease_id
          AND p.id = public.user_profile_id()
          AND ls.role IN ('locataire_principal', 'locataire', 'colocataire')
      )
    )
    OR owner_id = public.user_profile_id()
    OR (
      property_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = documents.property_id
          AND p.owner_id = public.user_profile_id()
      )
    )
    OR public.user_role() = 'admin'
  );

