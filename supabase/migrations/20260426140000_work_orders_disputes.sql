-- =====================================================
-- Migration : Litiges work orders (Sprint D)
-- Date : 2026-04-26
--
-- Permet à un propriétaire de contester un paiement WO en escrow_status='held'
-- avant la libération automatique. Pendant la contestation, le cron de
-- libération est bloqué (escrow_status='disputed' au lieu de 'held').
-- L'admin support peut résoudre le litige (libérer ou rembourser).
-- =====================================================

BEGIN;

-- 1. Table des litiges
CREATE TABLE IF NOT EXISTS public.work_order_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Le paiement contesté
  work_order_payment_id UUID NOT NULL
    REFERENCES public.work_order_payments(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL
    REFERENCES public.work_orders(id) ON DELETE CASCADE,

  -- Qui conteste (propriétaire normalement)
  raised_by_profile_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Détails de la contestation
  reason TEXT NOT NULL CHECK (reason IN (
    'work_not_done',           -- Travaux non réalisés
    'work_incomplete',         -- Travaux partiellement réalisés
    'quality_issue',           -- Problème de qualité
    'wrong_amount',            -- Montant incorrect
    'unauthorized',            -- Paiement non autorisé
    'other'                    -- Autre
  )),
  description TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',

  -- Résolution
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',                    -- En cours d'examen
    'resolved_release',        -- Libéré au prestataire (admin tranche)
    'resolved_refund',         -- Remboursé au propriétaire (admin tranche)
    'resolved_partial',        -- Remboursement partiel + libération partielle
    'withdrawn'                -- Retiré par le propriétaire
  )),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by_profile_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Stripe (si remboursement effectué)
  stripe_refund_id TEXT,
  refund_amount DECIMAL(10,2),

  -- Dates
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wo_disputes_payment
  ON public.work_order_disputes(work_order_payment_id);
CREATE INDEX IF NOT EXISTS idx_wo_disputes_work_order
  ON public.work_order_disputes(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_disputes_status
  ON public.work_order_disputes(status)
  WHERE status = 'open';

-- 2. Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_work_order_disputes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wo_disputes_updated_at ON public.work_order_disputes;
CREATE TRIGGER trg_wo_disputes_updated_at
  BEFORE UPDATE ON public.work_order_disputes
  FOR EACH ROW EXECUTE FUNCTION public.tg_work_order_disputes_updated_at();

-- 3. RLS : owner voit ses litiges, admin voit tout
ALTER TABLE public.work_order_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their disputes" ON public.work_order_disputes;
CREATE POLICY "Owners read their disputes" ON public.work_order_disputes
  FOR SELECT
  USING (
    raised_by_profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Owners create their disputes" ON public.work_order_disputes;
CREATE POLICY "Owners create their disputes" ON public.work_order_disputes
  FOR INSERT
  WITH CHECK (
    raised_by_profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin updates disputes" ON public.work_order_disputes;
CREATE POLICY "Admin updates disputes" ON public.work_order_disputes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

COMMIT;
