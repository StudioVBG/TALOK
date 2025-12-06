-- Migration: Système de gestion des changements de tarifs
-- Date: 2024-12-01
-- Description: Tables pour historique des prix, grandfathering et consentements CGU

BEGIN;

-- ============================================
-- HISTORIQUE DES MODIFICATIONS DE PLANS
-- ============================================
CREATE TABLE IF NOT EXISTS plan_pricing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  
  -- Ancien tarif
  old_price_monthly INTEGER NOT NULL,
  old_price_yearly INTEGER NOT NULL,
  old_features JSONB,
  old_limits JSONB,
  
  -- Nouveau tarif
  new_price_monthly INTEGER NOT NULL,
  new_price_yearly INTEGER NOT NULL,
  new_features JSONB,
  new_limits JSONB,
  
  -- Métadonnées
  change_reason TEXT NOT NULL,
  effective_date TIMESTAMPTZ NOT NULL,
  notification_sent_at TIMESTAMPTZ,
  affected_subscribers_count INTEGER DEFAULT 0,
  
  -- Admin qui a effectué le changement
  changed_by UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_history_plan ON plan_pricing_history(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_history_effective ON plan_pricing_history(effective_date);
CREATE INDEX IF NOT EXISTS idx_plan_history_created ON plan_pricing_history(created_at DESC);

-- ============================================
-- VERSION DES CGU
-- ============================================
CREATE TABLE IF NOT EXISTS cgu_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  changes_summary TEXT,
  published_at TIMESTAMPTZ,
  effective_date TIMESTAMPTZ NOT NULL,
  requires_consent BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cgu_versions_published ON cgu_versions(published_at DESC);

-- ============================================
-- TABLE DES CONSENTEMENTS CGU
-- ============================================
CREATE TABLE IF NOT EXISTS cgu_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cgu_version_id UUID NOT NULL REFERENCES cgu_versions(id),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  
  UNIQUE(user_id, cgu_version_id)
);

CREATE INDEX IF NOT EXISTS idx_cgu_consents_user ON cgu_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_cgu_consents_version ON cgu_consents(cgu_version_id);

-- ============================================
-- AJOUT COLONNES GRANDFATHERING SUR SUBSCRIPTIONS
-- ============================================
DO $$
BEGIN
  -- Colonne pour la date de fin du grandfathering
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'grandfathered_until') THEN
    ALTER TABLE subscriptions ADD COLUMN grandfathered_until TIMESTAMPTZ;
  END IF;
  
  -- Tarif mensuel verrouillé
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'locked_price_monthly') THEN
    ALTER TABLE subscriptions ADD COLUMN locked_price_monthly INTEGER;
  END IF;
  
  -- Tarif annuel verrouillé
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'locked_price_yearly') THEN
    ALTER TABLE subscriptions ADD COLUMN locked_price_yearly INTEGER;
  END IF;
  
  -- Date de notification du changement de prix
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'price_change_notified_at') THEN
    ALTER TABLE subscriptions ADD COLUMN price_change_notified_at TIMESTAMPTZ;
  END IF;
  
  -- Acceptation du changement de prix
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscriptions' AND column_name = 'price_change_accepted') THEN
    ALTER TABLE subscriptions ADD COLUMN price_change_accepted BOOLEAN DEFAULT NULL;
  END IF;
END $$;

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE plan_pricing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgu_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgu_consents ENABLE ROW LEVEL SECURITY;

-- Admins peuvent tout gérer sur l'historique des prix
DROP POLICY IF EXISTS "Admins can manage pricing history" ON plan_pricing_history;
CREATE POLICY "Admins can manage pricing history" ON plan_pricing_history
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Admins peuvent tout gérer sur les CGU versions
DROP POLICY IF EXISTS "Admins can manage CGU versions" ON cgu_versions;
CREATE POLICY "Admins can manage CGU versions" ON cgu_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- CGU publiées visibles par tous les authentifiés
DROP POLICY IF EXISTS "Published CGU visible by all" ON cgu_versions;
CREATE POLICY "Published CGU visible by all" ON cgu_versions
  FOR SELECT TO authenticated
  USING (published_at IS NOT NULL);

-- Utilisateurs voient leurs propres consentements
DROP POLICY IF EXISTS "Users can view their consents" ON cgu_consents;
CREATE POLICY "Users can view their consents" ON cgu_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Utilisateurs peuvent accepter les CGU
DROP POLICY IF EXISTS "Users can accept CGU" ON cgu_consents;
CREATE POLICY "Users can accept CGU" ON cgu_consents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins peuvent voir tous les consentements
DROP POLICY IF EXISTS "Admins can view all consents" ON cgu_consents;
CREATE POLICY "Admins can view all consents" ON cgu_consents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- ============================================
-- FONCTION: Obtenir le prix effectif d'un abonnement
-- (prend en compte le grandfathering)
-- ============================================
CREATE OR REPLACE FUNCTION get_effective_subscription_price(
  p_subscription_id UUID
) RETURNS TABLE (
  price_monthly INTEGER,
  price_yearly INTEGER,
  is_grandfathered BOOLEAN,
  grandfathered_until TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN s.grandfathered_until IS NOT NULL AND s.grandfathered_until > NOW()
      THEN COALESCE(s.locked_price_monthly, p.price_monthly)
      ELSE p.price_monthly
    END AS price_monthly,
    CASE 
      WHEN s.grandfathered_until IS NOT NULL AND s.grandfathered_until > NOW()
      THEN COALESCE(s.locked_price_yearly, p.price_yearly)
      ELSE p.price_yearly
    END AS price_yearly,
    (s.grandfathered_until IS NOT NULL AND s.grandfathered_until > NOW()) AS is_grandfathered,
    s.grandfathered_until
  FROM subscriptions s
  JOIN subscription_plans p ON s.plan_id = p.id
  WHERE s.id = p_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- INSÉRER UNE VERSION CGU INITIALE
-- ============================================
INSERT INTO cgu_versions (version, content_hash, changes_summary, published_at, effective_date, requires_consent)
VALUES (
  '1.0.0',
  md5('initial'),
  'Version initiale des Conditions Générales d''Utilisation',
  NOW(),
  NOW(),
  false -- Pas besoin de consentement pour la version initiale
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

