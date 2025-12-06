-- =====================================================
-- MIGRATION: Facturation Professionnelle SOTA 2025
-- Factures conformes avec mentions légales obligatoires
-- Acomptes, avoirs, pénalités de retard
-- =====================================================

-- =====================================================
-- 1. TABLE: provider_invoices (refonte complète)
-- =====================================================

-- Supprimer l'ancienne table si elle existe et la recréer
DROP TABLE IF EXISTS provider_invoice_items CASCADE;
DROP TABLE IF EXISTS provider_invoice_payments CASCADE;

-- Recréer provider_invoices avec tous les champs requis
CREATE TABLE IF NOT EXISTS provider_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Numérotation unique et séquentielle (obligatoire légalement)
  invoice_number TEXT UNIQUE NOT NULL,
  
  -- Parties
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID REFERENCES profiles(id),
  property_id UUID REFERENCES properties(id),
  work_order_id UUID REFERENCES work_orders(id),
  
  -- Type de document
  document_type TEXT NOT NULL DEFAULT 'invoice' CHECK (document_type IN (
    'invoice',    -- Facture
    'quote',      -- Devis
    'credit_note' -- Avoir
  )),
  
  -- Référence (pour avoirs)
  related_invoice_id UUID REFERENCES provider_invoices(id),
  
  -- Informations générales
  title TEXT NOT NULL,
  description TEXT,
  
  -- Dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,
  
  -- Conditions de paiement
  payment_terms_days INTEGER DEFAULT 30,
  
  -- Montants
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Pénalités de retard (Article L441-10 Code Commerce)
  late_payment_rate DECIMAL(5,2) DEFAULT 10.00, -- Taux annuel
  fixed_recovery_fee DECIMAL(10,2) DEFAULT 40.00, -- Indemnité forfaitaire
  late_fees_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Escompte
  early_payment_discount_rate DECIMAL(5,2), -- % escompte paiement anticipé
  early_payment_discount_days INTEGER, -- Délai pour bénéficier de l'escompte
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',      -- Brouillon
    'sent',       -- Envoyée
    'viewed',     -- Vue par le client
    'partial',    -- Partiellement payée
    'paid',       -- Payée
    'overdue',    -- En retard
    'disputed',   -- Contestée
    'cancelled',  -- Annulée
    'credited'    -- Avoir émis
  )),
  
  -- Envoi
  sent_at TIMESTAMPTZ,
  sent_to_email TEXT,
  viewed_at TIMESTAMPTZ,
  
  -- Rappels
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  
  -- PDF
  pdf_storage_path TEXT,
  pdf_generated_at TIMESTAMPTZ,
  
  -- Mentions légales personnalisées
  custom_legal_mentions TEXT,
  custom_payment_info TEXT,
  
  -- Notes internes
  internal_notes TEXT,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajouter les colonnes manquantes si la table existe déjà
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'provider_profile_id') THEN
    ALTER TABLE provider_invoices ADD COLUMN provider_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    -- Copier les données de provider_id si elle existe
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'provider_id') THEN
      UPDATE provider_invoices SET provider_profile_id = provider_id WHERE provider_profile_id IS NULL;
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'owner_profile_id') THEN
    ALTER TABLE provider_invoices ADD COLUMN owner_profile_id UUID REFERENCES profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'property_id') THEN
    ALTER TABLE provider_invoices ADD COLUMN property_id UUID REFERENCES properties(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'work_order_id') THEN
    ALTER TABLE provider_invoices ADD COLUMN work_order_id UUID REFERENCES work_orders(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'invoice_number') THEN
    ALTER TABLE provider_invoices ADD COLUMN invoice_number TEXT UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'title') THEN
    ALTER TABLE provider_invoices ADD COLUMN title TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'description') THEN
    ALTER TABLE provider_invoices ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'subtotal') THEN
    ALTER TABLE provider_invoices ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'tax_rate') THEN
    ALTER TABLE provider_invoices ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 20.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'tax_amount') THEN
    ALTER TABLE provider_invoices ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'total_amount') THEN
    ALTER TABLE provider_invoices ADD COLUMN total_amount DECIMAL(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'document_type') THEN
    ALTER TABLE provider_invoices ADD COLUMN document_type TEXT DEFAULT 'invoice';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'due_date') THEN
    ALTER TABLE provider_invoices ADD COLUMN due_date DATE;
  END IF;
END$$;

-- Index conditionnels
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'provider_profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_provider_invoices_provider ON provider_invoices(provider_profile_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'owner_profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_provider_invoices_owner ON provider_invoices(owner_profile_id);
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_provider_invoices_status ON provider_invoices(status);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'invoice_date') THEN
    CREATE INDEX IF NOT EXISTS idx_provider_invoices_date ON provider_invoices(invoice_date);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'due_date') THEN
    CREATE INDEX IF NOT EXISTS idx_provider_invoices_due_date ON provider_invoices(due_date);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provider_invoices' AND column_name = 'invoice_number') THEN
    CREATE INDEX IF NOT EXISTS idx_provider_invoices_number ON provider_invoices(invoice_number);
  END IF;
END$$;

-- =====================================================
-- 2. TABLE: provider_invoice_items (lignes de facture)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES provider_invoices(id) ON DELETE CASCADE,
  
  -- Description
  description TEXT NOT NULL,
  
  -- Quantité et prix
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'unité', -- unité, heure, m², kg, etc.
  unit_price DECIMAL(10,2) NOT NULL,
  
  -- TVA par ligne (peut varier)
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  
  -- Montants calculés
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  tax_amount DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price * tax_rate / 100) STORED,
  total DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price * (1 + tax_rate / 100)) STORED,
  
  -- Remise par ligne
  discount_percent DECIMAL(5,2) DEFAULT 0,
  
  -- Ordre d'affichage
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON provider_invoice_items(invoice_id);

-- =====================================================
-- 3. TABLE: provider_invoice_payments (paiements)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES provider_invoices(id) ON DELETE CASCADE,
  
  -- Montant
  amount DECIMAL(10,2) NOT NULL,
  
  -- Type de paiement
  payment_type TEXT NOT NULL CHECK (payment_type IN (
    'deposit',    -- Acompte
    'partial',    -- Paiement partiel
    'final',      -- Solde
    'refund'      -- Remboursement
  )),
  
  -- Méthode
  payment_method TEXT CHECK (payment_method IN (
    'card',       -- Carte bancaire
    'transfer',   -- Virement
    'check',      -- Chèque
    'cash',       -- Espèces
    'platform'    -- Via la plateforme
  )),
  
  -- Références
  transaction_id TEXT,
  stripe_payment_intent_id TEXT,
  check_number TEXT,
  
  -- Date
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Notes
  notes TEXT,
  
  -- Reçu
  receipt_number TEXT,
  receipt_pdf_path TEXT,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON provider_invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON provider_invoice_payments(paid_at);

-- =====================================================
-- 4. TABLE: invoice_number_sequences (séquences)
-- =====================================================

CREATE TABLE IF NOT EXISTS invoice_number_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  prefix TEXT DEFAULT 'FAC',
  
  UNIQUE(provider_profile_id, year)
);

-- =====================================================
-- 5. FONCTIONS
-- =====================================================

-- Fonction pour générer un numéro de facture unique
CREATE OR REPLACE FUNCTION generate_invoice_number(p_provider_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER;
  v_next_number INTEGER;
  v_prefix TEXT;
  v_invoice_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Récupérer ou créer la séquence
  INSERT INTO invoice_number_sequences (provider_profile_id, year, last_number, prefix)
  VALUES (p_provider_id, v_year, 0, 'FAC')
  ON CONFLICT (provider_profile_id, year) DO NOTHING;
  
  -- Incrémenter et récupérer le numéro
  UPDATE invoice_number_sequences
  SET last_number = last_number + 1
  WHERE provider_profile_id = p_provider_id AND year = v_year
  RETURNING last_number, prefix INTO v_next_number, v_prefix;
  
  -- Formater le numéro: FAC-2024-000001
  v_invoice_number := v_prefix || '-' || v_year || '-' || LPAD(v_next_number::TEXT, 6, '0');
  
  RETURN v_invoice_number;
END;
$$;

-- Fonction pour calculer les totaux d'une facture
CREATE OR REPLACE FUNCTION calculate_invoice_totals(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_subtotal DECIMAL(10,2);
  v_discount_amount DECIMAL(10,2);
  v_tax_amount DECIMAL(10,2);
  v_total_amount DECIMAL(10,2);
  v_discount_percent DECIMAL(5,2);
BEGIN
  -- Récupérer le pourcentage de remise
  SELECT discount_percent INTO v_discount_percent
  FROM provider_invoices WHERE id = p_invoice_id;
  
  -- Calculer le sous-total
  SELECT COALESCE(SUM(quantity * unit_price * (1 - COALESCE(discount_percent, 0) / 100)), 0)
  INTO v_subtotal
  FROM provider_invoice_items
  WHERE invoice_id = p_invoice_id;
  
  -- Appliquer la remise globale
  v_discount_amount := v_subtotal * COALESCE(v_discount_percent, 0) / 100;
  v_subtotal := v_subtotal - v_discount_amount;
  
  -- Calculer la TVA
  SELECT COALESCE(SUM(
    (quantity * unit_price * (1 - COALESCE(discount_percent, 0) / 100)) * tax_rate / 100
  ), 0)
  INTO v_tax_amount
  FROM provider_invoice_items
  WHERE invoice_id = p_invoice_id;
  
  -- Ajuster la TVA avec la remise globale
  v_tax_amount := v_tax_amount * (1 - COALESCE(v_discount_percent, 0) / 100);
  
  -- Total
  v_total_amount := v_subtotal + v_tax_amount;
  
  -- Mettre à jour la facture
  UPDATE provider_invoices
  SET 
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = v_tax_amount,
    total_amount = v_total_amount,
    updated_at = NOW()
  WHERE id = p_invoice_id;
END;
$$;

-- Fonction pour calculer le solde dû d'une facture
CREATE OR REPLACE FUNCTION get_invoice_balance(p_invoice_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total DECIMAL(10,2);
  v_paid DECIMAL(10,2);
BEGIN
  SELECT total_amount INTO v_total
  FROM provider_invoices WHERE id = p_invoice_id;
  
  SELECT COALESCE(SUM(
    CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END
  ), 0) INTO v_paid
  FROM provider_invoice_payments WHERE invoice_id = p_invoice_id;
  
  RETURN v_total - v_paid;
END;
$$;

-- Fonction pour calculer les pénalités de retard
CREATE OR REPLACE FUNCTION calculate_late_fees(p_invoice_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice RECORD;
  v_balance DECIMAL(10,2);
  v_days_late INTEGER;
  v_late_fees DECIMAL(10,2);
BEGIN
  SELECT * INTO v_invoice
  FROM provider_invoices WHERE id = p_invoice_id;
  
  IF v_invoice.due_date IS NULL OR v_invoice.due_date >= CURRENT_DATE THEN
    RETURN 0;
  END IF;
  
  v_balance := get_invoice_balance(p_invoice_id);
  IF v_balance <= 0 THEN
    RETURN 0;
  END IF;
  
  v_days_late := CURRENT_DATE - v_invoice.due_date;
  
  -- Pénalités = (solde * taux annuel / 365 * jours de retard) + indemnité forfaitaire
  v_late_fees := (v_balance * v_invoice.late_payment_rate / 100 / 365 * v_days_late) + v_invoice.fixed_recovery_fee;
  
  -- Mettre à jour la facture
  UPDATE provider_invoices
  SET late_fees_amount = v_late_fees
  WHERE id = p_invoice_id;
  
  RETURN v_late_fees;
END;
$$;

-- Fonction pour générer les données du PDF
CREATE OR REPLACE FUNCTION get_invoice_pdf_data(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'invoice', jsonb_build_object(
      'number', pi.invoice_number,
      'date', pi.invoice_date,
      'due_date', pi.due_date,
      'type', pi.document_type,
      'title', pi.title,
      'description', pi.description,
      'subtotal', pi.subtotal,
      'discount_percent', pi.discount_percent,
      'discount_amount', pi.discount_amount,
      'tax_rate', pi.tax_rate,
      'tax_amount', pi.tax_amount,
      'total_amount', pi.total_amount,
      'late_payment_rate', pi.late_payment_rate,
      'fixed_recovery_fee', pi.fixed_recovery_fee,
      'early_payment_discount_rate', pi.early_payment_discount_rate,
      'custom_legal_mentions', pi.custom_legal_mentions,
      'custom_payment_info', pi.custom_payment_info
    ),
    'provider', jsonb_build_object(
      'name', COALESCE(pp.raison_sociale, p_prov.prenom || ' ' || p_prov.nom),
      'siret', pp.siret,
      'tva_intra', pp.tva_intra,
      'address', pp.adresse,
      'postal_code', pp.code_postal,
      'city', pp.ville,
      'phone', p_prov.telephone,
      'email', (SELECT email FROM auth.users WHERE id = p_prov.user_id)
    ),
    'client', jsonb_build_object(
      'name', p_own.prenom || ' ' || p_own.nom,
      'address', prop.adresse_complete,
      'postal_code', prop.code_postal,
      'city', prop.ville
    ),
    'items', (
      SELECT jsonb_agg(jsonb_build_object(
        'description', pii.description,
        'quantity', pii.quantity,
        'unit', pii.unit,
        'unit_price', pii.unit_price,
        'tax_rate', pii.tax_rate,
        'subtotal', pii.subtotal,
        'total', pii.total
      ) ORDER BY pii.sort_order)
      FROM provider_invoice_items pii
      WHERE pii.invoice_id = pi.id
    ),
    'payments', (
      SELECT jsonb_agg(jsonb_build_object(
        'amount', pip.amount,
        'type', pip.payment_type,
        'method', pip.payment_method,
        'date', pip.paid_at
      ) ORDER BY pip.paid_at)
      FROM provider_invoice_payments pip
      WHERE pip.invoice_id = pi.id
    ),
    'balance', get_invoice_balance(pi.id),
    'legal_mentions', jsonb_build_object(
      'late_payment_text', 'En cas de retard de paiement, une pénalité de ' || pi.late_payment_rate || '% annuel sera appliquée.',
      'recovery_fee_text', 'Indemnité forfaitaire pour frais de recouvrement: ' || pi.fixed_recovery_fee || '€ (Article L441-10 du Code de Commerce).',
      'early_discount_text', CASE WHEN pi.early_payment_discount_rate IS NOT NULL 
        THEN 'Escompte de ' || pi.early_payment_discount_rate || '% pour paiement sous ' || pi.early_payment_discount_days || ' jours.'
        ELSE 'Pas d''escompte pour paiement anticipé.'
      END
    )
  ) INTO v_result
  FROM provider_invoices pi
  JOIN profiles p_prov ON p_prov.id = pi.provider_profile_id
  LEFT JOIN provider_profiles pp ON pp.profile_id = pi.provider_profile_id
  LEFT JOIN profiles p_own ON p_own.id = pi.owner_profile_id
  LEFT JOIN properties prop ON prop.id = pi.property_id
  WHERE pi.id = p_invoice_id;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Trigger pour générer le numéro de facture
CREATE OR REPLACE FUNCTION trigger_generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number(NEW.provider_profile_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_invoice_number ON provider_invoices;
CREATE TRIGGER trg_generate_invoice_number
  BEFORE INSERT ON provider_invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_generate_invoice_number();

-- Trigger pour recalculer les totaux après modification des items
CREATE OR REPLACE FUNCTION trigger_recalculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_invoice_totals(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalculate_invoice_totals ON provider_invoice_items;
CREATE TRIGGER trg_recalculate_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON provider_invoice_items
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_invoice_totals();

-- Trigger pour mettre à jour le statut de la facture après paiement
CREATE OR REPLACE FUNCTION trigger_update_invoice_status_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_balance DECIMAL(10,2);
  v_new_status TEXT;
BEGIN
  v_balance := get_invoice_balance(NEW.invoice_id);
  
  IF v_balance <= 0 THEN
    v_new_status := 'paid';
  ELSIF v_balance < (SELECT total_amount FROM provider_invoices WHERE id = NEW.invoice_id) THEN
    v_new_status := 'partial';
  ELSE
    -- Garder le statut actuel
    RETURN NEW;
  END IF;
  
  UPDATE provider_invoices
  SET 
    status = v_new_status,
    paid_date = CASE WHEN v_new_status = 'paid' THEN CURRENT_DATE ELSE paid_date END,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_invoice_status_on_payment ON provider_invoice_payments;
CREATE TRIGGER trg_update_invoice_status_on_payment
  AFTER INSERT ON provider_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION trigger_update_invoice_status_on_payment();

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_provider_invoices_updated_at ON provider_invoices;
CREATE TRIGGER trg_provider_invoices_updated_at
  BEFORE UPDATE ON provider_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

ALTER TABLE provider_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_number_sequences ENABLE ROW LEVEL SECURITY;

-- Policies provider_invoices
DROP POLICY IF EXISTS "Providers can manage own invoices" ON provider_invoices;
CREATE POLICY "Providers can manage own invoices"
  ON provider_invoices FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view invoices addressed to them" ON provider_invoices;
CREATE POLICY "Owners can view invoices addressed to them"
  ON provider_invoices FOR SELECT
  USING (owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view all invoices" ON provider_invoices;
CREATE POLICY "Admins can view all invoices"
  ON provider_invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies provider_invoice_items
DROP POLICY IF EXISTS "Users can manage invoice items" ON provider_invoice_items;
CREATE POLICY "Users can manage invoice items"
  ON provider_invoice_items FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM provider_invoices 
      WHERE provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can view invoice items" ON provider_invoice_items;
CREATE POLICY "Owners can view invoice items"
  ON provider_invoice_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM provider_invoices 
      WHERE owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Policies provider_invoice_payments
DROP POLICY IF EXISTS "Providers can manage payments" ON provider_invoice_payments;
CREATE POLICY "Providers can manage payments"
  ON provider_invoice_payments FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM provider_invoices 
      WHERE provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can view payments" ON provider_invoice_payments;
CREATE POLICY "Owners can view payments"
  ON provider_invoice_payments FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM provider_invoices 
      WHERE owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Policies sequences
DROP POLICY IF EXISTS "Providers can manage own sequences" ON invoice_number_sequences;
CREATE POLICY "Providers can manage own sequences"
  ON invoice_number_sequences FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- =====================================================
-- 8. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE provider_invoices IS 'Factures prestataires conformes aux obligations légales françaises';
COMMENT ON TABLE provider_invoice_items IS 'Lignes de facture avec TVA par ligne';
COMMENT ON TABLE provider_invoice_payments IS 'Paiements et acomptes sur factures';
COMMENT ON FUNCTION generate_invoice_number IS 'Génère un numéro de facture unique et séquentiel';
COMMENT ON FUNCTION calculate_invoice_totals IS 'Recalcule les totaux d''une facture';
COMMENT ON FUNCTION get_invoice_balance IS 'Retourne le solde dû d''une facture';
COMMENT ON FUNCTION calculate_late_fees IS 'Calcule les pénalités de retard selon l''Article L441-10';
COMMENT ON FUNCTION get_invoice_pdf_data IS 'Génère les données structurées pour la génération du PDF';

