-- ============================================
-- Module syndic — Historique des relances et mises en demeure
-- ============================================
-- Stocke chaque relance / mise en demeure envoyée à un copropriétaire
-- en retard de paiement. Sert de journal légal et alimente les KPI
-- du dashboard syndic.

CREATE TABLE IF NOT EXISTS public.copro_overdue_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  fund_call_id UUID REFERENCES public.copro_fund_calls(id) ON DELETE SET NULL,
  fund_call_line_id UUID REFERENCES public.copro_fund_call_lines(id) ON DELETE SET NULL,
  lot_id UUID REFERENCES public.copro_lots(id) ON DELETE SET NULL,

  notice_type TEXT NOT NULL CHECK (notice_type IN ('reminder', 'formal_notice')),
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'postal', 'sms', 'in_app')),

  recipient_name TEXT,
  recipient_email TEXT,

  amount_due_cents INTEGER NOT NULL CHECK (amount_due_cents >= 0),
  days_late INTEGER NOT NULL DEFAULT 0,

  pdf_url TEXT,
  message TEXT,

  sent_by_user_id UUID REFERENCES auth.users(id),
  sent_by_profile_id UUID REFERENCES public.profiles(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copro_overdue_notices_site
  ON public.copro_overdue_notices(site_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_copro_overdue_notices_lot
  ON public.copro_overdue_notices(lot_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_copro_overdue_notices_call
  ON public.copro_overdue_notices(fund_call_id);

COMMENT ON TABLE public.copro_overdue_notices IS
'Journal des relances et mises en demeure envoyées aux copropriétaires en retard. Trace légale.';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.copro_overdue_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copro_overdue_notices_syndic_select" ON public.copro_overdue_notices;
CREATE POLICY "copro_overdue_notices_syndic_select" ON public.copro_overdue_notices
  FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT s.id FROM public.sites s
      JOIN public.profiles p ON p.id = s.syndic_profile_id
      WHERE p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'platform_admin')
    )
  );

DROP POLICY IF EXISTS "copro_overdue_notices_syndic_insert" ON public.copro_overdue_notices;
CREATE POLICY "copro_overdue_notices_syndic_insert" ON public.copro_overdue_notices
  FOR INSERT TO authenticated
  WITH CHECK (
    site_id IN (
      SELECT s.id FROM public.sites s
      JOIN public.profiles p ON p.id = s.syndic_profile_id
      WHERE p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'platform_admin')
    )
  );
