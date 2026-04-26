-- =====================================================================
-- FIX : Doublons compliance prestataire
-- =====================================================================
-- Problème : provider_kyc_requirements n'a pas d'UNIQUE sur
-- (provider_type, document_type). La clause ON CONFLICT DO NOTHING
-- de la migration 20251205200000 est inopérante. Le seed (18 lignes)
-- a été appliqué plusieurs fois (apply_scripts/batch_01.sql +
-- migration native + fixes/APPLY_ALL_MIGRATIONS.sql) -> chaque
-- requirement présent N fois.
--
-- Conséquence : la RPC get_provider_missing_documents() renvoie N
-- lignes par doc -> page /provider/compliance affiche les documents
-- en triple (RC Pro x3, RIB x3, CNI x3, URSSAF x3).
--
-- Cette migration :
--   1. Déduplique provider_kyc_requirements
--   2. Pose un UNIQUE INDEX (provider_type, document_type)
--   3. Renforce get_provider_missing_documents avec DISTINCT
-- =====================================================================

BEGIN;

-- 1. Déduplication : on garde la ligne d'id le plus petit pour chaque
--    couple (provider_type, document_type)
DELETE FROM provider_kyc_requirements a
USING provider_kyc_requirements b
WHERE a.id > b.id
  AND a.provider_type = b.provider_type
  AND a.document_type = b.document_type;

-- 2. Empêche définitivement la réapparition de doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_requirements_unique
  ON provider_kyc_requirements(provider_type, document_type);

-- 3. Hardening défensif de la RPC : DISTINCT au cas où des doublons
--    réapparaitraient via un autre chemin (seed adhoc, restore partiel)
CREATE OR REPLACE FUNCTION get_provider_missing_documents(p_provider_profile_id UUID)
RETURNS TABLE (
  document_type TEXT,
  description TEXT,
  help_text TEXT,
  is_required BOOLEAN,
  has_expiration BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider_type TEXT;
BEGIN
  SELECT COALESCE(provider_type, 'independant') INTO v_provider_type
  FROM provider_profiles
  WHERE profile_id = p_provider_profile_id;

  RETURN QUERY
  SELECT DISTINCT
    pkr.document_type,
    pkr.description,
    pkr.help_text,
    pkr.is_required,
    pkr.has_expiration
  FROM provider_kyc_requirements pkr
  WHERE pkr.provider_type = v_provider_type
  AND NOT EXISTS (
    SELECT 1 FROM provider_compliance_documents pcd
    WHERE pcd.provider_profile_id = p_provider_profile_id
    AND pcd.document_type = pkr.document_type
    AND pcd.verification_status IN ('pending', 'verified')
    AND (pcd.expiration_date IS NULL OR pcd.expiration_date > CURRENT_DATE)
  );
END;
$$;

COMMENT ON INDEX idx_kyc_requirements_unique IS
  'Empeche les doublons (provider_type, document_type) - fix bug compliance triple affichage';

COMMIT;

-- =====================================================================
-- VÉRIFICATIONS POST-MIGRATION (à exécuter manuellement)
-- =====================================================================
-- Vérifier la déduplication :
--   SELECT provider_type, document_type, COUNT(*)
--   FROM provider_kyc_requirements
--   GROUP BY 1,2
--   HAVING COUNT(*) > 1;
--   -> doit retourner 0 ligne
--
-- Vérifier la RPC :
--   SELECT COUNT(*) FROM get_provider_missing_documents('<profile_id>');
--   -> doit etre <= 7 (nb max docs requis pour BTP)
-- =====================================================================
