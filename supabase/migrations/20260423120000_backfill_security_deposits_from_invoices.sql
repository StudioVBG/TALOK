-- =====================================================
-- Backfill security_deposits from paid initial invoices
-- Date: 2026-04-23
--
-- Contexte : le trigger `trg_create_security_deposit` ne crée la ligne
-- security_deposits qu'à l'activation du bail (leases.statut = 'active').
-- Quand un dépôt est encaissé AVANT l'activation (Stripe, espèces,
-- virement, chèque…), la trace existe dans invoices.metadata mais n'est
-- rattachée à aucun suivi formel → onglet "Dépôts de garantie" vide
-- malgré l'argent reçu.
--
-- Cette migration :
--   1. Corrige les données historiques en créant / complétant les lignes
--      security_deposits à partir des factures initiales soldées.
--   2. Ajoute un trigger défensif sur invoices : dès qu'une facture
--      initiale passe à paid / partial avec metadata.includes_deposit,
--      on upsert la ligne security_deposits.
-- =====================================================

BEGIN;

-- =====================================================
-- 1) Fonction utilitaire partagée
-- =====================================================
CREATE OR REPLACE FUNCTION upsert_security_deposit_from_invoice(
  p_invoice_id UUID
) RETURNS UUID AS $$
DECLARE
  v_invoice RECORD;
  v_tenant_id UUID;
  v_deposit_euros NUMERIC;
  v_amount_cents INTEGER;
  v_deposit_id UUID;
  v_existing_status TEXT;
  v_existing_paid_at TIMESTAMPTZ;
  v_existing_method TEXT;
  v_existing_amount INTEGER;
  v_paid_at TIMESTAMPTZ;
  v_payment_method TEXT;
BEGIN
  SELECT id, lease_id, tenant_id, metadata, type, statut, date_paiement, paid_at
    INTO v_invoice
    FROM invoices
    WHERE id = p_invoice_id;

  IF NOT FOUND OR v_invoice.lease_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Facture initiale uniquement
  IF COALESCE(v_invoice.metadata->>'type', v_invoice.type) <> 'initial_invoice' THEN
    RETURN NULL;
  END IF;

  -- Inclut un dépôt ?
  IF COALESCE((v_invoice.metadata->>'includes_deposit')::boolean, false) = false THEN
    RETURN NULL;
  END IF;

  v_deposit_euros := COALESCE((v_invoice.metadata->>'deposit_amount')::numeric, 0);
  IF v_deposit_euros <= 0 THEN
    RETURN NULL;
  END IF;

  v_amount_cents := ROUND(v_deposit_euros * 100)::INTEGER;

  -- Locataire : champ dénormalisé sinon locataire principal du bail
  v_tenant_id := v_invoice.tenant_id;
  IF v_tenant_id IS NULL THEN
    SELECT ls.profile_id INTO v_tenant_id
    FROM lease_signers ls
    WHERE ls.lease_id = v_invoice.lease_id
      AND ls.role = 'locataire_principal'
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Date de paiement : on préfère date_paiement, fallback paid_at, fallback now()
  v_paid_at := COALESCE(
    v_invoice.date_paiement::timestamptz,
    v_invoice.paid_at,
    now()
  );

  -- Méthode : on regarde le paiement le plus récent lié à la facture
  SELECT moyen INTO v_payment_method
  FROM payments
  WHERE invoice_id = p_invoice_id
    AND statut = 'succeeded'
  ORDER BY date_paiement DESC NULLS LAST, created_at DESC
  LIMIT 1;

  -- Déjà une ligne ?
  SELECT id, status, paid_at, payment_method, amount_cents
    INTO v_deposit_id, v_existing_status, v_existing_paid_at, v_existing_method, v_existing_amount
    FROM security_deposits
    WHERE lease_id = v_invoice.lease_id;

  IF v_deposit_id IS NULL THEN
    INSERT INTO security_deposits (
      lease_id, tenant_id, amount_cents, paid_at, payment_method, status, metadata
    ) VALUES (
      v_invoice.lease_id,
      v_tenant_id,
      v_amount_cents,
      v_paid_at,
      v_payment_method,
      'received',
      jsonb_build_object('source', 'invoice_backfill', 'invoice_id', p_invoice_id)
    )
    ON CONFLICT (lease_id) DO NOTHING
    RETURNING id INTO v_deposit_id;
    RETURN v_deposit_id;
  END IF;

  -- Dépôt déjà clôturé : on n'y touche pas.
  IF v_existing_status IN ('returned', 'partially_returned', 'disputed') THEN
    RETURN v_deposit_id;
  END IF;

  UPDATE security_deposits SET
    status         = CASE WHEN status = 'pending' THEN 'received' ELSE status END,
    paid_at        = COALESCE(paid_at, v_paid_at),
    payment_method = COALESCE(payment_method, v_payment_method),
    amount_cents   = CASE
                       WHEN COALESCE(amount_cents, 0) <= 0 THEN v_amount_cents
                       ELSE amount_cents
                     END
  WHERE id = v_deposit_id;

  RETURN v_deposit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2) Backfill des factures initiales déjà soldées
-- =====================================================
DO $$
DECLARE
  v_count INTEGER := 0;
  v_invoice_id UUID;
BEGIN
  FOR v_invoice_id IN
    SELECT id
    FROM invoices
    WHERE COALESCE(metadata->>'type', type) = 'initial_invoice'
      AND COALESCE((metadata->>'includes_deposit')::boolean, false) = true
      AND COALESCE((metadata->>'deposit_amount')::numeric, 0) > 0
      AND statut IN ('paid', 'partial')
      AND lease_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM security_deposits sd
        WHERE sd.lease_id = invoices.lease_id
          AND sd.status IN ('received', 'partially_returned', 'returned', 'disputed')
      )
  LOOP
    IF upsert_security_deposit_from_invoice(v_invoice_id) IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfilled % security_deposits rows from paid initial invoices', v_count;
END $$;

-- =====================================================
-- 3) Trigger défensif sur invoices
--    → dès qu'une facture initiale devient paid / partial et inclut un
--      dépôt, on (re)synchronise la ligne security_deposits. La logique
--      applicative (TS) fait déjà ce travail, ce trigger sert de filet
--      de sécurité pour les flux qui contourneraient le code applicatif
--      (updates manuels, imports, correctifs SQL…).
-- =====================================================
CREATE OR REPLACE FUNCTION sync_security_deposit_on_invoice_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut IN ('paid', 'partial')
     AND (OLD.statut IS DISTINCT FROM NEW.statut OR OLD.statut IS NULL)
     AND COALESCE(NEW.metadata->>'type', NEW.type) = 'initial_invoice'
     AND COALESCE((NEW.metadata->>'includes_deposit')::boolean, false) = true THEN
    PERFORM upsert_security_deposit_from_invoice(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_security_deposit_on_invoice_paid ON invoices;
CREATE TRIGGER trg_sync_security_deposit_on_invoice_paid
  AFTER UPDATE OF statut ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION sync_security_deposit_on_invoice_paid();

COMMIT;
