-- ============================================================================
-- FIX: Peupler owner_profiles manquants + entités "particulier" manquantes
-- À exécuter dans Supabase SQL Editor
-- ============================================================================

-- 1. Créer les lignes owner_profiles manquantes pour tous les owners
INSERT INTO public.owner_profiles (profile_id, type)
SELECT p.id, 'particulier'
FROM public.profiles p
LEFT JOIN public.owner_profiles op ON op.profile_id = p.id
WHERE p.role = 'owner'
  AND op.profile_id IS NULL
ON CONFLICT (profile_id) DO NOTHING;

-- Vérifier combien ont été créés
SELECT 'owner_profiles créés' AS action, COUNT(*) AS nb
FROM public.owner_profiles op
JOIN public.profiles p ON p.id = op.profile_id
WHERE p.role = 'owner';

-- 2. Créer l'entité "particulier" (nom propre) pour les owners qui n'en ont pas
INSERT INTO public.legal_entities (owner_profile_id, entity_type, nom, regime_fiscal, is_active)
SELECT
  p.id,
  'particulier',
  COALESCE(p.prenom || ' ' || p.nom, p.email, 'Nom propre'),
  'micro_foncier',
  true
FROM public.profiles p
LEFT JOIN public.legal_entities le
  ON le.owner_profile_id = p.id AND le.entity_type = 'particulier'
WHERE p.role = 'owner'
  AND le.id IS NULL;

-- Vérifier combien d'entités "particulier" existent maintenant
SELECT 'entités particulier' AS action, COUNT(*) AS nb
FROM public.legal_entities
WHERE entity_type = 'particulier' AND is_active = true;

-- 3. Résumé : owners avec leur nombre d'entités
SELECT
  p.email,
  p.prenom,
  p.nom,
  COUNT(le.id) AS nb_entites,
  BOOL_OR(le.entity_type = 'particulier') AS has_particulier,
  EXISTS(SELECT 1 FROM public.owner_profiles op WHERE op.profile_id = p.id) AS has_owner_profile
FROM public.profiles p
LEFT JOIN public.legal_entities le ON le.owner_profile_id = p.id AND le.is_active = true
WHERE p.role = 'owner'
GROUP BY p.id, p.email, p.prenom, p.nom
ORDER BY nb_entites DESC;
