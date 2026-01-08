-- ============================================
-- Migration : PDF final pour baux signés
-- Date : 2025-12-28
-- ============================================
-- Un bail signé par toutes les parties devient immutable.
-- Le PDF final est stocké et ne peut plus être modifié.
-- ============================================

-- 1. Ajouter la colonne pour stocker le chemin du PDF signé
ALTER TABLE leases 
ADD COLUMN IF NOT EXISTS signed_pdf_path TEXT;

-- 2. Ajouter une colonne pour la date de scellement
ALTER TABLE leases 
ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ;

-- 3. Commentaires pour documentation
COMMENT ON COLUMN leases.signed_pdf_path IS 'Chemin du PDF final signé dans Storage (immutable après signature complète)';
COMMENT ON COLUMN leases.sealed_at IS 'Date à laquelle le bail a été scellé (toutes signatures collectées)';

-- 4. Index pour rechercher les baux scellés
CREATE INDEX IF NOT EXISTS idx_leases_sealed ON leases(sealed_at) WHERE sealed_at IS NOT NULL;

-- 5. Fonction pour vérifier si un bail est modifiable
CREATE OR REPLACE FUNCTION is_lease_editable(p_lease_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_statut TEXT;
  v_sealed_at TIMESTAMPTZ;
BEGIN
  SELECT statut, sealed_at INTO v_statut, v_sealed_at
  FROM leases
  WHERE id = p_lease_id;
  
  -- Un bail est modifiable si :
  -- 1. Il n'est pas encore scellé (sealed_at IS NULL)
  -- 2. Son statut permet les modifications
  RETURN v_sealed_at IS NULL AND v_statut IN ('draft', 'sent', 'pending_signature', 'partially_signed', 'pending_owner_signature');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger pour empêcher les modifications sur un bail scellé
CREATE OR REPLACE FUNCTION prevent_sealed_lease_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le bail est scellé, bloquer certaines modifications
  IF OLD.sealed_at IS NOT NULL THEN
    -- Autoriser uniquement les changements de statut vers terminated/archived
    -- et les mises à jour de activated_at, entry_edl_id
    IF NEW.statut NOT IN ('active', 'terminated', 'archived', 'fully_signed') 
       OR NEW.loyer != OLD.loyer 
       OR NEW.charges_forfaitaires != OLD.charges_forfaitaires
       OR NEW.date_debut != OLD.date_debut
       OR NEW.date_fin != OLD.date_fin
       OR NEW.type_bail != OLD.type_bail THEN
      RAISE EXCEPTION 'Ce bail est scellé et ne peut plus être modifié. Seul le statut peut évoluer vers terminé ou archivé.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS check_sealed_lease ON leases;
CREATE TRIGGER check_sealed_lease
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sealed_lease_modification();

-- 7. Fonction pour sceller un bail (appelée après signature complète)
CREATE OR REPLACE FUNCTION seal_lease(p_lease_id UUID, p_pdf_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_all_signed BOOLEAN;
BEGIN
  -- Vérifier que toutes les signatures sont présentes
  SELECT COUNT(*) = SUM(CASE WHEN signature_status = 'signed' THEN 1 ELSE 0 END)
  INTO v_all_signed
  FROM lease_signers
  WHERE lease_id = p_lease_id;
  
  IF NOT v_all_signed THEN
    RAISE EXCEPTION 'Toutes les signatures ne sont pas présentes';
  END IF;
  
  -- Sceller le bail
  UPDATE leases
  SET 
    signed_pdf_path = p_pdf_path,
    sealed_at = NOW(),
    statut = 'fully_signed'
  WHERE id = p_lease_id
    AND sealed_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION seal_lease IS 'Scelle un bail après signature complète. Stocke le PDF final et empêche les modifications futures.';














