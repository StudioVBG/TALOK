-- Migration : Consolidation de la colonne `loyer_reference_majore`
--
-- Contexte :
-- Deux migrations historiques ont créé deux colonnes au nom quasi identique
-- mais avec un caractère accentué différent :
--   * 202411140220_property_financial_diagnostics.sql → `loyer_reference_majoré` (avec accent é)
--   * 20260128000000_surface_carrez_rent_control.sql  → `loyer_reference_majore` (sans accent)
--
-- Résultat en prod : la table `properties` peut posséder les DEUX colonnes
-- simultanément (les ALTER TABLE ... IF NOT EXISTS ne suppriment jamais
-- l'ancienne). Selon le call site TypeScript, les valeurs sont écrites dans
-- l'une ou l'autre, ce qui provoque des incohérences (validation Zod versus
-- column-not-found, et données partiellement perdues).
--
-- Cette migration :
--   1. Copie les valeurs de la colonne accentuée vers la colonne non-accentuée
--      (en priorisant la valeur non-NULL existante).
--   2. Drop la vue `active_properties` qui dépend de la colonne (elle est en
--      SELECT *, on la recrée à l'identique).
--   3. Drop la colonne accentuée (`loyer_reference_majoré`).
--   4. Recrée la vue avec le schéma à jour.
--
-- Idempotente : aucune action si la colonne accentuée n'existe plus.

BEGIN;

DO $$
DECLARE
  has_accented   BOOLEAN;
  has_unaccented BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'loyer_reference_majoré'
  ) INTO has_accented;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'loyer_reference_majore'
  ) INTO has_unaccented;

  IF has_accented THEN
    -- S'assurer que la colonne cible existe avant la copie
    IF NOT has_unaccented THEN
      ALTER TABLE properties ADD COLUMN loyer_reference_majore NUMERIC(12,2);
    END IF;

    -- Copier les valeurs : priorité à la valeur non-NULL existante côté
    -- non-accentuée, fallback sur l'accentuée pour récupérer les données
    -- écrites par les anciens call sites.
    EXECUTE 'UPDATE properties SET loyer_reference_majore = COALESCE(loyer_reference_majore, "loyer_reference_majoré")';

    -- Drop des objets dépendants avant le DROP COLUMN. La vue est en SELECT *
    -- donc on peut la recréer à l'identique juste après — la définition
    -- correspond à celle posée par 20260128000000_surface_carrez_rent_control.
    DROP VIEW IF EXISTS active_properties CASCADE;

    -- Supprimer la colonne accentuée maintenant que les données sont
    -- consolidées dans la version canonique.
    ALTER TABLE properties DROP COLUMN "loyer_reference_majoré";

    -- Recréer la vue avec le nouveau schéma (sans la colonne accentuée).
    CREATE OR REPLACE VIEW active_properties AS
      SELECT * FROM properties
      WHERE deleted_at IS NULL
        AND (etat IS NULL OR etat != 'deleted');
  END IF;
END $$;

COMMENT ON COLUMN properties.loyer_reference_majore IS
  'Loyer de référence majoré (encadrement ALUR/ELAN). Colonne canonique sans accent (consolidée 2026-04-28).';

COMMIT;
