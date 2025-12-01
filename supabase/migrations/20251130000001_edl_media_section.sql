-- Migration : Ajouter le champ section à edl_media pour lier les photos aux pièces
-- Date: 2025-11-30

BEGIN;

-- Ajouter la colonne section pour stocker l'ID de la pièce ou le nom de section
ALTER TABLE edl_media
  ADD COLUMN IF NOT EXISTS section TEXT;

-- Index pour accélérer les requêtes par section
CREATE INDEX IF NOT EXISTS idx_edl_media_section ON edl_media(section);

-- Commentaire explicatif
COMMENT ON COLUMN edl_media.section IS 'ID de la pièce (room) ou nom de section pour organiser les photos par zone du logement';

COMMIT;

