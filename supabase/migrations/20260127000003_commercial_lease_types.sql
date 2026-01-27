-- Migration: Ajout des types de baux commerciaux
-- GAP-003: Support des baux commerciaux (3/6/9 et dérogatoire)
-- Conforme au Code de commerce (Articles L145-1 à L145-60)

-- =============================================================================
-- 1. EXTENSION DU TYPE ENUM lease_type
-- =============================================================================

-- Ajouter les nouveaux types de bail si pas déjà présents
DO $$
BEGIN
  -- Bail commercial 3/6/9
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'commercial'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lease_type')
  ) THEN
    ALTER TYPE lease_type ADD VALUE IF NOT EXISTS 'commercial';
  END IF;

  -- Bail dérogatoire (précaire)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'commercial_derogatoire'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lease_type')
  ) THEN
    ALTER TYPE lease_type ADD VALUE IF NOT EXISTS 'commercial_derogatoire';
  END IF;

  -- Bail professionnel (pour les professions libérales)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'professionnel'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lease_type')
  ) THEN
    ALTER TYPE lease_type ADD VALUE IF NOT EXISTS 'professionnel';
  END IF;
END$$;

-- =============================================================================
-- 2. TABLE: commercial_lease_details
-- Détails spécifiques aux baux commerciaux
-- =============================================================================

CREATE TABLE IF NOT EXISTS commercial_lease_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Destination des locaux (Article L145-47)
  destination_clause TEXT NOT NULL,
  activite_principale TEXT NOT NULL,
  activites_connexes TEXT,
  clause_tous_commerces BOOLEAN DEFAULT FALSE,
  despecialisation_partielle_autorisee BOOLEAN DEFAULT TRUE,
  code_ape VARCHAR(10),

  -- Durée et périodes triennales
  duree_ferme_mois INTEGER, -- Pour bail dérogatoire: durée ferme
  renonciation_triennale BOOLEAN DEFAULT FALSE,
  renonciation_motif TEXT,

  -- Loyer et indexation
  loyer_annuel_ht DECIMAL(12,2) NOT NULL,
  tva_applicable BOOLEAN DEFAULT TRUE,
  tva_taux DECIMAL(5,2) DEFAULT 20.00,
  indice_type VARCHAR(10) DEFAULT 'ILC', -- ILC, ILAT, ICC
  indice_base DECIMAL(10,2),
  indice_trimestre_base VARCHAR(20),
  plafonnement_revision BOOLEAN DEFAULT TRUE,

  -- Pas-de-porte / Droit d'entrée
  pas_de_porte_montant DECIMAL(12,2),
  pas_de_porte_nature VARCHAR(50), -- 'supplement_loyer', 'indemnite'
  pas_de_porte_tva DECIMAL(12,2),

  -- Droit au bail
  droit_au_bail_valeur DECIMAL(12,2),

  -- Garanties spécifiques
  garantie_bancaire_type VARCHAR(50),
  garantie_bancaire_montant DECIMAL(12,2),
  garantie_bancaire_banque VARCHAR(255),
  garantie_bancaire_duree_mois INTEGER,

  -- Caution solidaire
  caution_solidaire BOOLEAN DEFAULT FALSE,
  caution_nom VARCHAR(255),
  caution_siret VARCHAR(14),
  caution_adresse TEXT,
  caution_montant_engagement DECIMAL(12,2),
  caution_duree_mois INTEGER,

  -- Cession et sous-location
  cession_libre BOOLEAN DEFAULT FALSE,
  droit_preemption_bailleur BOOLEAN DEFAULT FALSE,
  sous_location_autorisee BOOLEAN DEFAULT FALSE,
  garantie_solidaire_cedant BOOLEAN DEFAULT TRUE,
  garantie_cedant_duree_mois INTEGER DEFAULT 36,

  -- Charges (répartition Loi Pinel)
  taxe_fonciere_preneur BOOLEAN DEFAULT FALSE,
  taxe_bureaux_preneur BOOLEAN DEFAULT FALSE,
  charges_copro_fonct_preneur BOOLEAN DEFAULT TRUE,

  -- Travaux
  accession_ameliorations BOOLEAN DEFAULT TRUE,
  travaux_bailleur_liste TEXT,

  -- Clause résolutoire
  clause_resolutoire_delai_jours INTEGER DEFAULT 30,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lease_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_commercial_lease_details_lease_id
  ON commercial_lease_details(lease_id);

-- =============================================================================
-- 3. TABLE: commercial_lease_triennial_periods
-- Historique des périodes triennales
-- =============================================================================

CREATE TABLE IF NOT EXISTS commercial_lease_triennial_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  period_number INTEGER NOT NULL, -- 1, 2, 3
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  resignation_deadline DATE NOT NULL, -- Date limite pour donner congé

  -- Statut de la période
  resignation_given BOOLEAN DEFAULT FALSE,
  resignation_date DATE,
  resignation_by VARCHAR(20), -- 'preneur', 'bailleur'

  -- Loyer applicable pendant cette période
  loyer_annuel_ht DECIMAL(12,2),
  indice_revision DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lease_id, period_number)
);

CREATE INDEX IF NOT EXISTS idx_commercial_triennial_lease_id
  ON commercial_lease_triennial_periods(lease_id);

-- =============================================================================
-- 4. TABLE: derogatoire_lease_history
-- Historique des baux dérogatoires successifs (contrôle des 3 ans max)
-- =============================================================================

CREATE TABLE IF NOT EXISTS derogatoire_lease_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Preneur (peut être différent pour chaque bail)
  preneur_type VARCHAR(20) NOT NULL, -- 'personne_physique', 'personne_morale'
  preneur_nom VARCHAR(255) NOT NULL,
  preneur_siret VARCHAR(14),

  -- Période du bail
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  duree_mois INTEGER NOT NULL,

  -- Pour vérification de la limite des 3 ans
  duree_cumulee_avant_mois INTEGER DEFAULT 0,
  duree_cumulee_apres_mois INTEGER NOT NULL,

  -- Alerte si proche de la limite
  alerte_limite_3_ans BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT check_duree_max CHECK (duree_cumulee_apres_mois <= 36)
);

CREATE INDEX IF NOT EXISTS idx_derogatoire_history_property
  ON derogatoire_lease_history(property_id);

-- =============================================================================
-- 5. FONCTION: Calcul automatique des périodes triennales
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_triennial_periods()
RETURNS TRIGGER AS $$
DECLARE
  v_start_date DATE;
  v_period_start DATE;
  v_period_end DATE;
  v_resignation_deadline DATE;
  v_loyer DECIMAL(12,2);
BEGIN
  -- Seulement pour les baux commerciaux 3/6/9
  IF NEW.type != 'commercial' THEN
    RETURN NEW;
  END IF;

  -- Récupérer la date de début et le loyer
  v_start_date := NEW.start_date;

  SELECT loyer_annuel_ht INTO v_loyer
  FROM commercial_lease_details
  WHERE lease_id = NEW.id;

  -- Générer les 3 périodes triennales
  FOR i IN 1..3 LOOP
    v_period_start := v_start_date + ((i-1) * INTERVAL '3 years');
    v_period_end := v_start_date + (i * INTERVAL '3 years') - INTERVAL '1 day';
    v_resignation_deadline := v_period_end - INTERVAL '6 months';

    INSERT INTO commercial_lease_triennial_periods (
      lease_id,
      period_number,
      start_date,
      end_date,
      resignation_deadline,
      loyer_annuel_ht
    ) VALUES (
      NEW.id,
      i,
      v_period_start,
      v_period_end,
      v_resignation_deadline,
      v_loyer
    )
    ON CONFLICT (lease_id, period_number)
    DO UPDATE SET
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      resignation_deadline = EXCLUDED.resignation_deadline;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour générer les périodes triennales
DROP TRIGGER IF EXISTS trigger_generate_triennial_periods ON leases;
CREATE TRIGGER trigger_generate_triennial_periods
  AFTER INSERT OR UPDATE OF start_date, type ON leases
  FOR EACH ROW
  WHEN (NEW.type = 'commercial')
  EXECUTE FUNCTION generate_triennial_periods();

-- =============================================================================
-- 6. FONCTION: Vérification durée cumulative bail dérogatoire
-- =============================================================================

CREATE OR REPLACE FUNCTION check_derogatoire_duration()
RETURNS TRIGGER AS $$
DECLARE
  v_cumul_mois INTEGER;
  v_new_total INTEGER;
BEGIN
  -- Calculer la durée cumulée des baux dérogatoires sur ce bien
  SELECT COALESCE(SUM(duree_mois), 0) INTO v_cumul_mois
  FROM derogatoire_lease_history
  WHERE property_id = NEW.property_id
    AND id != NEW.id;

  v_new_total := v_cumul_mois + NEW.duree_mois;

  -- Mettre à jour les valeurs
  NEW.duree_cumulee_avant_mois := v_cumul_mois;
  NEW.duree_cumulee_apres_mois := v_new_total;

  -- Alerte si on approche de la limite
  IF v_new_total > 30 THEN
    NEW.alerte_limite_3_ans := TRUE;
  END IF;

  -- Erreur si dépassement
  IF v_new_total > 36 THEN
    RAISE EXCEPTION 'La durée cumulée des baux dérogatoires ne peut excéder 36 mois (3 ans). Durée actuelle: % mois', v_new_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_derogatoire_duration ON derogatoire_lease_history;
CREATE TRIGGER trigger_check_derogatoire_duration
  BEFORE INSERT OR UPDATE ON derogatoire_lease_history
  FOR EACH ROW
  EXECUTE FUNCTION check_derogatoire_duration();

-- =============================================================================
-- 7. FONCTION: RPC pour obtenir l'historique dérogatoire d'un bien
-- =============================================================================

CREATE OR REPLACE FUNCTION get_derogatoire_history(p_property_id UUID)
RETURNS TABLE (
  id UUID,
  preneur_nom VARCHAR,
  date_debut DATE,
  date_fin DATE,
  duree_mois INTEGER,
  duree_cumulee_apres_mois INTEGER,
  mois_restants INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id,
    h.preneur_nom,
    h.date_debut,
    h.date_fin,
    h.duree_mois,
    h.duree_cumulee_apres_mois,
    (36 - h.duree_cumulee_apres_mois) as mois_restants
  FROM derogatoire_lease_history h
  WHERE h.property_id = p_property_id
  ORDER BY h.date_debut;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 8. FONCTION: RPC pour calculer la révision de loyer ILC/ILAT
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_commercial_rent_revision(
  p_lease_id UUID,
  p_new_indice DECIMAL
)
RETURNS TABLE (
  ancien_loyer DECIMAL,
  nouveau_loyer DECIMAL,
  variation_pct DECIMAL,
  indice_base DECIMAL,
  nouvel_indice DECIMAL
) AS $$
DECLARE
  v_loyer DECIMAL;
  v_indice_base DECIMAL;
  v_nouveau_loyer DECIMAL;
  v_variation DECIMAL;
BEGIN
  -- Récupérer les données du bail
  SELECT
    cld.loyer_annuel_ht,
    cld.indice_base
  INTO v_loyer, v_indice_base
  FROM commercial_lease_details cld
  WHERE cld.lease_id = p_lease_id;

  IF v_loyer IS NULL OR v_indice_base IS NULL THEN
    RAISE EXCEPTION 'Bail commercial non trouvé ou indice de base manquant';
  END IF;

  -- Calcul du nouveau loyer
  v_nouveau_loyer := v_loyer * (p_new_indice / v_indice_base);
  v_variation := ((p_new_indice - v_indice_base) / v_indice_base) * 100;

  RETURN QUERY
  SELECT
    v_loyer as ancien_loyer,
    ROUND(v_nouveau_loyer, 2) as nouveau_loyer,
    ROUND(v_variation, 2) as variation_pct,
    v_indice_base as indice_base,
    p_new_indice as nouvel_indice;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 9. RLS POLICIES
-- =============================================================================

-- Activer RLS
ALTER TABLE commercial_lease_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_lease_triennial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE derogatoire_lease_history ENABLE ROW LEVEL SECURITY;

-- Policies pour commercial_lease_details
CREATE POLICY "commercial_lease_details_select_policy" ON commercial_lease_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = commercial_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "commercial_lease_details_insert_policy" ON commercial_lease_details
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = commercial_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "commercial_lease_details_update_policy" ON commercial_lease_details
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = commercial_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "commercial_lease_details_delete_policy" ON commercial_lease_details
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = commercial_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

-- Policies pour commercial_lease_triennial_periods
CREATE POLICY "triennial_periods_select_policy" ON commercial_lease_triennial_periods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = commercial_lease_triennial_periods.lease_id
        AND p.owner_id = auth.uid()
    )
  );

-- Policies pour derogatoire_lease_history
CREATE POLICY "derogatoire_history_select_policy" ON derogatoire_lease_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = derogatoire_lease_history.property_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "derogatoire_history_insert_policy" ON derogatoire_lease_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = derogatoire_lease_history.property_id
        AND p.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- 10. TRIGGER: Mise à jour automatique updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_commercial_lease_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_commercial_lease_timestamp ON commercial_lease_details;
CREATE TRIGGER trigger_update_commercial_lease_timestamp
  BEFORE UPDATE ON commercial_lease_details
  FOR EACH ROW
  EXECUTE FUNCTION update_commercial_lease_timestamp();

-- =============================================================================
-- 11. COMMENTAIRES
-- =============================================================================

COMMENT ON TABLE commercial_lease_details IS
  'Détails spécifiques aux baux commerciaux (3/6/9 et dérogatoire) - Code de commerce L145';

COMMENT ON TABLE commercial_lease_triennial_periods IS
  'Périodes triennales pour les baux commerciaux 3/6/9 avec dates de résiliation';

COMMENT ON TABLE derogatoire_lease_history IS
  'Historique des baux dérogatoires par bien pour contrôle de la limite de 3 ans (L145-5)';

COMMENT ON COLUMN commercial_lease_details.indice_type IS
  'Type d''indice: ILC (commerces), ILAT (bureaux/activités tertiaires), ICC (obsolète)';

COMMENT ON COLUMN commercial_lease_details.pas_de_porte_nature IS
  'supplement_loyer = pris en compte pour renouvellement, indemnite = non pris en compte';
