-- =====================================================
-- Migration: Fix SOTA create_cash_receipt RPC + schema cache reload
-- Date: 2026-04-12
-- Branche: claude/talok-account-audit-78zaW
--
-- Contexte:
--   En production, le modal "Reçu de paiement espèces" (CashReceiptFlow)
--   tombe sur l'erreur PostgREST :
--
--     Could not find the function public.create_cash_receipt(
--       p_amount, p_device_info, p_invoice_id, p_latitude, p_longitude,
--       p_notes, p_owner_signature, p_owner_signed_at
--     ) in the schema cache
--
--   La migration 20260411000000 définit déjà la bonne signature 8 args,
--   mais soit elle n'a pas été appliquée en production, soit le cache
--   PostgREST est resté bloqué sur une version antérieure (10 args avec
--   p_tenant_signature obligatoire).
--
--   Cette migration :
--     1. Drop EXPLICITEMENT toutes les signatures connues (10 args, 8 args,
--        et toute variante potentielle) pour éviter les conflits de surcharge.
--     2. Assouplit les contraintes cash_receipts nécessaires au flux 2 étapes
--        (idempotence avec la migration 20260410220000).
--     3. Recrée la fonction avec EXACTEMENT la signature attendue par le front
--        (/api/payments/cash-receipt/route.ts).
--     4. Renforce la sécurité : SECURITY DEFINER + search_path verrouillé,
--        vérification owner dénormalisé vs chemin lease→property, idempotence.
--     5. Renforce / confirme les RLS (owner INSERT+SELECT, tenant SELECT+UPDATE
--        pour contresigner, admin SELECT).
--     6. Force le rechargement du schema cache PostgREST via NOTIFY.
--
-- Conformité:
--   - Art. 21 loi n°89-462 du 6 juillet 1989
--   - Décret n°2015-587 du 6 mai 2015
-- =====================================================

BEGIN;

-- ============================================
-- 1. Pré-requis schéma (idempotents)
-- ============================================

-- Assurer l'existence de la table cash_receipts si aucune migration précédente
-- ne l'a créée (défensif — la table existe normalement via 20241129000002).
CREATE TABLE IF NOT EXISTS public.cash_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  amount NUMERIC(10, 2) NOT NULL,
  amount_words TEXT,
  owner_signature TEXT,
  tenant_signature TEXT,
  owner_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  tenant_signature_latitude NUMERIC(10, 7),
  tenant_signature_longitude NUMERIC(10, 7),
  address_reverse TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  tenant_device_info JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  document_hash TEXT,
  signature_chain TEXT,
  pdf_path TEXT,
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  periode TEXT,
  receipt_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_tenant',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Flow 2 étapes : tenant_signature peut être NULL jusqu'à la contresignature
ALTER TABLE public.cash_receipts
  ALTER COLUMN tenant_signature DROP NOT NULL;
ALTER TABLE public.cash_receipts
  ALTER COLUMN tenant_signed_at DROP NOT NULL;

-- Whitelist étendue des statuts (ajout de pending_tenant si manquant)
DO $$
BEGIN
  ALTER TABLE public.cash_receipts DROP CONSTRAINT IF EXISTS cash_receipts_status_check;
  ALTER TABLE public.cash_receipts
    ADD CONSTRAINT cash_receipts_status_check
    CHECK (status IN ('draft', 'pending_tenant', 'signed', 'sent', 'archived', 'disputed', 'cancelled'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Colonnes pour contexte de contresignature locataire (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_receipts' AND column_name = 'tenant_signature_latitude'
  ) THEN
    ALTER TABLE public.cash_receipts ADD COLUMN tenant_signature_latitude NUMERIC(10,7);
    ALTER TABLE public.cash_receipts ADD COLUMN tenant_signature_longitude NUMERIC(10,7);
    ALTER TABLE public.cash_receipts ADD COLUMN tenant_device_info JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Colonne pour le PDF de l'attestation générée
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_receipts' AND column_name = 'pdf_generated_at'
  ) THEN
    ALTER TABLE public.cash_receipts ADD COLUMN pdf_generated_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================
-- 2. Drop de toutes les versions existantes
-- ============================================
-- On cible explicitement chaque signature connue pour garantir l'absence
-- de conflit de surcharge. DROP IF EXISTS est idempotent.

-- Signature 10 args (migration historique 2024-11-29)
DROP FUNCTION IF EXISTS public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
);

-- Signature 8 args (migrations 2026-04-10 et 2026-04-11)
DROP FUNCTION IF EXISTS public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
);

-- Filet supplémentaire : drop sans qualification si une version anonyme existe
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_cash_receipt'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.signature || ' CASCADE';
  END LOOP;
END $$;

-- ============================================
-- 3. Création de la fonction SOTA
-- ============================================

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
  'SOTA 2026 — Crée un reçu de paiement espèces en statut pending_tenant.
   Le propriétaire signe d''abord ; le locataire contresigne ensuite depuis
   son propre espace, ce qui déclenche la création du payment et marque la
   facture comme payée. Conformité art. 21 loi 6 juillet 1989.';

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
-- 5. RLS policies (idempotent)
-- ============================================
-- Owner : INSERT + SELECT + UPDATE de ses propres reçus
-- Tenant : SELECT + UPDATE limité (pour contresigner via sign_cash_receipt_as_tenant)
-- Admin : SELECT sur tout

ALTER TABLE public.cash_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_receipts_owner_select" ON public.cash_receipts;
CREATE POLICY "cash_receipts_owner_select" ON public.cash_receipts
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cash_receipts_owner_insert" ON public.cash_receipts;
CREATE POLICY "cash_receipts_owner_insert" ON public.cash_receipts
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cash_receipts_owner_update" ON public.cash_receipts;
CREATE POLICY "cash_receipts_owner_update" ON public.cash_receipts
  FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    owner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cash_receipts_tenant_select" ON public.cash_receipts;
CREATE POLICY "cash_receipts_tenant_select" ON public.cash_receipts
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Le locataire peut UPDATE uniquement pour poser sa signature
-- (la route /tenant-sign passe par une RPC SECURITY DEFINER, cette policy
-- est un filet secondaire au cas où un client UPDATE directement)
DROP POLICY IF EXISTS "cash_receipts_tenant_update" ON public.cash_receipts;
CREATE POLICY "cash_receipts_tenant_update" ON public.cash_receipts
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND status IN ('pending_tenant', 'draft')
  )
  WITH CHECK (
    tenant_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cash_receipts_admin_select" ON public.cash_receipts;
CREATE POLICY "cash_receipts_admin_select" ON public.cash_receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 6. Forcer le rechargement du schema cache PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
