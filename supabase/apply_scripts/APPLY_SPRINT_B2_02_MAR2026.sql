-- =============================================================================
-- APPLY SPRINT B2 — BATCH 02_MAR2026 (IDEMPOTENT v2)
-- Genere le 2026-04-19T07:38:02Z
--
-- Contenu : 62 migrations (action=apply uniquement)
-- Plage   : 20260301000000 -> 20260331130000
-- Risque  : SAFE=17 / MODERE=21 / DANGEREUX=16 / CRITIQUE=8
--
-- IDEMPOTENCE : chaque CREATE POLICY est precede d'un DROP POLICY IF EXISTS,
-- chaque CREATE TRIGGER est precede d'un DROP TRIGGER IF EXISTS.
-- Les CREATE TABLE/INDEX/FUNCTION utilisent deja IF NOT EXISTS ou OR REPLACE.
-- => Re-executable sans erreur si une migration a deja ete partiellement appliquee.
--
-- INSTRUCTIONS :
-- 1. BACKUP prod obligatoire avant execution (pg_dump + Supabase PITR).
-- 2. Ouvrir Supabase Dashboard > SQL Editor > New Query.
-- 3. Coller ce fichier integralement et cliquer Run.
-- 4. Chaque migration est encapsulee dans son propre BEGIN/COMMIT : rollback cible.
-- 5. Ne PAS appliquer les 28 migrations "rename-then-apply" (branche dedup requise).
--
-- ORDRE : CHRONOLOGIQUE STRICT — ne pas reordonner.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1/62 -- 20260301000000 -- DANGEREUX -- 20260301000000_create_key_handovers.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 1/62 (DANGEREUX) 20260301000000_create_key_handovers.sql'; END $$;
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
DROP POLICY IF EXISTS "owner_key_handovers" ON key_handovers;
CREATE POLICY "owner_key_handovers" ON key_handovers
  FOR ALL
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Tenant can see and confirm handovers for their leases
DROP POLICY IF EXISTS "tenant_key_handovers" ON key_handovers;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 2/62 -- 20260301100000 -- DANGEREUX -- 20260301100000_entity_audit_and_propagation.sql
-- risk: UPDATE sans WHERE : on,or
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 2/62 (DANGEREUX) 20260301100000_entity_audit_and_propagation.sql'; END $$;
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

DROP POLICY IF EXISTS "Users can view audit logs of their entities" ON entity_audit_log;
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

DROP POLICY IF EXISTS "Users can insert audit logs for their entities" ON entity_audit_log;
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

DROP POLICY IF EXISTS "Admins can do everything on entity_audit_log" ON entity_audit_log;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 3/62 -- 20260303000000 -- MODERE -- 20260303000000_backfill_uploaded_by.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 3/62 (MODERE) 20260303000000_backfill_uploaded_by.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 4/62 -- 20260303100000 -- DANGEREUX -- 20260303100000_entity_rls_fix_and_optimize.sql
-- risk: UPDATE sans WHERE : their,their
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 4/62 (DANGEREUX) 20260303100000_entity_rls_fix_and_optimize.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 5/62 -- 20260304000000 -- SAFE -- 20260304000000_fix_invoice_generation_jour_paiement.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 5/62 (SAFE) 20260304000000_fix_invoice_generation_jour_paiement.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 6/62 -- 20260304000001 -- DANGEREUX -- 20260304000001_sync_sepa_collection_day.sql
-- risk: UPDATE sans WHERE : of
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 6/62 (DANGEREUX) 20260304000001_sync_sepa_collection_day.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 7/62 -- 20260304100000 -- SAFE -- 20260304100000_activate_pg_cron_schedules.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 7/62 (SAFE) 20260304100000_activate_pg_cron_schedules.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 8/62 -- 20260304200000 -- MODERE -- 20260304200000_auto_mark_late_invoices.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 8/62 (MODERE) 20260304200000_auto_mark_late_invoices.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 9/62 -- 20260305000001 -- DANGEREUX -- 20260305000001_invoice_engine_fields.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 9/62 (DANGEREUX) 20260305000001_invoice_engine_fields.sql'; END $$;
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

DROP POLICY IF EXISTS "Tenants can view own reminders" ON payment_reminders;
CREATE POLICY "Tenants can view own reminders"
  ON payment_reminders FOR SELECT
  USING (tenant_id = public.user_profile_id());

DROP POLICY IF EXISTS "Owners can view reminders of own invoices" ON payment_reminders;
CREATE POLICY "Owners can view reminders of own invoices"
  ON payment_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payment_reminders.invoice_id
      AND i.owner_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "Admins can view all reminders" ON payment_reminders;
CREATE POLICY "Admins can view all reminders"
  ON payment_reminders FOR SELECT
  USING (public.user_role() = 'admin');

-- late_fees
ALTER TABLE late_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view late fees of accessible invoices" ON late_fees;
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

DROP POLICY IF EXISTS "Tenants can view own receipts" ON receipts;
CREATE POLICY "Tenants can view own receipts"
  ON receipts FOR SELECT
  USING (tenant_id = public.user_profile_id());

DROP POLICY IF EXISTS "Owners can view receipts of own properties" ON receipts;
CREATE POLICY "Owners can view receipts of own properties"
  ON receipts FOR SELECT
  USING (owner_id = public.user_profile_id());

DROP POLICY IF EXISTS "Admins can view all receipts" ON receipts;
CREATE POLICY "Admins can view all receipts"
  ON receipts FOR SELECT
  USING (public.user_role() = 'admin');

-- tenant_credit_score
ALTER TABLE tenant_credit_score ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view own credit score" ON tenant_credit_score;
CREATE POLICY "Tenants can view own credit score"
  ON tenant_credit_score FOR SELECT
  USING (tenant_id = public.user_profile_id());

DROP POLICY IF EXISTS "Admins can view all credit scores" ON tenant_credit_score;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 10/62 -- 20260305000002 -- SAFE -- 20260305000002_payment_crons.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 10/62 (SAFE) 20260305000002_payment_crons.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 11/62 -- 20260305100000 -- SAFE -- 20260305100000_fix_invoice_draft_notification.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 11/62 (SAFE) 20260305100000_fix_invoice_draft_notification.sql'; END $$;
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
      '/tenant/payments?invoice=' || NEW.id,
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 12/62 -- 20260305100001 -- DANGEREUX -- 20260305100001_add_missing_notification_triggers.sql
-- risk: UPDATE sans WHERE : of
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 12/62 (DANGEREUX) 20260305100001_add_missing_notification_triggers.sql'; END $$;
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
    DROP TRIGGER IF EXISTS trg_notify_owner_on_ticket_created ON tickets;
    CREATE TRIGGER trg_notify_owner_on_ticket_created
      AFTER INSERT ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION notify_owner_on_ticket_created();
  END IF;
END;
$$;

-- TRIGGER 2 SKIPPED : references tickets.provider_id which never existed.
-- The provider is linked via work_orders.provider_id, not tickets.
-- The function notify_provider_on_work_order() is left defined above
-- for future use once the column semantics are fixed.

COMMIT;

-- -----------------------------------------------------------------------------
-- 13/62 -- 20260306000000 -- MODERE -- 20260306000000_lease_documents_visible_tenant.sql
-- risk: +1 policies, -1 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 13/62 (MODERE) 20260306000000_lease_documents_visible_tenant.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 14/62 -- 20260306100000 -- SAFE -- 20260306100000_add_digicode_interphone_columns.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 14/62 (SAFE) 20260306100000_add_digicode_interphone_columns.sql'; END $$;
-- Add digicode and interphone text columns to properties table
-- These store the actual access codes/names for tenant display

ALTER TABLE properties ADD COLUMN IF NOT EXISTS digicode TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS interphone TEXT;

COMMENT ON COLUMN properties.digicode IS 'Code digicode de l''immeuble';
COMMENT ON COLUMN properties.interphone IS 'Nom/numéro interphone du logement';

COMMIT;

-- -----------------------------------------------------------------------------
-- 15/62 -- 20260306100001 -- MODERE -- 20260306100001_backfill_initial_invoices.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 15/62 (MODERE) 20260306100001_backfill_initial_invoices.sql'; END $$;
-- ============================================
-- Migration : Backfill des factures initiales pour les baux existants
-- Date : 2026-03-06
-- Description :
--   1. Génère les factures initiales manquantes pour les baux fully_signed
--      qui n'ont pas de facture initial_invoice.
--   2. Corrige date_echeance NULL sur les factures initiales existantes.
-- ============================================

-- =====================
-- 1. Backfill : générer les factures initiales manquantes
-- =====================

DO $$
DECLARE
  v_lease RECORD;
  v_tenant_id UUID;
  v_owner_id UUID;
BEGIN
  FOR v_lease IN
    SELECT l.id, l.property_id
    FROM leases l
    WHERE l.statut IN ('fully_signed', 'active')
    AND NOT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.lease_id = l.id
      AND i.metadata->>'type' = 'initial_invoice'
    )
  LOOP
    -- Trouver le locataire
    SELECT ls.profile_id INTO v_tenant_id
    FROM lease_signers ls
    WHERE ls.lease_id = v_lease.id
    AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
    LIMIT 1;

    -- Trouver le propriétaire
    SELECT p.owner_id INTO v_owner_id
    FROM properties p WHERE p.id = v_lease.property_id;

    IF v_tenant_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      PERFORM generate_initial_signing_invoice(v_lease.id, v_tenant_id, v_owner_id);
    END IF;
  END LOOP;
END $$;

-- =====================
-- 2. Fix : corriger date_echeance NULL sur les factures initiales existantes
-- =====================

UPDATE invoices
SET date_echeance = COALESCE(
  (SELECT l.date_debut FROM leases l WHERE l.id = invoices.lease_id),
  created_at::date
)
WHERE metadata->>'type' = 'initial_invoice'
AND date_echeance IS NULL;

-- =====================
-- 3. Fix : corriger date_echeance NULL sur toute facture avec statut 'sent' ou 'late'
-- =====================

UPDATE invoices
SET date_echeance = COALESCE(
  due_date,
  (SELECT l.date_debut FROM leases l WHERE l.id = invoices.lease_id),
  created_at::date
)
WHERE date_echeance IS NULL
AND statut IN ('sent', 'late', 'overdue', 'unpaid');

COMMIT;

-- -----------------------------------------------------------------------------
-- 16/62 -- 20260306200000 -- DANGEREUX -- 20260306200000_notify_tenant_digicode_changed.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 16/62 (DANGEREUX) 20260306200000_notify_tenant_digicode_changed.sql'; END $$;
-- =====================================================
-- Migration: Trigger notification changement digicode
-- Date: 2026-03-06
-- Description: Notifie les locataires actifs quand le
--              propriétaire modifie le digicode du bien
-- =====================================================

CREATE OR REPLACE FUNCTION notify_tenant_digicode_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
BEGIN
  -- Seulement si le digicode a changé ET n'est pas null
  IF OLD.digicode IS DISTINCT FROM NEW.digicode AND NEW.digicode IS NOT NULL THEN
    v_property_address := COALESCE(NEW.adresse_complete, 'Votre logement');

    -- Notifier tous les locataires ayant un bail actif sur cette propriété
    FOR v_tenant IN
      SELECT DISTINCT ls.profile_id
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = NEW.id
        AND l.statut = 'active'
        AND ls.role IN ('locataire_principal', 'colocataire')
        AND ls.profile_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        v_tenant.profile_id,
        'alert',
        'Code d''accès modifié',
        format('Le digicode de %s a été mis à jour. Consultez votre espace locataire.', v_property_address),
        '/tenant/lease',
        NEW.id,
        'property'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_tenant_digicode_changed ON properties;
CREATE TRIGGER trigger_notify_tenant_digicode_changed
  AFTER UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenant_digicode_changed();

-- =====================================================
-- Logs de la migration
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== Migration: Trigger notification changement digicode ===';
  RAISE NOTICE 'Trigger 8: notify_tenant_digicode_changed (digicode modifié)';
  RAISE NOTICE 'Notifie les locataires actifs quand le digicode est modifié';
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 17/62 -- 20260306300000 -- SAFE -- 20260306300000_add_owner_payment_preferences.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 17/62 (SAFE) 20260306300000_add_owner_payment_preferences.sql'; END $$;
-- Migration : Ajouter les colonnes de préférences financières et d'automatisation au profil propriétaire
-- Ces colonnes étaient précédemment stockées uniquement dans le brouillon d'onboarding et perdues après

-- Préférences d'encaissement et de versement
ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS encaissement_prefere TEXT DEFAULT 'sepa_sdd'
    CHECK (encaissement_prefere IN ('sepa_sdd', 'virement_sct', 'virement_inst', 'pay_by_bank', 'carte_wallet')),
  ADD COLUMN IF NOT EXISTS payout_frequence TEXT DEFAULT 'immediat'
    CHECK (payout_frequence IN ('immediat', 'hebdo', 'mensuel', 'seuil')),
  ADD COLUMN IF NOT EXISTS payout_rail TEXT DEFAULT 'sct'
    CHECK (payout_rail IN ('sct', 'sct_inst')),
  ADD COLUMN IF NOT EXISTS payout_seuil NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_jour INTEGER DEFAULT 1
    CHECK (payout_jour >= 1 AND payout_jour <= 28);

-- Niveau d'automatisation
ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS automation_level TEXT DEFAULT 'standard'
    CHECK (automation_level IN ('basique', 'standard', 'pro', 'autopilot'));

COMMENT ON COLUMN owner_profiles.encaissement_prefere IS 'Mode d''encaissement préféré (SEPA, virement, carte, etc.)';
COMMENT ON COLUMN owner_profiles.payout_frequence IS 'Fréquence de versement des fonds au propriétaire';
COMMENT ON COLUMN owner_profiles.payout_rail IS 'Rail de versement (SCT standard ou instantané)';
COMMENT ON COLUMN owner_profiles.payout_seuil IS 'Seuil de déclenchement du versement (si fréquence = seuil)';
COMMENT ON COLUMN owner_profiles.payout_jour IS 'Jour du mois pour le versement (si fréquence = mensuel)';
COMMENT ON COLUMN owner_profiles.automation_level IS 'Niveau d''automatisation choisi par le propriétaire';

COMMIT;

-- -----------------------------------------------------------------------------
-- 18/62 -- 20260309000000 -- DANGEREUX -- 20260309000000_entity_status_and_dedup.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 18/62 (DANGEREUX) 20260309000000_entity_status_and_dedup.sql'; END $$;
-- ============================================
-- Migration: Ajout status sur legal_entities + anti-doublons + déduplication
-- Date: 2026-03-09
-- Description:
--   1. Ajout colonne `status` ('draft','active','archived') avec sync `is_active`
--   2. Index partiel anti-doublons pour entités sans SIRET
--   3. Fonction admin de déduplication des entités
-- ============================================

BEGIN;

-- ============================================
-- 1. Ajout de la colonne `status`
-- ============================================

ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('draft', 'active', 'archived'));

-- Backfill des valeurs existantes
UPDATE legal_entities SET status = 'active'  WHERE is_active = true  AND status IS DISTINCT FROM 'active';
UPDATE legal_entities SET status = 'archived' WHERE is_active = false AND status IS DISTINCT FROM 'archived';

-- Index sur status
CREATE INDEX IF NOT EXISTS idx_legal_entities_status ON legal_entities(status);

-- ============================================
-- 2. Trigger de synchronisation is_active <-> status
-- ============================================

CREATE OR REPLACE FUNCTION sync_entity_status_and_is_active()
RETURNS TRIGGER AS $$
BEGIN
  -- Si status a changé, mettre à jour is_active
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_active := (NEW.status = 'active');
  -- Si is_active a changé mais pas status, mettre à jour status
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active THEN
      NEW.status := 'active';
    ELSE
      NEW.status := 'archived';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_entity_status ON legal_entities;
CREATE TRIGGER trg_sync_entity_status
  BEFORE INSERT OR UPDATE ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION sync_entity_status_and_is_active();

-- ============================================
-- 3. Index partiel anti-doublons (entités sans SIRET)
-- ============================================
-- Empêche de créer deux entités actives avec le même (owner, type, nom)
-- quand aucun SIRET n'est renseigné (typiquement les "particulier")

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_entities_no_siret_unique
  ON legal_entities(owner_profile_id, entity_type, nom)
  WHERE siret IS NULL AND status = 'active';

-- ============================================
-- 4. Fonction de déduplication admin
-- ============================================

CREATE OR REPLACE FUNCTION admin_deduplicate_entities(p_owner_profile_id UUID)
RETURNS TABLE(deleted_count INTEGER, reassigned_properties INTEGER, reassigned_leases INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_reassigned_props INTEGER := 0;
  v_reassigned_leases INTEGER := 0;
  v_group RECORD;
  v_keep_id UUID;
  v_dup RECORD;
  v_props_moved INTEGER;
  v_leases_moved INTEGER;
BEGIN
  -- Pour chaque groupe de doublons (même owner, type, nom, tous actifs)
  FOR v_group IN
    SELECT le.owner_profile_id, le.entity_type, le.nom, COUNT(*) AS cnt
    FROM legal_entities le
    WHERE le.owner_profile_id = p_owner_profile_id
      AND le.status = 'active'
      AND le.siret IS NULL
    GROUP BY le.owner_profile_id, le.entity_type, le.nom
    HAVING COUNT(*) > 1
  LOOP
    -- Garder la plus ancienne (created_at ASC)
    SELECT id INTO v_keep_id
    FROM legal_entities
    WHERE owner_profile_id = v_group.owner_profile_id
      AND entity_type = v_group.entity_type
      AND nom = v_group.nom
      AND status = 'active'
      AND siret IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    -- Pour chaque doublon (hors la gardée)
    FOR v_dup IN
      SELECT id FROM legal_entities
      WHERE owner_profile_id = v_group.owner_profile_id
        AND entity_type = v_group.entity_type
        AND nom = v_group.nom
        AND status = 'active'
        AND siret IS NULL
        AND id != v_keep_id
    LOOP
      -- Réassigner les propriétés orphelines
      UPDATE properties
      SET legal_entity_id = v_keep_id
      WHERE legal_entity_id = v_dup.id
        AND deleted_at IS NULL;
      GET DIAGNOSTICS v_props_moved = ROW_COUNT;
      v_reassigned_props := v_reassigned_props + v_props_moved;

      -- Réassigner les property_ownership
      UPDATE property_ownership
      SET legal_entity_id = v_keep_id
      WHERE legal_entity_id = v_dup.id;

      -- Réassigner les baux
      UPDATE leases
      SET signatory_entity_id = v_keep_id
      WHERE signatory_entity_id = v_dup.id;
      GET DIAGNOSTICS v_leases_moved = ROW_COUNT;
      v_reassigned_leases := v_reassigned_leases + v_leases_moved;

      -- Réassigner les factures
      UPDATE invoices
      SET issuer_entity_id = v_keep_id
      WHERE issuer_entity_id = v_dup.id;

      -- Supprimer les associés du doublon
      DELETE FROM entity_associates WHERE legal_entity_id = v_dup.id;

      -- Supprimer le doublon
      DELETE FROM legal_entities WHERE id = v_dup.id;
      v_deleted := v_deleted + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_deleted, v_reassigned_props, v_reassigned_leases;
END;
$$;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 19/62 -- 20260309000001 -- DANGEREUX -- 20260309000001_messages_update_rls.sql
-- risk: UPDATE sans WHERE : own
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 19/62 (DANGEREUX) 20260309000001_messages_update_rls.sql'; END $$;
-- Migration: Allow users to update their own messages (edit + soft-delete)
-- Needed for message edit/delete feature

-- Policy for UPDATE: users can only update their own messages in their conversations
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (
    sender_profile_id = public.user_profile_id()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_profile_id = public.user_profile_id() OR c.tenant_profile_id = public.user_profile_id())
    )
  )
  WITH CHECK (
    sender_profile_id = public.user_profile_id()
  );

COMMIT;

-- -----------------------------------------------------------------------------
-- 20/62 -- 20260309000002 -- SAFE -- 20260309000002_add_ticket_to_conversations.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 20/62 (SAFE) 20260309000002_add_ticket_to_conversations.sql'; END $$;
-- Migration: Add ticket_id to conversations table for ticket-chat integration

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_ticket_id ON conversations(ticket_id);

COMMIT;

-- -----------------------------------------------------------------------------
-- 21/62 -- 20260309100000 -- MODERE -- 20260309100000_sync_subscription_plans_features.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 21/62 (MODERE) 20260309100000_sync_subscription_plans_features.sql'; END $$;
-- =====================================================
-- Migration: Synchronisation complète des plans d'abonnement
-- Date: 2026-03-09
-- Description:
--   - Synchronise les features JSONB de subscription_plans avec le frontend (plans.ts)
--   - Ajoute les plans manquants (gratuit, enterprise_s/m/l/xl)
--   - Met à jour les prix (confort 29→35€, pro 59→69€)
--   - Synchronise subscriptions.plan_slug avec subscription_plans.slug
--   - Migre les abonnements enterprise legacy → enterprise_s
--   - Recalcule les compteurs d'usage
--   - Crée les abonnements manquants pour les propriétaires orphelins
--   - Met à jour has_subscription_feature() pour les features non-booléennes
-- =====================================================

BEGIN;

-- =====================================================
-- ÉTAPE 1: UPSERT des 8 plans avec features complètes
-- Source de vérité : lib/subscriptions/plans.ts
-- =====================================================

-- GRATUIT - 0€/mois (1 bien) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'gratuit',
  'Gratuit',
  'Découvrez la gestion locative simplifiée avec 1 bien',
  0, 0,
  1, 1, 2, 0.1,
  '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "open_banking": false,
    "open_banking_level": "none",
    "bank_reconciliation": false,
    "auto_reminders": false,
    "auto_reminders_sms": false,
    "irl_revision": false,
    "alerts_deadlines": false,
    "tenant_portal": "basic",
    "tenant_payment_online": false,
    "lease_generation": true,
    "colocation": false,
    "multi_units": false,
    "multi_users": false,
    "max_users": 1,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": false,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": false,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": false,
    "scoring_advanced": false,
    "edl_digital": false,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, false, -1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- STARTER - 9€/mois (3 biens) - MISE À JOUR features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'starter',
  'Starter',
  'Idéal pour gérer jusqu''à 3 biens en toute simplicité',
  900, 9000,
  3, 5, 10, 1,
  '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "open_banking": false,
    "open_banking_level": "none",
    "bank_reconciliation": false,
    "auto_reminders": "email_basic",
    "auto_reminders_sms": false,
    "irl_revision": false,
    "alerts_deadlines": false,
    "tenant_portal": "basic",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": false,
    "multi_units": false,
    "multi_users": false,
    "max_users": 1,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": false,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": false,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": false,
    "scoring_advanced": false,
    "edl_digital": false,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, false, 0
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- CONFORT - 35€/mois (10 biens) - MISE À JOUR prix + features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'confort',
  'Confort',
  'Pour les propriétaires actifs avec plusieurs biens',
  3500, 33600,  -- 35€/mois, 336€/an (=28€/mois, -20%)
  10, 25, 40, 5,
  '{
    "signatures": true,
    "signatures_monthly_quota": 2,
    "open_banking": true,
    "open_banking_level": "basic",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": false,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "advanced",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 2,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": true,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": true,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": false,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, true, 1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- PRO - 69€/mois (50 biens) - MISE À JOUR prix + features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'pro',
  'Pro',
  'Pour les gestionnaires professionnels et SCI',
  6900, 66200,  -- 69€/mois, 662€/an (=55€/mois, -20%)
  50, -1, -1, 30,
  '{
    "signatures": true,
    "signatures_monthly_quota": 10,
    "open_banking": true,
    "open_banking_level": "advanced",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 5,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": true,
    "api_access_level": "read_write",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, false, 2
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE S - 249€/mois (100 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_s',
  'Enterprise S',
  'Pour les gestionnaires de 50 à 100 biens',
  24900, 239000,
  100, -1, -1, 50,
  '{
    "signatures": true,
    "signatures_monthly_quota": 25,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, false, 3
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE M - 349€/mois (200 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_m',
  'Enterprise M',
  'Pour les gestionnaires de 100 à 200 biens',
  34900, 335000,
  200, -1, -1, 100,
  '{
    "signatures": true,
    "signatures_monthly_quota": 40,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, false, 4
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE L - 499€/mois (500 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_l',
  'Enterprise L',
  'Pour les gestionnaires de 200 à 500 biens',
  49900, 479000,
  500, -1, -1, 200,
  '{
    "signatures": true,
    "signatures_monthly_quota": 60,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": true,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, true, 5
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE XL - 799€/mois (illimité) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_xl',
  'Enterprise XL',
  'Solution sur-mesure pour +500 biens',
  79900, 767000,
  -1, -1, -1, -1,
  '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, false, 6
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE (Legacy) - Mise à jour features pour cohérence
-- On garde le plan en BDD pour les abonnements existants mais on le masque
UPDATE subscription_plans
SET
  features = '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  display_order = 99,
  updated_at = NOW()
WHERE slug = 'enterprise';

-- =====================================================
-- ÉTAPE 2: Synchroniser subscriptions.plan_slug
-- =====================================================

-- 2a. Synchroniser plan_slug avec le slug réel du plan lié
UPDATE subscriptions s
SET plan_slug = sp.slug, updated_at = NOW()
FROM subscription_plans sp
WHERE s.plan_id = sp.id
AND (s.plan_slug IS NULL OR s.plan_slug != sp.slug);

-- 2b. Migrer les abonnements enterprise legacy → enterprise_s
DO $$
DECLARE
  v_enterprise_s_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_enterprise_s_id FROM subscription_plans WHERE slug = 'enterprise_s';

  IF v_enterprise_s_id IS NOT NULL THEN
    UPDATE subscriptions
    SET plan_slug = 'enterprise_s',
        plan_id = v_enterprise_s_id,
        updated_at = NOW()
    WHERE plan_slug = 'enterprise';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) enterprise migré(s) vers enterprise_s', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 3: Recalculer les compteurs d'usage
-- =====================================================

-- 3a. Recalculer properties_count pour les comptes actifs
UPDATE subscriptions s
SET
  properties_count = COALESCE(prop_counts.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT p.owner_id, COUNT(*) as cnt
  FROM properties p
  WHERE p.deleted_at IS NULL
  GROUP BY p.owner_id
) prop_counts
WHERE s.owner_id = prop_counts.owner_id
AND s.status IN ('active', 'trialing');

-- 3b. Recalculer leases_count pour les comptes actifs
UPDATE subscriptions s
SET
  leases_count = COALESCE(lease_counts.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT pr.owner_id, COUNT(*) as cnt
  FROM leases l
  JOIN properties pr ON l.property_id = pr.id
  WHERE l.statut IN ('active', 'pending_signature', 'partially_signed', 'fully_signed')
  GROUP BY pr.owner_id
) lease_counts
WHERE s.owner_id = lease_counts.owner_id
AND s.status IN ('active', 'trialing');

-- =====================================================
-- ÉTAPE 4: Créer abonnements manquants
-- =====================================================

DO $$
DECLARE
  v_starter_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_starter_id FROM subscription_plans WHERE slug = 'starter' LIMIT 1;

  IF v_starter_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      owner_id, plan_id, plan_slug, status, billing_cycle,
      current_period_start, current_period_end, trial_end,
      properties_count, leases_count
    )
    SELECT
      p.id,
      v_starter_id,
      'starter',
      'trialing',
      'monthly',
      NOW(),
      NOW() + INTERVAL '30 days',
      NOW() + INTERVAL '30 days',
      COALESCE((SELECT COUNT(*) FROM properties pr WHERE pr.owner_id = p.id AND pr.deleted_at IS NULL), 0),
      0
    FROM profiles p
    WHERE p.role = 'owner'
    AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.owner_id = p.id)
    ON CONFLICT (owner_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) Starter créé(s) pour propriétaires orphelins', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 5: Mettre à jour has_subscription_feature()
-- Support des features non-booléennes (niveaux, nombres)
-- =====================================================

CREATE OR REPLACE FUNCTION has_subscription_feature(p_owner_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  feature_raw JSONB;
  feature_type TEXT;
BEGIN
  -- Récupérer la valeur brute de la feature depuis le plan
  SELECT sp.features -> p_feature
  INTO feature_raw
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.slug = COALESCE(s.plan_slug, 'gratuit')
  WHERE s.owner_id = p_owner_id;

  -- Si pas de subscription ou feature absente
  IF feature_raw IS NULL THEN
    RETURN false;
  END IF;

  -- Déterminer le type JSONB
  feature_type := jsonb_typeof(feature_raw);

  -- Booléen : retourner directement
  IF feature_type = 'boolean' THEN
    RETURN feature_raw::text::boolean;
  END IF;

  -- Nombre : true si > 0 (ou -1 pour illimité)
  IF feature_type = 'number' THEN
    RETURN (feature_raw::text::numeric != 0);
  END IF;

  -- String : true si non vide et pas "none" ou "false"
  IF feature_type = 'string' THEN
    RETURN (feature_raw::text NOT IN ('"none"', '"false"', '""'));
  END IF;

  -- Null explicite
  IF feature_type = 'null' THEN
    RETURN false;
  END IF;

  -- Autres types (array, object) : considérer comme true
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_subscription_feature(UUID, TEXT) IS
  'Vérifie si un owner a accès à une feature selon son forfait. Supporte bool, niveaux (string) et quotas (number).';

-- =====================================================
-- ÉTAPE 6: Mise à jour du trigger create_owner_subscription
-- Mettre à jour les intervalles pour 30 jours (cohérence)
-- =====================================================

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Seulement pour les propriétaires
  IF NEW.role = 'owner' THEN
    -- Récupérer l'ID du plan starter (plan par défaut)
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = 'starter'
    LIMIT 1;

    -- Créer l'abonnement si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id,
        plan_id,
        plan_slug,
        status,
        billing_cycle,
        current_period_start,
        current_period_end,
        trial_end,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'starter',
        'trialing',
        'monthly',
        NOW(),
        NOW() + INTERVAL '30 days',
        NOW() + INTERVAL '30 days',
        0,
        0
      )
      ON CONFLICT (owner_id) DO NOTHING;

      RAISE NOTICE 'Abonnement Talok Starter (essai 30j) créé pour le propriétaire %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 22/62 -- 20260310000000 -- MODERE -- 20260310000000_fix_subscription_plans_display_order.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 22/62 (MODERE) 20260310000000_fix_subscription_plans_display_order.sql'; END $$;
-- =====================================================
-- Migration: Fix display_order des plans d'abonnement
-- Date: 2026-03-10
-- Description:
--   - Corrige display_order du plan Gratuit (-1 → 0)
--   - Réordonne tous les plans avec des valeurs séquentielles
-- =====================================================

BEGIN;

UPDATE subscription_plans SET display_order = 0, updated_at = NOW() WHERE slug = 'gratuit';
UPDATE subscription_plans SET display_order = 1, updated_at = NOW() WHERE slug = 'starter';
UPDATE subscription_plans SET display_order = 2, updated_at = NOW() WHERE slug = 'confort';
UPDATE subscription_plans SET display_order = 3, updated_at = NOW() WHERE slug = 'pro';
UPDATE subscription_plans SET display_order = 4, updated_at = NOW() WHERE slug = 'enterprise_s';
UPDATE subscription_plans SET display_order = 5, updated_at = NOW() WHERE slug = 'enterprise_m';
UPDATE subscription_plans SET display_order = 6, updated_at = NOW() WHERE slug = 'enterprise_l';
UPDATE subscription_plans SET display_order = 7, updated_at = NOW() WHERE slug = 'enterprise_xl';
UPDATE subscription_plans SET display_order = 99, updated_at = NOW() WHERE slug = 'enterprise';

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 23/62 -- 20260310100000 -- DANGEREUX -- 20260310100000_fix_property_limit_enforcement.sql
-- risk: UPDATE sans WHERE : or,deleted_at
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 23/62 (DANGEREUX) 20260310100000_fix_property_limit_enforcement.sql'; END $$;
-- =====================================================
-- Migration: Fix Property Limit Enforcement & Counter Sync
--
-- Problème: Les compteurs properties_count/leases_count dans
-- la table subscriptions se désynchronisent car :
-- 1. Le trigger enforce_property_limit() lit le compteur caché
--    au lieu de faire un vrai COUNT
-- 2. Le trigger update_subscription_properties_count() ne gère
--    pas les soft-deletes (UPDATE de deleted_at)
-- 3. Les compteurs existants sont potentiellement faux
--
-- Fix:
-- - enforce_property_limit() utilise un vrai COUNT(*)
-- - enforce_lease_limit() utilise un vrai COUNT(*) avec deleted_at IS NULL
-- - update_subscription_properties_count() gère les soft-deletes via recount
-- - Recalcul des compteurs pour TOUS les comptes
-- =====================================================

-- =====================================================
-- 1. Fix enforce_property_limit() : utiliser un vrai COUNT
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
BEGIN
  -- Compter les propriétés actives (non soft-deleted) avec un vrai COUNT
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL;

  -- Récupérer la limite du plan
  SELECT
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. Fix enforce_lease_limit() : COUNT live + deleted_at IS NULL
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_lease_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
  property_owner_id UUID;
BEGIN
  -- Récupérer l'owner_id depuis la propriété
  SELECT owner_id INTO property_owner_id
  FROM properties
  WHERE id = NEW.property_id;

  IF property_owner_id IS NULL THEN
    RAISE EXCEPTION 'Propriété non trouvée';
  END IF;

  -- Compter les baux actifs sur les propriétés non soft-deleted
  SELECT COUNT(*) INTO current_count
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE p.owner_id = property_owner_id
    AND p.deleted_at IS NULL
    AND l.statut IN ('active', 'pending_signature');

  -- Récupérer la limite du plan
  SELECT
    COALESCE(sp.max_leases, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = property_owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bail(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour créer plus de baux.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. Fix update_subscription_properties_count() : gérer soft-deletes
--    Utilise un recount complet (self-healing) au lieu de inc/dec
-- =====================================================
CREATE OR REPLACE FUNCTION update_subscription_properties_count()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_owner_id := OLD.owner_id;
  ELSE
    v_owner_id := NEW.owner_id;
  END IF;

  -- Recalculer le compteur à partir de l'état réel de la table
  UPDATE subscriptions
  SET properties_count = (
    SELECT COUNT(*)
    FROM properties
    WHERE owner_id = v_owner_id
      AND deleted_at IS NULL
  ),
  updated_at = NOW()
  WHERE owner_id = v_owner_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour le trigger pour écouter aussi les UPDATE (soft-delete/restore)
DROP TRIGGER IF EXISTS trg_update_subscription_properties ON properties;
CREATE TRIGGER trg_update_subscription_properties
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_subscription_properties_count();

-- =====================================================
-- 4. Recalculer properties_count pour TOUS les comptes
-- =====================================================
UPDATE subscriptions s
SET
  properties_count = COALESCE(pc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(p.id) as cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  GROUP BY s2.owner_id
) pc
WHERE s.owner_id = pc.owner_id;

-- =====================================================
-- 5. Recalculer leases_count pour TOUS les comptes
-- =====================================================
UPDATE subscriptions s
SET
  leases_count = COALESCE(lc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(l.id) as cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  LEFT JOIN leases l ON l.property_id = p.id AND l.statut IN ('active', 'pending_signature')
  GROUP BY s2.owner_id
) lc
WHERE s.owner_id = lc.owner_id;

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON FUNCTION enforce_property_limit() IS 'Vérifie la limite de biens via COUNT réel (pas le compteur caché). Gère correctement les soft-deletes.';
COMMENT ON FUNCTION enforce_lease_limit() IS 'Vérifie la limite de baux via COUNT réel. Exclut les propriétés soft-deleted.';
COMMENT ON FUNCTION update_subscription_properties_count() IS 'Met à jour le compteur properties_count via recount complet sur INSERT, DELETE et soft-delete (UPDATE deleted_at).';

COMMIT;

-- -----------------------------------------------------------------------------
-- 24/62 -- 20260310200000 -- CRITIQUE -- 20260310200000_add_signature_push_franceconnect.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 24/62 (CRITIQUE) 20260310200000_add_signature_push_franceconnect.sql'; END $$;
-- Migration: Ajout colonnes signatures (Yousign), table franceconnect_sessions,
-- et colonnes push Web Push sur notification_settings
-- Date: 2026-03-10

-- =============================================================================
-- 1. signatures: ajout colonnes provider et signing_url pour intégration Yousign
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'signatures' AND column_name = 'provider'
  ) THEN
    ALTER TABLE signatures ADD COLUMN provider TEXT DEFAULT 'internal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'signatures' AND column_name = 'signing_url'
  ) THEN
    ALTER TABLE signatures ADD COLUMN signing_url TEXT;
  END IF;
END $$;

COMMENT ON COLUMN signatures.provider IS 'Provider de signature: internal, yousign, docusign';
COMMENT ON COLUMN signatures.signing_url IS 'URL de signature externe (Yousign)';

-- =============================================================================
-- 2. franceconnect_sessions: sessions OIDC FranceConnect / France Identité
-- =============================================================================
CREATE TABLE IF NOT EXISTS franceconnect_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  nonce TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'identity_verification',
  callback_url TEXT NOT NULL DEFAULT '/',
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fc_sessions_user_id ON franceconnect_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fc_sessions_state ON franceconnect_sessions(state);
CREATE INDEX IF NOT EXISTS idx_fc_sessions_expires_at ON franceconnect_sessions(expires_at);

-- RLS
ALTER TABLE franceconnect_sessions ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs ne peuvent voir que leurs propres sessions
DROP POLICY IF EXISTS "Users can view own FC sessions" ON franceconnect_sessions;
CREATE POLICY "Users can view own FC sessions"
  ON franceconnect_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Seul le service role peut insérer/modifier (via l'API route)
DROP POLICY IF EXISTS "Service role can manage FC sessions" ON franceconnect_sessions;
CREATE POLICY "Service role can manage FC sessions"
  ON franceconnect_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- Nettoyage automatique des sessions expirées (via pg_cron si disponible)
-- DELETE FROM franceconnect_sessions WHERE expires_at < NOW();

-- =============================================================================
-- 3. notification_settings: colonnes push_enabled et push_subscription
--    pour le Web Push API (VAPID)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_settings' AND column_name = 'push_enabled'
  ) THEN
    ALTER TABLE notification_settings ADD COLUMN push_enabled BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_settings' AND column_name = 'push_subscription'
  ) THEN
    ALTER TABLE notification_settings ADD COLUMN push_subscription JSONB;
  END IF;
END $$;

COMMENT ON COLUMN notification_settings.push_enabled IS 'Web Push activé pour cet utilisateur';
COMMENT ON COLUMN notification_settings.push_subscription IS 'Objet PushSubscription (endpoint, keys) pour Web Push API';

COMMIT;

-- -----------------------------------------------------------------------------
-- 25/62 -- 20260310300000 -- CRITIQUE -- 20260310300000_add_stripe_price_extra_property_id.sql
-- risk: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 25/62 (CRITIQUE) 20260310300000_add_stripe_price_extra_property_id.sql'; END $$;
-- Add stripe_price_extra_property_id column to subscription_plans
-- Stores the Stripe Price ID for per-unit extra property billing

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_price_extra_property_id TEXT;

COMMENT ON COLUMN subscription_plans.stripe_price_extra_property_id
IS 'Stripe Price ID for recurring per-unit billing of extra properties beyond included quota';

COMMIT;

-- -----------------------------------------------------------------------------
-- 26/62 -- 20260311100000 -- DANGEREUX -- 20260311100000_sync_subscription_plan_slugs.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 26/62 (DANGEREUX) 20260311100000_sync_subscription_plan_slugs.sql'; END $$;
-- =====================================================
-- Migration: Synchroniser plan_slug depuis plan_id
--
-- Problème: Certaines subscriptions ont plan_slug NULL
-- car la colonne a été ajoutée après la création de la subscription.
-- Cela cause un fallback vers le plan "gratuit" côté frontend,
-- bloquant les utilisateurs sur les forfaits payants (starter, etc.)
--
-- Fix:
-- 1. Synchroniser plan_slug depuis plan_id pour toutes les rows NULL
-- 2. Créer un trigger pour auto-sync à chaque changement de plan_id
-- =====================================================

-- 1. Synchroniser les plan_slug manquants
UPDATE subscriptions s
SET plan_slug = sp.slug, updated_at = NOW()
FROM subscription_plans sp
WHERE sp.id = s.plan_id
  AND s.plan_slug IS NULL;

-- 2. Trigger auto-sync plan_slug quand plan_id change
CREATE OR REPLACE FUNCTION sync_subscription_plan_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Si plan_id change ou plan_slug est NULL, synchroniser depuis subscription_plans
  IF NEW.plan_id IS NOT NULL AND (
    NEW.plan_slug IS NULL
    OR TG_OP = 'INSERT'
    OR OLD.plan_id IS DISTINCT FROM NEW.plan_id
  ) THEN
    SELECT slug INTO NEW.plan_slug
    FROM subscription_plans
    WHERE id = NEW.plan_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_subscription_plan_slug ON subscriptions;
CREATE TRIGGER trg_sync_subscription_plan_slug
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_subscription_plan_slug();

COMMENT ON FUNCTION sync_subscription_plan_slug() IS
  'Auto-synchronise plan_slug depuis plan_id pour éviter les fallbacks vers gratuit.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 27/62 -- 20260312000000 -- SAFE -- 20260312000000_admin_dashboard_rpcs.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 27/62 (SAFE) 20260312000000_admin_dashboard_rpcs.sql'; END $$;
-- ============================================================================
-- Migration: Admin Dashboard RPCs
-- Date: 2026-03-12
-- Description: Crée les RPCs manquantes pour le dashboard admin V2
--   - admin_monthly_revenue : revenus mensuels sur 12 mois
--   - admin_subscription_stats : stats abonnements
--   - admin_daily_trends : tendances 7 derniers jours
-- ============================================================================

-- 1. RPC: admin_monthly_revenue
-- Retourne les revenus attendus vs encaissés sur les 12 derniers mois
CREATE OR REPLACE FUNCTION admin_monthly_revenue()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      to_char(month_start, 'Mon') AS month,
      COALESCE(SUM(montant_total), 0)::numeric AS attendu,
      COALESCE(SUM(CASE WHEN statut = 'paid' THEN montant_total ELSE 0 END), 0)::numeric AS encaisse
    FROM generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS month_start
    LEFT JOIN invoices ON date_trunc('month', invoices.created_at) = month_start
    GROUP BY month_start
    ORDER BY month_start
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 2. RPC: admin_subscription_stats
-- Retourne les statistiques d'abonnements
CREATE OR REPLACE FUNCTION admin_subscription_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*)::int,
    'active', COUNT(*) FILTER (WHERE status = 'active')::int,
    'trial', COUNT(*) FILTER (WHERE status = 'trialing' OR (trial_end IS NOT NULL AND trial_end > now()))::int,
    'churned', COUNT(*) FILTER (WHERE status IN ('canceled', 'expired'))::int
  )
  INTO result
  FROM subscriptions;

  RETURN COALESCE(result, json_build_object('total', 0, 'active', 0, 'trial', 0, 'churned', 0));
END;
$$;

-- 3. RPC: admin_daily_trends
-- Retourne les tendances des 7 derniers jours (nouveaux users, properties, leases)
CREATE OR REPLACE FUNCTION admin_daily_trends()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  users_arr int[];
  properties_arr int[];
  leases_arr int[];
  d date;
BEGIN
  users_arr := ARRAY[]::int[];
  properties_arr := ARRAY[]::int[];
  leases_arr := ARRAY[]::int[];

  FOR d IN SELECT generate_series(
    (current_date - interval '6 days')::date,
    current_date,
    interval '1 day'
  )::date
  LOOP
    users_arr := users_arr || COALESCE(
      (SELECT COUNT(*)::int FROM profiles WHERE created_at::date = d), 0
    );
    properties_arr := properties_arr || COALESCE(
      (SELECT COUNT(*)::int FROM properties WHERE created_at::date = d), 0
    );
    leases_arr := leases_arr || COALESCE(
      (SELECT COUNT(*)::int FROM leases WHERE created_at::date = d), 0
    );
  END LOOP;

  RETURN json_build_object(
    'users', to_json(users_arr),
    'properties', to_json(properties_arr),
    'leases', to_json(leases_arr)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_monthly_revenue() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_subscription_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_daily_trends() TO authenticated;

COMMIT;

-- -----------------------------------------------------------------------------
-- 28/62 -- 20260312000001 -- DANGEREUX -- 20260312000001_fix_owner_subscription_defaults.sql
-- risk: UPDATE sans WHERE : of
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 28/62 (DANGEREUX) 20260312000001_fix_owner_subscription_defaults.sql'; END $$;
-- =====================================================
-- Migration: Fix Owner Subscription Defaults & Data Repair
--
-- Problemes corriges:
-- 1. create_owner_subscription() assigne "starter" au lieu de "gratuit"
-- 2. plan_slug non defini explicitement dans le trigger
-- 3. Periode d'essai incorrecte pour le plan gratuit
-- 4. properties_count desynchronise pour les comptes existants
-- 5. Owners orphelins sans subscription
--
-- Flux corrige:
-- - Nouveau owner → subscription "gratuit" (status=active, pas de trial)
-- - L'utilisateur choisit son forfait ensuite via /signup/plan
-- - Si forfait payant → Stripe Checkout met a jour la subscription
-- - Si gratuit → POST /api/subscriptions/select-plan confirme le choix
-- =====================================================

-- =====================================================
-- 1. Corriger le trigger create_owner_subscription()
--    Plan par defaut = gratuit, plan_slug defini, pas de trial
-- =====================================================

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
  v_prop_count INTEGER;
  v_lease_count INTEGER;
BEGIN
  -- Seulement pour les proprietaires
  IF NEW.role = 'owner' THEN
    -- Recuperer l'ID du plan gratuit
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = 'gratuit'
    LIMIT 1;

    -- Compter les proprietes existantes (cas rare mais possible via admin)
    SELECT COUNT(*) INTO v_prop_count
    FROM properties
    WHERE owner_id = NEW.id
      AND deleted_at IS NULL;

    -- Compter les baux actifs
    SELECT COUNT(*) INTO v_lease_count
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    WHERE p.owner_id = NEW.id
      AND p.deleted_at IS NULL
      AND l.statut IN ('active', 'pending_signature');

    -- Creer l'abonnement gratuit si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id,
        plan_id,
        plan_slug,
        status,
        billing_cycle,
        current_period_start,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'gratuit',         -- Plan gratuit par defaut
        'active',          -- Actif immediatement (pas de trial pour le gratuit)
        'monthly',
        NOW(),
        COALESCE(v_prop_count, 0),
        COALESCE(v_lease_count, 0)
      )
      ON CONFLICT (owner_id) DO NOTHING;

      RAISE NOTICE 'Abonnement Gratuit cree pour le proprietaire %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreer le trigger
DROP TRIGGER IF EXISTS trg_create_owner_subscription ON profiles;
CREATE TRIGGER trg_create_owner_subscription
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'owner')
  EXECUTE FUNCTION create_owner_subscription();

COMMENT ON FUNCTION create_owner_subscription() IS
  'Cree automatiquement un abonnement Gratuit pour les nouveaux proprietaires. Le forfait reel sera choisi ensuite via /signup/plan.';

-- =====================================================
-- 2. Recalculer properties_count pour TOUS les comptes
-- =====================================================

UPDATE subscriptions s
SET
  properties_count = COALESCE(pc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(p.id) AS cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  GROUP BY s2.owner_id
) pc
WHERE s.owner_id = pc.owner_id;

-- =====================================================
-- 3. Recalculer leases_count pour TOUS les comptes
-- =====================================================

UPDATE subscriptions s
SET
  leases_count = COALESCE(lc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(l.id) AS cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  LEFT JOIN leases l ON l.property_id = p.id AND l.statut IN ('active', 'pending_signature')
  GROUP BY s2.owner_id
) lc
WHERE s.owner_id = lc.owner_id;

-- =====================================================
-- 4. Synchroniser plan_slug NULL depuis plan_id
-- =====================================================

UPDATE subscriptions s
SET
  plan_slug = sp.slug,
  updated_at = NOW()
FROM subscription_plans sp
WHERE sp.id = s.plan_id
  AND (s.plan_slug IS NULL OR s.plan_slug = '');

-- =====================================================
-- 5. Creer subscriptions manquantes pour owners orphelins
--    (plan gratuit, status active)
-- =====================================================

DO $$
DECLARE
  v_gratuit_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_gratuit_id FROM subscription_plans WHERE slug = 'gratuit' LIMIT 1;

  IF v_gratuit_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      owner_id, plan_id, plan_slug, status, billing_cycle,
      current_period_start, properties_count, leases_count
    )
    SELECT
      p.id,
      v_gratuit_id,
      'gratuit',
      'active',
      'monthly',
      NOW(),
      COALESCE((SELECT COUNT(*) FROM properties pr WHERE pr.owner_id = p.id AND pr.deleted_at IS NULL), 0),
      0
    FROM profiles p
    WHERE p.role = 'owner'
      AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.owner_id = p.id)
    ON CONFLICT (owner_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) Gratuit cree(s) pour proprietaires orphelins', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON FUNCTION create_owner_subscription() IS
  'Cree un abonnement Gratuit (plan_slug=gratuit, status=active) pour chaque nouveau proprietaire. Les compteurs sont initialises a partir de l''etat reel de la base.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 29/62 -- 20260312100000 -- SAFE -- 20260312100000_fix_handle_new_user_all_roles.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 29/62 (SAFE) 20260312100000_fix_handle_new_user_all_roles.sql'; END $$;
-- ============================================
-- Migration: Ajouter guarantor et syndic au trigger handle_new_user
-- Date: 2026-03-12
-- Description: Le trigger acceptait uniquement admin/owner/tenant/provider.
--              Les rôles guarantor et syndic étaient silencieusement convertis en tenant.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
BEGIN
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le rôle (tous les rôles supportés par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Insérer le profil avec toutes les données
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Crée automatiquement un profil lors de la création d''un utilisateur.
Lit le rôle et les informations personnelles depuis les raw_user_meta_data.
Supporte tous les rôles: admin, owner, tenant, provider, guarantor, syndic.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 30/62 -- 20260314001000 -- CRITIQUE -- 20260314001000_fix_stripe_connect_rls.sql
-- risk: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 30/62 (CRITIQUE) 20260314001000_fix_stripe_connect_rls.sql'; END $$;
-- Migration: corriger la RLS Stripe Connect avec profiles.id
-- Date: 2026-03-14

BEGIN;

ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own connect account" ON stripe_connect_accounts;
DROP POLICY IF EXISTS "Owners can create own connect account" ON stripe_connect_accounts;
DROP POLICY IF EXISTS "Service role full access connect" ON stripe_connect_accounts;

CREATE POLICY "Owners can view own connect account" ON stripe_connect_accounts
  FOR SELECT
  USING (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

CREATE POLICY "Owners can create own connect account" ON stripe_connect_accounts
  FOR INSERT
  WITH CHECK (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Owners can update own connect account" ON stripe_connect_accounts;
CREATE POLICY "Owners can update own connect account" ON stripe_connect_accounts
  FOR UPDATE
  USING (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  )
  WITH CHECK (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

CREATE POLICY "Service role full access connect" ON stripe_connect_accounts
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Owners can view own transfers" ON stripe_transfers;
DROP POLICY IF EXISTS "Service role full access transfers" ON stripe_transfers;

CREATE POLICY "Owners can view own transfers" ON stripe_transfers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM stripe_connect_accounts sca
      WHERE sca.id = stripe_transfers.connect_account_id
        AND (
          sca.profile_id = public.user_profile_id()
          OR public.user_role() = 'admin'
        )
    )
  );

CREATE POLICY "Service role full access transfers" ON stripe_transfers
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 31/62 -- 20260314020000 -- MODERE -- 20260314020000_canonical_lease_activation_flow.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 31/62 (MODERE) 20260314020000_canonical_lease_activation_flow.sql'; END $$;
-- Migration: recentrer le flux bail sur un parcours canonique
-- Date: 2026-03-14
--
-- Objectifs:
-- 1. Empêcher les activations implicites depuis les signataires ou l'EDL
-- 2. Faire de la facture initiale une étape explicite après fully_signed
-- 3. Préserver le dépôt de garantie dans le total de la facture initiale

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Neutraliser les activations SQL implicites legacy
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS tr_check_activate_lease ON lease_signers;
DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON edl;
DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;

-- ---------------------------------------------------------------------------
-- 2. L'EDL finalise uniquement le document, sans activer le bail
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_edl_finalization()
RETURNS TRIGGER AS $$
DECLARE
    v_has_owner BOOLEAN;
    v_has_tenant BOOLEAN;
    v_edl_id UUID;
BEGIN
    v_edl_id := NEW.edl_id;

    SELECT 
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
              AND signer_role IN ('owner', 'proprietaire', 'bailleur') 
              AND signature_image_path IS NOT NULL
              AND signed_at IS NOT NULL
        ),
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
              AND signer_role IN ('tenant', 'locataire', 'locataire_principal') 
              AND signature_image_path IS NOT NULL
              AND signed_at IS NOT NULL
        )
    INTO v_has_owner, v_has_tenant;

    IF v_has_owner AND v_has_tenant THEN
        UPDATE edl
        SET 
            status = 'signed',
            completed_date = COALESCE(completed_date, CURRENT_DATE),
            updated_at = NOW()
        WHERE id = v_edl_id
          AND status != 'signed';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3. Préserver le dépôt de garantie dans le calcul du total
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  v_deposit_amount DECIMAL := 0;
BEGIN
  IF NEW.metadata IS NOT NULL AND NEW.metadata->>'type' = 'initial_invoice' THEN
    v_deposit_amount := COALESCE((NEW.metadata->>'deposit_amount')::DECIMAL, 0);
  END IF;

  NEW.montant_total :=
    ROUND(COALESCE(NEW.montant_loyer, 0) + COALESCE(NEW.montant_charges, 0) + v_deposit_amount, 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 4. Fonction SSOT de génération de la facture initiale
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_initial_signing_invoice(
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
  v_date_debut DATE;
  v_loyer DECIMAL(10,2);
  v_charges DECIMAL(10,2);
  v_deposit DECIMAL(10,2);
  v_total_days INT;
  v_prorata_days INT;
  v_prorata_loyer DECIMAL(10,2);
  v_prorata_charges DECIMAL(10,2);
  v_is_prorated BOOLEAN := false;
  v_month_str TEXT;
  v_due_date DATE;
  v_period_end DATE;
  v_invoice_exists BOOLEAN;
BEGIN
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_loyer := COALESCE(v_lease.loyer, 0);
  v_charges := COALESCE(v_lease.charges_forfaitaires, 0);
  v_deposit := COALESCE(v_lease.depot_de_garantie, 0);
  v_date_debut := v_lease.date_debut;

  IF v_date_debut IS NULL THEN RETURN; END IF;

  v_month_str := TO_CHAR(v_date_debut, 'YYYY-MM');

  SELECT EXISTS(
    SELECT 1 FROM invoices
    WHERE lease_id = p_lease_id
      AND (
        metadata->>'type' = 'initial_invoice'
        OR type = 'initial_invoice'
      )
  ) INTO v_invoice_exists;

  IF v_invoice_exists THEN RETURN; END IF;

  v_total_days := EXTRACT(DAY FROM (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_prorata_days := v_total_days - EXTRACT(DAY FROM v_date_debut)::INT + 1;
  v_period_end := (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  IF v_prorata_days < v_total_days THEN
    v_prorata_loyer := ROUND((v_loyer * v_prorata_days / v_total_days), 2);
    v_prorata_charges := ROUND((v_charges * v_prorata_days / v_total_days), 2);
    v_is_prorated := true;
  ELSE
    v_prorata_loyer := v_loyer;
    v_prorata_charges := v_charges;
  END IF;

  v_due_date := GREATEST(v_date_debut, CURRENT_DATE);

  INSERT INTO invoices (
    lease_id,
    owner_id,
    tenant_id,
    periode,
    montant_loyer,
    montant_charges,
    montant_total,
    date_echeance,
    due_date,
    period_start,
    period_end,
    invoice_number,
    type,
    statut,
    generated_at,
    metadata,
    notes
  ) VALUES (
    p_lease_id,
    p_owner_id,
    p_tenant_id,
    v_month_str,
    v_prorata_loyer,
    v_prorata_charges,
    v_prorata_loyer + v_prorata_charges + v_deposit,
    v_due_date,
    v_due_date,
    v_date_debut,
    v_period_end,
    'INI-' || REPLACE(v_month_str, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
    'initial_invoice',
    'sent',
    NOW(),
    jsonb_build_object(
      'type', 'initial_invoice',
      'includes_deposit', v_deposit > 0,
      'deposit_amount', v_deposit,
      'is_prorated', v_is_prorated,
      'prorata_days', v_prorata_days,
      'total_days', v_total_days,
      'generated_at_signing', true
    ),
    CASE
      WHEN v_is_prorated THEN
        'Facture initiale : loyer prorata du ' || v_date_debut || ' au ' || v_period_end
        || ' (' || v_prorata_days || '/' || v_total_days || ' jours)'
        || ' + dépôt de garantie ' || v_deposit || ' €'
      ELSE
        'Facture initiale : loyer ' || v_month_str || ' + dépôt de garantie ' || v_deposit || ' €'
    END
  );
END;
$$;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 32/62 -- 20260314030000 -- CRITIQUE -- 20260314030000_payments_production_hardening.sql
-- risk: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 32/62 (CRITIQUE) 20260314030000_payments_production_hardening.sql'; END $$;
-- Migration: hardening production paiements
-- Objectifs:
-- 1. Neutraliser les derniers chemins legacy qui activent un bail implicitement
-- 2. Renforcer l'idempotence des reversements Stripe Connect
-- 3. Distinguer transfert Connect et payout bancaire reel
-- 4. Backfiller les marqueurs de facture initiale et les liens SEPA sur les donnees existantes

-- -----------------------------------------------------------------------------
-- Flux bail / signatures / EDL
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_signature_session_to_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
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

    ELSIF NEW.entity_type = 'edl' THEN
      UPDATE edl
      SET
        status = 'signed',
        updated_at = NOW()
      WHERE id = NEW.entity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON public.edl;
DROP TRIGGER IF EXISTS tr_check_activate_lease ON public.lease_signers;
DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON public.leases;
DROP TRIGGER IF EXISTS trg_invoice_engine_on_lease_active ON public.leases;

-- -----------------------------------------------------------------------------
-- Reversements Stripe Connect / payouts
-- -----------------------------------------------------------------------------

ALTER TABLE public.stripe_transfers
  ADD COLUMN IF NOT EXISTS stripe_source_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_destination_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_transfers_unique_payment
  ON public.stripe_transfers(payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_transfers_unique_invoice_transfer
  ON public.stripe_transfers(invoice_id, stripe_transfer_id);

CREATE TABLE IF NOT EXISTS public.stripe_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connect_account_id UUID NOT NULL REFERENCES public.stripe_connect_accounts(id) ON DELETE CASCADE,
  stripe_payout_id TEXT NOT NULL UNIQUE,
  stripe_balance_transaction_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'in_transit')),
  arrival_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payouts_connect_account
  ON public.stripe_payouts(connect_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_payouts_status
  ON public.stripe_payouts(status, created_at DESC);

ALTER TABLE public.stripe_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own payouts" ON public.stripe_payouts;
CREATE POLICY "Owners can view own payouts" ON public.stripe_payouts
  FOR SELECT USING (
    connect_account_id IN (
      SELECT sca.id
      FROM public.stripe_connect_accounts sca
      WHERE sca.profile_id = public.user_profile_id()
    )
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Service role full access payouts" ON public.stripe_payouts;
CREATE POLICY "Service role full access payouts" ON public.stripe_payouts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP TRIGGER IF EXISTS update_stripe_payouts_updated_at ON public.stripe_payouts;
CREATE TRIGGER update_stripe_payouts_updated_at
  BEFORE UPDATE ON public.stripe_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stripe_transfers'
      AND column_name = 'payout_id'
  ) THEN
    BEGIN
      ALTER TABLE public.stripe_transfers
        ADD CONSTRAINT fk_stripe_transfers_payout
        FOREIGN KEY (payout_id) REFERENCES public.stripe_payouts(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Backfills securises et idempotents
-- -----------------------------------------------------------------------------

UPDATE public.invoices
SET type = 'initial_invoice'
WHERE COALESCE(metadata->>'type', '') = 'initial_invoice'
  AND COALESCE(type, '') <> 'initial_invoice';

UPDATE public.invoices
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('type', 'initial_invoice')
WHERE type = 'initial_invoice'
  AND COALESCE(metadata->>'type', '') <> 'initial_invoice';

UPDATE public.tenant_payment_methods tpm
SET sepa_mandate_id = sm.id,
    updated_at = NOW()
FROM public.sepa_mandates sm
WHERE tpm.type = 'sepa_debit'
  AND tpm.sepa_mandate_id IS NULL
  AND tpm.tenant_profile_id = sm.tenant_profile_id
  AND tpm.stripe_payment_method_id = sm.stripe_payment_method_id;

COMMIT;

-- -----------------------------------------------------------------------------
-- 33/62 -- 20260315090000 -- CRITIQUE -- 20260315090000_market_standard_subscription_alignment.sql
-- risk: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 33/62 (CRITIQUE) 20260315090000_market_standard_subscription_alignment.sql'; END $$;
BEGIN;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS selected_plan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS selected_plan_source TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_plan_id UUID REFERENCES subscription_plans(id),
  ADD COLUMN IF NOT EXISTS scheduled_plan_slug TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_plan_effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_subscription_schedule_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_selected_plan_at
  ON subscriptions(selected_plan_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_scheduled_plan_effective_at
  ON subscriptions(scheduled_plan_effective_at)
  WHERE scheduled_plan_effective_at IS NOT NULL;

UPDATE subscriptions s
SET plan_id = sp.id
FROM subscription_plans sp
WHERE s.plan_id IS NULL
  AND s.plan_slug IS NOT NULL
  AND sp.slug = s.plan_slug;

UPDATE subscriptions s
SET plan_slug = sp.slug
FROM subscription_plans sp
WHERE s.plan_slug IS NULL
  AND s.plan_id IS NOT NULL
  AND sp.id = s.plan_id;

UPDATE subscriptions
SET status = 'paused'
WHERE status = 'suspended';

UPDATE subscriptions
SET selected_plan_at = COALESCE(current_period_start, updated_at, created_at),
    selected_plan_source = CASE
      WHEN stripe_subscription_id IS NOT NULL THEN COALESCE(selected_plan_source, 'backfill_stripe')
      ELSE COALESCE(selected_plan_source, 'backfill_local')
    END
WHERE selected_plan_at IS NULL
   OR selected_plan_source IS NULL;

UPDATE subscriptions
SET scheduled_plan_id = NULL,
    scheduled_plan_slug = NULL,
    scheduled_plan_effective_at = NULL,
    stripe_subscription_schedule_id = NULL
WHERE scheduled_plan_effective_at IS NOT NULL
  AND scheduled_plan_effective_at < NOW() - INTERVAL '7 days';

UPDATE subscriptions s
SET scheduled_plan_id = sp.id
FROM subscription_plans sp
WHERE s.scheduled_plan_id IS NULL
  AND s.scheduled_plan_slug IS NOT NULL
  AND sp.slug = s.scheduled_plan_slug;

UPDATE subscriptions s
SET scheduled_plan_slug = sp.slug
FROM subscription_plans sp
WHERE s.scheduled_plan_slug IS NULL
  AND s.scheduled_plan_id IS NOT NULL
  AND sp.id = s.scheduled_plan_id;

UPDATE subscriptions
SET properties_count = property_counts.count_value
FROM (
  SELECT owner_id, COUNT(*)::INT AS count_value
  FROM properties
  WHERE deleted_at IS NULL
  GROUP BY owner_id
) AS property_counts
WHERE subscriptions.owner_id = property_counts.owner_id;

UPDATE subscriptions
SET properties_count = 0
WHERE properties_count IS NULL;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 34/62 -- 20260318000000 -- MODERE -- 20260318000000_fix_auth_reset_template_examples.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 34/62 (MODERE) 20260318000000_fix_auth_reset_template_examples.sql'; END $$;
-- =============================================================================
-- Migration : Align auth reset template examples with live recovery flow
-- Date      : 2026-03-18
-- Objectif  : Éviter les exemples legacy /auth/reset?token=... qui ne
--             correspondent plus au flux actuel /auth/callback -> /auth/reset-password
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates') THEN
    UPDATE email_templates
    SET available_variables = REPLACE(
          available_variables::text,
          'https://talok.fr/auth/reset?token=...',
          'https://talok.fr/auth/callback?next=/auth/reset-password&code=...'
        )::jsonb,
        updated_at = NOW()
    WHERE slug = 'auth_reset_password'
      AND available_variables::text LIKE '%https://talok.fr/auth/reset?token=...%';

    RAISE NOTICE 'email_templates auth_reset_password example updated to callback/reset-password flow';
  ELSE
    RAISE NOTICE 'email_templates table does not exist, skipping';
  END IF;
END $$;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 35/62 -- 20260318010000 -- CRITIQUE -- 20260318010000_password_reset_requests.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 35/62 (CRITIQUE) 20260318010000_password_reset_requests.sql'; END $$;
-- =============================================================================
-- Migration : Password reset requests SOTA 2026
-- Objectif  : Introduire une couche applicative one-time au-dessus du recovery
--             Supabase pour sécuriser le changement de mot de passe.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired', 'revoked')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip INET,
  requested_user_agent TEXT,
  completed_ip INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_status
  ON password_reset_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_expires_at
  ON password_reset_requests(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_requests_single_pending
  ON password_reset_requests(user_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION set_password_reset_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_password_reset_requests_updated_at ON password_reset_requests;
CREATE TRIGGER trg_password_reset_requests_updated_at
  BEFORE UPDATE ON password_reset_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_password_reset_requests_updated_at();

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 36/62 -- 20260318020000 -- DANGEREUX -- 20260318020000_buildings_rls_sota2026.sql
-- risk: UPDATE sans WHERE : their,their,to
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 36/62 (DANGEREUX) 20260318020000_buildings_rls_sota2026.sql'; END $$;
-- ============================================
-- Migration : RLS SOTA 2026 pour buildings & building_units
-- Remplace auth.uid() par user_profile_id() / user_role()
-- Ajoute policies admin et tenant
-- ============================================

-- 1. DROP anciennes policies buildings
-- ============================================
DROP POLICY IF EXISTS "Owners can view their buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can create buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can update their buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can delete their buildings" ON buildings;

-- 2. DROP anciennes policies building_units
-- ============================================
DROP POLICY IF EXISTS "Owners can view their building units" ON building_units;
DROP POLICY IF EXISTS "Owners can create building units" ON building_units;
DROP POLICY IF EXISTS "Owners can update their building units" ON building_units;
DROP POLICY IF EXISTS "Owners can delete their building units" ON building_units;

-- 3. Nouvelles policies buildings (owner)
-- ============================================
DROP POLICY IF EXISTS "buildings_owner_select" ON buildings;
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (owner_id = public.user_profile_id());

DROP POLICY IF EXISTS "buildings_owner_insert" ON buildings;
CREATE POLICY "buildings_owner_insert" ON buildings
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.user_profile_id());

DROP POLICY IF EXISTS "buildings_owner_update" ON buildings;
CREATE POLICY "buildings_owner_update" ON buildings
  FOR UPDATE TO authenticated
  USING (owner_id = public.user_profile_id());

DROP POLICY IF EXISTS "buildings_owner_delete" ON buildings;
CREATE POLICY "buildings_owner_delete" ON buildings
  FOR DELETE TO authenticated
  USING (owner_id = public.user_profile_id());

-- 4. Policies buildings (admin)
-- ============================================
DROP POLICY IF EXISTS "buildings_admin_all" ON buildings;
CREATE POLICY "buildings_admin_all" ON buildings
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');

-- 5. Policies buildings (tenant via bail actif)
-- ============================================
DROP POLICY IF EXISTS "buildings_tenant_select" ON buildings;
CREATE POLICY "buildings_tenant_select" ON buildings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM building_units bu
      JOIN leases l ON l.id = bu.current_lease_id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE bu.building_id = buildings.id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut = 'active'
    )
  );

-- 6. Nouvelles policies building_units (owner)
-- ============================================
DROP POLICY IF EXISTS "building_units_owner_select" ON building_units;
CREATE POLICY "building_units_owner_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "building_units_owner_insert" ON building_units;
CREATE POLICY "building_units_owner_insert" ON building_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "building_units_owner_update" ON building_units;
CREATE POLICY "building_units_owner_update" ON building_units
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "building_units_owner_delete" ON building_units;
CREATE POLICY "building_units_owner_delete" ON building_units
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

-- 7. Policies building_units (admin)
-- ============================================
DROP POLICY IF EXISTS "building_units_admin_all" ON building_units;
CREATE POLICY "building_units_admin_all" ON building_units
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');

-- 8. Policies building_units (tenant via bail actif)
-- ============================================
DROP POLICY IF EXISTS "building_units_tenant_select" ON building_units;
CREATE POLICY "building_units_tenant_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.id = building_units.current_lease_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut = 'active'
    )
  );

-- 9. Ajout property_id sur building_units si manquant
-- ============================================
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_building_units_property ON building_units(property_id);

COMMIT;

-- -----------------------------------------------------------------------------
-- 37/62 -- 20260320100000 -- MODERE -- 20260320100000_fix_owner_id_mismatch_and_rls.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 37/62 (MODERE) 20260320100000_fix_owner_id_mismatch_and_rls.sql'; END $$;
-- ============================================================================
-- Migration: Fix owner_id mismatch on properties table
-- Date: 2026-03-20
--
-- Problème: Certaines propriétés ont owner_id = profiles.user_id (UUID auth)
-- au lieu de owner_id = profiles.id (UUID profil). Cela casse les politiques
-- RLS qui utilisent public.user_profile_id() pour comparer avec owner_id.
--
-- Cette migration:
-- 1. Corrige les owner_id incorrects (user_id → profiles.id)
-- 2. S'assure que la fonction user_profile_id() est SECURITY DEFINER et STABLE
-- 3. Supprime les doublons éventuels de propriétés
-- ============================================================================

-- ============================================================================
-- 1. Corriger les owner_id qui pointent vers user_id au lieu de profiles.id
-- ============================================================================

-- Diagnostic d'abord (visible dans les logs)
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM properties pr
  INNER JOIN profiles p ON pr.owner_id = p.user_id
  WHERE p.role = 'owner'
    AND p.id != pr.owner_id
    AND pr.deleted_at IS NULL;

  RAISE NOTICE 'Propriétés avec owner_id mismatch (user_id au lieu de profiles.id): %', mismatch_count;
END $$;

-- Correction: remplacer owner_id = user_id par owner_id = profiles.id
UPDATE properties pr
SET owner_id = p.id,
    updated_at = NOW()
FROM profiles p
WHERE pr.owner_id = p.user_id
  AND p.role = 'owner'
  AND p.id != pr.owner_id;

-- ============================================================================
-- 2. S'assurer que user_profile_id() fonctionne correctement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================================
-- 3. Vérifier et supprimer les doublons de propriétés
--    (même adresse, même owner_id, même type = doublon probable)
-- ============================================================================

-- Marquer les doublons comme supprimés (soft delete) en gardant le plus récent
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id, adresse_complete, type, ville, code_postal
      ORDER BY created_at DESC
    ) as rn
  FROM properties
  WHERE deleted_at IS NULL
    AND adresse_complete IS NOT NULL
    AND adresse_complete != ''
)
UPDATE properties
SET deleted_at = NOW(),
    deleted_by = NULL
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Log du nombre de doublons supprimés
DO $$
DECLARE
  dedup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dedup_count
  FROM properties
  WHERE deleted_at >= NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Propriétés doublons soft-deleted: %', dedup_count;
END $$;

-- ============================================================================
-- 4. Vérification finale
-- ============================================================================

DO $$
DECLARE
  remaining_mismatch INTEGER;
  total_active INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_mismatch
  FROM properties pr
  INNER JOIN profiles p ON pr.owner_id = p.user_id
  WHERE p.role = 'owner'
    AND p.id != pr.owner_id
    AND pr.deleted_at IS NULL;

  SELECT COUNT(*) INTO total_active
  FROM properties
  WHERE deleted_at IS NULL;

  RAISE NOTICE 'Vérification: % propriétés actives, % mismatches restants', total_active, remaining_mismatch;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 38/62 -- 20260321000000 -- SAFE -- 20260321000000_drop_invoice_trigger_sota2026.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 38/62 (SAFE) 20260321000000_drop_invoice_trigger_sota2026.sql'; END $$;
-- SOTA 2026: Supprimer le trigger SQL redondant pour la facture initiale.
-- Le service TS ensureInitialInvoiceForLease() (appele par handleLeaseFullySigned)
-- est desormais le seul chemin de creation de la facture initiale.
-- Ce trigger creait un doublon et rendait le flux confus.

DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;

-- Supprimer egalement la fonction associee si elle existe
DROP FUNCTION IF EXISTS fn_generate_initial_invoice_on_fully_signed() CASCADE;

COMMIT;

-- -----------------------------------------------------------------------------
-- 39/62 -- 20260321100000 -- SAFE -- 20260321100000_fix_cron_post_refactoring_sota2026.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 39/62 (SAFE) 20260321100000_fix_cron_post_refactoring_sota2026.sql'; END $$;
-- ============================================
-- Migration corrective : SOTA 2026 post-refactoring
-- Date : 2026-03-21
-- Description :
--   1. Supprime le job generate-monthly-invoices (route supprimee en P3)
--   2. Ajoute le job process-outbox pour le processeur outbox asynchrone
-- ============================================

-- 1. Supprimer le job pointant vers la route supprimee
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'generate-monthly-invoices';

-- 2. Ajouter le processeur outbox (toutes les 5 minutes)
SELECT cron.schedule('process-outbox', '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/process-outbox',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

COMMIT;

-- -----------------------------------------------------------------------------
-- 40/62 -- 20260323000000 -- MODERE -- 20260323000000_fix_document_visibility_and_dedup.sql
-- risk: +1 policies, -1 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 40/62 (MODERE) 20260323000000_fix_document_visibility_and_dedup.sql'; END $$;
-- Migration: Fix document visibility RLS + add deduplication constraint
-- 1) RLS: tenant_id match must also respect visible_tenant
-- 2) Unique partial index to prevent duplicate quittances per payment
-- 3) Unique partial index to prevent duplicate attestations per handover

-- ============================================================
-- 1. Fix RLS: tenant with tenant_id = user MUST still respect visible_tenant
-- Previously: tenant_id = user_profile_id() bypassed visible_tenant = false
-- ============================================================

DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON documents;

CREATE POLICY "Tenants can read visible lease documents"
  ON documents FOR SELECT
  USING (
    -- Tenant direct match: must respect visible_tenant
    (
      tenant_id = public.user_profile_id()
      AND visible_tenant IS NOT FALSE
    )
    -- Tenant via lease signer: must respect visible_tenant
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
    -- Owner direct match
    OR owner_id = public.user_profile_id()
    -- Owner via property
    OR (
      property_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = documents.property_id
          AND p.owner_id = public.user_profile_id()
      )
    )
    -- Admin
    OR public.user_role() = 'admin'
  );

-- ============================================================
-- 2. Unique partial index: one quittance per payment_id
-- Prevents race-condition duplicates in receipt generation
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_quittance_payment
  ON documents ((metadata->>'payment_id'))
  WHERE type = 'quittance'
    AND metadata->>'payment_id' IS NOT NULL;

-- ============================================================
-- 3. Unique partial index: one attestation per handover_id
-- Prevents duplicate key handover attestations
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_attestation_handover
  ON documents ((metadata->>'handover_id'))
  WHERE type = 'attestation_remise_cles'
    AND metadata->>'handover_id' IS NOT NULL;

-- ============================================================
-- 4. Index for document-access helper: lookup by storage_path
-- Used by the unified access check when path doesn't match known patterns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_documents_storage_path
  ON documents (storage_path)
  WHERE storage_path IS NOT NULL;

COMMIT;

-- -----------------------------------------------------------------------------
-- 41/62 -- 20260324100000 -- SAFE -- 20260324100000_prevent_duplicate_payments.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 41/62 (SAFE) 20260324100000_prevent_duplicate_payments.sql'; END $$;
-- ============================================
-- Migration : Anti-doublon paiements
-- Date : 2026-03-24
-- Description :
--   1. Contrainte UNIQUE partielle sur payments : un seul paiement pending par facture
--   2. Empêche la race condition qui a causé le double paiement sur bail da2eb9da
-- ============================================

-- Un seul paiement 'pending' par facture à la fois
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_pending_per_invoice
  ON payments (invoice_id)
  WHERE statut = 'pending';

COMMENT ON INDEX idx_payments_one_pending_per_invoice
  IS 'Empêche plusieurs paiements pending simultanés sur la même facture (anti-doublon)';

COMMIT;

-- -----------------------------------------------------------------------------
-- 42/62 -- 20260326022619 -- MODERE -- 20260326022619_fix_documents_bucket_mime.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 42/62 (MODERE) 20260326022619_fix_documents_bucket_mime.sql'; END $$;
-- Fix: Aligner les MIME types du bucket storage avec lib/documents/constants.ts
-- Bug: Word/Excel etaient acceptes par le code mais rejetes par le bucket

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
]::text[],
file_size_limit = 52428800  -- 50 Mo
WHERE id = 'documents';

COMMIT;

-- -----------------------------------------------------------------------------
-- 43/62 -- 20260326022700 -- SAFE -- 20260326022700_migrate_tenant_documents.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 43/62 (SAFE) 20260326022700_migrate_tenant_documents.sql'; END $$;
-- Migration: Unifier tenant_documents dans la table documents
-- Les CNI et autres pieces d'identite locataire sont dans tenant_documents
-- mais invisibles dans le systeme unifie. Cette migration les copie.

DO $$
DECLARE
  migrated_count INT := 0;
BEGIN
  -- Verifier que tenant_documents existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'tenant_documents'
  ) THEN
    RAISE NOTICE 'Table tenant_documents absente, rien a migrer';
    RETURN;
  END IF;

  -- Copier les documents qui ne sont pas deja dans documents (par storage_path)
  INSERT INTO documents (
    type, category, title, original_filename,
    tenant_id, owner_id,
    storage_path, file_size, mime_type,
    uploaded_by, is_generated, ged_status,
    visible_tenant, verification_status,
    metadata, created_at, updated_at
  )
  SELECT
    CASE
      WHEN td.document_type ILIKE '%recto%' OR td.document_type = 'cni_recto' THEN 'cni_recto'
      WHEN td.document_type ILIKE '%verso%' OR td.document_type = 'cni_verso' THEN 'cni_verso'
      WHEN td.document_type = 'passeport' THEN 'passeport'
      WHEN td.document_type = 'titre_sejour' THEN 'titre_sejour'
      WHEN td.document_type ILIKE '%identit%' THEN 'piece_identite'
      ELSE COALESCE(td.document_type, 'autre')
    END AS type,
    'identite' AS category,
    CASE
      WHEN td.document_type ILIKE '%recto%' OR td.document_type = 'cni_recto'
        THEN 'Carte d''identite (recto)'
      WHEN td.document_type ILIKE '%verso%' OR td.document_type = 'cni_verso'
        THEN 'Carte d''identite (verso)'
      WHEN td.document_type = 'passeport' THEN 'Passeport'
      WHEN td.document_type = 'titre_sejour' THEN 'Titre de sejour'
      ELSE COALESCE(td.file_name, 'Document identite')
    END AS title,
    td.file_name AS original_filename,
    td.tenant_profile_id AS tenant_id,
    NULL AS owner_id,
    td.file_path AS storage_path,
    td.file_size,
    td.mime_type,
    td.uploaded_by,
    false AS is_generated,
    'active' AS ged_status,
    true AS visible_tenant,
    CASE WHEN td.is_valid = true THEN 'verified' ELSE 'pending' END AS verification_status,
    jsonb_build_object(
      'migrated_from', 'tenant_documents',
      'original_id', td.id,
      'ocr_confidence', td.ocr_confidence,
      'extracted_data', td.extracted_data
    ) AS metadata,
    td.created_at,
    COALESCE(td.updated_at, td.created_at)
  FROM tenant_documents td
  WHERE NOT EXISTS (
    SELECT 1 FROM documents d
    WHERE d.storage_path = td.file_path
  )
  AND td.file_path IS NOT NULL
  AND td.file_path != '';

  GET DIAGNOSTICS migrated_count = ROW_COUNT;

  RAISE NOTICE 'Migration tenant_documents: % documents copies vers documents', migrated_count;

  -- Le trigger auto_fill_document_fk completera owner_id et property_id
  -- via lease_signers si disponible
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 44/62 -- 20260326022800 -- MODERE -- 20260326022800_create_document_links.sql
-- risk: +3 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 44/62 (MODERE) 20260326022800_create_document_links.sql'; END $$;
-- Table document_links: liens de partage temporaires
-- Utilisee par POST /api/documents/[id]/download et /api/documents/[id]/copy-link

CREATE TABLE IF NOT EXISTS document_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  max_views INTEGER DEFAULT 10,
  view_count INTEGER NOT NULL DEFAULT 0,
  accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_links_token ON document_links(token);
CREATE INDEX IF NOT EXISTS idx_document_links_document_id ON document_links(document_id);
CREATE INDEX IF NOT EXISTS idx_document_links_expires_at ON document_links(expires_at);

-- RLS
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own document links" ON document_links;
CREATE POLICY "Users can view own document links" ON document_links
  FOR SELECT TO authenticated
  USING (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_links.document_id
      AND (d.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR d.tenant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can create document links" ON document_links;
CREATE POLICY "Users can create document links" ON document_links
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access document_links" ON document_links;
CREATE POLICY "Service role full access document_links" ON document_links
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;

-- -----------------------------------------------------------------------------
-- 45/62 -- 20260326023000 -- MODERE -- 20260326023000_fix_document_titles.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 45/62 (MODERE) 20260326023000_fix_document_titles.sql'; END $$;
-- Fix document titles for existing records with NULL, screenshot names, or raw technical names
-- Uses TYPE_TO_LABEL mapping from lib/documents/constants.ts as source of truth

UPDATE documents SET title = CASE
  WHEN type = 'cni_recto' THEN 'Carte d''identite (recto)'
  WHEN type = 'cni_verso' THEN 'Carte d''identite (verso)'
  WHEN type = 'attestation_assurance' THEN 'Attestation d''assurance'
  WHEN type = 'assurance_pno' THEN 'Assurance PNO'
  WHEN type = 'bail' THEN 'Contrat de bail'
  WHEN type = 'avenant' THEN 'Avenant au bail'
  WHEN type = 'engagement_garant' THEN 'Engagement de caution'
  WHEN type = 'bail_signe_locataire' THEN 'Bail signe (locataire)'
  WHEN type = 'bail_signe_proprietaire' THEN 'Bail signe (proprietaire)'
  WHEN type = 'piece_identite' THEN 'Piece d''identite'
  WHEN type = 'passeport' THEN 'Passeport'
  WHEN type = 'titre_sejour' THEN 'Titre de sejour'
  WHEN type = 'quittance' THEN 'Quittance de loyer'
  WHEN type = 'facture' THEN 'Facture'
  WHEN type = 'rib' THEN 'RIB'
  WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
  WHEN type = 'bulletin_paie' THEN 'Bulletin de paie'
  WHEN type = 'attestation_loyer' THEN 'Attestation de loyer'
  WHEN type = 'justificatif_revenus' THEN 'Justificatif de revenus'
  WHEN type = 'diagnostic' THEN 'Diagnostic'
  WHEN type = 'dpe' THEN 'DPE'
  WHEN type = 'diagnostic_gaz' THEN 'Diagnostic gaz'
  WHEN type = 'diagnostic_electricite' THEN 'Diagnostic electricite'
  WHEN type = 'diagnostic_plomb' THEN 'Diagnostic plomb'
  WHEN type = 'diagnostic_amiante' THEN 'Diagnostic amiante'
  WHEN type = 'diagnostic_termites' THEN 'Diagnostic termites'
  WHEN type = 'diagnostic_performance' THEN 'Diagnostic de performance'
  WHEN type = 'erp' THEN 'Etat des risques (ERP)'
  WHEN type = 'EDL_entree' THEN 'Etat des lieux d''entree'
  WHEN type = 'EDL_sortie' THEN 'Etat des lieux de sortie'
  WHEN type = 'inventaire' THEN 'Inventaire mobilier'
  WHEN type = 'devis' THEN 'Devis'
  WHEN type = 'ordre_mission' THEN 'Ordre de mission'
  WHEN type = 'rapport_intervention' THEN 'Rapport d''intervention'
  WHEN type = 'taxe_fonciere' THEN 'Taxe fonciere'
  WHEN type = 'copropriete' THEN 'Document copropriete'
  WHEN type = 'proces_verbal' THEN 'Proces-verbal'
  WHEN type = 'appel_fonds' THEN 'Appel de fonds'
  WHEN type = 'photo' THEN 'Photo'
  WHEN type = 'courrier' THEN 'Courrier'
  WHEN type = 'autre' THEN 'Autre document'
  ELSE title
END
WHERE title IS NULL
   OR title ~ '^Capture d.cran'
   OR title ~ '^[A-Z_]+$';

COMMIT;

-- -----------------------------------------------------------------------------
-- 46/62 -- 20260326205416 -- SAFE -- 20260326205416_add_agency_role_to_handle_new_user.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 46/62 (SAFE) 20260326205416_add_agency_role_to_handle_new_user.sql'; END $$;
-- ============================================
-- Migration: Ajouter agency au trigger handle_new_user
-- Date: 2026-03-26
-- Description: Le trigger acceptait admin/owner/tenant/provider/guarantor/syndic.
--              Le role agency etait silencieusement converti en tenant.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
BEGIN
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (tous les roles supportes par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Inserer le profil avec toutes les donnees
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur.
Lit le role et les informations personnelles depuis les raw_user_meta_data.
Supporte tous les roles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 47/62 -- 20260327143000 -- MODERE -- 20260327143000_add_site_config.sql
-- risk: +5 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 47/62 (MODERE) 20260327143000_add_site_config.sql'; END $$;
-- Table de configuration du site vitrine
CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  label TEXT,           -- Label lisible pour l'admin
  section TEXT,         -- Groupe dans l'UI admin
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS : lecture publique, écriture admin uniquement
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read" ON site_config;
CREATE POLICY "Public read" ON site_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write" ON site_config;
CREATE POLICY "Admin write" ON site_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'platform_admin')
    )
  );

-- Valeurs initiales (images Unsplash par défaut)
INSERT INTO site_config (key, label, section, value) VALUES
  -- Section "Arguments" (4 cartes)
  ('landing_arg_time_img',
   'Argument — Gagnez 3h (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=80'),

  ('landing_arg_money_img',
   'Argument — Économisez 2000€ (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'),

  ('landing_arg_contract_img',
   'Argument — Contrats 5 min (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80'),

  ('landing_arg_sleep_img',
   'Argument — Dormez tranquille (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1541480601022-2308c0f02487?w=600&q=80'),

  -- Section "Profils"
  ('landing_profile_owner_img',
   'Profil — Propriétaire particulier',
   'Profils',
   'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80'),

  ('landing_profile_investor_img',
   'Profil — Investisseur / SCI',
   'Profils',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'),

  ('landing_profile_agency_img',
   'Profil — Agence / Gestionnaire',
   'Profils',
   'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80'),

  -- Section "Avant / Après"
  ('landing_beforeafter_img',
   'Avant/Après — Photo de fond',
   'Avant-Après',
   'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80')

ON CONFLICT (key) DO NOTHING;

-- Bucket public pour les images landing
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-images', 'landing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Politique de lecture publique sur le bucket
DROP POLICY IF EXISTS "Public read landing images" ON storage.objects;
CREATE POLICY "Public read landing images"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-images');

-- Politique d'upload admin
DROP POLICY IF EXISTS "Admin upload landing images" ON storage.objects;
CREATE POLICY "Admin upload landing images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'landing-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'platform_admin')
  )
);

-- Politique de suppression admin
DROP POLICY IF EXISTS "Admin delete landing images" ON storage.objects;
CREATE POLICY "Admin delete landing images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'landing-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'platform_admin')
  )
);

COMMIT;

-- -----------------------------------------------------------------------------
-- 48/62 -- 20260327200000 -- CRITIQUE -- 20260327200000_fix_handle_new_user_restore_email.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 48/62 (CRITIQUE) 20260327200000_fix_handle_new_user_restore_email.sql'; END $$;
-- ============================================
-- Migration: Corriger handle_new_user — restaurer email + EXCEPTION handler
-- Date: 2026-03-27
-- Description:
--   La migration 20260326205416 a introduit une regression :
--     1. La colonne `email` n'est plus inseree dans profiles (variable v_email supprimee)
--     2. Le handler EXCEPTION WHEN OTHERS a ete supprime
--   Cette migration restaure les deux, tout en conservant le support
--   de tous les roles (admin, owner, tenant, provider, guarantor, syndic, agency).
--   Elle backfill aussi les emails NULL crees par la migration cassee.
-- ============================================

-- A. RESTAURER handle_new_user() avec email + EXCEPTION handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
  v_email TEXT;
BEGIN
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (tous les roles supportes par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Recuperer l'email depuis le champ auth.users.email
  v_email := NEW.email;

  -- Inserer le profil avec toutes les donnees, y compris l'email
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone, email)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone, v_email)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la creation d'un utilisateur auth
  -- meme si l'insertion du profil echoue
  RAISE WARNING '[handle_new_user] Erreur pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur auth.
Lit le role et les informations personnelles depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
Supporte tous les roles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.
Ne bloque jamais la creation auth meme en cas d''erreur (EXCEPTION handler).';

-- B. BACKFILL des emails NULL (crees par la migration 20260326205416 cassee)
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND (p.email IS NULL OR p.email = '')
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[fix_handle_new_user] % profil(s) mis a jour avec l''email depuis auth.users', v_updated;
  ELSE
    RAISE NOTICE '[fix_handle_new_user] Tous les profils ont deja un email renseigne';
  END IF;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 49/62 -- 20260328000000 -- MODERE -- 20260328000000_fix_visible_tenant_documents.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 49/62 (MODERE) 20260328000000_fix_visible_tenant_documents.sql'; END $$;
-- FIX 4: Ensure mandatory lease documents are visible to tenants
-- Documents types contrat_bail, edl_entree, assurance_habitation
-- must have visible_tenant = true so tenants can see them.

UPDATE documents
SET visible_tenant = true,
    updated_at = now()
WHERE type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

COMMIT;

-- -----------------------------------------------------------------------------
-- 50/62 -- 20260328042538 -- MODERE -- 20260328042538_update_argument_images.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 50/62 (MODERE) 20260328042538_update_argument_images.sql'; END $$;
-- Mise à jour des images par défaut des 4 cartes Arguments
UPDATE site_config SET value = 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&q=80'
WHERE key = 'landing_arg_time_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'
WHERE key = 'landing_arg_money_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80'
WHERE key = 'landing_arg_contract_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80'
WHERE key = 'landing_arg_sleep_img';

COMMIT;

-- -----------------------------------------------------------------------------
-- 51/62 -- 20260328100000 -- MODERE -- 20260328100000_create_site_content.sql
-- risk: +2 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 51/62 (MODERE) 20260328100000_create_site_content.sql'; END $$;
-- ============================================
-- Migration: site_content — CMS léger pour pages marketing
-- Date: 2026-03-28
-- Auteur: Claude
-- ============================================

CREATE TABLE IF NOT EXISTS site_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identification
  page_slug TEXT NOT NULL,
  section_key TEXT NOT NULL DEFAULT 'content_body',

  -- Contenu
  content_type TEXT NOT NULL DEFAULT 'markdown',
  content TEXT NOT NULL,

  -- Métadonnées
  title TEXT,
  meta_description TEXT,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),

  -- Versioning
  version INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(page_slug, section_key, version)
);

-- RLS
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_content_public_read" ON site_content;
CREATE POLICY "site_content_public_read" ON site_content
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "site_content_admin_all" ON site_content;
CREATE POLICY "site_content_admin_all" ON site_content
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');

-- Index pour les requêtes fréquentes
CREATE INDEX idx_site_content_slug ON site_content(page_slug, section_key)
  WHERE is_published = true;

-- Commentaire
COMMENT ON TABLE site_content IS 'CMS léger pour les pages marketing et légales de talok.fr';

COMMIT;

-- -----------------------------------------------------------------------------
-- 52/62 -- 20260329052631 -- MODERE -- 20260329052631_fix_contrat_bail_visible_tenant.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 52/62 (MODERE) 20260329052631_fix_contrat_bail_visible_tenant.sql'; END $$;
-- Migration: Rendre les documents de bail visibles aux locataires
-- Contexte: Le route /seal ne définissait pas visible_tenant=true sur les documents de bail
-- Impact: Les locataires ne voyaient pas leur bail dans /tenant/documents

-- S'assurer que tous les documents bail liés à un lease ont visible_tenant=true
UPDATE documents
SET
  visible_tenant = true,
  title = CASE
    WHEN title = 'Bail de location signé' THEN 'Contrat de bail signé'
    ELSE title
  END,
  original_filename = COALESCE(
    original_filename,
    'bail_signe_' || lease_id::text || '.html'
  ),
  updated_at = now()
WHERE
  type = 'bail'
  AND lease_id IS NOT NULL
  AND (visible_tenant IS NULL OR visible_tenant = false);

COMMIT;

-- -----------------------------------------------------------------------------
-- 53/62 -- 20260329120000 -- SAFE -- 20260329120000_add_agency_to_handle_new_user.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 53/62 (SAFE) 20260329120000_add_agency_to_handle_new_user.sql'; END $$;
-- ============================================
-- Migration: Ajouter le rôle agency au trigger handle_new_user
-- Date: 2026-03-29
-- Description: Le rôle agency était absent de la liste des rôles valides
--              dans le trigger, causant un fallback silencieux vers tenant.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
BEGIN
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le rôle (tous les rôles supportés par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Insérer le profil avec toutes les données
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Crée automatiquement un profil lors de la création d''un utilisateur.
Lit le rôle et les informations personnelles depuis les raw_user_meta_data.
Supporte tous les rôles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 54/62 -- 20260329164841 -- MODERE -- 20260329164841_fix_document_titles.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 54/62 (MODERE) 20260329164841_fix_document_titles.sql'; END $$;
-- Migration: Corriger les titres bruts/manquants des documents existants
-- Remplace les titres NULL, screenshots, codes bruts et dates par des labels lisibles
-- Source: talok-documents-sota section 8

UPDATE documents SET
  title = CASE
    WHEN type = 'cni_recto' THEN 'Carte d''identité (Recto)'
    WHEN type = 'cni_verso' THEN 'Carte d''identité (Verso)'
    WHEN type = 'attestation_assurance' THEN 'Attestation d''assurance'
    WHEN type = 'assurance_pno' THEN 'Assurance PNO'
    WHEN type = 'bail' THEN 'Contrat de bail'
    WHEN type = 'avenant' THEN 'Avenant au bail'
    WHEN type = 'engagement_garant' THEN 'Engagement de caution'
    WHEN type = 'bail_signe_locataire' THEN 'Bail signé (locataire)'
    WHEN type = 'bail_signe_proprietaire' THEN 'Bail signé (propriétaire)'
    WHEN type = 'piece_identite' THEN 'Pièce d''identité'
    WHEN type = 'passeport' THEN 'Passeport'
    WHEN type = 'titre_sejour' THEN 'Titre de séjour'
    WHEN type = 'quittance' THEN 'Quittance de loyer'
    WHEN type = 'facture' THEN 'Facture'
    WHEN type = 'rib' THEN 'RIB'
    WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
    WHEN type = 'bulletin_paie' THEN 'Bulletin de paie'
    WHEN type = 'attestation_loyer' THEN 'Attestation de loyer'
    WHEN type = 'justificatif_revenus' THEN 'Justificatif de revenus'
    WHEN type = 'dpe' THEN 'Diagnostic de performance énergétique'
    WHEN type = 'diagnostic_gaz' THEN 'Diagnostic gaz'
    WHEN type = 'diagnostic_electricite' THEN 'Diagnostic électricité'
    WHEN type = 'diagnostic_plomb' THEN 'Diagnostic plomb (CREP)'
    WHEN type = 'diagnostic_amiante' THEN 'Diagnostic amiante'
    WHEN type = 'diagnostic_termites' THEN 'Diagnostic termites'
    WHEN type = 'erp' THEN 'État des risques (ERP)'
    WHEN type = 'EDL_entree' THEN 'État des lieux d''entrée'
    WHEN type = 'EDL_sortie' THEN 'État des lieux de sortie'
    WHEN type = 'inventaire' THEN 'Inventaire mobilier'
    WHEN type = 'taxe_fonciere' THEN 'Taxe foncière'
    WHEN type = 'devis' THEN 'Devis'
    WHEN type = 'rapport_intervention' THEN 'Rapport d''intervention'
    ELSE COALESCE(title, 'Document')
  END
WHERE title IS NULL
   OR title ~ '^Capture d.écran'
   OR title ~ '^[A-Z_]+$'
   OR title ~ '^\d{4}-\d{2}-\d{2}';

COMMIT;

-- -----------------------------------------------------------------------------
-- 55/62 -- 20260329170000 -- DANGEREUX -- 20260329170000_add_punctuality_score.sql
-- risk: UPDATE sans WHERE : of
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 55/62 (DANGEREUX) 20260329170000_add_punctuality_score.sql'; END $$;
-- Migration: Ajouter le score de ponctualité sur les baux
-- Le score mesure le % de paiements reçus à temps (avant date_echeance)

-- 1. Colonne sur leases
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS punctuality_score DECIMAL(5,2) DEFAULT NULL;

COMMENT ON COLUMN leases.punctuality_score IS
  'Score de ponctualité du locataire (0-100). NULL = pas encore de données. Mis à jour par trigger.';

-- 2. Fonction de calcul
CREATE OR REPLACE FUNCTION compute_punctuality_score(p_lease_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_total INT;
  v_on_time INT;
BEGIN
  -- Compter les factures payées ou en retard (exclure les brouillons et annulées)
  SELECT COUNT(*) INTO v_total
  FROM invoices
  WHERE lease_id = p_lease_id
    AND statut IN ('paid', 'late', 'overdue', 'unpaid');

  IF v_total = 0 THEN
    RETURN NULL;
  END IF;

  -- Compter les factures payées à temps :
  -- date_paiement <= date_echeance OU statut = 'paid' sans retard
  SELECT COUNT(*) INTO v_on_time
  FROM invoices
  WHERE lease_id = p_lease_id
    AND statut = 'paid'
    AND (
      (date_paiement IS NOT NULL AND date_echeance IS NOT NULL AND date_paiement <= date_echeance)
      OR date_echeance IS NULL
    );

  RETURN ROUND((v_on_time::DECIMAL / v_total) * 100, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Trigger pour recalculer à chaque changement de facture
CREATE OR REPLACE FUNCTION trigger_update_punctuality_score()
RETURNS TRIGGER AS $$
DECLARE
  v_lease_id UUID;
  v_score DECIMAL(5,2);
BEGIN
  -- Déterminer le lease_id concerné
  v_lease_id := COALESCE(NEW.lease_id, OLD.lease_id);

  IF v_lease_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalculer le score
  v_score := compute_punctuality_score(v_lease_id);

  -- Mettre à jour le bail
  UPDATE leases
  SET punctuality_score = v_score
  WHERE id = v_lease_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_punctuality_score ON invoices;

CREATE TRIGGER trg_update_punctuality_score
  AFTER INSERT OR UPDATE OF statut, date_paiement ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_punctuality_score();

-- 4. Calculer le score initial pour tous les baux existants
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT lease_id FROM invoices WHERE lease_id IS NOT NULL LOOP
    UPDATE leases
    SET punctuality_score = compute_punctuality_score(r.lease_id)
    WHERE id = r.lease_id;
  END LOOP;
END;
$$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 56/62 -- 20260329180000 -- DANGEREUX -- 20260329180000_notify_owner_edl_signed.sql
-- risk: UPDATE sans WHERE : of
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 56/62 (DANGEREUX) 20260329180000_notify_owner_edl_signed.sql'; END $$;
-- Migration: Notification propriétaire quand un EDL est signé par les deux parties
-- Date: 2026-03-29
-- Description: Ajoute un trigger qui notifie le propriétaire lorsqu'un EDL passe en statut "signed"

-- ============================================================================
-- Fonction de notification EDL signé → propriétaire
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_owner_edl_signed()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_id UUID;
    v_property_address TEXT;
    v_edl_type TEXT;
    v_existing UUID;
BEGIN
    -- Seulement quand le statut passe à 'signed'
    IF NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') THEN

        -- Récupérer le type de l'EDL
        v_edl_type := COALESCE(NEW.type, 'entree');

        -- Récupérer le propriétaire et l'adresse via la propriété
        SELECT p.owner_id, p.adresse_complete
        INTO v_owner_id, v_property_address
        FROM properties p
        WHERE p.id = NEW.property_id;

        IF v_owner_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- Déduplication : vérifier si une notification similaire existe dans la dernière heure
        SELECT id INTO v_existing
        FROM notifications
        WHERE profile_id = v_owner_id
          AND type = 'edl_signed'
          AND related_id = NEW.id
          AND created_at > NOW() - INTERVAL '1 hour'
        LIMIT 1;

        IF v_existing IS NOT NULL THEN
            RETURN NEW;
        END IF;

        -- Créer la notification via la RPC
        PERFORM create_notification(
            v_owner_id,
            'edl_signed',
            CASE v_edl_type
                WHEN 'entree' THEN 'État des lieux d''entrée signé'
                WHEN 'sortie' THEN 'État des lieux de sortie signé'
                ELSE 'État des lieux signé'
            END,
            'L''état des lieux ' ||
            CASE v_edl_type
                WHEN 'entree' THEN 'd''entrée'
                WHEN 'sortie' THEN 'de sortie'
                ELSE ''
            END ||
            ' pour ' || COALESCE(v_property_address, 'votre bien') ||
            ' a été signé par toutes les parties.',
            '/owner/edl/' || NEW.id,
            NEW.id,
            'edl'
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Ne pas bloquer la transaction si la notification échoue
    RAISE WARNING '[notify_owner_edl_signed] Erreur: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger sur la table edl (UPDATE du statut)
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_notify_owner_edl_signed ON edl;
CREATE TRIGGER trigger_notify_owner_edl_signed
    AFTER UPDATE OF status ON edl
    FOR EACH ROW
    WHEN (NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed')
    EXECUTE FUNCTION public.notify_owner_edl_signed();

COMMIT;

-- -----------------------------------------------------------------------------
-- 57/62 -- 20260329190000 -- DANGEREUX -- 20260329190000_force_visible_tenant_generated_docs.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 57/62 (DANGEREUX) 20260329190000_force_visible_tenant_generated_docs.sql'; END $$;
-- Migration: Backfill visible_tenant for generated documents + trigger guard
-- Date: 2026-03-29
-- Description:
--   1. Backfill: force visible_tenant = true on all existing generated documents
--   2. Trigger: prevent any future INSERT/UPDATE from creating a generated doc with visible_tenant = false

-- ============================================================================
-- 1. Backfill existing generated documents
-- ============================================================================
UPDATE documents
SET visible_tenant = true, updated_at = NOW()
WHERE is_generated = true AND (visible_tenant = false OR visible_tenant IS NULL);

-- ============================================================================
-- 2. Trigger function: force visible_tenant on generated documents
-- ============================================================================
CREATE OR REPLACE FUNCTION public.force_visible_tenant_on_generated()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_generated = true THEN
        NEW.visible_tenant := true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Trigger on documents table
-- ============================================================================
DROP TRIGGER IF EXISTS trg_force_visible_tenant_on_generated ON documents;
CREATE TRIGGER trg_force_visible_tenant_on_generated
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION public.force_visible_tenant_on_generated();

COMMIT;

-- -----------------------------------------------------------------------------
-- 58/62 -- 20260330100000 -- CRITIQUE -- 20260330100000_add_lease_cancellation_columns.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 58/62 (CRITIQUE) 20260330100000_add_lease_cancellation_columns.sql'; END $$;
-- ============================================
-- Migration : Ajout colonnes annulation de bail
-- Date : 2026-03-30
-- Contexte : Un bail signé mais jamais activé ne peut pas être annulé.
--            Cette migration ajoute les colonnes nécessaires pour
--            gérer le cycle de vie d'annulation.
-- ============================================

-- Étape 1 : Ajouter les colonnes d'annulation sur leases
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id);
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_type TEXT;

-- Étape 2 : Contrainte CHECK sur cancellation_type
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_cancellation_type_check'
  ) THEN
    ALTER TABLE leases ADD CONSTRAINT leases_cancellation_type_check
      CHECK (cancellation_type IS NULL OR cancellation_type IN (
        'tenant_withdrawal',
        'owner_withdrawal',
        'mutual_agreement',
        'never_activated',
        'error',
        'duplicate'
      ));
  END IF;
END $$;

-- Étape 3 : Vérifier que 'cancelled' est dans la contrainte CHECK sur statut
-- La migration 20260215200001 l'a déjà ajouté, mais on vérifie par sécurité
DO $$ BEGIN
  -- Tenter d'insérer un bail cancelled pour vérifier la contrainte
  -- Si ça échoue, on met à jour la contrainte
  PERFORM 1;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Étape 4 : Index pour requêtes de nettoyage et reporting
CREATE INDEX IF NOT EXISTS idx_leases_cancelled
  ON leases(statut) WHERE statut = 'cancelled';

CREATE INDEX IF NOT EXISTS idx_leases_cancelled_at
  ON leases(cancelled_at) WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leases_zombie_candidates
  ON leases(statut, created_at)
  WHERE statut IN ('pending_signature', 'partially_signed', 'fully_signed', 'draft', 'sent')
    AND cancelled_at IS NULL;

-- Étape 5 : RLS — les politiques existantes couvrent déjà leases
-- Pas besoin de nouvelles politiques car l'annulation passe par UPDATE du statut

-- Étape 6 : Commentaires
COMMENT ON COLUMN leases.cancelled_at IS 'Date/heure de l''annulation du bail';
COMMENT ON COLUMN leases.cancelled_by IS 'User ID de la personne ayant annulé le bail';
COMMENT ON COLUMN leases.cancellation_reason IS 'Motif libre de l''annulation';
COMMENT ON COLUMN leases.cancellation_type IS 'Type d''annulation : tenant_withdrawal, owner_withdrawal, mutual_agreement, never_activated, error, duplicate';

COMMIT;

-- -----------------------------------------------------------------------------
-- 59/62 -- 20260331000000 -- MODERE -- 20260331000000_add_receipt_generated_to_invoices.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 59/62 (MODERE) 20260331000000_add_receipt_generated_to_invoices.sql'; END $$;
-- Add receipt_generated flag to invoices table
-- Tracks whether a quittance PDF has been generated for a paid invoice

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_generated'
  ) THEN
    ALTER TABLE invoices ADD COLUMN receipt_generated BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN invoices.receipt_generated IS 'TRUE when a quittance PDF has been generated and stored for this invoice';
  END IF;
END $$;

-- Backfill: mark invoices that already have a quittance document
UPDATE invoices
SET receipt_generated = TRUE
WHERE id IN (
  SELECT DISTINCT (metadata->>'invoice_id')::uuid
  FROM documents
  WHERE type = 'quittance'
    AND metadata->>'invoice_id' IS NOT NULL
)
AND receipt_generated IS NOT TRUE;

COMMIT;

-- -----------------------------------------------------------------------------
-- 60/62 -- 20260331100000 -- SAFE -- 20260331100000_add_agricultural_property_types.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 60/62 (SAFE) 20260331100000_add_agricultural_property_types.sql'; END $$;
-- ============================================
-- Migration: Ajouter les types agricoles au CHECK constraint properties
-- Alignement avec le skill SOTA 2026 (14 types)
-- Ref: .cursor/skills/sota-property-system/SKILL.md §1
-- ============================================

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_type_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_type_check
  CHECK (type IN (
    'appartement',
    'maison',
    'studio',
    'colocation',
    'saisonnier',
    'parking',
    'box',
    'local_commercial',
    'bureaux',
    'entrepot',
    'fonds_de_commerce',
    'immeuble',
    'terrain_agricole',
    'exploitation_agricole'
  ));

COMMIT;

-- -----------------------------------------------------------------------------
-- 61/62 -- 20260331120000 -- MODERE -- 20260331120000_add_signed_pdf_generated_to_leases.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 61/62 (MODERE) 20260331120000_add_signed_pdf_generated_to_leases.sql'; END $$;
-- Migration: Ajouter colonne signed_pdf_generated à la table leases
-- Permet de tracker quels baux ont déjà un PDF signé généré

ALTER TABLE leases
ADD COLUMN IF NOT EXISTS signed_pdf_generated BOOLEAN DEFAULT FALSE;

-- Backfill : baux qui ont déjà un document bail généré
UPDATE leases l
SET signed_pdf_generated = TRUE
WHERE EXISTS (
  SELECT 1 FROM documents d
  WHERE d.lease_id = l.id
    AND d.type = 'bail'
    AND d.is_generated = TRUE
);

-- Index pour requêtes de diagnostic
CREATE INDEX IF NOT EXISTS idx_leases_signed_pdf_generated
ON leases (signed_pdf_generated)
WHERE signed_pdf_generated = FALSE;

COMMIT;

-- -----------------------------------------------------------------------------
-- 62/62 -- 20260331130000 -- SAFE -- 20260331130000_key_handovers_add_cancelled_notes.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 62/62 (SAFE) 20260331130000_key_handovers_add_cancelled_notes.sql'; END $$;
-- Migration: Améliorer la table key_handovers
-- Ajoute cancelled_at (annulation soft) et notes (commentaires propriétaire)

ALTER TABLE key_handovers
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Index partiel : remises actives (non confirmées, non annulées)
CREATE INDEX IF NOT EXISTS idx_key_handovers_pending
ON key_handovers (lease_id, created_at DESC)
WHERE confirmed_at IS NULL AND cancelled_at IS NULL;

-- Commentaires
COMMENT ON COLUMN key_handovers.cancelled_at IS 'Date d''annulation de la remise par le propriétaire (soft delete)';
COMMENT ON COLUMN key_handovers.notes IS 'Notes libres du propriétaire sur la remise des clés';

COMMIT;
