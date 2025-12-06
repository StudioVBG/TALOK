-- =====================================================
-- MIGRATION: Facturation Prestataire
-- Description: Factures émises par les prestataires pour leurs interventions
-- =====================================================

-- =====================================================
-- TABLE: provider_invoices (factures prestataires)
-- =====================================================
CREATE TABLE IF NOT EXISTS provider_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Référence unique
  invoice_number TEXT UNIQUE,
  
  -- Relations
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  
  -- Détails
  title TEXT NOT NULL,
  description TEXT,
  
  -- Montants
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 20.00, -- TVA 20%
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,
  
  -- Statut
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',      -- Brouillon
    'sent',       -- Envoyée
    'viewed',     -- Vue par le destinataire
    'paid',       -- Payée
    'overdue',    -- En retard
    'cancelled',  -- Annulée
    'disputed'    -- Contestée
  )),
  
  -- Paiement
  payment_method TEXT,
  payment_reference TEXT,
  
  -- Fichiers
  pdf_url TEXT,
  
  -- Métadonnées
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  
  -- Coordonnées prestataire (snapshot au moment de la facture)
  provider_company_name TEXT,
  provider_siret TEXT,
  provider_address TEXT,
  provider_email TEXT,
  provider_phone TEXT
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_invoices_provider ON provider_invoices(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_owner ON provider_invoices(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_status ON provider_invoices(status);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_date ON provider_invoices(invoice_date DESC);

-- =====================================================
-- TABLE: provider_invoice_items (lignes de facture)
-- =====================================================
CREATE TABLE IF NOT EXISTS provider_invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES provider_invoices(id) ON DELETE CASCADE,
  
  -- Description
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'unité', -- unité, heure, m², etc.
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Calculs
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2),
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Ordre d'affichage
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_invoice_items_invoice ON provider_invoice_items(invoice_id);

-- =====================================================
-- FONCTION: Générer un numéro de facture unique
-- =====================================================
CREATE OR REPLACE FUNCTION generate_provider_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
  v_number TEXT;
BEGIN
  -- Format: FAC-YYYY-XXXXX
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM provider_invoices
  WHERE invoice_number LIKE 'FAC-' || v_year || '-%';
  
  v_number := 'FAC-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
  
  NEW.invoice_number := v_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-générer le numéro
DROP TRIGGER IF EXISTS trigger_generate_provider_invoice_number ON provider_invoices;
CREATE TRIGGER trigger_generate_provider_invoice_number
  BEFORE INSERT ON provider_invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION generate_provider_invoice_number();

-- =====================================================
-- FONCTION: Calculer les totaux de la facture
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_provider_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal NUMERIC(10,2);
  v_tax_amount NUMERIC(10,2);
  v_total NUMERIC(10,2);
BEGIN
  -- Calculer à partir des lignes
  SELECT 
    COALESCE(SUM(subtotal), 0),
    COALESCE(SUM(tax_amount), 0),
    COALESCE(SUM(total), 0)
  INTO v_subtotal, v_tax_amount, v_total
  FROM provider_invoice_items
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Mettre à jour la facture
  UPDATE provider_invoices
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_total,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour recalculer les totaux
DROP TRIGGER IF EXISTS trigger_calculate_provider_invoice_totals ON provider_invoice_items;
CREATE TRIGGER trigger_calculate_provider_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON provider_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_provider_invoice_totals();

-- =====================================================
-- FONCTION: Calculer les totaux d'une ligne
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_invoice_item_totals()
RETURNS TRIGGER AS $$
BEGIN
  NEW.subtotal := NEW.quantity * NEW.unit_price;
  
  IF NEW.tax_rate IS NOT NULL THEN
    NEW.tax_amount := NEW.subtotal * (NEW.tax_rate / 100);
  ELSE
    NEW.tax_amount := 0;
  END IF;
  
  NEW.total := NEW.subtotal + COALESCE(NEW.tax_amount, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-calculer les lignes
DROP TRIGGER IF EXISTS trigger_calculate_invoice_item_totals ON provider_invoice_items;
CREATE TRIGGER trigger_calculate_invoice_item_totals
  BEFORE INSERT OR UPDATE ON provider_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_item_totals();

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE provider_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_invoice_items ENABLE ROW LEVEL SECURITY;

-- Prestataires peuvent voir leurs factures
CREATE POLICY "Providers can view their invoices"
  ON provider_invoices FOR SELECT
  USING (
    provider_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Propriétaires peuvent voir les factures qui leur sont adressées
CREATE POLICY "Owners can view invoices addressed to them"
  ON provider_invoices FOR SELECT
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Prestataires peuvent créer des factures
CREATE POLICY "Providers can create invoices"
  ON provider_invoices FOR INSERT
  WITH CHECK (
    provider_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Prestataires peuvent modifier leurs factures en brouillon
CREATE POLICY "Providers can update draft invoices"
  ON provider_invoices FOR UPDATE
  USING (
    provider_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status IN ('draft', 'sent')
  );

-- Propriétaires peuvent marquer comme payé
CREATE POLICY "Owners can mark invoices as paid"
  ON provider_invoices FOR UPDATE
  USING (
    owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Lignes de facture - visibles si la facture est visible
CREATE POLICY "Invoice items visible if invoice visible"
  ON provider_invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM provider_invoices pi
      WHERE pi.id = provider_invoice_items.invoice_id
      AND (
        pi.provider_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR pi.owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

-- Prestataires peuvent gérer les lignes de leurs factures
CREATE POLICY "Providers can manage their invoice items"
  ON provider_invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM provider_invoices pi
      WHERE pi.id = provider_invoice_items.invoice_id
      AND pi.provider_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      AND pi.status = 'draft'
    )
  );

