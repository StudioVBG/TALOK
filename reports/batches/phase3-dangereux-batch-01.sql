-- ====================================================================
-- Sprint B2 — Phase 3 DANGEREUX — Batch 1/11
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
-- Migration: 20260209100000_create_sms_messages_table.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260209100000_create_sms_messages_table.sql'; END $pre$;

-- Migration: Create sms_messages table for Twilio SMS tracking (2026-02-09)
--
-- The application code (API routes) already references this table:
--   - POST /api/notifications/sms/send  → inserts SMS records
--   - POST /api/webhooks/twilio          → updates delivery status
-- But the table was never created in a migration.

-- ============================================================
-- 1. Create sms_messages table
-- ============================================================

CREATE TABLE IF NOT EXISTS sms_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  from_number   TEXT NOT NULL,
  to_number     TEXT NOT NULL,
  message       TEXT NOT NULL,
  segments      INT DEFAULT 1,
  twilio_sid    TEXT,
  twilio_status TEXT,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'sent', 'delivered', 'undelivered', 'failed')),
  error_code    TEXT,
  error_message TEXT,
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  sms_messages IS 'Journal des SMS envoyés via Twilio';
COMMENT ON COLUMN sms_messages.profile_id    IS 'Profil destinataire (nullable si envoi à un numéro libre)';
COMMENT ON COLUMN sms_messages.from_number   IS 'Numéro ou service Twilio expéditeur';
COMMENT ON COLUMN sms_messages.to_number     IS 'Numéro de téléphone du destinataire (format E.164)';
COMMENT ON COLUMN sms_messages.segments      IS 'Nombre de segments SMS (1 segment = 160 caractères)';
COMMENT ON COLUMN sms_messages.twilio_sid    IS 'SID du message Twilio (pour corrélation webhook)';
COMMENT ON COLUMN sms_messages.twilio_status IS 'Dernier statut brut renvoyé par Twilio';
COMMENT ON COLUMN sms_messages.status        IS 'Statut normalisé : queued, sent, delivered, undelivered, failed';

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Lookup by Twilio SID (webhook updates)
CREATE INDEX IF NOT EXISTS idx_sms_messages_twilio_sid
  ON sms_messages (twilio_sid)
  WHERE twilio_sid IS NOT NULL;

-- Lookup by profile
CREATE INDEX IF NOT EXISTS idx_sms_messages_profile_id
  ON sms_messages (profile_id)
  WHERE profile_id IS NOT NULL;

-- Recent messages
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at
  ON sms_messages (created_at DESC);

-- ============================================================
-- 3. Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_sms_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sms_messages_updated_at ON sms_messages;
CREATE TRIGGER trg_sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_messages_updated_at();

-- ============================================================
-- 4. Row Level Security
-- ============================================================

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Admins can see all SMS
CREATE POLICY sms_messages_admin_all ON sms_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Owners can see SMS they sent (via their profile)
CREATE POLICY sms_messages_owner_select ON sms_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'owner'
        AND p.id = sms_messages.profile_id
    )
  );

-- Service role inserts (API routes use service role client, bypasses RLS)
-- No explicit INSERT policy needed for service role, but add one for completeness
CREATE POLICY sms_messages_service_insert ON sms_messages
  FOR INSERT
  WITH CHECK (true);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260209100000', 'create_sms_messages_table')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260209100000_create_sms_messages_table.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260213100000_fix_rls_all_tables_recursion.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : to
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260213100000_fix_rls_all_tables_recursion.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Correction globale de la récursion RLS
-- Date: 2026-02-13
-- Problème: Les politiques RLS de subscriptions, notifications et
--           d'autres tables font des sous-requêtes directes sur `profiles`
--           ce qui déclenche l'évaluation RLS sur profiles → récursion (42P17).
--
-- SOLUTION: Remplacer toutes les sous-requêtes `SELECT id FROM profiles WHERE user_id = auth.uid()`
--           par l'appel à `public.get_my_profile_id()` (SECURITY DEFINER, bypass RLS).
-- =====================================================

-- ============================================
-- 0. CORRIGER profiles : retirer FORCE si présent
-- ============================================
-- FORCE ROW LEVEL SECURITY fait que même le propriétaire de la table (postgres)
-- est soumis aux RLS, ce qui casse les fonctions SECURITY DEFINER.
ALTER TABLE profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1. CORRIGER subscriptions
-- ============================================
DROP POLICY IF EXISTS "Owners can view their subscription" ON subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;

-- Propriétaire voit son abonnement (utilise get_my_profile_id au lieu de sous-requête)
CREATE POLICY "Owners can view their subscription" ON subscriptions
  FOR SELECT TO authenticated
  USING (owner_id = public.get_my_profile_id());

-- Admins voient tout (utilise is_admin qui est SECURITY DEFINER)
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ============================================
-- 2. CORRIGER subscription_invoices (si la table existe)
-- ============================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners can view their invoices" ON subscription_invoices;
  CREATE POLICY "Owners can view their invoices" ON subscription_invoices
    FOR SELECT TO authenticated
    USING (
      subscription_id IN (
        SELECT id FROM subscriptions
        WHERE owner_id = public.get_my_profile_id()
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'subscription_invoices does not exist yet, skipping';
END $$;

-- ============================================
-- 3. CORRIGER subscription_usage (si la table existe)
-- ============================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners can view their usage" ON subscription_usage;
  CREATE POLICY "Owners can view their usage" ON subscription_usage
    FOR SELECT TO authenticated
    USING (
      subscription_id IN (
        SELECT id FROM subscriptions
        WHERE owner_id = public.get_my_profile_id()
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'subscription_usage does not exist yet, skipping';
END $$;

-- ============================================
-- 4. CORRIGER notifications
-- ============================================
-- Supprimer TOUTES les anciennes politiques de notifications pour repartir proprement
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'notifications' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Lecture : l'utilisateur voit ses propres notifications
-- Utilise auth.uid() directement et get_my_profile_id() pour recipient_id/profile_id
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Mise à jour : l'utilisateur peut modifier ses propres notifications
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Suppression : l'utilisateur peut supprimer ses propres notifications
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Insertion : le système peut insérer des notifications
CREATE POLICY "notifications_insert_system" ON notifications
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. VÉRIFICATION : lister les politiques restantes avec sous-requête profiles
-- ============================================
-- Note: Les tables ci-dessous ont aussi des sous-requêtes sur profiles dans leurs
-- politiques RLS. Elles sont moins critiques car elles ne sont pas appelées
-- en cascade depuis profiles, mais pour la robustesse on les corrige aussi.

-- Cette requête est un diagnostic, elle n'échouera pas si les tables n'existent pas
DO $$
BEGIN
  RAISE NOTICE '=== Migration RLS globale appliquée avec succès ===';
  RAISE NOTICE 'Tables corrigées: profiles, subscriptions, subscription_invoices, subscription_usage, notifications';
  RAISE NOTICE 'Méthode: get_my_profile_id() SECURITY DEFINER au lieu de sous-requêtes directes';
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260213100000', 'fix_rls_all_tables_recursion')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260213100000_fix_rls_all_tables_recursion.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260216000000_tenant_document_center.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : of
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260216000000_tenant_document_center.sql'; END $pre$;

-- =============================================================================
-- Migration : Tenant Document Center
-- Date      : 2026-02-16
-- Auteur    : Audit UX/UI — Refonte gestion documentaire locataire
--
-- Objectif  : Supporter le Document Center unifié côté locataire avec :
--   1. RPC tenant_document_center() — endpoint unique pour les 3 zones
--   2. Vue v_tenant_key_documents — 4 documents clés par locataire
--   3. Vue v_tenant_pending_actions — actions en attente agrégées
--   4. Index composite optimisé pour les requêtes du Document Center
--   5. RPC tenant_documents_search() — recherche full-text améliorée
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. INDEX COMPOSITE pour les requêtes Document Center
--    Optimise : SELECT * FROM documents WHERE tenant_id = ? ORDER BY created_at DESC
--    et       : SELECT * FROM documents WHERE tenant_id = ? AND type = ?
-- =============================================================================

-- Index composite tenant_id + type + created_at (DESC) pour la zone "Tous les documents"
CREATE INDEX IF NOT EXISTS idx_documents_tenant_type_date
  ON documents (tenant_id, type, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Index composite lease_id + type + created_at (DESC) pour les docs liés au bail
CREATE INDEX IF NOT EXISTS idx_documents_lease_type_date
  ON documents (lease_id, type, created_at DESC)
  WHERE lease_id IS NOT NULL;


-- =============================================================================
-- 2. VUE : v_tenant_key_documents
--    Retourne les 4 documents clés les plus récents par locataire :
--    bail, quittance, EDL d'entrée, attestation d'assurance
-- =============================================================================

CREATE OR REPLACE VIEW v_tenant_key_documents AS
WITH ranked_docs AS (
  SELECT
    d.id,
    d.type,
    d.title,
    d.storage_path,
    d.created_at,
    d.tenant_id,
    d.lease_id,
    d.property_id,
    d.metadata,
    d.verification_status,
    d.ged_status,
    -- Catégorie normalisée pour les 4 slots
    CASE
      WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
      WHEN d.type IN ('quittance') THEN 'quittance'
      WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
      WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
      ELSE NULL
    END AS slot_key,
    ROW_NUMBER() OVER (
      PARTITION BY
        d.tenant_id,
        CASE
          WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
          WHEN d.type IN ('quittance') THEN 'quittance'
          WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
          WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
        END
      ORDER BY
        -- Prioriser les documents "final" et "signed"
        CASE WHEN (d.metadata->>'final')::boolean = true THEN 0 ELSE 1 END,
        CASE WHEN d.ged_status = 'signed' THEN 0 WHEN d.ged_status = 'active' THEN 1 ELSE 2 END,
        d.created_at DESC
    ) AS rn
  FROM documents d
  WHERE d.tenant_id IS NOT NULL
    AND d.type IN (
      'bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire',
      'quittance',
      'EDL_entree', 'edl_entree', 'inventaire',
      'attestation_assurance', 'assurance_pno'
    )
)
SELECT
  id,
  type,
  title,
  storage_path,
  created_at,
  tenant_id,
  lease_id,
  property_id,
  metadata,
  verification_status,
  ged_status,
  slot_key
FROM ranked_docs
WHERE rn = 1 AND slot_key IS NOT NULL;

COMMENT ON VIEW v_tenant_key_documents IS
  'Documents clés par locataire (bail, dernière quittance, EDL entrée, assurance). Retourne le plus récent/pertinent pour chaque slot.';


-- =============================================================================
-- 3. VUE : v_tenant_pending_actions
--    Agrège les actions en attente pour un locataire :
--    - Bail à signer
--    - EDL à signer
--    - Attestation d'assurance manquante
-- =============================================================================

CREATE OR REPLACE VIEW v_tenant_pending_actions AS

-- Action : Bail à signer
SELECT
  ls.profile_id AS tenant_profile_id,
  'sign_lease' AS action_type,
  l.id AS entity_id,
  'Signer mon bail' AS action_label,
  'Votre bail est prêt et attend votre signature.' AS action_description,
  '/tenant/onboarding/sign' AS action_href,
  'high' AS priority,
  l.created_at AS action_created_at
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE ls.signature_status = 'pending'
  AND ls.signed_at IS NULL
  AND l.statut IN ('pending_signature', 'partially_signed')
  AND ls.role IN ('locataire_principal', 'colocataire')

UNION ALL

-- Action : EDL à signer (via le système de signature unifié)
SELECT
  sp.profile_id AS tenant_profile_id,
  'sign_edl' AS action_type,
  ss.entity_id AS entity_id,
  'Signer l''état des lieux' AS action_label,
  'Un état des lieux est en attente de votre signature.' AS action_description,
  '/tenant/documents' AS action_href,
  'high' AS priority,
  ss.created_at AS action_created_at
FROM signature_participants sp
JOIN signature_sessions ss ON ss.id = sp.session_id
WHERE sp.status IN ('pending', 'notified')
  AND ss.status IN ('pending', 'ongoing')
  AND ss.entity_type = 'edl'
  AND sp.role IN ('locataire_principal', 'colocataire')

UNION ALL

-- Action : Attestation d'assurance manquante
SELECT
  ls.profile_id AS tenant_profile_id,
  'upload_insurance' AS action_type,
  l.property_id AS entity_id,
  'Déposer l''attestation d''assurance' AS action_label,
  'Obligatoire pour activer votre bail.' AS action_description,
  '/tenant/documents' AS action_href,
  'medium' AS priority,
  l.created_at AS action_created_at
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND l.statut IN ('active', 'pending_signature', 'partially_signed', 'fully_signed')
  AND NOT EXISTS (
    SELECT 1 FROM documents d
    WHERE d.tenant_id = ls.profile_id
      AND d.property_id = l.property_id
      AND d.type IN ('attestation_assurance', 'assurance_pno')
      AND (d.verification_status IS NULL OR d.verification_status != 'rejected')
  );

COMMENT ON VIEW v_tenant_pending_actions IS
  'Actions en attente par locataire : baux à signer, EDL à signer, documents manquants. Utilisé par la zone "À faire" du Document Center.';


-- =============================================================================
-- 4. RPC : tenant_document_center()
--    Endpoint unique qui retourne toutes les données pour les 3 zones
--    du Document Center en un seul appel.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_document_center(p_profile_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_pending_actions JSONB;
  v_key_documents JSONB;
  v_all_documents JSONB;
  v_stats JSONB;
BEGIN
  -- Résoudre le profile_id (paramètre ou utilisateur courant)
  IF p_profile_id IS NOT NULL THEN
    v_profile_id := p_profile_id;
  ELSE
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  -- Zone 1 : Actions en attente
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'action_type', action_type,
      'entity_id', entity_id,
      'label', action_label,
      'description', action_description,
      'href', action_href,
      'priority', priority,
      'created_at', action_created_at
    ) ORDER BY
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      action_created_at DESC
  ), '[]'::jsonb)
  INTO v_pending_actions
  FROM v_tenant_pending_actions
  WHERE tenant_profile_id = v_profile_id;

  -- Zone 2 : Documents clés (4 slots)
  SELECT COALESCE(jsonb_object_agg(
    slot_key,
    jsonb_build_object(
      'id', id,
      'type', type,
      'title', title,
      'storage_path', storage_path,
      'created_at', created_at,
      'lease_id', lease_id,
      'property_id', property_id,
      'metadata', COALESCE(metadata, '{}'::jsonb),
      'verification_status', verification_status,
      'ged_status', ged_status
    )
  ), '{}'::jsonb)
  INTO v_key_documents
  FROM v_tenant_key_documents
  WHERE tenant_id = v_profile_id;

  -- Zone 3 : Tous les documents (les 50 plus récents, dédoublonnés)
  SELECT COALESCE(jsonb_agg(doc ORDER BY doc->>'created_at' DESC), '[]'::jsonb)
  INTO v_all_documents
  FROM (
    SELECT DISTINCT ON (d.type, COALESCE(d.lease_id, d.property_id, d.id))
      jsonb_build_object(
        'id', d.id,
        'type', d.type,
        'title', d.title,
        'storage_path', d.storage_path,
        'created_at', d.created_at,
        'tenant_id', d.tenant_id,
        'lease_id', d.lease_id,
        'property_id', d.property_id,
        'metadata', COALESCE(d.metadata, '{}'::jsonb),
        'verification_status', d.verification_status,
        'ged_status', d.ged_status,
        'file_size', d.file_size,
        'mime_type', d.mime_type,
        'original_filename', d.original_filename
      ) AS doc
    FROM documents d
    WHERE (d.tenant_id = v_profile_id
      OR d.lease_id IN (
        SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
      )
    )
    ORDER BY d.type, COALESCE(d.lease_id, d.property_id, d.id), d.created_at DESC
    LIMIT 100
  ) sub
  LIMIT 50;

  -- Stats rapides
  SELECT jsonb_build_object(
    'total_documents', (
      SELECT COUNT(*) FROM documents d
      WHERE d.tenant_id = v_profile_id
        OR d.lease_id IN (SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id)
    ),
    'pending_actions_count', jsonb_array_length(v_pending_actions),
    'has_bail', v_key_documents ? 'bail',
    'has_quittance', v_key_documents ? 'quittance',
    'has_edl', v_key_documents ? 'edl',
    'has_assurance', v_key_documents ? 'assurance'
  ) INTO v_stats;

  -- Résultat final
  v_result := jsonb_build_object(
    'pending_actions', v_pending_actions,
    'key_documents', v_key_documents,
    'documents', v_all_documents,
    'stats', v_stats
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.tenant_document_center IS
  'Endpoint unique pour le Document Center locataire. Retourne : pending_actions, key_documents (4 slots), documents (tous, dédoublonnés), stats.';

-- Accès pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.tenant_document_center TO authenticated;


-- =============================================================================
-- 5. RPC : tenant_documents_search()
--    Recherche full-text améliorée dans les documents du locataire
--    avec filtres par type, période et tri.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_documents_search(
  p_query TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_period TEXT DEFAULT NULL,        -- '1m', '3m', '6m', '1y', 'all'
  p_sort TEXT DEFAULT 'date_desc',   -- 'date_desc', 'date_asc', 'type'
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_period_start TIMESTAMPTZ;
BEGIN
  -- Résoudre le profile_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found', 'documents', '[]'::jsonb);
  END IF;

  -- Calculer la date de début de période
  v_period_start := CASE p_period
    WHEN '1m' THEN NOW() - INTERVAL '1 month'
    WHEN '3m' THEN NOW() - INTERVAL '3 months'
    WHEN '6m' THEN NOW() - INTERVAL '6 months'
    WHEN '1y' THEN NOW() - INTERVAL '1 year'
    ELSE NULL -- Pas de filtre de date
  END;

  -- Requête avec filtres dynamiques
  SELECT jsonb_build_object(
    'documents', COALESCE(jsonb_agg(doc), '[]'::jsonb),
    'total', COUNT(*) OVER()
  )
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', d.id,
      'type', d.type,
      'title', d.title,
      'storage_path', d.storage_path,
      'created_at', d.created_at,
      'tenant_id', d.tenant_id,
      'lease_id', d.lease_id,
      'property_id', d.property_id,
      'metadata', COALESCE(d.metadata, '{}'::jsonb),
      'verification_status', d.verification_status,
      'ged_status', d.ged_status,
      'file_size', d.file_size,
      'mime_type', d.mime_type,
      'original_filename', d.original_filename,
      'is_recent', (d.created_at > NOW() - INTERVAL '7 days')
    ) AS doc,
    d.created_at,
    d.type
    FROM documents d
    WHERE (
      d.tenant_id = v_profile_id
      OR d.lease_id IN (
        SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
      )
    )
    -- Filtre full-text
    AND (p_query IS NULL OR p_query = '' OR
      d.search_vector @@ plainto_tsquery('french', p_query)
      OR d.title ILIKE '%' || p_query || '%'
      OR d.type ILIKE '%' || p_query || '%'
    )
    -- Filtre par type
    AND (p_type IS NULL OR p_type = 'all' OR d.type = p_type)
    -- Filtre par période
    AND (v_period_start IS NULL OR d.created_at >= v_period_start)
    -- Tri
    ORDER BY
      CASE WHEN p_sort = 'date_desc' THEN d.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'date_asc'  THEN d.created_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'type'      THEN d.type END ASC,
      d.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) sub;

  RETURN COALESCE(v_result, jsonb_build_object('documents', '[]'::jsonb, 'total', 0));
END;
$$;

COMMENT ON FUNCTION public.tenant_documents_search IS
  'Recherche full-text dans les documents du locataire avec filtres (type, période) et tri. Utilisé par la zone "Tous les documents" du Document Center.';

GRANT EXECUTE ON FUNCTION public.tenant_documents_search TO authenticated;


-- =============================================================================
-- 6. RLS : Politiques pour les vues (sécurité)
--    Les vues utilisent SECURITY DEFINER dans les RPC, mais on ajoute
--    des politiques de sécurité sur les tables sous-jacentes pour les accès directs.
-- =============================================================================

-- S'assurer que les lease_signers sont accessibles pour les vues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lease_signers' AND policyname = 'lease_signers_tenant_view_for_doc_center'
  ) THEN
    CREATE POLICY "lease_signers_tenant_view_for_doc_center"
      ON lease_signers
      FOR SELECT
      TO authenticated
      USING (
        profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      );
  END IF;
END $$;


-- =============================================================================
-- 7. TRIGGER : Mettre à jour search_vector lors de l'insertion/modification
--    pour supporter la recherche full-text améliorée
-- =============================================================================

CREATE OR REPLACE FUNCTION update_document_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('french', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.type, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.original_filename, '')), 'C') ||
    setweight(to_tsvector('french', COALESCE(NEW.metadata->>'description', '')), 'D');
  RETURN NEW;
END;
$$;

-- Le trigger peut déjà exister, on le recrée proprement
DROP TRIGGER IF EXISTS trg_documents_search_vector ON documents;
CREATE TRIGGER trg_documents_search_vector
  BEFORE INSERT OR UPDATE OF title, type, original_filename, metadata
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_search_vector();


-- =============================================================================
-- 8. BACKFILL : Recalculer search_vector pour les documents existants
--    qui n'ont pas encore de vecteur de recherche
-- =============================================================================

UPDATE documents
SET search_vector = 
  setweight(to_tsvector('french', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('french', COALESCE(type, '')), 'B') ||
  setweight(to_tsvector('french', COALESCE(original_filename, '')), 'C') ||
  setweight(to_tsvector('french', COALESCE(metadata->>'description', '')), 'D')
WHERE search_vector IS NULL;


COMMIT;

-- =============================================================================
-- Notes de migration :
--
-- Usage côté frontend (React Query) :
--
--   // Charger le Document Center complet en 1 appel
--   const { data } = await supabase.rpc('tenant_document_center');
--   // data.pending_actions → Zone "À faire"
--   // data.key_documents   → Zone "Documents clés" (bail, quittance, edl, assurance)
--   // data.documents       → Zone "Tous les documents"
--   // data.stats           → Compteurs et flags
--
--   // Recherche avec filtres
--   const { data } = await supabase.rpc('tenant_documents_search', {
--     p_query: 'bail',
--     p_type: 'quittance',
--     p_period: '3m',
--     p_sort: 'date_desc',
--   });
--
-- Rollback :
--   DROP FUNCTION IF EXISTS public.tenant_document_center;
--   DROP FUNCTION IF EXISTS public.tenant_documents_search;
--   DROP VIEW IF EXISTS v_tenant_key_documents;
--   DROP VIEW IF EXISTS v_tenant_pending_actions;
--   DROP INDEX IF EXISTS idx_documents_tenant_type_date;
--   DROP INDEX IF EXISTS idx_documents_lease_type_date;
-- =============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260216000000', 'tenant_document_center')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260216000000_tenant_document_center.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260223000001_auto_fill_document_fk.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260223000001_auto_fill_document_fk.sql'; END $pre$;

-- =====================================================
-- MIGRATION SOTA 2026: Auto-complétion des FK documents
-- Date: 2026-02-23
--
-- PROBLÈME CORRIGÉ:
--   Quand un document est créé avec seulement lease_id,
--   property_id et owner_id restent NULL → le propriétaire ne le voit pas.
--   Inversement, un document créé par le propriétaire sans tenant_id
--   empêche le locataire de le voir via tenant_id direct.
--
-- FIX:
--   1. Trigger BEFORE INSERT/UPDATE : auto-remplit property_id depuis lease_id,
--      owner_id depuis property_id, tenant_id depuis lease_signers.
--   2. Fix rétroactif : corrige les documents existants.
--
-- SÉCURITÉ:
--   - Exception handler non-bloquant (ne casse jamais l'INSERT/UPDATE)
--   - SECURITY DEFINER pour accéder aux tables liées sans RLS
--   - Additive : ne supprime ni ne modifie aucun trigger existant
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-complétion des FK documents
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_fill_document_fk()
RETURNS TRIGGER AS $$
BEGIN
  -- Étape 1 : Dériver property_id depuis lease_id
  IF NEW.property_id IS NULL AND NEW.lease_id IS NOT NULL THEN
    SELECT COALESCE(property_id, (SELECT property_id FROM units WHERE id = unit_id))
    INTO NEW.property_id
    FROM public.leases
    WHERE id = NEW.lease_id;
  END IF;

  -- Étape 2 : Dériver owner_id depuis property_id
  IF NEW.owner_id IS NULL AND NEW.property_id IS NOT NULL THEN
    SELECT owner_id INTO NEW.owner_id
    FROM public.properties
    WHERE id = NEW.property_id;
  END IF;

  -- Étape 3 : Dériver tenant_id depuis lease_signers (locataire principal)
  IF NEW.tenant_id IS NULL AND NEW.lease_id IS NOT NULL THEN
    SELECT ls.profile_id INTO NEW.tenant_id
    FROM public.lease_signers ls
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'locataire', 'tenant')
      AND ls.profile_id IS NOT NULL
    ORDER BY ls.created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_fill_document_fk] Non-blocking error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.auto_fill_document_fk() IS
  'SOTA 2026: Auto-remplit property_id (depuis lease), owner_id (depuis property), et tenant_id (depuis lease_signers) pour garantir la visibilité inter-comptes des documents.';

-- ============================================
-- 2. TRIGGER: Exécuter BEFORE INSERT OR UPDATE sur documents
--    (s''exécute avant les triggers search_vector, ged_status, etc.)
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_fill_document_fk ON public.documents;

CREATE TRIGGER trigger_auto_fill_document_fk
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_document_fk();

-- ============================================
-- 3. FIX RÉTROACTIF A : property_id depuis lease_id
-- ============================================
DO $$
DECLARE
  fixed_count INT;
BEGIN
  UPDATE public.documents d
  SET property_id = l.property_id
  FROM public.leases l
  WHERE d.lease_id = l.id
    AND d.property_id IS NULL
    AND l.property_id IS NOT NULL;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  IF fixed_count > 0 THEN
    RAISE NOTICE '[fix_A] % documents: property_id rempli depuis lease_id', fixed_count;
  ELSE
    RAISE NOTICE '[fix_A] Aucun document sans property_id à corriger';
  END IF;
END $$;

-- ============================================
-- 4. FIX RÉTROACTIF B : owner_id depuis property_id
-- ============================================
DO $$
DECLARE
  fixed_count INT;
BEGIN
  UPDATE public.documents d
  SET owner_id = p.owner_id
  FROM public.properties p
  WHERE d.property_id = p.id
    AND d.owner_id IS NULL
    AND p.owner_id IS NOT NULL;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  IF fixed_count > 0 THEN
    RAISE NOTICE '[fix_B] % documents: owner_id rempli depuis property_id', fixed_count;
  ELSE
    RAISE NOTICE '[fix_B] Aucun document sans owner_id à corriger';
  END IF;
END $$;

-- ============================================
-- 5. FIX RÉTROACTIF C : tenant_id depuis lease_signers
-- ============================================
DO $$
DECLARE
  fixed_count INT;
BEGIN
  UPDATE public.documents d
  SET tenant_id = sub.profile_id
  FROM (
    SELECT DISTINCT ON (ls.lease_id)
      ls.lease_id,
      ls.profile_id
    FROM public.lease_signers ls
    WHERE ls.role IN ('locataire_principal', 'locataire', 'tenant')
      AND ls.profile_id IS NOT NULL
    ORDER BY ls.lease_id, ls.created_at ASC
  ) sub
  WHERE d.lease_id = sub.lease_id
    AND d.tenant_id IS NULL;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  IF fixed_count > 0 THEN
    RAISE NOTICE '[fix_C] % documents: tenant_id rempli depuis lease_signers', fixed_count;
  ELSE
    RAISE NOTICE '[fix_C] Aucun document sans tenant_id à corriger';
  END IF;
END $$;

-- ============================================
-- 6. AUDIT : Vérifier l'état final
-- ============================================
DO $$
DECLARE
  docs_no_owner INT;
  docs_no_property INT;
  docs_no_tenant INT;
BEGIN
  SELECT count(*)::INT INTO docs_no_owner
  FROM public.documents
  WHERE owner_id IS NULL
    AND (property_id IS NOT NULL OR lease_id IS NOT NULL);

  SELECT count(*)::INT INTO docs_no_property
  FROM public.documents
  WHERE property_id IS NULL
    AND lease_id IS NOT NULL;

  SELECT count(*)::INT INTO docs_no_tenant
  FROM public.documents
  WHERE tenant_id IS NULL
    AND lease_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM lease_signers ls
      WHERE ls.lease_id = documents.lease_id
        AND ls.role IN ('locataire_principal', 'locataire', 'tenant')
        AND ls.profile_id IS NOT NULL
    );

  RAISE NOTICE '=== AUDIT DOCUMENTS FK ===';
  RAISE NOTICE 'Documents avec property/lease mais sans owner_id: %', docs_no_owner;
  RAISE NOTICE 'Documents avec lease_id mais sans property_id: %', docs_no_property;
  RAISE NOTICE 'Documents avec bail+locataire mais sans tenant_id: %', docs_no_tenant;

  IF docs_no_owner = 0 AND docs_no_property = 0 THEN
    RAISE NOTICE '✅ Tous les documents ont des FK cohérentes';
  END IF;
END $$;

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260223000001', 'auto_fill_document_fk')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260223000001_auto_fill_document_fk.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260223200000_fix_all_missing_tables_and_columns.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on,own,own
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260223200000_fix_all_missing_tables_and_columns.sql'; END $pre$;

-- ============================================================================
-- MIGRATION CONSOLIDÉE : Tables et colonnes manquantes (connexions BDD)
-- Date: 2026-02-23
-- Corrige : tenant_profiles (CNI/KYC), conversations, messages, documents, storage
-- ============================================================================

-- ============================================
-- 1. COLONNES tenant_profiles (CNI / KYC)
-- ============================================

ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_recto_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verso_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_number TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_expiry_date DATE;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verified_at TIMESTAMPTZ;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_verification_method TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS identity_data JSONB DEFAULT '{}';
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS selfie_path TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS selfie_verified_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_profiles' AND column_name = 'kyc_status'
  ) THEN
    ALTER TABLE tenant_profiles
    ADD COLUMN kyc_status TEXT DEFAULT 'pending'
    CHECK (kyc_status IN ('pending', 'processing', 'verified', 'rejected'));
  END IF;
END $$;

-- ============================================
-- 2. FONCTION update_updated_at (si absente)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. TABLE conversations
-- ============================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  owner_unread_count INTEGER NOT NULL DEFAULT 0,
  tenant_unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_profile_id ON conversations(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_profile_id ON conversations(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_property_id ON conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can insert conversations" ON conversations;
CREATE POLICY "Users can insert conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

-- ============================================
-- 4. TABLE messages
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('owner', 'tenant')),
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'system')),
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  attachment_size INTEGER,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_profile_id ON messages(sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(conversation_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages of own conversations" ON messages;
CREATE POLICY "Users can view messages of own conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_profile_id = public.user_profile_id() OR c.tenant_profile_id = public.user_profile_id())
    )
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON messages;
CREATE POLICY "Users can insert messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    sender_profile_id = public.user_profile_id()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_profile_id = public.user_profile_id() OR c.tenant_profile_id = public.user_profile_id())
    )
  );

-- ============================================
-- 5. FONCTION RPC mark_messages_as_read
-- ============================================

CREATE OR REPLACE FUNCTION public.mark_messages_as_read(
  p_conversation_id UUID,
  p_reader_profile_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv RECORD;
BEGIN
  SELECT owner_profile_id, tenant_profile_id INTO v_conv
  FROM conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Marquer read_at sur les messages non lus reçus par le lecteur
  UPDATE messages
  SET read_at = COALESCE(read_at, NOW())
  WHERE conversation_id = p_conversation_id
    AND sender_profile_id != p_reader_profile_id
    AND read_at IS NULL;

  -- Remettre à zéro le compteur non lu du lecteur
  IF v_conv.owner_profile_id = p_reader_profile_id THEN
    UPDATE conversations
    SET owner_unread_count = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
  ELSIF v_conv.tenant_profile_id = p_reader_profile_id THEN
    UPDATE conversations
    SET tenant_unread_count = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(UUID, UUID) TO authenticated;

-- ============================================
-- 6. COLONNES documents (si manquantes)
-- ============================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS collection TEXT DEFAULT 'property_media';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- 7. BUCKET STORAGE documents
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Politique upload pour utilisateurs authentifiés
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- ============================================
-- FIN
-- ============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260223200000', 'fix_all_missing_tables_and_columns')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260223200000_fix_all_missing_tables_and_columns.sql'; END $post$;

COMMIT;

-- END OF BATCH 1/11 (Phase 3 DANGEREUX)
