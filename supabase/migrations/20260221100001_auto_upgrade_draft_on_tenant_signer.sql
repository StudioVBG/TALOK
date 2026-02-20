-- =====================================================
-- MIGRATION: Auto-upgrade baux draft + fix rétroactif complet
-- Date: 2026-02-21
--
-- PROBLÈMES CORRIGÉS:
--   1. Trigger: quand un signataire locataire est ajouté à un bail 'draft',
--      passer automatiquement le bail en 'pending_signature'
--   2. Fix rétroactif A: re-lier les lease_signers orphelins (invited_email match)
--   3. Fix rétroactif B: upgrader les baux draft qui ont déjà un locataire
--   4. Fix rétroactif C: créer les lease_signers manquants depuis edl_signatures
--   5. Audit: vérifier qu'aucun bail ne reste à demi connecté
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-upgrade draft → pending_signature
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_upgrade_draft_lease_on_signer()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand un signataire locataire est ajouté, upgrader le bail draft
  IF NEW.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire') THEN
    UPDATE public.leases
    SET statut = 'pending_signature', updated_at = NOW()
    WHERE id = NEW.lease_id
      AND statut = 'draft';
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'INSERT du signer
  RAISE WARNING '[auto_upgrade_draft] Erreur non-bloquante: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_upgrade_draft_lease_on_signer() IS
'SOTA 2026: Quand un signataire locataire est ajouté à un bail draft, passe le bail en pending_signature automatiquement.';

-- ============================================
-- 2. TRIGGER: Exécuter après chaque INSERT sur lease_signers
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_upgrade_draft_on_signer ON public.lease_signers;

CREATE TRIGGER trigger_auto_upgrade_draft_on_signer
  AFTER INSERT ON public.lease_signers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_upgrade_draft_lease_on_signer();

-- ============================================
-- 3. FIX RÉTROACTIF A: Re-lier les lease_signers orphelins
--    (invited_email correspond à un compte existant mais profile_id est NULL)
-- ============================================
DO $$
DECLARE
  linked_total INT := 0;
BEGIN
  UPDATE public.lease_signers ls
  SET profile_id = p.id
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
    AND ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND TRIM(ls.invited_email) != ''
    AND ls.invited_email NOT LIKE '%@a-definir%'
    AND ls.invited_email NOT LIKE '%@placeholder%';

  GET DIAGNOSTICS linked_total = ROW_COUNT;

  IF linked_total > 0 THEN
    RAISE NOTICE '[fix_A] % lease_signers orphelins re-liés à un profil existant', linked_total;
  ELSE
    RAISE NOTICE '[fix_A] Aucun lease_signer orphelin à re-lier';
  END IF;
END $$;

-- ============================================
-- 4. FIX RÉTROACTIF B: Upgrader les baux draft qui ont un locataire
-- ============================================
DO $$
DECLARE
  upgraded_count INT := 0;
BEGIN
  UPDATE public.leases
  SET statut = 'pending_signature', updated_at = NOW()
  WHERE statut = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = leases.id
    AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
  );

  GET DIAGNOSTICS upgraded_count = ROW_COUNT;

  IF upgraded_count > 0 THEN
    RAISE NOTICE '[fix_B] % baux draft upgradés en pending_signature', upgraded_count;
  ELSE
    RAISE NOTICE '[fix_B] Aucun bail draft avec locataire à upgrader';
  END IF;
END $$;

-- ============================================
-- 5. FIX RÉTROACTIF C: Créer les lease_signers manquants
--    depuis les edl_signatures (EDL a un locataire mais le bail n'a pas le signer)
-- ============================================
DO $$
DECLARE
  created_count INT := 0;
BEGIN
  INSERT INTO public.lease_signers (lease_id, profile_id, role, signature_status, invited_email, invited_name)
  SELECT DISTINCT ON (e.lease_id)
    e.lease_id,
    es.signer_profile_id,
    'locataire_principal',
    'pending',
    es.signer_email,
    es.signer_name
  FROM public.edl e
  JOIN public.edl_signatures es ON es.edl_id = e.id
  WHERE es.signer_role IN ('tenant', 'locataire', 'locataire_principal')
    AND e.lease_id IS NOT NULL
    -- Le bail n'a pas déjà un signer locataire
    AND NOT EXISTS (
      SELECT 1 FROM public.lease_signers ls
      WHERE ls.lease_id = e.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
    )
    -- Le signer a au moins un profil ou un email valide
    AND (
      es.signer_profile_id IS NOT NULL
      OR (es.signer_email IS NOT NULL AND TRIM(es.signer_email) != '' AND es.signer_email NOT LIKE '%@a-definir%')
    )
  ORDER BY e.lease_id, e.created_at DESC;

  GET DIAGNOSTICS created_count = ROW_COUNT;

  IF created_count > 0 THEN
    RAISE NOTICE '[fix_C] % lease_signers créés depuis edl_signatures', created_count;
  ELSE
    RAISE NOTICE '[fix_C] Aucun lease_signer manquant à créer depuis les EDL';
  END IF;
END $$;

-- ============================================
-- 6. AUDIT: Vérifier l'état final
-- ============================================
DO $$
DECLARE
  orphan_signers INT;
  draft_with_tenant INT;
  leases_without_tenant INT;
BEGIN
  -- Signataires orphelins restants (profile_id NULL, email valide, pas placeholder)
  SELECT count(*)::INT INTO orphan_signers
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND TRIM(invited_email) != ''
    AND invited_email NOT LIKE '%@a-definir%'
    AND invited_email NOT LIKE '%@placeholder%';

  -- Baux draft avec un locataire (ne devrait plus en avoir)
  SELECT count(*)::INT INTO draft_with_tenant
  FROM public.leases l
  WHERE l.statut = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
  );

  -- Baux non-draft sans signataire locataire
  SELECT count(*)::INT INTO leases_without_tenant
  FROM public.leases l
  WHERE l.statut NOT IN ('draft', 'terminated', 'cancelled', 'archived')
  AND NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
  );

  RAISE NOTICE '=== AUDIT RÉSULTAT ===';
  RAISE NOTICE 'Signataires orphelins (email sans compte): %', orphan_signers;
  RAISE NOTICE 'Baux draft avec locataire (devrait être 0): %', draft_with_tenant;
  RAISE NOTICE 'Baux actifs sans locataire: %', leases_without_tenant;

  IF draft_with_tenant = 0 THEN
    RAISE NOTICE '✅ Aucun bail draft à demi connecté';
  ELSE
    RAISE WARNING '⚠️  % baux draft ont encore un locataire — vérifier manuellement', draft_with_tenant;
  END IF;
END $$;

COMMIT;
