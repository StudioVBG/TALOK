-- ============================================================================
-- MIGRATION: Corrections audit sécurité signatures (2026-02-15)
-- ============================================================================
-- 
-- Fixes appliqués :
-- P1-3: Suppression de la colonne signature_image (base64) de lease_signers
-- P1-6: Harmonisation du requirement CNI (décision: CNI optionnel partout)
-- P0-4: Vérification de la contrainte CHECK sur les statuts de bail
--
-- IMPORTANT: Migration NON-DESTRUCTIVE (soft delete avec renommage)
-- ============================================================================

BEGIN;

-- ============================================================================
-- P1-3: Renommer signature_image → _signature_image_deprecated
-- ============================================================================
-- On ne supprime pas immédiatement pour éviter les erreurs d'application
-- pendant le déploiement. La colonne sera supprimée dans une migration future.

DO $$
BEGIN
  -- Vérifier si la colonne existe avant de la renommer
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_signers' 
    AND column_name = 'signature_image'
    AND table_schema = 'public'
  ) THEN
    -- Renommer plutôt que supprimer (rollback possible)
    ALTER TABLE lease_signers RENAME COLUMN signature_image TO _signature_image_deprecated;
    
    COMMENT ON COLUMN lease_signers._signature_image_deprecated IS 
      'DEPRECATED 2026-02-15: Utiliser signature_image_path (Storage) à la place. '
      'Cette colonne sera supprimée lors de la prochaine migration majeure.';
    
    RAISE NOTICE 'Colonne lease_signers.signature_image renommée en _signature_image_deprecated';
  ELSE
    RAISE NOTICE 'Colonne lease_signers.signature_image déjà absente ou renommée';
  END IF;
END $$;

-- ============================================================================
-- P0-4: S'assurer que les statuts de bail incluent tous ceux utilisés par le code
-- ============================================================================
-- Le code utilise ces statuts : draft, pending_signature, partially_signed,
-- fully_signed, active, terminated, archived, cancelled
-- 
-- Vérifier et mettre à jour la contrainte CHECK si nécessaire

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Trouver le nom de la contrainte CHECK sur statut
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'leases'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%statut%';

  IF v_constraint_name IS NOT NULL THEN
    -- Supprimer l'ancienne contrainte
    EXECUTE 'ALTER TABLE leases DROP CONSTRAINT ' || v_constraint_name;
    RAISE NOTICE 'Ancienne contrainte supprimée: %', v_constraint_name;
  END IF;

  -- Recréer avec tous les statuts valides (SSOT 2026)
  ALTER TABLE leases ADD CONSTRAINT leases_statut_check CHECK (
    statut IN (
      'draft',
      'pending_signature',
      'partially_signed',
      'fully_signed',
      'active',
      'terminated',
      'archived',
      'cancelled'
    )
  );
  
  RAISE NOTICE 'Contrainte CHECK sur leases.statut mise à jour avec tous les statuts SSOT 2026';
END $$;

-- ============================================================================
-- P2-6: Ajouter un champ template_version aux lease_signers pour traçabilité
-- ============================================================================

ALTER TABLE lease_signers 
ADD COLUMN IF NOT EXISTS template_version TEXT;

COMMENT ON COLUMN lease_signers.template_version IS 
  'Version du template de bail utilisée au moment de la signature. '
  'Permet de régénérer le PDF avec le bon template si nécessaire.';

-- ============================================================================
-- Index pour améliorer les performances des requêtes de signature
-- ============================================================================

-- Index partiel pour les signatures en attente (optimise checkSignatureRights)
CREATE INDEX IF NOT EXISTS idx_lease_signers_pending 
ON lease_signers(lease_id, role) 
WHERE signature_status = 'pending';

-- Index partiel pour les signatures complètes (optimise determineLeaseStatus)
CREATE INDEX IF NOT EXISTS idx_lease_signers_signed 
ON lease_signers(lease_id) 
WHERE signature_status = 'signed';

-- Index sur invited_email pour la recherche par email (optimise routes token)
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email 
ON lease_signers(invited_email) 
WHERE invited_email IS NOT NULL;

COMMIT;
