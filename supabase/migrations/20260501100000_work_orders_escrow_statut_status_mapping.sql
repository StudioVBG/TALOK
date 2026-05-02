-- =====================================================
-- Migration: Mapping statut↔status pour le flux escrow complet
-- Date: 2026-05-01
--
-- CONTEXTE:
-- Migration 20251205800000 a étendu work_orders.statut avec 13 nouveaux
-- statuts (accepted, visit_scheduled, quote_sent, deposit_paid, fully_paid…)
-- pour modéliser le flux Visite → Devis → Acompte → Travaux → Solde.
--
-- Le trigger trg_work_orders_sync_statut_status (migration 20260420140000)
-- maintient `status` (EN) en miroir de `statut` (FR legacy) via la fonction
-- work_order_statut_to_status. Cette fonction ne connaît QUE les 5 statuts
-- legacy (assigned/scheduled/in_progress/done/cancelled) et retombe sur
-- 'draft' pour tous les autres.
--
-- BUG OBSERVÉ:
-- Quand le webhook Stripe paie l'acompte et écrit `statut='deposit_paid'`
-- sans toucher `status`, le trigger remappe `status` à 'draft', cassant la
-- machine d'état EN et faisant disparaître les actions UI.
--
-- FIX:
-- Étendre work_order_statut_to_status pour mapper proprement chaque statut
-- escrow vers son équivalent EN. Le mapping préserve la sémantique du flux:
--   - phases pré-devis      → draft
--   - phases devis          → quote_requested / quote_received / quote_approved
--   - phases acompte        → quote_approved (l'acompte est un détail interne)
--   - phases travaux        → scheduled / in_progress
--   - phases solde + clôture → completed / paid
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.work_order_statut_to_status(p_statut TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT CASE p_statut
    -- Legacy FR (migration initiale)
    WHEN 'assigned'         THEN 'draft'
    WHEN 'scheduled'        THEN 'scheduled'
    WHEN 'in_progress'      THEN 'in_progress'
    WHEN 'done'             THEN 'completed'
    WHEN 'cancelled'        THEN 'cancelled'
    -- Flux escrow étendu (migration 20251205800000)
    WHEN 'accepted'         THEN 'draft'
    WHEN 'refused'          THEN 'cancelled'
    WHEN 'visit_scheduled'  THEN 'quote_requested'
    WHEN 'visit_completed'  THEN 'quote_requested'
    WHEN 'quote_sent'       THEN 'quote_received'
    WHEN 'quote_accepted'   THEN 'quote_approved'
    WHEN 'quote_refused'    THEN 'quote_rejected'
    WHEN 'deposit_pending'  THEN 'quote_approved'
    WHEN 'deposit_paid'     THEN 'quote_approved'
    WHEN 'work_scheduled'   THEN 'scheduled'
    WHEN 'work_completed'   THEN 'completed'
    WHEN 'balance_pending'  THEN 'completed'
    WHEN 'fully_paid'       THEN 'paid'
    WHEN 'pending_review'   THEN 'paid'
    WHEN 'closed'           THEN 'paid'
    WHEN 'disputed'         THEN 'disputed'
    ELSE 'draft'
  END;
$func$;

COMMENT ON FUNCTION public.work_order_statut_to_status(TEXT) IS
  'Mappe statut (FR legacy + escrow étendu) vers status (EN). '
  'Les statuts escrow internes (deposit_pending/paid, balance_pending) '
  'sont absorbés par les états contractuels EN les plus proches.';

-- =====================================================
-- Resync ponctuel : aligne status sur les lignes existantes dont le statut
-- est un état escrow étendu et dont status était figé sur 'draft' à cause
-- du fallback de l'ancienne fonction.
-- =====================================================

UPDATE public.work_orders
SET status = public.work_order_statut_to_status(statut)
WHERE statut IN (
  'accepted', 'refused', 'visit_scheduled', 'visit_completed',
  'quote_sent', 'quote_accepted', 'quote_refused',
  'deposit_pending', 'deposit_paid',
  'work_scheduled', 'work_completed', 'balance_pending',
  'fully_paid', 'pending_review', 'closed', 'disputed'
)
AND status = 'draft';

COMMIT;
