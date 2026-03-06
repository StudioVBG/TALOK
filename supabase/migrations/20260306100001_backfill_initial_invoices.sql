-- ============================================
-- Migration : Backfill des factures initiales pour les baux existants
-- Date : 2026-03-06
-- Description :
--   1. Génère les factures initiales manquantes pour les baux fully_signed
--      qui n'ont pas de facture initial_invoice.
--   2. Corrige date_echeance NULL sur les factures initiales existantes.
-- ============================================

-- =====================
-- 1. Backfill : générer les factures initiales manquantes
-- =====================

DO $$
DECLARE
  v_lease RECORD;
  v_tenant_id UUID;
  v_owner_id UUID;
BEGIN
  FOR v_lease IN
    SELECT l.id, l.property_id
    FROM leases l
    WHERE l.statut IN ('fully_signed', 'active')
    AND NOT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.lease_id = l.id
      AND i.metadata->>'type' = 'initial_invoice'
    )
  LOOP
    -- Trouver le locataire
    SELECT ls.profile_id INTO v_tenant_id
    FROM lease_signers ls
    WHERE ls.lease_id = v_lease.id
    AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
    LIMIT 1;

    -- Trouver le propriétaire
    SELECT p.owner_id INTO v_owner_id
    FROM properties p WHERE p.id = v_lease.property_id;

    IF v_tenant_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      PERFORM generate_initial_signing_invoice(v_lease.id, v_tenant_id, v_owner_id);
    END IF;
  END LOOP;
END $$;

-- =====================
-- 2. Fix : corriger date_echeance NULL sur les factures initiales existantes
-- =====================

UPDATE invoices
SET date_echeance = COALESCE(
  (SELECT l.date_debut FROM leases l WHERE l.id = invoices.lease_id),
  created_at::date
)
WHERE metadata->>'type' = 'initial_invoice'
AND date_echeance IS NULL;

-- =====================
-- 3. Fix : corriger date_echeance NULL sur toute facture avec statut 'sent' ou 'late'
-- =====================

UPDATE invoices
SET date_echeance = COALESCE(
  due_date,
  (SELECT l.date_debut FROM leases l WHERE l.id = invoices.lease_id),
  created_at::date
)
WHERE date_echeance IS NULL
AND statut IN ('sent', 'late', 'overdue', 'unpaid');
