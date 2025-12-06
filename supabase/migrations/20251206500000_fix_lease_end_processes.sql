-- ============================================
-- Migration: Unifier lease_end_processes et end_of_lease_processes
-- Date: 2025-12-06
-- Problème: Incohérence de nommage entre tables et APIs
-- ============================================

-- ============================================
-- 1. CRÉER LA TABLE lease_end_processes (nom utilisé par l'API)
-- ============================================
CREATE TABLE IF NOT EXISTS lease_end_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  created_by UUID REFERENCES profiles(id),
  
  -- Status & Progress
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'triggered', 'edl_scheduled', 'edl_in_progress', 'edl_completed',
    'damages_assessed', 'dg_calculated', 'renovation_planned', 'renovation_in_progress',
    'ready_to_rent', 'completed', 'cancelled'
  )),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  
  -- Dates importantes
  lease_end_date DATE NOT NULL,
  trigger_date DATE,
  edl_sortie_scheduled_date DATE,
  edl_sortie_completed_date DATE,
  ready_to_rent_date DATE,
  completed_date DATE,
  
  -- Dépôt de garantie
  dg_amount DECIMAL(10,2) DEFAULT 0,
  dg_retention_amount DECIMAL(10,2) DEFAULT 0,
  dg_refund_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Coûts calculés
  tenant_damage_cost DECIMAL(10,2) DEFAULT 0,
  vetusty_cost DECIMAL(10,2) DEFAULT 0,
  renovation_cost DECIMAL(10,2) DEFAULT 0,
  total_budget DECIMAL(10,2) DEFAULT 0,
  
  -- Références EDL
  edl_entree_id UUID REFERENCES edl(id),
  edl_sortie_id UUID REFERENCES edl(id),
  
  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contraintes
  UNIQUE(lease_id)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_status ON lease_end_processes(status);
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_lease ON lease_end_processes(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_property ON lease_end_processes(property_id);
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_created_by ON lease_end_processes(created_by);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_lease_end_processes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lease_end_processes_updated_at ON lease_end_processes;
CREATE TRIGGER trg_lease_end_processes_updated_at
  BEFORE UPDATE ON lease_end_processes
  FOR EACH ROW EXECUTE FUNCTION update_lease_end_processes_updated_at();

-- ============================================
-- 2. RLS POLICIES pour lease_end_processes
-- ============================================
ALTER TABLE lease_end_processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_end_owner_select" ON lease_end_processes;
DROP POLICY IF EXISTS "lease_end_owner_all" ON lease_end_processes;
DROP POLICY IF EXISTS "lease_end_admin_all" ON lease_end_processes;

-- Owners can view their processes (via property ownership)
CREATE POLICY "lease_end_owner_select" ON lease_end_processes FOR SELECT TO authenticated
USING (
  property_id IN (SELECT id FROM properties WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- Owners can manage their processes
CREATE POLICY "lease_end_owner_all" ON lease_end_processes FOR ALL TO authenticated
USING (
  property_id IN (SELECT id FROM properties WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
)
WITH CHECK (
  property_id IN (SELECT id FROM properties WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- Admin full access
CREATE POLICY "lease_end_admin_all" ON lease_end_processes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- ============================================
-- 3. TABLES DE SUPPORT
-- ============================================

-- Items d'inspection EDL sortie
CREATE TABLE IF NOT EXISTS edl_inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_end_process_id UUID NOT NULL REFERENCES lease_end_processes(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'murs', 'sols', 'plafonds', 'salle_de_bain', 'cuisine', 
    'fenetres_portes', 'electricite_plomberie', 'meubles', 'exterieur', 'autre'
  )),
  item_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  condition_entree TEXT,
  condition_sortie TEXT,
  damage_type TEXT CHECK (damage_type IN ('none', 'normal_wear', 'tenant_damage', 'pre_existing')),
  damage_description TEXT,
  photo_urls TEXT[], -- Array of storage paths
  estimated_cost DECIMAL(10,2) DEFAULT 0,
  vetusty_rate DECIMAL(5,2) DEFAULT 0, -- Taux de vétusté (0-100)
  tenant_responsibility DECIMAL(5,2) DEFAULT 0, -- Part locataire (0-100)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_items_process ON edl_inspection_items(lease_end_process_id);
CREATE INDEX IF NOT EXISTS idx_edl_items_category ON edl_inspection_items(category);

-- RLS pour edl_inspection_items
ALTER TABLE edl_inspection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "edl_items_via_process" ON edl_inspection_items;
CREATE POLICY "edl_items_via_process" ON edl_inspection_items FOR ALL TO authenticated
USING (
  lease_end_process_id IN (SELECT id FROM lease_end_processes)
);

-- Items de rénovation
CREATE TABLE IF NOT EXISTS renovation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_end_process_id UUID NOT NULL REFERENCES lease_end_processes(id) ON DELETE CASCADE,
  work_type TEXT NOT NULL,
  description TEXT,
  room TEXT,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  estimated_cost DECIMAL(10,2) DEFAULT 0,
  vetusty_deduction DECIMAL(10,2) DEFAULT 0,
  tenant_share DECIMAL(10,2) DEFAULT 0,
  owner_share DECIMAL(10,2) DEFAULT 0,
  payer TEXT CHECK (payer IN ('tenant', 'owner', 'shared')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'approved', 'in_progress', 'completed', 'cancelled')),
  scheduled_date DATE,
  completed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renovation_items_process ON renovation_items(lease_end_process_id);

-- RLS
ALTER TABLE renovation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "renovation_items_via_process" ON renovation_items;
CREATE POLICY "renovation_items_via_process" ON renovation_items FOR ALL TO authenticated
USING (
  lease_end_process_id IN (SELECT id FROM lease_end_processes)
);

-- Timeline des actions
CREATE TABLE IF NOT EXISTS lease_end_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_end_process_id UUID NOT NULL REFERENCES lease_end_processes(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  description TEXT,
  day_offset INTEGER NOT NULL, -- Nombre de jours avant/après la date de fin
  scheduled_date DATE,
  completed_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  assigned_to UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_process ON lease_end_timeline(lease_end_process_id);

-- RLS
ALTER TABLE lease_end_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timeline_via_process" ON lease_end_timeline;
CREATE POLICY "timeline_via_process" ON lease_end_timeline FOR ALL TO authenticated
USING (
  lease_end_process_id IN (SELECT id FROM lease_end_processes)
);

-- ============================================
-- 4. FONCTION RPC CORRIGÉE
-- ============================================
DROP FUNCTION IF EXISTS public.get_owner_lease_end_processes(UUID);
CREATE OR REPLACE FUNCTION public.get_owner_lease_end_processes(p_owner_id UUID)
RETURNS TABLE (
  id UUID,
  lease_id UUID,
  property_id UUID,
  status TEXT,
  progress_percentage INTEGER,
  lease_end_date DATE,
  trigger_date DATE,
  dg_amount DECIMAL,
  dg_retention_amount DECIMAL,
  dg_refund_amount DECIMAL,
  tenant_damage_cost DECIMAL,
  vetusty_cost DECIMAL,
  renovation_cost DECIMAL,
  total_budget DECIMAL,
  created_at TIMESTAMPTZ,
  -- Données jointes
  property JSONB,
  lease JSONB,
  tenant JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lep.id,
    lep.lease_id,
    lep.property_id,
    lep.status,
    lep.progress_percentage,
    lep.lease_end_date,
    lep.trigger_date,
    lep.dg_amount,
    lep.dg_retention_amount,
    lep.dg_refund_amount,
    lep.tenant_damage_cost,
    lep.vetusty_cost,
    lep.renovation_cost,
    lep.total_budget,
    lep.created_at,
    -- Property info
    jsonb_build_object(
      'id', p.id,
      'adresse_complete', p.adresse_complete,
      'ville', p.ville,
      'code_postal', p.code_postal,
      'type', p.type
    ) AS property,
    -- Lease info
    jsonb_build_object(
      'id', l.id,
      'type_bail', l.type_bail,
      'loyer', l.loyer,
      'charges_forfaitaires', l.charges_forfaitaires,
      'depot_de_garantie', l.depot_de_garantie,
      'date_debut', l.date_debut,
      'date_fin', l.date_fin
    ) AS lease,
    -- Tenant info (first tenant signer)
    COALESCE(
      (
        SELECT jsonb_build_object(
          'id', pr.id,
          'prenom', pr.prenom,
          'nom', pr.nom,
          'email', u.email
        )
        FROM lease_signers ls
        JOIN profiles pr ON pr.id = ls.profile_id
        LEFT JOIN auth.users u ON u.id = pr.user_id
        WHERE ls.lease_id = l.id 
          AND ls.role IN ('locataire_principal', 'locataire')
        LIMIT 1
      ),
      '{}'::jsonb
    ) AS tenant
  FROM lease_end_processes lep
  JOIN properties p ON p.id = lep.property_id
  JOIN leases l ON l.id = lep.lease_id
  WHERE p.owner_id = p_owner_id
  ORDER BY lep.lease_end_date ASC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_lease_end_processes(UUID) TO authenticated;

-- ============================================
-- 5. VUE POUR LES BAUX À SURVEILLER (trigger)
-- ============================================
CREATE OR REPLACE VIEW v_upcoming_lease_ends AS
SELECT 
  l.id AS lease_id,
  l.property_id,
  l.type_bail,
  l.loyer,
  l.date_fin,
  p.owner_id,
  p.adresse_complete,
  p.ville,
  CASE l.type_bail
    WHEN 'nu' THEN 90
    WHEN 'meuble' THEN 30
    WHEN 'colocation' THEN 30
    WHEN 'saisonnier' THEN 0
    WHEN 'mobilite' THEN 15
    WHEN 'etudiant' THEN 30
    WHEN 'commercial' THEN 180
    ELSE 30
  END AS trigger_days,
  (l.date_fin::DATE - CURRENT_DATE) AS days_until_end,
  (l.date_fin::DATE - CURRENT_DATE - 
    CASE l.type_bail
      WHEN 'nu' THEN 90
      WHEN 'meuble' THEN 30
      WHEN 'colocation' THEN 30
      WHEN 'saisonnier' THEN 0
      WHEN 'mobilite' THEN 15
      WHEN 'etudiant' THEN 30
      WHEN 'commercial' THEN 180
      ELSE 30
    END
  ) AS days_until_trigger,
  CASE 
    WHEN (l.date_fin::DATE - CURRENT_DATE - 
      CASE l.type_bail
        WHEN 'nu' THEN 90
        WHEN 'meuble' THEN 30
        WHEN 'colocation' THEN 30
        WHEN 'saisonnier' THEN 0
        WHEN 'mobilite' THEN 15
        WHEN 'etudiant' THEN 30
        WHEN 'commercial' THEN 180
        ELSE 30
      END) <= 0 THEN true
    ELSE false
  END AS will_trigger_soon
FROM leases l
JOIN properties p ON p.id = l.property_id
WHERE l.statut IN ('active', 'pending_signature')
  AND l.date_fin IS NOT NULL
  AND l.date_fin >= CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM lease_end_processes lep 
    WHERE lep.lease_id = l.id AND lep.status NOT IN ('completed', 'cancelled')
  );

-- ============================================
-- 6. GRILLES DE RÉFÉRENCE
-- ============================================

-- Grille de vétusté (si n'existe pas)
CREATE TABLE IF NOT EXISTS vetusty_grid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  lifespan_years INTEGER NOT NULL,
  yearly_depreciation DECIMAL(5,2) NOT NULL,
  min_residual_value DECIMAL(5,2) DEFAULT 10, -- Valeur résiduelle minimum en %
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, item)
);

-- Grille des coûts de réparation (si n'existe pas)
CREATE TABLE IF NOT EXISTS repair_cost_grid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL, -- 'm2', 'unite', 'ml' (mètre linéaire)
  cost_min DECIMAL(10,2) NOT NULL,
  cost_max DECIMAL(10,2) NOT NULL,
  cost_avg DECIMAL(10,2) NOT NULL,
  region TEXT DEFAULT 'france', -- Pour différencier les coûts par région
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(work_type, region)
);

-- Données de base pour la grille de vétusté
INSERT INTO vetusty_grid (category, item, lifespan_years, yearly_depreciation, min_residual_value) VALUES
  ('sols', 'moquette', 7, 14.28, 0),
  ('sols', 'parquet_massif', 25, 4, 20),
  ('sols', 'parquet_stratifie', 15, 6.67, 10),
  ('sols', 'carrelage', 30, 3.33, 20),
  ('sols', 'lino_pvc', 10, 10, 10),
  ('murs', 'peinture', 7, 14.28, 0),
  ('murs', 'papier_peint', 9, 11.11, 0),
  ('murs', 'faience', 30, 3.33, 20),
  ('plafonds', 'peinture', 10, 10, 0),
  ('plafonds', 'lambris', 20, 5, 10),
  ('equipements', 'robinetterie', 15, 6.67, 10),
  ('equipements', 'sanitaires', 25, 4, 15),
  ('equipements', 'chauffe_eau', 15, 6.67, 10),
  ('equipements', 'chaudiere', 20, 5, 15),
  ('menuiseries', 'portes_interieures', 25, 4, 15),
  ('menuiseries', 'fenetres_pvc', 30, 3.33, 20),
  ('menuiseries', 'volets', 25, 4, 15),
  ('electricite', 'prises_interrupteurs', 25, 4, 15),
  ('electricite', 'tableau_electrique', 30, 3.33, 20)
ON CONFLICT (category, item) DO NOTHING;

-- Données de base pour les coûts de réparation
INSERT INTO repair_cost_grid (work_type, description, unit, cost_min, cost_max, cost_avg) VALUES
  ('peinture_murs', 'Peinture des murs (préparation + 2 couches)', 'm2', 15, 35, 25),
  ('peinture_plafond', 'Peinture du plafond', 'm2', 18, 40, 28),
  ('parquet_stratifie', 'Pose de parquet stratifié', 'm2', 25, 50, 38),
  ('carrelage', 'Pose de carrelage', 'm2', 35, 80, 55),
  ('moquette', 'Pose de moquette', 'm2', 15, 40, 25),
  ('rebouchage_trous', 'Rebouchage de trous', 'unite', 5, 20, 12),
  ('porte_interieure', 'Remplacement porte intérieure', 'unite', 150, 400, 250),
  ('robinetterie', 'Remplacement robinetterie', 'unite', 80, 200, 130),
  ('prise_electrique', 'Remplacement prise électrique', 'unite', 25, 60, 40),
  ('interrupteur', 'Remplacement interrupteur', 'unite', 20, 50, 35),
  ('nettoyage_profond', 'Nettoyage profond complet', 'unite', 100, 300, 180),
  ('desinfection', 'Désinfection locaux', 'm2', 5, 15, 9)
ON CONFLICT (work_type, region) DO NOTHING;

-- ============================================
-- DONE
-- ============================================
COMMENT ON TABLE lease_end_processes IS 'Processus de fin de bail avec suivi EDL, rénovation et restitution DG';
COMMENT ON TABLE edl_inspection_items IS 'Items d''inspection pour l''EDL de sortie';
COMMENT ON TABLE renovation_items IS 'Travaux de rénovation planifiés';
COMMENT ON TABLE lease_end_timeline IS 'Timeline des actions de fin de bail';
COMMENT ON TABLE vetusty_grid IS 'Grille de vétusté officielle pour calcul de la part locataire';
COMMENT ON TABLE repair_cost_grid IS 'Grille de référence des coûts de réparation';

