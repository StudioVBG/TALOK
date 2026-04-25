-- ============================================================================
-- Sprint Provider — Logo entreprise + templates de devis réutilisables
-- ============================================================================
-- Ajoute :
--   1. Colonne provider_profiles.company_logo_url (logo entreprise distinct
--      de l'avatar utilisateur stocké dans profiles.avatar_url).
--   2. Table quote_templates : devis-types réutilisables par le prestataire,
--      avec lignes pré-remplies (titre, description, qty, prix, TVA).
--   3. Table quote_template_items : lignes de chaque template.
--
-- Triggers : touch updated_at
-- RLS : provider gère ses propres templates uniquement.
-- ============================================================================


-- ============================================================================
-- BLOC 1 — Logo entreprise sur provider_profiles
-- ============================================================================

BEGIN;

ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

COMMENT ON COLUMN public.provider_profiles.company_logo_url IS
  'URL publique du logo entreprise (Supabase storage bucket documents). Distinct de profiles.avatar_url qui est l''avatar utilisateur.';

COMMIT;


-- ============================================================================
-- BLOC 2 — Tables quote_templates + quote_template_items
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_profile_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  default_validity_days INTEGER NOT NULL DEFAULT 30
    CHECK (default_validity_days > 0 AND default_validity_days <= 365),
  default_tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 20.00
    CHECK (default_tax_rate >= 0 AND default_tax_rate <= 100),
  default_terms TEXT,
  default_payment_conditions TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_templates_provider_active
  ON public.quote_templates(provider_profile_id)
  WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_quote_templates_provider_category
  ON public.quote_templates(provider_profile_id, category);


CREATE TABLE IF NOT EXISTS public.quote_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL
    REFERENCES public.quote_templates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit TEXT,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 20.00
    CHECK (tax_rate >= 0 AND tax_rate <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_template_items_template_pos
  ON public.quote_template_items(template_id, position);

COMMIT;


-- ============================================================================
-- BLOC 3 — Triggers updated_at
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.touch_quote_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_templates_touch_updated_at
  ON public.quote_templates;
CREATE TRIGGER trg_quote_templates_touch_updated_at
  BEFORE UPDATE ON public.quote_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_quote_templates_updated_at();

COMMIT;


-- ============================================================================
-- BLOC 4 — RLS policies
-- ============================================================================
-- Provider voit / gère uniquement ses propres templates.
-- Admin = full read.
-- Helpers : public.user_profile_id(), public.user_role()
-- ============================================================================

BEGIN;

ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_template_items ENABLE ROW LEVEL SECURITY;


-- ---------- quote_templates ----------

DROP POLICY IF EXISTS quote_templates_select_own
  ON public.quote_templates;
CREATE POLICY quote_templates_select_own
  ON public.quote_templates FOR SELECT
  USING (
    provider_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS quote_templates_insert_own
  ON public.quote_templates;
CREATE POLICY quote_templates_insert_own
  ON public.quote_templates FOR INSERT
  WITH CHECK (
    provider_profile_id = public.user_profile_id()
  );

DROP POLICY IF EXISTS quote_templates_update_own
  ON public.quote_templates;
CREATE POLICY quote_templates_update_own
  ON public.quote_templates FOR UPDATE
  USING (provider_profile_id = public.user_profile_id())
  WITH CHECK (provider_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS quote_templates_delete_own
  ON public.quote_templates;
CREATE POLICY quote_templates_delete_own
  ON public.quote_templates FOR DELETE
  USING (provider_profile_id = public.user_profile_id());


-- ---------- quote_template_items (via parent template) ----------

DROP POLICY IF EXISTS quote_template_items_select_via_parent
  ON public.quote_template_items;
CREATE POLICY quote_template_items_select_via_parent
  ON public.quote_template_items FOR SELECT
  USING (
    public.user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.quote_templates qt
      WHERE qt.id = quote_template_items.template_id
        AND qt.provider_profile_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS quote_template_items_insert_via_parent
  ON public.quote_template_items;
CREATE POLICY quote_template_items_insert_via_parent
  ON public.quote_template_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quote_templates qt
      WHERE qt.id = quote_template_items.template_id
        AND qt.provider_profile_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS quote_template_items_update_via_parent
  ON public.quote_template_items;
CREATE POLICY quote_template_items_update_via_parent
  ON public.quote_template_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_templates qt
      WHERE qt.id = quote_template_items.template_id
        AND qt.provider_profile_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS quote_template_items_delete_via_parent
  ON public.quote_template_items;
CREATE POLICY quote_template_items_delete_via_parent
  ON public.quote_template_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_templates qt
      WHERE qt.id = quote_template_items.template_id
        AND qt.provider_profile_id = public.user_profile_id()
    )
  );

COMMIT;


-- ============================================================================
-- FIN — Migration 20260425130100_provider_logo_and_quote_templates
-- Colonnes : provider_profiles.company_logo_url
-- Tables   : quote_templates, quote_template_items
-- Triggers : trg_quote_templates_touch_updated_at
-- RLS      : 8 policies (4 par table, owner-scoped)
-- ============================================================================
