-- ============================================
-- REPAIR — Bail da2eb9da : génération facture initiale
-- Date : 2026-03-24
--
-- IMPORTANT : Exécuter diagnostic-bail-da2eb9da.sql d'abord !
-- La fonction generate_initial_signing_invoice() n'existe pas en prod,
-- ce script fait un INSERT direct avec toutes les gardes nécessaires.
-- ============================================

DO $$
DECLARE
  v_lease RECORD;
  v_tenant_id UUID;
  v_owner_id UUID;
  v_invoice_exists BOOLEAN;
  v_loyer NUMERIC;
  v_charges NUMERIC;
  v_depot NUMERIC;
  v_total NUMERIC;
  v_periode TEXT;
  v_new_id UUID;
BEGIN
  -- 1. Récupérer le bail
  SELECT id, statut, date_debut, loyer, charges_forfaitaires, depot_de_garantie, property_id
  INTO v_lease
  FROM leases WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7';

  IF v_lease.id IS NULL THEN
    RAISE EXCEPTION 'Bail da2eb9da introuvable';
  END IF;

  RAISE NOTICE 'Bail — statut: %, date_debut: %, loyer: %, charges: %, DG: %',
    v_lease.statut, v_lease.date_debut, v_lease.loyer, v_lease.charges_forfaitaires, v_lease.depot_de_garantie;

  -- 2. Vérifier qu'aucune facture n'existe déjà
  SELECT EXISTS(
    SELECT 1 FROM invoices
    WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
  ) INTO v_invoice_exists;

  IF v_invoice_exists THEN
    RAISE EXCEPTION 'Une facture existe déjà pour ce bail — aucune action nécessaire';
  END IF;

  -- 3. Résoudre le locataire
  SELECT ls.profile_id INTO v_tenant_id
  FROM lease_signers ls
  WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
  AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
  AND ls.profile_id IS NOT NULL
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Aucun locataire trouvé (lease_signers vide ou profile_id NULL)';
  END IF;

  -- 4. Résoudre le propriétaire
  SELECT p.owner_id INTO v_owner_id
  FROM properties p
  WHERE p.id = v_lease.property_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Aucun propriétaire trouvé pour le bien';
  END IF;

  RAISE NOTICE 'Tenant: %, Owner: %', v_tenant_id, v_owner_id;

  -- 5. Calculer les montants
  v_loyer := COALESCE(v_lease.loyer, 0);
  v_charges := COALESCE(v_lease.charges_forfaitaires, 0);
  v_depot := COALESCE(v_lease.depot_de_garantie, 0);
  v_total := v_loyer + v_charges + v_depot;
  v_periode := TO_CHAR(v_lease.date_debut, 'YYYY-MM');

  RAISE NOTICE 'Montants — loyer: %, charges: %, DG: %, total: %, période: %',
    v_loyer, v_charges, v_depot, v_total, v_periode;

  -- 6. Insérer la facture initiale
  INSERT INTO invoices (
    lease_id, owner_id, tenant_id,
    periode, montant_loyer, montant_charges, montant_total,
    statut, type, metadata
  ) VALUES (
    'da2eb9da-1ff1-4020-8682-5f993aa6fde7',
    v_owner_id,
    v_tenant_id,
    v_periode,
    v_loyer + v_charges,  -- loyer CC (loyer HC + charges)
    v_depot,              -- dépôt de garantie dans montant_charges
    v_total,              -- total = loyer CC + DG
    'sent',
    'initial_invoice',
    jsonb_build_object(
      'type', 'initial_invoice',
      'loyer_hc', v_loyer,
      'charges_forfaitaires', v_charges,
      'depot_de_garantie', v_depot,
      'generated_by', 'manual_repair_2026-03-24'
    )
  )
  RETURNING id INTO v_new_id;

  RAISE NOTICE 'Facture initiale créée — id: %, montant: % €', v_new_id, v_total;
END $$;

-- Vérification : afficher la facture créée
SELECT id, type, statut, montant_loyer, montant_charges, montant_total,
       periode, metadata, created_at
FROM invoices
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
ORDER BY created_at DESC
LIMIT 1;
