-- =====================================================
-- Migration: Fix tenant data sync — liaison orpheline + notifications manquantes
-- Date: 2026-02-24
--
-- Contexte: Bug critique où le compte locataire est isolé malgré un bail signé
-- côté propriétaire. Causes: lease_signers.profile_id NULL (auto-link raté),
-- profiles.email manquant, notifications jamais créées.
--
-- Actions (toutes idempotentes):
-- 1. Re-lier les lease_signers orphelins (profile_id NULL + email matche auth)
-- 2. Backfill profiles.email depuis auth.users
-- 3. Backfill notifications pour locataires avec bail actif sans notification
-- 4. Diagnostic final
-- =====================================================

BEGIN;

-- ============================================
-- 1. ORPHAN LINKING: lease_signers avec profile_id NULL
-- ============================================
-- Pour chaque lease_signer dont le profile_id est NULL mais dont l'invited_email
-- correspond à un compte auth existant, on lie automatiquement.
UPDATE public.lease_signers ls
SET profile_id = p.id
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

-- ============================================
-- 2. BACKFILL: profiles.email depuis auth.users
-- ============================================
-- Certains profils n'ont pas d'email renseigné, ce qui empêche certaines
-- recherches de fonctionner. On récupère l'email depuis auth.users.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.user_id
  AND (p.email IS NULL OR TRIM(p.email) = '');

-- ============================================
-- 3. BACKFILL: notifications pour locataires avec bail actif
-- ============================================
-- Crée une notification "bail activé" pour chaque locataire lié à un bail
-- actif/fully_signed qui n'a jamais reçu de notification de type lease_activated.
INSERT INTO public.notifications (user_id, profile_id, type, title, body, is_read, metadata)
SELECT DISTINCT
  p.user_id,
  p.id,
  'lease_activated',
  'Bail activé',
  'Votre bail a été activé. Vous pouvez désormais accéder à toutes les fonctionnalités de votre espace locataire.',
  false,
  jsonb_build_object('lease_id', l.id, 'auto_backfill', true)
FROM public.lease_signers ls
JOIN public.leases l ON l.id = ls.lease_id
JOIN public.profiles p ON p.id = ls.profile_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND l.statut IN ('active', 'fully_signed')
  AND p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.profile_id = p.id
      AND n.type = 'lease_activated'
  );

-- ============================================
-- 4. DIAGNOSTIC FINAL
-- ============================================
DO $$
DECLARE
  orphans INT;
  backfilled INT;
  linked INT;
BEGIN
  -- Compter les orphelins restants (email valide sans compte)
  SELECT count(*)::INT INTO orphans
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND TRIM(invited_email) != ''
    AND invited_email NOT LIKE '%@a-definir%'
    AND invited_email NOT LIKE '%@placeholder%';

  -- Compter les notifications backfillées
  SELECT count(*)::INT INTO backfilled
  FROM public.notifications
  WHERE metadata->>'auto_backfill' = 'true';

  -- Compter les lease_signers liés par cette migration
  SELECT count(*)::INT INTO linked
  FROM public.lease_signers
  WHERE profile_id IS NOT NULL;

  RAISE NOTICE '[fix_tenant_sync] Orphelins restants: % | Notifications backfillées: % | Signers liés total: %',
    orphans, backfilled, linked;

  IF orphans > 0 THEN
    RAISE NOTICE '[fix_tenant_sync] Les % orphelins restants correspondent à des emails sans compte créé (attendu)', orphans;
  ELSE
    RAISE NOTICE '[fix_tenant_sync] Tous les signers avec email valide sont liés';
  END IF;
END $$;

COMMIT;
