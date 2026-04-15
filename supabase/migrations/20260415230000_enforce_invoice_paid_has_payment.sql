-- =============================================================================
-- Migration : garde-fou "une invoice paid a toujours un payment associé"
-- Date      : 2026-04-15
-- Context   :
--   L'audit du 2026-04-15 a identifie 2 invoices en statut 'paid' sans
--   aucune row payments.succeeded associee (lease da2eb9da..., periodes
--   2026-01 et 2026-04). Cause racine : la Server Action
--   `app/owner/money/actions.ts::markInvoiceAsPaid()` faisait un UPDATE
--   direct `statut='paid'` sans creer de payment. `ensureReceiptDocument`
--   prenant un payment_id en entree, ces invoices devenaient impossibles
--   a rattraper proprement : pas de quittance pour le locataire, pas
--   d'ecriture comptable `rent_received`.
--
--   Fix applicatif : la Server Action a ete refactoree pour creer un
--   payment puis appeler ensureReceiptDocument (commit associe).
--
--   Cette migration ajoute un garde-fou DB pour bloquer *tout* autre
--   chemin (SQL direct, nouvelle route future, migration bogguee...)
--   qui tenterait de poser statut='paid' sans payment succeeded.
--
-- Exceptions legitimes :
--   - Avoirs (montant_total <= 0) issus de la regularisation annuelle
--     de charges : `metadata->>'type' = 'avoir_regularisation'` — ces
--     "factures" sont des credits poses a `paid` d'emblee car il n'y a
--     pas de flux d'argent entrant (c'est un trop-percu rembourse/deduit).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Trigger function : check et auto-populate paid_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enforce_invoice_paid_has_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_count INTEGER;
  v_latest_payment_date DATE;
  v_is_credit_note BOOLEAN;
BEGIN
  -- Ne declenche que sur les transitions vers 'paid' (INSERT ou UPDATE).
  -- Les updates qui conservent statut='paid' (ex: changement de metadata)
  -- passent sans verification.
  IF TG_OP = 'INSERT' THEN
    IF NEW.statut IS DISTINCT FROM 'paid' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.statut IS DISTINCT FROM 'paid' OR OLD.statut = 'paid' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Exception legitime : avoirs de regularisation de charges
  v_is_credit_note := COALESCE(NEW.metadata->>'type', '') IN (
    'avoir_regularisation',
    'credit_note'
  ) OR COALESCE(NEW.montant_total, 0) <= 0;

  IF v_is_credit_note THEN
    RETURN NEW;
  END IF;

  -- Verifier qu'au moins un payment succeeded existe pour cette invoice
  SELECT COUNT(*), MAX(p.date_paiement)
    INTO v_payment_count, v_latest_payment_date
  FROM public.payments p
  WHERE p.invoice_id = NEW.id
    AND p.statut = 'succeeded';

  IF v_payment_count = 0 THEN
    RAISE EXCEPTION
      'Invoice % cannot be marked as paid without a succeeded payment. '
      'Create a row in public.payments (statut=succeeded) first, or use '
      '/api/invoices/[id]/mark-paid / markInvoiceAsPaid() which handle it '
      'atomically. For legitimate credit notes, set metadata->>''type'' '
      'to ''avoir_regularisation''.',
      NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Auto-populate paid_at si NULL (commodite — la majorite des chemins
  -- applicatifs le remplissent deja, mais certains flux historiques
  -- l'oublient. Sans paid_at, l'UI /tenant/payments affiche "Date inconnue").
  IF NEW.paid_at IS NULL THEN
    NEW.paid_at := COALESCE(
      v_latest_payment_date::timestamptz,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_invoice_paid_has_payment IS
  'Bloque les transitions invoices.statut -> ''paid'' sans row payments '
  '(statut=succeeded) associee. Exception pour les avoirs de regularisation '
  '(metadata.type = avoir_regularisation ou montant_total <= 0). '
  'Auto-populate paid_at si NULL. Voir migration 20260415230000.';


-- =============================================================================
-- 2. Attacher le trigger (BEFORE pour pouvoir modifier NEW.paid_at)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_enforce_invoice_paid_has_payment ON public.invoices;

CREATE TRIGGER trg_enforce_invoice_paid_has_payment
  BEFORE INSERT OR UPDATE OF statut ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_paid_has_payment();


-- =============================================================================
-- 3. Backfill paid_at pour les invoices actuellement paid avec paid_at NULL
--    mais un payment succeeded existant.
--    (ne touche PAS les invoices orphelines sans payment — elles restent
--     visibles au monitoring via la requete 1g de scripts/diagnose-receipts.sql)
-- =============================================================================
UPDATE public.invoices i
SET paid_at = sub.latest_payment_date
FROM (
  SELECT p.invoice_id, MAX(p.date_paiement)::timestamptz AS latest_payment_date
  FROM public.payments p
  WHERE p.statut = 'succeeded'
  GROUP BY p.invoice_id
) sub
WHERE i.id = sub.invoice_id
  AND i.statut = 'paid'
  AND i.paid_at IS NULL;


-- =============================================================================
-- 4. Vue de monitoring : invoices paid sans payment (incident detection)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_invoices_paid_without_payment AS
SELECT
  i.id AS invoice_id,
  i.lease_id,
  i.tenant_id,
  i.owner_id,
  i.periode,
  i.montant_total,
  i.statut,
  i.paid_at,
  i.receipt_generated,
  i.created_at,
  COALESCE(i.metadata->>'type', '') AS invoice_type,
  (i.metadata->>'type' = 'avoir_regularisation' OR i.montant_total <= 0) AS is_credit_note_legitimate
FROM public.invoices i
WHERE i.statut = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.invoice_id = i.id AND p.statut = 'succeeded'
  );

COMMENT ON VIEW public.v_invoices_paid_without_payment IS
  'Invoices en statut paid sans payment succeeded associe. Doit etre vide '
  'apres le deploiement du trigger enforce_invoice_paid_has_payment. Utile '
  'pour le monitoring : exposer dans un health-check / alerting. Les credits '
  'legitimes (avoirs de regularisation) ont is_credit_note_legitimate = true.';

GRANT SELECT ON public.v_invoices_paid_without_payment TO authenticated;


COMMIT;

-- =============================================================================
-- Rollback :
--   BEGIN;
--     DROP VIEW IF EXISTS public.v_invoices_paid_without_payment;
--     DROP TRIGGER IF EXISTS trg_enforce_invoice_paid_has_payment ON public.invoices;
--     DROP FUNCTION IF EXISTS public.enforce_invoice_paid_has_payment();
--   COMMIT;
-- =============================================================================
