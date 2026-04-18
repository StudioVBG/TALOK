-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 15/15
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
-- Migration: 20260415150000_upsert_building_with_units_rpc.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260415150000_upsert_building_with_units_rpc.sql'; END $pre$;

-- ============================================================================
-- Migration : RPC transactionnelle upsert_building_with_units
--
-- Encapsule en une seule transaction SQL l'ensemble des opérations de
-- création/mise à jour d'un immeuble et de ses lots :
--   1. UPSERT du record buildings
--   2. Garde baux actifs (via building_active_lease_units)
--   3. UPSERT des properties lots (préserve les IDs existants via floor-position)
--   4. DELETE + INSERT des building_units (atomiquement dans la même fonction)
--
-- Items de l'audit adressés :
--   #4  — Transaction SQL pour POST /building-units
--   #8  — Garde baux actifs avant DELETE
--   #10 — UPDATE du `name` dans UPSERT (pas figé à la création)
--   #24 — Supprime le hardcode `meuble = studio||local_commercial`
--   #6  — Propagation loyer/charges/depot_garantie vers properties lots
--         (y compris depot_garantie qui manquait)
-- ============================================================================

-- ============================================================================
-- 1. Fonction utilitaire permanente : génération de unique_code property
--    Format : PROP-XXXX-XXXX (8 caractères random, charset alphanum majuscule)
--    Identique à lib/helpers/code-generator.ts côté app.
-- ============================================================================
CREATE OR REPLACE FUNCTION public._gen_prop_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  charset TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT;
  i INT;
  max_attempts INT := 20;
  attempt INT := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    result := 'PROP-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM properties WHERE unique_code = result);
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'gen_prop_code_max_attempts_exceeded';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public._gen_prop_code() IS
  'Génère un unique_code PROP-XXXX-XXXX unique dans la table properties.';

-- ============================================================================
-- 2. RPC transactionnelle : upsert_building_with_units
--    Signature :
--      upsert_building_with_units(
--        p_property_id UUID,          -- property wrapper (type='immeuble')
--        p_building_data JSONB,       -- champs building (tous optionnels)
--        p_units JSONB                -- array des lots (obligatoire)
--      ) RETURNS JSONB
--
--    Retour :
--      { "building_id": UUID, "unit_count": INT, "lot_property_ids": [UUID] }
--
--    Exceptions :
--      P0001 'property_not_found'      — property parent introuvable
--      P0002 'active_leases_blocking:<list>' — baux actifs bloquent le remplacement
--      23505 (unique_violation)        — contrainte UNIQUE violée (collision floor/position)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_building_with_units(
  p_property_id UUID,
  p_building_data JSONB,
  p_units JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_legal_entity_id UUID;
  v_adresse TEXT;
  v_cp TEXT;
  v_ville TEXT;
  v_dept TEXT;
  v_building_id UUID;
  v_active_count INTEGER;
  v_active_list TEXT;
  v_existing_prop_map JSONB := '{}'::JSONB;
  v_unit JSONB;
  v_key TEXT;
  v_lot_prop_id UUID;
  v_lot_prop_ids UUID[] := ARRAY[]::UUID[];
  v_new_code TEXT;
  v_floor_label TEXT;
  v_floor INTEGER;
  v_pos TEXT;
  v_type TEXT;
  v_template TEXT;
  v_unit_count INTEGER := 0;
  v_has_ascenseur BOOLEAN;
BEGIN
  -- ─── 1. Valider la property parent ────────────────────────────────────────
  SELECT owner_id, legal_entity_id, adresse_complete, code_postal, ville, departement
    INTO v_owner_id, v_legal_entity_id, v_adresse, v_cp, v_ville, v_dept
    FROM properties
   WHERE id = p_property_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'property_not_found' USING ERRCODE = 'P0001';
  END IF;

  v_has_ascenseur := COALESCE((p_building_data->>'has_ascenseur')::BOOLEAN, false);

  -- ─── 2. Upsert building ───────────────────────────────────────────────────
  SELECT id INTO v_building_id
    FROM buildings
   WHERE property_id = p_property_id
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_building_id IS NOT NULL THEN
    -- Garde baux actifs avant tout replacement
    SELECT COUNT(*), string_agg('Lot ' || "position" || ' (étage ' || floor || ')', ', ')
      INTO v_active_count, v_active_list
      FROM public.building_active_lease_units(v_building_id);

    IF v_active_count > 0 THEN
      RAISE EXCEPTION 'active_leases_blocking:%', v_active_list
        USING ERRCODE = 'P0002';
    END IF;

    -- UPDATE building (COALESCE pour ne pas écraser avec NULL si non fourni)
    UPDATE buildings SET
      name = COALESCE(NULLIF(p_building_data->>'name', ''), name),
      floors = COALESCE((p_building_data->>'floors')::INTEGER, floors),
      has_ascenseur = COALESCE((p_building_data->>'has_ascenseur')::BOOLEAN, has_ascenseur),
      has_gardien = COALESCE((p_building_data->>'has_gardien')::BOOLEAN, has_gardien),
      has_interphone = COALESCE((p_building_data->>'has_interphone')::BOOLEAN, has_interphone),
      has_digicode = COALESCE((p_building_data->>'has_digicode')::BOOLEAN, has_digicode),
      has_local_velo = COALESCE((p_building_data->>'has_local_velo')::BOOLEAN, has_local_velo),
      has_local_poubelles = COALESCE((p_building_data->>'has_local_poubelles')::BOOLEAN, has_local_poubelles),
      has_parking_commun = COALESCE((p_building_data->>'has_parking_commun')::BOOLEAN, has_parking_commun),
      has_jardin_commun = COALESCE((p_building_data->>'has_jardin_commun')::BOOLEAN, has_jardin_commun),
      ownership_type = COALESCE(NULLIF(p_building_data->>'ownership_type', ''), ownership_type),
      total_lots_in_building = CASE
        WHEN p_building_data ? 'total_lots_in_building'
             AND p_building_data->>'total_lots_in_building' IS NOT NULL
          THEN (p_building_data->>'total_lots_in_building')::INTEGER
        ELSE total_lots_in_building
      END,
      construction_year = CASE
        WHEN p_building_data ? 'construction_year'
             AND p_building_data->>'construction_year' IS NOT NULL
          THEN (p_building_data->>'construction_year')::INTEGER
        ELSE construction_year
      END,
      surface_totale = CASE
        WHEN p_building_data ? 'surface_totale'
             AND p_building_data->>'surface_totale' IS NOT NULL
          THEN (p_building_data->>'surface_totale')::DECIMAL
        ELSE surface_totale
      END,
      notes = COALESCE(p_building_data->>'notes', notes),
      updated_at = NOW()
    WHERE id = v_building_id;
  ELSE
    -- INSERT building
    INSERT INTO buildings (
      owner_id, property_id, name,
      adresse_complete, code_postal, ville, departement,
      floors,
      has_ascenseur, has_gardien, has_interphone, has_digicode,
      has_local_velo, has_local_poubelles, has_parking_commun, has_jardin_commun,
      ownership_type, total_lots_in_building,
      construction_year, surface_totale, notes
    ) VALUES (
      v_owner_id, p_property_id,
      COALESCE(NULLIF(p_building_data->>'name', ''), LEFT(COALESCE(v_adresse, 'Immeuble'), 200)),
      v_adresse, v_cp, v_ville, v_dept,
      COALESCE((p_building_data->>'floors')::INTEGER, 1),
      COALESCE((p_building_data->>'has_ascenseur')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_gardien')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_interphone')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_digicode')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_local_velo')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_local_poubelles')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_parking_commun')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_jardin_commun')::BOOLEAN, false),
      COALESCE(NULLIF(p_building_data->>'ownership_type', ''), 'full'),
      NULLIF(p_building_data->>'total_lots_in_building', '')::INTEGER,
      NULLIF(p_building_data->>'construction_year', '')::INTEGER,
      NULLIF(p_building_data->>'surface_totale', '')::DECIMAL,
      NULLIF(p_building_data->>'notes', '')
    )
    RETURNING id INTO v_building_id;
  END IF;

  -- ─── 3. Map des property_id existantes par floor-position ─────────────────
  SELECT COALESCE(
           jsonb_object_agg(floor::TEXT || '-' || position, property_id),
           '{}'::JSONB
         )
    INTO v_existing_prop_map
    FROM building_units
   WHERE building_id = v_building_id
     AND property_id IS NOT NULL
     AND deleted_at IS NULL;

  -- ─── 4. DELETE des building_units (les properties lots restent) ───────────
  DELETE FROM building_units WHERE building_id = v_building_id;

  -- ─── 5. Pour chaque unit du payload : upsert property lot + insert unit ───
  FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units) LOOP
    v_floor := (v_unit->>'floor')::INTEGER;
    v_pos := v_unit->>'position';
    v_type := v_unit->>'type';
    v_template := NULLIF(lower(COALESCE(v_unit->>'template', '')), '');
    v_key := v_floor::TEXT || '-' || v_pos;

    -- Label étage
    IF v_floor < 0 THEN v_floor_label := 'SS' || abs(v_floor);
    ELSIF v_floor = 0 THEN v_floor_label := 'RDC';
    ELSE v_floor_label := 'Étage ' || v_floor;
    END IF;

    v_lot_prop_id := NULL;
    IF v_existing_prop_map ? v_key THEN
      v_lot_prop_id := (v_existing_prop_map->>v_key)::UUID;

      -- UPDATE property lot existante
      -- meuble : on respecte le payload si fourni, sinon on garde la valeur actuelle
      UPDATE properties SET
        type = v_type,
        surface = (v_unit->>'surface')::DECIMAL,
        nb_pieces = (v_unit->>'nb_pieces')::INTEGER,
        loyer_hc = (v_unit->>'loyer_hc')::DECIMAL,
        charges_mensuelles = (v_unit->>'charges')::DECIMAL,
        depot_garantie = (v_unit->>'depot_garantie')::DECIMAL,
        meuble = CASE
          WHEN v_unit ? 'meuble' AND v_unit->>'meuble' IS NOT NULL
            THEN (v_unit->>'meuble')::BOOLEAN
          ELSE meuble
        END,
        ascenseur = v_has_ascenseur,
        adresse_complete = COALESCE(v_adresse, '')
                           || ' - Lot ' || v_pos
                           || ', ' || v_floor_label,
        updated_at = NOW()
      WHERE id = v_lot_prop_id;
    ELSE
      -- INSERT property lot
      v_new_code := public._gen_prop_code();

      INSERT INTO properties (
        owner_id, legal_entity_id, parent_property_id,
        type, etat, unique_code,
        adresse_complete, code_postal, ville, departement,
        surface, nb_pieces, nb_chambres,
        ascenseur, meuble,
        loyer_hc, charges_mensuelles, depot_garantie
      ) VALUES (
        v_owner_id, v_legal_entity_id, p_property_id,
        v_type, 'published', v_new_code,
        COALESCE(v_adresse, '') || ' - Lot ' || v_pos || ', ' || v_floor_label,
        COALESCE(v_cp, ''), COALESCE(v_ville, ''), COALESCE(v_dept, ''),
        (v_unit->>'surface')::DECIMAL,
        (v_unit->>'nb_pieces')::INTEGER,
        0,
        v_has_ascenseur,
        COALESCE((v_unit->>'meuble')::BOOLEAN, false),
        (v_unit->>'loyer_hc')::DECIMAL,
        (v_unit->>'charges')::DECIMAL,
        (v_unit->>'depot_garantie')::DECIMAL
      )
      RETURNING id INTO v_lot_prop_id;
    END IF;

    -- INSERT building_unit
    INSERT INTO building_units (
      building_id, floor, position, type, template,
      surface, nb_pieces,
      loyer_hc, charges, depot_garantie,
      status, property_id
    ) VALUES (
      v_building_id, v_floor, v_pos, v_type, v_template,
      (v_unit->>'surface')::DECIMAL,
      (v_unit->>'nb_pieces')::INTEGER,
      (v_unit->>'loyer_hc')::DECIMAL,
      (v_unit->>'charges')::DECIMAL,
      (v_unit->>'depot_garantie')::DECIMAL,
      COALESCE(NULLIF(v_unit->>'status', ''), 'vacant'),
      v_lot_prop_id
    );

    v_lot_prop_ids := array_append(v_lot_prop_ids, v_lot_prop_id);
    v_unit_count := v_unit_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'building_id', v_building_id,
    'unit_count', v_unit_count,
    'lot_property_ids', to_jsonb(v_lot_prop_ids)
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_building_with_units(UUID, JSONB, JSONB) IS
  'Upsert atomique d''un immeuble + lots + properties lots. Refuse si au moins un lot a un bail bloquant. Renvoie { building_id, unit_count, lot_property_ids }.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260415150000', 'upsert_building_with_units_rpc')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260415150000_upsert_building_with_units_rpc.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260416100000_fix_messages_conversation_trigger.sql
-- Risk: MODERE
-- Why: +1 triggers, UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260416100000_fix_messages_conversation_trigger.sql'; END $pre$;

-- Migration: Fix Messages Module
-- 1. Trigger AFTER INSERT ON messages → update conversations metadata
-- 2. Backfill existing conversations with last_message data
-- 3. Unique index to prevent duplicate conversations (race condition)

-- ============================================
-- 1. TRIGGER: update conversation on new message
-- ============================================

CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW(),
    owner_unread_count = CASE
      WHEN NEW.sender_role = 'tenant' THEN COALESCE(owner_unread_count, 0) + 1
      ELSE owner_unread_count
    END,
    tenant_unread_count = CASE
      WHEN NEW.sender_role = 'owner' THEN COALESCE(tenant_unread_count, 0) + 1
      ELSE tenant_unread_count
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON messages;

CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();

-- ============================================
-- 2. BACKFILL: populate last_message_at/preview for existing conversations
-- ============================================

UPDATE conversations c
SET
  last_message_at = sub.max_created,
  last_message_preview = sub.last_content,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.created_at AS max_created,
    LEFT(m.content, 100) AS last_content
  FROM messages m
  WHERE m.deleted_at IS NULL
  ORDER BY m.conversation_id, m.created_at DESC
) sub
WHERE c.id = sub.conversation_id
  AND c.last_message_at IS NULL;

-- ============================================
-- 3. UNIQUE INDEX: prevent duplicate active conversations
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_active_pair
  ON conversations (property_id, owner_profile_id, tenant_profile_id)
  WHERE status = 'active';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260416100000', 'fix_messages_conversation_trigger')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260416100000_fix_messages_conversation_trigger.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260416100000_fix_tickets_rls_recursion.sql
-- Note: file on disk is 20260416100000_fix_tickets_rls_recursion.sql but will be renamed to 20260416100001_fix_tickets_rls_recursion.sql
-- Risk: MODERE
-- Why: +2 policies, -4 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260416100000_fix_tickets_rls_recursion.sql'; END $pre$;

-- =====================================================
-- Migration: Fix tickets RLS infinite recursion (42P17)
-- Date: 2026-04-16
--
-- CONTEXT:
-- The "Users can view tickets of accessible properties" SELECT policy
-- on `tickets` (20260215200002_fix_rls_tenant_access_beyond_active.sql)
-- uses inline EXISTS subqueries that cause circular RLS evaluation:
--
--   EXISTS (
--     SELECT 1 FROM leases l
--     JOIN lease_signers ls ON ls.lease_id = l.id
--     WHERE l.property_id = tickets.property_id
--       AND ls.profile_id = user_profile_id()
--       AND l.statut IN ('active', 'notice_given')
--   )
--
-- Reading `leases` triggers leases SELECT RLS → which checks
-- `properties` RLS → which uses tenant_accessible_property_ids() →
-- reads `leases` again → Postgres detects the cycle at plan time:
--
--   ERROR: 42P17 infinite recursion detected in policy for
--          relation "tickets"
--
-- This breaks useTenantRealtime (500 on tickets query) and any
-- tenant-side ticket access.
--
-- FIX:
-- Replace the inline EXISTS on leases/lease_signers with a
-- SECURITY DEFINER helper function that bypasses RLS. Same pattern
-- used by tenant_accessible_property_ids() and
-- owner_accessible_work_order_ids().
--
-- Also fix the INSERT policy which has the same inline pattern.
--
-- Safe to re-run (CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS).
-- =====================================================

-- =====================================================
-- 1. SECURITY DEFINER helper: ticket ids the current authenticated
--    user can read as a tenant (via lease_signers on the same property)
-- =====================================================
CREATE OR REPLACE FUNCTION public.tenant_accessible_ticket_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT t.id
  FROM public.tickets t
  JOIN public.leases l ON l.property_id = t.property_id
  JOIN public.lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = public.user_profile_id()
    AND l.statut IN ('active', 'notice_given');
$$;

COMMENT ON FUNCTION public.tenant_accessible_ticket_ids IS
  'Returns ticket ids that the currently authenticated user can access '
  'as a tenant signer on an active or notice_given lease for the same '
  'property. SECURITY DEFINER to bypass RLS on leases and lease_signers '
  'and avoid the infinite recursion caused by the inline EXISTS subquery '
  'in the tickets SELECT policy.';

-- =====================================================
-- 2. SECURITY DEFINER helper: property ids the current user can
--    create tickets for as a tenant
-- =====================================================
CREATE OR REPLACE FUNCTION public.tenant_ticketable_property_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT l.property_id
  FROM public.leases l
  JOIN public.lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = public.user_profile_id()
    AND l.statut IN ('active', 'notice_given');
$$;

COMMENT ON FUNCTION public.tenant_ticketable_property_ids IS
  'Returns property ids where the current user is a tenant with an '
  'active or notice_given lease. Used for the tickets INSERT policy '
  'to avoid RLS recursion.';

-- =====================================================
-- 3. Rewrite SELECT policy — no more inline leases/profiles subqueries
-- =====================================================
DROP POLICY IF EXISTS "Users can view tickets of accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;

CREATE POLICY "Users can view tickets of accessible properties"
  ON tickets
  FOR SELECT
  USING (
    -- Creator of the ticket
    tickets.created_by_profile_id = public.user_profile_id()
    OR
    -- Owner of the property (direct check, no sub-select on properties)
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Tenant with active/notice_given lease (SECURITY DEFINER helper)
    tickets.id IN (SELECT public.tenant_accessible_ticket_ids())
    OR
    -- Provider assigned via work_order
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.ticket_id = tickets.id
        AND wo.provider_id = public.user_profile_id()
    )
    OR
    -- Admin (direct check on auth.uid(), no sub-select on profiles)
    public.user_profile_id() IN (
      SELECT p.id FROM profiles p WHERE p.id = public.user_profile_id() AND p.role = 'admin'
    )
  );

COMMENT ON POLICY "Users can view tickets of accessible properties" ON tickets IS
  'Unified SELECT policy for tickets. Uses tenant_accessible_ticket_ids() '
  'SECURITY DEFINER helper to avoid the infinite recursion through '
  'leases → properties → leases policies.';

-- =====================================================
-- 4. Rewrite INSERT policy — same recursion fix
-- =====================================================
DROP POLICY IF EXISTS "Users can create tickets for accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;

CREATE POLICY "Users can create tickets for accessible properties"
  ON tickets
  FOR INSERT
  WITH CHECK (
    -- Owner of the property
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Tenant with active/notice_given lease (SECURITY DEFINER helper)
    tickets.property_id IN (SELECT public.tenant_ticketable_property_ids())
    OR
    -- Admin
    public.user_profile_id() IN (
      SELECT p.id FROM profiles p WHERE p.id = public.user_profile_id() AND p.role = 'admin'
    )
  );

COMMENT ON POLICY "Users can create tickets for accessible properties" ON tickets IS
  'INSERT policy for tickets. Uses tenant_ticketable_property_ids() '
  'SECURITY DEFINER helper to avoid the infinite recursion.';

-- =====================================================
-- Log
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '[MIGRATION] Fix tickets RLS recursion — replaced inline leases/lease_signers EXISTS with SECURITY DEFINER helpers';
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260416100001', 'fix_tickets_rls_recursion')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260416100000_fix_tickets_rls_recursion.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260417090200_epci_reference_table.sql
-- Risk: MODERE
-- Why: +1 policies, -1 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260417090200_epci_reference_table.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Sprint 0.a — Table epci_reference
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- Référentiel des EPCI (DROM-COM priorité) pour
-- déterminer le type de taxe déchets applicable
-- (TEOM / REOM / none) et le taux de TEOM.
-- Utilisé côté Sprint 2 pour le lookup par code postal
-- et côté Sprint 3 pour afficher l'info REOM.
--
-- RLS : lecture publique (référentiel, aucune donnée PII).
-- Seeds : injectés en Sprint 0.b (22 EPCI DROM-COM).
-- Idempotent : CREATE TABLE IF NOT EXISTS.
-- =====================================================

CREATE TABLE IF NOT EXISTS epci_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_departement TEXT NOT NULL,
  code_postal_pattern TEXT,
  epci_name TEXT NOT NULL,
  syndicat_traitement TEXT,
  waste_tax_type TEXT NOT NULL DEFAULT 'teom'
    CHECK (waste_tax_type IN ('teom', 'reom', 'none')),
  teom_rate_pct NUMERIC(5,2),
  teom_rate_year INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT epci_reference_dept_name_unique UNIQUE (code_departement, epci_name)
);

CREATE INDEX IF NOT EXISTS idx_epci_reference_dept ON epci_reference(code_departement);
CREATE INDEX IF NOT EXISTS idx_epci_reference_cp ON epci_reference(code_postal_pattern)
  WHERE code_postal_pattern IS NOT NULL;

ALTER TABLE epci_reference ENABLE ROW LEVEL SECURITY;

-- Lecture publique (référentiel sans PII). Écriture bloquée côté client
-- (seed SQL uniquement via migration).
DROP POLICY IF EXISTS "epci_reference_public_read" ON epci_reference;
CREATE POLICY "epci_reference_public_read" ON epci_reference
  FOR SELECT TO authenticated, anon
  USING (true);

COMMENT ON TABLE epci_reference IS
  'Référentiel EPCI — type de taxe déchets et taux TEOM par EPCI. Focus DROM-COM au Sprint 0, métropole extensible ensuite.';
COMMENT ON COLUMN epci_reference.waste_tax_type IS
  'teom = taxe (intégrée taxe foncière, payée par propriétaire, récupérable sur locataire). reom = redevance (payée directement par locataire, aucune régul côté propriétaire). none = aucune taxe.';
COMMENT ON COLUMN epci_reference.teom_rate_pct IS
  'Taux TEOM en pourcentage (référentiel indicatif — le montant réel figure sur l''avis de taxe foncière).';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260417090200', 'epci_reference_table')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260417090200_epci_reference_table.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260417090300_fix_tenant_contest_rls.sql
-- Risk: MODERE
-- Why: +1 policies, -1 policies, UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260417090300_fix_tenant_contest_rls.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Gap P0 #4 — RLS locataire contested
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- La policy lease_charge_reg_tenant_contest créée par la
-- migration 20260408130000 a un WITH CHECK (status = 'sent')
-- qui interdit toute transition : l'UPDATE voit la NOUVELLE
-- valeur et si le locataire passe status à 'contested' le
-- WITH CHECK rejette. Résultat : la policy est inutile,
-- le locataire ne peut rien modifier.
--
-- Fix : USING (ancien status = 'sent') + WITH CHECK
-- (nouveau status = 'contested'). Transition strictement
-- sent → contested, aucune autre autorisée (pas sent→settled,
-- pas contested→sent, etc.). L'appartenance au bail reste
-- vérifiée des deux côtés.
--
-- Idempotent : DROP POLICY IF EXISTS avant CREATE POLICY.
-- =====================================================

DROP POLICY IF EXISTS "lease_charge_reg_tenant_contest" ON lease_charge_regularizations;

CREATE POLICY "lease_charge_reg_tenant_contest" ON lease_charge_regularizations
  FOR UPDATE TO authenticated
  USING (
    status = 'sent'
    AND lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  )
  WITH CHECK (
    status = 'contested'
    AND lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

COMMENT ON POLICY "lease_charge_reg_tenant_contest" ON lease_charge_regularizations IS
  'Locataire : transition strictement sent → contested. Toute autre transition est interdite (owner only). Gap P0 #4 du skill talok-charges-regularization.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260417090300', 'fix_tenant_contest_rls')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260417090300_fix_tenant_contest_rls.sql'; END $post$;

COMMIT;

-- END OF BATCH 15/15 (Phase 2 MODERE)
