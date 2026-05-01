-- ============================================
-- Module syndic — Fournisseurs et contrats
-- ============================================
-- Permet au syndic de gérer son carnet de fournisseurs (entretien, ascenseur,
-- chauffage, espaces verts, assurance immeuble, gardiennage, etc.) et le
-- portefeuille de contrats associés à chaque copropriété.

CREATE TABLE IF NOT EXISTS public.copro_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  legal_form TEXT,
  siret TEXT,
  vat_number TEXT,

  category TEXT NOT NULL DEFAULT 'autre' CHECK (
    category IN (
      'entretien', 'ascenseur', 'chauffage', 'plomberie', 'electricite',
      'espaces_verts', 'nettoyage', 'gardiennage', 'securite',
      'assurance', 'expert_comptable', 'avocat', 'architecte',
      'travaux_batiment', 'autre'
    )
  ),

  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  address_line1 TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'FR',

  notes TEXT,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copro_suppliers_syndic
  ON public.copro_suppliers(syndic_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_copro_suppliers_category
  ON public.copro_suppliers(category);
CREATE INDEX IF NOT EXISTS idx_copro_suppliers_siret
  ON public.copro_suppliers(siret) WHERE siret IS NOT NULL;

COMMENT ON TABLE public.copro_suppliers IS
'Carnet de fournisseurs partagé par le syndic (utilisable sur toutes ses copropriétés).';

-- ============================================
-- Contrats
-- ============================================
CREATE TABLE IF NOT EXISTS public.copro_supplier_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.copro_suppliers(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,

  contract_number TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'entretien' CHECK (
    category IN (
      'entretien', 'ascenseur', 'chauffage', 'plomberie', 'electricite',
      'espaces_verts', 'nettoyage', 'gardiennage', 'securite',
      'assurance_immeuble', 'expert_comptable', 'avocat', 'autre'
    )
  ),

  start_date DATE NOT NULL,
  end_date DATE,
  duration_months INTEGER,
  tacit_renewal BOOLEAN NOT NULL DEFAULT FALSE,
  notice_period_months INTEGER DEFAULT 3,

  payment_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (
    payment_frequency IN ('monthly', 'quarterly', 'annual', 'on_demand')
  ),
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  vat_rate_pct DECIMAL(5, 2),
  currency TEXT NOT NULL DEFAULT 'EUR',

  contract_pdf_url TEXT,
  voted_in_assembly_id UUID REFERENCES public.copro_assemblies(id),
  voted_resolution_id UUID,

  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('draft', 'active', 'suspended', 'expired', 'terminated')
  ),
  terminated_at TIMESTAMPTZ,
  terminated_reason TEXT,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copro_supplier_contracts_site
  ON public.copro_supplier_contracts(site_id, status);
CREATE INDEX IF NOT EXISTS idx_copro_supplier_contracts_supplier
  ON public.copro_supplier_contracts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_copro_supplier_contracts_end_date
  ON public.copro_supplier_contracts(end_date) WHERE status = 'active' AND end_date IS NOT NULL;

COMMENT ON TABLE public.copro_supplier_contracts IS
'Contrats fournisseurs rattachés à une copropriété (entretien, ascenseur, assurance, etc.).';

-- ============================================
-- RLS Suppliers
-- ============================================
ALTER TABLE public.copro_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copro_suppliers_select_own" ON public.copro_suppliers;
CREATE POLICY "copro_suppliers_select_own" ON public.copro_suppliers
  FOR SELECT TO authenticated
  USING (
    syndic_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'platform_admin')
    )
  );

DROP POLICY IF EXISTS "copro_suppliers_insert_own" ON public.copro_suppliers;
CREATE POLICY "copro_suppliers_insert_own" ON public.copro_suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    syndic_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "copro_suppliers_update_own" ON public.copro_suppliers;
CREATE POLICY "copro_suppliers_update_own" ON public.copro_suppliers
  FOR UPDATE TO authenticated
  USING (
    syndic_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "copro_suppliers_delete_own" ON public.copro_suppliers;
CREATE POLICY "copro_suppliers_delete_own" ON public.copro_suppliers
  FOR DELETE TO authenticated
  USING (
    syndic_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- RLS Contracts
-- ============================================
ALTER TABLE public.copro_supplier_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copro_supplier_contracts_select" ON public.copro_supplier_contracts;
CREATE POLICY "copro_supplier_contracts_select" ON public.copro_supplier_contracts
  FOR SELECT TO authenticated
  USING (
    site_id IN (
      SELECT s.id FROM public.sites s
      JOIN public.profiles p ON p.id = s.syndic_profile_id
      WHERE p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'platform_admin')
    )
  );

DROP POLICY IF EXISTS "copro_supplier_contracts_insert" ON public.copro_supplier_contracts;
CREATE POLICY "copro_supplier_contracts_insert" ON public.copro_supplier_contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    site_id IN (
      SELECT s.id FROM public.sites s
      JOIN public.profiles p ON p.id = s.syndic_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "copro_supplier_contracts_update" ON public.copro_supplier_contracts;
CREATE POLICY "copro_supplier_contracts_update" ON public.copro_supplier_contracts
  FOR UPDATE TO authenticated
  USING (
    site_id IN (
      SELECT s.id FROM public.sites s
      JOIN public.profiles p ON p.id = s.syndic_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "copro_supplier_contracts_delete" ON public.copro_supplier_contracts;
CREATE POLICY "copro_supplier_contracts_delete" ON public.copro_supplier_contracts
  FOR DELETE TO authenticated
  USING (
    site_id IN (
      SELECT s.id FROM public.sites s
      JOIN public.profiles p ON p.id = s.syndic_profile_id
      WHERE p.user_id = auth.uid()
    )
  );
