-- =====================================================
-- Migration: Système de paiement SOTA 2026
-- Date: 2026-02-11
-- Description:
--   - Ajouter plan_slug, user_id, cancel_reason sur subscriptions
--   - Créer subscription_events (audit trail des changements)
--   - Créer admin_user_notes (feedback résiliation)
--   - Créer webhook_logs (traçabilité webhooks entrants)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Colonnes manquantes sur subscriptions
-- =====================================================

-- plan_slug: dénormalisation pour accès rapide sans JOIN
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'plan_slug'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN plan_slug TEXT;

    -- Remplir à partir du plan_id existant
    UPDATE public.subscriptions s
    SET plan_slug = sp.slug
    FROM public.subscription_plans sp
    WHERE s.plan_id = sp.id
      AND s.plan_slug IS NULL;

    RAISE NOTICE 'Column plan_slug added to subscriptions';
  END IF;
END $$;

-- user_id: lien direct vers auth.users pour simplifier les requêtes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN user_id UUID;

    -- Remplir à partir du profil owner
    UPDATE public.subscriptions s
    SET user_id = p.user_id
    FROM public.profiles p
    WHERE s.owner_id = p.id
      AND s.user_id IS NULL;

    RAISE NOTICE 'Column user_id added to subscriptions';
  END IF;
END $$;

-- cancel_reason: raison de l'annulation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'cancel_reason'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN cancel_reason TEXT;

    RAISE NOTICE 'Column cancel_reason added to subscriptions';
  END IF;
END $$;

-- grandfathered_until: date de maintien du tarif historique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'grandfathered_until'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN grandfathered_until TIMESTAMPTZ;

    RAISE NOTICE 'Column grandfathered_until added to subscriptions';
  END IF;
END $$;

-- Index sur plan_slug et user_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_slug
  ON public.subscriptions(plan_slug);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions(user_id);

-- =====================================================
-- 2. Table subscription_events (audit trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Références
  subscription_id UUID NOT NULL,
  user_id UUID NOT NULL,

  -- Événement
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'created', 'activated', 'upgraded', 'downgraded',
      'plan_changed', 'canceled', 'reactivated',
      'trial_started', 'trial_ended',
      'payment_succeeded', 'payment_failed',
      'paused', 'resumed'
    )),

  -- Plans concernés
  from_plan TEXT,
  to_plan TEXT,

  -- Détails
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_subscription_events_sub
  ON public.subscription_events(subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user
  ON public.subscription_events(user_id);

CREATE INDEX IF NOT EXISTS idx_subscription_events_type
  ON public.subscription_events(event_type);

CREATE INDEX IF NOT EXISTS idx_subscription_events_created
  ON public.subscription_events(created_at DESC);

COMMENT ON TABLE public.subscription_events
  IS 'Audit trail de tous les événements liés aux abonnements';

-- RLS
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Les propriétaires peuvent voir leurs propres événements
CREATE POLICY subscription_events_owner_read
  ON public.subscription_events
  FOR SELECT
  USING (
    user_id IN (
      SELECT p.user_id FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );

-- Insertion uniquement via service role (API routes)
-- Pas de policy INSERT pour les utilisateurs normaux

-- =====================================================
-- 3. Table admin_user_notes (notes admin / feedback)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Utilisateur concerné
  user_id UUID NOT NULL,

  -- Admin qui a écrit la note (ou user_id si auto-généré)
  admin_id UUID NOT NULL,

  -- Contenu
  note TEXT NOT NULL,

  -- Importance
  is_important BOOLEAN NOT NULL DEFAULT false,

  -- Catégorie optionnelle
  category TEXT DEFAULT 'general'
    CHECK (category IN ('general', 'billing', 'support', 'cancel_feedback', 'compliance')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_user_notes_user
  ON public.admin_user_notes(user_id);

CREATE INDEX IF NOT EXISTS idx_admin_user_notes_important
  ON public.admin_user_notes(is_important)
  WHERE is_important = true;

COMMENT ON TABLE public.admin_user_notes
  IS 'Notes administrateur sur les utilisateurs (feedback résiliation, support, etc.)';

-- RLS
ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire/écrire
CREATE POLICY admin_user_notes_admin_all
  ON public.admin_user_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- =====================================================
-- 4. Table webhook_logs (traçabilité webhooks entrants)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source du webhook
  provider TEXT NOT NULL
    CHECK (provider IN ('stripe', 'yousign', 'twilio', 'resend', 'plaid', 'other')),

  -- Identifiant Stripe/autre
  event_type TEXT NOT NULL,
  event_id TEXT,

  -- Payload brut (pour debug)
  payload JSONB DEFAULT '{}'::jsonb,

  -- Résultat du traitement
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'error', 'skipped')),
  error TEXT,

  -- Timing
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche par provider et event
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider
  ON public.webhook_logs(provider, event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id
  ON public.webhook_logs(event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_status
  ON public.webhook_logs(status)
  WHERE status = 'error';

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created
  ON public.webhook_logs(created_at DESC);

COMMENT ON TABLE public.webhook_logs
  IS 'Logs des webhooks entrants (Stripe, Yousign, etc.) pour traçabilité et debug';

-- RLS: uniquement accessible via service role
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Fonction de nettoyage des vieux logs (garder 90 jours)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.webhook_logs
  WHERE status = 'success'
    AND created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_webhook_logs()
  IS 'Supprime les webhook logs réussis de plus de 90 jours';

-- =====================================================
-- 5. Trigger: sync plan_slug sur UPDATE de plan_id
-- =====================================================

CREATE OR REPLACE FUNCTION sync_subscription_plan_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    SELECT slug INTO NEW.plan_slug
    FROM subscription_plans
    WHERE id = NEW.plan_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_plan_slug ON subscriptions;
CREATE TRIGGER trg_sync_plan_slug
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscription_plan_slug();

COMMENT ON FUNCTION sync_subscription_plan_slug()
  IS 'Synchronise automatiquement plan_slug quand plan_id change';

-- =====================================================
-- 6. Trigger: sync user_id sur INSERT/UPDATE
-- =====================================================

CREATE OR REPLACE FUNCTION sync_subscription_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM profiles
    WHERE id = NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_id ON subscriptions;
CREATE TRIGGER trg_sync_user_id
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscription_user_id();

COMMENT ON FUNCTION sync_subscription_user_id()
  IS 'Synchronise automatiquement user_id depuis le profil owner';

COMMIT;
