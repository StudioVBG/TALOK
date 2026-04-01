-- Add receipt_generated flag to invoices table
-- Tracks whether a quittance PDF has been generated for a paid invoice

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_generated'
  ) THEN
    ALTER TABLE invoices ADD COLUMN receipt_generated BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN invoices.receipt_generated IS 'TRUE when a quittance PDF has been generated and stored for this invoice';
  END IF;
END $$;

-- Backfill: mark invoices that already have a quittance document
UPDATE invoices
SET receipt_generated = TRUE
WHERE id IN (
  SELECT DISTINCT (metadata->>'invoice_id')::uuid
  FROM documents
  WHERE type = 'quittance'
    AND metadata->>'invoice_id' IS NOT NULL
)
AND receipt_generated IS NOT TRUE;
