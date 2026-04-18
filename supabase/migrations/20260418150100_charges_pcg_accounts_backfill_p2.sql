-- =====================================================
-- Sprint 0.c RESCUE — Gap P0 #3 complément
-- Date: 2026-04-18
--
-- Le backfill de 20260417090400 n'a seedé que 419100 et 654000
-- en se basant sur l'hypothèse que 614100 + 708000 étaient déjà
-- présents pour toutes les entities via le seed
-- PCG_OWNER_ACCOUNTS (lib/accounting/chart-amort-ocr.ts).
-- L'audit Sprint 0.c a révélé que cette hypothèse est fausse
-- pour les entities créées avant l'ajout de ces comptes au
-- tableau : il manque les rows pour ces anciennes entities.
--
-- Cette migration complète le backfill en insérant 614100 et
-- 708000 pour toutes les entities qui n'en auraient pas.
--
-- Labels + account_type alignés sur PCG_OWNER_ACCOUNTS existant
-- (chart-amort-ocr.ts lignes 43, 60) pour éviter toute divergence
-- entre entities seedées à la création vs backfillées :
--   614100 = 'Charges reelles recuperables' (expense)
--   708000 = 'Charges recuperees / TEOM'    (income)
--
-- Note : 'revenue' n'existe pas dans le CHECK
-- chart_of_accounts.account_type (cf migration 20260406210000,
-- lignes 53-55), valeurs autorisées = {asset, liability,
-- equity, income, expense}. On utilise 'income' comme le reste
-- du plan owner.
--
-- Idempotent : ON CONFLICT (entity_id, account_number) DO NOTHING.
-- =====================================================

INSERT INTO chart_of_accounts (entity_id, account_number, label, account_type)
SELECT le.id, '614100', 'Charges reelles recuperables', 'expense'
FROM legal_entities le
ON CONFLICT (entity_id, account_number) DO NOTHING;

INSERT INTO chart_of_accounts (entity_id, account_number, label, account_type)
SELECT le.id, '708000', 'Charges recuperees / TEOM', 'income'
FROM legal_entities le
ON CONFLICT (entity_id, account_number) DO NOTHING;
