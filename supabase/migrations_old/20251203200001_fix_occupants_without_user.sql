-- Migration : Corriger la gestion des occupants sans compte utilisateur
-- Problème : La contrainte UNIQUE(lease_id, user_id) empêche d'ajouter plusieurs occupants
--           car ils partagent tous le user_id du locataire principal
-- Solution : Ajouter un champ occupant_id unique et rendre user_id/profile_id nullable pour les occupants

-- ============================================
-- 1. MODIFICATION DE LA TABLE ROOMMATES
-- ============================================

-- Ajouter une colonne pour identifier les occupants sans compte
ALTER TABLE roommates 
ADD COLUMN IF NOT EXISTS occupant_reference UUID DEFAULT gen_random_uuid();

-- Ajouter un commentaire explicatif
COMMENT ON COLUMN roommates.occupant_reference IS 'Identifiant unique pour les occupants sans compte utilisateur. Permet de différencier plusieurs occupants ajoutés par le même locataire principal.';

-- Ajouter une colonne pour stocker la relation avec le locataire principal
ALTER TABLE roommates 
ADD COLUMN IF NOT EXISTS relationship TEXT;

COMMENT ON COLUMN roommates.relationship IS 'Relation avec le locataire principal: conjoint, enfant, parent, ami, autre';

-- Ajouter une colonne email optionnelle pour inviter l'occupant plus tard
ALTER TABLE roommates 
ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN roommates.email IS 'Email de l''occupant pour une future invitation à créer un compte';

-- ============================================
-- 2. MODIFICATION DES CONTRAINTES
-- ============================================

-- Supprimer l'ancienne contrainte UNIQUE si elle existe
DO $$
BEGIN
  -- Vérifier si la contrainte existe avant de la supprimer
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'roommates_lease_id_user_id_key'
    AND conrelid = 'roommates'::regclass
  ) THEN
    ALTER TABLE roommates DROP CONSTRAINT roommates_lease_id_user_id_key;
  END IF;
END $$;

-- Créer une nouvelle contrainte qui permet les doublons pour les occupants
-- (user_id peut être identique si occupant_reference est différent)
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

-- ============================================
-- 3. INDEX POUR LES PERFORMANCES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_roommates_occupant_reference 
ON roommates(occupant_reference);

CREATE INDEX IF NOT EXISTS idx_roommates_email 
ON roommates(email) 
WHERE email IS NOT NULL;

-- ============================================
-- 4. POLITIQUE RLS MISE À JOUR
-- ============================================

-- Mettre à jour la politique pour inclure les occupants
DROP POLICY IF EXISTS "Roommates insert for principal" ON roommates;

CREATE POLICY "Roommates insert for principal"
  ON roommates FOR INSERT
  WITH CHECK (
    -- Le locataire principal peut ajouter des occupants à son bail
    EXISTS (
      SELECT 1 FROM roommates r
      WHERE r.lease_id = lease_id
      AND r.user_id = auth.uid()
      AND r.role = 'principal'
      AND r.left_on IS NULL
    )
    -- Ou c'est le premier locataire (principal lui-même)
    OR (
      user_id = auth.uid() 
      AND role = 'principal'
      AND NOT EXISTS (
        SELECT 1 FROM roommates r 
        WHERE r.lease_id = lease_id AND r.role = 'principal'
      )
    )
    -- Ou c'est un admin
    OR public.user_role() = 'admin'
  );

-- ============================================
-- 5. FONCTION POUR CONVERTIR UN OCCUPANT EN LOCATAIRE
-- ============================================

-- Quand un occupant crée un compte, on met à jour son entrée roommates
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
  -- Vérifier que l'occupant existe et n'est pas déjà lié
  SELECT * INTO v_occupant
  FROM roommates
  WHERE occupant_reference = p_occupant_reference
  AND (user_id IS NULL OR role = 'occupant');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Occupant non trouvé ou déjà lié à un compte';
  END IF;

  -- Mettre à jour avec les infos du nouvel utilisateur
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
-- 6. METTRE À JOUR LES OCCUPANTS EXISTANTS
-- ============================================

-- Générer un occupant_reference unique pour les entrées existantes qui n'en ont pas
UPDATE roommates
SET occupant_reference = gen_random_uuid()
WHERE occupant_reference IS NULL;

-- Rendre la colonne NOT NULL maintenant que toutes les lignes ont une valeur
ALTER TABLE roommates 
ALTER COLUMN occupant_reference SET NOT NULL;


