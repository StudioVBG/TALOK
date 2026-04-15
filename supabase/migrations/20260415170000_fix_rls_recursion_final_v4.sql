-- =====================================================
-- Migration: Fix V4 — Drop policies doublonnes + rewrite lease-reading policies
-- Date: 2026-04-15
-- Branche: claude/fix-tenant-payment-signing-UuhJr (follow-up V4)
--
-- CONTEXTE:
--   Les migrations V1 (20260415140000) et V2 (20260415160000) ont cassé
--   les cycles via tenant_select_properties et via les policies units/
--   tickets/charges/invoices que J'AI CRÉÉES. Mais des POLICIES LEGACY
--   sur les mêmes tables coexistent et ré-introduisent le cycle :
--
--   Cycle résiduel détecté en prod :
--     leases → "Owners can view leases of own properties" → EXISTS(units)
--     units → tenants_view_units (LEGACY, EXISTS(leases)) → leases → CYCLE
--
--   Policies legacy identifiées par le diagnostic pg_policies :
--     - units.tenants_view_units           ← CRITIQUE (cycle units↔leases)
--     - tickets.tenants_view_tickets       ← CRITIQUE (cycle tickets→leases→units→leases)
--     - edl_media.owners_manage_edl_media  (LEFT JOIN leases)
--     - edl_media.signers_view_edl_media   (JOIN leases JOIN lease_signers)
--     - edl_additional_furniture.Users can manage additional furniture via inventory
--     - edl_mandatory_furniture.Users can manage mandatory furniture via inventory
--     - lease_indexations."Owners can manage lease indexations"
--     - rent_payments."Owner can view rent_payments"
--     - vetusty_items.vetusty_items_select_policy
--     - vetusty_items.vetusty_items_update_policy
--     - vetusty_items.vetusty_items_delete_policy
--     - audit_events.audit_events_owned_entities
--
-- FIX:
--   1. DROP les 2 policies doublonnes critiques (units.tenants_view_units
--      et tickets.tenants_view_tickets) — elles sont déjà couvertes par
--      "Users can view units/tickets of accessible properties" créées en V2.
--   2. Créer 2 nouveaux helpers SECURITY DEFINER :
--      - signer_accessible_lease_ids()
--      - owner_accessible_lease_ids()
--   3. Rewrite toutes les policies legacy pour consommer les helpers au
--      lieu de sous-requêter leases inline.
-- =====================================================

BEGIN;

-- ============================================================
-- 1. Nouveaux helpers SECURITY DEFINER
-- ============================================================

CREATE OR REPLACE FUNCTION public.signer_accessible_lease_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ls.lease_id
  FROM public.lease_signers ls
  WHERE ls.profile_id = public.user_profile_id();
$$;

COMMENT ON FUNCTION public.signer_accessible_lease_ids() IS
  'SOTA 2026 — Lease ids où le profil authentifié est signataire. '
  'SECURITY DEFINER pour bypasser les RLS de lease_signers et éviter '
  'la récursion via les policies consommatrices.';

REVOKE ALL ON FUNCTION public.signer_accessible_lease_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signer_accessible_lease_ids()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_accessible_lease_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.id
  FROM public.leases l
  JOIN public.properties p ON p.id = l.property_id
  WHERE p.owner_id = public.user_profile_id();
$$;

COMMENT ON FUNCTION public.owner_accessible_lease_ids() IS
  'SOTA 2026 — Lease ids détenus par le profil authentifié via property.owner_id. '
  'SECURITY DEFINER pour bypasser les RLS de leases/properties.';

REVOKE ALL ON FUNCTION public.owner_accessible_lease_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_accessible_lease_ids()
  TO authenticated, service_role;

-- ============================================================
-- 2. CRITIQUE — DROP les 2 policies doublonnes qui créent le cycle
-- ============================================================

-- Ces 2 policies (legacy, avec EXISTS(leases) inline) coexistent avec
-- "Users can view units of accessible properties" et "Users can view
-- tickets of accessible properties" créées en V2 (20260415160000).
-- Les fixes V2 utilisent des helpers SECURITY DEFINER, les legacy non →
-- le plan RLS évalue les deux et le legacy réintroduit le cycle.

DROP POLICY IF EXISTS tenants_view_units ON public.units;
DROP POLICY IF EXISTS tenants_view_tickets ON public.tickets;

-- ============================================================
-- 3. edl_media — rewrite avec helpers
-- ============================================================

DROP POLICY IF EXISTS owners_manage_edl_media ON public.edl_media;
CREATE POLICY owners_manage_edl_media ON public.edl_media
  FOR ALL TO authenticated
  USING (
    edl_id IN (
      SELECT e.id FROM public.edl e
      WHERE e.lease_id IN (SELECT public.owner_accessible_lease_ids())
    )
  )
  WITH CHECK (
    edl_id IN (
      SELECT e.id FROM public.edl e
      WHERE e.lease_id IN (SELECT public.owner_accessible_lease_ids())
    )
  );

DROP POLICY IF EXISTS signers_view_edl_media ON public.edl_media;
CREATE POLICY signers_view_edl_media ON public.edl_media
  FOR SELECT TO authenticated
  USING (
    edl_id IN (
      SELECT e.id FROM public.edl e
      WHERE e.lease_id IN (SELECT public.signer_accessible_lease_ids())
    )
  );

-- ============================================================
-- 4. edl_additional_furniture + edl_mandatory_furniture
-- ============================================================

DROP POLICY IF EXISTS "Users can manage additional furniture via inventory" ON public.edl_additional_furniture;
CREATE POLICY "Users can manage additional furniture via inventory"
  ON public.edl_additional_furniture FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.edl_furniture_inventory fi
      WHERE fi.id = edl_additional_furniture.inventory_id
        AND (
          fi.lease_id IN (SELECT public.owner_accessible_lease_ids())
          OR fi.lease_id IN (SELECT public.signer_accessible_lease_ids())
        )
    )
  );

DROP POLICY IF EXISTS "Users can manage mandatory furniture via inventory" ON public.edl_mandatory_furniture;
CREATE POLICY "Users can manage mandatory furniture via inventory"
  ON public.edl_mandatory_furniture FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.edl_furniture_inventory fi
      WHERE fi.id = edl_mandatory_furniture.inventory_id
        AND (
          fi.lease_id IN (SELECT public.owner_accessible_lease_ids())
          OR fi.lease_id IN (SELECT public.signer_accessible_lease_ids())
        )
    )
  );

-- ============================================================
-- 5. lease_indexations
-- ============================================================

DROP POLICY IF EXISTS "Owners can manage lease indexations" ON public.lease_indexations;
CREATE POLICY "Owners can manage lease indexations"
  ON public.lease_indexations FOR ALL TO authenticated
  USING (lease_id IN (SELECT public.owner_accessible_lease_ids()))
  WITH CHECK (lease_id IN (SELECT public.owner_accessible_lease_ids()));

-- ============================================================
-- 6. rent_payments
-- ============================================================

DROP POLICY IF EXISTS "Owner can view rent_payments" ON public.rent_payments;
CREATE POLICY "Owner can view rent_payments"
  ON public.rent_payments FOR SELECT TO authenticated
  USING (lease_id IN (SELECT public.owner_accessible_lease_ids()));

-- ============================================================
-- 7. vetusty_items (3 policies)
-- ============================================================

DROP POLICY IF EXISTS vetusty_items_select_policy ON public.vetusty_items;
CREATE POLICY vetusty_items_select_policy
  ON public.vetusty_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vetusty_reports vr
      WHERE vr.id = vetusty_items.report_id
        AND (
          vr.lease_id IN (SELECT public.owner_accessible_lease_ids())
          OR vr.lease_id IN (SELECT public.signer_accessible_lease_ids())
        )
    )
  );

DROP POLICY IF EXISTS vetusty_items_update_policy ON public.vetusty_items;
CREATE POLICY vetusty_items_update_policy
  ON public.vetusty_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vetusty_reports vr
      WHERE vr.id = vetusty_items.report_id
        AND vr.lease_id IN (SELECT public.owner_accessible_lease_ids())
    )
  );

DROP POLICY IF EXISTS vetusty_items_delete_policy ON public.vetusty_items;
CREATE POLICY vetusty_items_delete_policy
  ON public.vetusty_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vetusty_reports vr
      WHERE vr.id = vetusty_items.report_id
        AND vr.lease_id IN (SELECT public.owner_accessible_lease_ids())
        AND vr.status = 'draft'
    )
  );

-- ============================================================
-- 8. audit_events
-- ============================================================

DROP POLICY IF EXISTS audit_events_owned_entities ON public.audit_events;
CREATE POLICY audit_events_owned_entities
  ON public.audit_events FOR ALL TO authenticated
  USING (
    (entity_type = 'properties' AND entity_id IN (
      SELECT id FROM public.properties WHERE owner_id = public.user_profile_id()
    ))
    OR (entity_type = 'leases' AND entity_id IN (SELECT public.owner_accessible_lease_ids()))
  );

-- ============================================================
-- 9. Fix audit trigger: skip NULL entity_id (blocking tenant-sign)
-- ============================================================
-- La fonction record_accounting_entry (20260110000001) insère dans
-- accounting_entries sans entity_id → trg_audit_entries fire → INSERT
-- NULL dans accounting_audit_log(entity_id NOT NULL) → 23502 → rollback
-- de la transaction tenant-sign → 500.

CREATE OR REPLACE FUNCTION public.fn_audit_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip audit si entity_id non renseigné (legacy flow mandants)
  IF NEW.entity_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.accounting_audit_log (entity_id, actor_id, actor_type, action, target_type, target_id, details)
    VALUES (
      NEW.entity_id,
      NEW.created_by,
      'user',
      'create_entry',
      'accounting_entry',
      NEW.id,
      jsonb_build_object(
        'journal_code', NEW.journal_code,
        'entry_number', NEW.entry_number,
        'label', NEW.label
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_validated = true AND OLD.is_validated = false THEN
      INSERT INTO public.accounting_audit_log (entity_id, actor_id, actor_type, action, target_type, target_id, details)
      VALUES (
        NEW.entity_id,
        NEW.validated_by,
        'user',
        'validate_entry',
        'accounting_entry',
        NEW.id,
        jsonb_build_object('entry_number', NEW.entry_number)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 10. Sanity check final
-- ============================================================
DO $$
DECLARE
  v_row RECORD;
  v_count INT := 0;
BEGIN
  FOR v_row IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ILIKE '%FROM leases%' OR qual ILIKE '%JOIN leases%'
           OR qual ILIKE '%FROM public.leases%' OR qual ILIKE '%JOIN public.leases%')
      AND qual NOT ILIKE '%accessible_lease_ids%'
      AND qual NOT ILIKE '%accessible_property_ids%'
      AND qual NOT ILIKE '%accessible_unit_ids%'
      AND qual NOT ILIKE '%is_lease_member%'
      AND qual NOT ILIKE '%is_lease_owner%'
  LOOP
    RAISE WARNING 'Policy % sur % lit toujours leases inline — risque de récursion',
      v_row.policyname, v_row.tablename;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE NOTICE 'OK: aucune policy RLS ne lit leases inline hors helpers SECURITY DEFINER';
  END IF;
END $$;

-- ============================================================
-- 11. Reload PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
