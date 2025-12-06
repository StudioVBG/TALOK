-- ============================================
-- Migration: Fix Remaining Issues
-- Date: 2024-12-04
-- Issues: 
--   1. Missing get_owner_lease_end_processes function
--   2. RLS policies on tickets
-- ============================================

-- ============================================
-- 1. CREATE OR UPDATE END_OF_LEASE_PROCESSES TABLE
-- ============================================

-- Create table if not exists (base structure)
CREATE TABLE IF NOT EXISTS end_of_lease_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add owner_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'owner_id') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN owner_id UUID REFERENCES profiles(id);
  END IF;
  
  -- Add tenant_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'tenant_id') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN tenant_id UUID REFERENCES profiles(id);
  END IF;
  
  -- Add notice_date column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'notice_date') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN notice_date DATE;
  END IF;
  
  -- Add expected_end_date column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'expected_end_date') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN expected_end_date DATE;
  END IF;
  
  -- Add actual_end_date column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'actual_end_date') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN actual_end_date DATE;
  END IF;
  
  -- Add EDL columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'edl_sortie_id') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN edl_sortie_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'edl_sortie_date') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN edl_sortie_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'edl_sortie_status') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN edl_sortie_status TEXT;
  END IF;
  
  -- Add deposit columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'deposit_amount') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN deposit_amount DECIMAL(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'deposit_deductions') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN deposit_deductions DECIMAL(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'deposit_refund_amount') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN deposit_refund_amount DECIMAL(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'deposit_refund_date') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN deposit_refund_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'deposit_status') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN deposit_status TEXT;
  END IF;
  
  -- Add document columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'key_return_date') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN key_return_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'meter_readings_completed') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN meter_readings_completed BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add notes column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'end_of_lease_processes' AND column_name = 'notes') THEN
    ALTER TABLE end_of_lease_processes ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Index for fast lookups (only if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'end_of_lease_processes' AND column_name = 'owner_id') THEN
    CREATE INDEX IF NOT EXISTS idx_end_of_lease_owner ON end_of_lease_processes(owner_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_end_of_lease_status ON end_of_lease_processes(status);
CREATE INDEX IF NOT EXISTS idx_end_of_lease_lease ON end_of_lease_processes(lease_id);

-- ============================================
-- 2. CREATE get_owner_lease_end_processes FUNCTION
-- ============================================
-- Drop existing function first to allow schema change
DROP FUNCTION IF EXISTS public.get_owner_lease_end_processes(UUID);

CREATE OR REPLACE FUNCTION public.get_owner_lease_end_processes(p_owner_id UUID)
RETURNS TABLE (
  id UUID,
  lease_id UUID,
  property_id UUID,
  tenant_id UUID,
  status TEXT,
  notice_date DATE,
  expected_end_date DATE,
  actual_end_date DATE,
  edl_sortie_status TEXT,
  deposit_status TEXT,
  deposit_refund_amount DECIMAL,
  created_at TIMESTAMPTZ,
  -- Joined data
  property_address TEXT,
  tenant_name TEXT,
  tenant_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eol.id,
    eol.lease_id,
    eol.property_id,
    eol.tenant_id,
    eol.status,
    eol.notice_date,
    eol.expected_end_date,
    eol.actual_end_date,
    eol.edl_sortie_status,
    eol.deposit_status,
    eol.deposit_refund_amount,
    eol.created_at,
    p.adresse_complete AS property_address,
    CONCAT(pr.prenom, ' ', pr.nom) AS tenant_name,
    pr.email AS tenant_email
  FROM end_of_lease_processes eol
  JOIN properties p ON p.id = eol.property_id
  LEFT JOIN profiles pr ON pr.id = eol.tenant_id
  WHERE eol.owner_id = p_owner_id
  ORDER BY eol.expected_end_date ASC;
END;
$$;

-- ============================================
-- 3. RLS POLICIES FOR END_OF_LEASE_PROCESSES
-- ============================================
ALTER TABLE end_of_lease_processes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Owners can view their end of lease processes" ON end_of_lease_processes;
DROP POLICY IF EXISTS "Owners can manage their end of lease processes" ON end_of_lease_processes;
DROP POLICY IF EXISTS "Admins full access on end_of_lease" ON end_of_lease_processes;

-- Owners can view their processes
CREATE POLICY "Owners can view their end of lease processes"
ON end_of_lease_processes FOR SELECT
TO authenticated
USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Owners can insert/update their processes
CREATE POLICY "Owners can manage their end of lease processes"
ON end_of_lease_processes FOR ALL
TO authenticated
USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
WITH CHECK (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Admins have full access
CREATE POLICY "Admins full access on end_of_lease"
ON end_of_lease_processes FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- ============================================
-- 4. SIMPLIFY TICKETS RLS
-- ============================================

-- Drop ALL existing ticket policies to start fresh
DROP POLICY IF EXISTS "tickets_owner_select" ON tickets;
DROP POLICY IF EXISTS "tickets_owner_insert" ON tickets;
DROP POLICY IF EXISTS "tickets_owner_update" ON tickets;
DROP POLICY IF EXISTS "tickets_tenant_select" ON tickets;
DROP POLICY IF EXISTS "tickets_tenant_insert" ON tickets;
DROP POLICY IF EXISTS "tickets_admin_all" ON tickets;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON tickets;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON tickets;
DROP POLICY IF EXISTS "Enable update for ticket creators and owners" ON tickets;
DROP POLICY IF EXISTS "Enable delete for ticket creators and admins" ON tickets;
-- Drop the policies we're about to create (in case they already exist)
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;
DROP POLICY IF EXISTS "tickets_update_policy" ON tickets;
DROP POLICY IF EXISTS "tickets_delete_policy" ON tickets;

-- Disable then re-enable RLS
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Simple SELECT policy: user can see tickets they created OR for properties they own
CREATE POLICY "tickets_select_policy" ON tickets FOR SELECT TO authenticated
USING (
  -- Creator can see their tickets
  created_by_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR
  -- Owner can see tickets on their properties
  property_id IN (SELECT id FROM properties WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  OR
  -- Admin sees all
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- INSERT: authenticated users can create tickets
CREATE POLICY "tickets_insert_policy" ON tickets FOR INSERT TO authenticated
WITH CHECK (
  created_by_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- UPDATE: creator or property owner can update
CREATE POLICY "tickets_update_policy" ON tickets FOR UPDATE TO authenticated
USING (
  created_by_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR
  property_id IN (SELECT id FROM properties WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  OR
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- DELETE: only creator or admin
CREATE POLICY "tickets_delete_policy" ON tickets FOR DELETE TO authenticated
USING (
  created_by_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 5. GRANT EXECUTE ON FUNCTION
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_owner_lease_end_processes(UUID) TO authenticated;

-- ============================================
-- DONE
-- ============================================

