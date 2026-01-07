-- Migration: Triggers de synchronisation EDL/Bail
-- Date: 2026-01-05
-- Description: Assure la synchronisation automatique des statuts entre EDL et baux

-- ============================================================================
-- 1. Fonction de vérification et finalisation de l'EDL
-- ============================================================================
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

    -- Vérifier les signatures (support des rôles FR et EN)
    SELECT 
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
            AND signer_role IN ('owner', 'proprietaire', 'bailleur') 
            AND signature_image_path IS NOT NULL
            AND signed_at IS NOT NULL
        ),
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
            AND signer_role IN ('tenant', 'locataire', 'locataire_principal') 
            AND signature_image_path IS NOT NULL
            AND signed_at IS NOT NULL
        )
    INTO v_has_owner, v_has_tenant;

    -- Si les deux parties ont signé
    IF v_has_owner AND v_has_tenant THEN
        -- Récupérer les infos de l'EDL
        SELECT type, lease_id INTO v_edl_type, v_lease_id 
        FROM edl WHERE id = v_edl_id;

        -- Mettre l'EDL en statut 'signed'
        UPDATE edl SET 
            status = 'signed',
            completed_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE id = v_edl_id 
        AND status != 'signed';

        -- Si c'est un EDL d'entrée, activer le bail
        IF v_edl_type = 'entree' AND v_lease_id IS NOT NULL THEN
            UPDATE leases SET 
                statut = 'active',
                activated_at = NOW(),
                updated_at = NOW()
            WHERE id = v_lease_id 
            AND statut IN ('fully_signed', 'pending_signature', 'partially_signed', 'sent');

            -- Émettre un événement pour la facturation
            INSERT INTO outbox (event_type, payload)
            VALUES ('Lease.Activated', jsonb_build_object(
                'lease_id', v_lease_id,
                'edl_id', v_edl_id,
                'action', 'generate_initial_invoice',
                'triggered_by', 'edl_signature_trigger'
            ));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Trigger sur edl_signatures (INSERT et UPDATE)
-- ============================================================================
DROP TRIGGER IF EXISTS tr_check_edl_finalization ON edl_signatures;
CREATE TRIGGER tr_check_edl_finalization
AFTER INSERT OR UPDATE OF signature_image_path, signed_at ON edl_signatures
FOR EACH ROW
EXECUTE FUNCTION public.check_edl_finalization();

-- ============================================================================
-- 3. Trigger sur edl pour activer le bail si statut passe à 'signed'
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_activate_lease_on_edl_signed()
RETURNS TRIGGER AS $$
BEGIN
    -- Si l'EDL d'entrée passe à "signed"
    IF NEW.type = 'entree' 
       AND NEW.status = 'signed' 
       AND (OLD.status IS NULL OR OLD.status != 'signed') 
    THEN
        UPDATE leases
        SET 
            statut = 'active',
            activated_at = NOW(),
            entry_edl_id = NEW.id,
            updated_at = NOW()
        WHERE id = NEW.lease_id 
        AND statut IN ('fully_signed', 'pending_signature', 'partially_signed', 'sent');
        
        RAISE NOTICE 'Bail % activé suite à la signature de l''EDL %', NEW.lease_id, NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON edl;
CREATE TRIGGER auto_activate_lease_on_edl
AFTER UPDATE OF status ON edl
FOR EACH ROW
EXECUTE FUNCTION public.trigger_activate_lease_on_edl_signed();

-- ============================================================================
-- 4. Correction immédiate des données existantes
-- ============================================================================

-- 4a. Corriger les EDL avec signatures complètes mais pas en 'signed'
UPDATE edl e
SET 
    status = 'signed', 
    completed_date = CURRENT_DATE,
    updated_at = NOW()
WHERE status != 'signed'
AND EXISTS (
    SELECT 1 FROM edl_signatures s 
    WHERE s.edl_id = e.id 
    AND s.signer_role IN ('owner', 'proprietaire', 'bailleur')
    AND s.signature_image_path IS NOT NULL
    AND s.signed_at IS NOT NULL
)
AND EXISTS (
    SELECT 1 FROM edl_signatures s 
    WHERE s.edl_id = e.id 
    AND s.signer_role IN ('tenant', 'locataire', 'locataire_principal')
    AND s.signature_image_path IS NOT NULL
    AND s.signed_at IS NOT NULL
);

-- 4b. Activer les baux dont l'EDL d'entrée est signé
UPDATE leases l
SET 
    statut = 'active', 
    activated_at = NOW(),
    updated_at = NOW()
WHERE statut IN ('fully_signed', 'pending_signature', 'partially_signed', 'sent')
AND EXISTS (
    SELECT 1 FROM edl e 
    WHERE e.lease_id = l.id 
    AND e.status = 'signed' 
    AND e.type = 'entree'
);

-- ============================================================================
-- 5. Vérification
-- ============================================================================
DO $$
DECLARE
    v_edl_count INTEGER;
    v_lease_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_edl_count FROM edl WHERE status = 'signed';
    SELECT COUNT(*) INTO v_lease_count FROM leases WHERE statut = 'active';
    
    RAISE NOTICE 'Migration terminée: % EDL signés, % baux actifs', v_edl_count, v_lease_count;
END $$;

SELECT 'Migration EDL/Lease sync triggers appliquée avec succès' AS status;

