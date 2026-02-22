-- =====================================================
-- MIGRATION: Backfill invoices.tenant_id pour les profils existants
-- Date: 2026-02-26
--
-- OBJECTIF:
--   Pour les factures existantes où tenant_id est NULL mais où
--   un lease_signer avec role locataire_principal existe et est
--   déjà lié à un profil, on renseigne le tenant_id.
--
-- SÉCURITÉ:
--   - Ne touche QUE les lignes où tenant_id IS NULL
--   - Ne crée aucune donnée, ne supprime rien
--   - Idempotent : peut être exécuté plusieurs fois sans effet
-- =====================================================

-- Backfill : lier les factures orphelines aux profils existants
UPDATE public.invoices i
SET tenant_id = ls.profile_id
FROM public.lease_signers ls
WHERE i.lease_id = ls.lease_id
  AND ls.role = 'locataire_principal'
  AND ls.profile_id IS NOT NULL
  AND i.tenant_id IS NULL;

-- Log du nombre de lignes mises à jour (visible dans les logs Supabase)
DO $$
DECLARE
  updated_count INT;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '[backfill_invoices_tenant_id] % factures liées à leur locataire', updated_count;
END $$;
