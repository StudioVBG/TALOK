-- Migration : Mises à jour législatives et avenants automatiques
-- Permet de tracker les changements législatifs et de notifier les parties concernées
BEGIN;

-- Table pour tracker les mises à jour législatives publiées
CREATE TABLE IF NOT EXISTS legislation_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version TEXT NOT NULL UNIQUE, -- ex: "LEG-2025-11-29" ou "ALUR-2025-update"
  description TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '[]', -- Détail des changements légaux [{field, oldValue, newValue, description}]
  affected_lease_types TEXT[] NOT NULL DEFAULT ARRAY['nu', 'meuble', 'colocation', 'saisonnier'],
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table pour les mises à jour en attente sur les baux actifs
-- (les baux actifs ne sont pas modifiés directement, on stocke les changements en attente)
CREATE TABLE IF NOT EXISTS lease_pending_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  legislation_update_id UUID NOT NULL REFERENCES legislation_updates(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- En attente de prise en compte
    'acknowledged', -- Lu/accusé réception par le propriétaire
    'applied',      -- Appliqué (lors du renouvellement)
    'dismissed'     -- Ignoré (si le bail se termine avant)
  )),
  notified_owner_at TIMESTAMPTZ,
  notified_tenant_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  notes TEXT, -- Notes du propriétaire ou admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lease_id, legislation_update_id)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_legislation_updates_effective_date ON legislation_updates(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_legislation_updates_version ON legislation_updates(version);
CREATE INDEX IF NOT EXISTS idx_lease_pending_updates_lease ON lease_pending_updates(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_pending_updates_status ON lease_pending_updates(status);
CREATE INDEX IF NOT EXISTS idx_lease_pending_updates_legislation ON lease_pending_updates(legislation_update_id);

-- Trigger pour updated_at sur lease_pending_updates
CREATE OR REPLACE FUNCTION update_lease_pending_updates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lease_pending_updates_updated_at ON lease_pending_updates;
CREATE TRIGGER update_lease_pending_updates_updated_at
  BEFORE UPDATE ON lease_pending_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_lease_pending_updates_timestamp();

-- RLS (Row Level Security)
ALTER TABLE legislation_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_pending_updates ENABLE ROW LEVEL SECURITY;

-- Policies pour legislation_updates
DROP POLICY IF EXISTS "Admins can manage legislation_updates" ON legislation_updates;
CREATE POLICY "Admins can manage legislation_updates"
  ON legislation_updates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Everyone can read legislation_updates" ON legislation_updates;
CREATE POLICY "Everyone can read legislation_updates"
  ON legislation_updates FOR SELECT
  USING (true);

-- Policies pour lease_pending_updates
DROP POLICY IF EXISTS "Users can view their lease pending updates" ON lease_pending_updates;
CREATE POLICY "Users can view their lease pending updates"
  ON lease_pending_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lease_signers ls
      JOIN profiles p ON ls.profile_id = p.id
      WHERE ls.lease_id = lease_pending_updates.lease_id
      AND p.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Owners can update their lease pending updates" ON lease_pending_updates;
CREATE POLICY "Owners can update their lease pending updates"
  ON lease_pending_updates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lease_signers ls
      JOIN profiles p ON ls.profile_id = p.id
      WHERE ls.lease_id = lease_pending_updates.lease_id
      AND ls.role = 'proprietaire'
      AND p.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage lease_pending_updates" ON lease_pending_updates;
CREATE POLICY "Admins can manage lease_pending_updates"
  ON lease_pending_updates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Commentaires pour documentation
COMMENT ON TABLE legislation_updates IS 'Historique des mises à jour législatives publiées par l''admin';
COMMENT ON TABLE lease_pending_updates IS 'Mises à jour en attente pour les baux actifs (non modifiés directement)';
COMMENT ON COLUMN lease_pending_updates.status IS 'pending=en attente, acknowledged=lu, applied=appliqué au renouvellement, dismissed=ignoré';

COMMIT;



