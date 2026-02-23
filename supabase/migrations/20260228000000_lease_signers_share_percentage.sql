-- SOTA 2026: part de répartition par signataire (colocation).
-- Si NULL, l'UI utilise le fallback 100 / nombre de colocataires.
ALTER TABLE public.lease_signers
  ADD COLUMN IF NOT EXISTS share_percentage numeric(5,2) NULL
  CONSTRAINT chk_lease_signers_share_percentage CHECK (share_percentage IS NULL OR (share_percentage >= 0 AND share_percentage <= 100));

COMMENT ON COLUMN public.lease_signers.share_percentage IS 'Part en % du loyer/charges pour ce signataire (colocation). NULL = répartition égale.';
