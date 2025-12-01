-- =====================================================
-- MIGRATION: Assemblées Générales (AG)
-- Description: Gestion des AG, résolutions, votes, pouvoirs
-- =====================================================

-- =====================================================
-- TABLE: assemblies (assemblées générales)
-- =====================================================
CREATE TABLE IF NOT EXISTS assemblies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Identification
  assembly_number TEXT NOT NULL, -- "AG-2025-01"
  label TEXT NOT NULL,
  
  -- Type d'assemblée
  assembly_type TEXT NOT NULL CHECK (assembly_type IN (
    'AGO',  -- Assemblée Générale Ordinaire
    'AGE',  -- Assemblée Générale Extraordinaire
    'AGM'   -- Assemblée Générale Mixte
  )),
  
  -- Dates et horaires
  scheduled_at TIMESTAMPTZ NOT NULL,
  convocation_sent_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Lieu
  location_type TEXT DEFAULT 'physical' CHECK (location_type IN (
    'physical', 'video', 'hybrid'
  )),
  location_address TEXT,
  location_room TEXT,
  video_link TEXT,
  video_password TEXT,
  
  -- Tantièmes
  total_tantiemes INTEGER NOT NULL DEFAULT 0,
  present_tantiemes INTEGER DEFAULT 0,
  represented_tantiemes INTEGER DEFAULT 0,
  absent_tantiemes INTEGER DEFAULT 0,
  
  -- Quorum
  quorum_required NUMERIC(5,2) DEFAULT 25.0, -- Pourcentage requis
  quorum_reached BOOLEAN DEFAULT false,
  quorum_reached_at TIMESTAMPTZ,
  
  -- Bureau de l'assemblée
  president_name TEXT,
  president_unit_id UUID REFERENCES copro_units(id),
  president_profile_id UUID REFERENCES profiles(id),
  secretary_name TEXT,
  secretary_unit_id UUID REFERENCES copro_units(id),
  secretary_profile_id UUID REFERENCES profiles(id),
  scrutineer_name TEXT,
  scrutineer_unit_id UUID REFERENCES copro_units(id),
  scrutineer_profile_id UUID REFERENCES profiles(id),
  
  -- État
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',          -- Brouillon
    'convoked',       -- Convocation envoyée
    'in_progress',    -- En cours
    'suspended',      -- Suspendue
    'closed',         -- Clôturée
    'cancelled'       -- Annulée
  )),
  
  -- Documents
  convocation_document_id UUID,
  pv_document_id UUID,
  pv_signed_at TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  agenda TEXT, -- Ordre du jour
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(site_id, assembly_number)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_assemblies_site ON assemblies(site_id);
CREATE INDEX IF NOT EXISTS idx_assemblies_scheduled ON assemblies(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_assemblies_status ON assemblies(status);
CREATE INDEX IF NOT EXISTS idx_assemblies_type ON assemblies(assembly_type);

-- =====================================================
-- TABLE: motions (résolutions à voter)
-- =====================================================
CREATE TABLE IF NOT EXISTS motions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  
  -- Identification
  motion_number INTEGER NOT NULL, -- Numéro dans l'AG
  title TEXT NOT NULL,
  description TEXT,
  
  -- Type de majorité requise
  majority_type TEXT NOT NULL DEFAULT 'simple' CHECK (majority_type IN (
    'simple',        -- Article 24: majorité des voix exprimées
    'absolute',      -- Article 25: majorité de tous les copropriétaires
    'double',        -- Article 26: double majorité (voix + tantièmes)
    'unanimity'      -- Unanimité requise
  )),
  
  -- Seuils personnalisés
  required_percentage NUMERIC(5,2), -- Pourcentage requis si différent
  
  -- Catégorie
  category TEXT DEFAULT 'general' CHECK (category IN (
    'general',         -- Gestion courante
    'budget',          -- Budget prévisionnel
    'travaux_courants', -- Travaux d'entretien
    'travaux_majeurs', -- Gros travaux (art. 25)
    'modification_reglement', -- Modification règlement
    'vente_parties_communes',
    'mandats',         -- Désignation mandataires
    'autre'
  )),
  
  -- Montant associé (si applicable)
  associated_amount NUMERIC(15,2),
  associated_description TEXT,
  
  -- Résultats
  votes_pour INTEGER DEFAULT 0,
  votes_contre INTEGER DEFAULT 0,
  votes_abstention INTEGER DEFAULT 0,
  tantiemes_pour INTEGER DEFAULT 0,
  tantiemes_contre INTEGER DEFAULT 0,
  tantiemes_abstention INTEGER DEFAULT 0,
  
  -- Décision
  is_adopted BOOLEAN,
  adoption_percentage NUMERIC(5,2),
  
  -- État
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- En attente de vote
    'voting',     -- Vote en cours
    'voted',      -- Vote terminé
    'adopted',    -- Adopté
    'rejected',   -- Rejeté
    'deferred',   -- Reporté
    'withdrawn'   -- Retiré
  )),
  voted_at TIMESTAMPTZ,
  
  -- Ordre d'affichage
  display_order INTEGER DEFAULT 0,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(assembly_id, motion_number)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_motions_assembly ON motions(assembly_id);
CREATE INDEX IF NOT EXISTS idx_motions_status ON motions(status);
CREATE INDEX IF NOT EXISTS idx_motions_order ON motions(display_order);

-- =====================================================
-- TABLE: assembly_attendance (présences)
-- =====================================================
CREATE TABLE IF NOT EXISTS assembly_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  
  -- Propriétaire
  owner_profile_id UUID REFERENCES profiles(id),
  owner_name TEXT NOT NULL,
  
  -- Tantièmes
  tantiemes INTEGER NOT NULL,
  
  -- Présence
  attendance_type TEXT NOT NULL CHECK (attendance_type IN (
    'present',      -- Présent en personne
    'represented',  -- Représenté par pouvoir
    'absent'        -- Absent
  )),
  
  -- Si représenté
  represented_by_profile_id UUID REFERENCES profiles(id),
  represented_by_name TEXT,
  proxy_id UUID, -- Référence au pouvoir
  
  -- Signature
  signed_at TIMESTAMPTZ,
  signature_type TEXT CHECK (signature_type IN ('physical', 'electronic')),
  
  -- Heure d'arrivée/départ
  arrived_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  left_early BOOLEAN DEFAULT false,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(assembly_id, unit_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_attendance_assembly ON assembly_attendance(assembly_id);
CREATE INDEX IF NOT EXISTS idx_attendance_unit ON assembly_attendance(unit_id);
CREATE INDEX IF NOT EXISTS idx_attendance_type ON assembly_attendance(attendance_type);

-- =====================================================
-- TABLE: proxies (pouvoirs)
-- =====================================================
CREATE TABLE IF NOT EXISTS proxies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  
  -- Mandant (celui qui donne pouvoir)
  grantor_unit_id UUID NOT NULL REFERENCES copro_units(id),
  grantor_profile_id UUID REFERENCES profiles(id),
  grantor_name TEXT NOT NULL,
  grantor_tantiemes INTEGER NOT NULL,
  
  -- Mandataire (celui qui reçoit le pouvoir)
  grantee_profile_id UUID REFERENCES profiles(id),
  grantee_name TEXT NOT NULL,
  grantee_email TEXT,
  grantee_is_syndic BOOLEAN DEFAULT false,
  
  -- Type de pouvoir
  proxy_type TEXT NOT NULL DEFAULT 'full' CHECK (proxy_type IN (
    'full',          -- Pouvoir complet
    'partial',       -- Pouvoir partiel (certaines résolutions)
    'imperative'     -- Pouvoir impératif (instructions de vote)
  )),
  
  -- Instructions (si impératif)
  voting_instructions JSONB DEFAULT '{}', -- { "motion_1": "pour", "motion_2": "contre" }
  
  -- État
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- En attente de validation
    'validated',  -- Validé
    'used',       -- Utilisé lors de l'AG
    'cancelled',  -- Annulé
    'expired'     -- Expiré
  )),
  
  -- Document
  document_id UUID,
  signed_at TIMESTAMPTZ,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Un seul pouvoir par lot et par AG
  UNIQUE(assembly_id, grantor_unit_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_proxies_assembly ON proxies(assembly_id);
CREATE INDEX IF NOT EXISTS idx_proxies_grantor ON proxies(grantor_unit_id);
CREATE INDEX IF NOT EXISTS idx_proxies_grantee ON proxies(grantee_profile_id);
CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);

-- =====================================================
-- TABLE: votes (votes individuels)
-- =====================================================
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  motion_id UUID NOT NULL REFERENCES motions(id) ON DELETE CASCADE,
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  
  -- Votant
  voter_profile_id UUID REFERENCES profiles(id),
  voter_name TEXT NOT NULL,
  
  -- Si vote par procuration
  is_proxy_vote BOOLEAN DEFAULT false,
  proxy_id UUID REFERENCES proxies(id),
  
  -- Tantièmes
  tantiemes INTEGER NOT NULL,
  
  -- Vote
  vote_value TEXT NOT NULL CHECK (vote_value IN (
    'pour', 'contre', 'abstention'
  )),
  
  -- Horodatage
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Un seul vote par lot et par résolution
  UNIQUE(motion_id, unit_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_votes_motion ON votes(motion_id);
CREATE INDEX IF NOT EXISTS idx_votes_assembly ON votes(assembly_id);
CREATE INDEX IF NOT EXISTS idx_votes_unit ON votes(unit_id);
CREATE INDEX IF NOT EXISTS idx_votes_value ON votes(vote_value);

-- =====================================================
-- TABLE: assembly_documents (documents AG)
-- =====================================================
CREATE TABLE IF NOT EXISTS assembly_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  
  -- Type de document
  document_type TEXT NOT NULL CHECK (document_type IN (
    'convocation',           -- Convocation
    'ordre_du_jour',         -- Ordre du jour
    'projet_resolution',     -- Projet de résolution
    'rapport_syndic',        -- Rapport du syndic
    'rapport_financier',     -- Rapport financier
    'devis',                 -- Devis travaux
    'feuille_presence',      -- Feuille de présence
    'pouvoir',               -- Modèle de pouvoir
    'pv_draft',              -- PV brouillon
    'pv_final',              -- PV final signé
    'annexe',                -- Annexe
    'autre'
  )),
  
  -- Informations
  label TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Ordre d'affichage
  display_order INTEGER DEFAULT 0,
  
  -- État
  is_public BOOLEAN DEFAULT false, -- Visible par tous les copropriétaires
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_assembly_docs_assembly ON assembly_documents(assembly_id);
CREATE INDEX IF NOT EXISTS idx_assembly_docs_type ON assembly_documents(document_type);

-- =====================================================
-- TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS trg_assemblies_updated ON assemblies;
CREATE TRIGGER trg_assemblies_updated
  BEFORE UPDATE ON assemblies FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_motions_updated ON motions;
CREATE TRIGGER trg_motions_updated
  BEFORE UPDATE ON motions FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_attendance_updated ON assembly_attendance;
CREATE TRIGGER trg_attendance_updated
  BEFORE UPDATE ON assembly_attendance FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_proxies_updated ON proxies;
CREATE TRIGGER trg_proxies_updated
  BEFORE UPDATE ON proxies FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_assembly_docs_updated ON assembly_documents;
CREATE TRIGGER trg_assembly_docs_updated
  BEFORE UPDATE ON assembly_documents FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- =====================================================
-- FUNCTIONS: Calculs AG
-- =====================================================

-- Fonction: Calculer le quorum d'une AG
CREATE OR REPLACE FUNCTION calculate_assembly_quorum(p_assembly_id UUID)
RETURNS TABLE (
  total_tantiemes INTEGER,
  present_tantiemes INTEGER,
  represented_tantiemes INTEGER,
  absent_tantiemes INTEGER,
  quorum_percentage NUMERIC,
  quorum_required NUMERIC,
  quorum_reached BOOLEAN
) AS $$
DECLARE
  v_assembly RECORD;
  v_present INTEGER := 0;
  v_represented INTEGER := 0;
  v_total INTEGER := 0;
BEGIN
  -- Récupérer l'AG
  SELECT * INTO v_assembly FROM assemblies WHERE id = p_assembly_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assemblée non trouvée';
  END IF;
  
  -- Total des tantièmes du site
  SELECT COALESCE(SUM(tantieme_general), 0) INTO v_total
  FROM copro_units WHERE site_id = v_assembly.site_id AND is_active = true;
  
  -- Présents
  SELECT COALESCE(SUM(tantiemes), 0) INTO v_present
  FROM assembly_attendance
  WHERE assembly_id = p_assembly_id AND attendance_type = 'present';
  
  -- Représentés
  SELECT COALESCE(SUM(tantiemes), 0) INTO v_represented
  FROM assembly_attendance
  WHERE assembly_id = p_assembly_id AND attendance_type = 'represented';
  
  RETURN QUERY SELECT
    v_total as total_tantiemes,
    v_present as present_tantiemes,
    v_represented as represented_tantiemes,
    (v_total - v_present - v_represented) as absent_tantiemes,
    CASE WHEN v_total > 0 
      THEN ROUND(((v_present + v_represented)::NUMERIC / v_total) * 100, 2)
      ELSE 0
    END as quorum_percentage,
    v_assembly.quorum_required as quorum_required,
    CASE WHEN v_total > 0 
      THEN ((v_present + v_represented)::NUMERIC / v_total) * 100 >= v_assembly.quorum_required
      ELSE false
    END as quorum_reached;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: Calculer le résultat d'un vote
CREATE OR REPLACE FUNCTION calculate_motion_result(p_motion_id UUID)
RETURNS TABLE (
  votes_pour INTEGER,
  votes_contre INTEGER,
  votes_abstention INTEGER,
  tantiemes_pour INTEGER,
  tantiemes_contre INTEGER,
  tantiemes_abstention INTEGER,
  total_votants INTEGER,
  total_tantiemes_votants INTEGER,
  percentage_pour NUMERIC,
  majority_type TEXT,
  required_percentage NUMERIC,
  is_adopted BOOLEAN,
  adoption_reason TEXT
) AS $$
DECLARE
  v_motion RECORD;
  v_assembly RECORD;
  v_pour INTEGER := 0;
  v_contre INTEGER := 0;
  v_abstention INTEGER := 0;
  v_tant_pour INTEGER := 0;
  v_tant_contre INTEGER := 0;
  v_tant_abstention INTEGER := 0;
  v_total_tantiemes INTEGER := 0;
  v_adopted BOOLEAN := false;
  v_reason TEXT := '';
BEGIN
  -- Récupérer la motion et l'AG
  SELECT m.*, a.total_tantiemes as ag_total_tantiemes
  INTO v_motion
  FROM motions m
  JOIN assemblies a ON a.id = m.assembly_id
  WHERE m.id = p_motion_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Motion non trouvée';
  END IF;
  
  -- Compter les votes
  SELECT 
    COUNT(*) FILTER (WHERE vote_value = 'pour'),
    COUNT(*) FILTER (WHERE vote_value = 'contre'),
    COUNT(*) FILTER (WHERE vote_value = 'abstention'),
    COALESCE(SUM(tantiemes) FILTER (WHERE vote_value = 'pour'), 0),
    COALESCE(SUM(tantiemes) FILTER (WHERE vote_value = 'contre'), 0),
    COALESCE(SUM(tantiemes) FILTER (WHERE vote_value = 'abstention'), 0)
  INTO v_pour, v_contre, v_abstention, v_tant_pour, v_tant_contre, v_tant_abstention
  FROM votes WHERE motion_id = p_motion_id;
  
  -- Total des tantièmes présents + représentés
  SELECT COALESCE(SUM(tantiemes), 0) INTO v_total_tantiemes
  FROM assembly_attendance
  WHERE assembly_id = v_motion.assembly_id 
    AND attendance_type IN ('present', 'represented');
  
  -- Calculer l'adoption selon le type de majorité
  CASE v_motion.majority_type
    WHEN 'simple' THEN
      -- Article 24: majorité des voix exprimées (hors abstentions)
      v_adopted := v_tant_pour > v_tant_contre;
      IF v_adopted THEN
        v_reason := 'Majorité simple atteinte (Art. 24)';
      ELSE
        v_reason := 'Majorité simple non atteinte';
      END IF;
      
    WHEN 'absolute' THEN
      -- Article 25: majorité de tous les copropriétaires
      v_adopted := v_tant_pour > (v_motion.ag_total_tantiemes / 2);
      IF v_adopted THEN
        v_reason := 'Majorité absolue atteinte (Art. 25)';
      ELSE
        v_reason := 'Majorité absolue non atteinte (>' || (v_motion.ag_total_tantiemes / 2) || ' tantièmes requis)';
      END IF;
      
    WHEN 'double' THEN
      -- Article 26: double majorité
      v_adopted := v_tant_pour > (v_motion.ag_total_tantiemes * 2 / 3)
                   AND v_pour > ((v_pour + v_contre + v_abstention) / 2);
      IF v_adopted THEN
        v_reason := 'Double majorité atteinte (Art. 26)';
      ELSE
        v_reason := 'Double majorité non atteinte (2/3 tantièmes + majorité des votants)';
      END IF;
      
    WHEN 'unanimity' THEN
      -- Unanimité
      v_adopted := v_contre = 0 AND v_abstention = 0 AND v_pour > 0;
      IF v_adopted THEN
        v_reason := 'Unanimité atteinte';
      ELSE
        v_reason := 'Unanimité non atteinte';
      END IF;
      
    ELSE
      v_adopted := v_tant_pour > v_tant_contre;
      v_reason := 'Majorité simple par défaut';
  END CASE;
  
  RETURN QUERY SELECT
    v_pour as votes_pour,
    v_contre as votes_contre,
    v_abstention as votes_abstention,
    v_tant_pour as tantiemes_pour,
    v_tant_contre as tantiemes_contre,
    v_tant_abstention as tantiemes_abstention,
    (v_pour + v_contre + v_abstention) as total_votants,
    v_total_tantiemes as total_tantiemes_votants,
    CASE WHEN (v_tant_pour + v_tant_contre) > 0
      THEN ROUND(v_tant_pour::NUMERIC / (v_tant_pour + v_tant_contre) * 100, 2)
      ELSE 0
    END as percentage_pour,
    v_motion.majority_type,
    COALESCE(v_motion.required_percentage, 
      CASE v_motion.majority_type
        WHEN 'simple' THEN 50.01
        WHEN 'absolute' THEN 50.01
        WHEN 'double' THEN 66.67
        WHEN 'unanimity' THEN 100
        ELSE 50.01
      END
    ) as required_percentage,
    v_adopted as is_adopted,
    v_reason as adoption_reason;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: Mettre à jour les résultats d'une motion après vote
CREATE OR REPLACE FUNCTION update_motion_results(p_motion_id UUID)
RETURNS VOID AS $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM calculate_motion_result(p_motion_id);
  
  UPDATE motions SET
    votes_pour = v_result.votes_pour,
    votes_contre = v_result.votes_contre,
    votes_abstention = v_result.votes_abstention,
    tantiemes_pour = v_result.tantiemes_pour,
    tantiemes_contre = v_result.tantiemes_contre,
    tantiemes_abstention = v_result.tantiemes_abstention,
    is_adopted = v_result.is_adopted,
    adoption_percentage = v_result.percentage_pour,
    status = CASE WHEN v_result.is_adopted THEN 'adopted' ELSE 'rejected' END,
    voted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_motion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Mettre à jour les résultats après chaque vote
CREATE OR REPLACE FUNCTION trigger_update_motion_after_vote()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_motion_results(NEW.motion_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_motion_after_vote ON votes;
CREATE TRIGGER trg_update_motion_after_vote
  AFTER INSERT OR UPDATE OR DELETE ON votes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_motion_after_vote();

-- Fonction: Mettre à jour le quorum après modification des présences
CREATE OR REPLACE FUNCTION trigger_update_assembly_quorum()
RETURNS TRIGGER AS $$
DECLARE
  v_quorum RECORD;
BEGIN
  SELECT * INTO v_quorum 
  FROM calculate_assembly_quorum(COALESCE(NEW.assembly_id, OLD.assembly_id));
  
  UPDATE assemblies SET
    total_tantiemes = v_quorum.total_tantiemes,
    present_tantiemes = v_quorum.present_tantiemes,
    represented_tantiemes = v_quorum.represented_tantiemes,
    absent_tantiemes = v_quorum.absent_tantiemes,
    quorum_reached = v_quorum.quorum_reached,
    quorum_reached_at = CASE 
      WHEN v_quorum.quorum_reached AND quorum_reached_at IS NULL THEN NOW()
      ELSE quorum_reached_at
    END,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.assembly_id, OLD.assembly_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_quorum ON assembly_attendance;
CREATE TRIGGER trg_update_quorum
  AFTER INSERT OR UPDATE OR DELETE ON assembly_attendance
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_assembly_quorum();

-- =====================================================
-- VIEWS
-- =====================================================

-- Vue: Résumé des AG
CREATE OR REPLACE VIEW v_assemblies_summary AS
SELECT 
  a.*,
  s.name as site_name,
  (SELECT COUNT(*) FROM motions m WHERE m.assembly_id = a.id) as motions_count,
  (SELECT COUNT(*) FROM motions m WHERE m.assembly_id = a.id AND m.status = 'adopted') as motions_adopted,
  (SELECT COUNT(*) FROM assembly_attendance aa WHERE aa.assembly_id = a.id AND aa.attendance_type = 'present') as present_count,
  (SELECT COUNT(*) FROM assembly_attendance aa WHERE aa.assembly_id = a.id AND aa.attendance_type = 'represented') as represented_count,
  (SELECT COUNT(*) FROM proxies p WHERE p.assembly_id = a.id AND p.status = 'validated') as proxies_count
FROM assemblies a
JOIN sites s ON s.id = a.site_id;

-- Vue: Résumé des motions avec résultats
CREATE OR REPLACE VIEW v_motions_with_results AS
SELECT 
  m.*,
  a.label as assembly_label,
  a.scheduled_at as assembly_date,
  CASE WHEN (m.tantiemes_pour + m.tantiemes_contre) > 0
    THEN ROUND(m.tantiemes_pour::NUMERIC / (m.tantiemes_pour + m.tantiemes_contre) * 100, 2)
    ELSE 0
  END as percentage_pour
FROM motions m
JOIN assemblies a ON a.id = m.assembly_id;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Assemblies
ALTER TABLE assemblies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assemblies_select" ON assemblies
  FOR SELECT USING (
    site_id IN (SELECT accessible_site_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "assemblies_insert" ON assemblies
  FOR INSERT WITH CHECK (is_syndic_of(site_id) OR has_role('platform_admin'));

CREATE POLICY "assemblies_update" ON assemblies
  FOR UPDATE USING (is_syndic_of(site_id) OR has_role('platform_admin'));

CREATE POLICY "assemblies_delete" ON assemblies
  FOR DELETE USING (has_role('platform_admin'));

-- Motions
ALTER TABLE motions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "motions_select" ON motions
  FOR SELECT USING (
    assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE a.site_id IN (SELECT accessible_site_ids())
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "motions_insert" ON motions
  FOR INSERT WITH CHECK (
    assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE is_syndic_of(a.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "motions_update" ON motions
  FOR UPDATE USING (
    assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE is_syndic_of(a.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "motions_delete" ON motions
  FOR DELETE USING (has_role('platform_admin'));

-- Attendance
ALTER TABLE assembly_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select" ON assembly_attendance
  FOR SELECT USING (
    assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE a.site_id IN (SELECT accessible_site_ids())
    )
    OR unit_id IN (SELECT owned_unit_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "attendance_insert" ON assembly_attendance
  FOR INSERT WITH CHECK (
    assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE is_syndic_of(a.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "attendance_update" ON assembly_attendance
  FOR UPDATE USING (
    assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE is_syndic_of(a.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "attendance_delete" ON assembly_attendance
  FOR DELETE USING (has_role('platform_admin'));

-- Proxies
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proxies_select" ON proxies
  FOR SELECT USING (
    grantor_unit_id IN (SELECT owned_unit_ids())
    OR grantee_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE is_syndic_of(a.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "proxies_insert" ON proxies
  FOR INSERT WITH CHECK (
    grantor_unit_id IN (SELECT owned_unit_ids())
    OR assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE is_syndic_of(a.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "proxies_update" ON proxies
  FOR UPDATE USING (
    grantor_unit_id IN (SELECT owned_unit_ids())
    OR assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE is_syndic_of(a.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "proxies_delete" ON proxies
  FOR DELETE USING (
    grantor_unit_id IN (SELECT owned_unit_ids())
    OR has_role('platform_admin')
  );

-- Votes
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes_select" ON votes
  FOR SELECT USING (
    unit_id IN (SELECT owned_unit_ids())
    OR assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE a.site_id IN (SELECT accessible_site_ids())
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "votes_insert" ON votes
  FOR INSERT WITH CHECK (
    (unit_id IN (SELECT owned_unit_ids()) AND has_permission('assemblies.vote'))
    OR assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE is_syndic_of(a.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "votes_update" ON votes
  FOR UPDATE USING (
    assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE is_syndic_of(a.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "votes_delete" ON votes
  FOR DELETE USING (has_role('platform_admin'));

-- Assembly documents
ALTER TABLE assembly_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assembly_docs_select" ON assembly_documents
  FOR SELECT USING (
    is_public = true
    OR assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE a.site_id IN (SELECT accessible_site_ids())
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "assembly_docs_insert" ON assembly_documents
  FOR INSERT WITH CHECK (
    assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE is_syndic_of(a.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "assembly_docs_update" ON assembly_documents
  FOR UPDATE USING (
    assembly_id IN (
      SELECT a.id FROM assemblies a 
      WHERE is_syndic_of(a.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "assembly_docs_delete" ON assembly_documents
  FOR DELETE USING (has_role('platform_admin'));

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON assemblies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON motions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON assembly_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON proxies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON assembly_documents TO authenticated;

GRANT SELECT ON v_assemblies_summary TO authenticated;
GRANT SELECT ON v_motions_with_results TO authenticated;

GRANT EXECUTE ON FUNCTION calculate_assembly_quorum TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_motion_result TO authenticated;
GRANT EXECUTE ON FUNCTION update_motion_results TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE assemblies IS 'Assemblées générales de copropriété';
COMMENT ON TABLE motions IS 'Résolutions soumises au vote';
COMMENT ON TABLE assembly_attendance IS 'Présences à l''AG';
COMMENT ON TABLE proxies IS 'Pouvoirs donnés pour l''AG';
COMMENT ON TABLE votes IS 'Votes individuels sur les résolutions';
COMMENT ON TABLE assembly_documents IS 'Documents liés à l''AG';

COMMENT ON COLUMN motions.majority_type IS 'simple=Art.24, absolute=Art.25, double=Art.26, unanimity=unanimité';

