-- ============================================
-- MODULE FIN DE BAIL + RÉNOVATION
-- Version ULTIME - SOTA 2025
-- ============================================

-- Table principale : Processus de fin de bail
CREATE TABLE IF NOT EXISTS lease_end_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Statut du processus
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',          -- En attente de déclenchement
    'triggered',        -- Déclenché automatiquement
    'edl_scheduled',    -- EDL sortie planifié
    'edl_in_progress',  -- EDL en cours
    'edl_completed',    -- EDL terminé
    'damages_assessed', -- Dommages évalués
    'dg_calculated',    -- DG calculée
    'renovation_planned', -- Rénovation planifiée
    'renovation_in_progress', -- Travaux en cours
    'ready_to_rent',    -- Prêt à relouer
    'completed',        -- Processus terminé
    'cancelled'         -- Annulé
  )),
  
  -- Dates clés
  lease_end_date DATE NOT NULL,
  trigger_date DATE NOT NULL,           -- Date de déclenchement auto
  edl_scheduled_date DATE,              -- Date EDL planifiée
  edl_completed_date DATE,              -- Date EDL effectuée
  renovation_start_date DATE,
  renovation_end_date DATE,
  ready_to_rent_date DATE,              -- Date prêt à relouer
  
  -- EDL Sortie ID
  edl_sortie_id UUID,
  
  -- Montants calculés
  dg_amount DECIMAL(10, 2) DEFAULT 0,           -- Dépôt de garantie initial
  dg_retention_amount DECIMAL(10, 2) DEFAULT 0, -- Retenue sur DG
  dg_refund_amount DECIMAL(10, 2) DEFAULT 0,    -- Montant à rembourser
  tenant_damage_cost DECIMAL(10, 2) DEFAULT 0,  -- Coût dommages locataire
  vetusty_cost DECIMAL(10, 2) DEFAULT 0,        -- Coût vétusté (proprio)
  renovation_cost DECIMAL(10, 2) DEFAULT 0,     -- Coût rénovation conseillée
  total_budget DECIMAL(10, 2) DEFAULT 0,        -- Budget total
  
  -- Progression
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  current_step INTEGER DEFAULT 0,
  
  -- Métadonnées
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_lease_id ON lease_end_processes(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_property_id ON lease_end_processes(property_id);
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_status ON lease_end_processes(status);
CREATE INDEX IF NOT EXISTS idx_lease_end_processes_trigger_date ON lease_end_processes(trigger_date);

-- Table : Éléments d'inspection EDL sortie
CREATE TABLE IF NOT EXISTS edl_inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_end_process_id UUID NOT NULL REFERENCES lease_end_processes(id) ON DELETE CASCADE,
  
  -- Catégorie d'inspection
  category TEXT NOT NULL CHECK (category IN (
    'murs',
    'sols',
    'salle_de_bain',
    'cuisine',
    'fenetres_portes',
    'electricite_plomberie',
    'meubles'
  )),
  
  -- État
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',   -- Non inspecté
    'ok',        -- Bon état
    'problem'    -- Problème détecté
  )),
  
  -- Description du problème
  problem_description TEXT,
  
  -- Photos (paths storage)
  photos JSONB DEFAULT '[]',
  
  -- Comparaison avec EDL entrée
  entry_condition TEXT,        -- État à l'entrée
  entry_photos JSONB DEFAULT '[]',
  
  -- Catégorisation du dommage
  damage_type TEXT CHECK (damage_type IN (
    'tenant_damage',  -- Dommage locataire
    'normal_wear',    -- Usure normale
    'recommended_renovation' -- Rénovation conseillée
  )),
  
  -- Coût estimé
  estimated_cost DECIMAL(10, 2) DEFAULT 0,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edl_inspection_items_process ON edl_inspection_items(lease_end_process_id);
CREATE INDEX IF NOT EXISTS idx_edl_inspection_items_category ON edl_inspection_items(category);

-- Table : Travaux de rénovation
CREATE TABLE IF NOT EXISTS renovation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_end_process_id UUID NOT NULL REFERENCES lease_end_processes(id) ON DELETE CASCADE,
  
  -- Type de travaux
  work_type TEXT NOT NULL CHECK (work_type IN (
    'peinture',
    'sol',
    'plomberie',
    'electricite',
    'menuiserie',
    'nettoyage',
    'salle_de_bain',
    'cuisine',
    'autres'
  )),
  
  -- Description
  title TEXT NOT NULL,
  description TEXT,
  
  -- Qui paye ?
  payer TEXT NOT NULL CHECK (payer IN (
    'tenant',    -- Locataire (retenue DG)
    'owner',     -- Propriétaire
    'shared'     -- Partagé
  )),
  
  -- Coûts
  estimated_cost DECIMAL(10, 2) DEFAULT 0,
  actual_cost DECIMAL(10, 2),
  tenant_share DECIMAL(10, 2) DEFAULT 0,
  owner_share DECIMAL(10, 2) DEFAULT 0,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',       -- En attente
    'quote_requested', -- Devis demandé
    'quote_received',  -- Devis reçu
    'approved',        -- Approuvé
    'in_progress',     -- En cours
    'completed',       -- Terminé
    'cancelled'        -- Annulé
  )),
  
  -- Priorité
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Dates
  scheduled_date DATE,
  completed_date DATE,
  
  -- Prestataire
  provider_id UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_renovation_items_process ON renovation_items(lease_end_process_id);
CREATE INDEX IF NOT EXISTS idx_renovation_items_status ON renovation_items(status);

-- Table : Devis de rénovation
CREATE TABLE IF NOT EXISTS renovation_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renovation_item_id UUID NOT NULL REFERENCES renovation_items(id) ON DELETE CASCADE,
  lease_end_process_id UUID NOT NULL REFERENCES lease_end_processes(id) ON DELETE CASCADE,
  
  -- Prestataire
  provider_id UUID REFERENCES profiles(id),
  provider_name TEXT,
  provider_email TEXT,
  provider_phone TEXT,
  
  -- Montants
  amount DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  
  -- Détails
  description TEXT,
  validity_date DATE,
  estimated_duration INTEGER, -- en jours
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',   -- En attente
    'received',  -- Reçu
    'accepted',  -- Accepté
    'rejected',  -- Refusé
    'expired'    -- Expiré
  )),
  
  -- Documents
  document_path TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_renovation_quotes_item ON renovation_quotes(renovation_item_id);
CREATE INDEX IF NOT EXISTS idx_renovation_quotes_process ON renovation_quotes(lease_end_process_id);

-- Table : Timeline / Actions du processus
CREATE TABLE IF NOT EXISTS lease_end_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_end_process_id UUID NOT NULL REFERENCES lease_end_processes(id) ON DELETE CASCADE,
  
  -- Jour relatif (J+0, J+1, etc.)
  day_offset INTEGER NOT NULL DEFAULT 0,
  
  -- Action
  action_type TEXT NOT NULL CHECK (action_type IN (
    'dg_retention',        -- Déduire DG
    'request_quotes',      -- Demander devis
    'select_quote',        -- Choisir devis
    'start_renovation',    -- Début travaux
    'take_photos',         -- Nouvelles photos
    'mark_ready',          -- Marquer prêt
    'create_listing',      -- Créer annonce
    'custom'               -- Action personnalisée
  )),
  
  title TEXT NOT NULL,
  description TEXT,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'skipped'
  )),
  
  -- Dates
  scheduled_date DATE,
  completed_date DATE,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_end_timeline_process ON lease_end_timeline(lease_end_process_id);

-- Table : Grille de vétusté
CREATE TABLE IF NOT EXISTS vetusty_grid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Catégorie
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  
  -- Durée de vie en années
  lifespan_years INTEGER NOT NULL,
  
  -- Coefficient par année (décroissant)
  yearly_depreciation DECIMAL(5, 4) NOT NULL DEFAULT 0.0667, -- ~6.67% par an pour 15 ans
  
  -- Valeur minimale résiduelle (%)
  min_residual_value DECIMAL(5, 4) NOT NULL DEFAULT 0.10, -- 10% minimum
  
  -- Actif
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insérer la grille de vétusté standard
INSERT INTO vetusty_grid (category, item, lifespan_years, yearly_depreciation, min_residual_value) VALUES
  -- Peintures et revêtements muraux
  ('peinture', 'Peinture standard', 10, 0.10, 0.10),
  ('peinture', 'Papier peint', 12, 0.0833, 0.10),
  ('peinture', 'Enduit décoratif', 15, 0.0667, 0.10),
  
  -- Sols
  ('sol', 'Moquette', 7, 0.1429, 0.10),
  ('sol', 'Parquet vitrifié', 15, 0.0667, 0.15),
  ('sol', 'Carrelage', 25, 0.04, 0.20),
  ('sol', 'Lino/PVC', 10, 0.10, 0.10),
  ('sol', 'Parquet flottant', 12, 0.0833, 0.10),
  
  -- Équipements
  ('equipement', 'Robinetterie', 10, 0.10, 0.10),
  ('equipement', 'Sanitaires (WC, lavabo)', 20, 0.05, 0.15),
  ('equipement', 'Baignoire/Douche', 20, 0.05, 0.15),
  ('equipement', 'Chauffe-eau', 12, 0.0833, 0.10),
  ('equipement', 'Radiateurs', 20, 0.05, 0.15),
  ('equipement', 'Volets/Stores', 15, 0.0667, 0.10),
  
  -- Électroménager (meublé)
  ('electromenager', 'Réfrigérateur', 10, 0.10, 0.10),
  ('electromenager', 'Lave-linge', 10, 0.10, 0.10),
  ('electromenager', 'Four', 12, 0.0833, 0.10),
  ('electromenager', 'Plaques de cuisson', 12, 0.0833, 0.10),
  ('electromenager', 'Micro-ondes', 8, 0.125, 0.10),
  
  -- Menuiseries
  ('menuiserie', 'Portes intérieures', 20, 0.05, 0.15),
  ('menuiserie', 'Fenêtres PVC', 25, 0.04, 0.20),
  ('menuiserie', 'Fenêtres bois', 20, 0.05, 0.15),
  ('menuiserie', 'Volets roulants', 15, 0.0667, 0.10),
  
  -- Meubles
  ('meuble', 'Literie', 10, 0.10, 0.10),
  ('meuble', 'Canapé', 10, 0.10, 0.10),
  ('meuble', 'Table/Chaises', 15, 0.0667, 0.10),
  ('meuble', 'Armoire/Placard', 20, 0.05, 0.15)
ON CONFLICT DO NOTHING;

-- Table : Barème des coûts de réparation (basé INSEE + BT01 2025)
CREATE TABLE IF NOT EXISTS repair_cost_grid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  work_type TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Coût au m² ou à l'unité
  unit TEXT NOT NULL DEFAULT 'm2' CHECK (unit IN ('m2', 'ml', 'unite', 'forfait')),
  
  -- Fourchette de prix (€)
  cost_min DECIMAL(10, 2) NOT NULL,
  cost_max DECIMAL(10, 2) NOT NULL,
  cost_avg DECIMAL(10, 2) NOT NULL,
  
  -- Zone géographique (coefficient)
  zone_coefficient DECIMAL(5, 2) DEFAULT 1.00,
  
  -- Année de référence
  reference_year INTEGER DEFAULT 2025,
  
  -- Index BT01 de référence
  bt01_index DECIMAL(10, 2),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insérer le barème des coûts 2025
INSERT INTO repair_cost_grid (work_type, description, unit, cost_min, cost_max, cost_avg) VALUES
  -- Peinture
  ('peinture', 'Peinture murs et plafonds', 'm2', 18, 35, 25),
  ('peinture', 'Lessivage murs', 'm2', 5, 12, 8),
  ('peinture', 'Rebouchage trous (petit)', 'unite', 15, 30, 20),
  ('peinture', 'Rebouchage trous (gros)', 'unite', 40, 80, 60),
  
  -- Sols
  ('sol', 'Remplacement moquette', 'm2', 25, 50, 35),
  ('sol', 'Remplacement parquet flottant', 'm2', 35, 70, 50),
  ('sol', 'Vitrification parquet', 'm2', 25, 45, 35),
  ('sol', 'Remplacement carrelage', 'm2', 50, 100, 75),
  ('sol', 'Remplacement lino/PVC', 'm2', 20, 40, 30),
  ('sol', 'Nettoyage professionnel sol', 'm2', 3, 8, 5),
  
  -- Plomberie
  ('plomberie', 'Remplacement robinet', 'unite', 80, 200, 130),
  ('plomberie', 'Débouchage canalisation', 'forfait', 80, 200, 120),
  ('plomberie', 'Remplacement joint silicone', 'ml', 8, 20, 12),
  ('plomberie', 'Remplacement WC', 'unite', 300, 600, 450),
  ('plomberie', 'Remplacement chauffe-eau', 'unite', 800, 1500, 1100),
  
  -- Électricité
  ('electricite', 'Remplacement prise', 'unite', 50, 100, 70),
  ('electricite', 'Remplacement interrupteur', 'unite', 40, 80, 60),
  ('electricite', 'Vérification tableau électrique', 'forfait', 150, 300, 220),
  
  -- Menuiserie
  ('menuiserie', 'Remplacement porte intérieure', 'unite', 250, 500, 350),
  ('menuiserie', 'Réparation serrure', 'unite', 80, 200, 130),
  ('menuiserie', 'Remplacement vitre', 'unite', 100, 300, 180),
  ('menuiserie', 'Réparation volet', 'unite', 100, 250, 160),
  
  -- Nettoyage
  ('nettoyage', 'Nettoyage complet appartement', 'm2', 8, 20, 12),
  ('nettoyage', 'Nettoyage fin de bail', 'm2', 5, 15, 10),
  
  -- Cuisine
  ('cuisine', 'Remplacement évier', 'unite', 200, 500, 320),
  ('cuisine', 'Remplacement plan de travail', 'ml', 150, 400, 250),
  ('cuisine', 'Remplacement hotte', 'unite', 200, 600, 350),
  
  -- Salle de bain
  ('salle_de_bain', 'Remplacement lavabo', 'unite', 200, 500, 320),
  ('salle_de_bain', 'Remplacement douche', 'unite', 500, 1500, 900),
  ('salle_de_bain', 'Réfection joints salle de bain', 'forfait', 100, 250, 160)
ON CONFLICT DO NOTHING;

-- Fonction : Calculer le délai de préavis selon le type de bail
CREATE OR REPLACE FUNCTION get_lease_end_notice_days(lease_type TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE lease_type
    WHEN 'nu' THEN 90              -- Location nue : 3 mois
    WHEN 'meuble' THEN 30          -- Meublé : 1 mois
    WHEN 'colocation' THEN 30      -- Colocation : 1 mois
    WHEN 'saisonnier' THEN 0       -- Saisonnier : pas de préavis
    WHEN 'mobilite' THEN 15        -- Mobilité : 15 jours
    WHEN 'etudiant' THEN 30        -- Étudiant : 1 mois
    WHEN 'commercial' THEN 180     -- Commercial : 6 mois
    ELSE 30                        -- Par défaut : 1 mois
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction : Calculer la vétusté
CREATE OR REPLACE FUNCTION calculate_vetusty(
  p_category TEXT,
  p_item TEXT,
  p_age_years INTEGER,
  p_original_cost DECIMAL
)
RETURNS TABLE(
  depreciation_rate DECIMAL,
  residual_value DECIMAL,
  owner_share DECIMAL,
  tenant_share DECIMAL
) AS $$
DECLARE
  v_lifespan INTEGER;
  v_yearly_depreciation DECIMAL;
  v_min_residual DECIMAL;
  v_depreciation DECIMAL;
  v_residual DECIMAL;
BEGIN
  -- Récupérer la grille de vétusté
  SELECT 
    vg.lifespan_years,
    vg.yearly_depreciation,
    vg.min_residual_value
  INTO v_lifespan, v_yearly_depreciation, v_min_residual
  FROM vetusty_grid vg
  WHERE vg.category = p_category AND vg.item = p_item AND vg.is_active = true
  LIMIT 1;
  
  -- Si pas trouvé, utiliser des valeurs par défaut
  IF v_lifespan IS NULL THEN
    v_lifespan := 10;
    v_yearly_depreciation := 0.10;
    v_min_residual := 0.10;
  END IF;
  
  -- Calculer la dépréciation
  v_depreciation := LEAST(p_age_years * v_yearly_depreciation, 1 - v_min_residual);
  v_residual := GREATEST(1 - v_depreciation, v_min_residual);
  
  RETURN QUERY SELECT
    v_depreciation AS depreciation_rate,
    p_original_cost * v_residual AS residual_value,
    p_original_cost * v_depreciation AS owner_share,      -- Part propriétaire (vétusté)
    p_original_cost * v_residual AS tenant_share;         -- Part locataire (si dégradation)
END;
$$ LANGUAGE plpgsql;

-- Fonction : Déclencher automatiquement les processus de fin de bail
CREATE OR REPLACE FUNCTION trigger_lease_end_processes()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_lease RECORD;
  v_trigger_date DATE;
  v_notice_days INTEGER;
BEGIN
  -- Parcourir les baux actifs avec une date de fin
  FOR v_lease IN
    SELECT 
      l.id as lease_id,
      l.property_id,
      l.type_bail,
      l.date_fin,
      l.depot_de_garantie
    FROM leases l
    LEFT JOIN lease_end_processes lep ON lep.lease_id = l.id
    WHERE 
      l.statut = 'active'
      AND l.date_fin IS NOT NULL
      AND lep.id IS NULL -- Pas encore de processus créé
  LOOP
    -- Calculer la date de déclenchement
    v_notice_days := get_lease_end_notice_days(v_lease.type_bail);
    v_trigger_date := v_lease.date_fin - (v_notice_days || ' days')::INTERVAL;
    
    -- Si on doit déclencher aujourd'hui ou avant
    IF v_trigger_date <= CURRENT_DATE THEN
      INSERT INTO lease_end_processes (
        lease_id,
        property_id,
        status,
        lease_end_date,
        trigger_date,
        dg_amount
      ) VALUES (
        v_lease.lease_id,
        v_lease.property_id,
        'triggered',
        v_lease.date_fin,
        v_trigger_date,
        v_lease.depot_de_garantie
      );
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction RPC : Obtenir les processus de fin de bail pour un propriétaire
CREATE OR REPLACE FUNCTION get_owner_lease_end_processes(p_owner_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', lep.id,
      'lease_id', lep.lease_id,
      'property_id', lep.property_id,
      'status', lep.status,
      'lease_end_date', lep.lease_end_date,
      'trigger_date', lep.trigger_date,
      'progress_percentage', lep.progress_percentage,
      'dg_amount', lep.dg_amount,
      'dg_retention_amount', lep.dg_retention_amount,
      'dg_refund_amount', lep.dg_refund_amount,
      'tenant_damage_cost', lep.tenant_damage_cost,
      'vetusty_cost', lep.vetusty_cost,
      'renovation_cost', lep.renovation_cost,
      'total_budget', lep.total_budget,
      'property', jsonb_build_object(
        'id', p.id,
        'adresse_complete', p.adresse_complete,
        'ville', p.ville,
        'type', p.type
      ),
      'lease', jsonb_build_object(
        'id', l.id,
        'type_bail', l.type_bail,
        'loyer', l.loyer,
        'date_debut', l.date_debut,
        'date_fin', l.date_fin
      ),
      'created_at', lep.created_at
    )
    ORDER BY lep.lease_end_date ASC
  )
  INTO v_result
  FROM lease_end_processes lep
  JOIN properties p ON p.id = lep.property_id
  JOIN leases l ON l.id = lep.lease_id
  WHERE p.owner_id = p_owner_id
    AND lep.status NOT IN ('completed', 'cancelled');
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction RPC : Calculer les coûts de réparation
CREATE OR REPLACE FUNCTION estimate_repair_costs(
  p_work_type TEXT,
  p_surface_or_quantity DECIMAL,
  p_zone TEXT DEFAULT 'france'
)
RETURNS TABLE(
  cost_min DECIMAL,
  cost_max DECIMAL,
  cost_avg DECIMAL,
  unit TEXT
) AS $$
DECLARE
  v_zone_coef DECIMAL := 1.0;
BEGIN
  -- Coefficient par zone
  v_zone_coef := CASE p_zone
    WHEN 'paris' THEN 1.30
    WHEN 'idf' THEN 1.20
    WHEN 'lyon' THEN 1.10
    WHEN 'marseille' THEN 1.05
    WHEN 'drom' THEN 1.15
    ELSE 1.0
  END;
  
  RETURN QUERY
  SELECT
    rcg.cost_min * p_surface_or_quantity * v_zone_coef AS cost_min,
    rcg.cost_max * p_surface_or_quantity * v_zone_coef AS cost_max,
    rcg.cost_avg * p_surface_or_quantity * v_zone_coef AS cost_avg,
    rcg.unit
  FROM repair_cost_grid rcg
  WHERE rcg.work_type = p_work_type
    AND rcg.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Ajout colonne status au properties (pour statut locatif)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'rental_status'
  ) THEN
    ALTER TABLE properties ADD COLUMN rental_status TEXT DEFAULT 'vacant' 
      CHECK (rental_status IN ('vacant', 'end_of_lease', 'renovation', 'ready_to_rent', 'occupied'));
  END IF;
END $$;

-- RLS Policies
ALTER TABLE lease_end_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE renovation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE renovation_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_end_timeline ENABLE ROW LEVEL SECURITY;

-- Propriétaires : lecture/écriture sur leurs processus
CREATE POLICY "owner_lease_end_processes_policy" ON lease_end_processes
FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = user_profile_id())
);

CREATE POLICY "owner_edl_inspection_items_policy" ON edl_inspection_items
FOR ALL USING (
  lease_end_process_id IN (
    SELECT id FROM lease_end_processes 
    WHERE property_id IN (SELECT id FROM properties WHERE owner_id = user_profile_id())
  )
);

CREATE POLICY "owner_renovation_items_policy" ON renovation_items
FOR ALL USING (
  lease_end_process_id IN (
    SELECT id FROM lease_end_processes 
    WHERE property_id IN (SELECT id FROM properties WHERE owner_id = user_profile_id())
  )
);

CREATE POLICY "owner_renovation_quotes_policy" ON renovation_quotes
FOR ALL USING (
  lease_end_process_id IN (
    SELECT id FROM lease_end_processes 
    WHERE property_id IN (SELECT id FROM properties WHERE owner_id = user_profile_id())
  )
);

CREATE POLICY "owner_lease_end_timeline_policy" ON lease_end_timeline
FOR ALL USING (
  lease_end_process_id IN (
    SELECT id FROM lease_end_processes 
    WHERE property_id IN (SELECT id FROM properties WHERE owner_id = user_profile_id())
  )
);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lease_end_processes_updated_at ON lease_end_processes;
CREATE TRIGGER update_lease_end_processes_updated_at
  BEFORE UPDATE ON lease_end_processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_renovation_items_updated_at ON renovation_items;
CREATE TRIGGER update_renovation_items_updated_at
  BEFORE UPDATE ON renovation_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_edl_inspection_items_updated_at ON edl_inspection_items;
CREATE TRIGGER update_edl_inspection_items_updated_at
  BEFORE UPDATE ON edl_inspection_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

