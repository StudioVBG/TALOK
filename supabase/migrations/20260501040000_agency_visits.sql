-- CRM agency : table des visites planifiées
--
-- Une visite est rattachée à un prospect du pipeline et à un bien de l'agence.
-- Elle a un statut : scheduled / completed / cancelled / no_show.
-- À la complétion, on peut faire transitionner automatiquement le prospect
-- de visit_scheduled → visited.

CREATE TABLE IF NOT EXISTS agency_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES agency_prospects(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,

  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),

  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'completed', 'cancelled', 'no_show'
  )),

  -- Notes sur la visite (préparation, retours, points d'attention)
  notes TEXT,

  -- Champs de complétion
  completed_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_visits_agency
  ON agency_visits(agency_profile_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_agency_visits_prospect
  ON agency_visits(prospect_id)
  WHERE prospect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agency_visits_upcoming
  ON agency_visits(scheduled_at)
  WHERE status = 'scheduled';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION agency_visits_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agency_visits_updated_at ON agency_visits;
CREATE TRIGGER trg_agency_visits_updated_at
  BEFORE UPDATE ON agency_visits
  FOR EACH ROW
  EXECUTE FUNCTION agency_visits_set_updated_at();

-- RLS
ALTER TABLE agency_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_visits_agency_select ON agency_visits;
CREATE POLICY agency_visits_agency_select ON agency_visits
  FOR SELECT
  USING (
    agency_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS agency_visits_agency_insert ON agency_visits;
CREATE POLICY agency_visits_agency_insert ON agency_visits
  FOR INSERT
  WITH CHECK (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

DROP POLICY IF EXISTS agency_visits_agency_update ON agency_visits;
CREATE POLICY agency_visits_agency_update ON agency_visits
  FOR UPDATE
  USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

DROP POLICY IF EXISTS agency_visits_agency_delete ON agency_visits;
CREATE POLICY agency_visits_agency_delete ON agency_visits
  FOR DELETE
  USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

DROP POLICY IF EXISTS agency_visits_admin ON agency_visits;
CREATE POLICY agency_visits_admin ON agency_visits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'platform_admin')
    )
  );

COMMENT ON TABLE agency_visits IS
  'Visites planifiées par une agence : rendez-vous prospect ↔ bien.';
