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
