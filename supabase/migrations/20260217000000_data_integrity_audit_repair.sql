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
