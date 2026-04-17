-- =====================================================
-- MIGRATION: Sprint 0.a — Table tax_notices
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- Stocke les avis de taxe foncière par bien et par année
-- pour extraire le montant TEOM net récupérable auprès
-- du locataire (décret 87-713 + note DGFiP : frais de
-- gestion ~8% non récupérables).
--
-- Idempotent : CREATE TABLE IF NOT EXISTS + DROP POLICY
-- IF EXISTS avant CREATE POLICY.
-- =====================================================

CREATE TABLE IF NOT EXISTS tax_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  teom_brut INTEGER CHECK (teom_brut IS NULL OR teom_brut >= 0),
  frais_gestion INTEGER CHECK (frais_gestion IS NULL OR frais_gestion >= 0),
  teom_net INTEGER CHECK (teom_net IS NULL OR teom_net >= 0),
  reom_applicable BOOLEAN NOT NULL DEFAULT false,
  extraction_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (extraction_method IN ('manual', 'ocr')),
  validated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tax_notices_property_year_unique UNIQUE (property_id, year)
);

CREATE INDEX IF NOT EXISTS idx_tax_notices_property ON tax_notices(property_id);
CREATE INDEX IF NOT EXISTS idx_tax_notices_entity ON tax_notices(entity_id)
  WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tax_notices_year ON tax_notices(year);

ALTER TABLE tax_notices ENABLE ROW LEVEL SECURITY;

-- Owner full access (via properties.owner_id → profiles.user_id)
DROP POLICY IF EXISTS "tax_notices_owner_access" ON tax_notices;
CREATE POLICY "tax_notices_owner_access" ON tax_notices
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Trigger updated_at (réutilise la fonction du module charges)
DROP TRIGGER IF EXISTS trg_tax_notices_updated ON tax_notices;
CREATE TRIGGER trg_tax_notices_updated
  BEFORE UPDATE ON tax_notices
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();

COMMENT ON TABLE tax_notices IS
  'Avis de taxe foncière par bien et par année — stocke TEOM brut / frais gestion / TEOM net récupérable. Source pour la régul des charges (gap P0 #2 du skill talok-charges-regularization).';
COMMENT ON COLUMN tax_notices.teom_brut IS 'Montant TEOM brut en centimes (tel qu''affiché sur l''avis).';
COMMENT ON COLUMN tax_notices.frais_gestion IS 'Frais de gestion (~8%) non récupérables en centimes.';
COMMENT ON COLUMN tax_notices.teom_net IS 'TEOM net récupérable en centimes (brut - frais_gestion).';
COMMENT ON COLUMN tax_notices.reom_applicable IS 'True si le bien est en zone de redevance (REOM) — alors aucune régul, payée directement par le locataire.';
COMMENT ON COLUMN tax_notices.extraction_method IS 'manual = saisie propriétaire, ocr = pipeline Tesseract + GPT-4o-mini (Sprint 6).';
