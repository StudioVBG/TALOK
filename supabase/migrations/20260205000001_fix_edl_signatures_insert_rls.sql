-- Migration: Fix edl_signatures INSERT RLS policy
-- Date: 2026-02-05
--
-- Problem:
--   The current RLS policy "EDL signatures signer create" requires:
--     WITH CHECK (signer_user = auth.uid())
--   But when creating an EDL, signatures are inserted with signer_user = NULL
--   (because the invitation flow creates signatures before the user signs).
--   This forces all INSERT operations to go through the service client (bypass RLS).
--
-- Fix:
--   Allow INSERT when:
--   1. signer_user = auth.uid() (existing behavior: user signing themselves)
--   2. The user is the EDL creator (owner injecting signataires from the lease)
--   3. The user is the property owner

BEGIN;

-- Drop the overly restrictive INSERT policy
DROP POLICY IF EXISTS "EDL signatures signer create" ON edl_signatures;

-- Create a new INSERT policy that covers all legitimate cases
CREATE POLICY "EDL signatures insert"
  ON edl_signatures FOR INSERT
  WITH CHECK (
    -- Case 1: User is signing themselves
    signer_user = auth.uid()
    OR
    -- Case 2: User is the EDL creator (owner adding signataires)
    edl_id IN (
      SELECT id FROM edl WHERE created_by = auth.uid()
    )
    OR
    -- Case 3: User is the property owner (via edl -> properties)
    edl_id IN (
      SELECT e.id FROM edl e
      JOIN properties p ON p.id = e.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Also add an UPDATE policy for the EDL creator (needed for signing flow)
DROP POLICY IF EXISTS "EDL signatures creator update" ON edl_signatures;
CREATE POLICY "EDL signatures creator update"
  ON edl_signatures FOR UPDATE
  USING (
    -- The signer themselves
    signer_user = auth.uid()
    OR
    -- The EDL creator
    edl_id IN (
      SELECT id FROM edl WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    signer_user = auth.uid()
    OR
    edl_id IN (
      SELECT id FROM edl WHERE created_by = auth.uid()
    )
  );

COMMIT;
