-- ============================================
-- Fix : optimisation des RLS policies de building_site_links
-- ============================================
-- Audit P2 (post-incident syndic du 2026-05-03) : les policies
-- introduites dans 20260429120300_owner_syndic_bridge.sql utilisaient
-- des sous-requêtes directes vers profiles/sites/buildings, ce qui :
--   1. Génère plusieurs scans pour chaque ligne évaluée par RLS
--   2. Risque de cycles RLS (cf. fix 20260426 sur sites <-> user_site_roles)
--   3. Empêche le query planner de cacher les résultats
--
-- On refactore en utilisant les helpers SECURITY DEFINER existants :
--   - public.user_profile_id()                  (migration 202502180003)
--   - public.current_user_syndic_site_ids()     (migration 20260426170000)
--
-- Comportement strictement équivalent — c'est uniquement une optimisation.
-- ============================================

BEGIN;

-- SELECT : owner voit ses demandes
DROP POLICY IF EXISTS "building_site_links_owner_select" ON public.building_site_links;
CREATE POLICY "building_site_links_owner_select" ON public.building_site_links
  FOR SELECT TO authenticated
  USING (
    claimed_by_profile_id = public.user_profile_id()
    OR building_id IN (
      SELECT b.id FROM public.buildings b
      WHERE b.owner_id = public.user_profile_id()
    )
  );

-- SELECT : syndic du site voit les demandes
DROP POLICY IF EXISTS "building_site_links_syndic_select" ON public.building_site_links;
CREATE POLICY "building_site_links_syndic_select" ON public.building_site_links
  FOR SELECT TO authenticated
  USING (
    site_id IN (SELECT public.current_user_syndic_site_ids())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = public.user_profile_id()
        AND p.role IN ('admin', 'platform_admin')
    )
  );

-- INSERT : owner soumet
DROP POLICY IF EXISTS "building_site_links_owner_insert" ON public.building_site_links;
CREATE POLICY "building_site_links_owner_insert" ON public.building_site_links
  FOR INSERT TO authenticated
  WITH CHECK (
    claimed_by_profile_id = public.user_profile_id()
    AND building_id IN (
      SELECT b.id FROM public.buildings b
      WHERE b.owner_id = public.user_profile_id()
    )
  );

-- UPDATE : owner cancel ou syndic decide
DROP POLICY IF EXISTS "building_site_links_update" ON public.building_site_links;
CREATE POLICY "building_site_links_update" ON public.building_site_links
  FOR UPDATE TO authenticated
  USING (
    claimed_by_profile_id = public.user_profile_id()
    OR site_id IN (SELECT public.current_user_syndic_site_ids())
  );

COMMIT;
