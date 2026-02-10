-- ============================================================
-- Migration SSOT 2026 : Consolidation bail → EDL → activation
-- Date : 2026-02-10
--
-- Corrections :
--   1. Répare check_edl_finalization() — retire le statut 'sent' (n'existe plus)
--      et ajoute une garde idempotente pour éviter les doubles activations
--   2. Répare sync_signature_session_to_entity() — ajoute activated_at + outbox event
--      et garde idempotente cohérente avec check_edl_finalization()
--   3. Ajoute outbox.aggregate_id — utilisé par initiate-signature
--   4. Ajoute index composite sur invoices(lease_id, metadata) pour facture initiale
--   5. Ajoute index composite edl(lease_id, type, status) pour fetchLeaseDetails
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Corriger check_edl_finalization()
--    - Retire 'sent' de la liste des statuts éligibles à l'activation
--    - Limite aux statuts réellement valides dans la CHECK DB
--    - Ajoute garde idempotente (skip si déjà 'active')
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_edl_finalization()
RETURNS TRIGGER AS $$
DECLARE
    v_has_owner BOOLEAN;
    v_has_tenant BOOLEAN;
    v_edl_type TEXT;
    v_lease_id UUID;
    v_edl_id UUID;
    v_current_lease_status TEXT;
BEGIN
    v_edl_id := NEW.edl_id;

    -- 1. Vérifier les signatures pour cet EDL
    SELECT
        EXISTS (
            SELECT 1 FROM edl_signatures
            WHERE edl_id = v_edl_id
            AND signer_role IN ('owner', 'proprietaire', 'bailleur')
            AND signature_image_path IS NOT NULL
        ),
        EXISTS (
            SELECT 1 FROM edl_signatures
            WHERE edl_id = v_edl_id
            AND signer_role IN ('tenant', 'locataire', 'locataire_principal')
            AND signature_image_path IS NOT NULL
        )
    INTO v_has_owner, v_has_tenant;

    -- 2. Si les deux ont signé
    IF v_has_owner AND v_has_tenant THEN
        -- Récupérer les infos de l'EDL
        SELECT type, lease_id INTO v_edl_type, v_lease_id FROM edl WHERE id = v_edl_id;

        -- Mettre l'EDL en statut 'signed' (idempotent)
        UPDATE edl SET
            status = 'signed',
            completed_date = NOW(),
            updated_at = NOW()
        WHERE id = v_edl_id
        AND status != 'signed';

        -- 3. Si c'est un EDL d'entrée, on active le bail
        IF v_edl_type = 'entree' THEN
            -- Vérifier le statut actuel du bail
            SELECT statut INTO v_current_lease_status FROM leases WHERE id = v_lease_id;

            -- Garde idempotente : ne pas re-activer un bail déjà actif/terminé/archivé
            IF v_current_lease_status IN ('fully_signed', 'pending_signature', 'partially_signed') THEN
                UPDATE leases SET
                    statut = 'active',
                    activated_at = NOW(),
                    updated_at = NOW()
                WHERE id = v_lease_id;

                -- Événement outbox pour la facture initiale
                INSERT INTO outbox (event_type, aggregate_id, payload)
                VALUES ('Lease.Activated', v_lease_id::text, jsonb_build_object(
                    'lease_id', v_lease_id,
                    'edl_id', v_edl_id,
                    'action', 'generate_initial_invoice',
                    'source', 'check_edl_finalization'
                ));
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Réattacher le trigger (idempotent)
DROP TRIGGER IF EXISTS trg_check_edl_finalization ON edl_signatures;
CREATE TRIGGER trg_check_edl_finalization
    AFTER INSERT OR UPDATE OF signature_image_path ON edl_signatures
    FOR EACH ROW
    EXECUTE FUNCTION check_edl_finalization();

RAISE NOTICE '✅ 1/5 check_edl_finalization() corrigé';

-- ============================================================
-- 2. Corriger sync_signature_session_to_entity()
--    - Ajoute activated_at lors de l'activation du bail
--    - Ajoute événement outbox pour la facture initiale
--    - Garde idempotente (ne pas re-activer un bail déjà actif)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_signature_session_to_entity()
RETURNS TRIGGER AS $$
DECLARE
    v_current_lease_status TEXT;
    v_lease_id UUID;
BEGIN
    -- Quand une session est complète (done)
    IF NEW.status = 'done' AND OLD.status != 'done' THEN

        -- Synchroniser avec bail
        IF NEW.entity_type = 'lease' THEN
            -- Vérifier le statut actuel du bail
            SELECT statut INTO v_current_lease_status FROM leases WHERE id = NEW.entity_id;

            -- Garde : ne pas écraser un bail déjà actif/terminé/archivé
            IF v_current_lease_status NOT IN ('active', 'terminated', 'archived', 'cancelled') THEN
                UPDATE leases
                SET
                    statut = CASE
                        WHEN NEW.document_type = 'bail' THEN 'fully_signed'
                        ELSE statut
                    END,
                    signature_completed_at = NOW(),
                    updated_at = NOW()
                WHERE id = NEW.entity_id;
            END IF;

        -- Synchroniser avec EDL
        ELSIF NEW.entity_type = 'edl' THEN
            UPDATE edl
            SET
                status = 'signed',
                completed_date = NOW(),
                updated_at = NOW()
            WHERE id = NEW.entity_id
            AND status != 'signed';

            -- Si EDL d'entrée signé, activer le bail (avec garde idempotente)
            SELECT l.id, l.statut INTO v_lease_id, v_current_lease_status
            FROM leases l
            JOIN edl e ON e.lease_id = l.id
            WHERE e.id = NEW.entity_id
            AND e.type = 'entree';

            IF v_lease_id IS NOT NULL AND v_current_lease_status = 'fully_signed' THEN
                UPDATE leases
                SET statut = 'active',
                    activated_at = NOW(),
                    updated_at = NOW()
                WHERE id = v_lease_id;

                -- Événement outbox pour la facture initiale
                INSERT INTO outbox (event_type, aggregate_id, payload)
                VALUES ('Lease.Activated', v_lease_id::text, jsonb_build_object(
                    'lease_id', v_lease_id,
                    'edl_id', NEW.entity_id,
                    'action', 'generate_initial_invoice',
                    'source', 'sync_signature_session_to_entity'
                ));
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Réattacher le trigger (idempotent)
DROP TRIGGER IF EXISTS tr_sync_signature_to_entity ON signature_sessions;
CREATE TRIGGER tr_sync_signature_to_entity
    AFTER UPDATE OF status ON signature_sessions
    FOR EACH ROW
    EXECUTE FUNCTION sync_signature_session_to_entity();

RAISE NOTICE '✅ 2/5 sync_signature_session_to_entity() corrigé';

-- ============================================================
-- 3. Ajouter aggregate_id à la table outbox
--    Utilisé par initiate-signature pour tracer l'entité source
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'outbox' AND column_name = 'aggregate_id'
    ) THEN
        ALTER TABLE outbox ADD COLUMN aggregate_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_outbox_aggregate_id ON outbox(aggregate_id) WHERE aggregate_id IS NOT NULL;
        RAISE NOTICE '✅ 3/5 outbox.aggregate_id ajouté';
    ELSE
        RAISE NOTICE '⏭️ 3/5 outbox.aggregate_id existe déjà';
    END IF;
END $$;

-- ============================================================
-- 4. Index composite pour la requête facture initiale
--    fetchLeaseDetails: .eq("metadata->>type", "initial_invoice")
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_invoices_lease_metadata_type
    ON invoices(lease_id, ((metadata->>'type')))
    WHERE metadata IS NOT NULL;

RAISE NOTICE '✅ 4/5 Index invoices(lease_id, metadata->>type) créé';

-- ============================================================
-- 5. Index composite pour fetchLeaseDetails EDL lookup
--    .eq("lease_id", leaseId).eq("type", "entree")
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_edl_lease_type_created
    ON edl(lease_id, type, created_at DESC);

RAISE NOTICE '✅ 5/5 Index edl(lease_id, type, created_at) créé';

COMMIT;
