-- =============================================================================
-- Vérification en base : liaison locataire Thomas VOLBERG
-- À exécuter dans Supabase → SQL Editor (Dashboard Supabase).
-- Modifier l'email ci-dessous si besoin (ex: volberg.thomas@hotmail.fr).
-- =============================================================================

-- Adapter cet email au compte à vérifier
DO $$
BEGIN
  RAISE NOTICE 'Vérification pour email contenant: volberg';
END $$;

-- -----------------------------------------------------------------------------
-- 1. auth.users + profiles (compte Thomas)
-- -----------------------------------------------------------------------------
SELECT
  u.id AS user_id,
  u.email,
  p.id AS profile_id,
  p.role,
  p.prenom,
  p.nom
FROM auth.users u
JOIN profiles p ON p.user_id = u.id
WHERE LOWER(u.email) LIKE '%volberg%';

-- -----------------------------------------------------------------------------
-- 2. lease_signers où invited_email = Thomas (avec ou sans profile_id)
-- -----------------------------------------------------------------------------
SELECT
  ls.id AS signer_id,
  ls.lease_id,
  ls.invited_email,
  ls.invited_name,
  ls.profile_id,
  ls.role,
  ls.signature_status,
  CASE WHEN ls.profile_id IS NULL THEN '❌ RUPTURE (profile_id NULL)' ELSE '✅ Lié' END AS status
FROM lease_signers ls
WHERE LOWER(ls.invited_email) LIKE '%volberg%'
ORDER BY ls.lease_id;

-- -----------------------------------------------------------------------------
-- 3. Baux concernés + adresse (63 rue Victor Schoelcher etc.)
-- -----------------------------------------------------------------------------
SELECT
  l.id AS lease_id,
  l.statut AS statut_bail,
  l.loyer,
  l.date_debut,
  pr.adresse_complete,
  pr.code_postal,
  pr.ville
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
JOIN properties pr ON pr.id = l.property_id
WHERE LOWER(ls.invited_email) LIKE '%volberg%';

-- -----------------------------------------------------------------------------
-- 4. Factures pour ces baux : tenant_id renseigné ?
-- -----------------------------------------------------------------------------
SELECT
  i.id AS invoice_id,
  i.lease_id,
  i.periode,
  i.montant_total,
  i.tenant_id,
  CASE WHEN i.tenant_id IS NULL THEN '⚠️ NULL' ELSE '✅' END AS status
FROM invoices i
WHERE i.lease_id IN (
  SELECT lease_id FROM lease_signers WHERE LOWER(invited_email) LIKE '%volberg%'
)
ORDER BY i.periode DESC
LIMIT 15;

-- -----------------------------------------------------------------------------
-- 5. Synthèse : nombre de signers orphelins (profile_id NULL)
-- -----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM lease_signers WHERE LOWER(invited_email) LIKE '%volberg%') AS total_signers,
  (SELECT COUNT(*) FROM lease_signers WHERE LOWER(invited_email) LIKE '%volberg%' AND profile_id IS NULL) AS signers_orphelins;
