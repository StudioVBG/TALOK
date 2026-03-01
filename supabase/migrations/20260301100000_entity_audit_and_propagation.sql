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
