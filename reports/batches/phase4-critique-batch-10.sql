-- ====================================================================
-- Sprint B2 — Phase 4 CRITIQUE — Batch 10/10
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260411140000_copro_assemblies_module.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260411140000_copro_assemblies_module.sql'; END $pre$;

-- ============================================
-- Migration: Module Assemblées Générales de Copropriété
-- Date: 2026-04-11
-- Phase: 2/8 du module syndic
--
-- Crée les 5 tables cœur du processus d'AG :
--   1. copro_assemblies     — Les AG (date, type, statut)
--   2. copro_convocations   — Envois de convocations par copropriétaire
--   3. copro_resolutions    — Résolutions à voter dans une AG
--   4. copro_votes          — Votes par résolution et copropriétaire
--   5. copro_minutes        — PV d'assemblée générés
--
-- Architecture :
--   - FK racine vers sites(id) — cohérent avec copro_units
--   - RLS via user_site_roles (pattern existant)
--   - Triggers updated_at
--   - Indexes sur les foreign keys
-- ============================================

-- ============================================
-- 1. COPRO_ASSEMBLIES — Les assemblées générales
-- ============================================
CREATE TABLE IF NOT EXISTS public.copro_assemblies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,

  -- Type d'assemblée
  assembly_type TEXT NOT NULL CHECK (
    assembly_type IN ('ordinaire', 'extraordinaire', 'concertation', 'consultation_ecrite')
  ),

  -- Identification
  title TEXT NOT NULL,
  reference_number TEXT, -- Numéro interne (ex: AG-2026-001)
  fiscal_year INTEGER, -- Exercice concerné (pour AG ordinaire)

  -- Planification
  scheduled_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  location_address TEXT,
  online_meeting_url TEXT, -- Visio optionnelle
  is_hybrid BOOLEAN NOT NULL DEFAULT false,

  -- Règles de quorum et majorité
  quorum_required INTEGER, -- Tantièmes minimum pour la tenue
  second_convocation_at TIMESTAMPTZ, -- Si pas de quorum
  first_convocation_sent_at TIMESTAMPTZ,
  second_convocation_sent_at TIMESTAMPTZ,

  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'convened', 'in_progress', 'held', 'adjourned', 'cancelled')
  ),

  -- Tenue effective
  held_at TIMESTAMPTZ,
  presided_by UUID REFERENCES public.profiles(id), -- Président de séance
  secretary_profile_id UUID REFERENCES public.profiles(id), -- Secrétaire
  scrutineers JSONB DEFAULT '[]', -- Scrutateurs [{profile_id, unit_id}]
  present_tantiemes INTEGER, -- Total tantièmes présents/représentés
  quorum_reached BOOLEAN,

  -- Métadonnées
  description TEXT,
  notes TEXT,
  meta JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copro_assemblies_site ON public.copro_assemblies(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_assemblies_status ON public.copro_assemblies(site_id, status);
CREATE INDEX IF NOT EXISTS idx_copro_assemblies_scheduled ON public.copro_assemblies(scheduled_at);

COMMENT ON TABLE public.copro_assemblies IS
'Assemblées générales de copropriété (ordinaires, extraordinaires, concertations, consultations écrites)';

-- ============================================
-- 2. COPRO_CONVOCATIONS — Envois de convocations
-- ============================================
CREATE TABLE IF NOT EXISTS public.copro_convocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES public.copro_assemblies(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,

  -- Destinataire (unit + owner)
  unit_id UUID REFERENCES public.copro_units(id) ON DELETE SET NULL,
  recipient_profile_id UUID REFERENCES public.profiles(id),
  recipient_name TEXT NOT NULL,
  recipient_email TEXT,
  recipient_address TEXT,

  -- Mode d'envoi
  delivery_method TEXT NOT NULL CHECK (
    delivery_method IN ('email', 'postal_simple', 'postal_recommande', 'hand_delivered', 'lrar', 'lre_numerique')
  ),

  -- État d'envoi
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'delivered', 'read', 'returned', 'refused', 'failed')
  ),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,

  -- Preuve postale / accusé de réception
  tracking_number TEXT, -- Numéro de suivi LRAR
  accuse_reception_url TEXT, -- Scan AR postal ou LRE
  accuse_reception_at TIMESTAMPTZ,

  -- Convocation PDF
  convocation_document_url TEXT,
  ordre_du_jour_document_url TEXT,

  -- Coût (pour suivi des frais)
  postal_cost_cents INTEGER DEFAULT 0,

  -- Métadonnées
  error_message TEXT, -- Si status = 'failed'
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copro_convocations_assembly ON public.copro_convocations(assembly_id);
CREATE INDEX IF NOT EXISTS idx_copro_convocations_site ON public.copro_convocations(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_convocations_unit ON public.copro_convocations(unit_id);
CREATE INDEX IF NOT EXISTS idx_copro_convocations_status ON public.copro_convocations(assembly_id, status);

COMMENT ON TABLE public.copro_convocations IS
'Envois de convocations aux copropriétaires pour une assemblée générale. Traçabilité légale (LRAR, accusé de réception).';

-- ============================================
-- 3. COPRO_RESOLUTIONS — Résolutions à voter
-- ============================================
CREATE TABLE IF NOT EXISTS public.copro_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES public.copro_assemblies(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,

  -- Ordre et identification
  resolution_number INTEGER NOT NULL, -- Numéro dans l'ordre du jour
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Catégorie
  category TEXT NOT NULL DEFAULT 'gestion' CHECK (
    category IN (
      'gestion',           -- Gestion courante
      'budget',            -- Vote du budget
      'travaux',           -- Travaux
      'reglement',         -- Modification règlement copropriété
      'honoraires',        -- Honoraires syndic
      'conseil_syndical',  -- Désignation conseil syndical
      'assurance',         -- Contrats d'assurance
      'conflits',          -- Actions en justice
      'autre'
    )
  ),

  -- Règle de majorité (loi du 10 juillet 1965)
  majority_rule TEXT NOT NULL CHECK (
    majority_rule IN (
      'article_24',     -- Majorité simple des présents/représentés
      'article_25',     -- Majorité absolue de tous les copropriétaires
      'article_25_1',   -- Article 25 avec second vote article 24 possible
      'article_26',     -- Double majorité (2/3 copropriétaires + 2/3 tantièmes)
      'article_26_1',   -- Article 26 avec passerelle article 25
      'unanimite'       -- Unanimité
    )
  ),

  -- Montant estimé (pour travaux, budgets)
  estimated_amount_cents INTEGER,
  contract_partner TEXT, -- Entreprise concernée (pour travaux)

  -- Résultat du vote
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (
    status IN ('proposed', 'voted_for', 'voted_against', 'abstained', 'adjourned', 'withdrawn')
  ),
  votes_for_count INTEGER DEFAULT 0,
  votes_against_count INTEGER DEFAULT 0,
  votes_abstain_count INTEGER DEFAULT 0,
  tantiemes_for INTEGER DEFAULT 0,
  tantiemes_against INTEGER DEFAULT 0,
  tantiemes_abstain INTEGER DEFAULT 0,
  second_vote_applied BOOLEAN DEFAULT false, -- Si article 25-1 déclenché

  -- Documents associés (devis, plans, etc.)
  attached_documents JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT copro_resolutions_number_unique UNIQUE (assembly_id, resolution_number)
);

CREATE INDEX IF NOT EXISTS idx_copro_resolutions_assembly ON public.copro_resolutions(assembly_id);
CREATE INDEX IF NOT EXISTS idx_copro_resolutions_site ON public.copro_resolutions(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_resolutions_status ON public.copro_resolutions(assembly_id, status);

COMMENT ON TABLE public.copro_resolutions IS
'Résolutions votées en assemblée générale. Règles de majorité loi du 10 juillet 1965.';

-- ============================================
-- 4. COPRO_VOTES — Votes individuels par résolution
-- ============================================
CREATE TABLE IF NOT EXISTS public.copro_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id UUID NOT NULL REFERENCES public.copro_resolutions(id) ON DELETE CASCADE,
  assembly_id UUID NOT NULL REFERENCES public.copro_assemblies(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,

  -- Votant (copropriétaire)
  unit_id UUID REFERENCES public.copro_units(id) ON DELETE SET NULL,
  voter_profile_id UUID REFERENCES public.profiles(id),
  voter_name TEXT NOT NULL,

  -- Tantièmes au moment du vote (snapshot pour audit)
  voter_tantiemes INTEGER NOT NULL DEFAULT 0,

  -- Vote
  vote TEXT NOT NULL CHECK (vote IN ('for', 'against', 'abstain')),

  -- Pouvoir / procuration
  is_proxy BOOLEAN NOT NULL DEFAULT false,
  proxy_holder_profile_id UUID REFERENCES public.profiles(id), -- Mandataire
  proxy_holder_name TEXT,
  proxy_document_url TEXT, -- Document de pouvoir signé
  proxy_scope TEXT CHECK (proxy_scope IN ('general', 'specific', 'limited')),

  -- Modalité de vote
  vote_method TEXT NOT NULL DEFAULT 'in_person' CHECK (
    vote_method IN ('in_person', 'proxy', 'mail_vote', 'online_vote', 'hand_vote')
  ),
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Traçabilité
  vote_ip_address INET,
  vote_user_agent TEXT,

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copro_votes_resolution ON public.copro_votes(resolution_id);
CREATE INDEX IF NOT EXISTS idx_copro_votes_assembly ON public.copro_votes(assembly_id);
CREATE INDEX IF NOT EXISTS idx_copro_votes_unit ON public.copro_votes(unit_id);
CREATE INDEX IF NOT EXISTS idx_copro_votes_voter ON public.copro_votes(voter_profile_id);

-- Un copropriétaire ne peut voter qu'une fois par résolution
CREATE UNIQUE INDEX IF NOT EXISTS uniq_copro_vote_per_unit_resolution
  ON public.copro_votes(resolution_id, unit_id)
  WHERE unit_id IS NOT NULL;

COMMENT ON TABLE public.copro_votes IS
'Votes individuels des copropriétaires sur chaque résolution. Supporte pouvoirs, vote par correspondance, vote en ligne.';

-- ============================================
-- 5. COPRO_MINUTES — Procès-verbaux
-- ============================================
CREATE TABLE IF NOT EXISTS public.copro_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES public.copro_assemblies(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,

  -- Contenu
  version INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL DEFAULT '{}', -- Structure {preamble, attendees, resolutions[], decisions, closing}
  content_html TEXT, -- Version rendue pour affichage
  document_url TEXT, -- PDF du PV signé

  -- État
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'reviewed', 'signed', 'distributed', 'archived')
  ),

  -- Signatures
  signed_by_president_at TIMESTAMPTZ,
  signed_by_president_profile_id UUID REFERENCES public.profiles(id),
  signed_by_secretary_at TIMESTAMPTZ,
  signed_by_secretary_profile_id UUID REFERENCES public.profiles(id),
  scrutineers_signatures JSONB DEFAULT '[]', -- [{profile_id, signed_at, signature_url}]

  -- Distribution
  distributed_at TIMESTAMPTZ,
  distribution_method TEXT CHECK (distribution_method IN ('email', 'postal', 'hand_delivered', 'portal')),

  -- Délai de contestation (2 mois légaux)
  contestation_deadline TIMESTAMPTZ,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT copro_minutes_version_unique UNIQUE (assembly_id, version)
);

CREATE INDEX IF NOT EXISTS idx_copro_minutes_assembly ON public.copro_minutes(assembly_id);
CREATE INDEX IF NOT EXISTS idx_copro_minutes_site ON public.copro_minutes(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_minutes_status ON public.copro_minutes(site_id, status);

COMMENT ON TABLE public.copro_minutes IS
'Procès-verbaux d''assemblées générales de copropriété. Versionning + signatures + délai de contestation légal (2 mois).';

-- ============================================
-- ROW LEVEL SECURITY — Pattern via user_site_roles
-- ============================================

ALTER TABLE public.copro_assemblies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copro_convocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copro_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copro_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copro_minutes ENABLE ROW LEVEL SECURITY;

-- Helper : le syndic d'un site a accès total
-- Helper : les copropriétaires voient en lecture seule
-- Helper : les admins voient tout

-- ===== copro_assemblies =====
DROP POLICY IF EXISTS "copro_assemblies_syndic_all" ON public.copro_assemblies;
CREATE POLICY "copro_assemblies_syndic_all" ON public.copro_assemblies
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

DROP POLICY IF EXISTS "copro_assemblies_coproprietaire_select" ON public.copro_assemblies;
CREATE POLICY "copro_assemblies_coproprietaire_select" ON public.copro_assemblies
  FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT site_id FROM public.user_site_roles
      WHERE user_id = auth.uid()
    )
  );

-- ===== copro_convocations =====
DROP POLICY IF EXISTS "copro_convocations_syndic_all" ON public.copro_convocations;
CREATE POLICY "copro_convocations_syndic_all" ON public.copro_convocations
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

DROP POLICY IF EXISTS "copro_convocations_recipient_select" ON public.copro_convocations;
CREATE POLICY "copro_convocations_recipient_select" ON public.copro_convocations
  FOR SELECT TO authenticated
  USING (
    recipient_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR site_id IN (
      SELECT site_id FROM public.user_site_roles WHERE user_id = auth.uid()
    )
  );

-- ===== copro_resolutions =====
DROP POLICY IF EXISTS "copro_resolutions_syndic_all" ON public.copro_resolutions;
CREATE POLICY "copro_resolutions_syndic_all" ON public.copro_resolutions
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

DROP POLICY IF EXISTS "copro_resolutions_coproprietaire_select" ON public.copro_resolutions;
CREATE POLICY "copro_resolutions_coproprietaire_select" ON public.copro_resolutions
  FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT site_id FROM public.user_site_roles WHERE user_id = auth.uid()
    )
  );

-- ===== copro_votes =====
DROP POLICY IF EXISTS "copro_votes_syndic_all" ON public.copro_votes;
CREATE POLICY "copro_votes_syndic_all" ON public.copro_votes
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

DROP POLICY IF EXISTS "copro_votes_voter_own" ON public.copro_votes;
CREATE POLICY "copro_votes_voter_own" ON public.copro_votes
  FOR SELECT TO authenticated
  USING (
    voter_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- ===== copro_minutes =====
DROP POLICY IF EXISTS "copro_minutes_syndic_all" ON public.copro_minutes;
CREATE POLICY "copro_minutes_syndic_all" ON public.copro_minutes
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

DROP POLICY IF EXISTS "copro_minutes_coproprietaire_select" ON public.copro_minutes;
CREATE POLICY "copro_minutes_coproprietaire_select" ON public.copro_minutes
  FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT site_id FROM public.user_site_roles WHERE user_id = auth.uid()
    )
    AND status IN ('signed', 'distributed', 'archived')
  );

-- ============================================
-- TRIGGERS updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_copro_assemblies_updated_at ON public.copro_assemblies;
CREATE TRIGGER update_copro_assemblies_updated_at
  BEFORE UPDATE ON public.copro_assemblies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_copro_convocations_updated_at ON public.copro_convocations;
CREATE TRIGGER update_copro_convocations_updated_at
  BEFORE UPDATE ON public.copro_convocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_copro_resolutions_updated_at ON public.copro_resolutions;
CREATE TRIGGER update_copro_resolutions_updated_at
  BEFORE UPDATE ON public.copro_resolutions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_copro_minutes_updated_at ON public.copro_minutes;
CREATE TRIGGER update_copro_minutes_updated_at
  BEFORE UPDATE ON public.copro_minutes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- GRANTS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copro_assemblies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copro_convocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copro_resolutions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copro_votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copro_minutes TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260411140000', 'copro_assemblies_module')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260411140000_copro_assemblies_module.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260411140100_copro_governance_module.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260411140100_copro_governance_module.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260411140100', 'copro_governance_module')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260411140100_copro_governance_module.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260412100000_stripe_connect_multi_entity.sql
-- Risk: CRITIQUE
-- Why: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260412100000_stripe_connect_multi_entity.sql'; END $pre$;

-- =====================================================
-- Migration: Stripe Connect — support multi-entité (copropriétés)
-- Date: 2026-04-12
-- Sprint: S2-2 — claude/talok-account-audit-78zaW
--
-- Contexte :
--   La table stripe_connect_accounts a actuellement une contrainte
--   UNIQUE(profile_id), ce qui limite un utilisateur à un seul compte
--   Stripe Connect. Or un syndic professionnel qui gère plusieurs
--   copropriétés est légalement tenu d'avoir un compte bancaire séparé
--   par copropriété (obligation de séparation des comptes — art. 18
--   loi n° 65-557 du 10 juillet 1965).
--
--   Cette migration ajoute le support d'un compte Connect par entité
--   juridique (legal_entity = copropriété, SCI, agence...) tout en
--   préservant la backward compatibility : les comptes existants,
--   tous rattachés à un profile_id avec entity_id=NULL, continuent
--   de fonctionner sans modification de code.
--
-- Changements :
--   1. Ajout colonne entity_id nullable (FK legal_entities)
--   2. Drop UNIQUE(profile_id)
--   3. Nouvelle contrainte UNIQUE (profile_id, entity_id) NULLS NOT DISTINCT
--      → empêche deux comptes pour le même couple
--   4. CHECK au moins un des deux remplis
--   5. Policy RLS supplémentaire pour permettre l'accès via entity_members
--   6. Index par entity_id
--
-- Backward compatibility :
--   - Tous les comptes existants ont entity_id=NULL
--   - Le code existant fait `WHERE profile_id = X` → match uniquement
--     les comptes personnels (entity_id IS NULL)
--   - Les nouveaux comptes scopés par entité requièrent explicitement
--     `WHERE entity_id = X` (ou `WHERE profile_id = X AND entity_id = Y`)
-- =====================================================

BEGIN;

-- ============================================
-- 1. Ajouter la colonne entity_id
-- ============================================
ALTER TABLE public.stripe_connect_accounts
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.stripe_connect_accounts.entity_id IS
  'Identifiant de l''entité juridique (legal_entity) rattachée à ce compte Connect.
   NULL = compte personnel du propriétaire (cas historique + owners particuliers).
   Valeur renseignée = compte scopé à une copropriété/SCI/agence spécifique
   (obligation de séparation des comptes pour les syndics professionnels).';

-- ============================================
-- 2. Drop l'ancienne contrainte UNIQUE(profile_id)
-- ============================================
ALTER TABLE public.stripe_connect_accounts
  DROP CONSTRAINT IF EXISTS unique_profile_connect;

-- ============================================
-- 3. Nouvelle contrainte UNIQUE (profile_id, entity_id)
-- ============================================
-- `NULLS NOT DISTINCT` traite (profile_id=X, entity_id=NULL) comme un
-- tuple identifiable pour le contrôle d'unicité. Sans cette option, deux
-- comptes avec même profile_id et entity_id=NULL passeraient (car NULL
-- est toujours distinct de NULL en SQL standard).
-- Supporté depuis PostgreSQL 15 — fallback via trigger si version < 15.
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.stripe_connect_accounts
      ADD CONSTRAINT stripe_connect_unique_profile_or_entity
      UNIQUE NULLS NOT DISTINCT (profile_id, entity_id);
  EXCEPTION
    WHEN syntax_error THEN
      -- PostgreSQL < 15 : fallback via index unique partiel.
      CREATE UNIQUE INDEX IF NOT EXISTS stripe_connect_unique_profile_personal
        ON public.stripe_connect_accounts (profile_id)
        WHERE entity_id IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS stripe_connect_unique_profile_entity
        ON public.stripe_connect_accounts (profile_id, entity_id)
        WHERE entity_id IS NOT NULL;
    -- patch sprint-b2: catch already-exists case (re-run idempotency)
    WHEN duplicate_object OR duplicate_table THEN NULL;
  END;
END $$;

-- ============================================
-- 4. CHECK : au moins un des deux doit être rempli
-- ============================================
-- profile_id reste NOT NULL historiquement (défini à la migration
-- 20260127010000). Cette contrainte documente l'invariant même si
-- techniquement non nécessaire tant que profile_id est NOT NULL.
DO $$
BEGIN
  ALTER TABLE public.stripe_connect_accounts
    ADD CONSTRAINT stripe_connect_has_owner
    CHECK (profile_id IS NOT NULL OR entity_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================
-- 5. Index par entity_id (pour les requêtes syndic multi-copro)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_stripe_connect_entity_id
  ON public.stripe_connect_accounts(entity_id)
  WHERE entity_id IS NOT NULL;

-- ============================================
-- 6. RLS — accès via entity_members
-- ============================================
-- Permet à un syndic (ou tout membre d'une entité) de voir et gérer les
-- comptes Connect des entités dont il fait partie. Les comptes personnels
-- (entity_id IS NULL) restent filtrés par profile_id comme avant.

DROP POLICY IF EXISTS "stripe_connect_entity_access" ON public.stripe_connect_accounts;
CREATE POLICY "stripe_connect_entity_access"
  ON public.stripe_connect_accounts
  FOR SELECT TO authenticated
  USING (
    -- Compte personnel : même profil
    (
      entity_id IS NULL
      AND profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR
    -- Compte scopé à une entité : l'utilisateur est membre de l'entité
    (
      entity_id IS NOT NULL
      AND entity_id IN (
        SELECT em.entity_id
        FROM public.entity_members em
        WHERE em.user_id = auth.uid()
      )
    )
    OR
    -- Admin : accès total (existante, re-exprimée ici pour clarté)
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- Policy INSERT : un utilisateur peut créer un compte pour son profil
-- ou pour une entité dont il est membre
DROP POLICY IF EXISTS "stripe_connect_entity_insert" ON public.stripe_connect_accounts;
CREATE POLICY "stripe_connect_entity_insert"
  ON public.stripe_connect_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      entity_id IS NULL
      AND profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR
    (
      entity_id IS NOT NULL
      AND entity_id IN (
        SELECT em.entity_id
        FROM public.entity_members em
        WHERE em.user_id = auth.uid()
      )
    )
  );

-- Policy UPDATE : idem SELECT (pour rafraîchir les infos Stripe)
DROP POLICY IF EXISTS "stripe_connect_entity_update" ON public.stripe_connect_accounts;
CREATE POLICY "stripe_connect_entity_update"
  ON public.stripe_connect_accounts
  FOR UPDATE TO authenticated
  USING (
    (
      entity_id IS NULL
      AND profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR
    (
      entity_id IS NOT NULL
      AND entity_id IN (
        SELECT em.entity_id
        FROM public.entity_members em
        WHERE em.user_id = auth.uid()
      )
    )
  );

-- ============================================
-- 7. Fonction helper : récupérer le compte Connect pour un profil + entité
-- ============================================
-- Sémantique :
--   - Si p_entity_id est fourni : cherche un compte scopé à cette entité
--   - Sinon : cherche le compte personnel (entity_id IS NULL)
CREATE OR REPLACE FUNCTION public.get_connect_account_for_scope(
  p_profile_id UUID,
  p_entity_id UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  stripe_account_id TEXT,
  charges_enabled BOOLEAN,
  payouts_enabled BOOLEAN,
  entity_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_entity_id IS NULL THEN
    RETURN QUERY
    SELECT
      sca.id,
      sca.stripe_account_id,
      sca.charges_enabled,
      sca.payouts_enabled,
      sca.entity_id
    FROM public.stripe_connect_accounts sca
    WHERE sca.profile_id = p_profile_id
      AND sca.entity_id IS NULL
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT
      sca.id,
      sca.stripe_account_id,
      sca.charges_enabled,
      sca.payouts_enabled,
      sca.entity_id
    FROM public.stripe_connect_accounts sca
    WHERE sca.entity_id = p_entity_id
    LIMIT 1;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_connect_account_for_scope(UUID, UUID) IS
  'Récupère le compte Stripe Connect pour un périmètre donné.
   Si entity_id NULL → compte personnel du profil (cas historique).
   Si entity_id renseigné → compte scopé à cette entité juridique.
   Retourne 0 ou 1 ligne (les contraintes UNIQUE garantissent l''unicité).';

-- ============================================
-- 8. Schema cache reload
-- ============================================
NOTIFY pgrst, 'reload schema';

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260412100000', 'stripe_connect_multi_entity')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260412100000_stripe_connect_multi_entity.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260412140000_close_admin_self_elevation.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260412140000_close_admin_self_elevation.sql'; END $pre$;

-- ============================================
-- Migration: Fermer la faille admin self-elevation dans handle_new_user
-- Date: 2026-04-12
-- Sprint: Bugs audit comptes — Bug #2
--
-- Contexte:
--   La fonction handle_new_user() (trigger ON INSERT sur auth.users)
--   lit le rôle depuis raw_user_meta_data et l'insère dans profiles.
--   La whitelist incluait 'admin' et 'platform_admin', ce qui permet
--   à n'importe quel client Supabase anonyme de faire :
--
--     supabase.auth.signUp({
--       email, password,
--       options: { data: { role: 'admin' } }
--     })
--
--   et d'obtenir un profil avec role='admin' en DB.
--
--   L'API /api/v1/auth/register bloque déjà via RegisterSchema.role
--   (enum 6 rôles publics), mais un appel direct à supabase.auth.signUp()
--   côté client bypass cette validation.
--
-- Fix:
--   Exclure 'admin' et 'platform_admin' de la whitelist du trigger.
--   Si raw_user_meta_data.role = 'admin' → fallback 'tenant'.
--   Les admins sont créés UNIQUEMENT par :
--     1. scripts/create-admin.ts (service role + UPDATE profiles SET role)
--     2. SQL direct par un DBA
--
-- Impact:
--   - Aucun impact sur les admins existants (le trigger ne s'exécute que
--     sur INSERT dans auth.users, pas sur les profils déjà créés)
--   - Aucun impact sur les 6 rôles publics (owner, tenant, provider,
--     guarantor, syndic, agency)
--   - Aucun impact sur l'API /api/v1/auth/register (déjà sécurisée)
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
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le rôle : seuls les rôles PUBLICS sont acceptés.
  -- 'admin' et 'platform_admin' sont EXCLUS pour empêcher l'auto-élévation
  -- via supabase.auth.signUp({ options: { data: { role: 'admin' } } }).
  -- Les admins sont créés par scripts/create-admin.ts ou SQL direct.
  IF v_role NOT IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Récupérer l'email depuis le champ auth.users.email
  v_email := NEW.email;

  -- Insérer le profil avec toutes les données
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
  -- Ne jamais bloquer la création d'un utilisateur auth
  -- même si l'insertion du profil échoue
  RAISE WARNING '[handle_new_user] Erreur pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'SOTA 2026 — Crée automatiquement un profil lors de la création d''un utilisateur auth.
Lit le rôle, prenom, nom et telephone depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
SÉCURITÉ: seuls les rôles publics (owner, tenant, provider, guarantor, syndic, agency)
sont acceptés. admin et platform_admin sont REFUSÉS pour empêcher l''auto-élévation
de privilèges. Fallback sur tenant si rôle invalide.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.
Ne bloque jamais la création auth même en cas d''erreur (EXCEPTION handler).';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260412140000', 'close_admin_self_elevation')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260412140000_close_admin_self_elevation.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260415000000_signup_integrity_guard.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260415000000_signup_integrity_guard.sql'; END $pre$;

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

DO $$ BEGIN

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

EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;

END $$;

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
DO $$ BEGIN
  ALTER TABLE public.onboarding_analytics
  ADD CONSTRAINT onboarding_analytics_role_check
  CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

ALTER TABLE public.onboarding_reminders
  DROP CONSTRAINT IF EXISTS onboarding_reminders_role_check;
DO $$ BEGIN
  ALTER TABLE public.onboarding_reminders
  ADD CONSTRAINT onboarding_reminders_role_check
  CHECK (role IN ('owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260415000000', 'signup_integrity_guard')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260415000000_signup_integrity_guard.sql'; END $post$;

COMMIT;

-- END OF BATCH 10/10 (Phase 4 CRITIQUE)
