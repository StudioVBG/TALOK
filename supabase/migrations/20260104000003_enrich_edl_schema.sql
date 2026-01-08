-- ============================================================================
-- MIGRATION: Enrichir le schéma EDL pour les compteurs et les clés
-- Date: 2026-01-04
-- ============================================================================

-- 1. Ajouter la colonne 'general_notes' et 'keys' à la table edl si elles n'existent pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'general_notes') THEN
        ALTER TABLE edl ADD COLUMN general_notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'keys') THEN
        ALTER TABLE edl ADD COLUMN keys JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. Ajouter la colonne 'category' et 'description' à la table edl_items
-- Utile pour classer les items (ex: 'cles', 'compteurs') si on ne veut pas de tables séparées
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'category') THEN
        ALTER TABLE edl_items ADD COLUMN category TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'description') THEN
        ALTER TABLE edl_items ADD COLUMN description TEXT;
    END IF;
END $$;

-- 3. Ajouter des indexes pour les performances
CREATE INDEX IF NOT EXISTS idx_edl_items_category ON edl_items(category);

-- 4. Commentaires
COMMENT ON COLUMN edl.keys IS 'Liste des clés remises (JSONB array: [{type, quantite, notes}])';
COMMENT ON COLUMN edl_items.category IS 'Catégorie de l''item (ex: cles, electricite, etc.)';
COMMENT ON COLUMN edl_items.description IS 'Description détaillée ou informations complémentaires sur l''item';

