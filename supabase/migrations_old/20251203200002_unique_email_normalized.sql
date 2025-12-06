-- Migration : Ajouter une contrainte unique sur l'email normalisé
-- Problème : Les doublons de locataires peuvent être créés avec des variations d'email
-- Solution : Normaliser les emails et créer un index unique

-- ============================================
-- 1. FONCTION DE NORMALISATION D'EMAIL
-- ============================================

-- Créer une fonction pour normaliser les emails
-- - Convertit en minuscules
-- - Supprime les espaces
-- - Supprime les alias Gmail (partie après le +)
-- - Supprime les points dans la partie locale Gmail
CREATE OR REPLACE FUNCTION public.normalize_email(email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  local_part TEXT;
  domain_part TEXT;
  normalized TEXT;
BEGIN
  IF email IS NULL OR email = '' THEN
    RETURN NULL;
  END IF;

  -- Convertir en minuscules et supprimer les espaces
  normalized := LOWER(TRIM(email));
  
  -- Séparer la partie locale et le domaine
  local_part := SPLIT_PART(normalized, '@', 1);
  domain_part := SPLIT_PART(normalized, '@', 2);
  
  -- Si pas de @, retourner l'email tel quel (invalide mais on le garde)
  IF domain_part = '' THEN
    RETURN normalized;
  END IF;
  
  -- Supprimer les alias (partie après le +)
  IF POSITION('+' IN local_part) > 0 THEN
    local_part := SPLIT_PART(local_part, '+', 1);
  END IF;
  
  -- Pour Gmail, supprimer les points de la partie locale
  -- (Gmail ignore les points: test.email@gmail.com = testemail@gmail.com)
  IF domain_part IN ('gmail.com', 'googlemail.com') THEN
    local_part := REPLACE(local_part, '.', '');
  END IF;
  
  RETURN local_part || '@' || domain_part;
END;
$$;

COMMENT ON FUNCTION public.normalize_email IS 'Normalise un email pour la détection de doublons (minuscules, suppression alias +, normalisation Gmail)';

-- ============================================
-- 2. AJOUTER LA COLONNE EMAIL AUX PROFILES SI ABSENTE
-- ============================================

-- Vérifier si la colonne email existe déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    -- Ajouter la colonne email
    ALTER TABLE profiles ADD COLUMN email TEXT;
    
    -- Remplir depuis auth.users si possible
    UPDATE profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.user_id = u.id
    AND p.email IS NULL;
    
    RAISE NOTICE 'Colonne email ajoutée à profiles et remplie depuis auth.users';
  END IF;
END $$;

-- ============================================
-- 3. AJOUTER LA COLONNE EMAIL NORMALISÉ
-- ============================================

-- Ajouter une colonne générée pour l'email normalisé
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_normalized TEXT 
GENERATED ALWAYS AS (public.normalize_email(email)) STORED;

COMMENT ON COLUMN profiles.email_normalized IS 'Email normalisé pour la détection de doublons (généré automatiquement)';

-- ============================================
-- 4. INDEX UNIQUE SUR L'EMAIL NORMALISÉ
-- ============================================

-- Créer un index unique partiel (ignore les NULL)
-- Cela permet d'avoir des profils sans email tout en empêchant les doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_normalized_unique
ON profiles(email_normalized)
WHERE email_normalized IS NOT NULL;

-- Index pour les recherches par email
CREATE INDEX IF NOT EXISTS idx_profiles_email
ON profiles(email)
WHERE email IS NOT NULL;

-- ============================================
-- 5. TRIGGER DE SYNCHRONISATION EMAIL AUTH -> PROFILES
-- ============================================

-- Fonction pour synchroniser l'email depuis auth.users
CREATE OR REPLACE FUNCTION public.sync_email_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mettre à jour l'email du profil quand l'email auth change
  UPDATE profiles
  SET email = NEW.email
  WHERE user_id = NEW.id
  AND (email IS NULL OR email != NEW.email);
  
  RETURN NEW;
END;
$$;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS sync_auth_email_to_profile ON auth.users;

-- Créer le trigger sur auth.users
CREATE TRIGGER sync_auth_email_to_profile
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.sync_email_from_auth();

-- ============================================
-- 6. FONCTION POUR VÉRIFIER LES DOUBLONS
-- ============================================

-- Fonction pour vérifier si un email existe déjà (avant création)
CREATE OR REPLACE FUNCTION public.check_email_duplicate(
  p_email TEXT,
  p_exclude_profile_id UUID DEFAULT NULL
)
RETURNS TABLE(
  exists_duplicate BOOLEAN,
  existing_profile_id UUID,
  existing_user_id UUID,
  existing_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := public.normalize_email(p_email);
  
  IF normalized IS NULL THEN
    exists_duplicate := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    TRUE as exists_duplicate,
    p.id as existing_profile_id,
    p.user_id as existing_user_id,
    p.role as existing_role
  FROM profiles p
  WHERE p.email_normalized = normalized
  AND (p_exclude_profile_id IS NULL OR p.id != p_exclude_profile_id)
  LIMIT 1;
  
  -- Si pas de résultat, retourner FALSE
  IF NOT FOUND THEN
    exists_duplicate := FALSE;
    existing_profile_id := NULL;
    existing_user_id := NULL;
    existing_role := NULL;
    RETURN NEXT;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.check_email_duplicate IS 'Vérifie si un email (normalisé) existe déjà dans les profils';

-- ============================================
-- 7. MIGRATION DES DONNÉES EXISTANTES
-- ============================================

-- Synchroniser les emails depuis auth.users pour les profils sans email
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id
AND p.email IS NULL
AND u.email IS NOT NULL;

-- Afficher les doublons potentiels (pour audit)
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT email_normalized, COUNT(*) as cnt
    FROM profiles
    WHERE email_normalized IS NOT NULL
    GROUP BY email_normalized
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE '⚠️ % groupes de doublons d''email détectés. Vérifiez avec: SELECT email_normalized, array_agg(id) FROM profiles WHERE email_normalized IS NOT NULL GROUP BY email_normalized HAVING COUNT(*) > 1;', duplicate_count;
  ELSE
    RAISE NOTICE '✅ Aucun doublon d''email détecté';
  END IF;
END $$;

-- ============================================
-- 8. CONTRAINTE CHECK POUR FORMAT EMAIL
-- ============================================

-- Ajouter une contrainte pour valider le format email
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_email_format_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_email_format_check 
CHECK (
  email IS NULL 
  OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);


