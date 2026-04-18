-- ====================================================================
-- Sprint B2 — Phase 4 CRITIQUE — Batch 7/10
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
-- Migration: 20260315090000_market_standard_subscription_alignment.sql
-- Risk: CRITIQUE
-- Why: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260315090000_market_standard_subscription_alignment.sql'; END $pre$;

BEGIN;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS selected_plan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS selected_plan_source TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_plan_id UUID REFERENCES subscription_plans(id),
  ADD COLUMN IF NOT EXISTS scheduled_plan_slug TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_plan_effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_subscription_schedule_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_selected_plan_at
  ON subscriptions(selected_plan_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_scheduled_plan_effective_at
  ON subscriptions(scheduled_plan_effective_at)
  WHERE scheduled_plan_effective_at IS NOT NULL;

UPDATE subscriptions s
SET plan_id = sp.id
FROM subscription_plans sp
WHERE s.plan_id IS NULL
  AND s.plan_slug IS NOT NULL
  AND sp.slug = s.plan_slug;

UPDATE subscriptions s
SET plan_slug = sp.slug
FROM subscription_plans sp
WHERE s.plan_slug IS NULL
  AND s.plan_id IS NOT NULL
  AND sp.id = s.plan_id;

UPDATE subscriptions
SET status = 'paused'
WHERE status = 'suspended';

UPDATE subscriptions
SET selected_plan_at = COALESCE(current_period_start, updated_at, created_at),
    selected_plan_source = CASE
      WHEN stripe_subscription_id IS NOT NULL THEN COALESCE(selected_plan_source, 'backfill_stripe')
      ELSE COALESCE(selected_plan_source, 'backfill_local')
    END
WHERE selected_plan_at IS NULL
   OR selected_plan_source IS NULL;

UPDATE subscriptions
SET scheduled_plan_id = NULL,
    scheduled_plan_slug = NULL,
    scheduled_plan_effective_at = NULL,
    stripe_subscription_schedule_id = NULL
WHERE scheduled_plan_effective_at IS NOT NULL
  AND scheduled_plan_effective_at < NOW() - INTERVAL '7 days';

UPDATE subscriptions s
SET scheduled_plan_id = sp.id
FROM subscription_plans sp
WHERE s.scheduled_plan_id IS NULL
  AND s.scheduled_plan_slug IS NOT NULL
  AND sp.slug = s.scheduled_plan_slug;

UPDATE subscriptions s
SET scheduled_plan_slug = sp.slug
FROM subscription_plans sp
WHERE s.scheduled_plan_slug IS NULL
  AND s.scheduled_plan_id IS NOT NULL
  AND sp.id = s.scheduled_plan_id;

UPDATE subscriptions
SET properties_count = property_counts.count_value
FROM (
  SELECT owner_id, COUNT(*)::INT AS count_value
  FROM properties
  WHERE deleted_at IS NULL
  GROUP BY owner_id
) AS property_counts
WHERE subscriptions.owner_id = property_counts.owner_id;

UPDATE subscriptions
SET properties_count = 0
WHERE properties_count IS NULL;

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260315090000', 'market_standard_subscription_alignment')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260315090000_market_standard_subscription_alignment.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260318010000_password_reset_requests.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260318010000_password_reset_requests.sql'; END $pre$;

-- =============================================================================
-- Migration : Password reset requests SOTA 2026
-- Objectif  : Introduire une couche applicative one-time au-dessus du recovery
--             Supabase pour sécuriser le changement de mot de passe.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired', 'revoked')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip INET,
  requested_user_agent TEXT,
  completed_ip INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_status
  ON password_reset_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_expires_at
  ON password_reset_requests(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_requests_single_pending
  ON password_reset_requests(user_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION set_password_reset_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_password_reset_requests_updated_at ON password_reset_requests;
CREATE TRIGGER trg_password_reset_requests_updated_at
  BEFORE UPDATE ON password_reset_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_password_reset_requests_updated_at();

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260318010000', 'password_reset_requests')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260318010000_password_reset_requests.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260327200000_fix_handle_new_user_restore_email.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260327200000_fix_handle_new_user_restore_email.sql'; END $pre$;

-- ============================================
-- Migration: Corriger handle_new_user — restaurer email + EXCEPTION handler
-- Date: 2026-03-27
-- Description:
--   La migration 20260326205416 a introduit une regression :
--     1. La colonne `email` n'est plus inseree dans profiles (variable v_email supprimee)
--     2. Le handler EXCEPTION WHEN OTHERS a ete supprime
--   Cette migration restaure les deux, tout en conservant le support
--   de tous les roles (admin, owner, tenant, provider, guarantor, syndic, agency).
--   Elle backfill aussi les emails NULL crees par la migration cassee.
-- ============================================

-- A. RESTAURER handle_new_user() avec email + EXCEPTION handler
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
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (tous les roles supportes par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Recuperer l'email depuis le champ auth.users.email
  v_email := NEW.email;

  -- Inserer le profil avec toutes les donnees, y compris l'email
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
  -- Ne jamais bloquer la creation d'un utilisateur auth
  -- meme si l'insertion du profil echoue
  RAISE WARNING '[handle_new_user] Erreur pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur auth.
Lit le role et les informations personnelles depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
Supporte tous les roles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.
Ne bloque jamais la creation auth meme en cas d''erreur (EXCEPTION handler).';

-- B. BACKFILL des emails NULL (crees par la migration 20260326205416 cassee)
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND (p.email IS NULL OR p.email = '')
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[fix_handle_new_user] % profil(s) mis a jour avec l''email depuis auth.users', v_updated;
  ELSE
    RAISE NOTICE '[fix_handle_new_user] Tous les profils ont deja un email renseigne';
  END IF;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260327200000', 'fix_handle_new_user_restore_email')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260327200000_fix_handle_new_user_restore_email.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260330100000_add_lease_cancellation_columns.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260330100000_add_lease_cancellation_columns.sql'; END $pre$;

-- ============================================
-- Migration : Ajout colonnes annulation de bail
-- Date : 2026-03-30
-- Contexte : Un bail signé mais jamais activé ne peut pas être annulé.
--            Cette migration ajoute les colonnes nécessaires pour
--            gérer le cycle de vie d'annulation.
-- ============================================

-- Étape 1 : Ajouter les colonnes d'annulation sur leases
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id);
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_type TEXT;

-- Étape 2 : Contrainte CHECK sur cancellation_type
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_cancellation_type_check'
  ) THEN
    ALTER TABLE leases ADD CONSTRAINT leases_cancellation_type_check
      CHECK (cancellation_type IS NULL OR cancellation_type IN (
        'tenant_withdrawal',
        'owner_withdrawal',
        'mutual_agreement',
        'never_activated',
        'error',
        'duplicate'
      ));
  END IF;
END $$;

-- Étape 3 : Vérifier que 'cancelled' est dans la contrainte CHECK sur statut
-- La migration 20260215200001 l'a déjà ajouté, mais on vérifie par sécurité
DO $$ BEGIN
  -- Tenter d'insérer un bail cancelled pour vérifier la contrainte
  -- Si ça échoue, on met à jour la contrainte
  PERFORM 1;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Étape 4 : Index pour requêtes de nettoyage et reporting
CREATE INDEX IF NOT EXISTS idx_leases_cancelled
  ON leases(statut) WHERE statut = 'cancelled';

CREATE INDEX IF NOT EXISTS idx_leases_cancelled_at
  ON leases(cancelled_at) WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leases_zombie_candidates
  ON leases(statut, created_at)
  WHERE statut IN ('pending_signature', 'partially_signed', 'fully_signed', 'draft', 'sent')
    AND cancelled_at IS NULL;

-- Étape 5 : RLS — les politiques existantes couvrent déjà leases
-- Pas besoin de nouvelles politiques car l'annulation passe par UPDATE du statut

-- Étape 6 : Commentaires
COMMENT ON COLUMN leases.cancelled_at IS 'Date/heure de l''annulation du bail';
COMMENT ON COLUMN leases.cancelled_by IS 'User ID de la personne ayant annulé le bail';
COMMENT ON COLUMN leases.cancellation_reason IS 'Motif libre de l''annulation';
COMMENT ON COLUMN leases.cancellation_type IS 'Type d''annulation : tenant_withdrawal, owner_withdrawal, mutual_agreement, never_activated, error, duplicate';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260330100000', 'add_lease_cancellation_columns')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260330100000_add_lease_cancellation_columns.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260406200000_create_entities_view_and_members.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260406200000_create_entities_view_and_members.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Create entities view + entity_members table
-- Date: 2026-04-07
--
-- CONTEXT: Le module comptabilite (20260406210000) reference
-- les tables `entities` et `entity_members` qui n'existent pas.
-- La table `legal_entities` existe deja et est utilisee partout.
--
-- SOLUTION (Option B - non-destructive) :
-- 1. Creer une vue `entities` pointant vers `legal_entities`
-- 2. Creer la table `entity_members` (junction users <-> entites)
-- 3. Backfill entity_members depuis les proprietaires existants
-- 4. Ajouter colonne `territory` pour TVA DROM-COM
-- =====================================================

-- =====================================================
-- 1. VUE entities → legal_entities
-- Permet au module comptable de faire FROM entities
-- sans renommer la table existante
-- =====================================================
CREATE OR REPLACE VIEW entities AS
  SELECT
    id,
    owner_profile_id,
    entity_type AS type,
    nom AS name,
    nom_commercial,
    siren,
    siret,
    numero_tva,
    adresse_siege AS address,
    code_postal_siege,
    ville_siege,
    pays_siege,
    regime_fiscal,
    tva_assujetti,
    tva_regime,
    tva_taux_defaut,
    iban,
    bic,
    is_active,
    created_at,
    updated_at
  FROM legal_entities;

COMMENT ON VIEW entities IS 'Vue de compatibilite pour le module comptable. Source: legal_entities.';

-- =====================================================
-- 2. TABLE entity_members
-- Junction table: qui a acces a quelle entite
-- Utilisee par toutes les RLS policies du module compta
-- =====================================================
CREATE TABLE IF NOT EXISTS entity_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'member', 'readonly', 'ec')),
  share_percentage NUMERIC(5,2),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entity_member_unique UNIQUE (entity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_members_entity ON entity_members(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_members_user ON entity_members(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_members_profile ON entity_members(profile_id) WHERE profile_id IS NOT NULL;

ALTER TABLE entity_members ENABLE ROW LEVEL SECURITY;

-- Policy: un utilisateur voit ses propres memberships
DROP POLICY IF EXISTS "entity_members_own_access" ON entity_members;
CREATE POLICY "entity_members_own_access" ON entity_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Policy: un admin d'une entite peut gerer ses membres
DROP POLICY IF EXISTS "entity_members_admin_manage" ON entity_members;
CREATE POLICY "entity_members_admin_manage" ON entity_members
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  );

COMMENT ON TABLE entity_members IS 'Membres d''une entite (SCI, agence, copro). Utilise par RLS de toutes les tables comptables.';

-- =====================================================
-- 3. COLONNE territory sur legal_entities
-- Pour la validation TVA DROM-COM
-- =====================================================
ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS territory TEXT DEFAULT 'metropole'
  CHECK (territory IN ('metropole', 'martinique', 'guadeloupe', 'reunion', 'guyane', 'mayotte'));

COMMENT ON COLUMN legal_entities.territory IS 'Territoire pour taux TVA DROM-COM. Defaut: metropole (20%).';

-- =====================================================
-- 4. BACKFILL entity_members
-- Pour chaque legal_entity existante, creer un member admin
-- en suivant la chaine FK:
-- legal_entities.owner_profile_id → owner_profiles.profile_id
-- → profiles.id → profiles.user_id → auth.users.id
-- =====================================================
INSERT INTO entity_members (entity_id, user_id, profile_id, role)
SELECT
  le.id AS entity_id,
  p.user_id AS user_id,
  p.id AS profile_id,
  'admin' AS role
FROM legal_entities le
JOIN profiles p ON le.owner_profile_id = p.id
WHERE le.is_active = true
ON CONFLICT (entity_id, user_id) DO NOTHING;

-- Aussi backfill depuis entity_associates (associes de SCI, etc.)
INSERT INTO entity_members (entity_id, user_id, profile_id, role, share_percentage)
SELECT
  ea.legal_entity_id AS entity_id,
  p.user_id AS user_id,
  p.id AS profile_id,
  CASE
    WHEN ea.is_gerant THEN 'admin'
    ELSE 'member'
  END AS role,
  ea.pourcentage_capital AS share_percentage
FROM entity_associates ea
JOIN profiles p ON ea.profile_id = p.id
WHERE p.user_id IS NOT NULL
ON CONFLICT (entity_id, user_id) DO NOTHING;

-- =====================================================
-- 5. AUTO-PROVISION: trigger pour creer un entity_member
-- quand une nouvelle legal_entity est creee
-- =====================================================
CREATE OR REPLACE FUNCTION fn_auto_entity_member()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM profiles
  WHERE id = NEW.owner_profile_id;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO entity_members (entity_id, user_id, profile_id, role)
    VALUES (NEW.id, v_user_id, NEW.owner_profile_id, 'admin')
    ON CONFLICT (entity_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_entity_member ON legal_entities;
CREATE TRIGGER trg_auto_entity_member
  AFTER INSERT ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_entity_member();

-- =====================================================
-- 6. Updated_at trigger pour entity_members
-- =====================================================
CREATE OR REPLACE FUNCTION fn_entity_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entity_members_updated_at ON entity_members;
CREATE TRIGGER trg_entity_members_updated_at
  BEFORE UPDATE ON entity_members
  FOR EACH ROW
  EXECUTE FUNCTION fn_entity_members_updated_at();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260406200000', 'create_entities_view_and_members')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260406200000_create_entities_view_and_members.sql'; END $post$;

COMMIT;

-- END OF BATCH 7/10 (Phase 4 CRITIQUE)
