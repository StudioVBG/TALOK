-- =====================================================
-- Sprint 0.c RESCUE — Gap P0 #4 fix : policy RLS tenant contested
-- Date: 2026-04-18
--
-- La policy "lease_charge_reg_tenant_contest" créée par
-- 20260408130000_charges_locatives_module.sql a un WITH CHECK
-- (status = 'sent') qui bloque la transition sent → contested.
-- La policy est donc inutile : le locataire ne peut rien modifier.
--
-- Contexte : la migration 20260417090300_fix_tenant_contest_rls.sql
-- avait déjà remplacé la policy par une transition strictement
-- sent → contested (WITH CHECK status = 'contested'). Sprint 0.c
-- assouplit le WITH CHECK à status IN ('sent', 'contested') pour
-- autoriser aussi les UPDATE idempotents (sent→sent, utile pour
-- patcher des champs annexes sans changer le status).
--
-- Cette migration SUPERSEDE 20260417090300. Idempotente :
-- DROP POLICY IF EXISTS + CREATE POLICY.
-- =====================================================

DROP POLICY IF EXISTS lease_charge_reg_tenant_contest ON public.lease_charge_regularizations;

CREATE POLICY lease_charge_reg_tenant_contest
ON public.lease_charge_regularizations
FOR UPDATE TO authenticated
USING (
  status = 'sent'
  AND lease_id IN (
    SELECT l.id
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN profiles pr ON pr.id = ls.profile_id
    WHERE pr.user_id = auth.uid()
      AND ls.role IN ('locataire_principal', 'colocataire')
  )
)
WITH CHECK (
  status IN ('sent', 'contested')
  AND lease_id IN (
    SELECT l.id
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN profiles pr ON pr.id = ls.profile_id
    WHERE pr.user_id = auth.uid()
      AND ls.role IN ('locataire_principal', 'colocataire')
  )
);

COMMENT ON POLICY lease_charge_reg_tenant_contest ON public.lease_charge_regularizations IS
  'Permet au locataire de passer la régul de sent à contested uniquement. USING force status=sent avant UPDATE, WITH CHECK restreint la nouvelle valeur à sent ou contested (sent→sent toléré pour patch idempotent, toute autre transition verrouillée par le USING). Sprint 0.c RESCUE — supersede 20260417090300.';
