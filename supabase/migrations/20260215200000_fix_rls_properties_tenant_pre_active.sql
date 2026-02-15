-- ============================================================================
-- P0-E1: Fix RLS properties pour locataires avant bail "active"
-- ============================================================================
-- PROBLÈME: La policy "Tenants can view properties with active leases" exige
--           l.statut = 'active', ce qui empêche un nouveau locataire de voir
--           sa propriété pendant la phase de signature / onboarding.
--
-- FIX: Élargir la condition pour inclure tous les statuts où le locataire
--      est légitimement lié au bien (pending_signature, partially_signed,
--      fully_signed, active, notice_given, terminated).
-- ============================================================================

-- 1. Supprimer l'ancienne policy restrictive
DROP POLICY IF EXISTS "Tenants can view properties with active leases" ON properties;

-- 2. Créer la nouvelle policy élargie
CREATE POLICY "Tenants can view linked properties"
  ON properties
  FOR SELECT
  USING (
    -- Le locataire peut voir la propriété s'il est signataire d'un bail lié,
    -- quel que soit le statut du bail (sauf draft et cancelled)
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = properties.id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
  );

-- 3. Vérification : s'assurer que les autres policies existantes ne sont pas impactées
-- (les policies owner et admin restent inchangées)

COMMENT ON POLICY "Tenants can view linked properties" ON properties IS
  'P0-E1: Locataires voient les propriétés liées à leurs baux (sauf draft/cancelled). '
  'Remplace l''ancienne policy qui exigeait statut=active uniquement.';
