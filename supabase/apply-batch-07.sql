-- Batch 7 — migrations 152 a 169 sur 169
-- 18 migrations

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
DROP POLICY IF EXISTS "Users can view their own addons" ON subscription_addons;
CREATE POLICY "Users can view their own addons"
  ON subscription_addons FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access on subscription_addons" ON subscription_addons;

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

DROP POLICY IF EXISTS "Users can view their own sms usage" ON sms_usage;

CREATE POLICY "Users can view their own sms usage"
  ON sms_usage FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access on sms_usage" ON sms_usage;

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
DROP POLICY IF EXISTS whitelabel_configs_select ON whitelabel_configs;
CREATE POLICY whitelabel_configs_select ON whitelabel_configs
  FOR SELECT USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS whitelabel_configs_insert ON whitelabel_configs;

CREATE POLICY whitelabel_configs_insert ON whitelabel_configs
  FOR INSERT WITH CHECK (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

DROP POLICY IF EXISTS whitelabel_configs_update ON whitelabel_configs;

CREATE POLICY whitelabel_configs_update ON whitelabel_configs
  FOR UPDATE USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS whitelabel_configs_admin ON whitelabel_configs;
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
DROP POLICY IF EXISTS agency_mandates_agency_select ON agency_mandates;
CREATE POLICY agency_mandates_agency_select ON agency_mandates
  FOR SELECT USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- RLS: owner sees mandates where they are mandant
DROP POLICY IF EXISTS agency_mandates_owner_select ON agency_mandates;
CREATE POLICY agency_mandates_owner_select ON agency_mandates
  FOR SELECT USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agency_mandates_insert ON agency_mandates;

CREATE POLICY agency_mandates_insert ON agency_mandates
  FOR INSERT WITH CHECK (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

DROP POLICY IF EXISTS agency_mandates_update ON agency_mandates;

CREATE POLICY agency_mandates_update ON agency_mandates
  FOR UPDATE USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS agency_mandates_admin ON agency_mandates;
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
DROP POLICY IF EXISTS agency_crg_agency_select ON agency_crg;
CREATE POLICY agency_crg_agency_select ON agency_crg
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS: owner sees CRGs for their mandates
DROP POLICY IF EXISTS agency_crg_owner_select ON agency_crg;
CREATE POLICY agency_crg_owner_select ON agency_crg
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.owner_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agency_crg_insert ON agency_crg;

CREATE POLICY agency_crg_insert ON agency_crg
  FOR INSERT WITH CHECK (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agency_crg_update ON agency_crg;

CREATE POLICY agency_crg_update ON agency_crg
  FOR UPDATE USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS agency_crg_admin ON agency_crg;
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
DROP POLICY IF EXISTS mandant_accounts_agency_select ON agency_mandant_accounts;
CREATE POLICY mandant_accounts_agency_select ON agency_mandant_accounts
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS: owner sees their mandant account
DROP POLICY IF EXISTS mandant_accounts_owner_select ON agency_mandant_accounts;
CREATE POLICY mandant_accounts_owner_select ON agency_mandant_accounts
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.owner_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS mandant_accounts_insert ON agency_mandant_accounts;

CREATE POLICY mandant_accounts_insert ON agency_mandant_accounts
  FOR INSERT WITH CHECK (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS mandant_accounts_update ON agency_mandant_accounts;

CREATE POLICY mandant_accounts_update ON agency_mandant_accounts
  FOR UPDATE USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS mandant_accounts_admin ON agency_mandant_accounts;
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
DROP POLICY IF EXISTS "Users can view own sessions" ON active_sessions;
CREATE POLICY "Users can view own sessions"
  ON active_sessions FOR SELECT
  USING (profile_id = user_profile_id());

DROP POLICY IF EXISTS "Users can insert own sessions" ON active_sessions;

CREATE POLICY "Users can insert own sessions"
  ON active_sessions FOR INSERT
  WITH CHECK (profile_id = user_profile_id());

DROP POLICY IF EXISTS "Users can update own sessions" ON active_sessions;

CREATE POLICY "Users can update own sessions"
  ON active_sessions FOR UPDATE
  USING (profile_id = user_profile_id());

-- Admins can view all sessions (for security audit)
DROP POLICY IF EXISTS "Admins can view all sessions" ON active_sessions;
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
DROP POLICY IF EXISTS "Admins can read admin_logs" ON admin_logs;
CREATE POLICY "Admins can read admin_logs"
  ON admin_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert admin_logs" ON admin_logs;

CREATE POLICY "Admins can insert admin_logs"
  ON admin_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- feature_flags: lecture pour tous (utilisateurs connectes), ecriture pour admins
DROP POLICY IF EXISTS "Authenticated users can read feature_flags" ON feature_flags;
CREATE POLICY "Authenticated users can read feature_flags"
  ON feature_flags FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage feature_flags" ON feature_flags;

CREATE POLICY "Admins can manage feature_flags"
  ON feature_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- support_tickets: user voit ses propres tickets, admins voient tout
DROP POLICY IF EXISTS "Users can read own support_tickets" ON support_tickets;
CREATE POLICY "Users can read own support_tickets"
  ON support_tickets FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create support_tickets" ON support_tickets;

CREATE POLICY "Users can create support_tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage all support_tickets" ON support_tickets;

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
DROP POLICY IF EXISTS property_listings_owner_all ON property_listings;
CREATE POLICY property_listings_owner_all ON property_listings
  FOR ALL USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Annonces publiées lisibles par tous (page publique)
DROP POLICY IF EXISTS property_listings_public_read ON property_listings;
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
DROP POLICY IF EXISTS applications_owner_all ON applications;
CREATE POLICY applications_owner_all ON applications
  FOR ALL USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Candidat authentifié peut voir ses propres candidatures
DROP POLICY IF EXISTS applications_applicant_read ON applications;
CREATE POLICY applications_applicant_read ON applications
  FOR SELECT USING (applicant_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Insertion publique (candidats non authentifiés peuvent postuler)
DROP POLICY IF EXISTS applications_public_insert ON applications;
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

DROP POLICY IF EXISTS "charge_categories_owner_access" ON charge_categories;

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
DROP POLICY IF EXISTS "charge_categories_tenant_read" ON charge_categories;
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

DROP POLICY IF EXISTS "charge_entries_owner_access" ON charge_entries;

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
DROP POLICY IF EXISTS "charge_entries_tenant_read" ON charge_entries;
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
DROP POLICY IF EXISTS "lease_charge_reg_owner_access" ON lease_charge_regularizations;
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
DROP POLICY IF EXISTS "lease_charge_reg_tenant_read" ON lease_charge_regularizations;
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

DROP POLICY IF EXISTS "lease_charge_reg_tenant_contest" ON lease_charge_regularizations;

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
DROP POLICY IF EXISTS "property_diagnostics_owner_select" ON property_diagnostics;
CREATE POLICY "property_diagnostics_owner_select"
  ON property_diagnostics FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "property_diagnostics_owner_insert" ON property_diagnostics;

CREATE POLICY "property_diagnostics_owner_insert"
  ON property_diagnostics FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "property_diagnostics_owner_update" ON property_diagnostics;

CREATE POLICY "property_diagnostics_owner_update"
  ON property_diagnostics FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "property_diagnostics_owner_delete" ON property_diagnostics;

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
DROP POLICY IF EXISTS "property_diagnostics_tenant_select" ON property_diagnostics;
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

DROP POLICY IF EXISTS "rent_control_zones_read" ON rent_control_zones;

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
DROP POLICY IF EXISTS "guarantor_invitations_owner_select" ON guarantor_invitations;
CREATE POLICY "guarantor_invitations_owner_select" ON guarantor_invitations
  FOR SELECT USING (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "guarantor_invitations_owner_insert" ON guarantor_invitations;

CREATE POLICY "guarantor_invitations_owner_insert" ON guarantor_invitations
  FOR INSERT WITH CHECK (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "guarantor_invitations_owner_update" ON guarantor_invitations;

CREATE POLICY "guarantor_invitations_owner_update" ON guarantor_invitations
  FOR UPDATE USING (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Le garant invité peut voir ses invitations (par email lié à son user)
DROP POLICY IF EXISTS "guarantor_invitations_guarantor_select" ON guarantor_invitations;
CREATE POLICY "guarantor_invitations_guarantor_select" ON guarantor_invitations
  FOR SELECT USING (
    guarantor_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- Admin peut tout
DROP POLICY IF EXISTS "guarantor_invitations_admin_all" ON guarantor_invitations;
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


-- === [161/169] 20260408130000_insurance_policies.sql ===
-- =============================================
-- Migration: Evolve insurance_policies table
-- From tenant-only to multi-role (PNO, multirisques, RC Pro, decennale, GLI, garantie financiere)
-- Original table: 20240101000009_tenant_advanced.sql
-- =============================================

-- 1. Add new columns to existing table
ALTER TABLE insurance_policies
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS insurance_type TEXT,
  ADD COLUMN IF NOT EXISTS amount_covered_cents INTEGER,
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_30j BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_7j BOOLEAN DEFAULT false;

-- 2. Migrate data: copy tenant_profile_id -> profile_id, coverage_type -> insurance_type
UPDATE insurance_policies
SET profile_id = tenant_profile_id
WHERE profile_id IS NULL AND tenant_profile_id IS NOT NULL;

UPDATE insurance_policies
SET insurance_type = CASE
  WHEN coverage_type = 'habitation' THEN 'multirisques'
  WHEN coverage_type = 'responsabilite' THEN 'rc_pro'
  WHEN coverage_type = 'comprehensive' THEN 'multirisques'
  ELSE 'multirisques'
END
WHERE insurance_type IS NULL AND coverage_type IS NOT NULL;

-- 3. Make lease_id optional (was NOT NULL, now multi-role policies may not have a lease)
ALTER TABLE insurance_policies ALTER COLUMN lease_id DROP NOT NULL;

-- 4. Make policy_number optional (was NOT NULL)
ALTER TABLE insurance_policies ALTER COLUMN policy_number DROP NOT NULL;

-- 5. Add insurance_type CHECK constraint
ALTER TABLE insurance_policies DROP CONSTRAINT IF EXISTS insurance_policies_coverage_type_check;
ALTER TABLE insurance_policies ADD CONSTRAINT chk_insurance_type
  CHECK (insurance_type IN ('pno', 'multirisques', 'rc_pro', 'decennale', 'garantie_financiere', 'gli'));

-- 6. Add business constraints
ALTER TABLE insurance_policies ADD CONSTRAINT chk_insurance_dates
  CHECK (end_date > start_date);
ALTER TABLE insurance_policies ADD CONSTRAINT chk_insurance_amount_positive
  CHECK (amount_covered_cents IS NULL OR amount_covered_cents > 0);

-- 7. New indexes
CREATE INDEX IF NOT EXISTS idx_insurance_profile ON insurance_policies(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_property ON insurance_policies(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insurance_expiry_active ON insurance_policies(end_date) WHERE end_date > now();
CREATE INDEX IF NOT EXISTS idx_insurance_type ON insurance_policies(insurance_type);

-- 8. RLS (drop old policies from tenant_rls if they exist, add new multi-role ones)
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;

-- Drop old policies safely
DROP POLICY IF EXISTS "Tenants can view own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Tenants can insert own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Tenants can update own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Tenants can delete own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Owners can view tenant insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_select ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_insert ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_update ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_delete ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_view_tenants ON insurance_policies;

-- Users can manage their own policies
DROP POLICY IF EXISTS insurance_self_select ON insurance_policies;
CREATE POLICY insurance_self_select ON insurance_policies
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS insurance_self_insert ON insurance_policies;

CREATE POLICY insurance_self_insert ON insurance_policies
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS insurance_self_update ON insurance_policies;

CREATE POLICY insurance_self_update ON insurance_policies
  FOR UPDATE TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS insurance_self_delete ON insurance_policies;

CREATE POLICY insurance_self_delete ON insurance_policies
  FOR DELETE TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Owners can view tenant insurance linked to their properties
DROP POLICY IF EXISTS insurance_owner_view_tenants ON insurance_policies;
CREATE POLICY insurance_owner_view_tenants ON insurance_policies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles prof ON p.owner_id = prof.id
      WHERE l.id = insurance_policies.lease_id
        AND prof.user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS insurance_admin_all ON insurance_policies;
CREATE POLICY insurance_admin_all ON insurance_policies
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- 9. Trigger updated_at (idempotent)
CREATE OR REPLACE FUNCTION update_insurance_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insurance_updated_at ON insurance_policies;
CREATE TRIGGER trg_insurance_updated_at
  BEFORE UPDATE ON insurance_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_insurance_policies_updated_at();

-- 10. View: assurances expirant bientot
CREATE OR REPLACE VIEW insurance_expiring_soon AS
SELECT
  ip.id,
  ip.profile_id,
  ip.property_id,
  ip.lease_id,
  ip.insurance_type,
  ip.insurer_name,
  ip.policy_number,
  ip.start_date,
  ip.end_date,
  ip.amount_covered_cents,
  ip.document_id,
  ip.is_verified,
  ip.reminder_sent_30j,
  ip.reminder_sent_7j,
  p.first_name,
  p.last_name,
  p.email,
  p.role,
  prop.adresse_complete AS property_address,
  CASE
    WHEN ip.end_date <= CURRENT_DATE THEN 'expired'
    WHEN ip.end_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
    WHEN ip.end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'warning'
    ELSE 'ok'
  END AS expiry_status,
  ip.end_date - CURRENT_DATE AS days_until_expiry
FROM insurance_policies ip
JOIN profiles p ON ip.profile_id = p.id
LEFT JOIN properties prop ON ip.property_id = prop.id
WHERE ip.end_date <= CURRENT_DATE + INTERVAL '30 days';


-- === [162/169] 20260408130000_lease_amendments_table.sql ===
-- ============================================================================
-- Lease Amendments (Avenants) — Table + RLS
--
-- Stores lease amendments (avenants) for active leases. Amendments track
-- rent revisions, roommate changes, charges adjustments, and other
-- contractual modifications. Each amendment references its parent lease
-- and optionally a signed document in the GED.
-- ============================================================================

-- 1. Create the lease_amendments table
CREATE TABLE IF NOT EXISTS lease_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  amendment_type TEXT NOT NULL CHECK (amendment_type IN (
    'loyer_revision',
    'ajout_colocataire',
    'retrait_colocataire',
    'changement_charges',
    'travaux',
    'autre'
  )),
  description TEXT NOT NULL,
  effective_date DATE NOT NULL,
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE lease_amendments ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Owner can view amendments for their leases
DROP POLICY IF EXISTS "owner_select_amendments" ON lease_amendments;
CREATE POLICY "owner_select_amendments"
  ON lease_amendments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Tenant can view amendments for leases they signed
DROP POLICY IF EXISTS "tenant_select_amendments" ON lease_amendments;
CREATE POLICY "tenant_select_amendments"
  ON lease_amendments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lease_signers ls
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE ls.lease_id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Owner can create amendments for their leases
DROP POLICY IF EXISTS "owner_insert_amendments" ON lease_amendments;
CREATE POLICY "owner_insert_amendments"
  ON lease_amendments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Owner can update amendments for their leases (only unsigned ones)
DROP POLICY IF EXISTS "owner_update_amendments" ON lease_amendments;
CREATE POLICY "owner_update_amendments"
  ON lease_amendments
  FOR UPDATE
  USING (
    signed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_lease_amendments_lease_id
  ON lease_amendments (lease_id);

CREATE INDEX IF NOT EXISTS idx_lease_amendments_type
  ON lease_amendments (amendment_type);

CREATE INDEX IF NOT EXISTS idx_lease_amendments_effective_date
  ON lease_amendments (effective_date);

-- 5. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_lease_amendments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lease_amendments_updated_at
  BEFORE UPDATE ON lease_amendments
  FOR EACH ROW
  EXECUTE FUNCTION update_lease_amendments_updated_at();

-- 6. Comments
COMMENT ON TABLE lease_amendments IS 'Avenants au bail — modifications contractuelles';
COMMENT ON COLUMN lease_amendments.amendment_type IS 'Type: loyer_revision, ajout/retrait_colocataire, changement_charges, travaux, autre';
COMMENT ON COLUMN lease_amendments.old_values IS 'Valeurs avant modification (JSONB)';
COMMENT ON COLUMN lease_amendments.new_values IS 'Valeurs après modification (JSONB)';
COMMENT ON COLUMN lease_amendments.signed_at IS 'Date de signature de l''avenant par toutes les parties';


-- === [163/169] 20260408130000_rgpd_consent_records_and_data_requests.sql ===
-- Migration RGPD : consent_records (historique granulaire) + data_requests (demandes export/suppression)
-- Complète la table user_consents existante avec un historique versionné

-- ============================================
-- 1. consent_records : historique granulaire des consentements
-- ============================================
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'cgu', 'privacy_policy', 'marketing', 'analytics',
    'cookies_functional', 'cookies_analytics'
  )),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  version TEXT NOT NULL
);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own consent records" ON consent_records;

CREATE POLICY "Users can view own consent records"
  ON consent_records FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert own consent records" ON consent_records;

CREATE POLICY "Users can insert own consent records"
  ON consent_records FOR INSERT
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_consent_records_profile_id ON consent_records(profile_id);
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);

-- ============================================
-- 2. data_requests : demandes RGPD (export, suppression, rectification)
-- ============================================
CREATE TABLE IF NOT EXISTS data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'deletion', 'rectification')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason TEXT,
  completed_at TIMESTAMPTZ,
  download_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own data requests" ON data_requests;

CREATE POLICY "Users can view own data requests"
  ON data_requests FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert own data requests" ON data_requests;

CREATE POLICY "Users can insert own data requests"
  ON data_requests FOR INSERT
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update own pending data requests" ON data_requests;

CREATE POLICY "Users can update own pending data requests"
  ON data_requests FOR UPDATE
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status = 'pending'
  );

CREATE INDEX idx_data_requests_profile_id ON data_requests(profile_id);
CREATE INDEX idx_data_requests_status ON data_requests(status);


-- === [164/169] 20260408130000_seasonal_rental_module.sql ===
-- ============================================================
-- Migration: Location saisonnière (seasonal rental module)
-- Tables: seasonal_listings, seasonal_rates, reservations, seasonal_blocked_dates
-- ============================================================

-- Vérifier que l'extension btree_gist est disponible pour la contrainte EXCLUDE
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- 1. seasonal_listings — Annonces saisonnières
-- ============================================================
CREATE TABLE IF NOT EXISTS seasonal_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  min_nights INTEGER DEFAULT 1 CHECK (min_nights >= 1),
  max_nights INTEGER DEFAULT 90 CHECK (max_nights >= 1),
  max_guests INTEGER DEFAULT 4 CHECK (max_guests >= 1),
  check_in_time TEXT DEFAULT '15:00',
  check_out_time TEXT DEFAULT '11:00',
  house_rules TEXT,
  amenities TEXT[] DEFAULT '{}',
  cleaning_fee_cents INTEGER DEFAULT 0 CHECK (cleaning_fee_cents >= 0),
  security_deposit_cents INTEGER DEFAULT 0 CHECK (security_deposit_cents >= 0),
  tourist_tax_per_night_cents INTEGER DEFAULT 0 CHECK (tourist_tax_per_night_cents >= 0),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE seasonal_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_manage_own_listings" ON seasonal_listings;

CREATE POLICY "owners_manage_own_listings" ON seasonal_listings
  FOR ALL USING (owner_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_seasonal_listings_property ON seasonal_listings(property_id);
CREATE INDEX idx_seasonal_listings_owner ON seasonal_listings(owner_id);
CREATE INDEX idx_seasonal_listings_published ON seasonal_listings(is_published) WHERE is_published = true;

-- ============================================================
-- 2. seasonal_rates — Tarifs par saison
-- ============================================================
CREATE TABLE IF NOT EXISTS seasonal_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES seasonal_listings(id) ON DELETE CASCADE,
  season_name TEXT NOT NULL CHECK (season_name IN ('haute', 'basse', 'moyenne', 'fetes')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  nightly_rate_cents INTEGER NOT NULL CHECK (nightly_rate_cents > 0),
  weekly_rate_cents INTEGER CHECK (weekly_rate_cents > 0),
  monthly_rate_cents INTEGER CHECK (monthly_rate_cents > 0),
  min_nights_override INTEGER CHECK (min_nights_override >= 1),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_rate_dates CHECK (end_date > start_date)
);

ALTER TABLE seasonal_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_manage_rates" ON seasonal_rates;

CREATE POLICY "owners_manage_rates" ON seasonal_rates
  FOR ALL USING (listing_id IN (
    SELECT id FROM seasonal_listings WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_seasonal_rates_listing ON seasonal_rates(listing_id);
CREATE INDEX idx_seasonal_rates_dates ON seasonal_rates(start_date, end_date);

-- ============================================================
-- 3. reservations — Réservations saisonnières
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES seasonal_listings(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  guest_count INTEGER DEFAULT 1 CHECK (guest_count >= 1),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER NOT NULL CHECK (nights >= 1),
  nightly_rate_cents INTEGER NOT NULL CHECK (nightly_rate_cents > 0),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  cleaning_fee_cents INTEGER DEFAULT 0 CHECK (cleaning_fee_cents >= 0),
  tourist_tax_cents INTEGER DEFAULT 0 CHECK (tourist_tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  deposit_cents INTEGER DEFAULT 0 CHECK (deposit_cents >= 0),
  source TEXT DEFAULT 'direct' CHECK (source IN ('direct','airbnb','booking','other')),
  external_id TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN (
    'pending','confirmed','checked_in','checked_out','cancelled','no_show'
  )),
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  cleaning_status TEXT DEFAULT 'pending' CHECK (cleaning_status IN ('pending','scheduled','done')),
  cleaning_provider_id UUID REFERENCES providers(id),
  notes TEXT,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_reservation_dates CHECK (check_out > check_in),
  CONSTRAINT no_overlap EXCLUDE USING gist (
    listing_id WITH =,
    daterange(check_in, check_out) WITH &&
  ) WHERE (status NOT IN ('cancelled','no_show'))
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_manage_reservations" ON reservations;

CREATE POLICY "owners_manage_reservations" ON reservations
  FOR ALL USING (listing_id IN (
    SELECT id FROM seasonal_listings WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_reservations_listing ON reservations(listing_id);
CREATE INDEX idx_reservations_property ON reservations(property_id);
CREATE INDEX idx_reservations_dates ON reservations(check_in, check_out);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_source ON reservations(source);
CREATE INDEX idx_reservations_cleaning ON reservations(cleaning_status) WHERE cleaning_status != 'done';

-- ============================================================
-- 4. seasonal_blocked_dates — Dates bloquées
-- ============================================================
CREATE TABLE IF NOT EXISTS seasonal_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES seasonal_listings(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT DEFAULT 'owner_block',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_blocked_dates CHECK (end_date >= start_date)
);

ALTER TABLE seasonal_blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_manage_blocked" ON seasonal_blocked_dates;

CREATE POLICY "owners_manage_blocked" ON seasonal_blocked_dates
  FOR ALL USING (listing_id IN (
    SELECT id FROM seasonal_listings WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_blocked_dates_listing ON seasonal_blocked_dates(listing_id);
CREATE INDEX idx_blocked_dates_range ON seasonal_blocked_dates(start_date, end_date);

-- ============================================================
-- 5. Triggers updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_seasonal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seasonal_listings_updated_at
  BEFORE UPDATE ON seasonal_listings
  FOR EACH ROW EXECUTE FUNCTION update_seasonal_updated_at();

CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_seasonal_updated_at();


-- === [165/169] 20260408130000_security_deposits.sql ===
-- =====================================================
-- Migration: Table des dépôts de garantie (lifecycle tracking)
-- Date: 2026-04-08
-- Spec: talok-paiements — Section 7
-- =====================================================

-- Table principale : un enregistrement par dépôt de garantie par bail
CREATE TABLE IF NOT EXISTS security_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  -- Montant
  amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,

  -- Restitution
  restitution_amount_cents INTEGER,
  retenue_cents INTEGER DEFAULT 0,
  retenue_details JSONB DEFAULT '[]'::jsonb,
  -- Format: [{ "motif": "Dégradations", "amount_cents": 15000, "justification": "Photos EDL" }]
  restitution_due_date DATE,           -- date sortie + 1 ou 2 mois selon EDL
  restituted_at TIMESTAMPTZ,
  restitution_method TEXT,             -- 'virement' | 'cheque' | 'especes'

  -- Statut lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'partially_returned', 'returned', 'disputed')),

  -- Pénalité de retard (10% loyer/mois)
  late_penalty_cents INTEGER DEFAULT 0,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Un seul dépôt par bail
  UNIQUE(lease_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_security_deposits_lease_id ON security_deposits(lease_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_tenant_id ON security_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_status ON security_deposits(status);
CREATE INDEX IF NOT EXISTS idx_security_deposits_restitution_due ON security_deposits(restitution_due_date)
  WHERE status = 'received' AND restitution_due_date IS NOT NULL;

-- Trigger updated_at
CREATE OR REPLACE TRIGGER set_updated_at_security_deposits
  BEFORE UPDATE ON security_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE security_deposits ENABLE ROW LEVEL SECURITY;

-- Politique: Le propriétaire peut gérer les dépôts de ses baux
DROP POLICY IF EXISTS "Owner manages security_deposits" ON security_deposits;
CREATE POLICY "Owner manages security_deposits" ON security_deposits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = security_deposits.lease_id
      AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Politique: Le locataire peut voir son dépôt
DROP POLICY IF EXISTS "Tenant views own security_deposit" ON security_deposits;
CREATE POLICY "Tenant views own security_deposit" ON security_deposits
  FOR SELECT
  USING (
    tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Politique: Admin peut tout gérer
DROP POLICY IF EXISTS "Admin manages all security_deposits" ON security_deposits;
CREATE POLICY "Admin manages all security_deposits" ON security_deposits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- Trigger : créer automatiquement un security_deposit à la signature du bail
-- =====================================================
CREATE OR REPLACE FUNCTION create_security_deposit_on_lease_activation()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_deposit_amount INTEGER;
BEGIN
  -- Seulement quand le bail passe à 'active'
  IF NEW.statut = 'active' AND (OLD.statut IS DISTINCT FROM 'active') THEN
    -- Récupérer le montant du dépôt (stocké en euros dans leases, convertir en centimes)
    v_deposit_amount := COALESCE(NEW.depot_de_garantie, 0) * 100;

    -- Pas de dépôt si montant = 0 (bail mobilité interdit)
    IF v_deposit_amount <= 0 THEN
      RETURN NEW;
    END IF;

    -- Récupérer le locataire principal
    SELECT ls.profile_id INTO v_tenant_id
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.id
      AND ls.role = 'locataire_principal'
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Créer le dépôt en statut 'pending'
    INSERT INTO security_deposits (lease_id, tenant_id, amount_cents, status)
    VALUES (NEW.id, v_tenant_id, v_deposit_amount, 'pending')
    ON CONFLICT (lease_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_security_deposit ON leases;
CREATE TRIGGER trg_create_security_deposit
  AFTER UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION create_security_deposit_on_lease_activation();


-- === [166/169] 20260408140000_tickets_module_sota.sql ===
-- =============================================
-- TICKETS MODULE SOTA — Upgrade complet
-- State machine: open → acknowledged → assigned → in_progress → resolved → closed
--                       ↓                                        ↓
--                    rejected                               reopened → in_progress
-- =============================================

-- 1. Ajouter les nouvelles colonnes à tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_rating INTEGER;

-- 2. Contrainte satisfaction_rating
ALTER TABLE tickets ADD CONSTRAINT tickets_satisfaction_rating_check
  CHECK (satisfaction_rating IS NULL OR (satisfaction_rating >= 1 AND satisfaction_rating <= 5));

-- 3. Contrainte category
ALTER TABLE tickets ADD CONSTRAINT tickets_category_check
  CHECK (category IS NULL OR category IN (
    'plomberie','electricite','serrurerie','chauffage','humidite',
    'nuisibles','bruit','parties_communes','equipement','autre'
  ));

-- 4. Étendre la contrainte de statut (garder paused pour backward compat)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_statut_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_statut_check
  CHECK (statut IN (
    'open','acknowledged','assigned','in_progress',
    'resolved','closed','rejected','reopened','paused'
  ));

-- 5. Étendre la contrainte de priorité (garder anciennes valeurs françaises pour compat)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_priorite_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_priorite_check
  CHECK (priorite IN ('low','normal','urgent','emergency','basse','normale','haute','urgente'));

-- 6. Backfill owner_id depuis properties pour tickets existants
UPDATE tickets t
SET owner_id = p.owner_id
FROM properties p
WHERE t.property_id = p.id
  AND t.owner_id IS NULL;

-- 7. Nouveaux index
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_owner_id ON tickets(owner_id);

-- 8. Créer la table ticket_comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id ON ticket_comments(author_id);

-- 9. RLS policies pour ticket_comments
DROP POLICY IF EXISTS "ticket_comments_select_owner" ON ticket_comments;
CREATE POLICY "ticket_comments_select_owner"
  ON ticket_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      JOIN properties p ON p.id = t.property_id
      WHERE t.id = ticket_comments.ticket_id
        AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "ticket_comments_select_creator" ON ticket_comments;

CREATE POLICY "ticket_comments_select_creator"
  ON ticket_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND t.created_by_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "ticket_comments_select_assigned" ON ticket_comments;

CREATE POLICY "ticket_comments_select_assigned"
  ON ticket_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND t.assigned_to = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "ticket_comments_insert" ON ticket_comments;

CREATE POLICY "ticket_comments_insert"
  ON ticket_comments FOR INSERT
  WITH CHECK (
    author_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "ticket_comments_select_admin" ON ticket_comments;

CREATE POLICY "ticket_comments_select_admin"
  ON ticket_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 10. Trigger updated_at pour tickets (si pas déjà présent)
CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tickets_updated_at ON tickets;
CREATE TRIGGER trigger_update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_updated_at();


-- === [167/169] 20260408200000_unified_notification_system.sql ===
-- =====================================================
-- MIGRATION: Système de notifications unifié
-- Ajoute la table notification_event_preferences (per-event)
-- et les colonnes manquantes sur notifications
-- =====================================================

-- 1. Ajouter colonnes manquantes à notifications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'route') THEN
    ALTER TABLE notifications ADD COLUMN route TEXT;
    COMMENT ON COLUMN notifications.route IS 'Deep link route (e.g. /owner/invoices/xxx)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'channels_sent') THEN
    ALTER TABLE notifications ADD COLUMN channels_sent TEXT[] DEFAULT '{}';
    COMMENT ON COLUMN notifications.channels_sent IS 'Channels actually used: email, push, in_app, sms';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
    ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read_at') THEN
    ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'profile_id') THEN
    ALTER TABLE notifications ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Index for profile-based queries
CREATE INDEX IF NOT EXISTS idx_notif_profile_read_created
  ON notifications(profile_id, is_read, created_at DESC);

-- 2. Table de préférences par événement
CREATE TABLE IF NOT EXISTS notification_event_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_event_prefs_profile
  ON notification_event_preferences(profile_id);

ALTER TABLE notification_event_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own event preferences" ON notification_event_preferences;
DROP POLICY IF EXISTS "Users can view own event preferences" ON notification_event_preferences;
CREATE POLICY "Users can view own event preferences"
  ON notification_event_preferences FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage own event preferences" ON notification_event_preferences;
DROP POLICY IF EXISTS "Users can manage own event preferences" ON notification_event_preferences;
CREATE POLICY "Users can manage own event preferences"
  ON notification_event_preferences FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Allow service role to insert
DROP POLICY IF EXISTS "Service can manage event preferences" ON notification_event_preferences;
DROP POLICY IF EXISTS "Service can manage event preferences" ON notification_event_preferences;
CREATE POLICY "Service can manage event preferences"
  ON notification_event_preferences FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_notification_event_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notif_event_prefs ON notification_event_preferences;
CREATE TRIGGER trigger_update_notif_event_prefs
  BEFORE UPDATE ON notification_event_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_event_prefs_updated_at();

COMMENT ON TABLE notification_event_preferences IS 'Per-event notification channel preferences for each user';

SELECT 'Unified notification system migration complete' AS result;


-- === [168/169] 20260408220000_payment_architecture_sota.sql ===
-- =====================================================
-- Migration: Payment Architecture SOTA 2026
-- Date: 2026-04-08
--
-- 1. rent_payments table (Stripe Connect Express)
-- 2. security_deposits table
-- 3. Invoice state machine alignment (7 états)
-- 4. RLS policies
-- 5. Helper functions
-- =====================================================

-- =====================================================
-- 1. RENT PAYMENTS — Stripe Connect Express
-- Tracks the split between tenant payment, platform
-- commission, and owner payout
-- =====================================================

CREATE TABLE IF NOT EXISTS rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Montants (tous en centimes)
  amount_cents INTEGER NOT NULL,
  commission_amount_cents INTEGER NOT NULL,
  commission_rate NUMERIC(4,3) NOT NULL,
  owner_amount_cents INTEGER NOT NULL,

  -- Stripe Connect
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,
  payment_method TEXT DEFAULT 'sepa_debit'
    CHECK (payment_method IN ('sepa_debit', 'card', 'bank_transfer')),

  -- Statut
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'disputed')),

  -- Dates
  initiated_at TIMESTAMPTZ DEFAULT now(),
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate payments for same invoice
  UNIQUE(invoice_id, stripe_payment_intent_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rent_payments_invoice_id ON rent_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_lease_id ON rent_payments(lease_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_status ON rent_payments(status);
CREATE INDEX IF NOT EXISTS idx_rent_payments_stripe_pi ON rent_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_created_at ON rent_payments(created_at DESC);

-- RLS
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;

-- Owner can view rent payments for their properties
DROP POLICY IF EXISTS "Owner can view rent_payments" ON rent_payments;
CREATE POLICY "Owner can view rent_payments" ON rent_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN properties p ON i.lease_id = (SELECT lease_id FROM leases WHERE id = rent_payments.lease_id LIMIT 1)
      WHERE i.id = rent_payments.invoice_id
        AND i.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Tenant can view their own payments
DROP POLICY IF EXISTS "Tenant can view own rent_payments" ON rent_payments;
CREATE POLICY "Tenant can view own rent_payments" ON rent_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = rent_payments.invoice_id
        AND i.tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Admin full access
DROP POLICY IF EXISTS "Admin can manage rent_payments" ON rent_payments;
CREATE POLICY "Admin can manage rent_payments" ON rent_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role inserts (API routes use service role)
-- No INSERT policy needed for normal users — only backend inserts


-- =====================================================
-- 2. SECURITY DEPOSITS — Dépôts de garantie
-- =====================================================

CREATE TABLE IF NOT EXISTS security_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('sepa_debit', 'card', 'bank_transfer', 'check', 'cash')),

  -- Restitution
  restitution_amount_cents INTEGER,
  retenue_cents INTEGER DEFAULT 0,
  retenue_details JSONB DEFAULT '[]',
  restitution_due_date DATE,
  restituted_at TIMESTAMPTZ,
  restitution_method TEXT
    CHECK (restitution_method IS NULL OR restitution_method IN ('bank_transfer', 'check', 'sepa_credit')),

  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'partially_returned', 'returned', 'disputed')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_deposits_lease_id ON security_deposits(lease_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_tenant_id ON security_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_status ON security_deposits(status);

-- Trigger updated_at
CREATE OR REPLACE TRIGGER set_updated_at_security_deposits
  BEFORE UPDATE ON security_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE security_deposits ENABLE ROW LEVEL SECURITY;

-- Owner can manage deposits for their properties
DROP POLICY IF EXISTS "Owner can manage security_deposits" ON security_deposits;
CREATE POLICY "Owner can manage security_deposits" ON security_deposits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = security_deposits.lease_id
        AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Tenant can view their own deposits
DROP POLICY IF EXISTS "Tenant can view own security_deposits" ON security_deposits;
CREATE POLICY "Tenant can view own security_deposits" ON security_deposits
  FOR SELECT USING (
    tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin full access
DROP POLICY IF EXISTS "Admin can manage all security_deposits" ON security_deposits;
CREATE POLICY "Admin can manage all security_deposits" ON security_deposits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- =====================================================
-- 3. INVOICE STATUS ALIGNMENT
-- Add missing statuses to invoices CHECK constraint
-- Spec states: draft, sent, pending, paid, receipt_generated,
--              overdue, reminder_sent, collection, written_off
-- =====================================================

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- period_start / period_end for spec alignment
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'period_start') THEN
    ALTER TABLE invoices ADD COLUMN period_start DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'period_end') THEN
    ALTER TABLE invoices ADD COLUMN period_end DATE;
  END IF;

  -- rent_amount_cents / charges_amount_cents / total_amount_cents
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'rent_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN rent_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'charges_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN charges_amount_cents INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'total_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN total_amount_cents INTEGER;
  END IF;

  -- entity_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'entity_id') THEN
    ALTER TABLE invoices ADD COLUMN entity_id UUID REFERENCES legal_entities(id);
  END IF;

  -- receipt_document_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_document_id') THEN
    ALTER TABLE invoices ADD COLUMN receipt_document_id UUID REFERENCES documents(id);
  END IF;

  -- receipt_generated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_generated_at') THEN
    ALTER TABLE invoices ADD COLUMN receipt_generated_at TIMESTAMPTZ;
  END IF;

  -- last_reminder_at (alias for existing last_reminder_sent_at)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'last_reminder_at') THEN
    ALTER TABLE invoices ADD COLUMN last_reminder_at TIMESTAMPTZ;
  END IF;

  -- metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'metadata') THEN
    ALTER TABLE invoices ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;

  -- paid_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'paid_at') THEN
    ALTER TABLE invoices ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;

  -- stripe_invoice_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'stripe_invoice_id') THEN
    ALTER TABLE invoices ADD COLUMN stripe_invoice_id TEXT;
  END IF;
END $$;

-- Backfill cents columns from existing euro columns
UPDATE invoices
SET
  rent_amount_cents = COALESCE(ROUND(montant_loyer * 100)::INTEGER, 0),
  charges_amount_cents = COALESCE(ROUND(montant_charges * 100)::INTEGER, 0),
  total_amount_cents = COALESCE(ROUND(montant_total * 100)::INTEGER, 0)
WHERE rent_amount_cents IS NULL AND montant_loyer IS NOT NULL;

-- Backfill period_start/period_end from periode (format: YYYY-MM)
UPDATE invoices
SET
  period_start = (periode || '-01')::DATE,
  period_end = ((periode || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day')::DATE
WHERE period_start IS NULL AND periode IS NOT NULL;


-- =====================================================
-- 4. HELPER FUNCTION: Transition invoice status
-- Validates the state machine transitions
-- =====================================================

CREATE OR REPLACE FUNCTION transition_invoice_status(
  p_invoice_id UUID,
  p_new_status TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_allowed BOOLEAN := FALSE;
BEGIN
  SELECT statut INTO v_current_status
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;

  -- Validate transitions
  v_allowed := CASE
    WHEN v_current_status = 'draft' AND p_new_status = 'sent' THEN TRUE
    WHEN v_current_status = 'sent' AND p_new_status IN ('pending', 'paid', 'overdue') THEN TRUE
    WHEN v_current_status = 'pending' AND p_new_status IN ('paid', 'overdue') THEN TRUE
    WHEN v_current_status = 'paid' AND p_new_status = 'receipt_generated' THEN TRUE
    WHEN v_current_status = 'overdue' AND p_new_status IN ('paid', 'reminder_sent') THEN TRUE
    WHEN v_current_status = 'reminder_sent' AND p_new_status IN ('paid', 'collection') THEN TRUE
    WHEN v_current_status = 'collection' AND p_new_status IN ('paid', 'written_off') THEN TRUE
    -- Legacy status compatibility
    WHEN v_current_status = 'late' AND p_new_status IN ('paid', 'overdue', 'reminder_sent') THEN TRUE
    WHEN v_current_status = 'unpaid' AND p_new_status IN ('paid', 'overdue') THEN TRUE
    ELSE FALSE
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', v_current_status, p_new_status;
  END IF;

  UPDATE invoices
  SET
    statut = p_new_status,
    paid_at = CASE WHEN p_new_status = 'paid' THEN now() ELSE paid_at END,
    receipt_generated_at = CASE WHEN p_new_status = 'receipt_generated' THEN now() ELSE receipt_generated_at END,
    last_reminder_at = CASE WHEN p_new_status = 'reminder_sent' THEN now() ELSE last_reminder_at END,
    metadata = COALESCE(metadata, '{}'::JSONB) || p_metadata,
    updated_at = now()
  WHERE id = p_invoice_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 5. HELPER: Get owner Connect account for a property
-- =====================================================

CREATE OR REPLACE FUNCTION get_owner_connect_account_for_invoice(p_invoice_id UUID)
RETURNS TABLE(
  stripe_account_id TEXT,
  charges_enabled BOOLEAN,
  owner_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sca.stripe_account_id,
    sca.charges_enabled,
    i.owner_id
  FROM invoices i
  JOIN profiles p ON i.owner_id = p.id
  LEFT JOIN stripe_connect_accounts sca ON sca.owner_id = p.id AND sca.status = 'active'
  WHERE i.id = p_invoice_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 6. PERFORMANCE INDEXES
-- =====================================================

-- Fast lookups for overdue invoices (cron)
CREATE INDEX IF NOT EXISTS idx_invoices_overdue_check
  ON invoices(due_date, statut)
  WHERE statut IN ('sent', 'pending', 'overdue', 'late');

-- Fast lookups for receipt generation
CREATE INDEX IF NOT EXISTS idx_invoices_receipt_pending
  ON invoices(id)
  WHERE statut = 'paid' AND receipt_generated IS NOT TRUE;


-- === [169/169] 20260409100000_add_missing_rls.sql ===
-- ==========================================================
-- Migration: Add missing RLS to 8 unprotected tables
-- Date: 2026-04-09
-- Context: Audit express identified 8 tables without RLS
-- ==========================================================

-- ──────────────────────────────────────────────
-- 1. tenants (system multi-tenant table, no user column)
-- Admin-only access via service role
-- ──────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_admin_only" ON tenants;

CREATE POLICY "tenants_admin_only"
  ON tenants FOR ALL
  USING (false);
-- Service role bypasses RLS; app code uses service client for admin ops

-- ──────────────────────────────────────────────
-- 2. two_factor_sessions (security-critical, has user_id)
-- ──────────────────────────────────────────────
ALTER TABLE two_factor_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_2fa_sessions" ON two_factor_sessions;

CREATE POLICY "users_own_2fa_sessions"
  ON two_factor_sessions FOR ALL
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 3. lease_templates (system-wide templates, read-only for users)
-- ──────────────────────────────────────────────
ALTER TABLE lease_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_templates_read_authenticated" ON lease_templates;

CREATE POLICY "lease_templates_read_authenticated"
  ON lease_templates FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lease_templates_write_admin_only" ON lease_templates;

CREATE POLICY "lease_templates_write_admin_only"
  ON lease_templates FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 4. idempotency_keys (API utility, no user column)
-- ──────────────────────────────────────────────
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "idempotency_keys_service_only" ON idempotency_keys;

CREATE POLICY "idempotency_keys_service_only"
  ON idempotency_keys FOR ALL
  USING (false);
-- Only accessed via service role in API middleware

-- ──────────────────────────────────────────────
-- 5. repair_cost_grid (reference table, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE repair_cost_grid ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "repair_cost_grid_read_authenticated" ON repair_cost_grid;

CREATE POLICY "repair_cost_grid_read_authenticated"
  ON repair_cost_grid FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "repair_cost_grid_write_admin_only" ON repair_cost_grid;

CREATE POLICY "repair_cost_grid_write_admin_only"
  ON repair_cost_grid FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 6. vetuste_grid (reference table for depreciation, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE vetuste_grid ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vetuste_grid_read_authenticated" ON vetuste_grid;

CREATE POLICY "vetuste_grid_read_authenticated"
  ON vetuste_grid FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "vetuste_grid_write_admin_only" ON vetuste_grid;

CREATE POLICY "vetuste_grid_write_admin_only"
  ON vetuste_grid FOR ALL
  USING (false);

-- ──────────────────────────────────────────────
-- 7. vetusty_grid (variant of vetuste_grid, read-only)
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_grid') THEN
    ALTER TABLE vetusty_grid ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_grid') THEN
    EXECUTE 'CREATE POLICY "vetusty_grid_read_authenticated" ON vetusty_grid FOR SELECT USING (auth.role() = ''authenticated'')';
    EXECUTE 'CREATE POLICY "vetusty_grid_write_admin_only" ON vetusty_grid FOR ALL USING (false)';
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- 8. api_webhook_deliveries (indirect user link via webhook_id)
-- ──────────────────────────────────────────────
ALTER TABLE api_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_deliveries_owner_access" ON api_webhook_deliveries;

CREATE POLICY "webhook_deliveries_owner_access"
  ON api_webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_webhooks w
      WHERE w.id = api_webhook_deliveries.webhook_id
        AND w.profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "webhook_deliveries_write_service_only" ON api_webhook_deliveries;

CREATE POLICY "webhook_deliveries_write_service_only"
  ON api_webhook_deliveries FOR INSERT
  USING (false);
-- Deliveries are created by the system (service role), users can only read their own


