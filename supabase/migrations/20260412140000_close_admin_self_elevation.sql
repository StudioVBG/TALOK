-- ============================================
-- Migration: Fermer la faille admin self-elevation dans handle_new_user
-- Date: 2026-04-12
-- Sprint: Bugs audit comptes — Bug #2
--
-- Contexte:
--   La fonction handle_new_user() (trigger ON INSERT sur auth.users)
--   lit le rôle depuis raw_user_meta_data et l'insère dans profiles.
--   La whitelist incluait 'admin' et 'platform_admin', ce qui permet
--   à n'importe quel client Supabase anonyme de faire :
--
--     supabase.auth.signUp({
--       email, password,
--       options: { data: { role: 'admin' } }
--     })
--
--   et d'obtenir un profil avec role='admin' en DB.
--
--   L'API /api/v1/auth/register bloque déjà via RegisterSchema.role
--   (enum 6 rôles publics), mais un appel direct à supabase.auth.signUp()
--   côté client bypass cette validation.
--
-- Fix:
--   Exclure 'admin' et 'platform_admin' de la whitelist du trigger.
--   Si raw_user_meta_data.role = 'admin' → fallback 'tenant'.
--   Les admins sont créés UNIQUEMENT par :
--     1. scripts/create-admin.ts (service role + UPDATE profiles SET role)
--     2. SQL direct par un DBA
--
-- Impact:
--   - Aucun impact sur les admins existants (le trigger ne s'exécute que
--     sur INSERT dans auth.users, pas sur les profils déjà créés)
--   - Aucun impact sur les 6 rôles publics (owner, tenant, provider,
--     guarantor, syndic, agency)
--   - Aucun impact sur l'API /api/v1/auth/register (déjà sécurisée)
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

  -- Valider le rôle : seuls les rôles PUBLICS sont acceptés.
  -- 'admin' et 'platform_admin' sont EXCLUS pour empêcher l'auto-élévation
  -- via supabase.auth.signUp({ options: { data: { role: 'admin' } } }).
  -- Les admins sont créés par scripts/create-admin.ts ou SQL direct.
  IF v_role NOT IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
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
'SOTA 2026 — Crée automatiquement un profil lors de la création d''un utilisateur auth.
Lit le rôle, prenom, nom et telephone depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
SÉCURITÉ: seuls les rôles publics (owner, tenant, provider, guarantor, syndic, agency)
sont acceptés. admin et platform_admin sont REFUSÉS pour empêcher l''auto-élévation
de privilèges. Fallback sur tenant si rôle invalide.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.
Ne bloque jamais la création auth même en cas d''erreur (EXCEPTION handler).';
