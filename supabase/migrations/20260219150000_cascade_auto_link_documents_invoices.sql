-- =====================================================
-- MIGRATION: Cascade auto-link to documents & fix invoice generation
-- Date: 2026-02-19
--
-- PROBLÈMES CORRIGÉS:
-- 1. Quand auto_link_lease_signers relie un profil, les documents
--    du bail restent avec tenant_id=NULL → locataire ne voit pas ses docs
-- 2. generate_monthly_invoices() échoue si profile_id est NULL
--    dans lease_signers (INSERT violates NOT NULL constraint)
-- 3. Documents existants jamais reliés au locataire
--
-- SOLUTION:
-- A. Enrichir auto_link trigger pour cascader vers documents
-- B. Fix generate_monthly_invoices avec garde NULL
-- C. Repair one-shot des documents orphelins
-- =====================================================

BEGIN;

-- =====================================================
-- A. ENRICHIR AUTO-LINK: Cascader aux documents
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
  docs_linked INT := 0;
  rec RECORD;
BEGIN
  -- Récupérer l'email de l'utilisateur auth
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  -- 1. Lier tous les lease_signers orphelins avec cet email
  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)',
      linked_count, NEW.id, user_email;

    -- 2. ✅ NOUVEAU: Cascader aux documents — relier tous les documents
    --    des baux où ce locataire est signataire
    UPDATE public.documents d
    SET tenant_id = NEW.id
    FROM public.lease_signers ls
    WHERE ls.profile_id = NEW.id
      AND ls.role IN ('locataire_principal', 'locataire', 'colocataire')
      AND d.lease_id = ls.lease_id
      AND d.tenant_id IS NULL;

    GET DIAGNOSTICS docs_linked = ROW_COUNT;
    IF docs_linked > 0 THEN
      RAISE NOTICE '[auto_link] % documents reliés au locataire % (baux associés)',
        docs_linked, NEW.id;
    END IF;

    -- 3. Aussi relier les documents de la propriété (diagnostics, etc.)
    UPDATE public.documents d
    SET tenant_id = NEW.id
    FROM public.lease_signers ls
    JOIN public.leases l ON l.id = ls.lease_id
    WHERE ls.profile_id = NEW.id
      AND ls.role IN ('locataire_principal', 'locataire', 'colocataire')
      AND d.property_id = l.property_id
      AND d.lease_id IS NULL
      AND d.tenant_id IS NULL;

    -- 4. Notifier chaque propriétaire concerné
    FOR rec IN
      SELECT DISTINCT
        p_owner.id AS owner_profile_id,
        p_owner.user_id AS owner_user_id,
        prop.adresse_complete AS property_address,
        l.id AS lease_id
      FROM public.lease_signers ls
      JOIN public.leases l ON l.id = ls.lease_id
      JOIN public.properties prop ON prop.id = l.property_id
      JOIN public.profiles p_owner ON p_owner.id = prop.owner_id
      WHERE ls.profile_id = NEW.id
        AND ls.role IN ('locataire_principal', 'colocataire')
    LOOP
      INSERT INTO public.notifications (
        user_id,
        profile_id,
        type,
        title,
        body,
        is_read,
        read,
        metadata
      ) VALUES (
        rec.owner_user_id,
        rec.owner_profile_id,
        'tenant_account_created',
        'Locataire inscrit',
        format('%s a créé son compte pour le bail au %s. Son profil est maintenant visible dans votre liste de locataires.',
          user_email, COALESCE(rec.property_address, 'adresse non renseignée')),
        false,
        false,
        jsonb_build_object(
          'lease_id', rec.lease_id,
          'tenant_email', user_email,
          'tenant_profile_id', NEW.id,
          'action_url', format('/owner/leases/%s', rec.lease_id)
        )
      );
      RAISE NOTICE '[auto_link] Notification créée pour propriétaire % (bail %)',
        rec.owner_profile_id, rec.lease_id;
    END LOOP;
  END IF;

  -- 5. Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- B. FIX generate_monthly_invoices: ignorer les baux sans profile_id
-- =====================================================
CREATE OR REPLACE FUNCTION generate_monthly_invoices(p_target_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_skipped INT := 0;
  v_lease RECORD;
  v_result JSONB;
BEGIN
  -- Vérifier le format du mois (YYYY-MM)
  IF p_target_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Format de mois invalide. Attendu: YYYY-MM';
  END IF;

  -- Parcourir tous les baux actifs qui n'ont pas encore de facture pour ce mois
  -- FIX: Filtrer ls.profile_id IS NOT NULL pour éviter INSERT avec tenant_id=NULL
  FOR v_lease IN
    SELECT
      l.id as lease_id,
      l.property_id,
      p.owner_id,
      ls.profile_id as tenant_id,
      l.loyer,
      l.charges_forfaitaires
    FROM leases l
    JOIN properties p ON p.id = l.property_id
    JOIN lease_signers ls ON ls.lease_id = l.id
      AND ls.role IN ('locataire', 'locataire_principal')
      AND ls.profile_id IS NOT NULL
    WHERE l.statut = 'active'
    AND l.date_debut <= (p_target_month || '-01')::DATE
    AND (l.date_fin IS NULL OR l.date_fin >= (p_target_month || '-01')::DATE)
    AND NOT EXISTS (
      SELECT 1 FROM invoices
      WHERE lease_id = l.id
      AND periode = p_target_month
    )
  LOOP
    INSERT INTO invoices (
      lease_id,
      owner_id,
      tenant_id,
      periode,
      montant_loyer,
      montant_charges,
      montant_total,
      statut,
      created_at
    ) VALUES (
      v_lease.lease_id,
      v_lease.owner_id,
      v_lease.tenant_id,
      p_target_month,
      v_lease.loyer,
      v_lease.charges_forfaitaires,
      v_lease.loyer + v_lease.charges_forfaitaires,
      'sent',
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  -- Compter les baux actifs sans tenant_id (skipped)
  SELECT COUNT(*) INTO v_skipped
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
    AND ls.role IN ('locataire', 'locataire_principal')
  WHERE l.statut = 'active'
    AND ls.profile_id IS NULL
    AND l.date_debut <= (p_target_month || '-01')::DATE
    AND (l.date_fin IS NULL OR l.date_fin >= (p_target_month || '-01')::DATE);

  IF v_skipped > 0 THEN
    RAISE WARNING '[generate_monthly_invoices] % baux actifs ignorés car profile_id NULL dans lease_signers', v_skipped;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'month', p_target_month,
    'generated_count', v_count,
    'skipped_no_tenant', v_skipped
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_monthly_invoices IS 'Génère les factures de loyer pour tous les baux actifs pour un mois donné (YYYY-MM). Ignore les baux sans profile_id locataire.';

-- =====================================================
-- C. REPAIR ONE-SHOT: Relier les documents orphelins existants
-- =====================================================
DO $$
DECLARE
  repaired_count INT := 0;
BEGIN
  -- Relier les documents du bail qui ont un tenant_id NULL
  -- mais dont le bail a un locataire avec profile_id renseigné
  UPDATE public.documents d
  SET tenant_id = ls.profile_id
  FROM public.lease_signers ls
  WHERE d.lease_id = ls.lease_id
    AND ls.role IN ('locataire_principal', 'locataire')
    AND ls.profile_id IS NOT NULL
    AND d.tenant_id IS NULL;

  GET DIAGNOSTICS repaired_count = ROW_COUNT;
  IF repaired_count > 0 THEN
    RAISE NOTICE '[repair] % documents reliés à leur locataire via lease_signers', repaired_count;
  END IF;

  -- Aussi relier les documents propriété aux locataires actifs
  UPDATE public.documents d
  SET tenant_id = ls.profile_id
  FROM public.leases l
  JOIN public.lease_signers ls ON ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'locataire')
    AND ls.profile_id IS NOT NULL
  WHERE d.property_id = l.property_id
    AND d.lease_id IS NULL
    AND d.tenant_id IS NULL
    AND l.statut IN ('active', 'fully_signed');

  GET DIAGNOSTICS repaired_count = ROW_COUNT;
  IF repaired_count > 0 THEN
    RAISE NOTICE '[repair] % documents propriété reliés aux locataires actifs', repaired_count;
  END IF;
END $$;

COMMIT;
