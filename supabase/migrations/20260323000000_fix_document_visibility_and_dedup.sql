-- Migration: Fix document visibility RLS + add deduplication constraint
-- 1) RLS: tenant_id match must also respect visible_tenant
-- 2) Unique partial index to prevent duplicate quittances per payment
-- 3) Unique partial index to prevent duplicate attestations per handover

-- ============================================================
-- 1. Fix RLS: tenant with tenant_id = user MUST still respect visible_tenant
-- Previously: tenant_id = user_profile_id() bypassed visible_tenant = false
-- ============================================================

DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON documents;

CREATE POLICY "Tenants can read visible lease documents"
  ON documents FOR SELECT
  USING (
    -- Tenant direct match: must respect visible_tenant
    (
      tenant_id = public.user_profile_id()
      AND visible_tenant IS NOT FALSE
    )
    -- Tenant via lease signer: must respect visible_tenant
    OR (
      visible_tenant = true
      AND lease_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM lease_signers ls
        JOIN profiles p ON p.id = ls.profile_id
        WHERE ls.lease_id = documents.lease_id
          AND p.id = public.user_profile_id()
          AND ls.role IN ('locataire_principal', 'locataire', 'colocataire')
      )
    )
    -- Owner direct match
    OR owner_id = public.user_profile_id()
    -- Owner via property
    OR (
      property_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = documents.property_id
          AND p.owner_id = public.user_profile_id()
      )
    )
    -- Admin
    OR public.user_role() = 'admin'
  );

-- ============================================================
-- 2. Unique partial index: one quittance per payment_id
-- Prevents race-condition duplicates in receipt generation
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_quittance_payment
  ON documents ((metadata->>'payment_id'))
  WHERE type = 'quittance'
    AND metadata->>'payment_id' IS NOT NULL;

-- ============================================================
-- 3. Unique partial index: one attestation per handover_id
-- Prevents duplicate key handover attestations
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_attestation_handover
  ON documents ((metadata->>'handover_id'))
  WHERE type = 'attestation_remise_cles'
    AND metadata->>'handover_id' IS NOT NULL;

-- ============================================================
-- 4. Index for document-access helper: lookup by storage_path
-- Used by the unified access check when path doesn't match known patterns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_documents_storage_path
  ON documents (storage_path)
  WHERE storage_path IS NOT NULL;
