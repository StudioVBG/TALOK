-- =====================================================
-- ⚠️ NE PAS EXÉCUTER — ROLLBACK DORMANT
-- Sprint 0.c apply — rollback script
-- À n'utiliser qu'en cas d'anomalie PASS 1, PASS 2 ou PASS 3
-- =====================================================
--
-- Migrations concernées :
--   20260418150000_fix_charges_contested_rls
--   20260418150100_charges_pcg_accounts_backfill_p2
--
-- Règle : rollback par PASS, dans l'ordre INVERSE d'application.
-- Décommenter UNIQUEMENT le bloc à exécuter.
-- =====================================================

-- =====================================================
-- ROLLBACK PASS 2 — Backfill PCG 614100 + 708000
-- =====================================================
--
-- ⚠️ DECISION : par défaut, NE PAS supprimer les lignes insérées.
-- Les comptes 614100 / 708000 sont inoffensifs tant que personne
-- ne les utilise. Les laisser évite tout risque d'orphaner des
-- `accounting_entry_lines` qui les référenceraient (FK text, pas
-- d'intégrité relationnelle — DELETE côté COA casserait juste
-- le join côté reporting).
--
-- Si tu veux VRAIMENT les supprimer (ex: pollution COA détectée) :
--
/*
DELETE FROM chart_of_accounts
WHERE account_number IN ('614100', '708000')
  AND NOT EXISTS (
    -- Safety : ne supprimer que les comptes non référencés par des écritures
    SELECT 1 FROM accounting_entry_lines
    WHERE account_number = chart_of_accounts.account_number
  );
*/
--
-- Puis retirer la version de schema_migrations :
/*
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260418150100';
*/

-- =====================================================
-- ROLLBACK PASS 1 — Policy RLS tenant contested
-- =====================================================
--
-- La migration Sprint 0.c a assoupli WITH CHECK à
-- `status IN ('sent', 'contested')`. Rollback recommandé :
-- retour à la version STRICTE (090300, WITH CHECK status='contested')
-- qui fixe toujours le P0 #4 mais interdit les UPDATE idempotents.
--
-- ⚠️ NE JAMAIS rétablir la version cassée originale
-- (WITH CHECK status = 'sent' — c'est le bug P0 #4 qu'on a fixé).
--
/*
DROP POLICY IF EXISTS lease_charge_reg_tenant_contest ON public.lease_charge_regularizations;

CREATE POLICY lease_charge_reg_tenant_contest
ON public.lease_charge_regularizations
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

COMMENT ON POLICY lease_charge_reg_tenant_contest ON public.lease_charge_regularizations IS
  'Locataire : transition strictement sent → contested. ROLLBACK Sprint 0.c — retour version stricte 090300.';
*/
--
-- Puis retirer la version de schema_migrations :
/*
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260418150000';
*/

-- =====================================================
-- CAS EXTRÊME — Rollback DB complet des 2 migrations
-- =====================================================
--
-- Uniquement si les 2 PASS ont échoué + aucune donnée dérivée.
-- Exécuter dans l'ordre :
--   1. Bloc ROLLBACK PASS 2 (backfill)
--   2. Bloc ROLLBACK PASS 1 (RLS)
--
-- Ne pas TRUNCATE ou DROP les tables — aucune table n'est
-- créée/supprimée par les migrations Sprint 0.c.

-- =====================================================
-- FIN
-- =====================================================
