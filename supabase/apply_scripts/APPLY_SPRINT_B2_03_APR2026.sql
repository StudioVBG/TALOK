-- =============================================================================
-- APPLY SPRINT B2 — BATCH 03_APR2026 (IDEMPOTENT v2)
-- Genere le 2026-04-19T17:33:50Z
--
-- Contenu : 71 migrations (action=apply uniquement)
-- Plage   : 20260401000000 -> 20260417110000
-- Risque  : SAFE=17 / MODERE=26 / DANGEREUX=16 / CRITIQUE=12
--
-- IDEMPOTENCE : chaque CREATE POLICY est precede d'un DROP POLICY IF EXISTS,
-- chaque CREATE TRIGGER est precede d'un DROP TRIGGER IF EXISTS.
-- Les CREATE TABLE/INDEX/FUNCTION utilisent deja IF NOT EXISTS ou OR REPLACE.
-- => Re-executable sans erreur si une migration a deja ete partiellement appliquee.
--
-- INSTRUCTIONS :
-- 1. BACKUP prod obligatoire avant execution (pg_dump + Supabase PITR).
-- 2. Ouvrir Supabase Dashboard > SQL Editor > New Query.
-- 3. Coller ce fichier integralement et cliquer Run.
-- 4. Chaque migration est encapsulee dans son propre BEGIN/COMMIT : rollback cible.
-- 5. Ne PAS appliquer les 28 migrations "rename-then-apply" (branche dedup requise).
--
-- ORDRE : CHRONOLOGIQUE STRICT — ne pas reordonner.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1/71 -- 20260401000000 -- SAFE -- 20260401000000_add_identity_status_onboarding_step.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 1/71 (SAFE) 20260401000000_add_identity_status_onboarding_step.sql'; END $$;
-- Migration: Ajout identity_status et onboarding_step sur profiles
-- Ces colonnes alimentent le middleware identity-gate qui contrôle
-- l'accès aux routes protégées selon le niveau de vérification.

-- Enum pour le statut d'identité
DO $$ BEGIN
  CREATE TYPE identity_status_enum AS ENUM (
    'unverified',
    'phone_verified',
    'document_uploaded',
    'identity_review',
    'identity_verified',
    'identity_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum pour l'étape d'onboarding
DO $$ BEGIN
  CREATE TYPE onboarding_step_enum AS ENUM (
    'account_created',
    'phone_pending',
    'phone_done',
    'profile_pending',
    'profile_done',
    'document_pending',
    'document_done',
    'complete'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ajout des colonnes sur profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_status identity_status_enum NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS onboarding_step onboarding_step_enum NOT NULL DEFAULT 'account_created',
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Index pour les requêtes du middleware (lookup par user + status)
CREATE INDEX IF NOT EXISTS idx_profiles_identity_status ON profiles (identity_status);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_step ON profiles (onboarding_step);

COMMENT ON COLUMN profiles.identity_status IS 'Niveau de vérification d''identité — utilisé par le middleware identity-gate';
COMMENT ON COLUMN profiles.onboarding_step IS 'Étape courante du parcours d''onboarding';

COMMIT;

-- -----------------------------------------------------------------------------
-- 2/71 -- 20260401000001 -- MODERE -- 20260401000001_add_initial_payment_confirmed_to_leases.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 2/71 (MODERE) 20260401000001_add_initial_payment_confirmed_to_leases.sql'; END $$;
-- Migration: Ajouter initial_payment_confirmed sur leases
-- Permet au webhook Stripe de marquer le paiement initial comme confirmé
-- et d'éviter la désynchronisation entre l'UI et l'API key-handover.

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS initial_payment_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_payment_date timestamptz,
  ADD COLUMN IF NOT EXISTS initial_payment_stripe_pi text;

-- Rétro-remplissage : marquer comme confirmé les baux dont la facture initiale est soldée
UPDATE leases l
SET initial_payment_confirmed = true,
    initial_payment_date = i.date_paiement
FROM invoices i
WHERE i.lease_id = l.id
  AND i.statut = 'paid'
  AND (
    i.metadata->>'type' = 'initial_invoice'
    OR i.type = 'initial_invoice'
  )
  AND l.initial_payment_confirmed = false;

-- Index partiel pour les requêtes fréquentes sur les baux non confirmés
CREATE INDEX IF NOT EXISTS idx_leases_initial_payment_pending
  ON leases (id)
  WHERE initial_payment_confirmed = false;

COMMIT;

-- -----------------------------------------------------------------------------
-- 3/71 -- 20260404100000 -- MODERE -- 20260404100000_rls_push_subscriptions.sql
-- risk: +1 policies, -1 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 3/71 (MODERE) 20260404100000_rls_push_subscriptions.sql'; END $$;
-- =====================================================
-- MIGRATION: Activer RLS sur push_subscriptions
-- Date: 2026-04-04
--
-- PROBLÈME: L'audit sécurité a révélé que la table push_subscriptions
-- n'a pas de RLS activé. Un utilisateur authentifié pourrait potentiellement
-- lire/modifier les subscriptions push d'autres utilisateurs.
--
-- FIX: Activer RLS + policy user_id = auth.uid()
-- =====================================================

-- Activer RLS (idempotent si déjà activé)
ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions;

-- Policy : chaque utilisateur ne peut accéder qu'à ses propres subscriptions
CREATE POLICY "push_subs_own_access" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "push_subs_own_access" ON push_subscriptions IS
  'Sécurité: un utilisateur ne peut voir/modifier que ses propres abonnements push.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 4/71 -- 20260404100100 -- SAFE -- 20260404100100_fix_tenant_docs_view_visible_tenant.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 4/71 (SAFE) 20260404100100_fix_tenant_docs_view_visible_tenant.sql'; END $$;
-- =====================================================
-- MIGRATION: Ajouter filtre visible_tenant à la vue v_tenant_accessible_documents
-- Date: 2026-04-04
--
-- PROBLÈME: La vue a été créée le 2026-02-23 (migration 20260223000002)
-- AVANT l'ajout de la colonne visible_tenant (migration 20260306000000).
-- Résultat : la vue ne filtre pas visible_tenant, donc un propriétaire
-- qui cache un document au locataire n'est pas respecté via cette vue.
--
-- FIX: Recréer la vue avec le filtre visible_tenant.
-- Logique : le tenant voit le document SI :
--   - visible_tenant = true (le proprio l'a rendu visible) OU
--   - tenant_id = user_profile_id() (c'est un doc uploadé par le tenant lui-même)
-- =====================================================

CREATE OR REPLACE VIEW public.v_tenant_accessible_documents AS
SELECT DISTINCT ON (d.id) d.*
FROM public.documents d
WHERE
  -- Documents directement liés au locataire (uploadés par lui)
  d.tenant_id = public.user_profile_id()
  -- Documents liés aux baux du locataire (visible_tenant requis)
  OR (
    d.visible_tenant = true
    AND d.lease_id IN (
      SELECT ls.lease_id
      FROM public.lease_signers ls
      WHERE ls.profile_id = public.user_profile_id()
    )
  )
  -- Documents partagés de la propriété (diagnostics, EDL, etc.) — visible_tenant requis
  OR (
    d.visible_tenant = true
    AND d.property_id IN (
      SELECT l.property_id
      FROM public.leases l
      JOIN public.lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = public.user_profile_id()
        AND l.property_id IS NOT NULL
    )
    AND d.type IN (
      'diagnostic_performance', 'dpe', 'erp', 'crep', 'amiante',
      'electricite', 'gaz', 'reglement_copro', 'notice_information',
      'EDL_entree', 'EDL_sortie', 'edl', 'edl_entree', 'edl_sortie'
    )
  );

COMMENT ON VIEW public.v_tenant_accessible_documents IS
  'SOTA 2026: Vue unifiée des documents accessibles par le locataire. Filtre visible_tenant=true sauf pour les documents uploadés par le tenant lui-même.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 5/71 -- 20260404100200 -- MODERE -- 20260404100200_fix_ticket_messages_rls_lease_signers.sql
-- risk: +2 policies, -2 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 5/71 (MODERE) 20260404100200_fix_ticket_messages_rls_lease_signers.sql'; END $$;
-- =====================================================
-- MIGRATION: Fix ticket_messages RLS — utiliser lease_signers au lieu de roommates
-- Date: 2026-04-04
--
-- PROBLÈME: La policy SELECT sur ticket_messages vérifie l'accès via
-- la table `roommates` (user_id), mais les locataires sont référencés
-- dans `lease_signers` (profile_id). Si roommates n'est pas peuplée,
-- le locataire n'a pas accès aux messages de ses tickets.
--
-- FIX: Remplacer roommates par lease_signers + user_profile_id()
-- =====================================================

-- SELECT policy
DROP POLICY IF EXISTS "Ticket messages same lease select" ON ticket_messages;

CREATE POLICY "Ticket messages same lease select"
  ON ticket_messages FOR SELECT
  USING (
    (
      -- Créateur du ticket
      ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.created_by_profile_id = public.user_profile_id()
      )
      -- Membre du bail via lease_signers
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls
          WHERE ls.profile_id = public.user_profile_id()
        )
      )
      -- Propriétaire du bien
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = public.user_profile_id()
      )
      -- Admin
      OR public.user_role() = 'admin'
    )
    AND (
      NOT is_internal
      OR public.user_role() IN ('owner', 'admin')
    )
  );

-- INSERT policy
DROP POLICY IF EXISTS "Ticket messages same lease insert" ON ticket_messages;

CREATE POLICY "Ticket messages same lease insert"
  ON ticket_messages FOR INSERT
  WITH CHECK (
    sender_user = auth.uid()
    AND (
      -- Créateur du ticket
      ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.created_by_profile_id = public.user_profile_id()
      )
      -- Membre du bail
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls
          WHERE ls.profile_id = public.user_profile_id()
        )
      )
      -- Propriétaire du bien
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = public.user_profile_id()
      )
      -- Admin
      OR public.user_role() = 'admin'
    )
  );

COMMIT;

-- -----------------------------------------------------------------------------
-- 6/71 -- 20260406200000 -- CRITIQUE -- 20260406200000_create_entities_view_and_members.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 6/71 (CRITIQUE) 20260406200000_create_entities_view_and_members.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 7/71 -- 20260406210000 -- CRITIQUE -- 20260406210000_accounting_complete.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 7/71 (CRITIQUE) 20260406210000_accounting_complete.sql'; END $$;
-- =====================================================
-- MIGRATION: Module Comptabilite complet
-- Date: 2026-04-06
--
-- 15 tables, 16 index, RLS, triggers, fonctions SQL
-- Double-entry accounting, FEC, rapprochement bancaire,
-- plan comptable PCG + copro, amortissements, OCR, audit
-- =====================================================

-- =====================================================
-- 1. ACCOUNTING_EXERCISES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')),
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exercise_dates_valid CHECK (end_date > start_date),
  CONSTRAINT exercise_unique_period UNIQUE (entity_id, start_date, end_date)
);

CREATE INDEX IF NOT EXISTS idx_exercises_entity ON accounting_exercises(entity_id);
CREATE INDEX IF NOT EXISTS idx_exercises_status ON accounting_exercises(entity_id, status);

ALTER TABLE accounting_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exercises_entity_access" ON accounting_exercises;
CREATE POLICY "exercises_entity_access" ON accounting_exercises
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 2. CHART_OF_ACCOUNTS
-- =====================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN (
    'asset', 'liability', 'equity', 'income', 'expense'
  )),
  plan_type TEXT NOT NULL DEFAULT 'pcg' CHECK (plan_type IN ('pcg', 'copro', 'custom')),
  account_class INTEGER GENERATED ALWAYS AS (
    CAST(LEFT(account_number, 1) AS INTEGER)
  ) STORED,
  is_active BOOLEAN NOT NULL DEFAULT true,
  parent_account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_number_entity_unique UNIQUE (entity_id, account_number)
);

CREATE INDEX IF NOT EXISTS idx_coa_entity ON chart_of_accounts(entity_id);
CREATE INDEX IF NOT EXISTS idx_coa_number ON chart_of_accounts(entity_id, account_number);
CREATE INDEX IF NOT EXISTS idx_coa_class ON chart_of_accounts(entity_id, account_class);

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coa_entity_access" ON chart_of_accounts;
CREATE POLICY "coa_entity_access" ON chart_of_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 3. ACCOUNTING_JOURNALS
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code IN ('ACH', 'VE', 'BQ', 'OD', 'AN', 'CL')),
  label TEXT NOT NULL,
  journal_type TEXT NOT NULL CHECK (journal_type IN (
    'purchase', 'sales', 'bank', 'miscellaneous', 'opening', 'closing'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT journal_code_entity_unique UNIQUE (entity_id, code)
);

ALTER TABLE accounting_journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journals_entity_access" ON accounting_journals;
CREATE POLICY "journals_entity_access" ON accounting_journals
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 4. ACCOUNTING_ENTRIES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  journal_code TEXT NOT NULL,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  label TEXT NOT NULL,
  source TEXT,
  reference TEXT,
  is_validated BOOLEAN NOT NULL DEFAULT false,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  reversal_of UUID REFERENCES accounting_entries(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entry_number_unique UNIQUE (entity_id, exercise_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_entries_exercise ON accounting_entries(exercise_id);
CREATE INDEX IF NOT EXISTS idx_entries_journal ON accounting_entries(entity_id, journal_code);
CREATE INDEX IF NOT EXISTS idx_entries_date ON accounting_entries(entity_id, entry_date);

ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entries_entity_access" ON accounting_entries;
CREATE POLICY "entries_entity_access" ON accounting_entries
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. ACCOUNTING_ENTRY_LINES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT,
  debit_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
  credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  lettrage TEXT,
  piece_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_side CHECK (
    (debit_cents > 0 AND credit_cents = 0) OR
    (debit_cents = 0 AND credit_cents > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_entry_lines_entry ON accounting_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_lines_account ON accounting_entry_lines(account_number);
CREATE INDEX IF NOT EXISTS idx_entry_lines_lettrage ON accounting_entry_lines(lettrage) WHERE lettrage IS NOT NULL;

ALTER TABLE accounting_entry_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entry_lines_via_entry" ON accounting_entry_lines;
CREATE POLICY "entry_lines_via_entry" ON accounting_entry_lines
  FOR ALL TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 6. BANK_CONNECTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('nordigen', 'bridge', 'manual')),
  provider_connection_id TEXT,
  bank_name TEXT,
  iban_hash TEXT NOT NULL,
  account_type TEXT DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'other')),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN (
    'pending', 'syncing', 'synced', 'error', 'expired'
  )),
  last_sync_at TIMESTAMPTZ,
  consent_expires_at TIMESTAMPTZ,
  error_message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iban_hash_unique UNIQUE (iban_hash)
);

CREATE INDEX IF NOT EXISTS idx_bank_conn_entity ON bank_connections(entity_id);

ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_conn_entity_access" ON bank_connections;
CREATE POLICY "bank_conn_entity_access" ON bank_connections
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. BANK_TRANSACTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  provider_transaction_id TEXT,
  transaction_date DATE NOT NULL,
  value_date DATE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  label TEXT,
  raw_label TEXT,
  category TEXT,
  counterpart_name TEXT,
  counterpart_iban TEXT,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN (
    'pending', 'matched_auto', 'matched_manual', 'suggested', 'orphan', 'ignored'
  )),
  matched_entry_id UUID REFERENCES accounting_entries(id),
  match_score NUMERIC(5,2),
  suggestion JSONB,
  is_internal_transfer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_connection ON bank_transactions(connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_tx_status ON bank_transactions(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_bank_tx_matched ON bank_transactions(matched_entry_id) WHERE matched_entry_id IS NOT NULL;

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_tx_via_connection" ON bank_transactions;
CREATE POLICY "bank_tx_via_connection" ON bank_transactions
  FOR ALL TO authenticated
  USING (
    connection_id IN (
      SELECT id FROM bank_connections
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    connection_id IN (
      SELECT id FROM bank_connections
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 8. DOCUMENT_ANALYSES (OCR + IA)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  extracted_data JSONB NOT NULL DEFAULT '{}',
  confidence_score NUMERIC(5,4),
  suggested_account TEXT,
  suggested_journal TEXT,
  document_type TEXT,
  siret_verified BOOLEAN DEFAULT false,
  tva_coherent BOOLEAN DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'completed', 'failed', 'validated', 'rejected'
  )),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_analyses_entity ON document_analyses(entity_id);
CREATE INDEX IF NOT EXISTS idx_doc_analyses_status ON document_analyses(processing_status);

ALTER TABLE document_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_analyses_entity_access" ON document_analyses;
CREATE POLICY "doc_analyses_entity_access" ON document_analyses
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 9. AMORTIZATION_SCHEDULES
-- =====================================================
CREATE TABLE IF NOT EXISTS amortization_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  property_id UUID,
  component TEXT NOT NULL,
  acquisition_date DATE NOT NULL,
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  terrain_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  depreciable_amount_cents INTEGER GENERATED ALWAYS AS (
    total_amount_cents - CAST(ROUND(total_amount_cents * terrain_percent / 100) AS INTEGER)
  ) STORED,
  duration_years INTEGER NOT NULL CHECK (duration_years > 0),
  amortization_method TEXT NOT NULL DEFAULT 'linear' CHECK (amortization_method IN ('linear', 'degressive')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amort_sched_entity ON amortization_schedules(entity_id);

ALTER TABLE amortization_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "amort_sched_entity_access" ON amortization_schedules;
CREATE POLICY "amort_sched_entity_access" ON amortization_schedules
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 10. AMORTIZATION_LINES
-- =====================================================
CREATE TABLE IF NOT EXISTS amortization_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES amortization_schedules(id) ON DELETE CASCADE,
  exercise_year INTEGER NOT NULL,
  annual_amount_cents INTEGER NOT NULL CHECK (annual_amount_cents >= 0),
  cumulated_amount_cents INTEGER NOT NULL CHECK (cumulated_amount_cents >= 0),
  net_book_value_cents INTEGER NOT NULL CHECK (net_book_value_cents >= 0),
  is_prorata BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT amort_line_unique UNIQUE (schedule_id, exercise_year)
);

ALTER TABLE amortization_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "amort_lines_via_schedule" ON amortization_lines;
CREATE POLICY "amort_lines_via_schedule" ON amortization_lines
  FOR ALL TO authenticated
  USING (
    schedule_id IN (
      SELECT id FROM amortization_schedules
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    schedule_id IN (
      SELECT id FROM amortization_schedules
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 11. DEFICIT_TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS deficit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  deficit_type TEXT NOT NULL CHECK (deficit_type IN ('foncier', 'bic_meuble')),
  origin_year INTEGER NOT NULL,
  initial_amount_cents INTEGER NOT NULL CHECK (initial_amount_cents > 0),
  used_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (used_amount_cents >= 0),
  remaining_amount_cents INTEGER GENERATED ALWAYS AS (
    initial_amount_cents - used_amount_cents
  ) STORED,
  expires_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deficit_entity ON deficit_tracking(entity_id);

ALTER TABLE deficit_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deficit_entity_access" ON deficit_tracking;
CREATE POLICY "deficit_entity_access" ON deficit_tracking
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 12. CHARGE_REGULARIZATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS charge_regularizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  lease_id UUID,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  provisions_paid_cents INTEGER NOT NULL DEFAULT 0,
  actual_recoverable_cents INTEGER NOT NULL DEFAULT 0,
  actual_non_recoverable_cents INTEGER NOT NULL DEFAULT 0,
  balance_cents INTEGER GENERATED ALWAYS AS (
    provisions_paid_cents - actual_recoverable_cents
  ) STORED,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'sent', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE charge_regularizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "charge_reg_entity_access" ON charge_regularizations;
CREATE POLICY "charge_reg_entity_access" ON charge_regularizations
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 13. EC_ACCESS + EC_ANNOTATIONS (Portail Expert-Comptable)
-- =====================================================
CREATE TABLE IF NOT EXISTS ec_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  ec_user_id UUID NOT NULL REFERENCES auth.users(id),
  ec_name TEXT NOT NULL,
  ec_email TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'annotate', 'validate')),
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ec_access_entity ON ec_access(entity_id);

ALTER TABLE ec_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ec_access_owner" ON ec_access;
CREATE POLICY "ec_access_owner" ON ec_access
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
    OR ec_user_id = auth.uid()
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS ec_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES accounting_entries(id),
  ec_user_id UUID NOT NULL REFERENCES auth.users(id),
  annotation_type TEXT NOT NULL CHECK (annotation_type IN (
    'comment', 'question', 'correction', 'validation'
  )),
  content TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ec_annotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ec_annotations_access" ON ec_annotations;
CREATE POLICY "ec_annotations_access" ON ec_annotations
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
    OR ec_user_id = auth.uid()
  )
  WITH CHECK (
    ec_user_id = auth.uid()
  );

-- =====================================================
-- 14. COPRO_BUDGETS + COPRO_FUND_CALLS
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  budget_name TEXT NOT NULL,
  budget_lines JSONB NOT NULL DEFAULT '[]',
  total_budget_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'voted', 'executed')),
  voted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE copro_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copro_budgets_entity_access" ON copro_budgets;
CREATE POLICY "copro_budgets_entity_access" ON copro_budgets
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS copro_fund_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES copro_budgets(id) ON DELETE CASCADE,
  copro_lot_id UUID,
  owner_name TEXT NOT NULL,
  tantiemes INTEGER NOT NULL CHECK (tantiemes > 0),
  total_tantiemes INTEGER NOT NULL CHECK (total_tantiemes > 0),
  call_amount_cents INTEGER NOT NULL CHECK (call_amount_cents > 0),
  call_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'partial', 'paid', 'overdue'
  )),
  paid_amount_cents INTEGER NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE copro_fund_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copro_fund_calls_entity_access" ON copro_fund_calls;
CREATE POLICY "copro_fund_calls_entity_access" ON copro_fund_calls
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 15. MANDANT_ACCOUNTS + CRG_REPORTS
-- =====================================================
CREATE TABLE IF NOT EXISTS mandant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  mandant_name TEXT NOT NULL,
  mandant_user_id UUID REFERENCES auth.users(id),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mandant_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mandant_accounts_entity_access" ON mandant_accounts;
CREATE POLICY "mandant_accounts_entity_access" ON mandant_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS crg_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  mandant_id UUID NOT NULL REFERENCES mandant_accounts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_income_cents INTEGER NOT NULL DEFAULT 0,
  total_expenses_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  net_owner_cents INTEGER NOT NULL DEFAULT 0,
  report_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'validated')),
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crg_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crg_reports_entity_access" ON crg_reports;
CREATE POLICY "crg_reports_entity_access" ON crg_reports
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 16. ACCOUNTING_AUDIT_LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'api', 'ec')),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON accounting_audit_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON accounting_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON accounting_audit_log(created_at);

ALTER TABLE accounting_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_entity_access" ON accounting_audit_log;
CREATE POLICY "audit_log_entity_access" ON accounting_audit_log
  FOR SELECT TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- Audit log is insert-only for the system, read-only for users
DROP POLICY IF EXISTS "audit_log_system_insert" ON accounting_audit_log;
CREATE POLICY "audit_log_system_insert" ON accounting_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: Verify entry balance (sum debit = sum credit) before validation
CREATE OR REPLACE FUNCTION fn_check_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debit INTEGER;
  total_credit INTEGER;
BEGIN
  IF NEW.is_validated = true AND (OLD.is_validated IS DISTINCT FROM true) THEN
    SELECT COALESCE(SUM(debit_cents), 0), COALESCE(SUM(credit_cents), 0)
    INTO total_debit, total_credit
    FROM accounting_entry_lines
    WHERE entry_id = NEW.id;

    IF total_debit != total_credit THEN
      RAISE EXCEPTION 'Entry balance error: debit (%) != credit (%)', total_debit, total_credit;
    END IF;

    IF total_debit = 0 THEN
      RAISE EXCEPTION 'Entry has no lines or all amounts are zero';
    END IF;

    NEW.is_locked := true;
    NEW.validated_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entry_balance ON accounting_entries;
CREATE TRIGGER trg_entry_balance
  BEFORE UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_entry_balance();

-- Trigger: Prevent modification of locked/validated entries (intangibilite)
CREATE OR REPLACE FUNCTION fn_locked_entry_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = true THEN
    -- Allow only reversal_of to be set on locked entries
    IF NEW.is_locked = OLD.is_locked
       AND NEW.is_validated = OLD.is_validated
       AND NEW.entry_date = OLD.entry_date
       AND NEW.label = OLD.label
       AND NEW.journal_code = OLD.journal_code THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a locked/validated entry. Use reversal (contre-passation) instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_locked_entry ON accounting_entries;
CREATE TRIGGER trg_locked_entry
  BEFORE UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_locked_entry_guard();

-- Trigger: Auto audit log on entry changes
CREATE OR REPLACE FUNCTION fn_audit_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO accounting_audit_log (entity_id, actor_id, actor_type, action, target_type, target_id, details)
    VALUES (
      NEW.entity_id,
      NEW.created_by,
      'user',
      'create_entry',
      'accounting_entry',
      NEW.id,
      jsonb_build_object('journal_code', NEW.journal_code, 'entry_number', NEW.entry_number, 'label', NEW.label)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_validated = true AND OLD.is_validated = false THEN
      INSERT INTO accounting_audit_log (entity_id, actor_id, actor_type, action, target_type, target_id, details)
      VALUES (
        NEW.entity_id,
        NEW.validated_by,
        'user',
        'validate_entry',
        'accounting_entry',
        NEW.id,
        jsonb_build_object('entry_number', NEW.entry_number)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_entries ON accounting_entries;
CREATE TRIGGER trg_audit_entries
  AFTER INSERT OR UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_entry_changes();

-- Trigger: updated_at auto-update
CREATE OR REPLACE FUNCTION fn_accounting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'accounting_exercises', 'accounting_entries', 'bank_connections',
      'bank_transactions', 'document_analyses', 'amortization_schedules',
      'deficit_tracking', 'charge_regularizations', 'copro_budgets',
      'copro_fund_calls', 'mandant_accounts', 'crg_reports'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_accounting_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- =====================================================
-- HELPER: Generate next entry number
-- =====================================================
CREATE OR REPLACE FUNCTION fn_next_entry_number(
  p_entity_id UUID,
  p_exercise_id UUID,
  p_journal_code TEXT
)
RETURNS TEXT AS $$
DECLARE
  next_seq INTEGER;
  year_part TEXT;
BEGIN
  SELECT EXTRACT(YEAR FROM start_date)::TEXT INTO year_part
  FROM accounting_exercises WHERE id = p_exercise_id;

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(entry_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM accounting_entries
  WHERE entity_id = p_entity_id
    AND exercise_id = p_exercise_id
    AND journal_code = p_journal_code;

  RETURN p_journal_code || '-' || year_part || '-' || LPAD(next_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE accounting_exercises IS 'Exercices comptables par entite (SCI, copro, agence)';
COMMENT ON TABLE chart_of_accounts IS 'Plan comptable PCG/copro/custom par entite';
COMMENT ON TABLE accounting_entries IS 'Ecritures comptables double-entry avec intangibilite';
COMMENT ON TABLE bank_transactions IS 'Transactions bancaires importees pour rapprochement';
COMMENT ON TABLE accounting_audit_log IS 'Journal audit comptable (insertion seule, lecture utilisateur)';

COMMIT;

-- -----------------------------------------------------------------------------
-- 8/71 -- 20260407110000 -- CRITIQUE -- 20260407110000_audit_fixes_rls_indexes.sql
-- risk: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 8/71 (CRITIQUE) 20260407110000_audit_fixes_rls_indexes.sql'; END $$;
-- Migration: Audit fixes — missing indexes, CHECK constraints, and RLS
-- Idempotent: safe to run multiple times

-- 1. Missing index on sepa_mandates.owner_profile_id (skip if table missing)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_sepa_mandates_owner ON sepa_mandates(owner_profile_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. CHECK constraints on status columns (skip if table does not exist)
DO $$ BEGIN
  ALTER TABLE reconciliation_matches DROP CONSTRAINT IF EXISTS chk_reconciliation_matches_status;
  ALTER TABLE reconciliation_matches ADD CONSTRAINT chk_reconciliation_matches_status CHECK (status IN ('pending','matched','disputed','resolved'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payment_schedules DROP CONSTRAINT IF EXISTS chk_payment_schedules_status;
  ALTER TABLE payment_schedules ADD CONSTRAINT chk_payment_schedules_status CHECK (status IN ('pending','active','paused','completed','cancelled'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE receipt_stubs DROP CONSTRAINT IF EXISTS chk_receipt_stubs_status;
  ALTER TABLE receipt_stubs ADD CONSTRAINT chk_receipt_stubs_status CHECK (status IN ('signed','cancelled','archived'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS chk_subscriptions_status;
  ALTER TABLE subscriptions ADD CONSTRAINT chk_subscriptions_status CHECK (status IN ('trialing','active','past_due','canceled','incomplete','paused'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE visit_slots DROP CONSTRAINT IF EXISTS chk_visit_slots_status;
  ALTER TABLE visit_slots ADD CONSTRAINT chk_visit_slots_status CHECK (status IN ('available','booked','cancelled','completed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE visit_bookings DROP CONSTRAINT IF EXISTS chk_visit_bookings_status;
  ALTER TABLE visit_bookings ADD CONSTRAINT chk_visit_bookings_status CHECK (status IN ('pending','confirmed','cancelled','no_show','completed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Enable RLS on lease_notices (idempotent — ENABLE is a no-op if already on)
ALTER TABLE IF EXISTS lease_notices ENABLE ROW LEVEL SECURITY;

COMMIT;

-- -----------------------------------------------------------------------------
-- 9/71 -- 20260407120000 -- CRITIQUE -- 20260407120000_accounting_reconcile_schemas.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 9/71 (CRITIQUE) 20260407120000_accounting_reconcile_schemas.sql'; END $$;
-- =====================================================
-- MIGRATION: Reconcile accounting schemas
-- Date: 2026-04-07
--
-- The old migration (20260110000001) created:
--   accounting_journals, accounting_entries, mandant_accounts,
--   charge_regularisations, deposit_operations, bank_reconciliations
--
-- The new migration (20260406210000) tries to create tables with
-- overlapping names but uses IF NOT EXISTS, so conflicting tables
-- are silently skipped.
--
-- This migration:
-- 1. Adds missing columns to old accounting_entries for double-entry support
-- 2. Adds missing columns to old accounting_journals for entity support
-- 3. Adds missing columns to old mandant_accounts for entity support
-- 4. Creates accounting_entry_lines if not exists (new table, no conflict)
-- 5. Ensures all new non-conflicting tables from 20260406210000 exist
-- =====================================================

-- =====================================================
-- 1. Extend accounting_journals with entity support
-- =====================================================
ALTER TABLE public.accounting_journals
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS journal_type TEXT;

-- Backfill label from libelle
UPDATE public.accounting_journals
SET label = libelle
WHERE label IS NULL AND libelle IS NOT NULL;

-- =====================================================
-- 2. Extend accounting_entries with double-entry header fields
-- =====================================================
ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES accounting_exercises(id),
  ADD COLUMN IF NOT EXISTS entry_number TEXT,
  ADD COLUMN IF NOT EXISTS entry_date DATE,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS is_validated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversal_of UUID REFERENCES accounting_entries(id);

-- Backfill new columns from old columns
UPDATE public.accounting_entries
SET
  entry_number = ecriture_num,
  entry_date = ecriture_date,
  label = ecriture_lib,
  is_validated = (valid_date IS NOT NULL),
  validated_at = valid_date::timestamptz
WHERE entry_number IS NULL AND ecriture_num IS NOT NULL;

-- Add the unique constraint for new entry numbering (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entry_number_unique'
  ) THEN
    -- Only add if no duplicates exist
    IF (SELECT COUNT(*) FROM (
      SELECT entity_id, exercise_id, entry_number
      FROM public.accounting_entries
      WHERE entity_id IS NOT NULL AND exercise_id IS NOT NULL AND entry_number IS NOT NULL
      GROUP BY entity_id, exercise_id, entry_number
      HAVING COUNT(*) > 1
    ) dups) = 0 THEN
      ALTER TABLE public.accounting_entries DROP CONSTRAINT IF EXISTS entry_number_unique;
      ALTER TABLE public.accounting_entries
        ADD CONSTRAINT entry_number_unique UNIQUE (entity_id, exercise_id, entry_number);
    END IF;
  END IF;
END $$;

-- =====================================================
-- 3. Extend mandant_accounts with entity support
-- =====================================================
ALTER TABLE public.mandant_accounts
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS mandant_name TEXT,
  ADD COLUMN IF NOT EXISTS mandant_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- 4. Ensure accounting_entry_lines exists
-- (This table is NEW — no conflict with old schema)
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT,
  debit_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
  credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  lettrage TEXT,
  piece_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_side CHECK (
    (debit_cents > 0 AND credit_cents = 0) OR
    (debit_cents = 0 AND credit_cents > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_entry_lines_entry ON accounting_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_lines_account ON accounting_entry_lines(account_number);
CREATE INDEX IF NOT EXISTS idx_entry_lines_lettrage ON accounting_entry_lines(lettrage)
  WHERE lettrage IS NOT NULL;

ALTER TABLE accounting_entry_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entry_lines_via_entry" ON accounting_entry_lines;
CREATE POLICY "entry_lines_via_entry" ON accounting_entry_lines
  FOR ALL TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 5. Add entity_members RLS policies to old tables
-- (Old tables used role-based RLS, add entity-based too)
-- =====================================================

-- accounting_entries: add entity-based policy
DROP POLICY IF EXISTS "entries_entity_access" ON public.accounting_entries;
CREATE POLICY "entries_entity_access" ON public.accounting_entries
  FOR ALL TO authenticated
  USING (
    entity_id IS NULL  -- allow access to old entries without entity
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- mandant_accounts: add entity-based policy
DROP POLICY IF EXISTS "mandant_entity_access" ON public.mandant_accounts;
CREATE POLICY "mandant_entity_access" ON public.mandant_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 6. Rename old accounting_accounts → keep as-is
-- The new chart_of_accounts is a separate table (no conflict)
-- Both can coexist: old for agency, new for owner/copro
-- =====================================================

COMMENT ON TABLE public.accounting_journals IS 'Journaux comptables — extended with entity support for multi-entity accounting';
COMMENT ON TABLE public.accounting_entries IS 'Ecritures comptables — extended with double-entry header fields and entity support';
COMMENT ON TABLE public.mandant_accounts IS 'Comptes mandants — extended with entity support';

COMMIT;

-- -----------------------------------------------------------------------------
-- 10/71 -- 20260407130000 -- MODERE -- 20260407130000_ocr_category_rules.sql
-- risk: +1 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 10/71 (MODERE) 20260407130000_ocr_category_rules.sql'; END $$;
-- =====================================================
-- MIGRATION: OCR Category Rules + document_analyses extensions
-- Date: 2026-04-07
-- =====================================================

-- Table for OCR learning rules
CREATE TABLE IF NOT EXISTS ocr_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('supplier_name', 'supplier_siret', 'keyword')),
  match_value TEXT NOT NULL,
  target_account TEXT NOT NULL,
  target_category TEXT,
  target_journal TEXT,
  confidence_boost NUMERIC(5,2) DEFAULT 10.0,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entity_id, match_type, match_value)
);

CREATE INDEX IF NOT EXISTS idx_ocr_rules_entity ON ocr_category_rules(entity_id);
CREATE INDEX IF NOT EXISTS idx_ocr_rules_match ON ocr_category_rules(match_type, match_value);

ALTER TABLE ocr_category_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocr_rules_entity_access" ON ocr_category_rules;
CREATE POLICY "ocr_rules_entity_access" ON ocr_category_rules
  FOR ALL TO authenticated
  USING (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));

-- Extend document_analyses with OCR-specific columns
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES accounting_entries(id);
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS raw_ocr_text TEXT;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS suggested_entry JSONB;

COMMIT;

-- -----------------------------------------------------------------------------
-- 11/71 -- 20260408042218 -- DANGEREUX -- 20260408042218_create_expenses_table.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 11/71 (DANGEREUX) 20260408042218_create_expenses_table.sql'; END $$;
-- Migration: Table expenses (dépenses/travaux propriétaire)
-- Date: 2026-04-08
-- RLS via chaîne : legal_entities.owner_profile_id → owner_profiles.profile_id
-- Compatible multi-entités (legal_entity_id) + particulier (owner_profile_id direct)

BEGIN;

-- ============================================
-- TABLE: expenses
-- ============================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rattachement entité / propriétaire
  legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  owner_profile_id UUID NOT NULL REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,

  -- Rattachement bien (optionnel — une dépense peut concerner plusieurs biens)
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,

  -- Catégorie de dépense
  category TEXT NOT NULL CHECK (category IN (
    'travaux',              -- Travaux / réparations
    'entretien',            -- Entretien courant
    'assurance',            -- Assurance PNO, loyers impayés
    'taxe_fonciere',        -- Taxe foncière
    'charges_copro',        -- Charges de copropriété
    'frais_gestion',        -- Frais de gestion / comptable
    'frais_bancaires',      -- Frais bancaires
    'diagnostic',           -- Diagnostics (DPE, amiante, etc.)
    'mobilier',             -- Mobilier (meublé)
    'honoraires',           -- Honoraires (notaire, huissier, avocat)
    'autre'                 -- Autre
  )),

  -- Détail
  description TEXT NOT NULL,
  montant DECIMAL(12, 2) NOT NULL CHECK (montant > 0),
  date_depense DATE NOT NULL DEFAULT CURRENT_DATE,
  fournisseur TEXT,                              -- Nom du prestataire / fournisseur

  -- TVA
  tva_taux DECIMAL(5, 2) DEFAULT 0,
  tva_montant DECIMAL(12, 2) DEFAULT 0,
  montant_ttc DECIMAL(12, 2) GENERATED ALWAYS AS (montant + COALESCE(tva_montant, 0)) STORED,

  -- Déductibilité fiscale
  deductible BOOLEAN NOT NULL DEFAULT true,
  deduction_exercice INTEGER,                    -- Année de déduction fiscale

  -- Justificatif
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  receipt_storage_path TEXT,

  -- Récurrence (si charge régulière)
  recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN (
    'mensuel', 'trimestriel', 'semestriel', 'annuel', 'ponctuel'
  )) DEFAULT 'ponctuel',

  -- Statut
  statut TEXT NOT NULL DEFAULT 'confirmed' CHECK (statut IN (
    'draft', 'confirmed', 'cancelled'
  )),

  -- Métadonnées
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- ============================================
-- INDEX
-- ============================================

CREATE INDEX IF NOT EXISTS idx_expenses_owner ON expenses(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_expenses_entity ON expenses(legal_entity_id) WHERE legal_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_expenses_year ON expenses(date_depense, owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_expenses_statut ON expenses(statut) WHERE statut = 'confirmed';

-- ============================================
-- RLS
-- ============================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Propriétaires : accès via la chaîne legal_entities → owner_profiles
-- Supporte à la fois :
--   - Dépenses rattachées à une entité (legal_entity_id IS NOT NULL)
--   - Dépenses en direct (owner_profile_id = profile courant)
DROP POLICY IF EXISTS "Owners can view own expenses" ON expenses;
CREATE POLICY "Owners can view own expenses" ON expenses
  FOR SELECT TO authenticated
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Owners can insert own expenses" ON expenses;
CREATE POLICY "Owners can insert own expenses" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can update own expenses" ON expenses;
CREATE POLICY "Owners can update own expenses" ON expenses
  FOR UPDATE TO authenticated
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can delete own expenses" ON expenses;
CREATE POLICY "Owners can delete own expenses" ON expenses
  FOR DELETE TO authenticated
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins full access on expenses" ON expenses;
CREATE POLICY "Admins full access on expenses" ON expenses
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- TRIGGER: updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 12/71 -- 20260408044152 -- CRITIQUE -- 20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 12/71 (CRITIQUE) 20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql'; END $$;
-- =====================================================
-- MIGRATION: Réconciliation finale des schémas comptables
-- Date: 2026-04-08
--
-- 1. charge_regularisations (FR) → charge_regularizations (EN)
--    - Migre les données de l'ancienne table vers la nouvelle
--    - Crée une vue de compatibilité charge_regularisations
--
-- 2. accounting_entries inline → accounting_entry_lines
--    - Backfill des anciennes écritures inline (debit/credit)
--    - Vers le nouveau modèle header/lignes (entry_lines)
--
-- Idempotent : chaque opération vérifie l'état avant d'agir.
-- =====================================================

BEGIN;

-- =====================================================
-- PARTIE 1 : charge_regularisations → charge_regularizations
-- =====================================================

-- 1a. S'assurer que charge_regularizations a les colonnes de compatibilité
ALTER TABLE public.charge_regularizations
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id),
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS annee INTEGER,
  ADD COLUMN IF NOT EXISTS date_emission DATE,
  ADD COLUMN IF NOT EXISTS date_echeance DATE,
  ADD COLUMN IF NOT EXISTS date_paiement DATE,
  ADD COLUMN IF NOT EXISTS nouvelle_provision DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS detail_charges JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 1b. Migrer les données de charge_regularisations → charge_regularizations
-- Seulement les lignes qui n'existent pas déjà (idempotent via id)
INSERT INTO public.charge_regularizations (
  id,
  lease_id,
  property_id,
  tenant_id,
  annee,
  period_start,
  period_end,
  provisions_paid_cents,
  actual_recoverable_cents,
  actual_non_recoverable_cents,
  status,
  date_emission,
  date_echeance,
  date_paiement,
  nouvelle_provision,
  notes,
  detail_charges,
  created_by,
  created_at,
  updated_at,
  -- entity_id et exercise_id sont NULL — sera backfillé plus tard
  entity_id
)
SELECT
  cr.id,
  cr.lease_id,
  cr.property_id,
  cr.tenant_id,
  cr.annee,
  cr.date_debut,
  cr.date_fin,
  -- Conversion DECIMAL euros → INTEGER cents
  ROUND(cr.provisions_versees * 100)::INTEGER,
  ROUND(cr.charges_reelles * 100)::INTEGER,
  0, -- actual_non_recoverable_cents inconnu dans l'ancien schéma
  -- Mapping statut FR → EN
  CASE cr.statut
    WHEN 'draft' THEN 'draft'
    WHEN 'sent' THEN 'sent'
    WHEN 'paid' THEN 'paid'
    WHEN 'disputed' THEN 'draft'
    WHEN 'cancelled' THEN 'draft'
    ELSE 'draft'
  END,
  cr.date_emission,
  cr.date_echeance,
  cr.date_paiement,
  cr.nouvelle_provision,
  cr.notes,
  cr.detail_charges,
  cr.created_by,
  cr.created_at,
  cr.updated_at,
  -- Résoudre entity_id via property → properties.legal_entity_id
  (SELECT p.legal_entity_id FROM public.properties p WHERE p.id = cr.property_id LIMIT 1)
FROM public.charge_regularisations cr
WHERE NOT EXISTS (
  SELECT 1 FROM public.charge_regularizations crz WHERE crz.id = cr.id
);

-- 1c. Rattacher entity_id + exercise_id sur les lignes migrées qui n'en ont pas
-- entity_id via property
UPDATE public.charge_regularizations
SET entity_id = (
  SELECT p.legal_entity_id
  FROM public.properties p
  WHERE p.id = charge_regularizations.property_id
  LIMIT 1
)
WHERE entity_id IS NULL AND property_id IS NOT NULL;

-- exercise_id via annee → le premier exercice de cette année
UPDATE public.charge_regularizations
SET exercise_id = (
  SELECT ae.id
  FROM public.accounting_exercises ae
  WHERE EXTRACT(YEAR FROM ae.start_date) = charge_regularizations.annee
  ORDER BY ae.start_date ASC
  LIMIT 1
)
WHERE exercise_id IS NULL AND annee IS NOT NULL;

-- 1d. Renommer l'ancienne table et créer une vue de compatibilité
-- On ne DROP pas l'ancienne table pour éviter de casser du code legacy
-- qui pourrait encore la référencer via des FK ou du code direct
DO $RENAME$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='charge_regularisations' AND table_type='BASE TABLE')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='charge_regularisations_legacy') THEN
    EXECUTE 'ALTER TABLE public.charge_regularisations RENAME TO charge_regularisations_legacy';
  END IF;
END $RENAME$;

-- Vue de compatibilité : le code qui SELECT depuis charge_regularisations
-- continue de fonctionner, pointant vers la table normalisée
CREATE OR REPLACE VIEW public.charge_regularisations AS
SELECT
  id,
  lease_id,
  property_id,
  tenant_id,
  annee,
  period_start AS date_debut,
  period_end AS date_fin,
  -- Conversion cents → euros pour compatibilité
  (provisions_paid_cents / 100.0)::DECIMAL(15,2) AS provisions_versees,
  (actual_recoverable_cents / 100.0)::DECIMAL(15,2) AS charges_reelles,
  ((actual_recoverable_cents - provisions_paid_cents) / 100.0)::DECIMAL(15,2) AS solde,
  detail_charges,
  status AS statut,
  date_emission,
  date_echeance,
  date_paiement,
  nouvelle_provision,
  NULL::DATE AS date_effet_nouvelle_provision,
  notes,
  created_at,
  updated_at,
  created_by
FROM public.charge_regularizations;

COMMENT ON VIEW public.charge_regularisations IS
  'Vue de compatibilité — pointe vers charge_regularizations. Utiliser la table normalisée pour les nouvelles écritures.';

-- 1e. Triggers INSTEAD OF pour que INSERT/UPDATE/DELETE sur la vue
--     redirigent vers charge_regularizations (compatibilité code legacy)

CREATE OR REPLACE FUNCTION charge_regularisations_insert_redirect()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.charge_regularizations (
    id, lease_id, property_id, tenant_id, annee,
    period_start, period_end,
    provisions_paid_cents, actual_recoverable_cents, actual_non_recoverable_cents,
    status, date_emission, date_echeance, date_paiement,
    nouvelle_provision, notes, detail_charges, created_by,
    entity_id
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.lease_id,
    NEW.property_id,
    NEW.tenant_id,
    NEW.annee,
    NEW.date_debut,
    NEW.date_fin,
    ROUND(COALESCE(NEW.provisions_versees, 0) * 100)::INTEGER,
    ROUND(COALESCE(NEW.charges_reelles, 0) * 100)::INTEGER,
    0,
    COALESCE(NEW.statut, 'draft'),
    NEW.date_emission,
    NEW.date_echeance,
    NEW.date_paiement,
    NEW.nouvelle_provision,
    NEW.notes,
    NEW.detail_charges,
    NEW.created_by,
    (SELECT p.legal_entity_id FROM public.properties p WHERE p.id = NEW.property_id LIMIT 1)
  )
  RETURNING id INTO NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS charge_regularisations_on_insert ON public.charge_regularisations;
CREATE TRIGGER charge_regularisations_on_insert
  INSTEAD OF INSERT ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_insert_redirect();

CREATE OR REPLACE FUNCTION charge_regularisations_update_redirect()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.charge_regularizations SET
    lease_id = NEW.lease_id,
    property_id = NEW.property_id,
    tenant_id = NEW.tenant_id,
    annee = NEW.annee,
    period_start = COALESCE(NEW.date_debut, period_start),
    period_end = COALESCE(NEW.date_fin, period_end),
    provisions_paid_cents = ROUND(COALESCE(NEW.provisions_versees, 0) * 100)::INTEGER,
    actual_recoverable_cents = ROUND(COALESCE(NEW.charges_reelles, 0) * 100)::INTEGER,
    status = COALESCE(NEW.statut, status),
    date_emission = NEW.date_emission,
    date_echeance = NEW.date_echeance,
    date_paiement = NEW.date_paiement,
    nouvelle_provision = NEW.nouvelle_provision,
    notes = NEW.notes,
    detail_charges = NEW.detail_charges,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS charge_regularisations_on_update ON public.charge_regularisations;
CREATE TRIGGER charge_regularisations_on_update
  INSTEAD OF UPDATE ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_update_redirect();

CREATE OR REPLACE FUNCTION charge_regularisations_delete_redirect()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.charge_regularizations WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS charge_regularisations_on_delete ON public.charge_regularisations;
CREATE TRIGGER charge_regularisations_on_delete
  INSTEAD OF DELETE ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_delete_redirect();

-- =====================================================
-- PARTIE 2 : Backfill accounting_entries → entry_lines
-- =====================================================
-- Les anciennes écritures ont debit/credit inline.
-- Le nouveau modèle utilise accounting_entry_lines.
-- On crée une ligne par écriture ancienne qui a un montant.

-- 2a. Insérer les lignes pour les écritures qui n'ont pas encore de lignes
INSERT INTO public.accounting_entry_lines (
  entry_id,
  account_number,
  label,
  debit_cents,
  credit_cents,
  lettrage,
  piece_ref
)
SELECT
  ae.id,
  ae.compte_num,
  ae.ecriture_lib,
  -- Conversion DECIMAL euros → INTEGER cents
  ROUND(ae.debit * 100)::INTEGER,
  ROUND(ae.credit * 100)::INTEGER,
  ae.ecriture_let,
  ae.piece_ref
FROM public.accounting_entries ae
WHERE
  -- Seulement les écritures qui ont des montants inline
  (ae.debit > 0 OR ae.credit > 0)
  -- Et qui n'ont pas encore de lignes associées
  AND NOT EXISTS (
    SELECT 1 FROM public.accounting_entry_lines ael
    WHERE ael.entry_id = ae.id
  )
  -- Et qui ont le format ancien (compte_num rempli)
  AND ae.compte_num IS NOT NULL;

-- 2b. Marquer les anciennes écritures comme ayant été migrées (via metadata)
-- On utilise la colonne source pour tracer
UPDATE public.accounting_entries
SET source = COALESCE(source, 'legacy_inline_migrated')
WHERE
  source IS NULL
  AND (debit > 0 OR credit > 0)
  AND compte_num IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.accounting_entry_lines ael WHERE ael.entry_id = id
  );

-- =====================================================
-- VÉRIFICATION (commentaire informatif)
-- =====================================================
-- Après exécution, vérifier :
--
-- SELECT 'charge_regularizations' AS table_name, COUNT(*) FROM charge_regularizations
-- UNION ALL
-- SELECT 'charge_regularisations_legacy', COUNT(*) FROM charge_regularisations_legacy
-- UNION ALL
-- SELECT 'entries_with_lines', COUNT(DISTINCT entry_id) FROM accounting_entry_lines
-- UNION ALL
-- SELECT 'entries_without_lines', COUNT(*) FROM accounting_entries
--   WHERE (debit > 0 OR credit > 0) AND NOT EXISTS (
--     SELECT 1 FROM accounting_entry_lines WHERE entry_id = accounting_entries.id
--   );

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 13/71 -- 20260408100000 -- MODERE -- 20260408100000_copro_lots.sql
-- risk: +2 policies, ALTER column (type/constraint), UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 13/71 (MODERE) 20260408100000_copro_lots.sql'; END $$;
-- Sprint 5: Copropriété lots + fund call lines
-- Tables for syndic copropriété module

CREATE TABLE IF NOT EXISTS copro_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copro_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  lot_type TEXT CHECK (lot_type IN ('habitation','commerce','parking','cave','bureau','autre')) DEFAULT 'habitation',
  owner_name TEXT NOT NULL,
  owner_entity_id UUID REFERENCES legal_entities(id),
  owner_profile_id UUID REFERENCES profiles(id),
  tantiemes_generaux INTEGER NOT NULL CHECK (tantiemes_generaux > 0),
  tantiemes_speciaux JSONB DEFAULT '{}',
  surface_m2 NUMERIC(8,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(copro_entity_id, lot_number)
);
CREATE INDEX IF NOT EXISTS idx_copro_lots_entity ON copro_lots(copro_entity_id);
ALTER TABLE copro_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "copro_lots_entity_access" ON copro_lots;
CREATE POLICY "copro_lots_entity_access" ON copro_lots FOR ALL TO authenticated
  USING (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));

-- Add missing columns to copro_fund_calls for syndic module
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES accounting_exercises(id);
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS call_number TEXT;
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS period_label TEXT;
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','partial','overdue'));

-- Make lot-level columns nullable (calls now represent periods, lines hold lot details)
ALTER TABLE copro_fund_calls ALTER COLUMN owner_name DROP NOT NULL;
ALTER TABLE copro_fund_calls ALTER COLUMN owner_name SET DEFAULT '';
ALTER TABLE copro_fund_calls ALTER COLUMN tantiemes DROP NOT NULL;
ALTER TABLE copro_fund_calls DROP CONSTRAINT IF EXISTS copro_fund_calls_tantiemes_check;
ALTER TABLE copro_fund_calls ALTER COLUMN tantiemes SET DEFAULT 0;
ALTER TABLE copro_fund_calls ALTER COLUMN total_tantiemes DROP NOT NULL;
ALTER TABLE copro_fund_calls DROP CONSTRAINT IF EXISTS copro_fund_calls_total_tantiemes_check;
ALTER TABLE copro_fund_calls ALTER COLUMN total_tantiemes SET DEFAULT 0;

-- Backfill exercise_id from budget if null
UPDATE copro_fund_calls SET exercise_id = copro_budgets.exercise_id
  FROM copro_budgets WHERE copro_fund_calls.budget_id = copro_budgets.id
  AND copro_fund_calls.exercise_id IS NULL;

-- Add copro_fund_call_lines if not exists
CREATE TABLE IF NOT EXISTS copro_fund_call_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES copro_fund_calls(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES copro_lots(id),
  owner_name TEXT NOT NULL,
  tantiemes INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','partial','paid','overdue')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE copro_fund_call_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "copro_fund_call_lines_access" ON copro_fund_call_lines;
CREATE POLICY "copro_fund_call_lines_access" ON copro_fund_call_lines FOR ALL TO authenticated
  USING (call_id IN (SELECT id FROM copro_fund_calls WHERE entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid())));

COMMIT;

-- -----------------------------------------------------------------------------
-- 14/71 -- 20260408110000 -- SAFE -- 20260408110000_agency_hoguet.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 14/71 (SAFE) 20260408110000_agency_hoguet.sql'; END $$;
-- ============================================================================
-- Sprint 6: Agency Hoguet compliance columns
--
-- Adds Carte G (carte professionnelle gestion immobiliere) and caisse de
-- garantie information to legal_entities for Loi Hoguet compliance.
-- ============================================================================

ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_numero TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_expiry DATE;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie_numero TEXT;

-- Index for quick Hoguet compliance checks
CREATE INDEX IF NOT EXISTS idx_legal_entities_carte_g
  ON legal_entities (carte_g_numero)
  WHERE carte_g_numero IS NOT NULL;

COMMENT ON COLUMN legal_entities.carte_g_numero IS 'Numero de carte professionnelle G (gestion immobiliere) - Loi Hoguet';
COMMENT ON COLUMN legal_entities.carte_g_expiry IS 'Date expiration de la carte G';
COMMENT ON COLUMN legal_entities.caisse_garantie IS 'Nom de la caisse de garantie financiere';
COMMENT ON COLUMN legal_entities.caisse_garantie_numero IS 'Numero adhesion a la caisse de garantie';

COMMIT;

-- -----------------------------------------------------------------------------
-- 15/71 -- 20260408120000 -- DANGEREUX -- 20260408120000_api_keys_webhooks.sql
-- risk: UPDATE sans WHERE : on,on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 15/71 (DANGEREUX) 20260408120000_api_keys_webhooks.sql'; END $$;
-- ============================================================================
-- Migration: API Keys, API Logs, API Webhooks
-- Feature: REST API pour développeurs tiers (Pro+/Enterprise)
-- ============================================================================

-- ============================================================================
-- 1. api_keys — Clés API pour authentification Bearer token
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,                           -- 'Mon ERP', 'Zapier'
  key_hash TEXT NOT NULL,                       -- SHA-256 du token (jamais en clair)
  key_prefix TEXT NOT NULL,                     -- 'tlk_live_xxxx' (pour identification)
  permissions TEXT[] DEFAULT '{read}',          -- ['read', 'write', 'delete']
  scopes TEXT[] DEFAULT '{properties}',         -- ['properties','leases','documents','accounting']
  rate_limit_per_hour INTEGER DEFAULT 1000,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_profile ON api_keys(profile_id);

-- RLS: Owner can only see/manage their own API keys
DROP POLICY IF EXISTS "api_keys_select_own" ON api_keys;
CREATE POLICY "api_keys_select_own" ON api_keys
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_keys_insert_own" ON api_keys;
CREATE POLICY "api_keys_insert_own" ON api_keys
  FOR INSERT WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_keys_update_own" ON api_keys;
CREATE POLICY "api_keys_update_own" ON api_keys
  FOR UPDATE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_keys_delete_own" ON api_keys;
CREATE POLICY "api_keys_delete_own" ON api_keys
  FOR DELETE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================================================
-- 2. api_logs — Logs de chaque appel API
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  request_body_size INTEGER,
  response_body_size INTEGER,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_logs_key ON api_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);

-- RLS: Owner can see logs for their own API keys
DROP POLICY IF EXISTS "api_logs_select_own" ON api_logs;
CREATE POLICY "api_logs_select_own" ON api_logs
  FOR SELECT USING (
    api_key_id IN (
      SELECT id FROM api_keys WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Insert allowed for service role only (via API middleware)
-- No insert policy for regular users

-- ============================================================================
-- 3. api_webhooks — Webhooks sortants configurés par le propriétaire
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,                       -- ['lease.created','payment.received',...]
  secret TEXT NOT NULL,                         -- Pour signature HMAC-SHA256
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  failure_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_webhooks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_webhooks_profile ON api_webhooks(profile_id);
CREATE INDEX IF NOT EXISTS idx_api_webhooks_events ON api_webhooks USING GIN(events);

-- RLS: Owner can only see/manage their own webhooks
DROP POLICY IF EXISTS "api_webhooks_select_own" ON api_webhooks;
CREATE POLICY "api_webhooks_select_own" ON api_webhooks
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_webhooks_insert_own" ON api_webhooks;
CREATE POLICY "api_webhooks_insert_own" ON api_webhooks
  FOR INSERT WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_webhooks_update_own" ON api_webhooks;
CREATE POLICY "api_webhooks_update_own" ON api_webhooks
  FOR UPDATE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "api_webhooks_delete_own" ON api_webhooks;
CREATE POLICY "api_webhooks_delete_own" ON api_webhooks
  FOR DELETE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. api_webhook_deliveries — Log de chaque envoi de webhook
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES api_webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  attempt INTEGER DEFAULT 1,
  error TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON api_webhook_deliveries(webhook_id, delivered_at DESC);

-- ============================================================================
-- 5. Triggers updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_api_keys_updated_at') THEN
    DROP TRIGGER IF EXISTS set_api_keys_updated_at ON api_keys;
    CREATE TRIGGER set_api_keys_updated_at
      BEFORE UPDATE ON api_keys
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_api_webhooks_updated_at') THEN
    DROP TRIGGER IF EXISTS set_api_webhooks_updated_at ON api_webhooks;
    CREATE TRIGGER set_api_webhooks_updated_at
      BEFORE UPDATE ON api_webhooks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 16/71 -- 20260408130000 -- DANGEREUX -- 20260408130000_active_sessions.sql
-- risk: UPDATE sans WHERE : own,on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 16/71 (DANGEREUX) 20260408130000_active_sessions.sql'; END $$;
-- ============================================================
-- MIGRATION: active_sessions — Session tracking & multi-device
-- SOTA 2026 — Auth & RBAC Architecture
-- ============================================================

-- Table: active_sessions
-- Tracks authenticated sessions per user/device for security overview
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_name TEXT,
  ip_address INET,
  user_agent TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_active_sessions_profile_id ON active_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_active ON active_sessions(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_sessions_not_revoked ON active_sessions(profile_id) WHERE revoked_at IS NULL;

-- Enable RLS
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see and manage their own sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON active_sessions;
CREATE POLICY "Users can view own sessions"
  ON active_sessions FOR SELECT
  USING (profile_id = user_profile_id());

DROP POLICY IF EXISTS "Users can insert own sessions" ON active_sessions;
CREATE POLICY "Users can insert own sessions"
  ON active_sessions FOR INSERT
  WITH CHECK (profile_id = user_profile_id());

DROP POLICY IF EXISTS "Users can update own sessions" ON active_sessions;
CREATE POLICY "Users can update own sessions"
  ON active_sessions FOR UPDATE
  USING (profile_id = user_profile_id());

-- Admins can view all sessions (for security audit)
DROP POLICY IF EXISTS "Admins can view all sessions" ON active_sessions;
CREATE POLICY "Admins can view all sessions"
  ON active_sessions FOR SELECT
  USING (user_role() = 'admin');

-- Auto-update timestamp trigger
DROP TRIGGER IF EXISTS set_active_sessions_updated_at ON active_sessions;
CREATE TRIGGER set_active_sessions_updated_at
  BEFORE UPDATE ON active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: upsert_active_session
-- Called on login/token refresh to track active sessions
CREATE OR REPLACE FUNCTION upsert_active_session(
  p_profile_id UUID,
  p_device_name TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_device TEXT;
BEGIN
  -- Parse device name from user agent if not provided
  v_device := COALESCE(p_device_name,
    CASE
      WHEN p_user_agent ILIKE '%iPhone%' THEN 'iPhone'
      WHEN p_user_agent ILIKE '%iPad%' THEN 'iPad'
      WHEN p_user_agent ILIKE '%Android%' THEN 'Android'
      WHEN p_user_agent ILIKE '%Macintosh%' THEN 'Mac'
      WHEN p_user_agent ILIKE '%Windows%' THEN 'Windows'
      WHEN p_user_agent ILIKE '%Linux%' THEN 'Linux'
      ELSE 'Appareil inconnu'
    END
  );

  -- Try to find an existing active session from the same device/IP
  SELECT id INTO v_session_id
  FROM active_sessions
  WHERE profile_id = p_profile_id
    AND revoked_at IS NULL
    AND (
      (ip_address = p_ip_address AND user_agent = p_user_agent)
      OR (device_name = v_device AND ip_address = p_ip_address)
    )
  ORDER BY last_active_at DESC
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    -- Update existing session
    UPDATE active_sessions
    SET last_active_at = now(),
        device_name = v_device,
        user_agent = COALESCE(p_user_agent, user_agent)
    WHERE id = v_session_id;
  ELSE
    -- Insert new session
    INSERT INTO active_sessions (profile_id, device_name, ip_address, user_agent)
    VALUES (p_profile_id, v_device, p_ip_address, p_user_agent)
    RETURNING id INTO v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$;

-- Function: revoke_session
CREATE OR REPLACE FUNCTION revoke_session(
  p_session_id UUID,
  p_profile_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE active_sessions
  SET revoked_at = now()
  WHERE id = p_session_id
    AND profile_id = p_profile_id
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

-- Auto-expire sessions older than 30 days (to be called by pg_cron)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE active_sessions
    SET revoked_at = now()
    WHERE revoked_at IS NULL
      AND last_active_at < now() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 17/71 -- 20260408140000 -- DANGEREUX -- 20260408140000_tickets_module_sota.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 17/71 (DANGEREUX) 20260408140000_tickets_module_sota.sql'; END $$;
-- =============================================
-- TICKETS MODULE SOTA — Upgrade complet
-- State machine: open → acknowledged → assigned → in_progress → resolved → closed
--                       ↓                                        ↓
--                    rejected                               reopened → in_progress
-- =============================================

-- 1. Ajouter les nouvelles colonnes à tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_rating INTEGER;

-- 2. Contrainte satisfaction_rating
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_satisfaction_rating_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_satisfaction_rating_check
  CHECK (satisfaction_rating IS NULL OR (satisfaction_rating >= 1 AND satisfaction_rating <= 5));

-- 3. Contrainte category
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_category_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_category_check
  CHECK (category IS NULL OR category IN (
    'plomberie','electricite','serrurerie','chauffage','humidite',
    'nuisibles','bruit','parties_communes','equipement','autre'
  ));

-- 4. Étendre la contrainte de statut (garder paused pour backward compat)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_statut_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_statut_check
  CHECK (statut IN (
    'open','acknowledged','assigned','in_progress',
    'resolved','closed','rejected','reopened','paused'
  ));

-- 5. Étendre la contrainte de priorité (garder anciennes valeurs françaises pour compat)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_priorite_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_priorite_check
  CHECK (priorite IN ('low','normal','urgent','emergency','basse','normale','haute','urgente'));

-- 6. Backfill owner_id depuis properties pour tickets existants
UPDATE tickets t
SET owner_id = p.owner_id
FROM properties p
WHERE t.property_id = p.id
  AND t.owner_id IS NULL;

-- 7. Nouveaux index
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_owner_id ON tickets(owner_id);

-- 8. Créer la table ticket_comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id ON ticket_comments(author_id);

-- 9. RLS policies pour ticket_comments
DROP POLICY IF EXISTS "ticket_comments_select_owner" ON ticket_comments;
CREATE POLICY "ticket_comments_select_owner"
  ON ticket_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      JOIN properties p ON p.id = t.property_id
      WHERE t.id = ticket_comments.ticket_id
        AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "ticket_comments_select_creator" ON ticket_comments;
CREATE POLICY "ticket_comments_select_creator"
  ON ticket_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND t.created_by_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "ticket_comments_select_assigned" ON ticket_comments;
CREATE POLICY "ticket_comments_select_assigned"
  ON ticket_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND t.assigned_to = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "ticket_comments_insert" ON ticket_comments;
CREATE POLICY "ticket_comments_insert"
  ON ticket_comments FOR INSERT
  WITH CHECK (
    author_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "ticket_comments_select_admin" ON ticket_comments;
CREATE POLICY "ticket_comments_select_admin"
  ON ticket_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 10. Trigger updated_at pour tickets (si pas déjà présent)
CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tickets_updated_at ON tickets;
CREATE TRIGGER trigger_update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_updated_at();

COMMIT;

-- -----------------------------------------------------------------------------
-- 18/71 -- 20260408200000 -- DANGEREUX -- 20260408200000_unified_notification_system.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 18/71 (DANGEREUX) 20260408200000_unified_notification_system.sql'; END $$;
-- =====================================================
-- MIGRATION: Système de notifications unifié
-- Ajoute la table notification_event_preferences (per-event)
-- et les colonnes manquantes sur notifications
-- =====================================================

-- 1. Ajouter colonnes manquantes à notifications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'route') THEN
    ALTER TABLE notifications ADD COLUMN route TEXT;
    COMMENT ON COLUMN notifications.route IS 'Deep link route (e.g. /owner/invoices/xxx)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'channels_sent') THEN
    ALTER TABLE notifications ADD COLUMN channels_sent TEXT[] DEFAULT '{}';
    COMMENT ON COLUMN notifications.channels_sent IS 'Channels actually used: email, push, in_app, sms';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
    ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read_at') THEN
    ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'profile_id') THEN
    ALTER TABLE notifications ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Index for profile-based queries
CREATE INDEX IF NOT EXISTS idx_notif_profile_read_created
  ON notifications(profile_id, is_read, created_at DESC);

-- 2. Table de préférences par événement
CREATE TABLE IF NOT EXISTS notification_event_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_event_prefs_profile
  ON notification_event_preferences(profile_id);

ALTER TABLE notification_event_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own event preferences" ON notification_event_preferences;
CREATE POLICY "Users can view own event preferences"
  ON notification_event_preferences FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage own event preferences" ON notification_event_preferences;
CREATE POLICY "Users can manage own event preferences"
  ON notification_event_preferences FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Allow service role to insert
DROP POLICY IF EXISTS "Service can manage event preferences" ON notification_event_preferences;
CREATE POLICY "Service can manage event preferences"
  ON notification_event_preferences FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_notification_event_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notif_event_prefs ON notification_event_preferences;
CREATE TRIGGER trigger_update_notif_event_prefs
  BEFORE UPDATE ON notification_event_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_event_prefs_updated_at();

COMMENT ON TABLE notification_event_preferences IS 'Per-event notification channel preferences for each user';

SELECT 'Unified notification system migration complete' AS result;

COMMIT;

-- -----------------------------------------------------------------------------
-- 19/71 -- 20260408220000 -- DANGEREUX -- 20260408220000_payment_architecture_sota.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 19/71 (DANGEREUX) 20260408220000_payment_architecture_sota.sql'; END $$;
-- =====================================================
-- Migration: Payment Architecture SOTA 2026
-- Date: 2026-04-08
--
-- 1. rent_payments table (Stripe Connect Express)
-- 2. security_deposits table
-- 3. Invoice state machine alignment (7 états)
-- 4. RLS policies
-- 5. Helper functions
-- =====================================================

BEGIN;

-- =====================================================
-- 1. RENT PAYMENTS — Stripe Connect Express
-- Tracks the split between tenant payment, platform
-- commission, and owner payout
-- =====================================================

CREATE TABLE IF NOT EXISTS rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Montants (tous en centimes)
  amount_cents INTEGER NOT NULL,
  commission_amount_cents INTEGER NOT NULL,
  commission_rate NUMERIC(4,3) NOT NULL,
  owner_amount_cents INTEGER NOT NULL,

  -- Stripe Connect
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,
  payment_method TEXT DEFAULT 'sepa_debit'
    CHECK (payment_method IN ('sepa_debit', 'card', 'bank_transfer')),

  -- Statut
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'disputed')),

  -- Dates
  initiated_at TIMESTAMPTZ DEFAULT now(),
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate payments for same invoice
  UNIQUE(invoice_id, stripe_payment_intent_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rent_payments_invoice_id ON rent_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_lease_id ON rent_payments(lease_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_status ON rent_payments(status);
CREATE INDEX IF NOT EXISTS idx_rent_payments_stripe_pi ON rent_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_created_at ON rent_payments(created_at DESC);

-- RLS
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;

-- Owner can view rent payments for their properties
DROP POLICY IF EXISTS "Owner can view rent_payments" ON rent_payments;
CREATE POLICY "Owner can view rent_payments" ON rent_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN properties p ON i.lease_id = (SELECT lease_id FROM leases WHERE id = rent_payments.lease_id LIMIT 1)
      WHERE i.id = rent_payments.invoice_id
        AND i.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Tenant can view their own payments
DROP POLICY IF EXISTS "Tenant can view own rent_payments" ON rent_payments;
CREATE POLICY "Tenant can view own rent_payments" ON rent_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = rent_payments.invoice_id
        AND i.tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Admin full access
DROP POLICY IF EXISTS "Admin can manage rent_payments" ON rent_payments;
CREATE POLICY "Admin can manage rent_payments" ON rent_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role inserts (API routes use service role)
-- No INSERT policy needed for normal users — only backend inserts


-- =====================================================
-- 2. SECURITY DEPOSITS — Dépôts de garantie
-- =====================================================

CREATE TABLE IF NOT EXISTS security_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('sepa_debit', 'card', 'bank_transfer', 'check', 'cash')),

  -- Restitution
  restitution_amount_cents INTEGER,
  retenue_cents INTEGER DEFAULT 0,
  retenue_details JSONB DEFAULT '[]',
  restitution_due_date DATE,
  restituted_at TIMESTAMPTZ,
  restitution_method TEXT
    CHECK (restitution_method IS NULL OR restitution_method IN ('bank_transfer', 'check', 'sepa_credit')),

  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'partially_returned', 'returned', 'disputed')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_deposits_lease_id ON security_deposits(lease_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_tenant_id ON security_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_status ON security_deposits(status);

-- Trigger updated_at
CREATE OR REPLACE TRIGGER set_updated_at_security_deposits
  BEFORE UPDATE ON security_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE security_deposits ENABLE ROW LEVEL SECURITY;

-- Owner can manage deposits for their properties
DROP POLICY IF EXISTS "Owner can manage security_deposits" ON security_deposits;
CREATE POLICY "Owner can manage security_deposits" ON security_deposits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = security_deposits.lease_id
        AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Tenant can view their own deposits
DROP POLICY IF EXISTS "Tenant can view own security_deposits" ON security_deposits;
CREATE POLICY "Tenant can view own security_deposits" ON security_deposits
  FOR SELECT USING (
    tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin full access
DROP POLICY IF EXISTS "Admin can manage all security_deposits" ON security_deposits;
CREATE POLICY "Admin can manage all security_deposits" ON security_deposits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- =====================================================
-- 3. INVOICE STATUS ALIGNMENT
-- Add missing statuses to invoices CHECK constraint
-- Spec states: draft, sent, pending, paid, receipt_generated,
--              overdue, reminder_sent, collection, written_off
-- =====================================================

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- period_start / period_end for spec alignment
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'period_start') THEN
    ALTER TABLE invoices ADD COLUMN period_start DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'period_end') THEN
    ALTER TABLE invoices ADD COLUMN period_end DATE;
  END IF;

  -- rent_amount_cents / charges_amount_cents / total_amount_cents
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'rent_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN rent_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'charges_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN charges_amount_cents INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'total_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN total_amount_cents INTEGER;
  END IF;

  -- entity_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'entity_id') THEN
    ALTER TABLE invoices ADD COLUMN entity_id UUID REFERENCES legal_entities(id);
  END IF;

  -- receipt_document_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_document_id') THEN
    ALTER TABLE invoices ADD COLUMN receipt_document_id UUID REFERENCES documents(id);
  END IF;

  -- receipt_generated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_generated_at') THEN
    ALTER TABLE invoices ADD COLUMN receipt_generated_at TIMESTAMPTZ;
  END IF;

  -- last_reminder_at (alias for existing last_reminder_sent_at)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'last_reminder_at') THEN
    ALTER TABLE invoices ADD COLUMN last_reminder_at TIMESTAMPTZ;
  END IF;

  -- metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'metadata') THEN
    ALTER TABLE invoices ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;

  -- paid_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'paid_at') THEN
    ALTER TABLE invoices ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;

  -- stripe_invoice_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'stripe_invoice_id') THEN
    ALTER TABLE invoices ADD COLUMN stripe_invoice_id TEXT;
  END IF;
END $$;

-- Backfill cents columns from existing euro columns
UPDATE invoices
SET
  rent_amount_cents = COALESCE(ROUND(montant_loyer * 100)::INTEGER, 0),
  charges_amount_cents = COALESCE(ROUND(montant_charges * 100)::INTEGER, 0),
  total_amount_cents = COALESCE(ROUND(montant_total * 100)::INTEGER, 0)
WHERE rent_amount_cents IS NULL AND montant_loyer IS NOT NULL;

-- Backfill period_start/period_end from periode (format: YYYY-MM)
UPDATE invoices
SET
  period_start = (periode || '-01')::DATE,
  period_end = ((periode || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day')::DATE
WHERE period_start IS NULL AND periode IS NOT NULL;


-- =====================================================
-- 4. HELPER FUNCTION: Transition invoice status
-- Validates the state machine transitions
-- =====================================================

CREATE OR REPLACE FUNCTION transition_invoice_status(
  p_invoice_id UUID,
  p_new_status TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_allowed BOOLEAN := FALSE;
BEGIN
  SELECT statut INTO v_current_status
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;

  -- Validate transitions
  v_allowed := CASE
    WHEN v_current_status = 'draft' AND p_new_status = 'sent' THEN TRUE
    WHEN v_current_status = 'sent' AND p_new_status IN ('pending', 'paid', 'overdue') THEN TRUE
    WHEN v_current_status = 'pending' AND p_new_status IN ('paid', 'overdue') THEN TRUE
    WHEN v_current_status = 'paid' AND p_new_status = 'receipt_generated' THEN TRUE
    WHEN v_current_status = 'overdue' AND p_new_status IN ('paid', 'reminder_sent') THEN TRUE
    WHEN v_current_status = 'reminder_sent' AND p_new_status IN ('paid', 'collection') THEN TRUE
    WHEN v_current_status = 'collection' AND p_new_status IN ('paid', 'written_off') THEN TRUE
    -- Legacy status compatibility
    WHEN v_current_status = 'late' AND p_new_status IN ('paid', 'overdue', 'reminder_sent') THEN TRUE
    WHEN v_current_status = 'unpaid' AND p_new_status IN ('paid', 'overdue') THEN TRUE
    ELSE FALSE
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', v_current_status, p_new_status;
  END IF;

  UPDATE invoices
  SET
    statut = p_new_status,
    paid_at = CASE WHEN p_new_status = 'paid' THEN now() ELSE paid_at END,
    receipt_generated_at = CASE WHEN p_new_status = 'receipt_generated' THEN now() ELSE receipt_generated_at END,
    last_reminder_at = CASE WHEN p_new_status = 'reminder_sent' THEN now() ELSE last_reminder_at END,
    metadata = COALESCE(metadata, '{}'::JSONB) || p_metadata,
    updated_at = now()
  WHERE id = p_invoice_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 5. HELPER: Get owner Connect account for a property
-- =====================================================

CREATE OR REPLACE FUNCTION get_owner_connect_account_for_invoice(p_invoice_id UUID)
RETURNS TABLE(
  stripe_account_id TEXT,
  charges_enabled BOOLEAN,
  owner_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sca.stripe_account_id,
    sca.charges_enabled,
    i.owner_id
  FROM invoices i
  JOIN profiles p ON i.owner_id = p.id
  LEFT JOIN stripe_connect_accounts sca ON sca.owner_id = p.id AND sca.status = 'active'
  WHERE i.id = p_invoice_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 6. PERFORMANCE INDEXES
-- =====================================================

-- Fast lookups for overdue invoices (cron)
CREATE INDEX IF NOT EXISTS idx_invoices_overdue_check
  ON invoices(due_date, statut)
  WHERE statut IN ('sent', 'pending', 'overdue', 'late');

-- Fast lookups for receipt generation
CREATE INDEX IF NOT EXISTS idx_invoices_receipt_pending
  ON invoices(id)
  WHERE statut = 'paid' AND receipt_generated IS NOT TRUE;


COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 20/71 -- 20260409100000 -- MODERE -- 20260409100000_add_missing_rls.sql
-- risk: +13 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 20/71 (MODERE) 20260409100000_add_missing_rls.sql'; END $$;
-- ==========================================================
-- Migration: Add missing RLS to 8 unprotected tables
-- Date: 2026-04-09
-- Context: Audit express identified 8 tables without RLS
-- ==========================================================

-- ──────────────────────────────────────────────
-- 1. tenants (system multi-tenant table, no user column)
-- Admin-only access via service role
-- ──────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_admin_only" ON tenants;
CREATE POLICY "tenants_admin_only"
  ON tenants FOR ALL
  USING (false);
-- Service role bypasses RLS; app code uses service client for admin ops

-- ──────────────────────────────────────────────
-- 2. two_factor_sessions (security-critical, has user_id)
-- ──────────────────────────────────────────────
ALTER TABLE two_factor_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_2fa_sessions" ON two_factor_sessions;
CREATE POLICY "users_own_2fa_sessions"
  ON two_factor_sessions FOR ALL
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 3. lease_templates (system-wide templates, read-only for users)
-- ──────────────────────────────────────────────
ALTER TABLE lease_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_templates_read_authenticated" ON lease_templates;
CREATE POLICY "lease_templates_read_authenticated"
  ON lease_templates FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lease_templates_write_admin_only" ON lease_templates;
CREATE POLICY "lease_templates_write_admin_only"
  ON lease_templates FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 4. idempotency_keys (API utility, no user column)
-- ──────────────────────────────────────────────
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "idempotency_keys_service_only" ON idempotency_keys;
CREATE POLICY "idempotency_keys_service_only"
  ON idempotency_keys FOR ALL
  USING (false);
-- Only accessed via service role in API middleware

-- ──────────────────────────────────────────────
-- 5. repair_cost_grid (reference table, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE repair_cost_grid ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "repair_cost_grid_read_authenticated" ON repair_cost_grid;
CREATE POLICY "repair_cost_grid_read_authenticated"
  ON repair_cost_grid FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "repair_cost_grid_write_admin_only" ON repair_cost_grid;
CREATE POLICY "repair_cost_grid_write_admin_only"
  ON repair_cost_grid FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 6. vetuste_grid (reference table for depreciation, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE vetuste_grid ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vetuste_grid_read_authenticated" ON vetuste_grid;
CREATE POLICY "vetuste_grid_read_authenticated"
  ON vetuste_grid FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "vetuste_grid_write_admin_only" ON vetuste_grid;
CREATE POLICY "vetuste_grid_write_admin_only"
  ON vetuste_grid FOR ALL
  USING (false);

-- ──────────────────────────────────────────────
-- 7. vetusty_grid (variant of vetuste_grid, read-only)
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_grid') THEN
    ALTER TABLE vetusty_grid ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_grid') THEN
    EXECUTE 'DROP POLICY IF EXISTS "vetusty_grid_read_authenticated" ON vetusty_grid';
    EXECUTE 'CREATE POLICY "vetusty_grid_read_authenticated" ON vetusty_grid FOR SELECT USING (auth.role() = ''authenticated'')';
    EXECUTE 'DROP POLICY IF EXISTS "vetusty_grid_write_admin_only" ON vetusty_grid';
    EXECUTE 'CREATE POLICY "vetusty_grid_write_admin_only" ON vetusty_grid FOR ALL USING (false)';
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- 8. api_webhook_deliveries (indirect user link via webhook_id)
-- ──────────────────────────────────────────────
ALTER TABLE api_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_deliveries_owner_access" ON api_webhook_deliveries;
CREATE POLICY "webhook_deliveries_owner_access"
  ON api_webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_webhooks w
      WHERE w.id = api_webhook_deliveries.webhook_id
        AND w.profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "webhook_deliveries_write_service_only" ON api_webhook_deliveries;
CREATE POLICY "webhook_deliveries_write_service_only"
  ON api_webhook_deliveries FOR INSERT
  WITH CHECK (false);
-- Deliveries are created by the system (service role), users can only read their own

COMMIT;

-- -----------------------------------------------------------------------------
-- 21/71 -- 20260409110000 -- DANGEREUX -- 20260409110000_fix_remaining_rls_recursion.sql
-- risk: UPDATE sans WHERE : to
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 21/71 (DANGEREUX) 20260409110000_fix_remaining_rls_recursion.sql'; END $$;
-- =====================================================
-- MIGRATION: Fix remaining RLS recursion on tables still using
--            direct sub-queries on profiles instead of get_my_profile_id()
-- Date: 2026-04-09
-- Problem: subscription_usage_metrics and api_webhook_deliveries still use
--          SELECT id FROM profiles WHERE user_id = auth.uid() in their RLS policies,
--          causing infinite recursion (42P17) when profiles table has RLS enabled.
-- Solution: Replace with public.get_my_profile_id() (SECURITY DEFINER, bypasses RLS).
-- =====================================================

-- ============================================
-- 1. FIX subscription_usage_metrics
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_usage_metrics') THEN
    DROP POLICY IF EXISTS "Owner can view own usage metrics" ON subscription_usage_metrics;
    CREATE POLICY "Owner can view own usage metrics" ON subscription_usage_metrics
      FOR SELECT TO authenticated
      USING (owner_id = public.get_my_profile_id());
  END IF;
END $$;

-- ============================================
-- 2. FIX api_webhook_deliveries
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_webhook_deliveries') THEN
    DROP POLICY IF EXISTS "webhook_deliveries_owner_access" ON api_webhook_deliveries;
    CREATE POLICY "webhook_deliveries_owner_access" ON api_webhook_deliveries
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM api_webhooks w
          WHERE w.id = api_webhook_deliveries.webhook_id
            AND w.profile_id = public.get_my_profile_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 3. FIX rgpd_consent_records (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rgpd_consent_records') THEN
    DROP POLICY IF EXISTS "consent_records_select_own" ON rgpd_consent_records;
    DROP POLICY IF EXISTS "consent_records_insert_own" ON rgpd_consent_records;
    CREATE POLICY "consent_records_select_own" ON rgpd_consent_records
      FOR SELECT TO authenticated
      USING (
        profile_id = public.get_my_profile_id()
      );
    CREATE POLICY "consent_records_insert_own" ON rgpd_consent_records
      FOR INSERT TO authenticated
      WITH CHECK (
        profile_id = public.get_my_profile_id()
      );
  END IF;
END $$;

-- ============================================
-- 4. FIX rgpd_data_requests (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rgpd_data_requests') THEN
    DROP POLICY IF EXISTS "data_requests_select_own" ON rgpd_data_requests;
    DROP POLICY IF EXISTS "data_requests_insert_own" ON rgpd_data_requests;
    DROP POLICY IF EXISTS "data_requests_update_own" ON rgpd_data_requests;
    CREATE POLICY "data_requests_select_own" ON rgpd_data_requests
      FOR SELECT TO authenticated
      USING (
        profile_id = public.get_my_profile_id()
      );
    CREATE POLICY "data_requests_insert_own" ON rgpd_data_requests
      FOR INSERT TO authenticated
      WITH CHECK (
        profile_id = public.get_my_profile_id()
      );
    CREATE POLICY "data_requests_update_own" ON rgpd_data_requests
      FOR UPDATE TO authenticated
      USING (
        profile_id = public.get_my_profile_id()
      );
  END IF;
END $$;

-- ============================================
-- 5. FIX rgpd_processing_activities (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rgpd_processing_activities') THEN
    DROP POLICY IF EXISTS "processing_activities_select_own" ON rgpd_processing_activities;
    CREATE POLICY "processing_activities_select_own" ON rgpd_processing_activities
      FOR SELECT TO authenticated
      USING (
        profile_id IN (SELECT public.get_my_profile_id())
      );
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '=== Migration RLS recursion fix (remaining tables) applied ===';
  RAISE NOTICE 'Fixed: subscription_usage_metrics, api_webhook_deliveries, rgpd_consent_records, rgpd_data_requests, rgpd_processing_activities';
  RAISE NOTICE 'Method: get_my_profile_id() SECURITY DEFINER instead of direct sub-queries';
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 22/71 -- 20260409120000 -- MODERE -- 20260409120000_fix_subscriptions_rls_recursion.sql
-- risk: +3 policies, -3 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 22/71 (MODERE) 20260409120000_fix_subscriptions_rls_recursion.sql'; END $$;
-- =====================================================
-- MIGRATION: Ensure subscriptions RLS uses get_my_profile_id() (no recursion)
-- Date: 2026-04-09
-- Problem: The "Owners can view their subscription" policy may still use a direct
--          sub-query on profiles (SELECT id FROM profiles WHERE user_id = auth.uid()),
--          which triggers infinite recursion (42P17) when profiles RLS is active.
--          Additionally, subscriptions has no INSERT/UPDATE policies for owners,
--          meaning writes must go through service_role only (which is correct).
-- Solution: Idempotently replace the SELECT policy with get_my_profile_id() (SECURITY DEFINER).
-- =====================================================

-- 1. Drop and recreate the owner SELECT policy to guarantee it uses get_my_profile_id()
DROP POLICY IF EXISTS "Owners can view their subscription" ON subscriptions;
CREATE POLICY "Owners can view their subscription" ON subscriptions
  FOR SELECT TO authenticated
  USING (owner_id = public.get_my_profile_id());

-- 2. Ensure admin policy also uses is_admin() (SECURITY DEFINER)
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin());

-- 3. Fix subscription_addon_subscriptions if it exists (may also have recursion)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_addon_subscriptions') THEN
    DROP POLICY IF EXISTS "addon_subs_owner_select" ON subscription_addon_subscriptions;
    CREATE POLICY "addon_subs_owner_select" ON subscription_addon_subscriptions
      FOR SELECT TO authenticated
      USING (
        subscription_id IN (
          SELECT id FROM subscriptions
          WHERE owner_id = public.get_my_profile_id()
        )
      );
  END IF;
END $$;

-- 4. Verification
DO $$
BEGIN
  RAISE NOTICE '=== Migration: subscriptions RLS recursion fix applied ===';
  RAISE NOTICE 'Policies replaced: Owners can view their subscription, Admins can view all subscriptions';
  RAISE NOTICE 'Method: get_my_profile_id() / is_admin() SECURITY DEFINER';
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 23/71 -- 20260409130000 -- CRITIQUE -- 20260409130000_fix_subscriptions_status_check.sql
-- risk: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 23/71 (CRITIQUE) 20260409130000_fix_subscriptions_status_check.sql'; END $$;
-- =====================================================
-- MIGRATION: Add 'expired' status to subscriptions CHECK constraint
-- Date: 2026-04-09
-- Problem: Application code sets status='expired' for expired trials,
--          but the CHECK constraint only allows:
--          'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete'
--          This causes silent write failures (fire-and-forget updates fail).
-- Solution: Drop old constraint, add new one including 'expired' and 'suspended'.
-- =====================================================

-- Drop the existing CHECK constraint on status
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;

-- Recreate with all valid statuses
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid',
    'paused', 'incomplete', 'expired', 'suspended'
  ));

-- Verification
DO $$
BEGIN
  RAISE NOTICE '=== Migration: subscriptions status CHECK updated (added expired, suspended) ===';
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 24/71 -- 20260409140000 -- MODERE -- 20260409140000_fix_addons_sms_rls_recursion.sql
-- risk: +2 policies, -2 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 24/71 (MODERE) 20260409140000_fix_addons_sms_rls_recursion.sql'; END $$;
-- =====================================================
-- MIGRATION: Fix RLS on subscription_addons & sms_usage
-- Date: 2026-04-09
-- Problem: Both tables use `profile_id = auth.uid()` which is WRONG.
--          `profile_id` references `profiles.id` (a profile UUID),
--          while `auth.uid()` returns the user's auth UUID (user_id).
--          These are DIFFERENT values, so the condition NEVER matches
--          and users can never see their own data.
-- Solution: Replace with `profile_id = public.get_my_profile_id()`
--           which is SECURITY DEFINER and returns the correct profiles.id.
-- =====================================================

-- 1. Fix subscription_addons
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_addons') THEN
    DROP POLICY IF EXISTS "Users can view their own addons" ON subscription_addons;
    CREATE POLICY "Users can view their own addons" ON subscription_addons
      FOR SELECT TO authenticated
      USING (profile_id = public.get_my_profile_id());
  END IF;
END $$;

-- 2. Fix sms_usage
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sms_usage') THEN
    DROP POLICY IF EXISTS "Users can view their own sms usage" ON sms_usage;
    CREATE POLICY "Users can view their own sms usage" ON sms_usage
      FOR SELECT TO authenticated
      USING (profile_id = public.get_my_profile_id());
  END IF;
END $$;

-- 3. Verification
DO $$
BEGIN
  RAISE NOTICE '=== Migration: subscription_addons & sms_usage RLS fixed ===';
  RAISE NOTICE 'Changed: profile_id = auth.uid() → profile_id = public.get_my_profile_id()';
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 25/71 -- 20260409150000 -- SAFE -- 20260409150000_fix_signature_tracking_and_analytics.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 25/71 (SAFE) 20260409150000_fix_signature_tracking_and_analytics.sql'; END $$;
-- =====================================================
-- MIGRATION: Fix 2 SQL bugs (signature tracking + analytics view)
-- Date: 2026-04-09
-- =====================================================

-- ============================================================
-- BUG 2: "column reference period_month is ambiguous"
-- The RETURNS TABLE column `period_month` clashes with
-- subscription_usage.period_month in PL/pgSQL queries.
-- Fix: prefix all column references with the table name.
-- ============================================================

-- Fix get_signature_usage
CREATE OR REPLACE FUNCTION get_signature_usage(p_subscription_id UUID)
RETURNS TABLE (
  signatures_used INTEGER,
  signatures_limit INTEGER,
  signatures_remaining INTEGER,
  usage_percentage INTEGER,
  period_month TEXT,
  last_signature_at TIMESTAMPTZ
) AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
  v_last_at TIMESTAMPTZ;
BEGIN
  SELECT
    COALESCE(SUM(su.quantity), 0)::INTEGER,
    MAX(su.created_at)
  INTO v_used, v_last_at
  FROM subscription_usage su
  WHERE su.subscription_id = p_subscription_id
    AND su.usage_type = 'signature'
    AND su.period_month = v_current_month;

  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  v_limit := COALESCE(v_limit, 0);
  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    v_used,
    v_limit,
    CASE WHEN v_limit = -1 THEN 999999 ELSE GREATEST(0, v_limit - v_used) END,
    CASE
      WHEN v_limit = -1 THEN 0
      WHEN v_limit = 0 THEN 100
      ELSE LEAST(100, (v_used * 100) / NULLIF(v_limit, 0))
    END::INTEGER,
    v_current_month,
    v_last_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fix increment_signature_usage
CREATE OR REPLACE FUNCTION increment_signature_usage(
  p_subscription_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT COALESCE(SUM(su.quantity), 0)::INTEGER
  INTO v_used
  FROM subscription_usage su
  WHERE su.subscription_id = p_subscription_id
    AND su.usage_type = 'signature'
    AND su.period_month = v_current_month;

  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  IF v_limit != -1 AND (COALESCE(v_used, 0) + p_quantity) > v_limit THEN
    RETURN false;
  END IF;

  INSERT INTO subscription_usage (
    subscription_id, usage_type, quantity, period_month, metadata
  ) VALUES (
    p_subscription_id, 'signature', p_quantity, v_current_month, p_metadata
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix can_use_signature
CREATE OR REPLACE FUNCTION can_use_signature(p_subscription_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT COALESCE(SUM(su.quantity), 0)::INTEGER
  INTO v_used
  FROM subscription_usage su
  WHERE su.subscription_id = p_subscription_id
    AND su.usage_type = 'signature'
    AND su.period_month = v_current_month;

  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  IF v_limit = -1 THEN RETURN true; END IF;
  RETURN v_used < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- BUG 3: "column i.created_at must appear in the GROUP BY clause"
-- The mv_owner_monthly_stats materialized view was created with
-- IF NOT EXISTS, so it may be stale. Drop and recreate.
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_owner_monthly_stats;

CREATE MATERIALIZED VIEW mv_owner_monthly_stats AS
SELECT
  p.id AS owner_id,
  DATE_TRUNC('month', i.created_at) AS month,
  COUNT(DISTINCT prop.id) AS properties_count,
  COUNT(DISTINCT l.id) AS active_leases_count,
  COUNT(DISTINCT i.id) AS invoices_count,
  COALESCE(SUM(i.montant_total), 0) AS total_invoiced,
  COALESCE(SUM(CASE WHEN i.statut = 'paid' THEN i.montant_total ELSE 0 END), 0) AS total_collected,
  COALESCE(SUM(CASE WHEN i.statut = 'late' THEN i.montant_total ELSE 0 END), 0) AS total_late,
  COUNT(CASE WHEN i.statut = 'paid' THEN 1 END) AS paid_invoices_count,
  COUNT(CASE WHEN i.statut = 'late' THEN 1 END) AS late_invoices_count,
  ROUND(
    CASE
      WHEN COUNT(i.id) > 0
      THEN COUNT(CASE WHEN i.statut = 'paid' THEN 1 END)::DECIMAL / COUNT(i.id) * 100
      ELSE 0
    END, 2
  ) AS collection_rate
FROM profiles p
LEFT JOIN properties prop ON prop.owner_id = p.id
LEFT JOIN leases l ON l.property_id = prop.id AND l.statut = 'active'
LEFT JOIN invoices i ON i.owner_id = p.id
WHERE p.role = 'owner'
GROUP BY p.id, DATE_TRUNC('month', i.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_owner_monthly_stats
  ON mv_owner_monthly_stats(owner_id, month);


-- Verification
DO $$ BEGIN
  RAISE NOTICE 'Fixed: signature tracking period_month ambiguity + analytics GROUP BY';
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 26/71 -- 20260409160000 -- DANGEREUX -- 20260409160000_building_unit_lease_document_fk.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 26/71 (DANGEREUX) 20260409160000_building_unit_lease_document_fk.sql'; END $$;
-- ============================================
-- Migration : FK building_unit_id sur leases et documents
-- Sprint 2+3 : Permettre baux et documents par lot d'immeuble
-- ============================================

-- 1. FK leases → building_units
-- ============================================
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS building_unit_id UUID
    REFERENCES building_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leases_building_unit_id
  ON leases(building_unit_id) WHERE building_unit_id IS NOT NULL;

COMMENT ON COLUMN leases.building_unit_id IS
  'Lot d''immeuble associé (si le bail concerne un lot spécifique)';

-- 2. FK documents → building_units
-- ============================================
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS building_unit_id UUID
    REFERENCES building_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_building_unit_id
  ON documents(building_unit_id) WHERE building_unit_id IS NOT NULL;

COMMENT ON COLUMN documents.building_unit_id IS
  'Lot d''immeuble associé (diagnostics lot, bail lot, EDL lot)';

-- 3. Colonne parent_property_id sur properties
-- ============================================
-- Les properties créées pour des lots d'immeuble pointent vers la property parent (type=immeuble).
-- Permet de les exclure de "Mes biens" et de les rattacher à l'immeuble.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS parent_property_id UUID
    REFERENCES properties(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_properties_parent_property
  ON properties(parent_property_id) WHERE parent_property_id IS NOT NULL;

COMMENT ON COLUMN properties.parent_property_id IS
  'Si non-null, cette property est un lot d''immeuble rattaché à la property parent';

-- 4. Mise à jour building_units.status depuis les baux actifs
-- ============================================
-- Quand un bail actif est lié à un lot, le lot passe en "occupe"
CREATE OR REPLACE FUNCTION sync_building_unit_status_from_lease()
RETURNS TRIGGER AS $$
BEGIN
  -- Bail activé → lot occupé
  IF NEW.statut = 'active' AND NEW.building_unit_id IS NOT NULL THEN
    UPDATE building_units
    SET status = 'occupe', current_lease_id = NEW.id
    WHERE id = NEW.building_unit_id;
  END IF;

  -- Bail terminé → lot vacant
  IF NEW.statut IN ('terminated', 'archived', 'cancelled')
     AND OLD.statut = 'active'
     AND NEW.building_unit_id IS NOT NULL THEN
    UPDATE building_units
    SET status = 'vacant', current_lease_id = NULL
    WHERE id = NEW.building_unit_id AND current_lease_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_unit_status_on_lease ON leases;
CREATE TRIGGER trigger_sync_unit_status_on_lease
  AFTER UPDATE ON leases
  FOR EACH ROW
  WHEN (OLD.statut IS DISTINCT FROM NEW.statut)
  EXECUTE FUNCTION sync_building_unit_status_from_lease();

COMMIT;

-- -----------------------------------------------------------------------------
-- 27/71 -- 20260409170000 -- DANGEREUX -- 20260409170000_backfill_building_unit_properties.sql
-- risk: UPDATE sans WHERE : on,on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 27/71 (DANGEREUX) 20260409170000_backfill_building_unit_properties.sql'; END $$;
-- ============================================
-- Migration : Compléter le schéma buildings + backfill lots
--
-- La table buildings existait depuis la migration copropriété (20251208)
-- avec un schéma minimal (site_id, name, code, floors_count, has_elevator).
-- Cette migration ajoute les colonnes nécessaires pour le module immeuble
-- locatif (property_id, owner_id, adresse, amenities) puis crée les
-- properties individuelles pour chaque lot.
-- ============================================

-- ============================================
-- 1. Colonnes manquantes sur buildings
-- ============================================
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS adresse_complete TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS code_postal TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS ville TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS departement TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS floors INTEGER DEFAULT 1;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS surface_totale DECIMAL(10, 2);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_ascenseur BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_gardien BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_interphone BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_digicode BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_local_velo BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_local_poubelles BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_parking_commun BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_jardin_commun BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_buildings_owner ON buildings(owner_id);
CREATE INDEX IF NOT EXISTS idx_buildings_property ON buildings(property_id);
CREATE INDEX IF NOT EXISTS idx_buildings_ville ON buildings(ville);
CREATE INDEX IF NOT EXISTS idx_buildings_code_postal ON buildings(code_postal);

-- ============================================
-- 2. Table building_units si elle n'existe pas
-- ============================================
CREATE TABLE IF NOT EXISTS building_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL DEFAULT 0 CHECK (floor >= -5 AND floor <= 50),
  position TEXT NOT NULL DEFAULT 'A',
  type TEXT NOT NULL CHECK (type IN (
    'appartement', 'studio', 'local_commercial', 'parking', 'cave', 'bureau'
  )),
  template TEXT CHECK (template IN (
    'studio', 't1', 't2', 't3', 't4', 't5', 'local', 'parking', 'cave'
  )),
  surface DECIMAL(8, 2) NOT NULL CHECK (surface > 0),
  nb_pieces INTEGER DEFAULT 1 CHECK (nb_pieces >= 0),
  loyer_hc DECIMAL(10, 2) DEFAULT 0 CHECK (loyer_hc >= 0),
  charges DECIMAL(10, 2) DEFAULT 0 CHECK (charges >= 0),
  depot_garantie DECIMAL(10, 2) DEFAULT 0 CHECK (depot_garantie >= 0),
  status TEXT DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupe', 'travaux', 'reserve')),
  current_lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(building_id, floor, position)
);

-- Colonnes manquantes sur building_units si la table existait déjà
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS template TEXT;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS loyer_hc DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS charges DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS depot_garantie DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'vacant';
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS current_lease_id UUID REFERENCES leases(id) ON DELETE SET NULL;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_building_units_building ON building_units(building_id);
CREATE INDEX IF NOT EXISTS idx_building_units_property ON building_units(property_id);
CREATE INDEX IF NOT EXISTS idx_building_units_status ON building_units(status);

-- ============================================
-- 3. Triggers updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_buildings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_buildings_updated_at ON buildings;
CREATE TRIGGER trigger_buildings_updated_at
  BEFORE UPDATE ON buildings
  FOR EACH ROW
  EXECUTE FUNCTION update_buildings_updated_at();

DROP TRIGGER IF EXISTS trigger_building_units_updated_at ON building_units;
CREATE TRIGGER trigger_building_units_updated_at
  BEFORE UPDATE ON building_units
  FOR EACH ROW
  EXECUTE FUNCTION update_buildings_updated_at();

-- ============================================
-- 4. RLS
-- ============================================
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_units ENABLE ROW LEVEL SECURITY;

-- Service role bypass (pour les API routes)
DROP POLICY IF EXISTS "Service role full access buildings" ON buildings;
CREATE POLICY "Service role full access buildings" ON buildings
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access building_units" ON building_units;
CREATE POLICY "Service role full access building_units" ON building_units
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 5. Backfill : property par lot (si des lots existent)
-- ============================================

-- Fonction utilitaire temporaire
CREATE OR REPLACE FUNCTION _gen_prop_code()
RETURNS TEXT AS $$
DECLARE
  charset TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT;
  i INT;
BEGIN
  LOOP
    result := 'PROP-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM properties WHERE unique_code = result);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  rec RECORD;
  new_pid UUID;
  new_code TEXT;
  pp RECORD;
  lot_addr TEXT;
  fl TEXT;
BEGIN
  -- Parcourir building_units sans property_id, reliés à un building ayant property_id
  FOR rec IN
    SELECT
      bu.id AS unit_id, bu.building_id, bu.floor, bu.position,
      bu.type, bu.surface, bu.nb_pieces, bu.loyer_hc, bu.charges,
      bu.depot_garantie, bu.status,
      b.property_id AS parent_pid, b.has_ascenseur
    FROM building_units bu
    JOIN buildings b ON b.id = bu.building_id
    WHERE bu.property_id IS NULL
      AND b.property_id IS NOT NULL
  LOOP
    -- Parent property
    SELECT owner_id, legal_entity_id, adresse_complete, code_postal, ville, departement, etat
    INTO pp FROM properties WHERE id = rec.parent_pid;

    IF pp IS NULL THEN CONTINUE; END IF;

    -- Floor label
    IF rec.floor < 0 THEN fl := 'SS' || abs(rec.floor);
    ELSIF rec.floor = 0 THEN fl := 'RDC';
    ELSE fl := 'Étage ' || rec.floor;
    END IF;

    lot_addr := COALESCE(pp.adresse_complete, '') || ' - Lot ' || rec.position || ', ' || fl;
    new_code := _gen_prop_code();

    INSERT INTO properties (
      owner_id, legal_entity_id, parent_property_id, type, etat, unique_code,
      adresse_complete, code_postal, ville, departement,
      surface, nb_pieces, nb_chambres, ascenseur, meuble, loyer_hc, charges_mensuelles
    ) VALUES (
      pp.owner_id, pp.legal_entity_id, rec.parent_pid, rec.type,
      CASE WHEN pp.etat = 'published' THEN 'published' ELSE 'draft' END,
      new_code, lot_addr,
      COALESCE(pp.code_postal, ''), COALESCE(pp.ville, ''), COALESCE(pp.departement, ''),
      rec.surface, rec.nb_pieces, 0,
      COALESCE(rec.has_ascenseur, false),
      rec.type IN ('studio', 'local_commercial'),
      COALESCE(rec.loyer_hc, 0), COALESCE(rec.charges, 0)
    ) RETURNING id INTO new_pid;

    UPDATE building_units SET property_id = new_pid WHERE id = rec.unit_id;
    RAISE NOTICE 'Lot %/% → property %', rec.position, fl, new_pid;
  END LOOP;

  -- Backfill parent_property_id pour lots existants qui l'ont pas
  UPDATE properties p
  SET parent_property_id = b.property_id
  FROM building_units bu
  JOIN buildings b ON b.id = bu.building_id
  WHERE bu.property_id = p.id
    AND p.parent_property_id IS NULL
    AND b.property_id IS NOT NULL
    AND b.property_id != p.id;
END;
$$;

DROP FUNCTION IF EXISTS _gen_prop_code();

COMMIT;

-- -----------------------------------------------------------------------------
-- 28/71 -- 20260409180000 -- MODERE -- 20260409180000_buildings_site_id_nullable.sql
-- risk: ALTER column (type/constraint)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 28/71 (MODERE) 20260409180000_buildings_site_id_nullable.sql'; END $$;
-- ============================================
-- Migration : Rendre site_id nullable sur buildings
--
-- La colonne site_id (FK vers sites) a été créée NOT NULL par la
-- migration copropriété (20251208). Pour les immeubles locatifs
-- gérés par un propriétaire, il n'y a pas de site de copropriété :
-- site_id doit être nullable.
-- ============================================

ALTER TABLE buildings ALTER COLUMN site_id DROP NOT NULL;

COMMIT;

-- -----------------------------------------------------------------------------
-- 29/71 -- 20260410100000 -- SAFE -- 20260410100000_accounting_missing_indexes.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 29/71 (SAFE) 20260410100000_accounting_missing_indexes.sql'; END $$;
-- =====================================================
-- MIGRATION: Accounting — missing indexes for hot queries
-- Date: 2026-04-10
--
-- Audit P2-4 follow-up. Adds composite / trigram indexes that
-- accelerate the three slowest owner-accounting queries:
--
--  1. Grand-livre par exercice + compte
--     (join accounting_entries × accounting_entry_lines filtered by
--      exercise_id and account_number)
--
--  2. Dashboard rapprochement bancaire
--     (bank_transactions filtered by connection_id + reconciliation_status
--      and sorted by transaction_date DESC)
--
--  3. Recherche plein-texte sur le libellé des écritures
--     (EntriesPageClient search input → ilike on accounting_entries.label)
--
-- All statements are idempotent (CREATE INDEX IF NOT EXISTS).
-- pg_trgm is already enabled by supabase/migrations/20240101000000_initial_schema.sql:6
-- so no CREATE EXTENSION is needed here.
-- =====================================================

-- ---------------------------------------------------------------
-- 1. Grand-livre acceleration
-- ---------------------------------------------------------------
-- `accounting_entry_lines` does NOT carry `exercise_id` (the exercise
-- lives on the parent `accounting_entries`), so the canonical composite
-- `(exercise_id, account_number)` would have to live on the parent
-- table. We add the two indexes that together cover the join:
--
--   SELECT ... FROM accounting_entry_lines l
--   JOIN accounting_entries e ON e.id = l.entry_id
--   WHERE e.exercise_id = $1 AND l.account_number LIKE $2
--   ORDER BY e.entry_date ASC;

CREATE INDEX IF NOT EXISTS idx_entries_exercise_date
  ON accounting_entries(exercise_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_entry_lines_account_entry
  ON accounting_entry_lines(account_number, entry_id);

-- ---------------------------------------------------------------
-- 2. Bank reconciliation dashboard
-- ---------------------------------------------------------------
-- `bank_transactions` has no `entity_id` column — the entity is
-- resolved via bank_connections. The composite index therefore uses
-- `connection_id` + `reconciliation_status` + `transaction_date`, which
-- matches /api/accounting/bank/reconciliation/route.ts query shape.

CREATE INDEX IF NOT EXISTS idx_bank_tx_connection_status_date
  ON bank_transactions(connection_id, reconciliation_status, transaction_date DESC);

-- ---------------------------------------------------------------
-- 3. Full-text search on entry labels
-- ---------------------------------------------------------------
-- Powers the search box in EntriesPageClient which runs
--   .or('label.ilike.%X%,piece_ref.ilike.%X%')
-- A GIN trigram index makes ILIKE %X% selective instead of a seq scan.
-- pg_trgm is enabled globally in 20240101000000_initial_schema.sql.

CREATE INDEX IF NOT EXISTS idx_entries_label_trgm
  ON accounting_entries USING gin(label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entries_piece_ref_trgm
  ON accounting_entries USING gin(piece_ref gin_trgm_ops);

COMMIT;

-- -----------------------------------------------------------------------------
-- 30/71 -- 20260410110000 -- SAFE -- 20260410110000_cleanup_orphan_analyses.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 30/71 (SAFE) 20260410110000_cleanup_orphan_analyses.sql'; END $$;
-- =====================================================
-- MIGRATION: Cleanup orphan document_analyses
-- Date: 2026-04-10
--
-- Audit P2-7 follow-up. `document_analyses` rows reference a
-- `document_id` that can be deleted from the `documents` table
-- independently (soft delete, user purge, tenant exit, etc.). When
-- that happens, the analysis row stays behind forever.
--
-- This migration adds:
--   1. A SECURITY DEFINER cleanup function that deletes analyses whose
--      parent document no longer exists AND that are older than 7 days
--      (the grace period gives the backfill / retry flows time to
--      re-link a recreated document without losing OCR work).
--   2. A weekly pg_cron schedule at 03:00 every Sunday. pg_cron is
--      already enabled project-wide via
--      supabase/migrations/20260304100000_activate_pg_cron_schedules.sql
--      so we can schedule in the same migration; if it were not, the
--      cron.schedule call would simply no-op and an admin would need to
--      activate pg_cron from the Supabase dashboard before re-running.
--
-- All statements are idempotent (CREATE OR REPLACE / DO-block guards).
-- =====================================================

-- ---------------------------------------------------------------
-- 1. Cleanup function
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_cleanup_orphan_document_analyses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.document_analyses da
  WHERE da.document_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.documents d WHERE d.id = da.document_id
    )
    AND da.created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION fn_cleanup_orphan_document_analyses IS
  'Supprime les lignes document_analyses dont le document parent '
  'n''existe plus depuis au moins 7 jours. Planifié via pg_cron '
  '(cron schedule: cleanup-orphan-analyses).';

-- ---------------------------------------------------------------
-- 2. Weekly schedule via pg_cron
-- ---------------------------------------------------------------
-- Runs every Sunday at 03:00 UTC. Wrapped in a DO block so the
-- migration stays idempotent and doesn't fail if pg_cron hasn't been
-- activated yet on this project — in that case it logs a NOTICE and
-- an admin can run the SELECT manually from the Supabase SQL editor
-- once pg_cron is enabled.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Unschedule any previous version with the same name, then reschedule.
    PERFORM cron.unschedule('cleanup-orphan-analyses')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphan-analyses'
    );

    PERFORM cron.schedule(
      'cleanup-orphan-analyses',
      '0 3 * * 0',
      $cron$SELECT public.fn_cleanup_orphan_document_analyses();$cron$
    );
  ELSE
    RAISE NOTICE E'pg_cron extension not installed; skipping schedule. Enable pg_cron from the Supabase dashboard and run:\n  SELECT cron.schedule(''cleanup-orphan-analyses'', ''0 3 * * 0'', ''SELECT public.fn_cleanup_orphan_document_analyses();'');';
  END IF;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 31/71 -- 20260410180000 -- MODERE -- 20260410180000_fix_invoice_generation_sota.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 31/71 (MODERE) 20260410180000_fix_invoice_generation_sota.sql'; END $$;
-- =====================================================
-- MIGRATION: Consolidated invoice generation fixes (bugs A-H)
-- Date: 2026-04-10
--
-- Audit follow-up. Bundles 6 SQL fixes + 2 deprecation markers that
-- came out of the invoice-generation audit on lease
-- da2eb9da-1ff1-4020-8682-5f993aa6fde7. Every statement is idempotent
-- (CREATE OR REPLACE / DROP IF EXISTS / IF NOT EXISTS).
--
-- Runs inside a single transaction so the whole thing rolls back on
-- any failure.
-- =====================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- Bug A — notify_tenant_invoice_created: resolve user_id
-- ═══════════════════════════════════════════════════════════
-- The original trigger from 20260305100000 inserted into `notifications`
-- without providing `user_id`, which is NOT NULL per the schema in
-- 20240101000021_add_notifications_table.sql. Every insert therefore
-- failed with a constraint violation and the tenant never saw the new
-- invoice.
--
-- Fix: resolve the auth.users id via profiles.user_id using the
-- invoice's tenant_id, skip silently when it can't be resolved (so we
-- never block the invoice insert itself), and populate the columns that
-- actually exist on the production notifications table (user_id, type,
-- title, body, metadata).
CREATE OR REPLACE FUNCTION notify_tenant_invoice_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_property_address TEXT;
BEGIN
  -- Only notify for "sent" invoices (not drafts, cancellations, etc.)
  IF NEW.statut IS DISTINCT FROM 'sent' THEN
    RETURN NEW;
  END IF;

  -- Resolve the tenant's auth.users id via profiles.user_id. The invoice
  -- row carries tenant_id = profiles.id, not the auth user id.
  SELECT p.user_id
  INTO v_user_id
  FROM profiles p
  WHERE p.id = NEW.tenant_id;

  -- If we cannot resolve an auth user, silently skip the notification
  -- (no tenant profile linked, or the tenant hasn't finished onboarding).
  -- Returning NEW without inserting keeps the invoice insert working.
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lookup property address via the lease for a friendlier message.
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = NEW.lease_id;

  INSERT INTO notifications (
    user_id,
    type,
    title,
    body,
    metadata
  ) VALUES (
    v_user_id,
    'invoice_issued',
    'Nouvelle quittance disponible',
    'Quittance pour ' || COALESCE(v_property_address, 'votre logement')
      || ' — ' || COALESCE(NEW.montant_total::TEXT, '0') || ' €',
    jsonb_build_object(
      'invoice_id', NEW.id,
      'lease_id', NEW.lease_id,
      'montant', NEW.montant_total,
      'periode', NEW.periode,
      'link', '/tenant/payments?invoice=' || NEW.id
    )
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_tenant_invoice_created IS
  'Inserts a notifications row when an invoice is issued. Resolves '
  'the tenant auth user via profiles.user_id and silently skips the '
  'insert if the tenant is not linked to an auth user (prevents '
  'user_id NOT NULL constraint violations that used to swallow the '
  'whole invoice insert).';


-- ═══════════════════════════════════════════════════════════
-- Bug B — generate_monthly_invoices: missing columns
-- ═══════════════════════════════════════════════════════════
-- The RPC from 20260304000000 did not populate period_start, period_end
-- or metadata. Downstream code (grand livre, filters on metadata->>'type')
-- then had to fall back to fuzzy period string parsing. There is no
-- dedicated `type` column on invoices — the convention established by
-- 20260306100000 and 20260314030000 is to store it inside metadata JSONB
-- as `metadata->>'type'`, so we follow that convention here.
CREATE OR REPLACE FUNCTION generate_monthly_invoices(p_target_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_lease RECORD;
  v_result JSONB;
  v_days_in_month INT;
  v_jour_paiement INT;
  v_date_echeance DATE;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  -- Guard: p_target_month must be YYYY-MM
  IF p_target_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Format de mois invalide. Attendu: YYYY-MM';
  END IF;

  v_period_start := (p_target_month || '-01')::DATE;
  v_period_end := (DATE_TRUNC('month', v_period_start) + INTERVAL '1 month - 1 day')::DATE;
  v_days_in_month := EXTRACT(DAY FROM v_period_end)::INT;

  -- Active leases missing an invoice for this period
  FOR v_lease IN
    SELECT
      l.id AS lease_id,
      l.property_id,
      p.owner_id,
      ls.profile_id AS tenant_id,
      l.loyer,
      l.charges_forfaitaires,
      COALESCE(l.jour_paiement, 5) AS jour_paiement
    FROM leases l
    JOIN properties p ON p.id = l.property_id
    JOIN lease_signers ls
      ON ls.lease_id = l.id
      AND ls.role IN ('locataire', 'locataire_principal')
    WHERE l.statut = 'active'
      AND l.date_debut <= v_period_start
      AND (l.date_fin IS NULL OR l.date_fin >= v_period_start)
      AND NOT EXISTS (
        SELECT 1 FROM invoices
        WHERE lease_id = l.id
          AND periode = p_target_month
      )
  LOOP
    -- Clamp jour_paiement to the last day of the month (e.g. 30 → 28 in Feb)
    v_jour_paiement := LEAST(v_lease.jour_paiement, v_days_in_month);
    v_date_echeance := (p_target_month || '-' || LPAD(v_jour_paiement::TEXT, 2, '0'))::DATE;

    INSERT INTO invoices (
      lease_id,
      owner_id,
      tenant_id,
      periode,
      montant_loyer,
      montant_charges,
      montant_total,
      date_echeance,
      period_start,
      period_end,
      invoice_number,
      statut,
      metadata,
      created_at
    ) VALUES (
      v_lease.lease_id,
      v_lease.owner_id,
      v_lease.tenant_id,
      p_target_month,
      v_lease.loyer,
      v_lease.charges_forfaitaires,
      v_lease.loyer + v_lease.charges_forfaitaires,
      v_date_echeance,
      v_period_start,
      v_period_end,
      'QUI-' || REPLACE(p_target_month, '-', '') || '-' || UPPER(LEFT(v_lease.lease_id::TEXT, 8)),
      'sent',
      jsonb_build_object(
        'type', 'loyer',
        'generated_by', 'generate_monthly_invoices',
        'generated_at', NOW()::TEXT
      ),
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'month', p_target_month,
    'generated_count', v_count
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_monthly_invoices IS
  'Generates monthly rent invoices for every active lease missing one '
  'for the target month (YYYY-MM). Uses leases.jour_paiement for the '
  'due date, fills period_start/period_end, and stores the invoice '
  'type in metadata (metadata->>''type'' = ''loyer'').';


-- ═══════════════════════════════════════════════════════════
-- Bug E — broken index on non-existent column due_date
-- ═══════════════════════════════════════════════════════════
-- 20260408220000_payment_architecture_sota.sql created an index on
-- `invoices(due_date, statut)` but the invoices table has never had a
-- `due_date` column (it's `date_echeance`). The migration either failed
-- silently on prod or the index was never applied. Drop it to keep the
-- schema clean; the correct index idx_invoices_date_echeance already
-- exists (20260305000001 line 66).
DROP INDEX IF EXISTS idx_invoices_overdue_check;


-- ═══════════════════════════════════════════════════════════
-- Bug F — mark_overdue_invoices_late: due_date → date_echeance
-- ═══════════════════════════════════════════════════════════
-- The original function (20260304200000) referenced `due_date` and wrote
-- statut = 'late'. Rewrite to use the real column (`date_echeance`) and
-- the status value the rest of the app checks against (`overdue`).
-- The existing cron schedule `mark-overdue-invoices` (5 0 * * *) stays
-- in place and will pick up the new function body automatically.
CREATE OR REPLACE FUNCTION mark_overdue_invoices_late()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE invoices
  SET
    statut = 'overdue',
    updated_at = NOW()
  WHERE statut = 'sent'
    AND date_echeance < CURRENT_DATE
    AND date_echeance IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    RAISE NOTICE '[mark_overdue_invoices_late] % factures passées en overdue', v_count;
  END IF;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION mark_overdue_invoices_late IS
  'Marks every `sent` invoice whose date_echeance is in the past as '
  '`overdue`. Called daily by the `mark-overdue-invoices` pg_cron job. '
  'Returns the number of rows updated.';


-- ═══════════════════════════════════════════════════════════
-- Bug C + G — pg_cron: net.http_post → net.http_get + Vault secrets
-- ═══════════════════════════════════════════════════════════
-- Supabase hosted does NOT support the `app.settings.*` GUC pattern the
-- original 20260304100000 migration used, and every cron API route in
-- app/api/cron/ exports only GET, so `net.http_post` never worked on
-- prod either. Rewrite every schedule to:
--   1. Use net.http_get (all routes verified to export GET)
--   2. Read the app URL + cron secret from vault.decrypted_secrets
--      at every run (not baked in at schedule creation time), so
--      rotating the secret doesn't require re-scheduling.
--   3. Set timeout_milliseconds := 30000 explicitly.
--
-- Vault entries expected (create them via the Supabase dashboard →
-- Project Settings → Vault before the cron jobs actually fire):
--   • app_url       = 'https://talok.fr'    (or the Netlify URL)
--   • cron_secret   = '<matches CRON_SECRET env var in Netlify>'
--
-- Routes targeted (all verified to export GET in app/api/cron/):
--   generate-invoices, payment-reminders, process-outbox,
--   process-webhooks, lease-expiry-alerts, check-cni-expiry,
--   subscription-alerts, irl-indexation, visit-reminders
--
-- `generate-monthly-invoices` is intentionally NOT rescheduled — the
-- route does not exist in app/api/cron/. The existing
-- `generate-invoices` cron already calls the (now-fixed)
-- generate_monthly_invoices RPC via /api/cron/generate-invoices.
--
-- SQL-function crons (cleanup-exports, cleanup-webhooks,
-- mark-overdue-invoices) are left untouched — they call local PL/pgSQL,
-- no HTTP involved.

-- Unschedule stale HTTP-based jobs (idempotent).
DO $$
DECLARE
  v_job TEXT;
BEGIN
  FOREACH v_job IN ARRAY ARRAY[
    'payment-reminders',
    'generate-monthly-invoices',
    'generate-invoices',
    'process-webhooks',
    'process-outbox',
    'lease-expiry-alerts',
    'check-cni-expiry',
    'irl-indexation',
    'visit-reminders',
    'subscription-alerts',
    'notifications'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_job) THEN
      PERFORM cron.unschedule(v_job);
    END IF;
  END LOOP;
END $$;

-- ─── Reschedule with net.http_get + vault secrets ─────────────

-- Daily rent payment reminders — 08:00 UTC
SELECT cron.schedule('payment-reminders', '0 8 * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/payment-reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Monthly invoice generation — 1st of the month, 06:00 UTC
SELECT cron.schedule('generate-invoices', '0 6 1 * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/generate-invoices',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Outbox worker — every 5 minutes
SELECT cron.schedule('process-outbox', '*/5 * * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/process-outbox',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Webhook retry worker — every 5 minutes (offset +2 to avoid burst)
SELECT cron.schedule('process-webhooks', '2-59/5 * * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/process-webhooks',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Lease expiry alerts — Mondays at 08:00 UTC
SELECT cron.schedule('lease-expiry-alerts', '0 8 * * 1', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/lease-expiry-alerts',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- CNI expiry check — daily at 10:00 UTC
SELECT cron.schedule('check-cni-expiry', '0 10 * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/check-cni-expiry',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Subscription alerts — daily at 10:00 UTC (offset +5 min to avoid burst)
SELECT cron.schedule('subscription-alerts', '5 10 * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/subscription-alerts',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- IRL indexation — 1st of the month, 07:00 UTC
SELECT cron.schedule('irl-indexation', '0 7 1 * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/irl-indexation',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);

-- Visit reminders — every 30 minutes
SELECT cron.schedule('visit-reminders', '*/30 * * * *', $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url') || '/api/cron/visit-reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
$cron$);


-- ═══════════════════════════════════════════════════════════
-- Bug H — deprecation marker on generate_first_invoice
-- ═══════════════════════════════════════════════════════════
-- DEPRECATED: generate_first_invoice() is superseded by
-- generate_initial_signing_invoice(), introduced in
-- 20260306100000_invoice_on_fully_signed.sql. The trigger
-- trg_invoice_engine_on_lease_active still calls generate_first_invoice
-- for backwards compatibility, but the guard added in that same
-- migration (SELECT … WHERE metadata->>'type' = 'initial_invoice')
-- prevents duplicate invoices. Full removal is deferred to a follow-up
-- migration once the new path has logged a few weeks of clean runs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'generate_first_invoice'
  ) THEN
    COMMENT ON FUNCTION generate_first_invoice(UUID, UUID, UUID) IS
      'DEPRECATED: use generate_initial_signing_invoice() instead. '
      'Still called by trg_invoice_engine_on_lease_active but guarded '
      'by the initial_invoice metadata check to prevent duplicates. '
      'Scheduled for removal in a future migration.';
  END IF;
END $$;


COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 32/71 -- 20260410204528 -- MODERE -- 20260410204528_extend_invoices_rls_for_sci_access.sql
-- risk: +3 policies, -3 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 32/71 (MODERE) 20260410204528_extend_invoices_rls_for_sci_access.sql'; END $$;
-- =====================================================
-- Migration: Extend invoices/leases/properties SELECT RLS for SCI access
-- Date: 2026-04-10
--
-- CONTEXT:
-- Bug #3 — "Facture introuvable" on /owner/invoices/[id] for SCI owners.
--
-- ROOT CAUSE:
-- The existing RLS SELECT policies on `invoices`, `leases` and `properties`
-- only check direct ownership via `owner_id = public.user_profile_id()`.
-- They do NOT account for owners who hold assets through a legal_entity
-- (SCI, SARL, agence…). When a property is owned by a SCI, its
-- `owner_id` points to the SCI's profile (not the individual manager),
-- so any human member of that SCI is blocked by RLS when fetching the
-- nested join `invoices → leases → properties`.
--
-- NOTE: The list endpoints (features/billing/server/data-fetching.ts)
-- silently work today because they use `getServiceClient()` which
-- bypasses RLS. The detail endpoint (app/api/invoices/[id]/route.ts)
-- correctly uses the authenticated client and therefore is blocked.
--
-- FIX:
-- Extend each SELECT policy to ALSO allow access when the caller is a
-- member of the legal_entity that owns the property (via entity_members).
-- INSERT / UPDATE / DELETE policies are left unchanged: only SELECT
-- needs the SCI read-through.
--
-- IDEMPOTENCE:
-- All policies are DROPped and CREATEd, matching the project convention.
-- Safe to re-run.
-- =====================================================

-- =====================================================
-- 1. PROPERTIES — allow SCI members to view properties
-- =====================================================
DROP POLICY IF EXISTS "Owners can view own properties" ON properties;

CREATE POLICY "Owners can view own properties"
  ON properties FOR SELECT
  USING (
    -- Direct ownership (personal owner_id)
    owner_id = public.user_profile_id()
    -- OR the property is held by a legal_entity the user is a member of
    OR legal_entity_id IN (
      SELECT em.entity_id
      FROM entity_members em
      WHERE em.user_id = auth.uid()
    )
  );

-- =====================================================
-- 2. LEASES — allow SCI members to view leases of SCI-owned properties
-- =====================================================
DROP POLICY IF EXISTS "Owners can view leases of own properties" ON leases;

CREATE POLICY "Owners can view leases of own properties"
  ON leases FOR SELECT
  USING (
    -- Lease on a property directly owned by the caller
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.owner_id = public.user_profile_id()
    )
    -- Or on a unit of such a property
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.owner_id = public.user_profile_id()
    )
    -- OR lease on a property held by a legal_entity the user is a member of
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.legal_entity_id IN (
          SELECT em.entity_id
          FROM entity_members em
          WHERE em.user_id = auth.uid()
        )
    )
    -- Or same on a unit
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.legal_entity_id IN (
          SELECT em.entity_id
          FROM entity_members em
          WHERE em.user_id = auth.uid()
        )
    )
  );

-- =====================================================
-- 3. INVOICES — allow SCI members to view invoices of SCI-owned assets
-- =====================================================
DROP POLICY IF EXISTS "Owners can view invoices of own properties" ON invoices;

CREATE POLICY "Owners can view invoices of own properties"
  ON invoices FOR SELECT
  USING (
    -- Direct ownership (invoices.owner_id matches the caller's profile)
    owner_id = public.user_profile_id()
    -- OR the invoice is explicitly tied to a legal_entity the user is a member of
    -- (invoices.entity_id was added by 20260408220000_payment_architecture_sota.sql)
    OR entity_id IN (
      SELECT em.entity_id
      FROM entity_members em
      WHERE em.user_id = auth.uid()
    )
    -- OR the invoice's lease points to a property held by a legal_entity
    -- the user is a member of
    OR lease_id IN (
      SELECT l.id
      FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.legal_entity_id IN (
        SELECT em.entity_id
        FROM entity_members em
        WHERE em.user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 4. COMMENTS for future readers
-- =====================================================
COMMENT ON POLICY "Owners can view own properties" ON properties IS
  'SCI-aware: allows direct profile owners AND members of the owning legal_entity.';

COMMENT ON POLICY "Owners can view leases of own properties" ON leases IS
  'SCI-aware: allows direct profile owners AND members of the legal_entity holding the underlying property.';

COMMENT ON POLICY "Owners can view invoices of own properties" ON invoices IS
  'SCI-aware: allows direct profile owners, explicit entity_id matches, AND members of the legal_entity holding the invoiced property.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 33/71 -- 20260410210000 -- DANGEREUX -- 20260410210000_fix_protected_document_visibility.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 33/71 (DANGEREUX) 20260410210000_fix_protected_document_visibility.sql'; END $$;
-- =============================================================================
-- Migration : Fix protected document visibility for tenants
-- Date      : 2026-04-10
-- Bug       : Tenants hit 403 when downloading quittances from /tenant/documents
--
-- Root cause : The RPC `tenant_document_center()` and the view
--   `v_tenant_key_documents` return documents regardless of `visible_tenant`,
--   but `/api/documents/[id]/signed-url` enforces `visible_tenant != false`
--   (consistent with the `documents` table RLS). So a quittance with
--   visible_tenant = false shows up in the UI and then 403s on download.
--
-- Additionally, quittances (and other legally-mandatory documents like
-- bail, EDL, attestation de remise des cles) must always be visible to
-- tenants per Art. 21 Loi du 6 juillet 1989. The existing trigger
-- `force_visible_tenant_on_generated` only protects docs with
-- is_generated = true, which quittances from /api/payments/[pid]/receipt
-- are not.
--
-- Fix (4 parts in one migration):
--   1. Backfill visible_tenant = true for all protected document types
--   2. Harden trigger: force visible_tenant = true for protected types too
--   3. Patch view v_tenant_key_documents to filter visible_tenant
--   4. Patch RPCs tenant_document_center() and tenant_documents_search()
--      to filter visible_tenant (exception: tenant always sees their own
--      uploads via uploaded_by).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. BACKFILL : Force visible_tenant = true for protected document types
-- =============================================================================

UPDATE documents
SET visible_tenant = true, updated_at = now()
WHERE type IN (
  'quittance',
  'bail', 'contrat', 'avenant',
  'bail_signe_locataire', 'bail_signe_proprietaire',
  'EDL_entree', 'edl_entree', 'EDL_sortie', 'edl_sortie',
  'attestation_remise_cles'
)
AND visible_tenant IS DISTINCT FROM true;


-- =============================================================================
-- 2. HARDEN TRIGGER : force visible_tenant on generated docs AND protected types
-- =============================================================================

CREATE OR REPLACE FUNCTION public.force_visible_tenant_on_generated()
RETURNS TRIGGER AS $$
BEGIN
    -- Generated documents are always visible to tenants
    IF NEW.is_generated = true THEN
        NEW.visible_tenant := true;
    END IF;

    -- Legally-mandatory document types must always be visible to tenants
    -- (quittances, bail, EDL, attestation de remise des cles)
    IF NEW.type IN (
        'quittance',
        'bail', 'contrat', 'avenant',
        'bail_signe_locataire', 'bail_signe_proprietaire',
        'EDL_entree', 'edl_entree', 'EDL_sortie', 'edl_sortie',
        'attestation_remise_cles'
    ) THEN
        NEW.visible_tenant := true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.force_visible_tenant_on_generated() IS
  'Coerces visible_tenant = true for (a) any is_generated=true document and '
  '(b) legally-mandatory document types (quittance, bail, EDL, attestation '
  'de remise des cles) regardless of is_generated. Prevents owners from '
  'accidentally hiding documents tenants have a legal right to access.';

-- Recreate trigger (same name, same timing) to pick up the new function body
DROP TRIGGER IF EXISTS trg_force_visible_tenant_on_generated ON documents;
CREATE TRIGGER trg_force_visible_tenant_on_generated
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION public.force_visible_tenant_on_generated();


-- =============================================================================
-- 3. PATCH VIEW : v_tenant_key_documents — filter visible_tenant
-- =============================================================================

CREATE OR REPLACE VIEW v_tenant_key_documents AS
WITH ranked_docs AS (
  SELECT
    d.id,
    d.type,
    d.title,
    d.storage_path,
    d.created_at,
    d.tenant_id,
    d.lease_id,
    d.property_id,
    d.metadata,
    d.verification_status,
    d.ged_status,
    CASE
      WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
      WHEN d.type IN ('quittance') THEN 'quittance'
      WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
      WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
      ELSE NULL
    END AS slot_key,
    ROW_NUMBER() OVER (
      PARTITION BY
        d.tenant_id,
        CASE
          WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
          WHEN d.type IN ('quittance') THEN 'quittance'
          WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
          WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
        END
      ORDER BY
        CASE WHEN (d.metadata->>'final')::boolean = true THEN 0 ELSE 1 END,
        CASE WHEN d.ged_status = 'signed' THEN 0 WHEN d.ged_status = 'active' THEN 1 ELSE 2 END,
        d.created_at DESC
    ) AS rn
  FROM documents d
  WHERE d.tenant_id IS NOT NULL
    AND d.type IN (
      'bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire',
      'quittance',
      'EDL_entree', 'edl_entree', 'inventaire',
      'attestation_assurance', 'assurance_pno'
    )
    -- Only surface documents the tenant can actually download.
    -- Tenant always sees their own uploads (uploaded_by match).
    AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = d.tenant_id)
)
SELECT
  id,
  type,
  title,
  storage_path,
  created_at,
  tenant_id,
  lease_id,
  property_id,
  metadata,
  verification_status,
  ged_status,
  slot_key
FROM ranked_docs
WHERE rn = 1 AND slot_key IS NOT NULL;

COMMENT ON VIEW v_tenant_key_documents IS
  'Documents cles par locataire (bail, derniere quittance, EDL entree, assurance). '
  'Filtre visible_tenant pour ne retourner que les documents effectivement '
  'telechargeables par le locataire (alignement avec /api/documents/[id]/signed-url).';


-- =============================================================================
-- 4. PATCH RPC : tenant_document_center() — filter visible_tenant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_document_center(p_profile_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_pending_actions JSONB;
  v_key_documents JSONB;
  v_all_documents JSONB;
  v_stats JSONB;
BEGIN
  -- Resolve profile_id (parameter or current user)
  IF p_profile_id IS NOT NULL THEN
    v_profile_id := p_profile_id;
  ELSE
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  -- Zone 1 : Pending actions
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'action_type', action_type,
      'entity_id', entity_id,
      'label', action_label,
      'description', action_description,
      'href', action_href,
      'priority', priority,
      'created_at', action_created_at
    ) ORDER BY
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      action_created_at DESC
  ), '[]'::jsonb)
  INTO v_pending_actions
  FROM v_tenant_pending_actions
  WHERE tenant_profile_id = v_profile_id;

  -- Zone 2 : Key documents (4 slots) — view already filters visible_tenant
  SELECT COALESCE(jsonb_object_agg(
    slot_key,
    jsonb_build_object(
      'id', id,
      'type', type,
      'title', title,
      'storage_path', storage_path,
      'created_at', created_at,
      'lease_id', lease_id,
      'property_id', property_id,
      'metadata', COALESCE(metadata, '{}'::jsonb),
      'verification_status', verification_status,
      'ged_status', ged_status
    )
  ), '{}'::jsonb)
  INTO v_key_documents
  FROM v_tenant_key_documents
  WHERE tenant_id = v_profile_id;

  -- Zone 3 : All documents (50 most recent, deduplicated, visible only)
  SELECT COALESCE(jsonb_agg(doc ORDER BY doc->>'created_at' DESC), '[]'::jsonb)
  INTO v_all_documents
  FROM (
    SELECT DISTINCT ON (d.type, COALESCE(d.lease_id, d.property_id, d.id))
      jsonb_build_object(
        'id', d.id,
        'type', d.type,
        'title', d.title,
        'storage_path', d.storage_path,
        'created_at', d.created_at,
        'tenant_id', d.tenant_id,
        'lease_id', d.lease_id,
        'property_id', d.property_id,
        'metadata', COALESCE(d.metadata, '{}'::jsonb),
        'verification_status', d.verification_status,
        'ged_status', d.ged_status,
        'file_size', d.file_size,
        'mime_type', d.mime_type,
        'original_filename', d.original_filename
      ) AS doc
    FROM documents d
    WHERE (
        d.tenant_id = v_profile_id
        OR d.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
        )
      )
      -- Align with /api/documents/[id]/signed-url permission check:
      -- tenant always sees their own uploads; owner-shared docs require
      -- visible_tenant IS NOT FALSE.
      AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = v_profile_id)
    ORDER BY d.type, COALESCE(d.lease_id, d.property_id, d.id), d.created_at DESC
    LIMIT 100
  ) sub
  LIMIT 50;

  -- Stats (must use the same filter to stay consistent with the list)
  SELECT jsonb_build_object(
    'total_documents', (
      SELECT COUNT(*) FROM documents d
      WHERE (
          d.tenant_id = v_profile_id
          OR d.lease_id IN (SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id)
        )
        AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = v_profile_id)
    ),
    'pending_actions_count', jsonb_array_length(v_pending_actions),
    'has_bail', v_key_documents ? 'bail',
    'has_quittance', v_key_documents ? 'quittance',
    'has_edl', v_key_documents ? 'edl',
    'has_assurance', v_key_documents ? 'assurance'
  ) INTO v_stats;

  v_result := jsonb_build_object(
    'pending_actions', v_pending_actions,
    'key_documents', v_key_documents,
    'documents', v_all_documents,
    'stats', v_stats
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.tenant_document_center IS
  'Endpoint unique pour le Document Center locataire. Retourne : pending_actions, '
  'key_documents (4 slots), documents (tous, dedoublonnes), stats. '
  'Filtre visible_tenant pour ne retourner que les documents effectivement '
  'telechargeables par le locataire (alignement avec /api/documents/[id]/signed-url).';

GRANT EXECUTE ON FUNCTION public.tenant_document_center TO authenticated;


-- =============================================================================
-- 5. PATCH RPC : tenant_documents_search() — filter visible_tenant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_documents_search(
  p_query TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_period TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'date_desc',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_period_start TIMESTAMPTZ;
BEGIN
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found', 'documents', '[]'::jsonb);
  END IF;

  v_period_start := CASE p_period
    WHEN '1m' THEN NOW() - INTERVAL '1 month'
    WHEN '3m' THEN NOW() - INTERVAL '3 months'
    WHEN '6m' THEN NOW() - INTERVAL '6 months'
    WHEN '1y' THEN NOW() - INTERVAL '1 year'
    ELSE NULL
  END;

  SELECT jsonb_build_object(
    'documents', COALESCE(jsonb_agg(doc), '[]'::jsonb),
    'total', COUNT(*) OVER()
  )
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', d.id,
      'type', d.type,
      'title', d.title,
      'storage_path', d.storage_path,
      'created_at', d.created_at,
      'tenant_id', d.tenant_id,
      'lease_id', d.lease_id,
      'property_id', d.property_id,
      'metadata', COALESCE(d.metadata, '{}'::jsonb),
      'verification_status', d.verification_status,
      'ged_status', d.ged_status,
      'file_size', d.file_size,
      'mime_type', d.mime_type,
      'original_filename', d.original_filename,
      'is_recent', (d.created_at > NOW() - INTERVAL '7 days')
    ) AS doc,
    d.created_at,
    d.type
    FROM documents d
    WHERE (
      d.tenant_id = v_profile_id
      OR d.lease_id IN (
        SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
      )
    )
    -- Align with signed-url permission check (see tenant_document_center)
    AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = v_profile_id)
    AND (p_query IS NULL OR p_query = '' OR
      d.search_vector @@ plainto_tsquery('french', p_query)
      OR d.title ILIKE '%' || p_query || '%'
      OR d.type ILIKE '%' || p_query || '%'
    )
    AND (p_type IS NULL OR p_type = 'all' OR d.type = p_type)
    AND (v_period_start IS NULL OR d.created_at >= v_period_start)
    ORDER BY
      CASE WHEN p_sort = 'date_desc' THEN d.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'date_asc'  THEN d.created_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'type'      THEN d.type END ASC,
      d.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) sub;

  RETURN COALESCE(v_result, jsonb_build_object('documents', '[]'::jsonb, 'total', 0));
END;
$$;

COMMENT ON FUNCTION public.tenant_documents_search IS
  'Recherche full-text dans les documents du locataire avec filtres (type, periode) et tri. '
  'Filtre visible_tenant pour ne retourner que les documents effectivement '
  'telechargeables par le locataire.';

GRANT EXECUTE ON FUNCTION public.tenant_documents_search TO authenticated;


COMMIT;

-- =============================================================================
-- Rollback notes :
--   1. Restore previous trigger body (force only on is_generated = true)
--   2. Restore v_tenant_key_documents without visible_tenant filter
--   3. Restore tenant_document_center() and tenant_documents_search() without
--      visible_tenant filter
--   (See migration 20260216000000_tenant_document_center.sql and
--    20260329190000_force_visible_tenant_generated_docs.sql for original bodies)
-- =============================================================================

COMMIT;

-- -----------------------------------------------------------------------------
-- 34/71 -- 20260410210341 -- SAFE -- 20260410210341_fix_notify_tenant_invoice_created_user_id.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 34/71 (SAFE) 20260410210341_fix_notify_tenant_invoice_created_user_id.sql'; END $$;
-- =====================================================
-- Migration: Fix notify_tenant_invoice_created — populate user_id
-- Date: 2026-04-10
--
-- CONTEXT:
-- The previous version of this trigger (migration
-- 20260305100000_fix_invoice_draft_notification.sql) rewrote the
-- function with a direct INSERT into notifications BUT forgot the
-- `user_id` column, which is NOT NULL (see
-- 20240101000009_tenant_advanced.sql:445 and
-- 20240101000021_add_notifications_table.sql:5).
--
-- Impact:
-- Every attempt to create an invoice with statut='sent' rolled back
-- because the AFTER INSERT trigger failed with:
--   null value in column "user_id" of relation "notifications"
--   violates not-null constraint
-- This made it impossible for generate_monthly_invoices(),
-- ensureInitialInvoiceForLease() or any other caller to produce an
-- invoice in 'sent' state. In practice, invoice generation was
-- silently broken in production since 2026-03-05.
--
-- FIX:
-- Recreate notify_tenant_invoice_created() to resolve the auth.users
-- id via profiles.user_id and include it in the INSERT.
-- Also protect against tenants that no longer have a linked user
-- (pr.user_id IS NOT NULL).
--
-- STATUS IN PRODUCTION:
-- The fix was already applied directly via SQL Editor during the
-- 2026-04-10 invoice-generation audit session. This migration records
-- the change in version control so it is reapplied on any rebuild.
-- Safe to re-run (CREATE OR REPLACE).
-- =====================================================

CREATE OR REPLACE FUNCTION notify_tenant_invoice_created()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
BEGIN
  -- Only notify for sent invoices (avoid drafts and already-paid ones).
  IF NEW.statut != 'sent' THEN
    RETURN NEW;
  END IF;

  -- Resolve the property address via the lease.
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = NEW.lease_id;

  -- Notify every tenant signer of the lease, joining profiles so we can
  -- populate the notifications.user_id NOT NULL column.
  FOR v_tenant IN
    SELECT DISTINCT ls.profile_id, pr.user_id
    FROM lease_signers ls
    JOIN profiles pr ON pr.id = ls.profile_id
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire')
      AND ls.profile_id IS NOT NULL
      AND pr.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (
      user_id,
      profile_id,
      type,
      title,
      message,
      link,
      metadata
    ) VALUES (
      v_tenant.user_id,
      v_tenant.profile_id,
      'invoice',
      'Nouvelle quittance disponible',
      'Quittance pour ' || v_property_address || ' - ' ||
        COALESCE(NEW.montant_total::text, '0') || '€',
      '/tenant/payments?invoice=' || NEW.id,
      jsonb_build_object(
        'invoice_id', NEW.id,
        'lease_id', NEW.lease_id,
        'montant', NEW.montant_total,
        'periode', NEW.periode
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_tenant_invoice_created IS
  'Creates a notification for every tenant signer when an invoice transitions '
  'to statut=sent. Resolves notifications.user_id via profiles.user_id to '
  'satisfy the NOT NULL constraint.';

-- The trigger itself was already created by 20260108200000 and is not
-- dropped/recreated here (CREATE OR REPLACE FUNCTION is enough to hot-swap
-- the implementation).

COMMIT;

-- -----------------------------------------------------------------------------
-- 35/71 -- 20260410210342 -- SAFE -- 20260410210342_fix_generate_monthly_invoices_fields.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 35/71 (SAFE) 20260410210342_fix_generate_monthly_invoices_fields.sql'; END $$;
-- =====================================================
-- Migration: Extend generate_monthly_invoices to populate period/type/metadata
-- Date: 2026-04-10
--
-- CONTEXT:
-- The previous version of this RPC (migration
-- 20260304000000_fix_invoice_generation_jour_paiement.sql) only
-- inserted `montant_loyer`, `montant_charges`, `montant_total`,
-- `date_echeance`, `invoice_number` and `statut`. It did NOT populate:
--   - period_start / period_end
--   - type (defaulted to 'loyer' but never set explicitly)
--   - metadata (defaulted to '{}' but never enriched)
--
-- Impact:
-- Monthly invoices had NULL period_start/period_end, which broke:
--   - Receipt PDF "Période du X au Y" rendering
--   - Accounting reports filtered on period_start
--   - Reconciliation queries looking up invoices by period bounds
-- metadata was empty so downstream jobs couldn't tell which invoices
-- came from the monthly cron vs. manual generation.
--
-- FIX:
-- Rewrite generate_monthly_invoices to compute period_start (first day
-- of target month), period_end (last day), set type='loyer', and
-- populate metadata with generation provenance. Everything else is
-- unchanged (loyer/charges/total calculation, jour_paiement handling,
-- anti-doublon via UNIQUE(lease_id, periode)).
--
-- STATUS IN PRODUCTION:
-- The missing fields were backfilled by a one-shot UPDATE during the
-- 2026-04-10 audit session. This migration ensures all FUTURE invoices
-- created by the cron include the fields automatically.
--
-- Safe to re-run (CREATE OR REPLACE FUNCTION).
-- =====================================================

CREATE OR REPLACE FUNCTION generate_monthly_invoices(p_target_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_lease RECORD;
  v_result JSONB;
  v_days_in_month INT;
  v_jour_paiement INT;
  v_date_echeance DATE;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  -- Vérifier le format du mois (YYYY-MM)
  IF p_target_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Format de mois invalide. Attendu: YYYY-MM';
  END IF;

  -- Calculer les bornes du mois cible
  v_period_start := (p_target_month || '-01')::DATE;
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_days_in_month := EXTRACT(DAY FROM v_period_end)::INT;

  -- Parcourir tous les baux actifs qui n'ont pas encore de facture pour ce mois
  FOR v_lease IN
    SELECT
      l.id as lease_id,
      l.property_id,
      p.owner_id,
      ls.profile_id as tenant_id,
      l.loyer,
      l.charges_forfaitaires,
      COALESCE(l.jour_paiement, 5) as jour_paiement
    FROM leases l
    JOIN properties p ON p.id = l.property_id
    JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role IN ('locataire', 'locataire_principal')
    WHERE l.statut = 'active'
      AND l.date_debut <= v_period_start
      AND (l.date_fin IS NULL OR l.date_fin >= v_period_start)
      AND NOT EXISTS (
        SELECT 1 FROM invoices
        WHERE lease_id = l.id
          AND periode = p_target_month
      )
  LOOP
    -- Clamper jour_paiement au dernier jour du mois (ex: 30 → 28 en février)
    v_jour_paiement := LEAST(v_lease.jour_paiement, v_days_in_month);
    v_date_echeance := (p_target_month || '-' || LPAD(v_jour_paiement::TEXT, 2, '0'))::DATE;

    INSERT INTO invoices (
      lease_id,
      owner_id,
      tenant_id,
      periode,
      montant_loyer,
      montant_charges,
      montant_total,
      date_echeance,
      period_start,
      period_end,
      invoice_number,
      statut,
      type,
      metadata,
      created_at,
      generated_at
    ) VALUES (
      v_lease.lease_id,
      v_lease.owner_id,
      v_lease.tenant_id,
      p_target_month,
      v_lease.loyer,
      v_lease.charges_forfaitaires,
      v_lease.loyer + v_lease.charges_forfaitaires,
      v_date_echeance,
      v_period_start,
      v_period_end,
      'QUI-' || REPLACE(p_target_month, '-', '') || '-' || UPPER(LEFT(v_lease.lease_id::TEXT, 8)),
      'sent',
      'loyer',
      jsonb_build_object(
        'type', 'loyer',
        'generated_by', 'generate_monthly_invoices',
        'target_month', p_target_month,
        'jour_paiement', v_jour_paiement
      ),
      NOW(),
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'month', p_target_month,
    'generated_count', v_count
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_monthly_invoices IS
  'Génère les factures de loyer pour tous les baux actifs pour un mois donné '
  '(YYYY-MM). Utilise leases.jour_paiement pour la date d''échéance, '
  'calcule period_start/period_end, et tag metadata.generated_by.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 36/71 -- 20260410212232 -- MODERE -- 20260410212232_fix_entity_members_policy_recursion.sql
-- risk: +4 policies, -4 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 36/71 (MODERE) 20260410212232_fix_entity_members_policy_recursion.sql'; END $$;
-- =====================================================
-- Migration: Fix entity_members RLS recursion
-- Date: 2026-04-10
--
-- CONTEXT:
-- The entity_members_admin_manage policy introduced in
-- 20260406200000_create_entities_view_and_members.sql:78-91 recursively
-- references the entity_members table in its own USING clause:
--
--   CREATE POLICY "entity_members_admin_manage" ON entity_members
--     FOR ALL TO authenticated
--     USING (
--       entity_id IN (
--         SELECT entity_id FROM entity_members em
--         WHERE em.user_id = auth.uid() AND em.role = 'admin'
--       )
--     )
--
-- This is fine in isolation (Postgres short-circuits on the simpler
-- own_access policy first for most queries), BUT as soon as ANOTHER
-- policy on a DIFFERENT table runs a subquery against entity_members
-- (e.g. the SCI-aware invoices SELECT policy added by
-- 20260410204528_extend_invoices_rls_for_sci_access.sql), Postgres
-- walks the admin_manage policy to check access, which kicks the
-- recursion and raises:
--
--   ERROR: 42P17 infinite recursion detected in policy for
--          relation "entity_members"
--
-- handleApiError (lib/helpers/api-error.ts:55-59) maps 42P17 to
-- HTTP 403 "Accès refusé", which is exactly what Marie-Line saw on
-- /owner/invoices/[id] for the SCI ATOMGISTE invoices after the
-- SCI-aware RLS migration landed.
--
-- FIX:
-- Replace the inline subquery with a SECURITY DEFINER helper function.
-- The function bypasses RLS on entity_members (because SECURITY
-- DEFINER runs with the owner's privileges) and therefore breaks the
-- recursion. It also becomes a single source of truth for "give me
-- the entities this authenticated user is a member of" and can be
-- reused by any other SCI-aware policy.
--
-- The admin_manage policy is also rewritten to use the helper, so the
-- recursion is eliminated at its source.
--
-- Safe to re-run (CREATE OR REPLACE + DROP IF EXISTS).
-- =====================================================

-- =====================================================
-- 1. Helper function: entities the authenticated user can access
-- =====================================================
CREATE OR REPLACE FUNCTION public.auth_user_entity_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT entity_id
  FROM public.entity_members
  WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.auth_user_entity_ids IS
  'Returns the set of legal_entity ids that the currently authenticated user '
  'is a member of. SECURITY DEFINER to bypass RLS on entity_members and '
  'avoid infinite recursion when used inside RLS policies of other tables.';

-- =====================================================
-- 2. Helper function: entities where the user is admin
-- =====================================================
CREATE OR REPLACE FUNCTION public.auth_user_admin_entity_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT entity_id
  FROM public.entity_members
  WHERE user_id = auth.uid()
    AND role = 'admin';
$$;

COMMENT ON FUNCTION public.auth_user_admin_entity_ids IS
  'Returns the set of legal_entity ids where the currently authenticated user '
  'has the admin role. SECURITY DEFINER to bypass RLS and avoid recursion.';

-- =====================================================
-- 3. Rewrite entity_members admin_manage policy without recursion
-- =====================================================
DROP POLICY IF EXISTS "entity_members_admin_manage" ON entity_members;

CREATE POLICY "entity_members_admin_manage" ON entity_members
  FOR ALL TO authenticated
  USING (entity_id IN (SELECT public.auth_user_admin_entity_ids()))
  WITH CHECK (entity_id IN (SELECT public.auth_user_admin_entity_ids()));

COMMENT ON POLICY "entity_members_admin_manage" ON entity_members IS
  'Admins of a legal_entity can fully manage its members. Uses the '
  'auth_user_admin_entity_ids() SECURITY DEFINER helper to avoid the '
  'infinite recursion caused by the previous inline subquery.';

-- =====================================================
-- 4. Rewrite the 3 SCI-aware SELECT policies to use the helper
-- =====================================================

-- 4a. PROPERTIES
DROP POLICY IF EXISTS "Owners can view own properties" ON properties;

CREATE POLICY "Owners can view own properties"
  ON properties FOR SELECT
  USING (
    owner_id = public.user_profile_id()
    OR legal_entity_id IN (SELECT public.auth_user_entity_ids())
  );

COMMENT ON POLICY "Owners can view own properties" ON properties IS
  'SCI-aware via auth_user_entity_ids() helper. No recursion.';

-- 4b. LEASES
DROP POLICY IF EXISTS "Owners can view leases of own properties" ON leases;

CREATE POLICY "Owners can view leases of own properties"
  ON leases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.owner_id = public.user_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
        AND p.legal_entity_id IN (SELECT public.auth_user_entity_ids())
    )
    OR EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND p.legal_entity_id IN (SELECT public.auth_user_entity_ids())
    )
  );

COMMENT ON POLICY "Owners can view leases of own properties" ON leases IS
  'SCI-aware via auth_user_entity_ids() helper. No recursion.';

-- 4c. INVOICES
DROP POLICY IF EXISTS "Owners can view invoices of own properties" ON invoices;

CREATE POLICY "Owners can view invoices of own properties"
  ON invoices FOR SELECT
  USING (
    owner_id = public.user_profile_id()
    OR entity_id IN (SELECT public.auth_user_entity_ids())
    OR lease_id IN (
      SELECT l.id
      FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.legal_entity_id IN (SELECT public.auth_user_entity_ids())
    )
  );

COMMENT ON POLICY "Owners can view invoices of own properties" ON invoices IS
  'SCI-aware via auth_user_entity_ids() helper. No recursion.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 37/71 -- 20260410213940 -- MODERE -- 20260410213940_fix_properties_tenant_policy_recursion.sql
-- risk: +1 policies, -1 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 37/71 (MODERE) 20260410213940_fix_properties_tenant_policy_recursion.sql'; END $$;
-- =====================================================
-- Migration: Fix "Tenants can view linked properties" policy recursion
-- Date: 2026-04-10
--
-- CONTEXT:
-- The "Tenants can view linked properties" SELECT policy on `properties`
-- (created by an older, unidentified migration) runs this EXISTS
-- subquery in its USING clause:
--
--   EXISTS (
--     SELECT 1 FROM leases l
--     JOIN lease_signers ls ON ls.lease_id = l.id
--     WHERE l.property_id = properties.id
--       AND ls.profile_id = user_profile_id()
--       AND l.statut <> ALL (ARRAY['draft', 'cancelled'])
--   )
--
-- Reading `leases` triggers the leases SELECT RLS, whose policies
-- ("Owners can view leases of own properties" and "leases_owner_all")
-- include an EXISTS subquery back into `properties`. That brings us
-- right back to this same policy → Postgres detects the cycle at
-- query-plan time and raises:
--
--   ERROR: 42P17 infinite recursion detected in policy for
--          relation "leases"
--
-- handleApiError (lib/helpers/api-error.ts:55-59) maps 42P17 to
-- HTTP 403 "Accès refusé", which is what Marie-Line saw on
-- /owner/invoices/[id] even though her profile_id is exactly the
-- invoice.owner_id. The cycle is detected at plan time, so even
-- rows that would match the simple `owner_id = user_profile_id()`
-- branch fail before they are evaluated.
--
-- FIX:
-- Replace the inline EXISTS subquery with a SECURITY DEFINER helper
-- function that bypasses RLS on `leases` and `lease_signers`. Same
-- pattern already used by is_lease_member() and is_lease_owner() in
-- 20251228230000_definitive_rls_fix.sql.
--
-- Safe to re-run (CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS).
-- =====================================================

-- =====================================================
-- 1. SECURITY DEFINER helper: property ids the current authenticated
--    user has access to as a tenant / signer on an active lease
-- =====================================================
CREATE OR REPLACE FUNCTION public.tenant_accessible_property_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT l.property_id
  FROM public.leases l
  JOIN public.lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = public.user_profile_id()
    AND l.statut NOT IN ('draft', 'cancelled');
$$;

COMMENT ON FUNCTION public.tenant_accessible_property_ids IS
  'Returns property ids that the currently authenticated user has access '
  'to as a tenant signer on an active (non-draft / non-cancelled) lease. '
  'SECURITY DEFINER to bypass RLS on leases and lease_signers and avoid '
  'the infinite recursion caused by using an inline EXISTS subquery in '
  'the properties SELECT policy.';

-- =====================================================
-- 2. Rewrite the "Tenants can view linked properties" policy to use
--    the helper — no more inline subquery on leases
-- =====================================================
DROP POLICY IF EXISTS "Tenants can view linked properties" ON properties;

CREATE POLICY "Tenants can view linked properties"
  ON properties FOR SELECT
  USING (id IN (SELECT public.tenant_accessible_property_ids()));

COMMENT ON POLICY "Tenants can view linked properties" ON properties IS
  'Tenants and co-tenants can read the property attached to any of their '
  'active leases. Uses the tenant_accessible_property_ids() SECURITY '
  'DEFINER helper to avoid recursion through the leases SELECT policy.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 38/71 -- 20260410220000 -- MODERE -- 20260410220000_cash_receipt_two_step_signature.sql
-- risk: ALTER column (type/constraint), UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 38/71 (MODERE) 20260410220000_cash_receipt_two_step_signature.sql'; END $$;
-- =====================================================
-- Migration: Reçu espèces — signature en deux étapes
-- Date: 2026-04-10
-- Description:
--   Le propriétaire crée le reçu avec sa signature uniquement.
--   Le locataire signe ensuite depuis son propre espace après
--   réception d'une notification.
-- =====================================================

BEGIN;

-- ============================================
-- 1. Assouplir le schéma cash_receipts
-- ============================================

-- La signature locataire doit pouvoir être NULL temporairement
ALTER TABLE cash_receipts
  ALTER COLUMN tenant_signature DROP NOT NULL;

ALTER TABLE cash_receipts
  ALTER COLUMN tenant_signed_at DROP NOT NULL;

-- Étendre les statuts possibles (ajouter pending_tenant)
DO $$
BEGIN
  ALTER TABLE cash_receipts DROP CONSTRAINT IF EXISTS cash_receipts_status_check;
  ALTER TABLE cash_receipts
    ADD CONSTRAINT cash_receipts_status_check
    CHECK (status IN ('draft', 'pending_tenant', 'signed', 'sent', 'archived', 'disputed', 'cancelled'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Nouvelles colonnes pour le contexte signature locataire
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_receipts' AND column_name = 'tenant_signature_latitude'
  ) THEN
    ALTER TABLE cash_receipts ADD COLUMN tenant_signature_latitude NUMERIC(10,7);
    ALTER TABLE cash_receipts ADD COLUMN tenant_signature_longitude NUMERIC(10,7);
    ALTER TABLE cash_receipts ADD COLUMN tenant_device_info JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================
-- 2. Drop ancienne fonction (signature à 10 args)
-- ============================================

DROP FUNCTION IF EXISTS create_cash_receipt(
  UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
);

-- ============================================
-- 3. Nouvelle fonction: création par le propriétaire
--    Crée le reçu en statut 'pending_tenant' avec
--    uniquement la signature du propriétaire.
--    Ne crée PAS de paiement — tant que le locataire
--    n'a pas signé, la facture reste impayée.
-- ============================================

CREATE OR REPLACE FUNCTION create_cash_receipt(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_owner_signature TEXT,
  p_owner_signed_at TIMESTAMPTZ DEFAULT NOW(),
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb,
  p_notes TEXT DEFAULT NULL
) RETURNS cash_receipts AS $$
DECLARE
  v_invoice invoices;
  v_receipt cash_receipts;
  v_hash TEXT;
  v_document_data TEXT;
BEGIN
  -- Récupérer la facture
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Facture non trouvée';
  END IF;

  IF v_invoice.statut = 'paid' THEN
    RAISE EXCEPTION 'Facture déjà payée';
  END IF;

  -- Vérifier qu'aucun reçu pending_tenant n'existe déjà pour cette facture
  IF EXISTS (
    SELECT 1 FROM cash_receipts
    WHERE invoice_id = p_invoice_id
      AND status IN ('pending_tenant', 'signed', 'sent')
  ) THEN
    RAISE EXCEPTION 'Un reçu existe déjà pour cette facture';
  END IF;

  -- Hash d'intégrité (partiel — complété lors de la signature locataire)
  v_document_data := p_invoice_id::TEXT || p_amount::TEXT ||
                     p_owner_signed_at::TEXT ||
                     COALESCE(p_latitude::TEXT, '') || COALESCE(p_longitude::TEXT, '');
  v_hash := encode(sha256(v_document_data::bytea), 'hex');

  -- Créer le reçu sans paiement ni mise à jour de la facture
  INSERT INTO cash_receipts (
    invoice_id, owner_id, tenant_id, property_id,
    amount, amount_words,
    owner_signature,
    owner_signed_at,
    latitude, longitude,
    device_info, document_hash,
    periode, notes, status
  )
  SELECT
    p_invoice_id,
    v_invoice.owner_id,
    v_invoice.tenant_id,
    l.property_id,
    p_amount,
    amount_to_french_words(p_amount),
    p_owner_signature,
    p_owner_signed_at,
    p_latitude,
    p_longitude,
    p_device_info,
    v_hash,
    v_invoice.periode,
    p_notes,
    'pending_tenant'
  FROM invoices i
  JOIN leases l ON i.lease_id = l.id
  WHERE i.id = p_invoice_id
  RETURNING * INTO v_receipt;

  RETURN v_receipt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. Nouvelle fonction: signature par le locataire
--    Complète le reçu avec la signature locataire,
--    crée le paiement et marque la facture comme payée.
-- ============================================

CREATE OR REPLACE FUNCTION sign_cash_receipt_as_tenant(
  p_receipt_id UUID,
  p_tenant_signature TEXT,
  p_tenant_signed_at TIMESTAMPTZ DEFAULT NOW(),
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb
) RETURNS cash_receipts AS $$
DECLARE
  v_receipt cash_receipts;
  v_payment payments;
  v_hash TEXT;
  v_document_data TEXT;
BEGIN
  -- Récupérer le reçu
  SELECT * INTO v_receipt FROM cash_receipts WHERE id = p_receipt_id;
  IF v_receipt IS NULL THEN
    RAISE EXCEPTION 'Reçu non trouvé';
  END IF;

  IF v_receipt.status NOT IN ('pending_tenant', 'draft') THEN
    RAISE EXCEPTION 'Ce reçu a déjà été signé';
  END IF;

  -- Créer le paiement associé
  INSERT INTO payments (invoice_id, montant, moyen, date_paiement, statut)
  VALUES (v_receipt.invoice_id, v_receipt.amount, 'especes', CURRENT_DATE, 'succeeded')
  RETURNING * INTO v_payment;

  -- Recalculer le hash d'intégrité avec les deux signatures
  v_document_data := v_receipt.invoice_id::TEXT || v_receipt.amount::TEXT ||
                     v_receipt.owner_signed_at::TEXT || p_tenant_signed_at::TEXT ||
                     COALESCE(v_receipt.latitude::TEXT, '') ||
                     COALESCE(v_receipt.longitude::TEXT, '') ||
                     COALESCE(p_latitude::TEXT, '') ||
                     COALESCE(p_longitude::TEXT, '');
  v_hash := encode(sha256(v_document_data::bytea), 'hex');

  -- Mettre à jour le reçu
  UPDATE cash_receipts
  SET tenant_signature = p_tenant_signature,
      tenant_signed_at = p_tenant_signed_at,
      tenant_signature_latitude = p_latitude,
      tenant_signature_longitude = p_longitude,
      tenant_device_info = p_device_info,
      payment_id = v_payment.id,
      document_hash = v_hash,
      status = 'signed',
      updated_at = NOW()
  WHERE id = p_receipt_id
  RETURNING * INTO v_receipt;

  -- Marquer la facture comme payée
  UPDATE invoices SET statut = 'paid' WHERE id = v_receipt.invoice_id;

  RETURN v_receipt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Index utile pour les reçus en attente
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cash_receipts_pending_tenant
  ON cash_receipts(tenant_id, status)
  WHERE status = 'pending_tenant';

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 39/71 -- 20260411000000 -- MODERE -- 20260411000000_create_cash_receipt_function.sql
-- risk: ALTER column (type/constraint)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 39/71 (MODERE) 20260411000000_create_cash_receipt_function.sql'; END $$;
-- =====================================================
-- Migration: (Re)création de la fonction create_cash_receipt
-- Date: 2026-04-11
-- Branche: claude/fix-create-cash-receipt-rpc
--
-- Contexte:
--   Le modal "Reçu de paiement espèces" (CashReceiptFlow.tsx) appelait
--   /api/payments/cash-receipt qui invoque ensuite la RPC
--   public.create_cash_receipt. La fonction n'était pas dans le schema
--   cache PostgREST, ce qui produisait l'erreur:
--     "Could not find the function public.create_cash_receipt(
--      p_amount, p_device_info, p_invoice_id, p_latitude, p_longitude,
--      p_notes, p_owner_signature, p_owner_signed_at) in the schema cache"
--
--   Cette migration:
--     - drop TOUTES les versions précédentes (10 args et 8 args) pour
--       éviter les conflits de surcharge,
--     - recrée la fonction avec la signature à 8 args attendue par le
--       front,
--     - renforce la sécurité (vérification propriétaire, idempotence),
--     - reste compatible avec le flux deux étapes (cf. migration
--       20260410220000_cash_receipt_two_step_signature.sql).
--
-- Conformité:
--   - Art. 21 loi n°89-462 du 6 juillet 1989
--   - Décret n°2015-587 du 6 mai 2015
-- =====================================================

BEGIN;

-- ============================================
-- 1. Pré-requis schéma (idempotents)
--    Au cas où la migration 20260410220000 n'aurait pas été appliquée,
--    on assouplit ici les contraintes nécessaires au flux deux étapes.
-- ============================================

-- Le locataire signe dans un second temps : tenant_signature peut être NULL
ALTER TABLE public.cash_receipts
  ALTER COLUMN tenant_signature  DROP NOT NULL;

ALTER TABLE public.cash_receipts
  ALTER COLUMN tenant_signed_at  DROP NOT NULL;

-- Étendre les statuts possibles (ajout de pending_tenant)
DO $$
BEGIN
  ALTER TABLE public.cash_receipts DROP CONSTRAINT IF EXISTS cash_receipts_status_check;
  ALTER TABLE public.cash_receipts
    ADD CONSTRAINT cash_receipts_status_check
    CHECK (status IN ('draft', 'pending_tenant', 'signed', 'sent', 'archived', 'disputed', 'cancelled'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- ============================================
-- 2. Drop des versions précédentes (toutes signatures)
-- ============================================

-- Ancienne signature 10 arguments (migration 2024-11-29)
DROP FUNCTION IF EXISTS public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
);

-- Signature 8 arguments (migration 2026-04-10) — drop pour CREATE OR REPLACE propre
DROP FUNCTION IF EXISTS public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
);

-- ============================================
-- 3. Création de la fonction
-- ============================================
--
-- Le propriétaire crée un reçu en attente de signature locataire.
-- Aucun paiement n'est créé à ce stade — il le sera lors de la
-- signature du locataire (cf. sign_cash_receipt_as_tenant).
--
-- Sécurité:
--   - SECURITY DEFINER + search_path verrouillé sur public, pg_temp
--   - Vérifie que l'invoice existe
--   - Vérifie que l'invoice n'est pas déjà payée ou annulée
--   - Vérifie l'appartenance via invoices.owner_id (déjà dénormalisé)
--     ET via le chemin lease→property→owner_id (defense-in-depth)
--   - Idempotence: refuse la création si un reçu pending_tenant /
--     signed / sent existe déjà pour cette facture
--
CREATE OR REPLACE FUNCTION public.create_cash_receipt(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_owner_signature TEXT,
  p_owner_signed_at TIMESTAMPTZ DEFAULT NOW(),
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb,
  p_notes TEXT DEFAULT NULL
) RETURNS public.cash_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice         public.invoices;
  v_property_owner  UUID;
  v_lease_property  UUID;
  v_receipt         public.cash_receipts;
  v_hash            TEXT;
  v_document_data   TEXT;
BEGIN
  -- (a) Vérifier que la facture existe
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Facture non trouvée'
      USING ERRCODE = 'P0002';
  END IF;

  -- (b) Vérifier que la facture n'est pas déjà payée ou annulée
  IF v_invoice.statut IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'Facture déjà payée ou annulée (statut=%)', v_invoice.statut
      USING ERRCODE = 'P0001';
  END IF;

  -- (c) Defense-in-depth: vérifier l'appartenance via lease→property
  SELECT l.property_id, p.owner_id
    INTO v_lease_property, v_property_owner
  FROM public.leases l
  JOIN public.properties p ON p.id = l.property_id
  WHERE l.id = v_invoice.lease_id;

  IF v_lease_property IS NULL THEN
    RAISE EXCEPTION 'Bien lié à la facture introuvable'
      USING ERRCODE = 'P0002';
  END IF;

  -- L'owner_id de la propriété doit correspondre à celui dénormalisé
  -- sur la facture. Toute incohérence est un signal de tampering.
  IF v_property_owner IS DISTINCT FROM v_invoice.owner_id THEN
    RAISE EXCEPTION 'Incohérence propriétaire facture / bien'
      USING ERRCODE = '42501';
  END IF;

  -- (d) Idempotence: refuser si un reçu actif existe déjà
  IF EXISTS (
    SELECT 1
    FROM public.cash_receipts
    WHERE invoice_id = p_invoice_id
      AND status IN ('pending_tenant', 'signed', 'sent')
  ) THEN
    RAISE EXCEPTION 'Un reçu existe déjà pour cette facture'
      USING ERRCODE = '23505';
  END IF;

  -- (e) Hash d'intégrité (sera complété lors de la signature locataire)
  v_document_data := p_invoice_id::TEXT
                  || '|' || p_amount::TEXT
                  || '|' || p_owner_signed_at::TEXT
                  || '|' || COALESCE(p_latitude::TEXT, '')
                  || '|' || COALESCE(p_longitude::TEXT, '');
  v_hash := encode(sha256(v_document_data::bytea), 'hex');

  -- (f) Création du reçu en statut pending_tenant
  --     (le paiement sera créé lors de la signature locataire)
  INSERT INTO public.cash_receipts (
    invoice_id,
    owner_id,
    tenant_id,
    property_id,
    amount,
    amount_words,
    owner_signature,
    owner_signed_at,
    latitude,
    longitude,
    device_info,
    document_hash,
    periode,
    notes,
    status
  )
  VALUES (
    p_invoice_id,
    v_invoice.owner_id,
    v_invoice.tenant_id,
    v_lease_property,
    p_amount,
    public.amount_to_french_words(p_amount),
    p_owner_signature,
    p_owner_signed_at,
    p_latitude,
    p_longitude,
    COALESCE(p_device_info, '{}'::jsonb),
    v_hash,
    v_invoice.periode,
    p_notes,
    'pending_tenant'
  )
  RETURNING * INTO v_receipt;

  RETURN v_receipt;
END;
$$;

COMMENT ON FUNCTION public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
) IS
  'Crée un reçu de paiement espèces en statut pending_tenant.
   Le propriétaire signe d''abord ; le locataire signera ensuite depuis
   son propre espace, ce qui créera le payment et marquera l''invoice
   comme payée. Conformité art. 21 loi 6 juillet 1989.';

-- ============================================
-- 4. Permissions explicites
-- ============================================

REVOKE ALL ON FUNCTION public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
) TO authenticated, service_role;

-- ============================================
-- 5. Forcer le rechargement du schema cache PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 40/71 -- 20260411100000 -- MODERE -- 20260411100000_fix_work_orders_policy_recursion.sql
-- risk: +1 policies, -1 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 40/71 (MODERE) 20260411100000_fix_work_orders_policy_recursion.sql'; END $$;
-- =====================================================
-- Migration: Fix work_orders RLS recursion via tickets/properties/leases
-- Date: 2026-04-11
--
-- CONTEXT:
-- The original "Owners can view work orders of own properties" SELECT
-- policy on `work_orders` (20240101000001_rls_policies.sql:427-436) runs
-- this EXISTS subquery in its USING clause:
--
--   EXISTS (
--     SELECT 1 FROM tickets t
--     JOIN properties p ON p.id = t.property_id
--     WHERE t.id = work_orders.ticket_id
--       AND p.owner_id = public.user_profile_id()
--   )
--
-- Reading `tickets` triggers the tickets SELECT RLS, which in turn
-- joins through `properties` — and `properties` now has the
-- "Tenants can view linked properties" policy that reads `leases`, and
-- `leases` policies read back into `properties`. Postgres sees the
-- whole graph at plan time and raises:
--
--   ERROR: 42P17 infinite recursion detected in policy for relation …
--
-- handleApiError (lib/helpers/api-error.ts) maps 42P17 to HTTP 500,
-- which is what the owner Tickets page observed as "Erreur lors du
-- chargement des interventions". Standalone work_orders (ticket_id
-- NULL) are also never visible to owners under this policy.
--
-- FIX:
-- Mirror the pattern used by 20260410213940_fix_properties_tenant_policy_recursion.sql:
-- replace the inline EXISTS subquery with a SECURITY DEFINER helper
-- that bypasses RLS on tickets/properties. The helper also covers
-- the standalone case (work_orders.owner_id matches the profile
-- directly, added by 20260408120000_providers_module_sota.sql).
--
-- Safe to re-run (CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS).
-- =====================================================

-- =====================================================
-- 1. SECURITY DEFINER helper: work_order ids the current authenticated
--    user can read as an owner (via ticket.property.owner_id OR direct
--    work_orders.owner_id for standalone orders).
-- =====================================================
CREATE OR REPLACE FUNCTION public.owner_accessible_work_order_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT wo.id
  FROM public.work_orders wo
  LEFT JOIN public.tickets t ON t.id = wo.ticket_id
  LEFT JOIN public.properties p ON p.id = COALESCE(wo.property_id, t.property_id)
  WHERE
    -- Standalone work_orders created through the providers module
    wo.owner_id = public.user_profile_id()
    -- Ticket-linked work_orders where the owner owns the property
    OR p.owner_id = public.user_profile_id();
$$;

COMMENT ON FUNCTION public.owner_accessible_work_order_ids IS
  'Returns work_order ids visible to the currently authenticated owner, '
  'either through a ticket on one of their properties or a standalone '
  'work_orders.owner_id match. SECURITY DEFINER to bypass RLS on tickets, '
  'properties and leases and avoid the infinite recursion triggered by '
  'nesting the tickets→properties→leases policies inside work_orders.';

-- =====================================================
-- 2. Rewrite the "Owners can view work orders of own properties"
--    policy to use the helper — no more inline subquery on tickets.
-- =====================================================
DROP POLICY IF EXISTS "Owners can view work orders of own properties" ON work_orders;

CREATE POLICY "Owners can view work orders of own properties"
  ON work_orders FOR SELECT
  USING (id IN (SELECT public.owner_accessible_work_order_ids()));

COMMENT ON POLICY "Owners can view work orders of own properties" ON work_orders IS
  'Owners can read work_orders attached to their properties (via the '
  'linked ticket) and the standalone ones they created themselves. Uses '
  'the owner_accessible_work_order_ids() SECURITY DEFINER helper to '
  'avoid recursion through the tickets/properties/leases policies.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 41/71 -- 20260411120000 -- SAFE -- 20260411120000_harden_payments_check_constraints.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 41/71 (SAFE) 20260411120000_harden_payments_check_constraints.sql'; END $$;
-- =====================================================
-- Migration: Harden payments CHECK constraints for manual flows
-- Date: 2026-04-11
--
-- CONTEXT:
-- The manual payment modal (`ManualPaymentDialog.tsx`) POSTs to
-- /api/invoices/[id]/mark-paid with `moyen` ∈ {especes, cheque, virement,
-- autre}. The corresponding CHECK on `payments.moyen` was updated to
-- this set by 20241129000002_cash_payments.sql, but the block was
-- wrapped in `EXCEPTION WHEN others THEN NULL` — meaning if the ALTER
-- failed for any reason (e.g. unnamed legacy constraint, parallel
-- migration race, existing row violation), the DB silently kept the
-- original check `('cb', 'virement', 'prelevement')`. On an environment
-- where the update never landed, inserting a `moyen = 'cheque'` row
-- raises:
--
--     new row for relation "payments" violates check constraint
--     "payments_moyen_check"
--
-- …which in mark-paid bubbles up to the outer catch and returns a
-- plain 500 "Erreur serveur" — exactly what the user sees on the
-- chèque / virement / espèces flows.
--
-- Similarly, `syncInvoiceStatusFromPayments` (lib/services/invoice-
-- status.service.ts) cancels stale pending payments by setting
-- `statut = 'cancelled'`, but the current CHECK only allows
-- ('pending', 'succeeded', 'failed', 'refunded'). The update silently
-- fails because the JS client doesn't throw on constraint errors for
-- bulk updates — we've been leaking orphan `pending` rows in the
-- background.
--
-- FIX:
-- Re-assert both constraints with the canonical allowed sets. No
-- EXCEPTION catch-all this time: if this ALTER fails, we want to know
-- loudly (the prior silent path is precisely why the prod DB drifted
-- from the migration history in the first place).
--
-- Safe to re-run: the DROP is IF EXISTS and the ADD is idempotent in
-- the sense that re-running the migration against an already-good DB
-- simply replaces the constraint with an equivalent one.
-- =====================================================

BEGIN;

-- ============================================
-- 1. payments.moyen — all manual + provider methods
-- ============================================
--
-- Allowed:
--   cb           Stripe card (tenant)
--   virement     Manual bank transfer (owner marks paid) OR Stripe SEPA
--   prelevement  SEPA Direct Debit
--   especes      Cash receipt (two-step signature flow)
--   cheque       Paper cheque (owner marks paid)
--   autre        Fallback (no specific method)
--
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_moyen_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_moyen_check
  CHECK (moyen IN ('cb', 'virement', 'prelevement', 'especes', 'cheque', 'autre'));

-- ============================================
-- 2. payments.statut — include 'cancelled' for pending cleanup
-- ============================================
--
-- Allowed:
--   pending      Created, awaiting provider confirmation
--   processing   Provider is processing (e.g. SEPA in flight)
--   succeeded    Settled
--   failed       Provider rejected
--   refunded     Chargeback / manual refund
--   cancelled    Superseded by another payment (used by
--                syncInvoiceStatusFromPayments when a full manual
--                payment makes a Stripe PaymentIntent orphaned)
--
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_statut_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_statut_check
  CHECK (statut IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled'));

-- ============================================
-- 3. Reload PostgREST schema cache
-- ============================================
-- Required for existing PostgREST workers to pick up the new
-- constraint definitions without a restart.

NOTIFY pgrst, 'reload schema';

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 42/71 -- 20260411130000 -- CRITIQUE -- 20260411130000_restore_handle_new_user_sota.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 42/71 (CRITIQUE) 20260411130000_restore_handle_new_user_sota.sql'; END $$;
-- ============================================
-- Migration: Restaurer handle_new_user SOTA 2026
-- Date: 2026-04-11
-- Contexte:
--   La migration 20260329120000_add_agency_to_handle_new_user.sql a écrasé
--   la version 20260327200000 qui contenait :
--     1. L'insertion de la colonne `email` (perdue)
--     2. L'EXCEPTION WHEN OTHERS handler (perdu)
--
--   Cette migration restaure les deux tout en conservant le support des
--   rôles supplémentaires (admin, owner, tenant, provider, guarantor,
--   syndic, agency) et le telephone depuis raw_user_meta_data.
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

  -- Valider le rôle (tous les rôles supportés par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency', 'platform_admin') THEN
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
'SOTA 2026 - Crée automatiquement un profil lors de la création d''un utilisateur auth.
Lit le rôle, prenom, nom et telephone depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
Supporte tous les rôles: admin, owner, tenant, provider, guarantor, syndic, agency, platform_admin.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.
Ne bloque jamais la création auth même en cas d''erreur (EXCEPTION handler).';

-- Backfill des emails NULL (si régressés par la migration 20260329120000)
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
    RAISE NOTICE '[restore_handle_new_user] % profil(s) backfill email', v_updated;
  END IF;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- 43/71 -- 20260411130100 -- MODERE -- 20260411130100_agency_profiles_raison_sociale_nullable.sql
-- risk: ALTER column (type/constraint)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 43/71 (MODERE) 20260411130100_agency_profiles_raison_sociale_nullable.sql'; END $$;
-- ============================================
-- Migration: Rendre raison_sociale nullable sur agency_profiles
-- Date: 2026-04-11
-- Contexte:
--   L'API /api/v1/auth/register upsert agency_profiles avec { profile_id }
--   uniquement à l'inscription. La raison_sociale sera fournie ensuite
--   lors de l'onboarding /agency/onboarding/profile.
--
--   La contrainte NOT NULL faisait crasher silencieusement l'upsert,
--   bloquant toute inscription en tant qu'agence.
-- ============================================

ALTER TABLE public.agency_profiles
  ALTER COLUMN raison_sociale DROP NOT NULL;

COMMENT ON COLUMN public.agency_profiles.raison_sociale IS
'Raison sociale de l''agence. NULL autorisé temporairement entre l''inscription
et la finalisation de l''onboarding /agency/onboarding/profile qui la renseigne.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 44/71 -- 20260411130200 -- DANGEREUX -- 20260411130200_create_syndic_profiles.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 44/71 (DANGEREUX) 20260411130200_create_syndic_profiles.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 45/71 -- 20260411130300 -- SAFE -- 20260411130300_onboarding_role_constraints_allow_syndic_agency.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 45/71 (SAFE) 20260411130300_onboarding_role_constraints_allow_syndic_agency.sql'; END $$;
-- ============================================
-- Migration : Autoriser syndic + agency dans onboarding_analytics et onboarding_reminders
-- Date : 2026-04-11
-- Contexte :
--   La migration 20260114000000 a créé les tables `onboarding_analytics`
--   et `onboarding_reminders` avec une contrainte CHECK sur `role` limitée
--   à ('owner', 'tenant', 'provider', 'guarantor').
--
--   Résultat : toute tentative de tracer l'onboarding d'un compte syndic
--   ou agency (appelée depuis useOnboarding → onboardingAnalyticsService
--   → startOnboarding) échoue avec une violation de contrainte CHECK.
--
--   De même, impossible de planifier un rappel d'onboarding (24h/72h/7d)
--   ou une relance de complétion pour un syndic ou une agence.
--
--   Cette migration remplace la contrainte par la liste complète des rôles
--   supportés par la plateforme Talok.
-- ============================================

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

COMMIT;

-- -----------------------------------------------------------------------------
-- 46/71 -- 20260411140000 -- CRITIQUE -- 20260411140000_copro_assemblies_module.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 46/71 (CRITIQUE) 20260411140000_copro_assemblies_module.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 47/71 -- 20260411140100 -- CRITIQUE -- 20260411140100_copro_governance_module.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 47/71 (CRITIQUE) 20260411140100_copro_governance_module.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 48/71 -- 20260412000000 -- MODERE -- 20260412000000_fix_cash_receipt_rpc_sota.sql
-- risk: +6 policies, -6 policies, ALTER column (type/constraint), UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 48/71 (MODERE) 20260412000000_fix_cash_receipt_rpc_sota.sql'; END $$;
-- =====================================================
-- Migration: Fix SOTA create_cash_receipt RPC + schema cache reload
-- Date: 2026-04-12
-- Branche: claude/talok-account-audit-78zaW
--
-- Contexte:
--   En production, le modal "Reçu de paiement espèces" (CashReceiptFlow)
--   tombe sur l'erreur PostgREST :
--
--     Could not find the function public.create_cash_receipt(
--       p_amount, p_device_info, p_invoice_id, p_latitude, p_longitude,
--       p_notes, p_owner_signature, p_owner_signed_at
--     ) in the schema cache
--
--   La migration 20260411000000 définit déjà la bonne signature 8 args,
--   mais soit elle n'a pas été appliquée en production, soit le cache
--   PostgREST est resté bloqué sur une version antérieure (10 args avec
--   p_tenant_signature obligatoire).
--
--   Cette migration :
--     1. Drop EXPLICITEMENT toutes les signatures connues (10 args, 8 args,
--        et toute variante potentielle) pour éviter les conflits de surcharge.
--     2. Assouplit les contraintes cash_receipts nécessaires au flux 2 étapes
--        (idempotence avec la migration 20260410220000).
--     3. Recrée la fonction avec EXACTEMENT la signature attendue par le front
--        (/api/payments/cash-receipt/route.ts).
--     4. Renforce la sécurité : SECURITY DEFINER + search_path verrouillé,
--        vérification owner dénormalisé vs chemin lease→property, idempotence.
--     5. Renforce / confirme les RLS (owner INSERT+SELECT, tenant SELECT+UPDATE
--        pour contresigner, admin SELECT).
--     6. Force le rechargement du schema cache PostgREST via NOTIFY.
--
-- Conformité:
--   - Art. 21 loi n°89-462 du 6 juillet 1989
--   - Décret n°2015-587 du 6 mai 2015
-- =====================================================

BEGIN;

-- ============================================
-- 1. Pré-requis schéma (idempotents)
-- ============================================

-- Assurer l'existence de la table cash_receipts si aucune migration précédente
-- ne l'a créée (défensif — la table existe normalement via 20241129000002).
CREATE TABLE IF NOT EXISTS public.cash_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  amount NUMERIC(10, 2) NOT NULL,
  amount_words TEXT,
  owner_signature TEXT,
  tenant_signature TEXT,
  owner_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  tenant_signature_latitude NUMERIC(10, 7),
  tenant_signature_longitude NUMERIC(10, 7),
  address_reverse TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  tenant_device_info JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  document_hash TEXT,
  signature_chain TEXT,
  pdf_path TEXT,
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  periode TEXT,
  receipt_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_tenant',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Flow 2 étapes : tenant_signature peut être NULL jusqu'à la contresignature
ALTER TABLE public.cash_receipts
  ALTER COLUMN tenant_signature DROP NOT NULL;
ALTER TABLE public.cash_receipts
  ALTER COLUMN tenant_signed_at DROP NOT NULL;

-- Whitelist étendue des statuts (ajout de pending_tenant si manquant)
DO $$
BEGIN
  ALTER TABLE public.cash_receipts DROP CONSTRAINT IF EXISTS cash_receipts_status_check;
  ALTER TABLE public.cash_receipts
    ADD CONSTRAINT cash_receipts_status_check
    CHECK (status IN ('draft', 'pending_tenant', 'signed', 'sent', 'archived', 'disputed', 'cancelled'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Colonnes pour contexte de contresignature locataire (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_receipts' AND column_name = 'tenant_signature_latitude'
  ) THEN
    ALTER TABLE public.cash_receipts ADD COLUMN tenant_signature_latitude NUMERIC(10,7);
    ALTER TABLE public.cash_receipts ADD COLUMN tenant_signature_longitude NUMERIC(10,7);
    ALTER TABLE public.cash_receipts ADD COLUMN tenant_device_info JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Colonne pour le PDF de l'attestation générée
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_receipts' AND column_name = 'pdf_generated_at'
  ) THEN
    ALTER TABLE public.cash_receipts ADD COLUMN pdf_generated_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================
-- 2. Drop de toutes les versions existantes
-- ============================================
-- On cible explicitement chaque signature connue pour garantir l'absence
-- de conflit de surcharge. DROP IF EXISTS est idempotent.

-- Signature 10 args (migration historique 2024-11-29)
DROP FUNCTION IF EXISTS public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
);

-- Signature 8 args (migrations 2026-04-10 et 2026-04-11)
DROP FUNCTION IF EXISTS public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
);

-- Filet supplémentaire : drop sans qualification si une version anonyme existe
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_cash_receipt'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.signature || ' CASCADE';
  END LOOP;
END $$;

-- ============================================
-- 3. Création de la fonction SOTA
-- ============================================

CREATE OR REPLACE FUNCTION public.create_cash_receipt(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_owner_signature TEXT,
  p_owner_signed_at TIMESTAMPTZ DEFAULT NOW(),
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb,
  p_notes TEXT DEFAULT NULL
) RETURNS public.cash_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice         public.invoices;
  v_property_owner  UUID;
  v_lease_property  UUID;
  v_receipt         public.cash_receipts;
  v_hash            TEXT;
  v_document_data   TEXT;
BEGIN
  -- (a) Vérifier que la facture existe
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Facture non trouvée'
      USING ERRCODE = 'P0002';
  END IF;

  -- (b) Vérifier que la facture n'est pas déjà payée ou annulée
  IF v_invoice.statut IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'Facture déjà payée ou annulée (statut=%)', v_invoice.statut
      USING ERRCODE = 'P0001';
  END IF;

  -- (c) Defense-in-depth: vérifier l'appartenance via lease→property
  SELECT l.property_id, p.owner_id
    INTO v_lease_property, v_property_owner
  FROM public.leases l
  JOIN public.properties p ON p.id = l.property_id
  WHERE l.id = v_invoice.lease_id;

  IF v_lease_property IS NULL THEN
    RAISE EXCEPTION 'Bien lié à la facture introuvable'
      USING ERRCODE = 'P0002';
  END IF;

  -- L'owner_id de la propriété doit correspondre à celui dénormalisé
  -- sur la facture. Toute incohérence est un signal de tampering.
  IF v_property_owner IS DISTINCT FROM v_invoice.owner_id THEN
    RAISE EXCEPTION 'Incohérence propriétaire facture / bien'
      USING ERRCODE = '42501';
  END IF;

  -- (d) Idempotence: refuser si un reçu actif existe déjà
  IF EXISTS (
    SELECT 1
    FROM public.cash_receipts
    WHERE invoice_id = p_invoice_id
      AND status IN ('pending_tenant', 'signed', 'sent')
  ) THEN
    RAISE EXCEPTION 'Un reçu existe déjà pour cette facture'
      USING ERRCODE = '23505';
  END IF;

  -- (e) Hash d'intégrité (sera complété lors de la signature locataire)
  v_document_data := p_invoice_id::TEXT
                  || '|' || p_amount::TEXT
                  || '|' || p_owner_signed_at::TEXT
                  || '|' || COALESCE(p_latitude::TEXT, '')
                  || '|' || COALESCE(p_longitude::TEXT, '');
  v_hash := encode(sha256(v_document_data::bytea), 'hex');

  -- (f) Création du reçu en statut pending_tenant
  INSERT INTO public.cash_receipts (
    invoice_id,
    owner_id,
    tenant_id,
    property_id,
    amount,
    amount_words,
    owner_signature,
    owner_signed_at,
    latitude,
    longitude,
    device_info,
    document_hash,
    periode,
    notes,
    status
  )
  VALUES (
    p_invoice_id,
    v_invoice.owner_id,
    v_invoice.tenant_id,
    v_lease_property,
    p_amount,
    public.amount_to_french_words(p_amount),
    p_owner_signature,
    p_owner_signed_at,
    p_latitude,
    p_longitude,
    COALESCE(p_device_info, '{}'::jsonb),
    v_hash,
    v_invoice.periode,
    p_notes,
    'pending_tenant'
  )
  RETURNING * INTO v_receipt;

  RETURN v_receipt;
END;
$$;

COMMENT ON FUNCTION public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
) IS
  'SOTA 2026 — Crée un reçu de paiement espèces en statut pending_tenant.
   Le propriétaire signe d''abord ; le locataire contresigne ensuite depuis
   son propre espace, ce qui déclenche la création du payment et marque la
   facture comme payée. Conformité art. 21 loi 6 juillet 1989.';

-- ============================================
-- 4. Permissions explicites
-- ============================================

REVOKE ALL ON FUNCTION public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_cash_receipt(
  UUID, NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB, TEXT
) TO authenticated, service_role;

-- ============================================
-- 5. RLS policies (idempotent)
-- ============================================
-- Owner : INSERT + SELECT + UPDATE de ses propres reçus
-- Tenant : SELECT + UPDATE limité (pour contresigner via sign_cash_receipt_as_tenant)
-- Admin : SELECT sur tout

ALTER TABLE public.cash_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_receipts_owner_select" ON public.cash_receipts;
CREATE POLICY "cash_receipts_owner_select" ON public.cash_receipts
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cash_receipts_owner_insert" ON public.cash_receipts;
CREATE POLICY "cash_receipts_owner_insert" ON public.cash_receipts
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cash_receipts_owner_update" ON public.cash_receipts;
CREATE POLICY "cash_receipts_owner_update" ON public.cash_receipts
  FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    owner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cash_receipts_tenant_select" ON public.cash_receipts;
CREATE POLICY "cash_receipts_tenant_select" ON public.cash_receipts
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Le locataire peut UPDATE uniquement pour poser sa signature
-- (la route /tenant-sign passe par une RPC SECURITY DEFINER, cette policy
-- est un filet secondaire au cas où un client UPDATE directement)
DROP POLICY IF EXISTS "cash_receipts_tenant_update" ON public.cash_receipts;
CREATE POLICY "cash_receipts_tenant_update" ON public.cash_receipts
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND status IN ('pending_tenant', 'draft')
  )
  WITH CHECK (
    tenant_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cash_receipts_admin_select" ON public.cash_receipts;
CREATE POLICY "cash_receipts_admin_select" ON public.cash_receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 6. Forcer le rechargement du schema cache PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 49/71 -- 20260412100000 -- CRITIQUE -- 20260412100000_stripe_connect_multi_entity.sql
-- risk: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 49/71 (CRITIQUE) 20260412100000_stripe_connect_multi_entity.sql'; END $$;
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
    ALTER TABLE public.stripe_connect_accounts DROP CONSTRAINT IF EXISTS stripe_connect_unique_profile_or_entity;
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
  ALTER TABLE public.stripe_connect_accounts DROP CONSTRAINT IF EXISTS stripe_connect_has_owner;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 50/71 -- 20260412110000 -- MODERE -- 20260412110000_documents_copro_fk.sql
-- risk: +4 policies, -4 policies, UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 50/71 (MODERE) 20260412110000_documents_copro_fk.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 51/71 -- 20260412120000 -- SAFE -- 20260412120000_copro_fund_call_lines_reminder_tracking.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 51/71 (SAFE) 20260412120000_copro_fund_call_lines_reminder_tracking.sql'; END $$;
-- =====================================================
-- Migration: Ajouter le tracking des relances sur copro_fund_call_lines
-- Date: 2026-04-12
-- Sprint: S3-1 — claude/talok-account-audit-78zaW
--
-- Contexte :
--   Le cron `copro-fund-call-reminders` (S3-1) doit envoyer des relances
--   aux copropriétaires en retard à J+10, J+30, J+60. Pour éviter de
--   spammer (et pour tracer l'historique), il faut pouvoir vérifier
--   quand la dernière relance a été envoyée et combien au total.
--
--   Ces colonnes n'existaient pas sur `copro_fund_call_lines`. Elles
--   existent déjà sur `invoices` pour le cron payment-reminders — on
--   copie ce pattern.
--
-- Colonnes ajoutées :
--   - reminder_count INTEGER DEFAULT 0 : compteur total de relances
--   - last_reminder_at TIMESTAMPTZ : timestamp de la dernière relance
-- =====================================================

BEGIN;

ALTER TABLE public.copro_fund_call_lines
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.copro_fund_call_lines
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

COMMENT ON COLUMN public.copro_fund_call_lines.reminder_count IS
  'Nombre total de relances envoyées pour cette ligne (cron copro-fund-call-reminders, S3-1).';

COMMENT ON COLUMN public.copro_fund_call_lines.last_reminder_at IS
  'Timestamp de la dernière relance envoyée. NULL si aucune relance envoyée.';

-- Index pour éviter le seq scan du cron qui filtre sur reminder_count
CREATE INDEX IF NOT EXISTS idx_copro_fund_call_lines_reminder_tracking
  ON public.copro_fund_call_lines(reminder_count, last_reminder_at)
  WHERE payment_status IN ('pending', 'partial');

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 52/71 -- 20260412130000 -- SAFE -- 20260412130000_copro_cron_schedules.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 52/71 (SAFE) 20260412130000_copro_cron_schedules.sql'; END $$;
-- ============================================================
-- Migration: Schedule copro cron jobs via pg_cron + pg_net
-- Date: 2026-04-12
-- Description: Schedules 5 copropriété cron jobs for automated
--   reminders, alerts, and compliance checks.
-- ============================================================

-- Unschedule existing jobs (idempotent)
SELECT cron.unschedule('copro-convocation-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-convocation-reminders'
);

SELECT cron.unschedule('copro-fund-call-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-fund-call-reminders'
);

SELECT cron.unschedule('copro-overdue-alerts')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-overdue-alerts'
);

SELECT cron.unschedule('copro-assembly-countdown')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-assembly-countdown'
);

SELECT cron.unschedule('copro-pv-distribution')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'copro-pv-distribution'
);

-- ============================================================
-- 1. copro-convocation-reminders — daily 9h UTC
-- ============================================================
SELECT cron.schedule('copro-convocation-reminders', '0 9 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-convocation-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 2. copro-fund-call-reminders — daily 8h UTC
-- ============================================================
SELECT cron.schedule('copro-fund-call-reminders', '0 8 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-fund-call-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 3. copro-overdue-alerts — Monday 8h UTC
-- ============================================================
SELECT cron.schedule('copro-overdue-alerts', '0 8 * * 1',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-overdue-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 4. copro-assembly-countdown — daily 7h UTC
-- ============================================================
SELECT cron.schedule('copro-assembly-countdown', '0 7 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-assembly-countdown',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- 5. copro-pv-distribution — daily 10h UTC
-- ============================================================
SELECT cron.schedule('copro-pv-distribution', '0 10 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/copro-pv-distribution',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);

-- ============================================================
COMMENT ON SCHEMA cron IS 'pg_cron schedules including 5 copro cron jobs: convocation-reminders (9h daily), fund-call-reminders (8h daily), overdue-alerts (8h Monday), assembly-countdown (7h daily), pv-distribution (10h daily)';

COMMIT;

-- -----------------------------------------------------------------------------
-- 53/71 -- 20260412140000 -- CRITIQUE -- 20260412140000_close_admin_self_elevation.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 53/71 (CRITIQUE) 20260412140000_close_admin_self_elevation.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 54/71 -- 20260412150000 -- MODERE -- 20260412150000_create_cron_logs.sql
-- risk: +2 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 54/71 (MODERE) 20260412150000_create_cron_logs.sql'; END $$;
-- =====================================================
-- Migration: Create cron_logs table for admin monitoring
-- =====================================================

CREATE TABLE IF NOT EXISTS cron_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cron_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error', 'running')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_name ON cron_logs(cron_name);
CREATE INDEX IF NOT EXISTS idx_cron_logs_started ON cron_logs(started_at DESC);

-- RLS
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read cron_logs" ON cron_logs;
CREATE POLICY "Admins can read cron_logs"
  ON cron_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'platform_admin')
    )
  );

DROP POLICY IF EXISTS "Service role can insert cron_logs" ON cron_logs;
CREATE POLICY "Service role can insert cron_logs"
  ON cron_logs FOR INSERT
  WITH CHECK (true);

COMMIT;

-- -----------------------------------------------------------------------------
-- 55/71 -- 20260415000000 -- CRITIQUE -- 20260415000000_signup_integrity_guard.sql
-- risk: Touche auth.users
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 55/71 (CRITIQUE) 20260415000000_signup_integrity_guard.sql'; END $$;
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

COMMIT;

-- -----------------------------------------------------------------------------
-- 56/71 -- 20260415121706 -- MODERE -- 20260415121706_harden_sign_cash_receipt_as_tenant.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 56/71 (MODERE) 20260415121706_harden_sign_cash_receipt_as_tenant.sql'; END $$;
-- =====================================================
-- Migration: Hardening SOTA de sign_cash_receipt_as_tenant
-- Date: 2026-04-15
-- Branche: claude/fix-cash-receipt-notification-fsMqC
--
-- Contexte:
--   La migration 20260410220000_cash_receipt_two_step_signature.sql a créé
--   la fonction sign_cash_receipt_as_tenant mais sans :
--     - SET search_path = public, pg_temp (risque d'injection via search_path)
--     - GRANT EXECUTE TO authenticated / service_role
--     - Vérification défensive de l'identité du locataire appelant
--     - NOTIFY pgrst pour recharger le cache
--
--   En production, le flow actuel passe par la route API qui utilise le
--   service role (bypass RLS), donc techniquement fonctionnel. Mais :
--     1. Sans GRANT explicite, tout appel direct depuis un client avec JWT
--        authenticated échoue ou dépend de l'exécution par défaut.
--     2. Sans search_path verrouillé, la fonction SECURITY DEFINER est
--        vulnérable aux attaques de search_path si `pg_temp` est prioritaire.
--     3. Sans tenant-check interne, un appel authenticated direct pourrait
--        signer le reçu d'un autre utilisateur si la RPC est exposée.
--
--   Cette migration :
--     1. Drop toutes les variantes connues de la fonction.
--     2. Recrée la fonction avec SECURITY DEFINER + search_path verrouillé.
--     3. Ajoute une vérification d'identité : si auth.uid() IS NOT NULL,
--        le caller doit correspondre au tenant du reçu (service_role bypass).
--     4. GRANT EXECUTE sur authenticated + service_role.
--     5. NOTIFY pgrst pour recharger le schema cache.
--
-- Conformité:
--   - Art. 21 loi n°89-462 du 6 juillet 1989
--   - Décret n°2015-587 du 6 mai 2015
-- =====================================================

BEGIN;

-- ============================================
-- 1. Drop de toutes les versions existantes
-- ============================================

-- Signature 6 args (migration 20260410220000)
DROP FUNCTION IF EXISTS public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
);

-- Filet de sécurité : drop toute autre surcharge existante
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sign_cash_receipt_as_tenant'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.signature || ' CASCADE';
  END LOOP;
END $$;

-- ============================================
-- 2. Recréation SOTA avec hardening complet
-- ============================================

CREATE OR REPLACE FUNCTION public.sign_cash_receipt_as_tenant(
  p_receipt_id UUID,
  p_tenant_signature TEXT,
  p_tenant_signed_at TIMESTAMPTZ DEFAULT NOW(),
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb
) RETURNS public.cash_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receipt       public.cash_receipts;
  v_payment       public.payments;
  v_caller_profile UUID;
  v_hash          TEXT;
  v_document_data TEXT;
BEGIN
  -- (a) Récupérer le reçu
  SELECT * INTO v_receipt FROM public.cash_receipts WHERE id = p_receipt_id;
  IF v_receipt.id IS NULL THEN
    RAISE EXCEPTION 'Reçu non trouvé'
      USING ERRCODE = 'P0002';
  END IF;

  -- (b) Idempotence / état
  IF v_receipt.status NOT IN ('pending_tenant', 'draft') THEN
    RAISE EXCEPTION 'Ce reçu a déjà été signé'
      USING ERRCODE = '23505';
  END IF;

  -- (c) Vérification d'identité défensive.
  --     - Si la fonction est appelée via une JWT authenticated (auth.uid()
  --       renvoie un user_id), on exige que le profile du caller == tenant_id.
  --     - Si auth.uid() est NULL (appel service_role via l'API route), on
  --       fait confiance au caller côté serveur, qui a déjà vérifié l'identité.
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO v_caller_profile
    FROM public.profiles
    WHERE user_id = auth.uid();

    IF v_caller_profile IS NULL OR v_caller_profile <> v_receipt.tenant_id THEN
      -- Admin bypass : un admin authentifié peut régulariser
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'admin'
      ) THEN
        RAISE EXCEPTION 'Ce reçu n''est pas adressé à votre compte'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- (d) Créer le paiement associé
  INSERT INTO public.payments (invoice_id, montant, moyen, date_paiement, statut)
  VALUES (v_receipt.invoice_id, v_receipt.amount, 'especes', CURRENT_DATE, 'succeeded')
  RETURNING * INTO v_payment;

  -- (e) Hash d'intégrité (deux signatures + contextes)
  v_document_data := v_receipt.invoice_id::TEXT
                  || '|' || v_receipt.amount::TEXT
                  || '|' || COALESCE(v_receipt.owner_signed_at::TEXT, '')
                  || '|' || p_tenant_signed_at::TEXT
                  || '|' || COALESCE(v_receipt.latitude::TEXT, '')
                  || '|' || COALESCE(v_receipt.longitude::TEXT, '')
                  || '|' || COALESCE(p_latitude::TEXT, '')
                  || '|' || COALESCE(p_longitude::TEXT, '');
  v_hash := encode(sha256(v_document_data::bytea), 'hex');

  -- (f) Finaliser le reçu
  UPDATE public.cash_receipts
  SET tenant_signature = p_tenant_signature,
      tenant_signed_at = p_tenant_signed_at,
      tenant_signature_latitude = p_latitude,
      tenant_signature_longitude = p_longitude,
      tenant_device_info = COALESCE(p_device_info, '{}'::jsonb),
      payment_id = v_payment.id,
      document_hash = v_hash,
      status = 'signed',
      updated_at = NOW()
  WHERE id = p_receipt_id
  RETURNING * INTO v_receipt;

  -- (g) Marquer la facture payée
  UPDATE public.invoices
  SET statut = 'paid'
  WHERE id = v_receipt.invoice_id;

  RETURN v_receipt;
END;
$$;

COMMENT ON FUNCTION public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
) IS
  'SOTA 2026 — Contresignature locataire d''un reçu espèces.
   Finalise la signature, crée le paiement et marque la facture comme payée.
   Vérification d''identité défensive (auth.uid() doit matcher tenant_id si
   présent). Conformité art. 21 loi 6 juillet 1989.';

-- ============================================
-- 3. Permissions explicites
-- ============================================

REVOKE ALL ON FUNCTION public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
) TO authenticated, service_role;

-- ============================================
-- 4. Forcer le rechargement du schema cache PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 57/71 -- 20260415124844 -- MODERE -- 20260415124844_add_cheque_photo_to_payments.sql
-- risk: -2 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 57/71 (MODERE) 20260415124844_add_cheque_photo_to_payments.sql'; END $$;
-- =====================================================
-- Migration: Cheque photo upload for manual payments
-- Date: 2026-04-15
--
-- CONTEXT:
-- The manual payment modal (`ManualPaymentDialog.tsx`) lets owners log a
-- cheque payment. We now allow them to attach an optional photo of the
-- physical cheque (e.g. taken from the mobile camera via
-- `<input capture="environment">`). The photo is stored privately and
-- accessed through signed URLs generated by an API route that validates
-- ownership.
--
-- CHANGES:
-- 1. Add `payments.cheque_photo_path TEXT NULL` to store the storage path
--    of the uploaded cheque image (e.g. `cheques/<invoice_id>/<ts>.jpg`).
-- 2. Create a private `payment-proofs` storage bucket with a 5 MB file
--    size limit and a restricted list of image MIME types.
-- 3. Lock RLS on `storage.objects` for this bucket: neither anonymous
--    nor authenticated users can INSERT/SELECT directly. All access is
--    mediated by API routes using the service role key, which both
--    bypasses RLS and performs application-level ownership checks
--    (pattern used throughout the app — see `api/inspections/[iid]/photos`).
--
-- NOTE:
-- The photo is OPTIONAL. An upload failure must never block the payment
-- from being recorded (the JS layer catches upload errors and logs them).
-- =====================================================

BEGIN;

-- ============================================
-- 1. payments.cheque_photo_path column
-- ============================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cheque_photo_path TEXT NULL;

COMMENT ON COLUMN public.payments.cheque_photo_path IS
  'Chemin de stockage (bucket payment-proofs) de la photo du chèque physique. NULL si aucune photo attachée.';

-- ============================================
-- 2. Private storage bucket for payment proofs
-- ============================================
--
-- `public = false` → tout accès passe par des URLs signées générées côté
-- serveur après vérification d'autorisation. 5 MB limit aligné avec le
-- front (voir `ManualPaymentDialog.tsx`).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- 3. RLS — no direct client access to this bucket
-- ============================================
--
-- Volontairement pas de policy permissive : tous les accès (upload,
-- download, delete) transitent par les routes API qui utilisent le
-- service_role client. Cela évite de devoir encoder l'owner dans le
-- path et centralise la vérification d'autorisation (lien facture → bail
-- → owner_id → profile).

DROP POLICY IF EXISTS "payment_proofs_block_anon" ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_block_auth" ON storage.objects;

-- ============================================
-- 4. Reload PostgREST schema cache
-- ============================================

NOTIFY pgrst, 'reload schema';

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 58/71 -- 20260415130000 -- SAFE -- 20260415130000_fix_tenant_accessible_property_ids_security_definer.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 58/71 (SAFE) 20260415130000_fix_tenant_accessible_property_ids_security_definer.sql'; END $$;
-- =====================================================
-- Migration: Hardening SOTA de tenant_accessible_property_ids
-- Date: 2026-04-15
-- Branche: claude/find-sign-receipt-function-Qszfz
--
-- Contexte:
--   La migration 20260410213940_fix_properties_tenant_policy_recursion.sql
--   a créé tenant_accessible_property_ids() en SECURITY DEFINER pour éviter
--   la récursion infinie RLS sur la policy "Tenants can view linked
--   properties" de la table properties.
--
--   Cette fonction est appelée depuis une policy RLS :
--     USING (id IN (SELECT public.tenant_accessible_property_ids()))
--   et lit leases + lease_signers — qui elles-mêmes ont des policies
--   référençant properties. Sans SECURITY DEFINER, on retombe dans la
--   boucle et Postgres lève 42P17 "infinite recursion detected in policy".
--
--   Cette migration durcit la fonction au même niveau SOTA que
--   20260415121706_harden_sign_cash_receipt_as_tenant.sql :
--     1. Recréation via CREATE OR REPLACE (signature inchangée) avec
--        SECURITY DEFINER + STABLE + search_path verrouillé sur
--        (public, pg_temp) — la version "simple" de cette migration
--        omettait pg_temp, ce qui rend la fonction SECURITY DEFINER
--        vulnérable aux attaques de search_path.
--     2. REVOKE ALL FROM PUBLIC + GRANT EXECUTE explicite à authenticated
--        et service_role (la policy est évaluée avec le rôle authenticated).
--     3. NOTIFY pgrst pour recharger le schema cache PostgREST.
--
--   NOTE: Pas de DROP FUNCTION ici — la policy
--   "Tenants can view linked properties" sur properties dépend de cette
--   fonction, donc un DROP (cascade ou non) soit supprimerait la policy,
--   soit ferait échouer la migration. CREATE OR REPLACE suffit puisque la
--   signature (() RETURNS SETOF UUID) est inchangée.
--
-- Conformité:
--   - Best practices Supabase / PostgREST 2026
--   - CERT-PG : PostgreSQL SECURITY DEFINER hardening
-- =====================================================

BEGIN;

-- ============================================
-- 1. Recréation SOTA avec hardening complet
-- ============================================

CREATE OR REPLACE FUNCTION public.tenant_accessible_property_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT l.property_id
  FROM public.leases l
  JOIN public.lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = public.user_profile_id()
    AND l.statut NOT IN ('draft', 'cancelled');
$$;

COMMENT ON FUNCTION public.tenant_accessible_property_ids() IS
  'SOTA 2026 — Retourne les property_id auxquels le profil authentifié a '
  'accès en tant que signataire d''un bail actif (non draft / non cancelled). '
  'SECURITY DEFINER + search_path verrouillé pour bypasser les RLS de '
  'leases / lease_signers et éviter la récursion infinie (42P17) sur la '
  'policy "Tenants can view linked properties" de properties.';

-- ============================================
-- 2. Permissions explicites
-- ============================================

REVOKE ALL ON FUNCTION public.tenant_accessible_property_ids() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.tenant_accessible_property_ids()
  TO authenticated, service_role;

-- ============================================
-- 3. Forcer le rechargement du schema cache PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;

COMMIT;

-- -----------------------------------------------------------------------------
-- 59/71 -- 20260415140000 -- DANGEREUX -- 20260415140000_buildings_sota_fix_wave1.sql
-- risk: UPDATE sans WHERE : on,to
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 59/71 (DANGEREUX) 20260415140000_buildings_sota_fix_wave1.sql'; END $$;
-- ============================================================================
-- Migration : Buildings SOTA Fix — Vague 1 (Sécurité & intégrité)
--
-- Consolide les items P0 de l'audit building-module :
--   #22 — DROP policies "Service role full access" (dangereuses)
--   #7  — ADD COLUMN ownership_type + total_lots_in_building
--   #9  — ADD COLUMN deleted_at (buildings + building_units)
--   #11 — Étendre le trigger sync lease → building_unit.status à INSERT
--         + backfill des building_units déjà liés à des baux actifs
--   #21 — UNIQUE INDEX partiel sur building_units.property_id
--   #8  — Helper SQL `building_has_active_leases(building_id)` réutilisé
--         par la RPC transactionnelle de la Phase 2
--
-- La vue `building_stats` est aussi étendue pour exposer ownership_type /
-- total_lots_in_building et filtrer les soft-deleted.
-- ============================================================================

-- ============================================================================
-- 1. [#22] Supprimer les policies "Service role full access" sur buildings
--    et building_units (court-circuit RLS dangereux en production).
--    Les API routes utilisent déjà createServiceRoleClient() qui bypass RLS
--    nativement via le service_role JWT — aucune policy n'est nécessaire.
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access buildings" ON buildings;
DROP POLICY IF EXISTS "Service role full access building_units" ON building_units;

-- ============================================================================
-- 2. [#7] ownership_type + total_lots_in_building sur buildings
--    full    = le propriétaire possède tous les lots physiques
--    partial = copropriété (quelques lots dans un immeuble plus grand)
--    total_lots_in_building n'a de sens que si ownership_type = 'partial'
-- ============================================================================
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'full'
    CHECK (ownership_type IN ('full', 'partial'));

ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS total_lots_in_building INTEGER
    CHECK (total_lots_in_building IS NULL OR total_lots_in_building > 0);

-- Cohérence : si full → total_lots_in_building doit être NULL
-- (un immeuble "full" ne dépend pas d'un nombre de lots extérieurs).
-- On ne pose pas de contrainte stricte NULL=full pour ne pas bloquer les
-- backfills futurs — les API/UI doivent enforce. Un commentaire documente.
COMMENT ON COLUMN buildings.ownership_type IS
  'full = immeuble entier possédé, partial = quelques lots dans une copropriété';
COMMENT ON COLUMN buildings.total_lots_in_building IS
  'Nombre total de lots dans l''immeuble physique (renseigné uniquement si ownership_type = partial)';

-- ============================================================================
-- 3. [#9] Soft-delete sur buildings ET building_units
--    La route DELETE /api/buildings/[id] tentait déjà `SET deleted_at = NOW()`
--    mais la colonne n'existait pas → fallback hard-delete silencieux.
-- ============================================================================
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE building_units
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index partiels : la majorité des records ont deleted_at = NULL.
-- Un index partiel est bien plus efficace qu'un index plein.
CREATE INDEX IF NOT EXISTS idx_buildings_active
  ON buildings (id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_building_units_active
  ON building_units (building_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN buildings.deleted_at IS
  'Soft-delete timestamp. Les records non-null sont filtrés des queries applicatives et RLS.';
COMMENT ON COLUMN building_units.deleted_at IS
  'Soft-delete timestamp. Cascade depuis buildings.deleted_at.';

-- ============================================================================
-- 4. [#21] Index UNIQUE partiel sur building_units.property_id
--    Empêche qu'un même lot-property soit lié à plusieurs building_units.
--    L'index est partiel (WHERE property_id IS NOT NULL) car les parkings /
--    caves / lots pas encore individualisés peuvent ne pas avoir de property.
--
--    Détection préalable des doublons (fail loud si incohérence existante).
-- ============================================================================
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT property_id
    FROM building_units
    WHERE property_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY property_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add UNIQUE index : % property_id(s) are linked to multiple building_units. Resolve manually before rerunning.',
      dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_building_units_property_id
  ON building_units (property_id)
  WHERE property_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- 5. [#8] Helper SQL réutilisable : compter / lister les lots d'un immeuble
--    qui ont un bail actif. Utilisé par la RPC transactionnelle de Phase 2
--    (upsert_building_with_units) et par l'API route DELETE.
--
--    Statuts considérés comme "actifs" (doivent bloquer DELETE/REPLACE) :
--      active, pending_signature, fully_signed, notice_given
--    Statuts NON bloquants : draft, cancelled, terminated, archived
-- ============================================================================
CREATE OR REPLACE FUNCTION public.building_active_lease_units(p_building_id UUID)
RETURNS TABLE (
  unit_id UUID,
  floor INTEGER,
  "position" TEXT,
  lease_id UUID,
  lease_statut TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bu.id AS unit_id,
    bu.floor,
    bu.position,
    l.id AS lease_id,
    l.statut::TEXT AS lease_statut
  FROM building_units bu
  LEFT JOIN leases l
    ON l.building_unit_id = bu.id
   AND l.statut IN ('active', 'pending_signature', 'fully_signed', 'notice_given')
  WHERE bu.building_id = p_building_id
    AND bu.deleted_at IS NULL
    AND (
      bu.current_lease_id IS NOT NULL
      OR l.id IS NOT NULL
    )
$$;

COMMENT ON FUNCTION public.building_active_lease_units(UUID) IS
  'Retourne les building_units d''un immeuble qui ont un bail bloquant (active / pending_signature / fully_signed / notice_given). Utilisé pour garder DELETE/REPLACE.';

-- ============================================================================
-- 6. [#11] Étendre le trigger sync_building_unit_status_from_lease à INSERT
--    + backfill des building_units dont le bail actif n'était pas synchronisé.
--
--    Comportement :
--      INSERT lease (statut='active', building_unit_id != NULL)
--         → UPDATE building_units.status='occupe', current_lease_id=lease.id
--      UPDATE lease.statut : draft/... → active
--         → UPDATE building_units.status='occupe', current_lease_id=lease.id
--      UPDATE lease.statut : active → terminated/archived/cancelled
--         → UPDATE building_units.status='vacant', current_lease_id=NULL
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_building_unit_status_from_lease()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT : un bail est créé directement actif avec un lot associé
  IF TG_OP = 'INSERT' THEN
    IF NEW.building_unit_id IS NOT NULL AND NEW.statut = 'active' THEN
      UPDATE building_units
         SET status = 'occupe',
             current_lease_id = NEW.id
       WHERE id = NEW.building_unit_id
         AND deleted_at IS NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE : traiter les transitions de statut
  IF TG_OP = 'UPDATE' THEN
    -- Transition vers 'active'
    IF NEW.statut = 'active'
       AND (OLD.statut IS DISTINCT FROM NEW.statut)
       AND NEW.building_unit_id IS NOT NULL THEN
      UPDATE building_units
         SET status = 'occupe',
             current_lease_id = NEW.id
       WHERE id = NEW.building_unit_id
         AND deleted_at IS NULL;
    END IF;

    -- Transition sortant de 'active' vers terminaison
    IF OLD.statut = 'active'
       AND NEW.statut IN ('terminated', 'archived', 'cancelled')
       AND NEW.building_unit_id IS NOT NULL THEN
      UPDATE building_units
         SET status = 'vacant',
             current_lease_id = NULL
       WHERE id = NEW.building_unit_id
         AND current_lease_id = NEW.id
         AND deleted_at IS NULL;
    END IF;

    -- Réassignation : le bail change de building_unit_id
    IF OLD.building_unit_id IS DISTINCT FROM NEW.building_unit_id THEN
      -- Ancien lot : libérer si c'était ce bail qui l'occupait
      IF OLD.building_unit_id IS NOT NULL THEN
        UPDATE building_units
           SET status = 'vacant',
               current_lease_id = NULL
         WHERE id = OLD.building_unit_id
           AND current_lease_id = NEW.id
           AND deleted_at IS NULL;
      END IF;
      -- Nouveau lot : occuper si bail actif
      IF NEW.building_unit_id IS NOT NULL AND NEW.statut = 'active' THEN
        UPDATE building_units
           SET status = 'occupe',
               current_lease_id = NEW.id
         WHERE id = NEW.building_unit_id
           AND deleted_at IS NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recréer le trigger pour couvrir INSERT + UPDATE
DROP TRIGGER IF EXISTS trigger_sync_unit_status_on_lease ON leases;
CREATE TRIGGER trigger_sync_unit_status_on_lease
  AFTER INSERT OR UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_building_unit_status_from_lease();

-- Backfill : synchroniser les building_units dont un bail actif existe déjà
-- mais dont le status / current_lease_id n'a pas été mis à jour.
UPDATE building_units bu
   SET status = 'occupe',
       current_lease_id = l.id
  FROM leases l
 WHERE l.building_unit_id = bu.id
   AND l.statut = 'active'
   AND bu.deleted_at IS NULL
   AND (bu.status IS DISTINCT FROM 'occupe' OR bu.current_lease_id IS DISTINCT FROM l.id);

-- Backfill inverse : libérer les building_units dont le bail n'est plus actif
UPDATE building_units bu
   SET status = 'vacant',
       current_lease_id = NULL
  FROM leases l
 WHERE bu.current_lease_id = l.id
   AND l.statut IN ('terminated', 'archived', 'cancelled')
   AND bu.deleted_at IS NULL;

-- ============================================================================
-- 7. Étendre les RLS policies pour filtrer les soft-deleted
--    Les policies owner_* existantes (migration 20260318020000) sont
--    reconstruites pour inclure `AND deleted_at IS NULL`.
--    Les admin_all et tenant_select laissent voir le soft-deleted (audit).
-- ============================================================================

-- buildings : recréer les policies owner avec filtre deleted_at
DROP POLICY IF EXISTS "buildings_owner_select" ON buildings;
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (
    owner_id = public.user_profile_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "buildings_owner_update" ON buildings;
CREATE POLICY "buildings_owner_update" ON buildings
  FOR UPDATE TO authenticated
  USING (
    owner_id = public.user_profile_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "buildings_owner_delete" ON buildings;
CREATE POLICY "buildings_owner_delete" ON buildings
  FOR DELETE TO authenticated
  USING (
    owner_id = public.user_profile_id()
    AND deleted_at IS NULL
  );
-- INSERT policy inchangée (un nouveau record a forcément deleted_at = NULL).

-- building_units : filtrer via le building parent non-soft-deleted
DROP POLICY IF EXISTS "building_units_owner_select" ON building_units;
CREATE POLICY "building_units_owner_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "building_units_owner_update" ON building_units;
CREATE POLICY "building_units_owner_update" ON building_units
  FOR UPDATE TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "building_units_owner_delete" ON building_units;
CREATE POLICY "building_units_owner_delete" ON building_units
  FOR DELETE TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

-- INSERT policy : idem, filtrer via building non-soft-deleted
DROP POLICY IF EXISTS "building_units_owner_insert" ON building_units;
CREATE POLICY "building_units_owner_insert" ON building_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.owner_id = public.user_profile_id()
         AND b.deleted_at IS NULL
    )
  );

-- ============================================================================
-- 8. Mettre à jour la vue building_stats pour exposer ownership_type
--    et filtrer les soft-deleted.
-- ============================================================================
CREATE OR REPLACE VIEW building_stats AS
SELECT
  b.id,
  b.name,
  b.owner_id,
  b.adresse_complete,
  b.ville,
  b.floors,
  b.ownership_type,
  b.total_lots_in_building,

  -- Comptages par type (uniquement lots actifs)
  COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave') AND bu.deleted_at IS NULL) AS total_units,
  COUNT(bu.id) FILTER (WHERE bu.type = 'parking' AND bu.deleted_at IS NULL) AS total_parkings,
  COUNT(bu.id) FILTER (WHERE bu.type = 'cave' AND bu.deleted_at IS NULL) AS total_caves,

  -- Surface
  COALESCE(SUM(bu.surface) FILTER (WHERE bu.deleted_at IS NULL), 0) AS surface_totale,

  -- Revenus
  COALESCE(SUM(bu.loyer_hc + bu.charges) FILTER (WHERE bu.deleted_at IS NULL), 0) AS revenus_potentiels,
  COALESCE(
    SUM(bu.loyer_hc + bu.charges) FILTER (WHERE bu.status = 'occupe' AND bu.deleted_at IS NULL),
    0
  ) AS revenus_actuels,

  -- Taux d'occupation (uniquement logements habitables, hors parking/cave)
  ROUND(
    COUNT(bu.id) FILTER (
      WHERE bu.status = 'occupe'
        AND bu.type NOT IN ('parking', 'cave')
        AND bu.deleted_at IS NULL
    )::DECIMAL /
    NULLIF(
      COUNT(bu.id) FILTER (
        WHERE bu.type NOT IN ('parking', 'cave')
          AND bu.deleted_at IS NULL
      ),
      0
    ) * 100,
    1
  ) AS occupancy_rate,

  COUNT(bu.id) FILTER (
    WHERE bu.status = 'vacant'
      AND bu.type NOT IN ('parking', 'cave')
      AND bu.deleted_at IS NULL
  ) AS vacant_units,
  COUNT(bu.id) FILTER (
    WHERE bu.status = 'occupe'
      AND bu.type NOT IN ('parking', 'cave')
      AND bu.deleted_at IS NULL
  ) AS occupied_units,
  COUNT(bu.id) FILTER (WHERE bu.status = 'travaux' AND bu.deleted_at IS NULL) AS units_en_travaux

FROM buildings b
LEFT JOIN building_units bu ON bu.building_id = b.id
WHERE b.deleted_at IS NULL
GROUP BY b.id;

COMMENT ON VIEW building_stats IS
  'Vue agrégée des stats par immeuble. Expose ownership_type et total_lots_in_building. Exclut les soft-deleted.';

-- ============================================================================
-- 9. Ajuster get_building_stats() pour filtrer les soft-deleted
-- ============================================================================
CREATE OR REPLACE FUNCTION get_building_stats(p_building_id UUID)
RETURNS TABLE (
  total_units INTEGER,
  total_parkings INTEGER,
  total_caves INTEGER,
  surface_totale DECIMAL,
  revenus_potentiels DECIMAL,
  revenus_actuels DECIMAL,
  occupancy_rate DECIMAL,
  vacant_units INTEGER,
  occupied_units INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave'))::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.type = 'parking')::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.type = 'cave')::INTEGER,
    COALESCE(SUM(bu.surface), 0)::DECIMAL,
    COALESCE(SUM(bu.loyer_hc + bu.charges), 0)::DECIMAL,
    COALESCE(SUM(bu.loyer_hc + bu.charges) FILTER (WHERE bu.status = 'occupe'), 0)::DECIMAL,
    ROUND(
      COUNT(bu.id) FILTER (WHERE bu.status = 'occupe' AND bu.type NOT IN ('parking', 'cave'))::DECIMAL /
      NULLIF(COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave')), 0) * 100,
      1
    )::DECIMAL,
    COUNT(bu.id) FILTER (WHERE bu.status = 'vacant' AND bu.type NOT IN ('parking', 'cave'))::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.status = 'occupe' AND bu.type NOT IN ('parking', 'cave'))::INTEGER
  FROM building_units bu
  WHERE bu.building_id = p_building_id
    AND bu.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_building_stats IS
  'Stats détaillées d''un immeuble — exclut les lots soft-deleted (deleted_at IS NULL).';

COMMIT;

-- -----------------------------------------------------------------------------
-- 60/71 -- 20260415150000 -- MODERE -- 20260415150000_upsert_building_with_units_rpc.sql
-- risk: UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 60/71 (MODERE) 20260415150000_upsert_building_with_units_rpc.sql'; END $$;
-- ============================================================================
-- Migration : RPC transactionnelle upsert_building_with_units
--
-- Encapsule en une seule transaction SQL l'ensemble des opérations de
-- création/mise à jour d'un immeuble et de ses lots :
--   1. UPSERT du record buildings
--   2. Garde baux actifs (via building_active_lease_units)
--   3. UPSERT des properties lots (préserve les IDs existants via floor-position)
--   4. DELETE + INSERT des building_units (atomiquement dans la même fonction)
--
-- Items de l'audit adressés :
--   #4  — Transaction SQL pour POST /building-units
--   #8  — Garde baux actifs avant DELETE
--   #10 — UPDATE du `name` dans UPSERT (pas figé à la création)
--   #24 — Supprime le hardcode `meuble = studio||local_commercial`
--   #6  — Propagation loyer/charges/depot_garantie vers properties lots
--         (y compris depot_garantie qui manquait)
-- ============================================================================

-- ============================================================================
-- 1. Fonction utilitaire permanente : génération de unique_code property
--    Format : PROP-XXXX-XXXX (8 caractères random, charset alphanum majuscule)
--    Identique à lib/helpers/code-generator.ts côté app.
-- ============================================================================
CREATE OR REPLACE FUNCTION public._gen_prop_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  charset TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT;
  i INT;
  max_attempts INT := 20;
  attempt INT := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    result := 'PROP-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM properties WHERE unique_code = result);
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'gen_prop_code_max_attempts_exceeded';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public._gen_prop_code() IS
  'Génère un unique_code PROP-XXXX-XXXX unique dans la table properties.';

-- ============================================================================
-- 2. RPC transactionnelle : upsert_building_with_units
--    Signature :
--      upsert_building_with_units(
--        p_property_id UUID,          -- property wrapper (type='immeuble')
--        p_building_data JSONB,       -- champs building (tous optionnels)
--        p_units JSONB                -- array des lots (obligatoire)
--      ) RETURNS JSONB
--
--    Retour :
--      { "building_id": UUID, "unit_count": INT, "lot_property_ids": [UUID] }
--
--    Exceptions :
--      P0001 'property_not_found'      — property parent introuvable
--      P0002 'active_leases_blocking:<list>' — baux actifs bloquent le remplacement
--      23505 (unique_violation)        — contrainte UNIQUE violée (collision floor/position)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_building_with_units(
  p_property_id UUID,
  p_building_data JSONB,
  p_units JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_legal_entity_id UUID;
  v_adresse TEXT;
  v_cp TEXT;
  v_ville TEXT;
  v_dept TEXT;
  v_building_id UUID;
  v_active_count INTEGER;
  v_active_list TEXT;
  v_existing_prop_map JSONB := '{}'::JSONB;
  v_unit JSONB;
  v_key TEXT;
  v_lot_prop_id UUID;
  v_lot_prop_ids UUID[] := ARRAY[]::UUID[];
  v_new_code TEXT;
  v_floor_label TEXT;
  v_floor INTEGER;
  v_pos TEXT;
  v_type TEXT;
  v_template TEXT;
  v_unit_count INTEGER := 0;
  v_has_ascenseur BOOLEAN;
BEGIN
  -- ─── 1. Valider la property parent ────────────────────────────────────────
  SELECT owner_id, legal_entity_id, adresse_complete, code_postal, ville, departement
    INTO v_owner_id, v_legal_entity_id, v_adresse, v_cp, v_ville, v_dept
    FROM properties
   WHERE id = p_property_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'property_not_found' USING ERRCODE = 'P0001';
  END IF;

  v_has_ascenseur := COALESCE((p_building_data->>'has_ascenseur')::BOOLEAN, false);

  -- ─── 2. Upsert building ───────────────────────────────────────────────────
  SELECT id INTO v_building_id
    FROM buildings
   WHERE property_id = p_property_id
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_building_id IS NOT NULL THEN
    -- Garde baux actifs avant tout replacement
    SELECT COUNT(*), string_agg('Lot ' || "position" || ' (étage ' || floor || ')', ', ')
      INTO v_active_count, v_active_list
      FROM public.building_active_lease_units(v_building_id);

    IF v_active_count > 0 THEN
      RAISE EXCEPTION 'active_leases_blocking:%', v_active_list
        USING ERRCODE = 'P0002';
    END IF;

    -- UPDATE building (COALESCE pour ne pas écraser avec NULL si non fourni)
    UPDATE buildings SET
      name = COALESCE(NULLIF(p_building_data->>'name', ''), name),
      floors = COALESCE((p_building_data->>'floors')::INTEGER, floors),
      has_ascenseur = COALESCE((p_building_data->>'has_ascenseur')::BOOLEAN, has_ascenseur),
      has_gardien = COALESCE((p_building_data->>'has_gardien')::BOOLEAN, has_gardien),
      has_interphone = COALESCE((p_building_data->>'has_interphone')::BOOLEAN, has_interphone),
      has_digicode = COALESCE((p_building_data->>'has_digicode')::BOOLEAN, has_digicode),
      has_local_velo = COALESCE((p_building_data->>'has_local_velo')::BOOLEAN, has_local_velo),
      has_local_poubelles = COALESCE((p_building_data->>'has_local_poubelles')::BOOLEAN, has_local_poubelles),
      has_parking_commun = COALESCE((p_building_data->>'has_parking_commun')::BOOLEAN, has_parking_commun),
      has_jardin_commun = COALESCE((p_building_data->>'has_jardin_commun')::BOOLEAN, has_jardin_commun),
      ownership_type = COALESCE(NULLIF(p_building_data->>'ownership_type', ''), ownership_type),
      total_lots_in_building = CASE
        WHEN p_building_data ? 'total_lots_in_building'
             AND p_building_data->>'total_lots_in_building' IS NOT NULL
          THEN (p_building_data->>'total_lots_in_building')::INTEGER
        ELSE total_lots_in_building
      END,
      construction_year = CASE
        WHEN p_building_data ? 'construction_year'
             AND p_building_data->>'construction_year' IS NOT NULL
          THEN (p_building_data->>'construction_year')::INTEGER
        ELSE construction_year
      END,
      surface_totale = CASE
        WHEN p_building_data ? 'surface_totale'
             AND p_building_data->>'surface_totale' IS NOT NULL
          THEN (p_building_data->>'surface_totale')::DECIMAL
        ELSE surface_totale
      END,
      notes = COALESCE(p_building_data->>'notes', notes),
      updated_at = NOW()
    WHERE id = v_building_id;
  ELSE
    -- INSERT building
    INSERT INTO buildings (
      owner_id, property_id, name,
      adresse_complete, code_postal, ville, departement,
      floors,
      has_ascenseur, has_gardien, has_interphone, has_digicode,
      has_local_velo, has_local_poubelles, has_parking_commun, has_jardin_commun,
      ownership_type, total_lots_in_building,
      construction_year, surface_totale, notes
    ) VALUES (
      v_owner_id, p_property_id,
      COALESCE(NULLIF(p_building_data->>'name', ''), LEFT(COALESCE(v_adresse, 'Immeuble'), 200)),
      v_adresse, v_cp, v_ville, v_dept,
      COALESCE((p_building_data->>'floors')::INTEGER, 1),
      COALESCE((p_building_data->>'has_ascenseur')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_gardien')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_interphone')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_digicode')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_local_velo')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_local_poubelles')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_parking_commun')::BOOLEAN, false),
      COALESCE((p_building_data->>'has_jardin_commun')::BOOLEAN, false),
      COALESCE(NULLIF(p_building_data->>'ownership_type', ''), 'full'),
      NULLIF(p_building_data->>'total_lots_in_building', '')::INTEGER,
      NULLIF(p_building_data->>'construction_year', '')::INTEGER,
      NULLIF(p_building_data->>'surface_totale', '')::DECIMAL,
      NULLIF(p_building_data->>'notes', '')
    )
    RETURNING id INTO v_building_id;
  END IF;

  -- ─── 3. Map des property_id existantes par floor-position ─────────────────
  SELECT COALESCE(
           jsonb_object_agg(floor::TEXT || '-' || position, property_id),
           '{}'::JSONB
         )
    INTO v_existing_prop_map
    FROM building_units
   WHERE building_id = v_building_id
     AND property_id IS NOT NULL
     AND deleted_at IS NULL;

  -- ─── 4. DELETE des building_units (les properties lots restent) ───────────
  DELETE FROM building_units WHERE building_id = v_building_id;

  -- ─── 5. Pour chaque unit du payload : upsert property lot + insert unit ───
  FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units) LOOP
    v_floor := (v_unit->>'floor')::INTEGER;
    v_pos := v_unit->>'position';
    v_type := v_unit->>'type';
    v_template := NULLIF(lower(COALESCE(v_unit->>'template', '')), '');
    v_key := v_floor::TEXT || '-' || v_pos;

    -- Label étage
    IF v_floor < 0 THEN v_floor_label := 'SS' || abs(v_floor);
    ELSIF v_floor = 0 THEN v_floor_label := 'RDC';
    ELSE v_floor_label := 'Étage ' || v_floor;
    END IF;

    v_lot_prop_id := NULL;
    IF v_existing_prop_map ? v_key THEN
      v_lot_prop_id := (v_existing_prop_map->>v_key)::UUID;

      -- UPDATE property lot existante
      -- meuble : on respecte le payload si fourni, sinon on garde la valeur actuelle
      UPDATE properties SET
        type = v_type,
        surface = (v_unit->>'surface')::DECIMAL,
        nb_pieces = (v_unit->>'nb_pieces')::INTEGER,
        loyer_hc = (v_unit->>'loyer_hc')::DECIMAL,
        charges_mensuelles = (v_unit->>'charges')::DECIMAL,
        depot_garantie = (v_unit->>'depot_garantie')::DECIMAL,
        meuble = CASE
          WHEN v_unit ? 'meuble' AND v_unit->>'meuble' IS NOT NULL
            THEN (v_unit->>'meuble')::BOOLEAN
          ELSE meuble
        END,
        ascenseur = v_has_ascenseur,
        adresse_complete = COALESCE(v_adresse, '')
                           || ' - Lot ' || v_pos
                           || ', ' || v_floor_label,
        updated_at = NOW()
      WHERE id = v_lot_prop_id;
    ELSE
      -- INSERT property lot
      v_new_code := public._gen_prop_code();

      INSERT INTO properties (
        owner_id, legal_entity_id, parent_property_id,
        type, etat, unique_code,
        adresse_complete, code_postal, ville, departement,
        surface, nb_pieces, nb_chambres,
        ascenseur, meuble,
        loyer_hc, charges_mensuelles, depot_garantie
      ) VALUES (
        v_owner_id, v_legal_entity_id, p_property_id,
        v_type, 'published', v_new_code,
        COALESCE(v_adresse, '') || ' - Lot ' || v_pos || ', ' || v_floor_label,
        COALESCE(v_cp, ''), COALESCE(v_ville, ''), COALESCE(v_dept, ''),
        (v_unit->>'surface')::DECIMAL,
        (v_unit->>'nb_pieces')::INTEGER,
        0,
        v_has_ascenseur,
        COALESCE((v_unit->>'meuble')::BOOLEAN, false),
        (v_unit->>'loyer_hc')::DECIMAL,
        (v_unit->>'charges')::DECIMAL,
        (v_unit->>'depot_garantie')::DECIMAL
      )
      RETURNING id INTO v_lot_prop_id;
    END IF;

    -- INSERT building_unit
    INSERT INTO building_units (
      building_id, floor, position, type, template,
      surface, nb_pieces,
      loyer_hc, charges, depot_garantie,
      status, property_id
    ) VALUES (
      v_building_id, v_floor, v_pos, v_type, v_template,
      (v_unit->>'surface')::DECIMAL,
      (v_unit->>'nb_pieces')::INTEGER,
      (v_unit->>'loyer_hc')::DECIMAL,
      (v_unit->>'charges')::DECIMAL,
      (v_unit->>'depot_garantie')::DECIMAL,
      COALESCE(NULLIF(v_unit->>'status', ''), 'vacant'),
      v_lot_prop_id
    );

    v_lot_prop_ids := array_append(v_lot_prop_ids, v_lot_prop_id);
    v_unit_count := v_unit_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'building_id', v_building_id,
    'unit_count', v_unit_count,
    'lot_property_ids', to_jsonb(v_lot_prop_ids)
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_building_with_units(UUID, JSONB, JSONB) IS
  'Upsert atomique d''un immeuble + lots + properties lots. Refuse si au moins un lot a un bail bloquant. Renvoie { building_id, unit_count, lot_property_ids }.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 61/71 -- 20260415160000 -- DANGEREUX -- 20260415160000_buildings_rls_entity_members_support.sql
-- risk: UPDATE sans WHERE : to
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 61/71 (DANGEREUX) 20260415160000_buildings_rls_entity_members_support.sql'; END $$;
-- ============================================================================
-- Migration : RLS Support entity_members pour buildings et building_units
--
-- Item #18 de l'audit building-module : actuellement les policies owner_* sur
-- buildings et building_units ne vérifient que `owner_id = user_profile_id()`.
-- Les membres d'une SCI (via entity_members) n'ont pas accès aux immeubles
-- de leur entité, alors que la page /owner/buildings/[id] les autorise déjà
-- au niveau SSR.
--
-- Cette migration étend les policies pour inclure ce cas :
--   Un user est autorisé sur un building si :
--     (a) il est l'owner direct (pattern existant)
--     (b) OU il est membre de l'entité légale associée à la property parent
--         (via entity_members.user_id = auth.uid())
--
-- Les policies tenant/admin ne sont pas touchées.
-- ============================================================================

-- ============================================================================
-- 1. Fonction helper : user_in_entity_of_property(property_id)
--    Retourne true si l'utilisateur courant est membre de l'entité légale
--    rattachée à la property. Encapsule le pattern pour éviter les sous-
--    requêtes répétées dans chaque policy.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_in_entity_of_property(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM properties p
    JOIN entity_members em ON em.entity_id = p.legal_entity_id
    WHERE p.id = p_property_id
      AND p.legal_entity_id IS NOT NULL
      AND em.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.user_in_entity_of_property(UUID) IS
  'Retourne true si auth.uid() est membre (entity_members) de l''entité légale de la property. Utilisé par les RLS policies buildings/building_units pour le cas SCI.';

-- ============================================================================
-- 2. Recréer les policies owner sur buildings pour inclure entity_members
-- ============================================================================
DROP POLICY IF EXISTS "buildings_owner_select" ON buildings;
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (
    buildings.deleted_at IS NULL
    AND (
      owner_id = public.user_profile_id()
      OR (
        property_id IS NOT NULL
        AND public.user_in_entity_of_property(property_id)
      )
    )
  );

DROP POLICY IF EXISTS "buildings_owner_update" ON buildings;
CREATE POLICY "buildings_owner_update" ON buildings
  FOR UPDATE TO authenticated
  USING (
    buildings.deleted_at IS NULL
    AND (
      owner_id = public.user_profile_id()
      OR (
        property_id IS NOT NULL
        AND public.user_in_entity_of_property(property_id)
      )
    )
  );

DROP POLICY IF EXISTS "buildings_owner_delete" ON buildings;
CREATE POLICY "buildings_owner_delete" ON buildings
  FOR DELETE TO authenticated
  USING (
    buildings.deleted_at IS NULL
    AND (
      owner_id = public.user_profile_id()
      OR (
        property_id IS NOT NULL
        AND public.user_in_entity_of_property(property_id)
      )
    )
  );

-- INSERT : seul le propriétaire direct peut créer un building. Un membre SCI
-- ne doit pas pouvoir créer un building hors du flux wizard. On garde la
-- contrainte restrictive sur INSERT (owner_id = user_profile_id()).

-- ============================================================================
-- 3. Recréer les policies owner sur building_units pour inclure entity_members
--    via buildings.property_id → properties.legal_entity_id
-- ============================================================================
DROP POLICY IF EXISTS "building_units_owner_select" ON building_units;
CREATE POLICY "building_units_owner_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
    )
  );

DROP POLICY IF EXISTS "building_units_owner_update" ON building_units;
CREATE POLICY "building_units_owner_update" ON building_units
  FOR UPDATE TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
    )
  );

DROP POLICY IF EXISTS "building_units_owner_delete" ON building_units;
CREATE POLICY "building_units_owner_delete" ON building_units
  FOR DELETE TO authenticated
  USING (
    building_units.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
    )
  );

DROP POLICY IF EXISTS "building_units_owner_insert" ON building_units;
CREATE POLICY "building_units_owner_insert" ON building_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buildings b
       WHERE b.id = building_units.building_id
         AND b.deleted_at IS NULL
         AND (
           b.owner_id = public.user_profile_id()
           OR (
             b.property_id IS NOT NULL
             AND public.user_in_entity_of_property(b.property_id)
           )
         )
    )
  );

COMMIT;

-- -----------------------------------------------------------------------------
-- 62/71 -- 20260415230000 -- DANGEREUX -- 20260415230000_enforce_invoice_paid_has_payment.sql
-- risk: UPDATE sans WHERE : of
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 62/71 (DANGEREUX) 20260415230000_enforce_invoice_paid_has_payment.sql'; END $$;
-- =============================================================================
-- Migration : garde-fou "une invoice paid a toujours un payment associé"
-- Date      : 2026-04-15
-- Context   :
--   L'audit du 2026-04-15 a identifie 2 invoices en statut 'paid' sans
--   aucune row payments.succeeded associee (lease da2eb9da..., periodes
--   2026-01 et 2026-04). Cause racine : la Server Action
--   `app/owner/money/actions.ts::markInvoiceAsPaid()` faisait un UPDATE
--   direct `statut='paid'` sans creer de payment. `ensureReceiptDocument`
--   prenant un payment_id en entree, ces invoices devenaient impossibles
--   a rattraper proprement : pas de quittance pour le locataire, pas
--   d'ecriture comptable `rent_received`.
--
--   Fix applicatif : la Server Action a ete refactoree pour creer un
--   payment puis appeler ensureReceiptDocument (commit associe).
--
--   Cette migration ajoute un garde-fou DB pour bloquer *tout* autre
--   chemin (SQL direct, nouvelle route future, migration bogguee...)
--   qui tenterait de poser statut='paid' sans payment succeeded.
--
-- Exceptions legitimes :
--   - Avoirs (montant_total <= 0) issus de la regularisation annuelle
--     de charges : `metadata->>'type' = 'avoir_regularisation'` — ces
--     "factures" sont des credits poses a `paid` d'emblee car il n'y a
--     pas de flux d'argent entrant (c'est un trop-percu rembourse/deduit).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Trigger function : check et auto-populate paid_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enforce_invoice_paid_has_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_count INTEGER;
  v_latest_payment_date DATE;
  v_is_credit_note BOOLEAN;
BEGIN
  -- Ne declenche que sur les transitions vers 'paid' (INSERT ou UPDATE).
  -- Les updates qui conservent statut='paid' (ex: changement de metadata)
  -- passent sans verification.
  IF TG_OP = 'INSERT' THEN
    IF NEW.statut IS DISTINCT FROM 'paid' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.statut IS DISTINCT FROM 'paid' OR OLD.statut = 'paid' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Exception legitime : avoirs de regularisation de charges
  v_is_credit_note := COALESCE(NEW.metadata->>'type', '') IN (
    'avoir_regularisation',
    'credit_note'
  ) OR COALESCE(NEW.montant_total, 0) <= 0;

  IF v_is_credit_note THEN
    RETURN NEW;
  END IF;

  -- Verifier qu'au moins un payment succeeded existe pour cette invoice
  SELECT COUNT(*), MAX(p.date_paiement)
    INTO v_payment_count, v_latest_payment_date
  FROM public.payments p
  WHERE p.invoice_id = NEW.id
    AND p.statut = 'succeeded';

  IF v_payment_count = 0 THEN
    RAISE EXCEPTION
      'Invoice % cannot be marked as paid without a succeeded payment. '
      'Create a row in public.payments (statut=succeeded) first, or use '
      '/api/invoices/[id]/mark-paid / markInvoiceAsPaid() which handle it '
      'atomically. For legitimate credit notes, set metadata->>''type'' '
      'to ''avoir_regularisation''.',
      NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Auto-populate paid_at si NULL (commodite — la majorite des chemins
  -- applicatifs le remplissent deja, mais certains flux historiques
  -- l'oublient. Sans paid_at, l'UI /tenant/payments affiche "Date inconnue").
  IF NEW.paid_at IS NULL THEN
    NEW.paid_at := COALESCE(
      v_latest_payment_date::timestamptz,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_invoice_paid_has_payment IS
  'Bloque les transitions invoices.statut -> ''paid'' sans row payments '
  '(statut=succeeded) associee. Exception pour les avoirs de regularisation '
  '(metadata.type = avoir_regularisation ou montant_total <= 0). '
  'Auto-populate paid_at si NULL. Voir migration 20260415230000.';


-- =============================================================================
-- 2. Attacher le trigger (BEFORE pour pouvoir modifier NEW.paid_at)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_enforce_invoice_paid_has_payment ON public.invoices;

CREATE TRIGGER trg_enforce_invoice_paid_has_payment
  BEFORE INSERT OR UPDATE OF statut ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_paid_has_payment();


-- =============================================================================
-- 3. Backfill paid_at pour les invoices actuellement paid avec paid_at NULL
--    mais un payment succeeded existant.
--    (ne touche PAS les invoices orphelines sans payment — elles restent
--     visibles au monitoring via la requete 1g de scripts/diagnose-receipts.sql)
-- =============================================================================
UPDATE public.invoices i
SET paid_at = sub.latest_payment_date
FROM (
  SELECT p.invoice_id, MAX(p.date_paiement)::timestamptz AS latest_payment_date
  FROM public.payments p
  WHERE p.statut = 'succeeded'
  GROUP BY p.invoice_id
) sub
WHERE i.id = sub.invoice_id
  AND i.statut = 'paid'
  AND i.paid_at IS NULL;


-- =============================================================================
-- 4. Vue de monitoring : invoices paid sans payment (incident detection)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_invoices_paid_without_payment AS
SELECT
  i.id AS invoice_id,
  i.lease_id,
  i.tenant_id,
  i.owner_id,
  i.periode,
  i.montant_total,
  i.statut,
  i.paid_at,
  i.receipt_generated,
  i.created_at,
  COALESCE(i.metadata->>'type', '') AS invoice_type,
  (i.metadata->>'type' = 'avoir_regularisation' OR i.montant_total <= 0) AS is_credit_note_legitimate
FROM public.invoices i
WHERE i.statut = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.invoice_id = i.id AND p.statut = 'succeeded'
  );

COMMENT ON VIEW public.v_invoices_paid_without_payment IS
  'Invoices en statut paid sans payment succeeded associe. Doit etre vide '
  'apres le deploiement du trigger enforce_invoice_paid_has_payment. Utile '
  'pour le monitoring : exposer dans un health-check / alerting. Les credits '
  'legitimes (avoirs de regularisation) ont is_credit_note_legitimate = true.';

GRANT SELECT ON public.v_invoices_paid_without_payment TO authenticated;


COMMIT;

-- =============================================================================
-- Rollback :
--   BEGIN;
--     DROP VIEW IF EXISTS public.v_invoices_paid_without_payment;
--     DROP TRIGGER IF EXISTS trg_enforce_invoice_paid_has_payment ON public.invoices;
--     DROP FUNCTION IF EXISTS public.enforce_invoice_paid_has_payment();
--   COMMIT;
-- =============================================================================

COMMIT;

-- -----------------------------------------------------------------------------
-- 63/71 -- 20260416100000 -- MODERE -- 20260416100000_fix_messages_conversation_trigger.sql
-- risk: +1 triggers, UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 63/71 (MODERE) 20260416100000_fix_messages_conversation_trigger.sql'; END $$;
-- Migration: Fix Messages Module
-- 1. Trigger AFTER INSERT ON messages → update conversations metadata
-- 2. Backfill existing conversations with last_message data
-- 3. Unique index to prevent duplicate conversations (race condition)

-- ============================================
-- 1. TRIGGER: update conversation on new message
-- ============================================

CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW(),
    owner_unread_count = CASE
      WHEN NEW.sender_role = 'tenant' THEN COALESCE(owner_unread_count, 0) + 1
      ELSE owner_unread_count
    END,
    tenant_unread_count = CASE
      WHEN NEW.sender_role = 'owner' THEN COALESCE(tenant_unread_count, 0) + 1
      ELSE tenant_unread_count
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON messages;

CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();

-- ============================================
-- 2. BACKFILL: populate last_message_at/preview for existing conversations
-- ============================================

UPDATE conversations c
SET
  last_message_at = sub.max_created,
  last_message_preview = sub.last_content,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.created_at AS max_created,
    LEFT(m.content, 100) AS last_content
  FROM messages m
  WHERE m.deleted_at IS NULL
  ORDER BY m.conversation_id, m.created_at DESC
) sub
WHERE c.id = sub.conversation_id
  AND c.last_message_at IS NULL;

-- ============================================
-- 3. UNIQUE INDEX: prevent duplicate active conversations
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_active_pair
  ON conversations (property_id, owner_profile_id, tenant_profile_id)
  WHERE status = 'active';

COMMIT;

-- -----------------------------------------------------------------------------
-- 64/71 -- 20260417090000 -- SAFE -- 20260417090000_charges_reg_invoice_link.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 64/71 (SAFE) 20260417090000_charges_reg_invoice_link.sql'; END $$;
-- =====================================================
-- MIGRATION: Gap P0 #1 — Liaison régul ↔ invoice
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- Ajoute la colonne regularization_invoice_id sur
-- lease_charge_regularizations pour lier la régul à
-- l'invoice générée au moment du settle (Sprint 2).
--
-- Idempotent : utilise ADD COLUMN IF NOT EXISTS.
-- =====================================================

ALTER TABLE lease_charge_regularizations
  ADD COLUMN IF NOT EXISTS regularization_invoice_id UUID
    REFERENCES invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lcr_regularization_invoice_id
  ON lease_charge_regularizations(regularization_invoice_id)
  WHERE regularization_invoice_id IS NOT NULL;

COMMENT ON COLUMN lease_charge_regularizations.regularization_invoice_id IS
  'FK vers invoices — renseignée au settle lorsque le mode de règlement génère une facture (Stripe, next_rent, installments_12).';

COMMIT;

-- -----------------------------------------------------------------------------
-- 65/71 -- 20260417090100 -- DANGEREUX -- 20260417090100_tax_notices_table.sql
-- risk: UPDATE sans WHERE : on
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 65/71 (DANGEREUX) 20260417090100_tax_notices_table.sql'; END $$;
-- =====================================================
-- MIGRATION: Sprint 0.a — Table tax_notices
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- Stocke les avis de taxe foncière par bien et par année
-- pour extraire le montant TEOM net récupérable auprès
-- du locataire (décret 87-713 + note DGFiP : frais de
-- gestion ~8% non récupérables).
--
-- Idempotent : CREATE TABLE IF NOT EXISTS + DROP POLICY
-- IF EXISTS avant CREATE POLICY.
-- =====================================================

CREATE TABLE IF NOT EXISTS tax_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  teom_brut INTEGER CHECK (teom_brut IS NULL OR teom_brut >= 0),
  frais_gestion INTEGER CHECK (frais_gestion IS NULL OR frais_gestion >= 0),
  teom_net INTEGER CHECK (teom_net IS NULL OR teom_net >= 0),
  reom_applicable BOOLEAN NOT NULL DEFAULT false,
  extraction_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (extraction_method IN ('manual', 'ocr')),
  validated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tax_notices_property_year_unique UNIQUE (property_id, year)
);

CREATE INDEX IF NOT EXISTS idx_tax_notices_property ON tax_notices(property_id);
CREATE INDEX IF NOT EXISTS idx_tax_notices_entity ON tax_notices(entity_id)
  WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tax_notices_year ON tax_notices(year);

ALTER TABLE tax_notices ENABLE ROW LEVEL SECURITY;

-- Owner full access (via properties.owner_id → profiles.user_id)
DROP POLICY IF EXISTS "tax_notices_owner_access" ON tax_notices;
CREATE POLICY "tax_notices_owner_access" ON tax_notices
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Trigger updated_at (réutilise la fonction du module charges)
DROP TRIGGER IF EXISTS trg_tax_notices_updated ON tax_notices;
CREATE TRIGGER trg_tax_notices_updated
  BEFORE UPDATE ON tax_notices
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();

COMMENT ON TABLE tax_notices IS
  'Avis de taxe foncière par bien et par année — stocke TEOM brut / frais gestion / TEOM net récupérable. Source pour la régul des charges (gap P0 #2 du skill talok-charges-regularization).';
COMMENT ON COLUMN tax_notices.teom_brut IS 'Montant TEOM brut en centimes (tel qu''affiché sur l''avis).';
COMMENT ON COLUMN tax_notices.frais_gestion IS 'Frais de gestion (~8%) non récupérables en centimes.';
COMMENT ON COLUMN tax_notices.teom_net IS 'TEOM net récupérable en centimes (brut - frais_gestion).';
COMMENT ON COLUMN tax_notices.reom_applicable IS 'True si le bien est en zone de redevance (REOM) — alors aucune régul, payée directement par le locataire.';
COMMENT ON COLUMN tax_notices.extraction_method IS 'manual = saisie propriétaire, ocr = pipeline Tesseract + GPT-4o-mini (Sprint 6).';

COMMIT;

-- -----------------------------------------------------------------------------
-- 66/71 -- 20260417090200 -- MODERE -- 20260417090200_epci_reference_table.sql
-- risk: +1 policies, -1 policies
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 66/71 (MODERE) 20260417090200_epci_reference_table.sql'; END $$;
-- =====================================================
-- MIGRATION: Sprint 0.a — Table epci_reference
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- Référentiel des EPCI (DROM-COM priorité) pour
-- déterminer le type de taxe déchets applicable
-- (TEOM / REOM / none) et le taux de TEOM.
-- Utilisé côté Sprint 2 pour le lookup par code postal
-- et côté Sprint 3 pour afficher l'info REOM.
--
-- RLS : lecture publique (référentiel, aucune donnée PII).
-- Seeds : injectés en Sprint 0.b (22 EPCI DROM-COM).
-- Idempotent : CREATE TABLE IF NOT EXISTS.
-- =====================================================

CREATE TABLE IF NOT EXISTS epci_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_departement TEXT NOT NULL,
  code_postal_pattern TEXT,
  epci_name TEXT NOT NULL,
  syndicat_traitement TEXT,
  waste_tax_type TEXT NOT NULL DEFAULT 'teom'
    CHECK (waste_tax_type IN ('teom', 'reom', 'none')),
  teom_rate_pct NUMERIC(5,2),
  teom_rate_year INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT epci_reference_dept_name_unique UNIQUE (code_departement, epci_name)
);

CREATE INDEX IF NOT EXISTS idx_epci_reference_dept ON epci_reference(code_departement);
CREATE INDEX IF NOT EXISTS idx_epci_reference_cp ON epci_reference(code_postal_pattern)
  WHERE code_postal_pattern IS NOT NULL;

ALTER TABLE epci_reference ENABLE ROW LEVEL SECURITY;

-- Lecture publique (référentiel sans PII). Écriture bloquée côté client
-- (seed SQL uniquement via migration).
DROP POLICY IF EXISTS "epci_reference_public_read" ON epci_reference;
CREATE POLICY "epci_reference_public_read" ON epci_reference
  FOR SELECT TO authenticated, anon
  USING (true);

COMMENT ON TABLE epci_reference IS
  'Référentiel EPCI — type de taxe déchets et taux TEOM par EPCI. Focus DROM-COM au Sprint 0, métropole extensible ensuite.';
COMMENT ON COLUMN epci_reference.waste_tax_type IS
  'teom = taxe (intégrée taxe foncière, payée par propriétaire, récupérable sur locataire). reom = redevance (payée directement par locataire, aucune régul côté propriétaire). none = aucune taxe.';
COMMENT ON COLUMN epci_reference.teom_rate_pct IS
  'Taux TEOM en pourcentage (référentiel indicatif — le montant réel figure sur l''avis de taxe foncière).';

COMMIT;

-- -----------------------------------------------------------------------------
-- 67/71 -- 20260417090300 -- MODERE -- 20260417090300_fix_tenant_contest_rls.sql
-- risk: +1 policies, -1 policies, UPDATE
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 67/71 (MODERE) 20260417090300_fix_tenant_contest_rls.sql'; END $$;
-- =====================================================
-- MIGRATION: Gap P0 #4 — RLS locataire contested
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- La policy lease_charge_reg_tenant_contest créée par la
-- migration 20260408130000 a un WITH CHECK (status = 'sent')
-- qui interdit toute transition : l'UPDATE voit la NOUVELLE
-- valeur et si le locataire passe status à 'contested' le
-- WITH CHECK rejette. Résultat : la policy est inutile,
-- le locataire ne peut rien modifier.
--
-- Fix : USING (ancien status = 'sent') + WITH CHECK
-- (nouveau status = 'contested'). Transition strictement
-- sent → contested, aucune autre autorisée (pas sent→settled,
-- pas contested→sent, etc.). L'appartenance au bail reste
-- vérifiée des deux côtés.
--
-- Idempotent : DROP POLICY IF EXISTS avant CREATE POLICY.
-- =====================================================

DROP POLICY IF EXISTS "lease_charge_reg_tenant_contest" ON lease_charge_regularizations;

CREATE POLICY "lease_charge_reg_tenant_contest" ON lease_charge_regularizations
  FOR UPDATE TO authenticated
  USING (
    status = 'sent'
    AND lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  )
  WITH CHECK (
    status = 'contested'
    AND lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

COMMENT ON POLICY "lease_charge_reg_tenant_contest" ON lease_charge_regularizations IS
  'Locataire : transition strictement sent → contested. Toute autre transition est interdite (owner only). Gap P0 #4 du skill talok-charges-regularization.';

COMMIT;

-- -----------------------------------------------------------------------------
-- 68/71 -- 20260417090400 -- SAFE -- 20260417090400_charges_pcg_accounts_backfill.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 68/71 (SAFE) 20260417090400_charges_pcg_accounts_backfill.sql'; END $$;
-- =====================================================
-- MIGRATION: Gap P0 #3 — Backfill comptes PCG charges
-- Date: 2026-04-17
-- Sprint: 0.b (Seeds PCG + EPCI — Régularisation des charges)
--
-- Ajoute les comptes PCG 419100 et 654000 pour toutes
-- les entities existantes. Les nouvelles entities sont
-- déjà couvertes via PCG_OWNER_ACCOUNTS dans
-- lib/accounting/chart-amort-ocr.ts (seed dynamique au
-- premier exercice).
--
-- Substitutions vs. skill théorique (voir section
-- "Mapping PCG Talok" dans .claude/skills/talok-charges-
-- regularization/SKILL.md) :
--   - skill '4191'   → Talok '419100' (uniformisation 6 chiffres)
--   - skill '654'    → Talok '654000' (idem)
--   - skill '614'    → Talok '614100' (déjà seedé, pas besoin de backfill)
--   - skill '708300' → Talok '708000' (déjà seedé, pas besoin de backfill)
--
-- Idempotent : ON CONFLICT (entity_id, account_number) DO NOTHING.
-- =====================================================

INSERT INTO chart_of_accounts (entity_id, account_number, label, account_type)
SELECT le.id, '419100', 'Provisions de charges recues', 'liability'
FROM legal_entities le
ON CONFLICT (entity_id, account_number) DO NOTHING;

INSERT INTO chart_of_accounts (entity_id, account_number, label, account_type)
SELECT le.id, '654000', 'Charges recuperables non recuperees', 'expense'
FROM legal_entities le
ON CONFLICT (entity_id, account_number) DO NOTHING;

COMMIT;

-- -----------------------------------------------------------------------------
-- 69/71 -- 20260417090500 -- SAFE -- 20260417090500_epci_reference_seed_drom.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 69/71 (SAFE) 20260417090500_epci_reference_seed_drom.sql'; END $$;
-- =====================================================
-- MIGRATION: Sprint 0.b — Seed EPCI DROM-COM
-- Date: 2026-04-17
-- Sprint: 0.b (Seeds PCG + EPCI — Régularisation des charges)
--
-- 23 EPCI DROM-COM — source : skill talok-charges-
-- regularization (compilé depuis DGCL / ADEME / données
-- publiques). Le skill annonçait "22 EPCI" mais le
-- décompte exact est : 3 (972) + 6 (971) + 5 (974)
-- + 4 (973) + 5 (976) = 23.
--
-- Seulement les champs vérifiables hors-ligne sont
-- renseignés : code_departement, epci_name,
-- waste_tax_type, teom_rate_pct, teom_rate_year, notes.
--
-- Les champs code_postal_pattern et syndicat_traitement
-- restent NULL (à compléter en ligne dans un sprint
-- ultérieur — besoin d'accès DGCL / INSEE).
--
-- La table epci_reference (créée en 0.a) n'a pas de
-- colonne siren par design : le lookup côté Sprint 2
-- se fait par code_postal_pattern / code_departement.
--
-- Idempotent : ON CONFLICT (code_departement, epci_name) DO NOTHING.
-- =====================================================

-- ---------------------------------------------------------------
-- 972 MARTINIQUE (3 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('972', 'CACEM', 'teom', 15.50, 2025, 'Communauté d''Agglomération du Centre de la Martinique'),
  ('972', 'Cap Nord Martinique', 'teom', 19.00, 2025, 'Communauté d''Agglomération du Nord de la Martinique'),
  ('972', 'Espace Sud', 'teom', 15.00, 2025, 'Communauté d''Agglomération de l''Espace Sud de la Martinique')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 971 GUADELOUPE (6 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('971', 'Cap Excellence', 'teom', 16.00, 2025, 'CA Cap Excellence (Pointe-à-Pitre / Les Abymes / Baie-Mahault)'),
  ('971', 'CANBT', 'teom', 14.00, 2025, 'CA du Nord Basse-Terre'),
  ('971', 'CARL', 'teom', 15.00, 2025, 'CA de la Riviera du Levant'),
  ('971', 'Grand Sud Caraïbe', 'teom', 16.00, 2025, 'CA Grand Sud Caraïbe'),
  ('971', 'CA Nord Grande-Terre', 'teom', 15.00, 2025, 'CA du Nord Grande-Terre'),
  ('971', 'CC Marie-Galante', 'teom', 18.00, 2025, 'CC Marie-Galante — surcoût transport maritime insulaire')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 974 LA RÉUNION (5 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('974', 'CINOR', 'teom', 12.00, 2025, 'CA de la Communauté Intercommunale du Nord de la Réunion'),
  ('974', 'CIREST', 'teom', 14.00, 2025, 'CA Communauté Intercommunale Réunion Est'),
  ('974', 'TCO', 'teom', 13.00, 2025, 'CA Territoire de la Côte Ouest'),
  ('974', 'CIVIS', 'teom', 15.00, 2025, 'CA Communauté Intercommunale des Villes Solidaires'),
  ('974', 'CASUD', 'teom', 14.50, 2025, 'CA du Sud Réunion')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 973 GUYANE (4 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('973', 'CACL', 'teom', 14.00, 2025, 'CA du Centre Littoral (Cayenne)'),
  ('973', 'CCDS', 'teom', 12.00, 2025, 'CC des Savanes'),
  ('973', 'CCOG', 'teom', 10.00, 2025, 'CC de l''Ouest Guyanais — couverture très faible ~25%'),
  ('973', 'CCEG', 'teom', 8.00, 2025, 'CC de l''Est Guyanais — Camopi: aucune TEOM (foncier État)')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- ---------------------------------------------------------------
-- 976 MAYOTTE (5 EPCI)
-- ---------------------------------------------------------------
INSERT INTO epci_reference (code_departement, epci_name, waste_tax_type, teom_rate_pct, teom_rate_year, notes)
VALUES
  ('976', 'CADEMA', 'teom', 20.00, 2025, 'CA Dembéni-Mamoudzou — cadastre incomplet'),
  ('976', 'CC du Sud', 'teom', 18.00, 2025, 'Communauté de Communes du Sud'),
  ('976', 'CC Petite-Terre', 'teom', 19.00, 2025, 'Communauté de Communes de Petite-Terre'),
  ('976', 'CC Centre-Ouest', 'teom', 17.00, 2025, 'Communauté de Communes du Centre-Ouest'),
  ('976', 'CC du Nord', 'teom', 18.00, 2025, 'Communauté de Communes du Nord')
ON CONFLICT (code_departement, epci_name) DO NOTHING;

-- =====================================================
-- TOTAL INSÉRÉ : 23 EPCI (3 + 6 + 5 + 4 + 5)
--
-- TODO Sprints ultérieurs :
-- 1. Compléter code_postal_pattern (liste communes par EPCI — source DGCL)
-- 2. Compléter syndicat_traitement (ex: SMTVD en Martinique, SYVADE en Guadeloupe)
-- 3. Étendre aux EPCI métropolitains (~1250 EPCI — accès DGCL requis)
-- =====================================================

COMMIT;

-- -----------------------------------------------------------------------------
-- 70/71 -- 20260417100000 -- DANGEREUX -- 20260417100000_drop_phone_otp_codes_refs.sql
-- risk: DROP TABLE : phone_otp_codes
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 70/71 (DANGEREUX) 20260417100000_drop_phone_otp_codes_refs.sql'; END $$;
-- Migration: Drop phone_otp_codes + enrich sms_messages (2026-04-17)
--
-- Sprint 0 (SMS unification + Twilio Verify):
--   - phone_otp_codes: table orpheline (aucune migration ne la créait).
--     Référencée uniquement par lib/identity/identity-verification.service.ts
--     (supprimée dans le même sprint). On drop pour nettoyer les
--     environnements où elle aurait été créée à la main.
--   - sms_messages: ajout de `territory` (analytics DROM) et
--     `verify_sid` (lien vers les verifications Twilio Verify).

-- ============================================================
-- 1. Drop phone_otp_codes (dead table)
-- ============================================================

DROP TABLE IF EXISTS public.phone_otp_codes CASCADE;

-- ============================================================
-- 2. sms_messages: add territory + verify_sid columns
-- ============================================================

ALTER TABLE public.sms_messages
  ADD COLUMN IF NOT EXISTS territory text,
  ADD COLUMN IF NOT EXISTS verify_sid text;

COMMENT ON COLUMN public.sms_messages.territory
  IS 'Code ISO du territoire (FR, MQ, GP, GF, RE, YT, PM, ...) déduit du numéro';
COMMENT ON COLUMN public.sms_messages.verify_sid
  IS 'SID de vérification Twilio Verify (VE...) pour les envois OTP';

CREATE INDEX IF NOT EXISTS sms_messages_territory_idx
  ON public.sms_messages (territory)
  WHERE territory IS NOT NULL;

CREATE INDEX IF NOT EXISTS sms_messages_verify_sid_idx
  ON public.sms_messages (verify_sid)
  WHERE verify_sid IS NOT NULL;

COMMIT;

-- -----------------------------------------------------------------------------
-- 71/71 -- 20260417110000 -- SAFE -- 20260417110000_purge_identity_2fa_cron.sql
-- risk: Idempotent / structural only
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN RAISE NOTICE 'Applying 71/71 (SAFE) 20260417110000_purge_identity_2fa_cron.sql'; END $$;
-- Migration: Cron quotidien de purge des demandes 2FA identité expirées
-- Date: 2026-04-17
--
-- Sprint 1 (monitoring + rétention) :
-- Les lignes de `identity_2fa_requests` sont insérées à chaque demande 2FA.
-- Sans purge, la table croît indéfiniment. On supprime les entrées dont
-- `expires_at` est > 1 jour dans le passé (OTP + token inutilisables).
--
-- Prérequis : pg_cron doit être activé (déjà fait par la migration
-- 20260304100000_activate_pg_cron_schedules.sql).

-- ============================================================
-- 1. Fonction de purge
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_identity_2fa()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.identity_2fa_requests
  WHERE expires_at < now() - interval '1 day';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_identity_2fa() IS
  'Supprime les demandes 2FA identité expirées depuis plus de 24h. '
  'Planifié quotidiennement à 3h UTC via pg_cron.';

REVOKE ALL ON FUNCTION public.cleanup_expired_identity_2fa() FROM public;
REVOKE ALL ON FUNCTION public.cleanup_expired_identity_2fa() FROM authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_identity_2fa() FROM anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_identity_2fa() TO service_role;

-- ============================================================
-- 2. Cron pg_cron (idempotent)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Drop ancien job s'il existe
    PERFORM cron.unschedule('cleanup-identity-2fa-expired')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cleanup-identity-2fa-expired'
    );

    -- Planifier quotidiennement à 3h UTC (entre 4h-5h Europe/Paris)
    PERFORM cron.schedule(
      'cleanup-identity-2fa-expired',
      '0 3 * * *',
      $cron$SELECT public.cleanup_expired_identity_2fa()$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron n''est pas activé : le cron de purge identity_2fa_requests ne sera pas planifié. Activer pg_cron puis ré-appliquer cette migration.';
  END IF;
END
$$;

COMMIT;
