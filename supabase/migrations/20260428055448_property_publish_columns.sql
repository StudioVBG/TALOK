-- Migration : Brancher les champs PublishStep et PropertyAnnouncementTab
-- ============================================
-- Contexte : Les champs `mode_location`, `visibility`, `available_from` et `description`
-- étaient validés par Zod (lib/validations/index.ts:568-571) puis silencieusement
-- strippés à app/api/properties/[id]/route.ts:21-30 (PROPERTY_NON_DB_FIELDS), car
-- aucune colonne ne les héberge en DB. Conséquence : la sortie de PublishStep et
-- les changements faits dans PropertyAnnouncementTab étaient perdus à chaque PATCH.
--
-- Cette migration ajoute les 4 colonnes manquantes sur `properties`. Les valeurs
-- des CHECK sont alignées sur l'enum Zod existant pour ne pas casser les call sites
-- qui envoient déjà ces champs (notamment PropertyAnnouncementTab).
--
-- Idempotente : ADD COLUMN IF NOT EXISTS partout, DROP CONSTRAINT IF EXISTS avant
-- chaque CREATE.

BEGIN;

-- ============================================
-- 1. AJOUT DES COLONNES
-- ============================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS mode_location TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT,
  ADD COLUMN IF NOT EXISTS available_from DATE,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================
-- 2. CHECK CONSTRAINTS — alignées sur l'enum Zod
-- ============================================
-- Source des valeurs : lib/validations/index.ts:568-569
--   mode_location : longue_duree, courte_duree, colocation, commercial, parking
--   visibility    : public, private

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_mode_location_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_mode_location_check
  CHECK (mode_location IS NULL OR mode_location IN (
    'longue_duree',
    'courte_duree',
    'colocation',
    'commercial',
    'parking'
  ));

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_visibility_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_visibility_check
  CHECK (visibility IS NULL OR visibility IN ('public', 'private'));

-- ============================================
-- 3. DOCUMENTATION
-- ============================================

COMMENT ON COLUMN properties.mode_location IS
  'Mode de location (longue_duree, courte_duree, colocation, commercial, parking). Source : PublishStep + PropertyAnnouncementTab.';
COMMENT ON COLUMN properties.visibility IS
  'Visibilité de l''annonce (public, private). Saisie via PublishStep.';
COMMENT ON COLUMN properties.available_from IS
  'Date à partir de laquelle le bien est disponible à la location.';
COMMENT ON COLUMN properties.description IS
  'Description longue de l''annonce. Saisie via PropertyAnnouncementTab.';

-- ============================================
-- 4. INDEX (faible cardinalité, optionnel)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_properties_visibility_etat
  ON properties(visibility, etat)
  WHERE deleted_at IS NULL;

COMMIT;
