-- Migration: Backfill identity_status pour les profils existants
-- Protège les utilisateurs existants avant activation du middleware identity-gate.
-- Ordre d'exécution important : les requêtes les plus spécifiques d'abord.

-- 1. Tenants avec bail actif/signé/terminé → identity_verified
UPDATE profiles SET
  identity_status         = 'identity_verified',
  identity_verified_at    = NOW(),
  phone_verified          = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at       = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step         = 'complete',
  onboarding_completed_at = NOW()
WHERE id IN (
  SELECT DISTINCT tenant_id FROM leases
  WHERE statut IN ('active', 'signed', 'ended')
  AND tenant_id IS NOT NULL
)
AND identity_status = 'unverified';

-- 2. Utilisateurs ayant uploadé des documents → identity_verified
UPDATE profiles SET
  identity_status         = 'identity_verified',
  identity_verified_at    = NOW(),
  phone_verified          = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at       = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step         = 'complete',
  onboarding_completed_at = NOW()
WHERE id IN (
  SELECT DISTINCT uploaded_by FROM documents WHERE uploaded_by IS NOT NULL
)
AND identity_status = 'unverified';

-- 3. Admins → identity_verified d'office
UPDATE profiles SET
  identity_status         = 'identity_verified',
  identity_verified_at    = NOW(),
  phone_verified          = true,
  onboarding_step         = 'complete',
  onboarding_completed_at = NOW()
WHERE role = 'admin'
AND identity_status = 'unverified';

-- 4. Tous les autres comptes créés depuis plus de 24h → phone_verified (grace period)
UPDATE profiles SET
  identity_status = 'phone_verified',
  phone_verified  = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  onboarding_step = 'phone_done'
WHERE identity_status = 'unverified'
AND created_at < NOW() - INTERVAL '1 day';

-- 5. Vérification : distribution finale des statuts
-- SELECT identity_status, COUNT(*) AS total
-- FROM profiles
-- GROUP BY identity_status
-- ORDER BY total DESC;
