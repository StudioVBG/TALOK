-- ============================================================================
-- Migration: Fix owner_id mismatch on properties table
-- Date: 2026-03-20
--
-- Problème: Certaines propriétés ont owner_id = profiles.user_id (UUID auth)
-- au lieu de owner_id = profiles.id (UUID profil). Cela casse les politiques
-- RLS qui utilisent public.user_profile_id() pour comparer avec owner_id.
--
-- Cette migration:
-- 1. Corrige les owner_id incorrects (user_id → profiles.id)
-- 2. S'assure que la fonction user_profile_id() est SECURITY DEFINER et STABLE
-- 3. Supprime les doublons éventuels de propriétés
-- ============================================================================

-- ============================================================================
-- 1. Corriger les owner_id qui pointent vers user_id au lieu de profiles.id
-- ============================================================================

-- Diagnostic d'abord (visible dans les logs)
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM properties pr
  INNER JOIN profiles p ON pr.owner_id = p.user_id
  WHERE p.role = 'owner'
    AND p.id != pr.owner_id
    AND pr.deleted_at IS NULL;

  RAISE NOTICE 'Propriétés avec owner_id mismatch (user_id au lieu de profiles.id): %', mismatch_count;
END $$;

-- Correction: remplacer owner_id = user_id par owner_id = profiles.id
UPDATE properties pr
SET owner_id = p.id,
    updated_at = NOW()
FROM profiles p
WHERE pr.owner_id = p.user_id
  AND p.role = 'owner'
  AND p.id != pr.owner_id;

-- ============================================================================
-- 2. S'assurer que user_profile_id() fonctionne correctement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================================
-- 3. Vérifier et supprimer les doublons de propriétés
--    (même adresse, même owner_id, même type = doublon probable)
-- ============================================================================

-- Marquer les doublons comme supprimés (soft delete) en gardant le plus récent
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id, adresse_complete, type, ville, code_postal
      ORDER BY created_at DESC
    ) as rn
  FROM properties
  WHERE deleted_at IS NULL
    AND adresse_complete IS NOT NULL
    AND adresse_complete != ''
)
UPDATE properties
SET deleted_at = NOW(),
    deleted_by = 'system-dedup-migration'
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Log du nombre de doublons supprimés
DO $$
DECLARE
  dedup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dedup_count
  FROM properties
  WHERE deleted_by = 'system-dedup-migration'
    AND deleted_at >= NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Propriétés doublons soft-deleted: %', dedup_count;
END $$;

-- ============================================================================
-- 4. Vérification finale
-- ============================================================================

DO $$
DECLARE
  remaining_mismatch INTEGER;
  total_active INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_mismatch
  FROM properties pr
  INNER JOIN profiles p ON pr.owner_id = p.user_id
  WHERE p.role = 'owner'
    AND p.id != pr.owner_id
    AND pr.deleted_at IS NULL;

  SELECT COUNT(*) INTO total_active
  FROM properties
  WHERE deleted_at IS NULL;

  RAISE NOTICE 'Vérification: % propriétés actives, % mismatches restants', total_active, remaining_mismatch;
END $$;
