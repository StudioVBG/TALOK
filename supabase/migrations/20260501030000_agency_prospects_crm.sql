-- CRM agency : table prospects pour le suivi commercial des candidats locataires
--
-- Pipeline 6 statuts :
--   new            → contact initial enregistré
--   contacted      → premier contact effectué (téléphone/email)
--   visit_scheduled → visite planifiée
--   visited        → visite effectuée
--   applied        → candidature déposée (lien optionnel vers tenant_applications)
--   signed         → bail signé (sortie pipeline en succès)
--   lost           → perdu / abandon (sortie pipeline en échec)

CREATE TABLE IF NOT EXISTS agency_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Contact
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,

  -- Source d'acquisition
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN (
    'manual', 'website', 'leboncoin', 'seloger', 'pap', 'recommandation', 'other'
  )),

  -- Pipeline
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'visit_scheduled', 'visited', 'applied', 'signed', 'lost'
  )),

  -- Bien d'intérêt (optionnel — un prospect peut être intéressé par un de
  -- nos biens en gestion ou par autre chose)
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,

  -- Notes libres (multi-lignes)
  notes TEXT,

  -- Suivi des actions (pour cron de relance future)
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_action_at TIMESTAMPTZ,

  -- Si le prospect a accepté un bail, on stocke la référence
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes pour les listings et filtres
CREATE INDEX IF NOT EXISTS idx_agency_prospects_agency
  ON agency_prospects(agency_profile_id);
CREATE INDEX IF NOT EXISTS idx_agency_prospects_status
  ON agency_prospects(agency_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_agency_prospects_next_action
  ON agency_prospects(next_action_at)
  WHERE next_action_at IS NOT NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION agency_prospects_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agency_prospects_updated_at ON agency_prospects;
CREATE TRIGGER trg_agency_prospects_updated_at
  BEFORE UPDATE ON agency_prospects
  FOR EACH ROW
  EXECUTE FUNCTION agency_prospects_set_updated_at();

-- RLS : chaque agency ne voit que ses propres prospects
ALTER TABLE agency_prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_prospects_agency_select ON agency_prospects;
CREATE POLICY agency_prospects_agency_select ON agency_prospects
  FOR SELECT
  USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agency_prospects_agency_insert ON agency_prospects;
CREATE POLICY agency_prospects_agency_insert ON agency_prospects
  FOR INSERT
  WITH CHECK (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

DROP POLICY IF EXISTS agency_prospects_agency_update ON agency_prospects;
CREATE POLICY agency_prospects_agency_update ON agency_prospects
  FOR UPDATE
  USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

DROP POLICY IF EXISTS agency_prospects_agency_delete ON agency_prospects;
CREATE POLICY agency_prospects_agency_delete ON agency_prospects
  FOR DELETE
  USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

-- Bypass admin
DROP POLICY IF EXISTS agency_prospects_admin ON agency_prospects;
CREATE POLICY agency_prospects_admin ON agency_prospects
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'platform_admin')
    )
  );

COMMENT ON TABLE agency_prospects IS
  'Pipeline CRM commercial : suivi des prospects locataires d''une agence (6 statuts du contact à la signature ou à la perte).';
