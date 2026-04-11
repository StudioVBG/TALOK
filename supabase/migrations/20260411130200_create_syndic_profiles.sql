-- ============================================
-- Migration: Créer table syndic_profiles
-- Date: 2026-04-11
-- Contexte:
--   Le rôle syndic utilisait jusqu'ici `profiles` seul, sans table dédiée
--   pour les champs réglementaires (carte professionnelle, garantie
--   financière, assurance RCP, SIRET, raison sociale).
--
--   Cette migration crée la table minimale pour supporter :
--     - L'inscription syndic via /api/v1/auth/register
--     - L'onboarding /syndic/onboarding/profile
--     - Les obligations légales loi Hoguet pour les syndics professionnels
-- ============================================

CREATE TABLE IF NOT EXISTS public.syndic_profiles (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Identité cabinet
  raison_sociale TEXT,
  forme_juridique TEXT CHECK (
    forme_juridique IS NULL OR
    forme_juridique IN ('SARL', 'SAS', 'SASU', 'SCI', 'EURL', 'EI', 'SA', 'association', 'benevole', 'autre')
  ),
  siret TEXT,

  -- Type de syndic
  type_syndic TEXT NOT NULL DEFAULT 'professionnel' CHECK (
    type_syndic IN ('professionnel', 'benevole', 'cooperatif')
  ),

  -- Carte professionnelle (obligatoire pour les syndics professionnels — loi Hoguet)
  numero_carte_pro TEXT,
  carte_pro_delivree_par TEXT,
  carte_pro_validite DATE,

  -- Garantie financière (obligatoire pour les syndics professionnels)
  garantie_financiere_montant DECIMAL(12, 2),
  garantie_financiere_organisme TEXT,

  -- Assurance RCP (obligatoire)
  assurance_rcp TEXT,
  assurance_rcp_organisme TEXT,

  -- Coordonnées
  adresse_siege TEXT,
  code_postal TEXT,
  ville TEXT,
  telephone TEXT,
  email_contact TEXT,
  website TEXT,
  logo_url TEXT,

  -- Activités
  nombre_coproprietes_gerees INTEGER DEFAULT 0,
  zones_intervention TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_syndic_profiles_siret ON public.syndic_profiles(siret);
CREATE INDEX IF NOT EXISTS idx_syndic_profiles_carte_pro ON public.syndic_profiles(numero_carte_pro);

COMMENT ON TABLE public.syndic_profiles IS
'Profils des syndics de copropriété (professionnels, bénévoles, coopératifs).
Stocke les champs réglementaires loi Hoguet (carte pro, garantie financière, RCP).';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.syndic_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndic_profiles_select_own" ON public.syndic_profiles;
CREATE POLICY "syndic_profiles_select_own" ON public.syndic_profiles
  FOR SELECT TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "syndic_profiles_insert_own" ON public.syndic_profiles;
CREATE POLICY "syndic_profiles_insert_own" ON public.syndic_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "syndic_profiles_update_own" ON public.syndic_profiles;
CREATE POLICY "syndic_profiles_update_own" ON public.syndic_profiles
  FOR UPDATE TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Trigger updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_syndic_profiles_updated_at ON public.syndic_profiles;
CREATE TRIGGER update_syndic_profiles_updated_at
  BEFORE UPDATE ON public.syndic_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Grants
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syndic_profiles TO authenticated;
