-- ============================================
-- Migration : Garde d'intégrité de l'inscription SOTA 2026
-- Date : 2026-04-15
-- Objectif :
--   Vérifier et restaurer (idempotent) toutes les tables, contraintes
--   et triggers indispensables à l'inscription d'un nouveau compte.
--   Toute ré-exécution sur une base saine est un no-op.
--
--   Cette migration sert de filet de sécurité si une base de production
--   a manqué l'une des migrations intermédiaires
--   (20260411130000 → 20260412140000) qui traitent les rôles syndic,
--   agency, le trigger handle_new_user et les contraintes d'onboarding.
-- ============================================

BEGIN;

-- ============================================
-- 1. TABLE profiles — s'assurer que la contrainte de rôle autorise
--    les 6 rôles publics (owner, tenant, provider, guarantor, syndic,
--    agency) + admin + platform_admin. Le trigger handle_new_user
--    refusera admin/platform_admin (cf. migration 20260412140000).
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    RAISE EXCEPTION 'Table public.profiles manquante — la migration 20240101000000_initial_schema.sql doit être appliquée avant ce filet de sécurité.';
  END IF;
END $$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'admin',
    'platform_admin',
    'owner',
    'tenant',
    'provider',
    'guarantor',
    'syndic',
    'agency',
    'coproprietaire'
  ));

-- Colonne email (cf. migration 20260411130000)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Colonnes de tracking (cf. migration 20260114000000)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS welcome_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tour_completed_at TIMESTAMPTZ;

-- ============================================
-- 2. owner_profiles / tenant_profiles / provider_profiles
--    (créés par 20240101000000 — on garantit l'existence en filet)
-- ============================================

CREATE TABLE IF NOT EXISTS public.owner_profiles (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'particulier' CHECK (type IN ('particulier', 'societe')),
  siret TEXT,
  tva TEXT,
  iban TEXT,
  adresse_facturation TEXT,
  raison_sociale TEXT,
  adresse_siege TEXT,
  forme_juridique TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_profiles (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  situation_pro TEXT,
  revenus_mensuels DECIMAL(10, 2),
  nb_adultes INTEGER NOT NULL DEFAULT 1,
  nb_enfants INTEGER NOT NULL DEFAULT 0,
  garant_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.provider_profiles (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  type_services TEXT[] NOT NULL DEFAULT '{}',
  certifications TEXT,
  zones_intervention TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. guarantor_profiles (cf. 20251208000000)
-- ============================================

CREATE TABLE IF NOT EXISTS public.guarantor_profiles (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  situation_professionnelle TEXT,
  employeur TEXT,
  profession TEXT,
  revenus_mensuels_nets DECIMAL(10, 2),
  revenus_annuels DECIMAL(12, 2),
  proprietaire_residence BOOLEAN DEFAULT false,
  valeur_patrimoine_immobilier DECIMAL(12, 2),
  epargne_disponible DECIMAL(12, 2),
  documents_verified BOOLEAN DEFAULT false,
  avis_imposition_url TEXT,
  justificatif_domicile_url TEXT,
  cni_url TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 4. agency_profiles (cf. 20251206700000 + 20260411130100)
--    raison_sociale doit être NULLable pour permettre l'upsert initial
--    à l'inscription. Elle est complétée en /agency/onboarding/profile.
-- ============================================

CREATE TABLE IF NOT EXISTS public.agency_profiles (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  raison_sociale TEXT,
  forme_juridique TEXT,
  siret TEXT,
  numero_carte_pro TEXT,
  carte_pro_delivree_par TEXT,
  carte_pro_validite DATE,
  garantie_financiere_montant DECIMAL(12, 2),
  garantie_financiere_organisme TEXT,
  assurance_rcp TEXT,
  assurance_rcp_organisme TEXT,
  adresse_siege TEXT,
  logo_url TEXT,
  website TEXT,
  description TEXT,
  zones_intervention TEXT[],
  services_proposes TEXT[] DEFAULT ARRAY['gestion_locative'],
  commission_gestion_defaut DECIMAL(4, 2) DEFAULT 7.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Forcer raison_sociale NULLable même si une ancienne version l'avait NOT NULL
ALTER TABLE public.agency_profiles
  ALTER COLUMN raison_sociale DROP NOT NULL;

-- ============================================
-- 5. syndic_profiles (cf. 20260411130200)
-- ============================================

CREATE TABLE IF NOT EXISTS public.syndic_profiles (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  raison_sociale TEXT,
  forme_juridique TEXT CHECK (
    forme_juridique IS NULL OR
    forme_juridique IN ('SARL', 'SAS', 'SASU', 'SCI', 'EURL', 'EI', 'SA', 'association', 'benevole', 'autre')
  ),
  siret TEXT,
  type_syndic TEXT NOT NULL DEFAULT 'professionnel' CHECK (
    type_syndic IN ('professionnel', 'benevole', 'cooperatif')
  ),
  numero_carte_pro TEXT,
  carte_pro_delivree_par TEXT,
  carte_pro_validite DATE,
  garantie_financiere_montant DECIMAL(12, 2),
  garantie_financiere_organisme TEXT,
  assurance_rcp TEXT,
  assurance_rcp_organisme TEXT,
  adresse_siege TEXT,
  code_postal TEXT,
  ville TEXT,
  telephone TEXT,
  email_contact TEXT,
  website TEXT,
  logo_url TEXT,
  nombre_coproprietes_gerees INTEGER DEFAULT 0,
  zones_intervention TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 6. Tables d'onboarding (drafts, progress, analytics, reminders)
-- ============================================

CREATE TABLE IF NOT EXISTS public.onboarding_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT,
  step TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  step TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role, step)
);

CREATE TABLE IF NOT EXISTS public.onboarding_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_duration_seconds INTEGER,
  steps_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_steps INTEGER NOT NULL DEFAULT 0,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  skipped_steps INTEGER NOT NULL DEFAULT 0,
  dropped_at_step TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device_type TEXT,
  browser TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.onboarding_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '72h', '7d', '14d', '30d')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'push', 'sms')),
  email_sent_to TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'cancelled', 'failed')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, reminder_type)
);

-- Étendre les contraintes CHECK role pour accepter les 6 rôles publics
-- (cf. migration 20260411130300 — certains rôles introduits après 20260114)
ALTER TABLE public.onboarding_analytics
  DROP CONSTRAINT IF EXISTS onboarding_analytics_role_check;
ALTER TABLE public.onboarding_analytics
  ADD CONSTRAINT onboarding_analytics_role_check
  CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency'));

ALTER TABLE public.onboarding_reminders
  DROP CONSTRAINT IF EXISTS onboarding_reminders_role_check;
ALTER TABLE public.onboarding_reminders
  ADD CONSTRAINT onboarding_reminders_role_check
  CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency'));

-- ============================================
-- 7. Trigger handle_new_user — restaurer la version SOTA 2026
--    (cf. migration 20260412140000_close_admin_self_elevation.sql)
--    Seuls les 6 rôles publics sont acceptés ; admin/platform_admin
--    passent en fallback tenant pour empêcher l'auto-élévation.
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
  v_email TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'tenant');

  IF v_role NOT IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';
  v_email := NEW.email;

  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone, email)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone, v_email)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[handle_new_user] Erreur pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- S'assurer que le trigger existe bien sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 8. Rapport final — audit des tables critiques d'inscription
-- ============================================

DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_table TEXT;
  v_required TEXT[] := ARRAY[
    'profiles',
    'owner_profiles',
    'tenant_profiles',
    'provider_profiles',
    'guarantor_profiles',
    'agency_profiles',
    'syndic_profiles',
    'onboarding_drafts',
    'onboarding_progress',
    'onboarding_analytics',
    'onboarding_reminders'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_required LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      v_missing := array_append(v_missing, v_table);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION '[signup-integrity-guard] Tables manquantes après migration: %', v_missing;
  END IF;

  RAISE NOTICE '[signup-integrity-guard] OK — toutes les tables critiques d''inscription sont présentes.';
END $$;

COMMIT;
