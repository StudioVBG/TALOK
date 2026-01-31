-- Migration: Ajout du bail professionnel
-- GAP-004: Support des baux professionnels (professions libérales)
-- Conforme à l'article 57 A de la loi n°86-1290 du 23 décembre 1986

-- =============================================================================
-- 1. EXTENSION DU TYPE ENUM lease_type (si pas déjà fait)
-- =============================================================================

-- Le type 'professionnel' a déjà été ajouté dans la migration précédente
-- Cette section est conservée pour idempotence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'professionnel'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lease_type')
  ) THEN
    ALTER TYPE lease_type ADD VALUE IF NOT EXISTS 'professionnel';
  END IF;
END$$;

-- =============================================================================
-- 2. TABLE: professional_lease_details
-- Détails spécifiques aux baux professionnels
-- =============================================================================

CREATE TABLE IF NOT EXISTS professional_lease_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Preneur - Profession
  profession_category VARCHAR(50) NOT NULL, -- sante, juridique, technique, comptable, conseil, artistique, autre
  profession_type VARCHAR(50) NOT NULL,     -- medecin_generaliste, avocat, architecte, etc.
  profession_libelle VARCHAR(255) NOT NULL, -- Libellé exact de la profession
  forme_juridique VARCHAR(50) NOT NULL,     -- exercice_individuel, scp, scm, sel, selarl, etc.

  -- Inscription ordinale
  ordre_professionnel VARCHAR(255),
  numero_ordinal VARCHAR(50),
  departement_inscription VARCHAR(3),

  -- Identification fiscale
  regime_fiscal VARCHAR(20) DEFAULT 'bnc', -- bnc, is, micro_bnc
  numero_tva_intra VARCHAR(20),

  -- Assurance RCP
  assurance_rcp BOOLEAN DEFAULT TRUE,
  assurance_rcp_compagnie VARCHAR(255),
  assurance_rcp_numero VARCHAR(100),

  -- Locaux
  surface_totale_m2 DECIMAL(10,2) NOT NULL,
  nb_bureaux INTEGER DEFAULT 1,
  nb_salles_attente INTEGER DEFAULT 1,
  nb_salles_examen INTEGER DEFAULT 0,
  accessibilite_pmr BOOLEAN DEFAULT FALSE,
  usage_exclusif_professionnel BOOLEAN DEFAULT TRUE,
  reception_clientele BOOLEAN DEFAULT TRUE,

  -- Financier
  loyer_annuel_hc DECIMAL(12,2) NOT NULL,
  tva_applicable BOOLEAN DEFAULT FALSE, -- Généralement pas de TVA
  tva_taux DECIMAL(5,2),
  charges_type VARCHAR(20) DEFAULT 'provisions', -- forfait, provisions, reel
  charges_montant_mensuel DECIMAL(10,2),

  -- Indexation (ILAT par défaut)
  indice_reference VARCHAR(10) DEFAULT 'ILAT',
  indice_base DECIMAL(10,2),
  indice_base_trimestre VARCHAR(20),
  date_revision_annuelle VARCHAR(5) DEFAULT '01-01', -- Format MM-DD

  -- Résiliation
  preavis_locataire_mois INTEGER DEFAULT 6,
  preavis_bailleur_mois INTEGER DEFAULT 6,

  -- Options
  sous_location_autorisee BOOLEAN DEFAULT FALSE,
  cession_autorisee BOOLEAN DEFAULT TRUE,
  cession_agrement_bailleur BOOLEAN DEFAULT TRUE,

  -- Clause résolutoire
  clause_resolutoire_active BOOLEAN DEFAULT TRUE,
  clause_resolutoire_delai_jours INTEGER DEFAULT 30,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lease_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_professional_lease_details_lease_id
  ON professional_lease_details(lease_id);

CREATE INDEX IF NOT EXISTS idx_professional_lease_profession_type
  ON professional_lease_details(profession_type);

CREATE INDEX IF NOT EXISTS idx_professional_lease_profession_category
  ON professional_lease_details(profession_category);

-- =============================================================================
-- 3. TABLE: professional_orders
-- Référentiel des ordres professionnels
-- =============================================================================

CREATE TABLE IF NOT EXISTS professional_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  professions VARCHAR(255)[], -- Liste des professions concernées

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertion des ordres professionnels
INSERT INTO professional_orders (code, name, website, professions) VALUES
  ('medecins', 'Ordre national des médecins', 'https://www.conseil-national.medecin.fr', ARRAY['medecin_generaliste', 'medecin_specialiste']),
  ('pharmaciens', 'Ordre national des pharmaciens', 'https://www.ordre.pharmacien.fr', ARRAY['pharmacien']),
  ('dentistes', 'Ordre national des chirurgiens-dentistes', 'https://www.ordre-chirurgiens-dentistes.fr', ARRAY['chirurgien_dentiste']),
  ('sages_femmes', 'Ordre national des sages-femmes', 'https://www.ordre-sages-femmes.fr', ARRAY['sage_femme']),
  ('infirmiers', 'Ordre national des infirmiers', 'https://www.ordre-infirmiers.fr', ARRAY['infirmier']),
  ('kinesitherapeutes', 'Ordre des masseurs-kinésithérapeutes', 'https://www.ordremk.fr', ARRAY['kinesitherapeute']),
  ('avocats', 'Conseil national des barreaux', 'https://www.cnb.avocat.fr', ARRAY['avocat']),
  ('notaires', 'Conseil supérieur du notariat', 'https://www.notaires.fr', ARRAY['notaire']),
  ('huissiers', 'Chambre nationale des commissaires de justice', 'https://www.cnhj.fr', ARRAY['huissier']),
  ('architectes', 'Ordre des architectes', 'https://www.architectes.org', ARRAY['architecte']),
  ('geometres_experts', 'Ordre des géomètres-experts', 'https://www.geometre-expert.fr', ARRAY['geometre_expert']),
  ('experts_comptables', 'Ordre des experts-comptables', 'https://www.experts-comptables.fr', ARRAY['expert_comptable', 'commissaire_aux_comptes']),
  ('veterinaires', 'Ordre national des vétérinaires', 'https://www.veterinaire.fr', ARRAY['veterinaire'])
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 4. FONCTION: Validation de la durée minimale bail professionnel
-- =============================================================================

CREATE OR REPLACE FUNCTION check_professional_lease_duration()
RETURNS TRIGGER AS $$
DECLARE
  v_lease_type TEXT;
  v_start_date DATE;
  v_end_date DATE;
  v_duration_months INTEGER;
BEGIN
  -- Récupérer le type de bail
  SELECT type, start_date, end_date
  INTO v_lease_type, v_start_date, v_end_date
  FROM leases
  WHERE id = NEW.lease_id;

  -- Vérifier seulement pour les baux professionnels
  IF v_lease_type = 'professionnel' AND v_end_date IS NOT NULL THEN
    -- Calculer la durée en mois
    v_duration_months := (
      EXTRACT(YEAR FROM v_end_date) - EXTRACT(YEAR FROM v_start_date)
    ) * 12 + (
      EXTRACT(MONTH FROM v_end_date) - EXTRACT(MONTH FROM v_start_date)
    );

    -- Durée minimale : 6 ans = 72 mois
    IF v_duration_months < 72 THEN
      RAISE EXCEPTION 'La durée minimale d''un bail professionnel est de 6 ans (72 mois). Durée actuelle: % mois', v_duration_months;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour vérifier la durée
DROP TRIGGER IF EXISTS trigger_check_professional_lease_duration ON professional_lease_details;
CREATE TRIGGER trigger_check_professional_lease_duration
  BEFORE INSERT OR UPDATE ON professional_lease_details
  FOR EACH ROW
  EXECUTE FUNCTION check_professional_lease_duration();

-- =============================================================================
-- 5. FONCTION: RPC pour obtenir les détails d'un bail professionnel
-- =============================================================================

CREATE OR REPLACE FUNCTION get_professional_lease_details(p_lease_id UUID)
RETURNS TABLE (
  lease_id UUID,
  profession_category VARCHAR,
  profession_type VARCHAR,
  profession_libelle VARCHAR,
  forme_juridique VARCHAR,
  ordre_professionnel VARCHAR,
  numero_ordinal VARCHAR,
  assurance_rcp BOOLEAN,
  surface_totale_m2 DECIMAL,
  loyer_annuel_hc DECIMAL,
  indice_reference VARCHAR,
  preavis_locataire_mois INTEGER,
  preavis_bailleur_mois INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pld.lease_id,
    pld.profession_category,
    pld.profession_type,
    pld.profession_libelle,
    pld.forme_juridique,
    pld.ordre_professionnel,
    pld.numero_ordinal,
    pld.assurance_rcp,
    pld.surface_totale_m2,
    pld.loyer_annuel_hc,
    pld.indice_reference,
    pld.preavis_locataire_mois,
    pld.preavis_bailleur_mois
  FROM professional_lease_details pld
  WHERE pld.lease_id = p_lease_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. FONCTION: Calcul de la révision ILAT
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_ilat_revision(
  p_current_rent DECIMAL,
  p_base_index DECIMAL,
  p_new_index DECIMAL
)
RETURNS TABLE (
  ancien_loyer DECIMAL,
  nouveau_loyer DECIMAL,
  variation_pct DECIMAL
) AS $$
DECLARE
  v_new_rent DECIMAL;
  v_variation DECIMAL;
BEGIN
  -- Calcul du nouveau loyer
  v_new_rent := p_current_rent * (p_new_index / p_base_index);
  v_variation := ((p_new_index - p_base_index) / p_base_index) * 100;

  RETURN QUERY
  SELECT
    p_current_rent as ancien_loyer,
    ROUND(v_new_rent, 2) as nouveau_loyer,
    ROUND(v_variation, 2) as variation_pct;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. RLS POLICIES
-- =============================================================================

-- Activer RLS
ALTER TABLE professional_lease_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_orders ENABLE ROW LEVEL SECURITY;

-- Policies pour professional_lease_details
CREATE POLICY "professional_lease_details_select_policy" ON professional_lease_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = professional_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "professional_lease_details_insert_policy" ON professional_lease_details
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = professional_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "professional_lease_details_update_policy" ON professional_lease_details
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = professional_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "professional_lease_details_delete_policy" ON professional_lease_details
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = professional_lease_details.lease_id
        AND p.owner_id = auth.uid()
    )
  );

-- Policies pour professional_orders (lecture seule pour tous)
CREATE POLICY "professional_orders_select_policy" ON professional_orders
  FOR SELECT USING (TRUE);

-- =============================================================================
-- 8. TRIGGER: Mise à jour automatique updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_professional_lease_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_professional_lease_timestamp ON professional_lease_details;
CREATE TRIGGER trigger_update_professional_lease_timestamp
  BEFORE UPDATE ON professional_lease_details
  FOR EACH ROW
  EXECUTE FUNCTION update_professional_lease_timestamp();

-- =============================================================================
-- 9. COMMENTAIRES
-- =============================================================================

COMMENT ON TABLE professional_lease_details IS
  'Détails spécifiques aux baux professionnels (article 57 A loi 86-1290) - Professions libérales';

COMMENT ON TABLE professional_orders IS
  'Référentiel des ordres professionnels français';

COMMENT ON COLUMN professional_lease_details.indice_reference IS
  'Indice de révision du loyer - ILAT recommandé pour les baux professionnels';

COMMENT ON COLUMN professional_lease_details.assurance_rcp IS
  'Assurance Responsabilité Civile Professionnelle - Obligatoire pour la plupart des professions réglementées';
