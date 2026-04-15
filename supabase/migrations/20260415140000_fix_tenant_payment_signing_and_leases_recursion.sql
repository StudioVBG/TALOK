-- =====================================================
-- Migration: Fix SOTA — tenant cash-receipt signature 500 + leases RLS recursion
-- Date: 2026-04-15
-- Branche: claude/fix-tenant-payment-signing-UuhJr
--
-- CONTEXTE — Deux bugs critiques côté tenant dashboard :
--
--   Bug #1 — POST /api/payments/cash-receipt/[id]/tenant-sign → 500
--     new row for relation "payments" violates check constraint
--     "payments_moyen_check"
--
--     ROOT CAUSE:
--       La RPC public.sign_cash_receipt_as_tenant (créée par
--       20260410220000, durcie par 20260415121706) insère dans public.payments
--       avec moyen = 'especes'. La migration 20241129000002_cash_payments.sql
--       était censée étendre le CHECK à ('cb', 'virement', 'prelevement',
--       'especes', 'cheque', 'autre') mais son bloc ALTER est wrappé dans
--       un `EXCEPTION WHEN others THEN NULL` → sur un environnement où le
--       ALTER a silencieusement échoué, le CHECK d'origine
--       ('cb', 'virement', 'prelevement') est resté en place. La migration
--       20260411120000_harden_payments_check_constraints.sql adresse le
--       problème mais ne garantit pas le reload du cache PostgREST sur tous
--       les runners PostgreSQL si elle a déjà été considérée appliquée.
--
--     FIX: Re-asserter le CHECK sans EXCEPTION catch-all, log explicite,
--     NOTIFY pgrst pour recharger le cache. Idempotent.
--
--   Bug #2 — useTenantRealtime → "infinite recursion detected in policy
--            for relation \"leases\"" (42P17)
--
--     ROOT CAUSE — Chaîne de récursion complète:
--       (1) Le tenant fait SELECT sur `leases` (hook useTenantRealtime,
--           lib/hooks/use-realtime-tenant.ts:215)
--       (2) Postgres évalue les policies sur leases. Parmi elles,
--           "Owners can view leases of own properties" (recréée par
--           20260410212232_fix_entity_members_policy_recursion.sql) fait:
--               EXISTS (SELECT 1 FROM properties p WHERE p.id =
--                 leases.property_id AND p.owner_id = user_profile_id())
--       (3) Le SELECT sur `properties` déclenche les policies de properties.
--           Parmi elles, "tenant_select_properties" (créée par
--           202502180002_fix_rls_conflicts_final.sql:53, JAMAIS DROPPÉE)
--           fait:
--               EXISTS (SELECT 1 FROM leases l
--                       JOIN lease_signers ls ON ls.lease_id = l.id
--                       WHERE l.property_id = properties.id
--                         AND ls.profile_id = user_profile_id()
--                         AND l.statut = 'active')
--       (4) Le SELECT sur `leases` de la sous-requête réexécute les policies
--           de leases → CYCLE → 42P17
--
--     NOTE:
--       La migration 20260410213940 a créé une policy équivalente
--       "Tenants can view linked properties" qui utilise
--       tenant_accessible_property_ids() en SECURITY DEFINER (donc pas de
--       récursion), MAIS n'a pas droppé "tenant_select_properties". Les
--       deux coexistent, et c'est la version non-SECURITY-DEFINER qui
--       casse le plan RLS.
--
--     Chaînes secondaires identiques via :
--       - tickets  → EXISTS(leases JOIN lease_signers) → leases → properties
--                    → tenant_select_properties → leases → BOUCLE
--       - charges  → idem
--       - units    → idem
--
--     FIX:
--       1. DROP "tenant_select_properties" (la SECURITY DEFINER cousine
--          "Tenants can view linked properties" couvre le même use case).
--       2. S'assurer que "Tenants can view linked properties" existe avec
--          le helper SECURITY DEFINER (idempotent — la migration 20260410213940
--          est supposée l'avoir créée, mais on garantit ici en defense-in-depth).
--       3. NOTIFY pgrst reload schema.
--
-- Conformité / sécurité:
--   - La policy SECURITY DEFINER est plus stricte : elle exige
--     l.statut NOT IN ('draft', 'cancelled') alors que tenant_select_properties
--     exigeait l.statut = 'active'. On élargit légèrement la visibilité
--     (pending_signature, fully_signed, notice_given, terminated) — conforme
--     à la décision produit de 20260215200000_fix_rls_properties_tenant_pre_active.sql.
-- =====================================================

BEGIN;

-- ============================================================
-- 1. Bug #1 — payments_moyen_check (defense-in-depth, pas d'EXCEPTION)
-- ============================================================
--
-- Whitelist canonique :
--   cb           Stripe carte bancaire (flow tenant)
--   virement     Virement manuel / Stripe SEPA
--   prelevement  SEPA Direct Debit
--   especes      Reçu espèces (signature en deux étapes)
--   cheque       Chèque papier (owner mark-paid)
--   autre        Fallback
--

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_moyen_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_moyen_check
  CHECK (moyen IN ('cb', 'virement', 'prelevement', 'especes', 'cheque', 'autre'));

-- On re-asserte aussi payments_statut_check dans la même passe : la
-- même migration 20260411120000 l'étend à 'cancelled'. Si elle n'est
-- pas appliquée, syncInvoiceStatusFromPayments échoue silencieusement
-- à chaque paiement manuel qui évince un PaymentIntent Stripe.
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_statut_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_statut_check
  CHECK (statut IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled'));

-- ============================================================
-- 2. Bug #2 — Récursion RLS infinie sur leases
-- ============================================================

-- 2a. S'assurer que le helper SECURITY DEFINER est en place (idempotent)
--     Même définition que 20260415130000 — fait office de safety net si la
--     migration précédente n'a pas été déployée.
CREATE OR REPLACE FUNCTION public.tenant_accessible_property_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT l.property_id
  FROM public.leases l
  JOIN public.lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = public.user_profile_id()
    AND l.statut NOT IN ('draft', 'cancelled');
$$;

REVOKE ALL ON FUNCTION public.tenant_accessible_property_ids() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.tenant_accessible_property_ids()
  TO authenticated, service_role;

-- 2b. DROP la policy récursive redondante.
--     tenant_select_properties contient un EXISTS(SELECT FROM leases) inline
--     qui crée la boucle avec "Owners can view leases of own properties"
--     (qui fait EXISTS(SELECT FROM properties)).
DROP POLICY IF EXISTS "tenant_select_properties" ON public.properties;

-- 2c. Garantir l'existence de la policy SECURITY DEFINER équivalente.
--     Si la migration 20260410213940 a été appliquée, la policy existe déjà
--     avec cette signature → DROP+CREATE la recrée à l'identique.
DROP POLICY IF EXISTS "Tenants can view linked properties" ON public.properties;

CREATE POLICY "Tenants can view linked properties"
  ON public.properties FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.tenant_accessible_property_ids()));

COMMENT ON POLICY "Tenants can view linked properties" ON public.properties IS
  'SOTA 2026 — Locataires peuvent voir les biens liés à leurs baux (hors '
  'draft/cancelled). Utilise tenant_accessible_property_ids() SECURITY '
  'DEFINER pour bypasser les RLS de leases/lease_signers et éviter la '
  'récursion infinie (42P17) via la chaîne leases→properties→leases.';

-- ============================================================
-- 3. Sanity check : aucune policy récursive résiduelle sur properties
-- ============================================================
DO $$
DECLARE
  v_remaining INT;
BEGIN
  -- Détecter toute policy sur properties dont le USING lit `leases` inline
  -- (signe d'une récursion latente qui réapparaîtrait au prochain query plan).
  SELECT count(*) INTO v_remaining
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'properties'
    AND (qual ILIKE '%FROM leases%' OR qual ILIKE '%JOIN leases%')
    -- Exclure les policies qui passent par le helper (pas de récursion)
    AND qual NOT ILIKE '%tenant_accessible_property_ids%';

  IF v_remaining > 0 THEN
    RAISE WARNING
      'ATTENTION: % policies RLS sur properties lisent encore `leases` inline — risque de récursion',
      v_remaining;
  ELSE
    RAISE NOTICE 'OK: aucune policy RLS sur properties ne lit `leases` inline';
  END IF;
END $$;

-- ============================================================
-- 4. Recharger le schema cache PostgREST
-- ============================================================
-- Nécessaire pour que les workers PostgREST existants re-lisent les
-- contraintes et policies sans redémarrage.

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
