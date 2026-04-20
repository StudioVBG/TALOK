-- ============================================================================
-- Platform Broadcasts — Annonces globales plateforme
-- ============================================================================
-- Permet aux admins d'afficher un bandeau global (maintenance, nouvelle feature,
-- alerte importante) ciblé par rôle ou globalement.
--
-- - target_role NULL => tous les utilisateurs connectés
-- - active = false => broadcast archivé (historique conservé)
-- - starts_at / ends_at => programmation dans le temps
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_broadcasts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  target_role TEXT NULL
              CHECK (target_role IS NULL OR target_role IN (
                'owner', 'tenant', 'provider', 'agency', 'guarantor', 'syndic'
              )),
  cta_label   TEXT NULL,
  cta_url     TEXT NULL,
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at     TIMESTAMPTZ NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  dismissible BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_broadcasts_active_window
  ON public.platform_broadcasts (active, starts_at, ends_at)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_platform_broadcasts_target_role
  ON public.platform_broadcasts (target_role)
  WHERE active = TRUE;

COMMENT ON TABLE public.platform_broadcasts IS
  'Annonces globales affichées en banner à tous les utilisateurs (ou un rôle cible). Créées par admin.broadcast.';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_platform_broadcasts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_broadcasts_updated_at ON public.platform_broadcasts;
CREATE TRIGGER trg_platform_broadcasts_updated_at
  BEFORE UPDATE ON public.platform_broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_platform_broadcasts_updated_at();

-- Dismissals : un user peut masquer un broadcast après l'avoir lu
CREATE TABLE IF NOT EXISTS public.platform_broadcast_dismissals (
  broadcast_id UUID NOT NULL REFERENCES public.platform_broadcasts(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (broadcast_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_dismissals_user
  ON public.platform_broadcast_dismissals (user_id);

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.platform_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_broadcast_dismissals ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié peut lire les broadcasts actifs
DROP POLICY IF EXISTS "read_active_broadcasts" ON public.platform_broadcasts;
CREATE POLICY "read_active_broadcasts" ON public.platform_broadcasts
  FOR SELECT
  TO authenticated
  USING (
    active = TRUE
    AND starts_at <= NOW()
    AND (ends_at IS NULL OR ends_at > NOW())
  );

-- Écriture : admins uniquement (via service_role ou is_admin())
DROP POLICY IF EXISTS "admin_write_broadcasts" ON public.platform_broadcasts;
CREATE POLICY "admin_write_broadcasts" ON public.platform_broadcasts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Dismissals : chacun gère les siens
DROP POLICY IF EXISTS "user_rw_own_dismissals" ON public.platform_broadcast_dismissals;
CREATE POLICY "user_rw_own_dismissals" ON public.platform_broadcast_dismissals
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
