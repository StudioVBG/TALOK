-- Migration : Ajout du suivi de première connexion et complétion d'onboarding
-- Date: 2026-01-14

-- ============================================
-- 1. AJOUT DES COLONNES DE SUIVI À PROFILES
-- ============================================

-- Ajouter les colonnes de suivi de première connexion
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS welcome_seen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tour_completed_at TIMESTAMPTZ;

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_profiles_first_login_at ON profiles(first_login_at);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed_at ON profiles(onboarding_completed_at);

-- ============================================
-- 2. TABLE D'ANALYTICS D'ONBOARDING
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor')),

  -- Métriques de temps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_duration_seconds INTEGER,

  -- Métriques par étape
  steps_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{ step: "profile", started_at, completed_at, duration_seconds, skipped: false, attempts: 1 }]

  -- Métriques de comportement
  total_steps INTEGER NOT NULL DEFAULT 0,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  skipped_steps INTEGER NOT NULL DEFAULT 0,
  dropped_at_step TEXT,

  -- Source et contexte
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device_type TEXT,
  browser TEXT,

  -- Métadonnées
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_user_id ON onboarding_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_profile_id ON onboarding_analytics(profile_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_role ON onboarding_analytics(role);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_completed_at ON onboarding_analytics(completed_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_dropped_at_step ON onboarding_analytics(dropped_at_step) WHERE dropped_at_step IS NOT NULL;

-- Trigger updated_at
CREATE TRIGGER update_onboarding_analytics_updated_at
  BEFORE UPDATE ON onboarding_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE onboarding_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics"
  ON onboarding_analytics FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own analytics"
  ON onboarding_analytics FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own analytics"
  ON onboarding_analytics FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- 3. TABLE DE RAPPELS D'ONBOARDING
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor')),

  -- Type de rappel
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '72h', '7d', '14d', '30d')),

  -- Statut
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Canal
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'push', 'sms')),

  -- Contenu
  email_sent_to TEXT,
  subject TEXT,

  -- État
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'cancelled', 'failed')),
  error_message TEXT,

  -- Métadonnées
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Éviter les doublons
  UNIQUE(user_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_reminders_user_id ON onboarding_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_reminders_scheduled_at ON onboarding_reminders(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_reminders_status ON onboarding_reminders(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_reminders_pending ON onboarding_reminders(scheduled_at)
  WHERE status = 'pending';

-- Trigger updated_at
CREATE TRIGGER update_onboarding_reminders_updated_at
  BEFORE UPDATE ON onboarding_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE onboarding_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
  ON onboarding_reminders FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- 4. TABLE FEATURES DÉCOUVERTES
-- ============================================

CREATE TABLE IF NOT EXISTS user_feature_discoveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Feature découverte
  feature_key TEXT NOT NULL,
  -- Exemples: 'dashboard', 'properties', 'leases', 'payments', 'tickets', 'messages'

  -- Timestamps
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tooltip_dismissed_at TIMESTAMPTZ,
  tour_step_completed_at TIMESTAMPTZ,

  -- Métadonnées
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Éviter les doublons
  UNIQUE(user_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_user_feature_discoveries_user_id ON user_feature_discoveries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_discoveries_feature_key ON user_feature_discoveries(feature_key);

-- RLS
ALTER TABLE user_feature_discoveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own discoveries"
  ON user_feature_discoveries FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- 5. FONCTION DE MISE À JOUR DU PREMIER LOGIN
-- ============================================

CREATE OR REPLACE FUNCTION handle_first_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Si c'est la première connexion (first_login_at est NULL)
  IF OLD.first_login_at IS NULL AND NEW.last_login_at IS NOT NULL THEN
    NEW.first_login_at := NEW.last_login_at;
    NEW.login_count := 1;
  ELSIF NEW.last_login_at IS NOT NULL AND NEW.last_login_at != OLD.last_login_at THEN
    NEW.login_count := COALESCE(OLD.login_count, 0) + 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour gérer le premier login
DROP TRIGGER IF EXISTS trigger_handle_first_login ON profiles;
CREATE TRIGGER trigger_handle_first_login
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_first_login();

-- ============================================
-- 6. FONCTION RPC POUR ENREGISTRER UN LOGIN
-- ============================================

CREATE OR REPLACE FUNCTION record_user_login(p_profile_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_is_first_login BOOLEAN;
  v_profile RECORD;
BEGIN
  -- Récupérer le profil actuel
  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Vérifier si c'est le premier login
  v_is_first_login := v_profile.first_login_at IS NULL;

  -- Mettre à jour le profil
  UPDATE profiles
  SET
    last_login_at = NOW(),
    first_login_at = COALESCE(first_login_at, NOW()),
    login_count = COALESCE(login_count, 0) + 1
  WHERE id = p_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'is_first_login', v_is_first_login,
    'login_count', COALESCE(v_profile.login_count, 0) + 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. FONCTION RPC POUR STATS D'ONBOARDING (ADMIN)
-- ============================================

CREATE OR REPLACE FUNCTION get_onboarding_stats(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_started', (SELECT COUNT(*) FROM onboarding_analytics WHERE started_at > NOW() - (p_days || ' days')::INTERVAL),
    'total_completed', (SELECT COUNT(*) FROM onboarding_analytics WHERE completed_at IS NOT NULL AND started_at > NOW() - (p_days || ' days')::INTERVAL),
    'completion_rate', (
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100,
        2
      )
      FROM onboarding_analytics
      WHERE started_at > NOW() - (p_days || ' days')::INTERVAL
    ),
    'avg_completion_time_seconds', (
      SELECT ROUND(AVG(total_duration_seconds))
      FROM onboarding_analytics
      WHERE completed_at IS NOT NULL
      AND started_at > NOW() - (p_days || ' days')::INTERVAL
    ),
    'dropout_by_step', (
      SELECT jsonb_object_agg(dropped_at_step, count)
      FROM (
        SELECT dropped_at_step, COUNT(*) as count
        FROM onboarding_analytics
        WHERE dropped_at_step IS NOT NULL
        AND started_at > NOW() - (p_days || ' days')::INTERVAL
        GROUP BY dropped_at_step
        ORDER BY count DESC
      ) sub
    ),
    'by_role', (
      SELECT jsonb_object_agg(role, stats)
      FROM (
        SELECT
          role,
          jsonb_build_object(
            'started', COUNT(*),
            'completed', COUNT(*) FILTER (WHERE completed_at IS NOT NULL),
            'rate', ROUND(
              (COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100,
              2
            )
          ) as stats
        FROM onboarding_analytics
        WHERE started_at > NOW() - (p_days || ' days')::INTERVAL
        GROUP BY role
      ) sub
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. AJOUTER LES COLONNES OWNER/TENANT/PROVIDER PROFILES
-- ============================================

-- Owner profiles
ALTER TABLE owner_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Tenant profiles
ALTER TABLE tenant_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Provider profiles
ALTER TABLE provider_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Note: guarantor_profiles a déjà ces colonnes

-- ============================================
-- 9. TEMPLATES DE NOTIFICATION ONBOARDING
-- ============================================

INSERT INTO notification_templates (code, name, description, category, channels, priority, in_app_title, in_app_message, in_app_icon, email_subject, variables, is_active)
VALUES
  (
    'onboarding_welcome',
    'Bienvenue',
    'Notification de bienvenue lors de la première connexion',
    'onboarding',
    ARRAY['in_app', 'email']::text[],
    'normal',
    'Bienvenue sur Talok !',
    'Nous sommes ravis de vous accueillir. Complétez votre profil pour commencer.',
    'wave',
    'Bienvenue sur Talok !',
    ARRAY['user_name', 'role']::text[],
    true
  ),
  (
    'onboarding_step_completed',
    'Étape complétée',
    'Notification quand une étape d''onboarding est complétée',
    'onboarding',
    ARRAY['in_app']::text[],
    'low',
    'Bravo !',
    'Vous avez complété l''étape {{step_name}}. Continuez !',
    'check_circle',
    NULL,
    ARRAY['step_name', 'progress_percent']::text[],
    true
  ),
  (
    'onboarding_almost_done',
    'Presque terminé',
    'Notification quand l''onboarding est à 80%+',
    'onboarding',
    ARRAY['in_app', 'push']::text[],
    'normal',
    'Vous y êtes presque !',
    'Plus que {{remaining_steps}} étape(s) pour finaliser votre profil.',
    'rocket',
    NULL,
    ARRAY['remaining_steps', 'progress_percent']::text[],
    true
  ),
  (
    'onboarding_completed',
    'Onboarding terminé',
    'Notification quand l''onboarding est 100% complété',
    'onboarding',
    ARRAY['in_app', 'email', 'push']::text[],
    'normal',
    'Profil complété !',
    'Félicitations ! Votre espace est maintenant entièrement configuré.',
    'trophy',
    'Votre profil Talok est complet !',
    ARRAY['user_name', 'role']::text[],
    true
  ),
  (
    'onboarding_reminder_24h',
    'Rappel 24h',
    'Rappel après 24h d''onboarding incomplet',
    'onboarding',
    ARRAY['email']::text[],
    'normal',
    'N''oubliez pas de finaliser votre profil',
    'Vous êtes à {{progress_percent}}% de compléter votre profil.',
    'bell',
    'Finalisez votre inscription sur Talok',
    ARRAY['user_name', 'progress_percent', 'next_step']::text[],
    true
  ),
  (
    'onboarding_reminder_72h',
    'Rappel 72h',
    'Rappel après 72h d''onboarding incomplet',
    'onboarding',
    ARRAY['email', 'push']::text[],
    'normal',
    'Votre profil vous attend',
    'Reprenez là où vous en étiez et finalisez votre inscription.',
    'clock',
    'Votre compte Talok n''est pas encore complet',
    ARRAY['user_name', 'progress_percent', 'next_step']::text[],
    true
  ),
  (
    'onboarding_reminder_7d',
    'Rappel 7 jours',
    'Rappel après 7 jours d''onboarding incomplet',
    'onboarding',
    ARRAY['email']::text[],
    'low',
    'On vous attend !',
    'Votre espace Talok est presque prêt. Finalisez votre inscription.',
    'hourglass',
    'Nous vous attendons sur Talok',
    ARRAY['user_name', 'progress_percent']::text[],
    true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  channels = EXCLUDED.channels,
  priority = EXCLUDED.priority,
  in_app_title = EXCLUDED.in_app_title,
  in_app_message = EXCLUDED.in_app_message,
  in_app_icon = EXCLUDED.in_app_icon,
  email_subject = EXCLUDED.email_subject,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active;

COMMENT ON TABLE onboarding_analytics IS 'Analytics détaillées du parcours d''onboarding des utilisateurs';
COMMENT ON TABLE onboarding_reminders IS 'Rappels programmés pour les utilisateurs n''ayant pas terminé l''onboarding';
COMMENT ON TABLE user_feature_discoveries IS 'Suivi des fonctionnalités découvertes par l''utilisateur (pour tooltips et tours)';
COMMENT ON COLUMN profiles.first_login_at IS 'Date/heure de la première connexion de l''utilisateur';
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Date/heure de complétion de l''onboarding';
COMMENT ON COLUMN profiles.login_count IS 'Nombre total de connexions';
COMMENT ON COLUMN profiles.welcome_seen_at IS 'Date/heure où le modal de bienvenue a été vu';
COMMENT ON COLUMN profiles.tour_completed_at IS 'Date/heure où le tour guidé a été complété';
