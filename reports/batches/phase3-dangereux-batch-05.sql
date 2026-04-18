-- ====================================================================
-- Sprint B2 — Phase 3 DANGEREUX — Batch 5/11
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
-- Migration: 20260329170000_add_punctuality_score.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : of
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260329170000_add_punctuality_score.sql'; END $pre$;

-- Migration: Ajouter le score de ponctualité sur les baux
-- Le score mesure le % de paiements reçus à temps (avant date_echeance)

-- 1. Colonne sur leases
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS punctuality_score DECIMAL(5,2) DEFAULT NULL;

COMMENT ON COLUMN leases.punctuality_score IS
  'Score de ponctualité du locataire (0-100). NULL = pas encore de données. Mis à jour par trigger.';

-- 2. Fonction de calcul
CREATE OR REPLACE FUNCTION compute_punctuality_score(p_lease_id UUID)
RETURNS DECIMAL(5,2) AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- 3. Trigger pour recalculer à chaque changement de facture
CREATE OR REPLACE FUNCTION trigger_update_punctuality_score()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_punctuality_score ON invoices;

CREATE TRIGGER trg_update_punctuality_score
  AFTER INSERT OR UPDATE OF statut, date_paiement ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_punctuality_score();

-- 4. Calculer le score initial pour tous les baux existants
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT lease_id FROM invoices WHERE lease_id IS NOT NULL LOOP
    UPDATE leases
    SET punctuality_score = compute_punctuality_score(r.lease_id)
    WHERE id = r.lease_id;
  END LOOP;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260329170000', 'add_punctuality_score')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260329170000_add_punctuality_score.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260329180000_notify_owner_edl_signed.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : of
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260329180000_notify_owner_edl_signed.sql'; END $pre$;

-- Migration: Notification propriétaire quand un EDL est signé par les deux parties
-- Date: 2026-03-29
-- Description: Ajoute un trigger qui notifie le propriétaire lorsqu'un EDL passe en statut "signed"

-- ============================================================================
-- Fonction de notification EDL signé → propriétaire
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_owner_edl_signed()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger sur la table edl (UPDATE du statut)
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_notify_owner_edl_signed ON edl;
CREATE TRIGGER trigger_notify_owner_edl_signed
    AFTER UPDATE OF status ON edl
    FOR EACH ROW
    WHEN (NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed')
    EXECUTE FUNCTION public.notify_owner_edl_signed();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260329180000', 'notify_owner_edl_signed')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260329180000_notify_owner_edl_signed.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260329190000_force_visible_tenant_generated_docs.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260329190000_force_visible_tenant_generated_docs.sql'; END $pre$;

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
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_generated = true THEN
        NEW.visible_tenant := true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Trigger on documents table
-- ============================================================================
DROP TRIGGER IF EXISTS trg_force_visible_tenant_on_generated ON documents;
CREATE TRIGGER trg_force_visible_tenant_on_generated
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION public.force_visible_tenant_on_generated();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260329190000', 'force_visible_tenant_generated_docs')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260329190000_force_visible_tenant_generated_docs.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408042218_create_expenses_table.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408042218_create_expenses_table.sql'; END $pre$;

-- Migration: Table expenses (dépenses/travaux propriétaire)
-- Date: 2026-04-08
-- RLS via chaîne : legal_entities.owner_profile_id → owner_profiles.profile_id
-- Compatible multi-entités (legal_entity_id) + particulier (owner_profile_id direct)

BEGIN;

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
DROP POLICY IF EXISTS "Owners can view own expenses" ON expenses;
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

DROP POLICY IF EXISTS "Owners can insert own expenses" ON expenses;
CREATE POLICY "Owners can insert own expenses" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can update own expenses" ON expenses;
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

DROP POLICY IF EXISTS "Owners can delete own expenses" ON expenses;
CREATE POLICY "Owners can delete own expenses" ON expenses
  FOR DELETE TO authenticated
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins full access on expenses" ON expenses;
CREATE POLICY "Admins full access on expenses" ON expenses
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- TRIGGER: updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408042218', 'create_expenses_table')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408042218_create_expenses_table.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408120000_api_keys_webhooks.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on,on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408120000_api_keys_webhooks.sql'; END $pre$;

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
DROP POLICY IF EXISTS "api_keys_select_own" ON api_keys;
CREATE POLICY "api_keys_select_own" ON api_keys
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_keys_insert_own" ON api_keys;
CREATE POLICY "api_keys_insert_own" ON api_keys
  FOR INSERT WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_keys_update_own" ON api_keys;
CREATE POLICY "api_keys_update_own" ON api_keys
  FOR UPDATE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_keys_delete_own" ON api_keys;
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
DROP POLICY IF EXISTS "api_logs_select_own" ON api_logs;
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
DROP POLICY IF EXISTS "api_webhooks_select_own" ON api_webhooks;
CREATE POLICY "api_webhooks_select_own" ON api_webhooks
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_webhooks_insert_own" ON api_webhooks;
CREATE POLICY "api_webhooks_insert_own" ON api_webhooks
  FOR INSERT WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_webhooks_update_own" ON api_webhooks;
CREATE POLICY "api_webhooks_update_own" ON api_webhooks
  FOR UPDATE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_webhooks_delete_own" ON api_webhooks;
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
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_api_keys_updated_at') THEN
    DROP TRIGGER IF EXISTS set_api_keys_updated_at ON api_keys;
    CREATE TRIGGER set_api_keys_updated_at
      BEFORE UPDATE ON api_keys
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_api_webhooks_updated_at') THEN
    DROP TRIGGER IF EXISTS set_api_webhooks_updated_at ON api_webhooks;
    CREATE TRIGGER set_api_webhooks_updated_at
      BEFORE UPDATE ON api_webhooks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408120000', 'api_keys_webhooks')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408120000_api_keys_webhooks.sql'; END $post$;

COMMIT;

-- END OF BATCH 5/11 (Phase 3 DANGEREUX)
