-- ====================================================================
-- Sprint B2 — Phase 1 SAFE — Batch 5/10
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
-- Migration: 20260321000000_drop_invoice_trigger_sota2026.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260321000000_drop_invoice_trigger_sota2026.sql'; END $pre$;

-- SOTA 2026: Supprimer le trigger SQL redondant pour la facture initiale.
-- Le service TS ensureInitialInvoiceForLease() (appele par handleLeaseFullySigned)
-- est desormais le seul chemin de creation de la facture initiale.
-- Ce trigger creait un doublon et rendait le flux confus.

DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;

-- Supprimer egalement la fonction associee si elle existe
DROP FUNCTION IF EXISTS fn_generate_initial_invoice_on_fully_signed() CASCADE;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260321000000', 'drop_invoice_trigger_sota2026')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260321000000_drop_invoice_trigger_sota2026.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260321100000_fix_cron_post_refactoring_sota2026.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260321100000_fix_cron_post_refactoring_sota2026.sql'; END $pre$;

-- ============================================
-- Migration corrective : SOTA 2026 post-refactoring
-- Date : 2026-03-21
-- Description :
--   1. Supprime le job generate-monthly-invoices (route supprimee en P3)
--   2. Ajoute le job process-outbox pour le processeur outbox asynchrone
-- ============================================

-- 1. Supprimer le job pointant vers la route supprimee
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'generate-monthly-invoices';

-- 2. Ajouter le processeur outbox (toutes les 5 minutes)
SELECT cron.schedule('process-outbox', '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/process-outbox',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260321100000', 'fix_cron_post_refactoring_sota2026')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260321100000_fix_cron_post_refactoring_sota2026.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260324100000_prevent_duplicate_payments.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260324100000_prevent_duplicate_payments.sql'; END $pre$;

-- ============================================
-- Migration : Anti-doublon paiements
-- Date : 2026-03-24
-- Description :
--   1. Contrainte UNIQUE partielle sur payments : un seul paiement pending par facture
--   2. Empêche la race condition qui a causé le double paiement sur bail da2eb9da
-- ============================================

-- Un seul paiement 'pending' par facture à la fois
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_pending_per_invoice
  ON payments (invoice_id)
  WHERE statut = 'pending';

COMMENT ON INDEX idx_payments_one_pending_per_invoice
  IS 'Empêche plusieurs paiements pending simultanés sur la même facture (anti-doublon)';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260324100000', 'prevent_duplicate_payments')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260324100000_prevent_duplicate_payments.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260326022700_migrate_tenant_documents.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260326022700_migrate_tenant_documents.sql'; END $pre$;

-- Migration: Unifier tenant_documents dans la table documents
-- Les CNI et autres pieces d'identite locataire sont dans tenant_documents
-- mais invisibles dans le systeme unifie. Cette migration les copie.

DO $$
DECLARE
  migrated_count INT := 0;
BEGIN
  -- Verifier que tenant_documents existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'tenant_documents'
  ) THEN
    RAISE NOTICE 'Table tenant_documents absente, rien a migrer';
    RETURN;
  END IF;

  -- Copier les documents qui ne sont pas deja dans documents (par storage_path)
  INSERT INTO documents (
    type, category, title, original_filename,
    tenant_id, owner_id,
    storage_path, file_size, mime_type,
    uploaded_by, is_generated, ged_status,
    visible_tenant, verification_status,
    metadata, created_at, updated_at
  )
  SELECT
    CASE
      WHEN td.document_type ILIKE '%recto%' OR td.document_type = 'cni_recto' THEN 'cni_recto'
      WHEN td.document_type ILIKE '%verso%' OR td.document_type = 'cni_verso' THEN 'cni_verso'
      WHEN td.document_type = 'passeport' THEN 'passeport'
      WHEN td.document_type = 'titre_sejour' THEN 'titre_sejour'
      WHEN td.document_type ILIKE '%identit%' THEN 'piece_identite'
      ELSE COALESCE(td.document_type, 'autre')
    END AS type,
    'identite' AS category,
    CASE
      WHEN td.document_type ILIKE '%recto%' OR td.document_type = 'cni_recto'
        THEN 'Carte d''identite (recto)'
      WHEN td.document_type ILIKE '%verso%' OR td.document_type = 'cni_verso'
        THEN 'Carte d''identite (verso)'
      WHEN td.document_type = 'passeport' THEN 'Passeport'
      WHEN td.document_type = 'titre_sejour' THEN 'Titre de sejour'
      ELSE COALESCE(td.file_name, 'Document identite')
    END AS title,
    td.file_name AS original_filename,
    td.tenant_profile_id AS tenant_id,
    NULL AS owner_id,
    td.file_path AS storage_path,
    td.file_size,
    td.mime_type,
    td.uploaded_by,
    false AS is_generated,
    'active' AS ged_status,
    true AS visible_tenant,
    CASE WHEN td.is_valid = true THEN 'verified' ELSE 'pending' END AS verification_status,
    jsonb_build_object(
      'migrated_from', 'tenant_documents',
      'original_id', td.id,
      'ocr_confidence', td.ocr_confidence,
      'extracted_data', td.extracted_data
    ) AS metadata,
    td.created_at,
    COALESCE(td.updated_at, td.created_at)
  FROM tenant_documents td
  WHERE NOT EXISTS (
    SELECT 1 FROM documents d
    WHERE d.storage_path = td.file_path
  )
  AND td.file_path IS NOT NULL
  AND td.file_path != '';

  GET DIAGNOSTICS migrated_count = ROW_COUNT;

  RAISE NOTICE 'Migration tenant_documents: % documents copies vers documents', migrated_count;

  -- Le trigger auto_fill_document_fk completera owner_id et property_id
  -- via lease_signers si disponible
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260326022700', 'migrate_tenant_documents')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260326022700_migrate_tenant_documents.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260326205416_add_agency_role_to_handle_new_user.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260326205416_add_agency_role_to_handle_new_user.sql'; END $pre$;

-- ============================================
-- Migration: Ajouter agency au trigger handle_new_user
-- Date: 2026-03-26
-- Description: Le trigger acceptait admin/owner/tenant/provider/guarantor/syndic.
--              Le role agency etait silencieusement converti en tenant.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
BEGIN
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (tous les roles supportes par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Inserer le profil avec toutes les donnees
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur.
Lit le role et les informations personnelles depuis les raw_user_meta_data.
Supporte tous les roles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260326205416', 'add_agency_role_to_handle_new_user')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260326205416_add_agency_role_to_handle_new_user.sql'; END $post$;

COMMIT;

-- END OF BATCH 5/10 (Phase 1 SAFE)
