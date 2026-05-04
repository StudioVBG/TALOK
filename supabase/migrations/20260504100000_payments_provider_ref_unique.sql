-- ============================================
-- Race condition fix : UNIQUE constraint sur payments.provider_ref
-- ============================================
-- Bug audit (2026-05-03) : upsertPaymentAttempt() faisait SELECT puis
-- INSERT/UPDATE sans verrou ni ON CONFLICT. Deux webhooks Stripe
-- simultanés pour le même payment_intent pouvaient créer deux rows
-- payments → double-encaissement comptable.
--
-- Fix en deux temps :
--   1. Dédoublonner les rows existantes (garde la plus ancienne, supprime
--      les autres). Critère : même provider_ref non-NULL.
--   2. Ajouter UNIQUE (provider_ref) WHERE provider_ref IS NOT NULL.
--      Le code TS bascule en upsert(..., { onConflict: 'provider_ref' })
--      pour éliminer la fenêtre TOCTOU.
--
-- Idempotent : DROP IF EXISTS + CREATE OR REPLACE.
-- ============================================

BEGIN;

-- 1. Cleanup des doublons existants (best-effort, garde le plus ancien)
WITH ranked AS (
  SELECT
    id,
    provider_ref,
    ROW_NUMBER() OVER (
      PARTITION BY provider_ref
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.payments
  WHERE provider_ref IS NOT NULL
)
DELETE FROM public.payments
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. UNIQUE partial index — autorise plusieurs paiements sans provider_ref
--    (cash, virements manuels), interdit les doublons par provider_ref.
DROP INDEX IF EXISTS idx_payments_provider_ref_unique;
CREATE UNIQUE INDEX idx_payments_provider_ref_unique
  ON public.payments (provider_ref)
  WHERE provider_ref IS NOT NULL;

COMMENT ON INDEX public.idx_payments_provider_ref_unique IS
  'Anti race-condition sur les webhooks Stripe : un même payment_intent_id '
  '(ou setup_intent_id) ne peut produire qu''un seul enregistrement payments.';

COMMIT;
