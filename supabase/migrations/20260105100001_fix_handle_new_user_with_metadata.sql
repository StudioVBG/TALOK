-- ============================================
-- Migration: Améliorer handle_new_user pour lire le rôle depuis les metadata
-- Date: 2026-01-05
-- Description: Le trigger lit maintenant le rôle, prénom, nom et téléphone 
--              depuis les raw_user_meta_data de l'utilisateur
-- ============================================

-- Recréer la fonction handle_new_user pour lire les metadata
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
BEGIN
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );
  
  -- Valider le rôle
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider') THEN
    v_role := 'tenant';
  END IF;
  
  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';
  
  -- Insérer le profil avec toutes les données
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Commenter la fonction
COMMENT ON FUNCTION public.handle_new_user() IS 
'Crée automatiquement un profil lors de la création d''un utilisateur.
Lit le rôle et les informations personnelles depuis les raw_user_meta_data.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';

