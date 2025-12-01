-- Migration : ajout des colonnes bancaires au profil propriétaire
-- Permet de stocker les informations complètes du compte bancaire pour les virements

BEGIN;

-- Ajouter les colonnes bancaires à owner_profiles
ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS bic VARCHAR(11),
  ADD COLUMN IF NOT EXISTS titulaire_compte VARCHAR(255),
  ADD COLUMN IF NOT EXISTS nom_banque VARCHAR(255);

-- Commentaires pour la documentation
COMMENT ON COLUMN owner_profiles.iban IS 'Numéro IBAN du compte bancaire';
COMMENT ON COLUMN owner_profiles.bic IS 'Code BIC/SWIFT de la banque';
COMMENT ON COLUMN owner_profiles.titulaire_compte IS 'Nom du titulaire du compte bancaire';
COMMENT ON COLUMN owner_profiles.nom_banque IS 'Nom de la banque';

COMMIT;

