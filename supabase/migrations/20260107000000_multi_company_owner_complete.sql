-- Migration: 20260107000000_multi_company_owner_complete.sql
-- Description: Support complet multi-sociétés propriétaire, immeubles, assurances, permis de louer, DPE amélioré, Linky
-- Auteur: Claude Code
-- Date: 2026-01-07

-- ============================================
-- 1. ORGANISATIONS / SOCIÉTÉS (SCI, SARL, etc.)
-- ============================================
-- Permet à un propriétaire de gérer plusieurs entités juridiques
-- Style Rentila: Multi-propriétaire avec sélection lors création bien

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_profile_id UUID NOT NULL REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,

    -- Identification
    nom_entite TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'particulier',      -- Bien en nom propre
        'sci_ir',           -- SCI à l'IR (transparence fiscale)
        'sci_is',           -- SCI à l'IS (opaque fiscalement)
        'sarl_famille',     -- SARL de famille
        'sas',              -- SAS immobilière
        'indivision',       -- Indivision successorale ou achat conjoint
        'usufruit',         -- Démembrement: usufruitier
        'nue_propriete',    -- Démembrement: nu-propriétaire
        'lmnp',             -- LMNP (Loueur Meublé Non Professionnel)
        'lmp'               -- LMP (Loueur Meublé Professionnel)
    )),

    -- Informations légales
    siret TEXT,
    siren TEXT,
    tva_intracom TEXT,
    rcs_ville TEXT,
    capital_social DECIMAL(15, 2),
    date_creation DATE,

    -- Forme juridique détaillée
    forme_juridique TEXT, -- 'SCI', 'SARL', 'SAS', 'EURL', etc.
    objet_social TEXT,

    -- Coordonnées du siège
    adresse_siege TEXT,
    code_postal_siege TEXT,
    ville_siege TEXT,
    pays_siege TEXT DEFAULT 'France',

    -- Contact
    email_contact TEXT,
    telephone_contact TEXT,

    -- Bancaire (pour quittances et virements)
    iban TEXT,
    bic TEXT,
    banque_nom TEXT,
    titulaire_compte TEXT,

    -- Représentant légal
    representant_nom TEXT,
    representant_prenom TEXT,
    representant_fonction TEXT, -- 'Gérant', 'Président', etc.

    -- Associés (pour SCI notamment)
    associes JSONB DEFAULT '[]', -- [{nom, prenom, parts_pct, role}]

    -- Fiscalité
    regime_fiscal TEXT CHECK (regime_fiscal IN (
        'micro_foncier',        -- Revenus fonciers < 15000€
        'reel_simplifie',       -- Régime réel simplifié
        'reel_normal',          -- Régime réel normal
        'micro_bic',            -- LMNP micro-BIC
        'bic_reel',             -- LMNP/LMP réel
        'is'                    -- Impôt sur les sociétés
    )),
    tva_applicable BOOLEAN DEFAULT false,
    tva_taux DECIMAL(5, 3) DEFAULT 0.20,
    cfe_exonere BOOLEAN DEFAULT false, -- Cotisation Foncière des Entreprises

    -- Statut
    is_default BOOLEAN DEFAULT false, -- Organisation par défaut
    is_active BOOLEAN DEFAULT true,

    -- Métadonnées
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contraintes
    UNIQUE(owner_profile_id, nom_entite)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_organizations_siret ON organizations(siret) WHERE siret IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);
CREATE INDEX IF NOT EXISTS idx_organizations_default ON organizations(owner_profile_id, is_default) WHERE is_default = true;

-- Trigger updated_at
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their organizations"
    ON organizations FOR SELECT
    USING (owner_profile_id = (SELECT profile_id FROM owner_profiles WHERE profile_id = (
        SELECT id FROM profiles WHERE user_id = auth.uid()
    )));

CREATE POLICY "Owners can insert their organizations"
    ON organizations FOR INSERT
    WITH CHECK (owner_profile_id = (SELECT profile_id FROM owner_profiles WHERE profile_id = (
        SELECT id FROM profiles WHERE user_id = auth.uid()
    )));

CREATE POLICY "Owners can update their organizations"
    ON organizations FOR UPDATE
    USING (owner_profile_id = (SELECT profile_id FROM owner_profiles WHERE profile_id = (
        SELECT id FROM profiles WHERE user_id = auth.uid()
    )));

CREATE POLICY "Owners can delete their organizations"
    ON organizations FOR DELETE
    USING (owner_profile_id = (SELECT profile_id FROM owner_profiles WHERE profile_id = (
        SELECT id FROM profiles WHERE user_id = auth.uid()
    )) AND is_default = false);

-- ============================================
-- 2. IMMEUBLES (Regroupement de biens)
-- ============================================
-- Un immeuble regroupe plusieurs lots à la même adresse

CREATE TABLE IF NOT EXISTS buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    owner_profile_id UUID NOT NULL REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,

    -- Identification
    nom TEXT NOT NULL, -- "Résidence Les Oliviers", "Immeuble 12 rue de Paris"
    code_interne TEXT, -- Code propriétaire pour référence

    -- Adresse
    adresse TEXT NOT NULL,
    complement_adresse TEXT,
    code_postal TEXT NOT NULL,
    ville TEXT NOT NULL,
    departement TEXT,
    pays TEXT DEFAULT 'France',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Caractéristiques
    annee_construction INTEGER,
    nb_etages INTEGER,
    nb_lots_total INTEGER, -- Nombre total de lots dans l'immeuble
    nb_lots_proprio INTEGER, -- Nombre de lots appartenant au propriétaire
    surface_totale_m2 DECIMAL(10, 2),

    -- Type d'immeuble
    type_immeuble TEXT CHECK (type_immeuble IN (
        'residence',            -- Résidence classique
        'copropriete',          -- Copropriété avec syndic
        'mono_proprietaire',    -- Immeuble entier (1 seul proprio)
        'mixte',                -- Habitation + Commercial
        'bureaux',              -- Immeuble de bureaux
        'commercial'            -- Centre commercial / Galerie
    )),

    -- Copropriété (si applicable)
    syndic_nom TEXT,
    syndic_contact TEXT,
    syndic_email TEXT,
    syndic_telephone TEXT,
    numero_immatriculation_copro TEXT, -- Registre national des copropriétés
    tantieme_total INTEGER, -- Tantièmes totaux du propriétaire

    -- Équipements communs
    has_ascenseur BOOLEAN DEFAULT false,
    has_parking_commun BOOLEAN DEFAULT false,
    has_local_velo BOOLEAN DEFAULT false,
    has_local_poubelles BOOLEAN DEFAULT false,
    has_interphone BOOLEAN DEFAULT false,
    has_digicode BOOLEAN DEFAULT false,
    has_videosurveillance BOOLEAN DEFAULT false,

    -- Gardien / Concierge
    has_gardien BOOLEAN DEFAULT false,
    gardien_id UUID, -- Référence vers caretakers si applicable

    -- Assurance MRI (Multirisque Immeuble)
    assurance_mri_id UUID, -- Référence vers insurance_policies

    -- Métadonnées
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buildings_owner ON buildings(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_buildings_org ON buildings(organization_id);
CREATE INDEX IF NOT EXISTS idx_buildings_address ON buildings(code_postal, ville);

CREATE TRIGGER update_buildings_updated_at
    BEFORE UPDATE ON buildings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Buildings
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their buildings"
    ON buildings FOR ALL
    USING (owner_profile_id = (
        SELECT id FROM profiles WHERE user_id = auth.uid()
    ));

-- ============================================
-- 3. GARDIENS D'IMMEUBLE
-- ============================================

CREATE TABLE IF NOT EXISTS caretakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,

    -- Identité
    civilite TEXT CHECK (civilite IN ('M.', 'Mme', 'Mlle')),
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,

    -- Contact
    telephone TEXT,
    telephone_urgence TEXT,
    email TEXT,

    -- Logement de fonction
    has_logement_fonction BOOLEAN DEFAULT false,
    logement_etage TEXT,
    logement_porte TEXT,

    -- Horaires de présence
    horaires JSONB DEFAULT '{}', -- {lundi: {debut: "08:00", fin: "18:00"}, ...}
    jours_presence TEXT[], -- ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']

    -- Missions
    missions TEXT[] DEFAULT ARRAY[
        'entretien_parties_communes',
        'sortie_poubelles',
        'reception_colis',
        'surveillance',
        'petits_travaux'
    ],

    -- Contrat
    type_contrat TEXT CHECK (type_contrat IN ('cdi', 'cdd', 'prestataire', 'benevole')),
    date_debut_contrat DATE,
    date_fin_contrat DATE,
    employeur TEXT, -- 'syndic', 'proprietaire', 'prestataire'

    -- Statut
    is_active BOOLEAN DEFAULT true,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caretakers_building ON caretakers(building_id);

CREATE TRIGGER update_caretakers_updated_at
    BEFORE UPDATE ON caretakers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Caretakers (via buildings)
ALTER TABLE caretakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage caretakers via buildings"
    ON caretakers FOR ALL
    USING (building_id IN (
        SELECT id FROM buildings WHERE owner_profile_id = (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    ));

-- ============================================
-- 4. TAILLE DE BIEN (Studio, T1-T5+)
-- ============================================

-- Ajouter colonne taille_logement à properties
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS taille_logement TEXT CHECK (taille_logement IN (
        'studio',       -- Pièce unique avec coin cuisine
        'T1',           -- 1 pièce principale + cuisine séparée
        'T1_bis',       -- T1 avec alcôve/mezzanine
        'T2',           -- 2 pièces (1 chambre)
        'T3',           -- 3 pièces (2 chambres)
        'T4',           -- 4 pièces (3 chambres)
        'T5',           -- 5 pièces (4 chambres)
        'T6',           -- 6 pièces (5 chambres)
        'T7_plus',      -- 7 pièces et plus
        'loft',         -- Espace atypique ouvert
        'duplex',       -- Sur 2 niveaux
        'triplex',      -- Sur 3 niveaux
        'maison_plain_pied',    -- Maison de plain-pied
        'maison_etage',         -- Maison à étages
        'local_pro',    -- Local professionnel (pas de typologie)
        'autre'
    ));

-- Ajouter organization_id à properties
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Ajouter building_id à properties
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES buildings(id) ON DELETE SET NULL;

-- Index
CREATE INDEX IF NOT EXISTS idx_properties_organization ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_building ON properties(building_id);
CREATE INDEX IF NOT EXISTS idx_properties_taille ON properties(taille_logement);

-- ============================================
-- 5. SYSTÈME D'ASSURANCE
-- ============================================

-- Types d'assurance
CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Rattachement (un seul à la fois)
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    lease_id UUID REFERENCES leases(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    owner_profile_id UUID REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,

    -- Type d'assurance
    type_assurance TEXT NOT NULL CHECK (type_assurance IN (
        'pno',              -- Propriétaire Non Occupant
        'mri',              -- Multirisque Immeuble
        'habitation',       -- Assurance habitation locataire
        'loyers_impayes',   -- Garantie Loyers Impayés (GLI)
        'protection_juridique',
        'rc_proprietaire',  -- Responsabilité Civile Propriétaire
        'dommages_ouvrage'  -- Garantie décennale travaux
    )),

    -- Assureur
    assureur_nom TEXT NOT NULL,
    assureur_type TEXT CHECK (assureur_type IN (
        'traditionnel',     -- AXA, Allianz, etc.
        'digital',          -- Luko, Lovys, etc.
        'mutuelle',         -- MAIF, MACIF, etc.
        'courtier'          -- Via courtier
    )),

    -- Contrat
    numero_contrat TEXT,
    date_effet DATE NOT NULL,
    date_echeance DATE NOT NULL,
    date_resiliation DATE,

    -- Primes
    prime_annuelle DECIMAL(10, 2),
    prime_mensuelle DECIMAL(10, 2),
    periodicite_paiement TEXT CHECK (periodicite_paiement IN (
        'mensuelle', 'trimestrielle', 'semestrielle', 'annuelle'
    )),
    jour_prelevement INTEGER CHECK (jour_prelevement BETWEEN 1 AND 28),

    -- Garanties couvertes
    garanties JSONB DEFAULT '[]', -- [{nom, plafond, franchise}]
    franchise_generale DECIMAL(10, 2),
    plafond_general DECIMAL(15, 2),

    -- Documents
    attestation_document_id UUID REFERENCES documents(id),
    conditions_generales_document_id UUID REFERENCES documents(id),

    -- Contact assureur
    contact_nom TEXT,
    contact_telephone TEXT,
    contact_email TEXT,
    espace_client_url TEXT,

    -- Rappels
    rappel_echeance_jours INTEGER DEFAULT 30, -- Jours avant échéance pour rappel
    rappel_envoye BOOLEAN DEFAULT false,

    -- Statut
    statut TEXT DEFAULT 'active' CHECK (statut IN (
        'active', 'en_attente', 'resiliee', 'expiree', 'suspendue'
    )),

    -- Métadonnées
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contrainte: au moins un rattachement
    CONSTRAINT insurance_has_owner CHECK (
        property_id IS NOT NULL OR
        building_id IS NOT NULL OR
        lease_id IS NOT NULL OR
        organization_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_insurance_property ON insurance_policies(property_id);
CREATE INDEX IF NOT EXISTS idx_insurance_building ON insurance_policies(building_id);
CREATE INDEX IF NOT EXISTS idx_insurance_lease ON insurance_policies(lease_id);
CREATE INDEX IF NOT EXISTS idx_insurance_owner ON insurance_policies(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_echeance ON insurance_policies(date_echeance) WHERE statut = 'active';

CREATE TRIGGER update_insurance_policies_updated_at
    BEFORE UPDATE ON insurance_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Insurance
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their insurance policies"
    ON insurance_policies FOR ALL
    USING (owner_profile_id = (
        SELECT id FROM profiles WHERE user_id = auth.uid()
    ));

-- Rappels d'assurance
CREATE TABLE IF NOT EXISTS insurance_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insurance_policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN (
        'echeance',             -- Échéance contrat
        'attestation_manquante', -- Attestation locataire manquante
        'cotisation_due',       -- Cotisation à payer
        'renouvellement'        -- Renouvellement à confirmer
    )),
    reminder_date DATE NOT NULL,
    sent_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_reminders_policy ON insurance_reminders(insurance_policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_reminders_date ON insurance_reminders(reminder_date) WHERE sent_at IS NULL;

-- ============================================
-- 6. PERMIS DE LOUER
-- ============================================

-- Zones soumises au permis de louer
CREATE TABLE IF NOT EXISTS permis_louer_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Localisation
    commune TEXT NOT NULL,
    code_insee TEXT,
    code_postal TEXT NOT NULL,
    departement TEXT NOT NULL,
    region TEXT,

    -- Zone spécifique (quartier, secteur)
    zone_nom TEXT, -- "Quartier Gare", "Centre-ville", etc.
    zone_description TEXT,
    perimetre_geojson JSONB, -- GeoJSON du périmètre si disponible

    -- Réglementation
    type_obligation TEXT NOT NULL CHECK (type_obligation IN (
        'declaration',      -- Déclaration préalable (simple notification)
        'autorisation'      -- Autorisation préalable (inspection requise)
    )),

    -- Dates
    date_entree_vigueur DATE NOT NULL,
    date_fin_vigueur DATE, -- NULL si toujours en vigueur

    -- Détails réglementaires
    deliberation_reference TEXT, -- Référence délibération municipale
    lien_deliberation TEXT, -- URL vers la délibération
    duree_validite_mois INTEGER DEFAULT 24, -- Durée validité autorisation

    -- Documents requis
    documents_requis JSONB DEFAULT '[]', -- [{type, obligatoire, description}]

    -- Contact mairie
    mairie_service TEXT,
    mairie_adresse TEXT,
    mairie_telephone TEXT,
    mairie_email TEXT,
    mairie_url TEXT,

    -- Tarifs
    cout_dossier DECIMAL(10, 2) DEFAULT 0,

    -- Sanctions
    amende_non_declaration DECIMAL(10, 2) DEFAULT 5000,
    amende_recidive DECIMAL(10, 2) DEFAULT 15000,

    -- Statut
    is_active BOOLEAN DEFAULT true,
    derniere_verification DATE DEFAULT CURRENT_DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(code_postal, zone_nom)
);

CREATE INDEX IF NOT EXISTS idx_permis_zones_cp ON permis_louer_zones(code_postal);
CREATE INDEX IF NOT EXISTS idx_permis_zones_commune ON permis_louer_zones(commune);
CREATE INDEX IF NOT EXISTS idx_permis_zones_active ON permis_louer_zones(is_active) WHERE is_active = true;

-- Seed des zones connues (2026)
INSERT INTO permis_louer_zones (commune, code_postal, departement, type_obligation, date_entree_vigueur, zone_nom) VALUES
    ('Paris', '75001', '75', 'declaration', '2023-01-01', 'Tout Paris'),
    ('Paris', '75002', '75', 'declaration', '2023-01-01', 'Tout Paris'),
    ('Paris', '75003', '75', 'declaration', '2023-01-01', 'Tout Paris'),
    ('Paris', '75010', '75', 'declaration', '2023-01-01', 'Tout Paris'),
    ('Paris', '75011', '75', 'declaration', '2023-01-01', 'Tout Paris'),
    ('Paris', '75018', '75', 'declaration', '2023-01-01', 'Tout Paris'),
    ('Paris', '75019', '75', 'declaration', '2023-01-01', 'Tout Paris'),
    ('Paris', '75020', '75', 'declaration', '2023-01-01', 'Tout Paris'),
    ('Strasbourg', '67000', '67', 'autorisation', '2026-05-01', 'Quartier Gare'),
    ('Lille', '59000', '59', 'autorisation', '2022-01-01', 'Secteurs dégradés'),
    ('Marseille', '13001', '13', 'autorisation', '2022-06-01', 'Centre-ville'),
    ('Marseille', '13003', '13', 'autorisation', '2022-06-01', 'Quartiers Nord'),
    ('Lyon', '69001', '69', 'declaration', '2023-01-01', 'Presqu''île'),
    ('Roubaix', '59100', '59', 'autorisation', '2017-01-01', 'Ville entière'),
    ('Tourcoing', '59200', '59', 'autorisation', '2017-01-01', 'Ville entière'),
    ('Saint-Denis', '93200', '93', 'autorisation', '2020-01-01', 'Secteurs prioritaires'),
    ('Aubervilliers', '93300', '93', 'autorisation', '2020-01-01', 'Secteurs prioritaires'),
    ('Montreuil', '93100', '93', 'declaration', '2021-01-01', 'Secteurs identifiés')
ON CONFLICT (code_postal, zone_nom) DO NOTHING;

-- Conformité permis de louer par bien
CREATE TABLE IF NOT EXISTS property_permis_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Zone applicable
    permis_zone_id UUID REFERENCES permis_louer_zones(id),

    -- Statut
    permis_requis BOOLEAN DEFAULT false,
    permis_type TEXT CHECK (permis_type IN ('declaration', 'autorisation', 'non_requis')),

    -- Soumission
    date_soumission DATE,
    numero_dossier TEXT,
    numero_autorisation TEXT,

    -- Dates
    date_obtention DATE,
    date_expiration DATE, -- Pour les autorisations (généralement 2 ans)

    -- Documents fournis
    documents_soumis JSONB DEFAULT '[]', -- [{document_id, type, date_soumis}]
    documents_manquants TEXT[],

    -- Résultat
    statut TEXT DEFAULT 'non_verifie' CHECK (statut IN (
        'non_verifie',      -- Pas encore vérifié
        'non_requis',       -- Zone non soumise
        'en_cours',         -- Dossier en cours
        'approuve',         -- Autorisation obtenue
        'refuse',           -- Refus (avec motif)
        'expire',           -- Autorisation expirée
        'a_renouveler'      -- À renouveler (< 90 jours)
    )),
    motif_refus TEXT,

    -- Inspection (pour autorisations)
    date_inspection DATE,
    rapport_inspection_document_id UUID REFERENCES documents(id),

    -- Rappels
    rappel_expiration_envoye BOOLEAN DEFAULT false,

    -- Métadonnées
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(property_id)
);

CREATE INDEX IF NOT EXISTS idx_permis_compliance_property ON property_permis_compliance(property_id);
CREATE INDEX IF NOT EXISTS idx_permis_compliance_statut ON property_permis_compliance(statut);
CREATE INDEX IF NOT EXISTS idx_permis_compliance_expiration ON property_permis_compliance(date_expiration)
    WHERE statut = 'approuve';

CREATE TRIGGER update_property_permis_compliance_updated_at
    BEFORE UPDATE ON property_permis_compliance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Permis compliance
ALTER TABLE property_permis_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their permis compliance"
    ON property_permis_compliance FOR ALL
    USING (property_id IN (
        SELECT id FROM properties WHERE owner_id = (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    ));

-- RLS Permis zones (lecture publique)
ALTER TABLE permis_louer_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view permis zones"
    ON permis_louer_zones FOR SELECT
    USING (true);

-- ============================================
-- 7. DPE AMÉLIORÉ
-- ============================================

-- Ajouter les champs DPE avancés à properties
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS dpe_numero VARCHAR(13), -- Numéro ADEME 13 caractères
    ADD COLUMN IF NOT EXISTS dpe_date_realisation DATE,
    ADD COLUMN IF NOT EXISTS dpe_date_validite DATE,
    ADD COLUMN IF NOT EXISTS dpe_diagnostiqueur TEXT,
    ADD COLUMN IF NOT EXISTS dpe_diagnostiqueur_certif TEXT,
    ADD COLUMN IF NOT EXISTS dpe_consommation_energie DECIMAL(10, 2), -- kWh/m²/an
    ADD COLUMN IF NOT EXISTS dpe_estimation_ges DECIMAL(10, 2), -- kgCO2/m²/an
    ADD COLUMN IF NOT EXISTS dpe_cout_energie_min DECIMAL(10, 2), -- €/an
    ADD COLUMN IF NOT EXISTS dpe_cout_energie_max DECIMAL(10, 2), -- €/an
    ADD COLUMN IF NOT EXISTS dpe_qr_code TEXT, -- Code QR pour vérification
    ADD COLUMN IF NOT EXISTS dpe_is_verified BOOLEAN DEFAULT false, -- Vérifié via API ADEME
    ADD COLUMN IF NOT EXISTS dpe_verification_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dpe_document_id UUID REFERENCES documents(id),
    ADD COLUMN IF NOT EXISTS dpe_methode TEXT CHECK (dpe_methode IN ('3CL', 'facture', 'DPE_vierge'));

-- Classe énergie pour restriction location
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS dpe_classe_energie TEXT CHECK (dpe_classe_energie IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
    ADD COLUMN IF NOT EXISTS dpe_classe_ges TEXT CHECK (dpe_classe_ges IN ('A', 'B', 'C', 'D', 'E', 'F', 'G'));

-- Index pour expiration DPE
CREATE INDEX IF NOT EXISTS idx_properties_dpe_validite ON properties(dpe_date_validite)
    WHERE dpe_date_validite IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_dpe_classe ON properties(dpe_classe_energie);

-- Autres diagnostics obligatoires
CREATE TABLE IF NOT EXISTS property_diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Type de diagnostic
    type_diagnostic TEXT NOT NULL CHECK (type_diagnostic IN (
        'dpe',                  -- Performance énergétique
        'amiante',              -- État amiante (avant 1997)
        'plomb',                -- CREP (avant 1949)
        'electricite',          -- Diagnostic électricité (>15 ans)
        'gaz',                  -- Diagnostic gaz (>15 ans)
        'termites',             -- État termites (zones à risque)
        'erp',                  -- État des Risques et Pollutions
        'assainissement',       -- Diagnostic assainissement
        'merule',               -- Mérule (zones à risque)
        'bruit',                -- État des nuisances sonores (aéroport)
        'carrez',               -- Mesurage loi Carrez
        'boutin'                -- Surface habitable
    )),

    -- Réalisation
    date_realisation DATE NOT NULL,
    date_validite DATE,
    numero_rapport TEXT,

    -- Diagnostiqueur
    diagnostiqueur_nom TEXT,
    diagnostiqueur_societe TEXT,
    diagnostiqueur_certification TEXT,
    diagnostiqueur_assurance TEXT,

    -- Résultat
    resultat TEXT, -- 'conforme', 'non_conforme', 'presence', 'absence', etc.
    observations TEXT,

    -- Document
    document_id UUID REFERENCES documents(id),

    -- Statut
    is_valid BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(property_id, type_diagnostic)
);

CREATE INDEX IF NOT EXISTS idx_diagnostics_property ON property_diagnostics(property_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_validite ON property_diagnostics(date_validite) WHERE is_valid = true;

CREATE TRIGGER update_property_diagnostics_updated_at
    BEFORE UPDATE ON property_diagnostics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Diagnostics
ALTER TABLE property_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their diagnostics"
    ON property_diagnostics FOR ALL
    USING (property_id IN (
        SELECT id FROM properties WHERE owner_id = (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    ));

-- ============================================
-- 8. COMPTEURS / LINKY
-- ============================================

CREATE TABLE IF NOT EXISTS property_meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Type de compteur
    type_compteur TEXT NOT NULL CHECK (type_compteur IN (
        'electricite',
        'gaz',
        'eau_froide',
        'eau_chaude',
        'chauffage'         -- Compteur individuel chauffage collectif
    )),

    -- Identification
    numero_compteur TEXT, -- Numéro sur le compteur
    prm TEXT, -- Point Référence Mesure (Linky, 14 chiffres)
    pce TEXT, -- Point de Comptage et d'Estimation (Gaz)
    pdl TEXT, -- Point De Livraison (ancien format élec)

    -- Type de compteur électrique
    type_compteur_elec TEXT CHECK (type_compteur_elec IN (
        'linky',            -- Compteur communicant Enedis
        'electronique',     -- Compteur électronique non communicant
        'electromecanique', -- Ancien compteur à disque
        'inconnu'
    )),

    -- Localisation
    emplacement TEXT, -- "Tableau électrique entrée", "Palier 2ème étage", etc.
    etage TEXT,
    acces_notes TEXT, -- Notes pour relève

    -- Puissance (électricité)
    puissance_souscrite INTEGER, -- kVA
    option_tarifaire TEXT CHECK (option_tarifaire IN (
        'base',
        'hp_hc',            -- Heures Pleines / Heures Creuses
        'tempo',
        'ejp'
    )),

    -- Dernier relevé
    dernier_releve_date DATE,
    dernier_releve_index INTEGER,
    dernier_releve_index_hp INTEGER, -- Heures pleines
    dernier_releve_index_hc INTEGER, -- Heures creuses

    -- Fournisseur (informatif, pas le gestionnaire réseau)
    fournisseur_actuel TEXT, -- EDF, Engie, TotalEnergies, etc.
    contrat_locataire BOOLEAN DEFAULT true, -- Contrat au nom du locataire?

    -- Enedis Data Connect (si consentement)
    enedis_consent BOOLEAN DEFAULT false,
    enedis_consent_date TIMESTAMPTZ,
    enedis_access_token TEXT,
    enedis_refresh_token TEXT,
    enedis_token_expiry TIMESTAMPTZ,
    last_sync_date TIMESTAMPTZ,

    -- Métadonnées
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meters_property ON property_meters(property_id);
CREATE INDEX IF NOT EXISTS idx_meters_prm ON property_meters(prm) WHERE prm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meters_type ON property_meters(type_compteur);

CREATE TRIGGER update_property_meters_updated_at
    BEFORE UPDATE ON property_meters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Historique des relevés
CREATE TABLE IF NOT EXISTS meter_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES property_meters(id) ON DELETE CASCADE,
    lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,

    -- Date et type de relevé
    date_releve DATE NOT NULL,
    type_releve TEXT NOT NULL CHECK (type_releve IN (
        'entree',           -- État des lieux d'entrée
        'sortie',           -- État des lieux de sortie
        'periodique',       -- Relevé périodique
        'estimation',       -- Estimation fournisseur
        'auto',             -- Auto-relevé locataire
        'telereleve'        -- Télérelève (Linky)
    )),

    -- Valeurs
    index_kwh INTEGER,          -- Index principal
    index_hp INTEGER,           -- Heures pleines
    index_hc INTEGER,           -- Heures creuses
    index_m3 INTEGER,           -- Pour gaz/eau

    -- Consommation calculée
    consommation_depuis_dernier DECIMAL(10, 2),

    -- Source
    source TEXT CHECK (source IN (
        'manuel',           -- Saisi manuellement
        'enedis_api',       -- Via API Enedis
        'grdf_api',         -- Via API GRDF
        'photo',            -- Via photo du compteur
        'fournisseur'       -- Via facture fournisseur
    )),

    -- Photo preuve
    photo_document_id UUID REFERENCES documents(id),

    -- Qui a fait le relevé
    releve_par_profile_id UUID REFERENCES profiles(id),

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_readings_meter ON meter_readings(meter_id);
CREATE INDEX IF NOT EXISTS idx_readings_date ON meter_readings(date_releve);
CREATE INDEX IF NOT EXISTS idx_readings_lease ON meter_readings(lease_id);

-- RLS Meters
ALTER TABLE property_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their meters"
    ON property_meters FOR ALL
    USING (property_id IN (
        SELECT id FROM properties WHERE owner_id = (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Owners and tenants can view readings"
    ON meter_readings FOR SELECT
    USING (
        meter_id IN (
            SELECT pm.id FROM property_meters pm
            JOIN properties p ON pm.property_id = p.id
            WHERE p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
        OR
        lease_id IN (
            SELECT ls.lease_id FROM lease_signers ls
            WHERE ls.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Owners can insert readings"
    ON meter_readings FOR INSERT
    WITH CHECK (
        meter_id IN (
            SELECT pm.id FROM property_meters pm
            JOIN properties p ON pm.property_id = p.id
            WHERE p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    );

-- ============================================
-- 9. AMÉLIORATIONS BAIL
-- ============================================

-- Date de prélèvement configurable
ALTER TABLE leases
    ADD COLUMN IF NOT EXISTS jour_prelevement INTEGER DEFAULT 5 CHECK (jour_prelevement BETWEEN 1 AND 28),
    ADD COLUMN IF NOT EXISTS mode_paiement_prefere TEXT CHECK (mode_paiement_prefere IN (
        'prelevement',      -- Prélèvement automatique
        'virement',         -- Virement manuel
        'cheque',           -- Chèque
        'especes',          -- Espèces (légal jusqu'à 1000€)
        'cb'                -- Carte bancaire
    ));

-- Clause résolutoire améliorée
ALTER TABLE leases
    ADD COLUMN IF NOT EXISTS clause_resolutoire JSONB DEFAULT '{
        "delai_commandement_jours": 30,
        "delai_paiement_apres_commandement_jours": 60,
        "montant_minimum_impaye_euros": null,
        "clause_penale_pct": 10,
        "interets_retard_pct": null,
        "frais_recouvrement_euros": null,
        "exclusion_treve_hivernale": false,
        "procedure_automatique": true
    }';

-- Documents bail existant (pour import)
ALTER TABLE leases
    ADD COLUMN IF NOT EXISTS bail_importe BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS bail_original_document_id UUID REFERENCES documents(id),
    ADD COLUMN IF NOT EXISTS bail_signe_electroniquement BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS bail_notarie BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS notaire_nom TEXT,
    ADD COLUMN IF NOT EXISTS notaire_office TEXT,
    ADD COLUMN IF NOT EXISTS notaire_reference TEXT;

-- Type de bail commercial amélioré
ALTER TABLE leases
    ADD COLUMN IF NOT EXISTS bail_commercial_details JSONB DEFAULT NULL;
    -- Structure: {
    --   "activite_autorisee": "Commerce de détail",
    --   "destination_clause": "...",
    --   "droit_au_bail_montant": 50000,
    --   "pas_de_porte_montant": null,
    --   "franchise_loyer_mois": 3,
    --   "paliers_loyer": [{mois: 12, loyer: 1000}, {mois: 24, loyer: 1200}],
    --   "charges_refacturables": ["taxe_fonciere", "assurance"],
    --   "travaux_locataire_autorises": true
    -- }

-- Index
CREATE INDEX IF NOT EXISTS idx_leases_jour_prelevement ON leases(jour_prelevement);

-- ============================================
-- 10. PROFIL PROPRIÉTAIRE COMPLET
-- ============================================

-- Compléter owner_profiles
ALTER TABLE owner_profiles
    ADD COLUMN IF NOT EXISTS civilite TEXT CHECK (civilite IN ('M.', 'Mme', 'Mlle')),
    ADD COLUMN IF NOT EXISTS nom_naissance TEXT,
    ADD COLUMN IF NOT EXISTS lieu_naissance TEXT,
    ADD COLUMN IF NOT EXISTS nationalite TEXT DEFAULT 'Française',
    ADD COLUMN IF NOT EXISTS adresse_personnelle TEXT,
    ADD COLUMN IF NOT EXISTS code_postal_personnel TEXT,
    ADD COLUMN IF NOT EXISTS ville_personnelle TEXT,
    ADD COLUMN IF NOT EXISTS pays_personnel TEXT DEFAULT 'France',
    ADD COLUMN IF NOT EXISTS telephone_fixe TEXT,
    ADD COLUMN IF NOT EXISTS telephone_mobile TEXT,
    ADD COLUMN IF NOT EXISTS email_secondaire TEXT,
    ADD COLUMN IF NOT EXISTS profession TEXT,
    ADD COLUMN IF NOT EXISTS situation_familiale TEXT CHECK (situation_familiale IN (
        'celibataire', 'marie', 'pacse', 'divorce', 'veuf', 'union_libre'
    )),
    ADD COLUMN IF NOT EXISTS regime_matrimonial TEXT CHECK (regime_matrimonial IN (
        'communaute_reduite_acquets',
        'communaute_universelle',
        'separation_biens',
        'participation_acquets'
    )),
    ADD COLUMN IF NOT EXISTS conjoint_nom TEXT,
    ADD COLUMN IF NOT EXISTS conjoint_prenom TEXT,
    ADD COLUMN IF NOT EXISTS conjoint_accepte_caution BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS preferences_communication JSONB DEFAULT '{"email": true, "sms": true, "push": true}',
    ADD COLUMN IF NOT EXISTS onboarding_multi_societe_complete BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS date_derniere_connexion TIMESTAMPTZ;

-- ============================================
-- 11. FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour vérifier si un bien nécessite un permis de louer
CREATE OR REPLACE FUNCTION check_permis_louer_required(p_code_postal TEXT)
RETURNS TABLE (
    required BOOLEAN,
    zone_id UUID,
    type_obligation TEXT,
    commune TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        true AS required,
        plz.id AS zone_id,
        plz.type_obligation,
        plz.commune
    FROM permis_louer_zones plz
    WHERE plz.code_postal = p_code_postal
    AND plz.is_active = true
    AND (plz.date_fin_vigueur IS NULL OR plz.date_fin_vigueur > CURRENT_DATE)
    LIMIT 1;

    -- Si aucune zone trouvée, retourner non requis
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction pour vérifier éligibilité location selon DPE
CREATE OR REPLACE FUNCTION check_dpe_rental_eligibility(p_classe_energie TEXT)
RETURNS TABLE (
    eligible BOOLEAN,
    reason TEXT,
    future_restriction_date DATE
) AS $$
BEGIN
    IF p_classe_energie = 'G' THEN
        RETURN QUERY SELECT
            false,
            'Les logements classés G sont interdits à la location depuis le 1er janvier 2025'::TEXT,
            NULL::DATE;
    ELSIF p_classe_energie = 'F' THEN
        RETURN QUERY SELECT
            true,
            'Attention: location interdite à partir du 1er janvier 2028'::TEXT,
            '2028-01-01'::DATE;
    ELSIF p_classe_energie = 'E' THEN
        RETURN QUERY SELECT
            true,
            'Attention: location interdite à partir du 1er janvier 2034'::TEXT,
            '2034-01-01'::DATE;
    ELSE
        RETURN QUERY SELECT true, NULL::TEXT, NULL::DATE;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour créer l'organisation par défaut d'un propriétaire
CREATE OR REPLACE FUNCTION create_default_organization()
RETURNS TRIGGER AS $$
DECLARE
    v_nom TEXT;
    v_prenom TEXT;
BEGIN
    -- Récupérer nom/prénom du profil
    SELECT nom, prenom INTO v_nom, v_prenom
    FROM profiles WHERE id = NEW.profile_id;

    -- Créer l'organisation par défaut (bien en nom propre)
    INSERT INTO organizations (
        owner_profile_id,
        nom_entite,
        type,
        is_default
    ) VALUES (
        NEW.profile_id,
        COALESCE(v_prenom || ' ' || v_nom, 'Nom propre'),
        'particulier',
        true
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer organisation par défaut
DROP TRIGGER IF EXISTS create_default_organization_trigger ON owner_profiles;
CREATE TRIGGER create_default_organization_trigger
    AFTER INSERT ON owner_profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_default_organization();

-- ============================================
-- 12. MIGRATION DES DONNÉES EXISTANTES
-- ============================================

-- Créer les organisations par défaut pour les propriétaires existants
DO $$
DECLARE
    r RECORD;
    v_nom TEXT;
    v_prenom TEXT;
BEGIN
    FOR r IN
        SELECT op.profile_id
        FROM owner_profiles op
        WHERE NOT EXISTS (
            SELECT 1 FROM organizations o WHERE o.owner_profile_id = op.profile_id
        )
    LOOP
        SELECT nom, prenom INTO v_nom, v_prenom
        FROM profiles WHERE id = r.profile_id;

        INSERT INTO organizations (
            owner_profile_id,
            nom_entite,
            type,
            is_default
        ) VALUES (
            r.profile_id,
            COALESCE(v_prenom || ' ' || v_nom, 'Nom propre'),
            'particulier',
            true
        )
        ON CONFLICT (owner_profile_id, nom_entite) DO NOTHING;
    END LOOP;
END;
$$;

-- Associer les biens existants à leur organisation par défaut
UPDATE properties p
SET organization_id = (
    SELECT o.id FROM organizations o
    WHERE o.owner_profile_id = p.owner_id
    AND o.is_default = true
    LIMIT 1
)
WHERE p.organization_id IS NULL;

-- ============================================
-- 13. VUES UTILES
-- ============================================

-- Vue des biens avec infos organisation et immeuble
CREATE OR REPLACE VIEW v_properties_extended AS
SELECT
    p.*,
    o.nom_entite AS organization_nom,
    o.type AS organization_type,
    o.siret AS organization_siret,
    b.nom AS building_nom,
    b.adresse AS building_adresse,
    c.nom AS gardien_nom,
    c.telephone AS gardien_telephone,
    ppc.statut AS permis_statut,
    ppc.date_expiration AS permis_expiration
FROM properties p
LEFT JOIN organizations o ON p.organization_id = o.id
LEFT JOIN buildings b ON p.building_id = b.id
LEFT JOIN caretakers c ON b.gardien_id = c.id AND c.is_active = true
LEFT JOIN property_permis_compliance ppc ON p.id = ppc.property_id;

-- Vue des assurances à renouveler
CREATE OR REPLACE VIEW v_insurance_expiring AS
SELECT
    ip.*,
    p.adresse_complete AS property_adresse,
    b.nom AS building_nom,
    EXTRACT(DAY FROM ip.date_echeance - CURRENT_DATE) AS jours_avant_echeance
FROM insurance_policies ip
LEFT JOIN properties p ON ip.property_id = p.id
LEFT JOIN buildings b ON ip.building_id = b.id
WHERE ip.statut = 'active'
AND ip.date_echeance BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days';

-- Vue des permis de louer à renouveler
CREATE OR REPLACE VIEW v_permis_expiring AS
SELECT
    ppc.*,
    p.adresse_complete,
    p.owner_id,
    plz.commune,
    plz.type_obligation,
    EXTRACT(DAY FROM ppc.date_expiration - CURRENT_DATE) AS jours_avant_expiration
FROM property_permis_compliance ppc
JOIN properties p ON ppc.property_id = p.id
LEFT JOIN permis_louer_zones plz ON ppc.permis_zone_id = plz.id
WHERE ppc.statut = 'approuve'
AND ppc.date_expiration BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days';

-- ============================================
-- 14. COMMENTAIRES POUR DOCUMENTATION
-- ============================================

COMMENT ON TABLE organizations IS 'Entités juridiques des propriétaires (SCI, SARL, nom propre, etc.)';
COMMENT ON TABLE buildings IS 'Immeubles regroupant plusieurs biens à la même adresse';
COMMENT ON TABLE caretakers IS 'Gardiens/concierges d''immeubles';
COMMENT ON TABLE insurance_policies IS 'Polices d''assurance (PNO, MRI, habitation, GLI)';
COMMENT ON TABLE permis_louer_zones IS 'Zones géographiques soumises au permis de louer';
COMMENT ON TABLE property_permis_compliance IS 'Conformité permis de louer par bien';
COMMENT ON TABLE property_diagnostics IS 'Diagnostics immobiliers obligatoires (hors DPE stocké dans properties)';
COMMENT ON TABLE property_meters IS 'Compteurs (électricité, gaz, eau) des biens';
COMMENT ON TABLE meter_readings IS 'Historique des relevés de compteurs';

COMMENT ON COLUMN properties.taille_logement IS 'Typologie du logement (Studio, T1, T2, etc.)';
COMMENT ON COLUMN properties.organization_id IS 'Société/entité propriétaire du bien';
COMMENT ON COLUMN properties.building_id IS 'Immeuble contenant le bien (si applicable)';
COMMENT ON COLUMN properties.dpe_numero IS 'Numéro ADEME du DPE (13 caractères)';
COMMENT ON COLUMN properties.dpe_is_verified IS 'DPE vérifié via API ADEME';

COMMENT ON COLUMN leases.jour_prelevement IS 'Jour du mois pour le prélèvement du loyer (1-28)';
COMMENT ON COLUMN leases.clause_resolutoire IS 'Paramètres de la clause résolutoire (délais, pénalités)';
COMMENT ON COLUMN leases.bail_importe IS 'Bail importé (existant avant utilisation de la plateforme)';
COMMENT ON COLUMN leases.bail_notarie IS 'Bail rédigé par un notaire';
