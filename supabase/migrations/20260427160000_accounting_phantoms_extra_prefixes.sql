-- =====================================================
-- ACCOUNTING — PURGE FANTÔMES (suite : DEP-, WO-, EXT-)
-- =====================================================
-- Suite de 20260427150000_accounting_purge_legacy_phantoms.sql.
--
-- L'audit du service legacy a révélé 3 autres méthodes au même pattern
-- mono-ligne (toutes supprimées 2026-04) :
--
--   - recordDepositOperation  → piece_ref `DEP-XXXXXXXX`
--   - recordWorkOrderPayment  → piece_ref `WO-XXXXXXXX`
--                                + sous-flux `PAY-WO-XXXXXXXX`
--   - reverseEntry            → piece_ref `EXT-...`
--
-- `PAY-WO-` est déjà couvert par le `^PAY-` de la migration précédente.
-- Cette migration ajoute DEP-, WO- (sans PAY-WO-, qui est plus spécifique)
-- et EXT-.
-- =====================================================

SET lock_timeout = '10s';

-- =====================================================
-- 1. Marquage des fantômes additionnels
-- =====================================================

WITH phantoms AS (
  SELECT ae.id
    FROM accounting_entries ae
   WHERE ae.piece_ref ~ '^(DEP|WO|EXT)-'
     AND NOT EXISTS (
       SELECT 1 FROM accounting_entry_lines l WHERE l.entry_id = ae.id
     )
     AND (
       (COALESCE(ae.debit, 0) > 0 AND COALESCE(ae.credit, 0) = 0)
       OR (COALESCE(ae.debit, 0) = 0 AND COALESCE(ae.credit, 0) > 0)
     )
)
UPDATE accounting_entries ae
   SET is_legacy_phantom = TRUE
  FROM phantoms p
 WHERE ae.id = p.id
   AND ae.is_legacy_phantom = FALSE;

-- =====================================================
-- 2. Étendre la CHECK constraint anti-résurrection
--    On remplace l'ancienne (3 préfixes) par une nouvelle qui couvre
--    les 6 préfixes legacy connus.
-- =====================================================

ALTER TABLE accounting_entries
  DROP CONSTRAINT IF EXISTS chk_no_legacy_phantom_inserts;

ALTER TABLE accounting_entries
  ADD CONSTRAINT chk_no_legacy_phantom_inserts CHECK (
    piece_ref IS NULL
    OR piece_ref !~ '^(PAY|FA|TRANS|DEP|WO|EXT)-'
    OR is_legacy_phantom = TRUE
  ) NOT VALID;

DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
    FROM accounting_entries
   WHERE piece_ref ~ '^(PAY|FA|TRANS|DEP|WO|EXT)-'
     AND is_legacy_phantom = FALSE;
  IF bad_count = 0 THEN
    EXECUTE 'ALTER TABLE accounting_entries '
            'VALIDATE CONSTRAINT chk_no_legacy_phantom_inserts';
  ELSE
    RAISE NOTICE 'chk_no_legacy_phantom_inserts NOT VALIDATED: % lignes legacy non flaggées subsistent.', bad_count;
  END IF;
END $$;
