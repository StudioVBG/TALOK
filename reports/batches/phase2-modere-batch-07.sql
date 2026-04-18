-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 7/15
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
-- Migration: 20260323000000_fix_document_visibility_and_dedup.sql
-- Risk: MODERE
-- Why: +1 policies, -1 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260323000000_fix_document_visibility_and_dedup.sql'; END $pre$;

-- Migration: Fix document visibility RLS + add deduplication constraint
-- 1) RLS: tenant_id match must also respect visible_tenant
-- 2) Unique partial index to prevent duplicate quittances per payment
-- 3) Unique partial index to prevent duplicate attestations per handover

-- ============================================================
-- 1. Fix RLS: tenant with tenant_id = user MUST still respect visible_tenant
-- Previously: tenant_id = user_profile_id() bypassed visible_tenant = false
-- ============================================================

DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON documents;

CREATE POLICY "Tenants can read visible lease documents"
  ON documents FOR SELECT
  USING (
    -- Tenant direct match: must respect visible_tenant
    (
      tenant_id = public.user_profile_id()
      AND visible_tenant IS NOT FALSE
    )
    -- Tenant via lease signer: must respect visible_tenant
    OR (
      visible_tenant = true
      AND lease_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM lease_signers ls
        JOIN profiles p ON p.id = ls.profile_id
        WHERE ls.lease_id = documents.lease_id
          AND p.id = public.user_profile_id()
          AND ls.role IN ('locataire_principal', 'locataire', 'colocataire')
      )
    )
    -- Owner direct match
    OR owner_id = public.user_profile_id()
    -- Owner via property
    OR (
      property_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = documents.property_id
          AND p.owner_id = public.user_profile_id()
      )
    )
    -- Admin
    OR public.user_role() = 'admin'
  );

-- ============================================================
-- 2. Unique partial index: one quittance per payment_id
-- Prevents race-condition duplicates in receipt generation
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_quittance_payment
  ON documents ((metadata->>'payment_id'))
  WHERE type = 'quittance'
    AND metadata->>'payment_id' IS NOT NULL;

-- ============================================================
-- 3. Unique partial index: one attestation per handover_id
-- Prevents duplicate key handover attestations
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_attestation_handover
  ON documents ((metadata->>'handover_id'))
  WHERE type = 'attestation_remise_cles'
    AND metadata->>'handover_id' IS NOT NULL;

-- ============================================================
-- 4. Index for document-access helper: lookup by storage_path
-- Used by the unified access check when path doesn't match known patterns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_documents_storage_path
  ON documents (storage_path)
  WHERE storage_path IS NOT NULL;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260323000000', 'fix_document_visibility_and_dedup')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260323000000_fix_document_visibility_and_dedup.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260326022619_fix_documents_bucket_mime.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260326022619_fix_documents_bucket_mime.sql'; END $pre$;

-- Fix: Aligner les MIME types du bucket storage avec lib/documents/constants.ts
-- Bug: Word/Excel etaient acceptes par le code mais rejetes par le bucket

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
]::text[],
file_size_limit = 52428800  -- 50 Mo
WHERE id = 'documents';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260326022619', 'fix_documents_bucket_mime')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260326022619_fix_documents_bucket_mime.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260326022800_create_document_links.sql
-- Risk: MODERE
-- Why: +3 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260326022800_create_document_links.sql'; END $pre$;

-- Table document_links: liens de partage temporaires
-- Utilisee par POST /api/documents/[id]/download et /api/documents/[id]/copy-link

CREATE TABLE IF NOT EXISTS document_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  max_views INTEGER DEFAULT 10,
  view_count INTEGER NOT NULL DEFAULT 0,
  accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_links_token ON document_links(token);
CREATE INDEX IF NOT EXISTS idx_document_links_document_id ON document_links(document_id);
CREATE INDEX IF NOT EXISTS idx_document_links_expires_at ON document_links(expires_at);

-- RLS
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document links" ON document_links
  FOR SELECT TO authenticated
  USING (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_links.document_id
      AND (d.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR d.tenant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can create document links" ON document_links
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access document_links" ON document_links
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260326022800', 'create_document_links')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260326022800_create_document_links.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260326023000_fix_document_titles.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260326023000_fix_document_titles.sql'; END $pre$;

-- Fix document titles for existing records with NULL, screenshot names, or raw technical names
-- Uses TYPE_TO_LABEL mapping from lib/documents/constants.ts as source of truth

UPDATE documents SET title = CASE
  WHEN type = 'cni_recto' THEN 'Carte d''identite (recto)'
  WHEN type = 'cni_verso' THEN 'Carte d''identite (verso)'
  WHEN type = 'attestation_assurance' THEN 'Attestation d''assurance'
  WHEN type = 'assurance_pno' THEN 'Assurance PNO'
  WHEN type = 'bail' THEN 'Contrat de bail'
  WHEN type = 'avenant' THEN 'Avenant au bail'
  WHEN type = 'engagement_garant' THEN 'Engagement de caution'
  WHEN type = 'bail_signe_locataire' THEN 'Bail signe (locataire)'
  WHEN type = 'bail_signe_proprietaire' THEN 'Bail signe (proprietaire)'
  WHEN type = 'piece_identite' THEN 'Piece d''identite'
  WHEN type = 'passeport' THEN 'Passeport'
  WHEN type = 'titre_sejour' THEN 'Titre de sejour'
  WHEN type = 'quittance' THEN 'Quittance de loyer'
  WHEN type = 'facture' THEN 'Facture'
  WHEN type = 'rib' THEN 'RIB'
  WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
  WHEN type = 'bulletin_paie' THEN 'Bulletin de paie'
  WHEN type = 'attestation_loyer' THEN 'Attestation de loyer'
  WHEN type = 'justificatif_revenus' THEN 'Justificatif de revenus'
  WHEN type = 'diagnostic' THEN 'Diagnostic'
  WHEN type = 'dpe' THEN 'DPE'
  WHEN type = 'diagnostic_gaz' THEN 'Diagnostic gaz'
  WHEN type = 'diagnostic_electricite' THEN 'Diagnostic electricite'
  WHEN type = 'diagnostic_plomb' THEN 'Diagnostic plomb'
  WHEN type = 'diagnostic_amiante' THEN 'Diagnostic amiante'
  WHEN type = 'diagnostic_termites' THEN 'Diagnostic termites'
  WHEN type = 'diagnostic_performance' THEN 'Diagnostic de performance'
  WHEN type = 'erp' THEN 'Etat des risques (ERP)'
  WHEN type = 'EDL_entree' THEN 'Etat des lieux d''entree'
  WHEN type = 'EDL_sortie' THEN 'Etat des lieux de sortie'
  WHEN type = 'inventaire' THEN 'Inventaire mobilier'
  WHEN type = 'devis' THEN 'Devis'
  WHEN type = 'ordre_mission' THEN 'Ordre de mission'
  WHEN type = 'rapport_intervention' THEN 'Rapport d''intervention'
  WHEN type = 'taxe_fonciere' THEN 'Taxe fonciere'
  WHEN type = 'copropriete' THEN 'Document copropriete'
  WHEN type = 'proces_verbal' THEN 'Proces-verbal'
  WHEN type = 'appel_fonds' THEN 'Appel de fonds'
  WHEN type = 'photo' THEN 'Photo'
  WHEN type = 'courrier' THEN 'Courrier'
  WHEN type = 'autre' THEN 'Autre document'
  ELSE title
END
WHERE title IS NULL
   OR title ~ '^Capture d.cran'
   OR title ~ '^[A-Z_]+$';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260326023000', 'fix_document_titles')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260326023000_fix_document_titles.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260327143000_add_site_config.sql
-- Risk: MODERE
-- Why: +5 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260327143000_add_site_config.sql'; END $pre$;

-- Table de configuration du site vitrine
CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  label TEXT,           -- Label lisible pour l'admin
  section TEXT,         -- Groupe dans l'UI admin
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS : lecture publique, écriture admin uniquement
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON site_config FOR SELECT USING (true);
CREATE POLICY "Admin write" ON site_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'platform_admin')
    )
  );

-- Valeurs initiales (images Unsplash par défaut)
INSERT INTO site_config (key, label, section, value) VALUES
  -- Section "Arguments" (4 cartes)
  ('landing_arg_time_img',
   'Argument — Gagnez 3h (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=80'),

  ('landing_arg_money_img',
   'Argument — Économisez 2000€ (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'),

  ('landing_arg_contract_img',
   'Argument — Contrats 5 min (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80'),

  ('landing_arg_sleep_img',
   'Argument — Dormez tranquille (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1541480601022-2308c0f02487?w=600&q=80'),

  -- Section "Profils"
  ('landing_profile_owner_img',
   'Profil — Propriétaire particulier',
   'Profils',
   'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80'),

  ('landing_profile_investor_img',
   'Profil — Investisseur / SCI',
   'Profils',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'),

  ('landing_profile_agency_img',
   'Profil — Agence / Gestionnaire',
   'Profils',
   'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80'),

  -- Section "Avant / Après"
  ('landing_beforeafter_img',
   'Avant/Après — Photo de fond',
   'Avant-Après',
   'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80')

ON CONFLICT (key) DO NOTHING;

-- Bucket public pour les images landing
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-images', 'landing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Politique de lecture publique sur le bucket
CREATE POLICY "Public read landing images"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-images');

-- Politique d'upload admin
CREATE POLICY "Admin upload landing images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'landing-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'platform_admin')
  )
);

-- Politique de suppression admin
CREATE POLICY "Admin delete landing images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'landing-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'platform_admin')
  )
);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260327143000', 'add_site_config')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260327143000_add_site_config.sql'; END $post$;

COMMIT;

-- END OF BATCH 7/15 (Phase 2 MODERE)
