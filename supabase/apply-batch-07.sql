-- Batch 7 — migrations 143 a 160 sur 169
-- 18 migrations

-- === [143/169] 20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql ===
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

BEGIN;

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
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER charge_regularisations_on_insert
  INSTEAD OF INSERT ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_insert_redirect();

CREATE OR REPLACE FUNCTION charge_regularisations_update_redirect()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER charge_regularisations_on_update
  INSTEAD OF UPDATE ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_update_redirect();

CREATE OR REPLACE FUNCTION charge_regularisations_delete_redirect()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.charge_regularizations WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

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

COMMIT;


-- === [144/169] 20260408100000_copro_lots.sql ===
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


-- === [145/169] 20260408100000_create_push_subscriptions.sql ===
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


-- === [146/169] 20260408110000_agency_hoguet.sql ===
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


-- === [147/169] 20260408120000_api_keys_webhooks.sql ===
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
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
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
END $$;


-- === [148/169] 20260408120000_colocation_module.sql ===
-- ============================================================
-- Migration: Module Colocation SOTA 2026
-- Tables: colocation_rooms, colocation_members, colocation_rules,
--         colocation_tasks, colocation_expenses
-- View:   v_colocation_balances
-- Alters: properties, leases
-- ============================================================

-- ============================================================
-- 1. Alter existing tables
-- ============================================================

ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  colocation_type TEXT CHECK (colocation_type IN ('bail_unique', 'baux_individuels'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  has_solidarity_clause BOOLEAN DEFAULT true;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  max_colocataires INTEGER;

ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  is_colocation BOOLEAN DEFAULT false;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  colocation_type TEXT CHECK (colocation_type IN ('bail_unique', 'baux_individuels'));
ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  solidarity_clause BOOLEAN DEFAULT false;

-- ============================================================
-- 2. Chambres d'une colocation
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  room_label TEXT,
  surface_m2 NUMERIC(6,2),
  rent_share_cents INTEGER NOT NULL,
  charges_share_cents INTEGER DEFAULT 0,
  is_furnished BOOLEAN DEFAULT false,
  description TEXT,
  photos JSONB DEFAULT '[]',
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, room_number)
);

ALTER TABLE colocation_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coloc_rooms_property ON colocation_rooms(property_id);

-- RLS: owner can manage rooms, tenant can read rooms of their property
CREATE POLICY coloc_rooms_owner_all ON colocation_rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_rooms.property_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY coloc_rooms_tenant_select ON colocation_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE l.property_id = colocation_rooms.property_id
        AND pr.user_id = auth.uid()
        AND l.statut IN ('active', 'pending')
    )
  );

-- ============================================================
-- 3. Membres d'une colocation
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  room_id UUID REFERENCES colocation_rooms(id),
  lease_id UUID NOT NULL REFERENCES leases(id),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id),

  -- Statut
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'departing', 'departed')),

  -- Dates
  move_in_date DATE NOT NULL,
  move_out_date DATE,
  notice_given_at TIMESTAMPTZ,
  notice_effective_date DATE,
  solidarity_end_date DATE,

  -- Financier
  rent_share_cents INTEGER NOT NULL,
  charges_share_cents INTEGER DEFAULT 0,
  deposit_cents INTEGER DEFAULT 0,
  deposit_returned BOOLEAN DEFAULT false,

  -- Paiement SEPA
  stripe_payment_method_id TEXT,
  pays_individually BOOLEAN DEFAULT false,

  -- Remplacement
  replaced_by_member_id UUID REFERENCES colocation_members(id),
  replaces_member_id UUID REFERENCES colocation_members(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coloc_members_property ON colocation_members(property_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_lease ON colocation_members(lease_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_tenant ON colocation_members(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_status ON colocation_members(status) WHERE status = 'active';

-- RLS: owner can manage members
CREATE POLICY coloc_members_owner_all ON colocation_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_members.property_id
        AND pr.user_id = auth.uid()
    )
  );

-- RLS: tenant can read members of their colocation
CREATE POLICY coloc_members_tenant_select ON colocation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm2
      WHERE cm2.property_id = colocation_members.property_id
        AND cm2.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm2.status IN ('active', 'departing')
    )
  );

-- ============================================================
-- 4. Reglement interieur
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'menage', 'bruit', 'invites', 'animaux',
                        'espaces_communs', 'charges', 'autre')),
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY coloc_rules_owner_all ON colocation_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_rules.property_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY coloc_rules_tenant_select ON colocation_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_rules.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );

-- ============================================================
-- 5. Planning taches partagees
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  recurrence TEXT DEFAULT 'weekly'
    CHECK (recurrence IN ('daily', 'weekly', 'biweekly', 'monthly')),
  assigned_member_id UUID REFERENCES colocation_members(id),
  assigned_room_id UUID REFERENCES colocation_rooms(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  rotation_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY coloc_tasks_owner_all ON colocation_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_tasks.property_id
        AND pr.user_id = auth.uid()
    )
  );

-- Tenants can read and update tasks (mark as completed)
CREATE POLICY coloc_tasks_tenant_select ON colocation_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_tasks.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );

CREATE POLICY coloc_tasks_tenant_update ON colocation_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_tasks.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status = 'active'
    )
  );

-- ============================================================
-- 6. Depenses partagees entre colocataires
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  paid_by_member_id UUID NOT NULL REFERENCES colocation_members(id),
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  category TEXT DEFAULT 'autre'
    CHECK (category IN ('menage', 'courses', 'internet', 'electricite',
                        'eau', 'reparation', 'autre')),
  split_type TEXT DEFAULT 'equal'
    CHECK (split_type IN ('equal', 'by_room', 'custom')),
  split_details JSONB,
  receipt_document_id UUID REFERENCES documents(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY coloc_expenses_owner_all ON colocation_expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_expenses.property_id
        AND pr.user_id = auth.uid()
    )
  );

-- Tenants can read and create expenses
CREATE POLICY coloc_expenses_tenant_select ON colocation_expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_expenses.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );

CREATE POLICY coloc_expenses_tenant_insert ON colocation_expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_expenses.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status = 'active'
    )
  );

-- ============================================================
-- 7. Vue : Soldes entre colocataires
-- ============================================================

CREATE OR REPLACE VIEW v_colocation_balances AS
WITH active_member_counts AS (
  SELECT property_id, COUNT(*) AS cnt
  FROM colocation_members
  WHERE status = 'active'
  GROUP BY property_id
),
room_rent_totals AS (
  SELECT cr.property_id,
         SUM(cr.rent_share_cents) AS total_rent
  FROM colocation_rooms cr
  WHERE cr.is_available = false
  GROUP BY cr.property_id
),
expense_shares AS (
  SELECT
    e.property_id,
    e.paid_by_member_id AS payer_id,
    cm.id AS debtor_id,
    CASE e.split_type
      WHEN 'equal' THEN e.amount_cents / NULLIF(amc.cnt, 0)
      WHEN 'by_room' THEN
        CASE WHEN rrt.total_rent > 0 AND cr.rent_share_cents IS NOT NULL
          THEN cr.rent_share_cents * e.amount_cents / rrt.total_rent
          ELSE e.amount_cents / NULLIF(amc.cnt, 0)
        END
      ELSE COALESCE((e.split_details->>(cm.id::text))::int, 0)
    END AS share_cents
  FROM colocation_expenses e
  JOIN colocation_members cm
    ON cm.property_id = e.property_id AND cm.status = 'active'
  LEFT JOIN active_member_counts amc
    ON amc.property_id = e.property_id
  LEFT JOIN colocation_rooms cr
    ON cr.id = cm.room_id
  LEFT JOIN room_rent_totals rrt
    ON rrt.property_id = e.property_id
  WHERE NOT e.is_settled
)
SELECT
  property_id,
  payer_id,
  debtor_id,
  SUM(share_cents)::INTEGER AS total_owed_cents
FROM expense_shares
WHERE payer_id != debtor_id
GROUP BY property_id, payer_id, debtor_id;

-- ============================================================
-- 8. Triggers updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_colocation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coloc_rooms_updated_at
  BEFORE UPDATE ON colocation_rooms
  FOR EACH ROW EXECUTE FUNCTION update_colocation_updated_at();

CREATE TRIGGER trg_coloc_members_updated_at
  BEFORE UPDATE ON colocation_members
  FOR EACH ROW EXECUTE FUNCTION update_colocation_updated_at();

-- ============================================================
-- 9. Function: Auto-calculate solidarity_end_date
-- ============================================================

CREATE OR REPLACE FUNCTION auto_solidarity_end_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If member is departing and has a move_out_date, calculate solidarity end
  IF NEW.status = 'departing' AND NEW.move_out_date IS NOT NULL THEN
    -- If replaced, solidarity ends immediately
    IF NEW.replaced_by_member_id IS NOT NULL THEN
      NEW.solidarity_end_date = NEW.move_out_date;
    ELSE
      -- 6 months after move_out (loi ALUR)
      NEW.solidarity_end_date = NEW.move_out_date + INTERVAL '6 months';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coloc_solidarity_end
  BEFORE INSERT OR UPDATE ON colocation_members
  FOR EACH ROW EXECUTE FUNCTION auto_solidarity_end_date();


-- === [149/169] 20260408120000_edl_sortie_workflow.sql ===
-- ============================================================================
-- MIGRATION: EDL Sortie Workflow — Pièces, Vétusté, Retenues, Comparaison
-- Date: 2026-04-08
-- Description:
--   - Table edl_rooms (pièces structurées avec cotation globale)
--   - Extension edl_items avec champs comparaison entrée/sortie
--   - Extension edl avec champs sortie (retenues, dépôt, lien entrée)
--   - Table vetuste_grid (grille de vétusté)
--   - Mise à jour contraintes condition (6 niveaux)
-- ============================================================================

-- ─── 1. Étendre la table edl pour le workflow sortie ────────────────────────

DO $$
BEGIN
    -- Lien vers l'EDL d'entrée (pour EDL sortie)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'linked_entry_edl_id') THEN
        ALTER TABLE edl ADD COLUMN linked_entry_edl_id UUID REFERENCES edl(id);
    END IF;

    -- Parties présentes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'owner_present') THEN
        ALTER TABLE edl ADD COLUMN owner_present BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'owner_representative') THEN
        ALTER TABLE edl ADD COLUMN owner_representative TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'tenant_profiles') THEN
        ALTER TABLE edl ADD COLUMN tenant_profiles UUID[] DEFAULT '{}';
    END IF;

    -- Retenues sur dépôt (sortie uniquement)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'total_retenue_cents') THEN
        ALTER TABLE edl ADD COLUMN total_retenue_cents INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'retenue_details') THEN
        ALTER TABLE edl ADD COLUMN retenue_details JSONB DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'depot_garantie_cents') THEN
        ALTER TABLE edl ADD COLUMN depot_garantie_cents INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'montant_restitue_cents') THEN
        ALTER TABLE edl ADD COLUMN montant_restitue_cents INTEGER;
    END IF;
END $$;

-- Index pour la jointure entrée→sortie
CREATE INDEX IF NOT EXISTS idx_edl_linked_entry ON edl(linked_entry_edl_id);

-- ─── 2. Table edl_rooms (pièces structurées) ───────────────────────────────

CREATE TABLE IF NOT EXISTS edl_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edl_id UUID NOT NULL REFERENCES edl(id) ON DELETE CASCADE,

    room_name TEXT NOT NULL,
    room_type TEXT NOT NULL DEFAULT 'autre'
        CHECK (room_type IN (
            'entree','salon','sejour','cuisine','chambre','salle_de_bain',
            'wc','couloir','buanderie','cave','parking','balcon','terrasse',
            'jardin','garage','autre'
        )),
    sort_order INTEGER DEFAULT 0,

    -- État global de la pièce
    general_condition TEXT DEFAULT 'bon'
        CHECK (general_condition IN ('neuf','tres_bon','bon','usage_normal','mauvais','tres_mauvais')),
    observations TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE edl_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_edl_rooms_edl ON edl_rooms(edl_id);

-- RLS policies pour edl_rooms
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_select_policy') THEN
        CREATE POLICY edl_rooms_select_policy ON edl_rooms FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_insert_policy') THEN
        CREATE POLICY edl_rooms_insert_policy ON edl_rooms FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_update_policy') THEN
        CREATE POLICY edl_rooms_update_policy ON edl_rooms FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_delete_policy') THEN
        CREATE POLICY edl_rooms_delete_policy ON edl_rooms FOR DELETE USING (true);
    END IF;
END $$;

-- ─── 3. Étendre edl_items pour comparaison entrée/sortie ───────────────────

DO $$
BEGIN
    -- Lien vers la pièce
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'room_id') THEN
        ALTER TABLE edl_items ADD COLUMN room_id UUID REFERENCES edl_rooms(id) ON DELETE CASCADE;
    END IF;

    -- Type d'élément normalisé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'element_type') THEN
        ALTER TABLE edl_items ADD COLUMN element_type TEXT;
    END IF;

    -- Label personnalisé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'element_label') THEN
        ALTER TABLE edl_items ADD COLUMN element_label TEXT;
    END IF;

    -- Ordre d'affichage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'sort_order') THEN
        ALTER TABLE edl_items ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;

    -- Photos JSONB
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'photos') THEN
        ALTER TABLE edl_items ADD COLUMN photos JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Champs comparaison entrée (remplis auto pour EDL sortie)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_condition') THEN
        ALTER TABLE edl_items ADD COLUMN entry_condition TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_description') THEN
        ALTER TABLE edl_items ADD COLUMN entry_description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_photos') THEN
        ALTER TABLE edl_items ADD COLUMN entry_photos JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Dégradation notée
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'degradation_noted') THEN
        ALTER TABLE edl_items ADD COLUMN degradation_noted BOOLEAN DEFAULT false;
    END IF;

    -- Vétusté
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'vetuste_applicable') THEN
        ALTER TABLE edl_items ADD COLUMN vetuste_applicable BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'vetuste_coefficient') THEN
        ALTER TABLE edl_items ADD COLUMN vetuste_coefficient NUMERIC(3,2);
    END IF;

    -- Retenue sur cet élément
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'retenue_cents') THEN
        ALTER TABLE edl_items ADD COLUMN retenue_cents INTEGER DEFAULT 0;
    END IF;

    -- Coût de réparation estimé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'cout_reparation_cents') THEN
        ALTER TABLE edl_items ADD COLUMN cout_reparation_cents INTEGER DEFAULT 0;
    END IF;
END $$;

-- Mettre à jour la contrainte condition pour 6 niveaux
-- D'abord supprimer l'ancienne contrainte si elle existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'edl_items' AND column_name = 'condition'
    ) THEN
        ALTER TABLE edl_items DROP CONSTRAINT IF EXISTS edl_items_condition_check;
    END IF;
END $$;

ALTER TABLE edl_items ADD CONSTRAINT edl_items_condition_check_v2
    CHECK (condition IS NULL OR condition IN ('neuf','tres_bon','bon','usage_normal','moyen','mauvais','tres_mauvais'));

-- Index pour room_id
CREATE INDEX IF NOT EXISTS idx_edl_items_room_id ON edl_items(room_id);
CREATE INDEX IF NOT EXISTS idx_edl_items_element_type ON edl_items(element_type);

-- ─── 4. Table vetuste_grid (grille de vétusté) ─────────────────────────────

CREATE TABLE IF NOT EXISTS vetuste_grid (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_type TEXT NOT NULL,
    duree_vie_ans INTEGER NOT NULL,
    taux_abattement_annuel NUMERIC(4,2),
    valeur_residuelle_min NUMERIC(3,2) DEFAULT 0.10,
    source TEXT DEFAULT 'talok',
    notes TEXT
);

-- Seed grille standard (idempotent)
INSERT INTO vetuste_grid (element_type, duree_vie_ans, taux_abattement_annuel, notes)
SELECT * FROM (VALUES
    ('peinture',           7,  14.29::NUMERIC(4,2), 'Peinture murale standard'),
    ('papier_peint',       7,  14.29, 'Revêtement mural'),
    ('moquette',           7,  14.29, 'Revêtement sol textile'),
    ('parquet',            15,  6.67, 'Parquet massif ou contrecollé'),
    ('carrelage',          20,  5.00, 'Sol carrelé'),
    ('lino',               10, 10.00, 'Revêtement sol PVC/lino'),
    ('robinetterie',       10, 10.00, 'Robinets, mitigeurs'),
    ('sanitaires',         15,  6.67, 'WC, lavabo, baignoire'),
    ('volets',             15,  6.67, 'Volets roulants ou battants'),
    ('porte_interieure',   15,  6.67, 'Portes intérieures'),
    ('fenetre',            20,  5.00, 'Menuiseries extérieures'),
    ('chaudiere',          15,  6.67, 'Chaudière/cumulus'),
    ('electrique',         20,  5.00, 'Installation électrique'),
    ('placards',           15,  6.67, 'Rangements intégrés')
) AS v(element_type, duree_vie_ans, taux_abattement_annuel, notes)
WHERE NOT EXISTS (SELECT 1 FROM vetuste_grid LIMIT 1);

-- ─── 5. Commentaires ───────────────────────────────────────────────────────

COMMENT ON TABLE edl_rooms IS 'Pièces structurées pour l''état des lieux';
COMMENT ON TABLE vetuste_grid IS 'Grille de vétusté pour calcul des retenues (décret 2016-382)';
COMMENT ON COLUMN edl.linked_entry_edl_id IS 'EDL sortie: référence vers l''EDL d''entrée correspondant';
COMMENT ON COLUMN edl.total_retenue_cents IS 'Montant total des retenues sur dépôt de garantie (en centimes)';
COMMENT ON COLUMN edl.depot_garantie_cents IS 'Montant du dépôt de garantie du bail (en centimes)';
COMMENT ON COLUMN edl.montant_restitue_cents IS 'Montant à restituer au locataire (dépôt − retenues, en centimes)';
COMMENT ON COLUMN edl_items.entry_condition IS 'État de l''élément à l''entrée (rempli auto lors de l''EDL sortie)';
COMMENT ON COLUMN edl_items.vetuste_coefficient IS 'Coefficient vétusté 0.00 à 1.00 (calculé auto)';
COMMENT ON COLUMN edl_items.retenue_cents IS 'Retenue nette après vétusté (en centimes)';


-- === [150/169] 20260408120000_providers_module_sota.sql ===
-- =====================================================
-- MIGRATION: Module Prestataires SOTA 2026
-- Tables: providers, owner_providers
-- Alter: work_orders (extended state machine + fields)
-- Triggers: rating auto-update, updated_at
-- RLS: policies per role
-- =====================================================

-- =====================================================
-- 1. TABLE: providers (annuaire prestataires)
-- Standalone provider directory — not coupled to profiles
-- =====================================================

CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Identité
  company_name TEXT NOT NULL,
  siret TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,

  -- Activité
  trade_categories TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,

  -- Localisation
  address TEXT,
  city TEXT,
  postal_code TEXT,
  department TEXT,
  service_radius_km INTEGER DEFAULT 30,

  -- Qualifications
  certifications TEXT[] DEFAULT '{}',
  insurance_number TEXT,
  insurance_expiry DATE,
  decennale_number TEXT,
  decennale_expiry DATE,

  -- Notation (auto-updated by trigger)
  avg_rating NUMERIC(2,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_interventions INTEGER DEFAULT 0,

  -- Disponibilité
  is_available BOOLEAN DEFAULT true,
  response_time_hours INTEGER DEFAULT 48,
  emergency_available BOOLEAN DEFAULT false,

  -- Relation avec proprio
  added_by_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_marketplace BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,

  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_providers_department ON providers(department);
CREATE INDEX IF NOT EXISTS idx_providers_categories ON providers USING GIN(trade_categories);
CREATE INDEX IF NOT EXISTS idx_providers_owner ON providers(added_by_owner_id);
CREATE INDEX IF NOT EXISTS idx_providers_marketplace ON providers(is_marketplace) WHERE is_marketplace = true;
CREATE INDEX IF NOT EXISTS idx_providers_email ON providers(email);
CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);

-- RLS
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Owners see their own providers + marketplace
DROP POLICY IF EXISTS "Owners see own providers and marketplace" ON providers;
CREATE POLICY "Owners see own providers and marketplace"
  ON providers FOR SELECT
  USING (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR is_marketplace = true
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Owners can insert providers they add
DROP POLICY IF EXISTS "Owners can add providers" ON providers;
CREATE POLICY "Owners can add providers"
  ON providers FOR INSERT
  WITH CHECK (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );

-- Owners can update their own providers, providers can update themselves
DROP POLICY IF EXISTS "Owners update own providers" ON providers;
CREATE POLICY "Owners update own providers"
  ON providers FOR UPDATE
  USING (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Admins full access
DROP POLICY IF EXISTS "Admins full access providers" ON providers;
CREATE POLICY "Admins full access providers"
  ON providers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_providers_updated_at ON providers;
CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE providers IS 'Annuaire prestataires (carnet personnel + marketplace)';

-- =====================================================
-- 2. TABLE: owner_providers (carnet d adresses)
-- =====================================================

CREATE TABLE IF NOT EXISTS owner_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  nickname TEXT,
  notes TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, provider_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_owner_providers_owner ON owner_providers(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_providers_provider ON owner_providers(provider_id);

-- RLS
ALTER TABLE owner_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own provider links" ON owner_providers;
CREATE POLICY "Owners manage own provider links"
  ON owner_providers FOR ALL
  USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

COMMENT ON TABLE owner_providers IS 'Lien propriétaire ↔ prestataire (carnet d adresses personnel)';

-- =====================================================
-- 3. ALTER: work_orders — Extended state machine
-- Add new columns for the full ticket→devis→intervention→facture→paiement flow
-- =====================================================

-- Add new columns (idempotent with IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  -- property_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'property_id') THEN
    ALTER TABLE work_orders ADD COLUMN property_id UUID REFERENCES properties(id);
  END IF;

  -- owner_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'owner_id') THEN
    ALTER TABLE work_orders ADD COLUMN owner_id UUID REFERENCES profiles(id);
  END IF;

  -- entity_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'entity_id') THEN
    ALTER TABLE work_orders ADD COLUMN entity_id UUID REFERENCES legal_entities(id);
  END IF;

  -- lease_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'lease_id') THEN
    ALTER TABLE work_orders ADD COLUMN lease_id UUID REFERENCES leases(id);
  END IF;

  -- title
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'title') THEN
    ALTER TABLE work_orders ADD COLUMN title TEXT;
  END IF;

  -- description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'description') THEN
    ALTER TABLE work_orders ADD COLUMN description TEXT;
  END IF;

  -- category
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'category') THEN
    ALTER TABLE work_orders ADD COLUMN category TEXT;
  END IF;

  -- urgency
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'urgency') THEN
    ALTER TABLE work_orders ADD COLUMN urgency TEXT DEFAULT 'normal'
      CHECK (urgency IN ('low', 'normal', 'urgent', 'emergency'));
  END IF;

  -- status (new extended state machine — coexists with legacy statut)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'status') THEN
    ALTER TABLE work_orders ADD COLUMN status TEXT DEFAULT 'draft'
      CHECK (status IN (
        'draft', 'quote_requested', 'quote_received', 'quote_approved',
        'quote_rejected', 'scheduled', 'in_progress', 'completed',
        'invoiced', 'paid', 'disputed', 'cancelled'
      ));
  END IF;

  -- Quote dates & financials
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'requested_at') THEN
    ALTER TABLE work_orders ADD COLUMN requested_at TIMESTAMPTZ DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_received_at') THEN
    ALTER TABLE work_orders ADD COLUMN quote_received_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'approved_at') THEN
    ALTER TABLE work_orders ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'scheduled_date') THEN
    ALTER TABLE work_orders ADD COLUMN scheduled_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'scheduled_time_slot') THEN
    ALTER TABLE work_orders ADD COLUMN scheduled_time_slot TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'started_at') THEN
    ALTER TABLE work_orders ADD COLUMN started_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'completed_at') THEN
    ALTER TABLE work_orders ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;

  -- Financials
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_amount_cents') THEN
    ALTER TABLE work_orders ADD COLUMN quote_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_document_id') THEN
    ALTER TABLE work_orders ADD COLUMN quote_document_id UUID REFERENCES documents(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'invoice_amount_cents') THEN
    ALTER TABLE work_orders ADD COLUMN invoice_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'invoice_document_id') THEN
    ALTER TABLE work_orders ADD COLUMN invoice_document_id UUID REFERENCES documents(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'payment_method') THEN
    ALTER TABLE work_orders ADD COLUMN payment_method TEXT
      CHECK (payment_method IN ('bank_transfer', 'check', 'cash', 'stripe'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'paid_at') THEN
    ALTER TABLE work_orders ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;

  -- Intervention report
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'intervention_report') THEN
    ALTER TABLE work_orders ADD COLUMN intervention_report TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'intervention_photos') THEN
    ALTER TABLE work_orders ADD COLUMN intervention_photos JSONB DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'tenant_signature_url') THEN
    ALTER TABLE work_orders ADD COLUMN tenant_signature_url TEXT;
  END IF;

  -- Accounting link
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'accounting_entry_id') THEN
    ALTER TABLE work_orders ADD COLUMN accounting_entry_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'is_deductible') THEN
    ALTER TABLE work_orders ADD COLUMN is_deductible BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'deductible_category') THEN
    ALTER TABLE work_orders ADD COLUMN deductible_category TEXT;
  END IF;

  -- notes column (may already exist in some forks)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'notes') THEN
    ALTER TABLE work_orders ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Make ticket_id nullable (work orders can now be created standalone)
ALTER TABLE work_orders ALTER COLUMN ticket_id DROP NOT NULL;

-- New indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_property ON work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_owner ON work_orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_new_status ON work_orders(status);

-- Backfill: set status from legacy statut for existing rows
UPDATE work_orders
SET status = CASE
  WHEN statut = 'assigned' THEN 'draft'
  WHEN statut = 'scheduled' THEN 'scheduled'
  WHEN statut = 'done' THEN 'completed'
  WHEN statut = 'cancelled' THEN 'cancelled'
  WHEN statut = 'in_progress' THEN 'in_progress'
  ELSE 'draft'
END
WHERE status IS NULL;

-- Backfill: property_id from ticket if missing
UPDATE work_orders wo
SET property_id = t.property_id
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.property_id IS NULL
  AND t.property_id IS NOT NULL;

-- Backfill: title from ticket titre
UPDATE work_orders wo
SET title = t.titre
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.title IS NULL;

-- Backfill: description from ticket description
UPDATE work_orders wo
SET description = t.description
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.description IS NULL;

-- =====================================================
-- 4. FUNCTION: Update provider rating from reviews
-- Uses the new providers table
-- =====================================================

CREATE OR REPLACE FUNCTION update_provider_rating_from_reviews()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_id UUID;
BEGIN
  -- Find the provider linked to this provider_profile_id
  SELECT p.id INTO v_provider_id
  FROM providers p
  WHERE p.profile_id = NEW.provider_profile_id
  LIMIT 1;

  IF v_provider_id IS NOT NULL THEN
    UPDATE providers SET
      avg_rating = COALESCE(
        (SELECT ROUND(AVG(rating_overall)::NUMERIC, 1)
         FROM provider_reviews
         WHERE provider_profile_id = NEW.provider_profile_id AND is_published = true),
        0
      ),
      total_reviews = (
        SELECT COUNT(*)
        FROM provider_reviews
        WHERE provider_profile_id = NEW.provider_profile_id AND is_published = true
      )
    WHERE id = v_provider_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_provider_rating_from_reviews ON provider_reviews;
CREATE TRIGGER trg_update_provider_rating_from_reviews
  AFTER INSERT OR UPDATE ON provider_reviews
  FOR EACH ROW EXECUTE FUNCTION update_provider_rating_from_reviews();

-- =====================================================
-- 5. FUNCTION: Update provider total_interventions
-- =====================================================

CREATE OR REPLACE FUNCTION update_provider_intervention_count()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_record RECORD;
BEGIN
  -- Find the provider entry for this provider_id
  -- provider_id on work_orders references profiles(id)
  SELECT p.id INTO v_provider_record
  FROM providers p
  WHERE p.profile_id = COALESCE(NEW.provider_id, OLD.provider_id)
  LIMIT 1;

  IF v_provider_record.id IS NOT NULL THEN
    UPDATE providers SET
      total_interventions = (
        SELECT COUNT(*)
        FROM work_orders
        WHERE provider_id = COALESCE(NEW.provider_id, OLD.provider_id)
          AND (status IN ('completed', 'invoiced', 'paid') OR statut = 'done')
      )
    WHERE id = v_provider_record.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_provider_intervention_count ON work_orders;
CREATE TRIGGER trg_update_provider_intervention_count
  AFTER INSERT OR UPDATE OF status, statut OR DELETE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_provider_intervention_count();

-- =====================================================
-- 6. FUNCTION: Validate SIRET (14 digits)
-- =====================================================

CREATE OR REPLACE FUNCTION validate_provider_siret()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.siret IS NOT NULL AND NEW.siret <> '' THEN
    IF NEW.siret !~ '^\d{14}$' THEN
      RAISE EXCEPTION 'SIRET invalide: doit contenir exactement 14 chiffres';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_provider_siret ON providers;
CREATE TRIGGER trg_validate_provider_siret
  BEFORE INSERT OR UPDATE OF siret ON providers
  FOR EACH ROW EXECUTE FUNCTION validate_provider_siret();

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON COLUMN providers.trade_categories IS 'plomberie, electricite, serrurerie, peinture, menuiserie, chauffage, climatisation, toiture, maconnerie, jardinage, nettoyage, demenagement, diagnostic, general';
COMMENT ON COLUMN work_orders.status IS 'Extended state machine: draft→quote_requested→quote_received→quote_approved→scheduled→in_progress→completed→invoiced→paid';
COMMENT ON COLUMN work_orders.urgency IS 'low, normal, urgent, emergency';


-- === [151/169] 20260408120000_smart_meters_connected.sql ===
-- Migration : Compteurs connectés — Enedis SGE, GRDF ADICT, alertes conso
-- Feature gate : Pro+ (connected_meters)

-- ============================================================
-- Table 1 : Compteurs liés à un bien (property_meters)
-- Complète la table "meters" existante (liée à lease_id)
-- property_meters est liée au bien, pas au bail
-- ============================================================
CREATE TABLE IF NOT EXISTS property_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  meter_type TEXT NOT NULL
    CHECK (meter_type IN ('electricity', 'gas', 'water', 'heating', 'other')),
  provider TEXT,                          -- 'enedis', 'grdf', 'veolia', 'manual'

  -- Identifiant compteur
  meter_reference TEXT NOT NULL,          -- PDL, PCE, ou numéro compteur eau
  meter_serial TEXT,                      -- Numéro de série physique

  -- Connexion API
  is_connected BOOLEAN DEFAULT false,
  connection_consent_at TIMESTAMPTZ,      -- Date consentement locataire
  connection_consent_by UUID REFERENCES profiles(id),
  oauth_token_encrypted TEXT,             -- Token chiffré
  oauth_refresh_token_encrypted TEXT,
  oauth_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'active', 'error', 'expired')),
  sync_error_message TEXT,

  -- Contrat
  contract_holder TEXT,                   -- Nom titulaire contrat
  contract_start_date DATE,
  tariff_option TEXT,                     -- 'base', 'hc_hp', 'tempo'
  subscribed_power_kva INTEGER,           -- Puissance souscrite (kVA)

  -- Config alertes
  alert_threshold_daily NUMERIC,          -- Seuil alerte conso journalière
  alert_threshold_monthly NUMERIC,        -- Seuil mensuel

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, meter_type, meter_reference)
);

ALTER TABLE property_meters ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_property_meters_property ON property_meters(property_id);
CREATE INDEX IF NOT EXISTS idx_property_meters_sync ON property_meters(is_connected, sync_status);
CREATE INDEX IF NOT EXISTS idx_property_meters_type ON property_meters(meter_type);

-- ============================================================
-- Table 2 : Relevés compteurs connectés
-- Étend le concept de meter_readings pour les compteurs connectés
-- ============================================================
CREATE TABLE IF NOT EXISTS property_meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES property_meters(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),

  reading_date DATE NOT NULL,
  value NUMERIC NOT NULL,                 -- kWh, m³, etc.
  unit TEXT NOT NULL DEFAULT 'kWh'
    CHECK (unit IN ('kWh', 'm3', 'litres')),

  -- Source
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'enedis', 'grdf', 'veolia', 'import')),
  recorded_by UUID REFERENCES profiles(id), -- NULL si auto

  -- Photo (relevé manuel)
  photo_document_id UUID REFERENCES documents(id),

  -- Coût estimé
  estimated_cost_cents INTEGER,           -- Coût estimé basé sur le tarif

  -- Déduplication
  external_id TEXT,                       -- ID unique côté fournisseur

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meter_id, reading_date, source)
);

ALTER TABLE property_meter_readings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pm_readings_meter_date ON property_meter_readings(meter_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_pm_readings_property ON property_meter_readings(property_id);
CREATE INDEX IF NOT EXISTS idx_pm_readings_source ON property_meter_readings(source);

-- ============================================================
-- Table 3 : Alertes consommation
-- ============================================================
CREATE TABLE IF NOT EXISTS meter_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES property_meters(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  alert_type TEXT NOT NULL
    CHECK (alert_type IN ('overconsumption', 'no_reading', 'anomaly', 'contract_expiry')),
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  data JSONB DEFAULT '{}',
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meter_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_meter_alerts_meter ON meter_alerts(meter_id);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_property ON meter_alerts(property_id);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_type ON meter_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_unacked ON meter_alerts(meter_id) WHERE acknowledged_at IS NULL;

-- ============================================================
-- RLS Policies
-- ============================================================

-- property_meters: propriétaire du bien peut tout faire
CREATE POLICY "property_meters_owner_select" ON property_meters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "property_meters_owner_insert" ON property_meters
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "property_meters_owner_update" ON property_meters
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "property_meters_owner_delete" ON property_meters
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- property_meters: locataire avec bail actif peut lire
CREATE POLICY "property_meters_tenant_select" ON property_meters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meters.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

-- property_meter_readings: propriétaire
CREATE POLICY "pm_readings_owner_select" ON property_meter_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "pm_readings_owner_insert" ON property_meter_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- property_meter_readings: locataire avec bail actif
CREATE POLICY "pm_readings_tenant_select" ON property_meter_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meter_readings.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

CREATE POLICY "pm_readings_tenant_insert" ON property_meter_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meter_readings.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

-- meter_alerts: propriétaire
CREATE POLICY "meter_alerts_owner_select" ON meter_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "meter_alerts_owner_update" ON meter_alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- meter_alerts: locataire
CREATE POLICY "meter_alerts_tenant_select" ON meter_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = meter_alerts.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

-- ============================================================
-- Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_property_meters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_property_meters_updated_at
  BEFORE UPDATE ON property_meters
  FOR EACH ROW EXECUTE FUNCTION update_property_meters_updated_at();

-- ============================================================
-- Service role policies (for cron sync & OAuth callbacks)
-- ============================================================
CREATE POLICY "property_meters_service_all" ON property_meters
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

CREATE POLICY "pm_readings_service_all" ON property_meter_readings
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

CREATE POLICY "meter_alerts_service_all" ON meter_alerts
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );


-- === [152/169] 20260408120000_subscription_addons.sql ===
-- ============================================================
-- Migration: subscription_addons & sms_usage
-- Module Add-ons Stripe (packs signatures, stockage, SMS, RAR, état daté)
-- ============================================================

-- Table principale : add-ons achetés
CREATE TABLE IF NOT EXISTS subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  entity_id UUID REFERENCES legal_entities(id),

  -- Type
  addon_type TEXT NOT NULL
    CHECK (addon_type IN (
      'signature_pack',
      'storage_20gb',
      'sms',
      'rar_electronic',
      'etat_date'
    )),

  -- Stripe
  stripe_checkout_session_id TEXT,
  stripe_subscription_id TEXT,
  stripe_subscription_item_id TEXT,
  stripe_invoice_id TEXT,

  -- Quantité / Usage
  quantity INTEGER NOT NULL DEFAULT 1,
  consumed_count INTEGER DEFAULT 0,

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'active',
      'consumed',
      'cancelled',
      'expired'
    )),

  -- Dates
  purchased_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;

-- RLS : les utilisateurs ne voient que leurs propres add-ons
CREATE POLICY "Users can view their own addons"
  ON subscription_addons FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Service role full access on subscription_addons"
  ON subscription_addons FOR ALL
  USING (auth.role() = 'service_role');

-- Index
CREATE INDEX idx_addons_profile ON subscription_addons(profile_id);
CREATE INDEX idx_addons_type_status ON subscription_addons(addon_type, status);
CREATE INDEX idx_addons_stripe_session ON subscription_addons(stripe_checkout_session_id);
CREATE INDEX idx_addons_stripe_subscription ON subscription_addons(stripe_subscription_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_subscription_addons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscription_addons_updated_at
  BEFORE UPDATE ON subscription_addons
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_addons_updated_at();

-- ============================================================
-- Table : Suivi usage SMS (agrégé par mois)
-- ============================================================

CREATE TABLE IF NOT EXISTS sms_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  month TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  reported_to_stripe BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, month)
);

ALTER TABLE sms_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sms usage"
  ON sms_usage FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Service role full access on sms_usage"
  ON sms_usage FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_sms_usage_profile_month ON sms_usage(profile_id, month);

-- ============================================================
-- RPC : Incrémenter usage SMS (upsert atomique)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_sms_usage(
  p_profile_id UUID,
  p_month TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO sms_usage (profile_id, month, count)
  VALUES (p_profile_id, p_month, 1)
  ON CONFLICT (profile_id, month)
  DO UPDATE SET count = sms_usage.count + 1
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC : Consommer une signature d'un pack (FIFO)
-- ============================================================

CREATE OR REPLACE FUNCTION consume_addon_signature(
  p_profile_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_addon_id UUID;
BEGIN
  -- Sélectionner le pack actif le plus ancien (FIFO) qui a des signatures restantes
  SELECT id INTO v_addon_id
  FROM subscription_addons
  WHERE profile_id = p_profile_id
    AND addon_type = 'signature_pack'
    AND status = 'active'
    AND consumed_count < quantity
  ORDER BY purchased_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_addon_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Incrémenter consumed_count
  UPDATE subscription_addons
  SET consumed_count = consumed_count + 1,
      status = CASE
        WHEN consumed_count + 1 >= quantity THEN 'consumed'
        ELSE 'active'
      END,
      updated_at = now()
  WHERE id = v_addon_id;

  RETURN v_addon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === [153/169] 20260408120000_whitelabel_agency_module.sql ===
-- ============================================================================
-- White-label Agency Module
--
-- Tables for agency white-label branding, mandates (Hoguet-compliant),
-- CRG (Compte Rendu de Gestion), and mandant accounts.
-- ============================================================================

-- 1. whitelabel_configs — branding & domain config per agency
CREATE TABLE IF NOT EXISTS whitelabel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#2563EB',
  secondary_color TEXT,
  font_family TEXT DEFAULT 'Manrope',
  custom_domain TEXT,
  subdomain TEXT,
  domain_verified BOOLEAN DEFAULT false,
  company_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  siret TEXT,
  carte_g_number TEXT NOT NULL,
  carte_g_expiry DATE,
  caisse_garantie TEXT,
  caisse_garantie_montant INTEGER,
  rcp_assurance TEXT,
  show_powered_by_talok BOOLEAN DEFAULT true,
  custom_email_sender TEXT,
  custom_email_domain_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('setup', 'active', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whitelabel_configs ENABLE ROW LEVEL SECURITY;

-- Unique domain index
CREATE UNIQUE INDEX IF NOT EXISTS idx_wl_domain
  ON whitelabel_configs(custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Unique subdomain index
CREATE UNIQUE INDEX IF NOT EXISTS idx_wl_subdomain
  ON whitelabel_configs(subdomain)
  WHERE subdomain IS NOT NULL;

-- One config per agency
CREATE UNIQUE INDEX IF NOT EXISTS idx_wl_agency_profile
  ON whitelabel_configs(agency_profile_id);

-- RLS: agency sees own config only
CREATE POLICY whitelabel_configs_select ON whitelabel_configs
  FOR SELECT USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY whitelabel_configs_insert ON whitelabel_configs
  FOR INSERT WITH CHECK (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

CREATE POLICY whitelabel_configs_update ON whitelabel_configs
  FOR UPDATE USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY whitelabel_configs_admin ON whitelabel_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- 2. agency_mandates — Hoguet-compliant mandates
CREATE TABLE IF NOT EXISTS agency_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agency_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mandate_number TEXT NOT NULL,
  mandate_type TEXT DEFAULT 'gestion' CHECK (mandate_type IN ('gestion', 'location', 'syndic', 'transaction')),
  start_date DATE NOT NULL,
  end_date DATE,
  tacit_renewal BOOLEAN DEFAULT true,
  management_fee_type TEXT DEFAULT 'percentage' CHECK (management_fee_type IN ('percentage', 'fixed')),
  management_fee_rate NUMERIC(5,2),
  management_fee_fixed_cents INTEGER,
  property_ids UUID[] DEFAULT '{}',
  mandate_document_id UUID REFERENCES documents(id),
  mandant_bank_iban TEXT,
  mandant_bank_bic TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'terminated', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agency_mandates ENABLE ROW LEVEL SECURITY;

-- Sequential mandate numbering per agency
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_mandates_number
  ON agency_mandates(agency_profile_id, mandate_number);

-- RLS: agency sees own mandates
CREATE POLICY agency_mandates_agency_select ON agency_mandates
  FOR SELECT USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- RLS: owner sees mandates where they are mandant
CREATE POLICY agency_mandates_owner_select ON agency_mandates
  FOR SELECT USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY agency_mandates_insert ON agency_mandates
  FOR INSERT WITH CHECK (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

CREATE POLICY agency_mandates_update ON agency_mandates
  FOR UPDATE USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY agency_mandates_admin ON agency_mandates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- 3. agency_crg — Compte Rendu de Gestion
CREATE TABLE IF NOT EXISTS agency_crg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id UUID NOT NULL REFERENCES agency_mandates(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_rent_collected_cents INTEGER DEFAULT 0,
  total_charges_paid_cents INTEGER DEFAULT 0,
  total_fees_cents INTEGER DEFAULT 0,
  net_reversement_cents INTEGER DEFAULT 0,
  unpaid_rent_cents INTEGER DEFAULT 0,
  details_per_property JSONB DEFAULT '[]',
  works_summary JSONB DEFAULT '[]',
  document_id UUID REFERENCES documents(id),
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'acknowledged')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agency_crg ENABLE ROW LEVEL SECURITY;

-- Prevent duplicate CRG for same mandate/period
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_crg_mandate_period
  ON agency_crg(mandate_id, period_start, period_end);

-- RLS: agency sees CRGs for own mandates
CREATE POLICY agency_crg_agency_select ON agency_crg
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS: owner sees CRGs for their mandates
CREATE POLICY agency_crg_owner_select ON agency_crg
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.owner_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY agency_crg_insert ON agency_crg
  FOR INSERT WITH CHECK (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY agency_crg_update ON agency_crg
  FOR UPDATE USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY agency_crg_admin ON agency_crg
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- 4. agency_mandant_accounts — fund separation (Hoguet compliance)
CREATE TABLE IF NOT EXISTS agency_mandant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id UUID NOT NULL REFERENCES agency_mandates(id) ON DELETE CASCADE,
  balance_cents INTEGER DEFAULT 0,
  last_reversement_at TIMESTAMPTZ,
  reversement_overdue BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agency_mandant_accounts ENABLE ROW LEVEL SECURITY;

-- One account per mandate
CREATE UNIQUE INDEX IF NOT EXISTS idx_mandant_accounts_mandate
  ON agency_mandant_accounts(mandate_id);

-- RLS: agency sees own mandant accounts
CREATE POLICY mandant_accounts_agency_select ON agency_mandant_accounts
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS: owner sees their mandant account
CREATE POLICY mandant_accounts_owner_select ON agency_mandant_accounts
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.owner_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY mandant_accounts_insert ON agency_mandant_accounts
  FOR INSERT WITH CHECK (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY mandant_accounts_update ON agency_mandant_accounts
  FOR UPDATE USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY mandant_accounts_admin ON agency_mandant_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- ============================================================================
-- Triggers: auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_whitelabel_configs') THEN
    CREATE TRIGGER set_updated_at_whitelabel_configs
      BEFORE UPDATE ON whitelabel_configs
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_agency_mandates') THEN
    CREATE TRIGGER set_updated_at_agency_mandates
      BEFORE UPDATE ON agency_mandates
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_mandant_accounts') THEN
    CREATE TRIGGER set_updated_at_mandant_accounts
      BEFORE UPDATE ON agency_mandant_accounts
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

-- ============================================================================
-- Trigger: auto-flag overdue reversements (> 30 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_reversement_overdue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance_cents > 0 AND (
    NEW.last_reversement_at IS NULL
    OR NEW.last_reversement_at < now() - interval '30 days'
  ) THEN
    NEW.reversement_overdue = true;
  ELSE
    NEW.reversement_overdue = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'check_reversement_overdue_trigger') THEN
    CREATE TRIGGER check_reversement_overdue_trigger
      BEFORE INSERT OR UPDATE ON agency_mandant_accounts
      FOR EACH ROW EXECUTE FUNCTION check_reversement_overdue();
  END IF;
END $$;

-- Comments
COMMENT ON TABLE whitelabel_configs IS 'White-label branding and domain configuration per agency (Enterprise plan)';
COMMENT ON TABLE agency_mandates IS 'Hoguet-compliant management mandates between agencies and property owners';
COMMENT ON TABLE agency_crg IS 'Compte Rendu de Gestion - periodic management reports for mandants';
COMMENT ON TABLE agency_mandant_accounts IS 'Mandant fund accounts - strict separation from agency own funds (Hoguet)';
COMMENT ON COLUMN agency_mandant_accounts.reversement_overdue IS 'Auto-flagged true when balance > 0 and last reversement > 30 days ago';


-- === [154/169] 20260408130000_active_sessions.sql ===
-- ============================================================
-- MIGRATION: active_sessions — Session tracking & multi-device
-- SOTA 2026 — Auth & RBAC Architecture
-- ============================================================

-- Table: active_sessions
-- Tracks authenticated sessions per user/device for security overview
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_name TEXT,
  ip_address INET,
  user_agent TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_active_sessions_profile_id ON active_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_active ON active_sessions(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_sessions_not_revoked ON active_sessions(profile_id) WHERE revoked_at IS NULL;

-- Enable RLS
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see and manage their own sessions
CREATE POLICY "Users can view own sessions"
  ON active_sessions FOR SELECT
  USING (profile_id = user_profile_id());

CREATE POLICY "Users can insert own sessions"
  ON active_sessions FOR INSERT
  WITH CHECK (profile_id = user_profile_id());

CREATE POLICY "Users can update own sessions"
  ON active_sessions FOR UPDATE
  USING (profile_id = user_profile_id());

-- Admins can view all sessions (for security audit)
CREATE POLICY "Admins can view all sessions"
  ON active_sessions FOR SELECT
  USING (user_role() = 'admin');

-- Auto-update timestamp trigger
CREATE TRIGGER set_active_sessions_updated_at
  BEFORE UPDATE ON active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: upsert_active_session
-- Called on login/token refresh to track active sessions
CREATE OR REPLACE FUNCTION upsert_active_session(
  p_profile_id UUID,
  p_device_name TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_device TEXT;
BEGIN
  -- Parse device name from user agent if not provided
  v_device := COALESCE(p_device_name,
    CASE
      WHEN p_user_agent ILIKE '%iPhone%' THEN 'iPhone'
      WHEN p_user_agent ILIKE '%iPad%' THEN 'iPad'
      WHEN p_user_agent ILIKE '%Android%' THEN 'Android'
      WHEN p_user_agent ILIKE '%Macintosh%' THEN 'Mac'
      WHEN p_user_agent ILIKE '%Windows%' THEN 'Windows'
      WHEN p_user_agent ILIKE '%Linux%' THEN 'Linux'
      ELSE 'Appareil inconnu'
    END
  );

  -- Try to find an existing active session from the same device/IP
  SELECT id INTO v_session_id
  FROM active_sessions
  WHERE profile_id = p_profile_id
    AND revoked_at IS NULL
    AND (
      (ip_address = p_ip_address AND user_agent = p_user_agent)
      OR (device_name = v_device AND ip_address = p_ip_address)
    )
  ORDER BY last_active_at DESC
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    -- Update existing session
    UPDATE active_sessions
    SET last_active_at = now(),
        device_name = v_device,
        user_agent = COALESCE(p_user_agent, user_agent)
    WHERE id = v_session_id;
  ELSE
    -- Insert new session
    INSERT INTO active_sessions (profile_id, device_name, ip_address, user_agent)
    VALUES (p_profile_id, v_device, p_ip_address, p_user_agent)
    RETURNING id INTO v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$;

-- Function: revoke_session
CREATE OR REPLACE FUNCTION revoke_session(
  p_session_id UUID,
  p_profile_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE active_sessions
  SET revoked_at = now()
  WHERE id = p_session_id
    AND profile_id = p_profile_id
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

-- Auto-expire sessions older than 30 days (to be called by pg_cron)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE active_sessions
    SET revoked_at = now()
    WHERE revoked_at IS NULL
      AND last_active_at < now() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;


-- === [155/169] 20260408130000_admin_panel_tables.sql ===
-- Migration: Admin Panel — admin_logs, feature_flags, support_tickets
-- Tables pour le panneau d'administration Talok

-- ============================================
-- 1. ADMIN_LOGS (journal d'actions admin)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_target ON admin_logs(target_type, target_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- ============================================
-- 2. FEATURE_FLAGS (flags fonctionnels)
-- ============================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  description TEXT,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_flags_name ON feature_flags(name);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled);

-- ============================================
-- 3. SUPPORT_TICKETS (tickets support)
-- ============================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  category TEXT DEFAULT 'general',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- Trigger updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. RLS POLICIES
-- ============================================

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- admin_logs: lecture/écriture pour admins uniquement
CREATE POLICY "Admins can read admin_logs"
  ON admin_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

CREATE POLICY "Admins can insert admin_logs"
  ON admin_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- feature_flags: lecture pour tous (utilisateurs connectes), ecriture pour admins
CREATE POLICY "Authenticated users can read feature_flags"
  ON feature_flags FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage feature_flags"
  ON feature_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- support_tickets: user voit ses propres tickets, admins voient tout
CREATE POLICY "Users can read own support_tickets"
  ON support_tickets FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create support_tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all support_tickets"
  ON support_tickets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- ============================================
-- 5. INSERT SOME DEFAULT FEATURE FLAGS
-- ============================================

INSERT INTO feature_flags (name, enabled, rollout_percentage, description) VALUES
  ('new_dashboard', false, 0, 'Nouveau tableau de bord utilisateur'),
  ('ai_assistant', false, 10, 'Assistant IA TALO pour les utilisateurs'),
  ('open_banking', false, 0, 'Integration Open Banking pour les virements'),
  ('electronic_signature_v2', false, 25, 'Nouvelle version de la signature electronique'),
  ('advanced_reporting', false, 0, 'Rapports avances pour les proprietaires Pro'),
  ('dark_mode', true, 100, 'Theme sombre'),
  ('maintenance_mode', false, 0, 'Mode maintenance - bloque les nouvelles inscriptions'),
  ('beta_features', false, 5, 'Fonctionnalites beta pour les early adopters')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 6. HELPER FUNCTION: log_admin_action
-- ============================================

CREATE OR REPLACE FUNCTION log_admin_action(
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_admin_profile_id UUID;
  v_log_id UUID;
BEGIN
  SELECT id INTO v_admin_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
    AND role IN ('admin', 'platform_admin')
  LIMIT 1;

  IF v_admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not an admin';
  END IF;

  INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
  VALUES (v_admin_profile_id, p_action, p_target_type, p_target_id, p_details)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === [156/169] 20260408130000_candidatures_workflow.sql ===
-- Migration : Workflow Candidatures Locatives
-- Tables : property_listings, applications
-- RLS policies pour owner, tenant et accès public

-- ============================================
-- 1. TABLE PROPERTY_LISTINGS (Annonces)
-- ============================================

CREATE TABLE IF NOT EXISTS property_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  rent_amount_cents INTEGER NOT NULL CHECK (rent_amount_cents >= 0),
  charges_cents INTEGER DEFAULT 0 CHECK (charges_cents >= 0),
  available_from DATE NOT NULL,
  bail_type TEXT NOT NULL CHECK (bail_type IN ('nu', 'meuble', 'colocation', 'saisonnier', 'commercial')),
  photos JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT false,
  public_url_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_property_listings_property ON property_listings(property_id);
CREATE INDEX idx_property_listings_owner ON property_listings(owner_id);
CREATE INDEX idx_property_listings_published ON property_listings(is_published) WHERE is_published = true;
CREATE INDEX idx_property_listings_token ON property_listings(public_url_token);

-- RLS
ALTER TABLE property_listings ENABLE ROW LEVEL SECURITY;

-- Owner peut tout faire sur ses annonces
CREATE POLICY property_listings_owner_all ON property_listings
  FOR ALL USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Annonces publiées lisibles par tous (page publique)
CREATE POLICY property_listings_public_read ON property_listings
  FOR SELECT USING (is_published = true);

-- Trigger updated_at
CREATE TRIGGER update_property_listings_updated_at
  BEFORE UPDATE ON property_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. TABLE APPLICATIONS (Candidatures)
-- ============================================

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  applicant_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  message TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  completeness_score INTEGER DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
  scoring_id UUID,
  status TEXT DEFAULT 'received' CHECK (status IN (
    'received', 'documents_pending', 'complete', 'scoring',
    'shortlisted', 'accepted', 'rejected', 'withdrawn'
  )),
  rejection_reason TEXT,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_applications_listing ON applications(listing_id);
CREATE INDEX idx_applications_property ON applications(property_id);
CREATE INDEX idx_applications_owner ON applications(owner_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_email ON applications(applicant_email);

-- RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Owner peut voir les candidatures pour ses biens
CREATE POLICY applications_owner_all ON applications
  FOR ALL USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Candidat authentifié peut voir ses propres candidatures
CREATE POLICY applications_applicant_read ON applications
  FOR SELECT USING (applicant_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Insertion publique (candidats non authentifiés peuvent postuler)
CREATE POLICY applications_public_insert ON applications
  FOR INSERT WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. FONCTION : Calcul automatique complétude
-- ============================================

CREATE OR REPLACE FUNCTION calculate_application_completeness()
RETURNS TRIGGER AS $$
DECLARE
  score INTEGER := 0;
  docs JSONB;
BEGIN
  docs := COALESCE(NEW.documents, '[]'::jsonb);

  -- Nom et email toujours fournis (20 points)
  score := 20;

  -- Téléphone (10 points)
  IF NEW.applicant_phone IS NOT NULL AND NEW.applicant_phone != '' THEN
    score := score + 10;
  END IF;

  -- Message / lettre de motivation (10 points)
  IF NEW.message IS NOT NULL AND length(NEW.message) > 20 THEN
    score := score + 10;
  END IF;

  -- Documents : CNI (20 points)
  IF docs @> '[{"type": "identity"}]'::jsonb THEN
    score := score + 20;
  END IF;

  -- Documents : Justificatifs de revenus (20 points)
  IF docs @> '[{"type": "income"}]'::jsonb THEN
    score := score + 20;
  END IF;

  -- Documents : Avis d'imposition (20 points)
  IF docs @> '[{"type": "tax_notice"}]'::jsonb THEN
    score := score + 20;
  END IF;

  NEW.completeness_score := LEAST(score, 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_calculate_completeness
  BEFORE INSERT OR UPDATE OF documents, applicant_phone, message ON applications
  FOR EACH ROW EXECUTE FUNCTION calculate_application_completeness();

-- ============================================
-- 4. FONCTION : Nettoyage RGPD des candidatures refusées (> 6 mois)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_rejected_applications()
RETURNS void AS $$
BEGIN
  -- Supprimer les documents des candidatures refusées depuis plus de 6 mois
  UPDATE applications
  SET documents = '[]'::jsonb,
      applicant_phone = NULL,
      message = NULL
  WHERE status = 'rejected'
    AND rejected_at < now() - INTERVAL '6 months'
    AND documents != '[]'::jsonb;
END;
$$ LANGUAGE plpgsql;


-- === [157/169] 20260408130000_charges_locatives_module.sql ===
-- =====================================================
-- CHARGES LOCATIVES MODULE
-- Tables: charge_categories, charge_entries, charge_regularizations_v2
-- Décret 87-713 : 6 catégories de charges récupérables
-- =====================================================

-- 1. CHARGE_CATEGORIES
-- Catégories de charges par bien (décret 87-713)
CREATE TABLE IF NOT EXISTS charge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'ascenseurs',
    'eau_chauffage',
    'installations_individuelles',
    'parties_communes',
    'espaces_exterieurs',
    'taxes_redevances'
  )),
  label TEXT NOT NULL,
  is_recoverable BOOLEAN NOT NULL DEFAULT true,
  annual_budget_cents INTEGER NOT NULL DEFAULT 0 CHECK (annual_budget_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_charge_categories_property ON charge_categories(property_id);
CREATE INDEX idx_charge_categories_category ON charge_categories(category);

ALTER TABLE charge_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charge_categories_owner_access" ON charge_categories
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Tenants can read categories for their leased properties
CREATE POLICY "charge_categories_tenant_read" ON charge_categories
  FOR SELECT TO authenticated
  USING (
    property_id IN (
      SELECT l.property_id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND l.statut IN ('active', 'terminated')
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

-- 2. CHARGE_ENTRIES
-- Individual charge entries (actual expenses)
CREATE TABLE IF NOT EXISTS charge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES charge_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  date DATE NOT NULL,
  is_recoverable BOOLEAN NOT NULL DEFAULT true,
  justificatif_document_id UUID,
  accounting_entry_id UUID,
  fiscal_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_charge_entries_property ON charge_entries(property_id);
CREATE INDEX idx_charge_entries_category ON charge_entries(category_id);
CREATE INDEX idx_charge_entries_fiscal_year ON charge_entries(fiscal_year);
CREATE INDEX idx_charge_entries_date ON charge_entries(date);

ALTER TABLE charge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charge_entries_owner_access" ON charge_entries
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Tenants can read recoverable entries for their leased properties
CREATE POLICY "charge_entries_tenant_read" ON charge_entries
  FOR SELECT TO authenticated
  USING (
    is_recoverable = true
    AND property_id IN (
      SELECT l.property_id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND l.statut IN ('active', 'terminated')
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

-- 3. LEASE_CHARGE_REGULARIZATIONS
-- Annual regularization per lease (replaces basic charge_reconciliations)
CREATE TABLE IF NOT EXISTS lease_charge_regularizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  total_provisions_cents INTEGER NOT NULL DEFAULT 0,
  total_actual_cents INTEGER NOT NULL DEFAULT 0,
  balance_cents INTEGER GENERATED ALWAYS AS (
    total_actual_cents - total_provisions_cents
  ) STORED, -- positive = tenant owes, negative = overpaid
  detail_per_category JSONB NOT NULL DEFAULT '[]'::jsonb,
  document_id UUID, -- PDF du décompte
  sent_at TIMESTAMPTZ,
  contested BOOLEAN NOT NULL DEFAULT false,
  contest_reason TEXT,
  contest_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'calculated', 'sent', 'acknowledged', 'contested', 'settled'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lease_id, fiscal_year)
);

CREATE INDEX idx_lease_charge_reg_lease ON lease_charge_regularizations(lease_id);
CREATE INDEX idx_lease_charge_reg_property ON lease_charge_regularizations(property_id);
CREATE INDEX idx_lease_charge_reg_year ON lease_charge_regularizations(fiscal_year);
CREATE INDEX idx_lease_charge_reg_status ON lease_charge_regularizations(status);

ALTER TABLE lease_charge_regularizations ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "lease_charge_reg_owner_access" ON lease_charge_regularizations
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Tenant can read and update (for contestation) their own regularizations
CREATE POLICY "lease_charge_reg_tenant_read" ON lease_charge_regularizations
  FOR SELECT TO authenticated
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

CREATE POLICY "lease_charge_reg_tenant_contest" ON lease_charge_regularizations
  FOR UPDATE TO authenticated
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  )
  WITH CHECK (
    -- Tenant can only update contestation fields
    status = 'sent'
  );

-- 4. TRIGGER: auto-update updated_at
CREATE OR REPLACE FUNCTION update_charges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_charge_categories_updated
  BEFORE UPDATE ON charge_categories
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();

CREATE TRIGGER trg_charge_entries_updated
  BEFORE UPDATE ON charge_entries
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();

CREATE TRIGGER trg_lease_charge_reg_updated
  BEFORE UPDATE ON lease_charge_regularizations
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();


-- === [158/169] 20260408130000_diagnostics_rent_control.sql ===
-- =============================================================================
-- Migration: property_diagnostics + rent_control_zones
-- Diagnostics immobiliers obligatoires (DDT) et encadrement des loyers
-- =============================================================================

-- 1. Table property_diagnostics
CREATE TABLE IF NOT EXISTS property_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  diagnostic_type TEXT NOT NULL CHECK (diagnostic_type IN (
    'dpe','amiante','plomb','gaz','electricite','termites','erp','surface_boutin','bruit'
  )),
  performed_date DATE NOT NULL,
  expiry_date DATE,
  result TEXT,
  diagnostiqueur_name TEXT,
  diagnostiqueur_certification TEXT,
  document_id UUID REFERENCES documents(id),
  is_valid BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, diagnostic_type)
);

-- RLS
ALTER TABLE property_diagnostics ENABLE ROW LEVEL SECURITY;

-- Owners can manage diagnostics on their properties
CREATE POLICY "property_diagnostics_owner_select"
  ON property_diagnostics FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "property_diagnostics_owner_insert"
  ON property_diagnostics FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "property_diagnostics_owner_update"
  ON property_diagnostics FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "property_diagnostics_owner_delete"
  ON property_diagnostics FOR DELETE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Tenants can view diagnostics for their leased properties
CREATE POLICY "property_diagnostics_tenant_select"
  ON property_diagnostics FOR SELECT
  USING (
    property_id IN (
      SELECT l.property_id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles p ON p.id = ls.profile_id
      WHERE p.user_id = auth.uid()
        AND l.statut = 'active'
    )
  );

-- Indexes
CREATE INDEX idx_property_diagnostics_property ON property_diagnostics(property_id);
CREATE INDEX idx_property_diagnostics_type ON property_diagnostics(diagnostic_type);
CREATE INDEX idx_property_diagnostics_expiry ON property_diagnostics(expiry_date) WHERE expiry_date IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_property_diagnostics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_property_diagnostics_updated_at
  BEFORE UPDATE ON property_diagnostics
  FOR EACH ROW EXECUTE FUNCTION update_property_diagnostics_updated_at();

-- 2. Table rent_control_zones (reference data)
CREATE TABLE IF NOT EXISTS rent_control_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  zone TEXT NOT NULL,
  type_logement TEXT NOT NULL,
  nb_pieces INTEGER,
  loyer_reference NUMERIC(6,2),
  loyer_majore NUMERIC(6,2),
  loyer_minore NUMERIC(6,2),
  year INTEGER NOT NULL,
  quarter INTEGER,
  source_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: read-only for all authenticated users
ALTER TABLE rent_control_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rent_control_zones_read"
  ON rent_control_zones FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Index for fast lookups
CREATE INDEX idx_rent_control_city_year ON rent_control_zones(city, year);
CREATE INDEX idx_rent_control_type ON rent_control_zones(type_logement, nb_pieces);

-- 3. Seed initial rent control reference data (Paris 2026 Q1 examples)
INSERT INTO rent_control_zones (city, zone, type_logement, nb_pieces, loyer_reference, loyer_majore, loyer_minore, year, quarter) VALUES
  ('Paris', '1', 'nu_ancien', 1, 28.30, 33.96, 19.81, 2026, 1),
  ('Paris', '1', 'nu_ancien', 2, 25.50, 30.60, 17.85, 2026, 1),
  ('Paris', '1', 'nu_ancien', 3, 23.10, 27.72, 16.17, 2026, 1),
  ('Paris', '1', 'meuble_ancien', 1, 33.10, 39.72, 23.17, 2026, 1),
  ('Paris', '1', 'meuble_ancien', 2, 29.80, 35.76, 20.86, 2026, 1),
  ('Paris', '1', 'meuble_ancien', 3, 27.40, 32.88, 19.18, 2026, 1),
  ('Paris', '2', 'nu_ancien', 1, 26.80, 32.16, 18.76, 2026, 1),
  ('Paris', '2', 'nu_ancien', 2, 24.20, 29.04, 16.94, 2026, 1),
  ('Paris', '2', 'meuble_ancien', 1, 31.50, 37.80, 22.05, 2026, 1),
  ('Paris', '2', 'meuble_ancien', 2, 28.30, 33.96, 19.81, 2026, 1),
  ('Lyon', '1', 'nu_ancien', 1, 14.50, 17.40, 10.15, 2026, 1),
  ('Lyon', '1', 'nu_ancien', 2, 12.80, 15.36, 8.96, 2026, 1),
  ('Lyon', '1', 'meuble_ancien', 1, 17.20, 20.64, 12.04, 2026, 1),
  ('Lille', '1', 'nu_ancien', 1, 13.80, 16.56, 9.66, 2026, 1),
  ('Lille', '1', 'nu_ancien', 2, 12.10, 14.52, 8.47, 2026, 1),
  ('Lille', '1', 'meuble_ancien', 1, 16.50, 19.80, 11.55, 2026, 1),
  ('Bordeaux', '1', 'nu_ancien', 1, 14.00, 16.80, 9.80, 2026, 1),
  ('Bordeaux', '1', 'meuble_ancien', 1, 16.80, 20.16, 11.76, 2026, 1),
  ('Montpellier', '1', 'nu_ancien', 1, 13.20, 15.84, 9.24, 2026, 1),
  ('Montpellier', '1', 'meuble_ancien', 1, 15.80, 18.96, 11.06, 2026, 1)
ON CONFLICT DO NOTHING;


-- === [159/169] 20260408130000_fix_subscription_plan_prices.sql ===
-- =====================================================
-- Migration: Fix subscription plan prices to match official pricing grid
-- Date: 2026-04-08
-- Description:
--   Ensures subscription_plans prices match the official Talok pricing:
--   - Gratuit: 0€/mois
--   - Starter: 9€/mois (900 centimes)
--   - Confort: 35€/mois (3500 centimes)
--   - Pro: 69€/mois (6900 centimes)
--   - Enterprise S: 249€/mois (24900 centimes)
--   Idempotent — safe to run multiple times.
-- =====================================================

BEGIN;

UPDATE subscription_plans SET price_monthly = 0, price_yearly = 0
WHERE slug = 'gratuit' AND price_monthly != 0;

UPDATE subscription_plans SET price_monthly = 900, price_yearly = 9000
WHERE slug = 'starter' AND price_monthly != 900;

UPDATE subscription_plans SET price_monthly = 3500, price_yearly = 35000
WHERE slug = 'confort' AND price_monthly != 3500;

UPDATE subscription_plans SET price_monthly = 6900, price_yearly = 69000
WHERE slug = 'pro' AND price_monthly != 6900;

UPDATE subscription_plans SET price_monthly = 24900, price_yearly = 249000
WHERE slug = 'enterprise_s' AND price_monthly != 24900;

COMMIT;


-- === [160/169] 20260408130000_guarantor_workflow_complete.sql ===
-- ============================================
-- Migration: Workflow garant complet
-- Date: 2026-04-08
-- Description:
--   1. Ajouter le support Visale au type de garantie
--   2. Ajouter les colonnes d'invitation (email, token, etc.)
--   3. Ajouter les colonnes de libération
--   4. Ajouter le numéro Visale sur les engagements
--   5. Créer la table guarantor_invitations
--   6. Créer la fonction RPC guarantor_dashboard
--   7. Ajouter les RLS policies manquantes
-- ============================================

BEGIN;

-- ============================================
-- 1. TABLE D'INVITATIONS GARANT
-- ============================================

CREATE TABLE IF NOT EXISTS guarantor_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Informations garant invité
  guarantor_name TEXT NOT NULL,
  guarantor_email TEXT NOT NULL,
  guarantor_phone TEXT,
  guarantor_type TEXT NOT NULL DEFAULT 'solidaire'
    CHECK (guarantor_type IN ('simple', 'solidaire', 'visale')),
  relationship TEXT,

  -- Token d'invitation
  invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Suivi
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  declined_reason TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

  -- Lien avec le profil garant créé après acceptation
  guarantor_profile_id UUID REFERENCES profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(lease_id, guarantor_email)
);

CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_lease ON guarantor_invitations(lease_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_token ON guarantor_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_email ON guarantor_invitations(guarantor_email);
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_status ON guarantor_invitations(status);

COMMENT ON TABLE guarantor_invitations IS 'Invitations envoyées par les propriétaires aux garants potentiels';

-- ============================================
-- 2. ÉTENDRE guarantor_engagements POUR VISALE
-- ============================================

-- Mettre à jour la contrainte type_garantie pour inclure visale
ALTER TABLE guarantor_engagements
DROP CONSTRAINT IF EXISTS guarantor_engagements_type_garantie_check;

ALTER TABLE guarantor_engagements
ADD CONSTRAINT guarantor_engagements_type_garantie_check
CHECK (type_garantie IN ('caution_simple', 'caution_solidaire', 'visale'));

-- Ajouter le numéro Visale
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS visale_number TEXT;

-- Ajouter les colonnes de libération
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS liberated_at TIMESTAMPTZ;

ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS liberation_reason TEXT
  CHECK (liberation_reason IS NULL OR liberation_reason IN (
    'fin_bail', 'remplacement_locataire', 'depart_colocataire_6mois', 'accord_parties', 'autre'
  ));

-- Ajouter la référence à l'invitation
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES guarantor_invitations(id);

-- Ajouter la colonne signed_at si pas présente (alias pour date_signature)
-- date_signature existe déjà comme DATE, ajoutons signed_at comme TIMESTAMPTZ pour plus de précision
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- ============================================
-- 3. ÉTENDRE guarantor_profiles
-- ============================================

-- Ajouter les colonnes manquantes attendues par les types TS
ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS relation_to_tenant TEXT CHECK (relation_to_tenant IN (
  'parent', 'grand_parent', 'oncle_tante', 'frere_soeur', 'employeur', 'ami', 'autre'
));

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS relation_details TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS situation_pro TEXT CHECK (situation_pro IN (
  'cdi', 'cdd', 'fonctionnaire', 'independant', 'retraite', 'profession_liberale', 'chef_entreprise', 'autre'
));

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS employeur_nom TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS employeur_adresse TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS anciennete_mois INTEGER;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS revenus_fonciers DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS autres_revenus DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS charges_mensuelles DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS credits_en_cours DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS est_proprietaire BOOLEAN DEFAULT false;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS valeur_patrimoine_immobilier DECIMAL(12, 2);

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS adresse_complete TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS code_postal TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS ville TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_garant BOOLEAN DEFAULT false;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_garant_at TIMESTAMPTZ;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_data_processing BOOLEAN DEFAULT false;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_data_processing_at TIMESTAMPTZ;

-- ============================================
-- 4. RLS POLICIES POUR INVITATIONS
-- ============================================

ALTER TABLE guarantor_invitations ENABLE ROW LEVEL SECURITY;

-- Le propriétaire qui a invité peut voir/modifier ses invitations
CREATE POLICY "guarantor_invitations_owner_select" ON guarantor_invitations
  FOR SELECT USING (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "guarantor_invitations_owner_insert" ON guarantor_invitations
  FOR INSERT WITH CHECK (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "guarantor_invitations_owner_update" ON guarantor_invitations
  FOR UPDATE USING (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Le garant invité peut voir ses invitations (par email lié à son user)
CREATE POLICY "guarantor_invitations_guarantor_select" ON guarantor_invitations
  FOR SELECT USING (
    guarantor_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- Admin peut tout
CREATE POLICY "guarantor_invitations_admin_all" ON guarantor_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 5. TRIGGER updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_guarantor_invitations_updated_at ON guarantor_invitations;
CREATE TRIGGER update_guarantor_invitations_updated_at
  BEFORE UPDATE ON guarantor_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. FONCTION RPC : DASHBOARD GARANT
-- ============================================

CREATE OR REPLACE FUNCTION guarantor_dashboard(p_guarantor_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  -- Récupérer le profile_id du garant
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_guarantor_user_id AND role = 'guarantor';

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Construire le résultat du dashboard
  SELECT jsonb_build_object(
    'profile_id', v_profile_id,
    'engagements', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ge.id,
          'lease_id', ge.lease_id,
          'caution_type', CASE ge.type_garantie
            WHEN 'caution_simple' THEN 'simple'
            WHEN 'caution_solidaire' THEN 'solidaire'
            WHEN 'visale' THEN 'visale'
            ELSE ge.type_garantie
          END,
          'montant_garanti', ge.montant_max_garanti,
          'status', CASE ge.statut
            WHEN 'pending' THEN 'pending_signature'
            WHEN 'active' THEN 'active'
            WHEN 'expired' THEN 'released'
            WHEN 'invoked' THEN 'called'
            WHEN 'terminated' THEN 'terminated'
            ELSE ge.statut
          END,
          'signed_at', ge.signed_at,
          'created_at', ge.created_at,
          'tenant', jsonb_build_object(
            'id', tp.id,
            'name', TRIM(COALESCE(tp.prenom, '') || ' ' || COALESCE(tp.nom, ''))
          ),
          'property', jsonb_build_object(
            'id', prop.id,
            'adresse', prop.adresse_complete,
            'ville', prop.ville
          ),
          'lease', jsonb_build_object(
            'loyer', l.loyer,
            'charges', COALESCE(l.charges_forfaitaires, 0),
            'date_debut', l.date_debut
          )
        )
        ORDER BY ge.created_at DESC
      )
      FROM guarantor_engagements ge
      JOIN profiles tp ON tp.id = ge.tenant_profile_id
      JOIN leases l ON l.id = ge.lease_id
      JOIN properties prop ON prop.id = l.property_id
      WHERE ge.guarantor_profile_id = v_profile_id
    ), '[]'::jsonb),
    'incidents', '[]'::jsonb,
    'stats', jsonb_build_object(
      'total_engagements', (
        SELECT COUNT(*) FROM guarantor_engagements
        WHERE guarantor_profile_id = v_profile_id
        AND statut IN ('active', 'pending')
      ),
      'pending_signatures', (
        SELECT COUNT(*) FROM guarantor_engagements
        WHERE guarantor_profile_id = v_profile_id
        AND statut = 'pending'
      ),
      'total_amount_guaranteed', COALESCE((
        SELECT SUM(montant_max_garanti) FROM guarantor_engagements
        WHERE guarantor_profile_id = v_profile_id
        AND statut = 'active'
      ), 0),
      'active_incidents', 0
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION guarantor_dashboard IS 'Retourne les données du dashboard garant (engagements, incidents, stats)';

COMMIT;


