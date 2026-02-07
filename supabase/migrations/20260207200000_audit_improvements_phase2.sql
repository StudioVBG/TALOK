-- =============================================================================
-- MIGRATION: Improvements from EDL/Bail audit — Phase 2
-- =============================================================================
-- P1-6:  Deduplicate lease activation triggers
-- P2-3:  Add EDL intermédiaire type
-- P2-13: Add missing ON DELETE rules
-- P2-14: Mark gap002 furniture tables as deprecated
-- Other: Missing indexes, role normalization
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- P1-6: Deduplicate lease activation triggers
-- Two triggers activate the lease: check_edl_finalization (on edl_signatures)
-- and trigger_activate_lease_on_edl_signed (on edl). Remove the redundant one.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_activate_lease_on_edl_signed ON public.edl;
DROP FUNCTION IF EXISTS public.activate_lease_on_edl_signed();
-- Keep only check_edl_finalization on edl_signatures (the primary trigger)

-- ─────────────────────────────────────────────────────────────────────────────
-- P2-3: Add EDL intermédiaire type
-- Extends the edl type constraint to support intermediate inspections
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Drop old check constraint if exists, then recreate with new types
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'edl' AND constraint_name LIKE '%type%' AND constraint_type = 'CHECK'
  ) THEN
    DECLARE
      cname TEXT;
    BEGIN
      SELECT constraint_name INTO cname
      FROM information_schema.table_constraints
      WHERE table_name = 'edl' AND constraint_name LIKE '%type%' AND constraint_type = 'CHECK'
      LIMIT 1;
      IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.edl DROP CONSTRAINT %I', cname);
      END IF;
    END;
  END IF;

  -- Recreate with expanded types
  ALTER TABLE public.edl ADD CONSTRAINT edl_type_check
    CHECK (type IN ('entree', 'sortie', 'intermediaire'));

  RAISE NOTICE 'P2-3: Added intermediaire EDL type';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'P2-3: edl_type_check already exists';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P2-13: Add missing ON DELETE rules
-- ─────────────────────────────────────────────────────────────────────────────

-- leases.tenant_id: add ON DELETE SET NULL
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'leases' AND kcu.column_name = 'tenant_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    DECLARE fk_name TEXT;
    BEGIN
      SELECT tc.constraint_name INTO fk_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'leases' AND kcu.column_name = 'tenant_id' AND tc.constraint_type = 'FOREIGN KEY'
      LIMIT 1;
      IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.leases DROP CONSTRAINT %I', fk_name);
        ALTER TABLE public.leases ADD CONSTRAINT leases_tenant_id_fkey
          FOREIGN KEY (tenant_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
        RAISE NOTICE 'P2-13: Fixed leases.tenant_id ON DELETE SET NULL';
      END IF;
    END;
  END IF;
END $$;

-- documents.replaced_by: ensure ON DELETE SET NULL
DO $$ BEGIN
  BEGIN
    ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_replaced_by_fkey;
    ALTER TABLE public.documents ADD CONSTRAINT documents_replaced_by_fkey
      FOREIGN KEY (replaced_by) REFERENCES public.documents(id) ON DELETE SET NULL;
    RAISE NOTICE 'P2-13: Fixed documents.replaced_by ON DELETE SET NULL';
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'P2-13: documents.replaced_by column does not exist, skipping';
  END;
END $$;

-- documents.verified_by: ensure ON DELETE SET NULL
DO $$ BEGIN
  BEGIN
    ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_verified_by_fkey;
    ALTER TABLE public.documents ADD CONSTRAINT documents_verified_by_fkey
      FOREIGN KEY (verified_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    RAISE NOTICE 'P2-13: Fixed documents.verified_by ON DELETE SET NULL';
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'P2-13: documents.verified_by column does not exist, skipping';
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P2-14: Add deprecation comment on gap002 furniture tables
-- (They reference non-existent etats_des_lieux table — use edl_furniture_inventory instead)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_inventories') THEN
    COMMENT ON TABLE public.furniture_inventories IS
      'DEPRECATED: This table has a broken FK (references non-existent etats_des_lieux). Use edl_furniture_inventory instead.';
    RAISE NOTICE 'P2-14: Marked furniture_inventories as deprecated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_items') THEN
    COMMENT ON TABLE public.furniture_items IS
      'DEPRECATED: Parent table furniture_inventories is broken. Use edl_mandatory_furniture / edl_additional_furniture instead.';
    RAISE NOTICE 'P2-14: Marked furniture_items as deprecated';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Add entity_associates document FK constraints
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entity_associates' AND column_name = 'piece_identite_document_id'
  ) THEN
    BEGIN
      ALTER TABLE public.entity_associates
        ADD CONSTRAINT entity_associates_piece_identite_fkey
        FOREIGN KEY (piece_identite_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_entity_associates_piece_identite ON public.entity_associates(piece_identite_document_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entity_associates' AND column_name = 'justificatif_domicile_document_id'
  ) THEN
    BEGIN
      ALTER TABLE public.entity_associates
        ADD CONSTRAINT entity_associates_justificatif_domicile_fkey
        FOREIGN KEY (justificatif_domicile_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_entity_associates_justificatif_domicile ON public.entity_associates(justificatif_domicile_document_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  RAISE NOTICE '=== Migration 20260207200000_audit_improvements_phase2 completed ===';
END $$;
