-- ============================================================================
-- MIGRATION: Tables pour la grille de vétusté (GAP-002)
-- Date: 2026-01-27
-- Description: Implémentation de la grille de vétusté pour le calcul des
--              retenues sur dépôt de garantie conformément aux accords collectifs
-- ============================================================================

-- 1. Table des rapports de vétusté
-- Un rapport par fin de bail, liant EDL entrée et sortie
CREATE TABLE IF NOT EXISTS vetusty_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  edl_entry_id UUID REFERENCES edl(id) ON DELETE SET NULL,
  edl_exit_id UUID REFERENCES edl(id) ON DELETE SET NULL,
  settlement_id UUID REFERENCES dg_settlements(id) ON DELETE SET NULL,

  -- Dates de référence
  edl_entry_date DATE NOT NULL,
  edl_exit_date DATE NOT NULL,
  lease_duration_years DECIMAL(4, 1) NOT NULL,

  -- Résumé financier
  total_items INTEGER NOT NULL DEFAULT 0,
  total_repair_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_owner_share DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_tenant_share DECIMAL(10, 2) NOT NULL DEFAULT 0,
  average_vetusty_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,

  -- Métadonnées
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'contested', 'final')),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES profiles(id),
  contested_at TIMESTAMPTZ,
  contest_reason TEXT,
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_vetusty_reports_lease_id ON vetusty_reports(lease_id);
CREATE INDEX IF NOT EXISTS idx_vetusty_reports_settlement_id ON vetusty_reports(settlement_id);
CREATE INDEX IF NOT EXISTS idx_vetusty_reports_status ON vetusty_reports(status);

-- 2. Table des éléments de vétusté calculés
-- Détail de chaque élément avec le calcul
CREATE TABLE IF NOT EXISTS vetusty_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES vetusty_reports(id) ON DELETE CASCADE,

  -- Référence à l'élément de la grille
  vetusty_grid_item_id TEXT NOT NULL, -- ID de l'élément dans VETUSTY_GRID
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,

  -- Données pour le calcul
  age_years DECIMAL(4, 1) NOT NULL,
  lifespan_years INTEGER NOT NULL,
  franchise_years INTEGER NOT NULL,

  -- Résultat du calcul
  vetusty_rate DECIMAL(5, 2) NOT NULL, -- Taux de vétusté (0-100)
  repair_cost DECIMAL(10, 2) NOT NULL,
  owner_share DECIMAL(10, 2) NOT NULL,
  tenant_share DECIMAL(10, 2) NOT NULL,

  -- Lien avec EDL si applicable
  edl_entry_item_id UUID, -- Référence à l'item EDL d'entrée
  edl_exit_item_id UUID,  -- Référence à l'item EDL de sortie
  room_name TEXT,

  -- Justificatifs
  is_degradation BOOLEAN NOT NULL DEFAULT true, -- Dégradation vs usure normale
  notes TEXT,
  photo_urls TEXT[], -- URLs des photos justificatives
  invoice_url TEXT, -- URL du devis/facture

  -- Contestation
  is_contested BOOLEAN NOT NULL DEFAULT false,
  contest_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_vetusty_items_report_id ON vetusty_items(report_id);
CREATE INDEX IF NOT EXISTS idx_vetusty_items_category ON vetusty_items(category);
CREATE INDEX IF NOT EXISTS idx_vetusty_items_is_contested ON vetusty_items(is_contested);

-- 3. Table historique des grilles de vétusté utilisées
-- Pour traçabilité en cas de mise à jour de la grille
CREATE TABLE IF NOT EXISTS vetusty_grid_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version TEXT NOT NULL UNIQUE,
  effective_date DATE NOT NULL,
  description TEXT,
  grid_data JSONB NOT NULL, -- Snapshot de la grille
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer la version actuelle de la grille
INSERT INTO vetusty_grid_versions (version, effective_date, description, grid_data, is_current)
VALUES (
  '2026.1',
  '2026-01-27',
  'Grille de vétusté initiale basée sur les accords collectifs ANIL/FNAIM/UNPI',
  '{"source": "accords_collectifs", "items_count": 55}'::jsonb,
  true
) ON CONFLICT (version) DO NOTHING;

-- 4. Trigger pour mettre à jour updated_at
CREATE TRIGGER update_vetusty_reports_updated_at
  BEFORE UPDATE ON vetusty_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vetusty_items_updated_at
  BEFORE UPDATE ON vetusty_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Fonction pour calculer automatiquement les totaux du rapport
CREATE OR REPLACE FUNCTION update_vetusty_report_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vetusty_reports
  SET
    total_items = (SELECT COUNT(*) FROM vetusty_items WHERE report_id = COALESCE(NEW.report_id, OLD.report_id)),
    total_repair_cost = (SELECT COALESCE(SUM(repair_cost), 0) FROM vetusty_items WHERE report_id = COALESCE(NEW.report_id, OLD.report_id)),
    total_owner_share = (SELECT COALESCE(SUM(owner_share), 0) FROM vetusty_items WHERE report_id = COALESCE(NEW.report_id, OLD.report_id)),
    total_tenant_share = (SELECT COALESCE(SUM(tenant_share), 0) FROM vetusty_items WHERE report_id = COALESCE(NEW.report_id, OLD.report_id)),
    average_vetusty_rate = (
      SELECT CASE
        WHEN SUM(repair_cost) > 0
        THEN SUM(vetusty_rate * repair_cost) / SUM(repair_cost)
        ELSE 0
      END
      FROM vetusty_items
      WHERE report_id = COALESCE(NEW.report_id, OLD.report_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.report_id, OLD.report_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vetusty_report_totals_insert
  AFTER INSERT ON vetusty_items
  FOR EACH ROW EXECUTE FUNCTION update_vetusty_report_totals();

CREATE TRIGGER trigger_update_vetusty_report_totals_update
  AFTER UPDATE ON vetusty_items
  FOR EACH ROW EXECUTE FUNCTION update_vetusty_report_totals();

CREATE TRIGGER trigger_update_vetusty_report_totals_delete
  AFTER DELETE ON vetusty_items
  FOR EACH ROW EXECUTE FUNCTION update_vetusty_report_totals();

-- 6. RLS Policies
ALTER TABLE vetusty_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vetusty_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vetusty_grid_versions ENABLE ROW LEVEL SECURITY;

-- Lecture des rapports : propriétaire du bien ou locataire concerné
CREATE POLICY "vetusty_reports_select_policy" ON vetusty_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = vetusty_reports.lease_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          WHERE ls.lease_id = l.id
          AND ls.profile_id = auth.uid()
        )
      )
    )
  );

-- Création/modification : propriétaire uniquement
CREATE POLICY "vetusty_reports_insert_policy" ON vetusty_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = vetusty_reports.lease_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "vetusty_reports_update_policy" ON vetusty_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = vetusty_reports.lease_id
      AND p.owner_id = auth.uid()
    )
  );

-- Items de vétusté : mêmes règles via le rapport
CREATE POLICY "vetusty_items_select_policy" ON vetusty_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE vr.id = vetusty_items.report_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          WHERE ls.lease_id = l.id
          AND ls.profile_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "vetusty_items_insert_policy" ON vetusty_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE vr.id = vetusty_items.report_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "vetusty_items_update_policy" ON vetusty_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE vr.id = vetusty_items.report_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "vetusty_items_delete_policy" ON vetusty_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE vr.id = vetusty_items.report_id
      AND p.owner_id = auth.uid()
      AND vr.status = 'draft'
    )
  );

-- Grille de vétusté : lecture publique
CREATE POLICY "vetusty_grid_versions_select_policy" ON vetusty_grid_versions
  FOR SELECT USING (true);

-- 7. Commentaires
COMMENT ON TABLE vetusty_reports IS 'Rapports de calcul de vétusté pour les fins de bail';
COMMENT ON TABLE vetusty_items IS 'Éléments individuels du calcul de vétusté';
COMMENT ON TABLE vetusty_grid_versions IS 'Historique des versions de la grille de vétusté';

COMMENT ON COLUMN vetusty_items.vetusty_rate IS 'Taux de vétusté calculé (0-100%), représente la part d''usure normale';
COMMENT ON COLUMN vetusty_items.owner_share IS 'Part du coût à charge du propriétaire (vétusté/usure normale)';
COMMENT ON COLUMN vetusty_items.tenant_share IS 'Part du coût à charge du locataire (dégradations anormales)';
