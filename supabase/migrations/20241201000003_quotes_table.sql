-- =====================================================
-- Migration : Table Quotes (Devis)
-- Date : 2024-12-01
-- Description : Système de devis pour les prestataires
-- =====================================================

-- Créer la table quotes si elle n'existe pas
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reference TEXT UNIQUE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'pending', 'approved')),
  items JSONB DEFAULT '[]',
  subtotal DECIMAL(10, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 20,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,
  valid_until TIMESTAMPTZ,
  notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

-- Ajouter les colonnes manquantes si la table existe déjà
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'owner_id') THEN
    ALTER TABLE quotes ADD COLUMN owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'property_id') THEN
    ALTER TABLE quotes ADD COLUMN property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'reference') THEN
    ALTER TABLE quotes ADD COLUMN reference TEXT UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'items') THEN
    ALTER TABLE quotes ADD COLUMN items JSONB DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'subtotal') THEN
    ALTER TABLE quotes ADD COLUMN subtotal DECIMAL(10, 2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'tax_rate') THEN
    ALTER TABLE quotes ADD COLUMN tax_rate DECIMAL(5, 2) DEFAULT 20;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'tax_amount') THEN
    ALTER TABLE quotes ADD COLUMN tax_amount DECIMAL(10, 2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'total') THEN
    ALTER TABLE quotes ADD COLUMN total DECIMAL(10, 2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'notes') THEN
    ALTER TABLE quotes ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'rejection_reason') THEN
    ALTER TABLE quotes ADD COLUMN rejection_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'sent_at') THEN
    ALTER TABLE quotes ADD COLUMN sent_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'responded_at') THEN
    ALTER TABLE quotes ADD COLUMN responded_at TIMESTAMPTZ;
  END IF;
END$$;

-- Index (avec vérification)
CREATE INDEX IF NOT EXISTS idx_quotes_provider ON quotes(provider_id);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'owner_id') THEN
    CREATE INDEX IF NOT EXISTS idx_quotes_owner ON quotes(owner_id);
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_ticket ON quotes(ticket_id);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'reference') THEN
    CREATE INDEX IF NOT EXISTS idx_quotes_reference ON quotes(reference);
  END IF;
END$$;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_quotes_updated_at ON quotes;
CREATE TRIGGER trigger_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_quotes_updated_at();

-- RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Politique : prestataire peut voir/créer ses devis
CREATE POLICY "Providers can manage their quotes"
  ON quotes
  FOR ALL
  TO authenticated
  USING (provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Politique : propriétaire peut voir les devis envoyés pour ses biens
CREATE POLICY "Owners can view sent quotes for their properties"
  ON quotes
  FOR SELECT
  TO authenticated
  USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status != 'draft'
  );

-- Politique : propriétaire peut répondre aux devis
CREATE POLICY "Owners can respond to quotes"
  ON quotes
  FOR UPDATE
  TO authenticated
  USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status = 'sent'
  )
  WITH CHECK (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status IN ('accepted', 'rejected')
  );

-- Politique : admin peut tout voir
CREATE POLICY "Admins can view all quotes"
  ON quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Commentaires
COMMENT ON TABLE quotes IS 'Devis des prestataires pour les interventions';
COMMENT ON COLUMN quotes.items IS 'Liste des lignes du devis en JSON [{description, quantity, unitPrice, total}]';
COMMENT ON COLUMN quotes.reference IS 'Numéro de devis unique (DEV-YYMM-XXXX)';

