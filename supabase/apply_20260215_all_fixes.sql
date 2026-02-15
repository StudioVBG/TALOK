-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATIONS CORRECTIVES — 15 février 2026                                ║
-- ║  4 migrations à exécuter dans l'ordre                                    ║
-- ║                                                                          ║
-- ║  INSTRUCTIONS:                                                           ║
-- ║  1. Ouvrir le Dashboard Supabase → SQL Editor                            ║
-- ║  2. Coller ce fichier en entier                                          ║
-- ║  3. Exécuter (Run)                                                       ║
-- ║  4. Vérifier les NOTICE dans l'output                                    ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 1/4 : Fix RLS properties — locataires avant bail "active"
-- Fichier : 20260215200000_fix_rls_properties_tenant_pre_active.sql
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Tenants can view properties with active leases" ON properties;

CREATE POLICY "Tenants can view linked properties"
  ON properties
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = properties.id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
  );

COMMENT ON POLICY "Tenants can view linked properties" ON properties IS
  'Locataires voient les propriétés liées à leurs baux (sauf draft/cancelled).';

DO $$ BEGIN RAISE NOTICE '✅ [1/4] RLS properties élargie'; END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 2/4 : Harmonisation CHECK constraint leases (12 statuts)
-- Fichier : 20260215200001_add_notice_given_lease_status.sql
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS check_lease_statut;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS lease_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  ALTER TABLE leases
    ADD CONSTRAINT leases_statut_check CHECK (
      statut IN (
        'draft',
        'sent',
        'pending_signature',
        'partially_signed',
        'pending_owner_signature',
        'fully_signed',
        'active',
        'notice_given',
        'amended',
        'terminated',
        'archived',
        'cancelled'
      )
    );

  RAISE NOTICE '✅ [2/4] CHECK constraint leases_statut_check — 12 statuts';
END $$;

COMMENT ON COLUMN leases.statut IS 'Statut du bail: draft, sent, pending_signature, partially_signed, pending_owner_signature, fully_signed, active, notice_given, amended, terminated, archived, cancelled';

DROP INDEX IF EXISTS idx_leases_pending_action;
CREATE INDEX IF NOT EXISTS idx_leases_pending_action ON leases(statut) 
  WHERE statut IN ('pending_signature', 'partially_signed', 'pending_owner_signature', 'fully_signed', 'sent');


-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 3/4 : Élargir RLS units / charges / tickets
-- Fichier : 20260215200002_fix_rls_tenant_access_beyond_active.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- UNITS
DROP POLICY IF EXISTS "Users can view units of accessible properties" ON units;

CREATE POLICY "Users can view units of accessible properties"
  ON units
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = units.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE (l.property_id = units.property_id OR l.unit_id = units.id)
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- CHARGES
DROP POLICY IF EXISTS "Tenants can view charges of properties with active leases" ON charges;

CREATE POLICY "Tenants can view charges of linked properties"
  ON charges
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = charges.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = charges.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given', 'fully_signed')
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- TICKETS SELECT
DROP POLICY IF EXISTS "Users can view tickets of accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;

CREATE POLICY "Users can view tickets of accessible properties"
  ON tickets
  FOR SELECT
  USING (
    tickets.created_by_profile_id = public.user_profile_id()
    OR
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.ticket_id = tickets.id
        AND wo.provider_id = public.user_profile_id()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- TICKETS INSERT
DROP POLICY IF EXISTS "Users can create tickets for accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;

CREATE POLICY "Users can create tickets for accessible properties"
  ON tickets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

DO $$ BEGIN RAISE NOTICE '✅ [3/4] RLS units/charges/tickets élargies'; END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 4/4 : FK ON DELETE SET NULL pour copropriété
-- Fichier : 20260215200003_fix_copro_fk_on_delete.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- copro_units.owner_profile_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'copro_units' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'owner_profile_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE copro_units DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'owner_profile_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'copro_units.owner_profile_id FK not found, skipping drop';
END $$;

ALTER TABLE copro_units
  ADD CONSTRAINT copro_units_owner_profile_id_fkey
  FOREIGN KEY (owner_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- copro_units.property_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'copro_units' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'property_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE copro_units DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'property_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'copro_units.property_id FK not found, skipping drop';
END $$;

ALTER TABLE copro_units
  ADD CONSTRAINT copro_units_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;

-- sites.syndic_profile_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sites' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'sites' AND column_name = 'syndic_profile_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE sites DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'sites' AND column_name = 'syndic_profile_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sites.syndic_profile_id FK not found, skipping drop';
END $$;

ALTER TABLE sites
  ADD CONSTRAINT sites_syndic_profile_id_fkey
  FOREIGN KEY (syndic_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

DO $$ BEGIN RAISE NOTICE '✅ [4/4] FK ON DELETE SET NULL ajoutées pour copro'; END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- RÉSUMÉ FINAL
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════════';
  RAISE NOTICE '  TOUTES LES MIGRATIONS APPLIQUÉES (4/4)     ';
  RAISE NOTICE '  1. RLS properties → locataires pre-active  ';
  RAISE NOTICE '  2. CHECK constraint → 12 statuts de bail   ';
  RAISE NOTICE '  3. RLS units/charges/tickets → élargies    ';
  RAISE NOTICE '  4. FK ON DELETE → copropriété               ';
  RAISE NOTICE '══════════════════════════════════════════════';
END $$;
