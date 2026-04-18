-- =====================================================
-- Sprint 0.d — colonnes settle sur lease_charge_regularizations
-- Date: 2026-04-18
--
-- Pré-requis de la route POST /api/charges/regularization/[id]/apply
-- (Sprint 0.d étape 2). Ajoute 3 colonnes nullable :
--
--   settlement_method TEXT  ∈ {stripe, next_rent, installments_12,
--                              deduction, waived} (ou NULL)
--   installment_count INT   ∈ [1, 12], DEFAULT 1
--   settled_at        TSTZ  timestamp de bascule vers status='settled'
--
-- + 3 CHECK constraints nommées (pour rollback propre) :
--   lease_charge_reg_settlement_method_check  — whitelist des 5 values
--   lease_charge_reg_installment_count_check  — [1, 12]
--   lease_charge_reg_settle_coherence_check   — settled_at ⇔ method
--
-- Appliqué manuellement en prod via SQL Editor le 2026-04-18, cf
-- transcript session Claude Code (Sprint 0.d apply).
--
-- Idempotente :
--   ADD COLUMN IF NOT EXISTS pour les 3 colonnes
--   DO $$ IF NOT EXISTS (SELECT 1 FROM pg_constraint …) pour les CHECK
-- =====================================================

ALTER TABLE public.lease_charge_regularizations
  ADD COLUMN IF NOT EXISTS settlement_method TEXT,
  ADD COLUMN IF NOT EXISTS installment_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lease_charge_reg_settlement_method_check'
  ) THEN
    ALTER TABLE public.lease_charge_regularizations
      ADD CONSTRAINT lease_charge_reg_settlement_method_check
      CHECK (
        settlement_method IS NULL
        OR settlement_method IN ('stripe', 'next_rent', 'installments_12', 'deduction', 'waived')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lease_charge_reg_installment_count_check'
  ) THEN
    ALTER TABLE public.lease_charge_regularizations
      ADD CONSTRAINT lease_charge_reg_installment_count_check
      CHECK (installment_count >= 1 AND installment_count <= 12);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lease_charge_reg_settle_coherence_check'
  ) THEN
    ALTER TABLE public.lease_charge_regularizations
      ADD CONSTRAINT lease_charge_reg_settle_coherence_check
      CHECK (
        (settled_at IS NULL AND settlement_method IS NULL)
        OR (settled_at IS NOT NULL AND settlement_method IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.lease_charge_regularizations.settlement_method IS
  'Méthode de règlement au settle : stripe | next_rent | installments_12 | deduction | waived. NULL tant que pas settled.';
COMMENT ON COLUMN public.lease_charge_regularizations.installment_count IS
  'Nombre d''échéances pour installments_12 (2-12). 1 pour toutes les autres méthodes.';
COMMENT ON COLUMN public.lease_charge_regularizations.settled_at IS
  'Timestamp de bascule en status=settled. Remplie par POST /api/charges/regularization/[id]/apply.';
