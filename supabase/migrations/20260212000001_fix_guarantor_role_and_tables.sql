-- ============================================
-- Migration: Ajouter le rôle guarantor + tables manquantes
-- Date: 2026-02-12
-- Description:
--   1. Ajouter 'guarantor' dans le CHECK constraint de profiles.role
--   2. Mettre à jour handle_new_user pour accepter 'guarantor'
--   3. Créer la table guarantor_profiles
--   4. Créer la table user_consents pour la conformité RGPD
--   5. Ajouter un CHECK constraint sur le champ telephone
-- ============================================

-- 1. Modifier le CHECK constraint de profiles.role pour inclure 'guarantor'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'owner', 'tenant', 'provider', 'guarantor'));

-- 2. Mettre à jour handle_new_user pour reconnaître 'guarantor'
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
BEGIN
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le rôle (inclut désormais 'guarantor')
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
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

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Crée automatiquement un profil lors de la création d''un utilisateur.
Lit le rôle et les informations personnelles depuis les raw_user_meta_data.
Supporte les rôles: admin, owner, tenant, provider, guarantor.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';

-- 3. Créer la table guarantor_profiles
CREATE TABLE IF NOT EXISTS guarantor_profiles (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  type_garantie TEXT CHECK (type_garantie IN ('personnelle', 'visale', 'depot_bancaire')),
  revenus_mensuels DECIMAL(10, 2),
  date_naissance DATE,
  piece_identite_path TEXT,
  justificatif_revenus_path TEXT,
  visale_path TEXT,
  depot_bancaire_montant DECIMAL(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS pour guarantor_profiles
ALTER TABLE guarantor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guarantor_profiles_select_own" ON guarantor_profiles;
CREATE POLICY "guarantor_profiles_select_own" ON guarantor_profiles
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "guarantor_profiles_insert_own" ON guarantor_profiles;
CREATE POLICY "guarantor_profiles_insert_own" ON guarantor_profiles
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "guarantor_profiles_update_own" ON guarantor_profiles;
CREATE POLICY "guarantor_profiles_update_own" ON guarantor_profiles
  FOR UPDATE USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- 4. Créer la table user_consents pour la conformité RGPD
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  terms_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted BOOLEAN NOT NULL DEFAULT false,
  privacy_version TEXT NOT NULL,
  privacy_accepted_at TIMESTAMPTZ,
  cookies_necessary BOOLEAN NOT NULL DEFAULT true,
  cookies_analytics BOOLEAN NOT NULL DEFAULT false,
  cookies_ads BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);

-- RLS pour user_consents
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_consents_select_own" ON user_consents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_consents_insert_own" ON user_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_consents_update_own" ON user_consents
  FOR UPDATE USING (user_id = auth.uid());

-- 5. Ajouter un CHECK constraint sur telephone (format E.164)
-- Le format E.164 commence par + suivi de 1 à 15 chiffres
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_telephone_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_telephone_check
  CHECK (telephone IS NULL OR telephone ~ '^\+[1-9]\d{1,14}$');
