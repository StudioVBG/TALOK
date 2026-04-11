-- ============================================
-- Migration: Restaurer handle_new_user SOTA 2026
-- Date: 2026-04-11
-- Contexte:
--   La migration 20260329120000_add_agency_to_handle_new_user.sql a écrasé
--   la version 20260327200000 qui contenait :
--     1. L'insertion de la colonne `email` (perdue)
--     2. L'EXCEPTION WHEN OTHERS handler (perdu)
--
--   Cette migration restaure les deux tout en conservant le support des
--   rôles supplémentaires (admin, owner, tenant, provider, guarantor,
--   syndic, agency) et le telephone depuis raw_user_meta_data.
-- ============================================

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
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le rôle (tous les rôles supportés par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency', 'platform_admin') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Récupérer l'email depuis le champ auth.users.email
  v_email := NEW.email;

  -- Insérer le profil avec toutes les données
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone, email)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone, v_email)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la création d'un utilisateur auth
  -- même si l'insertion du profil échoue
  RAISE WARNING '[handle_new_user] Erreur pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'SOTA 2026 - Crée automatiquement un profil lors de la création d''un utilisateur auth.
Lit le rôle, prenom, nom et telephone depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
Supporte tous les rôles: admin, owner, tenant, provider, guarantor, syndic, agency, platform_admin.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.
Ne bloque jamais la création auth même en cas d''erreur (EXCEPTION handler).';

-- Backfill des emails NULL (si régressés par la migration 20260329120000)
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
    RAISE NOTICE '[restore_handle_new_user] % profil(s) backfill email', v_updated;
  END IF;
END $$;
