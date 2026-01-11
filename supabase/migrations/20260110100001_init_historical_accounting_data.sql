-- ============================================================================
-- MIGRATION: Initialisation des données comptables historiques
-- Date: 2026-01-10
-- Description: Initialise deposit_operations et accounting_entries pour les
--              baux et paiements existants
-- ============================================================================

-- ============================================================================
-- 1. Initialiser deposit_operations pour les baux avec dépôt de garantie
-- ============================================================================

INSERT INTO public.deposit_operations (
  lease_id,
  property_id,
  tenant_id,
  owner_id,
  operation_type,
  montant,
  date_operation,
  statut,
  notes
)
SELECT
  l.id as lease_id,
  COALESCE(l.property_id, u.property_id) as property_id,
  l.tenant_id,
  p.owner_id,
  'reception' as operation_type,
  l.depot_de_garantie as montant,
  l.date_debut as date_operation,
  'completed' as statut,
  'Migration automatique - Dépôt de garantie initial' as notes
FROM public.leases l
LEFT JOIN public.units u ON l.unit_id = u.id
LEFT JOIN public.properties p ON COALESCE(l.property_id, u.property_id) = p.id
WHERE l.depot_de_garantie > 0
  AND l.tenant_id IS NOT NULL
  AND l.statut IN ('active', 'terminated')
  AND NOT EXISTS (
    SELECT 1 FROM public.deposit_operations do
    WHERE do.lease_id = l.id AND do.operation_type = 'reception'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. Créer les écritures comptables pour les paiements existants
-- ============================================================================

-- Fonction temporaire pour migrer les paiements
CREATE OR REPLACE FUNCTION public.migrate_historical_payments()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_payment RECORD;
  v_invoice RECORD;
  v_lease RECORD;
  v_property_id UUID;
  v_owner_id UUID;
  v_code_postal TEXT;
  v_taux_tva DECIMAL;
  v_honoraires_ht DECIMAL;
  v_tva_montant DECIMAL;
  v_net_proprietaire DECIMAL;
BEGIN
  -- Parcourir tous les paiements succeeded sans écritures comptables
  FOR v_payment IN
    SELECT pay.*
    FROM public.payments pay
    WHERE pay.statut = 'succeeded'
      AND NOT EXISTS (
        SELECT 1 FROM public.accounting_entries ae
        WHERE ae.payment_id = pay.id
      )
  LOOP
    BEGIN
      -- Récupérer la facture
      SELECT * INTO v_invoice FROM public.invoices WHERE id = v_payment.invoice_id;
      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      -- Récupérer le bail et propriété
      SELECT
        l.*,
        COALESCE(l.property_id, u.property_id) as prop_id,
        COALESCE(p.code_postal, '75000') as code_postal,
        p.owner_id
      INTO v_lease
      FROM public.leases l
      LEFT JOIN public.units u ON l.unit_id = u.id
      LEFT JOIN public.properties p ON COALESCE(l.property_id, u.property_id) = p.id
      WHERE l.id = v_invoice.lease_id;

      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      v_property_id := v_lease.prop_id;
      v_owner_id := v_invoice.owner_id;
      v_code_postal := v_lease.code_postal;

      -- Calculer TVA selon code postal
      v_taux_tva := CASE
        WHEN v_code_postal LIKE '97%' THEN
          CASE
            WHEN v_code_postal LIKE '973%' OR v_code_postal LIKE '976%' THEN 0.00
            ELSE 0.085
          END
        ELSE 0.20
      END;

      -- Calculer honoraires
      v_honoraires_ht := ROUND((v_invoice.montant_loyer * 0.07)::NUMERIC, 2);
      v_tva_montant := ROUND((v_honoraires_ht * v_taux_tva)::NUMERIC, 2);
      v_net_proprietaire := v_invoice.montant_loyer - v_honoraires_ht - v_tva_montant;

      -- Créer les écritures comptables
      -- 1. Encaissement banque mandant
      PERFORM public.record_accounting_entry(
        'BM', '545000', 'Banque compte mandant',
        'MIG-' || v_payment.id::TEXT,
        'Migration - Encaissement ' || v_invoice.periode,
        v_payment.montant, 0,
        v_owner_id, v_property_id, v_invoice.id, v_payment.id
      );

      -- 2. Crédit compte locataire
      PERFORM public.record_accounting_entry(
        'BM', '467200', 'Locataires - Comptes mandants',
        'MIG-' || v_payment.id::TEXT,
        'Migration - Paiement ' || v_invoice.periode,
        0, v_payment.montant,
        v_owner_id, v_property_id, v_invoice.id, v_payment.id
      );

      -- 3. Honoraires HT
      PERFORM public.record_accounting_entry(
        'VE', '706100', 'Honoraires de gestion locative',
        'MIG-HON-' || v_invoice.periode,
        'Migration - Honoraires ' || v_invoice.periode,
        0, v_honoraires_ht,
        v_owner_id, v_property_id, v_invoice.id, v_payment.id
      );

      -- 4. TVA si applicable
      IF v_tva_montant > 0 THEN
        PERFORM public.record_accounting_entry(
          'VE', '445710', 'TVA collectée',
          'MIG-HON-' || v_invoice.periode,
          'Migration - TVA honoraires ' || v_invoice.periode,
          0, v_tva_montant,
          v_owner_id, v_property_id, v_invoice.id, v_payment.id
        );
      END IF;

      -- 5. Net propriétaire
      PERFORM public.record_accounting_entry(
        'BM', '467100', 'Propriétaires - Comptes mandants',
        'MIG-CRG-' || v_invoice.periode,
        'Migration - Net propriétaire ' || v_invoice.periode,
        0, v_net_proprietaire,
        v_owner_id, v_property_id, v_invoice.id, v_payment.id
      );

      -- Mettre à jour les soldes mandants
      PERFORM public.update_mandant_balance(
        v_owner_id, v_property_id, 'proprietaire',
        0, v_net_proprietaire
      );

      IF v_invoice.tenant_id IS NOT NULL THEN
        PERFORM public.update_mandant_balance(
          v_invoice.tenant_id, v_property_id, 'locataire',
          0, v_payment.montant
        );
      END IF;

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Log et continuer en cas d'erreur
      RAISE NOTICE 'Erreur migration paiement %: %', v_payment.id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Exécuter la migration des paiements
DO $$
DECLARE
  v_migrated INTEGER;
BEGIN
  SELECT public.migrate_historical_payments() INTO v_migrated;
  RAISE NOTICE 'Paiements migrés: %', v_migrated;
END $$;

-- Supprimer la fonction temporaire
DROP FUNCTION IF EXISTS public.migrate_historical_payments();

-- ============================================================================
-- 3. Créer les écritures pour les dépôts de garantie
-- ============================================================================

-- Fonction temporaire pour migrer les dépôts
CREATE OR REPLACE FUNCTION public.migrate_historical_deposits()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_deposit RECORD;
BEGIN
  FOR v_deposit IN
    SELECT do.*
    FROM public.deposit_operations do
    WHERE do.operation_type = 'reception'
      AND do.statut = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM public.accounting_entries ae
        WHERE ae.piece_ref LIKE 'DEP-' || do.id::TEXT || '%'
      )
  LOOP
    BEGIN
      -- 1. Encaissement banque mandant
      PERFORM public.record_accounting_entry(
        'BM', '545000', 'Banque compte mandant',
        'DEP-' || v_deposit.id::TEXT,
        'Dépôt de garantie - Encaissement',
        v_deposit.montant, 0,
        v_deposit.owner_id, v_deposit.property_id, NULL, NULL
      );

      -- 2. Crédit compte dépôts de garantie
      PERFORM public.record_accounting_entry(
        'BM', '467300', 'Dépôts de garantie reçus',
        'DEP-' || v_deposit.id::TEXT,
        'Dépôt de garantie - Réception',
        0, v_deposit.montant,
        v_deposit.owner_id, v_deposit.property_id, NULL, NULL
      );

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erreur migration dépôt %: %', v_deposit.id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Exécuter la migration des dépôts
DO $$
DECLARE
  v_migrated INTEGER;
BEGIN
  SELECT public.migrate_historical_deposits() INTO v_migrated;
  RAISE NOTICE 'Dépôts migrés: %', v_migrated;
END $$;

-- Supprimer la fonction temporaire
DROP FUNCTION IF EXISTS public.migrate_historical_deposits();

-- ============================================================================
-- 4. Trigger pour nouveaux dépôts de garantie
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_record_deposit_entries()
RETURNS TRIGGER AS $$
BEGIN
  -- Ne traiter que les opérations complétées
  IF NEW.statut != 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.operation_type = 'reception' THEN
    -- Encaissement
    PERFORM public.record_accounting_entry(
      'BM', '545000', 'Banque compte mandant',
      'DEP-' || NEW.id::TEXT,
      'Dépôt de garantie - Encaissement',
      NEW.montant, 0,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );
    PERFORM public.record_accounting_entry(
      'BM', '467300', 'Dépôts de garantie reçus',
      'DEP-' || NEW.id::TEXT,
      'Dépôt de garantie - Réception',
      0, NEW.montant,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );

  ELSIF NEW.operation_type = 'restitution' THEN
    -- Restitution
    PERFORM public.record_accounting_entry(
      'BM', '467300', 'Dépôts de garantie reçus',
      'DEP-REST-' || NEW.id::TEXT,
      'Dépôt de garantie - Restitution',
      NEW.montant, 0,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );
    PERFORM public.record_accounting_entry(
      'BM', '545000', 'Banque compte mandant',
      'DEP-REST-' || NEW.id::TEXT,
      'Dépôt de garantie - Virement restitution',
      0, NEW.montant,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );

  ELSIF NEW.operation_type = 'retenue' THEN
    -- Retenue (transfert vers produits)
    PERFORM public.record_accounting_entry(
      'BM', '467300', 'Dépôts de garantie reçus',
      'DEP-RET-' || NEW.id::TEXT,
      'Dépôt de garantie - Retenue: ' || COALESCE(NEW.motif_retenue, 'Dégradations'),
      NEW.montant, 0,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );
    PERFORM public.record_accounting_entry(
      'OD', '467100', 'Propriétaires - Comptes mandants',
      'DEP-RET-' || NEW.id::TEXT,
      'Indemnisation propriétaire - Retenue dépôt',
      0, NEW.montant,
      NEW.owner_id, NEW.property_id, NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS trigger_auto_deposit_entries ON public.deposit_operations;

-- Créer le trigger
CREATE TRIGGER trigger_auto_deposit_entries
  AFTER INSERT OR UPDATE OF statut ON public.deposit_operations
  FOR EACH ROW
  WHEN (NEW.statut = 'completed')
  EXECUTE FUNCTION public.auto_record_deposit_entries();

-- ============================================================================
-- 5. Vérification de la migration
-- ============================================================================

DO $$
DECLARE
  v_deposits_count INTEGER;
  v_entries_count INTEGER;
  v_mandant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_deposits_count FROM public.deposit_operations;
  SELECT COUNT(*) INTO v_entries_count FROM public.accounting_entries;
  SELECT COUNT(*) INTO v_mandant_count FROM public.mandant_accounts;

  RAISE NOTICE '=== Résumé Migration Comptabilité ===';
  RAISE NOTICE 'Opérations sur dépôts: %', v_deposits_count;
  RAISE NOTICE 'Écritures comptables: %', v_entries_count;
  RAISE NOTICE 'Comptes mandants: %', v_mandant_count;
END $$;

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================
