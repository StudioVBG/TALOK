-- =====================================================
-- MIGRATION: Sprint 0.a — Table epci_reference
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- Référentiel des EPCI (DROM-COM priorité) pour
-- déterminer le type de taxe déchets applicable
-- (TEOM / REOM / none) et le taux de TEOM.
-- Utilisé côté Sprint 2 pour le lookup par code postal
-- et côté Sprint 3 pour afficher l'info REOM.
--
-- RLS : lecture publique (référentiel, aucune donnée PII).
-- Seeds : injectés en Sprint 0.b (22 EPCI DROM-COM).
-- Idempotent : CREATE TABLE IF NOT EXISTS.
-- =====================================================

CREATE TABLE IF NOT EXISTS epci_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_departement TEXT NOT NULL,
  code_postal_pattern TEXT,
  epci_name TEXT NOT NULL,
  syndicat_traitement TEXT,
  waste_tax_type TEXT NOT NULL DEFAULT 'teom'
    CHECK (waste_tax_type IN ('teom', 'reom', 'none')),
  teom_rate_pct NUMERIC(5,2),
  teom_rate_year INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT epci_reference_dept_name_unique UNIQUE (code_departement, epci_name)
);

CREATE INDEX IF NOT EXISTS idx_epci_reference_dept ON epci_reference(code_departement);
CREATE INDEX IF NOT EXISTS idx_epci_reference_cp ON epci_reference(code_postal_pattern)
  WHERE code_postal_pattern IS NOT NULL;

ALTER TABLE epci_reference ENABLE ROW LEVEL SECURITY;

-- Lecture publique (référentiel sans PII). Écriture bloquée côté client
-- (seed SQL uniquement via migration).
DROP POLICY IF EXISTS "epci_reference_public_read" ON epci_reference;
CREATE POLICY "epci_reference_public_read" ON epci_reference
  FOR SELECT TO authenticated, anon
  USING (true);

COMMENT ON TABLE epci_reference IS
  'Référentiel EPCI — type de taxe déchets et taux TEOM par EPCI. Focus DROM-COM au Sprint 0, métropole extensible ensuite.';
COMMENT ON COLUMN epci_reference.waste_tax_type IS
  'teom = taxe (intégrée taxe foncière, payée par propriétaire, récupérable sur locataire). reom = redevance (payée directement par locataire, aucune régul côté propriétaire). none = aucune taxe.';
COMMENT ON COLUMN epci_reference.teom_rate_pct IS
  'Taux TEOM en pourcentage (référentiel indicatif — le montant réel figure sur l''avis de taxe foncière).';
