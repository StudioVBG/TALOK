-- ============================================
-- MIGRATION: Remise des clés
-- SOTA 2026 — Table + RLS + Index
-- ============================================

CREATE TABLE IF NOT EXISTS public.key_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id),

  -- Type
  handover_type TEXT NOT NULL CHECK (handover_type IN ('entree', 'sortie')),

  -- Clés remises
  keys JSONB NOT NULL DEFAULT '[]',
  -- Format: [{ "type": "porte_principale", "quantity": 2, "notes": "clés Fichet" }, ...]

  -- Codes et accès
  access_codes JSONB DEFAULT '[]',
  -- Format: [{ "type": "digicode", "code": "1234A", "location": "hall" }, ...]

  -- Participants
  owner_profile_id UUID REFERENCES public.profiles(id),
  tenant_profile_id UUID REFERENCES public.profiles(id),
  witness_name TEXT,              -- Nom du témoin (huissier, agent, etc.)
  witness_role TEXT,              -- huissier / agent_immobilier / autre

  -- Date et lieu
  handover_date DATE NOT NULL,
  handover_time TIME,
  handover_location TEXT,         -- Adresse si différente du bien

  -- Relevés compteurs au moment de la remise
  meter_readings JSONB DEFAULT '[]',
  -- Format: [{ "meter_type": "electricity", "value": 12345, "unit": "kWh" }, ...]

  -- Signatures
  owner_signed BOOLEAN NOT NULL DEFAULT FALSE,
  tenant_signed BOOLEAN NOT NULL DEFAULT FALSE,
  owner_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,
  owner_signature_path TEXT,
  tenant_signature_path TEXT,

  -- Statut
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned',        -- Planifiée
    'in_progress',    -- En cours
    'completed',      -- Terminée (signée par les deux parties)
    'cancelled'       -- Annulée
  )),

  -- Photos
  photos JSONB DEFAULT '[]',
  -- Format: [{ "path": "...", "description": "Clés remises" }, ...]

  -- Notes
  notes TEXT,
  general_observations TEXT,

  -- Métadonnées
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_key_handovers_lease_id ON public.key_handovers(lease_id);
CREATE INDEX idx_key_handovers_status ON public.key_handovers(status);
CREATE UNIQUE INDEX idx_key_handovers_unique_type ON public.key_handovers(lease_id, handover_type)
  WHERE status != 'cancelled';

-- Trigger updated_at
CREATE TRIGGER trg_key_handovers_updated_at
  BEFORE UPDATE ON public.key_handovers
  FOR EACH ROW EXECUTE FUNCTION public.update_lease_amendment_timestamp();

-- RLS
ALTER TABLE public.key_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_key_handovers_all" ON public.key_handovers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = key_handovers.property_id
      AND p.owner_id = public.user_profile_id()
    )
  );

CREATE POLICY "tenant_key_handovers_select" ON public.key_handovers
  FOR SELECT USING (
    tenant_profile_id = public.user_profile_id()
  );

CREATE POLICY "service_key_handovers_all" ON public.key_handovers
  FOR ALL USING (auth.role() = 'service_role');
