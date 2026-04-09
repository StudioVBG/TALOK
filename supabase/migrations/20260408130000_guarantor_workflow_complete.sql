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
CREATE POLICY "guarantor_invitations_owner_select" ON guarantor_invitations
  FOR SELECT USING (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "guarantor_invitations_owner_insert" ON guarantor_invitations
  FOR INSERT WITH CHECK (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "guarantor_invitations_owner_update" ON guarantor_invitations
  FOR UPDATE USING (
    invited_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Le garant invité peut voir ses invitations (par email lié à son user)
CREATE POLICY "guarantor_invitations_guarantor_select" ON guarantor_invitations
  FOR SELECT USING (
    guarantor_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- Admin peut tout
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
