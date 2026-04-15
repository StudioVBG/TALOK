-- =====================================================
-- Migration: Hardening SOTA de tenant_accessible_property_ids
-- Date: 2026-04-15
-- Branche: claude/find-sign-receipt-function-Qszfz
--
-- Contexte:
--   La migration 20260410213940_fix_properties_tenant_policy_recursion.sql
--   a créé tenant_accessible_property_ids() en SECURITY DEFINER pour éviter
--   la récursion infinie RLS sur la policy "Tenants can view linked
--   properties" de la table properties.
--
--   Cette fonction est appelée depuis une policy RLS :
--     USING (id IN (SELECT public.tenant_accessible_property_ids()))
--   et lit leases + lease_signers — qui elles-mêmes ont des policies
--   référençant properties. Sans SECURITY DEFINER, on retombe dans la
--   boucle et Postgres lève 42P17 "infinite recursion detected in policy".
--
--   Cette migration durcit la fonction au même niveau SOTA que
--   20260415121706_harden_sign_cash_receipt_as_tenant.sql :
--     1. Recréation via CREATE OR REPLACE (signature inchangée) avec
--        SECURITY DEFINER + STABLE + search_path verrouillé sur
--        (public, pg_temp) — la version "simple" de cette migration
--        omettait pg_temp, ce qui rend la fonction SECURITY DEFINER
--        vulnérable aux attaques de search_path.
--     2. REVOKE ALL FROM PUBLIC + GRANT EXECUTE explicite à authenticated
--        et service_role (la policy est évaluée avec le rôle authenticated).
--     3. NOTIFY pgrst pour recharger le schema cache PostgREST.
--
--   NOTE: Pas de DROP FUNCTION ici — la policy
--   "Tenants can view linked properties" sur properties dépend de cette
--   fonction, donc un DROP (cascade ou non) soit supprimerait la policy,
--   soit ferait échouer la migration. CREATE OR REPLACE suffit puisque la
--   signature (() RETURNS SETOF UUID) est inchangée.
--
-- Conformité:
--   - Best practices Supabase / PostgREST 2026
--   - CERT-PG : PostgreSQL SECURITY DEFINER hardening
-- =====================================================

BEGIN;

-- ============================================
-- 1. Recréation SOTA avec hardening complet
-- ============================================

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

COMMENT ON FUNCTION public.tenant_accessible_property_ids() IS
  'SOTA 2026 — Retourne les property_id auxquels le profil authentifié a '
  'accès en tant que signataire d''un bail actif (non draft / non cancelled). '
  'SECURITY DEFINER + search_path verrouillé pour bypasser les RLS de '
  'leases / lease_signers et éviter la récursion infinie (42P17) sur la '
  'policy "Tenants can view linked properties" de properties.';

-- ============================================
-- 2. Permissions explicites
-- ============================================

REVOKE ALL ON FUNCTION public.tenant_accessible_property_ids() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.tenant_accessible_property_ids()
  TO authenticated, service_role;

-- ============================================
-- 3. Forcer le rechargement du schema cache PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
