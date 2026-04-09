-- Batch 6 — migrations 128 a 151 sur 169
-- 24 migrations

-- === [128/169] 20260331100000_fix_document_titles_bruts.sql ===
-- B7: Corriger les titres bruts des anciens documents
-- Remplacer les noms de fichiers (ex: "Capture_d_ecran_2024-03-15.png")
-- par des titres lisibles selon le type de document

UPDATE documents SET title = CASE
  WHEN type = 'cni_recto' THEN 'Carte d''Identité (Recto)'
  WHEN type = 'cni_verso' THEN 'Carte d''Identité (Verso)'
  WHEN type = 'assurance_habitation' THEN 'Attestation d''assurance habitation'
  WHEN type = 'contrat_bail' THEN 'Contrat de bail'
  WHEN type = 'quittance_loyer' THEN 'Quittance de loyer'
  WHEN type = 'bulletin_salaire' THEN 'Bulletin de salaire'
  WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
  WHEN type = 'justificatif_domicile' THEN 'Justificatif de domicile'
  WHEN type = 'rib' THEN 'Relevé d''Identité Bancaire'
  WHEN type = 'kbis' THEN 'Extrait KBIS'
  WHEN type = 'attestation_assurance_rc' THEN 'Attestation assurance RC Pro'
  WHEN type = 'dpe' THEN 'Diagnostic de Performance Énergétique'
  WHEN type = 'edl_entree' THEN 'État des lieux d''entrée'
  WHEN type = 'edl_sortie' THEN 'État des lieux de sortie'
  WHEN type = 'mandat_gestion' THEN 'Mandat de gestion'
  WHEN type = 'reglement_copropriete' THEN 'Règlement de copropriété'
  ELSE title
END
WHERE (
  title IS NULL
  OR title ~ '^Capture d.écran'
  OR title ~ '^capture'
  OR title ~ '^Screenshot'
  OR title ~ '^IMG_'
  OR title ~ '^[A-Z_]{4,}$'
  OR title ~ '^\d{4}-\d{2}-\d{2}'
  OR title ~ '\.(png|jpg|jpeg|pdf|webp)$'
)
AND type IS NOT NULL;


-- === [129/169] 20260331120000_add_signed_pdf_generated_to_leases.sql ===
-- Migration: Ajouter colonne signed_pdf_generated à la table leases
-- Permet de tracker quels baux ont déjà un PDF signé généré

ALTER TABLE leases
ADD COLUMN IF NOT EXISTS signed_pdf_generated BOOLEAN DEFAULT FALSE;

-- Backfill : baux qui ont déjà un document bail généré
UPDATE leases l
SET signed_pdf_generated = TRUE
WHERE EXISTS (
  SELECT 1 FROM documents d
  WHERE d.lease_id = l.id
    AND d.type = 'bail'
    AND d.is_generated = TRUE
);

-- Index pour requêtes de diagnostic
CREATE INDEX IF NOT EXISTS idx_leases_signed_pdf_generated
ON leases (signed_pdf_generated)
WHERE signed_pdf_generated = FALSE;


-- === [130/169] 20260331130000_key_handovers_add_cancelled_notes.sql ===
-- Migration: Améliorer la table key_handovers
-- Ajoute cancelled_at (annulation soft) et notes (commentaires propriétaire)

ALTER TABLE key_handovers
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Index partiel : remises actives (non confirmées, non annulées)
CREATE INDEX IF NOT EXISTS idx_key_handovers_pending
ON key_handovers (lease_id, created_at DESC)
WHERE confirmed_at IS NULL AND cancelled_at IS NULL;

-- Commentaires
COMMENT ON COLUMN key_handovers.cancelled_at IS 'Date d''annulation de la remise par le propriétaire (soft delete)';
COMMENT ON COLUMN key_handovers.notes IS 'Notes libres du propriétaire sur la remise des clés';


-- === [131/169] 20260401000000_add_identity_status_onboarding_step.sql ===
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


-- === [132/169] 20260401000001_add_initial_payment_confirmed_to_leases.sql ===
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


-- === [133/169] 20260401000001_backfill_identity_status.sql ===
-- Migration: Backfill identity_status pour les profils existants
-- Protège les utilisateurs existants avant activation du middleware identity-gate.
-- Ordre d'exécution important : les requêtes les plus spécifiques d'abord.
--
-- FIX: Utilise les vrais statuts leases (active, fully_signed, notice_given, terminated)
-- FIX: Supprime onboarding_completed_at (n'existe pas dans le schéma)
-- FIX: Utilise aussi lease_signers comme fallback quand leases.tenant_id est NULL

-- 1. Tenants/Owners avec bail actif/signé/terminé → identity_verified + complete
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at    = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step      = 'complete'
WHERE (
  -- Via leases.tenant_id (dénormalisé)
  id IN (
    SELECT DISTINCT tenant_id FROM leases
    WHERE statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
    AND tenant_id IS NOT NULL
  )
  OR
  -- Via lease_signers (source de vérité)
  id IN (
    SELECT DISTINCT ls.profile_id FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    WHERE l.statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
    AND ls.signature_status = 'signed'
    AND ls.profile_id IS NOT NULL
  )
  OR
  -- Propriétaires avec des biens
  id IN (
    SELECT DISTINCT owner_id FROM properties WHERE owner_id IS NOT NULL
  )
)
AND identity_status = 'unverified';

-- 2. Utilisateurs ayant uploadé des documents → identity_verified
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at    = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step      = 'complete'
WHERE id IN (
  SELECT DISTINCT uploaded_by FROM documents WHERE uploaded_by IS NOT NULL
)
AND identity_status = 'unverified';

-- 3. Admins → identity_verified d'office
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = true,
  onboarding_step      = 'complete'
WHERE role = 'admin'
AND identity_status = 'unverified';

-- 4. Comptes avec téléphone renseigné + prénom/nom → phone_verified
UPDATE profiles SET
  identity_status = 'phone_verified',
  phone_verified  = true,
  phone_verified_at = NOW(),
  onboarding_step = 'profile_done'
WHERE identity_status = 'unverified'
AND telephone IS NOT NULL AND telephone <> ''
AND prenom IS NOT NULL AND prenom <> ''
AND nom IS NOT NULL AND nom <> '';

-- 5. Comptes créés depuis plus de 24h sans rien → phone_verified (grace period)
UPDATE profiles SET
  identity_status = 'phone_verified',
  onboarding_step = 'phone_done'
WHERE identity_status = 'unverified'
AND created_at < NOW() - INTERVAL '1 day';


-- === [134/169] 20260404100000_rls_push_subscriptions.sql ===
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
DO $dp$ BEGIN DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

-- Policy : chaque utilisateur ne peut accéder qu'à ses propres subscriptions
DO $dp$ BEGIN DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "push_subs_own_access" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $cm$ BEGIN
COMMENT ON POLICY "push_subs_own_access" ON push_subscriptions IS
  'Sécurité: un utilisateur ne peut voir/modifier que ses propres abonnements push.';
EXCEPTION WHEN undefined_table THEN NULL;
END $cm$;


-- === [135/169] 20260404100100_fix_tenant_docs_view_visible_tenant.sql ===
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


-- === [136/169] 20260404100200_fix_ticket_messages_rls_lease_signers.sql ===
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
DO $dp$ BEGIN DROP POLICY IF EXISTS "Ticket messages same lease select" ON ticket_messages; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Ticket messages same lease select" ON ticket_messages; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- INSERT policy
DO $dp$ BEGIN DROP POLICY IF EXISTS "Ticket messages same lease insert" ON ticket_messages; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Ticket messages same lease insert" ON ticket_messages; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;


-- === [137/169] 20260406200000_create_entities_view_and_members.sql ===
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
DO $dp$ BEGIN DROP POLICY IF EXISTS "entity_members_own_access" ON entity_members; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "entity_members_own_access" ON entity_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Policy: un admin d'une entite peut gerer ses membres
DO $dp$ BEGIN DROP POLICY IF EXISTS "entity_members_admin_manage" ON entity_members; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

CREATE TRIGGER trg_entity_members_updated_at
  BEFORE UPDATE ON entity_members
  FOR EACH ROW
  EXECUTE FUNCTION fn_entity_members_updated_at();


-- === [138/169] 20260406210000_accounting_complete.sql ===
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

DO $dp$ BEGIN DROP POLICY IF EXISTS "exercises_entity_access" ON accounting_exercises; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "coa_entity_access" ON chart_of_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "journals_entity_access" ON accounting_journals; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "entries_entity_access" ON accounting_entries; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "entry_lines_via_entry" ON accounting_entry_lines; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "bank_conn_entity_access" ON bank_connections; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "bank_tx_via_connection" ON bank_transactions; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "doc_analyses_entity_access" ON document_analyses; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "amort_sched_entity_access" ON amortization_schedules; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "amort_lines_via_schedule" ON amortization_lines; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "deficit_entity_access" ON deficit_tracking; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "charge_reg_entity_access" ON charge_regularizations; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "ec_access_owner" ON ec_access; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "ec_annotations_access" ON ec_annotations; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "copro_budgets_entity_access" ON copro_budgets; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "copro_fund_calls_entity_access" ON copro_fund_calls; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "mandant_accounts_entity_access" ON mandant_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "crg_reports_entity_access" ON crg_reports; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

DO $dp$ BEGIN DROP POLICY IF EXISTS "audit_log_entity_access" ON accounting_audit_log; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "audit_log_entity_access" ON accounting_audit_log
  FOR SELECT TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Audit log is insert-only for the system, read-only for users
DO $dp$ BEGIN DROP POLICY IF EXISTS "audit_log_system_insert" ON accounting_audit_log; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "audit_log_system_insert" ON accounting_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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


-- === [139/169] 20260407110000_audit_fixes_rls_indexes.sql ===
-- Migration: Audit fixes — missing indexes, CHECK constraints, and RLS
-- Idempotent: safe to run multiple times

-- 1. Missing index on sepa_mandates.owner_profile_id (skip if table missing)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_sepa_mandates_owner ON sepa_mandates(owner_profile_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. CHECK constraints on status columns (skip if table does not exist)
DO $$ BEGIN
  ALTER TABLE reconciliation_matches ADD CONSTRAINT chk_reconciliation_matches_status CHECK (status IN ('pending','matched','disputed','resolved'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payment_schedules ADD CONSTRAINT chk_payment_schedules_status CHECK (status IN ('pending','active','paused','completed','cancelled'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE receipt_stubs ADD CONSTRAINT chk_receipt_stubs_status CHECK (status IN ('signed','cancelled','archived'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT chk_subscriptions_status CHECK (status IN ('trialing','active','past_due','canceled','incomplete','paused'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE visit_slots ADD CONSTRAINT chk_visit_slots_status CHECK (status IN ('available','booked','cancelled','completed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE visit_bookings ADD CONSTRAINT chk_visit_bookings_status CHECK (status IN ('pending','confirmed','cancelled','no_show','completed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Enable RLS on lease_notices (idempotent — ENABLE is a no-op if already on)
ALTER TABLE IF EXISTS lease_notices ENABLE ROW LEVEL SECURITY;


-- === [140/169] 20260407120000_accounting_reconcile_schemas.sql ===
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

DO $dp$ BEGIN DROP POLICY IF EXISTS "entry_lines_via_entry" ON accounting_entry_lines; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "entry_lines_via_entry" ON accounting_entry_lines; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- =====================================================
-- 5. Add entity_members RLS policies to old tables
-- (Old tables used role-based RLS, add entity-based too)
-- =====================================================

-- accounting_entries: add entity-based policy
DO $dp$ BEGIN DROP POLICY IF EXISTS "entries_entity_access" ON public.accounting_entries; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "entries_entity_access" ON public.accounting_entries; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- mandant_accounts: add entity-based policy
DO $dp$ BEGIN DROP POLICY IF EXISTS "mandant_entity_access" ON public.mandant_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "mandant_entity_access" ON public.mandant_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- =====================================================
-- 6. Rename old accounting_accounts → keep as-is
-- The new chart_of_accounts is a separate table (no conflict)
-- Both can coexist: old for agency, new for owner/copro
-- =====================================================

COMMENT ON TABLE public.accounting_journals IS 'Journaux comptables — extended with entity support for multi-entity accounting';
COMMENT ON TABLE public.accounting_entries IS 'Ecritures comptables — extended with double-entry header fields and entity support';
COMMENT ON TABLE public.mandant_accounts IS 'Comptes mandants — extended with entity support';


-- === [141/169] 20260407130000_ocr_category_rules.sql ===
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

DO $dp$ BEGIN DROP POLICY IF EXISTS "ocr_rules_entity_access" ON ocr_category_rules; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "ocr_rules_entity_access" ON ocr_category_rules
  FOR ALL TO authenticated
  USING (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Extend document_analyses with OCR-specific columns
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES accounting_entries(id);
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS raw_ocr_text TEXT;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS suggested_entry JSONB;


-- === [142/169] 20260408042218_create_expenses_table.sql ===
-- Migration: Table expenses (dépenses/travaux propriétaire)
-- Date: 2026-04-08
-- RLS via chaîne : legal_entities.owner_profile_id → owner_profiles.profile_id
-- Compatible multi-entités (legal_entity_id) + particulier (owner_profile_id direct)

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
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can view own expenses" ON expenses; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can insert own expenses" ON expenses; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Owners can insert own expenses" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can update own expenses" ON expenses; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
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
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can delete own expenses" ON expenses; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Owners can delete own expenses" ON expenses
  FOR DELETE TO authenticated
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Admins full access on expenses" ON expenses; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Admins full access on expenses" ON expenses
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();


-- === [143/169] 20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql ===
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
ALTER TABLE public.charge_regularisations RENAME TO charge_regularisations_legacy;

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


-- === [144/169] 20260408100000_copro_lots.sql ===
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
DO $dp$ BEGIN DROP POLICY IF EXISTS "copro_lots_entity_access" ON copro_lots; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "copro_lots_entity_access" ON copro_lots FOR ALL TO authenticated
  USING (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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
DO $dp$ BEGIN DROP POLICY IF EXISTS "copro_fund_call_lines_access" ON copro_fund_call_lines; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "copro_fund_call_lines_access" ON copro_fund_call_lines FOR ALL TO authenticated
  USING (call_id IN (SELECT id FROM copro_fund_calls WHERE entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid())));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;


-- === [145/169] 20260408100000_create_push_subscriptions.sql ===
-- =====================================================
-- MIGRATION: Create push_subscriptions table
-- Date: 2026-04-08
--
-- Cette table stocke les tokens push (Web Push VAPID + FCM natif)
-- pour envoyer des notifications push aux utilisateurs.
-- =====================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Web Push : endpoint complet ; FCM natif : fcm://{token}
  endpoint TEXT NOT NULL,

  -- Web Push VAPID keys (NULL pour FCM natif)
  p256dh_key TEXT,
  auth_key TEXT,

  -- Device info
  device_type TEXT NOT NULL DEFAULT 'web' CHECK (device_type IN ('web', 'ios', 'android')),
  device_name TEXT,
  browser TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un seul endpoint par user
  UNIQUE(user_id, endpoint)
);

-- Index pour les requetes frequentes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile
  ON push_subscriptions(profile_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions(user_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_type
  ON push_subscriptions(device_type) WHERE is_active = true;

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $dp$ BEGIN DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "push_subs_own_access" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

COMMENT ON TABLE push_subscriptions IS 'Tokens push : Web Push (VAPID) et FCM natif (iOS/Android)';


-- === [146/169] 20260408110000_agency_hoguet.sql ===
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


-- === [147/169] 20260408120000_api_keys_webhooks.sql ===
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
DO $dp$ BEGIN DROP POLICY IF EXISTS "api_keys_select_own" ON api_keys; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "api_keys_select_own" ON api_keys
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "api_keys_insert_own" ON api_keys; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "api_keys_insert_own" ON api_keys
  FOR INSERT WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "api_keys_update_own" ON api_keys; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "api_keys_update_own" ON api_keys
  FOR UPDATE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "api_keys_delete_own" ON api_keys; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "api_keys_delete_own" ON api_keys
  FOR DELETE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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
DO $dp$ BEGIN DROP POLICY IF EXISTS "api_logs_select_own" ON api_logs; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "api_logs_select_own" ON api_logs
  FOR SELECT USING (
    api_key_id IN (
      SELECT id FROM api_keys WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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
DO $dp$ BEGIN DROP POLICY IF EXISTS "api_webhooks_select_own" ON api_webhooks; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "api_webhooks_select_own" ON api_webhooks
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "api_webhooks_insert_own" ON api_webhooks; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "api_webhooks_insert_own" ON api_webhooks
  FOR INSERT WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "api_webhooks_update_own" ON api_webhooks; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "api_webhooks_update_own" ON api_webhooks
  FOR UPDATE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "api_webhooks_delete_own" ON api_webhooks; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "api_webhooks_delete_own" ON api_webhooks
  FOR DELETE USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

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
    CREATE TRIGGER set_api_keys_updated_at
      BEFORE UPDATE ON api_keys
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_api_webhooks_updated_at') THEN
    CREATE TRIGGER set_api_webhooks_updated_at
      BEFORE UPDATE ON api_webhooks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- === [148/169] 20260408120000_colocation_module.sql ===
-- ============================================================
-- Migration: Module Colocation SOTA 2026
-- Tables: colocation_rooms, colocation_members, colocation_rules,
--         colocation_tasks, colocation_expenses
-- View:   v_colocation_balances
-- Alters: properties, leases
-- ============================================================

-- ============================================================
-- 1. Alter existing tables
-- ============================================================

ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  colocation_type TEXT CHECK (colocation_type IN ('bail_unique', 'baux_individuels'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  has_solidarity_clause BOOLEAN DEFAULT true;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  max_colocataires INTEGER;

ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  is_colocation BOOLEAN DEFAULT false;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  colocation_type TEXT CHECK (colocation_type IN ('bail_unique', 'baux_individuels'));
ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  solidarity_clause BOOLEAN DEFAULT false;

-- ============================================================
-- 2. Chambres d'une colocation
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  room_label TEXT,
  surface_m2 NUMERIC(6,2),
  rent_share_cents INTEGER NOT NULL,
  charges_share_cents INTEGER DEFAULT 0,
  is_furnished BOOLEAN DEFAULT false,
  description TEXT,
  photos JSONB DEFAULT '[]',
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, room_number)
);

ALTER TABLE colocation_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coloc_rooms_property ON colocation_rooms(property_id);

-- RLS: owner can manage rooms, tenant can read rooms of their property
DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_rooms_owner_all ON colocation_rooms; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY coloc_rooms_owner_all ON colocation_rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_rooms.property_id
        AND pr.user_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_rooms_tenant_select ON colocation_rooms; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY coloc_rooms_tenant_select ON colocation_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE l.property_id = colocation_rooms.property_id
        AND pr.user_id = auth.uid()
        AND l.statut IN ('active', 'pending')
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- ============================================================
-- 3. Membres d'une colocation
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  room_id UUID REFERENCES colocation_rooms(id),
  lease_id UUID NOT NULL REFERENCES leases(id),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id),

  -- Statut
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'departing', 'departed')),

  -- Dates
  move_in_date DATE NOT NULL,
  move_out_date DATE,
  notice_given_at TIMESTAMPTZ,
  notice_effective_date DATE,
  solidarity_end_date DATE,

  -- Financier
  rent_share_cents INTEGER NOT NULL,
  charges_share_cents INTEGER DEFAULT 0,
  deposit_cents INTEGER DEFAULT 0,
  deposit_returned BOOLEAN DEFAULT false,

  -- Paiement SEPA
  stripe_payment_method_id TEXT,
  pays_individually BOOLEAN DEFAULT false,

  -- Remplacement
  replaced_by_member_id UUID REFERENCES colocation_members(id),
  replaces_member_id UUID REFERENCES colocation_members(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coloc_members_property ON colocation_members(property_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_lease ON colocation_members(lease_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_tenant ON colocation_members(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_status ON colocation_members(status) WHERE status = 'active';

-- RLS: owner can manage members
DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_members_owner_all ON colocation_members; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY coloc_members_owner_all ON colocation_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_members.property_id
        AND pr.user_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- RLS: tenant can read members of their colocation
DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_members_tenant_select ON colocation_members; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY coloc_members_tenant_select ON colocation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm2
      WHERE cm2.property_id = colocation_members.property_id
        AND cm2.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm2.status IN ('active', 'departing')
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- ============================================================
-- 4. Reglement interieur
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'menage', 'bruit', 'invites', 'animaux',
                        'espaces_communs', 'charges', 'autre')),
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_rules ENABLE ROW LEVEL SECURITY;

DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_rules_owner_all ON colocation_rules; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY coloc_rules_owner_all ON colocation_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_rules.property_id
        AND pr.user_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_rules_tenant_select ON colocation_rules; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY coloc_rules_tenant_select ON colocation_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_rules.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- ============================================================
-- 5. Planning taches partagees
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  recurrence TEXT DEFAULT 'weekly'
    CHECK (recurrence IN ('daily', 'weekly', 'biweekly', 'monthly')),
  assigned_member_id UUID REFERENCES colocation_members(id),
  assigned_room_id UUID REFERENCES colocation_rooms(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  rotation_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_tasks ENABLE ROW LEVEL SECURITY;

DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_tasks_owner_all ON colocation_tasks; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY coloc_tasks_owner_all ON colocation_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_tasks.property_id
        AND pr.user_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Tenants can read and update tasks (mark as completed)
DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_tasks_tenant_select ON colocation_tasks; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY coloc_tasks_tenant_select ON colocation_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_tasks.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_tasks_tenant_update ON colocation_tasks; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY coloc_tasks_tenant_update ON colocation_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_tasks.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status = 'active'
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- ============================================================
-- 6. Depenses partagees entre colocataires
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  paid_by_member_id UUID NOT NULL REFERENCES colocation_members(id),
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  category TEXT DEFAULT 'autre'
    CHECK (category IN ('menage', 'courses', 'internet', 'electricite',
                        'eau', 'reparation', 'autre')),
  split_type TEXT DEFAULT 'equal'
    CHECK (split_type IN ('equal', 'by_room', 'custom')),
  split_details JSONB,
  receipt_document_id UUID REFERENCES documents(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_expenses ENABLE ROW LEVEL SECURITY;

DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_expenses_owner_all ON colocation_expenses; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY coloc_expenses_owner_all ON colocation_expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_expenses.property_id
        AND pr.user_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Tenants can read and create expenses
DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_expenses_tenant_select ON colocation_expenses; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY coloc_expenses_tenant_select ON colocation_expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_expenses.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS coloc_expenses_tenant_insert ON colocation_expenses; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY coloc_expenses_tenant_insert ON colocation_expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_expenses.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status = 'active'
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- ============================================================
-- 7. Vue : Soldes entre colocataires
-- ============================================================

CREATE OR REPLACE VIEW v_colocation_balances AS
WITH active_member_counts AS (
  SELECT property_id, COUNT(*) AS cnt
  FROM colocation_members
  WHERE status = 'active'
  GROUP BY property_id
),
room_rent_totals AS (
  SELECT cr.property_id,
         SUM(cr.rent_share_cents) AS total_rent
  FROM colocation_rooms cr
  WHERE cr.is_available = false
  GROUP BY cr.property_id
),
expense_shares AS (
  SELECT
    e.property_id,
    e.paid_by_member_id AS payer_id,
    cm.id AS debtor_id,
    CASE e.split_type
      WHEN 'equal' THEN e.amount_cents / NULLIF(amc.cnt, 0)
      WHEN 'by_room' THEN
        CASE WHEN rrt.total_rent > 0 AND cr.rent_share_cents IS NOT NULL
          THEN cr.rent_share_cents * e.amount_cents / rrt.total_rent
          ELSE e.amount_cents / NULLIF(amc.cnt, 0)
        END
      ELSE COALESCE((e.split_details->>(cm.id::text))::int, 0)
    END AS share_cents
  FROM colocation_expenses e
  JOIN colocation_members cm
    ON cm.property_id = e.property_id AND cm.status = 'active'
  LEFT JOIN active_member_counts amc
    ON amc.property_id = e.property_id
  LEFT JOIN colocation_rooms cr
    ON cr.id = cm.room_id
  LEFT JOIN room_rent_totals rrt
    ON rrt.property_id = e.property_id
  WHERE NOT e.is_settled
)
SELECT
  property_id,
  payer_id,
  debtor_id,
  SUM(share_cents)::INTEGER AS total_owed_cents
FROM expense_shares
WHERE payer_id != debtor_id
GROUP BY property_id, payer_id, debtor_id;

-- ============================================================
-- 8. Triggers updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_colocation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coloc_rooms_updated_at
  BEFORE UPDATE ON colocation_rooms
  FOR EACH ROW EXECUTE FUNCTION update_colocation_updated_at();

CREATE TRIGGER trg_coloc_members_updated_at
  BEFORE UPDATE ON colocation_members
  FOR EACH ROW EXECUTE FUNCTION update_colocation_updated_at();

-- ============================================================
-- 9. Function: Auto-calculate solidarity_end_date
-- ============================================================

CREATE OR REPLACE FUNCTION auto_solidarity_end_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If member is departing and has a move_out_date, calculate solidarity end
  IF NEW.status = 'departing' AND NEW.move_out_date IS NOT NULL THEN
    -- If replaced, solidarity ends immediately
    IF NEW.replaced_by_member_id IS NOT NULL THEN
      NEW.solidarity_end_date = NEW.move_out_date;
    ELSE
      -- 6 months after move_out (loi ALUR)
      NEW.solidarity_end_date = NEW.move_out_date + INTERVAL '6 months';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coloc_solidarity_end
  BEFORE INSERT OR UPDATE ON colocation_members
  FOR EACH ROW EXECUTE FUNCTION auto_solidarity_end_date();


-- === [149/169] 20260408120000_edl_sortie_workflow.sql ===
-- ============================================================================
-- MIGRATION: EDL Sortie Workflow — Pièces, Vétusté, Retenues, Comparaison
-- Date: 2026-04-08
-- Description:
--   - Table edl_rooms (pièces structurées avec cotation globale)
--   - Extension edl_items avec champs comparaison entrée/sortie
--   - Extension edl avec champs sortie (retenues, dépôt, lien entrée)
--   - Table vetuste_grid (grille de vétusté)
--   - Mise à jour contraintes condition (6 niveaux)
-- ============================================================================

-- ─── 1. Étendre la table edl pour le workflow sortie ────────────────────────

DO $$
BEGIN
    -- Lien vers l'EDL d'entrée (pour EDL sortie)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'linked_entry_edl_id') THEN
        ALTER TABLE edl ADD COLUMN linked_entry_edl_id UUID REFERENCES edl(id);
    END IF;

    -- Parties présentes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'owner_present') THEN
        ALTER TABLE edl ADD COLUMN owner_present BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'owner_representative') THEN
        ALTER TABLE edl ADD COLUMN owner_representative TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'tenant_profiles') THEN
        ALTER TABLE edl ADD COLUMN tenant_profiles UUID[] DEFAULT '{}';
    END IF;

    -- Retenues sur dépôt (sortie uniquement)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'total_retenue_cents') THEN
        ALTER TABLE edl ADD COLUMN total_retenue_cents INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'retenue_details') THEN
        ALTER TABLE edl ADD COLUMN retenue_details JSONB DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'depot_garantie_cents') THEN
        ALTER TABLE edl ADD COLUMN depot_garantie_cents INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'montant_restitue_cents') THEN
        ALTER TABLE edl ADD COLUMN montant_restitue_cents INTEGER;
    END IF;
END $$;

-- Index pour la jointure entrée→sortie
CREATE INDEX IF NOT EXISTS idx_edl_linked_entry ON edl(linked_entry_edl_id);

-- ─── 2. Table edl_rooms (pièces structurées) ───────────────────────────────

CREATE TABLE IF NOT EXISTS edl_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edl_id UUID NOT NULL REFERENCES edl(id) ON DELETE CASCADE,

    room_name TEXT NOT NULL,
    room_type TEXT NOT NULL DEFAULT 'autre'
        CHECK (room_type IN (
            'entree','salon','sejour','cuisine','chambre','salle_de_bain',
            'wc','couloir','buanderie','cave','parking','balcon','terrasse',
            'jardin','garage','autre'
        )),
    sort_order INTEGER DEFAULT 0,

    -- État global de la pièce
    general_condition TEXT DEFAULT 'bon'
        CHECK (general_condition IN ('neuf','tres_bon','bon','usage_normal','mauvais','tres_mauvais')),
    observations TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE edl_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_edl_rooms_edl ON edl_rooms(edl_id);

-- RLS policies pour edl_rooms
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_select_policy') THEN
DO $dp$ BEGIN DROP POLICY IF EXISTS edl_rooms_select_policy ON edl_rooms; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
        CREATE POLICY edl_rooms_select_policy ON edl_rooms FOR SELECT USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_insert_policy') THEN
DO $dp$ BEGIN DROP POLICY IF EXISTS edl_rooms_insert_policy ON edl_rooms; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
        CREATE POLICY edl_rooms_insert_policy ON edl_rooms FOR INSERT WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_update_policy') THEN
DO $dp$ BEGIN DROP POLICY IF EXISTS edl_rooms_update_policy ON edl_rooms; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
        CREATE POLICY edl_rooms_update_policy ON edl_rooms FOR UPDATE USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_delete_policy') THEN
DO $dp$ BEGIN DROP POLICY IF EXISTS edl_rooms_delete_policy ON edl_rooms; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
        CREATE POLICY edl_rooms_delete_policy ON edl_rooms FOR DELETE USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;
    END IF;
END $$;

-- ─── 3. Étendre edl_items pour comparaison entrée/sortie ───────────────────

DO $$
BEGIN
    -- Lien vers la pièce
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'room_id') THEN
        ALTER TABLE edl_items ADD COLUMN room_id UUID REFERENCES edl_rooms(id) ON DELETE CASCADE;
    END IF;

    -- Type d'élément normalisé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'element_type') THEN
        ALTER TABLE edl_items ADD COLUMN element_type TEXT;
    END IF;

    -- Label personnalisé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'element_label') THEN
        ALTER TABLE edl_items ADD COLUMN element_label TEXT;
    END IF;

    -- Ordre d'affichage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'sort_order') THEN
        ALTER TABLE edl_items ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;

    -- Photos JSONB
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'photos') THEN
        ALTER TABLE edl_items ADD COLUMN photos JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Champs comparaison entrée (remplis auto pour EDL sortie)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_condition') THEN
        ALTER TABLE edl_items ADD COLUMN entry_condition TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_description') THEN
        ALTER TABLE edl_items ADD COLUMN entry_description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_photos') THEN
        ALTER TABLE edl_items ADD COLUMN entry_photos JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Dégradation notée
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'degradation_noted') THEN
        ALTER TABLE edl_items ADD COLUMN degradation_noted BOOLEAN DEFAULT false;
    END IF;

    -- Vétusté
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'vetuste_applicable') THEN
        ALTER TABLE edl_items ADD COLUMN vetuste_applicable BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'vetuste_coefficient') THEN
        ALTER TABLE edl_items ADD COLUMN vetuste_coefficient NUMERIC(3,2);
    END IF;

    -- Retenue sur cet élément
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'retenue_cents') THEN
        ALTER TABLE edl_items ADD COLUMN retenue_cents INTEGER DEFAULT 0;
    END IF;

    -- Coût de réparation estimé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'cout_reparation_cents') THEN
        ALTER TABLE edl_items ADD COLUMN cout_reparation_cents INTEGER DEFAULT 0;
    END IF;
END $$;

-- Mettre à jour la contrainte condition pour 6 niveaux
-- D'abord supprimer l'ancienne contrainte si elle existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'edl_items' AND column_name = 'condition'
    ) THEN
        ALTER TABLE edl_items DROP CONSTRAINT IF EXISTS edl_items_condition_check;
    END IF;
END $$;

ALTER TABLE edl_items ADD CONSTRAINT edl_items_condition_check_v2
    CHECK (condition IS NULL OR condition IN ('neuf','tres_bon','bon','usage_normal','moyen','mauvais','tres_mauvais'));

-- Index pour room_id
CREATE INDEX IF NOT EXISTS idx_edl_items_room_id ON edl_items(room_id);
CREATE INDEX IF NOT EXISTS idx_edl_items_element_type ON edl_items(element_type);

-- ─── 4. Table vetuste_grid (grille de vétusté) ─────────────────────────────

CREATE TABLE IF NOT EXISTS vetuste_grid (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_type TEXT NOT NULL,
    duree_vie_ans INTEGER NOT NULL,
    taux_abattement_annuel NUMERIC(4,2),
    valeur_residuelle_min NUMERIC(3,2) DEFAULT 0.10,
    source TEXT DEFAULT 'talok',
    notes TEXT
);

-- Seed grille standard (idempotent)
INSERT INTO vetuste_grid (element_type, duree_vie_ans, taux_abattement_annuel, notes)
SELECT * FROM (VALUES
    ('peinture',           7,  14.29::NUMERIC(4,2), 'Peinture murale standard'),
    ('papier_peint',       7,  14.29, 'Revêtement mural'),
    ('moquette',           7,  14.29, 'Revêtement sol textile'),
    ('parquet',            15,  6.67, 'Parquet massif ou contrecollé'),
    ('carrelage',          20,  5.00, 'Sol carrelé'),
    ('lino',               10, 10.00, 'Revêtement sol PVC/lino'),
    ('robinetterie',       10, 10.00, 'Robinets, mitigeurs'),
    ('sanitaires',         15,  6.67, 'WC, lavabo, baignoire'),
    ('volets',             15,  6.67, 'Volets roulants ou battants'),
    ('porte_interieure',   15,  6.67, 'Portes intérieures'),
    ('fenetre',            20,  5.00, 'Menuiseries extérieures'),
    ('chaudiere',          15,  6.67, 'Chaudière/cumulus'),
    ('electrique',         20,  5.00, 'Installation électrique'),
    ('placards',           15,  6.67, 'Rangements intégrés')
) AS v(element_type, duree_vie_ans, taux_abattement_annuel, notes)
WHERE NOT EXISTS (SELECT 1 FROM vetuste_grid LIMIT 1);

-- ─── 5. Commentaires ───────────────────────────────────────────────────────

COMMENT ON TABLE edl_rooms IS 'Pièces structurées pour l''état des lieux';
COMMENT ON TABLE vetuste_grid IS 'Grille de vétusté pour calcul des retenues (décret 2016-382)';
COMMENT ON COLUMN edl.linked_entry_edl_id IS 'EDL sortie: référence vers l''EDL d''entrée correspondant';
COMMENT ON COLUMN edl.total_retenue_cents IS 'Montant total des retenues sur dépôt de garantie (en centimes)';
COMMENT ON COLUMN edl.depot_garantie_cents IS 'Montant du dépôt de garantie du bail (en centimes)';
COMMENT ON COLUMN edl.montant_restitue_cents IS 'Montant à restituer au locataire (dépôt − retenues, en centimes)';
COMMENT ON COLUMN edl_items.entry_condition IS 'État de l''élément à l''entrée (rempli auto lors de l''EDL sortie)';
COMMENT ON COLUMN edl_items.vetuste_coefficient IS 'Coefficient vétusté 0.00 à 1.00 (calculé auto)';
COMMENT ON COLUMN edl_items.retenue_cents IS 'Retenue nette après vétusté (en centimes)';


-- === [150/169] 20260408120000_providers_module_sota.sql ===
-- =====================================================
-- MIGRATION: Module Prestataires SOTA 2026
-- Tables: providers, owner_providers
-- Alter: work_orders (extended state machine + fields)
-- Triggers: rating auto-update, updated_at
-- RLS: policies per role
-- =====================================================

-- =====================================================
-- 1. TABLE: providers (annuaire prestataires)
-- Standalone provider directory — not coupled to profiles
-- =====================================================

CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Identité
  company_name TEXT NOT NULL,
  siret TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,

  -- Activité
  trade_categories TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,

  -- Localisation
  address TEXT,
  city TEXT,
  postal_code TEXT,
  department TEXT,
  service_radius_km INTEGER DEFAULT 30,

  -- Qualifications
  certifications TEXT[] DEFAULT '{}',
  insurance_number TEXT,
  insurance_expiry DATE,
  decennale_number TEXT,
  decennale_expiry DATE,

  -- Notation (auto-updated by trigger)
  avg_rating NUMERIC(2,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_interventions INTEGER DEFAULT 0,

  -- Disponibilité
  is_available BOOLEAN DEFAULT true,
  response_time_hours INTEGER DEFAULT 48,
  emergency_available BOOLEAN DEFAULT false,

  -- Relation avec proprio
  added_by_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_marketplace BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,

  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_providers_department ON providers(department);
CREATE INDEX IF NOT EXISTS idx_providers_categories ON providers USING GIN(trade_categories);
CREATE INDEX IF NOT EXISTS idx_providers_owner ON providers(added_by_owner_id);
CREATE INDEX IF NOT EXISTS idx_providers_marketplace ON providers(is_marketplace) WHERE is_marketplace = true;
CREATE INDEX IF NOT EXISTS idx_providers_email ON providers(email);
CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);

-- RLS
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Owners see their own providers + marketplace
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners see own providers and marketplace" ON providers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners see own providers and marketplace" ON providers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Owners see own providers and marketplace"
  ON providers FOR SELECT
  USING (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR is_marketplace = true
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Owners can insert providers they add
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can add providers" ON providers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can add providers" ON providers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Owners can add providers"
  ON providers FOR INSERT
  WITH CHECK (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Owners can update their own providers, providers can update themselves
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners update own providers" ON providers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners update own providers" ON providers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Owners update own providers"
  ON providers FOR UPDATE
  USING (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Admins full access
DO $dp$ BEGIN DROP POLICY IF EXISTS "Admins full access providers" ON providers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Admins full access providers" ON providers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Admins full access providers"
  ON providers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_providers_updated_at ON providers;
CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE providers IS 'Annuaire prestataires (carnet personnel + marketplace)';

-- =====================================================
-- 2. TABLE: owner_providers (carnet d adresses)
-- =====================================================

CREATE TABLE IF NOT EXISTS owner_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  nickname TEXT,
  notes TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, provider_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_owner_providers_owner ON owner_providers(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_providers_provider ON owner_providers(provider_id);

-- RLS
ALTER TABLE owner_providers ENABLE ROW LEVEL SECURITY;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners manage own provider links" ON owner_providers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners manage own provider links" ON owner_providers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Owners manage own provider links"
  ON owner_providers FOR ALL
  USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

COMMENT ON TABLE owner_providers IS 'Lien propriétaire ↔ prestataire (carnet d adresses personnel)';

-- =====================================================
-- 3. ALTER: work_orders — Extended state machine
-- Add new columns for the full ticket→devis→intervention→facture→paiement flow
-- =====================================================

-- Add new columns (idempotent with IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  -- property_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'property_id') THEN
    ALTER TABLE work_orders ADD COLUMN property_id UUID REFERENCES properties(id);
  END IF;

  -- owner_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'owner_id') THEN
    ALTER TABLE work_orders ADD COLUMN owner_id UUID REFERENCES profiles(id);
  END IF;

  -- entity_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'entity_id') THEN
    ALTER TABLE work_orders ADD COLUMN entity_id UUID REFERENCES legal_entities(id);
  END IF;

  -- lease_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'lease_id') THEN
    ALTER TABLE work_orders ADD COLUMN lease_id UUID REFERENCES leases(id);
  END IF;

  -- title
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'title') THEN
    ALTER TABLE work_orders ADD COLUMN title TEXT;
  END IF;

  -- description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'description') THEN
    ALTER TABLE work_orders ADD COLUMN description TEXT;
  END IF;

  -- category
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'category') THEN
    ALTER TABLE work_orders ADD COLUMN category TEXT;
  END IF;

  -- urgency
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'urgency') THEN
    ALTER TABLE work_orders ADD COLUMN urgency TEXT DEFAULT 'normal'
      CHECK (urgency IN ('low', 'normal', 'urgent', 'emergency'));
  END IF;

  -- status (new extended state machine — coexists with legacy statut)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'status') THEN
    ALTER TABLE work_orders ADD COLUMN status TEXT DEFAULT 'draft'
      CHECK (status IN (
        'draft', 'quote_requested', 'quote_received', 'quote_approved',
        'quote_rejected', 'scheduled', 'in_progress', 'completed',
        'invoiced', 'paid', 'disputed', 'cancelled'
      ));
  END IF;

  -- Quote dates & financials
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'requested_at') THEN
    ALTER TABLE work_orders ADD COLUMN requested_at TIMESTAMPTZ DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_received_at') THEN
    ALTER TABLE work_orders ADD COLUMN quote_received_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'approved_at') THEN
    ALTER TABLE work_orders ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'scheduled_date') THEN
    ALTER TABLE work_orders ADD COLUMN scheduled_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'scheduled_time_slot') THEN
    ALTER TABLE work_orders ADD COLUMN scheduled_time_slot TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'started_at') THEN
    ALTER TABLE work_orders ADD COLUMN started_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'completed_at') THEN
    ALTER TABLE work_orders ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;

  -- Financials
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_amount_cents') THEN
    ALTER TABLE work_orders ADD COLUMN quote_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_document_id') THEN
    ALTER TABLE work_orders ADD COLUMN quote_document_id UUID REFERENCES documents(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'invoice_amount_cents') THEN
    ALTER TABLE work_orders ADD COLUMN invoice_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'invoice_document_id') THEN
    ALTER TABLE work_orders ADD COLUMN invoice_document_id UUID REFERENCES documents(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'payment_method') THEN
    ALTER TABLE work_orders ADD COLUMN payment_method TEXT
      CHECK (payment_method IN ('bank_transfer', 'check', 'cash', 'stripe'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'paid_at') THEN
    ALTER TABLE work_orders ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;

  -- Intervention report
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'intervention_report') THEN
    ALTER TABLE work_orders ADD COLUMN intervention_report TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'intervention_photos') THEN
    ALTER TABLE work_orders ADD COLUMN intervention_photos JSONB DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'tenant_signature_url') THEN
    ALTER TABLE work_orders ADD COLUMN tenant_signature_url TEXT;
  END IF;

  -- Accounting link
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'accounting_entry_id') THEN
    ALTER TABLE work_orders ADD COLUMN accounting_entry_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'is_deductible') THEN
    ALTER TABLE work_orders ADD COLUMN is_deductible BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'deductible_category') THEN
    ALTER TABLE work_orders ADD COLUMN deductible_category TEXT;
  END IF;

  -- notes column (may already exist in some forks)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'notes') THEN
    ALTER TABLE work_orders ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Make ticket_id nullable (work orders can now be created standalone)
ALTER TABLE work_orders ALTER COLUMN ticket_id DROP NOT NULL;

-- New indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_property ON work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_owner ON work_orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_new_status ON work_orders(status);

-- Backfill: set status from legacy statut for existing rows
UPDATE work_orders
SET status = CASE
  WHEN statut = 'assigned' THEN 'draft'
  WHEN statut = 'scheduled' THEN 'scheduled'
  WHEN statut = 'done' THEN 'completed'
  WHEN statut = 'cancelled' THEN 'cancelled'
  WHEN statut = 'in_progress' THEN 'in_progress'
  ELSE 'draft'
END
WHERE status IS NULL;

-- Backfill: property_id from ticket if missing
UPDATE work_orders wo
SET property_id = t.property_id
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.property_id IS NULL
  AND t.property_id IS NOT NULL;

-- Backfill: title from ticket titre
UPDATE work_orders wo
SET title = t.titre
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.title IS NULL;

-- Backfill: description from ticket description
UPDATE work_orders wo
SET description = t.description
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.description IS NULL;

-- =====================================================
-- 4. FUNCTION: Update provider rating from reviews
-- Uses the new providers table
-- =====================================================

CREATE OR REPLACE FUNCTION update_provider_rating_from_reviews()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_id UUID;
BEGIN
  -- Find the provider linked to this provider_profile_id
  SELECT p.id INTO v_provider_id
  FROM providers p
  WHERE p.profile_id = NEW.provider_profile_id
  LIMIT 1;

  IF v_provider_id IS NOT NULL THEN
    UPDATE providers SET
      avg_rating = COALESCE(
        (SELECT ROUND(AVG(rating_overall)::NUMERIC, 1)
         FROM provider_reviews
         WHERE provider_profile_id = NEW.provider_profile_id AND is_published = true),
        0
      ),
      total_reviews = (
        SELECT COUNT(*)
        FROM provider_reviews
        WHERE provider_profile_id = NEW.provider_profile_id AND is_published = true
      )
    WHERE id = v_provider_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_provider_rating_from_reviews ON provider_reviews;
CREATE TRIGGER trg_update_provider_rating_from_reviews
  AFTER INSERT OR UPDATE ON provider_reviews
  FOR EACH ROW EXECUTE FUNCTION update_provider_rating_from_reviews();

-- =====================================================
-- 5. FUNCTION: Update provider total_interventions
-- =====================================================

CREATE OR REPLACE FUNCTION update_provider_intervention_count()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_record RECORD;
BEGIN
  -- Find the provider entry for this provider_id
  -- provider_id on work_orders references profiles(id)
  SELECT p.id INTO v_provider_record
  FROM providers p
  WHERE p.profile_id = COALESCE(NEW.provider_id, OLD.provider_id)
  LIMIT 1;

  IF v_provider_record.id IS NOT NULL THEN
    UPDATE providers SET
      total_interventions = (
        SELECT COUNT(*)
        FROM work_orders
        WHERE provider_id = COALESCE(NEW.provider_id, OLD.provider_id)
          AND (status IN ('completed', 'invoiced', 'paid') OR statut = 'done')
      )
    WHERE id = v_provider_record.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_provider_intervention_count ON work_orders;
CREATE TRIGGER trg_update_provider_intervention_count
  AFTER INSERT OR UPDATE OF status, statut OR DELETE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_provider_intervention_count();

-- =====================================================
-- 6. FUNCTION: Validate SIRET (14 digits)
-- =====================================================

CREATE OR REPLACE FUNCTION validate_provider_siret()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.siret IS NOT NULL AND NEW.siret <> '' THEN
    IF NEW.siret !~ '^\d{14}$' THEN
      RAISE EXCEPTION 'SIRET invalide: doit contenir exactement 14 chiffres';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_provider_siret ON providers;
CREATE TRIGGER trg_validate_provider_siret
  BEFORE INSERT OR UPDATE OF siret ON providers
  FOR EACH ROW EXECUTE FUNCTION validate_provider_siret();

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON COLUMN providers.trade_categories IS 'plomberie, electricite, serrurerie, peinture, menuiserie, chauffage, climatisation, toiture, maconnerie, jardinage, nettoyage, demenagement, diagnostic, general';
COMMENT ON COLUMN work_orders.status IS 'Extended state machine: draft→quote_requested→quote_received→quote_approved→scheduled→in_progress→completed→invoiced→paid';
COMMENT ON COLUMN work_orders.urgency IS 'low, normal, urgent, emergency';


-- === [151/169] 20260408120000_smart_meters_connected.sql ===
-- Migration : Compteurs connectés — Enedis SGE, GRDF ADICT, alertes conso
-- Feature gate : Pro+ (connected_meters)

-- ============================================================
-- Table 1 : Compteurs liés à un bien (property_meters)
-- Complète la table "meters" existante (liée à lease_id)
-- property_meters est liée au bien, pas au bail
-- ============================================================
CREATE TABLE IF NOT EXISTS property_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  meter_type TEXT NOT NULL
    CHECK (meter_type IN ('electricity', 'gas', 'water', 'heating', 'other')),
  provider TEXT,                          -- 'enedis', 'grdf', 'veolia', 'manual'

  -- Identifiant compteur
  meter_reference TEXT NOT NULL,          -- PDL, PCE, ou numéro compteur eau
  meter_serial TEXT,                      -- Numéro de série physique

  -- Connexion API
  is_connected BOOLEAN DEFAULT false,
  connection_consent_at TIMESTAMPTZ,      -- Date consentement locataire
  connection_consent_by UUID REFERENCES profiles(id),
  oauth_token_encrypted TEXT,             -- Token chiffré
  oauth_refresh_token_encrypted TEXT,
  oauth_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'active', 'error', 'expired')),
  sync_error_message TEXT,

  -- Contrat
  contract_holder TEXT,                   -- Nom titulaire contrat
  contract_start_date DATE,
  tariff_option TEXT,                     -- 'base', 'hc_hp', 'tempo'
  subscribed_power_kva INTEGER,           -- Puissance souscrite (kVA)

  -- Config alertes
  alert_threshold_daily NUMERIC,          -- Seuil alerte conso journalière
  alert_threshold_monthly NUMERIC,        -- Seuil mensuel

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, meter_type, meter_reference)
);

ALTER TABLE property_meters ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_property_meters_property ON property_meters(property_id);
CREATE INDEX IF NOT EXISTS idx_property_meters_sync ON property_meters(is_connected, sync_status);
CREATE INDEX IF NOT EXISTS idx_property_meters_type ON property_meters(meter_type);

-- ============================================================
-- Table 2 : Relevés compteurs connectés
-- Étend le concept de meter_readings pour les compteurs connectés
-- ============================================================
CREATE TABLE IF NOT EXISTS property_meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES property_meters(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),

  reading_date DATE NOT NULL,
  value NUMERIC NOT NULL,                 -- kWh, m³, etc.
  unit TEXT NOT NULL DEFAULT 'kWh'
    CHECK (unit IN ('kWh', 'm3', 'litres')),

  -- Source
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'enedis', 'grdf', 'veolia', 'import')),
  recorded_by UUID REFERENCES profiles(id), -- NULL si auto

  -- Photo (relevé manuel)
  photo_document_id UUID REFERENCES documents(id),

  -- Coût estimé
  estimated_cost_cents INTEGER,           -- Coût estimé basé sur le tarif

  -- Déduplication
  external_id TEXT,                       -- ID unique côté fournisseur

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meter_id, reading_date, source)
);

ALTER TABLE property_meter_readings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pm_readings_meter_date ON property_meter_readings(meter_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_pm_readings_property ON property_meter_readings(property_id);
CREATE INDEX IF NOT EXISTS idx_pm_readings_source ON property_meter_readings(source);

-- ============================================================
-- Table 3 : Alertes consommation
-- ============================================================
CREATE TABLE IF NOT EXISTS meter_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES property_meters(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  alert_type TEXT NOT NULL
    CHECK (alert_type IN ('overconsumption', 'no_reading', 'anomaly', 'contract_expiry')),
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  data JSONB DEFAULT '{}',
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meter_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_meter_alerts_meter ON meter_alerts(meter_id);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_property ON meter_alerts(property_id);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_type ON meter_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_unacked ON meter_alerts(meter_id) WHERE acknowledged_at IS NULL;

-- ============================================================
-- RLS Policies
-- ============================================================

-- property_meters: propriétaire du bien peut tout faire
DO $dp$ BEGIN DROP POLICY IF EXISTS "property_meters_owner_select" ON property_meters; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "property_meters_owner_select" ON property_meters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "property_meters_owner_insert" ON property_meters; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "property_meters_owner_insert" ON property_meters
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "property_meters_owner_update" ON property_meters; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "property_meters_owner_update" ON property_meters
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "property_meters_owner_delete" ON property_meters; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "property_meters_owner_delete" ON property_meters
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- property_meters: locataire avec bail actif peut lire
DO $dp$ BEGIN DROP POLICY IF EXISTS "property_meters_tenant_select" ON property_meters; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "property_meters_tenant_select" ON property_meters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meters.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- property_meter_readings: propriétaire
DO $dp$ BEGIN DROP POLICY IF EXISTS "pm_readings_owner_select" ON property_meter_readings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "pm_readings_owner_select" ON property_meter_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "pm_readings_owner_insert" ON property_meter_readings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "pm_readings_owner_insert" ON property_meter_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- property_meter_readings: locataire avec bail actif
DO $dp$ BEGIN DROP POLICY IF EXISTS "pm_readings_tenant_select" ON property_meter_readings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "pm_readings_tenant_select" ON property_meter_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meter_readings.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "pm_readings_tenant_insert" ON property_meter_readings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "pm_readings_tenant_insert" ON property_meter_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meter_readings.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- meter_alerts: propriétaire
DO $dp$ BEGIN DROP POLICY IF EXISTS "meter_alerts_owner_select" ON meter_alerts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "meter_alerts_owner_select" ON meter_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "meter_alerts_owner_update" ON meter_alerts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "meter_alerts_owner_update" ON meter_alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- meter_alerts: locataire
DO $dp$ BEGIN DROP POLICY IF EXISTS "meter_alerts_tenant_select" ON meter_alerts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "meter_alerts_tenant_select" ON meter_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = meter_alerts.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- ============================================================
-- Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_property_meters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_property_meters_updated_at
  BEFORE UPDATE ON property_meters
  FOR EACH ROW EXECUTE FUNCTION update_property_meters_updated_at();

-- ============================================================
-- Service role policies (for cron sync & OAuth callbacks)
-- ============================================================
DO $dp$ BEGIN DROP POLICY IF EXISTS "property_meters_service_all" ON property_meters; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "property_meters_service_all" ON property_meters
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "pm_readings_service_all" ON property_meter_readings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "pm_readings_service_all" ON property_meter_readings
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "meter_alerts_service_all" ON meter_alerts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "meter_alerts_service_all" ON meter_alerts
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;


