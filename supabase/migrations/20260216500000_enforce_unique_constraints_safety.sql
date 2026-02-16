-- Migration: Enforce unique constraints safety net
-- Date: 2026-02-16
-- Description: S'assure que les contraintes uniques critiques sont bien appliquées.
--              Idempotent : ne fait rien si elles existent déjà.
--              Nettoie les doublons existants avant de créer les contraintes.

BEGIN;

-- =============================================
-- 1. INVOICES: unique (lease_id, periode)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_lease_periode'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_invoices_lease_periode'
  ) THEN
    -- Supprimer les doublons en gardant le plus récent
    DELETE FROM invoices
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY lease_id, periode ORDER BY created_at DESC) AS rn
        FROM invoices
        WHERE lease_id IS NOT NULL AND periode IS NOT NULL
      ) sub
      WHERE sub.rn > 1
    );

    ALTER TABLE invoices
      ADD CONSTRAINT uq_invoices_lease_periode
      UNIQUE (lease_id, periode);

    RAISE NOTICE 'Created constraint uq_invoices_lease_periode on invoices';
  ELSE
    RAISE NOTICE 'Constraint uq_invoices_lease_periode already exists, skipping';
  END IF;
END $$;

-- =============================================
-- 2. LEASE_SIGNERS: unique (lease_id, profile_id) WHERE profile_id IS NOT NULL
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_lease_signers_lease_profile'
  ) THEN
    -- Supprimer les doublons en gardant celui qui a été signé (ou le plus récent)
    DELETE FROM lease_signers
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY lease_id, profile_id
                 ORDER BY
                   CASE WHEN signature_status = 'signed' THEN 0 ELSE 1 END,
                   created_at DESC
               ) AS rn
        FROM lease_signers
        WHERE profile_id IS NOT NULL
      ) sub
      WHERE sub.rn > 1
    );

    CREATE UNIQUE INDEX uq_lease_signers_lease_profile
      ON lease_signers (lease_id, profile_id)
      WHERE profile_id IS NOT NULL;

    RAISE NOTICE 'Created index uq_lease_signers_lease_profile on lease_signers';
  ELSE
    RAISE NOTICE 'Index uq_lease_signers_lease_profile already exists, skipping';
  END IF;
END $$;

-- =============================================
-- 3. ROOMMATES: unique (lease_id, profile_id)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_roommates_lease_profile'
  ) THEN
    -- Vérifier si la table roommates existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roommates') THEN
      -- Supprimer les doublons
      DELETE FROM roommates
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY lease_id, profile_id ORDER BY created_at DESC) AS rn
          FROM roommates
          WHERE lease_id IS NOT NULL AND profile_id IS NOT NULL
        ) sub
        WHERE sub.rn > 1
      );

      CREATE UNIQUE INDEX uq_roommates_lease_profile
        ON roommates (lease_id, profile_id);

      RAISE NOTICE 'Created index uq_roommates_lease_profile on roommates';
    ELSE
      RAISE NOTICE 'Table roommates does not exist, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Index uq_roommates_lease_profile already exists, skipping';
  END IF;
END $$;

-- =============================================
-- 4. DOCUMENTS: Empêcher les doublons de fichiers (même storage_path)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_documents_storage_path'
  ) THEN
    -- Supprimer les doublons en gardant le plus récent
    DELETE FROM documents
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY storage_path ORDER BY created_at DESC) AS rn
        FROM documents
        WHERE storage_path IS NOT NULL
      ) sub
      WHERE sub.rn > 1
    );

    CREATE UNIQUE INDEX uq_documents_storage_path
      ON documents (storage_path)
      WHERE storage_path IS NOT NULL;

    RAISE NOTICE 'Created index uq_documents_storage_path on documents';
  ELSE
    RAISE NOTICE 'Index uq_documents_storage_path already exists, skipping';
  END IF;
END $$;

COMMIT;
