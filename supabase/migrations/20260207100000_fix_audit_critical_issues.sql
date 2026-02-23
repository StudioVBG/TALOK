-- =============================================================================
-- MIGRATION: Fix critical issues found during EDL/Bail system audit (2026-02-07)
-- =============================================================================
-- Fixes:
--   1. Add entity_id column to edl table (multi-entity support)
--   2. Add edl_id column to documents table (direct EDL-document link)
--   3. Fix furniture_inventories FK (etats_des_lieux -> edl)
--   4. Fix vetusty_reports FK (dg_settlements -> deposit_movements)
--   5. Fix RLS policies on vetusty/furniture tables (owner_id vs auth.uid() mismatch)
--   6. Add missing FK constraints on vetusty_items
--   7. Add missing indexes on FK columns
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add entity_id to edl table (align with leases + documents)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'edl' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE public.edl ADD COLUMN entity_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_edl_entity_id ON public.edl(entity_id);

    -- Backfill: set entity_id from the linked lease's signatory_entity_id
    UPDATE public.edl e
    SET entity_id = l.signatory_entity_id
    FROM public.leases l
    WHERE e.lease_id = l.id
      AND l.signatory_entity_id IS NOT NULL
      AND e.entity_id IS NULL;

    -- Fallback: set entity_id from the property's legal_entity_id
    UPDATE public.edl e
    SET entity_id = p.legal_entity_id
    FROM public.properties p
    WHERE e.property_id = p.id
      AND p.legal_entity_id IS NOT NULL
      AND e.entity_id IS NULL;

    RAISE NOTICE 'Added entity_id column to edl table';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add edl_id to documents table (direct link EDL <-> document)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'edl_id'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN edl_id UUID REFERENCES public.edl(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_documents_edl_id ON public.documents(edl_id);
    RAISE NOTICE 'Added edl_id column to documents table';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fix furniture_inventories: reference correct edl table (not etats_des_lieux)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Check if furniture_inventories exists with broken FK
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'furniture_inventories'
  ) THEN
    -- Drop the broken FK if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'furniture_inventories' AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%edl_id%'
    ) THEN
      -- Get the actual constraint name and drop it
      DECLARE
        fk_name TEXT;
      BEGIN
        SELECT constraint_name INTO fk_name
        FROM information_schema.table_constraints
        WHERE table_name = 'furniture_inventories' AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%edl_id%'
        LIMIT 1;

        IF fk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE public.furniture_inventories DROP CONSTRAINT %I', fk_name);
          RAISE NOTICE 'Dropped broken FK on furniture_inventories.edl_id';
        END IF;
      END;
    END IF;

    -- Re-add the correct FK pointing to edl (not etats_des_lieux)
    BEGIN
      ALTER TABLE public.furniture_inventories
        ADD CONSTRAINT furniture_inventories_edl_id_fkey
        FOREIGN KEY (edl_id) REFERENCES public.edl(id) ON DELETE CASCADE;
      RAISE NOTICE 'Added correct FK furniture_inventories.edl_id -> edl(id)';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'FK furniture_inventories_edl_id_fkey already exists';
    END;
  ELSE
    RAISE NOTICE 'Table furniture_inventories does not exist, skipping';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fix vetusty_reports: settlement_id references a table that doesn't exist
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'vetusty_reports'
  ) THEN
    -- Drop the broken FK on settlement_id if it exists
    DECLARE
      fk_name TEXT;
    BEGIN
      SELECT tc.constraint_name INTO fk_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'vetusty_reports'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'settlement_id'
      LIMIT 1;

      IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.vetusty_reports DROP CONSTRAINT %I', fk_name);
        RAISE NOTICE 'Dropped broken FK on vetusty_reports.settlement_id';
      END IF;
    END;

    -- Re-add FK pointing to deposit_movements if that table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = 'deposit_movements'
    ) THEN
      BEGIN
        ALTER TABLE public.vetusty_reports
          ADD CONSTRAINT vetusty_reports_settlement_id_fkey
          FOREIGN KEY (settlement_id) REFERENCES public.deposit_movements(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added FK vetusty_reports.settlement_id -> deposit_movements(id)';
      EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'FK vetusty_reports_settlement_id_fkey already exists';
      WHEN undefined_table THEN
        RAISE NOTICE 'deposit_movements table not found, leaving settlement_id as plain UUID';
      END;
    END IF;

    -- Add missing indexes on FK columns
    CREATE INDEX IF NOT EXISTS idx_vetusty_reports_edl_entry ON public.vetusty_reports(edl_entry_id);
    CREATE INDEX IF NOT EXISTS idx_vetusty_reports_edl_exit ON public.vetusty_reports(edl_exit_id);
    CREATE INDEX IF NOT EXISTS idx_vetusty_reports_validated_by ON public.vetusty_reports(validated_by);
    CREATE INDEX IF NOT EXISTS idx_vetusty_reports_created_by ON public.vetusty_reports(created_by);

    RAISE NOTICE 'Added missing indexes on vetusty_reports';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Fix RLS policies: owner_id vs auth.uid() mismatch
-- The correct pattern: JOIN profiles to compare user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

-- 5a. Fix vetusty_reports RLS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_reports') THEN
    -- Drop existing broken policies
    DROP POLICY IF EXISTS "vetusty_reports_owner_select" ON public.vetusty_reports;
    DROP POLICY IF EXISTS "vetusty_reports_owner_insert" ON public.vetusty_reports;
    DROP POLICY IF EXISTS "vetusty_reports_owner_update" ON public.vetusty_reports;
    DROP POLICY IF EXISTS "vetusty_reports_owner_delete" ON public.vetusty_reports;
    DROP POLICY IF EXISTS "vetusty_reports_tenant_select" ON public.vetusty_reports;
    DROP POLICY IF EXISTS "vetusty_reports_admin_all" ON public.vetusty_reports;

    -- Recreate with correct join pattern
    CREATE POLICY "vetusty_reports_owner_select" ON public.vetusty_reports
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.leases l
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE l.id = vetusty_reports.lease_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "vetusty_reports_owner_insert" ON public.vetusty_reports
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.leases l
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE l.id = vetusty_reports.lease_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "vetusty_reports_owner_update" ON public.vetusty_reports
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.leases l
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE l.id = vetusty_reports.lease_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "vetusty_reports_owner_delete" ON public.vetusty_reports
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.leases l
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE l.id = vetusty_reports.lease_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "vetusty_reports_tenant_select" ON public.vetusty_reports
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.leases l
          JOIN public.profiles pr ON pr.id = l.tenant_id
          WHERE l.id = vetusty_reports.lease_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "vetusty_reports_admin_all" ON public.vetusty_reports
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
        )
      );

    RAISE NOTICE 'Fixed RLS policies on vetusty_reports';
  END IF;
END $$;

-- 5b. Fix vetusty_items RLS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_items') THEN
    DROP POLICY IF EXISTS "vetusty_items_owner_select" ON public.vetusty_items;
    DROP POLICY IF EXISTS "vetusty_items_owner_insert" ON public.vetusty_items;
    DROP POLICY IF EXISTS "vetusty_items_owner_update" ON public.vetusty_items;
    DROP POLICY IF EXISTS "vetusty_items_owner_delete" ON public.vetusty_items;
    DROP POLICY IF EXISTS "vetusty_items_tenant_select" ON public.vetusty_items;
    DROP POLICY IF EXISTS "vetusty_items_admin_all" ON public.vetusty_items;

    CREATE POLICY "vetusty_items_owner_select" ON public.vetusty_items
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.vetusty_reports vr
          JOIN public.leases l ON l.id = vr.lease_id
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE vr.id = vetusty_items.report_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "vetusty_items_owner_insert" ON public.vetusty_items
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.vetusty_reports vr
          JOIN public.leases l ON l.id = vr.lease_id
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE vr.id = vetusty_items.report_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "vetusty_items_owner_update" ON public.vetusty_items
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.vetusty_reports vr
          JOIN public.leases l ON l.id = vr.lease_id
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE vr.id = vetusty_items.report_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "vetusty_items_owner_delete" ON public.vetusty_items
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.vetusty_reports vr
          JOIN public.leases l ON l.id = vr.lease_id
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE vr.id = vetusty_items.report_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "vetusty_items_tenant_select" ON public.vetusty_items
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.vetusty_reports vr
          JOIN public.leases l ON l.id = vr.lease_id
          JOIN public.profiles pr ON pr.id = l.tenant_id
          WHERE vr.id = vetusty_items.report_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "vetusty_items_admin_all" ON public.vetusty_items
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
        )
      );

    -- Add missing FK constraints on vetusty_items
    BEGIN
      ALTER TABLE public.vetusty_items
        ADD CONSTRAINT vetusty_items_edl_entry_item_fkey
        FOREIGN KEY (edl_entry_item_id) REFERENCES public.edl_items(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    END;

    BEGIN
      ALTER TABLE public.vetusty_items
        ADD CONSTRAINT vetusty_items_edl_exit_item_fkey
        FOREIGN KEY (edl_exit_item_id) REFERENCES public.edl_items(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
    END;

    RAISE NOTICE 'Fixed RLS policies on vetusty_items';
  END IF;
END $$;

-- 5c. Fix furniture_inventories RLS (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_inventories') THEN
    DROP POLICY IF EXISTS "furniture_inventories_owner_select" ON public.furniture_inventories;
    DROP POLICY IF EXISTS "furniture_inventories_owner_insert" ON public.furniture_inventories;
    DROP POLICY IF EXISTS "furniture_inventories_owner_update" ON public.furniture_inventories;
    DROP POLICY IF EXISTS "furniture_inventories_owner_delete" ON public.furniture_inventories;
    DROP POLICY IF EXISTS "furniture_inventories_tenant_select" ON public.furniture_inventories;
    DROP POLICY IF EXISTS "furniture_inventories_admin_all" ON public.furniture_inventories;

    CREATE POLICY "furniture_inventories_owner_select" ON public.furniture_inventories
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.leases l
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE l.id = furniture_inventories.lease_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "furniture_inventories_owner_insert" ON public.furniture_inventories
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.leases l
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE l.id = furniture_inventories.lease_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "furniture_inventories_owner_update" ON public.furniture_inventories
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.leases l
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE l.id = furniture_inventories.lease_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "furniture_inventories_tenant_select" ON public.furniture_inventories
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.leases l
          JOIN public.profiles pr ON pr.id = l.tenant_id
          WHERE l.id = furniture_inventories.lease_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "furniture_inventories_admin_all" ON public.furniture_inventories
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
        )
      );

    RAISE NOTICE 'Fixed RLS policies on furniture_inventories';
  END IF;
END $$;

-- 5d. Fix furniture_items RLS (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_items') THEN
    DROP POLICY IF EXISTS "furniture_items_owner_select" ON public.furniture_items;
    DROP POLICY IF EXISTS "furniture_items_owner_insert" ON public.furniture_items;
    DROP POLICY IF EXISTS "furniture_items_owner_update" ON public.furniture_items;
    DROP POLICY IF EXISTS "furniture_items_owner_delete" ON public.furniture_items;
    DROP POLICY IF EXISTS "furniture_items_tenant_select" ON public.furniture_items;
    DROP POLICY IF EXISTS "furniture_items_admin_all" ON public.furniture_items;

    CREATE POLICY "furniture_items_owner_select" ON public.furniture_items
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.furniture_inventories fi
          JOIN public.leases l ON l.id = fi.lease_id
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE fi.id = furniture_items.inventory_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "furniture_items_owner_insert" ON public.furniture_items
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.furniture_inventories fi
          JOIN public.leases l ON l.id = fi.lease_id
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE fi.id = furniture_items.inventory_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "furniture_items_owner_update" ON public.furniture_items
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.furniture_inventories fi
          JOIN public.leases l ON l.id = fi.lease_id
          JOIN public.properties p ON p.id = l.property_id
          JOIN public.profiles pr ON pr.id = p.owner_id
          WHERE fi.id = furniture_items.inventory_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "furniture_items_tenant_select" ON public.furniture_items
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.furniture_inventories fi
          JOIN public.leases l ON l.id = fi.lease_id
          JOIN public.profiles pr ON pr.id = l.tenant_id
          WHERE fi.id = furniture_items.inventory_id AND pr.user_id = auth.uid()
        )
      );

    CREATE POLICY "furniture_items_admin_all" ON public.furniture_items
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
        )
      );

    RAISE NOTICE 'Fixed RLS policies on furniture_items';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Add missing indexes on FK columns across the schema
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_edl_signatures_signer_profile ON public.edl_signatures(signer_profile_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Trigger: auto-set entity_id on EDL creation from lease/property
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_edl_entity_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set if entity_id is NULL
  IF NEW.entity_id IS NULL AND NEW.lease_id IS NOT NULL THEN
    -- Try from lease.signatory_entity_id first
    SELECT signatory_entity_id INTO NEW.entity_id
    FROM public.leases WHERE id = NEW.lease_id;
  END IF;

  IF NEW.entity_id IS NULL AND NEW.property_id IS NOT NULL THEN
    -- Fallback to property.legal_entity_id
    SELECT legal_entity_id INTO NEW.entity_id
    FROM public.properties WHERE id = NEW.property_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_edl_entity_id ON public.edl;
CREATE TRIGGER trigger_set_edl_entity_id
  BEFORE INSERT ON public.edl
  FOR EACH ROW
  EXECUTE FUNCTION public.set_edl_entity_id();

-- ─────────────────────────────────────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  RAISE NOTICE '=== Migration 20260207100000_fix_audit_critical_issues completed successfully ===';
END $$;
