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
CREATE POLICY "Owners can view own expenses" ON expenses
  FOR SELECT TO authenticated
  USING (
    owner_profile_id = get_current_owner_profile_id()
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = get_current_owner_profile_id()
    )
    OR public.user_role() = 'admin'
  );

CREATE POLICY "Owners can insert own expenses" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_profile_id = get_current_owner_profile_id()
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = get_current_owner_profile_id()
    )
  );

CREATE POLICY "Owners can update own expenses" ON expenses
  FOR UPDATE TO authenticated
  USING (
    owner_profile_id = get_current_owner_profile_id()
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = get_current_owner_profile_id()
    )
  )
  WITH CHECK (
    owner_profile_id = get_current_owner_profile_id()
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = get_current_owner_profile_id()
    )
  );

CREATE POLICY "Owners can delete own expenses" ON expenses
  FOR DELETE TO authenticated
  USING (
    owner_profile_id = get_current_owner_profile_id()
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = get_current_owner_profile_id()
    )
  );

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

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

COMMIT;
