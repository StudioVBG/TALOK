-- ============================================================================
-- QR sessions module + user_2fa realtime
-- ============================================================================
-- Pattern desktop ↔ mobile : un desktop affiche un QR code, le mobile scan une
-- URL Talok signée, confirme l'opération, et le desktop reçoit l'événement
-- realtime puis redirige automatiquement.
--
-- user_2fa est ajouté à la publication realtime pour permettre la redirection
-- automatique de la page /admin/security?force_2fa=1 dès activation 2FA.
--
-- NOTE : la table qr_sessions, ses enums et le job cron 284 ont été créés
-- précédemment via apply_migration. Ce fichier est idempotent : il ne fait
-- qu'enregistrer les commandes pour rejouabilité locale via supabase CLI.
-- ============================================================================

-- 1. Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qr_session_status') THEN
    CREATE TYPE qr_session_status AS ENUM ('pending', 'scanned', 'confirmed', 'expired', 'consumed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qr_session_kind') THEN
    CREATE TYPE qr_session_kind AS ENUM (
      'mobile_signin',
      'key_handover',
      'document_signature',
      'lease_signature',
      'edl_signature',
      '2fa_setup_companion'
    );
  END IF;
END$$;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.qr_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  kind qr_session_kind NOT NULL,
  status qr_session_status NOT NULL DEFAULT 'pending',
  initiator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  redirect_url TEXT,
  scanner_metadata JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  scanned_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qr_sessions_token_active_idx
  ON public.qr_sessions(token)
  WHERE status IN ('pending', 'scanned');

CREATE INDEX IF NOT EXISTS qr_sessions_initiator_status_idx
  ON public.qr_sessions(initiator_user_id, status);

-- 3. RLS
ALTER TABLE public.qr_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qr_sessions_initiator_read ON public.qr_sessions;
CREATE POLICY qr_sessions_initiator_read ON public.qr_sessions
  FOR SELECT USING (initiator_user_id = auth.uid());

-- 4. Realtime publications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'qr_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_2fa'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_2fa;
  END IF;
END$$;

-- 5. Cleanup périodique (pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_qr_sessions()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.qr_sessions
     SET status = 'expired'
   WHERE status IN ('pending', 'scanned')
     AND expires_at < now();
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-qr-sessions'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-qr-sessions',
      '*/5 * * * *',
      'SELECT public.cleanup_expired_qr_sessions()'
    );
  END IF;
END$$;
