-- =====================================================
-- MIGRATION: SOTA 2026 - Contrainte de statuts de bail
-- Date: 2026-01-07
-- Description: Garantit que tous les statuts légaux de bail sont autorisés
-- =====================================================

-- 1. Supprimer l'ancienne contrainte si elle existe
ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;

-- 2. Ajouter la nouvelle contrainte avec TOUS les statuts SOTA 2026
ALTER TABLE leases ADD CONSTRAINT leases_statut_check 
  CHECK (statut IN (
    'draft',                   -- Brouillon initial
    'sent',                    -- Envoyé pour signature
    'pending_signature',       -- En attente de signatures
    'partially_signed',        -- Partiellement signé
    'pending_owner_signature', -- Locataire signé, attente propriétaire
    'fully_signed',            -- Entièrement signé (avant activation)
    'active',                  -- Bail en cours
    'notice_given',            -- Congé donné (préavis)
    'amended',                 -- Avenant en cours
    'terminated',              -- Terminé
    'archived'                 -- Archivé
  ));

-- 3. Créer un index pour optimiser les requêtes par statut
CREATE INDEX IF NOT EXISTS idx_leases_statut ON leases(statut);

-- 4. Index partiel pour les baux en attente d'action (les plus fréquemment consultés)
CREATE INDEX IF NOT EXISTS idx_leases_pending_action ON leases(statut) 
  WHERE statut IN ('pending_signature', 'partially_signed', 'pending_owner_signature', 'fully_signed');

-- 5. Commenter pour la documentation
COMMENT ON COLUMN leases.statut IS 'Statut du bail: draft, sent, pending_signature, partially_signed, pending_owner_signature, fully_signed, active, notice_given, amended, terminated, archived';

-- 6. Log de migration
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM leases;
  RAISE NOTICE '[MIGRATION] Contrainte statuts SOTA 2026 appliquée. % baux existants.', v_count;
END $$;

