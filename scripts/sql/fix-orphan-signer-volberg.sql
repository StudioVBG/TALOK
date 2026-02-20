-- =====================================================
-- Fix orphelin : lier le locataire volberg.thomas@hotmail.fr
-- À exécuter dans Supabase → SQL Editor
-- =====================================================

-- 1. DIAGNOSTIC : signataires orphelins pour cet email
SELECT
  ls.id,
  ls.lease_id,
  ls.invited_email,
  ls.invited_name,
  ls.profile_id,
  ls.role,
  l.statut AS statut_bail,
  CASE WHEN ls.profile_id IS NULL THEN '❌ RUPTURE' ELSE '✅ OK' END AS status
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE LOWER(ls.invited_email) = LOWER('volberg.thomas@hotmail.fr');

-- 2. LIER le profil locataire aux lease_signers orphelins
WITH tenant_profile AS (
  SELECT p.id AS profile_id
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr')
)
UPDATE lease_signers
SET profile_id = (SELECT profile_id FROM tenant_profile)
WHERE LOWER(invited_email) = LOWER('volberg.thomas@hotmail.fr')
  AND profile_id IS NULL;

-- 3. MARQUER les invitations comme utilisées
WITH tenant_profile AS (
  SELECT p.id AS profile_id
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr')
)
UPDATE invitations
SET used_by = (SELECT profile_id FROM tenant_profile),
    used_at = NOW()
WHERE LOWER(email) = LOWER('volberg.thomas@hotmail.fr')
  AND used_at IS NULL;

-- 4. VÉRIFICATION : relancer le diagnostic (doit montrer profile_id renseigné)
SELECT
  ls.id,
  ls.lease_id,
  ls.invited_email,
  ls.profile_id,
  ls.role,
  CASE WHEN ls.profile_id IS NULL THEN '❌ RUPTURE' ELSE '✅ OK' END AS status
FROM lease_signers ls
WHERE LOWER(ls.invited_email) = LOWER('volberg.thomas@hotmail.fr');
