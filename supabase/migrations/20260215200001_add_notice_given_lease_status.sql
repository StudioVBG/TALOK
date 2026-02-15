-- ============================================================================
-- MIGRATION CORRECTIVE: Harmonisation complète des statuts de bail
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Les migrations successives (20260107000001 → 20260108400000)
--           se sont écrasées mutuellement, supprimant des statuts légitimes
--           (sent, pending_owner_signature, amended, notice_given, cancelled).
--
-- FIX: Recréer la contrainte CHECK avec l'union de TOUS les statuts métier
--      nécessaires au cycle de vie complet d'un bail.
--
-- Flux normal :
--   draft → sent → pending_signature → partially_signed
--   → pending_owner_signature → fully_signed → active
--   → notice_given → terminated → archived
--
-- Branches :
--   draft|pending_signature → cancelled
--   active → amended → active (avenant)
-- ============================================================================

DO $$
BEGIN
  -- Supprimer toute contrainte CHECK existante sur statut
  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS check_lease_statut;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS lease_status_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Recréer avec la liste complète et définitive
  ALTER TABLE leases
    ADD CONSTRAINT leases_statut_check CHECK (
      statut IN (
        'draft',                    -- Brouillon initial
        'sent',                     -- Envoyé au locataire pour lecture
        'pending_signature',        -- En attente de signatures
        'partially_signed',         -- Au moins un signataire a signé
        'pending_owner_signature',  -- Locataire(s) signé(s), attente propriétaire
        'fully_signed',             -- Tous ont signé (avant activation)
        'active',                   -- Bail en cours
        'notice_given',             -- Congé donné (préavis en cours)
        'amended',                  -- Avenant en cours de traitement
        'terminated',               -- Résilié / terminé
        'archived',                 -- Archivé (conservation légale)
        'cancelled'                 -- Annulé (jamais activé)
      )
    );

  RAISE NOTICE '[MIGRATION] CHECK constraint leases_statut_check harmonisée — 12 statuts';
END $$;

-- Mettre à jour le commentaire de colonne
COMMENT ON COLUMN leases.statut IS 'Statut du bail: draft, sent, pending_signature, partially_signed, pending_owner_signature, fully_signed, active, notice_given, amended, terminated, archived, cancelled';

-- Index partiel pour baux en attente d'action (requêtes fréquentes)
DROP INDEX IF EXISTS idx_leases_pending_action;
CREATE INDEX IF NOT EXISTS idx_leases_pending_action ON leases(statut) 
  WHERE statut IN ('pending_signature', 'partially_signed', 'pending_owner_signature', 'fully_signed', 'sent');
