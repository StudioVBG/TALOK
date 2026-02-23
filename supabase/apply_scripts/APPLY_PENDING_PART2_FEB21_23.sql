-- =====================================================
-- PARTIE 2/3 — Migrations 20260221 → 20260223 (11 fichiers)
-- Date: 2026-02-23
-- Coller dans Supabase SQL Editor → Run
-- PREREQUIS: PART1 appliquée
-- =====================================================

-- === SOURCE: 20260221000002_fix_edl_signatures_rls.sql ===

-- =====================================================
-- Fix RLS edl_signatures pour invités (signer_user NULL)
-- Date: 2026-02-21
--
-- Un locataire invité par email a une ligne edl_signatures avec
-- signer_user = NULL, signer_profile_id = NULL, signer_email = son email.
-- Il doit pouvoir SELECT et UPDATE sa ligne pour signer.
-- =====================================================

BEGIN;

DROP POLICY IF EXISTS "EDL signatures creator update" ON edl_signatures;
DROP POLICY IF EXISTS "EDL signatures update" ON edl_signatures;

CREATE POLICY "EDL signatures update"
  ON edl_signatures FOR UPDATE
  USING (
    signer_user = auth.uid()
    OR signer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR (signer_email IS NOT NULL AND LOWER(TRIM(signer_email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid()))))
    OR edl_id IN (SELECT id FROM edl WHERE created_by = auth.uid())
  )
  WITH CHECK (
    signer_user = auth.uid()
    OR signer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR (signer_email IS NOT NULL AND LOWER(TRIM(signer_email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid()))))
    OR edl_id IN (SELECT id FROM edl WHERE created_by = auth.uid())
  );

COMMENT ON POLICY "EDL signatures update" ON edl_signatures IS
'SOTA 2026: Permet au signataire (uid, profile_id, ou email invité) et au créateur EDL de mettre à jour.';

COMMIT;


-- === SOURCE: 20260221100000_fix_tenant_dashboard_draft_visibility.sql ===

-- ============================================================================
-- MIGRATION: Fix tenant_dashboard — inclure les baux 'draft' pour le locataire
-- Date: 2026-02-21
--
-- PROBLÈME CORRIGÉ:
--   Le locataire ne voit pas son logement quand le bail est en statut 'draft'.
--   La RPC tenant_dashboard filtre par statut IN ('active', 'pending_signature',
--   'fully_signed', 'terminated') — excluant 'draft'.
--   Résultat: le locataire voit "Pas encore de logement" même s'il est lié au bail.
--   Il ne peut donc pas signer les éléments du bail (bail, EDL).
--
-- FIX: Ajouter 'draft' au filtre de statut.
-- ============================================================================

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_user_email TEXT;
  v_tenant_data JSONB;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_notifications JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_kyc_status TEXT := 'pending';
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil ET l'email de l'utilisateur
  SELECT p.id, u.email,
         jsonb_build_object(
           'id', p.id,
           'prenom', p.prenom,
           'nom', p.nom,
           'email', u.email,
           'telephone', p.telephone,
           'avatar_url', p.avatar_url
         )
  INTO v_profile_id, v_user_email, v_tenant_data
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = p_tenant_user_id AND p.role = 'tenant';

  IF v_profile_id IS NULL THEN
    RAISE NOTICE '[tenant_dashboard] Aucun profil trouvé pour user_id: %', p_tenant_user_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE '[tenant_dashboard] Profil trouvé: %, email: %', v_profile_id, v_user_email;

  -- 2. Récupérer TOUS les baux avec données techniques enrichies + clés + compteurs
  --    ✅ FIX: Inclure 'draft' pour que le locataire voie le bail dès qu'il est invité
  SELECT jsonb_agg(lease_data ORDER BY lease_data->>'statut' = 'active' DESC, lease_data->>'created_at' DESC)
  INTO v_leases
  FROM (
    SELECT
      jsonb_build_object(
        'id', l.id,
        'type_bail', l.type_bail,
        'statut', l.statut,
        'loyer', l.loyer,
        'charges_forfaitaires', l.charges_forfaitaires,
        'depot_de_garantie', l.depot_de_garantie,
        'date_debut', l.date_debut,
        'date_fin', l.date_fin,
        'created_at', l.created_at,
        -- Signataires complets avec profils + invited fallback
        'signers', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', ls2.id,
              'profile_id', ls2.profile_id,
              'role', ls2.role,
              'signature_status', ls2.signature_status,
              'signed_at', ls2.signed_at,
              'invited_name', ls2.invited_name,
              'invited_email', ls2.invited_email,
              'prenom', COALESCE(p_sig.prenom, SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 1)),
              'nom', COALESCE(p_sig.nom, NULLIF(SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 2), '')),
              'avatar_url', p_sig.avatar_url
            )
          ), '[]'::jsonb)
          FROM lease_signers ls2
          LEFT JOIN profiles p_sig ON p_sig.id = ls2.profile_id
          WHERE ls2.lease_id = l.id
        ),
        -- Propriété avec champs techniques complets
        'property', jsonb_build_object(
          'id', p.id,
          'owner_id', p.owner_id,
          'adresse_complete', COALESCE(p.adresse_complete, 'Adresse à compléter'),
          'ville', COALESCE(p.ville, ''),
          'code_postal', COALESCE(p.code_postal, ''),
          'type', COALESCE(p.type, 'appartement'),
          'surface', p.surface,
          'surface_habitable_m2', p.surface_habitable_m2,
          'nb_pieces', p.nb_pieces,
          'etage', p.etage,
          'ascenseur', p.ascenseur,
          'annee_construction', p.annee_construction,
          'parking_numero', p.parking_numero,
          'has_cave', p.has_cave,
          'num_lot', p.num_lot,
          'digicode', p.digicode,
          'interphone', p.interphone,
          -- DPE complet : COALESCE pour supporter ancien + nouveau nommage
          'energie', p.energie,
          'ges', p.ges,
          'dpe_classe_energie', COALESCE(p.dpe_classe_energie, p.energie),
          'dpe_classe_climat', COALESCE(p.dpe_classe_climat, p.ges),
          'dpe_consommation', p.dpe_consommation,
          'dpe_emissions', p.dpe_emissions,
          'dpe_date_realisation', p.dpe_date_realisation,
          'dpe_date_expiration', p.dpe_date_expiration,
          -- Caractéristiques techniques
          'chauffage_type', p.chauffage_type,
          'chauffage_energie', p.chauffage_energie,
          'eau_chaude_type', p.eau_chaude_type,
          'regime', p.regime,
          -- Photo de couverture
          'cover_url', (
            SELECT url FROM property_photos
            WHERE property_id = p.id AND is_main = true
            LIMIT 1
          ),
          -- Compteurs actifs avec dernière lecture
          'meters', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', m.id,
                'type', m.type,
                'serial_number', m.serial_number,
                'unit', m.unit,
                'last_reading_value', (
                  SELECT reading_value FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                ),
                'last_reading_date', (
                  SELECT reading_date FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                )
              )
            ), '[]'::jsonb)
            FROM meters m
            WHERE m.property_id = p.id AND m.is_active = true
          ),
          -- Clés depuis le dernier EDL signé ou complété
          'keys', (
            SELECT e_keys.keys
            FROM edl e_keys
            WHERE e_keys.property_id = p.id
              AND e_keys.status IN ('signed', 'completed')
              AND e_keys.keys IS NOT NULL
              AND e_keys.keys != '[]'::jsonb
            ORDER BY COALESCE(e_keys.completed_date, e_keys.created_at) DESC
            LIMIT 1
          )
        ),
        -- Propriétaire
        'owner', jsonb_build_object(
          'id', owner_prof.id,
          'name', COALESCE(
            (SELECT raison_sociale FROM owner_profiles WHERE profile_id = owner_prof.id),
            CONCAT(COALESCE(owner_prof.prenom, ''), ' ', COALESCE(owner_prof.nom, ''))
          ),
          'email', owner_prof.email,
          'telephone', owner_prof.telephone
        )
      ) as lease_data
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE
      (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
      AND l.statut IN ('draft', 'active', 'pending_signature', 'fully_signed', 'terminated')
  ) sub;

  RAISE NOTICE '[tenant_dashboard] Baux trouvés: %', COALESCE(jsonb_array_length(v_leases), 0);

  -- 3. Factures (10 dernières)
  SELECT COALESCE(jsonb_agg(invoice_data), '[]'::jsonb) INTO v_invoices
  FROM (
    SELECT
      i.id,
      i.periode,
      i.montant_total,
      i.statut,
      i.created_at,
      i.due_date,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Tickets récents (10 derniers)
  SELECT COALESCE(jsonb_agg(ticket_data), '[]'::jsonb) INTO v_tickets
  FROM (
    SELECT
      t.id,
      t.titre,
      t.description,
      t.priorite,
      t.statut,
      t.created_at,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Notifications récentes
  SELECT COALESCE(jsonb_agg(notif_data), '[]'::jsonb) INTO v_notifications
  FROM (
    SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at, n.action_url
    FROM notifications n
    WHERE n.profile_id = v_profile_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 5
  ) notif_data;

  -- 6. EDLs en attente de signature
  SELECT COALESCE(jsonb_agg(edl_data), '[]'::jsonb) INTO v_pending_edls
  FROM (
    SELECT
      e.id,
      e.type,
      e.status,
      e.scheduled_at,
      es.invitation_token,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    JOIN properties p ON p.id = e.property_id
    WHERE (es.signer_profile_id = v_profile_id OR LOWER(es.signer_email) = LOWER(v_user_email))
    AND es.signed_at IS NULL
    AND e.status IN ('draft', 'scheduled', 'in_progress', 'completed')
    ORDER BY e.created_at DESC
  ) edl_data;

  -- 7. Vérifier l'assurance
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 8. Stats globales
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(i.montant_total) FILTER (WHERE i.statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE i.statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(
      (SELECT SUM(l2.loyer + l2.charges_forfaitaires)
       FROM leases l2
       JOIN lease_signers ls2 ON ls2.lease_id = l2.id
       WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
       AND l2.statut = 'active'),
      0
    ),
    'active_leases_count', (
      SELECT COUNT(DISTINCT l2.id)
      FROM leases l2
      JOIN lease_signers ls2 ON ls2.lease_id = l2.id
      WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
      AND l2.statut = 'active'
    )
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  LEFT JOIN invoices i ON i.lease_id = l.id
  WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email));

  -- 9. KYC status
  BEGIN
    SELECT COALESCE(tp.kyc_status, 'pending') INTO v_kyc_status
    FROM tenant_profiles tp
    WHERE tp.profile_id = v_profile_id;
  EXCEPTION WHEN OTHERS THEN
    v_kyc_status := 'pending';
  END;

  -- 10. Assembler le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'tenant', v_tenant_data,
    'kyc_status', COALESCE(v_kyc_status, 'pending'),
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'lease', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN v_leases->0 ELSE NULL END,
    'property', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN (v_leases->0)->'property' ELSE NULL END,
    'invoices', v_invoices,
    'tickets', v_tickets,
    'notifications', v_notifications,
    'pending_edls', v_pending_edls,
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION tenant_dashboard(UUID) IS
'RPC dashboard locataire v5. Cherche par profile_id OU invited_email.
FIX: Inclut les baux draft pour que le locataire voie son logement dès invitation.
Inclut: signers enrichis, property complète (DPE, meters, keys), insurance, KYC status.';


-- === SOURCE: 20260221100001_auto_upgrade_draft_on_tenant_signer.sql ===

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


-- === SOURCE: 20260221200000_sync_edl_signer_to_lease_signer.sql ===

-- =====================================================
-- MIGRATION: Sync edl_signatures → lease_signers (défense en profondeur)
-- Date: 2026-02-21
--
-- PROBLÈME CORRIGÉ:
--   Quand une edl_signature tenant est créée pour un EDL lié à un bail,
--   il se peut qu'aucun lease_signers correspondant n'existe (ex: bail
--   créé en mode "manual draft"). Le locataire ne voit alors pas le bail
--   sur son dashboard car la RPC tenant_dashboard passe par lease_signers.
--
-- FIX: Trigger AFTER INSERT sur edl_signatures qui crée automatiquement
--   un lease_signers si aucun signer tenant n'existe pour le bail associé.
--   Ne bloque jamais l'INSERT original (exception handler).
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Sync edl_signature → lease_signer
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_edl_signer_to_lease_signer()
RETURNS TRIGGER AS $$
DECLARE
  v_lease_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- Uniquement pour les rôles tenant
  IF NEW.signer_role NOT IN ('tenant', 'locataire', 'locataire_principal') THEN
    RETURN NEW;
  END IF;

  -- Doit avoir au moins un email ou un profile_id
  IF NEW.signer_profile_id IS NULL AND (NEW.signer_email IS NULL OR TRIM(NEW.signer_email) = '') THEN
    RETURN NEW;
  END IF;

  -- Ignorer les emails placeholder
  IF NEW.signer_email IS NOT NULL AND (
    NEW.signer_email LIKE '%@a-definir%' OR
    NEW.signer_email LIKE '%@placeholder%'
  ) THEN
    RETURN NEW;
  END IF;

  -- Récupérer le lease_id depuis l'EDL
  SELECT lease_id INTO v_lease_id
  FROM public.edl
  WHERE id = NEW.edl_id;

  IF v_lease_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Vérifier si un signer tenant existe déjà pour ce bail
  SELECT EXISTS (
    SELECT 1 FROM public.lease_signers
    WHERE lease_id = v_lease_id
    AND role IN ('locataire_principal', 'locataire', 'tenant', 'colocataire')
  ) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, invited_name, role, signature_status)
    VALUES (v_lease_id, NEW.signer_profile_id, NEW.signer_email, NEW.signer_name, 'locataire_principal', 'pending');
    RAISE NOTICE '[sync_edl_signer] Created lease_signer for lease % from edl_signature %', v_lease_id, NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'INSERT de edl_signatures
  RAISE WARNING '[sync_edl_signer] Error (non-blocking): %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.sync_edl_signer_to_lease_signer() IS
'SOTA 2026: Quand une edl_signature tenant est créée, vérifie que le bail associé a un lease_signer locataire. Sinon, en crée un. Ne bloque jamais l''INSERT.';

-- ============================================
-- 2. TRIGGER: Exécuter après chaque INSERT sur edl_signatures
-- ============================================
DROP TRIGGER IF EXISTS trigger_sync_edl_signer_to_lease_signer ON public.edl_signatures;

CREATE TRIGGER trigger_sync_edl_signer_to_lease_signer
  AFTER INSERT ON public.edl_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_edl_signer_to_lease_signer();

COMMIT;


-- === SOURCE: 20260221300000_fix_tenant_dashboard_owner_join.sql ===

-- ============================================================================
-- MIGRATION: Fix tenant_dashboard — LEFT JOIN sur owner_prof + adresse_complete
-- Date: 2026-02-21
--
-- PROBLÈMES CORRIGÉS:
--   1. INNER JOIN sur profiles owner_prof exclut silencieusement les baux
--      si owner_id est NULL ou si le profil propriétaire n'existe pas.
--      → Changé en LEFT JOIN pour que les baux soient toujours retournés.
--
--   2. COALESCE(p.adresse_complete, 'Adresse à compléter') est inutile car
--      le frontend gère maintenant les adresses NULL/incomplètes.
--      → Remplacé par COALESCE pour retourner une chaîne vide au lieu d'un
--      placeholder qui causait des faux négatifs.
-- ============================================================================

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_user_email TEXT;
  v_tenant_data JSONB;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_notifications JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_kyc_status TEXT := 'pending';
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil ET l'email de l'utilisateur
  SELECT p.id, u.email,
         jsonb_build_object(
           'id', p.id,
           'prenom', p.prenom,
           'nom', p.nom,
           'email', u.email,
           'telephone', p.telephone,
           'avatar_url', p.avatar_url
         )
  INTO v_profile_id, v_user_email, v_tenant_data
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = p_tenant_user_id AND p.role = 'tenant';

  IF v_profile_id IS NULL THEN
    RAISE NOTICE '[tenant_dashboard] Aucun profil trouvé pour user_id: %', p_tenant_user_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE '[tenant_dashboard] Profil trouvé: %, email: %', v_profile_id, v_user_email;

  -- 2. Récupérer TOUS les baux avec données techniques enrichies + clés + compteurs
  --    ✅ FIX: LEFT JOIN sur owner_prof pour ne pas perdre les baux si le propriétaire manque
  --    ✅ FIX: Inclure 'draft' pour que le locataire voie le bail dès qu'il est invité
  SELECT jsonb_agg(lease_data ORDER BY lease_data->>'statut' = 'active' DESC, lease_data->>'created_at' DESC)
  INTO v_leases
  FROM (
    SELECT
      jsonb_build_object(
        'id', l.id,
        'type_bail', l.type_bail,
        'statut', l.statut,
        'loyer', l.loyer,
        'charges_forfaitaires', l.charges_forfaitaires,
        'depot_de_garantie', l.depot_de_garantie,
        'date_debut', l.date_debut,
        'date_fin', l.date_fin,
        'created_at', l.created_at,
        -- Signataires complets avec profils + invited fallback
        'signers', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', ls2.id,
              'profile_id', ls2.profile_id,
              'role', ls2.role,
              'signature_status', ls2.signature_status,
              'signed_at', ls2.signed_at,
              'invited_name', ls2.invited_name,
              'invited_email', ls2.invited_email,
              'prenom', COALESCE(p_sig.prenom, SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 1)),
              'nom', COALESCE(p_sig.nom, NULLIF(SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 2), '')),
              'avatar_url', p_sig.avatar_url
            )
          ), '[]'::jsonb)
          FROM lease_signers ls2
          LEFT JOIN profiles p_sig ON p_sig.id = ls2.profile_id
          WHERE ls2.lease_id = l.id
        ),
        -- Propriété avec champs techniques complets
        'property', jsonb_build_object(
          'id', p.id,
          'owner_id', p.owner_id,
          'adresse_complete', p.adresse_complete,
          'ville', COALESCE(p.ville, ''),
          'code_postal', COALESCE(p.code_postal, ''),
          'type', COALESCE(p.type, 'appartement'),
          'surface', p.surface,
          'surface_habitable_m2', p.surface_habitable_m2,
          'nb_pieces', p.nb_pieces,
          'etage', p.etage,
          'ascenseur', p.ascenseur,
          'annee_construction', p.annee_construction,
          'parking_numero', p.parking_numero,
          'has_cave', p.has_cave,
          'num_lot', p.num_lot,
          'digicode', p.digicode,
          'interphone', p.interphone,
          -- DPE complet : COALESCE pour supporter ancien + nouveau nommage
          'energie', p.energie,
          'ges', p.ges,
          'dpe_classe_energie', COALESCE(p.dpe_classe_energie, p.energie),
          'dpe_classe_climat', COALESCE(p.dpe_classe_climat, p.ges),
          'dpe_consommation', p.dpe_consommation,
          'dpe_emissions', p.dpe_emissions,
          'dpe_date_realisation', p.dpe_date_realisation,
          'dpe_date_expiration', p.dpe_date_expiration,
          -- Caractéristiques techniques
          'chauffage_type', p.chauffage_type,
          'chauffage_energie', p.chauffage_energie,
          'eau_chaude_type', p.eau_chaude_type,
          'regime', p.regime,
          -- Photo de couverture
          'cover_url', (
            SELECT url FROM property_photos
            WHERE property_id = p.id AND is_main = true
            LIMIT 1
          ),
          -- Compteurs actifs avec dernière lecture
          'meters', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', m.id,
                'type', m.type,
                'serial_number', m.serial_number,
                'unit', m.unit,
                'last_reading_value', (
                  SELECT reading_value FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                ),
                'last_reading_date', (
                  SELECT reading_date FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                )
              )
            ), '[]'::jsonb)
            FROM meters m
            WHERE m.property_id = p.id AND m.is_active = true
          ),
          -- Clés depuis le dernier EDL signé ou complété
          'keys', (
            SELECT e_keys.keys
            FROM edl e_keys
            WHERE e_keys.property_id = p.id
              AND e_keys.status IN ('signed', 'completed')
              AND e_keys.keys IS NOT NULL
              AND e_keys.keys != '[]'::jsonb
            ORDER BY COALESCE(e_keys.completed_date, e_keys.created_at) DESC
            LIMIT 1
          )
        ),
        -- Propriétaire (peut être NULL si owner_prof manquant)
        'owner', CASE
          WHEN owner_prof.id IS NOT NULL THEN
            jsonb_build_object(
              'id', owner_prof.id,
              'name', COALESCE(
                (SELECT raison_sociale FROM owner_profiles WHERE profile_id = owner_prof.id),
                CONCAT(COALESCE(owner_prof.prenom, ''), ' ', COALESCE(owner_prof.nom, ''))
              ),
              'email', owner_prof.email,
              'telephone', owner_prof.telephone
            )
          ELSE
            jsonb_build_object(
              'id', p.owner_id,
              'name', 'Propriétaire',
              'email', NULL,
              'telephone', NULL
            )
        END
      ) as lease_data
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    LEFT JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE
      (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
      AND l.statut IN ('draft', 'active', 'pending_signature', 'fully_signed', 'terminated')
  ) sub;

  RAISE NOTICE '[tenant_dashboard] Baux trouvés: %', COALESCE(jsonb_array_length(v_leases), 0);

  -- 3. Factures (10 dernières)
  SELECT COALESCE(jsonb_agg(invoice_data), '[]'::jsonb) INTO v_invoices
  FROM (
    SELECT
      i.id,
      i.periode,
      i.montant_total,
      i.statut,
      i.created_at,
      i.due_date,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Tickets récents (10 derniers)
  SELECT COALESCE(jsonb_agg(ticket_data), '[]'::jsonb) INTO v_tickets
  FROM (
    SELECT
      t.id,
      t.titre,
      t.description,
      t.priorite,
      t.statut,
      t.created_at,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Notifications récentes
  SELECT COALESCE(jsonb_agg(notif_data), '[]'::jsonb) INTO v_notifications
  FROM (
    SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at, n.action_url
    FROM notifications n
    WHERE n.profile_id = v_profile_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 5
  ) notif_data;

  -- 6. EDLs en attente de signature
  SELECT COALESCE(jsonb_agg(edl_data), '[]'::jsonb) INTO v_pending_edls
  FROM (
    SELECT
      e.id,
      e.type,
      e.status,
      e.scheduled_at,
      es.invitation_token,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    JOIN properties p ON p.id = e.property_id
    WHERE (es.signer_profile_id = v_profile_id OR LOWER(es.signer_email) = LOWER(v_user_email))
    AND es.signed_at IS NULL
    AND e.status IN ('draft', 'scheduled', 'in_progress', 'completed')
    ORDER BY e.created_at DESC
  ) edl_data;

  -- 7. Vérifier l'assurance
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 8. Stats globales
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(i.montant_total) FILTER (WHERE i.statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE i.statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(
      (SELECT SUM(l2.loyer + l2.charges_forfaitaires)
       FROM leases l2
       JOIN lease_signers ls2 ON ls2.lease_id = l2.id
       WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
       AND l2.statut = 'active'),
      0
    ),
    'active_leases_count', (
      SELECT COUNT(DISTINCT l2.id)
      FROM leases l2
      JOIN lease_signers ls2 ON ls2.lease_id = l2.id
      WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
      AND l2.statut = 'active'
    )
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  LEFT JOIN invoices i ON i.lease_id = l.id
  WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email));

  -- 9. KYC status
  BEGIN
    SELECT COALESCE(tp.kyc_status, 'pending') INTO v_kyc_status
    FROM tenant_profiles tp
    WHERE tp.profile_id = v_profile_id;
  EXCEPTION WHEN OTHERS THEN
    v_kyc_status := 'pending';
  END;

  -- 10. Assembler le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'tenant', v_tenant_data,
    'kyc_status', COALESCE(v_kyc_status, 'pending'),
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'lease', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN v_leases->0 ELSE NULL END,
    'property', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN (v_leases->0)->'property' ELSE NULL END,
    'invoices', v_invoices,
    'tickets', v_tickets,
    'notifications', v_notifications,
    'pending_edls', v_pending_edls,
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION tenant_dashboard(UUID) IS
'RPC dashboard locataire v6. Cherche par profile_id OU invited_email.
FIX: LEFT JOIN sur owner_prof pour ne pas perdre les baux si le propriétaire manque.
FIX: adresse_complete retourné tel quel (le frontend gère les NULL).
Inclut baux draft, signers enrichis, property complète (DPE, meters, keys), insurance, KYC status.';


-- === SOURCE: 20260222000000_fix_invitations_and_orphan_signers.sql ===

-- =====================================================
-- Migration: Lier les lease_signers orphelins et créer les invitations manquantes
-- Date: 2026-02-22
--
-- Contexte: Les baux créés avant l'unification des flux n'ont pas de record
-- dans la table invitations, ce qui empêche le locataire de voir/accepter
-- l'invitation. Cette migration :
-- 1. Lie les lease_signers orphelins (profile_id NULL) dont l'email correspond à un compte.
-- 2. Crée une invitation (token, email, role, lease_id, ...) pour chaque signataire
--    locataire (locataire_principal, colocataire) qui n'a pas déjà une invitation
--    valide (non utilisée) pour ce bail et cet email.
-- =====================================================

BEGIN;

-- 1. Lier les lease_signers orphelins : profile_id NULL + invited_email matche auth.users
UPDATE public.lease_signers ls
SET profile_id = p.id
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

-- 2. Créer les invitations manquantes pour les signataires locataires sans invitation utilisable
--    (une invitation par lease_id + email, avec token unique et expiration 30 jours)
INSERT INTO public.invitations (
  token,
  email,
  role,
  property_id,
  unit_id,
  lease_id,
  created_by,
  expires_at
)
SELECT
  encode(gen_random_bytes(32), 'hex') AS token,
  ls.invited_email AS email,
  ls.role::TEXT AS role,
  l.property_id AS property_id,
  l.unit_id AS unit_id,
  ls.lease_id AS lease_id,
  p.owner_id AS created_by,
  (NOW() + INTERVAL '30 days')::TIMESTAMPTZ AS expires_at
FROM public.lease_signers ls
JOIN public.leases l ON l.id = ls.lease_id
JOIN public.properties p ON p.id = l.property_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.invitations i
    WHERE i.lease_id = ls.lease_id
      AND LOWER(TRIM(i.email)) = LOWER(TRIM(ls.invited_email))
      AND i.used_at IS NULL
      AND i.expires_at > NOW()
  );

COMMIT;


-- === SOURCE: 20260222100000_repair_missing_signers_and_invitations.sql ===

-- =====================================================
-- Migration: Réparation complète — signataires manquants + invitations
-- Date: 2026-02-22
--
-- Problème : Certains baux (notamment da2eb9da) sont en fully_signed
-- mais n'ont AUCUN lease_signers, ce qui empêche l'affichage du locataire
-- et bloque le flux d'activation.
--
-- Cette migration :
-- 1. [DIAGNOSTIC] Identifie les baux signés sans signataires
-- 2. Crée le signataire PROPRIETAIRE manquant pour chaque bail signé
-- 3. Crée le signataire LOCATAIRE manquant à partir des invitations
-- 4. Lie les lease_signers orphelins (profile_id NULL) dont l'email matche un compte
-- 5. Crée les invitations manquantes pour les signataires sans invitation valide
-- =====================================================

BEGIN;

-- ========================================================
-- ÉTAPE 1 : Créer les signataires PROPRIETAIRE manquants
-- Pour tout bail en fully_signed/active/terminated sans signataire propriétaire
-- ========================================================
INSERT INTO public.lease_signers (lease_id, profile_id, role, signature_status, signed_at)
SELECT
  l.id AS lease_id,
  p.owner_id AS profile_id,
  'proprietaire' AS role,
  'signed' AS signature_status,
  COALESCE(l.sealed_at, l.updated_at, NOW()) AS signed_at
FROM public.leases l
JOIN public.properties p ON p.id = l.property_id
WHERE l.statut IN ('fully_signed', 'active', 'terminated', 'archived')
  AND NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
      AND ls.role = 'proprietaire'
  )
ON CONFLICT DO NOTHING;

-- ========================================================
-- ÉTAPE 2 : Créer les signataires LOCATAIRE PRINCIPAL manquants
-- Source prioritaire : table invitations (contient l'email du locataire invité)
-- ========================================================
INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, role, signature_status, signed_at)
SELECT DISTINCT ON (i.lease_id)
  i.lease_id,
  COALESCE(pr.id, NULL) AS profile_id,
  i.email AS invited_email,
  'locataire_principal' AS role,
  CASE
    WHEN le.statut IN ('fully_signed', 'active', 'terminated', 'archived') THEN 'signed'
    ELSE 'pending'
  END AS signature_status,
  CASE
    WHEN le.statut IN ('fully_signed', 'active', 'terminated', 'archived')
    THEN COALESCE(i.used_at, le.sealed_at, le.updated_at, NOW())
    ELSE NULL
  END AS signed_at
FROM public.invitations i
JOIN public.leases le ON le.id = i.lease_id
LEFT JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(i.email))
LEFT JOIN public.profiles pr ON pr.user_id = u.id
WHERE i.role IN ('locataire_principal', 'locataire', 'tenant')
  AND NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = i.lease_id
      AND ls.role IN ('locataire_principal', 'locataire', 'tenant')
  )
ORDER BY i.lease_id, i.created_at DESC;

-- ========================================================
-- ÉTAPE 3 : Lier les lease_signers orphelins
-- profile_id NULL + invited_email matche un compte auth.users
-- ========================================================
UPDATE public.lease_signers ls
SET profile_id = pr.id
FROM public.profiles pr
JOIN auth.users u ON u.id = pr.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

-- ========================================================
-- ÉTAPE 4 : Créer les invitations manquantes
-- Pour les signataires locataires/colocataires sans invitation valide
-- ========================================================
INSERT INTO public.invitations (
  token,
  email,
  role,
  property_id,
  unit_id,
  lease_id,
  created_by,
  expires_at
)
SELECT
  encode(gen_random_bytes(32), 'hex') AS token,
  ls.invited_email AS email,
  ls.role::TEXT AS role,
  l.property_id AS property_id,
  l.unit_id AS unit_id,
  ls.lease_id AS lease_id,
  p.owner_id AS created_by,
  (NOW() + INTERVAL '30 days')::TIMESTAMPTZ AS expires_at
FROM public.lease_signers ls
JOIN public.leases l ON l.id = ls.lease_id
JOIN public.properties p ON p.id = l.property_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(ls.invited_email)) NOT LIKE '%@a-definir%'
  AND NOT EXISTS (
    SELECT 1 FROM public.invitations i
    WHERE i.lease_id = ls.lease_id
      AND LOWER(TRIM(i.email)) = LOWER(TRIM(ls.invited_email))
      AND i.used_at IS NULL
      AND i.expires_at > NOW()
  );

-- ========================================================
-- ÉTAPE 5 : Filet de sécurité — bail da2eb9da (Thomas VOLBERG)
-- Uniquement si ce bail existe (migration de réparation production)
-- ========================================================
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM public.leases WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7') THEN

  -- 5a. Créer le locataire signer si manquant
  INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, invited_name, role, signature_status, signed_at)
  SELECT
    'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, pr.id, 'volberg.thomas@hotmail.fr', 'Thomas VOLBERG', 'locataire_principal', 'signed', NOW()
  FROM (SELECT pr2.id FROM public.profiles pr2 JOIN auth.users u ON u.id = pr2.user_id WHERE LOWER(u.email) = 'volberg.thomas@hotmail.fr' LIMIT 1) pr
  WHERE NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role IN ('locataire_principal', 'locataire', 'tenant'));

  -- 5b. Fallback signer orphelin
  INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, invited_name, role, signature_status, signed_at)
  SELECT 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, NULL, 'volberg.thomas@hotmail.fr', 'Thomas VOLBERG', 'locataire_principal', 'signed', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role IN ('locataire_principal', 'locataire', 'tenant'));

  -- 5c. Proprio signer
  INSERT INTO public.lease_signers (lease_id, profile_id, role, signature_status, signed_at)
  SELECT 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, p.owner_id, 'proprietaire', 'signed', NOW()
  FROM public.leases l JOIN public.properties p ON p.id = l.property_id
  WHERE l.id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
    AND NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role = 'proprietaire');

END IF;
END $$;

-- ========================================================
-- ÉTAPE 6 : Lier les profils tenant sans user_id à auth.users
-- (complémentaire : certains profiles ont role='tenant' mais user_id NULL)
-- ========================================================
UPDATE public.profiles p
SET user_id = u.id
FROM auth.users u
WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
  AND p.role = 'tenant'
  AND p.user_id IS NULL;

-- ========================================================
-- ÉTAPE 7 : Re-lier les lease_signers après la correction des profiles
-- (2e passe, car l'étape 6 a pu créer de nouvelles liaisons)
-- ========================================================
UPDATE public.lease_signers ls
SET profile_id = pr.id
FROM public.profiles pr
JOIN auth.users u ON u.id = pr.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

COMMIT;


-- === SOURCE: 20260222200000_ensure_all_owners_have_entity.sql ===

-- ============================================
-- Migration: S'assurer que tous les propriétaires ont une entité juridique
-- Date: 2026-02-22
-- Description:
--   Backfill idempotent : crée une entité "particulier" pour chaque owner_profiles
--   qui n'en a pas, puis lie les propriétés orphelines à l'entité par défaut.
-- Idempotent: peut être exécutée plusieurs fois sans effet secondaire.
-- ============================================

BEGIN;

-- Créer legal_entities manquantes pour les propriétaires
INSERT INTO legal_entities (owner_profile_id, entity_type, nom, regime_fiscal, is_active)
SELECT op.profile_id, 'particulier',
  COALESCE(TRIM(CONCAT(p.prenom, ' ', p.nom)), 'Patrimoine personnel'), 'ir', true
FROM owner_profiles op
JOIN profiles p ON op.profile_id = p.id
WHERE NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.owner_profile_id = op.profile_id);

-- Lier les propriétés orphelines à l'entité par défaut du propriétaire
UPDATE properties p
SET legal_entity_id = (
  SELECT le.id FROM legal_entities le
  WHERE le.owner_profile_id = p.owner_id
  ORDER BY le.created_at ASC
  LIMIT 1
)
WHERE p.legal_entity_id IS NULL
  AND p.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM legal_entities le WHERE le.owner_profile_id = p.owner_id);

COMMIT;


-- === SOURCE: 20260222200001_get_entity_stats_for_store.sql ===

-- ============================================
-- Migration: get_entity_stats aligné avec la logique du store (properties.legal_entity_id + particulier)
-- Date: 2026-02-22
-- Description:
--   Remplace get_entity_stats pour compter comme le store front :
--   - Biens : properties.legal_entity_id = entity OU (particulier et legal_entity_id IS NULL)
--   - Baux actifs : signatory_entity_id = entity, statut in (active, pending_signature, fully_signed)
-- ============================================

CREATE OR REPLACE FUNCTION get_entity_stats(
  p_owner_profile_id UUID
) RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  regime_fiscal TEXT,
  properties_count BIGINT,
  total_value DECIMAL(14,2),
  monthly_rent DECIMAL(12,2),
  active_leases BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH entity_props AS (
    SELECT
      le.id AS eid,
      COUNT(DISTINCT p.id) AS prop_count
    FROM legal_entities le
    LEFT JOIN properties p ON p.deleted_at IS NULL
      AND (
        p.legal_entity_id = le.id
        OR (le.entity_type = 'particulier' AND p.owner_id = le.owner_profile_id AND p.legal_entity_id IS NULL)
      )
    WHERE le.owner_profile_id = p_owner_profile_id
      AND le.is_active = true
    GROUP BY le.id
  ),
  entity_leases AS (
    SELECT
      l.signatory_entity_id AS eid,
      COUNT(*) AS lease_count
    FROM leases l
    WHERE l.signatory_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id = p_owner_profile_id AND is_active = true
    )
    AND l.statut IN ('active', 'pending_signature', 'fully_signed')
    GROUP BY l.signatory_entity_id
  )
  SELECT
    le.id AS entity_id,
    le.nom AS entity_name,
    le.entity_type,
    le.regime_fiscal,
    COALESCE(ep.prop_count, 0)::BIGINT AS properties_count,
    0::DECIMAL(14,2) AS total_value,
    0::DECIMAL(12,2) AS monthly_rent,
    COALESCE(el.lease_count, 0)::BIGINT AS active_leases
  FROM legal_entities le
  LEFT JOIN entity_props ep ON ep.eid = le.id
  LEFT JOIN entity_leases el ON el.eid = le.id
  WHERE le.owner_profile_id = p_owner_profile_id
    AND le.is_active = true
  ORDER BY properties_count DESC, le.nom;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- === SOURCE: 20260223000000_fix_tenant_documents_rls.sql ===
-- NOTE: Encapsulé dans DO $$ car tenant_documents peut ne pas exister

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tenant_documents' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "tenant_view_own_documents" ON tenant_documents';
    EXECUTE 'DROP POLICY IF EXISTS "tenant_insert_own_documents" ON tenant_documents';

    EXECUTE '
      CREATE POLICY "tenant_view_own_documents" ON tenant_documents
        FOR SELECT USING (
          tenant_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )';

    EXECUTE '
      CREATE POLICY "tenant_insert_own_documents" ON tenant_documents
        FOR INSERT WITH CHECK (
          tenant_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )';

    RAISE NOTICE 'tenant_documents: policies RLS corrigées';
  ELSE
    RAISE NOTICE 'tenant_documents: table absente — skip';
  END IF;
END $$;

-- Backfill tenant_email dans metadata des CNI
UPDATE documents d
SET metadata = COALESCE(d.metadata, '{}'::jsonb) || jsonb_build_object(
  'tenant_email', COALESCE(
    (SELECT u.email FROM profiles p JOIN auth.users u ON u.id = p.user_id WHERE p.id = d.tenant_id),
    ''
  )
)
WHERE d.type IN ('cni_recto', 'cni_verso')
  AND d.tenant_id IS NOT NULL
  AND (d.metadata->>'tenant_email' IS NULL OR d.metadata->>'tenant_email' = '');


-- === SOURCE: 20260223000001_auto_fill_document_fk.sql ===

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

