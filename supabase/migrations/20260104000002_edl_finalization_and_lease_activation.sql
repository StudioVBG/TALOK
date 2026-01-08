-- Migration pour automatiser la finalisation de l'EDL et l'activation du bail
-- Correction des rôles pour la détection des signatures

CREATE OR REPLACE FUNCTION public.check_edl_finalization()
RETURNS TRIGGER AS $$
DECLARE
    v_has_owner BOOLEAN;
    v_has_tenant BOOLEAN;
    v_edl_type TEXT;
    v_lease_id UUID;
    v_edl_id UUID;
BEGIN
    v_edl_id := NEW.edl_id;

    -- 1. Vérifier les signatures pour cet EDL
    -- On est plus souple sur les noms de rôles
    SELECT 
        EXISTS (SELECT 1 FROM edl_signatures WHERE edl_id = v_edl_id AND (signer_role IN ('owner', 'proprietaire', 'bailleur')) AND signature_image_path IS NOT NULL),
        EXISTS (SELECT 1 FROM edl_signatures WHERE edl_id = v_edl_id AND (signer_role IN ('tenant', 'locataire', 'locataire_principal')) AND signature_image_path IS NOT NULL)
    INTO v_has_owner, v_has_tenant;

    -- 2. Si les deux ont signé
    IF v_has_owner AND v_has_tenant THEN
        -- Récupérer les infos de l'EDL
        SELECT type, lease_id INTO v_edl_type, v_lease_id FROM edl WHERE id = v_edl_id;

        -- Mettre l'EDL en statut 'signed'
        UPDATE edl SET 
            status = 'signed',
            completed_date = NOW(),
            updated_at = NOW()
        WHERE id = v_edl_id 
        AND status != 'signed';

        -- 3. Si c'est un EDL d'entrée, on active le bail
        IF v_edl_type = 'entree' THEN
            -- Vérifier si le bail est déjà au moins fully_signed
            UPDATE leases SET 
                statut = 'active',
                activated_at = NOW(),
                updated_at = NOW()
            WHERE id = v_lease_id 
            AND statut IN ('fully_signed', 'pending_signature', 'partially_signed', 'sent');

            -- Déclencher un événement outbox pour la facture initiale (sera traité par un worker)
            INSERT INTO outbox (event_type, payload)
            VALUES ('Lease.Activated', jsonb_build_object(
                'lease_id', v_lease_id,
                'edl_id', v_edl_id,
                'action', 'generate_initial_invoice'
            ));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur edl_signatures
DROP TRIGGER IF EXISTS tr_check_edl_finalization ON edl_signatures;
CREATE TRIGGER tr_check_edl_finalization
AFTER INSERT OR UPDATE OF signature_image_path ON edl_signatures
FOR EACH ROW
EXECUTE FUNCTION public.check_edl_finalization();

-- Correction immédiate des EDL déjà signés mais bloqués en brouillon
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT id FROM edl WHERE status != 'signed'
    LOOP
        -- Simuler un update pour déclencher la logique (ou appeler la fonction manuellement)
        -- Ici on appelle la logique pour chaque signature existante
        PERFORM check_edl_finalization();
    END LOOP;
END $$;

