-- =====================================================
-- Migration: Réparation complète — signataires manquants + invitations
-- Date: 2026-02-22
--
-- Problème : Certains baux (notamment da2eb9da) sont en fully_signed
-- mais n'ont AUCUN lease_signers, ce qui empêche l'affichage du locataire
-- et bloque le flux d'activation.
--
-- Cette migration :
-- 1. [DIAGNOSTIC] Identifie les baux signés sans signataires
-- 2. Crée le signataire PROPRIETAIRE manquant pour chaque bail signé
-- 3. Crée le signataire LOCATAIRE manquant à partir des invitations
-- 4. Lie les lease_signers orphelins (profile_id NULL) dont l'email matche un compte
-- 5. Crée les invitations manquantes pour les signataires sans invitation valide
-- =====================================================

BEGIN;

-- ========================================================
-- ÉTAPE 1 : Créer les signataires PROPRIETAIRE manquants
-- Pour tout bail en fully_signed/active/terminated sans signataire propriétaire
-- ========================================================
INSERT INTO public.lease_signers (lease_id, profile_id, role, signature_status, signed_at)
SELECT
  l.id AS lease_id,
  p.owner_id AS profile_id,
  'proprietaire' AS role,
  'signed' AS signature_status,
  COALESCE(l.sealed_at, l.updated_at, NOW()) AS signed_at
FROM public.leases l
JOIN public.properties p ON p.id = l.property_id
WHERE l.statut IN ('fully_signed', 'active', 'terminated', 'archived')
  AND NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
      AND ls.role = 'proprietaire'
  )
ON CONFLICT DO NOTHING;

-- ========================================================
-- ÉTAPE 2 : Créer les signataires LOCATAIRE PRINCIPAL manquants
-- Source prioritaire : table invitations (contient l'email du locataire invité)
-- ========================================================
INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, role, signature_status, signed_at)
SELECT DISTINCT ON (i.lease_id)
  i.lease_id,
  COALESCE(pr.id, NULL) AS profile_id,
  i.email AS invited_email,
  'locataire_principal' AS role,
  CASE
    WHEN le.statut IN ('fully_signed', 'active', 'terminated', 'archived') THEN 'signed'
    ELSE 'pending'
  END AS signature_status,
  CASE
    WHEN le.statut IN ('fully_signed', 'active', 'terminated', 'archived')
    THEN COALESCE(i.used_at, le.sealed_at, le.updated_at, NOW())
    ELSE NULL
  END AS signed_at
FROM public.invitations i
JOIN public.leases le ON le.id = i.lease_id
LEFT JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(i.email))
LEFT JOIN public.profiles pr ON pr.user_id = u.id
WHERE i.role IN ('locataire_principal', 'locataire', 'tenant')
  AND NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = i.lease_id
      AND ls.role IN ('locataire_principal', 'locataire', 'tenant')
  )
ORDER BY i.lease_id, i.created_at DESC;

-- ========================================================
-- ÉTAPE 3 : Lier les lease_signers orphelins
-- profile_id NULL + invited_email matche un compte auth.users
-- ========================================================
UPDATE public.lease_signers ls
SET profile_id = pr.id
FROM public.profiles pr
JOIN auth.users u ON u.id = pr.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

-- ========================================================
-- ÉTAPE 4 : Créer les invitations manquantes
-- Pour les signataires locataires/colocataires sans invitation valide
-- ========================================================
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
  AND LOWER(TRIM(ls.invited_email)) NOT LIKE '%@a-definir%'
  AND NOT EXISTS (
    SELECT 1 FROM public.invitations i
    WHERE i.lease_id = ls.lease_id
      AND LOWER(TRIM(i.email)) = LOWER(TRIM(ls.invited_email))
      AND i.used_at IS NULL
      AND i.expires_at > NOW()
  );

-- ========================================================
-- ÉTAPE 5 : Filet de sécurité — bail da2eb9da (Thomas VOLBERG)
-- Uniquement si ce bail existe (migration de réparation production)
-- ========================================================
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM public.leases WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7') THEN

  -- 5a. Créer le locataire signer si manquant
  INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, invited_name, role, signature_status, signed_at)
  SELECT
    'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, pr.id, 'volberg.thomas@hotmail.fr', 'Thomas VOLBERG', 'locataire_principal', 'signed', NOW()
  FROM (SELECT pr2.id FROM public.profiles pr2 JOIN auth.users u ON u.id = pr2.user_id WHERE LOWER(u.email) = 'volberg.thomas@hotmail.fr' LIMIT 1) pr
  WHERE NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role IN ('locataire_principal', 'locataire', 'tenant'));

  -- 5b. Fallback signer orphelin
  INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, invited_name, role, signature_status, signed_at)
  SELECT 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, NULL, 'volberg.thomas@hotmail.fr', 'Thomas VOLBERG', 'locataire_principal', 'signed', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role IN ('locataire_principal', 'locataire', 'tenant'));

  -- 5c. Proprio signer
  INSERT INTO public.lease_signers (lease_id, profile_id, role, signature_status, signed_at)
  SELECT 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, p.owner_id, 'proprietaire', 'signed', NOW()
  FROM public.leases l JOIN public.properties p ON p.id = l.property_id
  WHERE l.id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
    AND NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role = 'proprietaire');

END IF;
END $$;

-- ========================================================
-- ÉTAPE 6 : Lier les profils tenant sans user_id à auth.users
-- (complémentaire : certains profiles ont role='tenant' mais user_id NULL)
-- ========================================================
UPDATE public.profiles p
SET user_id = u.id
FROM auth.users u
WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
  AND p.role = 'tenant'
  AND p.user_id IS NULL;

-- ========================================================
-- ÉTAPE 7 : Re-lier les lease_signers après la correction des profiles
-- (2e passe, car l'étape 6 a pu créer de nouvelles liaisons)
-- ========================================================
UPDATE public.lease_signers ls
SET profile_id = pr.id
FROM public.profiles pr
JOIN auth.users u ON u.id = pr.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

COMMIT;
