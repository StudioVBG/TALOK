-- ============================================================================
-- Signature electronique AVANCEE des devis prestataire (eIDAS niveau 2)
-- ============================================================================
-- Au-dela d'un seuil (defaut 10 000 EUR TTC), l'acceptation requiert :
--   1. Un code OTP envoye par email au proprietaire (preuve de possession)
--   2. Un hash SHA-256 du contenu canonique du devis (integrite)
--   3. Une signature HMAC-SHA256 du hash (preuve d'origine serveur)
--
-- Ces 3 elements satisfont les 4 criteres eIDAS AES :
--   - Liee uniquement au signataire (auth + OTP email/profil)
--   - Permet d'identifier le signataire (profile_id + nom + IP + UA)
--   - Donnees sous controle exclusif (OTP a usage unique 10min)
--   - Toute modification ulterieure detectable (hash + HMAC)
--
-- NB : pour eIDAS QES (qualifiee), il faudrait une AC qualifiee + HSM,
--      ce qui sort du scope autonome.
-- ============================================================================


-- ============================================================================
-- BLOC 1 — Table OTP devis (separee de otp_codes legacy lease-based)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.quote_signature_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL
    REFERENCES public.provider_quotes(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  /** Hash PBKDF2(code, salt) — code en clair JAMAIS stocke */
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  /** Methode d'envoi : 'email' (MVP) | 'sms' (a venir) */
  delivery_method TEXT NOT NULL DEFAULT 'email'
    CHECK (delivery_method IN ('email', 'sms')),
  delivery_destination TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_otps_quote_profile_unused
  ON public.quote_signature_otps(quote_id, profile_id)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_quote_otps_expires
  ON public.quote_signature_otps(expires_at)
  WHERE used_at IS NULL;

COMMIT;


-- ============================================================================
-- BLOC 2 — Colonnes de signature avancee sur provider_quotes
-- ============================================================================

BEGIN;

ALTER TABLE public.provider_quotes
  ADD COLUMN IF NOT EXISTS signature_level TEXT
    CHECK (signature_level IN ('simple', 'advanced'));

ALTER TABLE public.provider_quotes
  ADD COLUMN IF NOT EXISTS signature_otp_method TEXT
    CHECK (signature_otp_method IN ('email', 'sms'));

ALTER TABLE public.provider_quotes
  ADD COLUMN IF NOT EXISTS signature_otp_verified_at TIMESTAMPTZ;

ALTER TABLE public.provider_quotes
  ADD COLUMN IF NOT EXISTS signature_document_hash TEXT;

ALTER TABLE public.provider_quotes
  ADD COLUMN IF NOT EXISTS signature_hmac TEXT;

COMMENT ON COLUMN public.provider_quotes.signature_level IS
  'simple = SES (nom + IP + UA + horodatage). advanced = AES (SES + OTP + hash + HMAC).';
COMMENT ON COLUMN public.provider_quotes.signature_document_hash IS
  'SHA-256 du contenu canonique JSON du devis (items + montants + dates) au moment de la signature. Permet de detecter toute modification ulterieure.';
COMMENT ON COLUMN public.provider_quotes.signature_hmac IS
  'HMAC-SHA256(document_hash || quote_id || signed_at, SIGNATURE_HMAC_KEY). Preuve d''origine serveur.';

COMMIT;


-- ============================================================================
-- BLOC 3 — RLS
-- ============================================================================

BEGIN;

ALTER TABLE public.quote_signature_otps ENABLE ROW LEVEL SECURITY;

-- Lecture : seul le destinataire de l'OTP (profile_id) peut voir ses propres
-- demandes. Pas de SELECT cross-profile, meme entre owner et provider du devis.
DROP POLICY IF EXISTS quote_otps_select_own
  ON public.quote_signature_otps;
CREATE POLICY quote_otps_select_own
  ON public.quote_signature_otps FOR SELECT
  USING (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

-- Insert / update / delete : reserve au service_role (cote API).
-- Pas de policy INSERT/UPDATE/DELETE pour authenticated → bloque par defaut.

COMMIT;


-- ============================================================================
-- BLOC 4 — Cleanup automatique des OTP expires (cron)
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_expired_quote_otps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.quote_signature_otps
  WHERE expires_at < NOW() - INTERVAL '24 hours'
     OR used_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Schedule pg_cron quotidien 3h (low traffic)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('cleanup-quote-signature-otps');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(
      'cleanup-quote-signature-otps',
      '0 3 * * *',
      $cron$ SELECT public.cleanup_expired_quote_otps() $cron$
    );
  END IF;
END$$;

COMMIT;


-- ============================================================================
-- FIN — Migration 20260425130400_provider_quote_advanced_signature
-- Table     : quote_signature_otps (RLS)
-- Colonnes  : provider_quotes.signature_level, signature_otp_method,
--             signature_otp_verified_at, signature_document_hash, signature_hmac
-- Function  : cleanup_expired_quote_otps()
-- Cron      : cleanup-quote-signature-otps (3h quotidien)
-- ============================================================================
