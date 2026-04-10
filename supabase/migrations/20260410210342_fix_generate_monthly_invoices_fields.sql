-- =====================================================
-- Migration: Extend generate_monthly_invoices to populate period/type/metadata
-- Date: 2026-04-10
--
-- CONTEXT:
-- The previous version of this RPC (migration
-- 20260304000000_fix_invoice_generation_jour_paiement.sql) only
-- inserted `montant_loyer`, `montant_charges`, `montant_total`,
-- `date_echeance`, `invoice_number` and `statut`. It did NOT populate:
--   - period_start / period_end
--   - type (defaulted to 'loyer' but never set explicitly)
--   - metadata (defaulted to '{}' but never enriched)
--
-- Impact:
-- Monthly invoices had NULL period_start/period_end, which broke:
--   - Receipt PDF "Période du X au Y" rendering
--   - Accounting reports filtered on period_start
--   - Reconciliation queries looking up invoices by period bounds
-- metadata was empty so downstream jobs couldn't tell which invoices
-- came from the monthly cron vs. manual generation.
--
-- FIX:
-- Rewrite generate_monthly_invoices to compute period_start (first day
-- of target month), period_end (last day), set type='loyer', and
-- populate metadata with generation provenance. Everything else is
-- unchanged (loyer/charges/total calculation, jour_paiement handling,
-- anti-doublon via UNIQUE(lease_id, periode)).
--
-- STATUS IN PRODUCTION:
-- The missing fields were backfilled by a one-shot UPDATE during the
-- 2026-04-10 audit session. This migration ensures all FUTURE invoices
-- created by the cron include the fields automatically.
--
-- Safe to re-run (CREATE OR REPLACE FUNCTION).
-- =====================================================

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
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  -- Vérifier le format du mois (YYYY-MM)
  IF p_target_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Format de mois invalide. Attendu: YYYY-MM';
  END IF;

  -- Calculer les bornes du mois cible
  v_period_start := (p_target_month || '-01')::DATE;
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_days_in_month := EXTRACT(DAY FROM v_period_end)::INT;

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
      AND l.date_debut <= v_period_start
      AND (l.date_fin IS NULL OR l.date_fin >= v_period_start)
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
      period_start,
      period_end,
      invoice_number,
      statut,
      type,
      metadata,
      created_at,
      generated_at
    ) VALUES (
      v_lease.lease_id,
      v_lease.owner_id,
      v_lease.tenant_id,
      p_target_month,
      v_lease.loyer,
      v_lease.charges_forfaitaires,
      v_lease.loyer + v_lease.charges_forfaitaires,
      v_date_echeance,
      v_period_start,
      v_period_end,
      'QUI-' || REPLACE(p_target_month, '-', '') || '-' || UPPER(LEFT(v_lease.lease_id::TEXT, 8)),
      'sent',
      'loyer',
      jsonb_build_object(
        'type', 'loyer',
        'generated_by', 'generate_monthly_invoices',
        'target_month', p_target_month,
        'jour_paiement', v_jour_paiement
      ),
      NOW(),
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

COMMENT ON FUNCTION generate_monthly_invoices IS
  'Génère les factures de loyer pour tous les baux actifs pour un mois donné '
  '(YYYY-MM). Utilise leases.jour_paiement pour la date d''échéance, '
  'calcule period_start/period_end, et tag metadata.generated_by.';
