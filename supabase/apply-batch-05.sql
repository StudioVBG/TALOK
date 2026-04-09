-- Batch 5 — migrations 66 a 97 sur 169
-- 32 migrations

-- === [66/169] 20260301100000_entity_audit_and_propagation.sql ===
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


-- === [67/169] 20260303000000_backfill_uploaded_by.sql ===
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


-- === [68/169] 20260303100000_entity_rls_fix_and_optimize.sql ===
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


-- === [69/169] 20260304000000_fix_invoice_generation_jour_paiement.sql ===
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


-- === [70/169] 20260304000001_sync_sepa_collection_day.sql ===
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


-- === [71/169] 20260304100000_activate_pg_cron_schedules.sql ===
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


-- === [72/169] 20260304200000_auto_mark_late_invoices.sql ===
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


-- === [73/169] 20260305000001_invoice_engine_fields.sql ===
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


-- === [74/169] 20260305000002_payment_crons.sql ===
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


-- === [75/169] 20260305100000_fix_invoice_draft_notification.sql ===
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


-- === [76/169] 20260305100001_add_missing_notification_triggers.sql ===
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


-- === [77/169] 20260306000000_lease_documents_visible_tenant.sql ===
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


-- === [78/169] 20260306100000_add_digicode_interphone_columns.sql ===
-- Add digicode and interphone text columns to properties table
-- These store the actual access codes/names for tenant display

ALTER TABLE properties ADD COLUMN IF NOT EXISTS digicode TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS interphone TEXT;

COMMENT ON COLUMN properties.digicode IS 'Code digicode de l''immeuble';
COMMENT ON COLUMN properties.interphone IS 'Nom/numéro interphone du logement';


-- === [79/169] 20260306100000_invoice_on_fully_signed.sql ===
-- ============================================
-- Migration : Facture initiale à la signature du bail (fully_signed)
-- Date : 2026-03-06
-- Description :
--   1. Fonction generate_initial_signing_invoice : crée la facture initiale
--      (loyer prorata + charges + dépôt de garantie) dès que le bail est
--      entièrement signé, conformément à la Loi Alur / loi du 6 juillet 1989.
--   2. Trigger trg_invoice_on_lease_fully_signed : appelle la fonction
--      quand leases.statut → 'fully_signed'.
--   3. Garde anti-doublon dans trigger_invoice_engine_on_lease_active :
--      empêche generate_first_invoice si une initial_invoice existe déjà.
-- ============================================

-- =====================
-- 1. Fonction de génération de la facture initiale à la signature
-- =====================

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
  -- Récupérer les données du bail
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_loyer := COALESCE(v_lease.loyer, 0);
  v_charges := COALESCE(v_lease.charges_forfaitaires, 0);
  v_deposit := COALESCE(v_lease.depot_de_garantie, 0);
  v_date_debut := v_lease.date_debut;

  IF v_date_debut IS NULL THEN RETURN; END IF;

  v_month_str := TO_CHAR(v_date_debut, 'YYYY-MM');

  -- Garde anti-doublon : vérifier si une facture initial_invoice existe déjà
  SELECT EXISTS(
    SELECT 1 FROM invoices
    WHERE lease_id = p_lease_id
    AND metadata->>'type' = 'initial_invoice'
  ) INTO v_invoice_exists;
  IF v_invoice_exists THEN RETURN; END IF;

  -- Calcul prorata si le bail ne commence pas le 1er du mois
  v_total_days := EXTRACT(DAY FROM (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_prorata_days := v_total_days - EXTRACT(DAY FROM v_date_debut)::INT + 1;
  v_period_end := (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  IF v_prorata_days < v_total_days THEN
    -- Prorata
    v_prorata_loyer := ROUND((v_loyer * v_prorata_days / v_total_days), 2);
    v_prorata_charges := ROUND((v_charges * v_prorata_days / v_total_days), 2);
    v_is_prorated := true;
  ELSE
    -- Mois complet
    v_prorata_loyer := v_loyer;
    v_prorata_charges := v_charges;
  END IF;

  -- Date d'échéance : dû immédiatement (aujourd'hui ou date_debut, le plus tard)
  v_due_date := GREATEST(v_date_debut, CURRENT_DATE);

  -- Insérer la facture initiale (loyer + charges + dépôt)
  INSERT INTO invoices (
    lease_id, owner_id, tenant_id, periode,
    montant_loyer, montant_charges, montant_total,
    date_echeance, period_start, period_end,
    invoice_number, statut, generated_at, metadata, notes
  ) VALUES (
    p_lease_id, p_owner_id, p_tenant_id, v_month_str,
    v_prorata_loyer, v_prorata_charges,
    v_prorata_loyer + v_prorata_charges + v_deposit,
    v_due_date, v_date_debut, v_period_end,
    'INI-' || REPLACE(v_month_str, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
    'sent', NOW(),
    jsonb_build_object(
      'type', 'initial_invoice',
      'includes_deposit', true,
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

COMMENT ON FUNCTION generate_initial_signing_invoice IS
  'Génère la facture initiale (loyer prorata + dépôt de garantie) à la signature du bail, conformément à la Loi Alur';

-- =====================
-- 2. Trigger : bail fully_signed → facture initiale
-- =====================

CREATE OR REPLACE FUNCTION trigger_invoice_on_lease_fully_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_owner_id UUID;
BEGIN
  -- Ne déclencher que si le statut passe à 'fully_signed'
  IF NEW.statut = 'fully_signed' AND (OLD.statut IS DISTINCT FROM 'fully_signed') THEN

    -- Trouver le locataire principal
    SELECT ls.profile_id INTO v_tenant_id
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.id
    AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
    LIMIT 1;

    -- Trouver le propriétaire
    SELECT p.owner_id INTO v_owner_id
    FROM properties p
    WHERE p.id = NEW.property_id;

    IF v_tenant_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      PERFORM generate_initial_signing_invoice(NEW.id, v_tenant_id, v_owner_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;
CREATE TRIGGER trg_invoice_on_lease_fully_signed
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invoice_on_lease_fully_signed();

COMMENT ON FUNCTION trigger_invoice_on_lease_fully_signed IS
  'Déclenche la génération de la facture initiale quand un bail passe à fully_signed';

-- =====================
-- 3. Patch : garde anti-doublon dans trigger_invoice_engine_on_lease_active
--    Si une initial_invoice existe déjà (créée à la signature), on ne recrée pas
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
  v_initial_exists BOOLEAN;
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

      -- Vérifier si une initial_invoice existe déjà (créée à la signature)
      SELECT EXISTS(
        SELECT 1 FROM invoices
        WHERE lease_id = NEW.id
        AND metadata->>'type' = 'initial_invoice'
      ) INTO v_initial_exists;

      -- Générer la première facture SEULEMENT si aucune facture initiale n'existe
      IF NOT v_initial_exists THEN
        PERFORM generate_first_invoice(NEW.id, v_tenant_signer.profile_id, v_owner_id);
      END IF;

      -- Marquer le moteur comme démarré
      NEW.invoice_engine_started := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- === [80/169] 20260306100001_backfill_initial_invoices.sql ===
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


-- === [81/169] 20260306200000_notify_tenant_digicode_changed.sql ===
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


-- === [82/169] 20260306300000_add_owner_payment_preferences.sql ===
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


-- === [83/169] 20260309000000_entity_status_and_dedup.sql ===
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


-- === [84/169] 20260309000001_messages_update_rls.sql ===
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


-- === [85/169] 20260309000002_add_ticket_to_conversations.sql ===
-- Migration: Add ticket_id to conversations table for ticket-chat integration

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_ticket_id ON conversations(ticket_id);


-- === [86/169] 20260309100000_sync_subscription_plans_features.sql ===
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


-- === [87/169] 20260310000000_fix_subscription_plans_display_order.sql ===
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


-- === [88/169] 20260310100000_fix_property_limit_enforcement.sql ===
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


-- === [89/169] 20260310200000_add_signature_push_franceconnect.sql ===
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
CREATE POLICY "Users can view own FC sessions"
  ON franceconnect_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Seul le service role peut insérer/modifier (via l'API route)
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


-- === [90/169] 20260310200000_fix_property_limit_extra_properties.sql ===
-- =====================================================
-- Migration: Allow extra properties for paid plans
--
-- Problème: Le trigger enforce_property_limit() bloque la
-- création de biens au-delà de max_properties, même pour
-- les forfaits payants (Starter, Confort, Pro) qui permettent
-- d'ajouter des biens supplémentaires moyennant un surcoût.
--
-- Fix:
-- - Ajouter la colonne extra_property_price à subscription_plans
-- - Mettre à jour enforce_property_limit() pour ne pas bloquer
--   quand extra_property_price > 0 (biens supplémentaires autorisés)
-- =====================================================

-- 1. Ajouter la colonne extra_property_price si elle n'existe pas
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS extra_property_price INTEGER DEFAULT 0;

COMMENT ON COLUMN subscription_plans.extra_property_price IS
  'Prix en centimes par bien supplémentaire au-delà du quota inclus. 0 = pas de bien suppl. autorisé.';

-- 2. Peupler la colonne pour les plans existants
UPDATE subscription_plans SET extra_property_price = 0   WHERE slug = 'gratuit';
UPDATE subscription_plans SET extra_property_price = 300 WHERE slug = 'starter';    -- 3€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 250 WHERE slug = 'confort';    -- 2,50€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 200 WHERE slug = 'pro';        -- 2€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 0   WHERE slug LIKE 'enterprise%';

-- 3. Mettre à jour enforce_property_limit() pour autoriser les biens
--    supplémentaires sur les forfaits qui le permettent
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
  v_extra_property_price INTEGER;
BEGIN
  -- Compter les propriétés actives (non soft-deleted) avec un vrai COUNT
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL;

  -- Récupérer la limite du plan et le prix des biens supplémentaires
  SELECT
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit'),
    COALESCE(sp.extra_property_price, 0)
  INTO max_allowed, plan_slug, v_extra_property_price
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
    v_extra_property_price := 0;
  END IF;

  -- Si le forfait autorise des biens supplémentaires payants, ne pas bloquer
  IF v_extra_property_price > 0 THEN
    RETURN NEW;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enforce_property_limit() IS
  'Vérifie la limite de biens. Autorise les biens supplémentaires payants pour les forfaits avec extra_property_price > 0.';


-- === [91/169] 20260310300000_add_stripe_price_extra_property_id.sql ===
-- Add stripe_price_extra_property_id column to subscription_plans
-- Stores the Stripe Price ID for per-unit extra property billing

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_price_extra_property_id TEXT;

COMMENT ON COLUMN subscription_plans.stripe_price_extra_property_id
IS 'Stripe Price ID for recurring per-unit billing of extra properties beyond included quota';


-- === [92/169] 20260311100000_sync_subscription_plan_slugs.sql ===
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


-- === [93/169] 20260312000000_admin_dashboard_rpcs.sql ===
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


-- === [94/169] 20260312000001_fix_owner_subscription_defaults.sql ===
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
  WHEN (NEW.role = 'owner')
  FOR EACH ROW
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


-- === [95/169] 20260312100000_fix_handle_new_user_all_roles.sql ===
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


-- === [96/169] 20260314001000_fix_stripe_connect_rls.sql ===
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


-- === [97/169] 20260314020000_canonical_lease_activation_flow.sql ===
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


