-- ============================================================================
-- Sprint 6: Agency Hoguet compliance columns
--
-- Adds Carte G (carte professionnelle gestion immobiliere) and caisse de
-- garantie information to legal_entities for Loi Hoguet compliance.
-- ============================================================================

ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_numero TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_expiry DATE;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie_numero TEXT;

-- Index for quick Hoguet compliance checks
CREATE INDEX IF NOT EXISTS idx_legal_entities_carte_g
  ON legal_entities (carte_g_numero)
  WHERE carte_g_numero IS NOT NULL;

COMMENT ON COLUMN legal_entities.carte_g_numero IS 'Numero de carte professionnelle G (gestion immobiliere) - Loi Hoguet';
COMMENT ON COLUMN legal_entities.carte_g_expiry IS 'Date expiration de la carte G';
COMMENT ON COLUMN legal_entities.caisse_garantie IS 'Nom de la caisse de garantie financiere';
COMMENT ON COLUMN legal_entities.caisse_garantie_numero IS 'Numero adhesion a la caisse de garantie';
