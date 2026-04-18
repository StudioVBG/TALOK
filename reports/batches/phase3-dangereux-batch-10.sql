-- ====================================================================
-- Sprint B2 — Phase 3 DANGEREUX — Batch 10/11
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
-- Migration: 20260411130200_create_syndic_profiles.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260411130200_create_syndic_profiles.sql'; END $pre$;

-- ============================================
-- Migration: Créer table syndic_profiles
-- Date: 2026-04-11
-- Contexte:
--   Le rôle syndic utilisait jusqu'ici `profiles` seul, sans table dédiée
--   pour les champs réglementaires (carte professionnelle, garantie
--   financière, assurance RCP, SIRET, raison sociale).
--
--   Cette migration crée la table minimale pour supporter :
--     - L'inscription syndic via /api/v1/auth/register
--     - L'onboarding /syndic/onboarding/profile
--     - Les obligations légales loi Hoguet pour les syndics professionnels
-- ============================================

CREATE TABLE IF NOT EXISTS public.syndic_profiles (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Identité cabinet
  raison_sociale TEXT,
  forme_juridique TEXT CHECK (
    forme_juridique IS NULL OR
    forme_juridique IN ('SARL', 'SAS', 'SASU', 'SCI', 'EURL', 'EI', 'SA', 'association', 'benevole', 'autre')
  ),
  siret TEXT,

  -- Type de syndic
  type_syndic TEXT NOT NULL DEFAULT 'professionnel' CHECK (
    type_syndic IN ('professionnel', 'benevole', 'cooperatif')
  ),

  -- Carte professionnelle (obligatoire pour les syndics professionnels — loi Hoguet)
  numero_carte_pro TEXT,
  carte_pro_delivree_par TEXT,
  carte_pro_validite DATE,

  -- Garantie financière (obligatoire pour les syndics professionnels)
  garantie_financiere_montant DECIMAL(12, 2),
  garantie_financiere_organisme TEXT,

  -- Assurance RCP (obligatoire)
  assurance_rcp TEXT,
  assurance_rcp_organisme TEXT,

  -- Coordonnées
  adresse_siege TEXT,
  code_postal TEXT,
  ville TEXT,
  telephone TEXT,
  email_contact TEXT,
  website TEXT,
  logo_url TEXT,

  -- Activités
  nombre_coproprietes_gerees INTEGER DEFAULT 0,
  zones_intervention TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_syndic_profiles_siret ON public.syndic_profiles(siret);
CREATE INDEX IF NOT EXISTS idx_syndic_profiles_carte_pro ON public.syndic_profiles(numero_carte_pro);

COMMENT ON TABLE public.syndic_profiles IS
'Profils des syndics de copropriété (professionnels, bénévoles, coopératifs).
Stocke les champs réglementaires loi Hoguet (carte pro, garantie financière, RCP).';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.syndic_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndic_profiles_select_own" ON public.syndic_profiles;
CREATE POLICY "syndic_profiles_select_own" ON public.syndic_profiles
  FOR SELECT TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "syndic_profiles_insert_own" ON public.syndic_profiles;
CREATE POLICY "syndic_profiles_insert_own" ON public.syndic_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "syndic_profiles_update_own" ON public.syndic_profiles;
CREATE POLICY "syndic_profiles_update_own" ON public.syndic_profiles
  FOR UPDATE TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Trigger updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_syndic_profiles_updated_at ON public.syndic_profiles;
CREATE TRIGGER update_syndic_profiles_updated_at
  BEFORE UPDATE ON public.syndic_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Grants
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syndic_profiles TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260411130200', 'create_syndic_profiles')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260411130200_create_syndic_profiles.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260415140000_buildings_sota_fix_wave1.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on,to
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260415140000_buildings_sota_fix_wave1.sql'; END $pre$;

-- ============================================================================
-- Migration : Buildings SOTA Fix — Vague 1 (Sécurité & intégrité)
--
-- Consolide les items P0 de l'audit building-module :
--   #22 — DROP policies "Service role full access" (dangereuses)
--   #7  — ADD COLUMN ownership_type + total_lots_in_building
--   #9  — ADD COLUMN deleted_at (buildings + building_units)
--   #11 — Étendre le trigger sync lease → building_unit.status à INSERT
--         + backfill des building_units déjà liés à des baux actifs
--   #21 — UNIQUE INDEX partiel sur building_units.property_id
--   #8  — Helper SQL `building_has_active_leases(building_id)` réutilisé
--         par la RPC transactionnelle de la Phase 2
--
-- La vue `building_stats` est aussi étendue pour exposer ownership_type /
-- total_lots_in_building et filtrer les soft-deleted.
-- ============================================================================

-- ============================================================================
-- 1. [#22] Supprimer les policies "Service role full access" sur buildings
--    et building_units (court-circuit RLS dangereux en production).
--    Les API routes utilisent déjà createServiceRoleClient() qui bypass RLS
--    nativement via le service_role JWT — aucune policy n'est nécessaire.
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access buildings" ON buildings;
DROP POLICY IF EXISTS "Service role full access building_units" ON building_units;

-- ============================================================================
-- 2. [#7] ownership_type + total_lots_in_building sur buildings
--    full    = le propriétaire possède tous les lots physiques
--    partial = copropriété (quelques lots dans un immeuble plus grand)
--    total_lots_in_building n'a de sens que si ownership_type = 'partial'
-- ============================================================================
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'full'
    CHECK (ownership_type IN ('full', 'partial'));

ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS total_lots_in_building INTEGER
    CHECK (total_lots_in_building IS NULL OR total_lots_in_building > 0);

-- Cohérence : si full → total_lots_in_building doit être NULL
-- (un immeuble "full" ne dépend pas d'un nombre de lots extérieurs).
-- On ne pose pas de contrainte stricte NULL=full pour ne pas bloquer les
-- backfills futurs — les API/UI doivent enforce. Un commentaire documente.
COMMENT ON COLUMN buildings.ownership_type IS
  'full = immeuble entier possédé, partial = quelques lots dans une copropriété';
COMMENT ON COLUMN buildings.total_lots_in_building IS
  'Nombre total de lots dans l''immeuble physique (renseigné uniquement si ownership_type = partial)';

-- ============================================================================
-- 3. [#9] Soft-delete sur buildings ET building_units
--    La route DELETE /api/buildings/[id] tentait déjà `SET deleted_at = NOW()`
--    mais la colonne n'existait pas → fallback hard-delete silencieux.
-- ============================================================================
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE building_units
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index partiels : la majorité des records ont deleted_at = NULL.
-- Un index partiel est bien plus efficace qu'un index plein.
CREATE INDEX IF NOT EXISTS idx_buildings_active
  ON buildings (id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_building_units_active
  ON building_units (building_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN buildings.deleted_at IS
  'Soft-delete timestamp. Les records non-null sont filtrés des queries applicatives et RLS.';
COMMENT ON COLUMN building_units.deleted_at IS
  'Soft-delete timestamp. Cascade depuis buildings.deleted_at.';

-- ============================================================================
-- 4. [#21] Index UNIQUE partiel sur building_units.property_id
--    Empêche qu'un même lot-property soit lié à plusieurs building_units.
--    L'index est partiel (WHERE property_id IS NOT NULL) car les parkings /
--    caves / lots pas encore individualisés peuvent ne pas avoir de property.
--
--    Détection préalable des doublons (fail loud si incohérence existante).
-- ============================================================================
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT property_id
    FROM building_units
    WHERE property_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY property_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add UNIQUE index : % property_id(s) are linked to multiple building_units. Resolve manually before rerunning.',
      dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_building_units_property_id
  ON building_units (property_id)
  WHERE property_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- 5. [#8] Helper SQL réutilisable : compter / lister les lots d'un immeuble
--    qui ont un bail actif. Utilisé par la RPC transactionnelle de Phase 2
--    (upsert_building_with_units) et par l'API route DELETE.
--
--    Statuts considérés comme "actifs" (doivent bloquer DELETE/REPLACE) :
--      active, pending_signature, fully_signed, notice_given
--    Statuts NON bloquants : draft, cancelled, terminated, archived
-- ============================================================================
CREATE OR REPLACE FUNCTION public.building_active_lease_units(p_building_id UUID)
RETURNS TABLE (
  unit_id UUID,
  floor INTEGER,
  "position" TEXT,
  lease_id UUID,
  lease_statut TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bu.id AS unit_id,
    bu.floor,
    bu.position,
    l.id AS lease_id,
    l.statut::TEXT AS lease_statut
  FROM building_units bu
  LEFT JOIN leases l
    ON l.building_unit_id = bu.id
   AND l.statut IN ('active', 'pending_signature', 'fully_signed', 'notice_given')
  WHERE bu.building_id = p_building_id
    AND bu.deleted_at IS NULL
    AND (
      bu.current_lease_id IS NOT NULL
      OR l.id IS NOT NULL
    )
$$;

COMMENT ON FUNCTION public.building_active_lease_units(UUID) IS
  'Retourne les building_units d''un immeuble qui ont un bail bloquant (active / pending_signature / fully_signed / notice_given). Utilisé pour garder DELETE/REPLACE.';

-- ============================================================================
-- 6. [#11] Étendre le trigger sync_building_unit_status_from_lease à INSERT
--    + backfill des building_units dont le bail actif n'était pas synchronisé.
--
--    Comportement :
--      INSERT lease (statut='active', building_unit_id != NULL)
--         → UPDATE building_units.status='occupe', current_lease_id=lease.id
--      UPDATE lease.statut : draft/... → active
--         → UPDATE building_units.status='occupe', current_lease_id=lease.id
--      UPDATE lease.statut : active → terminated/archived/cancelled
--         → UPDATE building_units.status='vacant', current_lease_id=NULL
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_building_unit_status_from_lease()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT : un bail est créé directement actif avec un lot associé
  IF TG_OP = 'INSERT' THEN
    IF NEW.building_unit_id IS NOT NULL AND NEW.statut = 'active' THEN
      UPDATE building_units
         SET status = 'occupe',
             current_lease_id = NEW.id
       WHERE id = NEW.building_unit_id
         AND deleted_at IS NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE : traiter les transitions de statut
  IF TG_OP = 'UPDATE' THEN
    -- Transition vers 'active'
    IF NEW.statut = 'active'
       AND (OLD.statut IS DISTINCT FROM NEW.statut)
       AND NEW.building_unit_id IS NOT NULL THEN
      UPDATE building_units
         SET status = 'occupe',
             current_lease_id = NEW.id
       WHERE id = NEW.building_unit_id
         AND deleted_at IS NULL;
    END IF;

    -- Transition sortant de 'active' vers terminaison
    IF OLD.statut = 'active'
       AND NEW.statut IN ('terminated', 'archived', 'cancelled')
       AND NEW.building_unit_id IS NOT NULL THEN
      UPDATE building_units
         SET status = 'vacant',
             current_lease_id = NULL
       WHERE id = NEW.building_unit_id
         AND current_lease_id = NEW.id
         AND deleted_at IS NULL;
    END IF;

    -- Réassignation : le bail change de building_unit_id
    IF OLD.building_unit_id IS DISTINCT FROM NEW.building_unit_id THEN
      -- Ancien lot : libérer si c'était ce bail qui l'occupait
      IF OLD.building_unit_id IS NOT NULL THEN
        UPDATE building_units
           SET status = 'vacant',
               current_lease_id = NULL
         WHERE id = OLD.building_unit_id
           AND current_lease_id = NEW.id
           AND deleted_at IS NULL;
      END IF;
      -- Nouveau lot : occuper si bail actif
      IF NEW.building_unit_id IS NOT NULL AND NEW.statut = 'active' THEN
        UPDATE building_units
           SET status = 'occupe',
               current_lease_id = NEW.id
         WHERE id = NEW.building_unit_id
           AND deleted_at IS NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recréer le trigger pour couvrir INSERT + UPDATE
DROP TRIGGER IF EXISTS trigger_sync_unit_status_on_lease ON leases;
CREATE TRIGGER trigger_sync_unit_status_on_lease
  AFTER INSERT OR UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_building_unit_status_from_lease();

-- Backfill : synchroniser les building_units dont un bail actif existe déjà
-- mais dont le status / current_lease_id n'a pas été mis à jour.
UPDATE building_units bu
   SET status = 'occupe',
       current_lease_id = l.id
  FROM leases l
 WHERE l.building_unit_id = bu.id
   AND l.statut = 'active'
   AND bu.deleted_at IS NULL
   AND (bu.status IS DISTINCT FROM 'occupe' OR bu.current_lease_id IS DISTINCT FROM l.id);

-- Backfill inverse : libérer les building_units dont le bail n'est plus actif
UPDATE building_units bu
   SET status = 'vacant',
       current_lease_id = NULL
  FROM leases l
 WHERE bu.current_lease_id = l.id
   AND l.statut IN ('terminated', 'archived', 'cancelled')
   AND bu.deleted_at IS NULL;

-- ============================================================================
-- 7. Étendre les RLS policies pour filtrer les soft-deleted
--    Les policies owner_* existantes (migration 20260318020000) sont
--    reconstruites pour inclure `AND deleted_at IS NULL`.
--    Les admin_all et tenant_select laissent voir le soft-deleted (audit).
-- ============================================================================

-- buildings : recréer les policies owner avec filtre deleted_at
DROP POLICY IF EXISTS "buildings_owner_select" ON buildings;
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (
    owner_id = public.user_profile_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "buildings_owner_update" ON buildings;
CREATE POLICY "buildings_owner_update" ON buildings
  FOR UPDATE TO authenticated
  USING (
    owner_id = public.user_profile_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "buildings_owner_delete" ON buildings;
CREATE POLICY "buildings_owner_delete" ON buildings
  FOR DELETE TO authenticated
  USING (
    owner_id = public.user_profile_id()
    AND deleted_at IS NULL
  );
-- INSERT policy inchangée (un nouveau record a forcément deleted_at = NULL).

-- building_units : filtrer via le building parent non-soft-deleted
DROP POLICY IF EXISTS "building_units_owner_select" ON building_units;
CREATE POLICY "building_units_owner_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "building_units_owner_update" ON building_units;
CREATE POLICY "building_units_owner_update" ON building_units
  FOR UPDATE TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "building_units_owner_delete" ON building_units;
CREATE POLICY "building_units_owner_delete" ON building_units
  FOR DELETE TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

-- INSERT policy : idem, filtrer via building non-soft-deleted
DROP POLICY IF EXISTS "building_units_owner_insert" ON building_units;
CREATE POLICY "building_units_owner_insert" ON building_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

-- ============================================================================
-- 8. Mettre à jour la vue building_stats pour exposer ownership_type
--    et filtrer les soft-deleted.
-- ============================================================================
CREATE OR REPLACE VIEW building_stats AS
SELECT
  b.id,
  b.name,
  b.owner_id,
  b.adresse_complete,
  b.ville,
  b.floors,
  b.ownership_type,
  b.total_lots_in_building,

  -- Comptages par type (uniquement lots actifs)
  COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave') AND bu.deleted_at IS NULL) AS total_units,
  COUNT(bu.id) FILTER (WHERE bu.type = 'parking' AND bu.deleted_at IS NULL) AS total_parkings,
  COUNT(bu.id) FILTER (WHERE bu.type = 'cave' AND bu.deleted_at IS NULL) AS total_caves,

  -- Surface
  COALESCE(SUM(bu.surface) FILTER (WHERE bu.deleted_at IS NULL), 0) AS surface_totale,

  -- Revenus
  COALESCE(SUM(bu.loyer_hc + bu.charges) FILTER (WHERE bu.deleted_at IS NULL), 0) AS revenus_potentiels,
  COALESCE(
    SUM(bu.loyer_hc + bu.charges) FILTER (WHERE bu.status = 'occupe' AND bu.deleted_at IS NULL),
    0
  ) AS revenus_actuels,

  -- Taux d'occupation (uniquement logements habitables, hors parking/cave)
  ROUND(
    COUNT(bu.id) FILTER (
      WHERE bu.status = 'occupe'
        AND bu.type NOT IN ('parking', 'cave')
        AND bu.deleted_at IS NULL
    )::DECIMAL /
    NULLIF(
      COUNT(bu.id) FILTER (
        WHERE bu.type NOT IN ('parking', 'cave')
          AND bu.deleted_at IS NULL
      ),
      0
    ) * 100,
    1
  ) AS occupancy_rate,

  COUNT(bu.id) FILTER (
    WHERE bu.status = 'vacant'
      AND bu.type NOT IN ('parking', 'cave')
      AND bu.deleted_at IS NULL
  ) AS vacant_units,
  COUNT(bu.id) FILTER (
    WHERE bu.status = 'occupe'
      AND bu.type NOT IN ('parking', 'cave')
      AND bu.deleted_at IS NULL
  ) AS occupied_units,
  COUNT(bu.id) FILTER (WHERE bu.status = 'travaux' AND bu.deleted_at IS NULL) AS units_en_travaux

FROM buildings b
LEFT JOIN building_units bu ON bu.building_id = b.id
WHERE b.deleted_at IS NULL
GROUP BY b.id;

COMMENT ON VIEW building_stats IS
  'Vue agrégée des stats par immeuble. Expose ownership_type et total_lots_in_building. Exclut les soft-deleted.';

-- ============================================================================
-- 9. Ajuster get_building_stats() pour filtrer les soft-deleted
-- ============================================================================
CREATE OR REPLACE FUNCTION get_building_stats(p_building_id UUID)
RETURNS TABLE (
  total_units INTEGER,
  total_parkings INTEGER,
  total_caves INTEGER,
  surface_totale DECIMAL,
  revenus_potentiels DECIMAL,
  revenus_actuels DECIMAL,
  occupancy_rate DECIMAL,
  vacant_units INTEGER,
  occupied_units INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave'))::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.type = 'parking')::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.type = 'cave')::INTEGER,
    COALESCE(SUM(bu.surface), 0)::DECIMAL,
    COALESCE(SUM(bu.loyer_hc + bu.charges), 0)::DECIMAL,
    COALESCE(SUM(bu.loyer_hc + bu.charges) FILTER (WHERE bu.status = 'occupe'), 0)::DECIMAL,
    ROUND(
      COUNT(bu.id) FILTER (WHERE bu.status = 'occupe' AND bu.type NOT IN ('parking', 'cave'))::DECIMAL /
      NULLIF(COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave')), 0) * 100,
      1
    )::DECIMAL,
    COUNT(bu.id) FILTER (WHERE bu.status = 'vacant' AND bu.type NOT IN ('parking', 'cave'))::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.status = 'occupe' AND bu.type NOT IN ('parking', 'cave'))::INTEGER
  FROM building_units bu
  WHERE bu.building_id = p_building_id
    AND bu.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_building_stats IS
  'Stats détaillées d''un immeuble — exclut les lots soft-deleted (deleted_at IS NULL).';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260415140000', 'buildings_sota_fix_wave1')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260415140000_buildings_sota_fix_wave1.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260415160000_buildings_rls_entity_members_support.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : to
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260415160000_buildings_rls_entity_members_support.sql'; END $pre$;

-- ============================================================================
-- Migration : RLS Support entity_members pour buildings et building_units
--
-- Item #18 de l'audit building-module : actuellement les policies owner_* sur
-- buildings et building_units ne vérifient que `owner_id = user_profile_id()`.
-- Les membres d'une SCI (via entity_members) n'ont pas accès aux immeubles
-- de leur entité, alors que la page /owner/buildings/[id] les autorise déjà
-- au niveau SSR.
--
-- Cette migration étend les policies pour inclure ce cas :
--   Un user est autorisé sur un building si :
--     (a) il est l'owner direct (pattern existant)
--     (b) OU il est membre de l'entité légale associée à la property parent
--         (via entity_members.user_id = auth.uid())
--
-- Les policies tenant/admin ne sont pas touchées.
-- ============================================================================

-- ============================================================================
-- 1. Fonction helper : user_in_entity_of_property(property_id)
--    Retourne true si l'utilisateur courant est membre de l'entité légale
--    rattachée à la property. Encapsule le pattern pour éviter les sous-
--    requêtes répétées dans chaque policy.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_in_entity_of_property(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM properties p
    JOIN entity_members em ON em.entity_id = p.legal_entity_id
    WHERE p.id = p_property_id
      AND p.legal_entity_id IS NOT NULL
      AND em.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.user_in_entity_of_property(UUID) IS
  'Retourne true si auth.uid() est membre (entity_members) de l''entité légale de la property. Utilisé par les RLS policies buildings/building_units pour le cas SCI.';

-- ============================================================================
-- 2. Recréer les policies owner sur buildings pour inclure entity_members
-- ============================================================================
DROP POLICY IF EXISTS "buildings_owner_select" ON buildings;
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (
    buildings.deleted_at IS NULL
    AND (
      owner_id = public.user_profile_id()
      OR (
        property_id IS NOT NULL
        AND public.user_in_entity_of_property(property_id)
      )
    )
  );

DROP POLICY IF EXISTS "buildings_owner_update" ON buildings;
CREATE POLICY "buildings_owner_update" ON buildings
  FOR UPDATE TO authenticated
  USING (
    buildings.deleted_at IS NULL
    AND (
      owner_id = public.user_profile_id()
      OR (
        property_id IS NOT NULL
        AND public.user_in_entity_of_property(property_id)
      )
    )
  );

DROP POLICY IF EXISTS "buildings_owner_delete" ON buildings;
CREATE POLICY "buildings_owner_delete" ON buildings
  FOR DELETE TO authenticated
  USING (
    buildings.deleted_at IS NULL
    AND (
      owner_id = public.user_profile_id()
      OR (
        property_id IS NOT NULL
        AND public.user_in_entity_of_property(property_id)
      )
    )
  );

-- INSERT : seul le propriétaire direct peut créer un building. Un membre SCI
-- ne doit pas pouvoir créer un building hors du flux wizard. On garde la
-- contrainte restrictive sur INSERT (owner_id = user_profile_id()).

-- ============================================================================
-- 3. Recréer les policies owner sur building_units pour inclure entity_members
--    via buildings.property_id → properties.legal_entity_id
-- ============================================================================
DROP POLICY IF EXISTS "building_units_owner_select" ON building_units;
CREATE POLICY "building_units_owner_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
    )
  );

DROP POLICY IF EXISTS "building_units_owner_update" ON building_units;
CREATE POLICY "building_units_owner_update" ON building_units
  FOR UPDATE TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
    )
  );

DROP POLICY IF EXISTS "building_units_owner_delete" ON building_units;
CREATE POLICY "building_units_owner_delete" ON building_units
  FOR DELETE TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
    )
  );

DROP POLICY IF EXISTS "building_units_owner_insert" ON building_units;
CREATE POLICY "building_units_owner_insert" ON building_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
    )
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260415160000', 'buildings_rls_entity_members_support')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260415160000_buildings_rls_entity_members_support.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260415230000_enforce_invoice_paid_has_payment.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : of
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260415230000_enforce_invoice_paid_has_payment.sql'; END $pre$;

-- =============================================================================
-- Migration : garde-fou "une invoice paid a toujours un payment associé"
-- Date      : 2026-04-15
-- Context   :
--   L'audit du 2026-04-15 a identifie 2 invoices en statut 'paid' sans
--   aucune row payments.succeeded associee (lease da2eb9da..., periodes
--   2026-01 et 2026-04). Cause racine : la Server Action
--   `app/owner/money/actions.ts::markInvoiceAsPaid()` faisait un UPDATE
--   direct `statut='paid'` sans creer de payment. `ensureReceiptDocument`
--   prenant un payment_id en entree, ces invoices devenaient impossibles
--   a rattraper proprement : pas de quittance pour le locataire, pas
--   d'ecriture comptable `rent_received`.
--
--   Fix applicatif : la Server Action a ete refactoree pour creer un
--   payment puis appeler ensureReceiptDocument (commit associe).
--
--   Cette migration ajoute un garde-fou DB pour bloquer *tout* autre
--   chemin (SQL direct, nouvelle route future, migration bogguee...)
--   qui tenterait de poser statut='paid' sans payment succeeded.
--
-- Exceptions legitimes :
--   - Avoirs (montant_total <= 0) issus de la regularisation annuelle
--     de charges : `metadata->>'type' = 'avoir_regularisation'` — ces
--     "factures" sont des credits poses a `paid` d'emblee car il n'y a
--     pas de flux d'argent entrant (c'est un trop-percu rembourse/deduit).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Trigger function : check et auto-populate paid_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enforce_invoice_paid_has_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_count INTEGER;
  v_latest_payment_date DATE;
  v_is_credit_note BOOLEAN;
BEGIN
  -- Ne declenche que sur les transitions vers 'paid' (INSERT ou UPDATE).
  -- Les updates qui conservent statut='paid' (ex: changement de metadata)
  -- passent sans verification.
  IF TG_OP = 'INSERT' THEN
    IF NEW.statut IS DISTINCT FROM 'paid' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.statut IS DISTINCT FROM 'paid' OR OLD.statut = 'paid' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Exception legitime : avoirs de regularisation de charges
  v_is_credit_note := COALESCE(NEW.metadata->>'type', '') IN (
    'avoir_regularisation',
    'credit_note'
  ) OR COALESCE(NEW.montant_total, 0) <= 0;

  IF v_is_credit_note THEN
    RETURN NEW;
  END IF;

  -- Verifier qu'au moins un payment succeeded existe pour cette invoice
  SELECT COUNT(*), MAX(p.date_paiement)
    INTO v_payment_count, v_latest_payment_date
  FROM public.payments p
  WHERE p.invoice_id = NEW.id
    AND p.statut = 'succeeded';

  IF v_payment_count = 0 THEN
    RAISE EXCEPTION
      'Invoice % cannot be marked as paid without a succeeded payment. '
      'Create a row in public.payments (statut=succeeded) first, or use '
      '/api/invoices/[id]/mark-paid / markInvoiceAsPaid() which handle it '
      'atomically. For legitimate credit notes, set metadata->>''type'' '
      'to ''avoir_regularisation''.',
      NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Auto-populate paid_at si NULL (commodite — la majorite des chemins
  -- applicatifs le remplissent deja, mais certains flux historiques
  -- l'oublient. Sans paid_at, l'UI /tenant/payments affiche "Date inconnue").
  IF NEW.paid_at IS NULL THEN
    NEW.paid_at := COALESCE(
      v_latest_payment_date::timestamptz,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_invoice_paid_has_payment IS
  'Bloque les transitions invoices.statut -> ''paid'' sans row payments '
  '(statut=succeeded) associee. Exception pour les avoirs de regularisation '
  '(metadata.type = avoir_regularisation ou montant_total <= 0). '
  'Auto-populate paid_at si NULL. Voir migration 20260415230000.';


-- =============================================================================
-- 2. Attacher le trigger (BEFORE pour pouvoir modifier NEW.paid_at)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_enforce_invoice_paid_has_payment ON public.invoices;

CREATE TRIGGER trg_enforce_invoice_paid_has_payment
  BEFORE INSERT OR UPDATE OF statut ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_paid_has_payment();


-- =============================================================================
-- 3. Backfill paid_at pour les invoices actuellement paid avec paid_at NULL
--    mais un payment succeeded existant.
--    (ne touche PAS les invoices orphelines sans payment — elles restent
--     visibles au monitoring via la requete 1g de scripts/diagnose-receipts.sql)
-- =============================================================================
UPDATE public.invoices i
SET paid_at = sub.latest_payment_date
FROM (
  SELECT p.invoice_id, MAX(p.date_paiement)::timestamptz AS latest_payment_date
  FROM public.payments p
  WHERE p.statut = 'succeeded'
  GROUP BY p.invoice_id
) sub
WHERE i.id = sub.invoice_id
  AND i.statut = 'paid'
  AND i.paid_at IS NULL;


-- =============================================================================
-- 4. Vue de monitoring : invoices paid sans payment (incident detection)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_invoices_paid_without_payment AS
SELECT
  i.id AS invoice_id,
  i.lease_id,
  i.tenant_id,
  i.owner_id,
  i.periode,
  i.montant_total,
  i.statut,
  i.paid_at,
  i.receipt_generated,
  i.created_at,
  COALESCE(i.metadata->>'type', '') AS invoice_type,
  (i.metadata->>'type' = 'avoir_regularisation' OR i.montant_total <= 0) AS is_credit_note_legitimate
FROM public.invoices i
WHERE i.statut = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.invoice_id = i.id AND p.statut = 'succeeded'
  );

COMMENT ON VIEW public.v_invoices_paid_without_payment IS
  'Invoices en statut paid sans payment succeeded associe. Doit etre vide '
  'apres le deploiement du trigger enforce_invoice_paid_has_payment. Utile '
  'pour le monitoring : exposer dans un health-check / alerting. Les credits '
  'legitimes (avoirs de regularisation) ont is_credit_note_legitimate = true.';

GRANT SELECT ON public.v_invoices_paid_without_payment TO authenticated;


COMMIT;

-- =============================================================================
-- Rollback :
--   BEGIN;
--     DROP VIEW IF EXISTS public.v_invoices_paid_without_payment;
--     DROP TRIGGER IF EXISTS trg_enforce_invoice_paid_has_payment ON public.invoices;
--     DROP FUNCTION IF EXISTS public.enforce_invoice_paid_has_payment();
--   COMMIT;
-- =============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260415230000', 'enforce_invoice_paid_has_payment')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260415230000_enforce_invoice_paid_has_payment.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260417090100_tax_notices_table.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260417090100_tax_notices_table.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Sprint 0.a — Table tax_notices
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- Stocke les avis de taxe foncière par bien et par année
-- pour extraire le montant TEOM net récupérable auprès
-- du locataire (décret 87-713 + note DGFiP : frais de
-- gestion ~8% non récupérables).
--
-- Idempotent : CREATE TABLE IF NOT EXISTS + DROP POLICY
-- IF EXISTS avant CREATE POLICY.
-- =====================================================

CREATE TABLE IF NOT EXISTS tax_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  teom_brut INTEGER CHECK (teom_brut IS NULL OR teom_brut >= 0),
  frais_gestion INTEGER CHECK (frais_gestion IS NULL OR frais_gestion >= 0),
  teom_net INTEGER CHECK (teom_net IS NULL OR teom_net >= 0),
  reom_applicable BOOLEAN NOT NULL DEFAULT false,
  extraction_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (extraction_method IN ('manual', 'ocr')),
  validated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tax_notices_property_year_unique UNIQUE (property_id, year)
);

CREATE INDEX IF NOT EXISTS idx_tax_notices_property ON tax_notices(property_id);
CREATE INDEX IF NOT EXISTS idx_tax_notices_entity ON tax_notices(entity_id)
  WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tax_notices_year ON tax_notices(year);

ALTER TABLE tax_notices ENABLE ROW LEVEL SECURITY;

-- Owner full access (via properties.owner_id → profiles.user_id)
DROP POLICY IF EXISTS "tax_notices_owner_access" ON tax_notices;
CREATE POLICY "tax_notices_owner_access" ON tax_notices
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Trigger updated_at (réutilise la fonction du module charges)
DROP TRIGGER IF EXISTS trg_tax_notices_updated ON tax_notices;
CREATE TRIGGER trg_tax_notices_updated
  BEFORE UPDATE ON tax_notices
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();

COMMENT ON TABLE tax_notices IS
  'Avis de taxe foncière par bien et par année — stocke TEOM brut / frais gestion / TEOM net récupérable. Source pour la régul des charges (gap P0 #2 du skill talok-charges-regularization).';
COMMENT ON COLUMN tax_notices.teom_brut IS 'Montant TEOM brut en centimes (tel qu''affiché sur l''avis).';
COMMENT ON COLUMN tax_notices.frais_gestion IS 'Frais de gestion (~8%) non récupérables en centimes.';
COMMENT ON COLUMN tax_notices.teom_net IS 'TEOM net récupérable en centimes (brut - frais_gestion).';
COMMENT ON COLUMN tax_notices.reom_applicable IS 'True si le bien est en zone de redevance (REOM) — alors aucune régul, payée directement par le locataire.';
COMMENT ON COLUMN tax_notices.extraction_method IS 'manual = saisie propriétaire, ocr = pipeline Tesseract + GPT-4o-mini (Sprint 6).';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260417090100', 'tax_notices_table')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260417090100_tax_notices_table.sql'; END $post$;

COMMIT;

-- END OF BATCH 10/11 (Phase 3 DANGEREUX)
