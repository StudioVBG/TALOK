-- ====================================================================
-- Sprint B2 — Phase 4 CRITIQUE — Batch 9/10
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
-- Migration: 20260408120000_subscription_addons.sql
-- Note: file on disk is 20260408120000_subscription_addons.sql but will be renamed to 20260408120005_subscription_addons.sql
-- Risk: CRITIQUE
-- Why: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408120000_subscription_addons.sql'; END $pre$;

-- ============================================================
-- Migration: subscription_addons & sms_usage
-- Module Add-ons Stripe (packs signatures, stockage, SMS, RAR, état daté)
-- ============================================================

-- Table principale : add-ons achetés
CREATE TABLE IF NOT EXISTS subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  entity_id UUID REFERENCES legal_entities(id),

  -- Type
  addon_type TEXT NOT NULL
    CHECK (addon_type IN (
      'signature_pack',
      'storage_20gb',
      'sms',
      'rar_electronic',
      'etat_date'
    )),

  -- Stripe
  stripe_checkout_session_id TEXT,
  stripe_subscription_id TEXT,
  stripe_subscription_item_id TEXT,
  stripe_invoice_id TEXT,

  -- Quantité / Usage
  quantity INTEGER NOT NULL DEFAULT 1,
  consumed_count INTEGER DEFAULT 0,

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'active',
      'consumed',
      'cancelled',
      'expired'
    )),

  -- Dates
  purchased_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;

-- RLS : les utilisateurs ne voient que leurs propres add-ons
DROP POLICY IF EXISTS "Users can view their own addons" ON subscription_addons;
CREATE POLICY "Users can view their own addons"
  ON subscription_addons FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access on subscription_addons" ON subscription_addons;
CREATE POLICY "Service role full access on subscription_addons"
  ON subscription_addons FOR ALL
  USING (auth.role() = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_addons_profile ON subscription_addons(profile_id);
CREATE INDEX IF NOT EXISTS idx_addons_type_status ON subscription_addons(addon_type, status);
CREATE INDEX IF NOT EXISTS idx_addons_stripe_session ON subscription_addons(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_addons_stripe_subscription ON subscription_addons(stripe_subscription_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_subscription_addons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscription_addons_updated_at ON subscription_addons;
CREATE TRIGGER trg_subscription_addons_updated_at
  BEFORE UPDATE ON subscription_addons
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_addons_updated_at();

-- ============================================================
-- Table : Suivi usage SMS (agrégé par mois)
-- ============================================================

CREATE TABLE IF NOT EXISTS sms_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  month TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  reported_to_stripe BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, month)
);

ALTER TABLE sms_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sms usage" ON sms_usage;
CREATE POLICY "Users can view their own sms usage"
  ON sms_usage FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access on sms_usage" ON sms_usage;
CREATE POLICY "Service role full access on sms_usage"
  ON sms_usage FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_sms_usage_profile_month ON sms_usage(profile_id, month);

-- ============================================================
-- RPC : Incrémenter usage SMS (upsert atomique)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_sms_usage(
  p_profile_id UUID,
  p_month TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO sms_usage (profile_id, month, count)
  VALUES (p_profile_id, p_month, 1)
  ON CONFLICT (profile_id, month)
  DO UPDATE SET count = sms_usage.count + 1
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC : Consommer une signature d'un pack (FIFO)
-- ============================================================

CREATE OR REPLACE FUNCTION consume_addon_signature(
  p_profile_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_addon_id UUID;
BEGIN
  -- Sélectionner le pack actif le plus ancien (FIFO) qui a des signatures restantes
  SELECT id INTO v_addon_id
  FROM subscription_addons
  WHERE profile_id = p_profile_id
    AND addon_type = 'signature_pack'
    AND status = 'active'
    AND consumed_count < quantity
  ORDER BY purchased_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_addon_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Incrémenter consumed_count
  UPDATE subscription_addons
  SET consumed_count = consumed_count + 1,
      status = CASE
        WHEN consumed_count + 1 >= quantity THEN 'consumed'
        ELSE 'active'
      END,
      updated_at = now()
  WHERE id = v_addon_id;

  RETURN v_addon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408120005', 'subscription_addons')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408120000_subscription_addons.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408130000_guarantor_workflow_complete.sql
-- Note: file on disk is 20260408130000_guarantor_workflow_complete.sql but will be renamed to 20260408130006_guarantor_workflow_complete.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408130000_guarantor_workflow_complete.sql'; END $pre$;

-- ============================================
-- Migration: Workflow garant complet
-- Date: 2026-04-08
-- Description:
--   1. Ajouter le support Visale au type de garantie
--   2. Ajouter les colonnes d'invitation (email, token, etc.)
--   3. Ajouter les colonnes de libération
--   4. Ajouter le numéro Visale sur les engagements
--   5. Créer la table guarantor_invitations
--   6. Créer la fonction RPC guarantor_dashboard
--   7. Ajouter les RLS policies manquantes
-- ============================================

BEGIN;

-- ============================================
-- 1. TABLE D'INVITATIONS GARANT
-- ============================================

CREATE TABLE IF NOT EXISTS guarantor_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Informations garant invité
  guarantor_name TEXT NOT NULL,
  guarantor_email TEXT NOT NULL,
  guarantor_phone TEXT,
  guarantor_type TEXT NOT NULL DEFAULT 'solidaire'
    CHECK (guarantor_type IN ('simple', 'solidaire', 'visale')),
  relationship TEXT,

  -- Token d'invitation
  invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Suivi
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  declined_reason TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

  -- Lien avec le profil garant créé après acceptation
  guarantor_profile_id UUID REFERENCES profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(lease_id, guarantor_email)
);

CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_lease ON guarantor_invitations(lease_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_token ON guarantor_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_email ON guarantor_invitations(guarantor_email);
CREATE INDEX IF NOT EXISTS idx_guarantor_invitations_status ON guarantor_invitations(status);

COMMENT ON TABLE guarantor_invitations IS 'Invitations envoyées par les propriétaires aux garants potentiels';

-- ============================================
-- 2. ÉTENDRE guarantor_engagements POUR VISALE
-- ============================================

-- Mettre à jour la contrainte type_garantie pour inclure visale
ALTER TABLE guarantor_engagements
DROP CONSTRAINT IF EXISTS guarantor_engagements_type_garantie_check;

ALTER TABLE guarantor_engagements
ADD CONSTRAINT guarantor_engagements_type_garantie_check
CHECK (type_garantie IN ('caution_simple', 'caution_solidaire', 'visale'));

-- Ajouter le numéro Visale
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS visale_number TEXT;

-- Ajouter les colonnes de libération
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS liberated_at TIMESTAMPTZ;

ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS liberation_reason TEXT
  CHECK (liberation_reason IS NULL OR liberation_reason IN (
    'fin_bail', 'remplacement_locataire', 'depart_colocataire_6mois', 'accord_parties', 'autre'
  ));

-- Ajouter la référence à l'invitation
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES guarantor_invitations(id);

-- Ajouter la colonne signed_at si pas présente (alias pour date_signature)
-- date_signature existe déjà comme DATE, ajoutons signed_at comme TIMESTAMPTZ pour plus de précision
ALTER TABLE guarantor_engagements
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- ============================================
-- 3. ÉTENDRE guarantor_profiles
-- ============================================

-- Ajouter les colonnes manquantes attendues par les types TS
ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS relation_to_tenant TEXT CHECK (relation_to_tenant IN (
  'parent', 'grand_parent', 'oncle_tante', 'frere_soeur', 'employeur', 'ami', 'autre'
));

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS relation_details TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS situation_pro TEXT CHECK (situation_pro IN (
  'cdi', 'cdd', 'fonctionnaire', 'independant', 'retraite', 'profession_liberale', 'chef_entreprise', 'autre'
));

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS employeur_nom TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS employeur_adresse TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS anciennete_mois INTEGER;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS revenus_fonciers DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS autres_revenus DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS charges_mensuelles DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS credits_en_cours DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS est_proprietaire BOOLEAN DEFAULT false;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS valeur_patrimoine_immobilier DECIMAL(12, 2);

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS adresse_complete TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS code_postal TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS ville TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_garant BOOLEAN DEFAULT false;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_garant_at TIMESTAMPTZ;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_data_processing BOOLEAN DEFAULT false;

ALTER TABLE guarantor_profiles
ADD COLUMN IF NOT EXISTS consent_data_processing_at TIMESTAMPTZ;

-- ============================================
-- 4. RLS POLICIES POUR INVITATIONS
-- ============================================

ALTER TABLE guarantor_invitations ENABLE ROW LEVEL SECURITY;

-- Le propriétaire qui a invité peut voir/modifier ses invitations
DROP POLICY IF EXISTS "guarantor_invitations_owner_select" ON guarantor_invitations;
CREATE POLICY "guarantor_invitations_owner_select" ON guarantor_invitations
  FOR SELECT USING (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "guarantor_invitations_owner_insert" ON guarantor_invitations;
CREATE POLICY "guarantor_invitations_owner_insert" ON guarantor_invitations
  FOR INSERT WITH CHECK (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "guarantor_invitations_owner_update" ON guarantor_invitations;
CREATE POLICY "guarantor_invitations_owner_update" ON guarantor_invitations
  FOR UPDATE USING (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Le garant invité peut voir ses invitations (par email lié à son user)
DROP POLICY IF EXISTS "guarantor_invitations_guarantor_select" ON guarantor_invitations;
CREATE POLICY "guarantor_invitations_guarantor_select" ON guarantor_invitations
  FOR SELECT USING (
    guarantor_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- Admin peut tout
DROP POLICY IF EXISTS "guarantor_invitations_admin_all" ON guarantor_invitations;
CREATE POLICY "guarantor_invitations_admin_all" ON guarantor_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 5. TRIGGER updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_guarantor_invitations_updated_at ON guarantor_invitations;
CREATE TRIGGER update_guarantor_invitations_updated_at
  BEFORE UPDATE ON guarantor_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. FONCTION RPC : DASHBOARD GARANT
-- ============================================

CREATE OR REPLACE FUNCTION guarantor_dashboard(p_guarantor_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  -- Récupérer le profile_id du garant
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_guarantor_user_id AND role = 'guarantor';

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Construire le résultat du dashboard
  SELECT jsonb_build_object(
    'profile_id', v_profile_id,
    'engagements', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ge.id,
          'lease_id', ge.lease_id,
          'caution_type', CASE ge.type_garantie
            WHEN 'caution_simple' THEN 'simple'
            WHEN 'caution_solidaire' THEN 'solidaire'
            WHEN 'visale' THEN 'visale'
            ELSE ge.type_garantie
          END,
          'montant_garanti', ge.montant_max_garanti,
          'status', CASE ge.statut
            WHEN 'pending' THEN 'pending_signature'
            WHEN 'active' THEN 'active'
            WHEN 'expired' THEN 'released'
            WHEN 'invoked' THEN 'called'
            WHEN 'terminated' THEN 'terminated'
            ELSE ge.statut
          END,
          'signed_at', ge.signed_at,
          'created_at', ge.created_at,
          'tenant', jsonb_build_object(
            'id', tp.id,
            'name', TRIM(COALESCE(tp.prenom, '') || ' ' || COALESCE(tp.nom, ''))
          ),
          'property', jsonb_build_object(
            'id', prop.id,
            'adresse', prop.adresse_complete,
            'ville', prop.ville
          ),
          'lease', jsonb_build_object(
            'loyer', l.loyer,
            'charges', COALESCE(l.charges_forfaitaires, 0),
            'date_debut', l.date_debut
          )
        )
        ORDER BY ge.created_at DESC
      )
      FROM guarantor_engagements ge
      JOIN profiles tp ON tp.id = ge.tenant_profile_id
      JOIN leases l ON l.id = ge.lease_id
      JOIN properties prop ON prop.id = l.property_id
      WHERE ge.guarantor_profile_id = v_profile_id
    ), '[]'::jsonb),
    'incidents', '[]'::jsonb,
    'stats', jsonb_build_object(
      'total_engagements', (
        SELECT COUNT(*) FROM guarantor_engagements
        WHERE guarantor_profile_id = v_profile_id
        AND statut IN ('active', 'pending')
      ),
      'pending_signatures', (
        SELECT COUNT(*) FROM guarantor_engagements
        WHERE guarantor_profile_id = v_profile_id
        AND statut = 'pending'
      ),
      'total_amount_guaranteed', COALESCE((
        SELECT SUM(montant_max_garanti) FROM guarantor_engagements
        WHERE guarantor_profile_id = v_profile_id
        AND statut = 'active'
      ), 0),
      'active_incidents', 0
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION guarantor_dashboard IS 'Retourne les données du dashboard garant (engagements, incidents, stats)';

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408130006', 'guarantor_workflow_complete')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408130000_guarantor_workflow_complete.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408130000_lease_amendments_table.sql
-- Note: file on disk is 20260408130000_lease_amendments_table.sql but will be renamed to 20260408130008_lease_amendments_table.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408130000_lease_amendments_table.sql'; END $pre$;

-- ============================================================================
-- Lease Amendments (Avenants) — Table + RLS
--
-- Stores lease amendments (avenants) for active leases. Amendments track
-- rent revisions, roommate changes, charges adjustments, and other
-- contractual modifications. Each amendment references its parent lease
-- and optionally a signed document in the GED.
-- ============================================================================

-- 1. Create the lease_amendments table
CREATE TABLE IF NOT EXISTS lease_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  amendment_type TEXT NOT NULL CHECK (amendment_type IN (
    'loyer_revision',
    'ajout_colocataire',
    'retrait_colocataire',
    'changement_charges',
    'travaux',
    'autre'
  )),
  description TEXT NOT NULL,
  effective_date DATE NOT NULL,
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE lease_amendments ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Owner can view amendments for their leases
DROP POLICY IF EXISTS "owner_select_amendments" ON lease_amendments;
CREATE POLICY "owner_select_amendments"
  ON lease_amendments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Tenant can view amendments for leases they signed
DROP POLICY IF EXISTS "tenant_select_amendments" ON lease_amendments;
CREATE POLICY "tenant_select_amendments"
  ON lease_amendments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lease_signers ls
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE ls.lease_id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Owner can create amendments for their leases
DROP POLICY IF EXISTS "owner_insert_amendments" ON lease_amendments;
CREATE POLICY "owner_insert_amendments"
  ON lease_amendments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Owner can update amendments for their leases (only unsigned ones)
DROP POLICY IF EXISTS "owner_update_amendments" ON lease_amendments;
CREATE POLICY "owner_update_amendments"
  ON lease_amendments
  FOR UPDATE
  USING (
    signed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_lease_amendments_lease_id
  ON lease_amendments (lease_id);

CREATE INDEX IF NOT EXISTS idx_lease_amendments_type
  ON lease_amendments (amendment_type);

CREATE INDEX IF NOT EXISTS idx_lease_amendments_effective_date
  ON lease_amendments (effective_date);

-- 5. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_lease_amendments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lease_amendments_updated_at ON lease_amendments;
CREATE TRIGGER trg_lease_amendments_updated_at
  BEFORE UPDATE ON lease_amendments
  FOR EACH ROW
  EXECUTE FUNCTION update_lease_amendments_updated_at();

-- 6. Comments
COMMENT ON TABLE lease_amendments IS 'Avenants au bail — modifications contractuelles';
COMMENT ON COLUMN lease_amendments.amendment_type IS 'Type: loyer_revision, ajout/retrait_colocataire, changement_charges, travaux, autre';
COMMENT ON COLUMN lease_amendments.old_values IS 'Valeurs avant modification (JSONB)';
COMMENT ON COLUMN lease_amendments.new_values IS 'Valeurs après modification (JSONB)';
COMMENT ON COLUMN lease_amendments.signed_at IS 'Date de signature de l''avenant par toutes les parties';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408130008', 'lease_amendments_table')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408130000_lease_amendments_table.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260409130000_fix_subscriptions_status_check.sql
-- Risk: CRITIQUE
-- Why: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260409130000_fix_subscriptions_status_check.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260409130000', 'fix_subscriptions_status_check')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260409130000_fix_subscriptions_status_check.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260411130000_restore_handle_new_user_sota.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260411130000_restore_handle_new_user_sota.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260411130000', 'restore_handle_new_user_sota')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260411130000_restore_handle_new_user_sota.sql'; END $post$;

COMMIT;

-- END OF BATCH 9/10 (Phase 4 CRITIQUE)
