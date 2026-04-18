-- ====================================================================
-- Sprint B2 — Phase 4 CRITIQUE — Batch 2/10
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
-- Migration: 20260216300000_fix_auth_profile_sync.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260216300000_fix_auth_profile_sync.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Correction synchronisation auth <-> profiles
-- Date: 2026-02-16
-- Version: 20260216300000
--
-- PROBLEMES CORRIGES:
--   1. handle_new_user() ne remplissait pas la colonne `email`
--   2. handle_new_user() n'incluait pas la gestion du role `guarantor`
--      dans le ON CONFLICT (deja corrige en 20260212, consolide ici)
--   3. Des utilisateurs auth.users existent sans profil correspondant
--      (trigger rate, erreur RLS, race condition)
--   4. Des profils existants ont email = NULL
--   5. Absence de policy INSERT explicite sur profiles
--      (le FOR ALL couvre le cas, mais une policy INSERT explicite est
--       plus lisible et securise les futures evolutions)
--
-- ACTIONS:
--   A. Mettre a jour handle_new_user() (email + guarantor + robustesse)
--   B. Creer les profils manquants pour les auth.users desynchronises
--   C. Backfill les emails NULL dans les profils existants
--   D. Assurer qu'une policy INSERT RLS existe sur profiles
-- =====================================================

BEGIN;

-- ============================================
-- A. MISE A JOUR DE handle_new_user()
-- ============================================
-- Ajout de l'email, meilleure gestion d'erreur,
-- support du role guarantor (consolidation)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
  v_email TEXT;
BEGIN
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (inclut 'guarantor')
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Recuperer l'email depuis le champ auth.users.email
  v_email := NEW.email;

  -- Inserer le profil avec toutes les donnees, y compris l'email
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone, email)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone, v_email)
  ON CONFLICT (user_id) DO UPDATE SET
    role = COALESCE(EXCLUDED.role, profiles.role),
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la creation d'un utilisateur auth
  -- meme si l'insertion du profil echoue
  RAISE WARNING '[handle_new_user] Erreur lors de la creation du profil pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur auth.
Lit le role et les informations personnelles depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
Supporte les roles: admin, owner, tenant, provider, guarantor.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.
Ne bloque jamais la creation auth meme en cas d''erreur (EXCEPTION handler).';

-- S'assurer que le trigger existe (idempotent)
DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '[fix_auth_sync] Cannot modify trigger on auth.users (insufficient privilege) — skipping';
END $$;

-- ============================================
-- B. CREER LES PROFILS MANQUANTS
-- ============================================
-- Pour chaque utilisateur dans auth.users qui n'a pas de profil,
-- en creer un avec les donnees disponibles.

DO $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT
      u.id,
      u.email,
      COALESCE(u.raw_user_meta_data->>'role', 'tenant') AS role,
      u.raw_user_meta_data->>'prenom' AS prenom,
      u.raw_user_meta_data->>'nom' AS nom,
      u.raw_user_meta_data->>'telephone' AS telephone
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.id IS NULL
  LOOP
    -- Valider le role
    IF v_user.role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
      v_user.role := 'tenant';
    END IF;

    BEGIN
      INSERT INTO public.profiles (user_id, role, email, prenom, nom, telephone)
      VALUES (
        v_user.id,
        v_user.role,
        v_user.email,
        v_user.prenom,
        v_user.nom,
        v_user.telephone
      )
      ON CONFLICT (user_id) DO NOTHING;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[fix_auth_sync] Impossible de creer le profil pour user_id=%: %',
        v_user.id, SQLERRM;
    END;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE '[fix_auth_sync] % profil(s) manquant(s) cree(s)', v_count;
  ELSE
    RAISE NOTICE '[fix_auth_sync] Aucun profil manquant — tous les auth.users ont un profil';
  END IF;
END $$;

-- ============================================
-- C. BACKFILL DES EMAILS NULL
-- ============================================
-- Mettre a jour les profils existants qui ont email = NULL
-- avec l'email provenant de auth.users.

DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND (p.email IS NULL OR p.email = '')
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[fix_auth_sync] % profil(s) mis a jour avec l''email depuis auth.users', v_updated;
  ELSE
    RAISE NOTICE '[fix_auth_sync] Tous les profils ont deja un email renseigne';
  END IF;
END $$;

-- ============================================
-- D. POLICY INSERT EXPLICITE SUR PROFILES
-- ============================================
-- Le FOR ALL existant (profiles_own_access) couvre l'INSERT,
-- mais une policy INSERT explicite est plus claire et securise
-- les futures modifications de profiles_own_access.

-- Supprimer si elle existe deja (idempotent)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

-- Permettre a un utilisateur authentifie de creer son propre profil
-- (couvre le cas ou le trigger handle_new_user echoue et que le
--  client tente un INSERT direct ou via l'API)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- E. VERIFICATION FINALE
-- ============================================
DO $$
DECLARE
  v_total_auth INTEGER;
  v_total_profiles INTEGER;
  v_orphan_count INTEGER;
  v_null_email_count INTEGER;
BEGIN
  SELECT count(*) INTO v_total_auth FROM auth.users;
  SELECT count(*) INTO v_total_profiles FROM public.profiles;

  SELECT count(*) INTO v_orphan_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.id IS NULL;

  SELECT count(*) INTO v_null_email_count
  FROM public.profiles
  WHERE email IS NULL OR email = '';

  RAISE NOTICE '========================================';
  RAISE NOTICE '  RAPPORT DE SYNCHRONISATION AUTH <-> PROFILES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  auth.users total       : %', v_total_auth;
  RAISE NOTICE '  profiles total         : %', v_total_profiles;
  RAISE NOTICE '  auth sans profil       : %', v_orphan_count;
  RAISE NOTICE '  profils sans email     : %', v_null_email_count;

  IF v_orphan_count = 0 AND v_null_email_count = 0 THEN
    RAISE NOTICE '  STATUS: SYNC OK — Aucun probleme detecte';
  ELSE
    RAISE WARNING '  STATUS: PROBLEMES RESTANTS — Verifier manuellement';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- F. FONCTIONS RPC POUR LE HEALTH CHECK (/api/health/auth)
-- ============================================
-- Ces fonctions sont appelees par l'endpoint de monitoring
-- et doivent etre SECURITY DEFINER pour acceder a auth.users.

-- Compter les auth.users total
CREATE OR REPLACE FUNCTION public.count_auth_users()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER FROM auth.users;
$$;

-- Compter les auth.users sans profil
CREATE OR REPLACE FUNCTION public.check_auth_without_profile()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.id IS NULL;
$$;

-- Compter les profils orphelins (sans auth.users)
CREATE OR REPLACE FUNCTION public.check_orphan_profiles()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE u.id IS NULL AND p.user_id IS NOT NULL;
$$;

-- Compter les emails desynchronises
CREATE OR REPLACE FUNCTION public.check_desync_emails()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.email IS DISTINCT FROM u.email
    AND p.email IS NOT NULL
    AND u.email IS NOT NULL;
$$;

-- Verifier si un trigger existe sur auth.users
CREATE OR REPLACE FUNCTION public.check_trigger_exists(p_trigger_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = p_trigger_name
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  );
$$;

-- Verifier si une policy INSERT ou ALL existe sur une table
CREATE OR REPLACE FUNCTION public.check_insert_policy_exists(p_table_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = p_table_name
      AND schemaname = 'public'
      AND (cmd = 'INSERT' OR cmd = '*')
  );
$$;

-- Permissions pour les fonctions de health check (admin seulement via service role)
GRANT EXECUTE ON FUNCTION public.count_auth_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_without_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_orphan_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_desync_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trigger_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_insert_policy_exists(TEXT) TO authenticated;

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260216300000', 'fix_auth_profile_sync')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260216300000_fix_auth_profile_sync.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260216500000_fix_tenant_dashboard_complete.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260216500000_fix_tenant_dashboard_complete.sql'; END $pre$;

-- ============================================================================
-- MIGRATION: Compléter la RPC tenant_dashboard avec toutes les données nécessaires
-- Date: 2026-02-16
-- Description:
--   1. Réintroduit les clés (keys) depuis le dernier EDL signé
--   2. Ajoute owner_id, surface_habitable_m2, chauffage_energie, regime
--   3. Ajoute les champs DPE complets (consommation, emissions, dates)
--   4. Ajoute le statut 'fully_signed' au filtre des baux
--   5. Conserve la recherche par email + signers enrichis
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
      AND l.statut IN ('active', 'pending_signature', 'fully_signed', 'terminated')
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
'RPC dashboard locataire v4. Cherche par profile_id OU invited_email.
Inclut: signers enrichis, property complète (DPE, meters, keys), insurance, KYC status.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260216500000', 'fix_tenant_dashboard_complete')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260216500000_fix_tenant_dashboard_complete.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260217000000_data_integrity_audit_repair.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260217000000_data_integrity_audit_repair.sql'; END $pre$;

-- ============================================================================
-- MIGRATION: Audit & Réparation Intégrité Relationnelle Complète
-- Date: 2026-02-17
-- Version: 20260217000000
--
-- CONTEXTE:
--   Les données existent en base mais les liens entre tables sont cassés.
--   Un locataire se connecte → dashboard vide (lease_signers non liés).
--   Un propriétaire se connecte → ne voit pas ses biens (owner_id incorrect).
--
-- SCHÉMA RELATIONNEL RÉEL DÉCOUVERT:
--   auth.users (id)
--     └── profiles (user_id → auth.users.id)
--           ├── properties (owner_id → profiles.id)
--           │     ├── leases (property_id → properties.id)
--           │     │     ├── lease_signers (lease_id, profile_id → profiles.id)
--           │     │     ├── invoices (lease_id, owner_id, tenant_id)
--           │     │     └── edl (lease_id, property_id)
--           │     ├── tickets (property_id, created_by_profile_id, owner_id)
--           │     ├── meters (property_id)
--           │     └── documents (property_id, lease_id, profile_id)
--           ├── notifications (profile_id)
--           └── subscriptions (user_id)
--
-- NOTE: La relation bail↔locataire passe par `lease_signers` (pas de tenant_id sur leases).
--
-- ACTIONS:
--   A. Créer la table d'audit _repair_log
--   B. Réparer auth→profiles (profils manquants, emails NULL)
--   C. Réparer lease_signers orphelins (profile_id NULL avec email match)
--   D. Réparer invoices.tenant_id orphelins
--   E. Réparer invoices.owner_id orphelins
--   F. Créer la fonction check_data_integrity()
--   G. Créer le trigger de validation sur leases
--   H. Ajouter les FK manquantes (si safe)
--   I. Rapport final
-- ============================================================================

BEGIN;

-- ============================================
-- A. TABLE D'AUDIT _repair_log
-- ============================================
CREATE TABLE IF NOT EXISTS public._repair_log (
  id SERIAL PRIMARY KEY,
  repair_date TIMESTAMPTZ DEFAULT NOW(),
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'LINK', 'DELETE', 'DIAGNOSTIC'
  details JSONB,
  reversed BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE public._repair_log IS
  'Table d''audit pour tracer toutes les opérations de réparation d''intégrité relationnelle.';

-- ============================================
-- B. RÉPARER auth.users → profiles
-- ============================================
-- B.1 Créer les profils manquants (consolidated - may already be done by 20260216300000)
DO $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT
      au.id,
      au.email,
      COALESCE(au.raw_user_meta_data->>'role', 'tenant') AS role,
      au.raw_user_meta_data->>'prenom' AS prenom,
      au.raw_user_meta_data->>'nom' AS nom,
      au.raw_user_meta_data->>'telephone' AS telephone
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE p.id IS NULL
  LOOP
    IF v_user.role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
      v_user.role := 'tenant';
    END IF;

    BEGIN
      INSERT INTO public.profiles (user_id, role, email, prenom, nom, telephone)
      VALUES (v_user.id, v_user.role, v_user.email, v_user.prenom, v_user.nom, v_user.telephone)
      ON CONFLICT (user_id) DO NOTHING;

      IF FOUND THEN
        v_count := v_count + 1;
        INSERT INTO public._repair_log (table_name, record_id, action, details)
        VALUES ('profiles', v_user.id::TEXT, 'INSERT',
          jsonb_build_object('email', v_user.email, 'role', v_user.role, 'reason', 'user_sans_profil'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[repair] Erreur creation profil user_id=%: %', v_user.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[B.1] % profil(s) manquant(s) créé(s)', v_count;
END $$;

-- B.2 Backfill emails NULL dans profiles
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.profiles p
    SET email = au.email, updated_at = NOW()
    FROM auth.users au
    WHERE p.user_id = au.id
      AND (p.email IS NULL OR p.email = '')
      AND au.email IS NOT NULL AND au.email != ''
    RETURNING p.id, au.email AS new_email
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'profiles', id::TEXT, 'UPDATE',
    jsonb_build_object('new_email', new_email, 'reason', 'email_null_backfill')
  FROM updated;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '[B.2] % email(s) backfillé(s)', v_updated;
END $$;

-- B.3 Synchroniser les emails désynchronisés (auth.email != profile.email)
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.profiles p
    SET email = au.email, updated_at = NOW()
    FROM auth.users au
    WHERE p.user_id = au.id
      AND p.email IS DISTINCT FROM au.email
      AND au.email IS NOT NULL AND au.email != ''
      AND p.email IS NOT NULL
    RETURNING p.id, p.email AS old_email, au.email AS new_email
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'profiles', id::TEXT, 'UPDATE',
    jsonb_build_object('old_email', old_email, 'new_email', new_email, 'reason', 'email_desync')
  FROM updated;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '[B.3] % email(s) resynchronisé(s)', v_updated;
END $$;

-- ============================================
-- C. RÉPARER lease_signers ORPHELINS
-- ============================================
-- C.1 Lier les lease_signers dont invited_email matche un profil existant
DO $$
DECLARE
  v_linked INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.id AS profile_id, LOWER(au.email) AS user_email
    FROM public.profiles p
    JOIN auth.users au ON au.id = p.user_id
    WHERE au.email IS NOT NULL AND au.email != ''
      AND EXISTS (
        SELECT 1 FROM public.lease_signers ls
        WHERE LOWER(ls.invited_email) = LOWER(au.email)
          AND ls.profile_id IS NULL
      )
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE LOWER(invited_email) = rec.user_email
      AND profile_id IS NULL;

    IF FOUND THEN
      v_linked := v_linked + 1;
      INSERT INTO public._repair_log (table_name, record_id, action, details)
      VALUES ('lease_signers', rec.profile_id::TEXT, 'LINK',
        jsonb_build_object('email', rec.user_email, 'reason', 'orphan_signer_relinked'));
    END IF;
  END LOOP;

  RAISE NOTICE '[C.1] % profil(s) liés à des lease_signers orphelins', v_linked;
END $$;

-- C.2 Compter les lease_signers encore orphelins (ceux qui n'ont pas de compte)
DO $$
DECLARE
  v_orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND invited_email != ''
    AND invited_email != 'locataire@a-definir.com';

  INSERT INTO public._repair_log (table_name, action, details)
  VALUES ('lease_signers', 'DIAGNOSTIC',
    jsonb_build_object('orphan_signers_remaining', v_orphan_count,
      'note', 'Ces locataires n''ont pas encore créé leur compte'));

  IF v_orphan_count > 0 THEN
    RAISE NOTICE '[C.2] % lease_signers orphelins restants (locataires sans compte)', v_orphan_count;
  ELSE
    RAISE NOTICE '[C.2] Aucun lease_signer orphelin restant';
  END IF;
END $$;

-- ============================================
-- D. RÉPARER invoices.tenant_id ORPHELINS
-- ============================================
-- Les invoices doivent avoir un tenant_id qui pointe vers le profile du locataire du bail
DO $$
DECLARE
  v_fixed INTEGER := 0;
BEGIN
  -- Cas 1: invoices avec tenant_id NULL - remplir depuis lease_signers
  WITH fix AS (
    UPDATE public.invoices inv
    SET tenant_id = ls.profile_id
    FROM public.lease_signers ls
    WHERE inv.lease_id = ls.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire')
      AND ls.profile_id IS NOT NULL
      AND (inv.tenant_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = inv.tenant_id
      ))
    RETURNING inv.id, ls.profile_id AS new_tenant_id
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'invoices', id::TEXT, 'UPDATE',
    jsonb_build_object('new_tenant_id', new_tenant_id, 'reason', 'tenant_id_orphan_or_null')
  FROM fix;

  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RAISE NOTICE '[D] % invoice(s) avec tenant_id réparé(s)', v_fixed;
END $$;

-- ============================================
-- E. RÉPARER invoices.owner_id ORPHELINS
-- ============================================
DO $$
DECLARE
  v_fixed INTEGER := 0;
BEGIN
  WITH fix AS (
    UPDATE public.invoices inv
    SET owner_id = prop.owner_id
    FROM public.leases l
    JOIN public.properties prop ON prop.id = l.property_id
    WHERE inv.lease_id = l.id
      AND (inv.owner_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = inv.owner_id
      ))
      AND prop.owner_id IS NOT NULL
    RETURNING inv.id, prop.owner_id AS new_owner_id
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'invoices', id::TEXT, 'UPDATE',
    jsonb_build_object('new_owner_id', new_owner_id, 'reason', 'owner_id_orphan_or_null')
  FROM fix;

  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RAISE NOTICE '[E] % invoice(s) avec owner_id réparé(s)', v_fixed;
END $$;

-- ============================================
-- F. FONCTION check_data_integrity()
-- ============================================
CREATE OR REPLACE FUNCTION public.check_data_integrity()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  count INT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check 1: Auth users sans profil
  RETURN QUERY
  SELECT 'users_sans_profil'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Utilisateurs auth.users sans profil dans public.profiles'::TEXT
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE p.id IS NULL;

  -- Check 2: Profils orphelins (sans auth.users)
  RETURN QUERY
  SELECT 'profils_orphelins'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Profils sans utilisateur auth.users correspondant'::TEXT
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE au.id IS NULL AND p.user_id IS NOT NULL;

  -- Check 3: Emails désynchronisés
  RETURN QUERY
  SELECT 'emails_desync'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Profils avec email different de auth.users'::TEXT
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.user_id
  WHERE p.email IS DISTINCT FROM au.email
    AND p.email IS NOT NULL AND au.email IS NOT NULL;

  -- Check 4: Properties sans owner valide
  RETURN QUERY
  SELECT 'properties_sans_owner'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Propriétés dont owner_id ne pointe vers aucun profil'::TEXT
  FROM public.properties pr
  LEFT JOIN public.profiles p ON pr.owner_id = p.id
  WHERE p.id IS NULL;

  -- Check 5: Properties dont l'owner n'est pas role='owner'
  RETURN QUERY
  SELECT 'properties_owner_mauvais_role'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Propriétés dont le owner_id pointe vers un profil non-owner'::TEXT
  FROM public.properties pr
  JOIN public.profiles p ON pr.owner_id = p.id
  WHERE p.role NOT IN ('owner', 'admin');

  -- Check 6: Leases sans property valide
  RETURN QUERY
  SELECT 'leases_sans_property'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Baux dont property_id ne pointe vers aucune propriété'::TEXT
  FROM public.leases l
  LEFT JOIN public.properties pr ON l.property_id = pr.id
  WHERE pr.id IS NULL;

  -- Check 7: Leases sans aucun signataire locataire
  RETURN QUERY
  SELECT 'leases_sans_tenant_signer'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Baux sans signataire locataire dans lease_signers'::TEXT
  FROM public.leases l
  WHERE NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
      AND ls.role IN ('locataire_principal', 'colocataire')
  )
  AND l.statut NOT IN ('draft', 'archived');

  -- Check 8: Lease_signers orphelins (profile_id NULL, email match un profil existant)
  RETURN QUERY
  SELECT 'lease_signers_linkables'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Signataires avec profile_id NULL qui pourraient etre liés'::TEXT
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.users au2
      JOIN public.profiles p2 ON p2.user_id = au2.id
      WHERE LOWER(au2.email) = LOWER(ls.invited_email)
    );

  -- Check 9: Lease_signers orphelins (email sans compte)
  RETURN QUERY
  SELECT 'lease_signers_sans_compte'::TEXT,
    'INFO'::TEXT,
    COUNT(*)::INT,
    'Signataires invités qui n''ont pas encore créé leur compte'::TEXT
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND ls.invited_email != 'locataire@a-definir.com'
    AND NOT EXISTS (
      SELECT 1 FROM auth.users au2
      WHERE LOWER(au2.email) = LOWER(ls.invited_email)
    );

  -- Check 10: Invoices sans lease valide
  RETURN QUERY
  SELECT 'invoices_sans_lease'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Factures dont lease_id ne pointe vers aucun bail'::TEXT
  FROM public.invoices inv
  LEFT JOIN public.leases l ON inv.lease_id = l.id
  WHERE l.id IS NULL AND inv.lease_id IS NOT NULL;

  -- Check 11: Invoices sans tenant_id valide
  RETURN QUERY
  SELECT 'invoices_sans_tenant'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Factures avec tenant_id NULL ou pointant vers un profil inexistant'::TEXT
  FROM public.invoices inv
  LEFT JOIN public.profiles p ON inv.tenant_id = p.id
  WHERE (inv.tenant_id IS NULL OR p.id IS NULL)
    AND inv.lease_id IS NOT NULL;

  -- Check 12: Documents orphelins (property_id invalide)
  BEGIN
    RETURN QUERY
    SELECT 'documents_orphelins'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'Documents dont property_id pointe vers une propriété inexistante'::TEXT
    FROM public.documents d
    LEFT JOIN public.properties pr ON d.property_id = pr.id
    WHERE d.property_id IS NOT NULL AND pr.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'documents_orphelins'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table documents inexistante'::TEXT;
  END;

  -- Check 13: Tickets orphelins (property_id invalide)
  BEGIN
    RETURN QUERY
    SELECT 'tickets_orphelins'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'Tickets dont property_id pointe vers une propriété inexistante'::TEXT
    FROM public.tickets t
    LEFT JOIN public.properties pr ON t.property_id = pr.id
    WHERE t.property_id IS NOT NULL AND pr.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'tickets_orphelins'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table tickets inexistante'::TEXT;
  END;

  -- Check 14: EDL orphelins
  BEGIN
    RETURN QUERY
    SELECT 'edl_orphelins'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'EDL dont lease_id pointe vers un bail inexistant'::TEXT
    FROM public.edl e
    LEFT JOIN public.leases l ON e.lease_id = l.id
    WHERE e.lease_id IS NOT NULL AND l.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'edl_orphelins'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table edl inexistante'::TEXT;
  END;

  -- Check 15: Notifications orphelines
  BEGIN
    RETURN QUERY
    SELECT 'notifications_orphelines'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'Notifications dont profile_id ne pointe vers aucun profil'::TEXT
    FROM public.notifications n
    LEFT JOIN public.profiles p ON n.profile_id = p.id
    WHERE n.profile_id IS NOT NULL AND p.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'notifications_orphelines'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table notifications inexistante'::TEXT;
  END;

  -- Check 16: Chaînes complètes owner→property→lease→tenant
  RETURN QUERY
  SELECT 'chaines_completes'::TEXT,
    'INFO'::TEXT,
    COUNT(DISTINCT l.id)::INT,
    'Baux avec chaîne complète owner→property→lease→tenant_signer'::TEXT
  FROM public.leases l
  JOIN public.properties pr ON l.property_id = pr.id
  JOIN public.profiles own ON pr.owner_id = own.id
  JOIN public.lease_signers ls ON ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
  JOIN public.profiles ten ON ls.profile_id = ten.id;

  -- Check 17: Trigger handle_new_user existe
  RETURN QUERY
  SELECT 'trigger_handle_new_user'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.tgname = 'on_auth_user_created'
        AND n.nspname = 'auth' AND c.relname = 'users'
    ) THEN 'OK' ELSE 'ERREUR' END::TEXT,
    0::INT,
    'Trigger on_auth_user_created sur auth.users'::TEXT;

  -- Check 18: Trigger auto_link_lease_signers existe
  RETURN QUERY
  SELECT 'trigger_auto_link'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.tgname = 'trigger_auto_link_lease_signers'
        AND n.nspname = 'public' AND c.relname = 'profiles'
    ) THEN 'OK' ELSE 'ERREUR' END::TEXT,
    0::INT,
    'Trigger auto_link_lease_signers sur profiles'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.check_data_integrity() IS
  'Fonction de diagnostic complète pour vérifier l''intégrité relationnelle de toutes les tables.
   Usage: SELECT * FROM check_data_integrity();';

GRANT EXECUTE ON FUNCTION public.check_data_integrity() TO authenticated;

-- ============================================
-- G. TRIGGER DE VALIDATION SUR LEASES
-- ============================================
-- Empêche la création d'un bail avec un property_id invalide
CREATE OR REPLACE FUNCTION public.validate_lease_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que la property existe
  IF NOT EXISTS (
    SELECT 1 FROM public.properties WHERE id = NEW.property_id
  ) THEN
    RAISE EXCEPTION 'Property % inexistante', NEW.property_id;
  END IF;

  -- Si unit_id est fourni, vérifier qu'il existe et appartient à la property
  IF NEW.unit_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.units
      WHERE id = NEW.unit_id AND property_id = NEW.property_id
    ) THEN
      RAISE EXCEPTION 'Unit % inexistante ou n''appartient pas à la property %',
        NEW.unit_id, NEW.property_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_lease_before_insert ON public.leases;
CREATE TRIGGER validate_lease_before_insert
  BEFORE INSERT ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_lease_insert();

COMMENT ON TRIGGER validate_lease_before_insert ON public.leases IS
  'Valide que property_id et unit_id sont valides avant l''insertion d''un bail.';

-- ============================================
-- G.2 TRIGGER: Auto-link lease_signers quand un profil est MIS À JOUR avec un email
-- ============================================
-- Couvre le cas où un profil existant n'avait pas d'email et le reçoit plus tard
CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_email_update()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  -- Seulement si l'email a changé
  IF NEW.email IS NOT NULL AND NEW.email != '' AND (OLD.email IS NULL OR OLD.email = '' OR OLD.email != NEW.email) THEN
    -- Aussi récupérer l'email auth pour double-check
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
    user_email := COALESCE(user_email, NEW.email);

    UPDATE public.lease_signers
    SET profile_id = NEW.id
    WHERE LOWER(invited_email) = LOWER(user_email)
      AND profile_id IS NULL;

    GET DIAGNOSTICS linked_count = ROW_COUNT;

    IF linked_count > 0 THEN
      RAISE NOTICE '[auto_link_update] % lease_signers liés au profil % (email: %)',
        linked_count, NEW.id, user_email;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_link_on_profile_update ON public.profiles;
CREATE TRIGGER trigger_auto_link_on_profile_update
  AFTER UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_email_update();

-- ============================================
-- H. FK MANQUANTES (ajoutées SEULEMENT si safe)
-- ============================================

-- H.1 properties.owner_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_properties_owner'
      AND table_name = 'properties' AND table_schema = 'public'
  ) AND NOT EXISTS (
    -- Vérifier qu'il n'y a pas de FK existante avec un autre nom
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'properties' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'owner_id'
  ) THEN
    -- Vérifier qu'il n'y a pas de données orphelines
    IF NOT EXISTS (
      SELECT 1 FROM public.properties pr
      LEFT JOIN public.profiles p ON pr.owner_id = p.id
      WHERE p.id IS NULL AND pr.owner_id IS NOT NULL
    ) THEN
      ALTER TABLE public.properties
        ADD CONSTRAINT fk_properties_owner
        FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
      RAISE NOTICE '[H.1] FK fk_properties_owner créée';
    ELSE
      RAISE WARNING '[H.1] FK fk_properties_owner NON créée: données orphelines existantes';
    END IF;
  ELSE
    RAISE NOTICE '[H.1] FK sur properties.owner_id existe déjà — skip';
  END IF;
END $$;

-- H.2 leases.property_id → properties.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'leases' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'property_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.leases l
      LEFT JOIN public.properties pr ON l.property_id = pr.id
      WHERE pr.id IS NULL AND l.property_id IS NOT NULL
    ) THEN
      ALTER TABLE public.leases
        ADD CONSTRAINT fk_leases_property
        FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE RESTRICT;
      RAISE NOTICE '[H.2] FK fk_leases_property créée';
    ELSE
      RAISE WARNING '[H.2] FK fk_leases_property NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.2] FK sur leases.property_id existe déjà — skip';
  END IF;
END $$;

-- H.3 lease_signers.lease_id → leases.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'lease_signers' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'lease_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.lease_signers ls
      LEFT JOIN public.leases l ON ls.lease_id = l.id
      WHERE l.id IS NULL AND ls.lease_id IS NOT NULL
    ) THEN
      ALTER TABLE public.lease_signers
        ADD CONSTRAINT fk_lease_signers_lease
        FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;
      RAISE NOTICE '[H.3] FK fk_lease_signers_lease créée';
    ELSE
      RAISE WARNING '[H.3] FK fk_lease_signers_lease NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.3] FK sur lease_signers.lease_id existe déjà — skip';
  END IF;
END $$;

-- H.4 lease_signers.profile_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'lease_signers' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'profile_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.lease_signers ls
      LEFT JOIN public.profiles p ON ls.profile_id = p.id
      WHERE p.id IS NULL AND ls.profile_id IS NOT NULL
    ) THEN
      ALTER TABLE public.lease_signers
        ADD CONSTRAINT fk_lease_signers_profile
        FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
      RAISE NOTICE '[H.4] FK fk_lease_signers_profile créée';
    ELSE
      RAISE WARNING '[H.4] FK fk_lease_signers_profile NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.4] FK sur lease_signers.profile_id existe déjà — skip';
  END IF;
END $$;

-- H.5 invoices.lease_id → leases.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'invoices' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'lease_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices inv
      LEFT JOIN public.leases l ON inv.lease_id = l.id
      WHERE l.id IS NULL AND inv.lease_id IS NOT NULL
    ) THEN
      ALTER TABLE public.invoices
        ADD CONSTRAINT fk_invoices_lease
        FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE RESTRICT;
      RAISE NOTICE '[H.5] FK fk_invoices_lease créée';
    ELSE
      RAISE WARNING '[H.5] FK fk_invoices_lease NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.5] FK sur invoices.lease_id existe déjà — skip';
  END IF;
END $$;

-- ============================================
-- I. RAPPORT FINAL
-- ============================================
DO $$
DECLARE
  v_auth_users INT;
  v_profiles INT;
  v_users_sans_profil INT;
  v_profils_orphelins INT;
  v_properties INT;
  v_props_sans_owner INT;
  v_leases INT;
  v_leases_sans_property INT;
  v_signers_orphelins INT;
  v_signers_linkables INT;
  v_chaines_completes INT;
  v_repair_count INT;
BEGIN
  SELECT COUNT(*) INTO v_auth_users FROM auth.users;
  SELECT COUNT(*) INTO v_profiles FROM public.profiles;

  SELECT COUNT(*) INTO v_users_sans_profil
  FROM auth.users au LEFT JOIN public.profiles p ON p.user_id = au.id WHERE p.id IS NULL;

  SELECT COUNT(*) INTO v_profils_orphelins
  FROM public.profiles p LEFT JOIN auth.users au ON au.id = p.user_id WHERE au.id IS NULL AND p.user_id IS NOT NULL;

  SELECT COUNT(*) INTO v_properties FROM public.properties;
  SELECT COUNT(*) INTO v_props_sans_owner
  FROM public.properties pr LEFT JOIN public.profiles p ON pr.owner_id = p.id WHERE p.id IS NULL;

  SELECT COUNT(*) INTO v_leases FROM public.leases;
  SELECT COUNT(*) INTO v_leases_sans_property
  FROM public.leases l LEFT JOIN public.properties pr ON l.property_id = pr.id WHERE pr.id IS NULL;

  SELECT COUNT(*) INTO v_signers_orphelins
  FROM public.lease_signers WHERE profile_id IS NULL AND invited_email IS NOT NULL
    AND invited_email != 'locataire@a-definir.com';

  SELECT COUNT(*) INTO v_signers_linkables
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL AND ls.invited_email IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.users au2
      JOIN public.profiles p2 ON p2.user_id = au2.id
      WHERE LOWER(au2.email) = LOWER(ls.invited_email)
    );

  SELECT COUNT(DISTINCT l.id) INTO v_chaines_completes
  FROM public.leases l
  JOIN public.properties pr ON l.property_id = pr.id
  JOIN public.profiles own ON pr.owner_id = own.id
  JOIN public.lease_signers ls ON ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
  JOIN public.profiles ten ON ls.profile_id = ten.id;

  SELECT COUNT(*) INTO v_repair_count FROM public._repair_log;

  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '  RAPPORT INTEGRITE RELATIONNELLE — TALOK — POST-REPARATION';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '  Date : %', NOW();
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  AUTH -> PROFILES';
  RAISE NOTICE '    Auth users total         : %', v_auth_users;
  RAISE NOTICE '    Profiles total           : %', v_profiles;
  RAISE NOTICE '    Users SANS profil        : % %', v_users_sans_profil,
    CASE WHEN v_users_sans_profil = 0 THEN '(OK)' ELSE '(ERREUR)' END;
  RAISE NOTICE '    Profils orphelins        : % %', v_profils_orphelins,
    CASE WHEN v_profils_orphelins = 0 THEN '(OK)' ELSE '(ATTENTION)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  PROPERTIES';
  RAISE NOTICE '    Total                    : %', v_properties;
  RAISE NOTICE '    Sans owner valide        : % %', v_props_sans_owner,
    CASE WHEN v_props_sans_owner = 0 THEN '(OK)' ELSE '(ERREUR)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  LEASES (BAUX)';
  RAISE NOTICE '    Total                    : %', v_leases;
  RAISE NOTICE '    Sans property valide     : % %', v_leases_sans_property,
    CASE WHEN v_leases_sans_property = 0 THEN '(OK)' ELSE '(ERREUR)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  LEASE_SIGNERS';
  RAISE NOTICE '    Orphelins (pas de compte): %', v_signers_orphelins;
  RAISE NOTICE '    Linkables (ont un compte): % %', v_signers_linkables,
    CASE WHEN v_signers_linkables = 0 THEN '(OK)' ELSE '(A REPARER)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  CHAINES COMPLETES';
  RAISE NOTICE '    owner->property->lease->tenant: %', v_chaines_completes;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  REPARATIONS EFFECTUEES     : % entrée(s) dans _repair_log', v_repair_count;
  RAISE NOTICE '================================================================';

  -- Logger le rapport dans _repair_log
  INSERT INTO public._repair_log (table_name, action, details)
  VALUES ('SYSTEM', 'INTEGRITY_REPORT', jsonb_build_object(
    'auth_users', v_auth_users,
    'profiles', v_profiles,
    'users_sans_profil', v_users_sans_profil,
    'profils_orphelins', v_profils_orphelins,
    'properties', v_properties,
    'properties_sans_owner', v_props_sans_owner,
    'leases', v_leases,
    'leases_sans_property', v_leases_sans_property,
    'signers_orphelins', v_signers_orphelins,
    'signers_linkables', v_signers_linkables,
    'chaines_completes', v_chaines_completes
  ));
END $$;

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260217000000', 'data_integrity_audit_repair')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260217000000_data_integrity_audit_repair.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260218000000_audit_repair_profiles.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260218000000_audit_repair_profiles.sql'; END $pre$;

-- ============================================================================
-- BLOC 1 : TABLE D'AUDIT + RÉPARATION PROFILS
-- ============================================================================

-- 1. Création de la table de log des réparations
CREATE TABLE IF NOT EXISTS public._repair_log (
  id          SERIAL PRIMARY KEY,
  repair_date TIMESTAMPTZ DEFAULT NOW(),
  table_name  TEXT NOT NULL,
  record_id   TEXT,
  action      TEXT NOT NULL,
  details     JSONB
);

-- 2. Créer les profils manquants (users sans profil)
WITH inserted AS (
  INSERT INTO public.profiles (user_id, role, email, prenom, nom, telephone)
  SELECT
    au.id,
    COALESCE(
      CASE WHEN au.raw_user_meta_data->>'role' IN ('admin','owner','tenant','provider','guarantor')
           THEN au.raw_user_meta_data->>'role'
           ELSE NULL END,
      'tenant'
    ),
    au.email,
    au.raw_user_meta_data->>'prenom',
    au.raw_user_meta_data->>'nom',
    CASE WHEN (au.raw_user_meta_data->>'telephone') ~ '^\+[1-9]\d{1,14}$'
         THEN au.raw_user_meta_data->>'telephone'
         ELSE NULL END
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE p.id IS NULL
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id, email, role
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', user_id::TEXT, 'INSERT',
       jsonb_build_object('email', email, 'role', role, 'reason', 'user_sans_profil')
FROM inserted;

-- 3. Sync emails NULL (profils sans email alors que auth.users en a un)
WITH updated AS (
  UPDATE public.profiles p
  SET email = au.email, updated_at = NOW()
  FROM auth.users au
  WHERE p.user_id = au.id
    AND (p.email IS NULL OR p.email = '')
    AND au.email IS NOT NULL AND au.email != ''
  RETURNING p.id, au.email AS new_email
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', id::TEXT, 'UPDATE',
       jsonb_build_object('new_email', new_email, 'reason', 'email_null_backfill')
FROM updated;

-- 4. Sync emails désynchronisés (profil a un email différent de auth.users)
WITH updated AS (
  UPDATE public.profiles p
  SET email = au.email, updated_at = NOW()
  FROM auth.users au
  WHERE p.user_id = au.id
    AND p.email IS DISTINCT FROM au.email
    AND au.email IS NOT NULL AND au.email != ''
    AND p.email IS NOT NULL
  RETURNING p.id, p.email AS old_email, au.email AS new_email
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', id::TEXT, 'UPDATE',
       jsonb_build_object('old_email', old_email, 'new_email', new_email, 'reason', 'email_desync')
FROM updated;

-- 5. Résultat
SELECT action, COUNT(*) AS nb, details->>'reason' AS reason
FROM public._repair_log
WHERE table_name = 'profiles'
GROUP BY action, details->>'reason';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260218000000', 'audit_repair_profiles')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260218000000_audit_repair_profiles.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260218100000_sync_auth_email_updates.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260218100000_sync_auth_email_updates.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Synchronisation des changements d'email auth -> profiles
-- Date: 2026-02-18
-- Version: 20260218100000
--
-- PROBLEME:
--   Quand un utilisateur change son email via Supabase Auth
--   (confirmation d'email, changement d'email, etc.),
--   la colonne profiles.email n'est PAS mise a jour automatiquement.
--   Cela cause une desynchronisation entre auth.users.email
--   et profiles.email.
--
-- SOLUTION:
--   A. Trigger AFTER UPDATE sur auth.users qui met a jour
--      profiles.email quand auth.users.email change.
--   B. Backfill immediat des emails desynchronises.
--
-- SECURITE:
--   La fonction utilise SECURITY DEFINER pour bypasser les RLS
--   et mettre a jour le profil sans restrictions.
--   SET search_path = public pour eviter les injections de schema.
-- =====================================================

BEGIN;

-- ============================================
-- A. FONCTION DE SYNCHRONISATION EMAIL
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne rien faire si l'email n'a pas change
  IF NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;

  -- Mettre a jour l'email dans le profil
  UPDATE public.profiles
  SET
    email = NEW.email,
    updated_at = NOW()
  WHERE user_id = NEW.id;

  IF NOT FOUND THEN
    -- Le profil n'existe pas encore (race condition possible)
    -- handle_new_user() le creera avec le bon email
    RAISE WARNING '[handle_user_email_change] Profil introuvable pour user_id=%, email non synchronise', NEW.id;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la modification d'un utilisateur auth
  RAISE WARNING '[handle_user_email_change] Erreur sync email pour user_id=%: % (SQLSTATE=%)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_user_email_change() IS
'Synchronise automatiquement profiles.email quand auth.users.email change.
SECURITY DEFINER pour bypasser les RLS.
Ne bloque jamais la modification auth (EXCEPTION handler).';

-- ============================================
-- B. TRIGGER SUR auth.users (UPDATE)
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.handle_user_email_change();

-- ============================================
-- C. BACKFILL DES EMAILS DESYNCHRONISES
-- ============================================
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND p.email IS DISTINCT FROM u.email
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[email_sync] % profil(s) resynchronise(s) avec l''email de auth.users', v_updated;
  ELSE
    RAISE NOTICE '[email_sync] Tous les emails sont deja synchronises';
  END IF;
END $$;

-- ============================================
-- D. VERIFICATION
-- ============================================
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_desync_count INTEGER;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_email_changed'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) INTO v_trigger_exists;

  SELECT count(*) INTO v_desync_count
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.email IS DISTINCT FROM u.email
    AND u.email IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE '  VERIFICATION EMAIL SYNC TRIGGER';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  Trigger on_auth_user_email_changed : %',
    CASE WHEN v_trigger_exists THEN 'ACTIF' ELSE 'MANQUANT' END;
  RAISE NOTICE '  Emails desynchronises restants     : %', v_desync_count;
  RAISE NOTICE '========================================';
END $$;

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260218100000', 'sync_auth_email_updates')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260218100000_sync_auth_email_updates.sql'; END $post$;

COMMIT;

-- END OF BATCH 2/10 (Phase 4 CRITIQUE)
