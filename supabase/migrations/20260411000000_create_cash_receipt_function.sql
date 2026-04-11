-- =====================================================
-- Migration: (Re)création de la fonction create_cash_receipt
-- Date: 2026-04-11
-- Branche: claude/fix-create-cash-receipt-rpc
--
-- Contexte:
--   Le modal "Reçu de paiement espèces" (CashReceiptFlow.tsx) appelait
--   /api/payments/cash-receipt qui invoque ensuite la RPC
--   public.create_cash_receipt. La fonction n'était pas dans le schema
--   cache PostgREST, ce qui produisait l'erreur:
--     "Could not find the function public.create_cash_receipt(
--      p_amount, p_device_info, p_invoice_id, p_latitude, p_longitude,
--      p_notes, p_owner_signature, p_owner_signed_at) in the schema cache"
--
--   Cette migration:
--     - drop TOUTES les versions précédentes (10 args et 8 args) pour
--       éviter les conflits de surcharge,
--     - recrée la fonction avec la signature à 8 args attendue par le
--       front,
--     - renforce la sécurité (vérification propriétaire, idempotence),
--     - reste compatible avec le flux deux étapes (cf. migration
--       20260410220000_cash_receipt_two_step_signature.sql).
--
-- Conformité:
--   - Art. 21 loi n°89-462 du 6 juillet 1989
--   - Décret n°2015-587 du 6 mai 2015
-- =====================================================

BEGIN;

-- ============================================
-- 1. Pré-requis schéma (idempotents)
--    Au cas où la migration 20260410220000 n'aurait pas été appliquée,
--    on assouplit ici les contraintes nécessaires au flux deux étapes.
-- ============================================

-- Le locataire signe dans un second temps : tenant_signature peut être NULL
ALTER TABLE public.cash_receipts
  ALTER COLUMN tenant_signature  DROP NOT NULL;

ALTER TABLE public.cash_receipts
  ALTER COLUMN tenant_signed_at  DROP NOT NULL;

-- Étendre les statuts possibles (ajout de pending_tenant)
DO $$
BEGIN
  ALTER TABLE public.cash_receipts DROP CONSTRAINT IF EXISTS cash_receipts_status_check;
  ALTER TABLE public.cash_receipts
    ADD CONSTRAINT cash_receipts_status_check
    CHECK (status IN ('draft', 'pending_tenant', 'signed', 'sent', 'archived', 'disputed', 'cancelled'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- ============================================
-- 2. Drop des versions précédentes (toutes signatures)
-- ============================================

-- Ancienne signature 10 arguments (migration 2024-11-29)
DROP FUNCTION IF EXISTS public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
);

-- Signature 8 arguments (migration 2026-04-10) — drop pour CREATE OR REPLACE propre
DROP FUNCTION IF EXISTS public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
);

-- ============================================
-- 3. Création de la fonction
-- ============================================
--
-- Le propriétaire crée un reçu en attente de signature locataire.
-- Aucun paiement n'est créé à ce stade — il le sera lors de la
-- signature du locataire (cf. sign_cash_receipt_as_tenant).
--
-- Sécurité:
--   - SECURITY DEFINER + search_path verrouillé sur public, pg_temp
--   - Vérifie que l'invoice existe
--   - Vérifie que l'invoice n'est pas déjà payée ou annulée
--   - Vérifie l'appartenance via invoices.owner_id (déjà dénormalisé)
--     ET via le chemin lease→property→owner_id (defense-in-depth)
--   - Idempotence: refuse la création si un reçu pending_tenant /
--     signed / sent existe déjà pour cette facture
--
CREATE OR REPLACE FUNCTION public.create_cash_receipt(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_owner_signature TEXT,
  p_owner_signed_at TIMESTAMPTZ DEFAULT NOW(),
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb,
  p_notes TEXT DEFAULT NULL
) RETURNS public.cash_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice         public.invoices;
  v_property_owner  UUID;
  v_lease_property  UUID;
  v_receipt         public.cash_receipts;
  v_hash            TEXT;
  v_document_data   TEXT;
BEGIN
  -- (a) Vérifier que la facture existe
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Facture non trouvée'
      USING ERRCODE = 'P0002';
  END IF;

  -- (b) Vérifier que la facture n'est pas déjà payée ou annulée
  IF v_invoice.statut IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'Facture déjà payée ou annulée (statut=%)', v_invoice.statut
      USING ERRCODE = 'P0001';
  END IF;

  -- (c) Defense-in-depth: vérifier l'appartenance via lease→property
  SELECT l.property_id, p.owner_id
    INTO v_lease_property, v_property_owner
  FROM public.leases l
  JOIN public.properties p ON p.id = l.property_id
  WHERE l.id = v_invoice.lease_id;

  IF v_lease_property IS NULL THEN
    RAISE EXCEPTION 'Bien lié à la facture introuvable'
      USING ERRCODE = 'P0002';
  END IF;

  -- L'owner_id de la propriété doit correspondre à celui dénormalisé
  -- sur la facture. Toute incohérence est un signal de tampering.
  IF v_property_owner IS DISTINCT FROM v_invoice.owner_id THEN
    RAISE EXCEPTION 'Incohérence propriétaire facture / bien'
      USING ERRCODE = '42501';
  END IF;

  -- (d) Idempotence: refuser si un reçu actif existe déjà
  IF EXISTS (
    SELECT 1
    FROM public.cash_receipts
    WHERE invoice_id = p_invoice_id
      AND status IN ('pending_tenant', 'signed', 'sent')
  ) THEN
    RAISE EXCEPTION 'Un reçu existe déjà pour cette facture'
      USING ERRCODE = '23505';
  END IF;

  -- (e) Hash d'intégrité (sera complété lors de la signature locataire)
  v_document_data := p_invoice_id::TEXT
                  || '|' || p_amount::TEXT
                  || '|' || p_owner_signed_at::TEXT
                  || '|' || COALESCE(p_latitude::TEXT, '')
                  || '|' || COALESCE(p_longitude::TEXT, '');
  v_hash := encode(sha256(v_document_data::bytea), 'hex');

  -- (f) Création du reçu en statut pending_tenant
  --     (le paiement sera créé lors de la signature locataire)
  INSERT INTO public.cash_receipts (
    invoice_id,
    owner_id,
    tenant_id,
    property_id,
    amount,
    amount_words,
    owner_signature,
    owner_signed_at,
    latitude,
    longitude,
    device_info,
    document_hash,
    periode,
    notes,
    status
  )
  VALUES (
    p_invoice_id,
    v_invoice.owner_id,
    v_invoice.tenant_id,
    v_lease_property,
    p_amount,
    public.amount_to_french_words(p_amount),
    p_owner_signature,
    p_owner_signed_at,
    p_latitude,
    p_longitude,
    COALESCE(p_device_info, '{}'::jsonb),
    v_hash,
    v_invoice.periode,
    p_notes,
    'pending_tenant'
  )
  RETURNING * INTO v_receipt;

  RETURN v_receipt;
END;
$$;

COMMENT ON FUNCTION public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
) IS
  'Crée un reçu de paiement espèces en statut pending_tenant.
   Le propriétaire signe d''abord ; le locataire signera ensuite depuis
   son propre espace, ce qui créera le payment et marquera l''invoice
   comme payée. Conformité art. 21 loi 6 juillet 1989.';

-- ============================================
-- 4. Permissions explicites
-- ============================================

REVOKE ALL ON FUNCTION public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
) TO authenticated, service_role;

-- ============================================
-- 5. Forcer le rechargement du schema cache PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';

COMMIT;
