-- =============================================================================
-- Migration : création des tables promo_codes + promo_code_uses
-- =============================================================================
-- Contexte : la route /admin/promo-codes et l'endpoint
-- /api/subscriptions/promo/validate référencent public.promo_codes depuis
-- plusieurs mois, mais la migration SQL correspondante n'avait jamais été
-- créée. Conséquence : GET /api/admin/promo-codes → 500 (PostgREST schema
-- cache miss).
--
-- Shape aligné sur le code TypeScript existant (lib/subscriptions/types.ts,
-- app/api/admin/promo-codes/**, app/api/subscriptions/promo/validate) :
--   discount_type   -> ('percent','fixed')   (pas 'amount_off')
--   is_active       -> boolean                (pas de colonne 'status')
--   applicable_plans-> text[]                 (slugs des plans Talok)
--
-- Les colonnes stripe_* restent nullables pour permettre une migration
-- ultérieure vers Option A (wrapper Stripe Coupons) sans cassage.
-- Voir AUDIT_ADMIN_PROMO_CODES.md pour la décision A/B/C.
-- =============================================================================

-- 1. TABLE promo_codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identité
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  description TEXT,

  -- Remise
  discount_type TEXT NOT NULL
    CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC NOT NULL
    CHECK (discount_value > 0),

  -- Éligibilité
  applicable_plans TEXT[] NOT NULL DEFAULT '{}',
  min_billing_cycle TEXT
    CHECK (min_billing_cycle IN ('monthly', 'yearly')),
  first_subscription_only BOOLEAN NOT NULL DEFAULT FALSE,

  -- Limites d'usage
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  max_uses_per_user INTEGER NOT NULL DEFAULT 1
    CHECK (max_uses_per_user > 0),

  -- Validité temporelle
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  -- Intégration Stripe (nullables — remplis si Option A activée plus tard)
  stripe_coupon_id TEXT UNIQUE,
  stripe_promotion_code_id TEXT UNIQUE,

  -- État
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Garde-fous
  CONSTRAINT promo_codes_code_format
    CHECK (code ~ '^[A-Z0-9_-]{3,40}$'),
  CONSTRAINT promo_codes_percent_max
    CHECK (discount_type <> 'percent' OR discount_value <= 100),
  CONSTRAINT promo_codes_valid_window
    CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_promo_codes_code
  ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active
  ON public.promo_codes(is_active)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_promo_codes_validity
  ON public.promo_codes(valid_from, valid_until)
  WHERE is_active = TRUE;

-- Trigger updated_at (fonction existante, cf. 202502160000_fix_supabase_advisors_issues.sql)
DROP TRIGGER IF EXISTS trg_promo_codes_updated_at ON public.promo_codes;
CREATE TRIGGER trg_promo_codes_updated_at
  BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Lecture :
--  - admins : tout
--  - utilisateurs authentifiés : uniquement les codes actifs et valides
--    (nécessaire pour que /api/subscriptions/promo/validate, qui utilise
--    le client Supabase user-scoped, puisse lire un code par son `code`).
--    L'énumération reste difficile : il faut connaître le code pour le
--    retrouver.
DROP POLICY IF EXISTS promo_codes_admin_all ON public.promo_codes;
CREATE POLICY promo_codes_admin_all ON public.promo_codes
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS promo_codes_read_active ON public.promo_codes;
CREATE POLICY promo_codes_read_active ON public.promo_codes
  FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    AND (valid_until IS NULL OR valid_until > NOW())
    AND (max_uses IS NULL OR uses_count < max_uses)
  );


-- 2. TABLE promo_code_uses (historique d'utilisation)
CREATE TABLE IF NOT EXISTS public.promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  promo_code_id UUID NOT NULL
    REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID,  -- FK optionnelle (ajoutée dans une migration
                         -- ultérieure une fois que promo sera branché au
                         -- webhook Stripe ; non NOT NULL pour compatibilité)

  -- Montants au moment de l'application (centimes)
  discount_amount INTEGER,
  original_amount INTEGER,
  final_amount INTEGER,

  applied_plan_slug TEXT,
  applied_billing_cycle TEXT CHECK (applied_billing_cycle IN ('monthly','yearly')),
  stripe_session_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_code_uses_code
  ON public.promo_code_uses(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_user
  ON public.promo_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_user_code
  ON public.promo_code_uses(user_id, promo_code_id);

ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promo_code_uses_admin_all ON public.promo_code_uses;
CREATE POLICY promo_code_uses_admin_all ON public.promo_code_uses
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Les utilisateurs authentifiés peuvent consulter leur propre historique
-- (utilisé par /api/subscriptions/promo/validate pour compter leurs usages).
DROP POLICY IF EXISTS promo_code_uses_self_select ON public.promo_code_uses;
CREATE POLICY promo_code_uses_self_select ON public.promo_code_uses
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- L'insertion se fera uniquement depuis le service role (webhook Stripe,
-- route /api/subscriptions/promo/use). Aucune policy INSERT pour
-- authenticated ⇒ insertion bloquée hors service role.


-- 3. COMMENTAIRES
COMMENT ON TABLE public.promo_codes IS
  'Codes promotionnels Talok (SaaS abonnements). Shape aligné sur le code
   TypeScript existant. Les colonnes stripe_* restent nullables en attendant
   la décision A/B/C (cf. AUDIT_ADMIN_PROMO_CODES.md).';
COMMENT ON COLUMN public.promo_codes.discount_type IS
  'percent = pourcentage (1-100) / fixed = centimes (EUR)';
COMMENT ON COLUMN public.promo_codes.applicable_plans IS
  'Slugs des plans éligibles. Vide = tous les plans.';
COMMENT ON COLUMN public.promo_codes.stripe_coupon_id IS
  'ID Stripe Coupon associé. NULL tant que l''intégration Stripe
   (Option A) n''est pas active.';

COMMENT ON TABLE public.promo_code_uses IS
  'Historique d''utilisation des codes promo (1 ligne par application
   réussie). Alimenté par le webhook Stripe ou une route serveur dédiée.';
