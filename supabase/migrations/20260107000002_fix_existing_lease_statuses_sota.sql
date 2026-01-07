-- =====================================================
-- MIGRATION: SOTA 2026 - Correction des statuts de baux existants
-- Date: 2026-01-07
-- Description: Corrige les baux mal catégorisés après le fix de determineLeaseStatus
-- =====================================================

-- 1. CORRECTION : Baux marqués "active" mais sans EDL d'entrée signé
-- Ces baux auraient dû être "fully_signed" et attendre l'EDL
UPDATE leases SET 
  statut = 'fully_signed',
  updated_at = NOW()
WHERE statut = 'active'
  AND id NOT IN (
    -- Exclure les baux qui ont un EDL d'entrée signé
    SELECT DISTINCT lease_id FROM edl 
    WHERE type = 'entree' AND status = 'signed'
  )
  AND id IN (
    -- Seulement les baux où tous les signataires ont signé
    SELECT ls.lease_id
    FROM lease_signers ls
    GROUP BY ls.lease_id
    HAVING COUNT(*) > 1 
       AND COUNT(*) = COUNT(CASE WHEN ls.signature_status = 'signed' THEN 1 END)
  );

-- Log du nombre de corrections
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE '[SOTA 2026] % bail(s) corrigé(s) de "active" vers "fully_signed"', v_count;
  ELSE
    RAISE NOTICE '[SOTA 2026] Aucun bail à corriger';
  END IF;
END $$;

-- 2. CORRECTION : Baux en "pending_signature" alors que tous ont signé
UPDATE leases SET 
  statut = 'fully_signed',
  updated_at = NOW()
WHERE statut IN ('pending_signature', 'partially_signed')
  AND id IN (
    -- Baux où tous les signataires ont signé
    SELECT ls.lease_id
    FROM lease_signers ls
    GROUP BY ls.lease_id
    HAVING COUNT(*) >= 2 -- Au moins propriétaire + locataire
       AND COUNT(*) = COUNT(CASE WHEN ls.signature_status = 'signed' THEN 1 END)
  );

-- 3. CORRECTION : Baux en "pending_signature" où locataire signé mais pas proprio
UPDATE leases SET 
  statut = 'pending_owner_signature',
  updated_at = NOW()
WHERE statut = 'pending_signature'
  AND id IN (
    SELECT ls.lease_id
    FROM lease_signers ls
    WHERE ls.role IN ('locataire_principal', 'locataire', 'tenant', 'colocataire')
      AND ls.signature_status = 'signed'
    GROUP BY ls.lease_id
  )
  AND id NOT IN (
    SELECT ls.lease_id
    FROM lease_signers ls
    WHERE ls.role IN ('proprietaire', 'owner')
      AND ls.signature_status = 'signed'
    GROUP BY ls.lease_id
  );

-- 4. Rapport final
DO $$
DECLARE
  v_draft INTEGER;
  v_pending INTEGER;
  v_fully_signed INTEGER;
  v_active INTEGER;
  v_terminated INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE statut = 'draft'),
    COUNT(*) FILTER (WHERE statut IN ('pending_signature', 'partially_signed', 'pending_owner_signature', 'sent')),
    COUNT(*) FILTER (WHERE statut = 'fully_signed'),
    COUNT(*) FILTER (WHERE statut = 'active'),
    COUNT(*) FILTER (WHERE statut IN ('terminated', 'archived'))
  INTO v_draft, v_pending, v_fully_signed, v_active, v_terminated
  FROM leases;
  
  RAISE NOTICE '=== RAPPORT STATUTS BAUX SOTA 2026 ===';
  RAISE NOTICE 'Brouillons: %', v_draft;
  RAISE NOTICE 'En attente de signature: %', v_pending;
  RAISE NOTICE 'Entièrement signés (attente EDL): %', v_fully_signed;
  RAISE NOTICE 'Actifs: %', v_active;
  RAISE NOTICE 'Terminés/Archivés: %', v_terminated;
  RAISE NOTICE '======================================';
END $$;

