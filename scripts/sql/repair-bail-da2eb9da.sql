-- ============================================
-- REPAIR — Bail da2eb9da : génération facture initiale
-- Date : 2026-03-24
--
-- IMPORTANT : Exécuter diagnostic-bail-da2eb9da.sql d'abord !
-- Ce script appelle generate_initial_signing_invoice() pour
-- créer la facture manquante.
-- ============================================

-- Vérification préalable : pas de facture initiale existante
DO $$
DECLARE
  v_invoice_exists BOOLEAN;
  v_lease_statut TEXT;
  v_tenant_id UUID;
  v_owner_id UUID;
BEGIN
  -- Vérifier le statut du bail
  SELECT statut INTO v_lease_statut
  FROM leases WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7';

  IF v_lease_statut IS NULL THEN
    RAISE EXCEPTION 'Bail da2eb9da introuvable';
  END IF;

  RAISE NOTICE 'Bail da2eb9da — statut actuel : %', v_lease_statut;

  -- Vérifier qu'aucune facture initiale n'existe
  SELECT EXISTS(
    SELECT 1 FROM invoices
    WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
    AND (metadata->>'type' = 'initial_invoice' OR type = 'initial_invoice')
  ) INTO v_invoice_exists;

  IF v_invoice_exists THEN
    RAISE EXCEPTION 'Une facture initiale existe déjà pour ce bail — aucune action nécessaire';
  END IF;

  -- Résoudre le locataire
  SELECT ls.profile_id INTO v_tenant_id
  FROM lease_signers ls
  WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
  AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
  AND ls.profile_id IS NOT NULL
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Aucun locataire trouvé pour ce bail (lease_signers vide ou profile_id NULL)';
  END IF;

  -- Résoudre le propriétaire
  SELECT p.owner_id INTO v_owner_id
  FROM properties p
  WHERE p.id = (SELECT property_id FROM leases WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7');

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Aucun propriétaire trouvé pour le bien lié au bail';
  END IF;

  RAISE NOTICE 'Tenant ID : %, Owner ID : %', v_tenant_id, v_owner_id;

  -- Générer la facture initiale
  PERFORM generate_initial_signing_invoice(
    'da2eb9da-1ff1-4020-8682-5f993aa6fde7',
    v_tenant_id,
    v_owner_id
  );

  RAISE NOTICE 'Facture initiale générée avec succès';
END $$;

-- Vérification : afficher la facture créée
SELECT id, type, statut, montant_loyer, montant_charges, montant_total,
       date_echeance, periode, invoice_number, metadata, notes, created_at
FROM invoices
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
AND (metadata->>'type' = 'initial_invoice' OR type = 'initial_invoice');
