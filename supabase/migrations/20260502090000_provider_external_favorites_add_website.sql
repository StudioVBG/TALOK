-- =====================================================
-- Migration: provider_external_favorites — ajout website
-- =====================================================
-- Le Text Search Google Places ne renvoie pas le site web : il faut un
-- appel Place Details supplémentaire. Pour éviter de re-payer cet appel
-- à chaque ouverture de la fiche favorite, on persiste l'URL aux côtés
-- du téléphone.
-- =====================================================

ALTER TABLE provider_external_favorites
  ADD COLUMN IF NOT EXISTS website TEXT;

NOTIFY pgrst, 'reload schema';
