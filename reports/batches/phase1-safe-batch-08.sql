-- ====================================================================
-- Sprint B2 — Phase 1 SAFE — Batch 8/10
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
-- Migration: 20260410210342_fix_generate_monthly_invoices_fields.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260410210342_fix_generate_monthly_invoices_fields.sql'; END $pre$;

-- =====================================================
-- Migration: Extend generate_monthly_invoices to populate period/type/metadata
-- Date: 2026-04-10
--
-- CONTEXT:
-- The previous version of this RPC (migration
-- 20260304000000_fix_invoice_generation_jour_paiement.sql) only
-- inserted `montant_loyer`, `montant_charges`, `montant_total`,
-- `date_echeance`, `invoice_number` and `statut`. It did NOT populate:
--   - period_start / period_end
--   - type (defaulted to 'loyer' but never set explicitly)
--   - metadata (defaulted to '{}' but never enriched)
--
-- Impact:
-- Monthly invoices had NULL period_start/period_end, which broke:
--   - Receipt PDF "Période du X au Y" rendering
--   - Accounting reports filtered on period_start
--   - Reconciliation queries looking up invoices by period bounds
-- metadata was empty so downstream jobs couldn't tell which invoices
-- came from the monthly cron vs. manual generation.
--
-- FIX:
-- Rewrite generate_monthly_invoices to compute period_start (first day
-- of target month), period_end (last day), set type='loyer', and
-- populate metadata with generation provenance. Everything else is
-- unchanged (loyer/charges/total calculation, jour_paiement handling,
-- anti-doublon via UNIQUE(lease_id, periode)).
--
-- STATUS IN PRODUCTION:
-- The missing fields were backfilled by a one-shot UPDATE during the
-- 2026-04-10 audit session. This migration ensures all FUTURE invoices
-- created by the cron include the fields automatically.
--
-- Safe to re-run (CREATE OR REPLACE FUNCTION).
-- =====================================================

CREATE OR REPLACE FUNCTION generate_monthly_invoices(p_target_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_lease RECORD;
  v_result JSONB;
  v_days_in_month INT;
  v_jour_paiement INT;
  v_date_echeance DATE;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  -- Vérifier le format du mois (YYYY-MM)
  IF p_target_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Format de mois invalide. Attendu: YYYY-MM';
  END IF;

  -- Calculer les bornes du mois cible
  v_period_start := (p_target_month || '-01')::DATE;
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_days_in_month := EXTRACT(DAY FROM v_period_end)::INT;

  -- Parcourir tous les baux actifs qui n'ont pas encore de facture pour ce mois
  FOR v_lease IN
    SELECT
      l.id as lease_id,
      l.property_id,
      p.owner_id,
      ls.profile_id as tenant_id,
      l.loyer,
      l.charges_forfaitaires,
      COALESCE(l.jour_paiement, 5) as jour_paiement
    FROM leases l
    JOIN properties p ON p.id = l.property_id
    JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role IN ('locataire', 'locataire_principal')
    WHERE l.statut = 'active'
      AND l.date_debut <= v_period_start
      AND (l.date_fin IS NULL OR l.date_fin >= v_period_start)
      AND NOT EXISTS (
        SELECT 1 FROM invoices
        WHERE lease_id = l.id
          AND periode = p_target_month
      )
  LOOP
    -- Clamper jour_paiement au dernier jour du mois (ex: 30 → 28 en février)
    v_jour_paiement := LEAST(v_lease.jour_paiement, v_days_in_month);
    v_date_echeance := (p_target_month || '-' || LPAD(v_jour_paiement::TEXT, 2, '0'))::DATE;

    INSERT INTO invoices (
      lease_id,
      owner_id,
      tenant_id,
      periode,
      montant_loyer,
      montant_charges,
      montant_total,
      date_echeance,
      period_start,
      period_end,
      invoice_number,
      statut,
      type,
      metadata,
      created_at,
      generated_at
    ) VALUES (
      v_lease.lease_id,
      v_lease.owner_id,
      v_lease.tenant_id,
      p_target_month,
      v_lease.loyer,
      v_lease.charges_forfaitaires,
      v_lease.loyer + v_lease.charges_forfaitaires,
      v_date_echeance,
      v_period_start,
      v_period_end,
      'QUI-' || REPLACE(p_target_month, '-', '') || '-' || UPPER(LEFT(v_lease.lease_id::TEXT, 8)),
      'sent',
      'loyer',
      jsonb_build_object(
        'type', 'loyer',
        'generated_by', 'generate_monthly_invoices',
        'target_month', p_target_month,
        'jour_paiement', v_jour_paiement
      ),
      NOW(),
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'month', p_target_month,
    'generated_count', v_count
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_monthly_invoices IS
  'Génère les factures de loyer pour tous les baux actifs pour un mois donné '
  '(YYYY-MM). Utilise leases.jour_paiement pour la date d''échéance, '
  'calcule period_start/period_end, et tag metadata.generated_by.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260410210342', 'fix_generate_monthly_invoices_fields')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260410210342_fix_generate_monthly_invoices_fields.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260411120000_harden_payments_check_constraints.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260411120000_harden_payments_check_constraints.sql'; END $pre$;

-- =====================================================
-- Migration: Harden payments CHECK constraints for manual flows
-- Date: 2026-04-11
--
-- CONTEXT:
-- The manual payment modal (`ManualPaymentDialog.tsx`) POSTs to
-- /api/invoices/[id]/mark-paid with `moyen` ∈ {especes, cheque, virement,
-- autre}. The corresponding CHECK on `payments.moyen` was updated to
-- this set by 20241129000002_cash_payments.sql, but the block was
-- wrapped in `EXCEPTION WHEN others THEN NULL` — meaning if the ALTER
-- failed for any reason (e.g. unnamed legacy constraint, parallel
-- migration race, existing row violation), the DB silently kept the
-- original check `('cb', 'virement', 'prelevement')`. On an environment
-- where the update never landed, inserting a `moyen = 'cheque'` row
-- raises:
--
--     new row for relation "payments" violates check constraint
--     "payments_moyen_check"
--
-- …which in mark-paid bubbles up to the outer catch and returns a
-- plain 500 "Erreur serveur" — exactly what the user sees on the
-- chèque / virement / espèces flows.
--
-- Similarly, `syncInvoiceStatusFromPayments` (lib/services/invoice-
-- status.service.ts) cancels stale pending payments by setting
-- `statut = 'cancelled'`, but the current CHECK only allows
-- ('pending', 'succeeded', 'failed', 'refunded'). The update silently
-- fails because the JS client doesn't throw on constraint errors for
-- bulk updates — we've been leaking orphan `pending` rows in the
-- background.
--
-- FIX:
-- Re-assert both constraints with the canonical allowed sets. No
-- EXCEPTION catch-all this time: if this ALTER fails, we want to know
-- loudly (the prior silent path is precisely why the prod DB drifted
-- from the migration history in the first place).
--
-- Safe to re-run: the DROP is IF EXISTS and the ADD is idempotent in
-- the sense that re-running the migration against an already-good DB
-- simply replaces the constraint with an equivalent one.
-- =====================================================

BEGIN;

-- ============================================
-- 1. payments.moyen — all manual + provider methods
-- ============================================
--
-- Allowed:
--   cb           Stripe card (tenant)
--   virement     Manual bank transfer (owner marks paid) OR Stripe SEPA
--   prelevement  SEPA Direct Debit
--   especes      Cash receipt (two-step signature flow)
--   cheque       Paper cheque (owner marks paid)
--   autre        Fallback (no specific method)
--
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_moyen_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_moyen_check
  CHECK (moyen IN ('cb', 'virement', 'prelevement', 'especes', 'cheque', 'autre'));

-- ============================================
-- 2. payments.statut — include 'cancelled' for pending cleanup
-- ============================================
--
-- Allowed:
--   pending      Created, awaiting provider confirmation
--   processing   Provider is processing (e.g. SEPA in flight)
--   succeeded    Settled
--   failed       Provider rejected
--   refunded     Chargeback / manual refund
--   cancelled    Superseded by another payment (used by
--                syncInvoiceStatusFromPayments when a full manual
--                payment makes a Stripe PaymentIntent orphaned)
--
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_statut_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_statut_check
  CHECK (statut IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled'));

-- ============================================
-- 3. Reload PostgREST schema cache
-- ============================================
-- Required for existing PostgREST workers to pick up the new
-- constraint definitions without a restart.

NOTIFY pgrst, 'reload schema';

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260411120000', 'harden_payments_check_constraints')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260411120000_harden_payments_check_constraints.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260411120000_schedule_onboarding_reminders_cron.sql
-- Note: file on disk is 20260411120000_schedule_onboarding_reminders_cron.sql but will be renamed to 20260411120001_schedule_onboarding_reminders_cron.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260411120000_schedule_onboarding_reminders_cron.sql'; END $pre$;

-- ============================================
-- Migration : Planifier le cron onboarding-reminders
-- Date : 2026-04-11
-- Description : Ajoute la planification pg_cron pour la route
--   /api/cron/onboarding-reminders. Cette route envoie les relances
--   d'onboarding (24h, 72h, 7 jours) aux utilisateurs n'ayant pas
--   terminé leur parcours. Elle existait dans le code mais n'était
--   jamais déclenchée en production faute d'entrée dans cron.job.
--
-- Prérequis (déjà configurés par 20260304100000_activate_pg_cron_schedules.sql) :
--   - Extensions pg_cron + pg_net actives
--   - app.settings.app_url défini
--   - app.settings.cron_secret défini
-- ============================================

-- Idempotence : supprimer un éventuel job existant
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'onboarding-reminders') THEN
    PERFORM cron.unschedule('onboarding-reminders');
  END IF;
END $$;

-- Planifier le cron : toutes les heures, pile (cf. commentaire dans
-- app/api/cron/onboarding-reminders/route.ts : "exécuter toutes les heures")
SELECT cron.schedule('onboarding-reminders', '0 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/onboarding-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260411120001', 'schedule_onboarding_reminders_cron')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260411120000_schedule_onboarding_reminders_cron.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260411130300_onboarding_role_constraints_allow_syndic_agency.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260411130300_onboarding_role_constraints_allow_syndic_agency.sql'; END $pre$;

-- ============================================
-- Migration : Autoriser syndic + agency dans onboarding_analytics et onboarding_reminders
-- Date : 2026-04-11
-- Contexte :
--   La migration 20260114000000 a créé les tables `onboarding_analytics`
--   et `onboarding_reminders` avec une contrainte CHECK sur `role` limitée
--   à ('owner', 'tenant', 'provider', 'guarantor').
--
--   Résultat : toute tentative de tracer l'onboarding d'un compte syndic
--   ou agency (appelée depuis useOnboarding → onboardingAnalyticsService
--   → startOnboarding) échoue avec une violation de contrainte CHECK.
--
--   De même, impossible de planifier un rappel d'onboarding (24h/72h/7d)
--   ou une relance de complétion pour un syndic ou une agence.
--
--   Cette migration remplace la contrainte par la liste complète des rôles
--   supportés par la plateforme Talok.
-- ============================================

ALTER TABLE public.onboarding_analytics
  DROP CONSTRAINT IF EXISTS onboarding_analytics_role_check;

ALTER TABLE public.onboarding_analytics
  ADD CONSTRAINT onboarding_analytics_role_check
  CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency'));

ALTER TABLE public.onboarding_reminders
  DROP CONSTRAINT IF EXISTS onboarding_reminders_role_check;

ALTER TABLE public.onboarding_reminders
  ADD CONSTRAINT onboarding_reminders_role_check
  CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency'));

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260411130300', 'onboarding_role_constraints_allow_syndic_agency')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260411130300_onboarding_role_constraints_allow_syndic_agency.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260412120000_copro_fund_call_lines_reminder_tracking.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260412120000_copro_fund_call_lines_reminder_tracking.sql'; END $pre$;

-- =====================================================
-- Migration: Ajouter le tracking des relances sur copro_fund_call_lines
-- Date: 2026-04-12
-- Sprint: S3-1 — claude/talok-account-audit-78zaW
--
-- Contexte :
--   Le cron `copro-fund-call-reminders` (S3-1) doit envoyer des relances
--   aux copropriétaires en retard à J+10, J+30, J+60. Pour éviter de
--   spammer (et pour tracer l'historique), il faut pouvoir vérifier
--   quand la dernière relance a été envoyée et combien au total.
--
--   Ces colonnes n'existaient pas sur `copro_fund_call_lines`. Elles
--   existent déjà sur `invoices` pour le cron payment-reminders — on
--   copie ce pattern.
--
-- Colonnes ajoutées :
--   - reminder_count INTEGER DEFAULT 0 : compteur total de relances
--   - last_reminder_at TIMESTAMPTZ : timestamp de la dernière relance
-- =====================================================

BEGIN;

ALTER TABLE public.copro_fund_call_lines
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.copro_fund_call_lines
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

COMMENT ON COLUMN public.copro_fund_call_lines.reminder_count IS
  'Nombre total de relances envoyées pour cette ligne (cron copro-fund-call-reminders, S3-1).';

COMMENT ON COLUMN public.copro_fund_call_lines.last_reminder_at IS
  'Timestamp de la dernière relance envoyée. NULL si aucune relance envoyée.';

-- Index pour éviter le seq scan du cron qui filtre sur reminder_count
CREATE INDEX IF NOT EXISTS idx_copro_fund_call_lines_reminder_tracking
  ON public.copro_fund_call_lines(reminder_count, last_reminder_at)
  WHERE payment_status IN ('pending', 'partial');

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260412120000', 'copro_fund_call_lines_reminder_tracking')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260412120000_copro_fund_call_lines_reminder_tracking.sql'; END $post$;

COMMIT;

-- END OF BATCH 8/10 (Phase 1 SAFE)
