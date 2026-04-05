-- Migration: Backfill identity_status pour les profils existants
-- Protège les utilisateurs existants avant activation du middleware identity-gate.
-- Ordre d'exécution important : les requêtes les plus spécifiques d'abord.
--
-- FIX: Utilise les vrais statuts leases (active, fully_signed, notice_given, terminated)
-- FIX: Supprime onboarding_completed_at (n'existe pas dans le schéma)
-- FIX: Utilise aussi lease_signers comme fallback quand leases.tenant_id est NULL

-- 1. Tenants/Owners avec bail actif/signé/terminé → identity_verified + complete
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at    = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step      = 'complete'
WHERE (
  -- Via leases.tenant_id (dénormalisé)
  id IN (
    SELECT DISTINCT tenant_id FROM leases
    WHERE statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
    AND tenant_id IS NOT NULL
  )
  OR
  -- Via lease_signers (source de vérité)
  id IN (
    SELECT DISTINCT ls.profile_id FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    WHERE l.statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
    AND ls.signature_status = 'signed'
    AND ls.profile_id IS NOT NULL
  )
  OR
  -- Propriétaires avec des biens
  id IN (
    SELECT DISTINCT owner_id FROM properties WHERE owner_id IS NOT NULL
  )
)
AND identity_status = 'unverified';

-- 2. Utilisateurs ayant uploadé des documents → identity_verified
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at    = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step      = 'complete'
WHERE id IN (
  SELECT DISTINCT uploaded_by FROM documents WHERE uploaded_by IS NOT NULL
)
AND identity_status = 'unverified';

-- 3. Admins → identity_verified d'office
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = true,
  onboarding_step      = 'complete'
WHERE role = 'admin'
AND identity_status = 'unverified';

-- 4. Comptes avec téléphone renseigné + prénom/nom → phone_verified
UPDATE profiles SET
  identity_status = 'phone_verified',
  phone_verified  = true,
  phone_verified_at = NOW(),
  onboarding_step = 'profile_done'
WHERE identity_status = 'unverified'
AND telephone IS NOT NULL AND telephone <> ''
AND prenom IS NOT NULL AND prenom <> ''
AND nom IS NOT NULL AND nom <> '';

-- 5. Comptes créés depuis plus de 24h sans rien → phone_verified (grace period)
UPDATE profiles SET
  identity_status = 'phone_verified',
  onboarding_step = 'phone_done'
WHERE identity_status = 'unverified'
AND created_at < NOW() - INTERVAL '1 day';
