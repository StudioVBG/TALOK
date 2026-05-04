-- Migration: Passkeys hardening (correction des bugs critiques)
-- Date: 2026-05-04
-- Description:
--   - Restreint les RLS de passkey_challenges au service_role (corrige une fuite)
--   - Ajoute une contrainte unique (user_id, type) sur les challenges pour
--     que l'upsert lors de l'enregistrement remplace l'ancien challenge
--     plutot que de creer des doublons (cause de "Challenge expire ou invalide")
--   - Ajoute un index unique (user_id, friendly_name) tronque pour eviter les noms
--     de passkey en doublon
--   - Planifie le cleanup automatique des challenges expires via pg_cron

-- =============================================================================
-- 1) Nettoyer les challenges expires accumules avant d'ajouter la contrainte
-- =============================================================================
DELETE FROM passkey_challenges WHERE expires_at < NOW();

-- Si plusieurs challenges actifs existent encore pour un meme (user_id, type),
-- ne garder que le plus recent (defensif, table normalement vide post-reset)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, type
           ORDER BY created_at DESC
         ) AS rn
  FROM passkey_challenges
  WHERE user_id IS NOT NULL
)
DELETE FROM passkey_challenges
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- =============================================================================
-- 2) Contrainte unique partielle (user_id, type) sur les challenges actifs
-- Permet d'utiliser .upsert({ onConflict: 'user_id,type' }) sans doublons
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_passkey_challenges_user_type_unique
  ON passkey_challenges(user_id, type)
  WHERE user_id IS NOT NULL;

-- =============================================================================
-- 3) RLS strict sur passkey_challenges : seulement service_role
-- L'ancienne policy "FOR ALL USING (true)" sans clause TO permettait a
-- n'importe quel utilisateur authentifie de lire/modifier les challenges
-- des autres. On restreint au service_role exclusivement.
-- =============================================================================
DROP POLICY IF EXISTS "Service role full access to challenges" ON passkey_challenges;
DROP POLICY IF EXISTS "service_role can manage challenges" ON passkey_challenges;

CREATE POLICY "service_role can manage challenges"
  ON passkey_challenges
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Pas de policy pour authenticated/anon : ils n'ont aucun acces direct.
-- Toutes les operations sur passkey_challenges doivent passer par les
-- routes API utilisant getServiceClient().

-- =============================================================================
-- 4) Index unique (user_id, friendly_name) pour eviter les "Ma passkey" en doublon
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_passkey_credentials_user_friendly_unique
  ON passkey_credentials(user_id, friendly_name);

-- =============================================================================
-- 5) Cleanup automatique des challenges expires (pg_cron, toutes les 10 min)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Supprime un eventuel ancien job de meme nom avant de le recreer
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-passkey-challenges');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-passkey-challenges',
  '*/10 * * * *',
  $$SELECT cleanup_expired_passkey_challenges();$$
);

-- =============================================================================
-- 6) Commentaires
-- =============================================================================
COMMENT ON INDEX idx_passkey_challenges_user_type_unique IS
  'Garantit un seul challenge actif par (user_id, type). Utilise par upsert onConflict.';
COMMENT ON INDEX idx_passkey_credentials_user_friendly_unique IS
  'Evite les noms de passkey en doublon pour un meme utilisateur.';
