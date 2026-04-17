-- =====================================================
-- MIGRATION: Gap P0 #1 — Liaison régul ↔ invoice
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- Ajoute la colonne regularization_invoice_id sur
-- lease_charge_regularizations pour lier la régul à
-- l'invoice générée au moment du settle (Sprint 2).
--
-- Idempotent : utilise ADD COLUMN IF NOT EXISTS.
-- =====================================================

ALTER TABLE lease_charge_regularizations
  ADD COLUMN IF NOT EXISTS regularization_invoice_id UUID
    REFERENCES invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lcr_regularization_invoice_id
  ON lease_charge_regularizations(regularization_invoice_id)
  WHERE regularization_invoice_id IS NOT NULL;

COMMENT ON COLUMN lease_charge_regularizations.regularization_invoice_id IS
  'FK vers invoices — renseignée au settle lorsque le mode de règlement génère une facture (Stripe, next_rent, installments_12).';
