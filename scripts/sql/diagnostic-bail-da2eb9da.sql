-- ============================================
-- DIAGNOSTIC — Bail da2eb9da (lecture seule)
-- Exécuter dans le SQL Editor de Supabase
-- Date : 2026-03-24
-- ============================================

-- 1. Statut exact du bail
SELECT id, statut, date_debut, loyer, charges_forfaitaires, depot_de_garantie,
       invoice_engine_started, first_invoice_date, activated_at, property_id
FROM leases
WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7';

-- 2. EDL d'entrée : existe-t-il ? Quel statut ?
SELECT id, type, status, created_at, completed_date, lease_id
FROM edl
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
AND type = 'entree';

-- 3. Signataires EDL : tous ont-ils signé ?
SELECT es.id, es.signer_role, es.signed_at, es.signature_image_path IS NOT NULL AS has_signature
FROM edl_signatures es
JOIN edl e ON es.edl_id = e.id
WHERE e.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
AND e.type = 'entree';

-- 4. Facture initiale : existe-t-elle en base ?
SELECT id, type, statut, montant_loyer, montant_charges, montant_total,
       date_echeance, periode, metadata, notes, created_at
FROM invoices
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
AND (
  metadata->>'type' = 'initial_invoice'
  OR type = 'initial_invoice'
);

-- 5. Lease signers : tenant et owner résolus ?
SELECT ls.id, ls.role, ls.profile_id, ls.invited_email, ls.signed_at
FROM lease_signers ls
WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7';

-- 6. Owner du bien
SELECT p.id AS property_id, p.owner_id, pr.email AS owner_email
FROM properties p
LEFT JOIN profiles pr ON pr.id = p.owner_id
WHERE p.id = (
  SELECT property_id FROM leases WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
);

-- 7. Triggers actifs sur leases
SELECT tgname AS trigger_name, tgenabled AS enabled,
       pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'leases'::regclass
AND tgname LIKE '%invoice%' OR tgname LIKE '%activ%';

-- 8. Outbox events pour ce bail ou son EDL
SELECT id, event_type, status, payload, created_at, processed_at, last_error
FROM outbox
WHERE payload->>'lease_id' = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
   OR payload->>'edl_id' IN (
     SELECT id::text FROM edl
     WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
   )
ORDER BY created_at DESC;
