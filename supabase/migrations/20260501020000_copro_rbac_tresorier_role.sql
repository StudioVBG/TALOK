-- RBAC intra-copropriété : ajout du rôle "tresorier"
--
-- Permet au syndic professionnel de déléguer la gestion comptable
-- (validation des dépenses, répartition des tantièmes, appels de fonds)
-- à un membre du conseil syndical désigné comme trésorier.
--
-- Rôles existants conservés :
--   - syndic              : cabinet syndic professionnel (admin du site)
--   - conseil_syndical    : membre du conseil syndical (lecture étendue)
--   - coproprietaire      : copropriétaire (vote AG, voir ses lots)
--   - coproprietaire_bailleur : propriétaire qui loue son lot
--   - locataire_copro     : locataire d'un copropriétaire bailleur
-- Nouveau rôle :
--   - tresorier           : trésorier élu par le conseil syndical
--                           (peut allouer, valider dépenses, créer appels de fonds)

DO $$
BEGIN
  -- 1. Drop l'ancienne CHECK
  ALTER TABLE user_site_roles
    DROP CONSTRAINT IF EXISTS user_site_roles_role_code_check;

  -- 2. Recréer la CHECK avec le nouveau rôle
  ALTER TABLE user_site_roles
    ADD CONSTRAINT user_site_roles_role_code_check
    CHECK (role_code IN (
      'syndic',
      'conseil_syndical',
      'tresorier',
      'coproprietaire',
      'coproprietaire_bailleur',
      'locataire_copro'
    ));
EXCEPTION
  WHEN OTHERS THEN
    -- Tolérant si la table ou la contrainte n'existent pas (environnements sans module copro)
    RAISE NOTICE 'Skipping user_site_roles CHECK update: %', SQLERRM;
END $$;

-- Index pour accélérer les lookups par rôle dans un site donné
-- (utilisé par requireCoproRole helper côté applicatif)
CREATE INDEX IF NOT EXISTS idx_user_site_roles_site_role
  ON user_site_roles(site_id, role_code);

COMMENT ON COLUMN user_site_roles.role_code IS
  'Rôle intra-copropriété : syndic / tresorier / conseil_syndical / coproprietaire / coproprietaire_bailleur / locataire_copro';
