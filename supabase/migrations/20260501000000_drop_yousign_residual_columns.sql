-- Bannissement complet de Yousign : suppression des colonnes résiduelles
-- Complément à la migration 20260224000001_remove_yousign_sendgrid_brevo.sql
-- Le code applicatif utilise désormais lib/signatures/ (SES interne avec OTP)

-- 1. Drop colonnes Yousign sur la table leases (si présentes)
ALTER TABLE leases DROP COLUMN IF EXISTS yousign_signature_request_id;
ALTER TABLE leases DROP COLUMN IF EXISTS yousign_document_id;

-- 2. Mettre à jour le commentaire de signatures.provider
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'signatures' AND column_name = 'provider'
  ) THEN
    EXECUTE $C$COMMENT ON COLUMN signatures.provider IS 'Provider de signature: internal (SES + OTP). Yousign supprimé en mai 2026.'$C$;
  END IF;
END $$;

-- 3. Optionnel : reclasser les enregistrements signature existants marqués 'yousign'
-- comme 'internal' pour éviter qu'ils soient orphelins (pas de re-signature possible)
UPDATE signatures
SET provider = 'internal'
WHERE provider = 'yousign';
