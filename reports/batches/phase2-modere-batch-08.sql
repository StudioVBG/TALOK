-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 8/15
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260328000000_fix_visible_tenant_documents.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260328000000_fix_visible_tenant_documents.sql'; END $pre$;

-- FIX 4: Ensure mandatory lease documents are visible to tenants
-- Documents types contrat_bail, edl_entree, assurance_habitation
-- must have visible_tenant = true so tenants can see them.

UPDATE documents
SET visible_tenant = true,
    updated_at = now()
WHERE type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260328000000', 'fix_visible_tenant_documents')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260328000000_fix_visible_tenant_documents.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260328042538_update_argument_images.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260328042538_update_argument_images.sql'; END $pre$;

-- Mise à jour des images par défaut des 4 cartes Arguments
UPDATE site_config SET value = 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&q=80'
WHERE key = 'landing_arg_time_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'
WHERE key = 'landing_arg_money_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80'
WHERE key = 'landing_arg_contract_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80'
WHERE key = 'landing_arg_sleep_img';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260328042538', 'update_argument_images')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260328042538_update_argument_images.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260328100000_create_site_content.sql
-- Risk: MODERE
-- Why: +2 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260328100000_create_site_content.sql'; END $pre$;

-- ============================================
-- Migration: site_content — CMS léger pour pages marketing
-- Date: 2026-03-28
-- Auteur: Claude
-- ============================================

CREATE TABLE IF NOT EXISTS site_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identification
  page_slug TEXT NOT NULL,
  section_key TEXT NOT NULL DEFAULT 'content_body',

  -- Contenu
  content_type TEXT NOT NULL DEFAULT 'markdown',
  content TEXT NOT NULL,

  -- Métadonnées
  title TEXT,
  meta_description TEXT,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),

  -- Versioning
  version INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(page_slug, section_key, version)
);

-- RLS
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_content_public_read" ON site_content
  FOR SELECT USING (is_published = true);

CREATE POLICY "site_content_admin_all" ON site_content
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');

-- Index pour les requêtes fréquentes
CREATE INDEX idx_site_content_slug ON site_content(page_slug, section_key)
  WHERE is_published = true;

-- Commentaire
COMMENT ON TABLE site_content IS 'CMS léger pour les pages marketing et légales de talok.fr';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260328100000', 'create_site_content')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260328100000_create_site_content.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260328100000_fix_visible_tenant_documents.sql
-- Note: file on disk is 20260328100000_fix_visible_tenant_documents.sql but will be renamed to 20260328100001_fix_visible_tenant_documents.sql
-- Risk: MODERE
-- Why: ALTER column (type/constraint), UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260328100000_fix_visible_tenant_documents.sql'; END $pre$;

-- Migration: Ensure key lease documents are visible to tenants
-- Fixes: Documents created before visible_tenant was properly set

-- Set visible_tenant = true for all tenant-relevant document types
UPDATE documents
SET visible_tenant = true
WHERE type IN ('bail', 'contrat_bail', 'EDL_entree', 'EDL_sortie', 'edl_entree', 'edl_sortie', 'quittance', 'attestation_remise_cles', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

-- Corriger les documents obligatoires du bail test da2eb9da
UPDATE documents
SET visible_tenant = true, updated_at = now()
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
  AND type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

-- Set default visible_tenant = true for new documents via column default
ALTER TABLE documents ALTER COLUMN visible_tenant SET DEFAULT true;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260328100001', 'fix_visible_tenant_documents')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260328100000_fix_visible_tenant_documents.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260329052631_fix_contrat_bail_visible_tenant.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260329052631_fix_contrat_bail_visible_tenant.sql'; END $pre$;

-- Migration: Rendre les documents de bail visibles aux locataires
-- Contexte: Le route /seal ne définissait pas visible_tenant=true sur les documents de bail
-- Impact: Les locataires ne voyaient pas leur bail dans /tenant/documents

-- S'assurer que tous les documents bail liés à un lease ont visible_tenant=true
UPDATE documents
SET
  visible_tenant = true,
  title = CASE
    WHEN title = 'Bail de location signé' THEN 'Contrat de bail signé'
    ELSE title
  END,
  original_filename = COALESCE(
    original_filename,
    'bail_signe_' || lease_id::text || '.html'
  ),
  updated_at = now()
WHERE
  type = 'bail'
  AND lease_id IS NOT NULL
  AND (visible_tenant IS NULL OR visible_tenant = false);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260329052631', 'fix_contrat_bail_visible_tenant')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260329052631_fix_contrat_bail_visible_tenant.sql'; END $post$;

COMMIT;

-- END OF BATCH 8/15 (Phase 2 MODERE)
