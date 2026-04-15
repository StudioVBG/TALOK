-- =============================================================================
-- Diagnostic receipts : pourquoi le locataire voit "Aucune quittance"
--
-- Usage : ouvrir Supabase SQL Editor, remplacer :LEASE_ID par l'UUID cible
--         puis executer bloc par bloc.
--
-- Bail cible historique : da2eb9da-1ff1-4020-8682-5f993aa6fde7
-- =============================================================================

-- 1a. Documents type quittance pour le bail cible
SELECT
  id, type, title, lease_id, tenant_id, property_id, owner_id,
  is_generated, visible_tenant, ged_status, created_at, storage_path,
  metadata->>'payment_id' AS payment_id_meta,
  metadata->>'invoice_id' AS invoice_id_meta
FROM documents
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
  AND type IN ('quittance', 'quittance_loyer', 'receipt')
ORDER BY created_at DESC;


-- 1b. Tous les documents pour ce bail (pour identifier les 3 fantomes sans titre)
SELECT
  id, type, title, original_filename, visible_tenant, ged_status,
  is_generated, created_at, mime_type, storage_path
FROM documents
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
ORDER BY created_at DESC;


-- 1c. Invoices du bail + statut quittance
SELECT
  id, periode, statut, montant_total, paid_at,
  receipt_generated, receipt_document_id, receipt_generated_at,
  stripe_payment_intent_id
FROM invoices
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
ORDER BY periode DESC;


-- 1d. Payments associes
SELECT
  p.id, p.invoice_id, p.montant, p.moyen, p.statut,
  p.date_paiement, p.provider_ref, p.created_at
FROM payments p
JOIN invoices i ON p.invoice_id = i.id
WHERE i.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
ORDER BY p.created_at DESC;


-- 1e. Audit trail table receipts
SELECT
  r.id, r.payment_id, r.invoice_id, r.lease_id, r.tenant_id,
  r.period, r.montant_total, r.pdf_storage_path,
  r.generated_at, r.sent_at
FROM receipts r
WHERE r.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
ORDER BY r.generated_at DESC;


-- 1f. Verifier ce que voit le locataire via la vue v_tenant_key_documents
-- NB : remplacer :PROFILE_ID par le profile_id du locataire
SELECT *
FROM v_tenant_key_documents
WHERE tenant_id IN (
  SELECT tenant_id
  FROM leases
  WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
);


-- 1g. Combien de factures payees sur toute la base n'ont pas de quittance ?
SELECT COUNT(*) AS invoices_paid_without_receipt
FROM invoices
WHERE statut = 'paid'
  AND (receipt_generated IS NULL OR receipt_generated = false);


-- =============================================================================
-- LECTURE DES RESULTATS
-- =============================================================================
-- 1a non vide + 1c receipt_generated = true : OK cote DB, probleme front
--     -> verifier visible_tenant / ged_status / tenant_id des documents quittance
--
-- 1a vide + 1c receipt_generated = true : incoherent
--     -> la row documents a ete supprimee, mais le flag n'est pas reset
--     -> relancer backfill (npx tsx scripts/backfill-receipts.ts --lease-id=...)
--
-- 1a vide + 1c receipt_generated = false/NULL : paiement antérieur au deploiement
--     -> CAS A, lancer le backfill
--
-- 1b contient des rows sans title et sans storage_path valide : fantomes
--     -> voir scripts/cleanup-phantom-documents.sql
-- =============================================================================
