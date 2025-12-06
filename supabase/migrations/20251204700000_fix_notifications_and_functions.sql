-- Migration: Corrections notifications et fonctions manquantes
-- Date: 2025-12-04

-- ============================================
-- 1. Ajouter recipient_id à notifications
-- ============================================
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES profiles(id);
UPDATE notifications SET recipient_id = user_id WHERE recipient_id IS NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);

-- ============================================
-- 2. Créer la fonction get_owner_lease_end_processes
-- ============================================
DROP FUNCTION IF EXISTS get_owner_lease_end_processes(UUID);
CREATE OR REPLACE FUNCTION get_owner_lease_end_processes(p_owner_id UUID)
RETURNS TABLE (
  id UUID,
  lease_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  property_address TEXT,
  tenant_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(eol.id, gen_random_uuid()),
    l.id as lease_id,
    COALESCE(eol.status, 'pending')::TEXT,
    COALESCE(eol.created_at, l.created_at),
    COALESCE(p.adresse_complete, 'Adresse non renseignée')::TEXT,
    COALESCE(concat(pr.prenom, ' ', pr.nom), 'Locataire')::TEXT
  FROM leases l
  LEFT JOIN end_of_lease_processes eol ON eol.lease_id = l.id
  JOIN properties p ON p.id = l.property_id
  LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire'
  LEFT JOIN profiles pr ON pr.id = ls.profile_id
  WHERE p.owner_id = p_owner_id
    AND l.statut IN ('active', 'ending', 'terminated')
  ORDER BY l.date_fin ASC NULLS LAST;
END;
$$;

-- ============================================
-- 3. Créer la table end_of_lease_processes si elle n'existe pas
-- ============================================
CREATE TABLE IF NOT EXISTS end_of_lease_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID REFERENCES leases(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  notice_date DATE,
  notice_type TEXT,
  move_out_date DATE,
  deposit_return_status TEXT DEFAULT 'pending',
  deposit_return_amount DECIMAL(10,2),
  deposit_deductions JSONB,
  final_inspection_date DATE,
  final_inspection_status TEXT,
  keys_returned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lease_id)
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_eol_processes_lease ON end_of_lease_processes(lease_id);
CREATE INDEX IF NOT EXISTS idx_eol_processes_status ON end_of_lease_processes(status);

-- ============================================
-- 4. RLS pour end_of_lease_processes
-- ============================================
ALTER TABLE end_of_lease_processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eol_owner_select" ON end_of_lease_processes;
CREATE POLICY "eol_owner_select" ON end_of_lease_processes FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM leases l
    JOIN properties p ON p.id = l.property_id
    WHERE l.id = end_of_lease_processes.lease_id
      AND p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "eol_owner_all" ON end_of_lease_processes;
CREATE POLICY "eol_owner_all" ON end_of_lease_processes FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM leases l
    JOIN properties p ON p.id = l.property_id
    WHERE l.id = end_of_lease_processes.lease_id
      AND p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- ============================================
-- 5. RLS pour notifications avec recipient_id
-- ============================================
DROP POLICY IF EXISTS "notifications_recipient_select" ON notifications;
CREATE POLICY "notifications_recipient_select" ON notifications FOR SELECT TO authenticated USING (
  recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "notifications_recipient_update" ON notifications;
CREATE POLICY "notifications_recipient_update" ON notifications FOR UPDATE TO authenticated USING (
  recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);

