-- =====================================================
-- MIGRATION: Identité légale artisan/prestataire
-- Enrichissement de la table `providers` avec les champs
-- récupérés via l'API Recherche d'entreprises (data.gouv.fr).
--
-- Pattern : on saisit une fois au signup, on lit partout.
-- Les devis, factures et fiches publiques liront ces champs
-- au lieu de redemander à l'artisan.
-- =====================================================

DO $$
BEGIN
  -- Forme juridique (libellé court : "SAS", "SARL", "EI", "EURL"…)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'forme_juridique') THEN
    ALTER TABLE providers ADD COLUMN forme_juridique TEXT;
  END IF;

  -- Code INSEE 4 chiffres (ex: 5710, 1000, 5499) — source de vérité brute
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'nature_juridique_code') THEN
    ALTER TABLE providers ADD COLUMN nature_juridique_code TEXT;
  END IF;

  -- Activité principale (NAF/APE)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'naf_code') THEN
    ALTER TABLE providers ADD COLUMN naf_code TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'naf_label') THEN
    ALTER TABLE providers ADD COLUMN naf_label TEXT;
  END IF;

  -- N° TVA intracommunautaire (calculé à partir du SIREN, format FRxxNNNNNNNNN)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'tva_intra') THEN
    ALTER TABLE providers ADD COLUMN tva_intra TEXT;
  END IF;

  -- RCS (Registre du commerce et des sociétés)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'rcs_numero') THEN
    ALTER TABLE providers ADD COLUMN rcs_numero TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'rcs_ville') THEN
    ALTER TABLE providers ADD COLUMN rcs_ville TEXT;
  END IF;

  -- Capital social (en euros, NUMERIC pour gérer les centimes)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'capital_social') THEN
    ALTER TABLE providers ADD COLUMN capital_social NUMERIC(15, 2);
  END IF;

  -- Date d'immatriculation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'date_creation') THEN
    ALTER TABLE providers ADD COLUMN date_creation DATE;
  END IF;

  -- Représentant légal (ou auto-entrepreneur)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'dirigeant_nom') THEN
    ALTER TABLE providers ADD COLUMN dirigeant_nom TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'dirigeant_prenom') THEN
    ALTER TABLE providers ADD COLUMN dirigeant_prenom TEXT;
  END IF;

  -- Qualité du dirigeant ("Président", "Gérant", "Auto-entrepreneur"…)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'dirigeant_qualite') THEN
    ALTER TABLE providers ADD COLUMN dirigeant_qualite TEXT;
  END IF;

  -- Badge RGE (Reconnu Garant de l'Environnement) — exposé par l'API
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'est_rge') THEN
    ALTER TABLE providers ADD COLUMN est_rge BOOLEAN DEFAULT false;
  END IF;

  -- État administratif INSEE : 'A' = Active, 'C' = Cessée
  -- Si 'C' au refresh, on suspend automatiquement le compte (cf. cron à venir).
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'etat_administratif') THEN
    ALTER TABLE providers ADD COLUMN etat_administratif TEXT
      CHECK (etat_administratif IN ('A', 'C'));
  END IF;

  -- Traçabilité de l'enrichissement (pour audit + revalidation)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'api_source') THEN
    ALTER TABLE providers ADD COLUMN api_source TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'api_resolved_at') THEN
    ALTER TABLE providers ADD COLUMN api_resolved_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_providers_siret_unique
  ON providers(siret)
  WHERE siret IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_providers_etat_admin
  ON providers(etat_administratif)
  WHERE etat_administratif = 'C';

COMMENT ON COLUMN providers.forme_juridique IS 'Forme juridique courte (SAS, SARL, EI, EURL...) — dérivée de nature_juridique_code';
COMMENT ON COLUMN providers.nature_juridique_code IS 'Code INSEE 4 chiffres (référentiel: https://www.insee.fr/fr/information/2028129)';
COMMENT ON COLUMN providers.naf_code IS 'Code NAF/APE (ex: 43.22A pour plomberie)';
COMMENT ON COLUMN providers.tva_intra IS 'N° TVA intracommunautaire (FRxxNNNNNNNNN), calculé à partir du SIREN';
COMMENT ON COLUMN providers.etat_administratif IS 'A=Actif, C=Cessé. Si C, le compte doit être suspendu.';
COMMENT ON COLUMN providers.api_source IS 'Source de l''enrichissement (ex: recherche-entreprises.api.gouv.fr)';
COMMENT ON COLUMN providers.api_resolved_at IS 'Timestamp du dernier appel API réussi — utilisé pour la revalidation périodique';
