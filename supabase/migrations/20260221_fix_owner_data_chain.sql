-- ============================================
-- Migration: Correction de la chaîne de données compte propriétaire
-- Date: 2026-02-21
-- Description:
--   1. handle_new_user() crée aussi owner_profiles / tenant_profiles / provider_profiles
--   2. create_default_particulier_entity() crée une entité pour tous les types (pas seulement particulier)
--   3. Backfill des données existantes (owner_profiles, tenant_profiles, legal_entities)
--   4. Index unique sur lease_signers pour éviter doublons (lease_id, invited_email) quand profile_id IS NULL
-- Idempotent: peut être exécutée plusieurs fois sans effet secondaire.
-- ============================================

BEGIN;

-- ============================================
-- 1. Corriger handle_new_user() : créer les profils spécialisés
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
  v_profile_id UUID;
BEGIN
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le rôle
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Insérer le profil avec toutes les données
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  -- Récupérer le profile_id qui vient d'être créé ou mis à jour
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = NEW.id;

  -- Créer le profil spécialisé selon le rôle
  IF v_role = 'owner' AND v_profile_id IS NOT NULL THEN
    INSERT INTO public.owner_profiles (profile_id, type)
    VALUES (v_profile_id, 'particulier')
    ON CONFLICT (profile_id) DO NOTHING;
  ELSIF v_role = 'tenant' AND v_profile_id IS NOT NULL THEN
    INSERT INTO public.tenant_profiles (profile_id)
    VALUES (v_profile_id)
    ON CONFLICT (profile_id) DO NOTHING;
  ELSIF v_role = 'provider' AND v_profile_id IS NOT NULL THEN
    INSERT INTO public.provider_profiles (profile_id, type_services)
    VALUES (v_profile_id, '{}')
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Crée automatiquement un profil et le profil spécialisé (owner_profiles, tenant_profiles, etc.) lors de la création d''un utilisateur.';

-- ============================================
-- 2. Corriger create_default_particulier_entity() : créer entité pour tous les types
-- ============================================

CREATE OR REPLACE FUNCTION create_default_particulier_entity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO legal_entities (owner_profile_id, entity_type, nom, regime_fiscal, is_active)
  SELECT
    NEW.profile_id,
    CASE WHEN NEW.type = 'societe' THEN 'sci_ir' ELSE 'particulier' END,
    COALESCE(
      (SELECT CONCAT(p.prenom, ' ', p.nom) FROM profiles p WHERE p.id = NEW.profile_id),
      'Patrimoine personnel'
    ),
    'ir',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM legal_entities WHERE owner_profile_id = NEW.profile_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Backfill : réparer les données existantes
-- ============================================

-- Créer owner_profiles manquants
INSERT INTO owner_profiles (profile_id, type)
SELECT id, 'particulier'
FROM profiles
WHERE role = 'owner'
  AND NOT EXISTS (SELECT 1 FROM owner_profiles WHERE profile_id = profiles.id);

-- Créer tenant_profiles manquants
INSERT INTO tenant_profiles (profile_id)
SELECT id FROM profiles
WHERE role = 'tenant'
  AND NOT EXISTS (SELECT 1 FROM tenant_profiles WHERE profile_id = profiles.id);

-- Créer provider_profiles manquants
INSERT INTO provider_profiles (profile_id, type_services)
SELECT id, '{}' FROM profiles
WHERE role = 'provider'
  AND NOT EXISTS (SELECT 1 FROM provider_profiles WHERE profile_id = profiles.id);

-- Créer legal_entities manquantes pour les propriétaires
INSERT INTO legal_entities (owner_profile_id, entity_type, nom, regime_fiscal, is_active)
SELECT op.profile_id, 'particulier',
  COALESCE(CONCAT(p.prenom, ' ', p.nom), 'Patrimoine personnel'), 'ir', true
FROM owner_profiles op
JOIN profiles p ON op.profile_id = p.id
WHERE NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.owner_profile_id = op.profile_id);

-- Lier les propriétés orphelines à l'entité par défaut du propriétaire
UPDATE properties p
SET legal_entity_id = (
  SELECT le.id FROM legal_entities le
  WHERE le.owner_profile_id = p.owner_id
  ORDER BY le.created_at ASC
  LIMIT 1
)
WHERE p.legal_entity_id IS NULL
  AND EXISTS (SELECT 1 FROM legal_entities le WHERE le.owner_profile_id = p.owner_id);

-- ============================================
-- 4. Index unique pour éviter doublons de signataires (invited_email sans profile_id)
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_lease_signer_email
  ON lease_signers (lease_id, invited_email)
  WHERE profile_id IS NULL AND invited_email IS NOT NULL;

COMMIT;
