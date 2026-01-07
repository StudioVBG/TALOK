-- Migration : Activation automatique des baux et synchronisation finale
-- Date: 2026-01-02

BEGIN;

-- 1. Fonction pour activer le bail si tous les signataires ont signé
CREATE OR REPLACE FUNCTION public.check_and_activate_lease()
RETURNS TRIGGER AS $$
DECLARE
    v_total_signers INTEGER;
    v_signed_count INTEGER;
BEGIN
    -- Compter le nombre de signataires requis
    SELECT COUNT(*) INTO v_total_signers
    FROM lease_signers
    WHERE lease_id = NEW.lease_id;

    -- Compter le nombre de signatures effectuées
    SELECT COUNT(*) INTO v_signed_count
    FROM lease_signers
    WHERE lease_id = NEW.lease_id
    AND signature_status = 'signed';

    -- Si tout le monde a signé (et qu'il y a au moins 2 personnes: proprio + locataire)
    IF v_total_signers >= 2 AND v_signed_count = v_total_signers THEN
        UPDATE leases
        SET statut = 'active',
            updated_at = NOW()
        WHERE id = NEW.lease_id
        AND statut = 'pending_signature';
        
        RAISE NOTICE 'Bail % activé automatiquement', NEW.lease_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger sur lease_signers
DROP TRIGGER IF EXISTS tr_check_activate_lease ON lease_signers;
CREATE TRIGGER tr_check_activate_lease
AFTER UPDATE OF signature_status ON lease_signers
FOR EACH ROW
WHEN (NEW.signature_status = 'signed')
EXECUTE FUNCTION public.check_and_activate_lease();

-- 3. Réparer les baux existants qui devraient être actifs
UPDATE leases l
SET statut = 'active',
    updated_at = NOW()
WHERE statut = 'pending_signature'
AND (
    SELECT COUNT(*) 
    FROM lease_signers ls 
    WHERE ls.lease_id = l.id
) >= 2
AND NOT EXISTS (
    SELECT 1 
    FROM lease_signers ls 
    WHERE ls.lease_id = l.id 
    AND ls.signature_status != 'signed'
);

COMMIT;

