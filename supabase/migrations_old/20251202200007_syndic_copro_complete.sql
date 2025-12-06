-- =====================================================
-- MIGRATION: Module Syndic/Copro complet
-- Description: Gestion complète des copropriétés
-- =====================================================

-- =====================================================
-- 1. TABLE: copro_meetings (Assemblées générales)
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Type d'assemblée
  meeting_type TEXT NOT NULL CHECK (meeting_type IN (
    'AGO', -- Assemblée Générale Ordinaire
    'AGE', -- Assemblée Générale Extraordinaire
    'CS'   -- Conseil Syndical
  )),
  
  -- Dates
  scheduled_date TIMESTAMPTZ NOT NULL,
  actual_date TIMESTAMPTZ,
  
  -- Lieu
  location TEXT,
  is_remote BOOLEAN DEFAULT false,
  remote_url TEXT,
  
  -- Convocation
  convocation_date DATE,
  convocation_method TEXT CHECK (convocation_method IN (
    'lettre_recommandee', 'email', 'remise_main_propre'
  )),
  
  -- Ordre du jour
  agenda JSONB NOT NULL DEFAULT '[]', -- [{number, title, description, resolution_type}]
  
  -- Quorum
  quorum_required INTEGER DEFAULT 50, -- % des tantièmes
  quorum_reached BOOLEAN,
  tantiemes_present INTEGER,
  tantiemes_represented INTEGER,
  
  -- Procès-verbal
  minutes_document_id UUID REFERENCES documents(id),
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'convened', 'in_progress', 'completed', 'cancelled'
  )),
  
  -- Notes
  notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_meetings_site ON copro_meetings(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_meetings_date ON copro_meetings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_copro_meetings_status ON copro_meetings(status);

-- =====================================================
-- 2. TABLE: copro_resolutions (Résolutions votées)
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_resolutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES copro_meetings(id) ON DELETE CASCADE,
  
  -- Numéro et titre
  resolution_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Type de majorité requise
  majority_type TEXT NOT NULL CHECK (majority_type IN (
    'simple',       -- Art. 24 - Majorité simple
    'absolute',     -- Art. 25 - Majorité absolue
    'qualified',    -- Art. 26 - Double majorité
    'unanimity'     -- Unanimité
  )),
  
  -- Votes
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  votes_abstain INTEGER DEFAULT 0,
  tantiemes_for INTEGER DEFAULT 0,
  tantiemes_against INTEGER DEFAULT 0,
  
  -- Résultat
  is_adopted BOOLEAN,
  
  -- Budget associé (si applicable)
  budget_amount DECIMAL(12,2),
  budget_description TEXT,
  
  -- Notes
  notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(meeting_id, resolution_number)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_resolutions_meeting ON copro_resolutions(meeting_id);

-- =====================================================
-- 3. TABLE: copro_votes (Votes individuels)
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resolution_id UUID NOT NULL REFERENCES copro_resolutions(id) ON DELETE CASCADE,
  ownership_id UUID NOT NULL REFERENCES ownerships(id),
  voter_profile_id UUID REFERENCES profiles(id),
  
  -- Vote
  vote TEXT NOT NULL CHECK (vote IN ('for', 'against', 'abstain')),
  tantiemes_used INTEGER NOT NULL,
  
  -- Procuration
  is_proxy BOOLEAN DEFAULT false,
  proxy_from_ownership_id UUID REFERENCES ownerships(id),
  
  -- Métadonnées
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(resolution_id, ownership_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_votes_resolution ON copro_votes(resolution_id);
CREATE INDEX IF NOT EXISTS idx_copro_votes_ownership ON copro_votes(ownership_id);

-- =====================================================
-- 4. TABLE: copro_budgets (Budgets prévisionnels)
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Exercice
  fiscal_year INTEGER NOT NULL,
  
  -- Type
  budget_type TEXT NOT NULL CHECK (budget_type IN (
    'operations', -- Budget de fonctionnement
    'works'       -- Budget travaux
  )),
  
  -- Montants
  total_amount DECIMAL(12,2) NOT NULL,
  
  -- Détail par catégorie (JSONB)
  categories JSONB NOT NULL DEFAULT '[]',
  -- [{category, description, budgeted, actual, variance}]
  
  -- Appels de fonds
  call_schedule JSONB DEFAULT '[]', -- [{date, amount, status}]
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'proposed', 'voted', 'active', 'closed'
  )),
  
  -- Validation
  voted_at_meeting_id UUID REFERENCES copro_meetings(id),
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(site_id, fiscal_year, budget_type)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_budgets_site ON copro_budgets(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_budgets_year ON copro_budgets(fiscal_year);

-- =====================================================
-- 5. TABLE: copro_calls (Appels de fonds)
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  budget_id UUID REFERENCES copro_budgets(id),
  
  -- Période
  call_number INTEGER NOT NULL, -- N° de l'appel dans l'année
  fiscal_year INTEGER NOT NULL,
  
  -- Dates
  call_date DATE NOT NULL,
  due_date DATE NOT NULL,
  
  -- Montant total
  total_amount DECIMAL(12,2) NOT NULL,
  
  -- Type
  call_type TEXT NOT NULL CHECK (call_type IN (
    'provisions',    -- Provisions sur charges
    'works',         -- Appel travaux
    'regularization' -- Régularisation
  )),
  
  -- Description
  description TEXT,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'partial', 'collected', 'closed'
  )),
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_calls_site ON copro_calls(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_calls_date ON copro_calls(due_date);

-- =====================================================
-- 6. TABLE: copro_call_items (Lignes d'appels par lot)
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_call_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES copro_calls(id) ON DELETE CASCADE,
  copro_lot_id UUID NOT NULL REFERENCES copro_lots(id),
  ownership_id UUID REFERENCES ownerships(id),
  
  -- Montant
  amount DECIMAL(10,2) NOT NULL,
  tantiemes_used INTEGER NOT NULL,
  
  -- Paiement
  paid_amount DECIMAL(10,2) DEFAULT 0,
  payment_date DATE,
  payment_reference TEXT,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'partial', 'paid', 'late'
  )),
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(call_id, copro_lot_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_call_items_call ON copro_call_items(call_id);
CREATE INDEX IF NOT EXISTS idx_copro_call_items_lot ON copro_call_items(copro_lot_id);

-- =====================================================
-- 7. TABLE: copro_incidents (Incidents/Sinistres)
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  building_id UUID REFERENCES buildings(id),
  copro_unit_id UUID REFERENCES copro_units(id),
  
  -- Type
  incident_type TEXT NOT NULL CHECK (incident_type IN (
    'water_damage',   -- Dégât des eaux
    'fire',           -- Incendie
    'break_in',       -- Effraction
    'structural',     -- Problème structural
    'electrical',     -- Problème électrique
    'elevator',       -- Panne ascenseur
    'heating',        -- Panne chauffage
    'other'
  )),
  
  -- Description
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Date
  incident_date TIMESTAMPTZ NOT NULL,
  reported_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Reporter
  reported_by UUID NOT NULL REFERENCES profiles(id),
  
  -- Assurance
  insurance_declared BOOLEAN DEFAULT false,
  insurance_declaration_date DATE,
  insurance_reference TEXT,
  
  -- Coût estimé
  estimated_cost DECIMAL(12,2),
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN (
    'reported', 'investigating', 'repair_planned', 'resolved', 'closed'
  )),
  
  -- Photos
  media JSONB DEFAULT '[]',
  
  -- Notes
  notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_incidents_site ON copro_incidents(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_incidents_type ON copro_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_copro_incidents_status ON copro_incidents(status);

-- =====================================================
-- 8. FONCTIONS
-- =====================================================

-- Fonction: Dashboard Syndic
CREATE OR REPLACE FUNCTION syndic_dashboard(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_sites JSONB;
  v_upcoming_meetings JSONB;
  v_pending_calls JSONB;
  v_active_incidents JSONB;
  v_stats JSONB;
BEGIN
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id AND role IN ('admin', 'syndic', 'owner');
  
  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Sites gérés
  SELECT COALESCE(jsonb_agg(site_data), '[]'::jsonb)
  INTO v_sites
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'nom', s.nom,
      'adresse', s.adresse_complete,
      'total_lots', (SELECT COUNT(*) FROM copro_lots WHERE site_id = s.id),
      'total_tantiemes', s.total_tantiemes
    ) as site_data
    FROM sites s
    WHERE s.syndic_profile_id = v_profile_id
       OR EXISTS (
         SELECT 1 FROM ownerships o
         JOIN copro_lots cl ON cl.id = o.copro_lot_id
         WHERE cl.site_id = s.id AND o.owner_profile_id = v_profile_id
       )
    LIMIT 10
  ) sub;
  
  -- Prochaines AG
  SELECT COALESCE(jsonb_agg(meeting_data ORDER BY meeting_data->>'scheduled_date'), '[]'::jsonb)
  INTO v_upcoming_meetings
  FROM (
    SELECT jsonb_build_object(
      'id', m.id,
      'site_id', m.site_id,
      'site_nom', s.nom,
      'meeting_type', m.meeting_type,
      'scheduled_date', m.scheduled_date,
      'status', m.status
    ) as meeting_data
    FROM copro_meetings m
    JOIN sites s ON s.id = m.site_id
    WHERE m.scheduled_date > NOW()
    AND m.status NOT IN ('completed', 'cancelled')
    ORDER BY m.scheduled_date
    LIMIT 5
  ) sub;
  
  -- Appels de fonds en attente
  SELECT COALESCE(jsonb_agg(call_data), '[]'::jsonb)
  INTO v_pending_calls
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'site_nom', s.nom,
      'call_type', c.call_type,
      'total_amount', c.total_amount,
      'due_date', c.due_date,
      'collected', (SELECT COALESCE(SUM(paid_amount), 0) FROM copro_call_items WHERE call_id = c.id)
    ) as call_data
    FROM copro_calls c
    JOIN sites s ON s.id = c.site_id
    WHERE c.status IN ('sent', 'partial')
    AND c.due_date <= CURRENT_DATE + INTERVAL '30 days'
    LIMIT 5
  ) sub;
  
  -- Incidents actifs
  SELECT COALESCE(jsonb_agg(incident_data), '[]'::jsonb)
  INTO v_active_incidents
  FROM (
    SELECT jsonb_build_object(
      'id', i.id,
      'site_nom', s.nom,
      'incident_type', i.incident_type,
      'title', i.title,
      'status', i.status,
      'incident_date', i.incident_date
    ) as incident_data
    FROM copro_incidents i
    JOIN sites s ON s.id = i.site_id
    WHERE i.status NOT IN ('resolved', 'closed')
    ORDER BY i.incident_date DESC
    LIMIT 5
  ) sub;
  
  -- Stats globales
  SELECT jsonb_build_object(
    'total_sites', (SELECT COUNT(*) FROM sites),
    'total_lots', (SELECT COUNT(*) FROM copro_lots),
    'upcoming_meetings', (SELECT COUNT(*) FROM copro_meetings WHERE scheduled_date > NOW() AND status NOT IN ('completed', 'cancelled')),
    'pending_calls_amount', (
      SELECT COALESCE(SUM(c.total_amount - COALESCE((
        SELECT SUM(paid_amount) FROM copro_call_items WHERE call_id = c.id
      ), 0)), 0)
      FROM copro_calls c
      WHERE c.status IN ('sent', 'partial')
    ),
    'active_incidents', (SELECT COUNT(*) FROM copro_incidents WHERE status NOT IN ('resolved', 'closed'))
  ) INTO v_stats;
  
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'sites', v_sites,
    'upcoming_meetings', v_upcoming_meetings,
    'pending_calls', v_pending_calls,
    'active_incidents', v_active_incidents,
    'stats', v_stats
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 9. RLS POLICIES
-- =====================================================

ALTER TABLE copro_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE copro_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE copro_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE copro_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE copro_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE copro_call_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE copro_incidents ENABLE ROW LEVEL SECURITY;

-- Policies générique : accès via site_id pour les copropriétaires
CREATE POLICY "Copropriétaires peuvent voir les réunions de leur copro"
  ON copro_meetings FOR SELECT
  USING (
    site_id IN (
      SELECT cl.site_id FROM copro_lots cl
      JOIN ownerships o ON o.copro_lot_id = cl.id
      WHERE o.owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins ont accès complet aux réunions"
  ON copro_meetings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Accès aux résolutions via réunion"
  ON copro_resolutions FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM copro_meetings m
      WHERE m.site_id IN (
        SELECT cl.site_id FROM copro_lots cl
        JOIN ownerships o ON o.copro_lot_id = cl.id
        WHERE o.owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Copropriétaires peuvent voir leurs votes"
  ON copro_votes FOR SELECT
  USING (
    ownership_id IN (
      SELECT o.id FROM ownerships o
      WHERE o.owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Accès aux budgets"
  ON copro_budgets FOR SELECT
  USING (
    site_id IN (
      SELECT cl.site_id FROM copro_lots cl
      JOIN ownerships o ON o.copro_lot_id = cl.id
      WHERE o.owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Accès aux appels de fonds"
  ON copro_calls FOR SELECT
  USING (
    site_id IN (
      SELECT cl.site_id FROM copro_lots cl
      JOIN ownerships o ON o.copro_lot_id = cl.id
      WHERE o.owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Accès aux lignes d'appels"
  ON copro_call_items FOR SELECT
  USING (
    ownership_id IN (
      SELECT o.id FROM ownerships o
      WHERE o.owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Accès aux incidents"
  ON copro_incidents FOR ALL
  USING (
    site_id IN (
      SELECT cl.site_id FROM copro_lots cl
      JOIN ownerships o ON o.copro_lot_id = cl.id
      WHERE o.owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR reported_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- =====================================================
-- 10. TRIGGERS
-- =====================================================

CREATE TRIGGER trg_copro_meetings_updated_at
  BEFORE UPDATE ON copro_meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_copro_budgets_updated_at
  BEFORE UPDATE ON copro_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_copro_calls_updated_at
  BEFORE UPDATE ON copro_calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_copro_incidents_updated_at
  BEFORE UPDATE ON copro_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 11. COMMENTAIRES
-- =====================================================
COMMENT ON TABLE copro_meetings IS 'Assemblées générales et conseils syndicaux';
COMMENT ON TABLE copro_resolutions IS 'Résolutions votées en AG';
COMMENT ON TABLE copro_votes IS 'Votes individuels sur les résolutions';
COMMENT ON TABLE copro_budgets IS 'Budgets prévisionnels annuels';
COMMENT ON TABLE copro_calls IS 'Appels de fonds';
COMMENT ON TABLE copro_call_items IS 'Détail des appels par lot';
COMMENT ON TABLE copro_incidents IS 'Incidents et sinistres';







