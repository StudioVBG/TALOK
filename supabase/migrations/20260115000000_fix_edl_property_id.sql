-- ============================================================================
-- MIGRATION: Ajouter property_id à la table edl pour accès direct
-- Date: 2026-01-15
-- Problème: L'EDL n'avait pas de lien direct vers la propriété,
--           nécessitant des jointures via le bail
-- ============================================================================

-- 1. Ajouter la colonne property_id si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'edl' AND column_name = 'property_id'
    ) THEN
        ALTER TABLE edl ADD COLUMN property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

        -- Créer un index pour les performances
        CREATE INDEX IF NOT EXISTS idx_edl_property_id ON edl(property_id);

        -- Remplir les property_id existants à partir des baux
        UPDATE edl e
        SET property_id = l.property_id
        FROM leases l
        WHERE e.lease_id = l.id AND e.property_id IS NULL;

        RAISE NOTICE 'Colonne property_id ajoutée à la table edl';
    END IF;
END $$;

-- 2. Rendre le lease_id nullable (l'EDL peut être lié directement à une propriété sans bail)
DO $$
BEGIN
    -- Supprimer la contrainte NOT NULL si elle existe
    ALTER TABLE edl ALTER COLUMN lease_id DROP NOT NULL;
    RAISE NOTICE 'Contrainte NOT NULL supprimée de lease_id';
EXCEPTION WHEN OTHERS THEN
    -- Déjà nullable ou autre erreur, ignorer
    NULL;
END $$;

-- 3. Ajouter une contrainte pour s'assurer qu'au moins property_id ou lease_id est défini
-- (Commenté car peut causer des problèmes avec les données existantes)
-- ALTER TABLE edl ADD CONSTRAINT edl_property_or_lease_check
--   CHECK (property_id IS NOT NULL OR lease_id IS NOT NULL);

-- 4. Commentaire
COMMENT ON COLUMN edl.property_id IS 'Lien direct vers la propriété pour éviter les jointures via le bail';
