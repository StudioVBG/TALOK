-- ============================================
-- Migration : Rendre site_id nullable sur buildings
--
-- La colonne site_id (FK vers sites) a été créée NOT NULL par la
-- migration copropriété (20251208). Pour les immeubles locatifs
-- gérés par un propriétaire, il n'y a pas de site de copropriété :
-- site_id doit être nullable.
-- ============================================

ALTER TABLE buildings ALTER COLUMN site_id DROP NOT NULL;
