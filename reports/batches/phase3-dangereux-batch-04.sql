-- ====================================================================
-- Sprint B2 — Phase 3 DANGEREUX — Batch 4/11
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260309000001_messages_update_rls.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : own
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260309000001_messages_update_rls.sql'; END $pre$;

-- Migration: Allow users to update their own messages (edit + soft-delete)
-- Needed for message edit/delete feature

-- Policy for UPDATE: users can only update their own messages in their conversations
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (
    sender_profile_id = public.user_profile_id()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_profile_id = public.user_profile_id() OR c.tenant_profile_id = public.user_profile_id())
    )
  )
  WITH CHECK (
    sender_profile_id = public.user_profile_id()
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260309000001', 'messages_update_rls')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260309000001_messages_update_rls.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260310100000_fix_property_limit_enforcement.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : or,deleted_at
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260310100000_fix_property_limit_enforcement.sql'; END $pre$;

-- =====================================================
-- Migration: Fix Property Limit Enforcement & Counter Sync
--
-- Problème: Les compteurs properties_count/leases_count dans
-- la table subscriptions se désynchronisent car :
-- 1. Le trigger enforce_property_limit() lit le compteur caché
--    au lieu de faire un vrai COUNT
-- 2. Le trigger update_subscription_properties_count() ne gère
--    pas les soft-deletes (UPDATE de deleted_at)
-- 3. Les compteurs existants sont potentiellement faux
--
-- Fix:
-- - enforce_property_limit() utilise un vrai COUNT(*)
-- - enforce_lease_limit() utilise un vrai COUNT(*) avec deleted_at IS NULL
-- - update_subscription_properties_count() gère les soft-deletes via recount
-- - Recalcul des compteurs pour TOUS les comptes
-- =====================================================

-- =====================================================
-- 1. Fix enforce_property_limit() : utiliser un vrai COUNT
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
BEGIN
  -- Compter les propriétés actives (non soft-deleted) avec un vrai COUNT
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL;

  -- Récupérer la limite du plan
  SELECT
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. Fix enforce_lease_limit() : COUNT live + deleted_at IS NULL
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

  -- Compter les baux actifs sur les propriétés non soft-deleted
  SELECT COUNT(*) INTO current_count
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE p.owner_id = property_owner_id
    AND p.deleted_at IS NULL
    AND l.statut IN ('active', 'pending_signature');

  -- Récupérer la limite du plan
  SELECT
    COALESCE(sp.max_leases, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = property_owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bail(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour créer plus de baux.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. Fix update_subscription_properties_count() : gérer soft-deletes
--    Utilise un recount complet (self-healing) au lieu de inc/dec
-- =====================================================
CREATE OR REPLACE FUNCTION update_subscription_properties_count()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_owner_id := OLD.owner_id;
  ELSE
    v_owner_id := NEW.owner_id;
  END IF;

  -- Recalculer le compteur à partir de l'état réel de la table
  UPDATE subscriptions
  SET properties_count = (
    SELECT COUNT(*)
    FROM properties
    WHERE owner_id = v_owner_id
      AND deleted_at IS NULL
  ),
  updated_at = NOW()
  WHERE owner_id = v_owner_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour le trigger pour écouter aussi les UPDATE (soft-delete/restore)
DROP TRIGGER IF EXISTS trg_update_subscription_properties ON properties;
CREATE TRIGGER trg_update_subscription_properties
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_subscription_properties_count();

-- =====================================================
-- 4. Recalculer properties_count pour TOUS les comptes
-- =====================================================
UPDATE subscriptions s
SET
  properties_count = COALESCE(pc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(p.id) as cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  GROUP BY s2.owner_id
) pc
WHERE s.owner_id = pc.owner_id;

-- =====================================================
-- 5. Recalculer leases_count pour TOUS les comptes
-- =====================================================
UPDATE subscriptions s
SET
  leases_count = COALESCE(lc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(l.id) as cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  LEFT JOIN leases l ON l.property_id = p.id AND l.statut IN ('active', 'pending_signature')
  GROUP BY s2.owner_id
) lc
WHERE s.owner_id = lc.owner_id;

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON FUNCTION enforce_property_limit() IS 'Vérifie la limite de biens via COUNT réel (pas le compteur caché). Gère correctement les soft-deletes.';
COMMENT ON FUNCTION enforce_lease_limit() IS 'Vérifie la limite de baux via COUNT réel. Exclut les propriétés soft-deleted.';
COMMENT ON FUNCTION update_subscription_properties_count() IS 'Met à jour le compteur properties_count via recount complet sur INSERT, DELETE et soft-delete (UPDATE deleted_at).';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260310100000', 'fix_property_limit_enforcement')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260310100000_fix_property_limit_enforcement.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260311100000_sync_subscription_plan_slugs.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260311100000_sync_subscription_plan_slugs.sql'; END $pre$;

-- =====================================================
-- Migration: Synchroniser plan_slug depuis plan_id
--
-- Problème: Certaines subscriptions ont plan_slug NULL
-- car la colonne a été ajoutée après la création de la subscription.
-- Cela cause un fallback vers le plan "gratuit" côté frontend,
-- bloquant les utilisateurs sur les forfaits payants (starter, etc.)
--
-- Fix:
-- 1. Synchroniser plan_slug depuis plan_id pour toutes les rows NULL
-- 2. Créer un trigger pour auto-sync à chaque changement de plan_id
-- =====================================================

-- 1. Synchroniser les plan_slug manquants
UPDATE subscriptions s
SET plan_slug = sp.slug, updated_at = NOW()
FROM subscription_plans sp
WHERE sp.id = s.plan_id
  AND s.plan_slug IS NULL;

-- 2. Trigger auto-sync plan_slug quand plan_id change
CREATE OR REPLACE FUNCTION sync_subscription_plan_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Si plan_id change ou plan_slug est NULL, synchroniser depuis subscription_plans
  IF NEW.plan_id IS NOT NULL AND (
    NEW.plan_slug IS NULL
    OR TG_OP = 'INSERT'
    OR OLD.plan_id IS DISTINCT FROM NEW.plan_id
  ) THEN
    SELECT slug INTO NEW.plan_slug
    FROM subscription_plans
    WHERE id = NEW.plan_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_subscription_plan_slug ON subscriptions;
CREATE TRIGGER trg_sync_subscription_plan_slug
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_subscription_plan_slug();

COMMENT ON FUNCTION sync_subscription_plan_slug() IS
  'Auto-synchronise plan_slug depuis plan_id pour éviter les fallbacks vers gratuit.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260311100000', 'sync_subscription_plan_slugs')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260311100000_sync_subscription_plan_slugs.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260312000001_fix_owner_subscription_defaults.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : of
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260312000001_fix_owner_subscription_defaults.sql'; END $pre$;

-- =====================================================
-- Migration: Fix Owner Subscription Defaults & Data Repair
--
-- Problemes corriges:
-- 1. create_owner_subscription() assigne "starter" au lieu de "gratuit"
-- 2. plan_slug non defini explicitement dans le trigger
-- 3. Periode d'essai incorrecte pour le plan gratuit
-- 4. properties_count desynchronise pour les comptes existants
-- 5. Owners orphelins sans subscription
--
-- Flux corrige:
-- - Nouveau owner → subscription "gratuit" (status=active, pas de trial)
-- - L'utilisateur choisit son forfait ensuite via /signup/plan
-- - Si forfait payant → Stripe Checkout met a jour la subscription
-- - Si gratuit → POST /api/subscriptions/select-plan confirme le choix
-- =====================================================

-- =====================================================
-- 1. Corriger le trigger create_owner_subscription()
--    Plan par defaut = gratuit, plan_slug defini, pas de trial
-- =====================================================

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
  v_prop_count INTEGER;
  v_lease_count INTEGER;
BEGIN
  -- Seulement pour les proprietaires
  IF NEW.role = 'owner' THEN
    -- Recuperer l'ID du plan gratuit
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = 'gratuit'
    LIMIT 1;

    -- Compter les proprietes existantes (cas rare mais possible via admin)
    SELECT COUNT(*) INTO v_prop_count
    FROM properties
    WHERE owner_id = NEW.id
      AND deleted_at IS NULL;

    -- Compter les baux actifs
    SELECT COUNT(*) INTO v_lease_count
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    WHERE p.owner_id = NEW.id
      AND p.deleted_at IS NULL
      AND l.statut IN ('active', 'pending_signature');

    -- Creer l'abonnement gratuit si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id,
        plan_id,
        plan_slug,
        status,
        billing_cycle,
        current_period_start,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'gratuit',         -- Plan gratuit par defaut
        'active',          -- Actif immediatement (pas de trial pour le gratuit)
        'monthly',
        NOW(),
        COALESCE(v_prop_count, 0),
        COALESCE(v_lease_count, 0)
      )
      ON CONFLICT (owner_id) DO NOTHING;

      RAISE NOTICE 'Abonnement Gratuit cree pour le proprietaire %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreer le trigger
DROP TRIGGER IF EXISTS trg_create_owner_subscription ON profiles;
CREATE TRIGGER trg_create_owner_subscription
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'owner')
  EXECUTE FUNCTION create_owner_subscription();

COMMENT ON FUNCTION create_owner_subscription() IS
  'Cree automatiquement un abonnement Gratuit pour les nouveaux proprietaires. Le forfait reel sera choisi ensuite via /signup/plan.';

-- =====================================================
-- 2. Recalculer properties_count pour TOUS les comptes
-- =====================================================

UPDATE subscriptions s
SET
  properties_count = COALESCE(pc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(p.id) AS cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  GROUP BY s2.owner_id
) pc
WHERE s.owner_id = pc.owner_id;

-- =====================================================
-- 3. Recalculer leases_count pour TOUS les comptes
-- =====================================================

UPDATE subscriptions s
SET
  leases_count = COALESCE(lc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(l.id) AS cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  LEFT JOIN leases l ON l.property_id = p.id AND l.statut IN ('active', 'pending_signature')
  GROUP BY s2.owner_id
) lc
WHERE s.owner_id = lc.owner_id;

-- =====================================================
-- 4. Synchroniser plan_slug NULL depuis plan_id
-- =====================================================

UPDATE subscriptions s
SET
  plan_slug = sp.slug,
  updated_at = NOW()
FROM subscription_plans sp
WHERE sp.id = s.plan_id
  AND (s.plan_slug IS NULL OR s.plan_slug = '');

-- =====================================================
-- 5. Creer subscriptions manquantes pour owners orphelins
--    (plan gratuit, status active)
-- =====================================================

DO $$
DECLARE
  v_gratuit_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_gratuit_id FROM subscription_plans WHERE slug = 'gratuit' LIMIT 1;

  IF v_gratuit_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      owner_id, plan_id, plan_slug, status, billing_cycle,
      current_period_start, properties_count, leases_count
    )
    SELECT
      p.id,
      v_gratuit_id,
      'gratuit',
      'active',
      'monthly',
      NOW(),
      COALESCE((SELECT COUNT(*) FROM properties pr WHERE pr.owner_id = p.id AND pr.deleted_at IS NULL), 0),
      0
    FROM profiles p
    WHERE p.role = 'owner'
      AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.owner_id = p.id)
    ON CONFLICT (owner_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) Gratuit cree(s) pour proprietaires orphelins', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON FUNCTION create_owner_subscription() IS
  'Cree un abonnement Gratuit (plan_slug=gratuit, status=active) pour chaque nouveau proprietaire. Les compteurs sont initialises a partir de l''etat reel de la base.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260312000001', 'fix_owner_subscription_defaults')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260312000001_fix_owner_subscription_defaults.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260318020000_buildings_rls_sota2026.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : their,their,to
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260318020000_buildings_rls_sota2026.sql'; END $pre$;

-- ============================================
-- Migration : RLS SOTA 2026 pour buildings & building_units
-- Remplace auth.uid() par user_profile_id() / user_role()
-- Ajoute policies admin et tenant
-- ============================================

-- 1. DROP anciennes policies buildings
-- ============================================
DROP POLICY IF EXISTS "Owners can view their buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can create buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can update their buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can delete their buildings" ON buildings;

-- 2. DROP anciennes policies building_units
-- ============================================
DROP POLICY IF EXISTS "Owners can view their building units" ON building_units;
DROP POLICY IF EXISTS "Owners can create building units" ON building_units;
DROP POLICY IF EXISTS "Owners can update their building units" ON building_units;
DROP POLICY IF EXISTS "Owners can delete their building units" ON building_units;

-- 3. Nouvelles policies buildings (owner)
-- ============================================
DROP POLICY IF EXISTS "buildings_owner_select" ON buildings;
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (owner_id = public.user_profile_id());

DROP POLICY IF EXISTS "buildings_owner_insert" ON buildings;
CREATE POLICY "buildings_owner_insert" ON buildings
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.user_profile_id());

DROP POLICY IF EXISTS "buildings_owner_update" ON buildings;
CREATE POLICY "buildings_owner_update" ON buildings
  FOR UPDATE TO authenticated
  USING (owner_id = public.user_profile_id());

DROP POLICY IF EXISTS "buildings_owner_delete" ON buildings;
CREATE POLICY "buildings_owner_delete" ON buildings
  FOR DELETE TO authenticated
  USING (owner_id = public.user_profile_id());

-- 4. Policies buildings (admin)
-- ============================================
DROP POLICY IF EXISTS "buildings_admin_all" ON buildings;
CREATE POLICY "buildings_admin_all" ON buildings
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');

-- 5. Policies buildings (tenant via bail actif)
-- ============================================
DROP POLICY IF EXISTS "buildings_tenant_select" ON buildings;
CREATE POLICY "buildings_tenant_select" ON buildings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM building_units bu
      JOIN leases l ON l.id = bu.current_lease_id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE bu.building_id = buildings.id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut = 'active'
    )
  );

-- 6. Nouvelles policies building_units (owner)
-- ============================================
DROP POLICY IF EXISTS "building_units_owner_select" ON building_units;
CREATE POLICY "building_units_owner_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "building_units_owner_insert" ON building_units;
CREATE POLICY "building_units_owner_insert" ON building_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "building_units_owner_update" ON building_units;
CREATE POLICY "building_units_owner_update" ON building_units
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "building_units_owner_delete" ON building_units;
CREATE POLICY "building_units_owner_delete" ON building_units
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

-- 7. Policies building_units (admin)
-- ============================================
DROP POLICY IF EXISTS "building_units_admin_all" ON building_units;
CREATE POLICY "building_units_admin_all" ON building_units
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');

-- 8. Policies building_units (tenant via bail actif)
-- ============================================
DROP POLICY IF EXISTS "building_units_tenant_select" ON building_units;
CREATE POLICY "building_units_tenant_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.id = building_units.current_lease_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut = 'active'
    )
  );

-- 9. Ajout property_id sur building_units si manquant
-- ============================================
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_building_units_property ON building_units(property_id);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260318020000', 'buildings_rls_sota2026')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260318020000_buildings_rls_sota2026.sql'; END $post$;

COMMIT;

-- END OF BATCH 4/11 (Phase 3 DANGEREUX)
