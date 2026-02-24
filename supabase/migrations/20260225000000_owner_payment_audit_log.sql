-- ============================================================
-- SOTA 2026 : Journal d'audit PSD3 pour les moyens de paiement propriétaire
-- Traçabilité des actions (carte ajoutée/supprimée, défaut, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS owner_payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payment_method_type TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opal_owner_created ON owner_payment_audit_log(owner_id, created_at DESC);

COMMENT ON TABLE owner_payment_audit_log IS 'Audit trail PSD3 pour les opérations sur les moyens de paiement propriétaire (abonnement, carte, etc.)';

ALTER TABLE owner_payment_audit_log ENABLE ROW LEVEL SECURITY;

-- Le propriétaire ne voit que ses propres logs
CREATE POLICY "opal_select_own" ON owner_payment_audit_log
  FOR SELECT USING (owner_id = public.user_profile_id());

-- Le propriétaire peut insérer des logs pour lui-même (via l'API qui utilise son session)
CREATE POLICY "opal_insert_own" ON owner_payment_audit_log
  FOR INSERT WITH CHECK (owner_id = public.user_profile_id());

-- L'admin voit et gère tout (lecture seule en pratique, pas de UPDATE/DELETE prévus)
CREATE POLICY "opal_admin_all" ON owner_payment_audit_log
  FOR ALL USING (public.user_role() = 'admin');
