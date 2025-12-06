-- ============================================
-- Migration: Assurer la colonne email dans profiles
-- ============================================
-- Cette migration ajoute la colonne email si elle n'existe pas
-- et lie automatiquement les profils aux comptes auth par email
-- ============================================

-- 1. Ajouter la colonne email si elle n'existe pas
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2. Créer un index sur email pour des recherches rapides
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 3. Contrainte d'unicité sur email (si pas déjà présente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_email_unique'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Contrainte profiles_email_unique existe déjà ou erreur ignorée';
END $$;

-- 4. Fonction pour lier automatiquement les profils aux comptes auth
CREATE OR REPLACE FUNCTION public.link_profile_to_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_user_id UUID;
BEGIN
  -- Si le profil a un email mais pas de user_id
  IF NEW.email IS NOT NULL AND NEW.user_id IS NULL THEN
    -- Chercher le user_id correspondant dans auth.users
    SELECT id INTO auth_user_id
    FROM auth.users
    WHERE email = NEW.email
    LIMIT 1;
    
    -- Si trouvé, lier le profil
    IF auth_user_id IS NOT NULL THEN
      NEW.user_id := auth_user_id;
      RAISE NOTICE 'Profil % lié au compte auth %', NEW.id, auth_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Créer le trigger
DROP TRIGGER IF EXISTS trigger_link_profile_auth ON profiles;
CREATE TRIGGER trigger_link_profile_auth
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.link_profile_to_auth_user();

-- 6. CORRECTION RÉTROACTIVE : Lier les profils existants sans user_id
UPDATE profiles p
SET user_id = u.id
FROM auth.users u
WHERE p.email = u.email
  AND p.user_id IS NULL;

-- 7. Log du nombre de profils corrigés
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM profiles
  WHERE user_id IS NOT NULL AND role = 'tenant';
  
  RAISE NOTICE 'Profils locataires avec user_id: %', updated_count;
END $$;

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================

