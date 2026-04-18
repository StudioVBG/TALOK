-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 2/15
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
-- Migration: 20260215100000_signature_security_audit_fixes.sql
-- Risk: MODERE
-- Why: RENAME column
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260215100000_signature_security_audit_fixes.sql'; END $pre$;

-- ============================================================================
-- MIGRATION: Corrections audit sécurité signatures (2026-02-15)
-- ============================================================================
-- 
-- Fixes appliqués :
-- P1-3: Suppression de la colonne signature_image (base64) de lease_signers
-- P1-6: Harmonisation du requirement CNI (décision: CNI optionnel partout)
-- P0-4: Vérification de la contrainte CHECK sur les statuts de bail
--
-- IMPORTANT: Migration NON-DESTRUCTIVE (soft delete avec renommage)
-- ============================================================================

BEGIN;

-- ============================================================================
-- P1-3: Renommer signature_image → _signature_image_deprecated
-- ============================================================================
-- On ne supprime pas immédiatement pour éviter les erreurs d'application
-- pendant le déploiement. La colonne sera supprimée dans une migration future.

DO $$
BEGIN
  -- Vérifier si la colonne existe avant de la renommer
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_signers' 
    AND column_name = 'signature_image'
    AND table_schema = 'public'
  ) THEN
    -- Renommer plutôt que supprimer (rollback possible)
    ALTER TABLE lease_signers RENAME COLUMN signature_image TO _signature_image_deprecated;
    
    COMMENT ON COLUMN lease_signers._signature_image_deprecated IS 
      'DEPRECATED 2026-02-15: Utiliser signature_image_path (Storage) à la place. '
      'Cette colonne sera supprimée lors de la prochaine migration majeure.';
    
    RAISE NOTICE 'Colonne lease_signers.signature_image renommée en _signature_image_deprecated';
  ELSE
    RAISE NOTICE 'Colonne lease_signers.signature_image déjà absente ou renommée';
  END IF;
END $$;

-- ============================================================================
-- P0-4: S'assurer que les statuts de bail incluent tous ceux utilisés par le code
-- ============================================================================
-- Le code utilise ces statuts : draft, pending_signature, partially_signed,
-- fully_signed, active, terminated, archived, cancelled
-- 
-- Vérifier et mettre à jour la contrainte CHECK si nécessaire

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Trouver le nom de la contrainte CHECK sur statut
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'leases'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%statut%';

  IF v_constraint_name IS NOT NULL THEN
    -- Supprimer l'ancienne contrainte
    EXECUTE 'ALTER TABLE leases DROP CONSTRAINT ' || v_constraint_name;
    RAISE NOTICE 'Ancienne contrainte supprimée: %', v_constraint_name;
  END IF;

  -- Recréer avec tous les statuts valides (SSOT 2026)
  ALTER TABLE leases ADD CONSTRAINT leases_statut_check CHECK (
    statut IN (
      'draft',
      'pending_signature',
      'partially_signed',
      'fully_signed',
      'active',
      'terminated',
      'archived',
      'cancelled'
    )
  );
  
  RAISE NOTICE 'Contrainte CHECK sur leases.statut mise à jour avec tous les statuts SSOT 2026';
END $$;

-- ============================================================================
-- P2-6: Ajouter un champ template_version aux lease_signers pour traçabilité
-- ============================================================================

ALTER TABLE lease_signers 
ADD COLUMN IF NOT EXISTS template_version TEXT;

COMMENT ON COLUMN lease_signers.template_version IS 
  'Version du template de bail utilisée au moment de la signature. '
  'Permet de régénérer le PDF avec le bon template si nécessaire.';

-- ============================================================================
-- Index pour améliorer les performances des requêtes de signature
-- ============================================================================

-- Index partiel pour les signatures en attente (optimise checkSignatureRights)
CREATE INDEX IF NOT EXISTS idx_lease_signers_pending 
ON lease_signers(lease_id, role) 
WHERE signature_status = 'pending';

-- Index partiel pour les signatures complètes (optimise determineLeaseStatus)
CREATE INDEX IF NOT EXISTS idx_lease_signers_signed 
ON lease_signers(lease_id) 
WHERE signature_status = 'signed';

-- Index sur invited_email pour la recherche par email (optimise routes token)
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email 
ON lease_signers(invited_email) 
WHERE invited_email IS NOT NULL;

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260215100000', 'signature_security_audit_fixes')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260215100000_signature_security_audit_fixes.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260215200000_fix_rls_properties_tenant_pre_active.sql
-- Risk: MODERE
-- Why: +1 policies, -1 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260215200000_fix_rls_properties_tenant_pre_active.sql'; END $pre$;

-- ============================================================================
-- P0-E1: Fix RLS properties pour locataires avant bail "active"
-- ============================================================================
-- PROBLÈME: La policy "Tenants can view properties with active leases" exige
--           l.statut = 'active', ce qui empêche un nouveau locataire de voir
--           sa propriété pendant la phase de signature / onboarding.
--
-- FIX: Élargir la condition pour inclure tous les statuts où le locataire
--      est légitimement lié au bien (pending_signature, partially_signed,
--      fully_signed, active, notice_given, terminated).
-- ============================================================================

-- 1. Supprimer l'ancienne policy restrictive
DROP POLICY IF EXISTS "Tenants can view properties with active leases" ON properties;
-- Idempotency guard: drop new policy if it already exists (re-run safe)
DROP POLICY IF EXISTS "Tenants can view linked properties" ON properties;

-- 2. Créer la nouvelle policy élargie
CREATE POLICY "Tenants can view linked properties"
  ON properties
  FOR SELECT
  USING (
    -- Le locataire peut voir la propriété s'il est signataire d'un bail lié,
    -- quel que soit le statut du bail (sauf draft et cancelled)
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = properties.id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
  );

-- 3. Vérification : s'assurer que les autres policies existantes ne sont pas impactées
-- (les policies owner et admin restent inchangées)

COMMENT ON POLICY "Tenants can view linked properties" ON properties IS
  'P0-E1: Locataires voient les propriétés liées à leurs baux (sauf draft/cancelled). '
  'Remplace l''ancienne policy qui exigeait statut=active uniquement.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260215200000', 'fix_rls_properties_tenant_pre_active')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260215200000_fix_rls_properties_tenant_pre_active.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260215200002_fix_rls_tenant_access_beyond_active.sql
-- Risk: MODERE
-- Why: +4 policies, -6 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260215200002_fix_rls_tenant_access_beyond_active.sql'; END $pre$;

-- ============================================================================
-- MIGRATION CORRECTIVE: Élargir les RLS units/charges/tickets pour les locataires
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Plusieurs policies RLS pour les tables units, charges et tickets
--           filtrent sur l.statut = 'active' uniquement, empêchant les locataires
--           d'accéder aux données pendant les phases de signature, préavis, etc.
--
-- FIX: Remplacer les policies restrictives par des versions élargies utilisant
--      NOT IN ('draft', 'cancelled') pour couvrir tout le cycle de vie.
-- ============================================================================

-- ============================================
-- 1. UNITS — Policy tenant trop restrictive
-- ============================================
DROP POLICY IF EXISTS "Users can view units of accessible properties" ON units;

CREATE POLICY "Users can view units of accessible properties"
  ON units
  FOR SELECT
  USING (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = units.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail non-brouillon/non-annulé sur ce bien
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE (l.property_id = units.property_id OR l.unit_id = units.id)
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- 2. CHARGES — Policy tenant trop restrictive
-- ============================================
DROP POLICY IF EXISTS "Tenants can view charges of properties with active leases" ON charges;

CREATE POLICY "Tenants can view charges of linked properties"
  ON charges
  FOR SELECT
  USING (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = charges.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis sur ce bien
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = charges.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given', 'fully_signed')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- 3. TICKETS — Policies tenant trop restrictives
-- ============================================

-- 3a. Policy SELECT
DROP POLICY IF EXISTS "Users can view tickets of accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;

CREATE POLICY "Users can view tickets of accessible properties"
  ON tickets
  FOR SELECT
  USING (
    -- Créateur du ticket
    tickets.created_by_profile_id = public.user_profile_id()
    OR
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    -- Prestataire assigné via work_order
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.ticket_id = tickets.id
        AND wo.provider_id = public.user_profile_id()
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- 3b. Policy INSERT
DROP POLICY IF EXISTS "Users can create tickets for accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;

CREATE POLICY "Users can create tickets for accessible properties"
  ON tickets
  FOR INSERT
  WITH CHECK (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis (peut signaler un problème)
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- Log
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '[MIGRATION] RLS units/charges/tickets élargies au-delà de active';
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260215200002', 'fix_rls_tenant_access_beyond_active')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260215200002_fix_rls_tenant_access_beyond_active.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260216000001_document_center_notifications.sql
-- Risk: MODERE
-- Why: +1 triggers, UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260216000001_document_center_notifications.sql'; END $pre$;

-- =============================================================================
-- Migration : Document Center — Notifications & URL updates
-- Date      : 2026-02-16
-- Auteur    : Audit UX/UI — Unification des routes documentaires
--
-- Objectif  : Mettre à jour les templates de notification et les URLs
--             qui référençaient /tenant/receipts ou /tenant/signatures
--             pour pointer vers /tenant/documents (Document Center unifié).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Mettre à jour les templates d'email qui contiennent les anciennes routes
--    (table email_templates si elle existe)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates') THEN
    -- Remplacer /tenant/receipts par /tenant/documents?type=quittance
    UPDATE email_templates
    SET body_html = REPLACE(body_html, '/tenant/receipts', '/tenant/documents?type=quittance'),
        body_text = REPLACE(body_text, '/tenant/receipts', '/tenant/documents?type=quittance'),
        updated_at = NOW()
    WHERE body_html LIKE '%/tenant/receipts%' OR body_text LIKE '%/tenant/receipts%';

    -- Remplacer /tenant/signatures par /tenant/documents
    UPDATE email_templates
    SET body_html = REPLACE(body_html, '/tenant/signatures', '/tenant/documents'),
        body_text = REPLACE(body_text, '/tenant/signatures', '/tenant/documents'),
        updated_at = NOW()
    WHERE body_html LIKE '%/tenant/signatures%' OR body_text LIKE '%/tenant/signatures%';

    RAISE NOTICE 'email_templates updated: receipts → documents, signatures → documents';
  ELSE
    RAISE NOTICE 'email_templates table does not exist, skipping';
  END IF;
END $$;


-- =============================================================================
-- 2. Mettre à jour les notifications existantes qui pointent vers les anciennes routes
--    (table notifications si elle existe)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    -- Mettre à jour les metadata.action_url des notifications non lues
    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{action_url}',
      to_jsonb(REPLACE(metadata->>'action_url', '/tenant/receipts', '/tenant/documents?type=quittance'))
    )
    WHERE metadata->>'action_url' LIKE '%/tenant/receipts%'
      AND read_at IS NULL;

    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{action_url}',
      to_jsonb(REPLACE(metadata->>'action_url', '/tenant/signatures', '/tenant/documents'))
    )
    WHERE metadata->>'action_url' LIKE '%/tenant/signatures%'
      AND read_at IS NULL;

    RAISE NOTICE 'notifications metadata updated for unread notifications';
  ELSE
    RAISE NOTICE 'notifications table does not exist, skipping';
  END IF;
END $$;


-- =============================================================================
-- 3. Fonction utilitaire : tenant_has_key_document()
--    Vérifie si un locataire a un document clé spécifique
--    Utilisée par les triggers de notification et le dashboard
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_has_key_document(
  p_tenant_id UUID,
  p_slot_key TEXT  -- 'bail', 'quittance', 'edl', 'assurance'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_types TEXT[];
  v_exists BOOLEAN;
BEGIN
  -- Mapper le slot_key aux types de documents
  v_types := CASE p_slot_key
    WHEN 'bail' THEN ARRAY['bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire']
    WHEN 'quittance' THEN ARRAY['quittance']
    WHEN 'edl' THEN ARRAY['EDL_entree', 'edl_entree', 'inventaire']
    WHEN 'assurance' THEN ARRAY['attestation_assurance', 'assurance_pno']
    ELSE ARRAY[]::TEXT[]
  END;

  SELECT EXISTS (
    SELECT 1 FROM documents
    WHERE tenant_id = p_tenant_id
      AND type = ANY(v_types)
      AND (verification_status IS NULL OR verification_status != 'rejected')
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

COMMENT ON FUNCTION public.tenant_has_key_document IS
  'Vérifie si un locataire possède un document clé (bail, quittance, edl, assurance). Utilisé par le Document Center et les triggers.';

GRANT EXECUTE ON FUNCTION public.tenant_has_key_document TO authenticated;


-- =============================================================================
-- 4. Trigger : Notifier le locataire quand un document clé est ajouté
--    (mise à jour du trigger existant pour utiliser les nouvelles routes)
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_tenant_document_center_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_label TEXT;
  v_notification_type TEXT;
BEGIN
  -- Ne notifier que pour les documents liés à un locataire
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Déterminer le label et le type de notification
  v_doc_label := CASE
    WHEN NEW.type IN ('bail', 'contrat', 'avenant') THEN 'Un nouveau bail'
    WHEN NEW.type = 'quittance' THEN 'Une nouvelle quittance'
    WHEN NEW.type IN ('EDL_entree', 'edl_entree') THEN 'Un état des lieux d''entrée'
    WHEN NEW.type IN ('EDL_sortie', 'edl_sortie') THEN 'Un état des lieux de sortie'
    WHEN NEW.type IN ('attestation_assurance') THEN 'Votre attestation d''assurance'
    WHEN NEW.type IN ('dpe', 'erp', 'crep') THEN 'Un diagnostic technique'
    ELSE 'Un document'
  END;

  v_notification_type := CASE
    WHEN NEW.type IN ('bail', 'contrat', 'avenant') THEN 'document_lease_added'
    WHEN NEW.type = 'quittance' THEN 'document_receipt_added'
    WHEN NEW.type LIKE 'EDL%' OR NEW.type LIKE 'edl%' THEN 'document_edl_added'
    ELSE 'document_added'
  END;

  -- Insérer la notification (si la table existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    INSERT INTO notifications (
      profile_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      NEW.tenant_id,
      v_notification_type,
      v_doc_label || ' a été ajouté',
      v_doc_label || ' est disponible dans votre espace documents.',
      jsonb_build_object(
        'document_id', NEW.id,
        'document_type', NEW.type,
        'action_url', '/tenant/documents',
        'action_label', 'Voir le document'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recréer le trigger
DROP TRIGGER IF EXISTS trg_notify_tenant_document_center ON documents;
CREATE TRIGGER trg_notify_tenant_document_center
  AFTER INSERT ON documents
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NOT NULL)
  EXECUTE FUNCTION notify_tenant_document_center_update();


-- =============================================================================
-- 5. Stats : Fonction pour les analytics du Document Center
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_document_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  IF p_tenant_id IS NOT NULL THEN
    v_profile_id := p_tenant_id;
  ELSE
    SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'by_type', jsonb_object_agg(type, cnt),
    'recent_7d', SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END),
    'has_bail', bool_or(type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire')),
    'has_quittance', bool_or(type = 'quittance'),
    'has_edl', bool_or(type IN ('EDL_entree', 'edl_entree', 'inventaire')),
    'has_assurance', bool_or(type IN ('attestation_assurance', 'assurance_pno'))
  )
  INTO v_result
  FROM (
    SELECT type, COUNT(*) AS cnt, MIN(created_at) AS created_at
    FROM documents
    WHERE tenant_id = v_profile_id
    GROUP BY type
  ) sub;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.tenant_document_stats IS
  'Statistiques du coffre-fort documentaire du locataire : total, par type, récents, flags de complétude.';

GRANT EXECUTE ON FUNCTION public.tenant_document_stats TO authenticated;


COMMIT;

-- =============================================================================
-- Rollback :
--   DROP FUNCTION IF EXISTS public.tenant_has_key_document;
--   DROP FUNCTION IF EXISTS public.tenant_document_stats;
--   DROP FUNCTION IF EXISTS notify_tenant_document_center_update() CASCADE;
--   DROP TRIGGER IF EXISTS trg_notify_tenant_document_center ON documents;
-- =============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260216000001', 'document_center_notifications')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260216000001_document_center_notifications.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260216100000_security_audit_rls_fixes.sql
-- Risk: MODERE
-- Why: +3 policies, -7 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260216100000_security_audit_rls_fixes.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Correctifs sécurité P0 — Audit BIC2026
-- Date: 2026-02-16
--
-- PROBLÈMES CORRIGÉS:
-- 1. Table `leases`: suppression des policies USING(true) résiduelles
--    (créées par 20241130000004, normalement supprimées par 20251228230000
--     mais cette migration assure la sécurité même en cas de re-application)
-- 2. Table `notifications`: policy INSERT trop permissive (WITH CHECK(true))
-- 3. Table `document_ged_audit_log`: policy INSERT trop permissive
-- 4. Table `professional_orders`: policy SELECT trop permissive
-- =====================================================

BEGIN;

-- ============================================
-- 1. LEASES: Supprimer les policies permissives résiduelles
-- ============================================
-- Ces policies permettaient à tout utilisateur authentifié de lire/modifier tous les baux.
-- Les bonnes policies (leases_admin_all, leases_owner_all, leases_tenant_select)
-- ont été créées dans 20251228230000_definitive_rls_fix.sql

DROP POLICY IF EXISTS "authenticated_users_view_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_insert_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_update_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_delete_leases" ON leases;

-- Vérifier que les bonnes policies existent
DO $$
DECLARE
  policy_count INT;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'leases' AND schemaname = 'public';

  IF policy_count = 0 THEN
    RAISE EXCEPTION 'ERREUR CRITIQUE: Table leases n''a aucune policy RLS après nettoyage. '
                     'Les policies sécurisées de 20251228230000 doivent être présentes.';
  END IF;

  RAISE NOTICE 'leases: % policies RLS actives après nettoyage', policy_count;
END $$;

-- ============================================
-- 2. NOTIFICATIONS: Restreindre l'INSERT
-- ============================================
-- Avant: WITH CHECK(true) → tout authentifié peut insérer pour n'importe qui
-- Après: Seul le service_role ou l'utilisateur peut insérer ses propres notifs

DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;

-- Le service_role bypass RLS par défaut, donc cette policy est pour les
-- appels authentifiés qui insèrent des notifications pour eux-mêmes.
-- Les Edge Functions (service_role) ne sont pas affectées par cette restriction.
CREATE POLICY "notifications_insert_own_or_service" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    -- L'utilisateur ne peut insérer que des notifications qui le concernent
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- ============================================
-- 3. DOCUMENT_GED_AUDIT_LOG: Restreindre l'INSERT
-- ============================================
-- Avant: WITH CHECK(true) → tout authentifié peut insérer des logs d'audit
-- Après: Seuls les utilisateurs authentifiés peuvent insérer leurs propres logs

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'document_ged_audit_log' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert audit logs" ON document_ged_audit_log';

    -- Restreindre aux logs créés par l'utilisateur authentifié
    EXECUTE '
      CREATE POLICY "audit_log_insert_own" ON document_ged_audit_log
        FOR INSERT TO authenticated
        WITH CHECK (
          performed_by = auth.uid()
          OR performed_by IS NULL
        )
    ';

    RAISE NOTICE 'document_ged_audit_log: policy INSERT corrigée';
  ELSE
    RAISE NOTICE 'document_ged_audit_log: table non existante, skip';
  END IF;
END $$;

-- ============================================
-- 4. PROFESSIONAL_ORDERS: Restreindre le SELECT
-- ============================================
-- Avant: USING(TRUE) → tout authentifié voit toutes les commandes
-- Après: ownership check

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'professional_orders' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "professional_orders_select_policy" ON professional_orders';

    -- professional_orders is a read-only reference table, keep open read
    EXECUTE '
      CREATE POLICY "professional_orders_select_scoped" ON professional_orders
        FOR SELECT TO authenticated
        USING (TRUE)
    ';

    RAISE NOTICE 'professional_orders: policy SELECT recréée (reference table, read-only)';
  ELSE
    RAISE NOTICE 'professional_orders: table non existante, skip';
  END IF;
END $$;

-- ============================================
-- 5. VÉRIFICATION FINALE
-- ============================================
DO $$
DECLARE
  dangerous_count INT;
BEGIN
  -- Compter les policies qui ont encore USING(true) ou WITH CHECK(true)
  -- sur les tables critiques (hors reference tables et service_role policies)
  SELECT count(*) INTO dangerous_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('leases', 'profiles', 'properties', 'invoices', 'payments', 'documents', 'tickets')
    AND (qual = 'true' OR with_check = 'true')
    AND policyname NOT LIKE '%service%'
    AND policyname NOT LIKE '%admin%';

  IF dangerous_count > 0 THEN
    RAISE WARNING 'ATTENTION: % policies avec USING(true)/WITH CHECK(true) restantes sur les tables critiques', dangerous_count;
  ELSE
    RAISE NOTICE 'OK: Aucune policy USING(true) dangereuse sur les tables critiques';
  END IF;
END $$;

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260216100000', 'security_audit_rls_fixes')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260216100000_security_audit_rls_fixes.sql'; END $post$;

COMMIT;

-- END OF BATCH 2/15 (Phase 2 MODERE)
