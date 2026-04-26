-- =====================================================
-- ACCOUNTING — Axes analytiques + sous-comptes auxiliaires
-- =====================================================
-- Ajoute sur accounting_entry_lines :
--   - third_party_id / third_party_type  (auxiliaire par tiers)
--   - property_id / unit_id / lease_id   (analytique par bien/lot/bail)
--
-- Tous nullables : back-compat 100% avec les écritures existantes.
-- Les nouveaux bridges les renseignent quand le contexte est disponible
-- (lease.tenant_id pour les loyers, invoice.vendor_id pour les achats…).
--
-- Permet :
--   - Grand livre par locataire/fournisseur (411T_LOCATAIRE_X)
--   - P&L par bien (group by property_id sur les lignes)
--   - 2044 ventilée par bien automatiquement
-- =====================================================

SET lock_timeout = '10s';

-- =====================================================
-- 0. chart_of_accounts.metadata (JSONB)
--    Pour stocker (third_party_id, third_party_type) sur les sous-comptes
--    auxiliaires sans table de jointure dédiée.
-- =====================================================

ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chart_metadata_third_party
  ON chart_of_accounts USING GIN (metadata)
  WHERE metadata ? 'third_party_id';

COMMENT ON COLUMN chart_of_accounts.metadata IS
  'Métadonnées libres. Utilisé notamment pour les sous-comptes auxiliaires : '
  '{ "third_party_id": uuid, "third_party_type": "tenant"|..., '
  '"parent_account": "411000" }.';

-- =====================================================
-- 1. accounting_entry_lines : axes analytiques
-- =====================================================

ALTER TABLE accounting_entry_lines
  ADD COLUMN IF NOT EXISTS third_party_type TEXT
    CHECK (third_party_type IN ('tenant','landlord','vendor','mandant','copro_owner','employee','tax_authority')),
  ADD COLUMN IF NOT EXISTS third_party_id   UUID,
  ADD COLUMN IF NOT EXISTS property_id      UUID REFERENCES properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_id          UUID,
  ADD COLUMN IF NOT EXISTS lease_id         UUID REFERENCES leases(id) ON DELETE SET NULL;

COMMENT ON COLUMN accounting_entry_lines.third_party_type IS
  'Type de tiers pour le sous-compte auxiliaire. Définit le préfixe du '
  'compte auxiliaire généré (T=tenant, F=vendor, P=landlord, M=mandant…).';

COMMENT ON COLUMN accounting_entry_lines.third_party_id IS
  'UUID du tiers (locataire, fournisseur, propriétaire mandant) — pointe '
  'généralement sur profiles.id ou providers.id selon le type.';

COMMENT ON COLUMN accounting_entry_lines.property_id IS
  'Bien immobilier impacté — pour P&L analytique par bien et 2044 ventilée.';

COMMENT ON COLUMN accounting_entry_lines.unit_id IS
  'Lot du bien (building_units.id) — pour copropriétés et immeubles divisés.';

COMMENT ON COLUMN accounting_entry_lines.lease_id IS
  'Bail concerné (loyers, dépôts, régularisations charges).';

-- Index pour les requêtes analytiques fréquentes
CREATE INDEX IF NOT EXISTS idx_entry_lines_third_party
  ON accounting_entry_lines (third_party_type, third_party_id)
  WHERE third_party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entry_lines_property
  ON accounting_entry_lines (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entry_lines_lease
  ON accounting_entry_lines (lease_id)
  WHERE lease_id IS NOT NULL;

-- =====================================================
-- Vue agrégée P&L par bien (matérialisable plus tard si besoin)
-- =====================================================

CREATE OR REPLACE VIEW v_pnl_by_property AS
SELECT
  ae.entity_id,
  ae.exercise_id,
  l.property_id,
  l.account_number,
  COALESCE(coa.label, l.account_number) AS account_label,
  SUM(l.debit_cents)  AS total_debit_cents,
  SUM(l.credit_cents) AS total_credit_cents,
  SUM(l.debit_cents) - SUM(l.credit_cents) AS balance_cents
FROM accounting_entry_lines l
JOIN accounting_entries ae ON ae.id = l.entry_id
LEFT JOIN chart_of_accounts coa
       ON coa.entity_id = ae.entity_id
      AND coa.account_number = l.account_number
WHERE ae.is_validated = true
  AND l.property_id IS NOT NULL
GROUP BY ae.entity_id, ae.exercise_id, l.property_id, l.account_number, coa.label;

COMMENT ON VIEW v_pnl_by_property IS
  'P&L par bien immobilier — agrégation des lignes validées avec '
  'property_id renseigné. Source pour la déclaration 2044 ventilée.';
