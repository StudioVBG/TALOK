-- ============================================
-- Migration : Anti-doublon paiements
-- Date : 2026-03-24
-- Description :
--   1. Contrainte UNIQUE partielle sur payments : un seul paiement pending par facture
--   2. Empêche la race condition qui a causé le double paiement sur bail da2eb9da
-- ============================================

-- Un seul paiement 'pending' par facture à la fois
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_pending_per_invoice
  ON payments (invoice_id)
  WHERE statut = 'pending';

COMMENT ON INDEX idx_payments_one_pending_per_invoice
  IS 'Empêche plusieurs paiements pending simultanés sur la même facture (anti-doublon)';
