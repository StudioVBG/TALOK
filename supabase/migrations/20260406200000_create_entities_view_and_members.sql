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

CREATE INDEX idx_entity_members_entity ON entity_members(entity_id);
CREATE INDEX idx_entity_members_user ON entity_members(user_id);
CREATE INDEX idx_entity_members_profile ON entity_members(profile_id) WHERE profile_id IS NOT NULL;

ALTER TABLE entity_members ENABLE ROW LEVEL SECURITY;

-- Policy: un utilisateur voit ses propres memberships
CREATE POLICY "entity_members_own_access" ON entity_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Policy: un admin d'une entite peut gerer ses membres
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
    WHEN ea.est_gerant THEN 'admin'
    ELSE 'member'
  END AS role,
  ea.pourcentage_parts AS share_percentage
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
