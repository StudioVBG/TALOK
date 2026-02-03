-- ============================================
-- Migration: Taxe de Séjour - GAP-006 SOTA 2026
-- ============================================
-- Conformité:
-- - Article L2333-26 à L2333-47 du CGCT
-- - Décret n°2019-1062 (taux plafonds)
-- - Loi de finances 2024 (taxe additionnelle)
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

-- Types d'hébergement touristique
CREATE TYPE hebergement_touristique_type AS ENUM (
  'palace',
  'hotel_5_etoiles',
  'hotel_4_etoiles',
  'hotel_3_etoiles',
  'hotel_2_etoiles',
  'hotel_1_etoile',
  'hotel_non_classe',
  'residence_tourisme_5',
  'residence_tourisme_4',
  'residence_tourisme_3',
  'residence_tourisme_2',
  'residence_tourisme_1',
  'residence_tourisme_nc',
  'meuble_tourisme_5',
  'meuble_tourisme_4',
  'meuble_tourisme_3',
  'meuble_tourisme_2',
  'meuble_tourisme_1',
  'meuble_tourisme_nc',
  'chambre_hotes',
  'camping_5_etoiles',
  'camping_4_etoiles',
  'camping_3_etoiles',
  'camping_2_etoiles',
  'camping_1_etoile',
  'camping_non_classe',
  'village_vacances_4_5',
  'village_vacances_1_2_3',
  'auberge_jeunesse',
  'port_plaisance',
  'aire_camping_car',
  'autre_hebergement'
);

-- Mode de perception
CREATE TYPE mode_perception_taxe AS ENUM (
  'au_reel',
  'au_forfait'
);

-- Statut de déclaration
CREATE TYPE declaration_taxe_status AS ENUM (
  'brouillon',
  'a_declarer',
  'declaree',
  'validee',
  'payee',
  'annulee'
);

-- Motifs d'exonération
CREATE TYPE motif_exoneration_taxe AS ENUM (
  'mineur',
  'intermediaire_agence',
  'travailleur_saisonnier',
  'logement_urgence',
  'resident_secondaire_taxe'
);

-- ============================================
-- TABLE: taxe_sejour_communes
-- Configuration par commune
-- ============================================
CREATE TABLE taxe_sejour_communes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification commune
  code_insee VARCHAR(5) NOT NULL UNIQUE,
  nom_commune VARCHAR(255) NOT NULL,
  code_postal VARCHAR(5) NOT NULL,
  departement VARCHAR(3) NOT NULL,

  -- Configuration taxe
  taxe_active BOOLEAN NOT NULL DEFAULT true,
  mode_perception mode_perception_taxe NOT NULL DEFAULT 'au_reel',

  -- Tarifs par type (€/personne/nuit) - NULL = tarif plafond par défaut
  tarifs JSONB NOT NULL DEFAULT '{}',

  -- Taxe additionnelle départementale (max 10%)
  taxe_additionnelle_departementale NUMERIC(5,2) NOT NULL DEFAULT 10.00
    CHECK (taxe_additionnelle_departementale >= 0 AND taxe_additionnelle_departementale <= 10),

  -- Déclaration
  portail_declaration_url TEXT,
  periodicite_declaration VARCHAR(20) NOT NULL DEFAULT 'trimestrielle'
    CHECK (periodicite_declaration IN ('mensuelle', 'trimestrielle', 'annuelle')),
  jour_limite_declaration INTEGER NOT NULL DEFAULT 15
    CHECK (jour_limite_declaration >= 1 AND jour_limite_declaration <= 28),

  -- Métadonnées
  observations TEXT,
  date_debut_validite DATE NOT NULL DEFAULT CURRENT_DATE,
  date_fin_validite DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche par code postal / département
CREATE INDEX idx_taxe_sejour_communes_code_postal ON taxe_sejour_communes(code_postal);
CREATE INDEX idx_taxe_sejour_communes_departement ON taxe_sejour_communes(departement);

-- ============================================
-- TABLE: sejours_touristiques
-- Séjours soumis à taxe de séjour
-- ============================================
CREATE TABLE sejours_touristiques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commune_config_id UUID REFERENCES taxe_sejour_communes(id),

  -- Classification hébergement
  type_hebergement hebergement_touristique_type NOT NULL DEFAULT 'meuble_tourisme_nc',
  numero_enregistrement VARCHAR(50), -- Obligatoire dans certaines villes

  -- Dates du séjour
  date_arrivee DATE NOT NULL,
  date_depart DATE NOT NULL,
  nombre_nuitees INTEGER NOT NULL GENERATED ALWAYS AS (date_depart - date_arrivee) STORED,

  -- Occupants (JSONB array)
  occupants JSONB NOT NULL DEFAULT '[]',
  nombre_occupants_total INTEGER NOT NULL DEFAULT 0,
  nombre_occupants_assujettis INTEGER NOT NULL DEFAULT 0,

  -- Calcul de la taxe
  taux_applique NUMERIC(10,2) NOT NULL DEFAULT 0,
  taux_additionnel_departemental NUMERIC(5,2) NOT NULL DEFAULT 0,
  montant_taxe_collectee NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_taxe_additionnelle NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_total NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Collecte
  taxe_collectee BOOLEAN NOT NULL DEFAULT false,
  date_collecte DATE,
  moyen_paiement_taxe VARCHAR(20)
    CHECK (moyen_paiement_taxe IN ('especes', 'cb', 'virement', 'inclus_loyer')),

  -- Lien vers déclaration
  declaration_id UUID REFERENCES declarations_taxe_sejour(id),

  -- Métadonnées
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT dates_sejour_valides CHECK (date_depart > date_arrivee),
  CONSTRAINT nuitees_max CHECK (nombre_nuitees <= 90) -- Max location saisonnière
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_sejours_touristiques_lease ON sejours_touristiques(lease_id);
CREATE INDEX idx_sejours_touristiques_property ON sejours_touristiques(property_id);
CREATE INDEX idx_sejours_touristiques_owner ON sejours_touristiques(owner_id);
CREATE INDEX idx_sejours_touristiques_dates ON sejours_touristiques(date_arrivee, date_depart);
CREATE INDEX idx_sejours_touristiques_non_collectes ON sejours_touristiques(owner_id)
  WHERE NOT taxe_collectee;
CREATE INDEX idx_sejours_touristiques_non_declares ON sejours_touristiques(owner_id)
  WHERE declaration_id IS NULL AND taxe_collectee;

-- ============================================
-- TABLE: declarations_taxe_sejour
-- Déclarations périodiques à la commune
-- ============================================
CREATE TABLE declarations_taxe_sejour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commune_config_id UUID NOT NULL REFERENCES taxe_sejour_communes(id),

  -- Période
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,
  annee_fiscale INTEGER NOT NULL,
  periode_reference VARCHAR(10) NOT NULL, -- "2026-Q1" ou "2026-01"

  -- Statut
  statut declaration_taxe_status NOT NULL DEFAULT 'brouillon',

  -- Totaux calculés
  total_nuitees INTEGER NOT NULL DEFAULT 0,
  total_personnes_assujetties INTEGER NOT NULL DEFAULT 0,
  montant_taxe_totale NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_taxe_additionnelle NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_total_a_reverser NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Échéances
  date_limite DATE NOT NULL,
  date_declaration DATE,
  reference_declaration VARCHAR(100),

  -- Paiement
  date_paiement DATE,
  reference_paiement VARCHAR(100),
  moyen_paiement VARCHAR(20)
    CHECK (moyen_paiement IN ('virement', 'prelevement', 'cheque', 'telepaiement')),

  -- Documents
  justificatif_id UUID REFERENCES documents(id),

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT periode_declaration_valide CHECK (periode_fin >= periode_debut)
);

-- Ajouter la foreign key maintenant que la table existe
ALTER TABLE sejours_touristiques
  ADD CONSTRAINT fk_sejours_declaration
  FOREIGN KEY (declaration_id) REFERENCES declarations_taxe_sejour(id) ON DELETE SET NULL;

-- Index
CREATE INDEX idx_declarations_taxe_owner ON declarations_taxe_sejour(owner_id);
CREATE INDEX idx_declarations_taxe_commune ON declarations_taxe_sejour(commune_config_id);
CREATE INDEX idx_declarations_taxe_periode ON declarations_taxe_sejour(annee_fiscale, periode_reference);
CREATE INDEX idx_declarations_taxe_statut ON declarations_taxe_sejour(statut);
CREATE INDEX idx_declarations_taxe_en_retard ON declarations_taxe_sejour(owner_id, date_limite)
  WHERE statut IN ('brouillon', 'a_declarer');

-- ============================================
-- TABLE: tarifs_plafonds_taxe_sejour
-- Référentiel des tarifs plafonds légaux
-- ============================================
CREATE TABLE tarifs_plafonds_taxe_sejour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  type_hebergement hebergement_touristique_type NOT NULL UNIQUE,
  tarif_plafond NUMERIC(10,2) NOT NULL,
  annee_reference INTEGER NOT NULL DEFAULT 2024,

  -- Source légale
  reference_legale TEXT NOT NULL DEFAULT 'Article L2333-30 CGCT',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer les tarifs plafonds 2024
INSERT INTO tarifs_plafonds_taxe_sejour (type_hebergement, tarif_plafond, annee_reference) VALUES
  ('palace', 15.00, 2024),
  ('hotel_5_etoiles', 5.00, 2024),
  ('hotel_4_etoiles', 2.88, 2024),
  ('hotel_3_etoiles', 1.70, 2024),
  ('hotel_2_etoiles', 1.00, 2024),
  ('hotel_1_etoile', 0.90, 2024),
  ('hotel_non_classe', 0.90, 2024),
  ('residence_tourisme_5', 5.00, 2024),
  ('residence_tourisme_4', 2.88, 2024),
  ('residence_tourisme_3', 1.70, 2024),
  ('residence_tourisme_2', 1.00, 2024),
  ('residence_tourisme_1', 0.90, 2024),
  ('residence_tourisme_nc', 0.90, 2024),
  ('meuble_tourisme_5', 5.00, 2024),
  ('meuble_tourisme_4', 2.88, 2024),
  ('meuble_tourisme_3', 1.70, 2024),
  ('meuble_tourisme_2', 1.00, 2024),
  ('meuble_tourisme_1', 0.90, 2024),
  ('meuble_tourisme_nc', 0.90, 2024),
  ('chambre_hotes', 0.90, 2024),
  ('camping_5_etoiles', 0.70, 2024),
  ('camping_4_etoiles', 0.60, 2024),
  ('camping_3_etoiles', 0.55, 2024),
  ('camping_2_etoiles', 0.33, 2024),
  ('camping_1_etoile', 0.25, 2024),
  ('camping_non_classe', 0.25, 2024),
  ('village_vacances_4_5', 1.00, 2024),
  ('village_vacances_1_2_3', 0.90, 2024),
  ('auberge_jeunesse', 0.25, 2024),
  ('port_plaisance', 0.25, 2024),
  ('aire_camping_car', 0.25, 2024),
  ('autre_hebergement', 0.90, 2024);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE taxe_sejour_communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sejours_touristiques ENABLE ROW LEVEL SECURITY;
ALTER TABLE declarations_taxe_sejour ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifs_plafonds_taxe_sejour ENABLE ROW LEVEL SECURITY;

-- Communes: lecture publique (référentiel)
CREATE POLICY "Communes lisibles par tous" ON taxe_sejour_communes
  FOR SELECT USING (true);

-- Tarifs plafonds: lecture publique
CREATE POLICY "Tarifs plafonds lisibles par tous" ON tarifs_plafonds_taxe_sejour
  FOR SELECT USING (true);

-- Séjours: accès propriétaire uniquement
CREATE POLICY "Séjours visibles par propriétaire" ON sejours_touristiques
  FOR SELECT USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Séjours créables par propriétaire" ON sejours_touristiques
  FOR INSERT WITH CHECK (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Séjours modifiables par propriétaire" ON sejours_touristiques
  FOR UPDATE USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Séjours supprimables par propriétaire" ON sejours_touristiques
  FOR DELETE USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND declaration_id IS NULL -- Ne pas supprimer si déjà déclaré
  );

-- Déclarations: accès propriétaire uniquement
CREATE POLICY "Déclarations visibles par propriétaire" ON declarations_taxe_sejour
  FOR SELECT USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Déclarations créables par propriétaire" ON declarations_taxe_sejour
  FOR INSERT WITH CHECK (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Déclarations modifiables par propriétaire" ON declarations_taxe_sejour
  FOR UPDATE USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND statut NOT IN ('payee', 'validee') -- Pas de modification après paiement
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger updated_at
CREATE TRIGGER set_updated_at_taxe_sejour_communes
  BEFORE UPDATE ON taxe_sejour_communes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_sejours_touristiques
  BEFORE UPDATE ON sejours_touristiques
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_declarations_taxe_sejour
  BEFORE UPDATE ON declarations_taxe_sejour
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================
-- FONCTIONS RPC
-- ============================================

-- Calculer la taxe pour un séjour
CREATE OR REPLACE FUNCTION calculate_taxe_sejour(
  p_nuitees INTEGER,
  p_occupants JSONB,
  p_type_hebergement hebergement_touristique_type,
  p_code_insee VARCHAR(5) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_taux_unitaire NUMERIC(10,2);
  v_taux_additionnel NUMERIC(5,2) := 10.00;
  v_occupants_assujettis INTEGER := 0;
  v_occupants_exoneres INTEGER := 0;
  v_taxe_base NUMERIC(10,2);
  v_taxe_additionnelle NUMERIC(10,2);
  v_total NUMERIC(10,2);
  v_occupant JSONB;
BEGIN
  -- Récupérer le taux plafond par défaut
  SELECT tarif_plafond INTO v_taux_unitaire
  FROM tarifs_plafonds_taxe_sejour
  WHERE type_hebergement = p_type_hebergement;

  -- Si commune spécifiée, utiliser son taux
  IF p_code_insee IS NOT NULL THEN
    SELECT
      COALESCE((tarifs->>p_type_hebergement::text)::numeric, v_taux_unitaire),
      taxe_additionnelle_departementale
    INTO v_taux_unitaire, v_taux_additionnel
    FROM taxe_sejour_communes
    WHERE code_insee = p_code_insee
      AND taxe_active = true;
  END IF;

  -- Compter les occupants assujettis
  FOR v_occupant IN SELECT * FROM jsonb_array_elements(p_occupants)
  LOOP
    IF (v_occupant->>'est_mineur')::boolean = true
       OR v_occupant->>'exoneration' IS NOT NULL THEN
      v_occupants_exoneres := v_occupants_exoneres + 1;
    ELSE
      v_occupants_assujettis := v_occupants_assujettis + 1;
    END IF;
  END LOOP;

  -- Calcul
  v_taxe_base := p_nuitees * v_occupants_assujettis * v_taux_unitaire;
  v_taxe_additionnelle := v_taxe_base * (v_taux_additionnel / 100);
  v_total := v_taxe_base + v_taxe_additionnelle;

  RETURN jsonb_build_object(
    'nuitees', p_nuitees,
    'occupants_assujettis', v_occupants_assujettis,
    'occupants_exoneres', v_occupants_exoneres,
    'taux_unitaire', v_taux_unitaire,
    'taxe_base', ROUND(v_taxe_base, 2),
    'taux_additionnel_pct', v_taux_additionnel,
    'taxe_additionnelle', ROUND(v_taxe_additionnelle, 2),
    'total', ROUND(v_total, 2),
    'formule', p_nuitees || ' nuits × ' || v_occupants_assujettis || ' pers. × ' ||
               v_taux_unitaire || '€ = ' || ROUND(v_taxe_base, 2) || '€'
  );
END;
$$;

-- Récupérer les statistiques de taxe de séjour pour un propriétaire
CREATE OR REPLACE FUNCTION get_taxe_sejour_stats(
  p_owner_id UUID,
  p_annee INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH stats AS (
    SELECT
      COUNT(*) as nombre_sejours,
      COALESCE(SUM(nombre_nuitees), 0) as total_nuitees,
      COALESCE(SUM(nombre_occupants_assujettis), 0) as total_personnes,
      COALESCE(SUM(CASE WHEN taxe_collectee THEN montant_total ELSE 0 END), 0) as total_collecte,
      COALESCE(SUM(montant_total), 0) as total_a_reverser,
      COALESCE(SUM(CASE WHEN NOT taxe_collectee THEN montant_total ELSE 0 END), 0) as en_attente
    FROM sejours_touristiques
    WHERE owner_id = p_owner_id
      AND EXTRACT(YEAR FROM date_arrivee) = p_annee
  ),
  declarations AS (
    SELECT
      COUNT(*) FILTER (WHERE statut IN ('brouillon', 'a_declarer')) as en_cours,
      COUNT(*) FILTER (WHERE statut IN ('brouillon', 'a_declarer') AND date_limite < CURRENT_DATE) as en_retard
    FROM declarations_taxe_sejour
    WHERE owner_id = p_owner_id
      AND annee_fiscale = p_annee
  ),
  par_type AS (
    SELECT
      type_hebergement,
      SUM(nombre_nuitees) as nuitees,
      SUM(montant_total) as montant
    FROM sejours_touristiques
    WHERE owner_id = p_owner_id
      AND EXTRACT(YEAR FROM date_arrivee) = p_annee
    GROUP BY type_hebergement
  )
  SELECT jsonb_build_object(
    'periode', jsonb_build_object(
      'debut', p_annee || '-01-01',
      'fin', p_annee || '-12-31'
    ),
    'nombre_sejours', s.nombre_sejours,
    'total_nuitees', s.total_nuitees,
    'total_personnes', s.total_personnes,
    'total_taxe_collectee', s.total_collecte,
    'total_taxe_a_reverser', s.total_a_reverser,
    'taxe_en_attente', s.en_attente,
    'declarations_en_cours', d.en_cours,
    'declarations_en_retard', d.en_retard,
    'par_type_hebergement', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'type', type_hebergement,
        'nuitees', nuitees,
        'montant', montant
      )) FROM par_type),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM stats s, declarations d;

  RETURN v_result;
END;
$$;

-- Créer une déclaration avec les séjours de la période
CREATE OR REPLACE FUNCTION create_declaration_taxe_sejour(
  p_owner_id UUID,
  p_commune_config_id UUID,
  p_periode_debut DATE,
  p_periode_fin DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_declaration_id UUID;
  v_annee INTEGER;
  v_periode_ref VARCHAR(10);
  v_totaux RECORD;
  v_date_limite DATE;
  v_periodicite VARCHAR(20);
  v_jour_limite INTEGER;
BEGIN
  -- Récupérer la config commune
  SELECT periodicite_declaration, jour_limite_declaration
  INTO v_periodicite, v_jour_limite
  FROM taxe_sejour_communes
  WHERE id = p_commune_config_id;

  -- Calculer période de référence et date limite
  v_annee := EXTRACT(YEAR FROM p_periode_debut);

  IF v_periodicite = 'mensuelle' THEN
    v_periode_ref := TO_CHAR(p_periode_debut, 'YYYY-MM');
    v_date_limite := (DATE_TRUNC('month', p_periode_fin) + INTERVAL '1 month' + (v_jour_limite - 1) * INTERVAL '1 day')::date;
  ELSIF v_periodicite = 'trimestrielle' THEN
    v_periode_ref := v_annee || '-Q' || CEIL(EXTRACT(MONTH FROM p_periode_debut) / 3.0)::integer;
    v_date_limite := (DATE_TRUNC('quarter', p_periode_fin) + INTERVAL '3 months' + (v_jour_limite - 1) * INTERVAL '1 day')::date;
  ELSE -- annuelle
    v_periode_ref := v_annee::text;
    v_date_limite := MAKE_DATE(v_annee + 1, 1, v_jour_limite);
  END IF;

  -- Calculer les totaux des séjours de la période
  SELECT
    COALESCE(SUM(nombre_nuitees), 0),
    COALESCE(SUM(nombre_occupants_assujettis), 0),
    COALESCE(SUM(montant_taxe_collectee), 0),
    COALESCE(SUM(montant_taxe_additionnelle), 0),
    COALESCE(SUM(montant_total), 0)
  INTO v_totaux
  FROM sejours_touristiques
  WHERE owner_id = p_owner_id
    AND commune_config_id = p_commune_config_id
    AND date_arrivee >= p_periode_debut
    AND date_depart <= p_periode_fin
    AND declaration_id IS NULL
    AND taxe_collectee = true;

  -- Créer la déclaration
  INSERT INTO declarations_taxe_sejour (
    owner_id,
    commune_config_id,
    periode_debut,
    periode_fin,
    annee_fiscale,
    periode_reference,
    date_limite,
    total_nuitees,
    total_personnes_assujetties,
    montant_taxe_totale,
    montant_taxe_additionnelle,
    montant_total_a_reverser
  ) VALUES (
    p_owner_id,
    p_commune_config_id,
    p_periode_debut,
    p_periode_fin,
    v_annee,
    v_periode_ref,
    v_date_limite,
    v_totaux.sum,
    v_totaux.sum,
    v_totaux.sum,
    v_totaux.sum,
    v_totaux.sum
  )
  RETURNING id INTO v_declaration_id;

  -- Associer les séjours à cette déclaration
  UPDATE sejours_touristiques
  SET declaration_id = v_declaration_id
  WHERE owner_id = p_owner_id
    AND commune_config_id = p_commune_config_id
    AND date_arrivee >= p_periode_debut
    AND date_depart <= p_periode_fin
    AND declaration_id IS NULL
    AND taxe_collectee = true;

  RETURN v_declaration_id;
END;
$$;

-- ============================================
-- VUES
-- ============================================

-- Vue des séjours avec calculs
CREATE OR REPLACE VIEW v_sejours_touristiques_complets AS
SELECT
  s.*,
  l.type_bail,
  l.date_debut as bail_date_debut,
  l.date_fin as bail_date_fin,
  p.adresse_complete,
  p.code_postal as property_code_postal,
  p.ville,
  c.nom_commune,
  c.code_insee,
  c.taxe_additionnelle_departementale,
  CASE
    WHEN s.taxe_collectee THEN 'Collectée'
    WHEN s.date_depart < CURRENT_DATE THEN 'À collecter'
    ELSE 'En cours'
  END as statut_collecte,
  CASE
    WHEN s.declaration_id IS NOT NULL THEN 'Déclaré'
    WHEN s.taxe_collectee AND s.declaration_id IS NULL THEN 'À déclarer'
    ELSE 'En attente'
  END as statut_declaration
FROM sejours_touristiques s
JOIN leases l ON s.lease_id = l.id
JOIN properties p ON s.property_id = p.id
LEFT JOIN taxe_sejour_communes c ON s.commune_config_id = c.id;

-- Vue des déclarations en retard
CREATE OR REPLACE VIEW v_declarations_taxe_en_retard AS
SELECT
  d.*,
  c.nom_commune,
  c.code_insee,
  CURRENT_DATE - d.date_limite as jours_retard
FROM declarations_taxe_sejour d
JOIN taxe_sejour_communes c ON d.commune_config_id = c.id
WHERE d.statut IN ('brouillon', 'a_declarer')
  AND d.date_limite < CURRENT_DATE;

-- ============================================
-- DONNÉES INITIALES - Quelques communes exemple
-- ============================================

INSERT INTO taxe_sejour_communes (code_insee, nom_commune, code_postal, departement, tarifs, observations) VALUES
  ('75056', 'Paris', '75001', '75',
   '{"palace": 15.00, "hotel_5_etoiles": 5.00, "hotel_4_etoiles": 2.88, "hotel_3_etoiles": 1.70, "hotel_2_etoiles": 1.00, "meuble_tourisme_nc": 0.90}'::jsonb,
   'Déclaration via paris.fr - Numéro enregistrement obligatoire'),
  ('13055', 'Marseille', '13001', '13',
   '{"meuble_tourisme_nc": 0.83, "meuble_tourisme_1": 0.83, "meuble_tourisme_2": 0.94, "meuble_tourisme_3": 1.50}'::jsonb,
   'Déclaration via taxesejour-marseille.fr'),
  ('69123', 'Lyon', '69001', '69',
   '{"meuble_tourisme_nc": 0.88, "meuble_tourisme_3": 1.65, "meuble_tourisme_4": 2.50}'::jsonb,
   'Déclaration via lyon.fr'),
  ('06088', 'Nice', '06000', '06',
   '{"meuble_tourisme_nc": 0.90, "meuble_tourisme_3": 1.70, "meuble_tourisme_4": 2.88}'::jsonb,
   'Déclaration via nice.fr');

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON TABLE taxe_sejour_communes IS 'Configuration de la taxe de séjour par commune - Article L2333-26 CGCT';
COMMENT ON TABLE sejours_touristiques IS 'Séjours touristiques soumis à taxe de séjour';
COMMENT ON TABLE declarations_taxe_sejour IS 'Déclarations périodiques de taxe de séjour à reverser aux communes';
COMMENT ON TABLE tarifs_plafonds_taxe_sejour IS 'Référentiel des tarifs plafonds légaux par type d''hébergement';

COMMENT ON FUNCTION calculate_taxe_sejour IS 'Calcule le montant de taxe de séjour pour un séjour donné';
COMMENT ON FUNCTION get_taxe_sejour_stats IS 'Récupère les statistiques de taxe de séjour pour un propriétaire';
COMMENT ON FUNCTION create_declaration_taxe_sejour IS 'Crée une déclaration de taxe de séjour avec les séjours de la période';
