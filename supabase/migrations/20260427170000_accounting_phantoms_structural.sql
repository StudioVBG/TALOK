-- =====================================================
-- ACCOUNTING — PURGE FANTÔMES (phase 3 : structurelle)
-- =====================================================
-- Suite de 20260427150000 et 20260427160000.
--
-- Le diagnostic terrain a montré que les fantômes ne se limitent pas
-- aux 6 préfixes legacy connus (PAY/FA/TRANS/DEP/WO/EXT) : on a aussi
-- trouvé HON-, CRG-, manual_repair_, etc. selon les outils ad-hoc qui
-- ont touché la base.
--
-- Plutôt que de jouer au chat-et-souris avec les préfixes, on bascule
-- sur un critère **structurel** :
--
--   Une entry est fantôme si :
--     - elle ne provient pas du moteur engine (source NOT LIKE 'auto:%')
--     ET
--     - elle n'est pas équilibrée :
--         * lignes existantes mais SUM(debit) ≠ SUM(credit)
--         * OU aucune ligne et header mono-côté
--
-- Les entries du moteur ont toujours des lignes balancées par
-- construction (trigger fn_check_entry_balance + builder AUTO_ENTRIES) :
-- elles sont protégées par le filtre `source NOT LIKE 'auto:%'`.
--
-- Confirmé sur l'environnement initial : 15 fantômes flaggés au total
-- (4 PAY- + 6 HON- + 3 CRG- + 2 manual_*), balance active retombée à 0.
-- =====================================================

SET lock_timeout = '10s';

-- =====================================================
-- 1. Marquage structurel (déséquilibre lignes ou header mono-côté)
-- =====================================================

WITH phantom_check AS (
  SELECT
    ae.id,
    ae.debit  AS header_debit,
    ae.credit AS header_credit,
    COUNT(l.id) AS line_count,
    COALESCE(SUM(l.debit_cents), 0)  AS sum_debit_cents,
    COALESCE(SUM(l.credit_cents), 0) AS sum_credit_cents
  FROM accounting_entries ae
  LEFT JOIN accounting_entry_lines l ON l.entry_id = ae.id
  WHERE ae.is_legacy_phantom = FALSE
    AND COALESCE(ae.source, '') NOT LIKE 'auto:%'
  GROUP BY ae.id, ae.debit, ae.credit
)
UPDATE accounting_entries ae
   SET is_legacy_phantom = TRUE
  FROM phantom_check pc
 WHERE ae.id = pc.id
   AND (
     -- Cas 1 : lignes existantes mais somme non équilibrée
     (pc.line_count > 0 AND pc.sum_debit_cents <> pc.sum_credit_cents)
     OR
     -- Cas 2 : aucune ligne, header mono-côté (legacy raw insert)
     (pc.line_count = 0 AND (
       (COALESCE(pc.header_debit, 0)  > 0 AND COALESCE(pc.header_credit, 0) = 0)
       OR (COALESCE(pc.header_debit, 0) = 0 AND COALESCE(pc.header_credit, 0)  > 0)
     ))
   );

-- =====================================================
-- 2. Filet de sécurité par préfixes additionnels observés
--    Au cas où le test structurel raterait un cas (entries header
--    nulles ET sans ligne ET piece_ref legacy connu).
-- =====================================================

UPDATE accounting_entries
   SET is_legacy_phantom = TRUE
 WHERE is_legacy_phantom = FALSE
   AND COALESCE(source, '') NOT LIKE 'auto:%'
   AND (
        piece_ref ~ '^HON-'
     OR piece_ref ~ '^CRG-'
     OR piece_ref ~ '^manual_'
   );

-- =====================================================
-- 3. Validation de la CHECK constraint (si tous les
--    préfixes initiaux sont flaggés)
-- =====================================================

DO $$
DECLARE bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
    FROM accounting_entries
   WHERE piece_ref ~ '^(PAY|FA|TRANS|DEP|WO|EXT)-'
     AND is_legacy_phantom = FALSE;
  IF bad_count = 0 THEN
    EXECUTE 'ALTER TABLE accounting_entries '
            'VALIDATE CONSTRAINT chk_no_legacy_phantom_inserts';
    RAISE NOTICE 'Constraint chk_no_legacy_phantom_inserts validée';
  ELSE
    RAISE NOTICE 'Constraint NON validée : % lignes legacy non flaggées subsistent.', bad_count;
  END IF;
END $$;
