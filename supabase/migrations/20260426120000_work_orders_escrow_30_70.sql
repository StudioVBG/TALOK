-- =====================================================
-- Migration : Switch work_orders payments to ESCROW mode (30/70 split)
-- Date : 2026-04-26
--
-- Contexte :
--   La spec Talok (PR Stripe Connect WO) acte le passage en escrow via
--   "Separate charges and transfers" Stripe Connect, avec un acompte 30%
--   au lieu de 66.67% (modèle plus adapté aux interventions domestiques :
--   moins de risque pour le proprio, plus pratique pour les petites
--   interventions).
--
-- Changements :
--   1. payment_fee_config.deposit_percent : 66.67 → 30.00 (default + ligne 'default')
--   2. work_order_payments.percentage_of_total : commentaire mis à jour
--      (pas de contrainte CHECK sur cette colonne, juste sémantique)
--
-- Backward compatibility :
--   Aucun WO en cours n'utilisait le flux Stripe (PR Sprint A change le
--   calcul côté code). Les WO historiques avec percentage_of_total=66.67
--   restent inchangés (data préservée).
-- =====================================================

BEGIN;

-- 1. Mettre à jour la valeur par défaut de deposit_percent
ALTER TABLE public.payment_fee_config
  ALTER COLUMN deposit_percent SET DEFAULT 30.00;

-- 2. Mettre à jour la ligne 'default' existante pour appliquer le nouveau %
--    aux nouveaux paiements créés après cette migration.
UPDATE public.payment_fee_config
   SET deposit_percent = 30.00,
       updated_at = NOW()
 WHERE config_key = 'default'
   AND deposit_percent = 66.67;

-- 3. Mettre à jour le commentaire sur percentage_of_total pour refléter
--    le nouveau split.
COMMENT ON COLUMN public.work_order_payments.percentage_of_total IS
  'Pourcentage du total que représente ce paiement (30 pour acompte, 70 pour solde, 100 pour full).';

COMMIT;
