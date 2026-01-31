-- Migration: Create webhook_queue table for retry service
-- Sprint 2: INTEG-001 - Webhook retry service

-- Table de queue pour les webhooks sortants avec retry
CREATE TABLE IF NOT EXISTS public.webhook_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identifiant de l'événement
    event_type TEXT NOT NULL,

    -- Payload JSON à envoyer
    payload JSONB NOT NULL DEFAULT '{}',

    -- URL cible
    target_url TEXT NOT NULL,

    -- Headers HTTP supplémentaires (optionnel)
    headers JSONB DEFAULT NULL,

    -- Compteur de retries
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,

    -- Date du prochain retry
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),

    -- Statut du webhook
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'success', 'failed', 'dead_letter')),

    -- Métadonnées de suivi
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NULL,
    last_error TEXT DEFAULT NULL,

    -- Index pour les requêtes fréquentes
    CONSTRAINT webhook_queue_max_retries_check CHECK (max_retries > 0 AND max_retries <= 10)
);

-- Index pour récupérer les webhooks à traiter
CREATE INDEX IF NOT EXISTS idx_webhook_queue_pending
    ON public.webhook_queue (next_retry_at)
    WHERE status = 'pending';

-- Index pour les dead letters
CREATE INDEX IF NOT EXISTS idx_webhook_queue_dead_letter
    ON public.webhook_queue (created_at DESC)
    WHERE status = 'dead_letter';

-- Index pour le nettoyage
CREATE INDEX IF NOT EXISTS idx_webhook_queue_cleanup
    ON public.webhook_queue (created_at)
    WHERE status = 'success';

-- Index sur event_type pour monitoring
CREATE INDEX IF NOT EXISTS idx_webhook_queue_event_type
    ON public.webhook_queue (event_type, status);

-- Commentaires
COMMENT ON TABLE public.webhook_queue IS 'Queue pour les webhooks sortants avec système de retry';
COMMENT ON COLUMN public.webhook_queue.event_type IS 'Type d''événement (ex: Payment.Succeeded, Lease.Created)';
COMMENT ON COLUMN public.webhook_queue.payload IS 'Contenu JSON du webhook';
COMMENT ON COLUMN public.webhook_queue.target_url IS 'URL de destination du webhook';
COMMENT ON COLUMN public.webhook_queue.headers IS 'Headers HTTP supplémentaires (auth, etc.)';
COMMENT ON COLUMN public.webhook_queue.retry_count IS 'Nombre de tentatives effectuées';
COMMENT ON COLUMN public.webhook_queue.max_retries IS 'Nombre maximum de tentatives (défaut: 5)';
COMMENT ON COLUMN public.webhook_queue.next_retry_at IS 'Date/heure du prochain essai';
COMMENT ON COLUMN public.webhook_queue.status IS 'Statut: pending, processing, success, failed, dead_letter';
COMMENT ON COLUMN public.webhook_queue.last_error IS 'Dernière erreur rencontrée';

-- RLS: Seul le service role peut accéder à cette table
ALTER TABLE public.webhook_queue ENABLE ROW LEVEL SECURITY;

-- Pas de policy pour les utilisateurs normaux
-- La table n'est accessible que via le service role

-- Fonction de nettoyage automatique (optionnel, via pg_cron)
CREATE OR REPLACE FUNCTION cleanup_old_webhooks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.webhook_queue
    WHERE status = 'success'
    AND created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_webhooks() IS 'Supprime les webhooks réussis de plus de 30 jours';
