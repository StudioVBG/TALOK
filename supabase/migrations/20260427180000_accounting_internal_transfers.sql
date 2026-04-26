-- =====================================================
-- ACCOUNTING — Virements internes (table métier)
-- =====================================================
-- Source de vérité pour les virements internes entre comptes bancaires
-- d'une même entité (ex. compte courant SCI → compte fonds travaux).
--
-- Sert de référence au bridge `ensureInternalTransferEntry` qui pose les
-- 2 écritures double-entrée associées (départ + arrivée via le compte
-- transfert 581000). Idempotency : `reference = transfers.id` côté
-- accounting_entries.
-- =====================================================

CREATE TABLE IF NOT EXISTS accounting_internal_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,

  from_account_number TEXT NOT NULL,
  to_account_number   TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),

  transfer_date DATE NOT NULL,
  label TEXT,

  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_different_accounts
    CHECK (from_account_number <> to_account_number),
  CONSTRAINT chk_account_format
    CHECK (length(from_account_number) >= 3 AND length(to_account_number) >= 3)
);

CREATE INDEX IF NOT EXISTS idx_internal_transfers_entity_date
  ON accounting_internal_transfers (entity_id, transfer_date DESC);

CREATE INDEX IF NOT EXISTS idx_internal_transfers_created_by
  ON accounting_internal_transfers (created_by);

COMMENT ON TABLE accounting_internal_transfers IS
  'Virements internes entre comptes bancaires d''une même entité. '
  'Lié 1↔1 à 2 écritures comptables (auto:internal_transfer) via reference.';

-- =====================================================
-- RLS
-- =====================================================

ALTER TABLE accounting_internal_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_own_transfers"
  ON accounting_internal_transfers;
CREATE POLICY "owner_select_own_transfers"
  ON accounting_internal_transfers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM legal_entities le
       JOIN profiles p ON p.id = le.owner_profile_id
      WHERE le.id = accounting_internal_transfers.entity_id
        AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "owner_insert_own_transfers"
  ON accounting_internal_transfers;
CREATE POLICY "owner_insert_own_transfers"
  ON accounting_internal_transfers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM legal_entities le
       JOIN profiles p ON p.id = le.owner_profile_id
      WHERE le.id = accounting_internal_transfers.entity_id
        AND p.user_id = auth.uid()
    )
  );
