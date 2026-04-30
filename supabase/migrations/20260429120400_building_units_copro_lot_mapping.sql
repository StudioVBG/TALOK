-- ============================================
-- Mapping fin building_units ↔ copro_lots
-- ============================================
-- Permet de relier précisément un lot physique côté owner (building_unit)
-- au lot juridique côté syndic (copro_lot). Une fois mappés, on peut
-- calculer le solde impayé EXACT par copropriétaire au lieu d'utiliser
-- le total global du fund call.

ALTER TABLE public.building_units
  ADD COLUMN IF NOT EXISTS copro_lot_id UUID REFERENCES public.copro_lots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_building_units_copro_lot
  ON public.building_units(copro_lot_id)
  WHERE copro_lot_id IS NOT NULL;

COMMENT ON COLUMN public.building_units.copro_lot_id IS
'FK vers copro_lots (côté syndic). Posé manuellement ou par auto-matching sur lot_number lors de l''approbation d''un building_site_link.';
