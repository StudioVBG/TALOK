-- ============================================================================
-- Signature simple d'acceptation des devis prestataire
-- ============================================================================
-- Ajoute les colonnes pour tracer l'acceptation d'un devis avec valeur
-- probante (sans atteindre eIDAS) :
--   - acceptance_signed_name     : nom complet saisi par l'acceptant
--   - acceptance_signed_at       : timestamp serveur (NOT acceptance_at, qui
--                                   peut diverger en cas de re-signature)
--   - acceptance_signed_ip       : IP source (RGPD : a effacer apres 5 ans)
--   - acceptance_signed_user_agent : user-agent source (debug + audit)
--
-- Cohabite avec provider_quotes.accepted_at (deja existant) qui reste le
-- timestamp metier de l'acceptation. Les nouvelles colonnes sont des
-- preuves complementaires.
--
-- Pas de breaking change : toutes les colonnes sont nullable, les anciens
-- devis acceptes restent en place.
-- ============================================================================

BEGIN;

ALTER TABLE public.provider_quotes
  ADD COLUMN IF NOT EXISTS acceptance_signed_name TEXT;

ALTER TABLE public.provider_quotes
  ADD COLUMN IF NOT EXISTS acceptance_signed_at TIMESTAMPTZ;

ALTER TABLE public.provider_quotes
  ADD COLUMN IF NOT EXISTS acceptance_signed_ip TEXT;

ALTER TABLE public.provider_quotes
  ADD COLUMN IF NOT EXISTS acceptance_signed_user_agent TEXT;

COMMENT ON COLUMN public.provider_quotes.acceptance_signed_name IS
  'Nom complet saisi par le proprietaire (ou admin) lors de l''acceptation. Sert de preuve simple.';
COMMENT ON COLUMN public.provider_quotes.acceptance_signed_at IS
  'Horodatage serveur de la signature. Distinct de accepted_at (timestamp metier).';
COMMENT ON COLUMN public.provider_quotes.acceptance_signed_ip IS
  'IP de l''acceptant — preuve d''origine. RGPD : effacer apres 5 ans.';
COMMENT ON COLUMN public.provider_quotes.acceptance_signed_user_agent IS
  'User-Agent du navigateur lors de la signature.';

COMMIT;
