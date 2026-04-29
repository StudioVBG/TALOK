-- Migration : Tracer la source d'un bien importé depuis une annonce
-- ============================================
-- Contexte : la route POST /api/scrape (app/api/scrape/route.ts) extrait déjà
-- `source_url` et `source_site` dans son payload (lignes 168-169, 1319-1320),
-- mais ces champs n'étaient pas persistés dans `properties`. Conséquences :
--   1. Aucune traçabilité de l'origine d'un bien (audit, support).
--   2. Aucun moyen de détecter qu'un même owner réimporte la même URL et
--      crée un doublon silencieux.
--
-- Cette migration ajoute les deux colonnes et un index pour une détection
-- rapide de doublon par (owner_id, source_url) côté API.
--
-- Idempotente : ADD COLUMN IF NOT EXISTS partout, CREATE INDEX IF NOT EXISTS.

BEGIN;

-- ============================================
-- 1. AJOUT DES COLONNES
-- ============================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_site TEXT;

-- ============================================
-- 2. DOCUMENTATION
-- ============================================

COMMENT ON COLUMN properties.source_url IS
  'URL de l''annonce d''origine si le bien a été créé via /api/scrape (Importer une annonce).';
COMMENT ON COLUMN properties.source_site IS
  'Site source détecté (leboncoin, seloger, pap, orpi, century21, laforet, generic, etc.).';

-- ============================================
-- 3. INDEX — détection de doublon par owner
-- ============================================
-- Sert à `/api/scrape` pour répondre `duplicate: { property_id }` quand un
-- owner réimporte une URL déjà liée à l'un de ses biens non supprimés.

CREATE INDEX IF NOT EXISTS idx_properties_owner_source_url
  ON properties(owner_id, source_url)
  WHERE source_url IS NOT NULL AND deleted_at IS NULL;

COMMIT;
