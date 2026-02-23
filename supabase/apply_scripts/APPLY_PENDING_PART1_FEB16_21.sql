-- =====================================================
-- PARTIE 1/3 — Migrations 20260216 → 20260221 (11 fichiers)
-- Date: 2026-02-23
-- Coller dans Supabase SQL Editor → Run
-- =====================================================

-- === SOURCE: 20260216500000_fix_tenant_dashboard_complete.sql ===

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


-- === SOURCE: 20260216500001_enforce_unique_constraints_safety.sql ===

-- Migration: Enforce unique constraints safety net
-- Date: 2026-02-16
-- Description: S'assure que les contraintes uniques critiques sont bien appliquées.
--              Idempotent : ne fait rien si elles existent déjà.
--              Nettoie les doublons existants avant de créer les contraintes.

BEGIN;

-- =============================================
-- 1. INVOICES: unique (lease_id, periode)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_lease_periode'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_invoices_lease_periode'
  ) THEN
    -- Supprimer les doublons en gardant le plus récent
    DELETE FROM invoices
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY lease_id, periode ORDER BY created_at DESC) AS rn
        FROM invoices
        WHERE lease_id IS NOT NULL AND periode IS NOT NULL
      ) sub
      WHERE sub.rn > 1
    );

    ALTER TABLE invoices
      ADD CONSTRAINT uq_invoices_lease_periode
      UNIQUE (lease_id, periode);

    RAISE NOTICE 'Created constraint uq_invoices_lease_periode on invoices';
  ELSE
    RAISE NOTICE 'Constraint uq_invoices_lease_periode already exists, skipping';
  END IF;
END $$;

-- =============================================
-- 2. LEASE_SIGNERS: unique (lease_id, profile_id) WHERE profile_id IS NOT NULL
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_lease_signers_lease_profile'
  ) THEN
    -- Supprimer les doublons en gardant celui qui a été signé (ou le plus récent)
    DELETE FROM lease_signers
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY lease_id, profile_id
                 ORDER BY
                   CASE WHEN signature_status = 'signed' THEN 0 ELSE 1 END,
                   created_at DESC
               ) AS rn
        FROM lease_signers
        WHERE profile_id IS NOT NULL
      ) sub
      WHERE sub.rn > 1
    );

    CREATE UNIQUE INDEX uq_lease_signers_lease_profile
      ON lease_signers (lease_id, profile_id)
      WHERE profile_id IS NOT NULL;

    RAISE NOTICE 'Created index uq_lease_signers_lease_profile on lease_signers';
  ELSE
    RAISE NOTICE 'Index uq_lease_signers_lease_profile already exists, skipping';
  END IF;
END $$;

-- =============================================
-- 3. ROOMMATES: unique (lease_id, profile_id)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_roommates_lease_profile'
  ) THEN
    -- Vérifier si la table roommates existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roommates') THEN
      -- Supprimer les doublons
      DELETE FROM roommates
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY lease_id, profile_id ORDER BY created_at DESC) AS rn
          FROM roommates
          WHERE lease_id IS NOT NULL AND profile_id IS NOT NULL
        ) sub
        WHERE sub.rn > 1
      );

      CREATE UNIQUE INDEX uq_roommates_lease_profile
        ON roommates (lease_id, profile_id);

      RAISE NOTICE 'Created index uq_roommates_lease_profile on roommates';
    ELSE
      RAISE NOTICE 'Table roommates does not exist, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Index uq_roommates_lease_profile already exists, skipping';
  END IF;
END $$;

-- =============================================
-- 4. DOCUMENTS: Empêcher les doublons de fichiers (même storage_path)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_documents_storage_path'
  ) THEN
    -- Supprimer les doublons en gardant le plus récent
    DELETE FROM documents
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY storage_path ORDER BY created_at DESC) AS rn
        FROM documents
        WHERE storage_path IS NOT NULL
      ) sub
      WHERE sub.rn > 1
    );

    CREATE UNIQUE INDEX uq_documents_storage_path
      ON documents (storage_path)
      WHERE storage_path IS NOT NULL;

    RAISE NOTICE 'Created index uq_documents_storage_path on documents';
  ELSE
    RAISE NOTICE 'Index uq_documents_storage_path already exists, skipping';
  END IF;
END $$;

COMMIT;


-- === SOURCE: 20260217000000_data_integrity_audit_repair.sql ===

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


-- === SOURCE: 20260218000000_audit_repair_profiles.sql ===

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


-- === SOURCE: 20260218100000_sync_auth_email_updates.sql ===

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


-- === SOURCE: 20260219000000_missing_tables_and_rag.sql ===

-- =====================================================
-- MIGRATION: Tables et fonctions manquantes
-- Date: 2026-02-19
-- Version: 20260219000000
--
-- Contenu:
--   1. tenant_rewards + colonne total_points sur tenant_profiles
--   2. invoice_reminders
--   3. webhook_logs
--   4. ai_conversations
--   5. Extension pgvector + tables RAG (legal_embeddings,
--      platform_knowledge, user_context_embeddings)
--   6. Fonctions RPC RAG (match_legal_documents,
--      hybrid_search_legal, match_platform_knowledge,
--      match_user_context)
--   7. RLS sur toutes les nouvelles tables
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TENANT REWARDS
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points NUMERIC(10,2) NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'rent_paid_on_time',
    'energy_saving',
    'profile_completed',
    'document_uploaded',
    'on_time_streak',
    'referral'
  )),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_rewards_profile
  ON tenant_rewards(profile_id, created_at DESC);

ALTER TABLE tenant_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_rewards_select_own" ON tenant_rewards;
CREATE POLICY "tenant_rewards_select_own" ON tenant_rewards
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tenant_rewards_insert_own" ON tenant_rewards;
CREATE POLICY "tenant_rewards_insert_own" ON tenant_rewards
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tenant_rewards_admin" ON tenant_rewards;
CREATE POLICY "tenant_rewards_admin" ON tenant_rewards
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- Colonne total_points sur tenant_profiles
ALTER TABLE tenant_profiles
  ADD COLUMN IF NOT EXISTS total_points NUMERIC(10,2) DEFAULT 0;

-- Trigger pour mettre a jour total_points automatiquement
CREATE OR REPLACE FUNCTION update_tenant_total_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tenant_profiles
  SET total_points = COALESCE(total_points, 0) + NEW.points
  WHERE profile_id = NEW.profile_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_tenant_total_points ON tenant_rewards;
CREATE TRIGGER trg_update_tenant_total_points
  AFTER INSERT ON tenant_rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_total_points();

-- =====================================================
-- 2. INVOICE REMINDERS
-- =====================================================

CREATE TABLE IF NOT EXISTS invoice_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT DEFAULT 'email' CHECK (method IN ('email', 'sms', 'courrier')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  recipient_email TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice
  ON invoice_reminders(invoice_id, created_at DESC);

ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_reminders_select_owner" ON invoice_reminders;
CREATE POLICY "invoice_reminders_select_owner" ON invoice_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_reminders.invoice_id
        AND i.owner_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "invoice_reminders_insert_owner" ON invoice_reminders;
CREATE POLICY "invoice_reminders_insert_owner" ON invoice_reminders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_id
        AND i.owner_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "invoice_reminders_admin" ON invoice_reminders;
CREATE POLICY "invoice_reminders_admin" ON invoice_reminders
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- =====================================================
-- 3. WEBHOOK LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'stripe',
  event_type TEXT NOT NULL,
  event_id TEXT,
  payload JSONB,
  error TEXT,
  processed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider_date
  ON webhook_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id
  ON webhook_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status
  ON webhook_logs(status) WHERE status = 'error';

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Seuls les admins et le service_role lisent les webhook logs
DROP POLICY IF EXISTS "webhook_logs_admin" ON webhook_logs;
CREATE POLICY "webhook_logs_admin" ON webhook_logs
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- Permettre l'insertion depuis les API routes (service_role)
DROP POLICY IF EXISTS "webhook_logs_service_insert" ON webhook_logs;
CREATE POLICY "webhook_logs_service_insert" ON webhook_logs
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- 4. AI CONVERSATIONS (analytics)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_query TEXT NOT NULL,
  assistant_response TEXT,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  model_used TEXT,
  rag_docs_retrieved INTEGER DEFAULT 0,
  rag_sources JSONB DEFAULT '[]',
  thread_id UUID REFERENCES assistant_threads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_profile
  ON ai_conversations(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_model
  ON ai_conversations(model_used, created_at DESC);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations_select_own" ON ai_conversations;
CREATE POLICY "ai_conversations_select_own" ON ai_conversations
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_conversations_insert_own" ON ai_conversations;
CREATE POLICY "ai_conversations_insert_own" ON ai_conversations
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_conversations_admin" ON ai_conversations;
CREATE POLICY "ai_conversations_admin" ON ai_conversations
  FOR ALL USING (
    public.user_role() = 'admin'
  );

-- =====================================================
-- 5. EXTENSION PGVECTOR + TABLES RAG
-- =====================================================

-- Tenter d'installer pgvector. Si indisponible, on skip toute la section RAG.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Extension vector non disponible: %. Section RAG ignorée.', SQLERRM;
END $$;

-- Si pgvector est disponible, créer les tables RAG avec colonnes vector
-- Sinon, créer les tables sans colonnes vector (fallback JSONB)
DO $$
DECLARE
  v_has_vector BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') INTO v_has_vector;

  IF v_has_vector THEN
    RAISE NOTICE 'pgvector détecté, création des tables RAG avec vector(1536)';

    EXECUTE 'CREATE TABLE IF NOT EXISTS legal_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      source_title TEXT,
      source_url TEXT,
      source_date DATE,
      article_reference TEXT,
      metadata JSONB DEFAULT ''{}'',
      embedding vector(1536),
      tsv tsvector GENERATED ALWAYS AS (
        to_tsvector(''french'', coalesce(content, '''') || '' '' || coalesce(source_title, ''''))
      ) STORED,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS platform_knowledge (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      knowledge_type TEXT NOT NULL,
      target_roles TEXT[] DEFAULT ''{owner,tenant,provider}'',
      slug TEXT UNIQUE,
      priority INTEGER DEFAULT 0,
      metadata JSONB DEFAULT ''{}'',
      embedding vector(1536),
      is_published BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS user_context_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      embedding vector(1536),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(entity_type, entity_id)
    )';

  ELSE
    RAISE NOTICE 'pgvector absent, création des tables RAG sans vector (fallback JSONB)';

    EXECUTE 'CREATE TABLE IF NOT EXISTS legal_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      source_title TEXT,
      source_url TEXT,
      source_date DATE,
      article_reference TEXT,
      metadata JSONB DEFAULT ''{}'',
      embedding JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS platform_knowledge (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      knowledge_type TEXT NOT NULL,
      target_roles TEXT[] DEFAULT ''{owner,tenant,provider}'',
      slug TEXT UNIQUE,
      priority INTEGER DEFAULT 0,
      metadata JSONB DEFAULT ''{}'',
      embedding JSONB,
      is_published BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS user_context_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      embedding JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(entity_type, entity_id)
    )';
  END IF;
END $$;

-- Index standards (non-vector)
CREATE INDEX IF NOT EXISTS idx_legal_embeddings_category ON legal_embeddings(category);
CREATE INDEX IF NOT EXISTS idx_platform_knowledge_type ON platform_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_platform_knowledge_slug ON platform_knowledge(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_context_profile ON user_context_embeddings(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_context_entity ON user_context_embeddings(entity_type, entity_id);

-- Index vector uniquement si pgvector est disponible
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_legal_embeddings_vector ON legal_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_platform_knowledge_vector ON platform_knowledge USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_context_vector ON user_context_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip vector indexes: %', SQLERRM;
    END;
  END IF;
END $$;

-- RLS
ALTER TABLE legal_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_embeddings_select_authenticated" ON legal_embeddings;
CREATE POLICY "legal_embeddings_select_authenticated" ON legal_embeddings
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "legal_embeddings_admin_manage" ON legal_embeddings;
CREATE POLICY "legal_embeddings_admin_manage" ON legal_embeddings
  FOR ALL USING (public.user_role() = 'admin');

DROP POLICY IF EXISTS "platform_knowledge_select_authenticated" ON platform_knowledge;
CREATE POLICY "platform_knowledge_select_authenticated" ON platform_knowledge
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_published = true);
DROP POLICY IF EXISTS "platform_knowledge_admin_manage" ON platform_knowledge;
CREATE POLICY "platform_knowledge_admin_manage" ON platform_knowledge
  FOR ALL USING (public.user_role() = 'admin');

DROP POLICY IF EXISTS "user_context_select_own" ON user_context_embeddings;
CREATE POLICY "user_context_select_own" ON user_context_embeddings
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "user_context_manage_own" ON user_context_embeddings;
CREATE POLICY "user_context_manage_own" ON user_context_embeddings
  FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "user_context_admin" ON user_context_embeddings;
CREATE POLICY "user_context_admin" ON user_context_embeddings
  FOR ALL USING (public.user_role() = 'admin');

-- Fonctions RAG (uniquement si pgvector)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION match_legal_documents(
        query_embedding vector(1536), match_count INTEGER DEFAULT 5,
        filter_category TEXT DEFAULT NULL, min_similarity FLOAT DEFAULT 0.7
      ) RETURNS TABLE (id UUID, content TEXT, category TEXT, source_title TEXT, article_reference TEXT, metadata JSONB, similarity FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      BEGIN RETURN QUERY SELECT le.id, le.content, le.category, le.source_title, le.article_reference, le.metadata, 1 - (le.embedding <=> query_embedding) AS similarity FROM legal_embeddings le WHERE (filter_category IS NULL OR le.category = filter_category) AND 1 - (le.embedding <=> query_embedding) >= min_similarity ORDER BY le.embedding <=> query_embedding LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION hybrid_search_legal(
        query_text TEXT, query_embedding vector(1536), match_count INTEGER DEFAULT 5,
        filter_category TEXT DEFAULT NULL, vector_weight FLOAT DEFAULT 0.7
      ) RETURNS TABLE (id UUID, content TEXT, category TEXT, source_title TEXT, article_reference TEXT, combined_score FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      DECLARE text_weight FLOAT := 1.0 - vector_weight;
      BEGIN RETURN QUERY SELECT le.id, le.content, le.category, le.source_title, le.article_reference, (vector_weight * (1 - (le.embedding <=> query_embedding)) + text_weight * COALESCE(ts_rank_cd(le.tsv, plainto_tsquery('french', query_text)), 0)) AS combined_score FROM legal_embeddings le WHERE (filter_category IS NULL OR le.category = filter_category) AND (1 - (le.embedding <=> query_embedding) >= 0.5 OR le.tsv @@ plainto_tsquery('french', query_text)) ORDER BY combined_score DESC LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION match_platform_knowledge(
        query_embedding vector(1536), match_count INTEGER DEFAULT 5,
        filter_type TEXT DEFAULT NULL, filter_role TEXT DEFAULT NULL
      ) RETURNS TABLE (id UUID, title TEXT, content TEXT, knowledge_type TEXT, similarity FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      BEGIN RETURN QUERY SELECT pk.id, pk.title, pk.content, pk.knowledge_type, 1 - (pk.embedding <=> query_embedding) AS similarity FROM platform_knowledge pk WHERE pk.is_published = true AND (filter_type IS NULL OR pk.knowledge_type = filter_type) AND (filter_role IS NULL OR filter_role = ANY(pk.target_roles)) AND 1 - (pk.embedding <=> query_embedding) >= 0.5 ORDER BY pk.embedding <=> query_embedding LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION match_user_context(
        query_embedding vector(1536), p_profile_id UUID,
        match_count INTEGER DEFAULT 5, filter_entity_type TEXT DEFAULT NULL
      ) RETURNS TABLE (id UUID, entity_type TEXT, entity_id UUID, content TEXT, summary TEXT, similarity FLOAT)
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
      BEGIN RETURN QUERY SELECT uce.id, uce.entity_type, uce.entity_id, uce.content, uce.summary, 1 - (uce.embedding <=> query_embedding) AS similarity FROM user_context_embeddings uce WHERE uce.profile_id = p_profile_id AND (filter_entity_type IS NULL OR uce.entity_type = filter_entity_type) AND 1 - (uce.embedding <=> query_embedding) >= 0.5 ORDER BY uce.embedding <=> query_embedding LIMIT match_count; END; $f$;
    $fn$;

    EXECUTE 'GRANT EXECUTE ON FUNCTION match_legal_documents TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION hybrid_search_legal TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION match_platform_knowledge TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION match_user_context TO authenticated';
  ELSE
    RAISE NOTICE 'pgvector absent: fonctions RAG non créées.';
  END IF;
END $$;

-- =====================================================
-- 7. GRANTS (tables non-vector)
-- =====================================================

GRANT SELECT, INSERT ON tenant_rewards TO authenticated;
GRANT SELECT, INSERT ON invoice_reminders TO authenticated;
GRANT INSERT ON webhook_logs TO authenticated;
GRANT SELECT ON webhook_logs TO authenticated;
GRANT SELECT, INSERT ON ai_conversations TO authenticated;
GRANT SELECT ON legal_embeddings TO authenticated;
GRANT SELECT ON platform_knowledge TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_context_embeddings TO authenticated;

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON TABLE tenant_rewards IS 'Points de fidelite et recompenses locataires';
COMMENT ON TABLE invoice_reminders IS 'Historique des relances de factures envoyees';
COMMENT ON TABLE webhook_logs IS 'Logs des webhooks recus (Stripe, etc.)';
COMMENT ON TABLE ai_conversations IS 'Historique analytique des conversations avec l''assistant IA';
COMMENT ON TABLE legal_embeddings IS 'Embeddings vectoriels des documents juridiques pour RAG';
COMMENT ON TABLE platform_knowledge IS 'Base de connaissances plateforme avec embeddings pour RAG';
COMMENT ON TABLE user_context_embeddings IS 'Embeddings du contexte utilisateur pour recherche personnalisee RAG';

COMMIT;


-- === SOURCE: 20260219100000_auto_link_notify_owner.sql ===

-- =====================================================
-- MIGRATION: Notify owner when tenant creates account (auto-link)
-- Date: 2026-02-19
--
-- PROBLÈME CORRIGÉ:
-- Quand un locataire crée son compte et que le trigger auto-link
-- lie son profil aux lease_signers, le propriétaire n'était PAS notifié.
-- Le locataire restait invisible jusqu'au prochain rafraîchissement
-- de la page propriétaire.
--
-- SOLUTION:
-- Enrichir la fonction auto_link_lease_signers_on_profile_created()
-- pour créer une notification in-app pour chaque propriétaire concerné.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
  rec RECORD;
BEGIN
  -- Récupérer l'email de l'utilisateur auth
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Lier tous les lease_signers orphelins avec cet email
  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)',
      linked_count, NEW.id, user_email;

    -- ✅ NOUVEAU: Notifier chaque propriétaire concerné
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

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;


-- === SOURCE: 20260219200000_fix_autolink_triggers_audit.sql ===

-- =====================================================
-- MIGRATION: Corrections issues de l'audit auto-link triggers
-- Date: 2026-02-19
-- Ref: AUDIT_AUTOLINK_TRIGGERS.md
--
-- Corrections appliquées:
--   P0-1: Supprimer le trigger obsolète on_profile_created_auto_link
--   P1-1: Ajouter EXCEPTION handler à auto_link_lease_signers_on_profile_created
--   P1-2: Supprimer la politique RLS trop permissive "System can insert notifications"
--   P2-1: Ajouter déduplication aux triggers de notification
-- =====================================================

BEGIN;

-- =====================================================
-- P0-1: Supprimer le trigger OBSOLÈTE on_profile_created_auto_link
-- Ce trigger (case-sensitive, sans notifications, sans invitations)
-- est remplacé par trigger_auto_link_lease_signers depuis la migration
-- 20260219100000_auto_link_notify_owner.sql
-- =====================================================

DROP TRIGGER IF EXISTS on_profile_created_auto_link ON public.profiles;
DROP FUNCTION IF EXISTS public.auto_link_signer_profile();

-- =====================================================
-- P1-1: Ajouter EXCEPTION handler à auto_link_lease_signers_on_profile_created
-- Sans cet handler, une erreur dans la notification (ex: colonne manquante)
-- provoque un rollback de la création du profil → l'utilisateur ne peut
-- pas s'inscrire.
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
  rec RECORD;
BEGIN
  -- Récupérer l'email de l'utilisateur auth
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Lier tous les lease_signers orphelins avec cet email
  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)',
      linked_count, NEW.id, user_email;

    -- Notifier chaque propriétaire concerné
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

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la création du profil
  RAISE WARNING '[auto_link] Erreur non-bloquante: % (SQLSTATE=%)', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- P1-2: Remplacer la politique RLS trop permissive
-- "System can insert notifications" (WITH CHECK (true))
-- par une politique restrictive: seuls les triggers SECURITY DEFINER
-- peuvent insérer (pas les utilisateurs authentifiés directement)
-- =====================================================

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Les triggers SECURITY DEFINER bypassent RLS, donc aucune politique
-- INSERT permissive n'est nécessaire pour eux. On ne crée PAS de
-- remplacement car les fonctions trigger sont toutes SECURITY DEFINER.
-- Si une politique INSERT est nécessaire pour le service role,
-- elle sera ajoutée par la couche applicative.

-- =====================================================
-- P2-1: Ajouter déduplication aux triggers de notification
-- Empêche les doublons si un statut oscille (ex: late -> paid -> late)
-- Fenêtre de déduplication : 1 heure
-- =====================================================

-- TRIGGER 1: notify_invoice_late - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_invoice_late()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tenant_name TEXT;
  v_property_address TEXT;
  v_amount NUMERIC;
BEGIN
  -- Seulement si le statut passe à 'late'
  IF NEW.statut = 'late' AND (OLD.statut IS NULL OR OLD.statut != 'late') THEN
    -- Récupérer les infos
    SELECT
      p.owner_id,
      COALESCE(pr.prenom || ' ' || pr.nom, 'Locataire'),
      COALESCE(p.adresse_complete, 'Adresse inconnue'),
      NEW.montant_total
    INTO v_owner_id, v_tenant_name, v_property_address, v_amount
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles pr ON ls.profile_id = pr.id
    WHERE l.id = NEW.lease_id;

    -- Notifier le propriétaire (avec déduplication)
    IF v_owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'payment_late'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_owner_id,
        'payment_late',
        'Loyer impayé',
        format('Le loyer de %s (%s) de %s€ est en retard.', v_tenant_name, v_property_address, v_amount),
        '/app/owner/money?filter=late',
        NEW.id,
        'invoice'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER 2: notify_payment_received - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tenant_name TEXT;
  v_amount NUMERIC;
BEGIN
  -- Seulement si le statut passe à 'succeeded'
  IF NEW.statut = 'succeeded' AND (OLD.statut IS NULL OR OLD.statut != 'succeeded') THEN
    -- Récupérer les infos via la facture
    SELECT
      p.owner_id,
      COALESCE(pr.prenom || ' ' || pr.nom, 'Locataire'),
      NEW.montant
    INTO v_owner_id, v_tenant_name, v_amount
    FROM invoices i
    JOIN leases l ON i.lease_id = l.id
    JOIN properties p ON l.property_id = p.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles pr ON ls.profile_id = pr.id
    WHERE i.id = NEW.invoice_id;

    -- Notifier le propriétaire (avec déduplication)
    IF v_owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'payment_received'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_owner_id,
        'payment_received',
        'Paiement reçu',
        format('Paiement de %s€ reçu de %s.', v_amount, v_tenant_name),
        '/app/owner/money',
        NEW.id,
        'payment'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER 3: notify_lease_signed - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_lease_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_address TEXT;
BEGIN
  -- Seulement si le statut passe à 'active'
  IF NEW.statut = 'active' AND (OLD.statut IS NULL OR OLD.statut != 'active') THEN
    -- Récupérer les infos
    SELECT p.owner_id, COALESCE(p.adresse_complete, 'Adresse inconnue')
    INTO v_owner_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    -- Notifier le propriétaire (avec déduplication)
    IF v_owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'lease_signed'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_owner_id,
        'lease_signed',
        'Bail signé !',
        format('Le bail pour %s est maintenant actif.', v_property_address),
        '/app/owner/leases/' || NEW.id,
        NEW.id,
        'lease'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER 5: notify_ticket_resolved - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_ticket_resolved()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id UUID;
  v_property_address TEXT;
BEGIN
  -- Seulement si le statut passe à 'resolved' ou 'closed'
  IF NEW.statut IN ('resolved', 'closed') AND OLD.statut NOT IN ('resolved', 'closed') THEN
    -- Récupérer les infos
    SELECT
      NEW.created_by_profile_id,
      COALESCE(p.adresse_complete, 'Adresse inconnue')
    INTO v_creator_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    -- Notifier le créateur du ticket (avec déduplication)
    IF v_creator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'ticket_resolved'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_creator_id,
        'ticket_resolved',
        'Ticket résolu',
        format('Votre demande "%s" a été traitée.', NEW.titre),
        '/app/owner/tickets/' || NEW.id,
        NEW.id,
        'ticket'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: trigger_notify_ticket_created (INSERT only) n'a pas besoin de
-- déduplication car un INSERT ne peut se produire qu'une fois.

COMMIT;


-- === SOURCE: 20260220000000_auto_link_signer_on_insert.sql ===

-- =====================================================
-- MIGRATION: SOTA 2026 — Auto-link signer à l'INSERT
-- Date: 2026-02-20
--
-- OBJECTIF:
--   Quand un lease_signer est créé avec invited_email et profile_id NULL,
--   lier immédiatement au profil existant si l'email correspond (auth.users).
--   Couvre le cas "locataire déjà inscrit invité sur un nouveau bail".
--
-- CONTENU:
--   1. Fonction auto_link_signer_on_insert() — BEFORE INSERT sur lease_signers
--   2. RPC find_profile_by_email(target_email) — pour l'API invite
--   3. Fix rétroactif — lier les orphelins existants
--   4. Vérification finale
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-link à l'INSERT du signer
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_link_signer_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  found_profile_id UUID;
BEGIN
  IF NEW.profile_id IS NULL AND NEW.invited_email IS NOT NULL AND TRIM(NEW.invited_email) != '' THEN
    SELECT p.id INTO found_profile_id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(NEW.invited_email))
    LIMIT 1;

    IF found_profile_id IS NOT NULL THEN
      NEW.profile_id := found_profile_id;
      RAISE NOTICE '[auto_link_on_insert] Lien immédiat: % -> profil %', NEW.invited_email, found_profile_id;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_link_on_insert] Erreur non-bloquante: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_link_signer_on_insert() IS
'SOTA 2026: À l''INSERT d''un lease_signer avec invited_email et profile_id NULL, lie au profil existant si l''email matche auth.users. Ne bloque jamais l''INSERT.';

-- ============================================
-- 2. TRIGGER: Exécuter avant chaque INSERT sur lease_signers
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_link_signer_on_insert ON public.lease_signers;

CREATE TRIGGER trigger_auto_link_signer_on_insert
  BEFORE INSERT ON public.lease_signers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_signer_on_insert();

-- ============================================
-- 3. RPC: find_profile_by_email — pour l'API (remplace listUsers)
-- ============================================
CREATE OR REPLACE FUNCTION public.find_profile_by_email(target_email TEXT)
RETURNS TABLE(id UUID, user_id UUID, role TEXT) AS $$
BEGIN
  IF target_email IS NULL OR TRIM(target_email) = '' THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id, p.user_id, p.role::TEXT
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(target_email))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.find_profile_by_email(TEXT) IS
'SOTA 2026: Retourne (id, user_id, role) du profil dont l''email auth correspond. Utilisé par l''API invite pour éviter listUsers().';

-- ============================================
-- 4. FIX RÉTROACTIF: Lier les lease_signers orphelins existants
-- ============================================
DO $$
DECLARE
  linked_total INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT ls.id AS signer_id, p.id AS profile_id
    FROM public.lease_signers ls
    JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
    JOIN public.profiles p ON p.user_id = u.id
    WHERE ls.profile_id IS NULL
      AND ls.invited_email IS NOT NULL
      AND TRIM(ls.invited_email) != ''
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE lease_signers.id = rec.signer_id;
    linked_total := linked_total + 1;
  END LOOP;

  IF linked_total > 0 THEN
    RAISE NOTICE '[rétro-link] % lease_signers orphelins liés à un profil existant', linked_total;
  ELSE
    RAISE NOTICE '[rétro-link] Aucun lease_signer orphelin à lier';
  END IF;
END $$;

-- ============================================
-- 5. VÉRIFICATION: Compter les orphelins restants
-- ============================================
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*)::INT INTO orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND TRIM(invited_email) != ''
    AND invited_email NOT LIKE '%@a-definir%';

  IF orphan_count > 0 THEN
    RAISE NOTICE '⚠️  % lease_signers orphelins restants (email sans compte correspondant)', orphan_count;
  ELSE
    RAISE NOTICE '✅ Tous les signers avec email valide sont liés ou n''ont pas encore de compte';
  END IF;
END $$;

COMMIT;


-- === SOURCE: 20260220100000_fix_orphan_signers_audit.sql ===

-- =====================================================
-- MIGRATION: Audit connexion comptes — fix rétroactif + RPC
-- Date: 2026-02-20
-- Ref: docs/AUDIT_CONNEXION_COMPTES.md
--
-- CONTENU:
--   1. Fix rétroactif — relier les lease_signers orphelins (idempotent)
--   2. Index LOWER(invited_email) si absent (IF NOT EXISTS)
--   3. RPC audit_account_connections() — diagnostic réutilisable
-- =====================================================

BEGIN;

-- ============================================
-- 1. FIX RÉTROACTIF: Lier les orphelins existants
-- (Idempotent: ne fait rien si déjà liés)
-- ============================================
DO $$
DECLARE
  linked_total INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT ls.id AS signer_id, p.id AS profile_id
    FROM public.lease_signers ls
    JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
    JOIN public.profiles p ON p.user_id = u.id
    WHERE ls.profile_id IS NULL
      AND ls.invited_email IS NOT NULL
      AND TRIM(ls.invited_email) != ''
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE lease_signers.id = rec.signer_id;
    linked_total := linked_total + 1;
  END LOOP;

  IF linked_total > 0 THEN
    RAISE NOTICE '[audit_fix] % lease_signers orphelins liés à un profil existant', linked_total;
  END IF;
END $$;

-- ============================================
-- 2. INDEX: LOWER(invited_email) pour lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email_lower
  ON public.lease_signers (LOWER(TRIM(invited_email)))
  WHERE invited_email IS NOT NULL AND TRIM(invited_email) != '';

-- ============================================
-- 3. RPC: audit_account_connections()
-- Retourne un diagnostic global (orphelins, invitations, notifications)
-- ============================================
CREATE OR REPLACE FUNCTION public.audit_account_connections()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orphan_count INT;
  linkable_count INT;  -- orphelins qui ont un compte (email match)
  invitations_not_used_count INT;
  result JSONB;
BEGIN
  -- Signataires orphelins (profile_id NULL, invited_email valide)
  SELECT count(*)::INT INTO orphan_count
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND TRIM(ls.invited_email) != ''
    AND ls.invited_email NOT LIKE '%@a-definir%';

  -- Orphelins pour lesquels un profil existe (email correspondant)
  SELECT count(*)::INT INTO linkable_count
  FROM public.lease_signers ls
  JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
  JOIN public.profiles p ON p.user_id = u.id
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND TRIM(ls.invited_email) != '';

  -- Invitations non marquées utilisées (email présent dans auth.users)
  SELECT count(*)::INT INTO invitations_not_used_count
  FROM public.invitations i
  WHERE i.used_at IS NULL
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(i.email))
    );

  result := jsonb_build_object(
    'orphan_signers_count', orphan_count,
    'linkable_orphans_count', linkable_count,
    'invitations_not_used_count', invitations_not_used_count,
    'message', CASE
      WHEN linkable_count > 0 THEN 'Des orphelins peuvent être liés (exécuter le fix SQL ou la migration).'
      WHEN orphan_count > 0 THEN 'Orphelins restants sans compte correspondant.'
      ELSE 'Aucun signataire orphelin à lier.'
    END
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.audit_account_connections() IS
'Audit connexion comptes: retourne orphan_signers_count, linkable_orphans_count, invitations_not_used_count. Ref: docs/AUDIT_CONNEXION_COMPTES.md';

COMMIT;


-- === SOURCE: 20260221000001_auto_link_trigger_update.sql ===

-- =====================================================
-- Auto-link lease_signers on profile UPDATE
-- Date: 2026-02-21
--
-- Quand un profil est mis à jour (ex: email confirmé, user_id lié),
-- lier les lease_signers orphelins dont invited_email matche l'email du user.
-- Réutilise la même logique que l'INSERT (auth.users.email -> lease_signers.invited_email).
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_updated()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR TRIM(user_email) = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(TRIM(invited_email)) = LOWER(TRIM(user_email))
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link_update] % lease_signers liés au profil % (email: %)',
      linked_count, NEW.id, user_email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_link_lease_signers_on_profile_updated() IS
'SOTA 2026: À l''UPDATE d''un profil, lie les lease_signers orphelins dont invited_email matche l''email auth.';

DROP TRIGGER IF EXISTS trigger_auto_link_lease_signers_on_update ON public.profiles;

CREATE TRIGGER trigger_auto_link_lease_signers_on_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_updated();

COMMIT;

