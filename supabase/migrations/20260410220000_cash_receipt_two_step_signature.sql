-- =====================================================
-- Migration: Reçu espèces — signature en deux étapes
-- Date: 2026-04-10
-- Description:
--   Le propriétaire crée le reçu avec sa signature uniquement.
--   Le locataire signe ensuite depuis son propre espace après
--   réception d'une notification.
-- =====================================================

BEGIN;

-- ============================================
-- 1. Assouplir le schéma cash_receipts
-- ============================================

-- La signature locataire doit pouvoir être NULL temporairement
ALTER TABLE cash_receipts
  ALTER COLUMN tenant_signature DROP NOT NULL;

ALTER TABLE cash_receipts
  ALTER COLUMN tenant_signed_at DROP NOT NULL;

-- Étendre les statuts possibles (ajouter pending_tenant)
DO $$
BEGIN
  ALTER TABLE cash_receipts DROP CONSTRAINT IF EXISTS cash_receipts_status_check;
  ALTER TABLE cash_receipts
    ADD CONSTRAINT cash_receipts_status_check
    CHECK (status IN ('draft', 'pending_tenant', 'signed', 'sent', 'archived', 'disputed', 'cancelled'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Nouvelles colonnes pour le contexte signature locataire
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_receipts' AND column_name = 'tenant_signature_latitude'
  ) THEN
    ALTER TABLE cash_receipts ADD COLUMN tenant_signature_latitude NUMERIC(10,7);
    ALTER TABLE cash_receipts ADD COLUMN tenant_signature_longitude NUMERIC(10,7);
    ALTER TABLE cash_receipts ADD COLUMN tenant_device_info JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================
-- 2. Drop ancienne fonction (signature à 10 args)
-- ============================================

DROP FUNCTION IF EXISTS create_cash_receipt(
  UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
);

-- ============================================
-- 3. Nouvelle fonction: création par le propriétaire
--    Crée le reçu en statut 'pending_tenant' avec
--    uniquement la signature du propriétaire.
--    Ne crée PAS de paiement — tant que le locataire
--    n'a pas signé, la facture reste impayée.
-- ============================================

CREATE OR REPLACE FUNCTION create_cash_receipt(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_owner_signature TEXT,
  p_owner_signed_at TIMESTAMPTZ DEFAULT NOW(),
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb,
  p_notes TEXT DEFAULT NULL
) RETURNS cash_receipts AS $$
DECLARE
  v_invoice invoices;
  v_receipt cash_receipts;
  v_hash TEXT;
  v_document_data TEXT;
BEGIN
  -- Récupérer la facture
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Facture non trouvée';
  END IF;

  IF v_invoice.statut = 'paid' THEN
    RAISE EXCEPTION 'Facture déjà payée';
  END IF;

  -- Vérifier qu'aucun reçu pending_tenant n'existe déjà pour cette facture
  IF EXISTS (
    SELECT 1 FROM cash_receipts
    WHERE invoice_id = p_invoice_id
      AND status IN ('pending_tenant', 'signed', 'sent')
  ) THEN
    RAISE EXCEPTION 'Un reçu existe déjà pour cette facture';
  END IF;

  -- Hash d'intégrité (partiel — complété lors de la signature locataire)
  v_document_data := p_invoice_id::TEXT || p_amount::TEXT ||
                     p_owner_signed_at::TEXT ||
                     COALESCE(p_latitude::TEXT, '') || COALESCE(p_longitude::TEXT, '');
  v_hash := encode(sha256(v_document_data::bytea), 'hex');

  -- Créer le reçu sans paiement ni mise à jour de la facture
  INSERT INTO cash_receipts (
    invoice_id, owner_id, tenant_id, property_id,
    amount, amount_words,
    owner_signature,
    owner_signed_at,
    latitude, longitude,
    device_info, document_hash,
    periode, notes, status
  )
  SELECT
    p_invoice_id,
    v_invoice.owner_id,
    v_invoice.tenant_id,
    l.property_id,
    p_amount,
    amount_to_french_words(p_amount),
    p_owner_signature,
    p_owner_signed_at,
    p_latitude,
    p_longitude,
    p_device_info,
    v_hash,
    v_invoice.periode,
    p_notes,
    'pending_tenant'
  FROM invoices i
  JOIN leases l ON i.lease_id = l.id
  WHERE i.id = p_invoice_id
  RETURNING * INTO v_receipt;

  RETURN v_receipt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. Nouvelle fonction: signature par le locataire
--    Complète le reçu avec la signature locataire,
--    crée le paiement et marque la facture comme payée.
-- ============================================

CREATE OR REPLACE FUNCTION sign_cash_receipt_as_tenant(
  p_receipt_id UUID,
  p_tenant_signature TEXT,
  p_tenant_signed_at TIMESTAMPTZ DEFAULT NOW(),
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb
) RETURNS cash_receipts AS $$
DECLARE
  v_receipt cash_receipts;
  v_payment payments;
  v_hash TEXT;
  v_document_data TEXT;
BEGIN
  -- Récupérer le reçu
  SELECT * INTO v_receipt FROM cash_receipts WHERE id = p_receipt_id;
  IF v_receipt IS NULL THEN
    RAISE EXCEPTION 'Reçu non trouvé';
  END IF;

  IF v_receipt.status NOT IN ('pending_tenant', 'draft') THEN
    RAISE EXCEPTION 'Ce reçu a déjà été signé';
  END IF;

  -- Créer le paiement associé
  INSERT INTO payments (invoice_id, montant, moyen, date_paiement, statut)
  VALUES (v_receipt.invoice_id, v_receipt.amount, 'especes', CURRENT_DATE, 'succeeded')
  RETURNING * INTO v_payment;

  -- Recalculer le hash d'intégrité avec les deux signatures
  v_document_data := v_receipt.invoice_id::TEXT || v_receipt.amount::TEXT ||
                     v_receipt.owner_signed_at::TEXT || p_tenant_signed_at::TEXT ||
                     COALESCE(v_receipt.latitude::TEXT, '') ||
                     COALESCE(v_receipt.longitude::TEXT, '') ||
                     COALESCE(p_latitude::TEXT, '') ||
                     COALESCE(p_longitude::TEXT, '');
  v_hash := encode(sha256(v_document_data::bytea), 'hex');

  -- Mettre à jour le reçu
  UPDATE cash_receipts
  SET tenant_signature = p_tenant_signature,
      tenant_signed_at = p_tenant_signed_at,
      tenant_signature_latitude = p_latitude,
      tenant_signature_longitude = p_longitude,
      tenant_device_info = p_device_info,
      payment_id = v_payment.id,
      document_hash = v_hash,
      status = 'signed',
      updated_at = NOW()
  WHERE id = p_receipt_id
  RETURNING * INTO v_receipt;

  -- Marquer la facture comme payée
  UPDATE invoices SET statut = 'paid' WHERE id = v_receipt.invoice_id;

  RETURN v_receipt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Index utile pour les reçus en attente
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cash_receipts_pending_tenant
  ON cash_receipts(tenant_id, status)
  WHERE status = 'pending_tenant';

COMMIT;
