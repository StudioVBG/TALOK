-- =====================================================
-- Migration: Fix notify_tenant_invoice_created — populate user_id
-- Date: 2026-04-10
--
-- CONTEXT:
-- The previous version of this trigger (migration
-- 20260305100000_fix_invoice_draft_notification.sql) rewrote the
-- function with a direct INSERT into notifications BUT forgot the
-- `user_id` column, which is NOT NULL (see
-- 20240101000009_tenant_advanced.sql:445 and
-- 20240101000021_add_notifications_table.sql:5).
--
-- Impact:
-- Every attempt to create an invoice with statut='sent' rolled back
-- because the AFTER INSERT trigger failed with:
--   null value in column "user_id" of relation "notifications"
--   violates not-null constraint
-- This made it impossible for generate_monthly_invoices(),
-- ensureInitialInvoiceForLease() or any other caller to produce an
-- invoice in 'sent' state. In practice, invoice generation was
-- silently broken in production since 2026-03-05.
--
-- FIX:
-- Recreate notify_tenant_invoice_created() to resolve the auth.users
-- id via profiles.user_id and include it in the INSERT.
-- Also protect against tenants that no longer have a linked user
-- (pr.user_id IS NOT NULL).
--
-- STATUS IN PRODUCTION:
-- The fix was already applied directly via SQL Editor during the
-- 2026-04-10 invoice-generation audit session. This migration records
-- the change in version control so it is reapplied on any rebuild.
-- Safe to re-run (CREATE OR REPLACE).
-- =====================================================

CREATE OR REPLACE FUNCTION notify_tenant_invoice_created()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
BEGIN
  -- Only notify for sent invoices (avoid drafts and already-paid ones).
  IF NEW.statut != 'sent' THEN
    RETURN NEW;
  END IF;

  -- Resolve the property address via the lease.
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = NEW.lease_id;

  -- Notify every tenant signer of the lease, joining profiles so we can
  -- populate the notifications.user_id NOT NULL column.
  FOR v_tenant IN
    SELECT DISTINCT ls.profile_id, pr.user_id
    FROM lease_signers ls
    JOIN profiles pr ON pr.id = ls.profile_id
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire')
      AND ls.profile_id IS NOT NULL
      AND pr.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (
      user_id,
      profile_id,
      type,
      title,
      message,
      link,
      metadata
    ) VALUES (
      v_tenant.user_id,
      v_tenant.profile_id,
      'invoice',
      'Nouvelle quittance disponible',
      'Quittance pour ' || v_property_address || ' - ' ||
        COALESCE(NEW.montant_total::text, '0') || '€',
      '/tenant/payments?invoice=' || NEW.id,
      jsonb_build_object(
        'invoice_id', NEW.id,
        'lease_id', NEW.lease_id,
        'montant', NEW.montant_total,
        'periode', NEW.periode
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_tenant_invoice_created IS
  'Creates a notification for every tenant signer when an invoice transitions '
  'to statut=sent. Resolves notifications.user_id via profiles.user_id to '
  'satisfy the NOT NULL constraint.';

-- The trigger itself was already created by 20260108200000 and is not
-- dropped/recreated here (CREATE OR REPLACE FUNCTION is enough to hot-swap
-- the implementation).
