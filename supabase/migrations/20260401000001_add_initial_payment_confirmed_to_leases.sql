-- Migration: Ajouter initial_payment_confirmed sur leases
-- Permet au webhook Stripe de marquer le paiement initial comme confirmé
-- et d'éviter la désynchronisation entre l'UI et l'API key-handover.

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS initial_payment_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_payment_date timestamptz,
  ADD COLUMN IF NOT EXISTS initial_payment_stripe_pi text;

-- Rétro-remplissage : marquer comme confirmé les baux dont la facture initiale est soldée
UPDATE leases l
SET initial_payment_confirmed = true,
    initial_payment_date = i.date_paiement
FROM invoices i
WHERE i.lease_id = l.id
  AND i.statut = 'paid'
  AND (
    i.metadata->>'type' = 'initial_invoice'
    OR i.type = 'initial_invoice'
  )
  AND l.initial_payment_confirmed = false;

-- Index partiel pour les requêtes fréquentes sur les baux non confirmés
CREATE INDEX IF NOT EXISTS idx_leases_initial_payment_pending
  ON leases (id)
  WHERE initial_payment_confirmed = false;
