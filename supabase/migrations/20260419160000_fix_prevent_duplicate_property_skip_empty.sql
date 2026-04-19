-- ----------------------------------------------------------------------------
-- Fix: prevent_duplicate_property() bloquait la création de drafts via
-- /api/properties/init quand un draft fantôme à adresse vide existait déjà
-- pour le même owner. Le trigger considérait deux INSERTs avec
-- adresse_complete='' et code_postal='' comme un doublon.
--
-- Changements:
--  1. Skip la vérification si NEW n'a pas encore d'adresse réelle (drafts init)
--  2. Skip pour les wrappers d'immeuble (jamais en doublon avec un lot)
--  3. Exclure les rows existantes en etat='draft' (n'empêchent pas une nouvelle
--     création si l'utilisateur veut recommencer)
--  4. Exclure les rows existantes type='immeuble' (un wrapper d'immeuble n'est
--     pas un doublon d'un bien individuel à la même adresse)
--  5. Cleanup en fin de migration des drafts fantômes accumulés > 24h
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_duplicate_property()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- Skip si NEW n'a pas encore d'adresse réelle (cas des drafts init)
  IF NEW.adresse_complete IS NULL
     OR TRIM(NEW.adresse_complete) = ''
     OR NEW.code_postal IS NULL
     OR TRIM(NEW.code_postal) = '' THEN
    RETURN NEW;
  END IF;

  -- Skip pour les wrappers d'immeuble (jamais en doublon avec un lot)
  IF NEW.type = 'immeuble' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_id
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND LOWER(TRIM(adresse_complete)) = LOWER(TRIM(NEW.adresse_complete))
    AND code_postal = NEW.code_postal
    AND deleted_at IS NULL
    AND COALESCE(etat, 'published') <> 'draft'
    AND type <> 'immeuble'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Propriété en doublon détectée (id: %). Même adresse et code postal pour ce propriétaire.', v_existing_id
      USING HINT = 'Vérifiez si cette propriété existe déjà avant d''en créer une nouvelle.',
            ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger reste identique (BEFORE INSERT) — on ne re-crée que la fonction.

-- ----------------------------------------------------------------------------
-- Cleanup: supprimer les drafts fantômes à adresse vide créés il y a > 24h
-- pour éviter l'accumulation pour les utilisateurs déjà bloqués.
-- ----------------------------------------------------------------------------
DELETE FROM properties
WHERE etat = 'draft'
  AND (adresse_complete IS NULL OR TRIM(adresse_complete) = '')
  AND created_at < NOW() - INTERVAL '24 hours';
