-- =============================================================================
-- Migration : Drop deprecated duplicate RPC `generate_first_invoice`
-- Date      : 2026-04-10
-- Scope     : Tech debt cleanup (P2) — unify duplicate initial-invoice RPCs
-- =============================================================================
--
-- Two RPCs historically coexisted for "create the first invoice of a lease":
--
--   • generate_first_invoice(UUID, UUID, UUID)           (2026-03-05)
--   • generate_initial_signing_invoice(UUID, UUID, UUID) (2026-03-06)
--
-- They had the same signature but diverged on business logic:
--
--                                | generate_first_invoice | generate_initial_signing_invoice
--   ----------------------------+-------------------------+---------------------------------
--   includes depot_de_garantie  |          no             |   yes (Loi Alur conformance)
--   invoice_number prefix       |         'QUI-'          |        'INI-'
--   metadata->>'type' marker    |         not set         |     'initial_invoice'
--   type column (post-03-14)    |         not set         |     'initial_invoice'
--   prorata Art. 21 loi 1989    |           yes           |           yes
--
-- `generate_initial_signing_invoice` is the canonical function — redefined as
-- SSOT in `20260314020000_canonical_lease_activation_flow.sql`, includes the
-- security deposit in the total (Loi Alur requirement), and is the only one
-- called from the TypeScript service `lib/services/lease-initial-invoice.service.ts`.
--
-- `generate_first_invoice` was marked DEPRECATED in
-- `20260410180000_fix_invoice_generation_sota.sql` (lines 436-457) but the
-- removal was deferred "once the new path has logged a few weeks of clean
-- runs". That comment was based on a stale premise: the ONLY trigger that
-- called `generate_first_invoice` — `trg_invoice_engine_on_lease_active` —
-- was dropped in `20260314030000_payments_production_hardening.sql` (line 43)
-- and never recreated. So the deprecated function has actually been **dead
-- code** for a month, never invoked. No clean runs to wait for — just drop.
--
-- This migration:
--   1. Drops the deprecated RPC itself.
--   2. Drops the orphan trigger function `trigger_invoice_engine_on_lease_active`
--      whose body still contains a `PERFORM generate_first_invoice(...)` call.
--      Its trigger is gone, so the function is dead code AND would leave a
--      dormant landmine (broken reference) the moment we drop the RPC.
--
-- Sibling orphan `trigger_invoice_on_lease_fully_signed` is intentionally
-- left in place: its body calls the canonical `generate_initial_signing_invoice`
-- (correct), so it is harmless dead code. Removing it is out of scope for
-- this tech-debt cleanup.
--
-- No TypeScript changes required: every `supabase.rpc(...)` call for initial
-- invoice generation already targets `generate_initial_signing_invoice`.
-- =============================================================================

BEGIN;

-- 1. Drop the orphan trigger function FIRST so nothing references the RPC
--    we're about to delete. (CASCADE is not needed — function bodies have no
--    pg_depend entries for the functions they call — but dropping in the
--    right order is cleaner and makes intent explicit.)
DROP FUNCTION IF EXISTS public.trigger_invoice_engine_on_lease_active();

-- 2. Drop the deprecated duplicate RPC.
DROP FUNCTION IF EXISTS public.generate_first_invoice(UUID, UUID, UUID);

COMMIT;

-- =============================================================================
-- Rollback notes:
--   Restore from `20260305000001_invoice_engine_fields.sql` (original
--   definitions of both the trigger function and the RPC) and re-attach the
--   trigger with `CREATE TRIGGER trg_invoice_engine_on_lease_active ON leases`.
--   You almost certainly don't want to — the canonical SSOT is
--   `generate_initial_signing_invoice` and the explicit activation flow in
--   `lib/services/lease-initial-invoice.service.ts`.
-- =============================================================================
