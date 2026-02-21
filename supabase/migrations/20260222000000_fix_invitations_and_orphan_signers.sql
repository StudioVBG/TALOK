-- =====================================================
-- Migration: Lier les lease_signers orphelins et créer les invitations manquantes
-- Date: 2026-02-22
--
-- Contexte: Les baux créés avant l'unification des flux n'ont pas de record
-- dans la table invitations, ce qui empêche le locataire de voir/accepter
-- l'invitation. Cette migration :
-- 1. Lie les lease_signers orphelins (profile_id NULL) dont l'email correspond à un compte.
-- 2. Crée une invitation (token, email, role, lease_id, ...) pour chaque signataire
--    locataire (locataire_principal, colocataire) qui n'a pas déjà une invitation
--    valide (non utilisée) pour ce bail et cet email.
-- =====================================================

BEGIN;

-- 1. Lier les lease_signers orphelins : profile_id NULL + invited_email matche auth.users
UPDATE public.lease_signers ls
SET profile_id = p.id
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

-- 2. Créer les invitations manquantes pour les signataires locataires sans invitation utilisable
--    (une invitation par lease_id + email, avec token unique et expiration 30 jours)
INSERT INTO public.invitations (
  token,
  email,
  role,
  property_id,
  unit_id,
  lease_id,
  created_by,
  expires_at
)
SELECT
  encode(gen_random_bytes(32), 'hex') AS token,
  ls.invited_email AS email,
  ls.role::TEXT AS role,
  l.property_id AS property_id,
  l.unit_id AS unit_id,
  ls.lease_id AS lease_id,
  p.owner_id AS created_by,
  (NOW() + INTERVAL '30 days')::TIMESTAMPTZ AS expires_at
FROM public.lease_signers ls
JOIN public.leases l ON l.id = ls.lease_id
JOIN public.properties p ON p.id = l.property_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.invitations i
    WHERE i.lease_id = ls.lease_id
      AND LOWER(TRIM(i.email)) = LOWER(TRIM(ls.invited_email))
      AND i.used_at IS NULL
      AND i.expires_at > NOW()
  );

COMMIT;
