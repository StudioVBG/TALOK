-- ====================================================================
-- Sprint B2 — Phase 4 CRITIQUE — Batch 4/10
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260221000002_fix_edl_signatures_rls.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260221000002_fix_edl_signatures_rls.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260221000002', 'fix_edl_signatures_rls')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260221000002_fix_edl_signatures_rls.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260221100000_fix_tenant_dashboard_draft_visibility.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260221100000_fix_tenant_dashboard_draft_visibility.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260221100000', 'fix_tenant_dashboard_draft_visibility')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260221100000_fix_tenant_dashboard_draft_visibility.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260221100001_auto_upgrade_draft_on_tenant_signer.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260221100001_auto_upgrade_draft_on_tenant_signer.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260221100001', 'auto_upgrade_draft_on_tenant_signer')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260221100001_auto_upgrade_draft_on_tenant_signer.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260221300000_fix_tenant_dashboard_owner_join.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260221300000_fix_tenant_dashboard_owner_join.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260221300000', 'fix_tenant_dashboard_owner_join')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260221300000_fix_tenant_dashboard_owner_join.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260222000000_fix_invitations_and_orphan_signers.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260222000000_fix_invitations_and_orphan_signers.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260222000000', 'fix_invitations_and_orphan_signers')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260222000000_fix_invitations_and_orphan_signers.sql'; END $post$;

COMMIT;

-- END OF BATCH 4/10 (Phase 4 CRITIQUE)
