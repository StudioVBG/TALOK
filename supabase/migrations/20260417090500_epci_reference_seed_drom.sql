-- =====================================================
-- MIGRATION: Sprint 0.b — Seed EPCI DROM-COM
-- Date: 2026-04-17
-- Sprint: 0.b (Seeds PCG + EPCI — Régularisation des charges)
--
-- 23 EPCI DROM-COM — source : skill talok-charges-
-- regularization (compilé depuis DGCL / ADEME / données
-- publiques). Le skill annonçait "22 EPCI" mais le
-- décompte exact est : 3 (972) + 6 (971) + 5 (974)
-- + 4 (973) + 5 (976) = 23.
--
-- Seulement les champs vérifiables hors-ligne sont
-- renseignés : code_departement, epci_name,
-- waste_tax_type, teom_rate_pct, teom_rate_year, notes.
--
-- Les champs code_postal_pattern et syndicat_traitement
-- restent NULL (à compléter en ligne dans un sprint
-- ultérieur — besoin d'accès DGCL / INSEE).
--
-- La table epci_reference (créée en 0.a) n'a pas de
-- colonne siren par design : le lookup côté Sprint 2
-- se fait par code_postal_pattern / code_departement.
--
-- Idempotent : ON CONFLICT (code_departement, epci_name) DO NOTHING.
-- =====================================================

-- ---------------------------------------------------------------
-- 972 MARTINIQUE (3 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('972', 'CACEM', 'teom', 15.50, 2025, 'Communauté d''Agglomération du Centre de la Martinique'),
  ('972', 'Cap Nord Martinique', 'teom', 19.00, 2025, 'Communauté d''Agglomération du Nord de la Martinique'),
  ('972', 'Espace Sud', 'teom', 15.00, 2025, 'Communauté d''Agglomération de l''Espace Sud de la Martinique')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 971 GUADELOUPE (6 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('971', 'Cap Excellence', 'teom', 16.00, 2025, 'CA Cap Excellence (Pointe-à-Pitre / Les Abymes / Baie-Mahault)'),
  ('971', 'CANBT', 'teom', 14.00, 2025, 'CA du Nord Basse-Terre'),
  ('971', 'CARL', 'teom', 15.00, 2025, 'CA de la Riviera du Levant'),
  ('971', 'Grand Sud Caraïbe', 'teom', 16.00, 2025, 'CA Grand Sud Caraïbe'),
  ('971', 'CA Nord Grande-Terre', 'teom', 15.00, 2025, 'CA du Nord Grande-Terre'),
  ('971', 'CC Marie-Galante', 'teom', 18.00, 2025, 'CC Marie-Galante — surcoût transport maritime insulaire')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 974 LA RÉUNION (5 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('974', 'CINOR', 'teom', 12.00, 2025, 'CA de la Communauté Intercommunale du Nord de la Réunion'),
  ('974', 'CIREST', 'teom', 14.00, 2025, 'CA Communauté Intercommunale Réunion Est'),
  ('974', 'TCO', 'teom', 13.00, 2025, 'CA Territoire de la Côte Ouest'),
  ('974', 'CIVIS', 'teom', 15.00, 2025, 'CA Communauté Intercommunale des Villes Solidaires'),
  ('974', 'CASUD', 'teom', 14.50, 2025, 'CA du Sud Réunion')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 973 GUYANE (4 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('973', 'CACL', 'teom', 14.00, 2025, 'CA du Centre Littoral (Cayenne)'),
  ('973', 'CCDS', 'teom', 12.00, 2025, 'CC des Savanes'),
  ('973', 'CCOG', 'teom', 10.00, 2025, 'CC de l''Ouest Guyanais — couverture très faible ~25%'),
  ('973', 'CCEG', 'teom', 8.00, 2025, 'CC de l''Est Guyanais — Camopi: aucune TEOM (foncier État)')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 976 MAYOTTE (5 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('976', 'CADEMA', 'teom', 20.00, 2025, 'CA Dembéni-Mamoudzou — cadastre incomplet'),
  ('976', 'CC du Sud', 'teom', 18.00, 2025, 'Communauté de Communes du Sud'),
  ('976', 'CC Petite-Terre', 'teom', 19.00, 2025, 'Communauté de Communes de Petite-Terre'),
  ('976', 'CC Centre-Ouest', 'teom', 17.00, 2025, 'Communauté de Communes du Centre-Ouest'),
  ('976', 'CC du Nord', 'teom', 18.00, 2025, 'Communauté de Communes du Nord')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- =====================================================
-- TOTAL INSÉRÉ : 23 EPCI (3 + 6 + 5 + 4 + 5)
--
-- TODO Sprints ultérieurs :
-- 1. Compléter code_postal_pattern (liste communes par EPCI — source DGCL)
-- 2. Compléter syndicat_traitement (ex: SMTVD en Martinique, SYVADE en Guadeloupe)
-- 3. Étendre aux EPCI métropolitains (~1250 EPCI — accès DGCL requis)
-- =====================================================
