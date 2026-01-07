-- Migration : Activer l'auto-activation du bail après signature de l'EDL
-- Date: 2026-01-04

-- 1. Fonction pour activer le bail
CREATE OR REPLACE FUNCTION public.trigger_activate_lease_on_edl_signed()
RETURNS TRIGGER AS $$
BEGIN
  -- Si l'EDL d'entrée passe à "signed"
  IF NEW.type = 'entree' AND NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    -- Mettre à jour le bail associé
    UPDATE leases
    SET 
      statut = 'active',
      activated_at = NOW(),
      entry_edl_id = NEW.id,
      updated_at = NOW()
    WHERE id = NEW.lease_id 
    AND statut IN ('fully_signed', 'pending_signature', 'partially_signed');
    
    RAISE NOTICE 'Bail % activé suite à la signature de l''EDL %', NEW.lease_id, NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Création effective du trigger
DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON edl;
CREATE TRIGGER auto_activate_lease_on_edl
  AFTER UPDATE OF status ON edl
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_activate_lease_on_edl_signed();

-- 3. Correction immédiate pour les baux déjà signés avec EDL signé
UPDATE leases l
SET statut = 'active', 
    activated_at = NOW(),
    updated_at = NOW()
WHERE l.statut IN ('fully_signed', 'pending_signature', 'partially_signed')
AND EXISTS (
    SELECT 1 FROM edl e 
    WHERE e.lease_id = l.id 
    AND e.status = 'signed' 
    AND e.type = 'entree'
);


