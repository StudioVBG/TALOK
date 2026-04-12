-- =====================================================
-- Migration: Documents copropriété — FK copro_site_id + RLS
-- Date: 2026-04-12
-- Sprint: S2-3 — claude/talok-account-audit-78zaW
--
-- Contexte :
--   La table `documents` sert de GED unifiée (contrats, diagnostics,
--   quittances…) mais n'a aucun lien direct vers un site de copropriété.
--   Pour permettre la GED copro (PV d'AG, convocations, états datés,
--   appels de fonds, contrats syndic…) sans mélanger avec les documents
--   par lease/property/entity, on ajoute une FK nullable `copro_site_id`.
--
--   Nullable = backward compat : les documents existants (contrats de
--   bail, CNI, quittances…) ne sont pas impactés.
--
-- Scope :
--   - NE PAS migrer les documents AG existants qui vivent dans
--     copro_assemblies.document_url et le bucket assembly-documents.
--     C'est un travail de convergence Phase 3, hors scope ici.
--   - Cette migration prépare l'infrastructure uniquement.
-- =====================================================

BEGIN;

-- ============================================
-- 1. Ajouter la colonne copro_site_id (nullable + FK)
-- ============================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS copro_site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.documents.copro_site_id IS
  'Site de copropriété rattaché à ce document (PV d''AG, convocation, état daté, etc.).
   NULL pour les documents non-copro (contrats, CNI, quittances, etc.).';

-- ============================================
-- 2. Index partiel — pour les requêtes GED copro
-- ============================================
-- L'index partiel garde la taille minimale en excluant tous les documents
-- non-copro (la majorité du volume).
CREATE INDEX IF NOT EXISTS idx_documents_copro_site_id
  ON public.documents(copro_site_id)
  WHERE copro_site_id IS NOT NULL;

-- ============================================
-- 3. RLS — syndic peut voir les documents de ses sites
-- ============================================
-- La chaîne d'autorisation :
--   user → profiles → syndic_profiles → sites.syndic_profile_id → documents
DROP POLICY IF EXISTS "documents_syndic_copro_select" ON public.documents;
CREATE POLICY "documents_syndic_copro_select"
  ON public.documents
  FOR SELECT TO authenticated
  USING (
    copro_site_id IS NOT NULL
    AND copro_site_id IN (
      SELECT s.id
      FROM public.sites s
      WHERE s.syndic_profile_id = (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT : un syndic peut déposer un document pour un site qu'il gère
DROP POLICY IF EXISTS "documents_syndic_copro_insert" ON public.documents;
CREATE POLICY "documents_syndic_copro_insert"
  ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    copro_site_id IS NULL -- laisse passer les non-copro inserts (autres policies gèrent)
    OR copro_site_id IN (
      SELECT s.id
      FROM public.sites s
      WHERE s.syndic_profile_id = (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- UPDATE : syndic peut mettre à jour les documents de ses sites
DROP POLICY IF EXISTS "documents_syndic_copro_update" ON public.documents;
CREATE POLICY "documents_syndic_copro_update"
  ON public.documents
  FOR UPDATE TO authenticated
  USING (
    copro_site_id IS NOT NULL
    AND copro_site_id IN (
      SELECT s.id
      FROM public.sites s
      WHERE s.syndic_profile_id = (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================
-- 4. RLS — copropriétaire peut voir les documents de son site
-- ============================================
-- La chaîne d'autorisation :
--   user → user_site_roles (role_code='coproprietaire') → sites → documents
DROP POLICY IF EXISTS "documents_coproprietaire_select" ON public.documents;
CREATE POLICY "documents_coproprietaire_select"
  ON public.documents
  FOR SELECT TO authenticated
  USING (
    copro_site_id IS NOT NULL
    AND copro_site_id IN (
      SELECT usr.site_id
      FROM public.user_site_roles usr
      WHERE usr.user_id = auth.uid()
        AND usr.role_code IN (
          'coproprietaire',
          'coproprietaire_bailleur',
          'conseil_syndical'
        )
    )
  );

-- ============================================
-- 5. Schema cache reload
-- ============================================
NOTIFY pgrst, 'reload schema';

COMMIT;
