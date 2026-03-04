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
