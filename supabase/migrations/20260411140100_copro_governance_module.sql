-- ============================================
-- Migration: Module Gouvernance Copropriété & Fonds Travaux (Loi ALUR)
-- Date: 2026-04-11
-- Phase: 2/8 du module syndic
--
-- Crée 3 tables complémentaires :
--   1. syndic_mandates     — Contrats syndic signés (mandat légal)
--   2. copro_councils      — Conseils syndicaux (membres + mandat)
--   3. copro_fonds_travaux — Fonds travaux obligatoire loi ALUR
--
-- Architecture :
--   - FK vers sites(id) — cohérent avec copro_assemblies
--   - RLS via sites.syndic_profile_id + user_site_roles
-- ============================================

-- ============================================
-- 1. SYNDIC_MANDATES — Mandats de syndic
-- ============================================
-- Note: la table `mandates` existe déjà pour les agences immobilières (gestion locative)
-- et `agency_mandates` pour les mandats white-label. Celle-ci est spécifique aux syndics
-- de copropriété (loi du 10 juillet 1965).
CREATE TABLE IF NOT EXISTS public.syndic_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  syndic_profile_id UUID NOT NULL REFERENCES public.profiles(id),

  -- Identification du mandat
  mandate_number TEXT, -- Numéro interne
  title TEXT NOT NULL DEFAULT 'Mandat de syndic',

  -- Durée (loi : 1 an minimum, 3 ans maximum)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_months INTEGER NOT NULL CHECK (duration_months BETWEEN 1 AND 36),

  -- Renouvellement / reconduction
  tacit_renewal BOOLEAN NOT NULL DEFAULT false,
  notice_period_months INTEGER DEFAULT 3, -- Préavis de résiliation
  previous_mandate_id UUID REFERENCES public.syndic_mandates(id), -- Chaînage des mandats

  -- Honoraires
  honoraires_annuels_cents INTEGER NOT NULL CHECK (honoraires_annuels_cents >= 0),
  honoraires_particuliers JSONB DEFAULT '{}', -- {edl: 15000, ag_supplement: 50000, etc.}
  currency TEXT NOT NULL DEFAULT 'EUR',

  -- Désignation par assemblée générale
  voted_in_assembly_id UUID REFERENCES public.copro_assemblies(id),
  voted_resolution_id UUID REFERENCES public.copro_resolutions(id),
  voted_at TIMESTAMPTZ,

  -- Document du mandat signé
  mandate_document_url TEXT,
  signed_at TIMESTAMPTZ,

  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'pending_signature', 'active', 'suspended', 'terminated', 'expired')
  ),

  -- Résiliation
  terminated_at TIMESTAMPTZ,
  terminated_by UUID REFERENCES auth.users(id),
  termination_reason TEXT,
  termination_type TEXT CHECK (
    termination_type IS NULL OR
    termination_type IN ('end_of_term', 'early_termination', 'non_renewal', 'revoked_by_ag', 'resignation')
  ),

  notes TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT syndic_mandate_dates_valid CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_syndic_mandates_site ON public.syndic_mandates(site_id);
CREATE INDEX IF NOT EXISTS idx_syndic_mandates_syndic ON public.syndic_mandates(syndic_profile_id);
CREATE INDEX IF NOT EXISTS idx_syndic_mandates_status ON public.syndic_mandates(site_id, status);
CREATE INDEX IF NOT EXISTS idx_syndic_mandates_end_date ON public.syndic_mandates(end_date);

-- Un seul mandat actif par site à la fois
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_syndic_mandate_per_site
  ON public.syndic_mandates(site_id)
  WHERE status = 'active';

COMMENT ON TABLE public.syndic_mandates IS
'Mandats de syndic de copropriété. Distincts des mandats agence immobilière. Loi du 10 juillet 1965 (durée 1-3 ans, renouvellement par AG).';

-- ============================================
-- 2. COPRO_COUNCILS — Conseils syndicaux
-- ============================================
CREATE TABLE IF NOT EXISTS public.copro_councils (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,

  -- Durée du mandat
  mandate_start DATE NOT NULL,
  mandate_end DATE NOT NULL,

  -- Président du conseil syndical
  president_profile_id UUID REFERENCES public.profiles(id),
  president_unit_id UUID REFERENCES public.copro_units(id),

  -- Vice-président (optionnel)
  vice_president_profile_id UUID REFERENCES public.profiles(id),
  vice_president_unit_id UUID REFERENCES public.copro_units(id),

  -- Membres du conseil (structurés en JSONB pour flexibilité)
  -- Format: [{profile_id, unit_id, role: 'member' | 'president' | 'vice_president', elected_at}]
  members JSONB NOT NULL DEFAULT '[]',
  members_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(COALESCE(members, '[]'::jsonb))) STORED,

  -- Désignation par AG
  elected_in_assembly_id UUID REFERENCES public.copro_assemblies(id),
  elected_resolution_id UUID REFERENCES public.copro_resolutions(id),

  -- Règlement du conseil
  internal_rules_document_url TEXT,

  -- Statut
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'suspended', 'dissolved', 'expired')
  ),

  -- Dissolution
  dissolved_at TIMESTAMPTZ,
  dissolution_reason TEXT,

  notes TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT copro_council_dates_valid CHECK (mandate_end > mandate_start)
);

CREATE INDEX IF NOT EXISTS idx_copro_councils_site ON public.copro_councils(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_councils_status ON public.copro_councils(site_id, status);
CREATE INDEX IF NOT EXISTS idx_copro_councils_president ON public.copro_councils(president_profile_id);

-- Un seul conseil actif par site
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_copro_council_per_site
  ON public.copro_councils(site_id)
  WHERE status = 'active';

COMMENT ON TABLE public.copro_councils IS
'Conseils syndicaux de copropriété. Élus en AG, assistent et contrôlent le syndic (loi du 10 juillet 1965).';

-- ============================================
-- 3. COPRO_FONDS_TRAVAUX — Fonds travaux obligatoire (Loi ALUR 2014)
-- ============================================
-- Obligatoire depuis 1er janvier 2017 pour les copropriétés de + de 5 ans
-- Cotisation minimale : 5% du budget prévisionnel annuel
CREATE TABLE IF NOT EXISTS public.copro_fonds_travaux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,

  -- Exercice concerné
  exercise_id UUID REFERENCES public.accounting_exercises(id) ON DELETE SET NULL,
  fiscal_year INTEGER NOT NULL, -- Ex: 2026

  -- Cotisation (loi ALUR : minimum 5% du budget prévisionnel)
  cotisation_taux_percent DECIMAL(5, 2) NOT NULL DEFAULT 5.00 CHECK (cotisation_taux_percent >= 0),
  cotisation_montant_annual_cents INTEGER NOT NULL CHECK (cotisation_montant_annual_cents >= 0),
  budget_reference_cents INTEGER, -- Budget prévisionnel de référence

  -- Solde
  solde_initial_cents INTEGER NOT NULL DEFAULT 0,
  solde_actuel_cents INTEGER NOT NULL DEFAULT 0,
  total_collected_cents INTEGER NOT NULL DEFAULT 0,
  total_spent_cents INTEGER NOT NULL DEFAULT 0,

  -- Dates
  derniere_cotisation_at TIMESTAMPTZ,
  next_cotisation_due_at DATE,

  -- Dérogation possible (copropriétés neuves ou à l'unanimité)
  loi_alur_exempt BOOLEAN NOT NULL DEFAULT false,
  exempt_reason TEXT CHECK (
    exempt_reason IS NULL OR
    exempt_reason IN ('copropriete_neuve_moins_5_ans', 'unanimite_dispense', 'dtg_pas_de_travaux_prevus')
  ),
  exempt_voted_resolution_id UUID REFERENCES public.copro_resolutions(id),

  -- Statut
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'paused', 'closed')
  ),

  -- Compte bancaire dédié (obligatoire loi ALUR)
  dedicated_bank_account TEXT, -- IBAN
  bank_name TEXT,

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT copro_fonds_travaux_unique_year UNIQUE (site_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_copro_fonds_travaux_site ON public.copro_fonds_travaux(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_fonds_travaux_exercise ON public.copro_fonds_travaux(exercise_id);
CREATE INDEX IF NOT EXISTS idx_copro_fonds_travaux_status ON public.copro_fonds_travaux(site_id, status);

COMMENT ON TABLE public.copro_fonds_travaux IS
'Fonds travaux obligatoire loi ALUR 2014 (article 58). Cotisation minimale 5% du budget. Obligatoire pour copropriétés >5 ans depuis 01/01/2017.';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.syndic_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copro_councils ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copro_fonds_travaux ENABLE ROW LEVEL SECURITY;

-- ===== syndic_mandates =====
DROP POLICY IF EXISTS "syndic_mandates_syndic_all" ON public.syndic_mandates;
CREATE POLICY "syndic_mandates_syndic_all" ON public.syndic_mandates
  FOR ALL TO authenticated
  USING (
    syndic_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR site_id IN (
      SELECT id FROM public.sites
      WHERE syndic_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin'))
  )
  WITH CHECK (
    syndic_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR site_id IN (
      SELECT id FROM public.sites
      WHERE syndic_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin'))
  );

DROP POLICY IF EXISTS "syndic_mandates_coproprietaire_select" ON public.syndic_mandates;
CREATE POLICY "syndic_mandates_coproprietaire_select" ON public.syndic_mandates
  FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT site_id FROM public.user_site_roles WHERE user_id = auth.uid()
    )
  );

-- ===== copro_councils =====
DROP POLICY IF EXISTS "copro_councils_syndic_all" ON public.copro_councils;
CREATE POLICY "copro_councils_syndic_all" ON public.copro_councils
  FOR ALL TO authenticated
  USING (
    site_id IN (
      SELECT id FROM public.sites
      WHERE syndic_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin'))
  )
  WITH CHECK (
    site_id IN (
      SELECT id FROM public.sites
      WHERE syndic_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin'))
  );

DROP POLICY IF EXISTS "copro_councils_member_select" ON public.copro_councils;
CREATE POLICY "copro_councils_member_select" ON public.copro_councils
  FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT site_id FROM public.user_site_roles WHERE user_id = auth.uid()
    )
    OR president_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR vice_president_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- ===== copro_fonds_travaux =====
DROP POLICY IF EXISTS "copro_fonds_travaux_syndic_all" ON public.copro_fonds_travaux;
CREATE POLICY "copro_fonds_travaux_syndic_all" ON public.copro_fonds_travaux
  FOR ALL TO authenticated
  USING (
    site_id IN (
      SELECT id FROM public.sites
      WHERE syndic_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin'))
  )
  WITH CHECK (
    site_id IN (
      SELECT id FROM public.sites
      WHERE syndic_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin'))
  );

DROP POLICY IF EXISTS "copro_fonds_travaux_coproprietaire_select" ON public.copro_fonds_travaux;
CREATE POLICY "copro_fonds_travaux_coproprietaire_select" ON public.copro_fonds_travaux
  FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT site_id FROM public.user_site_roles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_syndic_mandates_updated_at ON public.syndic_mandates;
CREATE TRIGGER update_syndic_mandates_updated_at
  BEFORE UPDATE ON public.syndic_mandates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_copro_councils_updated_at ON public.copro_councils;
CREATE TRIGGER update_copro_councils_updated_at
  BEFORE UPDATE ON public.copro_councils
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_copro_fonds_travaux_updated_at ON public.copro_fonds_travaux;
CREATE TRIGGER update_copro_fonds_travaux_updated_at
  BEFORE UPDATE ON public.copro_fonds_travaux
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- GRANTS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syndic_mandates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copro_councils TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copro_fonds_travaux TO authenticated;
