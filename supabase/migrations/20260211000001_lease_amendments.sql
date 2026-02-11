-- ============================================
-- MIGRATION: Avenants au bail
-- SOTA 2026 — Table + RLS + Index
-- ============================================

-- Table des avenants
CREATE TABLE IF NOT EXISTS public.lease_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,

  -- Type d'avenant
  amendment_type TEXT NOT NULL CHECK (amendment_type IN (
    'loyer',               -- Modification du loyer (hors IRL)
    'charges',             -- Modification des charges
    'duree',               -- Prolongation ou réduction de durée
    'occupant_ajout',      -- Ajout d'un occupant/colocataire
    'occupant_retrait',    -- Retrait d'un occupant
    'clause_ajout',        -- Ajout d'une clause
    'clause_modification', -- Modification d'une clause
    'clause_suppression',  -- Suppression d'une clause
    'depot_garantie',      -- Modification dépôt de garantie
    'usage',               -- Changement d'usage (mixte, etc.)
    'travaux',             -- Accord travaux locataire
    'autre'                -- Autre modification
  )),

  -- Contenu
  description TEXT NOT NULL,
  motif TEXT,                          -- Motif juridique de l'avenant
  old_values JSONB NOT NULL DEFAULT '{}', -- Valeurs avant modification
  new_values JSONB NOT NULL DEFAULT '{}', -- Valeurs après modification
  effective_date DATE NOT NULL,        -- Date d'effet de l'avenant

  -- Numérotation
  amendment_number INTEGER NOT NULL DEFAULT 1,

  -- Signatures
  signed_by_owner BOOLEAN NOT NULL DEFAULT FALSE,
  signed_by_tenant BOOLEAN NOT NULL DEFAULT FALSE,
  owner_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,
  owner_signature_path TEXT,
  tenant_signature_path TEXT,
  owner_proof_metadata JSONB,
  tenant_proof_metadata JSONB,

  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',              -- Brouillon
    'pending_signature',  -- En attente de signatures
    'partially_signed',   -- Partiellement signé
    'signed',             -- Entièrement signé (appliqué)
    'cancelled',          -- Annulé
    'refused'             -- Refusé par une partie
  )),

  -- Document
  document_path TEXT,      -- PDF de l'avenant dans Storage
  sealed_at TIMESTAMPTZ,   -- Date de scellement

  -- Métadonnées
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_lease_amendments_lease_id ON public.lease_amendments(lease_id);
CREATE INDEX idx_lease_amendments_status ON public.lease_amendments(status) WHERE status NOT IN ('cancelled', 'refused');
CREATE UNIQUE INDEX idx_lease_amendments_number ON public.lease_amendments(lease_id, amendment_number);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_lease_amendment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lease_amendments_updated_at
  BEFORE UPDATE ON public.lease_amendments
  FOR EACH ROW EXECUTE FUNCTION public.update_lease_amendment_timestamp();

-- Auto-numérotation
CREATE OR REPLACE FUNCTION public.auto_number_amendment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amendment_number IS NULL OR NEW.amendment_number = 1 THEN
    SELECT COALESCE(MAX(amendment_number), 0) + 1
    INTO NEW.amendment_number
    FROM public.lease_amendments
    WHERE lease_id = NEW.lease_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lease_amendments_auto_number
  BEFORE INSERT ON public.lease_amendments
  FOR EACH ROW EXECUTE FUNCTION public.auto_number_amendment();

-- RLS
ALTER TABLE public.lease_amendments ENABLE ROW LEVEL SECURITY;

-- Le propriétaire peut tout voir/modifier pour ses baux
CREATE POLICY "owner_amendments_all" ON public.lease_amendments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.properties p ON p.id = l.property_id
      WHERE l.id = lease_amendments.lease_id
      AND p.owner_id = public.user_profile_id()
    )
  );

-- Le locataire peut voir les avenants de ses baux
CREATE POLICY "tenant_amendments_select" ON public.lease_amendments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lease_signers ls
      WHERE ls.lease_id = lease_amendments.lease_id
      AND ls.profile_id = public.user_profile_id()
    )
  );

-- Service role a tout accès
CREATE POLICY "service_amendments_all" ON public.lease_amendments
  FOR ALL USING (auth.role() = 'service_role');
