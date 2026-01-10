-- =====================================================
-- SCRIPT DE RÉINITIALISATION DU BAIL BB79E040
-- À exécuter dans Supabase SQL Editor
-- =====================================================

-- Variables
DO $$
DECLARE
    v_lease_id UUID := 'bb79e040-9fdf-4365-a4a5-6090d417ae97';
    v_signers_count INTEGER;
    v_edl_count INTEGER;
BEGIN
    RAISE NOTICE '=== RÉINITIALISATION DU BAIL % ===', v_lease_id;

    -- 1. Afficher l'état actuel
    RAISE NOTICE 'État actuel du bail:';
    SELECT statut INTO STRICT v_edl_count FROM leases WHERE id = v_lease_id;
    RAISE NOTICE '  Statut: %', v_edl_count;

    -- 2. Réinitialiser les signatures
    UPDATE lease_signers
    SET 
        signature_status = 'pending',
        signed_at = NULL,
        signature_image = NULL,
        signature_image_path = NULL,
        proof_id = NULL,
        proof_metadata = NULL,
        document_hash = NULL,
        ip_inet = NULL,
        user_agent = NULL
    WHERE lease_id = v_lease_id;
    
    GET DIAGNOSTICS v_signers_count = ROW_COUNT;
    RAISE NOTICE '  Signatures réinitialisées: %', v_signers_count;

    -- 3. Mettre le bail en pending_signature
    UPDATE leases
    SET 
        statut = 'pending_signature',
        updated_at = NOW()
    WHERE id = v_lease_id;
    RAISE NOTICE '  Bail passé à pending_signature';

    -- 4. Réinitialiser l'EDL d'entrée si existant
    UPDATE edl
    SET 
        status = 'draft',
        completed_date = NULL
    WHERE lease_id = v_lease_id AND type = 'entree';
    
    GET DIAGNOSTICS v_edl_count = ROW_COUNT;
    RAISE NOTICE '  EDL réinitialisés: %', v_edl_count;

    -- 5. Supprimer les signatures EDL
    DELETE FROM edl_signatures
    WHERE edl_id IN (SELECT id FROM edl WHERE lease_id = v_lease_id);
    
    GET DIAGNOSTICS v_signers_count = ROW_COUNT;
    RAISE NOTICE '  Signatures EDL supprimées: %', v_signers_count;

    -- 6. Supprimer les factures non payées
    DELETE FROM invoices
    WHERE lease_id = v_lease_id
    AND statut IN ('draft', 'sent', 'late');
    
    GET DIAGNOSTICS v_edl_count = ROW_COUNT;
    RAISE NOTICE '  Factures non payées supprimées: %', v_edl_count;

    RAISE NOTICE '=== RÉINITIALISATION TERMINÉE ===';
END $$;

-- Vérification finale
SELECT 
    l.id,
    l.statut,
    l.date_debut,
    l.loyer,
    l.charges_forfaitaires,
    (SELECT COUNT(*) FROM lease_signers ls WHERE ls.lease_id = l.id) as nb_signataires,
    (SELECT COUNT(*) FROM lease_signers ls WHERE ls.lease_id = l.id AND ls.signature_status = 'signed') as nb_signatures,
    (SELECT COUNT(*) FROM edl e WHERE e.lease_id = l.id AND e.type = 'entree') as nb_edl_entree
FROM leases l
WHERE l.id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97';

-- Afficher les signataires avec leurs emails pour régénérer les invitations
SELECT 
    id,
    role,
    invited_email,
    invited_name,
    signature_status
FROM lease_signers
WHERE lease_id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97'
ORDER BY role;

