-- =====================================================
-- ACCOUNTING — PURGE DES ÉCRITURES FANTÔMES LEGACY
-- =====================================================
-- Conséquence du fix `mark-paid` : l'ancien
-- AccountingIntegrationService.recordRentPayment écrivait 7 écritures
-- mono-ligne (un seul côté débit OU crédit) à chaque loyer marqué payé,
-- en parallèle de la double-écriture posée par le nouveau moteur. Ces
-- écritures fantômes :
--   - violent la partie double (pas de contrepartie),
--   - faussent le total de la liste écritures (ex. 250 € D ≠ 310 € C),
--   - polluent la balance et le grand livre.
--
-- Discriminateur sûr : `piece_ref ~ '^(PAY|FA|TRANS)-'` (préfixes propres
-- au code legacy : voir features/accounting/services/
-- accounting-integration.service.ts) ET aucune ligne dans
-- accounting_entry_lines (le legacy n'a jamais peuplé ce nouveau côté).
--
-- Stratégie : soft-archive plutôt que DELETE — on flag les lignes,
-- l'API les filtre par défaut, et un admin peut toujours les revoir
-- via `?include_legacy_phantom=true`. Aucune perte d'audit.
-- =====================================================

SET lock_timeout = '10s';

-- =====================================================
-- 1. Colonne d'archivage soft
-- =====================================================

ALTER TABLE accounting_entries
  ADD COLUMN IF NOT EXISTS is_legacy_phantom BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN accounting_entries.is_legacy_phantom IS
  'TRUE pour les écritures mono-ligne héritées du flux agence '
  '(AccountingIntegrationService.recordRentPayment, désactivé 2026-04). '
  'Filtrées des listes/balance/grand-livre côté API. Conservées pour audit.';

-- =====================================================
-- 2. Marquage des écritures fantômes existantes
--    Critères cumulatifs (ET) :
--      - piece_ref legacy (PAY-/FA-/TRANS-)
--      - aucune ligne associée dans accounting_entry_lines
--      - le couple (debit, credit) est mono-côté (sécurité belt-and-suspenders)
-- =====================================================

WITH phantoms AS (
  SELECT ae.id
    FROM accounting_entries ae
   WHERE ae.piece_ref ~ '^(PAY|FA|TRANS)-'
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
-- 3. Index partiel pour ne pas dégrader les listings
--    On filtre quasi-systématiquement WHERE NOT is_legacy_phantom,
--    autant rendre cette branche du plan rapide.
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_accounting_entries_active
  ON accounting_entries(entity_id, entry_date DESC, journal_code)
  WHERE is_legacy_phantom = FALSE;

COMMENT ON INDEX idx_accounting_entries_active IS
  'Index partiel pour la liste écritures côté UI (exclut les fantômes legacy).';

-- =====================================================
-- 4. Garde-fou : empêcher la création de nouvelles fantômes
--    Toute nouvelle écriture engine doit avoir au moins une ligne dans
--    accounting_entry_lines (vérifié à la validation par le trigger
--    fn_check_entry_balance, mais on n'a rien sur l'INSERT). Ici on se
--    contente d'interdire la résurrection du flux legacy : une écriture
--    avec piece_ref PAY-/FA-/TRANS- n'est plus jamais créée → constraint.
-- =====================================================

ALTER TABLE accounting_entries
  DROP CONSTRAINT IF EXISTS chk_no_legacy_phantom_inserts;

ALTER TABLE accounting_entries
  ADD CONSTRAINT chk_no_legacy_phantom_inserts CHECK (
    piece_ref IS NULL
    OR piece_ref !~ '^(PAY|FA|TRANS)-'
    OR is_legacy_phantom = TRUE
  ) NOT VALID;

-- Validate seulement si aucune contre-exception ne traîne. NOT VALID au
-- pire des cas : le constraint protège uniquement les inserts futurs.
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
    FROM accounting_entries
   WHERE piece_ref ~ '^(PAY|FA|TRANS)-'
     AND is_legacy_phantom = FALSE;
  IF bad_count = 0 THEN
    EXECUTE 'ALTER TABLE accounting_entries '
            'VALIDATE CONSTRAINT chk_no_legacy_phantom_inserts';
  ELSE
    RAISE NOTICE 'chk_no_legacy_phantom_inserts NOT VALIDATED: % lignes legacy non flaggées subsistent.', bad_count;
  END IF;
END $$;
