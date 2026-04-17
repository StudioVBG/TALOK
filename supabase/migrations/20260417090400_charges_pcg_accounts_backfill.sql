-- =====================================================
-- MIGRATION: Gap P0 #3 — Backfill comptes PCG charges
-- Date: 2026-04-17
-- Sprint: 0.b (Seeds PCG + EPCI — Régularisation des charges)
--
-- Ajoute les comptes PCG 419100 et 654000 pour toutes
-- les entities existantes. Les nouvelles entities sont
-- déjà couvertes via PCG_OWNER_ACCOUNTS dans
-- lib/accounting/chart-amort-ocr.ts (seed dynamique au
-- premier exercice).
--
-- Substitutions vs. skill théorique (voir section
-- "Mapping PCG Talok" dans .claude/skills/talok-charges-
-- regularization/SKILL.md) :
--   - skill '4191'   → Talok '419100' (uniformisation 6 chiffres)
--   - skill '654'    → Talok '654000' (idem)
--   - skill '614'    → Talok '614100' (déjà seedé, pas besoin de backfill)
--   - skill '708300' → Talok '708000' (déjà seedé, pas besoin de backfill)
--
-- Idempotent : ON CONFLICT (entity_id, account_number) DO NOTHING.
-- =====================================================

INSERT INTO chart_of_accounts (entity_id, account_number, label, account_type)
SELECT le.id, '419100', 'Provisions de charges recues', 'liability'
FROM legal_entities le
ON CONFLICT (entity_id, account_number) DO NOTHING;

INSERT INTO chart_of_accounts (entity_id, account_number, label, account_type)
SELECT le.id, '654000', 'Charges recuperables non recuperees', 'expense'
FROM legal_entities le
ON CONFLICT (entity_id, account_number) DO NOTHING;
