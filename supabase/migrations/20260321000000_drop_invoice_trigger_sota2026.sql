-- SOTA 2026: Supprimer le trigger SQL redondant pour la facture initiale.
-- Le service TS ensureInitialInvoiceForLease() (appele par handleLeaseFullySigned)
-- est desormais le seul chemin de creation de la facture initiale.
-- Ce trigger creait un doublon et rendait le flux confus.

DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;

-- Supprimer egalement la fonction associee si elle existe
DROP FUNCTION IF EXISTS fn_generate_initial_invoice_on_fully_signed() CASCADE;
