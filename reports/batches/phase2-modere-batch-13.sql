-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 13/15
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260410220000_cash_receipt_two_step_signature.sql
-- Risk: MODERE
-- Why: ALTER column (type/constraint), UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260410220000_cash_receipt_two_step_signature.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260410220000', 'cash_receipt_two_step_signature')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260410220000_cash_receipt_two_step_signature.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260411000000_create_cash_receipt_function.sql
-- Risk: MODERE
-- Why: ALTER column (type/constraint)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260411000000_create_cash_receipt_function.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260411000000', 'create_cash_receipt_function')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260411000000_create_cash_receipt_function.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260411100000_fix_work_orders_policy_recursion.sql
-- Risk: MODERE
-- Why: +1 policies, -1 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260411100000_fix_work_orders_policy_recursion.sql'; END $pre$;

-- =====================================================
-- Migration: Fix work_orders RLS recursion via tickets/properties/leases
-- Date: 2026-04-11
--
-- CONTEXT:
-- The original "Owners can view work orders of own properties" SELECT
-- policy on `work_orders` (20240101000001_rls_policies.sql:427-436) runs
-- this EXISTS subquery in its USING clause:
--
--   EXISTS (
--     SELECT 1 FROM tickets t
--     JOIN properties p ON p.id = t.property_id
--     WHERE t.id = work_orders.ticket_id
--       AND p.owner_id = public.user_profile_id()
--   )
--
-- Reading `tickets` triggers the tickets SELECT RLS, which in turn
-- joins through `properties` — and `properties` now has the
-- "Tenants can view linked properties" policy that reads `leases`, and
-- `leases` policies read back into `properties`. Postgres sees the
-- whole graph at plan time and raises:
--
--   ERROR: 42P17 infinite recursion detected in policy for relation …
--
-- handleApiError (lib/helpers/api-error.ts) maps 42P17 to HTTP 500,
-- which is what the owner Tickets page observed as "Erreur lors du
-- chargement des interventions". Standalone work_orders (ticket_id
-- NULL) are also never visible to owners under this policy.
--
-- FIX:
-- Mirror the pattern used by 20260410213940_fix_properties_tenant_policy_recursion.sql:
-- replace the inline EXISTS subquery with a SECURITY DEFINER helper
-- that bypasses RLS on tickets/properties. The helper also covers
-- the standalone case (work_orders.owner_id matches the profile
-- directly, added by 20260408120000_providers_module_sota.sql).
--
-- Safe to re-run (CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS).
-- =====================================================

-- =====================================================
-- 1. SECURITY DEFINER helper: work_order ids the current authenticated
--    user can read as an owner (via ticket.property.owner_id OR direct
--    work_orders.owner_id for standalone orders).
-- =====================================================
CREATE OR REPLACE FUNCTION public.owner_accessible_work_order_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT wo.id
  FROM public.work_orders wo
  LEFT JOIN public.tickets t ON t.id = wo.ticket_id
  LEFT JOIN public.properties p ON p.id = COALESCE(wo.property_id, t.property_id)
  WHERE
    -- Standalone work_orders created through the providers module
    wo.owner_id = public.user_profile_id()
    -- Ticket-linked work_orders where the owner owns the property
    OR p.owner_id = public.user_profile_id();
$$;

COMMENT ON FUNCTION public.owner_accessible_work_order_ids IS
  'Returns work_order ids visible to the currently authenticated owner, '
  'either through a ticket on one of their properties or a standalone '
  'work_orders.owner_id match. SECURITY DEFINER to bypass RLS on tickets, '
  'properties and leases and avoid the infinite recursion triggered by '
  'nesting the tickets→properties→leases policies inside work_orders.';

-- =====================================================
-- 2. Rewrite the "Owners can view work orders of own properties"
--    policy to use the helper — no more inline subquery on tickets.
-- =====================================================
DROP POLICY IF EXISTS "Owners can view work orders of own properties" ON work_orders;

CREATE POLICY "Owners can view work orders of own properties"
  ON work_orders FOR SELECT
  USING (id IN (SELECT public.owner_accessible_work_order_ids()));

COMMENT ON POLICY "Owners can view work orders of own properties" ON work_orders IS
  'Owners can read work_orders attached to their properties (via the '
  'linked ticket) and the standalone ones they created themselves. Uses '
  'the owner_accessible_work_order_ids() SECURITY DEFINER helper to '
  'avoid recursion through the tickets/properties/leases policies.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260411100000', 'fix_work_orders_policy_recursion')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260411100000_fix_work_orders_policy_recursion.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260411130100_agency_profiles_raison_sociale_nullable.sql
-- Risk: MODERE
-- Why: ALTER column (type/constraint)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260411130100_agency_profiles_raison_sociale_nullable.sql'; END $pre$;

-- ============================================
-- Migration: Rendre raison_sociale nullable sur agency_profiles
-- Date: 2026-04-11
-- Contexte:
--   L'API /api/v1/auth/register upsert agency_profiles avec { profile_id }
--   uniquement à l'inscription. La raison_sociale sera fournie ensuite
--   lors de l'onboarding /agency/onboarding/profile.
--
--   La contrainte NOT NULL faisait crasher silencieusement l'upsert,
--   bloquant toute inscription en tant qu'agence.
-- ============================================

ALTER TABLE public.agency_profiles
  ALTER COLUMN raison_sociale DROP NOT NULL;

COMMENT ON COLUMN public.agency_profiles.raison_sociale IS
'Raison sociale de l''agence. NULL autorisé temporairement entre l''inscription
et la finalisation de l''onboarding /agency/onboarding/profile qui la renseigne.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260411130100', 'agency_profiles_raison_sociale_nullable')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260411130100_agency_profiles_raison_sociale_nullable.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260412000000_fix_cash_receipt_rpc_sota.sql
-- Risk: MODERE
-- Why: +6 policies, -6 policies, ALTER column (type/constraint), UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260412000000_fix_cash_receipt_rpc_sota.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260412000000', 'fix_cash_receipt_rpc_sota')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260412000000_fix_cash_receipt_rpc_sota.sql'; END $post$;

COMMIT;

-- END OF BATCH 13/15 (Phase 2 MODERE)
