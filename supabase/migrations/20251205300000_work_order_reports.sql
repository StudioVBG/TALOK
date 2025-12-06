-- =====================================================
-- MIGRATION: Rapports d'intervention SOTA 2025
-- Photos avant/après, checklists techniques, time tracking
-- =====================================================

-- =====================================================
-- 1. TABLE: checklist_templates
-- Templates de checklists par type d'intervention
-- =====================================================

CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Catégorisation
  service_type TEXT NOT NULL, -- plomberie, electricite, etc.
  intervention_type TEXT, -- depannage, installation, entretien, diagnostic
  name TEXT NOT NULL,
  description TEXT,
  
  -- Structure des items
  items JSONB NOT NULL DEFAULT '[]',
  -- Format: [
  --   {
  --     "id": "1",
  --     "label": "Texte de la question",
  --     "type": "checkbox" | "text" | "number" | "photo" | "select" | "rating",
  --     "required": true | false,
  --     "options": ["option1", "option2"] (pour select),
  --     "min": 0, "max": 10 (pour number/rating),
  --     "category": "sécurité" | "qualité" | "conformité"
  --   }
  -- ]
  
  -- Score de conformité
  min_score_required INTEGER DEFAULT 0, -- Score minimum pour valider
  
  -- Versioning
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_checklist_templates_service ON checklist_templates(service_type);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_active ON checklist_templates(is_active);

-- =====================================================
-- 2. TABLE: work_order_reports
-- Rapports d'intervention avec photos et checklists
-- =====================================================

CREATE TABLE IF NOT EXISTS work_order_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  -- Type de rapport
  report_type TEXT NOT NULL CHECK (report_type IN (
    'arrival',      -- Arrivée sur site (check-in)
    'before',       -- État avant intervention
    'during',       -- Pendant (pour longs chantiers)
    'after',        -- État après intervention
    'completion'    -- Rapport final de fin
  )),
  
  -- Horodatage précis
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Géolocalisation
  gps_latitude DECIMAL(10, 8),
  gps_longitude DECIMAL(11, 8),
  gps_accuracy DECIMAL(6, 2), -- Précision en mètres
  gps_address TEXT, -- Adresse reverse-geocodée
  
  -- Photos/Vidéos
  media_items JSONB DEFAULT '[]',
  -- Format: [
  --   {
  --     "id": "uuid",
  --     "type": "photo" | "video",
  --     "storage_path": "path/to/file",
  --     "thumbnail_path": "path/to/thumb",
  --     "caption": "Description",
  --     "taken_at": "2024-01-01T10:00:00Z",
  --     "ai_analysis": { ... } (optionnel)
  --   }
  -- ]
  
  -- Checklist technique
  checklist_template_id UUID REFERENCES checklist_templates(id),
  checklist_responses JSONB DEFAULT '{}',
  -- Format: { "item_id": "response_value", ... }
  checklist_score DECIMAL(5,2), -- Score de conformité calculé (0-100)
  
  -- Notes et observations
  technician_notes TEXT,
  anomalies_detected TEXT[], -- Liste des anomalies
  recommendations TEXT[], -- Recommandations pour le client
  
  -- Signature client (optionnel)
  client_signature_url TEXT,
  client_signed_at TIMESTAMPTZ,
  client_name TEXT,
  client_feedback TEXT,
  client_satisfaction INTEGER CHECK (client_satisfaction BETWEEN 1 AND 5),
  
  -- Métadonnées techniques
  device_info JSONB, -- Infos sur l'appareil utilisé
  app_version TEXT,
  
  -- Créateur
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_work_order_reports_work_order ON work_order_reports(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_reports_type ON work_order_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_work_order_reports_created_at ON work_order_reports(created_at);

-- Contrainte: un seul rapport par type par work_order (sauf 'during')
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_order_reports_unique_type 
  ON work_order_reports(work_order_id, report_type) 
  WHERE report_type != 'during';

-- =====================================================
-- 3. EXTENSION: work_orders pour time tracking
-- =====================================================

-- Planification avancée
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;

-- Time tracking réel
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMPTZ;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS actual_end_at TIMESTAMPTZ;

-- Acceptation
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Rapport final
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS completion_notes TEXT;

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS final_report_id UUID REFERENCES work_order_reports(id);

-- Qualité et satisfaction
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS quality_score DECIMAL(5,2);

ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS client_satisfaction INTEGER CHECK (client_satisfaction BETWEEN 1 AND 5);

-- =====================================================
-- 4. TABLE: work_order_time_entries
-- Entrées de temps détaillées (pour les interventions longues)
-- =====================================================

CREATE TABLE IF NOT EXISTS work_order_time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  -- Type d'entrée
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'travel',       -- Trajet
    'work',         -- Travail sur site
    'break',        -- Pause
    'waiting'       -- Attente (pièces, client, etc.)
  )),
  
  -- Temps
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER, -- Calculé automatiquement
  
  -- Notes
  description TEXT,
  
  -- GPS au démarrage
  start_latitude DECIMAL(10, 8),
  start_longitude DECIMAL(11, 8),
  
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_time_entries_work_order ON work_order_time_entries(work_order_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_type ON work_order_time_entries(entry_type);

-- =====================================================
-- 5. FONCTIONS
-- =====================================================

-- Fonction pour calculer le score d'une checklist
CREATE OR REPLACE FUNCTION calculate_checklist_score(
  p_template_id UUID,
  p_responses JSONB
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
  v_template RECORD;
  v_items JSONB;
  v_total_points DECIMAL := 0;
  v_earned_points DECIMAL := 0;
  v_item JSONB;
  v_response TEXT;
BEGIN
  -- Récupérer le template
  SELECT items INTO v_items
  FROM checklist_templates
  WHERE id = p_template_id;
  
  IF v_items IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Parcourir les items
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    -- Chaque item vaut 1 point s'il est required
    IF (v_item->>'required')::boolean = true THEN
      v_total_points := v_total_points + 1;
      
      -- Vérifier la réponse
      v_response := p_responses->>v_item->>'id';
      
      IF v_response IS NOT NULL AND v_response != '' AND v_response != 'false' THEN
        v_earned_points := v_earned_points + 1;
      END IF;
    END IF;
  END LOOP;
  
  -- Calculer le score (0-100)
  IF v_total_points > 0 THEN
    RETURN ROUND((v_earned_points / v_total_points) * 100, 2);
  ELSE
    RETURN 100; -- Pas d'items requis = 100%
  END IF;
END;
$$;

-- Fonction pour générer un résumé de rapport d'intervention
CREATE OR REPLACE FUNCTION get_work_order_report_summary(p_work_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'work_order_id', wo.id,
    'status', wo.statut,
    'scheduled', jsonb_build_object(
      'start', wo.scheduled_start_at,
      'end', wo.scheduled_end_at,
      'duration_minutes', wo.estimated_duration_minutes
    ),
    'actual', jsonb_build_object(
      'start', wo.actual_start_at,
      'end', wo.actual_end_at,
      'duration_minutes', EXTRACT(EPOCH FROM (wo.actual_end_at - wo.actual_start_at)) / 60
    ),
    'punctuality_minutes', EXTRACT(EPOCH FROM (wo.actual_start_at - wo.scheduled_start_at)) / 60,
    'reports', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', wor.id,
        'type', wor.report_type,
        'reported_at', wor.reported_at,
        'photos_count', jsonb_array_length(COALESCE(wor.media_items, '[]')),
        'checklist_score', wor.checklist_score,
        'has_anomalies', array_length(wor.anomalies_detected, 1) > 0
      ) ORDER BY wor.reported_at)
      FROM work_order_reports wor
      WHERE wor.work_order_id = wo.id
    ),
    'time_entries', (
      SELECT jsonb_agg(jsonb_build_object(
        'type', wte.entry_type,
        'duration_minutes', wte.duration_minutes
      ))
      FROM work_order_time_entries wte
      WHERE wte.work_order_id = wo.id
    ),
    'total_work_time_minutes', (
      SELECT SUM(duration_minutes)
      FROM work_order_time_entries
      WHERE work_order_id = wo.id AND entry_type = 'work'
    ),
    'quality_score', wo.quality_score,
    'client_satisfaction', wo.client_satisfaction,
    'completion_notes', wo.completion_notes
  ) INTO v_result
  FROM work_orders wo
  WHERE wo.id = p_work_order_id;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Trigger pour calculer la durée des entrées de temps
CREATE OR REPLACE FUNCTION trigger_calculate_time_entry_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_time_entry_duration ON work_order_time_entries;
CREATE TRIGGER trg_time_entry_duration
  BEFORE INSERT OR UPDATE OF ended_at ON work_order_time_entries
  FOR EACH ROW EXECUTE FUNCTION trigger_calculate_time_entry_duration();

-- Trigger pour mettre à jour le score de checklist
CREATE OR REPLACE FUNCTION trigger_update_checklist_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.checklist_template_id IS NOT NULL AND NEW.checklist_responses IS NOT NULL THEN
    NEW.checklist_score := calculate_checklist_score(NEW.checklist_template_id, NEW.checklist_responses);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_checklist_score ON work_order_reports;
CREATE TRIGGER trg_update_checklist_score
  BEFORE INSERT OR UPDATE OF checklist_responses ON work_order_reports
  FOR EACH ROW EXECUTE FUNCTION trigger_update_checklist_score();

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_work_order_reports_updated_at ON work_order_reports;
CREATE TRIGGER trg_work_order_reports_updated_at
  BEFORE UPDATE ON work_order_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_checklist_templates_updated_at ON checklist_templates;
CREATE TRIGGER trg_checklist_templates_updated_at
  BEFORE UPDATE ON checklist_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

ALTER TABLE work_order_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

-- Policies pour work_order_reports

-- Les prestataires peuvent voir et créer des rapports pour leurs interventions
DROP POLICY IF EXISTS "Providers can manage own work order reports" ON work_order_reports;
CREATE POLICY "Providers can manage own work order reports"
  ON work_order_reports FOR ALL
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Les propriétaires peuvent voir les rapports de leurs propriétés
DROP POLICY IF EXISTS "Owners can view work order reports" ON work_order_reports;
CREATE POLICY "Owners can view work order reports"
  ON work_order_reports FOR SELECT
  USING (
    work_order_id IN (
      SELECT wo.id FROM work_orders wo
      JOIN tickets t ON t.id = wo.ticket_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Les admins peuvent tout voir
DROP POLICY IF EXISTS "Admins can view all reports" ON work_order_reports;
CREATE POLICY "Admins can view all reports"
  ON work_order_reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Policies pour work_order_time_entries
DROP POLICY IF EXISTS "Providers can manage own time entries" ON work_order_time_entries;
CREATE POLICY "Providers can manage own time entries"
  ON work_order_time_entries FOR ALL
  USING (
    work_order_id IN (
      SELECT id FROM work_orders 
      WHERE provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can view time entries" ON work_order_time_entries;
CREATE POLICY "Owners can view time entries"
  ON work_order_time_entries FOR SELECT
  USING (
    work_order_id IN (
      SELECT wo.id FROM work_orders wo
      JOIN tickets t ON t.id = wo.ticket_id
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Policies pour checklist_templates (lecture pour tous les authentifiés)
DROP POLICY IF EXISTS "Authenticated users can view templates" ON checklist_templates;
CREATE POLICY "Authenticated users can view templates"
  ON checklist_templates FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage templates" ON checklist_templates;
CREATE POLICY "Admins can manage templates"
  ON checklist_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- 8. DONNÉES INITIALES: Templates de checklists
-- =====================================================

INSERT INTO checklist_templates (service_type, intervention_type, name, description, items) VALUES
(
  'plomberie',
  'depannage',
  'Intervention fuite standard',
  'Checklist pour les interventions de réparation de fuite',
  '[
    {"id": "1", "label": "État général de la tuyauterie visible", "type": "select", "required": true, "options": ["Bon", "Usé", "Critique"], "category": "diagnostic"},
    {"id": "2", "label": "Photo de la zone de fuite AVANT", "type": "photo", "required": true, "category": "documentation"},
    {"id": "3", "label": "Origine de la fuite identifiée", "type": "text", "required": true, "category": "diagnostic"},
    {"id": "4", "label": "Joint remplacé", "type": "checkbox", "required": false, "category": "travaux"},
    {"id": "5", "label": "Pièces remplacées (détail)", "type": "text", "required": false, "category": "travaux"},
    {"id": "6", "label": "Test d''étanchéité effectué", "type": "checkbox", "required": true, "category": "qualité"},
    {"id": "7", "label": "Pression eau vérifiée (bar)", "type": "number", "required": false, "min": 0, "max": 10, "category": "qualité"},
    {"id": "8", "label": "Photo de la zone APRÈS réparation", "type": "photo", "required": true, "category": "documentation"},
    {"id": "9", "label": "Zone nettoyée et séchée", "type": "checkbox", "required": true, "category": "finition"},
    {"id": "10", "label": "Recommandations pour le client", "type": "text", "required": false, "category": "conseil"}
  ]'
),
(
  'electricite',
  'depannage',
  'Intervention électrique standard',
  'Checklist pour les interventions électriques de dépannage',
  '[
    {"id": "1", "label": "Coupure du courant effectuée", "type": "checkbox", "required": true, "category": "sécurité"},
    {"id": "2", "label": "Photo du tableau électrique", "type": "photo", "required": true, "category": "documentation"},
    {"id": "3", "label": "Disjoncteur concerné identifié", "type": "text", "required": true, "category": "diagnostic"},
    {"id": "4", "label": "Cause de la panne identifiée", "type": "text", "required": true, "category": "diagnostic"},
    {"id": "5", "label": "Test d''isolation effectué", "type": "checkbox", "required": true, "category": "qualité"},
    {"id": "6", "label": "Remplacement de pièce effectué", "type": "checkbox", "required": false, "category": "travaux"},
    {"id": "7", "label": "Détail des travaux réalisés", "type": "text", "required": true, "category": "travaux"},
    {"id": "8", "label": "Test de fonctionnement OK", "type": "checkbox", "required": true, "category": "qualité"},
    {"id": "9", "label": "Photo finale du tableau", "type": "photo", "required": true, "category": "documentation"},
    {"id": "10", "label": "Conformité NF C 15-100 vérifiée", "type": "checkbox", "required": true, "category": "conformité"}
  ]'
),
(
  'chauffage',
  'entretien',
  'Entretien chaudière annuel',
  'Checklist pour l''entretien annuel obligatoire de chaudière',
  '[
    {"id": "1", "label": "Marque et modèle de la chaudière", "type": "text", "required": true, "category": "identification"},
    {"id": "2", "label": "Photo de la plaque signalétique", "type": "photo", "required": true, "category": "documentation"},
    {"id": "3", "label": "Nettoyage du corps de chauffe effectué", "type": "checkbox", "required": true, "category": "travaux"},
    {"id": "4", "label": "Vérification du brûleur", "type": "checkbox", "required": true, "category": "travaux"},
    {"id": "5", "label": "Réglage de la combustion effectué", "type": "checkbox", "required": true, "category": "travaux"},
    {"id": "6", "label": "Taux de CO mesuré (ppm)", "type": "number", "required": true, "min": 0, "max": 1000, "category": "sécurité"},
    {"id": "7", "label": "Tirage conduit vérifié", "type": "checkbox", "required": true, "category": "sécurité"},
    {"id": "8", "label": "Pression circuit (bar)", "type": "number", "required": true, "min": 0, "max": 5, "category": "qualité"},
    {"id": "9", "label": "Vase d''expansion vérifié", "type": "checkbox", "required": true, "category": "travaux"},
    {"id": "10", "label": "Attestation d''entretien remise", "type": "checkbox", "required": true, "category": "documentation"}
  ]'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 9. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE work_order_reports IS 'Rapports d''intervention avec photos, checklists et time tracking';
COMMENT ON TABLE work_order_time_entries IS 'Entrées de temps détaillées pour les interventions';
COMMENT ON TABLE checklist_templates IS 'Templates de checklists par type d''intervention';
COMMENT ON FUNCTION calculate_checklist_score IS 'Calcule le score de conformité d''une checklist (0-100)';
COMMENT ON FUNCTION get_work_order_report_summary IS 'Génère un résumé complet d''un rapport d''intervention';

