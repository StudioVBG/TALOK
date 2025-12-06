-- ============================================================
-- MIGRATION COMBINÉE: Corrections du processus d'ajout locataire
-- Exécuter dans le SQL Editor de Supabase Dashboard
-- ============================================================

-- ============================================
-- PARTIE 1: CORRECTION DES OCCUPANTS
-- ============================================

-- 1.1 Ajouter la colonne pour identifier les occupants sans compte
ALTER TABLE roommates 
ADD COLUMN IF NOT EXISTS occupant_reference UUID DEFAULT gen_random_uuid();

COMMENT ON COLUMN roommates.occupant_reference IS 'Identifiant unique pour les occupants sans compte utilisateur';

-- 1.2 Ajouter une colonne pour stocker la relation
ALTER TABLE roommates 
ADD COLUMN IF NOT EXISTS relationship TEXT;

COMMENT ON COLUMN roommates.relationship IS 'Relation: conjoint, enfant, parent, ami, autre';

-- 1.3 Ajouter une colonne email optionnelle
ALTER TABLE roommates 
ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN roommates.email IS 'Email de l''occupant pour invitation future';

-- 1.4 Supprimer l'ancienne contrainte UNIQUE si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'roommates_lease_id_user_id_key'
    AND conrelid = 'roommates'::regclass
  ) THEN
    ALTER TABLE roommates DROP CONSTRAINT roommates_lease_id_user_id_key;
  END IF;
END $$;

-- 1.5 Créer une nouvelle contrainte
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'roommates_lease_user_occupant_unique'
  ) THEN
    ALTER TABLE roommates 
    ADD CONSTRAINT roommates_lease_user_occupant_unique 
    UNIQUE (lease_id, user_id, occupant_reference);
  END IF;
END $$;

-- 1.6 Index pour les performances
CREATE INDEX IF NOT EXISTS idx_roommates_occupant_reference 
ON roommates(occupant_reference);

CREATE INDEX IF NOT EXISTS idx_roommates_email 
ON roommates(email) 
WHERE email IS NOT NULL;

-- 1.7 Mettre à jour les occupants existants
UPDATE roommates
SET occupant_reference = gen_random_uuid()
WHERE occupant_reference IS NULL;

-- 1.8 Rendre la colonne NOT NULL
ALTER TABLE roommates 
ALTER COLUMN occupant_reference SET NOT NULL;

-- 1.9 Fonction pour convertir un occupant en locataire
CREATE OR REPLACE FUNCTION public.link_occupant_to_user(
  p_occupant_reference UUID,
  p_user_id UUID,
  p_profile_id UUID
)
RETURNS roommates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_occupant roommates;
BEGIN
  SELECT * INTO v_occupant
  FROM roommates
  WHERE occupant_reference = p_occupant_reference
  AND (user_id IS NULL OR role = 'occupant');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Occupant non trouvé ou déjà lié';
  END IF;

  UPDATE roommates
  SET 
    user_id = p_user_id,
    profile_id = p_profile_id,
    updated_at = NOW()
  WHERE id = v_occupant.id
  RETURNING * INTO v_occupant;

  RETURN v_occupant;
END;
$$;

-- ============================================
-- PARTIE 2: EMAIL UNIQUE NORMALISÉ
-- ============================================

-- 2.1 Fonction de normalisation d'email
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

  normalized := LOWER(TRIM(email));
  local_part := SPLIT_PART(normalized, '@', 1);
  domain_part := SPLIT_PART(normalized, '@', 2);
  
  IF domain_part = '' THEN
    RETURN normalized;
  END IF;
  
  IF POSITION('+' IN local_part) > 0 THEN
    local_part := SPLIT_PART(local_part, '+', 1);
  END IF;
  
  IF domain_part IN ('gmail.com', 'googlemail.com') THEN
    local_part := REPLACE(local_part, '.', '');
  END IF;
  
  RETURN local_part || '@' || domain_part;
END;
$$;

-- 2.2 Ajouter la colonne email aux profiles si absente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email TEXT;
    
    UPDATE profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.user_id = u.id
    AND p.email IS NULL;
  END IF;
END $$;

-- 2.3 Ajouter la colonne email normalisé (générée)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email_normalized'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN email_normalized TEXT 
    GENERATED ALWAYS AS (public.normalize_email(email)) STORED;
  END IF;
END $$;

-- 2.4 Index unique sur l'email normalisé (ignore NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_normalized_unique
ON profiles(email_normalized)
WHERE email_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email
ON profiles(email)
WHERE email IS NOT NULL;

-- 2.5 Synchroniser les emails depuis auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id
AND p.email IS NULL
AND u.email IS NOT NULL;

-- 2.6 Fonction de vérification des doublons
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
  
  IF NOT FOUND THEN
    exists_duplicate := FALSE;
    existing_profile_id := NULL;
    existing_user_id := NULL;
    existing_role := NULL;
    RETURN NEXT;
  END IF;
END;
$$;

-- 2.7 Afficher les doublons potentiels
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
    RAISE NOTICE '⚠️ % groupes de doublons détectés', duplicate_count;
  ELSE
    RAISE NOTICE '✅ Aucun doublon détecté';
  END IF;
END $$;

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================
SELECT 'Migration appliquée avec succès !' as status;

