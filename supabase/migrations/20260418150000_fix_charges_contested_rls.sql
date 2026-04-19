-- =====================================================
-- MIGRATION: Gap P0 #4 — Policy tenant contested (version finale appliquée prod)
-- Date: 2026-04-18
-- Sprint: 0.c (Fondations DB — Régularisation des charges)
--
-- Supersede 20260417090300_fix_tenant_contest_rls.sql (jamais tourné en prod).
-- Celle-ci a été appliquée directement via SQL Editor Supabase le 2026-04-18
-- mais n'avait pas été committée en tant que migration versionnée — ce fichier
-- corrige la dérive git ↔ prod en formalisant l'état réel.
--
-- Différence vs. 20260417090300 (strict sent → contested uniquement) :
--   USING      identique  (status='sent' AND membre du bail)
--   WITH CHECK assoupli   status IN ('sent', 'contested') — permet les UPDATE
--              idempotents sent → sent (ex. tenant met à jour son
--              `contest_reason` avant de basculer en contested) et
--              sent → contested (transition normale).
--
-- Garde-fous inchangés :
--   - owner reste seul à pouvoir passer en 'settled', 'acknowledged', etc.
--     (policy `lease_charge_reg_owner_access` couvre tous les cas)
--   - tenant ne peut pas modifier status vers autre chose que sent/contested
--   - appartenance au bail vérifiée des deux côtés
--
-- Idempotent : DROP POLICY IF EXISTS avant CREATE POLICY. Peut être ré-appliquée
-- sans effet secondaire sur la prod qui la possède déjà.
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
    status IN ('sent', 'contested')
    AND lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

COMMENT ON POLICY "lease_charge_reg_tenant_contest" ON lease_charge_regularizations IS
  'Locataire : UPDATE autorisé depuis status=sent vers status IN (sent, contested). Version finale Sprint 0.c — supersede 20260417090300. Gap P0 #4 du skill talok-charges-regularization.';
