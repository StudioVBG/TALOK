-- Migration : S'assurer que user_profile_id() fonctionne correctement
-- Problème : user_profile_id() peut retourner NULL si auth.uid() n'est pas disponible dans le contexte
-- Solution : Créer une version robuste qui gère les cas d'erreur

BEGIN;

-- Supprimer toutes les versions existantes de user_profile_id() pour éviter les conflits
DROP FUNCTION IF EXISTS public.user_profile_id() CASCADE;
DROP FUNCTION IF EXISTS public.user_profile_id(UUID) CASCADE;

-- Créer une version robuste de user_profile_id() sans paramètre (utilise auth.uid())
CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result UUID;
  current_user_id UUID;
BEGIN
  -- Obtenir auth.uid() de manière sécurisée
  current_user_id := auth.uid();
  
  -- Si aucun utilisateur n'est authentifié, retourner NULL
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Récupérer le profile_id correspondant
  SELECT id INTO result
  FROM profiles
  WHERE user_id = current_user_id
  LIMIT 1;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur, retourner NULL plutôt que de planter
    RETURN NULL;
END;
$$;

-- Créer une version avec paramètre pour les cas où on veut passer explicitement le user_id
CREATE OR REPLACE FUNCTION public.user_profile_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT id INTO result
  FROM profiles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- S'assurer que user_role() existe aussi et fonctionne correctement
DROP FUNCTION IF EXISTS public.user_role() CASCADE;
DROP FUNCTION IF EXISTS public.user_role(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT role INTO result
  FROM profiles
  WHERE user_id = current_user_id
  LIMIT 1;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT role INTO result
  FROM profiles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Commentaire : Ces fonctions sont utilisées par les politiques RLS
-- SECURITY DEFINER permet de bypasser RLS lors de l'exécution
-- STABLE indique que la fonction ne modifie pas la base de données
-- SET search_path = public garantit que les tables sont trouvées dans le bon schéma

COMMIT;

