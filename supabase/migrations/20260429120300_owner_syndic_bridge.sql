-- ============================================
-- Pont owner ↔ syndic : connecter un building (côté propriétaire)
-- à un site (côté syndic) quand le syndic utilise aussi Talok.
-- ============================================
-- Cas d'usage :
--   - Owner avec ownership_type='partial' réclame le rattachement à
--     la copropriété gérée par un syndic Talok existant.
--   - Owner avec ownership_type='full' bascule en mode "syndic-bénévole"
--     pour structurer sa gestion (compta dédiée, contrats fournisseurs).
--   - Le syndic invite directement ses copropriétaires (flow inverse,
--     déjà existant via copro_invites — on ajoute juste le lien building).

-- Champs sur buildings
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_link_status TEXT NOT NULL DEFAULT 'unlinked'
    CHECK (site_link_status IN ('unlinked', 'pending', 'linked', 'rejected')),
  ADD COLUMN IF NOT EXISTS site_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_syndic_mode TEXT NOT NULL DEFAULT 'none'
    CHECK (owner_syndic_mode IN ('none', 'volunteer', 'managed_external'));

CREATE INDEX IF NOT EXISTS idx_buildings_site_id
  ON public.buildings(site_id) WHERE site_id IS NOT NULL;

COMMENT ON COLUMN public.buildings.site_id IS
'Si non null, immeuble lié à un site syndic Talok. Null sinon (mono-propriété, syndic externe, ou unlinked).';

COMMENT ON COLUMN public.buildings.owner_syndic_mode IS
'Indique comment le propriétaire gère la copropriété : none (pas de copro / N/A), volunteer (syndic-bénévole de son propre immeuble full), managed_external (syndic externe non-Talok ou sur Talok via site_id).';

-- Table d'historique des demandes de rattachement
CREATE TABLE IF NOT EXISTS public.building_site_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),

  claimed_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claim_message TEXT,

  decided_by_profile_id UUID REFERENCES public.profiles(id),
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Une seule demande pending à la fois pour un (building, site)
  CONSTRAINT building_site_links_unique_pending
    UNIQUE (building_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_building_site_links_building
  ON public.building_site_links(building_id);
CREATE INDEX IF NOT EXISTS idx_building_site_links_site_status
  ON public.building_site_links(site_id, status);

COMMENT ON TABLE public.building_site_links IS
'Historique des demandes de rattachement entre buildings (côté owner) et sites (côté syndic). Un building peut avoir plusieurs entrées (rejet, nouvelle demande, etc.) mais une seule active.';

-- ============================================
-- RLS — building_site_links
-- ============================================
ALTER TABLE public.building_site_links ENABLE ROW LEVEL SECURITY;

-- L'owner du building voit ses propres demandes
DROP POLICY IF EXISTS "building_site_links_owner_select" ON public.building_site_links;
CREATE POLICY "building_site_links_owner_select" ON public.building_site_links
  FOR SELECT TO authenticated
  USING (
    claimed_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR building_id IN (
      SELECT b.id FROM public.buildings b
      JOIN public.profiles p ON p.id = b.owner_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Le syndic du site voit les demandes adressées à ses sites
DROP POLICY IF EXISTS "building_site_links_syndic_select" ON public.building_site_links;
CREATE POLICY "building_site_links_syndic_select" ON public.building_site_links
  FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT s.id FROM public.sites s
      JOIN public.profiles p ON p.id = s.syndic_profile_id
      WHERE p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'platform_admin')
    )
  );

-- L'owner peut soumettre une demande
DROP POLICY IF EXISTS "building_site_links_owner_insert" ON public.building_site_links;
CREATE POLICY "building_site_links_owner_insert" ON public.building_site_links
  FOR INSERT TO authenticated
  WITH CHECK (
    claimed_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND building_id IN (
      SELECT b.id FROM public.buildings b
      JOIN public.profiles p ON p.id = b.owner_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Owner ou syndic peut updater (cancel par owner / approve|reject par syndic)
DROP POLICY IF EXISTS "building_site_links_update" ON public.building_site_links;
CREATE POLICY "building_site_links_update" ON public.building_site_links
  FOR UPDATE TO authenticated
  USING (
    claimed_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR site_id IN (
      SELECT s.id FROM public.sites s
      JOIN public.profiles p ON p.id = s.syndic_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- ============================================
-- Trigger : quand un link passe à 'approved', on met à jour le building
-- et on crée le user_site_role coproprietaire_bailleur si absent.
-- ============================================
CREATE OR REPLACE FUNCTION public.apply_building_site_link()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_owner_profile_id UUID;
  v_owner_user_id UUID;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    -- Met à jour le building
    UPDATE public.buildings
    SET
      site_id = NEW.site_id,
      site_link_status = 'linked',
      site_linked_at = NOW(),
      owner_syndic_mode = 'managed_external',
      updated_at = NOW()
    WHERE id = NEW.building_id;

    -- Crée le rôle copropriétaire si absent
    SELECT b.owner_id INTO v_owner_profile_id
    FROM public.buildings b WHERE b.id = NEW.building_id;

    SELECT user_id INTO v_owner_user_id
    FROM public.profiles WHERE id = v_owner_profile_id;

    IF v_owner_user_id IS NOT NULL THEN
      INSERT INTO public.user_site_roles (user_id, site_id, role_code)
      VALUES (v_owner_user_id, NEW.site_id, 'coproprietaire_bailleur')
      ON CONFLICT DO NOTHING;
    END IF;

  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.buildings
    SET
      site_link_status = 'rejected',
      updated_at = NOW()
    WHERE id = NEW.building_id;

  ELSIF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    UPDATE public.buildings
    SET
      site_link_status = 'unlinked',
      updated_at = NOW()
    WHERE id = NEW.building_id AND site_link_status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_building_site_link ON public.building_site_links;
CREATE TRIGGER trg_apply_building_site_link
  AFTER UPDATE ON public.building_site_links
  FOR EACH ROW EXECUTE FUNCTION public.apply_building_site_link();

-- Trigger INSERT : si le claim est immédiatement approved (cas owner=syndic), apply
CREATE OR REPLACE FUNCTION public.apply_building_site_link_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_owner_profile_id UUID;
  v_owner_user_id UUID;
BEGIN
  IF NEW.status = 'pending' THEN
    UPDATE public.buildings
    SET site_link_status = 'pending', updated_at = NOW()
    WHERE id = NEW.building_id AND site_link_status IN ('unlinked', 'rejected');
  ELSIF NEW.status = 'approved' THEN
    UPDATE public.buildings
    SET
      site_id = NEW.site_id,
      site_link_status = 'linked',
      site_linked_at = NOW(),
      owner_syndic_mode = 'managed_external',
      updated_at = NOW()
    WHERE id = NEW.building_id;

    SELECT b.owner_id INTO v_owner_profile_id
    FROM public.buildings b WHERE b.id = NEW.building_id;

    SELECT user_id INTO v_owner_user_id
    FROM public.profiles WHERE id = v_owner_profile_id;

    IF v_owner_user_id IS NOT NULL THEN
      INSERT INTO public.user_site_roles (user_id, site_id, role_code)
      VALUES (v_owner_user_id, NEW.site_id, 'coproprietaire_bailleur')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_building_site_link_insert ON public.building_site_links;
CREATE TRIGGER trg_apply_building_site_link_insert
  AFTER INSERT ON public.building_site_links
  FOR EACH ROW EXECUTE FUNCTION public.apply_building_site_link_on_insert();
