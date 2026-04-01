-- Script de fix one-shot pour le bail de test da2eb9da-1ff1-4020-8682-5f993aa6fde7
-- À exécuter dans le Supabase SQL Editor

-- 1. Marquer le paiement initial comme confirmé
UPDATE leases
SET initial_payment_confirmed = true,
    initial_payment_date = NOW()
WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
  AND initial_payment_confirmed = false;

-- 2. Vérification
SELECT id, initial_payment_confirmed, initial_payment_date, statut
FROM leases
WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7';
