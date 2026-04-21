-- =============================================
-- CHARGE_ENTRIES : lien vers le work_order source
-- =============================================
-- Quand un work_order is_tenant_chargeable=true est clôturé, on injecte
-- automatiquement une ligne dans charge_entries. Ce lien permet :
--   - Idempotence (éviter le doublon si l'injection est rejouée)
--   - Traçabilité (audit : d'où vient cette charge ?)
--   - Remontée UI : afficher le lien vers l'intervention sur la régul

ALTER TABLE charge_entries
  ADD COLUMN IF NOT EXISTS source_work_order_id UUID
  REFERENCES work_orders(id) ON DELETE SET NULL;

COMMENT ON COLUMN charge_entries.source_work_order_id IS
  'Work order source de cette charge (NULL = saisie manuelle). Sert à l''idempotence de l''injection automatique post-clôture.';

-- Unique index partiel : un work_order n'injecte qu'une seule charge_entry
CREATE UNIQUE INDEX IF NOT EXISTS idx_charge_entries_work_order_unique
  ON charge_entries (source_work_order_id)
  WHERE source_work_order_id IS NOT NULL;

-- Index reporting
CREATE INDEX IF NOT EXISTS idx_charge_entries_source_work_order
  ON charge_entries (source_work_order_id)
  WHERE source_work_order_id IS NOT NULL;
