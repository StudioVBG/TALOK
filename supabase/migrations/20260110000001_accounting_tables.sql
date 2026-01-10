-- ============================================================================
-- MIGRATION: Tables Comptabilité Complètes
-- Date: 2026-01-10
-- Description: Ajoute les tables nécessaires pour une comptabilité complète
-- ============================================================================

-- ============================================================================
-- 1. TABLE: accounting_journals (Journaux comptables)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(4) NOT NULL UNIQUE,
  libelle VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les journaux par défaut
INSERT INTO public.accounting_journals (code, libelle, description) VALUES
  ('VE', 'Ventes', 'Facturation des honoraires de gestion'),
  ('AC', 'Achats', 'Factures fournisseurs et prestataires'),
  ('BQ', 'Banque Agence', 'Mouvements du compte courant agence'),
  ('BM', 'Banque Mandant', 'Mouvements du compte mandant'),
  ('OD', 'Opérations Diverses', 'Régularisations et écritures diverses'),
  ('AN', 'À Nouveau', 'Report à nouveau des soldes')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. TABLE: accounting_accounts (Plan comptable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(10) NOT NULL UNIQUE,
  libelle VARCHAR(255) NOT NULL,
  classe INTEGER NOT NULL CHECK (classe BETWEEN 1 AND 9),
  sens VARCHAR(10) CHECK (sens IN ('debit', 'credit', 'mixte')),
  is_active BOOLEAN DEFAULT true,
  parent_numero VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les comptes principaux
INSERT INTO public.accounting_accounts (numero, libelle, classe, sens) VALUES
  -- Classe 4 - Tiers
  ('401000', 'Fournisseurs', 4, 'credit'),
  ('411000', 'Clients', 4, 'debit'),
  ('421000', 'Personnel - Rémunérations dues', 4, 'credit'),
  ('445710', 'TVA collectée', 4, 'credit'),
  ('445660', 'TVA déductible sur ABS', 4, 'debit'),
  ('467000', 'Autres comptes débiteurs ou créditeurs', 4, 'mixte'),
  ('467100', 'Propriétaires - Comptes mandants', 4, 'credit'),
  ('467200', 'Locataires - Comptes mandants', 4, 'debit'),
  ('467300', 'Dépôts de garantie reçus', 4, 'credit'),
  -- Classe 5 - Financiers
  ('512000', 'Banque compte courant', 5, 'debit'),
  ('545000', 'Banque compte mandant', 5, 'debit'),
  ('530000', 'Caisse', 5, 'debit'),
  -- Classe 6 - Charges
  ('606100', 'Fournitures non stockables', 6, 'debit'),
  ('613500', 'Locations mobilières (SaaS)', 6, 'debit'),
  ('616000', 'Primes d''assurance', 6, 'debit'),
  ('622600', 'Honoraires comptables', 6, 'debit'),
  ('626000', 'Frais postaux et télécommunications', 6, 'debit'),
  ('627100', 'Frais bancaires', 6, 'debit'),
  -- Classe 7 - Produits
  ('706000', 'Prestations de services', 7, 'credit'),
  ('706100', 'Honoraires de gestion locative', 7, 'credit'),
  ('706200', 'Honoraires de mise en location', 7, 'credit'),
  ('706300', 'Honoraires d''état des lieux', 7, 'credit')
ON CONFLICT (numero) DO NOTHING;

-- ============================================================================
-- 3. TABLE: accounting_entries (Écritures comptables)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  journal_code VARCHAR(4) NOT NULL REFERENCES public.accounting_journals(code),
  ecriture_num VARCHAR(30) NOT NULL,
  ecriture_date DATE NOT NULL,

  -- Compte
  compte_num VARCHAR(10) NOT NULL,
  compte_lib VARCHAR(255) NOT NULL,
  compte_aux_num VARCHAR(20),
  compte_aux_lib VARCHAR(255),

  -- Pièce
  piece_ref VARCHAR(50) NOT NULL,
  piece_date DATE NOT NULL,

  -- Montants
  ecriture_lib VARCHAR(255) NOT NULL,
  debit DECIMAL(15, 2) NOT NULL DEFAULT 0,
  credit DECIMAL(15, 2) NOT NULL DEFAULT 0,

  -- Lettrage
  ecriture_let VARCHAR(10),
  date_let DATE,

  -- Validation
  valid_date DATE,

  -- Devise
  montant_devise DECIMAL(15, 2) DEFAULT 0,
  idevise VARCHAR(3) DEFAULT 'EUR',

  -- Métadonnées
  owner_id UUID REFERENCES public.profiles(id),
  property_id UUID REFERENCES public.properties(id),
  invoice_id UUID REFERENCES public.invoices(id),
  payment_id UUID REFERENCES public.payments(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Contraintes
  CONSTRAINT check_debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)
  )
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_accounting_entries_journal ON public.accounting_entries(journal_code);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_date ON public.accounting_entries(ecriture_date);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_compte ON public.accounting_entries(compte_num);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_piece ON public.accounting_entries(piece_ref);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_owner ON public.accounting_entries(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_invoice ON public.accounting_entries(invoice_id);

-- ============================================================================
-- 4. TABLE: mandant_accounts (Comptes mandants individuels)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.mandant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  account_number VARCHAR(20) NOT NULL UNIQUE,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('proprietaire', 'locataire')),

  -- Liens
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  property_id UUID REFERENCES public.properties(id),

  -- Soldes
  solde_debit DECIMAL(15, 2) DEFAULT 0,
  solde_credit DECIMAL(15, 2) DEFAULT 0,
  solde_net DECIMAL(15, 2) GENERATED ALWAYS AS (solde_credit - solde_debit) STORED,

  -- Dates
  last_movement_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT unique_mandant_profile_property UNIQUE (profile_id, property_id, account_type)
);

CREATE INDEX IF NOT EXISTS idx_mandant_accounts_profile ON public.mandant_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_mandant_accounts_type ON public.mandant_accounts(account_type);

-- ============================================================================
-- 5. TABLE: charge_regularisations (Régularisation des charges)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.charge_regularisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  lease_id UUID NOT NULL REFERENCES public.leases(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id),

  -- Période
  annee INTEGER NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,

  -- Montants
  provisions_versees DECIMAL(15, 2) NOT NULL DEFAULT 0,
  charges_reelles DECIMAL(15, 2) NOT NULL DEFAULT 0,
  solde DECIMAL(15, 2) GENERATED ALWAYS AS (charges_reelles - provisions_versees) STORED,

  -- Détail charges
  detail_charges JSONB DEFAULT '[]',

  -- Statut
  statut VARCHAR(20) DEFAULT 'draft' CHECK (statut IN ('draft', 'sent', 'paid', 'disputed', 'cancelled')),

  -- Dates
  date_emission DATE,
  date_echeance DATE,
  date_paiement DATE,

  -- Ajustement
  nouvelle_provision DECIMAL(15, 2),
  date_effet_nouvelle_provision DATE,

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_regularisation_lease_annee UNIQUE (lease_id, annee)
);

CREATE INDEX IF NOT EXISTS idx_charge_regularisations_lease ON public.charge_regularisations(lease_id);
CREATE INDEX IF NOT EXISTS idx_charge_regularisations_annee ON public.charge_regularisations(annee);

-- ============================================================================
-- 6. TABLE: deposit_operations (Opérations sur dépôts de garantie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.deposit_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  lease_id UUID NOT NULL REFERENCES public.leases(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id),
  owner_id UUID NOT NULL REFERENCES public.profiles(id),

  -- Type d'opération
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('reception', 'restitution', 'retenue', 'complement')),

  -- Montants
  montant DECIMAL(15, 2) NOT NULL,

  -- Pour les retenues
  motif_retenue TEXT,
  detail_retenues JSONB DEFAULT '[]',

  -- Références
  payment_id UUID REFERENCES public.payments(id),
  edl_sortie_id UUID,

  -- Dates
  date_operation DATE NOT NULL,
  date_limite_restitution DATE,

  -- Statut
  statut VARCHAR(20) DEFAULT 'pending' CHECK (statut IN ('pending', 'completed', 'disputed', 'cancelled')),

  -- Documents
  documents JSONB DEFAULT '[]',

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_deposit_operations_lease ON public.deposit_operations(lease_id);
CREATE INDEX IF NOT EXISTS idx_deposit_operations_tenant ON public.deposit_operations(tenant_id);

-- ============================================================================
-- 7. TABLE: bank_reconciliations (Rapprochements bancaires)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Période
  periode VARCHAR(7) NOT NULL, -- YYYY-MM
  date_reconciliation DATE NOT NULL,

  -- Compte
  compte_type VARCHAR(20) NOT NULL CHECK (compte_type IN ('agence', 'mandant')),

  -- Soldes
  solde_banque DECIMAL(15, 2) NOT NULL,
  solde_comptable DECIMAL(15, 2) NOT NULL,
  ecart DECIMAL(15, 2) GENERATED ALWAYS AS (solde_banque - solde_comptable) STORED,

  -- Détail
  operations_non_pointees JSONB DEFAULT '[]',

  -- Statut
  statut VARCHAR(20) DEFAULT 'draft' CHECK (statut IN ('draft', 'validated', 'locked')),
  is_balanced BOOLEAN GENERATED ALWAYS AS (ABS(solde_banque - solde_comptable) < 0.01) STORED,

  -- Validation
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_reconciliation_periode_compte UNIQUE (periode, compte_type)
);

-- ============================================================================
-- 8. FONCTION: Enregistrer une écriture comptable
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_accounting_entry(
  p_journal_code VARCHAR(4),
  p_compte_num VARCHAR(10),
  p_compte_lib VARCHAR(255),
  p_piece_ref VARCHAR(50),
  p_ecriture_lib VARCHAR(255),
  p_debit DECIMAL(15, 2),
  p_credit DECIMAL(15, 2),
  p_owner_id UUID DEFAULT NULL,
  p_property_id UUID DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_payment_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_entry_id UUID;
  v_ecriture_num VARCHAR(30);
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Générer le numéro d'écriture
  v_ecriture_num := p_journal_code || '-' || TO_CHAR(v_today, 'YYYY') || '-' ||
    LPAD(COALESCE(
      (SELECT COUNT(*) + 1 FROM public.accounting_entries
       WHERE journal_code = p_journal_code
       AND EXTRACT(YEAR FROM ecriture_date) = EXTRACT(YEAR FROM v_today))::TEXT,
      '1'
    ), 6, '0');

  -- Insérer l'écriture
  INSERT INTO public.accounting_entries (
    journal_code, ecriture_num, ecriture_date,
    compte_num, compte_lib,
    piece_ref, piece_date,
    ecriture_lib, debit, credit,
    owner_id, property_id, invoice_id, payment_id
  ) VALUES (
    p_journal_code, v_ecriture_num, v_today,
    p_compte_num, p_compte_lib,
    p_piece_ref, v_today,
    p_ecriture_lib, p_debit, p_credit,
    p_owner_id, p_property_id, p_invoice_id, p_payment_id
  ) RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. FONCTION: Mettre à jour le solde mandant
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_mandant_balance(
  p_profile_id UUID,
  p_property_id UUID,
  p_account_type VARCHAR(20),
  p_debit DECIMAL(15, 2) DEFAULT 0,
  p_credit DECIMAL(15, 2) DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_account_number VARCHAR(20);
BEGIN
  -- Générer le numéro de compte
  v_account_number := CASE p_account_type
    WHEN 'proprietaire' THEN '4671' || UPPER(SUBSTRING(p_profile_id::TEXT, 1, 5))
    WHEN 'locataire' THEN '4672' || UPPER(SUBSTRING(p_profile_id::TEXT, 1, 5))
  END;

  -- Upsert le compte mandant
  INSERT INTO public.mandant_accounts (
    account_number, account_type, profile_id, property_id,
    solde_debit, solde_credit, last_movement_at
  ) VALUES (
    v_account_number, p_account_type, p_profile_id, p_property_id,
    p_debit, p_credit, NOW()
  )
  ON CONFLICT (profile_id, property_id, account_type) DO UPDATE SET
    solde_debit = public.mandant_accounts.solde_debit + p_debit,
    solde_credit = public.mandant_accounts.solde_credit + p_credit,
    last_movement_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_account_id;

  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. RLS Policies
-- ============================================================================

-- accounting_entries
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all entries" ON public.accounting_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Owners can view their entries" ON public.accounting_entries
  FOR SELECT TO authenticated
  USING (
    owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert entries" ON public.accounting_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- mandant_accounts
ALTER TABLE public.mandant_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all mandant accounts" ON public.mandant_accounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view their own mandant account" ON public.mandant_accounts
  FOR SELECT TO authenticated
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- charge_regularisations
ALTER TABLE public.charge_regularisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage regularisations" ON public.charge_regularisations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Tenants can view their regularisations" ON public.charge_regularisations
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- deposit_operations
ALTER TABLE public.deposit_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage deposits" ON public.deposit_operations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Owners can view their deposit operations" ON public.deposit_operations
  FOR SELECT TO authenticated
  USING (
    owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenants can view their deposit operations" ON public.deposit_operations
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- bank_reconciliations
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only for reconciliations" ON public.bank_reconciliations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 11. Triggers pour mise à jour automatique
-- ============================================================================

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mandant_accounts_updated_at
  BEFORE UPDATE ON public.mandant_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_charge_regularisations_updated_at
  BEFORE UPDATE ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deposit_operations_updated_at
  BEFORE UPDATE ON public.deposit_operations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_reconciliations_updated_at
  BEFORE UPDATE ON public.bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================
