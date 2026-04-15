-- =====================================================
-- Migration: Hardening SOTA de sign_cash_receipt_as_tenant
-- Date: 2026-04-15
-- Branche: claude/fix-cash-receipt-notification-fsMqC
--
-- Contexte:
--   La migration 20260410220000_cash_receipt_two_step_signature.sql a créé
--   la fonction sign_cash_receipt_as_tenant mais sans :
--     - SET search_path = public, pg_temp (risque d'injection via search_path)
--     - GRANT EXECUTE TO authenticated / service_role
--     - Vérification défensive de l'identité du locataire appelant
--     - NOTIFY pgrst pour recharger le cache
--
--   En production, le flow actuel passe par la route API qui utilise le
--   service role (bypass RLS), donc techniquement fonctionnel. Mais :
--     1. Sans GRANT explicite, tout appel direct depuis un client avec JWT
--        authenticated échoue ou dépend de l'exécution par défaut.
--     2. Sans search_path verrouillé, la fonction SECURITY DEFINER est
--        vulnérable aux attaques de search_path si `pg_temp` est prioritaire.
--     3. Sans tenant-check interne, un appel authenticated direct pourrait
--        signer le reçu d'un autre utilisateur si la RPC est exposée.
--
--   Cette migration :
--     1. Drop toutes les variantes connues de la fonction.
--     2. Recrée la fonction avec SECURITY DEFINER + search_path verrouillé.
--     3. Ajoute une vérification d'identité : si auth.uid() IS NOT NULL,
--        le caller doit correspondre au tenant du reçu (service_role bypass).
--     4. GRANT EXECUTE sur authenticated + service_role.
--     5. NOTIFY pgrst pour recharger le schema cache.
--
-- Conformité:
--   - Art. 21 loi n°89-462 du 6 juillet 1989
--   - Décret n°2015-587 du 6 mai 2015
-- =====================================================

BEGIN;

-- ============================================
-- 1. Drop de toutes les versions existantes
-- ============================================

-- Signature 6 args (migration 20260410220000)
DROP FUNCTION IF EXISTS public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
);

-- Filet de sécurité : drop toute autre surcharge existante
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sign_cash_receipt_as_tenant'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.signature || ' CASCADE';
  END LOOP;
END $$;

-- ============================================
-- 2. Recréation SOTA avec hardening complet
-- ============================================

CREATE OR REPLACE FUNCTION public.sign_cash_receipt_as_tenant(
  p_receipt_id UUID,
  p_tenant_signature TEXT,
  p_tenant_signed_at TIMESTAMPTZ DEFAULT NOW(),
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb
) RETURNS public.cash_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receipt       public.cash_receipts;
  v_payment       public.payments;
  v_caller_profile UUID;
  v_hash          TEXT;
  v_document_data TEXT;
BEGIN
  -- (a) Récupérer le reçu
  SELECT * INTO v_receipt FROM public.cash_receipts WHERE id = p_receipt_id;
  IF v_receipt.id IS NULL THEN
    RAISE EXCEPTION 'Reçu non trouvé'
      USING ERRCODE = 'P0002';
  END IF;

  -- (b) Idempotence / état
  IF v_receipt.status NOT IN ('pending_tenant', 'draft') THEN
    RAISE EXCEPTION 'Ce reçu a déjà été signé'
      USING ERRCODE = '23505';
  END IF;

  -- (c) Vérification d'identité défensive.
  --     - Si la fonction est appelée via une JWT authenticated (auth.uid()
  --       renvoie un user_id), on exige que le profile du caller == tenant_id.
  --     - Si auth.uid() est NULL (appel service_role via l'API route), on
  --       fait confiance au caller côté serveur, qui a déjà vérifié l'identité.
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO v_caller_profile
    FROM public.profiles
    WHERE user_id = auth.uid();

    IF v_caller_profile IS NULL OR v_caller_profile <> v_receipt.tenant_id THEN
      -- Admin bypass : un admin authentifié peut régulariser
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'admin'
      ) THEN
        RAISE EXCEPTION 'Ce reçu n''est pas adressé à votre compte'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- (d) Créer le paiement associé
  INSERT INTO public.payments (invoice_id, montant, moyen, date_paiement, statut)
  VALUES (v_receipt.invoice_id, v_receipt.amount, 'especes', CURRENT_DATE, 'succeeded')
  RETURNING * INTO v_payment;

  -- (e) Hash d'intégrité (deux signatures + contextes)
  v_document_data := v_receipt.invoice_id::TEXT
                  || '|' || v_receipt.amount::TEXT
                  || '|' || COALESCE(v_receipt.owner_signed_at::TEXT, '')
                  || '|' || p_tenant_signed_at::TEXT
                  || '|' || COALESCE(v_receipt.latitude::TEXT, '')
                  || '|' || COALESCE(v_receipt.longitude::TEXT, '')
                  || '|' || COALESCE(p_latitude::TEXT, '')
                  || '|' || COALESCE(p_longitude::TEXT, '');
  v_hash := encode(sha256(v_document_data::bytea), 'hex');

  -- (f) Finaliser le reçu
  UPDATE public.cash_receipts
  SET tenant_signature = p_tenant_signature,
      tenant_signed_at = p_tenant_signed_at,
      tenant_signature_latitude = p_latitude,
      tenant_signature_longitude = p_longitude,
      tenant_device_info = COALESCE(p_device_info, '{}'::jsonb),
      payment_id = v_payment.id,
      document_hash = v_hash,
      status = 'signed',
      updated_at = NOW()
  WHERE id = p_receipt_id
  RETURNING * INTO v_receipt;

  -- (g) Marquer la facture payée
  UPDATE public.invoices
  SET statut = 'paid'
  WHERE id = v_receipt.invoice_id;

  RETURN v_receipt;
END;
$$;

COMMENT ON FUNCTION public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
) IS
  'SOTA 2026 — Contresignature locataire d''un reçu espèces.
   Finalise la signature, crée le paiement et marque la facture comme payée.
   Vérification d''identité défensive (auth.uid() doit matcher tenant_id si
   présent). Conformité art. 21 loi 6 juillet 1989.';

-- ============================================
-- 3. Permissions explicites
-- ============================================

REVOKE ALL ON FUNCTION public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
) TO authenticated, service_role;

-- ============================================
-- 4. Forcer le rechargement du schema cache PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
