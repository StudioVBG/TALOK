-- ============================================================================
-- MIGRATION: Correction des écarts entre services et schéma DB
-- Date: 2026-01-10
-- Description: Aligne le schéma avec les attentes des services comptables
-- ============================================================================

-- ============================================================================
-- 1. TABLE charges - Ajouter colonnes manquantes
-- ============================================================================

-- Ajouter libelle si non existant
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS libelle TEXT;

-- Ajouter quote_part (pourcentage récupérable sur le locataire)
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS quote_part DECIMAL(5, 2) DEFAULT 100.00
  CHECK (quote_part >= 0 AND quote_part <= 100);

-- Ajouter date_debut pour prorata
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS date_debut DATE;

-- Ajouter date_fin pour prorata
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS date_fin DATE;

-- Commenter les colonnes
COMMENT ON COLUMN public.charges.libelle IS 'Libellé descriptif de la charge (ex: "Eau froide et chaude")';
COMMENT ON COLUMN public.charges.quote_part IS 'Pourcentage récupérable sur le locataire (0-100)';
COMMENT ON COLUMN public.charges.date_debut IS 'Date de début d''application de la charge';
COMMENT ON COLUMN public.charges.date_fin IS 'Date de fin d''application de la charge (null = en cours)';

-- ============================================================================
-- 2. TABLE leases - Ajouter tenant_id direct
-- ============================================================================

-- Ajouter tenant_id direct pour simplifier les requêtes
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON public.leases(tenant_id);

-- Commenter la colonne
COMMENT ON COLUMN public.leases.tenant_id IS 'ID du locataire principal (dénormalisé depuis lease_signers)';

-- ============================================================================
-- 3. Backfill tenant_id depuis lease_signers
-- ============================================================================

-- Peupler tenant_id depuis lease_signers (locataire_principal seulement)
UPDATE public.leases l
SET tenant_id = (
  SELECT ls.profile_id
  FROM public.lease_signers ls
  WHERE ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'locataire')
  ORDER BY ls.created_at ASC
  LIMIT 1
)
WHERE l.tenant_id IS NULL;

-- ============================================================================
-- 4. TABLE charge_regularisations - Corriger noms colonnes
-- ============================================================================

-- La table existe déjà avec des noms français, ajouter des alias anglais
-- pour compatibilité avec le service

-- Ajouter colonnes avec noms anglais si pas existants
DO $$
BEGIN
  -- Vérifier si les colonnes anglaises existent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'year'
  ) THEN
    -- Renommer ou ajouter les colonnes
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS year INTEGER;

    -- Copier les données
    UPDATE public.charge_regularisations SET year = annee WHERE year IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'period_start'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS period_start DATE;
    UPDATE public.charge_regularisations SET period_start = date_debut WHERE period_start IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'period_end'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS period_end DATE;
    UPDATE public.charge_regularisations SET period_end = date_fin WHERE period_end IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'provisions_received'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS provisions_received DECIMAL(15, 2) DEFAULT 0;
    UPDATE public.charge_regularisations SET provisions_received = provisions_versees WHERE provisions_received IS NULL OR provisions_received = 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'actual_charges'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS actual_charges DECIMAL(15, 2) DEFAULT 0;
    UPDATE public.charge_regularisations SET actual_charges = charges_reelles WHERE actual_charges IS NULL OR actual_charges = 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'balance'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS balance DECIMAL(15, 2) DEFAULT 0;
    UPDATE public.charge_regularisations SET balance = solde WHERE balance IS NULL OR balance = 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
    UPDATE public.charge_regularisations SET status = statut WHERE status IS NULL OR status = 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'details'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';
    UPDATE public.charge_regularisations SET details = detail_charges WHERE details = '{}' OR details IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'applied_at'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'charge_regularisations' AND column_name = 'credit_note_id'
  ) THEN
    ALTER TABLE public.charge_regularisations
      ADD COLUMN IF NOT EXISTS credit_note_id UUID REFERENCES public.invoices(id);
  END IF;
END $$;

-- Ajouter property_id si manquant
ALTER TABLE public.charge_regularisations
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id);

-- Backfill property_id depuis leases
UPDATE public.charge_regularisations cr
SET property_id = (
  SELECT COALESCE(l.property_id, u.property_id)
  FROM public.leases l
  LEFT JOIN public.units u ON l.unit_id = u.id
  WHERE l.id = cr.lease_id
)
WHERE cr.property_id IS NULL;

-- ============================================================================
-- 5. TABLE invoices - Ajouter champ type et metadata
-- ============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS type VARCHAR(30) DEFAULT 'loyer';

-- Commenter
COMMENT ON COLUMN public.invoices.metadata IS 'Métadonnées additionnelles (type régularisation, etc.)';
COMMENT ON COLUMN public.invoices.type IS 'Type de facture: loyer, regularisation_charges, avoir_regularisation, depot_garantie';

-- ============================================================================
-- 6. TRIGGER: Synchroniser tenant_id depuis lease_signers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_lease_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand un signataire locataire est ajouté, mettre à jour tenant_id du bail
  IF NEW.role IN ('locataire_principal', 'locataire') THEN
    UPDATE public.leases
    SET tenant_id = NEW.profile_id
    WHERE id = NEW.lease_id
      AND tenant_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS trigger_sync_lease_tenant_id ON public.lease_signers;

-- Créer le trigger
CREATE TRIGGER trigger_sync_lease_tenant_id
  AFTER INSERT ON public.lease_signers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lease_tenant_id();

-- ============================================================================
-- 7. TRIGGER: Écritures comptables automatiques sur paiement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_record_payment_entries()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice RECORD;
  v_lease RECORD;
  v_owner_id UUID;
  v_tenant_id UUID;
  v_property_id UUID;
  v_code_postal TEXT;
  v_taux_tva DECIMAL;
  v_honoraires_ht DECIMAL;
  v_tva_montant DECIMAL;
  v_honoraires_ttc DECIMAL;
  v_net_proprietaire DECIMAL;
BEGIN
  -- Ne traiter que les paiements confirmés
  IF NEW.statut != 'succeeded' THEN
    RETURN NEW;
  END IF;

  -- Récupérer les infos de la facture
  SELECT * INTO v_invoice FROM public.invoices WHERE id = NEW.invoice_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Récupérer le bail
  SELECT
    l.*,
    COALESCE(p.id, (SELECT property_id FROM units WHERE id = l.unit_id)) as prop_id,
    COALESCE(p.code_postal, '75000') as code_postal,
    p.owner_id as owner_id
  INTO v_lease
  FROM public.leases l
  LEFT JOIN public.properties p ON l.property_id = p.id
  LEFT JOIN public.units u ON l.unit_id = u.id
  LEFT JOIN public.properties p2 ON u.property_id = p2.id
  WHERE l.id = v_invoice.lease_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_owner_id := v_invoice.owner_id;
  v_tenant_id := v_invoice.tenant_id;
  v_property_id := v_lease.prop_id;
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

  -- Calculer honoraires (7% HT du loyer)
  v_honoraires_ht := ROUND((v_invoice.montant_loyer * 0.07)::NUMERIC, 2);
  v_tva_montant := ROUND((v_honoraires_ht * v_taux_tva)::NUMERIC, 2);
  v_honoraires_ttc := v_honoraires_ht + v_tva_montant;
  v_net_proprietaire := v_invoice.montant_loyer - v_honoraires_ttc;

  -- 1. Écriture: Encaissement locataire → Banque mandant
  PERFORM public.record_accounting_entry(
    'BM', '545000', 'Banque compte mandant',
    COALESCE(NEW.provider_ref, 'PAY-' || NEW.id::TEXT),
    'Encaissement loyer ' || v_invoice.periode,
    NEW.montant, 0,
    v_owner_id, v_property_id, v_invoice.id, NEW.id
  );

  -- 2. Écriture: Crédit compte locataire
  PERFORM public.record_accounting_entry(
    'BM', '467200', 'Locataires - Comptes mandants',
    COALESCE(NEW.provider_ref, 'PAY-' || NEW.id::TEXT),
    'Paiement locataire ' || v_invoice.periode,
    0, NEW.montant,
    v_owner_id, v_property_id, v_invoice.id, NEW.id
  );

  -- 3. Écriture: Honoraires de gestion HT
  PERFORM public.record_accounting_entry(
    'VE', '706100', 'Honoraires de gestion locative',
    'HON-' || v_invoice.periode,
    'Honoraires gestion ' || v_invoice.periode,
    0, v_honoraires_ht,
    v_owner_id, v_property_id, v_invoice.id, NEW.id
  );

  -- 4. Écriture: TVA collectée
  IF v_tva_montant > 0 THEN
    PERFORM public.record_accounting_entry(
      'VE', '445710', 'TVA collectée',
      'HON-' || v_invoice.periode,
      'TVA sur honoraires ' || v_invoice.periode,
      0, v_tva_montant,
      v_owner_id, v_property_id, v_invoice.id, NEW.id
    );
  END IF;

  -- 5. Écriture: Crédit compte propriétaire (net)
  PERFORM public.record_accounting_entry(
    'BM', '467100', 'Propriétaires - Comptes mandants',
    'CRG-' || v_invoice.periode,
    'Net propriétaire ' || v_invoice.periode,
    0, v_net_proprietaire,
    v_owner_id, v_property_id, v_invoice.id, NEW.id
  );

  -- 6. Mettre à jour le solde mandant propriétaire
  PERFORM public.update_mandant_balance(
    v_owner_id, v_property_id, 'proprietaire',
    0, v_net_proprietaire
  );

  -- 7. Mettre à jour le solde mandant locataire
  PERFORM public.update_mandant_balance(
    v_tenant_id, v_property_id, 'locataire',
    0, NEW.montant
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS trigger_auto_payment_entries ON public.payments;

-- Créer le trigger
CREATE TRIGGER trigger_auto_payment_entries
  AFTER INSERT OR UPDATE OF statut ON public.payments
  FOR EACH ROW
  WHEN (NEW.statut = 'succeeded')
  EXECUTE FUNCTION public.auto_record_payment_entries();

-- ============================================================================
-- 8. Contraintes et validations
-- ============================================================================

-- Contrainte pour status charge_regularisations
DO $$
BEGIN
  ALTER TABLE public.charge_regularisations
    DROP CONSTRAINT IF EXISTS charge_regularisations_status_check;

  ALTER TABLE public.charge_regularisations
    ADD CONSTRAINT charge_regularisations_status_check
    CHECK (status IS NULL OR status IN ('draft', 'sent', 'applied', 'paid', 'disputed', 'cancelled'));
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignorer si contrainte existe déjà
END $$;

-- ============================================================================
-- 9. Index supplémentaires pour performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_charges_quote_part ON public.charges(quote_part);
CREATE INDEX IF NOT EXISTS idx_charges_date_debut ON public.charges(date_debut);
CREATE INDEX IF NOT EXISTS idx_charge_regularisations_year ON public.charge_regularisations(year);
CREATE INDEX IF NOT EXISTS idx_charge_regularisations_status ON public.charge_regularisations(status);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(type);

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================
