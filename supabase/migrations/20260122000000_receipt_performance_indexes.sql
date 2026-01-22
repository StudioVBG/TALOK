-- ============================================
-- MIGRATION: Performance Indexes for Receipts & Invoices
-- SOTA 2026 - Optimisation des requêtes quittances
-- ============================================

-- Index composite pour les recherches de factures par bail et période
-- Utilisé par: InvoicesService.getInvoicesByLease(), filtres période
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_lease_periode
  ON invoices(lease_id, periode DESC);

-- Index composite pour les recherches par propriétaire
-- Utilisé par: InvoicesService.getInvoicesByOwner(), dashboard propriétaire
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_owner_periode
  ON invoices(owner_id, periode DESC);

-- Index composite pour les recherches par locataire
-- Utilisé par: InvoicesService.getInvoicesByTenant(), dashboard locataire
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_tenant_periode
  ON invoices(tenant_id, periode DESC);

-- Index pour les factures impayées (filtre très fréquent)
-- Utilisé par: InvoicesService.getUnpaidInvoicesByLease(), relances
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_lease_unpaid
  ON invoices(lease_id, periode DESC)
  WHERE statut IN ('draft', 'sent', 'partial');

-- Index composite pour les paiements par facture et statut
-- Utilisé par: vérification des paiements réussis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_invoice_succeeded
  ON payments(invoice_id, statut)
  WHERE statut = 'succeeded';

-- Index composite pour les reçus espèces par propriétaire
-- Utilisé par: GET /api/payments/cash-receipt (liste propriétaire)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_receipts_owner_created
  ON cash_receipts(owner_id, created_at DESC);

-- Index composite pour les reçus espèces par locataire
-- Utilisé par: GET /api/payments/cash-receipt (liste locataire)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_receipts_tenant_created
  ON cash_receipts(tenant_id, created_at DESC);

-- Index pour les reçus par période (reporting mensuel)
-- Utilisé par: rapports et statistiques
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_receipts_periode
  ON cash_receipts(periode DESC, created_at DESC);

-- Index pour la recherche de numéro de reçu (unicité + recherche rapide)
-- Utilisé par: recherche par numéro de quittance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_receipts_receipt_number
  ON cash_receipts(receipt_number)
  WHERE receipt_number IS NOT NULL;

-- ============================================
-- COMMENTAIRES SUR LES INDEX
-- ============================================
COMMENT ON INDEX idx_invoices_lease_periode IS
  'SOTA 2026: Optimise getInvoicesByLease() - O(log n) vs O(n) scan';

COMMENT ON INDEX idx_invoices_owner_periode IS
  'SOTA 2026: Optimise dashboard propriétaire - filtres période';

COMMENT ON INDEX idx_invoices_tenant_periode IS
  'SOTA 2026: Optimise dashboard locataire - filtres période';

COMMENT ON INDEX idx_invoices_lease_unpaid IS
  'SOTA 2026: Partial index pour factures impayées - relances automatiques';

COMMENT ON INDEX idx_payments_invoice_succeeded IS
  'SOTA 2026: Partial index pour paiements réussis - calcul totaux';

COMMENT ON INDEX idx_cash_receipts_owner_created IS
  'SOTA 2026: Optimise liste reçus propriétaire - pagination';

COMMENT ON INDEX idx_cash_receipts_tenant_created IS
  'SOTA 2026: Optimise liste reçus locataire - pagination';
