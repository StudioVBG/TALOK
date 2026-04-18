-- ====================================================================
-- Sprint B2 — Phase 1 SAFE — Batch 9/10
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
-- Migration: 20260412130000_copro_cron_schedules.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260412130000_copro_cron_schedules.sql'; END $pre$;

-- ============================================================
-- Migration: Schedule copro cron jobs via pg_cron + pg_net
-- Date: 2026-04-12
-- Description: Schedules 5 copropriété cron jobs for automated
--   reminders, alerts, and compliance checks.
-- ============================================================

-- Unschedule existing jobs (idempotent)
SELECT cron.unschedule('copro-convocation-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-convocation-reminders'
);

SELECT cron.unschedule('copro-fund-call-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-fund-call-reminders'
);

SELECT cron.unschedule('copro-overdue-alerts')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-overdue-alerts'
);

SELECT cron.unschedule('copro-assembly-countdown')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-assembly-countdown'
);

SELECT cron.unschedule('copro-pv-distribution')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-pv-distribution'
);

-- ============================================================
-- 1. copro-convocation-reminders — daily 9h UTC
-- ============================================================
SELECT cron.schedule('copro-convocation-reminders', '0 9 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-convocation-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 2. copro-fund-call-reminders — daily 8h UTC
-- ============================================================
SELECT cron.schedule('copro-fund-call-reminders', '0 8 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-fund-call-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 3. copro-overdue-alerts — Monday 8h UTC
-- ============================================================
SELECT cron.schedule('copro-overdue-alerts', '0 8 * * 1',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-overdue-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 4. copro-assembly-countdown — daily 7h UTC
-- ============================================================
SELECT cron.schedule('copro-assembly-countdown', '0 7 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-assembly-countdown',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 5. copro-pv-distribution — daily 10h UTC
-- ============================================================
SELECT cron.schedule('copro-pv-distribution', '0 10 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-pv-distribution',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- (removed) COMMENT ON SCHEMA cron IS '...' — requires supabase_admin ownership, skipped for SQL Editor execution

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260412130000', 'copro_cron_schedules')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260412130000_copro_cron_schedules.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260415130000_fix_tenant_accessible_property_ids_security_definer.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260415130000_fix_tenant_accessible_property_ids_security_definer.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260415130000', 'fix_tenant_accessible_property_ids_security_definer')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260415130000_fix_tenant_accessible_property_ids_security_definer.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260417090000_charges_reg_invoice_link.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260417090000_charges_reg_invoice_link.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Gap P0 #1 — Liaison régul ↔ invoice
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- Ajoute la colonne regularization_invoice_id sur
-- lease_charge_regularizations pour lier la régul à
-- l'invoice générée au moment du settle (Sprint 2).
--
-- Idempotent : utilise ADD COLUMN IF NOT EXISTS.
-- =====================================================

ALTER TABLE lease_charge_regularizations
  ADD COLUMN IF NOT EXISTS regularization_invoice_id UUID
    REFERENCES invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lcr_regularization_invoice_id
  ON lease_charge_regularizations(regularization_invoice_id)
  WHERE regularization_invoice_id IS NOT NULL;

COMMENT ON COLUMN lease_charge_regularizations.regularization_invoice_id IS
  'FK vers invoices — renseignée au settle lorsque le mode de règlement génère une facture (Stripe, next_rent, installments_12).';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260417090000', 'charges_reg_invoice_link')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260417090000_charges_reg_invoice_link.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260417090400_charges_pcg_accounts_backfill.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260417090400_charges_pcg_accounts_backfill.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Gap P0 #3 — Backfill comptes PCG charges
-- Date: 2026-04-17
-- Sprint: 0.b (Seeds PCG + EPCI — Régularisation des charges)
--
-- Ajoute les comptes PCG 419100 et 654000 pour toutes
-- les entities existantes. Les nouvelles entities sont
-- déjà couvertes via PCG_OWNER_ACCOUNTS dans
-- lib/accounting/chart-amort-ocr.ts (seed dynamique au
-- premier exercice).
--
-- Substitutions vs. skill théorique (voir section
-- "Mapping PCG Talok" dans .claude/skills/talok-charges-
-- regularization/SKILL.md) :
--   - skill '4191'   → Talok '419100' (uniformisation 6 chiffres)
--   - skill '654'    → Talok '654000' (idem)
--   - skill '614'    → Talok '614100' (déjà seedé, pas besoin de backfill)
--   - skill '708300' → Talok '708000' (déjà seedé, pas besoin de backfill)
--
-- Idempotent : ON CONFLICT (entity_id, account_number) DO NOTHING.
-- =====================================================

INSERT INTO chart_of_accounts (entity_id, account_number, label, account_type)
SELECT le.id, '419100', 'Provisions de charges recues', 'liability'
FROM legal_entities le
ON CONFLICT (entity_id, account_number) DO NOTHING;

INSERT INTO chart_of_accounts (entity_id, account_number, label, account_type)
SELECT le.id, '654000', 'Charges recuperables non recuperees', 'expense'
FROM legal_entities le
ON CONFLICT (entity_id, account_number) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260417090400', 'charges_pcg_accounts_backfill')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260417090400_charges_pcg_accounts_backfill.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260417090500_epci_reference_seed_drom.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260417090500_epci_reference_seed_drom.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Sprint 0.b — Seed EPCI DROM-COM
-- Date: 2026-04-17
-- Sprint: 0.b (Seeds PCG + EPCI — Régularisation des charges)
--
-- 23 EPCI DROM-COM — source : skill talok-charges-
-- regularization (compilé depuis DGCL / ADEME / données
-- publiques). Le skill annonçait "22 EPCI" mais le
-- décompte exact est : 3 (972) + 6 (971) + 5 (974)
-- + 4 (973) + 5 (976) = 23.
--
-- Seulement les champs vérifiables hors-ligne sont
-- renseignés : code_departement, epci_name,
-- waste_tax_type, teom_rate_pct, teom_rate_year, notes.
--
-- Les champs code_postal_pattern et syndicat_traitement
-- restent NULL (à compléter en ligne dans un sprint
-- ultérieur — besoin d'accès DGCL / INSEE).
--
-- La table epci_reference (créée en 0.a) n'a pas de
-- colonne siren par design : le lookup côté Sprint 2
-- se fait par code_postal_pattern / code_departement.
--
-- Idempotent : ON CONFLICT (code_departement, epci_name) DO NOTHING.
-- =====================================================

-- ---------------------------------------------------------------
-- 972 MARTINIQUE (3 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('972', 'CACEM', 'teom', 15.50, 2025, 'Communauté d''Agglomération du Centre de la Martinique'),
  ('972', 'Cap Nord Martinique', 'teom', 19.00, 2025, 'Communauté d''Agglomération du Nord de la Martinique'),
  ('972', 'Espace Sud', 'teom', 15.00, 2025, 'Communauté d''Agglomération de l''Espace Sud de la Martinique')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 971 GUADELOUPE (6 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('971', 'Cap Excellence', 'teom', 16.00, 2025, 'CA Cap Excellence (Pointe-à-Pitre / Les Abymes / Baie-Mahault)'),
  ('971', 'CANBT', 'teom', 14.00, 2025, 'CA du Nord Basse-Terre'),
  ('971', 'CARL', 'teom', 15.00, 2025, 'CA de la Riviera du Levant'),
  ('971', 'Grand Sud Caraïbe', 'teom', 16.00, 2025, 'CA Grand Sud Caraïbe'),
  ('971', 'CA Nord Grande-Terre', 'teom', 15.00, 2025, 'CA du Nord Grande-Terre'),
  ('971', 'CC Marie-Galante', 'teom', 18.00, 2025, 'CC Marie-Galante — surcoût transport maritime insulaire')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 974 LA RÉUNION (5 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('974', 'CINOR', 'teom', 12.00, 2025, 'CA de la Communauté Intercommunale du Nord de la Réunion'),
  ('974', 'CIREST', 'teom', 14.00, 2025, 'CA Communauté Intercommunale Réunion Est'),
  ('974', 'TCO', 'teom', 13.00, 2025, 'CA Territoire de la Côte Ouest'),
  ('974', 'CIVIS', 'teom', 15.00, 2025, 'CA Communauté Intercommunale des Villes Solidaires'),
  ('974', 'CASUD', 'teom', 14.50, 2025, 'CA du Sud Réunion')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 973 GUYANE (4 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('973', 'CACL', 'teom', 14.00, 2025, 'CA du Centre Littoral (Cayenne)'),
  ('973', 'CCDS', 'teom', 12.00, 2025, 'CC des Savanes'),
  ('973', 'CCOG', 'teom', 10.00, 2025, 'CC de l''Ouest Guyanais — couverture très faible ~25%'),
  ('973', 'CCEG', 'teom', 8.00, 2025, 'CC de l''Est Guyanais — Camopi: aucune TEOM (foncier État)')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 976 MAYOTTE (5 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('976', 'CADEMA', 'teom', 20.00, 2025, 'CA Dembéni-Mamoudzou — cadastre incomplet'),
  ('976', 'CC du Sud', 'teom', 18.00, 2025, 'Communauté de Communes du Sud'),
  ('976', 'CC Petite-Terre', 'teom', 19.00, 2025, 'Communauté de Communes de Petite-Terre'),
  ('976', 'CC Centre-Ouest', 'teom', 17.00, 2025, 'Communauté de Communes du Centre-Ouest'),
  ('976', 'CC du Nord', 'teom', 18.00, 2025, 'Communauté de Communes du Nord')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- =====================================================
-- TOTAL INSÉRÉ : 23 EPCI (3 + 6 + 5 + 4 + 5)
--
-- TODO Sprints ultérieurs :
-- 1. Compléter code_postal_pattern (liste communes par EPCI — source DGCL)
-- 2. Compléter syndicat_traitement (ex: SMTVD en Martinique, SYVADE en Guadeloupe)
-- 3. Étendre aux EPCI métropolitains (~1250 EPCI — accès DGCL requis)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260417090500', 'epci_reference_seed_drom')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260417090500_epci_reference_seed_drom.sql'; END $post$;

COMMIT;

-- END OF BATCH 9/10 (Phase 1 SAFE)
