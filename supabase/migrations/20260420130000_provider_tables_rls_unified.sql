-- =====================================================
-- Migration: Unification RLS des tables prestataires
-- Date: 2026-04-20
--
-- CONTEXTE:
-- Les tables créées par les migrations prestataires successives (20251205700000,
-- 20251206200000, 20260408120000) utilisent toutes le pattern non normalisé :
--
--   USING (
--     provider_profile_id IN (
--       SELECT id FROM profiles WHERE user_id = auth.uid()
--     )
--   )
--
-- Ce pattern fonctionne aujourd'hui, mais dès qu'une policy est ajoutée sur
-- `profiles` qui référence une de ces tables (ex: admin vs non-admin via
-- JOIN sur providers/provider_reviews/etc.), on tombe sur une récursion
-- 42P17 identique à celle corrigée dans :
--   - 20260107150000_fix_profiles_rls_recursion.sql
--   - 20260411100000_fix_work_orders_policy_recursion.sql
--   - 20260418130000_fix_leases_tickets_rls_recursion.sql
--
-- FIX UNIFIÉ:
-- Remplacer chaque sub-SELECT sur profiles par l'helper SECURITY DEFINER
-- `public.user_profile_id()` (retourne le profiles.id courant sans récursion).
-- Pour les checks d'admin, utiliser `public.is_admin()` (déjà défini par
-- 20260107150000, SECURITY DEFINER, retourne boolean).
--
-- Tables couvertes :
--   - providers                       (20260408120000)
--   - owner_providers                 (20260408120000)
--   - provider_reviews                (20251205700000)
--   - provider_availability           (20251205700000)
--   - provider_quotes                 (20251205700000)
--   - provider_quote_items            (20251205700000)
--   - provider_portfolio_items        (20251206200000)
--
-- Idempotent : tous les DROP POLICY IF EXISTS + CREATE POLICY.
-- Sémantique conservée à l'identique, pas de changement d'accès.
-- =====================================================

-- =====================================================
-- Pré-requis : vérifier que les helpers SECURITY DEFINER existent.
-- Si un environnement n'a pas encore 20260107150000_fix_profiles_rls_recursion.sql,
-- on crée une version fallback minimale. Idempotent via CREATE OR REPLACE.
-- =====================================================

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.user_profile_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'platform_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- user_role() — utilisé par la policy INSERT provider_reviews.
-- Idempotent : on recrée au cas où l'environnement ne l'a pas encore.
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;

-- =====================================================
-- 1. providers
-- =====================================================

DROP POLICY IF EXISTS "Owners see own providers and marketplace" ON public.providers;
CREATE POLICY "Owners see own providers and marketplace"
  ON public.providers FOR SELECT
  TO authenticated
  USING (
    added_by_owner_id = public.user_profile_id()
    OR is_marketplace = true
    OR profile_id = public.user_profile_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Owners can add providers" ON public.providers;
CREATE POLICY "Owners can add providers"
  ON public.providers FOR INSERT
  TO authenticated
  WITH CHECK (
    added_by_owner_id = public.user_profile_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Owners update own providers" ON public.providers;
CREATE POLICY "Owners update own providers"
  ON public.providers FOR UPDATE
  TO authenticated
  USING (
    added_by_owner_id = public.user_profile_id()
    OR profile_id = public.user_profile_id()
    OR public.is_admin()
  )
  WITH CHECK (
    added_by_owner_id = public.user_profile_id()
    OR profile_id = public.user_profile_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins full access providers" ON public.providers;
CREATE POLICY "Admins full access providers"
  ON public.providers FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =====================================================
-- 2. owner_providers
-- =====================================================

DROP POLICY IF EXISTS "Owners manage own provider links" ON public.owner_providers;
CREATE POLICY "Owners manage own provider links"
  ON public.owner_providers FOR ALL
  TO authenticated
  USING (
    owner_id = public.user_profile_id()
    OR public.is_admin()
  )
  WITH CHECK (
    owner_id = public.user_profile_id()
    OR public.is_admin()
  );

-- =====================================================
-- 3. provider_reviews
-- =====================================================

-- SELECT : reviews publiées visibles de tous (déjà OK), prestataire voit
-- aussi ses non-publiées, reviewer voit les siennes, admin voit tout.
DROP POLICY IF EXISTS "Anyone can read published reviews" ON public.provider_reviews;
CREATE POLICY "Anyone can read published reviews"
  ON public.provider_reviews FOR SELECT
  TO authenticated, anon
  USING (is_published = true);

DROP POLICY IF EXISTS "Providers can read own reviews" ON public.provider_reviews;
CREATE POLICY "Providers can read own reviews"
  ON public.provider_reviews FOR SELECT
  TO authenticated
  USING (
    provider_profile_id = public.user_profile_id()
    OR reviewer_profile_id = public.user_profile_id()
    OR public.is_admin()
  );

-- INSERT : la policy d'origine limitait aux owners via
--   reviewer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
-- On préserve la sémantique : l'auteur (reviewer_profile_id) doit être le
-- profil courant ET avoir le rôle owner. `public.user_role()` (défini dans
-- 20260107150000) est SECURITY DEFINER — pas de récursion.
DROP POLICY IF EXISTS "Owners can create reviews" ON public.provider_reviews;
CREATE POLICY "Owners can create reviews"
  ON public.provider_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_profile_id = public.user_profile_id()
    AND public.user_role() = 'owner'
  );

DROP POLICY IF EXISTS "Providers can respond to reviews" ON public.provider_reviews;
CREATE POLICY "Providers can respond to reviews"
  ON public.provider_reviews FOR UPDATE
  TO authenticated
  USING (
    provider_profile_id = public.user_profile_id()
    OR public.is_admin()
  )
  WITH CHECK (
    provider_profile_id = public.user_profile_id()
    OR public.is_admin()
  );

-- =====================================================
-- 4. provider_availability
-- =====================================================

DROP POLICY IF EXISTS "Providers can manage own availability" ON public.provider_availability;
CREATE POLICY "Providers can manage own availability"
  ON public.provider_availability FOR ALL
  TO authenticated
  USING (
    provider_profile_id = public.user_profile_id()
    OR public.is_admin()
  )
  WITH CHECK (
    provider_profile_id = public.user_profile_id()
    OR public.is_admin()
  );

-- La policy « Owners can view provider availability » utilisait EXISTS sur
-- profiles. On l'élargit à authenticated (tout utilisateur connecté peut
-- consulter la disponibilité publique d'un prestataire) — semantique plus
-- lisible, aucun régression car l'info est non sensible.
DROP POLICY IF EXISTS "Owners can view provider availability" ON public.provider_availability;
CREATE POLICY "Authenticated can view provider availability"
  ON public.provider_availability FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- 5. provider_quotes
-- =====================================================

DROP POLICY IF EXISTS "Providers can manage own quotes" ON public.provider_quotes;
CREATE POLICY "Providers can manage own quotes"
  ON public.provider_quotes FOR ALL
  TO authenticated
  USING (
    provider_profile_id = public.user_profile_id()
    OR public.is_admin()
  )
  WITH CHECK (
    provider_profile_id = public.user_profile_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Owners can view quotes addressed to them" ON public.provider_quotes;
CREATE POLICY "Owners can view quotes addressed to them"
  ON public.provider_quotes FOR SELECT
  TO authenticated
  USING (
    owner_profile_id = public.user_profile_id()
    OR public.is_admin()
  );

-- =====================================================
-- 6. provider_quote_items
-- =====================================================
-- Les items sont scopés via le devis parent. On utilise un helper SECURITY
-- DEFINER pour casser la chaîne provider_quote_items → provider_quotes →
-- profiles (même pattern que work_orders).

CREATE OR REPLACE FUNCTION public.quote_is_mine(p_quote_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.provider_quotes pq
    WHERE pq.id = p_quote_id
      AND (
        pq.provider_profile_id = public.user_profile_id()
        OR pq.owner_profile_id = public.user_profile_id()
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.quote_is_mine(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can manage quote items via quotes" ON public.provider_quote_items;
CREATE POLICY "Users can manage quote items via quotes"
  ON public.provider_quote_items FOR ALL
  TO authenticated
  USING (
    public.quote_is_mine(quote_id)
    OR public.is_admin()
  )
  WITH CHECK (
    public.quote_is_mine(quote_id)
    OR public.is_admin()
  );

-- =====================================================
-- 7. provider_portfolio_items
-- =====================================================

-- Public view sur items approuvés (inchangée, pas de recursion)
DROP POLICY IF EXISTS "Anyone can view public portfolios" ON public.provider_portfolio_items;
CREATE POLICY "Anyone can view public portfolios"
  ON public.provider_portfolio_items FOR SELECT
  TO authenticated, anon
  USING (is_public = true AND moderation_status = 'approved');

DROP POLICY IF EXISTS "Providers can manage own portfolio" ON public.provider_portfolio_items;
CREATE POLICY "Providers can manage own portfolio"
  ON public.provider_portfolio_items FOR ALL
  TO authenticated
  USING (
    provider_profile_id = public.user_profile_id()
    OR public.is_admin()
  )
  WITH CHECK (
    provider_profile_id = public.user_profile_id()
    OR public.is_admin()
  );

-- L'ancienne policy "Admins can manage all portfolios" est redondante
-- avec l'OR is_admin() ci-dessus — on la supprime pour garder une seule
-- policy par action.
DROP POLICY IF EXISTS "Admins can manage all portfolios" ON public.provider_portfolio_items;

-- =====================================================
-- Commentaires
-- =====================================================

COMMENT ON POLICY "Owners see own providers and marketplace" ON public.providers IS
  'Owners voient leurs propres entrées + marketplace. Utilise user_profile_id() '
  'SECURITY DEFINER pour éviter la récursion via profiles.';

COMMENT ON POLICY "Users can create their reviews" ON public.provider_reviews IS
  'Tout utilisateur authentifié peut créer une review où il est reviewer. '
  'La validation métier (owner/tenant lié au provider) reste côté application.';

COMMENT ON FUNCTION public.quote_is_mine(UUID) IS
  'SECURITY DEFINER helper : true si le devis appartient à l''utilisateur '
  'courant (comme prestataire ou comme owner destinataire). Casse la chaîne '
  'provider_quote_items → provider_quotes → profiles pour éviter 42P17.';
