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
