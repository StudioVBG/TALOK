-- =====================================================
-- MIGRATION: Index de performance pour les policies RLS
-- Date: 2026-02-16
--
-- Les policies RLS sur documents et storage.objects utilisent
-- des EXISTS avec 3 niveaux de jointure. Ces index accélèrent
-- les lookups les plus fréquents.
-- =====================================================

BEGIN;

-- ============================================
-- 1. LEASE_SIGNERS: Index composite pour lookup par profile_id + lease_id
-- Utilisé par quasi toutes les policies RLS inter-comptes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lease_signers_profile_id
  ON public.lease_signers (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email_lower
  ON public.lease_signers (LOWER(invited_email))
  WHERE invited_email IS NOT NULL AND profile_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_lease_signers_lease_profile
  ON public.lease_signers (lease_id, profile_id)
  WHERE profile_id IS NOT NULL;

-- ============================================
-- 2. DOCUMENTS: Index pour les colonnes utilisées dans les policies RLS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_documents_property_id
  ON public.documents (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_lease_id
  ON public.documents (lease_id)
  WHERE lease_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_owner_id
  ON public.documents (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_id
  ON public.documents (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_storage_path
  ON public.documents (storage_path)
  WHERE storage_path IS NOT NULL;

-- ============================================
-- 3. LEASES: Index pour lookup property_id (jointures RLS)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leases_property_id
  ON public.leases (property_id);

-- ============================================
-- 4. PROPERTIES: Index pour lookup owner_id (jointures RLS)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_properties_owner_id
  ON public.properties (owner_id);

-- ============================================
-- 5. INVOICES: Index pour filtrage par owner/tenant
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invoices_owner_id
  ON public.invoices (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id
  ON public.invoices (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_lease_id
  ON public.invoices (lease_id);

-- ============================================
-- 6. TICKETS: Index pour filtrage
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tickets_property_id
  ON public.tickets (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_created_by
  ON public.tickets (created_by_profile_id)
  WHERE created_by_profile_id IS NOT NULL;

-- ============================================
-- 7. PROFILES: Index pour lookup user_id (utilisé partout)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles (user_id);

-- ============================================
-- VÉRIFICATION
-- ============================================
DO $$
DECLARE
  idx_count INT;
BEGIN
  SELECT count(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';

  RAISE NOTICE '✅ % index de performance créés/vérifiés', idx_count;
END $$;

COMMIT;
