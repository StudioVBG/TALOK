-- =====================================================
-- MIGRATION SOTA 2026: Auto-complétion des FK documents
-- Date: 2026-02-23
--
-- PROBLÈME CORRIGÉ:
--   Quand un document est créé avec seulement lease_id,
--   property_id et owner_id restent NULL → le propriétaire ne le voit pas.
--   Inversement, un document créé par le propriétaire sans tenant_id
--   empêche le locataire de le voir via tenant_id direct.
--
-- FIX:
--   1. Trigger BEFORE INSERT/UPDATE : auto-remplit property_id depuis lease_id,
--      owner_id depuis property_id, tenant_id depuis lease_signers.
--   2. Fix rétroactif : corrige les documents existants.
--
-- SÉCURITÉ:
--   - Exception handler non-bloquant (ne casse jamais l'INSERT/UPDATE)
--   - SECURITY DEFINER pour accéder aux tables liées sans RLS
--   - Additive : ne supprime ni ne modifie aucun trigger existant
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-complétion des FK documents
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_fill_document_fk()
RETURNS TRIGGER AS $$
BEGIN
  -- Étape 1 : Dériver property_id depuis lease_id
  IF NEW.property_id IS NULL AND NEW.lease_id IS NOT NULL THEN
    SELECT COALESCE(property_id, (SELECT property_id FROM units WHERE id = unit_id))
    INTO NEW.property_id
    FROM public.leases
    WHERE id = NEW.lease_id;
  END IF;

  -- Étape 2 : Dériver owner_id depuis property_id
  IF NEW.owner_id IS NULL AND NEW.property_id IS NOT NULL THEN
    SELECT owner_id INTO NEW.owner_id
    FROM public.properties
    WHERE id = NEW.property_id;
  END IF;

  -- Étape 3 : Dériver tenant_id depuis lease_signers (locataire principal)
  IF NEW.tenant_id IS NULL AND NEW.lease_id IS NOT NULL THEN
    SELECT ls.profile_id INTO NEW.tenant_id
    FROM public.lease_signers ls
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'locataire', 'tenant')
      AND ls.profile_id IS NOT NULL
    ORDER BY ls.created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_fill_document_fk] Non-blocking error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.auto_fill_document_fk() IS
  'SOTA 2026: Auto-remplit property_id (depuis lease), owner_id (depuis property), et tenant_id (depuis lease_signers) pour garantir la visibilité inter-comptes des documents.';

-- ============================================
-- 2. TRIGGER: Exécuter BEFORE INSERT OR UPDATE sur documents
--    (s''exécute avant les triggers search_vector, ged_status, etc.)
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_fill_document_fk ON public.documents;

CREATE TRIGGER trigger_auto_fill_document_fk
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_document_fk();

-- ============================================
-- 3. FIX RÉTROACTIF A : property_id depuis lease_id
-- ============================================
DO $$
DECLARE
  fixed_count INT;
BEGIN
  UPDATE public.documents d
  SET property_id = l.property_id
  FROM public.leases l
  WHERE d.lease_id = l.id
    AND d.property_id IS NULL
    AND l.property_id IS NOT NULL;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  IF fixed_count > 0 THEN
    RAISE NOTICE '[fix_A] % documents: property_id rempli depuis lease_id', fixed_count;
  ELSE
    RAISE NOTICE '[fix_A] Aucun document sans property_id à corriger';
  END IF;
END $$;

-- ============================================
-- 4. FIX RÉTROACTIF B : owner_id depuis property_id
-- ============================================
DO $$
DECLARE
  fixed_count INT;
BEGIN
  UPDATE public.documents d
  SET owner_id = p.owner_id
  FROM public.properties p
  WHERE d.property_id = p.id
    AND d.owner_id IS NULL
    AND p.owner_id IS NOT NULL;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  IF fixed_count > 0 THEN
    RAISE NOTICE '[fix_B] % documents: owner_id rempli depuis property_id', fixed_count;
  ELSE
    RAISE NOTICE '[fix_B] Aucun document sans owner_id à corriger';
  END IF;
END $$;

-- ============================================
-- 5. FIX RÉTROACTIF C : tenant_id depuis lease_signers
-- ============================================
DO $$
DECLARE
  fixed_count INT;
BEGIN
  UPDATE public.documents d
  SET tenant_id = sub.profile_id
  FROM (
    SELECT DISTINCT ON (ls.lease_id)
      ls.lease_id,
      ls.profile_id
    FROM public.lease_signers ls
    WHERE ls.role IN ('locataire_principal', 'locataire', 'tenant')
      AND ls.profile_id IS NOT NULL
    ORDER BY ls.lease_id, ls.created_at ASC
  ) sub
  WHERE d.lease_id = sub.lease_id
    AND d.tenant_id IS NULL;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;

  IF fixed_count > 0 THEN
    RAISE NOTICE '[fix_C] % documents: tenant_id rempli depuis lease_signers', fixed_count;
  ELSE
    RAISE NOTICE '[fix_C] Aucun document sans tenant_id à corriger';
  END IF;
END $$;

-- ============================================
-- 6. AUDIT : Vérifier l'état final
-- ============================================
DO $$
DECLARE
  docs_no_owner INT;
  docs_no_property INT;
  docs_no_tenant INT;
BEGIN
  SELECT count(*)::INT INTO docs_no_owner
  FROM public.documents
  WHERE owner_id IS NULL
    AND (property_id IS NOT NULL OR lease_id IS NOT NULL);

  SELECT count(*)::INT INTO docs_no_property
  FROM public.documents
  WHERE property_id IS NULL
    AND lease_id IS NOT NULL;

  SELECT count(*)::INT INTO docs_no_tenant
  FROM public.documents
  WHERE tenant_id IS NULL
    AND lease_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM lease_signers ls
      WHERE ls.lease_id = documents.lease_id
        AND ls.role IN ('locataire_principal', 'locataire', 'tenant')
        AND ls.profile_id IS NOT NULL
    );

  RAISE NOTICE '=== AUDIT DOCUMENTS FK ===';
  RAISE NOTICE 'Documents avec property/lease mais sans owner_id: %', docs_no_owner;
  RAISE NOTICE 'Documents avec lease_id mais sans property_id: %', docs_no_property;
  RAISE NOTICE 'Documents avec bail+locataire mais sans tenant_id: %', docs_no_tenant;

  IF docs_no_owner = 0 AND docs_no_property = 0 THEN
    RAISE NOTICE '✅ Tous les documents ont des FK cohérentes';
  END IF;
END $$;

COMMIT;
