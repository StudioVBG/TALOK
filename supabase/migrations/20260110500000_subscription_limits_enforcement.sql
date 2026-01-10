-- =====================================================
-- Migration: Subscription Limits Enforcement
-- SOTA 2026: Backend enforcement des limites de forfait
-- =====================================================

-- =====================================================
-- 1. Fonction de vérification des limites de propriétés
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
BEGIN
  -- Récupérer le compteur actuel et la limite du plan
  SELECT
    s.properties_count,
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO current_count, max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1; -- Plan gratuit = 1 bien
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur INSERT properties
DROP TRIGGER IF EXISTS check_property_limit_before_insert ON properties;
CREATE TRIGGER check_property_limit_before_insert
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION enforce_property_limit();

-- =====================================================
-- 2. Fonction de vérification des limites de baux
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_lease_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
  property_owner_id UUID;
BEGIN
  -- Récupérer l'owner_id depuis la propriété
  SELECT owner_id INTO property_owner_id
  FROM properties
  WHERE id = NEW.property_id;

  IF property_owner_id IS NULL THEN
    RAISE EXCEPTION 'Propriété non trouvée';
  END IF;

  -- Récupérer le compteur actuel et la limite du plan
  SELECT
    s.leases_count,
    COALESCE(sp.max_leases, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO current_count, max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = property_owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1; -- Plan gratuit = 1 bail
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bail(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour créer plus de baux.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur INSERT leases
DROP TRIGGER IF EXISTS check_lease_limit_before_insert ON leases;
CREATE TRIGGER check_lease_limit_before_insert
  BEFORE INSERT ON leases
  FOR EACH ROW
  EXECUTE FUNCTION enforce_lease_limit();

-- =====================================================
-- 3. Fonction de vérification des limites d'utilisateurs
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_user_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
BEGIN
  -- Compter les utilisateurs actuels pour cet owner
  SELECT COUNT(*) INTO current_count
  FROM team_members
  WHERE owner_id = NEW.owner_id AND status = 'active';

  -- Récupérer la limite du plan
  SELECT
    COALESCE(sp.max_users, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1; -- Plan gratuit = 1 utilisateur (le propriétaire)
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % utilisateur(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour inviter plus de collaborateurs.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur INSERT team_members (si la table existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
    DROP TRIGGER IF EXISTS check_user_limit_before_insert ON team_members;
    CREATE TRIGGER check_user_limit_before_insert
      BEFORE INSERT ON team_members
      FOR EACH ROW
      EXECUTE FUNCTION enforce_user_limit();
  END IF;
END $$;

-- =====================================================
-- 4. Fonction de vérification du quota de signatures
-- =====================================================
CREATE OR REPLACE FUNCTION check_signature_quota(p_owner_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  monthly_quota INTEGER;
  used_this_month INTEGER;
  plan_slug TEXT;
  current_month TEXT;
BEGIN
  current_month := to_char(NOW(), 'YYYY-MM');

  -- Récupérer le quota du plan
  SELECT
    COALESCE(sp.signatures_monthly_quota, 0),
    COALESCE(s.plan_slug, 'gratuit')
  INTO monthly_quota, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = p_owner_id;

  -- Compter les signatures utilisées ce mois
  SELECT COUNT(*) INTO used_this_month
  FROM signature_requests sr
  JOIN leases l ON sr.lease_id = l.id
  JOIN properties p ON l.property_id = p.id
  WHERE p.owner_id = p_owner_id
    AND to_char(sr.created_at, 'YYYY-MM') = current_month
    AND sr.status != 'cancelled';

  -- Si quota illimité (-1), toujours OK
  IF monthly_quota = -1 THEN
    result := jsonb_build_object(
      'can_sign', true,
      'quota', -1,
      'used', used_this_month,
      'remaining', -1,
      'plan', plan_slug
    );
  ELSE
    result := jsonb_build_object(
      'can_sign', used_this_month < monthly_quota,
      'quota', monthly_quota,
      'used', used_this_month,
      'remaining', GREATEST(0, monthly_quota - used_this_month),
      'plan', plan_slug
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. Fonction de vérification d'accès à une feature
-- =====================================================
CREATE OR REPLACE FUNCTION has_subscription_feature(p_owner_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  plan_slug TEXT;
  feature_value BOOLEAN;
BEGIN
  -- Récupérer le plan de l'utilisateur
  SELECT COALESCE(s.plan_slug, 'gratuit')
  INTO plan_slug
  FROM subscriptions s
  WHERE s.owner_id = p_owner_id;

  -- Vérifier si la feature est disponible selon le plan
  -- Cette logique est simplifiée, la vraie vérification devrait
  -- consulter la table subscription_plans pour les features
  SELECT
    CASE
      WHEN sp.features ? p_feature THEN (sp.features->>p_feature)::boolean
      ELSE false
    END
  INTO feature_value
  FROM subscription_plans sp
  WHERE sp.slug = COALESCE(plan_slug, 'gratuit');

  RETURN COALESCE(feature_value, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. Index pour optimiser les requêtes de vérification
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_owner_id ON subscriptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_slug ON subscriptions(plan_slug);

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON FUNCTION enforce_property_limit() IS 'Vérifie et bloque l''ajout de biens au-delà de la limite du forfait';
COMMENT ON FUNCTION enforce_lease_limit() IS 'Vérifie et bloque la création de baux au-delà de la limite du forfait';
COMMENT ON FUNCTION check_signature_quota(UUID) IS 'Retourne le quota de signatures et l''utilisation actuelle';
COMMENT ON FUNCTION has_subscription_feature(UUID, TEXT) IS 'Vérifie si un owner a accès à une feature selon son forfait';
