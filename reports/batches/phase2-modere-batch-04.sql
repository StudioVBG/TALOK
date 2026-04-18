-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 4/15
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
-- Migration: 20260224100000_normalize_provider_names.sql
-- Note: file on disk is 20260224100000_normalize_provider_names.sql but will be renamed to 20260224100001_normalize_provider_names.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260224100000_normalize_provider_names.sql'; END $pre$;

-- Normalise les noms des providers pour correspondre au code (Twilio, Stripe, etc.)
-- Le code credentials-service.ts cherche des noms capitalisés.

UPDATE api_providers SET name = 'Twilio' WHERE lower(name) = 'twilio';
UPDATE api_providers SET name = 'Stripe' WHERE lower(name) = 'stripe';
UPDATE api_providers SET name = 'GoCardless' WHERE lower(name) = 'gocardless';
UPDATE api_providers SET name = 'Mindee' WHERE lower(name) = 'mindee';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260224100001', 'normalize_provider_names')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260224100000_normalize_provider_names.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260225000000_owner_payment_audit_log.sql
-- Risk: MODERE
-- Why: +3 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260225000000_owner_payment_audit_log.sql'; END $pre$;

-- ============================================================
-- SOTA 2026 : Journal d'audit PSD3 pour les moyens de paiement propriétaire
-- Traçabilité des actions (carte ajoutée/supprimée, défaut, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS owner_payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payment_method_type TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opal_owner_created ON owner_payment_audit_log(owner_id, created_at DESC);

COMMENT ON TABLE owner_payment_audit_log IS 'Audit trail PSD3 pour les opérations sur les moyens de paiement propriétaire (abonnement, carte, etc.)';

ALTER TABLE owner_payment_audit_log ENABLE ROW LEVEL SECURITY;

-- Le propriétaire ne voit que ses propres logs
CREATE POLICY "opal_select_own" ON owner_payment_audit_log
  FOR SELECT USING (owner_id = public.user_profile_id());

-- Le propriétaire peut insérer des logs pour lui-même (via l'API qui utilise son session)
CREATE POLICY "opal_insert_own" ON owner_payment_audit_log
  FOR INSERT WITH CHECK (owner_id = public.user_profile_id());

-- L'admin voit et gère tout (lecture seule en pratique, pas de UPDATE/DELETE prévus)
CREATE POLICY "opal_admin_all" ON owner_payment_audit_log
  FOR ALL USING (public.user_role() = 'admin');

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260225000000', 'owner_payment_audit_log')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260225000000_owner_payment_audit_log.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260225000001_fix_furniture_vetusty_rls.sql
-- Risk: MODERE
-- Why: +11 policies, -11 policies, UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260225000001_fix_furniture_vetusty_rls.sql'; END $pre$;

-- ============================================================================
-- P0-4: Correction RLS vétusté et mobilier
-- properties.owner_id et lease_signers.profile_id sont des profiles.id,
-- alors que auth.uid() renvoie auth.users.id. Il faut joindre profiles
-- et comparer pr.user_id = auth.uid().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. furniture_inventories
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS furniture_inventories_owner_policy ON furniture_inventories;
CREATE POLICY furniture_inventories_owner_policy ON furniture_inventories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = furniture_inventories.lease_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS furniture_inventories_tenant_policy ON furniture_inventories;
CREATE POLICY furniture_inventories_tenant_policy ON furniture_inventories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE l.id = furniture_inventories.lease_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 2. furniture_items
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS furniture_items_owner_policy ON furniture_items;
CREATE POLICY furniture_items_owner_policy ON furniture_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE fi.id = furniture_items.inventory_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS furniture_items_tenant_policy ON furniture_items;
CREATE POLICY furniture_items_tenant_policy ON furniture_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE fi.id = furniture_items.inventory_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 3. vetusty_reports
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "vetusty_reports_select_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_select_policy" ON vetusty_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr_owner ON pr_owner.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND (
        pr_owner.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          JOIN profiles pr ON pr.id = ls.profile_id
          WHERE ls.lease_id = l.id
          AND pr.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "vetusty_reports_insert_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_insert_policy" ON vetusty_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_reports_update_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_update_policy" ON vetusty_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. vetusty_items
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "vetusty_items_select_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_select_policy" ON vetusty_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr_owner ON pr_owner.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND (
        pr_owner.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          JOIN profiles pr ON pr.id = ls.profile_id
          WHERE ls.lease_id = l.id
          AND pr.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "vetusty_items_insert_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_insert_policy" ON vetusty_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_items_update_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_update_policy" ON vetusty_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_items_delete_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_delete_policy" ON vetusty_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
      AND vr.status = 'draft'
    )
  );

-- vetusty_grid_versions reste en lecture publique (USING (true)), pas de modification.

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260225000001', 'fix_furniture_vetusty_rls')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260225000001_fix_furniture_vetusty_rls.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260226000000_backfill_existing_invoices_tenant_id.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260226000000_backfill_existing_invoices_tenant_id.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Backfill invoices.tenant_id pour les profils existants
-- Date: 2026-02-26
--
-- OBJECTIF:
--   Pour les factures existantes où tenant_id est NULL mais où
--   un lease_signer avec role locataire_principal existe et est
--   déjà lié à un profil, on renseigne le tenant_id.
--
-- SÉCURITÉ:
--   - Ne touche QUE les lignes où tenant_id IS NULL
--   - Ne crée aucune donnée, ne supprime rien
--   - Idempotent : peut être exécuté plusieurs fois sans effet
-- =====================================================

-- Backfill : lier les factures orphelines aux profils existants
UPDATE public.invoices i
SET tenant_id = ls.profile_id
FROM public.lease_signers ls
WHERE i.lease_id = ls.lease_id
  AND ls.role = 'locataire_principal'
  AND ls.profile_id IS NOT NULL
  AND i.tenant_id IS NULL;

-- Log du nombre de lignes mises à jour (visible dans les logs Supabase)
DO $$
DECLARE
  updated_count INT;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '[backfill_invoices_tenant_id] % factures liées à leur locataire', updated_count;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260226000000', 'backfill_existing_invoices_tenant_id')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260226000000_backfill_existing_invoices_tenant_id.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260226000000_fix_notifications_triggers.sql
-- Note: file on disk is 20260226000000_fix_notifications_triggers.sql but will be renamed to 20260226000001_fix_notifications_triggers.sql
-- Risk: MODERE
-- Why: +1 triggers, ALTER column (type/constraint)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260226000000_fix_notifications_triggers.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Fix notifications body NOT NULL + trigger document center
-- Date: 2026-02-26
--
-- BUG 1: trg_notify_tenant_document_center faisait INSERT direct sans body/user_id
--        -> échec de l'INSERT document. On utilise create_notification() à la place.
-- BUG 2: create_notification() n'insérait pas body (NOT NULL) -> échec silencieux.
-- =====================================================

BEGIN;

-- Filet de sécurité : body peut avoir une valeur par défaut si jamais oublié
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'body') THEN
    ALTER TABLE notifications ALTER COLUMN body SET DEFAULT '';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fix_notifications] body default: %', SQLERRM;
END $$;

-- Recréer create_notification() en insérant body = p_message (requis NOT NULL)
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_user_id UUID;
  v_is_profile BOOLEAN := false;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE id = p_recipient_id
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    v_is_profile := true;
  ELSE
    v_user_id := p_recipient_id;
  END IF;

  IF v_is_profile THEN
    INSERT INTO notifications (
      user_id,
      profile_id,
      type,
      title,
      body,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_recipient_id,
      p_type,
      p_title,
      COALESCE(NULLIF(TRIM(p_message), ''), '(sans contenu)'),
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  ELSE
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      message,
      link,
      related_id,
      related_type
    ) VALUES (
      v_user_id,
      p_type,
      p_title,
      COALESCE(NULLIF(TRIM(p_message), ''), '(sans contenu)'),
      p_message,
      p_link,
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN v_notification_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_notification] Erreur: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) IS
'Crée une notification. body et message remplis avec p_message. p_recipient_id = profile_id ou user_id.';

-- Remplacer le trigger document center : utiliser create_notification() au lieu d'INSERT direct
CREATE OR REPLACE FUNCTION notify_tenant_document_center_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_label TEXT;
  v_notification_type TEXT;
  v_message TEXT;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

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

  v_message := v_doc_label || ' est disponible dans votre espace documents.';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    PERFORM create_notification(
      NEW.tenant_id,
      v_notification_type,
      v_doc_label || ' a été ajouté',
      v_message,
      '/tenant/documents',
      NEW.id,
      'document'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_tenant_document_center_update] Non-blocking: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tenant_document_center ON documents;
CREATE TRIGGER trg_notify_tenant_document_center
  AFTER INSERT ON documents
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NOT NULL)
  EXECUTE FUNCTION notify_tenant_document_center_update();

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260226000001', 'fix_notifications_triggers')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260226000000_fix_notifications_triggers.sql'; END $post$;

COMMIT;

-- END OF BATCH 4/15 (Phase 2 MODERE)
