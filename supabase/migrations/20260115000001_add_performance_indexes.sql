-- Migration: Add performance indexes for frequent queries
-- Date: 2026-01-15
-- Purpose: Improve query performance on commonly accessed columns

-- ============================================
-- 1. Index on leases.tenant_id
-- Purpose: Optimize frequent tenant lookup queries
-- Used for: Dashboard views, tenant-specific lease retrieval
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id_perf
ON leases(tenant_id);

COMMENT ON INDEX idx_leases_tenant_id_perf IS
'Performance index for frequent tenant lookup queries on leases';

-- ============================================
-- 2. Index on documents.verified_by
-- Purpose: Speed up document verification queries
-- Used for: Admin verification workflows, audit trails
-- ============================================
CREATE INDEX IF NOT EXISTS idx_documents_verified_by
ON documents(verified_by);

COMMENT ON INDEX idx_documents_verified_by IS
'Performance index for document verification lookups and audit queries';

-- ============================================
-- 3. Composite index on payments(invoice_id, statut)
-- Purpose: Optimize payment tracking and status queries
-- Used for: Payment status reports, invoice reconciliation
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payments_invoice_statut
ON payments(invoice_id, statut);

COMMENT ON INDEX idx_payments_invoice_statut IS
'Composite index for efficient payment tracking by invoice and status';

-- ============================================
-- 4. Composite index on invoices(owner_id, periode)
-- Purpose: Speed up financial summary queries per owner
-- Used for: Owner dashboards, monthly/yearly financial reports
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invoices_owner_periode
ON invoices(owner_id, periode);

COMMENT ON INDEX idx_invoices_owner_periode IS
'Composite index for owner financial summaries grouped by period';

-- ============================================
-- 5. Composite index on payment_adjustments(month, roommate_id)
-- Purpose: Optimize tenant payment adjustment reports
-- Used for: Colocation billing, roommate payment history
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payment_adjustments_month_roommate
ON payment_adjustments(month, roommate_id);

COMMENT ON INDEX idx_payment_adjustments_month_roommate IS
'Composite index for tenant payment adjustment reports by month and roommate';
