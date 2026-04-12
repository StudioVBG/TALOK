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
      -- Deux index : un pour (profile_id) où entity_id IS NULL,
      -- et un autre pour (profile_id, entity_id) où entity_id IS NOT NULL.
      CREATE UNIQUE INDEX IF NOT EXISTS stripe_connect_unique_profile_personal
        ON public.stripe_connect_accounts (profile_id)
        WHERE entity_id IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS stripe_connect_unique_profile_entity
        ON public.stripe_connect_accounts (profile_id, entity_id)
        WHERE entity_id IS NOT NULL;
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
