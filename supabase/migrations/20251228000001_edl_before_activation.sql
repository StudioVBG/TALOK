-- ============================================
-- Migration : EDL obligatoire avant activation
-- Date : 2025-12-28
-- ============================================
-- FLUX LÉGAL FRANÇAIS :
-- 1. Bail signé par toutes les parties → statut "fully_signed"
-- 2. EDL d'entrée réalisé et signé
-- 3. Bail activé → statut "active"
-- ============================================

-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE leases 
DROP CONSTRAINT IF EXISTS leases_statut_check;

-- Ajouter la nouvelle contrainte avec tous les statuts du cycle de vie
ALTER TABLE leases
ADD CONSTRAINT leases_statut_check
CHECK (statut IN (
  'draft',              -- Brouillon
  'sent',               -- Envoyé pour signature
  'pending_signature',  -- En attente de signatures
  'partially_signed',   -- Partiellement signé (au moins une signature)
  'pending_owner_signature', -- Locataire(s) signé, attente propriétaire
  'fully_signed',       -- Entièrement signé (AVANT activation - attend EDL)
  'active',             -- Actif (APRÈS EDL d'entrée)
  'amended',            -- Avenant en cours
  'suspended',          -- Suspendu temporairement
  'terminated',         -- Terminé
  'archived'            -- Archivé
));

-- Ajouter une colonne pour suivre la date d'activation réelle
ALTER TABLE leases
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- Ajouter une colonne pour stocker l'ID de l'EDL d'entrée qui a déclenché l'activation
ALTER TABLE leases
ADD COLUMN IF NOT EXISTS entry_edl_id UUID REFERENCES edl(id) ON DELETE SET NULL;

-- Index pour rechercher les baux en attente d'activation
CREATE INDEX IF NOT EXISTS idx_leases_fully_signed ON leases(statut) WHERE statut = 'fully_signed';

-- Commentaires pour documentation
COMMENT ON COLUMN leases.activated_at IS 'Date réelle d''activation du bail (après EDL d''entrée)';
COMMENT ON COLUMN leases.entry_edl_id IS 'Référence à l''EDL d''entrée qui a permis l''activation';

-- ============================================
-- Fonction : Vérifier si un bail peut être activé
-- ============================================
DROP FUNCTION IF EXISTS can_activate_lease(UUID);
CREATE OR REPLACE FUNCTION can_activate_lease(p_lease_id UUID)
RETURNS TABLE(
  can_activate BOOLEAN,
  reason TEXT,
  edl_status TEXT
) AS $$
DECLARE
  v_lease_status TEXT;
  v_edl_record RECORD;
BEGIN
  -- Récupérer le statut du bail
  SELECT statut INTO v_lease_status
  FROM leases
  WHERE id = p_lease_id;
  
  IF v_lease_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Bail non trouvé'::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  IF v_lease_status != 'fully_signed' THEN
    RETURN QUERY SELECT FALSE, 
      ('Le bail doit être entièrement signé (statut actuel: ' || v_lease_status || ')')::TEXT, 
      NULL::TEXT;
    RETURN;
  END IF;
  
  -- Vérifier l'EDL d'entrée
  SELECT id, status INTO v_edl_record
  FROM edl
  WHERE lease_id = p_lease_id AND type = 'entree'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_edl_record.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 
      'Aucun état des lieux d''entrée n''existe pour ce bail'::TEXT, 
      NULL::TEXT;
    RETURN;
  END IF;
  
  IF v_edl_record.status != 'signed' THEN
    RETURN QUERY SELECT FALSE, 
      ('L''état des lieux d''entrée doit être signé (statut actuel: ' || v_edl_record.status || ')')::TEXT, 
      v_edl_record.status;
    RETURN;
  END IF;
  
  -- Tout est OK
  RETURN QUERY SELECT TRUE, 'Prêt pour activation'::TEXT, v_edl_record.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Trigger : Auto-activation si EDL signé
-- (Optionnel - peut être commenté si activation manuelle préférée)
-- ============================================
DROP FUNCTION IF EXISTS trigger_activate_lease_on_edl_signed() CASCADE;
CREATE OR REPLACE FUNCTION trigger_activate_lease_on_edl_signed()
RETURNS TRIGGER AS $$
BEGIN
  -- Si l'EDL d'entrée passe à "signed"
  IF NEW.type = 'entree' AND NEW.status = 'signed' AND OLD.status != 'signed' THEN
    -- Vérifier que le bail est bien "fully_signed"
    IF EXISTS (
      SELECT 1 FROM leases 
      WHERE id = NEW.lease_id 
      AND statut = 'fully_signed'
    ) THEN
      -- Activer le bail
      UPDATE leases
      SET 
        statut = 'active',
        activated_at = NOW(),
        entry_edl_id = NEW.id,
        updated_at = NOW()
      WHERE id = NEW.lease_id;
      
      -- Log l'événement
      INSERT INTO audit_log (action, entity_type, entity_id, metadata)
      VALUES (
        'lease_auto_activated',
        'lease',
        NEW.lease_id,
        jsonb_build_object(
          'triggered_by', 'edl_signed',
          'edl_id', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger (désactivé par défaut - décommenter pour activation automatique)
-- DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON edl;
-- CREATE TRIGGER auto_activate_lease_on_edl
--   AFTER UPDATE ON edl
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_activate_lease_on_edl_signed();

-- ============================================
-- Vue : Baux en attente d'activation
-- ============================================
CREATE OR REPLACE VIEW v_leases_awaiting_activation AS
SELECT 
  l.id AS lease_id,
  l.date_debut,
  l.date_fin,
  l.type_bail,
  l.statut,
  l.created_at AS lease_created_at,
  p.id AS property_id,
  p.adresse_complete AS adresse,
  p.ville,
  p.code_postal,
  e.id AS edl_id,
  e.status AS edl_status,
  e.scheduled_date AS edl_scheduled,
  CASE 
    WHEN e.id IS NULL THEN 'Créer l''EDL d''entrée'
    WHEN e.status = 'draft' THEN 'Compléter l''EDL'
    WHEN e.status = 'in_progress' THEN 'Terminer l''EDL'
    WHEN e.status = 'completed' THEN 'Faire signer l''EDL'
    WHEN e.status = 'signed' THEN 'Prêt à activer'
    ELSE 'État inconnu'
  END AS next_action
FROM leases l
JOIN properties p ON l.property_id = p.id
LEFT JOIN edl e ON e.lease_id = l.id AND e.type = 'entree'
WHERE l.statut = 'fully_signed'
ORDER BY l.date_debut ASC;

COMMENT ON VIEW v_leases_awaiting_activation IS 'Liste des baux signés en attente d''activation (EDL requis)';





