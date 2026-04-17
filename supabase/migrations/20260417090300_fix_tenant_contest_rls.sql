-- =====================================================
-- MIGRATION: Gap P0 #4 — RLS locataire contested
-- Date: 2026-04-17
-- Sprint: 0.a (Fondations DB — Régularisation des charges)
--
-- La policy lease_charge_reg_tenant_contest créée par la
-- migration 20260408130000 a un WITH CHECK (status = 'sent')
-- qui interdit toute transition : l'UPDATE voit la NOUVELLE
-- valeur et si le locataire passe status à 'contested' le
-- WITH CHECK rejette. Résultat : la policy est inutile,
-- le locataire ne peut rien modifier.
--
-- Fix : USING (ancien status = 'sent') + WITH CHECK
-- (nouveau status = 'contested'). Transition strictement
-- sent → contested, aucune autre autorisée (pas sent→settled,
-- pas contested→sent, etc.). L'appartenance au bail reste
-- vérifiée des deux côtés.
--
-- Idempotent : DROP POLICY IF EXISTS avant CREATE POLICY.
-- =====================================================

DROP POLICY IF EXISTS "lease_charge_reg_tenant_contest" ON lease_charge_regularizations;

CREATE POLICY "lease_charge_reg_tenant_contest" ON lease_charge_regularizations
  FOR UPDATE TO authenticated
  USING (
    status = 'sent'
    AND lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  )
  WITH CHECK (
    status = 'contested'
    AND lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

COMMENT ON POLICY "lease_charge_reg_tenant_contest" ON lease_charge_regularizations IS
  'Locataire : transition strictement sent → contested. Toute autre transition est interdite (owner only). Gap P0 #4 du skill talok-charges-regularization.';
