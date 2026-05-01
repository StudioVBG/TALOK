-- ============================================
-- Module syndic — Mouvements du fonds de travaux
-- ============================================
-- Trace tous les mouvements entrant et sortant du fonds de travaux
-- (cotisations encaissées, dépenses de travaux, intérêts, etc.)
-- pour produire l'historique requis par la loi ALUR.

CREATE TABLE IF NOT EXISTS public.copro_fonds_travaux_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonds_id UUID NOT NULL REFERENCES public.copro_fonds_travaux(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,

  movement_type TEXT NOT NULL CHECK (
    movement_type IN ('cotisation', 'travaux', 'interets', 'remboursement', 'autre')
  ),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),

  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,

  description TEXT,
  reference TEXT,
  related_invoice_id UUID,
  attachment_url TEXT,

  created_by_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copro_fonds_travaux_movements_fonds
  ON public.copro_fonds_travaux_movements(fonds_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_copro_fonds_travaux_movements_site
  ON public.copro_fonds_travaux_movements(site_id, movement_date DESC);

COMMENT ON TABLE public.copro_fonds_travaux_movements IS
'Historique des mouvements du fonds de travaux ALUR (entrées et sorties).';

-- Trigger pour mettre à jour le solde du fonds parent
CREATE OR REPLACE FUNCTION public.update_fonds_travaux_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_delta INTEGER;
BEGIN
  v_delta := CASE WHEN NEW.direction = 'credit' THEN NEW.amount_cents ELSE -NEW.amount_cents END;

  UPDATE public.copro_fonds_travaux
  SET
    solde_actuel_cents = solde_actuel_cents + v_delta,
    total_collected_cents = total_collected_cents + (CASE WHEN NEW.direction = 'credit' THEN NEW.amount_cents ELSE 0 END),
    total_spent_cents = total_spent_cents + (CASE WHEN NEW.direction = 'debit' THEN NEW.amount_cents ELSE 0 END),
    updated_at = NOW()
  WHERE id = NEW.fonds_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copro_fonds_travaux_movements_balance
  ON public.copro_fonds_travaux_movements;
CREATE TRIGGER trg_copro_fonds_travaux_movements_balance
  AFTER INSERT ON public.copro_fonds_travaux_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_fonds_travaux_balance();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.copro_fonds_travaux_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copro_fonds_travaux_movements_select" ON public.copro_fonds_travaux_movements;
CREATE POLICY "copro_fonds_travaux_movements_select" ON public.copro_fonds_travaux_movements
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

DROP POLICY IF EXISTS "copro_fonds_travaux_movements_insert" ON public.copro_fonds_travaux_movements;
CREATE POLICY "copro_fonds_travaux_movements_insert" ON public.copro_fonds_travaux_movements
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
