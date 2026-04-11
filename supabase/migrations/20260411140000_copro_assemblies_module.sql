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
