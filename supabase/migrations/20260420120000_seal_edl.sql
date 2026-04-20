-- ============================================
-- Migration : Scellement EDL (pattern seal_lease)
-- Date : 2026-04-20
-- ============================================
-- Un EDL signe par toutes les parties doit etre fige :
-- status='signed' + signed_pdf_path + sealed_at non-null.
-- Aligne sur le pattern `leases` (migration 20251228100000).
-- ============================================

-- 1. Colonnes de scellement
ALTER TABLE edl
  ADD COLUMN IF NOT EXISTS signed_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ;

COMMENT ON COLUMN edl.signed_pdf_path IS 'Chemin du PDF final signe dans Storage (immutable apres signature complete)';
COMMENT ON COLUMN edl.sealed_at IS 'Date a laquelle l''EDL a ete scelle (toutes signatures collectees)';

-- 2. Index pour rechercher les EDL sceles
CREATE INDEX IF NOT EXISTS idx_edl_sealed_at ON edl(sealed_at)
  WHERE sealed_at IS NOT NULL;

-- 3. Fonction RPC seal_edl : scellement atomique apres signature complete
CREATE OR REPLACE FUNCTION seal_edl(
  p_edl_id UUID,
  p_pdf_path TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_sealed_at TIMESTAMPTZ;
BEGIN
  SELECT status, sealed_at INTO v_current_status, v_sealed_at
  FROM edl
  WHERE id = p_edl_id
  FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'EDL % introuvable', p_edl_id;
  END IF;

  -- Idempotent : si deja scelle, ne fait rien
  IF v_sealed_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  IF v_current_status != 'signed' THEN
    RAISE EXCEPTION 'EDL % doit etre au statut ''signed'' avant scellement (statut actuel: %)', p_edl_id, v_current_status;
  END IF;

  UPDATE edl
  SET
    signed_pdf_path = p_pdf_path,
    sealed_at = NOW()
  WHERE id = p_edl_id
    AND sealed_at IS NULL;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION seal_edl IS 'Scelle un EDL apres signature complete. Stocke le chemin du PDF final et empeche les modifications futures.';

GRANT EXECUTE ON FUNCTION seal_edl(UUID, TEXT) TO authenticated, service_role;
