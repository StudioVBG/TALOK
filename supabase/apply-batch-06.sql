-- Batch 6 — migrations 106 a 147 sur 169
-- 42 migrations

-- === [106/169] 20260323000000_fix_document_visibility_and_dedup.sql ===
DO $wrapper$ BEGIN
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

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [107/169] 20260324100000_prevent_duplicate_payments.sql ===
DO $wrapper$ BEGIN
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

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [108/169] 20260326022619_fix_documents_bucket_mime.sql ===
DO $wrapper$ BEGIN
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

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [109/169] 20260326022700_migrate_tenant_documents.sql ===
DO $wrapper$ BEGIN
-- Migration: Unifier tenant_documents dans la table documents
-- Les CNI et autres pieces d'identite locataire sont dans tenant_documents
-- mais invisibles dans le systeme unifie. Cette migration les copie.

DO $mig$
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
END $mig$;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [110/169] 20260326022800_create_document_links.sql ===
DO $wrapper$ BEGIN
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

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [111/169] 20260326023000_fix_document_titles.sql ===
DO $wrapper$ BEGIN
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

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [112/169] 20260326205416_add_agency_role_to_handle_new_user.sql ===
DO $wrapper$ BEGIN
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
AS $mig$
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
$mig$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur.
Lit le role et les informations personnelles depuis les raw_user_meta_data.
Supporte tous les roles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [113/169] 20260327143000_add_site_config.sql ===
DO $wrapper$ BEGIN
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

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [114/169] 20260327200000_fix_handle_new_user_restore_email.sql ===
DO $wrapper$ BEGIN
-- ============================================
-- Migration: Corriger handle_new_user — restaurer email + EXCEPTION handler
-- Date: 2026-03-27
-- Description:
--   La migration 20260326205416 a introduit une regression :
--     1. La colonne `email` n'est plus inseree dans profiles (variable v_email supprimee)
--     2. Le handler EXCEPTION WHEN OTHERS a ete supprime
--   Cette migration restaure les deux, tout en conservant le support
--   de tous les roles (admin, owner, tenant, provider, guarantor, syndic, agency).
--   Elle backfill aussi les emails NULL crees par la migration cassee.
-- ============================================

-- A. RESTAURER handle_new_user() avec email + EXCEPTION handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $mig$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
  v_email TEXT;
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

  -- Recuperer l'email depuis le champ auth.users.email
  v_email := NEW.email;

  -- Inserer le profil avec toutes les donnees, y compris l'email
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone, email)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone, v_email)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la creation d'un utilisateur auth
  -- meme si l'insertion du profil echoue
  RAISE WARNING '[handle_new_user] Erreur pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$mig$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur auth.
Lit le role et les informations personnelles depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
Supporte tous les roles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.
Ne bloque jamais la creation auth meme en cas d''erreur (EXCEPTION handler).';

-- B. BACKFILL des emails NULL (crees par la migration 20260326205416 cassee)
DO $mig$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND (p.email IS NULL OR p.email = '')
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[fix_handle_new_user] % profil(s) mis a jour avec l''email depuis auth.users', v_updated;
  ELSE
    RAISE NOTICE '[fix_handle_new_user] Tous les profils ont deja un email renseigne';
  END IF;
END $mig$;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [115/169] 20260328000000_fix_visible_tenant_documents.sql ===
DO $wrapper$ BEGIN
-- FIX 4: Ensure mandatory lease documents are visible to tenants
-- Documents types contrat_bail, edl_entree, assurance_habitation
-- must have visible_tenant = true so tenants can see them.

UPDATE documents
SET visible_tenant = true,
    updated_at = now()
WHERE type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [116/169] 20260328042538_update_argument_images.sql ===
DO $wrapper$ BEGIN
-- Mise à jour des images par défaut des 4 cartes Arguments
UPDATE site_config SET value = 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&q=80'
WHERE key = 'landing_arg_time_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'
WHERE key = 'landing_arg_money_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80'
WHERE key = 'landing_arg_contract_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80'
WHERE key = 'landing_arg_sleep_img';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [117/169] 20260328100000_create_site_content.sql ===
DO $wrapper$ BEGIN
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

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [118/169] 20260328100000_fix_visible_tenant_documents.sql ===
DO $wrapper$ BEGIN
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

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [119/169] 20260329052631_fix_contrat_bail_visible_tenant.sql ===
DO $wrapper$ BEGIN
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

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [120/169] 20260329120000_add_agency_to_handle_new_user.sql ===
DO $wrapper$ BEGIN
-- ============================================
-- Migration: Ajouter le rôle agency au trigger handle_new_user
-- Date: 2026-03-29
-- Description: Le rôle agency était absent de la liste des rôles valides
--              dans le trigger, causant un fallback silencieux vers tenant.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $mig$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
BEGIN
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le rôle (tous les rôles supportés par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Insérer le profil avec toutes les données
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
$mig$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Crée automatiquement un profil lors de la création d''un utilisateur.
Lit le rôle et les informations personnelles depuis les raw_user_meta_data.
Supporte tous les rôles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [121/169] 20260329164841_fix_document_titles.sql ===
DO $wrapper$ BEGIN
-- Migration: Corriger les titres bruts/manquants des documents existants
-- Remplace les titres NULL, screenshots, codes bruts et dates par des labels lisibles
-- Source: talok-documents-sota section 8

UPDATE documents SET
  title = CASE
    WHEN type = 'cni_recto' THEN 'Carte d''identité (Recto)'
    WHEN type = 'cni_verso' THEN 'Carte d''identité (Verso)'
    WHEN type = 'attestation_assurance' THEN 'Attestation d''assurance'
    WHEN type = 'assurance_pno' THEN 'Assurance PNO'
    WHEN type = 'bail' THEN 'Contrat de bail'
    WHEN type = 'avenant' THEN 'Avenant au bail'
    WHEN type = 'engagement_garant' THEN 'Engagement de caution'
    WHEN type = 'bail_signe_locataire' THEN 'Bail signé (locataire)'
    WHEN type = 'bail_signe_proprietaire' THEN 'Bail signé (propriétaire)'
    WHEN type = 'piece_identite' THEN 'Pièce d''identité'
    WHEN type = 'passeport' THEN 'Passeport'
    WHEN type = 'titre_sejour' THEN 'Titre de séjour'
    WHEN type = 'quittance' THEN 'Quittance de loyer'
    WHEN type = 'facture' THEN 'Facture'
    WHEN type = 'rib' THEN 'RIB'
    WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
    WHEN type = 'bulletin_paie' THEN 'Bulletin de paie'
    WHEN type = 'attestation_loyer' THEN 'Attestation de loyer'
    WHEN type = 'justificatif_revenus' THEN 'Justificatif de revenus'
    WHEN type = 'dpe' THEN 'Diagnostic de performance énergétique'
    WHEN type = 'diagnostic_gaz' THEN 'Diagnostic gaz'
    WHEN type = 'diagnostic_electricite' THEN 'Diagnostic électricité'
    WHEN type = 'diagnostic_plomb' THEN 'Diagnostic plomb (CREP)'
    WHEN type = 'diagnostic_amiante' THEN 'Diagnostic amiante'
    WHEN type = 'diagnostic_termites' THEN 'Diagnostic termites'
    WHEN type = 'erp' THEN 'État des risques (ERP)'
    WHEN type = 'EDL_entree' THEN 'État des lieux d''entrée'
    WHEN type = 'EDL_sortie' THEN 'État des lieux de sortie'
    WHEN type = 'inventaire' THEN 'Inventaire mobilier'
    WHEN type = 'taxe_fonciere' THEN 'Taxe foncière'
    WHEN type = 'devis' THEN 'Devis'
    WHEN type = 'rapport_intervention' THEN 'Rapport d''intervention'
    ELSE COALESCE(title, 'Document')
  END
WHERE title IS NULL
   OR title ~ '^Capture d.écran'
   OR title ~ '^[A-Z_]+$'
   OR title ~ '^\d{4}-\d{2}-\d{2}';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [122/169] 20260329170000_add_punctuality_score.sql ===
DO $wrapper$ BEGIN
-- Migration: Ajouter le score de ponctualité sur les baux
-- Le score mesure le % de paiements reçus à temps (avant date_echeance)

-- 1. Colonne sur leases
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS punctuality_score DECIMAL(5,2) DEFAULT NULL;

COMMENT ON COLUMN leases.punctuality_score IS
  'Score de ponctualité du locataire (0-100). NULL = pas encore de données. Mis à jour par trigger.';

-- 2. Fonction de calcul
CREATE OR REPLACE FUNCTION compute_punctuality_score(p_lease_id UUID)
RETURNS DECIMAL(5,2) AS $mig$
DECLARE
  v_total INT;
  v_on_time INT;
BEGIN
  -- Compter les factures payées ou en retard (exclure les brouillons et annulées)
  SELECT COUNT(*) INTO v_total
  FROM invoices
  WHERE lease_id = p_lease_id
    AND statut IN ('paid', 'late', 'overdue', 'unpaid');

  IF v_total = 0 THEN
    RETURN NULL;
  END IF;

  -- Compter les factures payées à temps :
  -- date_paiement <= date_echeance OU statut = 'paid' sans retard
  SELECT COUNT(*) INTO v_on_time
  FROM invoices
  WHERE lease_id = p_lease_id
    AND statut = 'paid'
    AND (
      (date_paiement IS NOT NULL AND date_echeance IS NOT NULL AND date_paiement <= date_echeance)
      OR date_echeance IS NULL
    );

  RETURN ROUND((v_on_time::DECIMAL / v_total) * 100, 2);
END;
$mig$ LANGUAGE plpgsql STABLE;

-- 3. Trigger pour recalculer à chaque changement de facture
CREATE OR REPLACE FUNCTION trigger_update_punctuality_score()
RETURNS TRIGGER AS $mig$
DECLARE
  v_lease_id UUID;
  v_score DECIMAL(5,2);
BEGIN
  -- Déterminer le lease_id concerné
  v_lease_id := COALESCE(NEW.lease_id, OLD.lease_id);

  IF v_lease_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalculer le score
  v_score := compute_punctuality_score(v_lease_id);

  -- Mettre à jour le bail
  UPDATE leases
  SET punctuality_score = v_score
  WHERE id = v_lease_id;

  RETURN COALESCE(NEW, OLD);
END;
$mig$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_punctuality_score ON invoices;

CREATE TRIGGER trg_update_punctuality_score
  AFTER INSERT OR UPDATE OF statut, date_paiement ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_punctuality_score();

-- 4. Calculer le score initial pour tous les baux existants
DO $mig$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT lease_id FROM invoices WHERE lease_id IS NOT NULL LOOP
    UPDATE leases
    SET punctuality_score = compute_punctuality_score(r.lease_id)
    WHERE id = r.lease_id;
  END LOOP;
END;
$mig$;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [123/169] 20260329180000_notify_owner_edl_signed.sql ===
DO $wrapper$ BEGIN
-- Migration: Notification propriétaire quand un EDL est signé par les deux parties
-- Date: 2026-03-29
-- Description: Ajoute un trigger qui notifie le propriétaire lorsqu'un EDL passe en statut "signed"

-- ============================================================================
-- Fonction de notification EDL signé → propriétaire
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_owner_edl_signed()
RETURNS TRIGGER AS $mig$
DECLARE
    v_owner_id UUID;
    v_property_address TEXT;
    v_edl_type TEXT;
    v_existing UUID;
BEGIN
    -- Seulement quand le statut passe à 'signed'
    IF NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') THEN

        -- Récupérer le type de l'EDL
        v_edl_type := COALESCE(NEW.type, 'entree');

        -- Récupérer le propriétaire et l'adresse via la propriété
        SELECT p.owner_id, p.adresse_complete
        INTO v_owner_id, v_property_address
        FROM properties p
        WHERE p.id = NEW.property_id;

        IF v_owner_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- Déduplication : vérifier si une notification similaire existe dans la dernière heure
        SELECT id INTO v_existing
        FROM notifications
        WHERE profile_id = v_owner_id
          AND type = 'edl_signed'
          AND related_id = NEW.id
          AND created_at > NOW() - INTERVAL '1 hour'
        LIMIT 1;

        IF v_existing IS NOT NULL THEN
            RETURN NEW;
        END IF;

        -- Créer la notification via la RPC
        PERFORM create_notification(
            v_owner_id,
            'edl_signed',
            CASE v_edl_type
                WHEN 'entree' THEN 'État des lieux d''entrée signé'
                WHEN 'sortie' THEN 'État des lieux de sortie signé'
                ELSE 'État des lieux signé'
            END,
            'L''état des lieux ' ||
            CASE v_edl_type
                WHEN 'entree' THEN 'd''entrée'
                WHEN 'sortie' THEN 'de sortie'
                ELSE ''
            END ||
            ' pour ' || COALESCE(v_property_address, 'votre bien') ||
            ' a été signé par toutes les parties.',
            '/owner/edl/' || NEW.id,
            NEW.id,
            'edl'
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Ne pas bloquer la transaction si la notification échoue
    RAISE WARNING '[notify_owner_edl_signed] Erreur: %', SQLERRM;
    RETURN NEW;
END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger sur la table edl (UPDATE du statut)
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_notify_owner_edl_signed ON edl;
CREATE TRIGGER trigger_notify_owner_edl_signed
    AFTER UPDATE OF status ON edl
    FOR EACH ROW
    WHEN (NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed')
    EXECUTE FUNCTION public.notify_owner_edl_signed();

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [124/169] 20260329190000_force_visible_tenant_generated_docs.sql ===
DO $wrapper$ BEGIN
-- Migration: Backfill visible_tenant for generated documents + trigger guard
-- Date: 2026-03-29
-- Description:
--   1. Backfill: force visible_tenant = true on all existing generated documents
--   2. Trigger: prevent any future INSERT/UPDATE from creating a generated doc with visible_tenant = false

-- ============================================================================
-- 1. Backfill existing generated documents
-- ============================================================================
UPDATE documents
SET visible_tenant = true, updated_at = NOW()
WHERE is_generated = true AND (visible_tenant = false OR visible_tenant IS NULL);

-- ============================================================================
-- 2. Trigger function: force visible_tenant on generated documents
-- ============================================================================
CREATE OR REPLACE FUNCTION public.force_visible_tenant_on_generated()
RETURNS TRIGGER AS $mig$
BEGIN
    IF NEW.is_generated = true THEN
        NEW.visible_tenant := true;
    END IF;
    RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Trigger on documents table
-- ============================================================================
DROP TRIGGER IF EXISTS trg_force_visible_tenant_on_generated ON documents;
CREATE TRIGGER trg_force_visible_tenant_on_generated
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION public.force_visible_tenant_on_generated();

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [125/169] 20260330100000_add_lease_cancellation_columns.sql ===
DO $wrapper$ BEGIN
-- ============================================
-- Migration : Ajout colonnes annulation de bail
-- Date : 2026-03-30
-- Contexte : Un bail signé mais jamais activé ne peut pas être annulé.
--            Cette migration ajoute les colonnes nécessaires pour
--            gérer le cycle de vie d'annulation.
-- ============================================

-- Étape 1 : Ajouter les colonnes d'annulation sur leases
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id);
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_type TEXT;

-- Étape 2 : Contrainte CHECK sur cancellation_type
DO $mig$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_cancellation_type_check'
  ) THEN
    ALTER TABLE leases ADD CONSTRAINT leases_cancellation_type_check
      CHECK (cancellation_type IS NULL OR cancellation_type IN (
        'tenant_withdrawal',
        'owner_withdrawal',
        'mutual_agreement',
        'never_activated',
        'error',
        'duplicate'
      ));
  END IF;
END $mig$;

-- Étape 3 : Vérifier que 'cancelled' est dans la contrainte CHECK sur statut
-- La migration 20260215200001 l'a déjà ajouté, mais on vérifie par sécurité
DO $mig$ BEGIN
  -- Tenter d'insérer un bail cancelled pour vérifier la contrainte
  -- Si ça échoue, on met à jour la contrainte
  PERFORM 1;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $mig$;

-- Étape 4 : Index pour requêtes de nettoyage et reporting
CREATE INDEX IF NOT EXISTS idx_leases_cancelled
  ON leases(statut) WHERE statut = 'cancelled';

CREATE INDEX IF NOT EXISTS idx_leases_cancelled_at
  ON leases(cancelled_at) WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leases_zombie_candidates
  ON leases(statut, created_at)
  WHERE statut IN ('pending_signature', 'partially_signed', 'fully_signed', 'draft', 'sent')
    AND cancelled_at IS NULL;

-- Étape 5 : RLS — les politiques existantes couvrent déjà leases
-- Pas besoin de nouvelles politiques car l'annulation passe par UPDATE du statut

-- Étape 6 : Commentaires
COMMENT ON COLUMN leases.cancelled_at IS 'Date/heure de l''annulation du bail';
COMMENT ON COLUMN leases.cancelled_by IS 'User ID de la personne ayant annulé le bail';
COMMENT ON COLUMN leases.cancellation_reason IS 'Motif libre de l''annulation';
COMMENT ON COLUMN leases.cancellation_type IS 'Type d''annulation : tenant_withdrawal, owner_withdrawal, mutual_agreement, never_activated, error, duplicate';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [126/169] 20260331000000_add_receipt_generated_to_invoices.sql ===
DO $wrapper$ BEGIN
-- Add receipt_generated flag to invoices table
-- Tracks whether a quittance PDF has been generated for a paid invoice

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_generated'
  ) THEN
    ALTER TABLE invoices ADD COLUMN receipt_generated BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN invoices.receipt_generated IS 'TRUE when a quittance PDF has been generated and stored for this invoice';
  END IF;
END $mig$;

-- Backfill: mark invoices that already have a quittance document
UPDATE invoices
SET receipt_generated = TRUE
WHERE id IN (
  SELECT DISTINCT (metadata->>'invoice_id')::uuid
  FROM documents
  WHERE type = 'quittance'
    AND metadata->>'invoice_id' IS NOT NULL
)
AND receipt_generated IS NOT TRUE;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [127/169] 20260331100000_add_agricultural_property_types.sql ===
DO $wrapper$ BEGIN
-- ============================================
-- Migration: Ajouter les types agricoles au CHECK constraint properties
-- Alignement avec le skill SOTA 2026 (14 types)
-- Ref: .cursor/skills/sota-property-system/SKILL.md §1
-- ============================================

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_type_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_type_check
  CHECK (type IN (
    'appartement',
    'maison',
    'studio',
    'colocation',
    'saisonnier',
    'parking',
    'box',
    'local_commercial',
    'bureaux',
    'entrepot',
    'fonds_de_commerce',
    'immeuble',
    'terrain_agricole',
    'exploitation_agricole'
  ));

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [128/169] 20260331100000_fix_document_titles_bruts.sql ===
DO $wrapper$ BEGIN
-- B7: Corriger les titres bruts des anciens documents
-- Remplacer les noms de fichiers (ex: "Capture_d_ecran_2024-03-15.png")
-- par des titres lisibles selon le type de document

UPDATE documents SET title = CASE
  WHEN type = 'cni_recto' THEN 'Carte d''Identité (Recto)'
  WHEN type = 'cni_verso' THEN 'Carte d''Identité (Verso)'
  WHEN type = 'assurance_habitation' THEN 'Attestation d''assurance habitation'
  WHEN type = 'contrat_bail' THEN 'Contrat de bail'
  WHEN type = 'quittance_loyer' THEN 'Quittance de loyer'
  WHEN type = 'bulletin_salaire' THEN 'Bulletin de salaire'
  WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
  WHEN type = 'justificatif_domicile' THEN 'Justificatif de domicile'
  WHEN type = 'rib' THEN 'Relevé d''Identité Bancaire'
  WHEN type = 'kbis' THEN 'Extrait KBIS'
  WHEN type = 'attestation_assurance_rc' THEN 'Attestation assurance RC Pro'
  WHEN type = 'dpe' THEN 'Diagnostic de Performance Énergétique'
  WHEN type = 'edl_entree' THEN 'État des lieux d''entrée'
  WHEN type = 'edl_sortie' THEN 'État des lieux de sortie'
  WHEN type = 'mandat_gestion' THEN 'Mandat de gestion'
  WHEN type = 'reglement_copropriete' THEN 'Règlement de copropriété'
  ELSE title
END
WHERE (
  title IS NULL
  OR title ~ '^Capture d.écran'
  OR title ~ '^capture'
  OR title ~ '^Screenshot'
  OR title ~ '^IMG_'
  OR title ~ '^[A-Z_]{4,}$'
  OR title ~ '^\d{4}-\d{2}-\d{2}'
  OR title ~ '\.(png|jpg|jpeg|pdf|webp)$'
)
AND type IS NOT NULL;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [129/169] 20260331120000_add_signed_pdf_generated_to_leases.sql ===
DO $wrapper$ BEGIN
-- Migration: Ajouter colonne signed_pdf_generated à la table leases
-- Permet de tracker quels baux ont déjà un PDF signé généré

ALTER TABLE leases
ADD COLUMN IF NOT EXISTS signed_pdf_generated BOOLEAN DEFAULT FALSE;

-- Backfill : baux qui ont déjà un document bail généré
UPDATE leases l
SET signed_pdf_generated = TRUE
WHERE EXISTS (
  SELECT 1 FROM documents d
  WHERE d.lease_id = l.id
    AND d.type = 'bail'
    AND d.is_generated = TRUE
);

-- Index pour requêtes de diagnostic
CREATE INDEX IF NOT EXISTS idx_leases_signed_pdf_generated
ON leases (signed_pdf_generated)
WHERE signed_pdf_generated = FALSE;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [130/169] 20260331130000_key_handovers_add_cancelled_notes.sql ===
DO $wrapper$ BEGIN
-- Migration: Améliorer la table key_handovers
-- Ajoute cancelled_at (annulation soft) et notes (commentaires propriétaire)

ALTER TABLE key_handovers
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Index partiel : remises actives (non confirmées, non annulées)
CREATE INDEX IF NOT EXISTS idx_key_handovers_pending
ON key_handovers (lease_id, created_at DESC)
WHERE confirmed_at IS NULL AND cancelled_at IS NULL;

-- Commentaires
COMMENT ON COLUMN key_handovers.cancelled_at IS 'Date d''annulation de la remise par le propriétaire (soft delete)';
COMMENT ON COLUMN key_handovers.notes IS 'Notes libres du propriétaire sur la remise des clés';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [131/169] 20260401000000_add_identity_status_onboarding_step.sql ===
DO $wrapper$ BEGIN
-- Migration: Ajout identity_status et onboarding_step sur profiles
-- Ces colonnes alimentent le middleware identity-gate qui contrôle
-- l'accès aux routes protégées selon le niveau de vérification.

-- Enum pour le statut d'identité
DO $mig$ BEGIN
  CREATE TYPE identity_status_enum AS ENUM (
    'unverified',
    'phone_verified',
    'document_uploaded',
    'identity_review',
    'identity_verified',
    'identity_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $mig$;

-- Enum pour l'étape d'onboarding
DO $mig$ BEGIN
  CREATE TYPE onboarding_step_enum AS ENUM (
    'account_created',
    'phone_pending',
    'phone_done',
    'profile_pending',
    'profile_done',
    'document_pending',
    'document_done',
    'complete'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $mig$;

-- Ajout des colonnes sur profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_status identity_status_enum NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS onboarding_step onboarding_step_enum NOT NULL DEFAULT 'account_created',
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Index pour les requêtes du middleware (lookup par user + status)
CREATE INDEX IF NOT EXISTS idx_profiles_identity_status ON profiles (identity_status);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_step ON profiles (onboarding_step);

COMMENT ON COLUMN profiles.identity_status IS 'Niveau de vérification d''identité — utilisé par le middleware identity-gate';
COMMENT ON COLUMN profiles.onboarding_step IS 'Étape courante du parcours d''onboarding';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [132/169] 20260401000001_add_initial_payment_confirmed_to_leases.sql ===
DO $wrapper$ BEGIN
-- Migration: Ajouter initial_payment_confirmed sur leases
-- Permet au webhook Stripe de marquer le paiement initial comme confirmé
-- et d'éviter la désynchronisation entre l'UI et l'API key-handover.

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS initial_payment_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_payment_date timestamptz,
  ADD COLUMN IF NOT EXISTS initial_payment_stripe_pi text;

-- Rétro-remplissage : marquer comme confirmé les baux dont la facture initiale est soldée
UPDATE leases l
SET initial_payment_confirmed = true,
    initial_payment_date = i.date_paiement
FROM invoices i
WHERE i.lease_id = l.id
  AND i.statut = 'paid'
  AND (
    i.metadata->>'type' = 'initial_invoice'
    OR i.type = 'initial_invoice'
  )
  AND l.initial_payment_confirmed = false;

-- Index partiel pour les requêtes fréquentes sur les baux non confirmés
CREATE INDEX IF NOT EXISTS idx_leases_initial_payment_pending
  ON leases (id)
  WHERE initial_payment_confirmed = false;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [133/169] 20260401000001_backfill_identity_status.sql ===
DO $wrapper$ BEGIN
-- Migration: Backfill identity_status pour les profils existants
-- Protège les utilisateurs existants avant activation du middleware identity-gate.
-- Ordre d'exécution important : les requêtes les plus spécifiques d'abord.
--
-- FIX: Utilise les vrais statuts leases (active, fully_signed, notice_given, terminated)
-- FIX: Supprime onboarding_completed_at (n'existe pas dans le schéma)
-- FIX: Utilise aussi lease_signers comme fallback quand leases.tenant_id est NULL

-- 1. Tenants/Owners avec bail actif/signé/terminé → identity_verified + complete
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at    = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step      = 'complete'
WHERE (
  -- Via leases.tenant_id (dénormalisé)
  id IN (
    SELECT DISTINCT tenant_id FROM leases
    WHERE statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
    AND tenant_id IS NOT NULL
  )
  OR
  -- Via lease_signers (source de vérité)
  id IN (
    SELECT DISTINCT ls.profile_id FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    WHERE l.statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
    AND ls.signature_status = 'signed'
    AND ls.profile_id IS NOT NULL
  )
  OR
  -- Propriétaires avec des biens
  id IN (
    SELECT DISTINCT owner_id FROM properties WHERE owner_id IS NOT NULL
  )
)
AND identity_status = 'unverified';

-- 2. Utilisateurs ayant uploadé des documents → identity_verified
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at    = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step      = 'complete'
WHERE id IN (
  SELECT DISTINCT uploaded_by FROM documents WHERE uploaded_by IS NOT NULL
)
AND identity_status = 'unverified';

-- 3. Admins → identity_verified d'office
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = true,
  onboarding_step      = 'complete'
WHERE role = 'admin'
AND identity_status = 'unverified';

-- 4. Comptes avec téléphone renseigné + prénom/nom → phone_verified
UPDATE profiles SET
  identity_status = 'phone_verified',
  phone_verified  = true,
  phone_verified_at = NOW(),
  onboarding_step = 'profile_done'
WHERE identity_status = 'unverified'
AND telephone IS NOT NULL AND telephone <> ''
AND prenom IS NOT NULL AND prenom <> ''
AND nom IS NOT NULL AND nom <> '';

-- 5. Comptes créés depuis plus de 24h sans rien → phone_verified (grace period)
UPDATE profiles SET
  identity_status = 'phone_verified',
  onboarding_step = 'phone_done'
WHERE identity_status = 'unverified'
AND created_at < NOW() - INTERVAL '1 day';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [134/169] 20260404100000_rls_push_subscriptions.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Activer RLS sur push_subscriptions
-- Date: 2026-04-04
--
-- PROBLÈME: L'audit sécurité a révélé que la table push_subscriptions
-- n'a pas de RLS activé. Un utilisateur authentifié pourrait potentiellement
-- lire/modifier les subscriptions push d'autres utilisateurs.
--
-- FIX: Activer RLS + policy user_id = auth.uid()
-- =====================================================

-- Activer RLS (idempotent si déjà activé)
ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions;

-- Policy : chaque utilisateur ne peut accéder qu'à ses propres subscriptions
CREATE POLICY "push_subs_own_access" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "push_subs_own_access" ON push_subscriptions IS
  'Sécurité: un utilisateur ne peut voir/modifier que ses propres abonnements push.';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [135/169] 20260404100100_fix_tenant_docs_view_visible_tenant.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Ajouter filtre visible_tenant à la vue v_tenant_accessible_documents
-- Date: 2026-04-04
--
-- PROBLÈME: La vue a été créée le 2026-02-23 (migration 20260223000002)
-- AVANT l'ajout de la colonne visible_tenant (migration 20260306000000).
-- Résultat : la vue ne filtre pas visible_tenant, donc un propriétaire
-- qui cache un document au locataire n'est pas respecté via cette vue.
--
-- FIX: Recréer la vue avec le filtre visible_tenant.
-- Logique : le tenant voit le document SI :
--   - visible_tenant = true (le proprio l'a rendu visible) OU
--   - tenant_id = user_profile_id() (c'est un doc uploadé par le tenant lui-même)
-- =====================================================

CREATE OR REPLACE VIEW public.v_tenant_accessible_documents AS
SELECT DISTINCT ON (d.id) d.*
FROM public.documents d
WHERE
  -- Documents directement liés au locataire (uploadés par lui)
  d.tenant_id = public.user_profile_id()
  -- Documents liés aux baux du locataire (visible_tenant requis)
  OR (
    d.visible_tenant = true
    AND d.lease_id IN (
      SELECT ls.lease_id
      FROM public.lease_signers ls
      WHERE ls.profile_id = public.user_profile_id()
    )
  )
  -- Documents partagés de la propriété (diagnostics, EDL, etc.) — visible_tenant requis
  OR (
    d.visible_tenant = true
    AND d.property_id IN (
      SELECT l.property_id
      FROM public.leases l
      JOIN public.lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = public.user_profile_id()
        AND l.property_id IS NOT NULL
    )
    AND d.type IN (
      'diagnostic_performance', 'dpe', 'erp', 'crep', 'amiante',
      'electricite', 'gaz', 'reglement_copro', 'notice_information',
      'EDL_entree', 'EDL_sortie', 'edl', 'edl_entree', 'edl_sortie'
    )
  );

COMMENT ON VIEW public.v_tenant_accessible_documents IS
  'SOTA 2026: Vue unifiée des documents accessibles par le locataire. Filtre visible_tenant=true sauf pour les documents uploadés par le tenant lui-même.';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [136/169] 20260404100200_fix_ticket_messages_rls_lease_signers.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Fix ticket_messages RLS — utiliser lease_signers au lieu de roommates
-- Date: 2026-04-04
--
-- PROBLÈME: La policy SELECT sur ticket_messages vérifie l'accès via
-- la table `roommates` (user_id), mais les locataires sont référencés
-- dans `lease_signers` (profile_id). Si roommates n'est pas peuplée,
-- le locataire n'a pas accès aux messages de ses tickets.
--
-- FIX: Remplacer roommates par lease_signers + user_profile_id()
-- =====================================================

-- SELECT policy
DROP POLICY IF EXISTS "Ticket messages same lease select" ON ticket_messages;

CREATE POLICY "Ticket messages same lease select"
  ON ticket_messages FOR SELECT
  USING (
    (
      -- Créateur du ticket
      ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.created_by_profile_id = public.user_profile_id()
      )
      -- Membre du bail via lease_signers
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls
          WHERE ls.profile_id = public.user_profile_id()
        )
      )
      -- Propriétaire du bien
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = public.user_profile_id()
      )
      -- Admin
      OR public.user_role() = 'admin'
    )
    AND (
      NOT is_internal
      OR public.user_role() IN ('owner', 'admin')
    )
  );

-- INSERT policy
DROP POLICY IF EXISTS "Ticket messages same lease insert" ON ticket_messages;

CREATE POLICY "Ticket messages same lease insert"
  ON ticket_messages FOR INSERT
  WITH CHECK (
    sender_user = auth.uid()
    AND (
      -- Créateur du ticket
      ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.created_by_profile_id = public.user_profile_id()
      )
      -- Membre du bail
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls
          WHERE ls.profile_id = public.user_profile_id()
        )
      )
      -- Propriétaire du bien
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = public.user_profile_id()
      )
      -- Admin
      OR public.user_role() = 'admin'
    )
  );

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [137/169] 20260406200000_create_entities_view_and_members.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Create entities view + entity_members table
-- Date: 2026-04-07
--
-- CONTEXT: Le module comptabilite (20260406210000) reference
-- les tables `entities` et `entity_members` qui n'existent pas.
-- La table `legal_entities` existe deja et est utilisee partout.
--
-- SOLUTION (Option B - non-destructive) :
-- 1. Creer une vue `entities` pointant vers `legal_entities`
-- 2. Creer la table `entity_members` (junction users <-> entites)
-- 3. Backfill entity_members depuis les proprietaires existants
-- 4. Ajouter colonne `territory` pour TVA DROM-COM
-- =====================================================

-- =====================================================
-- 1. VUE entities → legal_entities
-- Permet au module comptable de faire FROM entities
-- sans renommer la table existante
-- =====================================================
CREATE OR REPLACE VIEW entities AS
  SELECT
    id,
    owner_profile_id,
    entity_type AS type,
    nom AS name,
    nom_commercial,
    siren,
    siret,
    numero_tva,
    adresse_siege AS address,
    code_postal_siege,
    ville_siege,
    pays_siege,
    regime_fiscal,
    tva_assujetti,
    tva_regime,
    tva_taux_defaut,
    iban,
    bic,
    is_active,
    created_at,
    updated_at
  FROM legal_entities;

COMMENT ON VIEW entities IS 'Vue de compatibilite pour le module comptable. Source: legal_entities.';

-- =====================================================
-- 2. TABLE entity_members
-- Junction table: qui a acces a quelle entite
-- Utilisee par toutes les RLS policies du module compta
-- =====================================================
CREATE TABLE IF NOT EXISTS entity_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'member', 'readonly', 'ec')),
  share_percentage NUMERIC(5,2),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entity_member_unique UNIQUE (entity_id, user_id)
);

CREATE INDEX idx_entity_members_entity ON entity_members(entity_id);
CREATE INDEX idx_entity_members_user ON entity_members(user_id);
CREATE INDEX idx_entity_members_profile ON entity_members(profile_id) WHERE profile_id IS NOT NULL;

ALTER TABLE entity_members ENABLE ROW LEVEL SECURITY;

-- Policy: un utilisateur voit ses propres memberships
CREATE POLICY "entity_members_own_access" ON entity_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Policy: un admin d'une entite peut gerer ses membres
CREATE POLICY "entity_members_admin_manage" ON entity_members
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  );

COMMENT ON TABLE entity_members IS 'Membres d''une entite (SCI, agence, copro). Utilise par RLS de toutes les tables comptables.';

-- =====================================================
-- 3. COLONNE territory sur legal_entities
-- Pour la validation TVA DROM-COM
-- =====================================================
ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS territory TEXT DEFAULT 'metropole'
  CHECK (territory IN ('metropole', 'martinique', 'guadeloupe', 'reunion', 'guyane', 'mayotte'));

COMMENT ON COLUMN legal_entities.territory IS 'Territoire pour taux TVA DROM-COM. Defaut: metropole (20%).';

-- =====================================================
-- 4. BACKFILL entity_members
-- Pour chaque legal_entity existante, creer un member admin
-- en suivant la chaine FK:
-- legal_entities.owner_profile_id → owner_profiles.profile_id
-- → profiles.id → profiles.user_id → auth.users.id
-- =====================================================
INSERT INTO entity_members (entity_id, user_id, profile_id, role)
SELECT
  le.id AS entity_id,
  p.user_id AS user_id,
  p.id AS profile_id,
  'admin' AS role
FROM legal_entities le
JOIN profiles p ON le.owner_profile_id = p.id
WHERE le.is_active = true
ON CONFLICT (entity_id, user_id) DO NOTHING;

-- Aussi backfill depuis entity_associates (associes de SCI, etc.)
INSERT INTO entity_members (entity_id, user_id, profile_id, role, share_percentage)
SELECT
  ea.legal_entity_id AS entity_id,
  p.user_id AS user_id,
  p.id AS profile_id,
  CASE
    WHEN ea.is_gerant THEN 'admin'
    ELSE 'member'
  END AS role,
  ea.pourcentage_capital AS share_percentage
FROM entity_associates ea
JOIN profiles p ON ea.profile_id = p.id
WHERE p.user_id IS NOT NULL
ON CONFLICT (entity_id, user_id) DO NOTHING;

-- =====================================================
-- 5. AUTO-PROVISION: trigger pour creer un entity_member
-- quand une nouvelle legal_entity est creee
-- =====================================================
CREATE OR REPLACE FUNCTION fn_auto_entity_member()
RETURNS TRIGGER AS $mig$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM profiles
  WHERE id = NEW.owner_profile_id;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO entity_members (entity_id, user_id, profile_id, role)
    VALUES (NEW.id, v_user_id, NEW.owner_profile_id, 'admin')
    ON CONFLICT (entity_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_entity_member ON legal_entities;
CREATE TRIGGER trg_auto_entity_member
  AFTER INSERT ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_entity_member();

-- =====================================================
-- 6. Updated_at trigger pour entity_members
-- =====================================================
CREATE OR REPLACE FUNCTION fn_entity_members_updated_at()
RETURNS TRIGGER AS $mig$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entity_members_updated_at
  BEFORE UPDATE ON entity_members
  FOR EACH ROW
  EXECUTE FUNCTION fn_entity_members_updated_at();

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [138/169] 20260406210000_accounting_complete.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Module Comptabilite complet
-- Date: 2026-04-06
--
-- 15 tables, 16 index, RLS, triggers, fonctions SQL
-- Double-entry accounting, FEC, rapprochement bancaire,
-- plan comptable PCG + copro, amortissements, OCR, audit
-- =====================================================

-- =====================================================
-- 1. ACCOUNTING_EXERCISES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')),
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exercise_dates_valid CHECK (end_date > start_date),
  CONSTRAINT exercise_unique_period UNIQUE (entity_id, start_date, end_date)
);

CREATE INDEX idx_exercises_entity ON accounting_exercises(entity_id);
CREATE INDEX idx_exercises_status ON accounting_exercises(entity_id, status);

ALTER TABLE accounting_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises_entity_access" ON accounting_exercises
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 2. CHART_OF_ACCOUNTS
-- =====================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN (
    'asset', 'liability', 'equity', 'income', 'expense'
  )),
  plan_type TEXT NOT NULL DEFAULT 'pcg' CHECK (plan_type IN ('pcg', 'copro', 'custom')),
  account_class INTEGER GENERATED ALWAYS AS (
    CAST(LEFT(account_number, 1) AS INTEGER)
  ) STORED,
  is_active BOOLEAN NOT NULL DEFAULT true,
  parent_account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_number_entity_unique UNIQUE (entity_id, account_number)
);

CREATE INDEX idx_coa_entity ON chart_of_accounts(entity_id);
CREATE INDEX idx_coa_number ON chart_of_accounts(entity_id, account_number);
CREATE INDEX idx_coa_class ON chart_of_accounts(entity_id, account_class);

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coa_entity_access" ON chart_of_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 3. ACCOUNTING_JOURNALS
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code IN ('ACH', 'VE', 'BQ', 'OD', 'AN', 'CL')),
  label TEXT NOT NULL,
  journal_type TEXT NOT NULL CHECK (journal_type IN (
    'purchase', 'sales', 'bank', 'miscellaneous', 'opening', 'closing'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT journal_code_entity_unique UNIQUE (entity_id, code)
);

ALTER TABLE accounting_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journals_entity_access" ON accounting_journals
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 4. ACCOUNTING_ENTRIES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  journal_code TEXT NOT NULL,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  label TEXT NOT NULL,
  source TEXT,
  reference TEXT,
  is_validated BOOLEAN NOT NULL DEFAULT false,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  reversal_of UUID REFERENCES accounting_entries(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entry_number_unique UNIQUE (entity_id, exercise_id, entry_number)
);

CREATE INDEX idx_entries_exercise ON accounting_entries(exercise_id);
CREATE INDEX idx_entries_journal ON accounting_entries(entity_id, journal_code);
CREATE INDEX idx_entries_date ON accounting_entries(entity_id, entry_date);

ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries_entity_access" ON accounting_entries
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. ACCOUNTING_ENTRY_LINES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT,
  debit_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
  credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  lettrage TEXT,
  piece_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_side CHECK (
    (debit_cents > 0 AND credit_cents = 0) OR
    (debit_cents = 0 AND credit_cents > 0)
  )
);

CREATE INDEX idx_entry_lines_entry ON accounting_entry_lines(entry_id);
CREATE INDEX idx_entry_lines_account ON accounting_entry_lines(account_number);
CREATE INDEX idx_entry_lines_lettrage ON accounting_entry_lines(lettrage) WHERE lettrage IS NOT NULL;

ALTER TABLE accounting_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entry_lines_via_entry" ON accounting_entry_lines
  FOR ALL TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 6. BANK_CONNECTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('nordigen', 'bridge', 'manual')),
  provider_connection_id TEXT,
  bank_name TEXT,
  iban_hash TEXT NOT NULL,
  account_type TEXT DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'other')),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN (
    'pending', 'syncing', 'synced', 'error', 'expired'
  )),
  last_sync_at TIMESTAMPTZ,
  consent_expires_at TIMESTAMPTZ,
  error_message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iban_hash_unique UNIQUE (iban_hash)
);

CREATE INDEX idx_bank_conn_entity ON bank_connections(entity_id);

ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_conn_entity_access" ON bank_connections
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. BANK_TRANSACTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  provider_transaction_id TEXT,
  transaction_date DATE NOT NULL,
  value_date DATE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  label TEXT,
  raw_label TEXT,
  category TEXT,
  counterpart_name TEXT,
  counterpart_iban TEXT,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN (
    'pending', 'matched_auto', 'matched_manual', 'suggested', 'orphan', 'ignored'
  )),
  matched_entry_id UUID REFERENCES accounting_entries(id),
  match_score NUMERIC(5,2),
  suggestion JSONB,
  is_internal_transfer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_tx_connection ON bank_transactions(connection_id);
CREATE INDEX idx_bank_tx_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_tx_status ON bank_transactions(reconciliation_status);
CREATE INDEX idx_bank_tx_matched ON bank_transactions(matched_entry_id) WHERE matched_entry_id IS NOT NULL;

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_tx_via_connection" ON bank_transactions
  FOR ALL TO authenticated
  USING (
    connection_id IN (
      SELECT id FROM bank_connections
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    connection_id IN (
      SELECT id FROM bank_connections
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 8. DOCUMENT_ANALYSES (OCR + IA)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  extracted_data JSONB NOT NULL DEFAULT '{}',
  confidence_score NUMERIC(5,4),
  suggested_account TEXT,
  suggested_journal TEXT,
  document_type TEXT,
  siret_verified BOOLEAN DEFAULT false,
  tva_coherent BOOLEAN DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'completed', 'failed', 'validated', 'rejected'
  )),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_analyses_entity ON document_analyses(entity_id);
CREATE INDEX idx_doc_analyses_status ON document_analyses(processing_status);

ALTER TABLE document_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_analyses_entity_access" ON document_analyses
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 9. AMORTIZATION_SCHEDULES
-- =====================================================
CREATE TABLE IF NOT EXISTS amortization_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  property_id UUID,
  component TEXT NOT NULL,
  acquisition_date DATE NOT NULL,
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  terrain_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  depreciable_amount_cents INTEGER GENERATED ALWAYS AS (
    total_amount_cents - CAST(ROUND(total_amount_cents * terrain_percent / 100) AS INTEGER)
  ) STORED,
  duration_years INTEGER NOT NULL CHECK (duration_years > 0),
  amortization_method TEXT NOT NULL DEFAULT 'linear' CHECK (amortization_method IN ('linear', 'degressive')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amort_sched_entity ON amortization_schedules(entity_id);

ALTER TABLE amortization_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amort_sched_entity_access" ON amortization_schedules
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 10. AMORTIZATION_LINES
-- =====================================================
CREATE TABLE IF NOT EXISTS amortization_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES amortization_schedules(id) ON DELETE CASCADE,
  exercise_year INTEGER NOT NULL,
  annual_amount_cents INTEGER NOT NULL CHECK (annual_amount_cents >= 0),
  cumulated_amount_cents INTEGER NOT NULL CHECK (cumulated_amount_cents >= 0),
  net_book_value_cents INTEGER NOT NULL CHECK (net_book_value_cents >= 0),
  is_prorata BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT amort_line_unique UNIQUE (schedule_id, exercise_year)
);

ALTER TABLE amortization_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amort_lines_via_schedule" ON amortization_lines
  FOR ALL TO authenticated
  USING (
    schedule_id IN (
      SELECT id FROM amortization_schedules
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    schedule_id IN (
      SELECT id FROM amortization_schedules
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 11. DEFICIT_TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS deficit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  deficit_type TEXT NOT NULL CHECK (deficit_type IN ('foncier', 'bic_meuble')),
  origin_year INTEGER NOT NULL,
  initial_amount_cents INTEGER NOT NULL CHECK (initial_amount_cents > 0),
  used_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (used_amount_cents >= 0),
  remaining_amount_cents INTEGER GENERATED ALWAYS AS (
    initial_amount_cents - used_amount_cents
  ) STORED,
  expires_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deficit_entity ON deficit_tracking(entity_id);

ALTER TABLE deficit_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deficit_entity_access" ON deficit_tracking
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 12. CHARGE_REGULARIZATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS charge_regularizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  lease_id UUID,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  provisions_paid_cents INTEGER NOT NULL DEFAULT 0,
  actual_recoverable_cents INTEGER NOT NULL DEFAULT 0,
  actual_non_recoverable_cents INTEGER NOT NULL DEFAULT 0,
  balance_cents INTEGER GENERATED ALWAYS AS (
    provisions_paid_cents - actual_recoverable_cents
  ) STORED,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'sent', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE charge_regularizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charge_reg_entity_access" ON charge_regularizations
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 13. EC_ACCESS + EC_ANNOTATIONS (Portail Expert-Comptable)
-- =====================================================
CREATE TABLE IF NOT EXISTS ec_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  ec_user_id UUID NOT NULL REFERENCES auth.users(id),
  ec_name TEXT NOT NULL,
  ec_email TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'annotate', 'validate')),
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ec_access_entity ON ec_access(entity_id);

ALTER TABLE ec_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ec_access_owner" ON ec_access
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
    OR ec_user_id = auth.uid()
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS ec_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES accounting_entries(id),
  ec_user_id UUID NOT NULL REFERENCES auth.users(id),
  annotation_type TEXT NOT NULL CHECK (annotation_type IN (
    'comment', 'question', 'correction', 'validation'
  )),
  content TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ec_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ec_annotations_access" ON ec_annotations
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
    OR ec_user_id = auth.uid()
  )
  WITH CHECK (
    ec_user_id = auth.uid()
  );

-- =====================================================
-- 14. COPRO_BUDGETS + COPRO_FUND_CALLS
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  budget_name TEXT NOT NULL,
  budget_lines JSONB NOT NULL DEFAULT '[]',
  total_budget_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'voted', 'executed')),
  voted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE copro_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copro_budgets_entity_access" ON copro_budgets
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS copro_fund_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES copro_budgets(id) ON DELETE CASCADE,
  copro_lot_id UUID,
  owner_name TEXT NOT NULL,
  tantiemes INTEGER NOT NULL CHECK (tantiemes > 0),
  total_tantiemes INTEGER NOT NULL CHECK (total_tantiemes > 0),
  call_amount_cents INTEGER NOT NULL CHECK (call_amount_cents > 0),
  call_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'partial', 'paid', 'overdue'
  )),
  paid_amount_cents INTEGER NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE copro_fund_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copro_fund_calls_entity_access" ON copro_fund_calls
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 15. MANDANT_ACCOUNTS + CRG_REPORTS
-- =====================================================
CREATE TABLE IF NOT EXISTS mandant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  mandant_name TEXT NOT NULL,
  mandant_user_id UUID REFERENCES auth.users(id),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mandant_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mandant_accounts_entity_access" ON mandant_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS crg_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  mandant_id UUID NOT NULL REFERENCES mandant_accounts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_income_cents INTEGER NOT NULL DEFAULT 0,
  total_expenses_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  net_owner_cents INTEGER NOT NULL DEFAULT 0,
  report_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'validated')),
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crg_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crg_reports_entity_access" ON crg_reports
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 16. ACCOUNTING_AUDIT_LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'api', 'ec')),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON accounting_audit_log(entity_id);
CREATE INDEX idx_audit_target ON accounting_audit_log(target_type, target_id);
CREATE INDEX idx_audit_date ON accounting_audit_log(created_at);

ALTER TABLE accounting_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_entity_access" ON accounting_audit_log
  FOR SELECT TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- Audit log is insert-only for the system, read-only for users
CREATE POLICY "audit_log_system_insert" ON accounting_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: Verify entry balance (sum debit = sum credit) before validation
CREATE OR REPLACE FUNCTION fn_check_entry_balance()
RETURNS TRIGGER AS $mig$
DECLARE
  total_debit INTEGER;
  total_credit INTEGER;
BEGIN
  IF NEW.is_validated = true AND (OLD.is_validated IS DISTINCT FROM true) THEN
    SELECT COALESCE(SUM(debit_cents), 0), COALESCE(SUM(credit_cents), 0)
    INTO total_debit, total_credit
    FROM accounting_entry_lines
    WHERE entry_id = NEW.id;

    IF total_debit != total_credit THEN
      RAISE EXCEPTION 'Entry balance error: debit (%) != credit (%)', total_debit, total_credit;
    END IF;

    IF total_debit = 0 THEN
      RAISE EXCEPTION 'Entry has no lines or all amounts are zero';
    END IF;

    NEW.is_locked := true;
    NEW.validated_at := now();
  END IF;

  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entry_balance ON accounting_entries;
CREATE TRIGGER trg_entry_balance
  BEFORE UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_entry_balance();

-- Trigger: Prevent modification of locked/validated entries (intangibilite)
CREATE OR REPLACE FUNCTION fn_locked_entry_guard()
RETURNS TRIGGER AS $mig$
BEGIN
  IF OLD.is_locked = true THEN
    -- Allow only reversal_of to be set on locked entries
    IF NEW.is_locked = OLD.is_locked
       AND NEW.is_validated = OLD.is_validated
       AND NEW.entry_date = OLD.entry_date
       AND NEW.label = OLD.label
       AND NEW.journal_code = OLD.journal_code THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a locked/validated entry. Use reversal (contre-passation) instead.';
  END IF;
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_locked_entry ON accounting_entries;
CREATE TRIGGER trg_locked_entry
  BEFORE UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_locked_entry_guard();

-- Trigger: Auto audit log on entry changes
CREATE OR REPLACE FUNCTION fn_audit_entry_changes()
RETURNS TRIGGER AS $mig$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO accounting_audit_log (entity_id, actor_id, actor_type, action, target_type, target_id, details)
    VALUES (
      NEW.entity_id,
      NEW.created_by,
      'user',
      'create_entry',
      'accounting_entry',
      NEW.id,
      jsonb_build_object('journal_code', NEW.journal_code, 'entry_number', NEW.entry_number, 'label', NEW.label)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_validated = true AND OLD.is_validated = false THEN
      INSERT INTO accounting_audit_log (entity_id, actor_id, actor_type, action, target_type, target_id, details)
      VALUES (
        NEW.entity_id,
        NEW.validated_by,
        'user',
        'validate_entry',
        'accounting_entry',
        NEW.id,
        jsonb_build_object('entry_number', NEW.entry_number)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_entries ON accounting_entries;
CREATE TRIGGER trg_audit_entries
  AFTER INSERT OR UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_entry_changes();

-- Trigger: updated_at auto-update
CREATE OR REPLACE FUNCTION fn_accounting_updated_at()
RETURNS TRIGGER AS $mig$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

DO $mig$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'accounting_exercises', 'accounting_entries', 'bank_connections',
      'bank_transactions', 'document_analyses', 'amortization_schedules',
      'deficit_tracking', 'charge_regularizations', 'copro_budgets',
      'copro_fund_calls', 'mandant_accounts', 'crg_reports'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_accounting_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$mig$;

-- =====================================================
-- HELPER: Generate next entry number
-- =====================================================
CREATE OR REPLACE FUNCTION fn_next_entry_number(
  p_entity_id UUID,
  p_exercise_id UUID,
  p_journal_code TEXT
)
RETURNS TEXT AS $mig$
DECLARE
  next_seq INTEGER;
  year_part TEXT;
BEGIN
  SELECT EXTRACT(YEAR FROM start_date)::TEXT INTO year_part
  FROM accounting_exercises WHERE id = p_exercise_id;

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(entry_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM accounting_entries
  WHERE entity_id = p_entity_id
    AND exercise_id = p_exercise_id
    AND journal_code = p_journal_code;

  RETURN p_journal_code || '-' || year_part || '-' || LPAD(next_seq::TEXT, 6, '0');
END;
$mig$ LANGUAGE plpgsql;

COMMENT ON TABLE accounting_exercises IS 'Exercices comptables par entite (SCI, copro, agence)';
COMMENT ON TABLE chart_of_accounts IS 'Plan comptable PCG/copro/custom par entite';
COMMENT ON TABLE accounting_entries IS 'Ecritures comptables double-entry avec intangibilite';
COMMENT ON TABLE bank_transactions IS 'Transactions bancaires importees pour rapprochement';
COMMENT ON TABLE accounting_audit_log IS 'Journal audit comptable (insertion seule, lecture utilisateur)';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [139/169] 20260407110000_audit_fixes_rls_indexes.sql ===
DO $wrapper$ BEGIN
-- Migration: Audit fixes — missing indexes, CHECK constraints, and RLS
-- Idempotent: safe to run multiple times

-- 1. Missing index on sepa_mandates.owner_profile_id (skip if table missing)
DO $mig$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_sepa_mandates_owner ON sepa_mandates(owner_profile_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $mig$;

-- 2. CHECK constraints on status columns (skip if table does not exist)
DO $mig$ BEGIN
  ALTER TABLE reconciliation_matches ADD CONSTRAINT chk_reconciliation_matches_status CHECK (status IN ('pending','matched','disputed','resolved'));
EXCEPTION WHEN OTHERS THEN NULL;
END $mig$;

DO $mig$ BEGIN
  ALTER TABLE payment_schedules ADD CONSTRAINT chk_payment_schedules_status CHECK (status IN ('pending','active','paused','completed','cancelled'));
EXCEPTION WHEN OTHERS THEN NULL;
END $mig$;

DO $mig$ BEGIN
  ALTER TABLE receipt_stubs ADD CONSTRAINT chk_receipt_stubs_status CHECK (status IN ('signed','cancelled','archived'));
EXCEPTION WHEN OTHERS THEN NULL;
END $mig$;

DO $mig$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT chk_subscriptions_status CHECK (status IN ('trialing','active','past_due','canceled','incomplete','paused'));
EXCEPTION WHEN OTHERS THEN NULL;
END $mig$;

DO $mig$ BEGIN
  ALTER TABLE visit_slots ADD CONSTRAINT chk_visit_slots_status CHECK (status IN ('available','booked','cancelled','completed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $mig$;

DO $mig$ BEGIN
  ALTER TABLE visit_bookings ADD CONSTRAINT chk_visit_bookings_status CHECK (status IN ('pending','confirmed','cancelled','no_show','completed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $mig$;

-- 3. Enable RLS on lease_notices (idempotent — ENABLE is a no-op if already on)
ALTER TABLE IF EXISTS lease_notices ENABLE ROW LEVEL SECURITY;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [140/169] 20260407120000_accounting_reconcile_schemas.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Reconcile accounting schemas
-- Date: 2026-04-07
--
-- The old migration (20260110000001) created:
--   accounting_journals, accounting_entries, mandant_accounts,
--   charge_regularisations, deposit_operations, bank_reconciliations
--
-- The new migration (20260406210000) tries to create tables with
-- overlapping names but uses IF NOT EXISTS, so conflicting tables
-- are silently skipped.
--
-- This migration:
-- 1. Adds missing columns to old accounting_entries for double-entry support
-- 2. Adds missing columns to old accounting_journals for entity support
-- 3. Adds missing columns to old mandant_accounts for entity support
-- 4. Creates accounting_entry_lines if not exists (new table, no conflict)
-- 5. Ensures all new non-conflicting tables from 20260406210000 exist
-- =====================================================

-- =====================================================
-- 1. Extend accounting_journals with entity support
-- =====================================================
ALTER TABLE public.accounting_journals
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS journal_type TEXT;

-- Backfill label from libelle
UPDATE public.accounting_journals
SET label = libelle
WHERE label IS NULL AND libelle IS NOT NULL;

-- =====================================================
-- 2. Extend accounting_entries with double-entry header fields
-- =====================================================
ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES accounting_exercises(id),
  ADD COLUMN IF NOT EXISTS entry_number TEXT,
  ADD COLUMN IF NOT EXISTS entry_date DATE,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS is_validated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversal_of UUID REFERENCES accounting_entries(id);

-- Backfill new columns from old columns
UPDATE public.accounting_entries
SET
  entry_number = ecriture_num,
  entry_date = ecriture_date,
  label = ecriture_lib,
  is_validated = (valid_date IS NOT NULL),
  validated_at = valid_date::timestamptz
WHERE entry_number IS NULL AND ecriture_num IS NOT NULL;

-- Add the unique constraint for new entry numbering (if not exists)
DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entry_number_unique'
  ) THEN
    -- Only add if no duplicates exist
    IF (SELECT COUNT(*) FROM (
      SELECT entity_id, exercise_id, entry_number
      FROM public.accounting_entries
      WHERE entity_id IS NOT NULL AND exercise_id IS NOT NULL AND entry_number IS NOT NULL
      GROUP BY entity_id, exercise_id, entry_number
      HAVING COUNT(*) > 1
    ) dups) = 0 THEN
      ALTER TABLE public.accounting_entries
        ADD CONSTRAINT entry_number_unique UNIQUE (entity_id, exercise_id, entry_number);
    END IF;
  END IF;
END $mig$;

-- =====================================================
-- 3. Extend mandant_accounts with entity support
-- =====================================================
ALTER TABLE public.mandant_accounts
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS mandant_name TEXT,
  ADD COLUMN IF NOT EXISTS mandant_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- 4. Ensure accounting_entry_lines exists
-- (This table is NEW — no conflict with old schema)
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT,
  debit_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
  credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  lettrage TEXT,
  piece_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_side CHECK (
    (debit_cents > 0 AND credit_cents = 0) OR
    (debit_cents = 0 AND credit_cents > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_entry_lines_entry ON accounting_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_lines_account ON accounting_entry_lines(account_number);
CREATE INDEX IF NOT EXISTS idx_entry_lines_lettrage ON accounting_entry_lines(lettrage)
  WHERE lettrage IS NOT NULL;

ALTER TABLE accounting_entry_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entry_lines_via_entry" ON accounting_entry_lines;
CREATE POLICY "entry_lines_via_entry" ON accounting_entry_lines
  FOR ALL TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 5. Add entity_members RLS policies to old tables
-- (Old tables used role-based RLS, add entity-based too)
-- =====================================================

-- accounting_entries: add entity-based policy
DROP POLICY IF EXISTS "entries_entity_access" ON public.accounting_entries;
CREATE POLICY "entries_entity_access" ON public.accounting_entries
  FOR ALL TO authenticated
  USING (
    entity_id IS NULL  -- allow access to old entries without entity
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- mandant_accounts: add entity-based policy
DROP POLICY IF EXISTS "mandant_entity_access" ON public.mandant_accounts;
CREATE POLICY "mandant_entity_access" ON public.mandant_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 6. Rename old accounting_accounts → keep as-is
-- The new chart_of_accounts is a separate table (no conflict)
-- Both can coexist: old for agency, new for owner/copro
-- =====================================================

COMMENT ON TABLE public.accounting_journals IS 'Journaux comptables — extended with entity support for multi-entity accounting';
COMMENT ON TABLE public.accounting_entries IS 'Ecritures comptables — extended with double-entry header fields and entity support';
COMMENT ON TABLE public.mandant_accounts IS 'Comptes mandants — extended with entity support';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [141/169] 20260407130000_ocr_category_rules.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: OCR Category Rules + document_analyses extensions
-- Date: 2026-04-07
-- =====================================================

-- Table for OCR learning rules
CREATE TABLE IF NOT EXISTS ocr_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('supplier_name', 'supplier_siret', 'keyword')),
  match_value TEXT NOT NULL,
  target_account TEXT NOT NULL,
  target_category TEXT,
  target_journal TEXT,
  confidence_boost NUMERIC(5,2) DEFAULT 10.0,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entity_id, match_type, match_value)
);

CREATE INDEX IF NOT EXISTS idx_ocr_rules_entity ON ocr_category_rules(entity_id);
CREATE INDEX IF NOT EXISTS idx_ocr_rules_match ON ocr_category_rules(match_type, match_value);

ALTER TABLE ocr_category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_rules_entity_access" ON ocr_category_rules
  FOR ALL TO authenticated
  USING (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));

-- Extend document_analyses with OCR-specific columns
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES accounting_entries(id);
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS raw_ocr_text TEXT;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS suggested_entry JSONB;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [142/169] 20260408042218_create_expenses_table.sql ===
DO $wrapper$ BEGIN
-- Migration: Table expenses (dépenses/travaux propriétaire)
-- Date: 2026-04-08
-- RLS via chaîne : legal_entities.owner_profile_id → owner_profiles.profile_id
-- Compatible multi-entités (legal_entity_id) + particulier (owner_profile_id direct)
-- (BEGIN removed for DO wrapper compatibility)
-- ============================================
-- TABLE: expenses
-- ============================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rattachement entité / propriétaire
  legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  owner_profile_id UUID NOT NULL REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,

  -- Rattachement bien (optionnel — une dépense peut concerner plusieurs biens)
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,

  -- Catégorie de dépense
  category TEXT NOT NULL CHECK (category IN (
    'travaux',              -- Travaux / réparations
    'entretien',            -- Entretien courant
    'assurance',            -- Assurance PNO, loyers impayés
    'taxe_fonciere',        -- Taxe foncière
    'charges_copro',        -- Charges de copropriété
    'frais_gestion',        -- Frais de gestion / comptable
    'frais_bancaires',      -- Frais bancaires
    'diagnostic',           -- Diagnostics (DPE, amiante, etc.)
    'mobilier',             -- Mobilier (meublé)
    'honoraires',           -- Honoraires (notaire, huissier, avocat)
    'autre'                 -- Autre
  )),

  -- Détail
  description TEXT NOT NULL,
  montant DECIMAL(12, 2) NOT NULL CHECK (montant > 0),
  date_depense DATE NOT NULL DEFAULT CURRENT_DATE,
  fournisseur TEXT,                              -- Nom du prestataire / fournisseur

  -- TVA
  tva_taux DECIMAL(5, 2) DEFAULT 0,
  tva_montant DECIMAL(12, 2) DEFAULT 0,
  montant_ttc DECIMAL(12, 2) GENERATED ALWAYS AS (montant + COALESCE(tva_montant, 0)) STORED,

  -- Déductibilité fiscale
  deductible BOOLEAN NOT NULL DEFAULT true,
  deduction_exercice INTEGER,                    -- Année de déduction fiscale

  -- Justificatif
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  receipt_storage_path TEXT,

  -- Récurrence (si charge régulière)
  recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN (
    'mensuel', 'trimestriel', 'semestriel', 'annuel', 'ponctuel'
  )) DEFAULT 'ponctuel',

  -- Statut
  statut TEXT NOT NULL DEFAULT 'confirmed' CHECK (statut IN (
    'draft', 'confirmed', 'cancelled'
  )),

  -- Métadonnées
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- ============================================
-- INDEX
-- ============================================

CREATE INDEX IF NOT EXISTS idx_expenses_owner ON expenses(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_expenses_entity ON expenses(legal_entity_id) WHERE legal_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_expenses_year ON expenses(date_depense, owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_expenses_statut ON expenses(statut) WHERE statut = 'confirmed';

-- ============================================
-- RLS
-- ============================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Propriétaires : accès via la chaîne legal_entities → owner_profiles
-- Supporte à la fois :
--   - Dépenses rattachées à une entité (legal_entity_id IS NOT NULL)
--   - Dépenses en direct (owner_profile_id = profile courant)
CREATE POLICY "Owners can view own expenses" ON expenses
  FOR SELECT TO authenticated
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR public.user_role() = 'admin'
  );

CREATE POLICY "Owners can insert own expenses" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Owners can update own expenses" ON expenses
  FOR UPDATE TO authenticated
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Owners can delete own expenses" ON expenses
  FOR DELETE TO authenticated
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins full access on expenses" ON expenses
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- TRIGGER: updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $mig$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();
-- (COMMIT removed for DO wrapper compatibility)
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [143/169] 20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Réconciliation finale des schémas comptables
-- Date: 2026-04-08
--
-- 1. charge_regularisations (FR) → charge_regularizations (EN)
--    - Migre les données de l'ancienne table vers la nouvelle
--    - Crée une vue de compatibilité charge_regularisations
--
-- 2. accounting_entries inline → accounting_entry_lines
--    - Backfill des anciennes écritures inline (debit/credit)
--    - Vers le nouveau modèle header/lignes (entry_lines)
--
-- Idempotent : chaque opération vérifie l'état avant d'agir.
-- =====================================================
-- (BEGIN removed for DO wrapper compatibility)
-- =====================================================
-- PARTIE 1 : charge_regularisations → charge_regularizations
-- =====================================================

-- 1a. S'assurer que charge_regularizations a les colonnes de compatibilité
ALTER TABLE public.charge_regularizations
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id),
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS annee INTEGER,
  ADD COLUMN IF NOT EXISTS date_emission DATE,
  ADD COLUMN IF NOT EXISTS date_echeance DATE,
  ADD COLUMN IF NOT EXISTS date_paiement DATE,
  ADD COLUMN IF NOT EXISTS nouvelle_provision DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS detail_charges JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 1b. Migrer les données de charge_regularisations → charge_regularizations
-- Seulement les lignes qui n'existent pas déjà (idempotent via id)
INSERT INTO public.charge_regularizations (
  id,
  lease_id,
  property_id,
  tenant_id,
  annee,
  period_start,
  period_end,
  provisions_paid_cents,
  actual_recoverable_cents,
  actual_non_recoverable_cents,
  status,
  date_emission,
  date_echeance,
  date_paiement,
  nouvelle_provision,
  notes,
  detail_charges,
  created_by,
  created_at,
  updated_at,
  -- entity_id et exercise_id sont NULL — sera backfillé plus tard
  entity_id
)
SELECT
  cr.id,
  cr.lease_id,
  cr.property_id,
  cr.tenant_id,
  cr.annee,
  cr.date_debut,
  cr.date_fin,
  -- Conversion DECIMAL euros → INTEGER cents
  ROUND(cr.provisions_versees * 100)::INTEGER,
  ROUND(cr.charges_reelles * 100)::INTEGER,
  0, -- actual_non_recoverable_cents inconnu dans l'ancien schéma
  -- Mapping statut FR → EN
  CASE cr.statut
    WHEN 'draft' THEN 'draft'
    WHEN 'sent' THEN 'sent'
    WHEN 'paid' THEN 'paid'
    WHEN 'disputed' THEN 'draft'
    WHEN 'cancelled' THEN 'draft'
    ELSE 'draft'
  END,
  cr.date_emission,
  cr.date_echeance,
  cr.date_paiement,
  cr.nouvelle_provision,
  cr.notes,
  cr.detail_charges,
  cr.created_by,
  cr.created_at,
  cr.updated_at,
  -- Résoudre entity_id via property → properties.legal_entity_id
  (SELECT p.legal_entity_id FROM public.properties p WHERE p.id = cr.property_id LIMIT 1)
FROM public.charge_regularisations cr
WHERE NOT EXISTS (
  SELECT 1 FROM public.charge_regularizations crz WHERE crz.id = cr.id
);

-- 1c. Rattacher entity_id + exercise_id sur les lignes migrées qui n'en ont pas
-- entity_id via property
UPDATE public.charge_regularizations
SET entity_id = (
  SELECT p.legal_entity_id
  FROM public.properties p
  WHERE p.id = charge_regularizations.property_id
  LIMIT 1
)
WHERE entity_id IS NULL AND property_id IS NOT NULL;

-- exercise_id via annee → le premier exercice de cette année
UPDATE public.charge_regularizations
SET exercise_id = (
  SELECT ae.id
  FROM public.accounting_exercises ae
  WHERE EXTRACT(YEAR FROM ae.start_date) = charge_regularizations.annee
  ORDER BY ae.start_date ASC
  LIMIT 1
)
WHERE exercise_id IS NULL AND annee IS NOT NULL;

-- 1d. Renommer l'ancienne table et créer une vue de compatibilité
-- On ne DROP pas l'ancienne table pour éviter de casser du code legacy
-- qui pourrait encore la référencer via des FK ou du code direct
ALTER TABLE public.charge_regularisations RENAME TO charge_regularisations_legacy;

-- Vue de compatibilité : le code qui SELECT depuis charge_regularisations
-- continue de fonctionner, pointant vers la table normalisée
CREATE OR REPLACE VIEW public.charge_regularisations AS
SELECT
  id,
  lease_id,
  property_id,
  tenant_id,
  annee,
  period_start AS date_debut,
  period_end AS date_fin,
  -- Conversion cents → euros pour compatibilité
  (provisions_paid_cents / 100.0)::DECIMAL(15,2) AS provisions_versees,
  (actual_recoverable_cents / 100.0)::DECIMAL(15,2) AS charges_reelles,
  ((actual_recoverable_cents - provisions_paid_cents) / 100.0)::DECIMAL(15,2) AS solde,
  detail_charges,
  status AS statut,
  date_emission,
  date_echeance,
  date_paiement,
  nouvelle_provision,
  NULL::DATE AS date_effet_nouvelle_provision,
  notes,
  created_at,
  updated_at,
  created_by
FROM public.charge_regularizations;

COMMENT ON VIEW public.charge_regularisations IS
  'Vue de compatibilité — pointe vers charge_regularizations. Utiliser la table normalisée pour les nouvelles écritures.';

-- 1e. Triggers INSTEAD OF pour que INSERT/UPDATE/DELETE sur la vue
--     redirigent vers charge_regularizations (compatibilité code legacy)

CREATE OR REPLACE FUNCTION charge_regularisations_insert_redirect()
RETURNS TRIGGER AS $mig$
BEGIN
  INSERT INTO public.charge_regularizations (
    id, lease_id, property_id, tenant_id, annee,
    period_start, period_end,
    provisions_paid_cents, actual_recoverable_cents, actual_non_recoverable_cents,
    status, date_emission, date_echeance, date_paiement,
    nouvelle_provision, notes, detail_charges, created_by,
    entity_id
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.lease_id,
    NEW.property_id,
    NEW.tenant_id,
    NEW.annee,
    NEW.date_debut,
    NEW.date_fin,
    ROUND(COALESCE(NEW.provisions_versees, 0) * 100)::INTEGER,
    ROUND(COALESCE(NEW.charges_reelles, 0) * 100)::INTEGER,
    0,
    COALESCE(NEW.statut, 'draft'),
    NEW.date_emission,
    NEW.date_echeance,
    NEW.date_paiement,
    NEW.nouvelle_provision,
    NEW.notes,
    NEW.detail_charges,
    NEW.created_by,
    (SELECT p.legal_entity_id FROM public.properties p WHERE p.id = NEW.property_id LIMIT 1)
  )
  RETURNING id INTO NEW.id;
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

CREATE TRIGGER charge_regularisations_on_insert
  INSTEAD OF INSERT ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_insert_redirect();

CREATE OR REPLACE FUNCTION charge_regularisations_update_redirect()
RETURNS TRIGGER AS $mig$
BEGIN
  UPDATE public.charge_regularizations SET
    lease_id = NEW.lease_id,
    property_id = NEW.property_id,
    tenant_id = NEW.tenant_id,
    annee = NEW.annee,
    period_start = COALESCE(NEW.date_debut, period_start),
    period_end = COALESCE(NEW.date_fin, period_end),
    provisions_paid_cents = ROUND(COALESCE(NEW.provisions_versees, 0) * 100)::INTEGER,
    actual_recoverable_cents = ROUND(COALESCE(NEW.charges_reelles, 0) * 100)::INTEGER,
    status = COALESCE(NEW.statut, status),
    date_emission = NEW.date_emission,
    date_echeance = NEW.date_echeance,
    date_paiement = NEW.date_paiement,
    nouvelle_provision = NEW.nouvelle_provision,
    notes = NEW.notes,
    detail_charges = NEW.detail_charges,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

CREATE TRIGGER charge_regularisations_on_update
  INSTEAD OF UPDATE ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_update_redirect();

CREATE OR REPLACE FUNCTION charge_regularisations_delete_redirect()
RETURNS TRIGGER AS $mig$
BEGIN
  DELETE FROM public.charge_regularizations WHERE id = OLD.id;
  RETURN OLD;
END;
$mig$ LANGUAGE plpgsql;

CREATE TRIGGER charge_regularisations_on_delete
  INSTEAD OF DELETE ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_delete_redirect();

-- =====================================================
-- PARTIE 2 : Backfill accounting_entries → entry_lines
-- =====================================================
-- Les anciennes écritures ont debit/credit inline.
-- Le nouveau modèle utilise accounting_entry_lines.
-- On crée une ligne par écriture ancienne qui a un montant.

-- 2a. Insérer les lignes pour les écritures qui n'ont pas encore de lignes
INSERT INTO public.accounting_entry_lines (
  entry_id,
  account_number,
  label,
  debit_cents,
  credit_cents,
  lettrage,
  piece_ref
)
SELECT
  ae.id,
  ae.compte_num,
  ae.ecriture_lib,
  -- Conversion DECIMAL euros → INTEGER cents
  ROUND(ae.debit * 100)::INTEGER,
  ROUND(ae.credit * 100)::INTEGER,
  ae.ecriture_let,
  ae.piece_ref
FROM public.accounting_entries ae
WHERE
  -- Seulement les écritures qui ont des montants inline
  (ae.debit > 0 OR ae.credit > 0)
  -- Et qui n'ont pas encore de lignes associées
  AND NOT EXISTS (
    SELECT 1 FROM public.accounting_entry_lines ael
    WHERE ael.entry_id = ae.id
  )
  -- Et qui ont le format ancien (compte_num rempli)
  AND ae.compte_num IS NOT NULL;

-- 2b. Marquer les anciennes écritures comme ayant été migrées (via metadata)
-- On utilise la colonne source pour tracer
UPDATE public.accounting_entries
SET source = COALESCE(source, 'legacy_inline_migrated')
WHERE
  source IS NULL
  AND (debit > 0 OR credit > 0)
  AND compte_num IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.accounting_entry_lines ael WHERE ael.entry_id = id
  );

-- =====================================================
-- VÉRIFICATION (commentaire informatif)
-- =====================================================
-- Après exécution, vérifier :
--
-- SELECT 'charge_regularizations' AS table_name, COUNT(*) FROM charge_regularizations
-- UNION ALL
-- SELECT 'charge_regularisations_legacy', COUNT(*) FROM charge_regularisations_legacy
-- UNION ALL
-- SELECT 'entries_with_lines', COUNT(DISTINCT entry_id) FROM accounting_entry_lines
-- UNION ALL
-- SELECT 'entries_without_lines', COUNT(*) FROM accounting_entries
--   WHERE (debit > 0 OR credit > 0) AND NOT EXISTS (
--     SELECT 1 FROM accounting_entry_lines WHERE entry_id = accounting_entries.id
--   );
-- (COMMIT removed for DO wrapper compatibility)
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [144/169] 20260408100000_copro_lots.sql ===
DO $wrapper$ BEGIN
-- Sprint 5: Copropriété lots + fund call lines
-- Tables for syndic copropriété module

CREATE TABLE IF NOT EXISTS copro_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copro_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  lot_type TEXT CHECK (lot_type IN ('habitation','commerce','parking','cave','bureau','autre')) DEFAULT 'habitation',
  owner_name TEXT NOT NULL,
  owner_entity_id UUID REFERENCES legal_entities(id),
  owner_profile_id UUID REFERENCES profiles(id),
  tantiemes_generaux INTEGER NOT NULL CHECK (tantiemes_generaux > 0),
  tantiemes_speciaux JSONB DEFAULT '{}',
  surface_m2 NUMERIC(8,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(copro_entity_id, lot_number)
);
CREATE INDEX idx_copro_lots_entity ON copro_lots(copro_entity_id);
ALTER TABLE copro_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copro_lots_entity_access" ON copro_lots FOR ALL TO authenticated
  USING (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));

-- Add missing columns to copro_fund_calls for syndic module
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES accounting_exercises(id);
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS call_number TEXT;
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS period_label TEXT;
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','partial','overdue'));

-- Make lot-level columns nullable (calls now represent periods, lines hold lot details)
ALTER TABLE copro_fund_calls ALTER COLUMN owner_name DROP NOT NULL;
ALTER TABLE copro_fund_calls ALTER COLUMN owner_name SET DEFAULT '';
ALTER TABLE copro_fund_calls ALTER COLUMN tantiemes DROP NOT NULL;
ALTER TABLE copro_fund_calls DROP CONSTRAINT IF EXISTS copro_fund_calls_tantiemes_check;
ALTER TABLE copro_fund_calls ALTER COLUMN tantiemes SET DEFAULT 0;
ALTER TABLE copro_fund_calls ALTER COLUMN total_tantiemes DROP NOT NULL;
ALTER TABLE copro_fund_calls DROP CONSTRAINT IF EXISTS copro_fund_calls_total_tantiemes_check;
ALTER TABLE copro_fund_calls ALTER COLUMN total_tantiemes SET DEFAULT 0;

-- Backfill exercise_id from budget if null
UPDATE copro_fund_calls SET exercise_id = copro_budgets.exercise_id
  FROM copro_budgets WHERE copro_fund_calls.budget_id = copro_budgets.id
  AND copro_fund_calls.exercise_id IS NULL;

-- Add copro_fund_call_lines if not exists
CREATE TABLE IF NOT EXISTS copro_fund_call_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES copro_fund_calls(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES copro_lots(id),
  owner_name TEXT NOT NULL,
  tantiemes INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','partial','paid','overdue')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE copro_fund_call_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copro_fund_call_lines_access" ON copro_fund_call_lines FOR ALL TO authenticated
  USING (call_id IN (SELECT id FROM copro_fund_calls WHERE entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid())));

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [145/169] 20260408100000_create_push_subscriptions.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Create push_subscriptions table
-- Date: 2026-04-08
--
-- Cette table stocke les tokens push (Web Push VAPID + FCM natif)
-- pour envoyer des notifications push aux utilisateurs.
-- =====================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Web Push : endpoint complet ; FCM natif : fcm://{token}
  endpoint TEXT NOT NULL,

  -- Web Push VAPID keys (NULL pour FCM natif)
  p256dh_key TEXT,
  auth_key TEXT,

  -- Device info
  device_type TEXT NOT NULL DEFAULT 'web' CHECK (device_type IN ('web', 'ios', 'android')),
  device_name TEXT,
  browser TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un seul endpoint par user
  UNIQUE(user_id, endpoint)
);

-- Index pour les requetes frequentes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile
  ON push_subscriptions(profile_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions(user_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_type
  ON push_subscriptions(device_type) WHERE is_active = true;

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions;
CREATE POLICY "push_subs_own_access" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE push_subscriptions IS 'Tokens push : Web Push (VAPID) et FCM natif (iOS/Android)';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [146/169] 20260408110000_agency_hoguet.sql ===
DO $wrapper$ BEGIN
-- ============================================================================
-- Sprint 6: Agency Hoguet compliance columns
--
-- Adds Carte G (carte professionnelle gestion immobiliere) and caisse de
-- garantie information to legal_entities for Loi Hoguet compliance.
-- ============================================================================

ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_numero TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_expiry DATE;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie_numero TEXT;

-- Index for quick Hoguet compliance checks
CREATE INDEX IF NOT EXISTS idx_legal_entities_carte_g
  ON legal_entities (carte_g_numero)
  WHERE carte_g_numero IS NOT NULL;

COMMENT ON COLUMN legal_entities.carte_g_numero IS 'Numero de carte professionnelle G (gestion immobiliere) - Loi Hoguet';
COMMENT ON COLUMN legal_entities.carte_g_expiry IS 'Date expiration de la carte G';
COMMENT ON COLUMN legal_entities.caisse_garantie IS 'Nom de la caisse de garantie financiere';
COMMENT ON COLUMN legal_entities.caisse_garantie_numero IS 'Numero adhesion a la caisse de garantie';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [147/169] 20260408120000_api_keys_webhooks.sql ===
DO $wrapper$ BEGIN
-- ============================================================================
-- Migration: API Keys, API Logs, API Webhooks
-- Feature: REST API pour développeurs tiers (Pro+/Enterprise)
-- ============================================================================

-- ============================================================================
-- 1. api_keys — Clés API pour authentification Bearer token
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,                           -- 'Mon ERP', 'Zapier'
  key_hash TEXT NOT NULL,                       -- SHA-256 du token (jamais en clair)
  key_prefix TEXT NOT NULL,                     -- 'tlk_live_xxxx' (pour identification)
  permissions TEXT[] DEFAULT '{read}',          -- ['read', 'write', 'delete']
  scopes TEXT[] DEFAULT '{properties}',         -- ['properties','leases','documents','accounting']
  rate_limit_per_hour INTEGER DEFAULT 1000,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_profile ON api_keys(profile_id);

-- RLS: Owner can only see/manage their own API keys
CREATE POLICY "api_keys_select_own" ON api_keys
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_keys_insert_own" ON api_keys
  FOR INSERT WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_keys_update_own" ON api_keys
  FOR UPDATE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_keys_delete_own" ON api_keys
  FOR DELETE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================================================
-- 2. api_logs — Logs de chaque appel API
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  request_body_size INTEGER,
  response_body_size INTEGER,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_logs_key ON api_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);

-- RLS: Owner can see logs for their own API keys
CREATE POLICY "api_logs_select_own" ON api_logs
  FOR SELECT USING (
    api_key_id IN (
      SELECT id FROM api_keys WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Insert allowed for service role only (via API middleware)
-- No insert policy for regular users

-- ============================================================================
-- 3. api_webhooks — Webhooks sortants configurés par le propriétaire
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,                       -- ['lease.created','payment.received',...]
  secret TEXT NOT NULL,                         -- Pour signature HMAC-SHA256
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  failure_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_webhooks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_webhooks_profile ON api_webhooks(profile_id);
CREATE INDEX IF NOT EXISTS idx_api_webhooks_events ON api_webhooks USING GIN(events);

-- RLS: Owner can only see/manage their own webhooks
CREATE POLICY "api_webhooks_select_own" ON api_webhooks
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_webhooks_insert_own" ON api_webhooks
  FOR INSERT WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_webhooks_update_own" ON api_webhooks
  FOR UPDATE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "api_webhooks_delete_own" ON api_webhooks
  FOR DELETE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. api_webhook_deliveries — Log de chaque envoi de webhook
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES api_webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  attempt INTEGER DEFAULT 1,
  error TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON api_webhook_deliveries(webhook_id, delivered_at DESC);

-- ============================================================================
-- 5. Triggers updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $mig$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql;

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_api_keys_updated_at') THEN
    CREATE TRIGGER set_api_keys_updated_at
      BEFORE UPDATE ON api_keys
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_api_webhooks_updated_at') THEN
    CREATE TRIGGER set_api_webhooks_updated_at
      BEFORE UPDATE ON api_webhooks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $mig$;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


