  -- Document
  document_id UUID REFERENCES documents(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_erp_dom_tom_property ON erp_dom_tom(property_id);
CREATE INDEX idx_erp_dom_tom_departement ON erp_dom_tom(departement);
CREATE INDEX idx_erp_dom_tom_validite ON erp_dom_tom(date_validite);

-- ============================================
-- TABLE: dom_referentiel
-- Référentiel des DOM et leurs caractéristiques
-- ============================================
CREATE TABLE dom_referentiel (
  departement VARCHAR(3) PRIMARY KEY CHECK (departement IN ('971', '972', '973', '974', '976')),

  nom VARCHAR(100) NOT NULL,
  region VARCHAR(100) NOT NULL,
  chef_lieu VARCHAR(100) NOT NULL,
  fuseau_horaire VARCHAR(50) NOT NULL,

  -- Risques
  risques_specifiques risque_naturel_dom[] NOT NULL,
  zone_sismique INTEGER NOT NULL CHECK (zone_sismique BETWEEN 1 AND 5),
  zone_cyclonique BOOLEAN NOT NULL DEFAULT false,
  zone_volcanique BOOLEAN NOT NULL DEFAULT false,
  volcan_actif VARCHAR(100),

  -- Obligations
  termites_obligatoire BOOLEAN NOT NULL DEFAULT true,
  normes_paracycloniques BOOLEAN NOT NULL DEFAULT false,
  normes_parasismiques BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Données de référence DOM
INSERT INTO dom_referentiel (departement, nom, region, chef_lieu, fuseau_horaire, risques_specifiques, zone_sismique, zone_cyclonique, zone_volcanique, volcan_actif, normes_paracycloniques, normes_parasismiques) VALUES
  ('971', 'Guadeloupe', 'Guadeloupe', 'Basse-Terre', 'America/Guadeloupe',
   ARRAY['cyclone', 'seisme', 'volcan', 'tsunami', 'inondation', 'mouvement_terrain']::risque_naturel_dom[],
   5, true, true, 'La Soufrière', true, true),
  ('972', 'Martinique', 'Martinique', 'Fort-de-France', 'America/Martinique',
   ARRAY['cyclone', 'seisme', 'volcan', 'tsunami', 'inondation', 'mouvement_terrain']::risque_naturel_dom[],
   5, true, true, 'Montagne Pelée', true, true),
  ('973', 'Guyane', 'Guyane', 'Cayenne', 'America/Cayenne',
   ARRAY['inondation', 'mouvement_terrain', 'feu_foret']::risque_naturel_dom[],
   2, false, false, NULL, false, false),
  ('974', 'La Réunion', 'La Réunion', 'Saint-Denis', 'Indian/Reunion',
   ARRAY['cyclone', 'seisme', 'volcan', 'tsunami', 'inondation', 'mouvement_terrain', 'erosion_cotiere']::risque_naturel_dom[],
   4, true, true, 'Piton de la Fournaise', true, true),
  ('976', 'Mayotte', 'Mayotte', 'Mamoudzou', 'Indian/Mayotte',
   ARRAY['cyclone', 'seisme', 'tsunami', 'inondation', 'mouvement_terrain', 'volcan']::risque_naturel_dom[],
   4, true, true, 'Volcan sous-marin Fani Maoré', true, true);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE diagnostics_termites ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics_termites_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_dom_tom ENABLE ROW LEVEL SECURITY;
ALTER TABLE dom_referentiel ENABLE ROW LEVEL SECURITY;

-- Référentiel DOM: lecture publique
CREATE POLICY "Référentiel DOM lisible par tous" ON dom_referentiel
  FOR SELECT USING (true);

-- Diagnostics termites: accès propriétaire
CREATE POLICY "Diagnostics termites visibles par propriétaire" ON diagnostics_termites
  FOR SELECT USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Diagnostics termites créables par propriétaire" ON diagnostics_termites
  FOR INSERT WITH CHECK (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Diagnostics termites modifiables par propriétaire" ON diagnostics_termites
  FOR UPDATE USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Zones termites: accès via diagnostic parent
CREATE POLICY "Zones termites visibles si diagnostic visible" ON diagnostics_termites_zones
  FOR SELECT USING (
    diagnostic_id IN (
      SELECT id FROM diagnostics_termites
      WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Zones termites créables si diagnostic propriétaire" ON diagnostics_termites_zones
  FOR INSERT WITH CHECK (
    diagnostic_id IN (
      SELECT id FROM diagnostics_termites
      WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- ERP DOM: accès propriétaire
CREATE POLICY "ERP DOM visibles par propriétaire" ON erp_dom_tom
  FOR SELECT USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "ERP DOM créables par propriétaire" ON erp_dom_tom
  FOR INSERT WITH CHECK (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "ERP DOM modifiables par propriétaire" ON erp_dom_tom
  FOR UPDATE USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER set_updated_at_diagnostics_termites
  BEFORE UPDATE ON diagnostics_termites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_erp_dom_tom
  BEFORE UPDATE ON erp_dom_tom
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================
-- FONCTIONS RPC
-- ============================================

-- Vérifie si un diagnostic termites est requis pour un bien
CREATE OR REPLACE FUNCTION is_termites_required(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_departement VARCHAR(3);
BEGIN
  SELECT departement INTO v_departement
  FROM properties
  WHERE id = p_property_id;

  -- Tous les DOM nécessitent un diagnostic termites
  IF v_departement IN ('971', '972', '973', '974', '976') THEN
    RETURN true;
  END IF;

  -- En métropole, vérifier si zone à arrêté préfectoral
  -- (non implémenté - retourne false par défaut)
  RETURN false;
END;
$$;

-- Vérifie si un diagnostic termites est valide pour un bien
CREATE OR REPLACE FUNCTION is_termites_valid(p_property_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_diagnostic diagnostics_termites%ROWTYPE;
  v_valid BOOLEAN;
  v_message TEXT;
BEGIN
  -- Récupérer le diagnostic le plus récent
  SELECT * INTO v_diagnostic
  FROM diagnostics_termites
  WHERE property_id = p_property_id
  ORDER BY date_diagnostic DESC
  LIMIT 1;

  IF v_diagnostic IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'exists', false,
      'message', 'Aucun diagnostic termites trouvé'
    );
  END IF;

  v_valid := v_diagnostic.date_validite >= CURRENT_DATE;

  IF v_valid THEN
    v_message := 'Diagnostic valide jusqu''au ' || v_diagnostic.date_validite::text;
  ELSE
    v_message := 'Diagnostic expiré depuis le ' || v_diagnostic.date_validite::text;
  END IF;

  RETURN jsonb_build_object(
    'valid', v_valid,
    'exists', true,
    'diagnostic_id', v_diagnostic.id,
    'date_diagnostic', v_diagnostic.date_diagnostic,
    'date_validite', v_diagnostic.date_validite,
    'conclusion', v_diagnostic.conclusion,
    'presence_active', v_diagnostic.presence_active,
    'message', v_message
  );
END;
$$;

-- Récupère les diagnostics obligatoires pour un bien DOM
CREATE OR REPLACE FUNCTION get_diagnostics_obligatoires_dom(
  p_property_id UUID,
  p_is_vente BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_departement VARCHAR(3);
  v_dom_info dom_referentiel%ROWTYPE;
  v_diagnostics JSONB := '[]'::jsonb;
BEGIN
  -- Récupérer le département du bien
  SELECT departement INTO v_departement
  FROM properties
  WHERE id = p_property_id;

  IF v_departement NOT IN ('971', '972', '973', '974', '976') THEN
    RETURN jsonb_build_object(
      'is_dom', false,
      'diagnostics', '[]'::jsonb
    );
  END IF;

  -- Récupérer les infos du DOM
  SELECT * INTO v_dom_info
  FROM dom_referentiel
  WHERE departement = v_departement;

  -- Construire la liste des diagnostics
  v_diagnostics := v_diagnostics || jsonb_build_object(
    'type', 'termites',
    'nom', 'Diagnostic termites (état parasitaire)',
    'obligatoire', true,
    'validite_mois', 6,
    'specificite', 'Espèces tropicales agressives'
  );

  v_diagnostics := v_diagnostics || jsonb_build_object(
    'type', 'erp',
    'nom', 'État des Risques et Pollutions DOM',
    'obligatoire', true,
    'validite_mois', 6,
    'risques', v_dom_info.risques_specifiques
  );

  IF v_dom_info.normes_paracycloniques THEN
    v_diagnostics := v_diagnostics || jsonb_build_object(
      'type', 'paracyclonique',
      'nom', 'Attestation normes paracycloniques',
      'obligatoire', true,
      'validite_mois', NULL
    );
  END IF;

  IF v_dom_info.normes_parasismiques THEN
    v_diagnostics := v_diagnostics || jsonb_build_object(
      'type', 'parasismique',
      'nom', 'Attestation normes parasismiques',
      'obligatoire', true,
      'zone_sismique', v_dom_info.zone_sismique
    );
  END IF;

  RETURN jsonb_build_object(
    'is_dom', true,
    'departement', v_departement,
    'nom', v_dom_info.nom,
    'zone_sismique', v_dom_info.zone_sismique,
    'zone_cyclonique', v_dom_info.zone_cyclonique,
    'zone_volcanique', v_dom_info.zone_volcanique,
    'volcan_actif', v_dom_info.volcan_actif,
    'diagnostics', v_diagnostics
  );
END;
$$;

-- ============================================
-- VUES
-- ============================================

-- Diagnostics termites expirés ou à renouveler
CREATE OR REPLACE VIEW v_diagnostics_termites_a_renouveler AS
SELECT
  dt.*,
  p.adresse_complete,
  p.code_postal,
  p.ville,
  p.departement,
  CASE
    WHEN dt.date_validite < CURRENT_DATE THEN 'expiré'
    WHEN dt.date_validite < CURRENT_DATE + INTERVAL '30 days' THEN 'expire_bientot'
    ELSE 'valide'
  END as statut_validite,
  dt.date_validite - CURRENT_DATE as jours_restants
FROM diagnostics_termites dt
JOIN properties p ON dt.property_id = p.id
WHERE dt.date_validite < CURRENT_DATE + INTERVAL '60 days';

-- Biens DOM sans diagnostic termites valide
CREATE OR REPLACE VIEW v_biens_dom_sans_termites AS
SELECT
  p.id as property_id,
  p.owner_id,
  p.adresse_complete,
  p.code_postal,
  p.ville,
  p.departement,
  dr.nom as nom_dom,
  dr.zone_sismique,
  dr.zone_cyclonique,
  dr.zone_volcanique,
  dr.volcan_actif
FROM properties p
JOIN dom_referentiel dr ON p.departement = dr.departement
LEFT JOIN diagnostics_termites dt ON p.id = dt.property_id AND dt.date_validite >= CURRENT_DATE
WHERE dt.id IS NULL;

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON TABLE diagnostics_termites IS 'Diagnostics termites obligatoires en DOM - Loi du 8 juin 1999';
COMMENT ON TABLE erp_dom_tom IS 'État des Risques et Pollutions spécifique aux DOM';
COMMENT ON TABLE dom_referentiel IS 'Référentiel des caractéristiques et obligations par DOM';

COMMENT ON FUNCTION is_termites_required IS 'Vérifie si un diagnostic termites est requis pour un bien';
COMMENT ON FUNCTION is_termites_valid IS 'Vérifie la validité du diagnostic termites d''un bien';
COMMENT ON FUNCTION get_diagnostics_obligatoires_dom IS 'Liste les diagnostics obligatoires pour un bien DOM';


-- ========== 20260128000000_surface_carrez_rent_control.sql ==========
-- Migration : Surface Carrez et encadrement des loyers SOTA 2026
-- Ajoute les colonnes pour la conformite loi ALUR et decret decence
BEGIN;

-- ============================================
-- SURFACE CARREZ (Loi du 18 decembre 1996)
-- ============================================
-- Surface privative certifiee, obligatoire en copropriete
-- Doit etre <= surface_habitable_m2

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS surface_carrez NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS surface_carrez_certifiee BOOLEAN DEFAULT false;

-- Commentaire pour documentation
COMMENT ON COLUMN properties.surface_carrez IS 'Surface privative loi Carrez (m2), obligatoire en copropriete';
COMMENT ON COLUMN properties.surface_carrez_certifiee IS 'Surface Carrez certifiee par un diagnostiqueur agree';

-- ============================================
-- ENCADREMENT DES LOYERS (Loi ALUR / ELAN)
-- ============================================
-- Pour les zones tendues avec encadrement (Paris, Lille, Lyon, etc.)

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS zone_encadrement TEXT,
  ADD COLUMN IF NOT EXISTS loyer_reference NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS loyer_reference_majore NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS complement_loyer NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS complement_loyer_justification TEXT;

-- Contrainte sur zone_encadrement
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_zone_encadrement_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_zone_encadrement_check
    CHECK (zone_encadrement IS NULL OR zone_encadrement IN (
      'paris',
      'paris_agglo',
      'lille',
      'lyon',
      'villeurbanne',
      'montpellier',
      'bordeaux',
      'aucune'
    ));

COMMENT ON COLUMN properties.zone_encadrement IS 'Zone d encadrement des loyers (Paris, Lille, Lyon, etc.)';
COMMENT ON COLUMN properties.loyer_reference IS 'Loyer de reference median pour la zone (EUR/m2)';
COMMENT ON COLUMN properties.loyer_reference_majore IS 'Loyer de reference majore (loyer_reference * 1.2)';
COMMENT ON COLUMN properties.complement_loyer IS 'Complement de loyer exceptionnel (EUR/mois)';
COMMENT ON COLUMN properties.complement_loyer_justification IS 'Justification du complement de loyer (caracteristiques exceptionnelles)';

-- ============================================
-- DPE COMPLET (Loi Climat et Resilience 2021)
-- ============================================
-- Champs DPE detailles pour conformite

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS dpe_classe_energie TEXT,
  ADD COLUMN IF NOT EXISTS dpe_classe_climat TEXT,
  ADD COLUMN IF NOT EXISTS dpe_consommation NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS dpe_emissions NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS dpe_date_realisation DATE,
  ADD COLUMN IF NOT EXISTS dpe_numero TEXT;

-- Contraintes DPE
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_dpe_classe_energie_check,
  DROP CONSTRAINT IF EXISTS properties_dpe_classe_climat_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_dpe_classe_energie_check
    CHECK (dpe_classe_energie IS NULL OR dpe_classe_energie IN ('A','B','C','D','E','F','G','NC')),
  ADD CONSTRAINT properties_dpe_classe_climat_check
    CHECK (dpe_classe_climat IS NULL OR dpe_classe_climat IN ('A','B','C','D','E','F','G','NC'));

COMMENT ON COLUMN properties.dpe_classe_energie IS 'Classe energie DPE (A-G ou NC)';
COMMENT ON COLUMN properties.dpe_classe_climat IS 'Classe emissions GES (A-G ou NC)';
COMMENT ON COLUMN properties.dpe_consommation IS 'Consommation energetique (kWh/m2/an)';
COMMENT ON COLUMN properties.dpe_emissions IS 'Emissions GES (kg CO2/m2/an)';

-- ============================================
-- INDEX POUR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_properties_dpe_classe ON properties(dpe_classe_energie);
CREATE INDEX IF NOT EXISTS idx_properties_zone_encadrement ON properties(zone_encadrement);
CREATE INDEX IF NOT EXISTS idx_properties_surface_carrez ON properties(surface_carrez);

COMMIT;


-- ========== 20260128000001_fix_edl_schema_500.sql ==========
-- ============================================================================
-- MIGRATION: Fix EDL table schema - Resolve 500 error on EDL creation
-- Date: 2026-01-28
-- Fixes:
--   1. Add property_id FK column (used by POST /api/properties/[id]/inspections)
--   2. Add scheduled_at TIMESTAMPTZ column (used by wizard creation flow)
--   3. Extend status CHECK constraint to include 'scheduled' and 'closed'
--   4. Backfill property_id from leases.property_id for existing records
-- ============================================================================

-- 1. Add property_id column to edl table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'edl' AND column_name = 'property_id'
    ) THEN
        ALTER TABLE edl ADD COLUMN property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added property_id column to edl table';
    END IF;
END $$;

-- 2. Add scheduled_at TIMESTAMPTZ column (more precise than scheduled_date DATE)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'edl' AND column_name = 'scheduled_at'
    ) THEN
        ALTER TABLE edl ADD COLUMN scheduled_at TIMESTAMPTZ;
        RAISE NOTICE 'Added scheduled_at column to edl table';
    END IF;
END $$;

-- 3. Extend status CHECK constraint to include 'scheduled' and 'closed'
-- Drop existing constraint and recreate with all valid statuses
DO $$
BEGIN
    -- Drop existing constraint (may have different names depending on migration order)
    ALTER TABLE edl DROP CONSTRAINT IF EXISTS edl_status_check;

    -- Recreate with all statuses used in the codebase
    ALTER TABLE edl ADD CONSTRAINT edl_status_check
        CHECK (status IN (
            'draft',           -- Brouillon initial
            'scheduled',       -- Planifie (cree via le wizard)
            'in_progress',     -- En cours de saisie
            'completed',       -- Complete, en attente de signatures
            'signed',          -- Signe par toutes les parties
            'disputed',        -- Conteste
            'closed'           -- Cloture (archive)
        ));

    RAISE NOTICE 'Updated status CHECK constraint on edl table';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not update status constraint: %', SQLERRM;
END $$;

-- 4. Backfill property_id from leases.property_id for existing records
UPDATE edl e
SET property_id = l.property_id
FROM leases l
WHERE e.lease_id = l.id
AND e.property_id IS NULL
AND l.property_id IS NOT NULL;

-- 5. Backfill scheduled_at from scheduled_date for existing records
UPDATE edl
SET scheduled_at = scheduled_date::timestamptz
WHERE scheduled_at IS NULL
AND scheduled_date IS NOT NULL;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_edl_property_id ON edl(property_id);
CREATE INDEX IF NOT EXISTS idx_edl_scheduled_at ON edl(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_edl_status ON edl(status);

-- 7. Comments
COMMENT ON COLUMN edl.property_id IS 'FK directe vers le bien immobilier (denormalise depuis leases.property_id pour faciliter les requetes)';
COMMENT ON COLUMN edl.scheduled_at IS 'Date et heure planifiees pour la realisation de l''EDL';

-- 8. RLS Policy for property_id direct access
-- Permet l'accès direct via property_id en plus de la relation lease_id
DROP POLICY IF EXISTS "owner_access_via_property_id" ON edl;
CREATE POLICY "owner_access_via_property_id" ON edl
  FOR ALL
  USING (
    -- Via property_id direct (nouvelle colonne)
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = edl.property_id
      AND pr.user_id = auth.uid()
    )
    OR
    -- Via lease_id (relation existante - fallback)
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = edl.lease_id
      AND pr.user_id = auth.uid()
    )
    OR
    -- Créateur de l'EDL
    edl.created_by = auth.uid()
    OR
    -- Signataire invité
    EXISTS (
      SELECT 1 FROM edl_signatures es
      JOIN profiles pr ON pr.id = es.signer_profile_id
      WHERE es.edl_id = edl.id
      AND pr.user_id = auth.uid()
    )
  );

SELECT 'Migration fix_edl_schema_500 applied successfully' AS status;


-- ========== 20260128000001_webhook_queue.sql ==========
-- Migration: Create webhook_queue table for retry service
-- Sprint 2: INTEG-001 - Webhook retry service

-- Table de queue pour les webhooks sortants avec retry
CREATE TABLE IF NOT EXISTS public.webhook_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identifiant de l'événement
    event_type TEXT NOT NULL,

    -- Payload JSON à envoyer
    payload JSONB NOT NULL DEFAULT '{}',

    -- URL cible
    target_url TEXT NOT NULL,

    -- Headers HTTP supplémentaires (optionnel)
    headers JSONB DEFAULT NULL,

    -- Compteur de retries
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,

    -- Date du prochain retry
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),

    -- Statut du webhook
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'success', 'failed', 'dead_letter')),

    -- Métadonnées de suivi
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NULL,
    last_error TEXT DEFAULT NULL,

    -- Index pour les requêtes fréquentes
    CONSTRAINT webhook_queue_max_retries_check CHECK (max_retries > 0 AND max_retries <= 10)
);

-- Index pour récupérer les webhooks à traiter
CREATE INDEX IF NOT EXISTS idx_webhook_queue_pending
    ON public.webhook_queue (next_retry_at)
    WHERE status = 'pending';

-- Index pour les dead letters
CREATE INDEX IF NOT EXISTS idx_webhook_queue_dead_letter
    ON public.webhook_queue (created_at DESC)
    WHERE status = 'dead_letter';

-- Index pour le nettoyage
CREATE INDEX IF NOT EXISTS idx_webhook_queue_cleanup
    ON public.webhook_queue (created_at)
    WHERE status = 'success';

-- Index sur event_type pour monitoring
CREATE INDEX IF NOT EXISTS idx_webhook_queue_event_type
    ON public.webhook_queue (event_type, status);

-- Commentaires
COMMENT ON TABLE public.webhook_queue IS 'Queue pour les webhooks sortants avec système de retry';
COMMENT ON COLUMN public.webhook_queue.event_type IS 'Type d''événement (ex: Payment.Succeeded, Lease.Created)';
COMMENT ON COLUMN public.webhook_queue.payload IS 'Contenu JSON du webhook';
COMMENT ON COLUMN public.webhook_queue.target_url IS 'URL de destination du webhook';
COMMENT ON COLUMN public.webhook_queue.headers IS 'Headers HTTP supplémentaires (auth, etc.)';
COMMENT ON COLUMN public.webhook_queue.retry_count IS 'Nombre de tentatives effectuées';
COMMENT ON COLUMN public.webhook_queue.max_retries IS 'Nombre maximum de tentatives (défaut: 5)';
COMMENT ON COLUMN public.webhook_queue.next_retry_at IS 'Date/heure du prochain essai';
COMMENT ON COLUMN public.webhook_queue.status IS 'Statut: pending, processing, success, failed, dead_letter';
COMMENT ON COLUMN public.webhook_queue.last_error IS 'Dernière erreur rencontrée';

-- RLS: Seul le service role peut accéder à cette table
ALTER TABLE public.webhook_queue ENABLE ROW LEVEL SECURITY;

-- Pas de policy pour les utilisateurs normaux
-- La table n'est accessible que via le service role

-- Fonction de nettoyage automatique (optionnel, via pg_cron)
CREATE OR REPLACE FUNCTION cleanup_old_webhooks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.webhook_queue
    WHERE status = 'success'
    AND created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_webhooks() IS 'Supprime les webhooks réussis de plus de 30 jours';


-- ========== 20260201000000_ged_system.sql ==========
-- Migration: Système GED (Gestion Électronique des Documents)
-- SOTA 2026 - Extension du système documents existant
-- Ajoute: document_types référentiel, alertes d'expiration, partages, audit log GED
-- RÉTROCOMPATIBLE: ne modifie aucune colonne existante

BEGIN;

-- ============================================
-- TABLE: ged_document_types (Référentiel types)
-- ============================================
-- Référentiel centralisé des types de documents avec métadonnées GED
-- Complète l'enum DocumentType existant avec des infos de validité et rattachement

CREATE TABLE IF NOT EXISTS ged_document_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  label_short TEXT,
  icon TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'legal', 'diagnostic', 'insurance', 'financial',
    'administrative', 'identity', 'edl', 'maintenance', 'other'
  )),
  is_expirable BOOLEAN NOT NULL DEFAULT FALSE,
  default_validity_days INTEGER,
  can_attach_to_entity BOOLEAN NOT NULL DEFAULT FALSE,
  can_attach_to_property BOOLEAN NOT NULL DEFAULT FALSE,
  can_attach_to_lease BOOLEAN NOT NULL DEFAULT FALSE,
  is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  is_mandatory_for_lease BOOLEAN NOT NULL DEFAULT FALSE,
  retention_days INTEGER,  -- Durée légale de conservation en jours
  display_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed data: tous les types de documents
INSERT INTO ged_document_types (id, label, label_short, icon, category, is_expirable, default_validity_days, can_attach_to_entity, can_attach_to_property, can_attach_to_lease, is_auto_generated, is_mandatory_for_lease, retention_days, display_order) VALUES
  -- Légaux (bail)
  ('bail', 'Bail de location', 'Bail', 'FileText', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, TRUE, 1825, 10),
  ('avenant', 'Avenant au bail', 'Avenant', 'FilePlus', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 11),
  ('engagement_garant', 'Acte de cautionnement', 'Caution', 'Shield', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 12),
  ('bail_signe_locataire', 'Bail signé locataire', 'Bail signé', 'FileCheck', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 13),
  ('bail_signe_proprietaire', 'Bail signé propriétaire', 'Bail signé', 'FileCheck', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 14),
  ('consentement', 'Consentement RGPD', 'RGPD', 'ShieldCheck', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1095, 15),

  -- Diagnostics (bien) - EXPIRABLES
  ('dpe', 'DPE (Diagnostic Performance Énergétique)', 'DPE', 'Thermometer', 'diagnostic', TRUE, 3650, FALSE, TRUE, FALSE, FALSE, TRUE, 3650, 20),
  ('diagnostic_gaz', 'Diagnostic Gaz', 'Gaz', 'Flame', 'diagnostic', TRUE, 2190, FALSE, TRUE, FALSE, FALSE, TRUE, 2190, 21),
  ('diagnostic_electricite', 'Diagnostic Électricité', 'Électricité', 'Zap', 'diagnostic', TRUE, 2190, FALSE, TRUE, FALSE, FALSE, TRUE, 2190, 22),
  ('diagnostic_plomb', 'Diagnostic Plomb (CREP)', 'Plomb', 'AlertTriangle', 'diagnostic', TRUE, 365, FALSE, TRUE, FALSE, FALSE, TRUE, NULL, 23),
  ('diagnostic_amiante', 'Diagnostic Amiante', 'Amiante', 'AlertTriangle', 'diagnostic', TRUE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, NULL, 24),
  ('diagnostic_termites', 'Diagnostic Termites', 'Termites', 'Bug', 'diagnostic', TRUE, 180, FALSE, TRUE, FALSE, FALSE, FALSE, 180, 25),
  ('erp', 'État des Risques et Pollutions', 'ERP', 'MapPin', 'diagnostic', TRUE, 180, FALSE, TRUE, FALSE, FALSE, TRUE, 180, 26),
  ('diagnostic', 'Dossier Diagnostic Technique (DDT)', 'DDT', 'FileSearch', 'diagnostic', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, NULL, 27),
  ('diagnostic_tertiaire', 'Diagnostic tertiaire', 'Tertiaire', 'Building', 'diagnostic', TRUE, 3650, FALSE, TRUE, FALSE, FALSE, FALSE, 3650, 28),
  ('diagnostic_performance', 'Diagnostic performance', 'Performance', 'BarChart', 'diagnostic', TRUE, 3650, FALSE, TRUE, FALSE, FALSE, FALSE, 3650, 29),

  -- Assurances - EXPIRABLES
  ('attestation_assurance', 'Attestation d''assurance habitation', 'Assurance hab.', 'ShieldCheck', 'insurance', TRUE, 365, FALSE, FALSE, TRUE, FALSE, TRUE, 1095, 30),
  ('assurance_pno', 'Assurance PNO', 'PNO', 'Shield', 'insurance', TRUE, 365, FALSE, TRUE, FALSE, FALSE, FALSE, 1095, 31),

  -- Financiers
  ('quittance', 'Quittance de loyer', 'Quittance', 'Receipt', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, TRUE, 1095, 40),
  ('facture', 'Facture', 'Facture', 'Receipt', 'financial', FALSE, NULL, TRUE, TRUE, TRUE, FALSE, FALSE, 3650, 41),
  ('rib', 'RIB / Coordonnées bancaires', 'RIB', 'CreditCard', 'financial', FALSE, NULL, TRUE, FALSE, FALSE, FALSE, FALSE, NULL, 42),
  ('avis_imposition', 'Avis d''imposition', 'Impôts', 'FileText', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1095, 43),
  ('bulletin_paie', 'Bulletin de paie', 'Paie', 'FileText', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1095, 44),
  ('attestation_loyer', 'Attestation de loyer', 'Att. loyer', 'FileText', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1095, 45),
  ('justificatif_revenus', 'Justificatif de revenus', 'Revenus', 'FileText', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1095, 46),
  ('taxe_fonciere', 'Taxe foncière', 'Taxe fonc.', 'FileText', 'financial', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 47),
  ('taxe_sejour', 'Taxe de séjour', 'Taxe séjour', 'FileText', 'financial', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 48),

  -- Identité
  ('piece_identite', 'Pièce d''identité', 'ID', 'User', 'identity', TRUE, 3650, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 50),
  ('cni_recto', 'Carte d''identité (recto)', 'CNI recto', 'CreditCard', 'identity', TRUE, 3650, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 51),
  ('cni_verso', 'Carte d''identité (verso)', 'CNI verso', 'CreditCard', 'identity', TRUE, 3650, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 52),
  ('passeport', 'Passeport', 'Passeport', 'BookOpen', 'identity', TRUE, 3650, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 53),
  ('titre_sejour', 'Titre de séjour', 'Titre séjour', 'FileText', 'identity', TRUE, 365, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 54),

  -- États des lieux
  ('EDL_entree', 'État des lieux d''entrée', 'EDL entrée', 'ClipboardCheck', 'edl', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, TRUE, 1825, 60),
  ('EDL_sortie', 'État des lieux de sortie', 'EDL sortie', 'ClipboardCheck', 'edl', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 61),
  ('inventaire', 'Inventaire mobilier', 'Inventaire', 'List', 'edl', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 62),

  -- Candidature locataire
  ('candidature_identite', 'Candidature - Identité', 'ID candidat', 'UserCheck', 'identity', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 365, 70),
  ('candidature_revenus', 'Candidature - Revenus', 'Revenus candidat', 'DollarSign', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 365, 71),
  ('candidature_domicile', 'Candidature - Domicile', 'Domicile candidat', 'Home', 'identity', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 365, 72),
  ('candidature_garantie', 'Candidature - Garantie', 'Garantie candidat', 'Shield', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 365, 73),

  -- Garant
  ('garant_identite', 'Garant - Identité', 'ID garant', 'UserCheck', 'identity', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 80),
  ('garant_revenus', 'Garant - Revenus', 'Revenus garant', 'DollarSign', 'financial', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 81),
  ('garant_domicile', 'Garant - Domicile', 'Domicile garant', 'Home', 'identity', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 82),
  ('garant_engagement', 'Garant - Engagement', 'Engagement garant', 'FileSignature', 'legal', FALSE, NULL, FALSE, FALSE, TRUE, FALSE, FALSE, 1825, 83),

  -- Prestataire / Maintenance
  ('devis', 'Devis', 'Devis', 'Calculator', 'maintenance', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 90),
  ('ordre_mission', 'Ordre de mission', 'Ordre mission', 'ClipboardList', 'maintenance', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 91),
  ('rapport_intervention', 'Rapport d''intervention', 'Rapport', 'FileText', 'maintenance', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 92),

  -- Copropriété
  ('copropriete', 'Règlement de copropriété', 'Règl. copro', 'Building', 'administrative', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, NULL, 100),
  ('proces_verbal', 'Procès-verbal d''AG', 'PV AG', 'FileText', 'administrative', FALSE, NULL, TRUE, TRUE, FALSE, FALSE, FALSE, 1825, 101),
  ('appel_fonds', 'Appel de fonds', 'Appel fonds', 'Receipt', 'financial', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 102),

  -- Administratifs (entité)
  ('annexe_pinel', 'Annexe Pinel', 'Pinel', 'FileText', 'administrative', FALSE, NULL, TRUE, TRUE, FALSE, FALSE, FALSE, 3650, 110),
  ('etat_travaux', 'État des travaux', 'Travaux', 'Wrench', 'administrative', FALSE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, 1825, 111),
  ('publication_jal', 'Publication JAL', 'JAL', 'Newspaper', 'administrative', FALSE, NULL, TRUE, FALSE, FALSE, FALSE, FALSE, 1825, 112),

  -- Divers
  ('courrier', 'Courrier', 'Courrier', 'Mail', 'other', FALSE, NULL, TRUE, TRUE, TRUE, FALSE, FALSE, 1095, 120),
  ('photo', 'Photo / Justificatif visuel', 'Photo', 'Camera', 'other', FALSE, NULL, FALSE, TRUE, TRUE, FALSE, FALSE, NULL, 121),
  ('autre', 'Autre document', 'Autre', 'File', 'other', FALSE, NULL, TRUE, TRUE, TRUE, FALSE, FALSE, NULL, 200)
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- EXTENSION: Colonnes GED sur documents existant
-- ============================================
-- Ajoute les colonnes GED sans toucher aux colonnes existantes

-- Rattachement entité juridique
ALTER TABLE documents ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL;

-- Validité / Expiration
ALTER TABLE documents ADD COLUMN IF NOT EXISTS valid_from DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS valid_until DATE;

-- Versioning
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_current_version BOOLEAN NOT NULL DEFAULT TRUE;

-- Statut GED (complète le verification_status existant)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ged_status TEXT DEFAULT 'active' CHECK (ged_status IN (
  'draft', 'active', 'pending_signature', 'signed', 'archived', 'expired'
));

-- Signature
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_data JSONB;

-- Tags pour recherche
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Données extraites par IA GED
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ged_ai_data JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ged_ai_processed_at TIMESTAMPTZ;

-- Index GED
CREATE INDEX IF NOT EXISTS idx_documents_entity_id ON documents(entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_valid_until ON documents(valid_until) WHERE valid_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_ged_status ON documents(ged_status);
CREATE INDEX IF NOT EXISTS idx_documents_version ON documents(parent_document_id, version);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin(tags);


-- ============================================
-- TABLE: document_alerts (Alertes d'expiration)
-- ============================================

CREATE TABLE IF NOT EXISTS document_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Type d'alerte
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'expiring_soon',     -- Document arrive à expiration
    'expired',           -- Document expiré
    'missing',           -- Document manquant (obligatoire pour bail)
    'action_required'    -- Action requise (upload, signature, etc.)
  )),

  -- Configuration
  days_before_expiry INTEGER,   -- Pour expiring_soon: combien de jours avant
  message TEXT,                 -- Message personnalisé

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'dismissed', 'resolved'
  )),

  -- Notification
  notified_at TIMESTAMPTZ,
  notification_channel TEXT,   -- 'in_app', 'email', 'sms'

  -- Résolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte: pas de doublon
  UNIQUE(document_id, alert_type, days_before_expiry)
);

CREATE INDEX IF NOT EXISTS idx_document_alerts_status ON document_alerts(status) WHERE status IN ('pending', 'sent');
CREATE INDEX IF NOT EXISTS idx_document_alerts_document ON document_alerts(document_id);


-- ============================================
-- TABLE: document_shares (Partages sécurisés)
-- ============================================

CREATE TABLE IF NOT EXISTS document_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Type de partage
  share_type TEXT NOT NULL CHECK (share_type IN ('link', 'email')),

  -- Destinataire
  recipient_email TEXT,
  recipient_name TEXT,

  -- Token et URL
  share_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Sécurité
  password_hash TEXT,          -- Optionnel: mot de passe pour accéder
  expires_at TIMESTAMPTZ NOT NULL,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_document_shares_token ON document_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_document_shares_document ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_expires ON document_shares(expires_at) WHERE expires_at > NOW();


-- ============================================
-- TABLE: document_ged_audit_log (Journal GED)
-- ============================================
-- Séparé de l'audit_log existant pour ne pas interférer

CREATE TABLE IF NOT EXISTS document_ged_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Action
  action TEXT NOT NULL CHECK (action IN (
    'created', 'viewed', 'downloaded', 'updated', 'signed',
    'shared', 'archived', 'deleted', 'restored', 'version_created',
    'alert_created', 'alert_dismissed', 'ai_analyzed'
  )),

  -- Détails
  details JSONB,

  -- Contexte
  performed_by UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ged_audit_document ON document_ged_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_ged_audit_action ON document_ged_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_ged_audit_performed_at ON document_ged_audit_log(performed_at);


-- ============================================
-- VUE: v_documents_ged (Vue enrichie GED)
-- ============================================
-- Vue qui combine documents + ged_document_types pour faciliter les requêtes

CREATE OR REPLACE VIEW v_documents_ged AS
SELECT
  d.id,
  d.type,
  d.title,
  d.storage_path,
  d.file_size,
  d.mime_type,
  d.owner_id,
  d.tenant_id,
  d.property_id,
  d.lease_id,
  d.entity_id,
  d.valid_from,
  d.valid_until,
  d.version,
  d.parent_document_id,
  d.is_current_version,
  d.ged_status,
  d.signed_at,
  d.tags,
  d.ged_ai_data,
  d.created_at,
  d.updated_at,
  d.created_by,
  -- Infos du type de document
  gdt.label AS type_label,
  gdt.label_short AS type_label_short,
  gdt.icon AS type_icon,
  gdt.category AS type_category,
  gdt.is_expirable,
  gdt.default_validity_days,
  gdt.is_mandatory_for_lease,
  gdt.retention_days,
  -- Calculs d'expiration
  CASE
    WHEN d.valid_until IS NOT NULL AND d.valid_until < CURRENT_DATE THEN 'expired'
    WHEN d.valid_until IS NOT NULL AND d.valid_until < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    WHEN d.valid_until IS NOT NULL AND d.valid_until < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_notice'
    WHEN d.valid_until IS NOT NULL THEN 'valid'
    ELSE NULL
  END AS expiry_status,
  CASE
    WHEN d.valid_until IS NOT NULL THEN d.valid_until - CURRENT_DATE
    ELSE NULL
  END AS days_until_expiry
FROM documents d
LEFT JOIN ged_document_types gdt ON gdt.id = d.type
WHERE d.is_archived IS NOT TRUE
  AND d.is_current_version IS TRUE;


-- ============================================
-- VUE: v_document_alerts_summary (Résumé alertes)
-- ============================================
-- Pour le panneau d'alertes de la page GED

CREATE OR REPLACE VIEW v_document_alerts_summary AS
SELECT
  d.owner_id,
  d.property_id,
  d.lease_id,
  d.entity_id,
  COUNT(*) FILTER (WHERE vg.expiry_status = 'expired') AS expired_count,
  COUNT(*) FILTER (WHERE vg.expiry_status = 'expiring_soon') AS expiring_soon_count,
  COUNT(*) FILTER (WHERE vg.expiry_status = 'expiring_notice') AS expiring_notice_count,
  json_agg(
    json_build_object(
      'id', d.id,
      'type', d.type,
      'title', d.title,
      'valid_until', d.valid_until,
      'expiry_status', vg.expiry_status,
      'days_until_expiry', vg.days_until_expiry,
      'property_id', d.property_id,
      'lease_id', d.lease_id
    ) ORDER BY d.valid_until ASC
  ) FILTER (WHERE vg.expiry_status IN ('expired', 'expiring_soon', 'expiring_notice')) AS alert_documents
FROM documents d
JOIN v_documents_ged vg ON vg.id = d.id
WHERE d.is_archived IS NOT TRUE
  AND d.valid_until IS NOT NULL
  AND vg.expiry_status IS NOT NULL
GROUP BY d.owner_id, d.property_id, d.lease_id, d.entity_id;


-- ============================================
-- RLS: Policies pour les nouvelles tables
-- ============================================

-- document_alerts
ALTER TABLE document_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts for their documents"
  ON document_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      LEFT JOIN properties p ON d.property_id = p.id
      LEFT JOIN profiles pr ON pr.user_id = auth.uid()
      WHERE d.id = document_alerts.document_id
        AND (d.owner_id = pr.id OR d.tenant_id = pr.id)
    )
  );

CREATE POLICY "Users can update alerts for their documents"
  ON document_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      LEFT JOIN profiles pr ON pr.user_id = auth.uid()
      WHERE d.id = document_alerts.document_id
        AND (d.owner_id = pr.id)
    )
  );

-- document_shares
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their shares"
  ON document_shares FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can create shares"
  ON document_shares FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their shares"
  ON document_shares FOR DELETE
  USING (created_by = auth.uid());

-- document_ged_audit_log
ALTER TABLE document_ged_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their documents"
  ON document_ged_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      LEFT JOIN profiles pr ON pr.user_id = auth.uid()
      WHERE d.id = document_ged_audit_log.document_id
        AND (d.owner_id = pr.id)
    )
  );

CREATE POLICY "System can insert audit logs"
  ON document_ged_audit_log FOR INSERT
  WITH CHECK (TRUE);

-- ged_document_types (lecture publique)
ALTER TABLE ged_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read document types"
  ON ged_document_types FOR SELECT
  USING (TRUE);


-- ============================================
-- FONCTION: Mise à jour automatique des alertes
-- ============================================

CREATE OR REPLACE FUNCTION update_document_ged_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Si valid_until est défini et passé, marquer comme expiré
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until < CURRENT_DATE AND NEW.ged_status = 'active' THEN
    NEW.ged_status := 'expired';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur mise à jour de documents
DROP TRIGGER IF EXISTS trigger_update_document_ged_status ON documents;
CREATE TRIGGER trigger_update_document_ged_status
  BEFORE UPDATE ON documents
  FOR EACH ROW
  WHEN (OLD.valid_until IS DISTINCT FROM NEW.valid_until OR OLD.ged_status IS DISTINCT FROM NEW.ged_status)
  EXECUTE FUNCTION update_document_ged_status();

COMMIT;


-- ========== 20260207000000_apply_legal_entities_consolidated.sql ==========
-- Migration consolidée: Legal Entities - Application et cohérence
-- SOTA 2026 - S'assure que l'architecture multi-entités est complète et cohérente
-- IDEMPOTENT: Peut être exécuté plusieurs fois sans erreur

BEGIN;

-- ============================================
-- 1. Vérification / Création des tables de base
-- ============================================
-- (Les tables sont créées par 20260115000000_multi_entity_architecture.sql)
-- Cette migration ne fait que s'assurer de la cohérence et des compléments

-- Colonne entity_id sur documents (référence GED → legal_entities)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_entity_id ON documents(entity_id) WHERE entity_id IS NOT NULL;

-- ============================================
-- 2. Index supplémentaires pour performance
-- ============================================

-- Index composite pour requêtes filtrées (owner + actif)
CREATE INDEX IF NOT EXISTS idx_legal_entities_owner_active
  ON legal_entities(owner_profile_id) WHERE is_active = true;

-- ============================================
-- 3. Contraintes de cohérence
-- ============================================
-- S'assure que les propriétés ont soit legal_entity_id soit restent sur owner_id legacy

DO $$
BEGIN
  -- Vérifier que detention_mode est bien défini pour les propriétés avec legal_entity_id
  UPDATE properties
  SET detention_mode = COALESCE(detention_mode, 'societe')
  WHERE legal_entity_id IS NOT NULL
    AND (detention_mode IS NULL OR detention_mode = 'direct');

  -- Pour les propriétés sans legal_entity_id, garder 'direct'
  UPDATE properties
  SET detention_mode = COALESCE(detention_mode, 'direct')
  WHERE legal_entity_id IS NULL
    AND detention_mode IS NULL;
END $$;

-- ============================================
-- 4. Backfill: entités par défaut manquantes
-- ============================================

INSERT INTO legal_entities (
  owner_profile_id,
  entity_type,
  nom,
  regime_fiscal,
  is_active,
  siret,
  adresse_siege,
  iban
)
SELECT
  op.profile_id,
  CASE
    WHEN op.type = 'societe' THEN 'sci_ir'
    ELSE 'particulier'
  END,
  COALESCE(
    op.raison_sociale,
    (SELECT CONCAT(p.prenom, ' ', p.nom) FROM profiles p WHERE p.id = op.profile_id),
    'Patrimoine personnel'
  ),
  'ir',
  true,
  op.siret,
  op.adresse_facturation,
  op.iban
FROM owner_profiles op
WHERE NOT EXISTS (
  SELECT 1 FROM legal_entities le
  WHERE le.owner_profile_id = op.profile_id
);

-- Lier les propriétés orphelines à l'entité par défaut du propriétaire
UPDATE properties p
SET legal_entity_id = (
  SELECT le.id
  FROM legal_entities le
  WHERE le.owner_profile_id = p.owner_id
  ORDER BY le.created_at ASC
  LIMIT 1
),
detention_mode = COALESCE(p.detention_mode, 'direct')
WHERE p.legal_entity_id IS NULL
  AND EXISTS (
    SELECT 1 FROM legal_entities le
    WHERE le.owner_profile_id = p.owner_id
  );

-- Créer property_ownership manquants pour les propriétés liées à une entité
INSERT INTO property_ownership (
  property_id,
  legal_entity_id,
  profile_id,
  quote_part_numerateur,
  quote_part_denominateur,
  detention_type,
  date_acquisition,
  mode_acquisition,
  is_current
)
SELECT
  p.id,
  p.legal_entity_id,
  NULL,
  1,
  1,
  'pleine_propriete',
  p.created_at::DATE,
  'achat',
  true
FROM properties p
WHERE p.legal_entity_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM property_ownership po
    WHERE po.property_id = p.id
  );

COMMIT;

-- ========== 20260205000001_fix_edl_signatures_insert_rls.sql ==========
BEGIN;
DROP POLICY IF EXISTS "EDL signatures signer create" ON edl_signatures;
CREATE POLICY "EDL signatures insert" ON edl_signatures FOR INSERT WITH CHECK (
  signer_user = auth.uid()
  OR edl_id IN (SELECT id FROM edl WHERE created_by = auth.uid())
  OR edl_id IN (SELECT e.id FROM edl e JOIN properties p ON p.id = e.property_id JOIN profiles pr ON pr.id = p.owner_id WHERE pr.user_id = auth.uid())
);
DROP POLICY IF EXISTS "EDL signatures creator update" ON edl_signatures;
CREATE POLICY "EDL signatures creator update" ON edl_signatures FOR UPDATE
  USING (signer_user = auth.uid() OR edl_id IN (SELECT id FROM edl WHERE created_by = auth.uid()))
  WITH CHECK (signer_user = auth.uid() OR edl_id IN (SELECT id FROM edl WHERE created_by = auth.uid()));
COMMIT;

-- ========== 20260206000000_migrate_owner_profiles_to_legal_entities.sql ==========
BEGIN;
INSERT INTO legal_entities (id, owner_profile_id, entity_type, nom, siret, forme_juridique, adresse_siege, numero_tva, is_active, created_at, updated_at)
SELECT gen_random_uuid(), op.profile_id,
  CASE WHEN op.forme_juridique = 'SCI' THEN 'sci_ir' WHEN op.forme_juridique = 'SARL' THEN 'sarl' WHEN op.forme_juridique = 'SAS' THEN 'sas' WHEN op.forme_juridique = 'SASU' THEN 'sasu' WHEN op.forme_juridique = 'EURL' THEN 'eurl' WHEN op.forme_juridique = 'EI' THEN 'eurl' WHEN op.forme_juridique = 'SA' THEN 'sa' WHEN op.forme_juridique = 'SCPI' THEN 'sci_ir' ELSE 'sarl' END,
  op.raison_sociale, op.siret, op.forme_juridique, op.adresse_siege, op.tva, true, NOW(), NOW()
FROM owner_profiles op
WHERE op.type = 'societe' AND op.raison_sociale IS NOT NULL AND op.raison_sociale != ''
  AND NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.owner_profile_id = op.profile_id AND le.is_active = true);
UPDATE properties p SET legal_entity_id = le.id
FROM owner_profiles op JOIN legal_entities le ON le.owner_profile_id = op.profile_id AND le.is_active = true
WHERE p.owner_id = op.profile_id AND p.legal_entity_id IS NULL AND op.type = 'societe' AND op.raison_sociale IS NOT NULL;
UPDATE leases l SET signatory_entity_id = p.legal_entity_id
FROM properties p WHERE l.property_id = p.id AND l.signatory_entity_id IS NULL AND p.legal_entity_id IS NOT NULL AND l.statut IN ('active', 'pending_signature', 'draft');
COMMIT;

-- ========== 20260207100000_fix_audit_critical_issues.sql ==========
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'entity_id') THEN
    ALTER TABLE public.edl ADD COLUMN entity_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_edl_entity_id ON public.edl(entity_id);
    UPDATE public.edl e SET entity_id = l.signatory_entity_id FROM public.leases l WHERE e.lease_id = l.id AND l.signatory_entity_id IS NOT NULL AND e.entity_id IS NULL;
    UPDATE public.edl e SET entity_id = p.legal_entity_id FROM public.properties p WHERE e.property_id = p.id AND p.legal_entity_id IS NOT NULL AND e.entity_id IS NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'edl_id') THEN
    ALTER TABLE public.documents ADD COLUMN edl_id UUID REFERENCES public.edl(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_documents_edl_id ON public.documents(edl_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_inventories') THEN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'furniture_inventories' AND constraint_type = 'FOREIGN KEY' AND constraint_name LIKE '%edl_id%') THEN
      DECLARE fk_name TEXT;
      BEGIN
        SELECT constraint_name INTO fk_name FROM information_schema.table_constraints WHERE table_name = 'furniture_inventories' AND constraint_type = 'FOREIGN KEY' AND constraint_name LIKE '%edl_id%' LIMIT 1;
        IF fk_name IS NOT NULL THEN EXECUTE format('ALTER TABLE public.furniture_inventories DROP CONSTRAINT %I', fk_name); END IF;
      END;
    END IF;
    BEGIN ALTER TABLE public.furniture_inventories ADD CONSTRAINT furniture_inventories_edl_id_fkey FOREIGN KEY (edl_id) REFERENCES public.edl(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_reports') THEN
    DECLARE fk_name TEXT;
    BEGIN
      SELECT constraint_name INTO fk_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_name = 'vetusty_reports' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'settlement_id' LIMIT 1;
      IF fk_name IS NOT NULL THEN EXECUTE format('ALTER TABLE public.vetusty_reports DROP CONSTRAINT %I', fk_name); END IF;
    END;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deposit_movements') THEN
      BEGIN ALTER TABLE public.vetusty_reports ADD CONSTRAINT vetusty_reports_settlement_id_fkey FOREIGN KEY (settlement_id) REFERENCES public.deposit_movements(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_vetusty_reports_edl_entry ON public.vetusty_reports(edl_entry_id);
    CREATE INDEX IF NOT EXISTS idx_vetusty_reports_edl_exit ON public.vetusty_reports(edl_exit_id);
    CREATE INDEX IF NOT EXISTS idx_vetusty_reports_validated_by ON public.vetusty_reports(validated_by);
    CREATE INDEX IF NOT EXISTS idx_vetusty_reports_created_by ON public.vetusty_reports(created_by);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_reports') THEN
    DROP POLICY IF EXISTS "vetusty_reports_owner_select" ON public.vetusty_reports;
    DROP POLICY IF EXISTS "vetusty_reports_owner_insert" ON public.vetusty_reports;
    DROP POLICY IF EXISTS "vetusty_reports_owner_update" ON public.vetusty_reports;
    DROP POLICY IF EXISTS "vetusty_reports_owner_delete" ON public.vetusty_reports;
    DROP POLICY IF EXISTS "vetusty_reports_tenant_select" ON public.vetusty_reports;
    DROP POLICY IF EXISTS "vetusty_reports_admin_all" ON public.vetusty_reports;
    CREATE POLICY "vetusty_reports_owner_select" ON public.vetusty_reports FOR SELECT USING (EXISTS (SELECT 1 FROM public.leases l JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE l.id = vetusty_reports.lease_id AND pr.user_id = auth.uid()));
    CREATE POLICY "vetusty_reports_owner_insert" ON public.vetusty_reports FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.leases l JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE l.id = vetusty_reports.lease_id AND pr.user_id = auth.uid()));
    CREATE POLICY "vetusty_reports_owner_update" ON public.vetusty_reports FOR UPDATE USING (EXISTS (SELECT 1 FROM public.leases l JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE l.id = vetusty_reports.lease_id AND pr.user_id = auth.uid()));
    CREATE POLICY "vetusty_reports_owner_delete" ON public.vetusty_reports FOR DELETE USING (EXISTS (SELECT 1 FROM public.leases l JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE l.id = vetusty_reports.lease_id AND pr.user_id = auth.uid()));
    CREATE POLICY "vetusty_reports_tenant_select" ON public.vetusty_reports FOR SELECT USING (EXISTS (SELECT 1 FROM public.leases l JOIN public.profiles pr ON pr.id = l.tenant_id WHERE l.id = vetusty_reports.lease_id AND pr.user_id = auth.uid()));
    CREATE POLICY "vetusty_reports_admin_all" ON public.vetusty_reports FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_items') THEN
    DROP POLICY IF EXISTS "vetusty_items_owner_select" ON public.vetusty_items;
    DROP POLICY IF EXISTS "vetusty_items_owner_insert" ON public.vetusty_items;
    DROP POLICY IF EXISTS "vetusty_items_owner_update" ON public.vetusty_items;
    DROP POLICY IF EXISTS "vetusty_items_owner_delete" ON public.vetusty_items;
    DROP POLICY IF EXISTS "vetusty_items_tenant_select" ON public.vetusty_items;
    DROP POLICY IF EXISTS "vetusty_items_admin_all" ON public.vetusty_items;
    CREATE POLICY "vetusty_items_owner_select" ON public.vetusty_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.vetusty_reports vr JOIN public.leases l ON l.id = vr.lease_id JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE vr.id = vetusty_items.report_id AND pr.user_id = auth.uid()));
    CREATE POLICY "vetusty_items_owner_insert" ON public.vetusty_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.vetusty_reports vr JOIN public.leases l ON l.id = vr.lease_id JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE vr.id = vetusty_items.report_id AND pr.user_id = auth.uid()));
    CREATE POLICY "vetusty_items_owner_update" ON public.vetusty_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.vetusty_reports vr JOIN public.leases l ON l.id = vr.lease_id JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE vr.id = vetusty_items.report_id AND pr.user_id = auth.uid()));
    CREATE POLICY "vetusty_items_owner_delete" ON public.vetusty_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.vetusty_reports vr JOIN public.leases l ON l.id = vr.lease_id JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE vr.id = vetusty_items.report_id AND pr.user_id = auth.uid()));
    CREATE POLICY "vetusty_items_tenant_select" ON public.vetusty_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.vetusty_reports vr JOIN public.leases l ON l.id = vr.lease_id JOIN public.profiles pr ON pr.id = l.tenant_id WHERE vr.id = vetusty_items.report_id AND pr.user_id = auth.uid()));
    CREATE POLICY "vetusty_items_admin_all" ON public.vetusty_items FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));
    BEGIN ALTER TABLE public.vetusty_items ADD CONSTRAINT vetusty_items_edl_entry_item_fkey FOREIGN KEY (edl_entry_item_id) REFERENCES public.edl_items(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN ALTER TABLE public.vetusty_items ADD CONSTRAINT vetusty_items_edl_exit_item_fkey FOREIGN KEY (edl_exit_item_id) REFERENCES public.edl_items(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_column THEN NULL; END;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_inventories') THEN
    DROP POLICY IF EXISTS "furniture_inventories_owner_select" ON public.furniture_inventories;
    DROP POLICY IF EXISTS "furniture_inventories_owner_insert" ON public.furniture_inventories;
    DROP POLICY IF EXISTS "furniture_inventories_owner_update" ON public.furniture_inventories;
    DROP POLICY IF EXISTS "furniture_inventories_owner_delete" ON public.furniture_inventories;
    DROP POLICY IF EXISTS "furniture_inventories_tenant_select" ON public.furniture_inventories;
    DROP POLICY IF EXISTS "furniture_inventories_admin_all" ON public.furniture_inventories;
    CREATE POLICY "furniture_inventories_owner_select" ON public.furniture_inventories FOR SELECT USING (EXISTS (SELECT 1 FROM public.leases l JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE l.id = furniture_inventories.lease_id AND pr.user_id = auth.uid()));
    CREATE POLICY "furniture_inventories_owner_insert" ON public.furniture_inventories FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.leases l JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE l.id = furniture_inventories.lease_id AND pr.user_id = auth.uid()));
    CREATE POLICY "furniture_inventories_owner_update" ON public.furniture_inventories FOR UPDATE USING (EXISTS (SELECT 1 FROM public.leases l JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE l.id = furniture_inventories.lease_id AND pr.user_id = auth.uid()));
    CREATE POLICY "furniture_inventories_tenant_select" ON public.furniture_inventories FOR SELECT USING (EXISTS (SELECT 1 FROM public.leases l JOIN public.profiles pr ON pr.id = l.tenant_id WHERE l.id = furniture_inventories.lease_id AND pr.user_id = auth.uid()));
    CREATE POLICY "furniture_inventories_admin_all" ON public.furniture_inventories FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_items') THEN
    DROP POLICY IF EXISTS "furniture_items_owner_select" ON public.furniture_items;
    DROP POLICY IF EXISTS "furniture_items_owner_insert" ON public.furniture_items;
    DROP POLICY IF EXISTS "furniture_items_owner_update" ON public.furniture_items;
    DROP POLICY IF EXISTS "furniture_items_owner_delete" ON public.furniture_items;
    DROP POLICY IF EXISTS "furniture_items_tenant_select" ON public.furniture_items;
    DROP POLICY IF EXISTS "furniture_items_admin_all" ON public.furniture_items;
    CREATE POLICY "furniture_items_owner_select" ON public.furniture_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.furniture_inventories fi JOIN public.leases l ON l.id = fi.lease_id JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE fi.id = furniture_items.inventory_id AND pr.user_id = auth.uid()));
    CREATE POLICY "furniture_items_owner_insert" ON public.furniture_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.furniture_inventories fi JOIN public.leases l ON l.id = fi.lease_id JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE fi.id = furniture_items.inventory_id AND pr.user_id = auth.uid()));
    CREATE POLICY "furniture_items_owner_update" ON public.furniture_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.furniture_inventories fi JOIN public.leases l ON l.id = fi.lease_id JOIN public.properties p ON p.id = l.property_id JOIN public.profiles pr ON pr.id = p.owner_id WHERE fi.id = furniture_items.inventory_id AND pr.user_id = auth.uid()));
    CREATE POLICY "furniture_items_tenant_select" ON public.furniture_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.furniture_inventories fi JOIN public.leases l ON l.id = fi.lease_id JOIN public.profiles pr ON pr.id = l.tenant_id WHERE fi.id = furniture_items.inventory_id AND pr.user_id = auth.uid()));
    CREATE POLICY "furniture_items_admin_all" ON public.furniture_items FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_edl_signatures_signer_profile ON public.edl_signatures(signer_profile_id);
CREATE OR REPLACE FUNCTION public.set_edl_entity_id() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entity_id IS NULL AND NEW.lease_id IS NOT NULL THEN SELECT signatory_entity_id INTO NEW.entity_id FROM public.leases WHERE id = NEW.lease_id; END IF;
  IF NEW.entity_id IS NULL AND NEW.property_id IS NOT NULL THEN SELECT legal_entity_id INTO NEW.entity_id FROM public.properties WHERE id = NEW.property_id; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trigger_set_edl_entity_id ON public.edl;
CREATE TRIGGER trigger_set_edl_entity_id BEFORE INSERT ON public.edl FOR EACH ROW EXECUTE FUNCTION public.set_edl_entity_id();

-- ========== 20260207200000_audit_improvements_phase2.sql ==========
DROP TRIGGER IF EXISTS trigger_activate_lease_on_edl_signed ON public.edl;
DROP FUNCTION IF EXISTS public.activate_lease_on_edl_signed();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'edl' AND constraint_name LIKE '%type%' AND constraint_type = 'CHECK') THEN
    DECLARE cname TEXT;
    BEGIN SELECT constraint_name INTO cname FROM information_schema.table_constraints WHERE table_name = 'edl' AND constraint_name LIKE '%type%' AND constraint_type = 'CHECK' LIMIT 1;
      IF cname IS NOT NULL THEN EXECUTE format('ALTER TABLE public.edl DROP CONSTRAINT %I', cname); END IF;
    END;
  END IF;
  ALTER TABLE public.edl ADD CONSTRAINT edl_type_check CHECK (type IN ('entree', 'sortie', 'intermediaire'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_name = 'leases' AND kcu.column_name = 'tenant_id' AND tc.constraint_type = 'FOREIGN KEY') THEN
    DECLARE fk_name TEXT;
    BEGIN SELECT tc.constraint_name INTO fk_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_name = 'leases' AND kcu.column_name = 'tenant_id' AND tc.constraint_type = 'FOREIGN KEY' LIMIT 1;
      IF fk_name IS NOT NULL THEN EXECUTE format('ALTER TABLE public.leases DROP CONSTRAINT %I', fk_name); ALTER TABLE public.leases ADD CONSTRAINT leases_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.profiles(id) ON DELETE SET NULL; END IF;
    END;
  END IF;
END $$;
DO $$ BEGIN BEGIN ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_replaced_by_fkey; ALTER TABLE public.documents ADD CONSTRAINT documents_replaced_by_fkey FOREIGN KEY (replaced_by) REFERENCES public.documents(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column THEN NULL; END; END $$;
DO $$ BEGIN BEGIN ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_verified_by_fkey; ALTER TABLE public.documents ADD CONSTRAINT documents_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.profiles(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column THEN NULL; END; END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_inventories') THEN COMMENT ON TABLE public.furniture_inventories IS 'DEPRECATED: Use edl_furniture_inventory instead.'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_items') THEN COMMENT ON TABLE public.furniture_items IS 'DEPRECATED: Use edl_mandatory_furniture / edl_additional_furniture instead.'; END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entity_associates' AND column_name = 'piece_identite_document_id') THEN
    BEGIN ALTER TABLE public.entity_associates ADD CONSTRAINT entity_associates_piece_identite_fkey FOREIGN KEY (piece_identite_document_id) REFERENCES public.documents(id) ON DELETE SET NULL; CREATE INDEX IF NOT EXISTS idx_entity_associates_piece_identite ON public.entity_associates(piece_identite_document_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entity_associates' AND column_name = 'justificatif_domicile_document_id') THEN
    BEGIN ALTER TABLE public.entity_associates ADD CONSTRAINT entity_associates_justificatif_domicile_fkey FOREIGN KEY (justificatif_domicile_document_id) REFERENCES public.documents(id) ON DELETE SET NULL; CREATE INDEX IF NOT EXISTS idx_entity_associates_justificatif_domicile ON public.entity_associates(justificatif_domicile_document_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- ========== 20260208100000_fix_data_storage_audit.sql ==========
ALTER TABLE roommates ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE roommates ALTER COLUMN profile_id DROP NOT NULL;
ALTER TABLE roommates ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE roommates ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE roommates ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE roommates ALTER COLUMN last_name SET DEFAULT '';
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS room_label TEXT;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS has_guarantor BOOLEAN DEFAULT false;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS guarantor_email TEXT;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS guarantor_name TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leases' AND column_name = 'clauses_particulieres') THEN ALTER TABLE leases ADD COLUMN clauses_particulieres TEXT; END IF; END $$;
ALTER TABLE roommates DROP CONSTRAINT IF EXISTS roommates_lease_id_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS roommates_lease_user_unique ON roommates (lease_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS roommates_lease_email_unique ON roommates (lease_id, invited_email) WHERE invited_email IS NOT NULL;

-- ========== 20260209100000_create_sms_messages_table.sql ==========
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  from_number TEXT NOT NULL, to_number TEXT NOT NULL, message TEXT NOT NULL,
  segments INT DEFAULT 1, twilio_sid TEXT, twilio_status TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'undelivered', 'failed')),
  error_code TEXT, error_message TEXT, sent_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_messages_twilio_sid ON sms_messages (twilio_sid) WHERE twilio_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_messages_profile_id ON sms_messages (profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages (created_at DESC);
CREATE OR REPLACE FUNCTION update_sms_messages_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sms_messages_updated_at ON sms_messages;
CREATE TRIGGER trg_sms_messages_updated_at BEFORE UPDATE ON sms_messages FOR EACH ROW EXECUTE FUNCTION update_sms_messages_updated_at();
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY sms_messages_admin_all ON sms_messages FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));
CREATE POLICY sms_messages_owner_select ON sms_messages FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'owner' AND p.id = sms_messages.profile_id));
CREATE POLICY sms_messages_service_insert ON sms_messages FOR INSERT WITH CHECK (true);

