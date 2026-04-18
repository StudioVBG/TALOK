-- ====================================================================
-- Sprint B2 — Phase 1 SAFE — Batch 6/10
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
-- Migration: 20260329120000_add_agency_to_handle_new_user.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260329120000_add_agency_to_handle_new_user.sql'; END $pre$;

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
AS $$
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
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Crée automatiquement un profil lors de la création d''un utilisateur.
Lit le rôle et les informations personnelles depuis les raw_user_meta_data.
Supporte tous les rôles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260329120000', 'add_agency_to_handle_new_user')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260329120000_add_agency_to_handle_new_user.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260331100000_add_agricultural_property_types.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260331100000_add_agricultural_property_types.sql'; END $pre$;

-- ============================================
-- Migration: Ajouter les types agricoles au CHECK constraint properties
-- Alignement avec le skill SOTA 2026 (14 types)
-- Ref: .cursor/skills/sota-property-system/SKILL.md §1
-- ============================================

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_type_check;

DO $$ BEGIN

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

EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;

END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260331100000', 'add_agricultural_property_types')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260331100000_add_agricultural_property_types.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260331130000_key_handovers_add_cancelled_notes.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260331130000_key_handovers_add_cancelled_notes.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260331130000', 'key_handovers_add_cancelled_notes')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260331130000_key_handovers_add_cancelled_notes.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260401000000_add_identity_status_onboarding_step.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260401000000_add_identity_status_onboarding_step.sql'; END $pre$;

-- Migration: Ajout identity_status et onboarding_step sur profiles
-- Ces colonnes alimentent le middleware identity-gate qui contrôle
-- l'accès aux routes protégées selon le niveau de vérification.

-- Enum pour le statut d'identité
DO $$ BEGIN
  CREATE TYPE identity_status_enum AS ENUM (
    'unverified',
    'phone_verified',
    'document_uploaded',
    'identity_review',
    'identity_verified',
    'identity_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum pour l'étape d'onboarding
DO $$ BEGIN
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
END $$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260401000000', 'add_identity_status_onboarding_step')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260401000000_add_identity_status_onboarding_step.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260404100100_fix_tenant_docs_view_visible_tenant.sql
-- Risk: SAFE
-- Why: Idempotent / structural only
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260404100100_fix_tenant_docs_view_visible_tenant.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260404100100', 'fix_tenant_docs_view_visible_tenant')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260404100100_fix_tenant_docs_view_visible_tenant.sql'; END $post$;

COMMIT;

-- END OF BATCH 6/10 (Phase 1 SAFE)
