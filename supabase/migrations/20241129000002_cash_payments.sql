-- Migration: Paiement en espèces avec signature tactile
-- Date: 2024-11-29
-- Description: Tables pour gérer les reçus espèces avec signatures numériques

BEGIN;

-- ============================================
-- ÉTENDRE LES MOYENS DE PAIEMENT
-- ============================================

-- Ajouter les nouveaux moyens de paiement si pas déjà fait
DO $$ 
BEGIN
  ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_moyen_check;
  ALTER TABLE payments ADD CONSTRAINT payments_moyen_check 
    CHECK (moyen IN ('cb', 'virement', 'prelevement', 'especes', 'cheque', 'autre'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- ============================================
-- TABLE DES REÇUS ESPÈCES
-- ============================================

CREATE TABLE IF NOT EXISTS cash_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Liens
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  
  -- Montant
  amount NUMERIC(10,2) NOT NULL,
  amount_words TEXT NOT NULL,  -- "Huit cents euros"
  
  -- Signatures (base64 PNG)
  owner_signature TEXT NOT NULL,
  tenant_signature TEXT NOT NULL,
  
  -- Horodatage signatures
  owner_signed_at TIMESTAMPTZ NOT NULL,
  tenant_signed_at TIMESTAMPTZ NOT NULL,
  
  -- Géolocalisation
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  address_reverse TEXT,  -- Adresse déduite de la géoloc via reverse geocoding
  
  -- Appareil et contexte
  device_info JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "userAgent": "...",
      "platform": "...",
      "language": "fr-FR",
      "screenWidth": 1920,
      "screenHeight": 1080
    }
  */
  ip_address TEXT,
  
  -- Intégrité et sécurité
  document_hash TEXT NOT NULL,  -- SHA256 du contenu
  signature_chain TEXT,  -- Hash de la signature précédente (blockchain-like)
  
  -- PDF généré
  pdf_path TEXT,
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  
  -- Période concernée
  periode TEXT NOT NULL,  -- "2024-12"
  
  -- Référence unique
  receipt_number TEXT NOT NULL UNIQUE,  -- "REC-2024-12-001"
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'signed' 
    CHECK (status IN ('draft', 'signed', 'sent', 'archived', 'disputed', 'cancelled')),
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_cash_receipts_invoice ON cash_receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_owner ON cash_receipts(owner_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_tenant ON cash_receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_property ON cash_receipts(property_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_status ON cash_receipts(status);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_periode ON cash_receipts(periode);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_created ON cash_receipts(created_at DESC);

-- ============================================
-- SÉQUENCE POUR NUMÉRO DE REÇU
-- ============================================

CREATE SEQUENCE IF NOT EXISTS cash_receipt_seq START 1;

-- Fonction pour générer le numéro de reçu
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_month TEXT;
  v_seq INTEGER;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  v_month := TO_CHAR(NOW(), 'MM');
  v_seq := NEXTVAL('cash_receipt_seq');
  RETURN 'REC-' || v_year || '-' || v_month || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-générer le numéro
CREATE OR REPLACE FUNCTION set_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := generate_receipt_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_receipt_number ON cash_receipts;
CREATE TRIGGER trg_set_receipt_number
  BEFORE INSERT ON cash_receipts
  FOR EACH ROW EXECUTE FUNCTION set_receipt_number();

-- ============================================
-- TABLE DES CONFIRMATIONS MANUELLES (historique)
-- ============================================

CREATE TABLE IF NOT EXISTS manual_payment_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cash_receipt_id UUID NOT NULL REFERENCES cash_receipts(id) ON DELETE CASCADE,
  
  -- Qui a confirmé
  confirmed_by UUID NOT NULL REFERENCES profiles(id),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Photo du reçu papier (optionnel)
  receipt_photo_path TEXT,
  receipt_photo_url TEXT,
  
  -- Notes
  notes TEXT,
  
  -- IP et device pour audit
  ip_address TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_confirmations_receipt ON manual_payment_confirmations(cash_receipt_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE cash_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_payment_confirmations ENABLE ROW LEVEL SECURITY;

-- Les propriétaires peuvent voir et créer leurs reçus
CREATE POLICY "Owners can manage their cash receipts" ON cash_receipts
  FOR ALL TO authenticated
  USING (
    owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Les locataires peuvent voir leurs reçus
CREATE POLICY "Tenants can view their cash receipts" ON cash_receipts
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all cash receipts" ON cash_receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Confirmations manuelles
CREATE POLICY "Owners can manage confirmations" ON manual_payment_confirmations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cash_receipts cr
      WHERE cr.id = manual_payment_confirmations.cash_receipt_id
      AND cr.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- FONCTION POUR CONVERTIR MONTANT EN LETTRES
-- ============================================

CREATE OR REPLACE FUNCTION amount_to_french_words(amount NUMERIC)
RETURNS TEXT AS $$
DECLARE
  units TEXT[] := ARRAY[
    '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    'dix-sept', 'dix-huit', 'dix-neuf'
  ];
  tens TEXT[] := ARRAY[
    '', '', 'vingt', 'trente', 'quarante', 'cinquante',
    'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'
  ];
  result TEXT := '';
  euros INTEGER;
  cents INTEGER;
  hundreds INTEGER;
  remainder INTEGER;
BEGIN
  euros := FLOOR(amount);
  cents := ROUND((amount - euros) * 100);
  
  -- Cas zéro
  IF euros = 0 THEN
    result := 'zéro';
  -- Cas < 20
  ELSIF euros < 20 THEN
    result := units[euros + 1];
  -- Cas < 100
  ELSIF euros < 100 THEN
    DECLARE
      t INTEGER := euros / 10;
      u INTEGER := euros % 10;
    BEGIN
      IF t = 7 OR t = 9 THEN
        -- 70-79, 90-99
        result := tens[t + 1];
        IF t = 7 THEN
          result := result || '-' || units[10 + u + 1];
        ELSE
          result := result || '-' || units[10 + u + 1];
        END IF;
      ELSIF u = 0 THEN
        result := tens[t + 1];
        IF t = 8 THEN
          result := result || 's';  -- quatre-vingts
        END IF;
      ELSIF u = 1 AND t /= 8 THEN
        result := tens[t + 1] || ' et un';
      ELSE
        result := tens[t + 1] || '-' || units[u + 1];
      END IF;
    END;
  -- Cas < 1000
  ELSIF euros < 1000 THEN
    hundreds := euros / 100;
    remainder := euros % 100;
    IF hundreds = 1 THEN
      result := 'cent';
    ELSE
      result := units[hundreds + 1] || ' cent';
      IF remainder = 0 THEN
        result := result || 's';
      END IF;
    END IF;
    IF remainder > 0 THEN
      result := result || ' ' || amount_to_french_words(remainder);
    END IF;
  -- Cas >= 1000
  ELSE
    DECLARE
      thousands INTEGER := euros / 1000;
      remainder INTEGER := euros % 1000;
    BEGIN
      IF thousands = 1 THEN
        result := 'mille';
      ELSE
        result := amount_to_french_words(thousands) || ' mille';
      END IF;
      IF remainder > 0 THEN
        result := result || ' ' || amount_to_french_words(remainder);
      END IF;
    END;
  END IF;
  
  -- Ajouter "euro(s)"
  result := result || ' euro';
  IF euros > 1 THEN
    result := result || 's';
  END IF;
  
  -- Ajouter les centimes
  IF cents > 0 THEN
    result := result || ' et ' || cents::TEXT || ' centime';
    IF cents > 1 THEN
      result := result || 's';
    END IF;
  END IF;
  
  -- Capitaliser la première lettre
  RETURN INITCAP(result);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- FONCTION POUR CRÉER UN REÇU COMPLET
-- ============================================

CREATE OR REPLACE FUNCTION create_cash_receipt(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_owner_signature TEXT,
  p_tenant_signature TEXT,
  p_owner_signed_at TIMESTAMPTZ,
  p_tenant_signed_at TIMESTAMPTZ,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb,
  p_notes TEXT DEFAULT NULL
) RETURNS cash_receipts AS $$
DECLARE
  v_invoice invoices;
  v_receipt cash_receipts;
  v_payment payments;
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
  
  -- Créer le paiement
  INSERT INTO payments (invoice_id, montant, moyen, date_paiement, statut)
  VALUES (p_invoice_id, p_amount, 'especes', CURRENT_DATE, 'succeeded')
  RETURNING * INTO v_payment;
  
  -- Créer le hash d'intégrité
  v_document_data := p_invoice_id::TEXT || p_amount::TEXT || 
                     p_owner_signed_at::TEXT || p_tenant_signed_at::TEXT ||
                     COALESCE(p_latitude::TEXT, '') || COALESCE(p_longitude::TEXT, '');
  v_hash := encode(sha256(v_document_data::bytea), 'hex');
  
  -- Créer le reçu
  INSERT INTO cash_receipts (
    invoice_id, payment_id, owner_id, tenant_id, property_id,
    amount, amount_words,
    owner_signature, tenant_signature,
    owner_signed_at, tenant_signed_at,
    latitude, longitude,
    device_info, document_hash,
    periode, notes, status
  )
  SELECT
    p_invoice_id,
    v_payment.id,
    v_invoice.owner_id,
    v_invoice.tenant_id,
    l.property_id,
    p_amount,
    amount_to_french_words(p_amount),
    p_owner_signature,
    p_tenant_signature,
    p_owner_signed_at,
    p_tenant_signed_at,
    p_latitude,
    p_longitude,
    p_device_info,
    v_hash,
    v_invoice.periode,
    p_notes,
    'signed'
  FROM invoices i
  JOIN leases l ON i.lease_id = l.id
  WHERE i.id = p_invoice_id
  RETURNING * INTO v_receipt;
  
  -- Mettre à jour la facture
  UPDATE invoices SET statut = 'paid' WHERE id = p_invoice_id;
  
  RETURN v_receipt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_cash_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cash_receipts_updated ON cash_receipts;
CREATE TRIGGER trg_cash_receipts_updated
  BEFORE UPDATE ON cash_receipts
  FOR EACH ROW EXECUTE FUNCTION update_cash_receipts_updated_at();

COMMIT;

