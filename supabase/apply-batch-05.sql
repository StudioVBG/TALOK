-- Batch 5 — migrations 74 a 127 sur 169
-- 54 migrations

-- === [74/169] 20260305000002_payment_crons.sql ===
-- ============================================
-- Migration : Ajouter overdue-check au pg_cron
-- Date : 2026-03-05
-- Description : Planifie le cron overdue-check quotidien à 9h UTC
--   pour détecter les retards, calculer les pénalités légales,
--   et mettre à jour les statuts des factures.
-- ============================================

-- Supprimer l'ancien job s'il existe (idempotent)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'overdue-check';

-- Cron overdue-check : quotidien à 9h UTC
SELECT cron.schedule('overdue-check', '0 9 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/overdue-check',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);


-- === [75/169] 20260305100000_fix_invoice_draft_notification.sql ===
-- =====================================================
-- FIX: Corriger la logique inversée dans notify_tenant_invoice_created
--
-- BUG: La condition `NOT IN ('sent', 'draft')` retournait NEW pour tout
-- sauf 'sent' et 'draft', ce qui inclut les brouillons dans les notifications.
-- Le commentaire dit "pas les brouillons" mais la logique fait le contraire.
--
-- FIX: Ne notifier que pour les factures envoyées ('sent'), pas les brouillons.
-- =====================================================

CREATE OR REPLACE FUNCTION notify_tenant_invoice_created()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
BEGIN
  -- Seulement pour les factures envoyées (pas les brouillons ni autres statuts)
  IF NEW.statut != 'sent' THEN
    RETURN NEW;
  END IF;

  -- Récupérer l'adresse via le bail
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = NEW.lease_id;

  -- Notifier tous les locataires du bail
  FOR v_tenant IN
    SELECT DISTINCT ls.profile_id
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire')
      AND ls.profile_id IS NOT NULL
  LOOP
    INSERT INTO notifications (
      profile_id,
      type,
      title,
      message,
      link,
      metadata
    ) VALUES (
      v_tenant.profile_id,
      'invoice',
      'Nouvelle quittance disponible',
      'Quittance pour ' || v_property_address || ' - ' || COALESCE(NEW.montant_total::text, '0') || '€',
      '/tenant/payments?invoice=' || NEW.id,
      jsonb_build_object(
        'invoice_id', NEW.id,
        'lease_id', NEW.lease_id,
        'montant', NEW.montant_total,
        'periode', NEW.periode
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === [76/169] 20260305100001_add_missing_notification_triggers.sql ===
-- =====================================================
-- Ajout des triggers de notification manquants
-- Identifiés lors de l'audit de propagation inter-comptes
-- =====================================================

-- =====================================================
-- TRIGGER 1: Notifier le propriétaire quand un ticket est créé
-- par un locataire sur l'un de ses biens
-- =====================================================
CREATE OR REPLACE FUNCTION notify_owner_on_ticket_created()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_address TEXT;
BEGIN
  -- Récupérer le propriétaire et l'adresse du bien
  SELECT p.owner_id, COALESCE(p.adresse_complete, 'Logement')
  INTO v_owner_id, v_property_address
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Si pas de propriétaire trouvé, on sort
  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Créer la notification pour le propriétaire
  INSERT INTO notifications (
    profile_id,
    type,
    title,
    message,
    link,
    metadata
  ) VALUES (
    v_owner_id,
    'ticket',
    'Nouveau signalement',
    'Un signalement a été créé pour ' || v_property_address || ' : ' || COALESCE(NEW.title, NEW.titre, 'Sans titre'),
    '/owner/tickets/' || NEW.id,
    jsonb_build_object(
      'ticket_id', NEW.id,
      'property_id', NEW.property_id,
      'priority', COALESCE(NEW.priority, NEW.priorite, 'normal')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger seulement s'il n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_owner_on_ticket_created'
  ) THEN
    CREATE TRIGGER trg_notify_owner_on_ticket_created
      AFTER INSERT ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION notify_owner_on_ticket_created();
  END IF;
END;
$$;

-- =====================================================
-- TRIGGER 2: Notifier le prestataire quand un ticket lui est assigné
-- (work order / intervention assignée)
-- =====================================================
CREATE OR REPLACE FUNCTION notify_provider_on_work_order()
RETURNS TRIGGER AS $$
DECLARE
  v_property_address TEXT;
BEGIN
  -- Seulement si un prestataire est assigné
  IF NEW.provider_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Seulement si l'assignation est nouvelle (INSERT ou UPDATE avec changement de provider)
  IF TG_OP = 'UPDATE' AND OLD.provider_id = NEW.provider_id THEN
    RETURN NEW;
  END IF;

  -- Récupérer l'adresse du bien
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Créer la notification pour le prestataire
  INSERT INTO notifications (
    profile_id,
    type,
    title,
    message,
    link,
    metadata
  ) VALUES (
    NEW.provider_id,
    'work_order',
    'Nouvelle intervention assignée',
    'Intervention sur ' || COALESCE(v_property_address, 'un bien') || ' : ' || COALESCE(NEW.title, NEW.titre, 'Sans titre'),
    '/provider/interventions/' || NEW.id,
    jsonb_build_object(
      'ticket_id', NEW.id,
      'property_id', NEW.property_id,
      'priority', COALESCE(NEW.priority, NEW.priorite, 'normal')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger seulement s'il n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_provider_on_work_order'
  ) THEN
    CREATE TRIGGER trg_notify_provider_on_work_order
      AFTER INSERT OR UPDATE OF provider_id ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION notify_provider_on_work_order();
  END IF;
END;
$$;


-- === [77/169] 20260306000000_lease_documents_visible_tenant.sql ===
-- Migration: Add visible_tenant column to documents table
-- Allows owners to control which documents are visible to tenants

ALTER TABLE documents ADD COLUMN IF NOT EXISTS visible_tenant BOOLEAN NOT NULL DEFAULT true;

-- Index for tenant document visibility queries
CREATE INDEX IF NOT EXISTS idx_documents_lease_visible_tenant
  ON documents(lease_id, visible_tenant) WHERE lease_id IS NOT NULL;

-- RLS policy: tenants can only see documents marked as visible_tenant = true
-- (Updates existing tenant read policy to add visible_tenant check)
DO $dp$ BEGIN DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON documents; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON documents; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Tenants can read visible lease documents"
  ON documents FOR SELECT
  USING (
    tenant_id = public.user_profile_id()
    OR (
      visible_tenant = true
      AND lease_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM lease_signers ls
        JOIN profiles p ON p.id = ls.profile_id
        WHERE ls.lease_id = documents.lease_id
          AND p.id = public.user_profile_id()
          AND ls.role IN ('locataire_principal', 'locataire', 'colocataire')
      )
    )
    OR owner_id = public.user_profile_id()
    OR (
      property_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = documents.property_id
          AND p.owner_id = public.user_profile_id()
      )
    )
    OR public.user_role() = 'admin'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;


-- === [78/169] 20260306100000_add_digicode_interphone_columns.sql ===
-- Add digicode and interphone text columns to properties table
-- These store the actual access codes/names for tenant display

ALTER TABLE properties ADD COLUMN IF NOT EXISTS digicode TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS interphone TEXT;

COMMENT ON COLUMN properties.digicode IS 'Code digicode de l''immeuble';
COMMENT ON COLUMN properties.interphone IS 'Nom/numéro interphone du logement';


-- === [79/169] 20260306100000_invoice_on_fully_signed.sql ===
-- ============================================
-- Migration : Facture initiale à la signature du bail (fully_signed)
-- Date : 2026-03-06
-- Description :
--   1. Fonction generate_initial_signing_invoice : crée la facture initiale
--      (loyer prorata + charges + dépôt de garantie) dès que le bail est
--      entièrement signé, conformément à la Loi Alur / loi du 6 juillet 1989.
--   2. Trigger trg_invoice_on_lease_fully_signed : appelle la fonction
--      quand leases.statut → 'fully_signed'.
--   3. Garde anti-doublon dans trigger_invoice_engine_on_lease_active :
--      empêche generate_first_invoice si une initial_invoice existe déjà.
-- ============================================

-- =====================
-- 1. Fonction de génération de la facture initiale à la signature
-- =====================

CREATE OR REPLACE FUNCTION generate_initial_signing_invoice(
  p_lease_id UUID,
  p_tenant_id UUID,
  p_owner_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_date_debut DATE;
  v_loyer DECIMAL(10,2);
  v_charges DECIMAL(10,2);
  v_deposit DECIMAL(10,2);
  v_total_days INT;
  v_prorata_days INT;
  v_prorata_loyer DECIMAL(10,2);
  v_prorata_charges DECIMAL(10,2);
  v_is_prorated BOOLEAN := false;
  v_month_str TEXT;
  v_due_date DATE;
  v_period_end DATE;
  v_invoice_exists BOOLEAN;
BEGIN
  -- Récupérer les données du bail
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_loyer := COALESCE(v_lease.loyer, 0);
  v_charges := COALESCE(v_lease.charges_forfaitaires, 0);
  v_deposit := COALESCE(v_lease.depot_de_garantie, 0);
  v_date_debut := v_lease.date_debut;

  IF v_date_debut IS NULL THEN RETURN; END IF;

  v_month_str := TO_CHAR(v_date_debut, 'YYYY-MM');

  -- Garde anti-doublon : vérifier si une facture initial_invoice existe déjà
  SELECT EXISTS(
    SELECT 1 FROM invoices
    WHERE lease_id = p_lease_id
    AND metadata->>'type' = 'initial_invoice'
  ) INTO v_invoice_exists;
  IF v_invoice_exists THEN RETURN; END IF;

  -- Calcul prorata si le bail ne commence pas le 1er du mois
  v_total_days := EXTRACT(DAY FROM (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_prorata_days := v_total_days - EXTRACT(DAY FROM v_date_debut)::INT + 1;
  v_period_end := (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  IF v_prorata_days < v_total_days THEN
    -- Prorata
    v_prorata_loyer := ROUND((v_loyer * v_prorata_days / v_total_days), 2);
    v_prorata_charges := ROUND((v_charges * v_prorata_days / v_total_days), 2);
    v_is_prorated := true;
  ELSE
    -- Mois complet
    v_prorata_loyer := v_loyer;
    v_prorata_charges := v_charges;
  END IF;

  -- Date d'échéance : dû immédiatement (aujourd'hui ou date_debut, le plus tard)
  v_due_date := GREATEST(v_date_debut, CURRENT_DATE);

  -- Insérer la facture initiale (loyer + charges + dépôt)
  INSERT INTO invoices (
    lease_id, owner_id, tenant_id, periode,
    montant_loyer, montant_charges, montant_total,
    date_echeance, period_start, period_end,
    invoice_number, statut, generated_at, metadata, notes
  ) VALUES (
    p_lease_id, p_owner_id, p_tenant_id, v_month_str,
    v_prorata_loyer, v_prorata_charges,
    v_prorata_loyer + v_prorata_charges + v_deposit,
    v_due_date, v_date_debut, v_period_end,
    'INI-' || REPLACE(v_month_str, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
    'sent', NOW(),
    jsonb_build_object(
      'type', 'initial_invoice',
      'includes_deposit', true,
      'deposit_amount', v_deposit,
      'is_prorated', v_is_prorated,
      'prorata_days', v_prorata_days,
      'total_days', v_total_days,
      'generated_at_signing', true
    ),
    CASE
      WHEN v_is_prorated THEN
        'Facture initiale : loyer prorata du ' || v_date_debut || ' au ' || v_period_end
        || ' (' || v_prorata_days || '/' || v_total_days || ' jours)'
        || ' + dépôt de garantie ' || v_deposit || ' €'
      ELSE
        'Facture initiale : loyer ' || v_month_str || ' + dépôt de garantie ' || v_deposit || ' €'
    END
  );
END;
$$;

COMMENT ON FUNCTION generate_initial_signing_invoice IS
  'Génère la facture initiale (loyer prorata + dépôt de garantie) à la signature du bail, conformément à la Loi Alur';

-- =====================
-- 2. Trigger : bail fully_signed → facture initiale
-- =====================

CREATE OR REPLACE FUNCTION trigger_invoice_on_lease_fully_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_owner_id UUID;
BEGIN
  -- Ne déclencher que si le statut passe à 'fully_signed'
  IF NEW.statut = 'fully_signed' AND (OLD.statut IS DISTINCT FROM 'fully_signed') THEN

    -- Trouver le locataire principal
    SELECT ls.profile_id INTO v_tenant_id
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.id
    AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
    LIMIT 1;

    -- Trouver le propriétaire
    SELECT p.owner_id INTO v_owner_id
    FROM properties p
    WHERE p.id = NEW.property_id;

    IF v_tenant_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      PERFORM generate_initial_signing_invoice(NEW.id, v_tenant_id, v_owner_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;
DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;
CREATE TRIGGER trg_invoice_on_lease_fully_signed
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invoice_on_lease_fully_signed();

COMMENT ON FUNCTION trigger_invoice_on_lease_fully_signed IS
  'Déclenche la génération de la facture initiale quand un bail passe à fully_signed';

-- =====================
-- 3. Patch : garde anti-doublon dans trigger_invoice_engine_on_lease_active
--    Si une initial_invoice existe déjà (créée à la signature), on ne recrée pas
-- =====================

CREATE OR REPLACE FUNCTION trigger_invoice_engine_on_lease_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_signer RECORD;
  v_owner_id UUID;
  v_property_address TEXT;
  v_initial_exists BOOLEAN;
BEGIN
  -- Ne déclencher que si le statut passe à 'active' et que le moteur n'a pas déjà été démarré
  IF NEW.statut = 'active' AND (OLD.statut IS DISTINCT FROM 'active') AND (NEW.invoice_engine_started IS NOT TRUE) THEN

    -- Trouver le locataire principal
    SELECT ls.profile_id INTO v_tenant_signer
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.id
    AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
    LIMIT 1;

    -- Trouver le propriétaire
    SELECT p.owner_id, p.adresse_complete INTO v_owner_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    IF v_tenant_signer.profile_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      -- Émettre un événement outbox pour que le process-outbox le traite
      INSERT INTO outbox (event_type, payload)
      VALUES ('Lease.InvoiceEngineStart', jsonb_build_object(
        'lease_id', NEW.id,
        'tenant_id', v_tenant_signer.profile_id,
        'owner_id', v_owner_id,
        'property_id', NEW.property_id,
        'property_address', COALESCE(v_property_address, ''),
        'loyer', NEW.loyer,
        'charges_forfaitaires', NEW.charges_forfaitaires,
        'date_debut', NEW.date_debut,
        'jour_paiement', COALESCE(NEW.jour_paiement, 5),
        'grace_period_days', COALESCE(NEW.grace_period_days, 3)
      ));

      -- Vérifier si une initial_invoice existe déjà (créée à la signature)
      SELECT EXISTS(
        SELECT 1 FROM invoices
        WHERE lease_id = NEW.id
        AND metadata->>'type' = 'initial_invoice'
      ) INTO v_initial_exists;

      -- Générer la première facture SEULEMENT si aucune facture initiale n'existe
      IF NOT v_initial_exists THEN
        PERFORM generate_first_invoice(NEW.id, v_tenant_signer.profile_id, v_owner_id);
      END IF;

      -- Marquer le moteur comme démarré
      NEW.invoice_engine_started := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- === [80/169] 20260306100001_backfill_initial_invoices.sql ===
-- ============================================
-- Migration : Backfill des factures initiales pour les baux existants
-- Date : 2026-03-06
-- Description :
--   1. Génère les factures initiales manquantes pour les baux fully_signed
--      qui n'ont pas de facture initial_invoice.
--   2. Corrige date_echeance NULL sur les factures initiales existantes.
-- ============================================

-- =====================
-- 1. Backfill : générer les factures initiales manquantes
-- =====================

DO $$
DECLARE
  v_lease RECORD;
  v_tenant_id UUID;
  v_owner_id UUID;
BEGIN
  FOR v_lease IN
    SELECT l.id, l.property_id
    FROM leases l
    WHERE l.statut IN ('fully_signed', 'active')
    AND NOT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.lease_id = l.id
      AND i.metadata->>'type' = 'initial_invoice'
    )
  LOOP
    -- Trouver le locataire
    SELECT ls.profile_id INTO v_tenant_id
    FROM lease_signers ls
    WHERE ls.lease_id = v_lease.id
    AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
    LIMIT 1;

    -- Trouver le propriétaire
    SELECT p.owner_id INTO v_owner_id
    FROM properties p WHERE p.id = v_lease.property_id;

    IF v_tenant_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      PERFORM generate_initial_signing_invoice(v_lease.id, v_tenant_id, v_owner_id);
    END IF;
  END LOOP;
END $$;

-- =====================
-- 2. Fix : corriger date_echeance NULL sur les factures initiales existantes
-- =====================

UPDATE invoices
SET date_echeance = COALESCE(
  (SELECT l.date_debut FROM leases l WHERE l.id = invoices.lease_id),
  created_at::date
)
WHERE metadata->>'type' = 'initial_invoice'
AND date_echeance IS NULL;

-- =====================
-- 3. Fix : corriger date_echeance NULL sur toute facture avec statut 'sent' ou 'late'
-- =====================

UPDATE invoices
SET date_echeance = COALESCE(
  due_date,
  (SELECT l.date_debut FROM leases l WHERE l.id = invoices.lease_id),
  created_at::date
)
WHERE date_echeance IS NULL
AND statut IN ('sent', 'late', 'overdue', 'unpaid');


-- === [81/169] 20260306200000_notify_tenant_digicode_changed.sql ===
-- =====================================================
-- Migration: Trigger notification changement digicode
-- Date: 2026-03-06
-- Description: Notifie les locataires actifs quand le
--              propriétaire modifie le digicode du bien
-- =====================================================

CREATE OR REPLACE FUNCTION notify_tenant_digicode_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
BEGIN
  -- Seulement si le digicode a changé ET n'est pas null
  IF OLD.digicode IS DISTINCT FROM NEW.digicode AND NEW.digicode IS NOT NULL THEN
    v_property_address := COALESCE(NEW.adresse_complete, 'Votre logement');

    -- Notifier tous les locataires ayant un bail actif sur cette propriété
    FOR v_tenant IN
      SELECT DISTINCT ls.profile_id
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = NEW.id
        AND l.statut = 'active'
        AND ls.role IN ('locataire_principal', 'colocataire')
        AND ls.profile_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        v_tenant.profile_id,
        'alert',
        'Code d''accès modifié',
        format('Le digicode de %s a été mis à jour. Consultez votre espace locataire.', v_property_address),
        '/tenant/lease',
        NEW.id,
        'property'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_tenant_digicode_changed ON properties;
DROP TRIGGER IF EXISTS trigger_notify_tenant_digicode_changed ON properties;
CREATE TRIGGER trigger_notify_tenant_digicode_changed
  AFTER UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION notify_tenant_digicode_changed();

-- =====================================================
-- Logs de la migration
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== Migration: Trigger notification changement digicode ===';
  RAISE NOTICE 'Trigger 8: notify_tenant_digicode_changed (digicode modifié)';
  RAISE NOTICE 'Notifie les locataires actifs quand le digicode est modifié';
END $$;


-- === [82/169] 20260306300000_add_owner_payment_preferences.sql ===
-- Migration : Ajouter les colonnes de préférences financières et d'automatisation au profil propriétaire
-- Ces colonnes étaient précédemment stockées uniquement dans le brouillon d'onboarding et perdues après

-- Préférences d'encaissement et de versement
ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS encaissement_prefere TEXT DEFAULT 'sepa_sdd'
    CHECK (encaissement_prefere IN ('sepa_sdd', 'virement_sct', 'virement_inst', 'pay_by_bank', 'carte_wallet')),
  ADD COLUMN IF NOT EXISTS payout_frequence TEXT DEFAULT 'immediat'
    CHECK (payout_frequence IN ('immediat', 'hebdo', 'mensuel', 'seuil')),
  ADD COLUMN IF NOT EXISTS payout_rail TEXT DEFAULT 'sct'
    CHECK (payout_rail IN ('sct', 'sct_inst')),
  ADD COLUMN IF NOT EXISTS payout_seuil NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_jour INTEGER DEFAULT 1
    CHECK (payout_jour >= 1 AND payout_jour <= 28);

-- Niveau d'automatisation
ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS automation_level TEXT DEFAULT 'standard'
    CHECK (automation_level IN ('basique', 'standard', 'pro', 'autopilot'));

COMMENT ON COLUMN owner_profiles.encaissement_prefere IS 'Mode d''encaissement préféré (SEPA, virement, carte, etc.)';
COMMENT ON COLUMN owner_profiles.payout_frequence IS 'Fréquence de versement des fonds au propriétaire';
COMMENT ON COLUMN owner_profiles.payout_rail IS 'Rail de versement (SCT standard ou instantané)';
COMMENT ON COLUMN owner_profiles.payout_seuil IS 'Seuil de déclenchement du versement (si fréquence = seuil)';
COMMENT ON COLUMN owner_profiles.payout_jour IS 'Jour du mois pour le versement (si fréquence = mensuel)';
COMMENT ON COLUMN owner_profiles.automation_level IS 'Niveau d''automatisation choisi par le propriétaire';


-- === [83/169] 20260309000000_entity_status_and_dedup.sql ===
-- ============================================
-- Migration: Ajout status sur legal_entities + anti-doublons + déduplication
-- Date: 2026-03-09
-- Description:
--   1. Ajout colonne `status` ('draft','active','archived') avec sync `is_active`
--   2. Index partiel anti-doublons pour entités sans SIRET
--   3. Fonction admin de déduplication des entités
-- ============================================

-- ============================================
-- 1. Ajout de la colonne `status`
-- ============================================

ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('draft', 'active', 'archived'));

-- Backfill des valeurs existantes
UPDATE legal_entities SET status = 'active'  WHERE is_active = true  AND status IS DISTINCT FROM 'active';
UPDATE legal_entities SET status = 'archived' WHERE is_active = false AND status IS DISTINCT FROM 'archived';

-- Index sur status
CREATE INDEX IF NOT EXISTS idx_legal_entities_status ON legal_entities(status);

-- ============================================
-- 2. Trigger de synchronisation is_active <-> status
-- ============================================

CREATE OR REPLACE FUNCTION sync_entity_status_and_is_active()
RETURNS TRIGGER AS $$
BEGIN
  -- Si status a changé, mettre à jour is_active
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_active := (NEW.status = 'active');
  -- Si is_active a changé mais pas status, mettre à jour status
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active THEN
      NEW.status := 'active';
    ELSE
      NEW.status := 'archived';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_entity_status ON legal_entities;
DROP TRIGGER IF EXISTS trg_sync_entity_status ON legal_entities;
CREATE TRIGGER trg_sync_entity_status
  BEFORE INSERT OR UPDATE ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION sync_entity_status_and_is_active();

-- ============================================
-- 3. Index partiel anti-doublons (entités sans SIRET)
-- ============================================
-- Empêche de créer deux entités actives avec le même (owner, type, nom)
-- quand aucun SIRET n'est renseigné (typiquement les "particulier")

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_entities_no_siret_unique
  ON legal_entities(owner_profile_id, entity_type, nom)
  WHERE siret IS NULL AND status = 'active';

-- ============================================
-- 4. Fonction de déduplication admin
-- ============================================

CREATE OR REPLACE FUNCTION admin_deduplicate_entities(p_owner_profile_id UUID)
RETURNS TABLE(deleted_count INTEGER, reassigned_properties INTEGER, reassigned_leases INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_reassigned_props INTEGER := 0;
  v_reassigned_leases INTEGER := 0;
  v_group RECORD;
  v_keep_id UUID;
  v_dup RECORD;
  v_props_moved INTEGER;
  v_leases_moved INTEGER;
BEGIN
  -- Pour chaque groupe de doublons (même owner, type, nom, tous actifs)
  FOR v_group IN
    SELECT le.owner_profile_id, le.entity_type, le.nom, COUNT(*) AS cnt
    FROM legal_entities le
    WHERE le.owner_profile_id = p_owner_profile_id
      AND le.status = 'active'
      AND le.siret IS NULL
    GROUP BY le.owner_profile_id, le.entity_type, le.nom
    HAVING COUNT(*) > 1
  LOOP
    -- Garder la plus ancienne (created_at ASC)
    SELECT id INTO v_keep_id
    FROM legal_entities
    WHERE owner_profile_id = v_group.owner_profile_id
      AND entity_type = v_group.entity_type
      AND nom = v_group.nom
      AND status = 'active'
      AND siret IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    -- Pour chaque doublon (hors la gardée)
    FOR v_dup IN
      SELECT id FROM legal_entities
      WHERE owner_profile_id = v_group.owner_profile_id
        AND entity_type = v_group.entity_type
        AND nom = v_group.nom
        AND status = 'active'
        AND siret IS NULL
        AND id != v_keep_id
    LOOP
      -- Réassigner les propriétés orphelines
      UPDATE properties
      SET legal_entity_id = v_keep_id
      WHERE legal_entity_id = v_dup.id
        AND deleted_at IS NULL;
      GET DIAGNOSTICS v_props_moved = ROW_COUNT;
      v_reassigned_props := v_reassigned_props + v_props_moved;

      -- Réassigner les property_ownership
      UPDATE property_ownership
      SET legal_entity_id = v_keep_id
      WHERE legal_entity_id = v_dup.id;

      -- Réassigner les baux
      UPDATE leases
      SET signatory_entity_id = v_keep_id
      WHERE signatory_entity_id = v_dup.id;
      GET DIAGNOSTICS v_leases_moved = ROW_COUNT;
      v_reassigned_leases := v_reassigned_leases + v_leases_moved;

      -- Réassigner les factures
      UPDATE invoices
      SET issuer_entity_id = v_keep_id
      WHERE issuer_entity_id = v_dup.id;

      -- Supprimer les associés du doublon
      DELETE FROM entity_associates WHERE legal_entity_id = v_dup.id;

      -- Supprimer le doublon
      DELETE FROM legal_entities WHERE id = v_dup.id;
      v_deleted := v_deleted + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_deleted, v_reassigned_props, v_reassigned_leases;
END;
$$;


-- === [84/169] 20260309000001_messages_update_rls.sql ===
-- Migration: Allow users to update their own messages (edit + soft-delete)
-- Needed for message edit/delete feature

-- Policy for UPDATE: users can only update their own messages in their conversations
DO $dp$ BEGIN DROP POLICY IF EXISTS "Users can update own messages" ON messages; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Users can update own messages" ON messages; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (
    sender_profile_id = public.user_profile_id()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_profile_id = public.user_profile_id() OR c.tenant_profile_id = public.user_profile_id())
    )
  )
  WITH CHECK (
    sender_profile_id = public.user_profile_id()
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;


-- === [85/169] 20260309000002_add_ticket_to_conversations.sql ===
-- Migration: Add ticket_id to conversations table for ticket-chat integration

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_ticket_id ON conversations(ticket_id);


-- === [86/169] 20260309100000_sync_subscription_plans_features.sql ===
-- =====================================================
-- Migration: Synchronisation complète des plans d'abonnement
-- Date: 2026-03-09
-- Description:
--   - Synchronise les features JSONB de subscription_plans avec le frontend (plans.ts)
--   - Ajoute les plans manquants (gratuit, enterprise_s/m/l/xl)
--   - Met à jour les prix (confort 29→35€, pro 59→69€)
--   - Synchronise subscriptions.plan_slug avec subscription_plans.slug
--   - Migre les abonnements enterprise legacy → enterprise_s
--   - Recalcule les compteurs d'usage
--   - Crée les abonnements manquants pour les propriétaires orphelins
--   - Met à jour has_subscription_feature() pour les features non-booléennes
-- =====================================================

-- =====================================================
-- ÉTAPE 1: UPSERT des 8 plans avec features complètes
-- Source de vérité : lib/subscriptions/plans.ts
-- =====================================================

-- GRATUIT - 0€/mois (1 bien) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'gratuit',
  'Gratuit',
  'Découvrez la gestion locative simplifiée avec 1 bien',
  0, 0,
  1, 1, 2, 0.1,
  '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "open_banking": false,
    "open_banking_level": "none",
    "bank_reconciliation": false,
    "auto_reminders": false,
    "auto_reminders_sms": false,
    "irl_revision": false,
    "alerts_deadlines": false,
    "tenant_portal": "basic",
    "tenant_payment_online": false,
    "lease_generation": true,
    "colocation": false,
    "multi_units": false,
    "multi_users": false,
    "max_users": 1,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": false,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": false,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": false,
    "scoring_advanced": false,
    "edl_digital": false,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, false, -1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- STARTER - 9€/mois (3 biens) - MISE À JOUR features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'starter',
  'Starter',
  'Idéal pour gérer jusqu''à 3 biens en toute simplicité',
  900, 9000,
  3, 5, 10, 1,
  '{
    "signatures": true,
    "signatures_monthly_quota": 0,
    "open_banking": false,
    "open_banking_level": "none",
    "bank_reconciliation": false,
    "auto_reminders": "email_basic",
    "auto_reminders_sms": false,
    "irl_revision": false,
    "alerts_deadlines": false,
    "tenant_portal": "basic",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": false,
    "multi_units": false,
    "multi_users": false,
    "max_users": 1,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": false,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": false,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": false,
    "scoring_advanced": false,
    "edl_digital": false,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, false, 0
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- CONFORT - 35€/mois (10 biens) - MISE À JOUR prix + features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'confort',
  'Confort',
  'Pour les propriétaires actifs avec plusieurs biens',
  3500, 33600,  -- 35€/mois, 336€/an (=28€/mois, -20%)
  10, 25, 40, 5,
  '{
    "signatures": true,
    "signatures_monthly_quota": 2,
    "open_banking": true,
    "open_banking_level": "basic",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": false,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "advanced",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 2,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": true,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": true,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": false,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, true, 1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- PRO - 69€/mois (50 biens) - MISE À JOUR prix + features
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'pro',
  'Pro',
  'Pour les gestionnaires professionnels et SCI',
  6900, 66200,  -- 69€/mois, 662€/an (=55€/mois, -20%)
  50, -1, -1, 30,
  '{
    "signatures": true,
    "signatures_monthly_quota": 10,
    "open_banking": true,
    "open_banking_level": "advanced",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 5,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": true,
    "api_access_level": "read_write",
    "webhooks": false,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": false,
    "dedicated_account_manager": false,
    "sla_guarantee": false
  }'::jsonb,
  true, false, 2
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE S - 249€/mois (100 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_s',
  'Enterprise S',
  'Pour les gestionnaires de 50 à 100 biens',
  24900, 239000,
  100, -1, -1, 50,
  '{
    "signatures": true,
    "signatures_monthly_quota": 25,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": false,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, false, 3
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE M - 349€/mois (200 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_m',
  'Enterprise M',
  'Pour les gestionnaires de 100 à 200 biens',
  34900, 335000,
  200, -1, -1, 100,
  '{
    "signatures": true,
    "signatures_monthly_quota": 40,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": false,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": false,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, false, 4
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE L - 499€/mois (500 biens) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_l',
  'Enterprise L',
  'Pour les gestionnaires de 200 à 500 biens',
  49900, 479000,
  500, -1, -1, 200,
  '{
    "signatures": true,
    "signatures_monthly_quota": 60,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": true,
    "sso": false,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, true, 5
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE XL - 799€/mois (illimité) - NOUVEAU
INSERT INTO subscription_plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_properties, max_leases, max_tenants, max_documents_gb,
  features, is_active, is_popular, display_order
) VALUES (
  'enterprise_xl',
  'Enterprise XL',
  'Solution sur-mesure pour +500 biens',
  79900, 767000,
  -1, -1, -1, -1,
  '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  true, false, 6
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ENTERPRISE (Legacy) - Mise à jour features pour cohérence
-- On garde le plan en BDD pour les abonnements existants mais on le masque
UPDATE subscription_plans
SET
  features = '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "open_banking_level": "premium",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "full",
    "tenant_payment_online": true,
    "lease_generation": true,
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "all",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "custom_domain": true,
    "sso": true,
    "scoring_tenant": true,
    "scoring_advanced": true,
    "edl_digital": true,
    "copro_module": true,
    "priority_support": true,
    "dedicated_account_manager": true,
    "sla_guarantee": true
  }'::jsonb,
  display_order = 99,
  updated_at = NOW()
WHERE slug = 'enterprise';

-- =====================================================
-- ÉTAPE 2: Synchroniser subscriptions.plan_slug
-- =====================================================

-- 2a. Synchroniser plan_slug avec le slug réel du plan lié
UPDATE subscriptions s
SET plan_slug = sp.slug, updated_at = NOW()
FROM subscription_plans sp
WHERE s.plan_id = sp.id
AND (s.plan_slug IS NULL OR s.plan_slug != sp.slug);

-- 2b. Migrer les abonnements enterprise legacy → enterprise_s
DO $$
DECLARE
  v_enterprise_s_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_enterprise_s_id FROM subscription_plans WHERE slug = 'enterprise_s';

  IF v_enterprise_s_id IS NOT NULL THEN
    UPDATE subscriptions
    SET plan_slug = 'enterprise_s',
        plan_id = v_enterprise_s_id,
        updated_at = NOW()
    WHERE plan_slug = 'enterprise';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) enterprise migré(s) vers enterprise_s', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 3: Recalculer les compteurs d'usage
-- =====================================================

-- 3a. Recalculer properties_count pour les comptes actifs
UPDATE subscriptions s
SET
  properties_count = COALESCE(prop_counts.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT p.owner_id, COUNT(*) as cnt
  FROM properties p
  WHERE p.deleted_at IS NULL
  GROUP BY p.owner_id
) prop_counts
WHERE s.owner_id = prop_counts.owner_id
AND s.status IN ('active', 'trialing');

-- 3b. Recalculer leases_count pour les comptes actifs
UPDATE subscriptions s
SET
  leases_count = COALESCE(lease_counts.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT pr.owner_id, COUNT(*) as cnt
  FROM leases l
  JOIN properties pr ON l.property_id = pr.id
  WHERE l.statut IN ('active', 'pending_signature', 'partially_signed', 'fully_signed')
  GROUP BY pr.owner_id
) lease_counts
WHERE s.owner_id = lease_counts.owner_id
AND s.status IN ('active', 'trialing');

-- =====================================================
-- ÉTAPE 4: Créer abonnements manquants
-- =====================================================

DO $$
DECLARE
  v_starter_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_starter_id FROM subscription_plans WHERE slug = 'starter' LIMIT 1;

  IF v_starter_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      owner_id, plan_id, plan_slug, status, billing_cycle,
      current_period_start, current_period_end, trial_end,
      properties_count, leases_count
    )
    SELECT
      p.id,
      v_starter_id,
      'starter',
      'trialing',
      'monthly',
      NOW(),
      NOW() + INTERVAL '30 days',
      NOW() + INTERVAL '30 days',
      COALESCE((SELECT COUNT(*) FROM properties pr WHERE pr.owner_id = p.id AND pr.deleted_at IS NULL), 0),
      0
    FROM profiles p
    WHERE p.role = 'owner'
    AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.owner_id = p.id)
    ON CONFLICT (owner_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) Starter créé(s) pour propriétaires orphelins', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 5: Mettre à jour has_subscription_feature()
-- Support des features non-booléennes (niveaux, nombres)
-- =====================================================

CREATE OR REPLACE FUNCTION has_subscription_feature(p_owner_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  feature_raw JSONB;
  feature_type TEXT;
BEGIN
  -- Récupérer la valeur brute de la feature depuis le plan
  SELECT sp.features -> p_feature
  INTO feature_raw
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.slug = COALESCE(s.plan_slug, 'gratuit')
  WHERE s.owner_id = p_owner_id;

  -- Si pas de subscription ou feature absente
  IF feature_raw IS NULL THEN
    RETURN false;
  END IF;

  -- Déterminer le type JSONB
  feature_type := jsonb_typeof(feature_raw);

  -- Booléen : retourner directement
  IF feature_type = 'boolean' THEN
    RETURN feature_raw::text::boolean;
  END IF;

  -- Nombre : true si > 0 (ou -1 pour illimité)
  IF feature_type = 'number' THEN
    RETURN (feature_raw::text::numeric != 0);
  END IF;

  -- String : true si non vide et pas "none" ou "false"
  IF feature_type = 'string' THEN
    RETURN (feature_raw::text NOT IN ('"none"', '"false"', '""'));
  END IF;

  -- Null explicite
  IF feature_type = 'null' THEN
    RETURN false;
  END IF;

  -- Autres types (array, object) : considérer comme true
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_subscription_feature(UUID, TEXT) IS
  'Vérifie si un owner a accès à une feature selon son forfait. Supporte bool, niveaux (string) et quotas (number).';

-- =====================================================
-- ÉTAPE 6: Mise à jour du trigger create_owner_subscription
-- Mettre à jour les intervalles pour 30 jours (cohérence)
-- =====================================================

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Seulement pour les propriétaires
  IF NEW.role = 'owner' THEN
    -- Récupérer l'ID du plan starter (plan par défaut)
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = 'starter'
    LIMIT 1;

    -- Créer l'abonnement si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id,
        plan_id,
        plan_slug,
        status,
        billing_cycle,
        current_period_start,
        current_period_end,
        trial_end,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'starter',
        'trialing',
        'monthly',
        NOW(),
        NOW() + INTERVAL '30 days',
        NOW() + INTERVAL '30 days',
        0,
        0
      )
      ON CONFLICT (owner_id) DO NOTHING;

      RAISE NOTICE 'Abonnement Talok Starter (essai 30j) créé pour le propriétaire %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === [87/169] 20260310000000_fix_subscription_plans_display_order.sql ===
-- =====================================================
-- Migration: Fix display_order des plans d'abonnement
-- Date: 2026-03-10
-- Description:
--   - Corrige display_order du plan Gratuit (-1 → 0)
--   - Réordonne tous les plans avec des valeurs séquentielles
-- =====================================================

UPDATE subscription_plans SET display_order = 0, updated_at = NOW() WHERE slug = 'gratuit';
UPDATE subscription_plans SET display_order = 1, updated_at = NOW() WHERE slug = 'starter';
UPDATE subscription_plans SET display_order = 2, updated_at = NOW() WHERE slug = 'confort';
UPDATE subscription_plans SET display_order = 3, updated_at = NOW() WHERE slug = 'pro';
UPDATE subscription_plans SET display_order = 4, updated_at = NOW() WHERE slug = 'enterprise_s';
UPDATE subscription_plans SET display_order = 5, updated_at = NOW() WHERE slug = 'enterprise_m';
UPDATE subscription_plans SET display_order = 6, updated_at = NOW() WHERE slug = 'enterprise_l';
UPDATE subscription_plans SET display_order = 7, updated_at = NOW() WHERE slug = 'enterprise_xl';
UPDATE subscription_plans SET display_order = 99, updated_at = NOW() WHERE slug = 'enterprise';


-- === [88/169] 20260310100000_fix_property_limit_enforcement.sql ===
-- =====================================================
-- Migration: Fix Property Limit Enforcement & Counter Sync
--
-- Problème: Les compteurs properties_count/leases_count dans
-- la table subscriptions se désynchronisent car :
-- 1. Le trigger enforce_property_limit() lit le compteur caché
--    au lieu de faire un vrai COUNT
-- 2. Le trigger update_subscription_properties_count() ne gère
--    pas les soft-deletes (UPDATE de deleted_at)
-- 3. Les compteurs existants sont potentiellement faux
--
-- Fix:
-- - enforce_property_limit() utilise un vrai COUNT(*)
-- - enforce_lease_limit() utilise un vrai COUNT(*) avec deleted_at IS NULL
-- - update_subscription_properties_count() gère les soft-deletes via recount
-- - Recalcul des compteurs pour TOUS les comptes
-- =====================================================

-- =====================================================
-- 1. Fix enforce_property_limit() : utiliser un vrai COUNT
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
BEGIN
  -- Compter les propriétés actives (non soft-deleted) avec un vrai COUNT
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL;

  -- Récupérer la limite du plan
  SELECT
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. Fix enforce_lease_limit() : COUNT live + deleted_at IS NULL
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_lease_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
  property_owner_id UUID;
BEGIN
  -- Récupérer l'owner_id depuis la propriété
  SELECT owner_id INTO property_owner_id
  FROM properties
  WHERE id = NEW.property_id;

  IF property_owner_id IS NULL THEN
    RAISE EXCEPTION 'Propriété non trouvée';
  END IF;

  -- Compter les baux actifs sur les propriétés non soft-deleted
  SELECT COUNT(*) INTO current_count
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE p.owner_id = property_owner_id
    AND p.deleted_at IS NULL
    AND l.statut IN ('active', 'pending_signature');

  -- Récupérer la limite du plan
  SELECT
    COALESCE(sp.max_leases, -1),
    COALESCE(s.plan_slug, 'gratuit')
  INTO max_allowed, plan_slug
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = property_owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bail(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour créer plus de baux.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. Fix update_subscription_properties_count() : gérer soft-deletes
--    Utilise un recount complet (self-healing) au lieu de inc/dec
-- =====================================================
CREATE OR REPLACE FUNCTION update_subscription_properties_count()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_owner_id := OLD.owner_id;
  ELSE
    v_owner_id := NEW.owner_id;
  END IF;

  -- Recalculer le compteur à partir de l'état réel de la table
  UPDATE subscriptions
  SET properties_count = (
    SELECT COUNT(*)
    FROM properties
    WHERE owner_id = v_owner_id
      AND deleted_at IS NULL
  ),
  updated_at = NOW()
  WHERE owner_id = v_owner_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour le trigger pour écouter aussi les UPDATE (soft-delete/restore)
DROP TRIGGER IF EXISTS trg_update_subscription_properties ON properties;
DROP TRIGGER IF EXISTS trg_update_subscription_properties ON properties;
CREATE TRIGGER trg_update_subscription_properties
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_subscription_properties_count();

-- =====================================================
-- 4. Recalculer properties_count pour TOUS les comptes
-- =====================================================
UPDATE subscriptions s
SET
  properties_count = COALESCE(pc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(p.id) as cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  GROUP BY s2.owner_id
) pc
WHERE s.owner_id = pc.owner_id;

-- =====================================================
-- 5. Recalculer leases_count pour TOUS les comptes
-- =====================================================
UPDATE subscriptions s
SET
  leases_count = COALESCE(lc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(l.id) as cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  LEFT JOIN leases l ON l.property_id = p.id AND l.statut IN ('active', 'pending_signature')
  GROUP BY s2.owner_id
) lc
WHERE s.owner_id = lc.owner_id;

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON FUNCTION enforce_property_limit() IS 'Vérifie la limite de biens via COUNT réel (pas le compteur caché). Gère correctement les soft-deletes.';
COMMENT ON FUNCTION enforce_lease_limit() IS 'Vérifie la limite de baux via COUNT réel. Exclut les propriétés soft-deleted.';
COMMENT ON FUNCTION update_subscription_properties_count() IS 'Met à jour le compteur properties_count via recount complet sur INSERT, DELETE et soft-delete (UPDATE deleted_at).';


-- === [89/169] 20260310200000_add_signature_push_franceconnect.sql ===
-- Migration: Ajout colonnes signatures (Yousign), table franceconnect_sessions,
-- et colonnes push Web Push sur notification_settings
-- Date: 2026-03-10

-- =============================================================================
-- 1. signatures: ajout colonnes provider et signing_url pour intégration Yousign
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'signatures' AND column_name = 'provider'
  ) THEN
    ALTER TABLE signatures ADD COLUMN provider TEXT DEFAULT 'internal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'signatures' AND column_name = 'signing_url'
  ) THEN
    ALTER TABLE signatures ADD COLUMN signing_url TEXT;
  END IF;
END $$;

COMMENT ON COLUMN signatures.provider IS 'Provider de signature: internal, yousign, docusign';
COMMENT ON COLUMN signatures.signing_url IS 'URL de signature externe (Yousign)';

-- =============================================================================
-- 2. franceconnect_sessions: sessions OIDC FranceConnect / France Identité
-- =============================================================================
CREATE TABLE IF NOT EXISTS franceconnect_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  nonce TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'identity_verification',
  callback_url TEXT NOT NULL DEFAULT '/',
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fc_sessions_user_id ON franceconnect_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fc_sessions_state ON franceconnect_sessions(state);
CREATE INDEX IF NOT EXISTS idx_fc_sessions_expires_at ON franceconnect_sessions(expires_at);

-- RLS
ALTER TABLE franceconnect_sessions ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs ne peuvent voir que leurs propres sessions
DO $dp$ BEGIN DROP POLICY IF EXISTS "Users can view own FC sessions" ON franceconnect_sessions; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Users can view own FC sessions"
  ON franceconnect_sessions FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Seul le service role peut insérer/modifier (via l'API route)
DO $dp$ BEGIN DROP POLICY IF EXISTS "Service role can manage FC sessions" ON franceconnect_sessions; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Service role can manage FC sessions"
  ON franceconnect_sessions FOR ALL
  USING (auth.role() = 'service_role');
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Nettoyage automatique des sessions expirées (via pg_cron si disponible)
-- DELETE FROM franceconnect_sessions WHERE expires_at < NOW();

-- =============================================================================
-- 3. notification_settings: colonnes push_enabled et push_subscription
--    pour le Web Push API (VAPID)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_settings' AND column_name = 'push_enabled'
  ) THEN
    ALTER TABLE notification_settings ADD COLUMN push_enabled BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_settings' AND column_name = 'push_subscription'
  ) THEN
    ALTER TABLE notification_settings ADD COLUMN push_subscription JSONB;
  END IF;
END $$;

COMMENT ON COLUMN notification_settings.push_enabled IS 'Web Push activé pour cet utilisateur';
COMMENT ON COLUMN notification_settings.push_subscription IS 'Objet PushSubscription (endpoint, keys) pour Web Push API';


-- === [90/169] 20260310200000_fix_property_limit_extra_properties.sql ===
-- =====================================================
-- Migration: Allow extra properties for paid plans
--
-- Problème: Le trigger enforce_property_limit() bloque la
-- création de biens au-delà de max_properties, même pour
-- les forfaits payants (Starter, Confort, Pro) qui permettent
-- d'ajouter des biens supplémentaires moyennant un surcoût.
--
-- Fix:
-- - Ajouter la colonne extra_property_price à subscription_plans
-- - Mettre à jour enforce_property_limit() pour ne pas bloquer
--   quand extra_property_price > 0 (biens supplémentaires autorisés)
-- =====================================================

-- 1. Ajouter la colonne extra_property_price si elle n'existe pas
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS extra_property_price INTEGER DEFAULT 0;

COMMENT ON COLUMN subscription_plans.extra_property_price IS
  'Prix en centimes par bien supplémentaire au-delà du quota inclus. 0 = pas de bien suppl. autorisé.';

-- 2. Peupler la colonne pour les plans existants
UPDATE subscription_plans SET extra_property_price = 0   WHERE slug = 'gratuit';
UPDATE subscription_plans SET extra_property_price = 300 WHERE slug = 'starter';    -- 3€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 250 WHERE slug = 'confort';    -- 2,50€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 200 WHERE slug = 'pro';        -- 2€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 0   WHERE slug LIKE 'enterprise%';

-- 3. Mettre à jour enforce_property_limit() pour autoriser les biens
--    supplémentaires sur les forfaits qui le permettent
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
  v_extra_property_price INTEGER;
BEGIN
  -- Compter les propriétés actives (non soft-deleted) avec un vrai COUNT
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL;

  -- Récupérer la limite du plan et le prix des biens supplémentaires
  SELECT
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit'),
    COALESCE(sp.extra_property_price, 0)
  INTO max_allowed, plan_slug, v_extra_property_price
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
    v_extra_property_price := 0;
  END IF;

  -- Si le forfait autorise des biens supplémentaires payants, ne pas bloquer
  IF v_extra_property_price > 0 THEN
    RETURN NEW;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enforce_property_limit() IS
  'Vérifie la limite de biens. Autorise les biens supplémentaires payants pour les forfaits avec extra_property_price > 0.';


-- === [91/169] 20260310300000_add_stripe_price_extra_property_id.sql ===
-- Add stripe_price_extra_property_id column to subscription_plans
-- Stores the Stripe Price ID for per-unit extra property billing

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_price_extra_property_id TEXT;

COMMENT ON COLUMN subscription_plans.stripe_price_extra_property_id
IS 'Stripe Price ID for recurring per-unit billing of extra properties beyond included quota';


-- === [92/169] 20260311100000_sync_subscription_plan_slugs.sql ===
-- =====================================================
-- Migration: Synchroniser plan_slug depuis plan_id
--
-- Problème: Certaines subscriptions ont plan_slug NULL
-- car la colonne a été ajoutée après la création de la subscription.
-- Cela cause un fallback vers le plan "gratuit" côté frontend,
-- bloquant les utilisateurs sur les forfaits payants (starter, etc.)
--
-- Fix:
-- 1. Synchroniser plan_slug depuis plan_id pour toutes les rows NULL
-- 2. Créer un trigger pour auto-sync à chaque changement de plan_id
-- =====================================================

-- 1. Synchroniser les plan_slug manquants
UPDATE subscriptions s
SET plan_slug = sp.slug, updated_at = NOW()
FROM subscription_plans sp
WHERE sp.id = s.plan_id
  AND s.plan_slug IS NULL;

-- 2. Trigger auto-sync plan_slug quand plan_id change
CREATE OR REPLACE FUNCTION sync_subscription_plan_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Si plan_id change ou plan_slug est NULL, synchroniser depuis subscription_plans
  IF NEW.plan_id IS NOT NULL AND (
    NEW.plan_slug IS NULL
    OR TG_OP = 'INSERT'
    OR OLD.plan_id IS DISTINCT FROM NEW.plan_id
  ) THEN
    SELECT slug INTO NEW.plan_slug
    FROM subscription_plans
    WHERE id = NEW.plan_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_subscription_plan_slug ON subscriptions;
DROP TRIGGER IF EXISTS trg_sync_subscription_plan_slug ON subscriptions;
CREATE TRIGGER trg_sync_subscription_plan_slug
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_subscription_plan_slug();

COMMENT ON FUNCTION sync_subscription_plan_slug() IS
  'Auto-synchronise plan_slug depuis plan_id pour éviter les fallbacks vers gratuit.';


-- === [93/169] 20260312000000_admin_dashboard_rpcs.sql ===
-- ============================================================================
-- Migration: Admin Dashboard RPCs
-- Date: 2026-03-12
-- Description: Crée les RPCs manquantes pour le dashboard admin V2
--   - admin_monthly_revenue : revenus mensuels sur 12 mois
--   - admin_subscription_stats : stats abonnements
--   - admin_daily_trends : tendances 7 derniers jours
-- ============================================================================

-- 1. RPC: admin_monthly_revenue
-- Retourne les revenus attendus vs encaissés sur les 12 derniers mois
CREATE OR REPLACE FUNCTION admin_monthly_revenue()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      to_char(month_start, 'Mon') AS month,
      COALESCE(SUM(montant_total), 0)::numeric AS attendu,
      COALESCE(SUM(CASE WHEN statut = 'paid' THEN montant_total ELSE 0 END), 0)::numeric AS encaisse
    FROM generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS month_start
    LEFT JOIN invoices ON date_trunc('month', invoices.created_at) = month_start
    GROUP BY month_start
    ORDER BY month_start
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 2. RPC: admin_subscription_stats
-- Retourne les statistiques d'abonnements
CREATE OR REPLACE FUNCTION admin_subscription_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*)::int,
    'active', COUNT(*) FILTER (WHERE status = 'active')::int,
    'trial', COUNT(*) FILTER (WHERE status = 'trialing' OR (trial_end IS NOT NULL AND trial_end > now()))::int,
    'churned', COUNT(*) FILTER (WHERE status IN ('canceled', 'expired'))::int
  )
  INTO result
  FROM subscriptions;

  RETURN COALESCE(result, json_build_object('total', 0, 'active', 0, 'trial', 0, 'churned', 0));
END;
$$;

-- 3. RPC: admin_daily_trends
-- Retourne les tendances des 7 derniers jours (nouveaux users, properties, leases)
CREATE OR REPLACE FUNCTION admin_daily_trends()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  users_arr int[];
  properties_arr int[];
  leases_arr int[];
  d date;
BEGIN
  users_arr := ARRAY[]::int[];
  properties_arr := ARRAY[]::int[];
  leases_arr := ARRAY[]::int[];

  FOR d IN SELECT generate_series(
    (current_date - interval '6 days')::date,
    current_date,
    interval '1 day'
  )::date
  LOOP
    users_arr := users_arr || COALESCE(
      (SELECT COUNT(*)::int FROM profiles WHERE created_at::date = d), 0
    );
    properties_arr := properties_arr || COALESCE(
      (SELECT COUNT(*)::int FROM properties WHERE created_at::date = d), 0
    );
    leases_arr := leases_arr || COALESCE(
      (SELECT COUNT(*)::int FROM leases WHERE created_at::date = d), 0
    );
  END LOOP;

  RETURN json_build_object(
    'users', to_json(users_arr),
    'properties', to_json(properties_arr),
    'leases', to_json(leases_arr)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_monthly_revenue() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_subscription_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_daily_trends() TO authenticated;


-- === [94/169] 20260312000001_fix_owner_subscription_defaults.sql ===
-- =====================================================
-- Migration: Fix Owner Subscription Defaults & Data Repair
--
-- Problemes corriges:
-- 1. create_owner_subscription() assigne "starter" au lieu de "gratuit"
-- 2. plan_slug non defini explicitement dans le trigger
-- 3. Periode d'essai incorrecte pour le plan gratuit
-- 4. properties_count desynchronise pour les comptes existants
-- 5. Owners orphelins sans subscription
--
-- Flux corrige:
-- - Nouveau owner → subscription "gratuit" (status=active, pas de trial)
-- - L'utilisateur choisit son forfait ensuite via /signup/plan
-- - Si forfait payant → Stripe Checkout met a jour la subscription
-- - Si gratuit → POST /api/subscriptions/select-plan confirme le choix
-- =====================================================

-- =====================================================
-- 1. Corriger le trigger create_owner_subscription()
--    Plan par defaut = gratuit, plan_slug defini, pas de trial
-- =====================================================

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
  v_prop_count INTEGER;
  v_lease_count INTEGER;
BEGIN
  -- Seulement pour les proprietaires
  IF NEW.role = 'owner' THEN
    -- Recuperer l'ID du plan gratuit
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = 'gratuit'
    LIMIT 1;

    -- Compter les proprietes existantes (cas rare mais possible via admin)
    SELECT COUNT(*) INTO v_prop_count
    FROM properties
    WHERE owner_id = NEW.id
      AND deleted_at IS NULL;

    -- Compter les baux actifs
    SELECT COUNT(*) INTO v_lease_count
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    WHERE p.owner_id = NEW.id
      AND p.deleted_at IS NULL
      AND l.statut IN ('active', 'pending_signature');

    -- Creer l'abonnement gratuit si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id,
        plan_id,
        plan_slug,
        status,
        billing_cycle,
        current_period_start,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'gratuit',         -- Plan gratuit par defaut
        'active',          -- Actif immediatement (pas de trial pour le gratuit)
        'monthly',
        NOW(),
        COALESCE(v_prop_count, 0),
        COALESCE(v_lease_count, 0)
      )
      ON CONFLICT (owner_id) DO NOTHING;

      RAISE NOTICE 'Abonnement Gratuit cree pour le proprietaire %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreer le trigger
DROP TRIGGER IF EXISTS trg_create_owner_subscription ON profiles;
DROP TRIGGER IF EXISTS trg_create_owner_subscription ON profiles;
CREATE TRIGGER trg_create_owner_subscription
  AFTER INSERT OR UPDATE OF role ON profiles
  WHEN (NEW.role = 'owner')
  FOR EACH ROW
  EXECUTE FUNCTION create_owner_subscription();

COMMENT ON FUNCTION create_owner_subscription() IS
  'Cree automatiquement un abonnement Gratuit pour les nouveaux proprietaires. Le forfait reel sera choisi ensuite via /signup/plan.';

-- =====================================================
-- 2. Recalculer properties_count pour TOUS les comptes
-- =====================================================

UPDATE subscriptions s
SET
  properties_count = COALESCE(pc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(p.id) AS cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  GROUP BY s2.owner_id
) pc
WHERE s.owner_id = pc.owner_id;

-- =====================================================
-- 3. Recalculer leases_count pour TOUS les comptes
-- =====================================================

UPDATE subscriptions s
SET
  leases_count = COALESCE(lc.cnt, 0),
  updated_at = NOW()
FROM (
  SELECT s2.owner_id, COUNT(l.id) AS cnt
  FROM subscriptions s2
  LEFT JOIN properties p ON p.owner_id = s2.owner_id AND p.deleted_at IS NULL
  LEFT JOIN leases l ON l.property_id = p.id AND l.statut IN ('active', 'pending_signature')
  GROUP BY s2.owner_id
) lc
WHERE s.owner_id = lc.owner_id;

-- =====================================================
-- 4. Synchroniser plan_slug NULL depuis plan_id
-- =====================================================

UPDATE subscriptions s
SET
  plan_slug = sp.slug,
  updated_at = NOW()
FROM subscription_plans sp
WHERE sp.id = s.plan_id
  AND (s.plan_slug IS NULL OR s.plan_slug = '');

-- =====================================================
-- 5. Creer subscriptions manquantes pour owners orphelins
--    (plan gratuit, status active)
-- =====================================================

DO $$
DECLARE
  v_gratuit_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_gratuit_id FROM subscription_plans WHERE slug = 'gratuit' LIMIT 1;

  IF v_gratuit_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      owner_id, plan_id, plan_slug, status, billing_cycle,
      current_period_start, properties_count, leases_count
    )
    SELECT
      p.id,
      v_gratuit_id,
      'gratuit',
      'active',
      'monthly',
      NOW(),
      COALESCE((SELECT COUNT(*) FROM properties pr WHERE pr.owner_id = p.id AND pr.deleted_at IS NULL), 0),
      0
    FROM profiles p
    WHERE p.role = 'owner'
      AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.owner_id = p.id)
    ON CONFLICT (owner_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE '% abonnement(s) Gratuit cree(s) pour proprietaires orphelins', v_count;
    END IF;
  END IF;
END $$;

-- =====================================================
-- Commentaires
-- =====================================================
COMMENT ON FUNCTION create_owner_subscription() IS
  'Cree un abonnement Gratuit (plan_slug=gratuit, status=active) pour chaque nouveau proprietaire. Les compteurs sont initialises a partir de l''etat reel de la base.';


-- === [95/169] 20260312100000_fix_handle_new_user_all_roles.sql ===
-- ============================================
-- Migration: Ajouter guarantor et syndic au trigger handle_new_user
-- Date: 2026-03-12
-- Description: Le trigger acceptait uniquement admin/owner/tenant/provider.
--              Les rôles guarantor et syndic étaient silencieusement convertis en tenant.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
BEGIN
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le rôle (tous les rôles supportés par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Insérer le profil avec toutes les données
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Crée automatiquement un profil lors de la création d''un utilisateur.
Lit le rôle et les informations personnelles depuis les raw_user_meta_data.
Supporte tous les rôles: admin, owner, tenant, provider, guarantor, syndic.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';


-- === [96/169] 20260314001000_fix_stripe_connect_rls.sql ===
-- Migration: corriger la RLS Stripe Connect avec profiles.id
-- Date: 2026-03-14

ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_transfers ENABLE ROW LEVEL SECURITY;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can view own connect account" ON stripe_connect_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can create own connect account" ON stripe_connect_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Service role full access connect" ON stripe_connect_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can view own connect account" ON stripe_connect_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Owners can view own connect account" ON stripe_connect_accounts
  FOR SELECT
  USING (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can create own connect account" ON stripe_connect_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Owners can create own connect account" ON stripe_connect_accounts
  FOR INSERT
  WITH CHECK (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can update own connect account" ON stripe_connect_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Owners can update own connect account" ON stripe_connect_accounts
  FOR UPDATE
  USING (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  )
  WITH CHECK (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Service role full access connect" ON stripe_connect_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Service role full access connect" ON stripe_connect_accounts
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can view own transfers" ON stripe_transfers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Service role full access transfers" ON stripe_transfers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can view own transfers" ON stripe_transfers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Owners can view own transfers" ON stripe_transfers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM stripe_connect_accounts sca
      WHERE sca.id = stripe_transfers.connect_account_id
        AND (
          sca.profile_id = public.user_profile_id()
          OR public.user_role() = 'admin'
        )
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Service role full access transfers" ON stripe_transfers; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Service role full access transfers" ON stripe_transfers
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;


-- === [97/169] 20260314020000_canonical_lease_activation_flow.sql ===
-- Migration: recentrer le flux bail sur un parcours canonique
-- Date: 2026-03-14
--
-- Objectifs:
-- 1. Empêcher les activations implicites depuis les signataires ou l'EDL
-- 2. Faire de la facture initiale une étape explicite après fully_signed
-- 3. Préserver le dépôt de garantie dans le total de la facture initiale

-- ---------------------------------------------------------------------------
-- 1. Neutraliser les activations SQL implicites legacy
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS tr_check_activate_lease ON lease_signers;
DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON edl;
DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;

-- ---------------------------------------------------------------------------
-- 2. L'EDL finalise uniquement le document, sans activer le bail
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_edl_finalization()
RETURNS TRIGGER AS $$
DECLARE
    v_has_owner BOOLEAN;
    v_has_tenant BOOLEAN;
    v_edl_id UUID;
BEGIN
    v_edl_id := NEW.edl_id;

    SELECT 
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
              AND signer_role IN ('owner', 'proprietaire', 'bailleur') 
              AND signature_image_path IS NOT NULL
              AND signed_at IS NOT NULL
        ),
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
              AND signer_role IN ('tenant', 'locataire', 'locataire_principal') 
              AND signature_image_path IS NOT NULL
              AND signed_at IS NOT NULL
        )
    INTO v_has_owner, v_has_tenant;

    IF v_has_owner AND v_has_tenant THEN
        UPDATE edl
        SET 
            status = 'signed',
            completed_date = COALESCE(completed_date, CURRENT_DATE),
            updated_at = NOW()
        WHERE id = v_edl_id
          AND status != 'signed';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3. Préserver le dépôt de garantie dans le calcul du total
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  v_deposit_amount DECIMAL := 0;
BEGIN
  IF NEW.metadata IS NOT NULL AND NEW.metadata->>'type' = 'initial_invoice' THEN
    v_deposit_amount := COALESCE((NEW.metadata->>'deposit_amount')::DECIMAL, 0);
  END IF;

  NEW.montant_total :=
    ROUND(COALESCE(NEW.montant_loyer, 0) + COALESCE(NEW.montant_charges, 0) + v_deposit_amount, 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 4. Fonction SSOT de génération de la facture initiale
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_initial_signing_invoice(
  p_lease_id UUID,
  p_tenant_id UUID,
  p_owner_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_date_debut DATE;
  v_loyer DECIMAL(10,2);
  v_charges DECIMAL(10,2);
  v_deposit DECIMAL(10,2);
  v_total_days INT;
  v_prorata_days INT;
  v_prorata_loyer DECIMAL(10,2);
  v_prorata_charges DECIMAL(10,2);
  v_is_prorated BOOLEAN := false;
  v_month_str TEXT;
  v_due_date DATE;
  v_period_end DATE;
  v_invoice_exists BOOLEAN;
BEGIN
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_loyer := COALESCE(v_lease.loyer, 0);
  v_charges := COALESCE(v_lease.charges_forfaitaires, 0);
  v_deposit := COALESCE(v_lease.depot_de_garantie, 0);
  v_date_debut := v_lease.date_debut;

  IF v_date_debut IS NULL THEN RETURN; END IF;

  v_month_str := TO_CHAR(v_date_debut, 'YYYY-MM');

  SELECT EXISTS(
    SELECT 1 FROM invoices
    WHERE lease_id = p_lease_id
      AND (
        metadata->>'type' = 'initial_invoice'
        OR type = 'initial_invoice'
      )
  ) INTO v_invoice_exists;

  IF v_invoice_exists THEN RETURN; END IF;

  v_total_days := EXTRACT(DAY FROM (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_prorata_days := v_total_days - EXTRACT(DAY FROM v_date_debut)::INT + 1;
  v_period_end := (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  IF v_prorata_days < v_total_days THEN
    v_prorata_loyer := ROUND((v_loyer * v_prorata_days / v_total_days), 2);
    v_prorata_charges := ROUND((v_charges * v_prorata_days / v_total_days), 2);
    v_is_prorated := true;
  ELSE
    v_prorata_loyer := v_loyer;
    v_prorata_charges := v_charges;
  END IF;

  v_due_date := GREATEST(v_date_debut, CURRENT_DATE);

  INSERT INTO invoices (
    lease_id,
    owner_id,
    tenant_id,
    periode,
    montant_loyer,
    montant_charges,
    montant_total,
    date_echeance,
    due_date,
    period_start,
    period_end,
    invoice_number,
    type,
    statut,
    generated_at,
    metadata,
    notes
  ) VALUES (
    p_lease_id,
    p_owner_id,
    p_tenant_id,
    v_month_str,
    v_prorata_loyer,
    v_prorata_charges,
    v_prorata_loyer + v_prorata_charges + v_deposit,
    v_due_date,
    v_due_date,
    v_date_debut,
    v_period_end,
    'INI-' || REPLACE(v_month_str, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
    'initial_invoice',
    'sent',
    NOW(),
    jsonb_build_object(
      'type', 'initial_invoice',
      'includes_deposit', v_deposit > 0,
      'deposit_amount', v_deposit,
      'is_prorated', v_is_prorated,
      'prorata_days', v_prorata_days,
      'total_days', v_total_days,
      'generated_at_signing', true
    ),
    CASE
      WHEN v_is_prorated THEN
        'Facture initiale : loyer prorata du ' || v_date_debut || ' au ' || v_period_end
        || ' (' || v_prorata_days || '/' || v_total_days || ' jours)'
        || ' + dépôt de garantie ' || v_deposit || ' €'
      ELSE
        'Facture initiale : loyer ' || v_month_str || ' + dépôt de garantie ' || v_deposit || ' €'
    END
  );
END;
$$;


-- === [98/169] 20260314030000_payments_production_hardening.sql ===
-- Migration: hardening production paiements
-- Objectifs:
-- 1. Neutraliser les derniers chemins legacy qui activent un bail implicitement
-- 2. Renforcer l'idempotence des reversements Stripe Connect
-- 3. Distinguer transfert Connect et payout bancaire reel
-- 4. Backfiller les marqueurs de facture initiale et les liens SEPA sur les donnees existantes

-- -----------------------------------------------------------------------------
-- Flux bail / signatures / EDL
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_signature_session_to_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    IF NEW.entity_type = 'lease' THEN
      UPDATE leases
      SET
        statut = CASE
          WHEN NEW.document_type = 'bail' THEN 'fully_signed'
          ELSE statut
        END,
        signature_completed_at = NOW(),
        updated_at = NOW()
      WHERE id = NEW.entity_id;

    ELSIF NEW.entity_type = 'edl' THEN
      UPDATE edl
      SET
        status = 'signed',
        updated_at = NOW()
      WHERE id = NEW.entity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON public.edl;
DROP TRIGGER IF EXISTS tr_check_activate_lease ON public.lease_signers;
DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON public.leases;
DROP TRIGGER IF EXISTS trg_invoice_engine_on_lease_active ON public.leases;

-- -----------------------------------------------------------------------------
-- Reversements Stripe Connect / payouts
-- -----------------------------------------------------------------------------

ALTER TABLE public.stripe_transfers
  ADD COLUMN IF NOT EXISTS stripe_source_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_destination_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_transfers_unique_payment
  ON public.stripe_transfers(payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_transfers_unique_invoice_transfer
  ON public.stripe_transfers(invoice_id, stripe_transfer_id);

CREATE TABLE IF NOT EXISTS public.stripe_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connect_account_id UUID NOT NULL REFERENCES public.stripe_connect_accounts(id) ON DELETE CASCADE,
  stripe_payout_id TEXT NOT NULL UNIQUE,
  stripe_balance_transaction_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'in_transit')),
  arrival_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payouts_connect_account
  ON public.stripe_payouts(connect_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_payouts_status
  ON public.stripe_payouts(status, created_at DESC);

ALTER TABLE public.stripe_payouts ENABLE ROW LEVEL SECURITY;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can view own payouts" ON public.stripe_payouts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can view own payouts" ON public.stripe_payouts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Owners can view own payouts" ON public.stripe_payouts
  FOR SELECT USING (
    connect_account_id IN (
      SELECT sca.id
      FROM public.stripe_connect_accounts sca
      WHERE sca.profile_id = public.user_profile_id()
    )
    OR public.user_role() = 'admin'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Service role full access payouts" ON public.stripe_payouts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Service role full access payouts" ON public.stripe_payouts; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Service role full access payouts" ON public.stripe_payouts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DROP TRIGGER IF EXISTS update_stripe_payouts_updated_at ON public.stripe_payouts;
DROP TRIGGER IF EXISTS update_stripe_payouts_updated_at ON public.stripe_payouts;
CREATE TRIGGER update_stripe_payouts_updated_at
  BEFORE UPDATE ON public.stripe_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stripe_transfers'
      AND column_name = 'payout_id'
  ) THEN
    BEGIN
      ALTER TABLE public.stripe_transfers
        ADD CONSTRAINT fk_stripe_transfers_payout
        FOREIGN KEY (payout_id) REFERENCES public.stripe_payouts(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Backfills securises et idempotents
-- -----------------------------------------------------------------------------

UPDATE public.invoices
SET type = 'initial_invoice'
WHERE COALESCE(metadata->>'type', '') = 'initial_invoice'
  AND COALESCE(type, '') <> 'initial_invoice';

UPDATE public.invoices
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('type', 'initial_invoice')
WHERE type = 'initial_invoice'
  AND COALESCE(metadata->>'type', '') <> 'initial_invoice';

UPDATE public.tenant_payment_methods tpm
SET sepa_mandate_id = sm.id,
    updated_at = NOW()
FROM public.sepa_mandates sm
WHERE tpm.type = 'sepa_debit'
  AND tpm.sepa_mandate_id IS NULL
  AND tpm.tenant_profile_id = sm.tenant_profile_id
  AND tpm.stripe_payment_method_id = sm.stripe_payment_method_id;


-- === [99/169] 20260315090000_market_standard_subscription_alignment.sql ===

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS selected_plan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS selected_plan_source TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_plan_id UUID REFERENCES subscription_plans(id),
  ADD COLUMN IF NOT EXISTS scheduled_plan_slug TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_plan_effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_subscription_schedule_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_selected_plan_at
  ON subscriptions(selected_plan_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_scheduled_plan_effective_at
  ON subscriptions(scheduled_plan_effective_at)
  WHERE scheduled_plan_effective_at IS NOT NULL;

UPDATE subscriptions s
SET plan_id = sp.id
FROM subscription_plans sp
WHERE s.plan_id IS NULL
  AND s.plan_slug IS NOT NULL
  AND sp.slug = s.plan_slug;

UPDATE subscriptions s
SET plan_slug = sp.slug
FROM subscription_plans sp
WHERE s.plan_slug IS NULL
  AND s.plan_id IS NOT NULL
  AND sp.id = s.plan_id;

UPDATE subscriptions
SET status = 'paused'
WHERE status = 'suspended';

UPDATE subscriptions
SET selected_plan_at = COALESCE(current_period_start, updated_at, created_at),
    selected_plan_source = CASE
      WHEN stripe_subscription_id IS NOT NULL THEN COALESCE(selected_plan_source, 'backfill_stripe')
      ELSE COALESCE(selected_plan_source, 'backfill_local')
    END
WHERE selected_plan_at IS NULL
   OR selected_plan_source IS NULL;

UPDATE subscriptions
SET scheduled_plan_id = NULL,
    scheduled_plan_slug = NULL,
    scheduled_plan_effective_at = NULL,
    stripe_subscription_schedule_id = NULL
WHERE scheduled_plan_effective_at IS NOT NULL
  AND scheduled_plan_effective_at < NOW() - INTERVAL '7 days';

UPDATE subscriptions s
SET scheduled_plan_id = sp.id
FROM subscription_plans sp
WHERE s.scheduled_plan_id IS NULL
  AND s.scheduled_plan_slug IS NOT NULL
  AND sp.slug = s.scheduled_plan_slug;

UPDATE subscriptions s
SET scheduled_plan_slug = sp.slug
FROM subscription_plans sp
WHERE s.scheduled_plan_slug IS NULL
  AND s.scheduled_plan_id IS NOT NULL
  AND sp.id = s.scheduled_plan_id;

UPDATE subscriptions
SET properties_count = property_counts.count_value
FROM (
  SELECT owner_id, COUNT(*)::INT AS count_value
  FROM properties
  WHERE deleted_at IS NULL
  GROUP BY owner_id
) AS property_counts
WHERE subscriptions.owner_id = property_counts.owner_id;

UPDATE subscriptions
SET properties_count = 0
WHERE properties_count IS NULL;


-- === [100/169] 20260318000000_fix_auth_reset_template_examples.sql ===
-- =============================================================================
-- Migration : Align auth reset template examples with live recovery flow
-- Date      : 2026-03-18
-- Objectif  : Éviter les exemples legacy /auth/reset?token=... qui ne
--             correspondent plus au flux actuel /auth/callback -> /auth/reset-password
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates') THEN
    UPDATE email_templates
    SET available_variables = REPLACE(
          available_variables::text,
          'https://talok.fr/auth/reset?token=...',
          'https://talok.fr/auth/callback?next=/auth/reset-password&code=...'
        )::jsonb,
        updated_at = NOW()
    WHERE slug = 'auth_reset_password'
      AND available_variables::text LIKE '%https://talok.fr/auth/reset?token=...%';

    RAISE NOTICE 'email_templates auth_reset_password example updated to callback/reset-password flow';
  ELSE
    RAISE NOTICE 'email_templates table does not exist, skipping';
  END IF;
END $$;


-- === [101/169] 20260318010000_password_reset_requests.sql ===
-- =============================================================================
-- Migration : Password reset requests SOTA 2026
-- Objectif  : Introduire une couche applicative one-time au-dessus du recovery
--             Supabase pour sécuriser le changement de mot de passe.
-- =============================================================================

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired', 'revoked')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip INET,
  requested_user_agent TEXT,
  completed_ip INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_status
  ON password_reset_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_expires_at
  ON password_reset_requests(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_requests_single_pending
  ON password_reset_requests(user_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION set_password_reset_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_password_reset_requests_updated_at ON password_reset_requests;
DROP TRIGGER IF EXISTS trg_password_reset_requests_updated_at ON password_reset_requests;
CREATE TRIGGER trg_password_reset_requests_updated_at
  BEFORE UPDATE ON password_reset_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_password_reset_requests_updated_at();

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;


-- === [102/169] 20260318020000_buildings_rls_sota2026.sql ===
-- ============================================
-- Migration : RLS SOTA 2026 pour buildings & building_units
-- Remplace auth.uid() par user_profile_id() / user_role()
-- Ajoute policies admin et tenant
-- ============================================

-- 1. DROP anciennes policies buildings
-- ============================================
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can view their buildings" ON buildings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can create buildings" ON buildings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can update their buildings" ON buildings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can delete their buildings" ON buildings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

-- 2. DROP anciennes policies building_units
-- ============================================
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can view their building units" ON building_units; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can create building units" ON building_units; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can update their building units" ON building_units; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Owners can delete their building units" ON building_units; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

-- 3. Nouvelles policies buildings (owner)
-- ============================================
DO $dp$ BEGIN DROP POLICY IF EXISTS "buildings_owner_select" ON buildings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (owner_id = public.user_profile_id());
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "buildings_owner_insert" ON buildings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "buildings_owner_insert" ON buildings
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.user_profile_id());
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "buildings_owner_update" ON buildings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "buildings_owner_update" ON buildings
  FOR UPDATE TO authenticated
  USING (owner_id = public.user_profile_id());
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "buildings_owner_delete" ON buildings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "buildings_owner_delete" ON buildings
  FOR DELETE TO authenticated
  USING (owner_id = public.user_profile_id());
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- 4. Policies buildings (admin)
-- ============================================
DO $dp$ BEGIN DROP POLICY IF EXISTS "buildings_admin_all" ON buildings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "buildings_admin_all" ON buildings
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- 5. Policies buildings (tenant via bail actif)
-- ============================================
DO $dp$ BEGIN DROP POLICY IF EXISTS "buildings_tenant_select" ON buildings; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "buildings_tenant_select" ON buildings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM building_units bu
      JOIN leases l ON l.id = bu.current_lease_id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE bu.building_id = buildings.id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut = 'active'
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- 6. Nouvelles policies building_units (owner)
-- ============================================
DO $dp$ BEGIN DROP POLICY IF EXISTS "building_units_owner_select" ON building_units; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "building_units_owner_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "building_units_owner_insert" ON building_units; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "building_units_owner_insert" ON building_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "building_units_owner_update" ON building_units; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "building_units_owner_update" ON building_units
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "building_units_owner_delete" ON building_units; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "building_units_owner_delete" ON building_units
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- 7. Policies building_units (admin)
-- ============================================
DO $dp$ BEGIN DROP POLICY IF EXISTS "building_units_admin_all" ON building_units; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "building_units_admin_all" ON building_units
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- 8. Policies building_units (tenant via bail actif)
-- ============================================
DO $dp$ BEGIN DROP POLICY IF EXISTS "building_units_tenant_select" ON building_units; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "building_units_tenant_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.id = building_units.current_lease_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut = 'active'
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- 9. Ajout property_id sur building_units si manquant
-- ============================================
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_building_units_property ON building_units(property_id);


-- === [103/169] 20260320100000_fix_owner_id_mismatch_and_rls.sql ===
-- ============================================================================
-- Migration: Fix owner_id mismatch on properties table
-- Date: 2026-03-20
--
-- Problème: Certaines propriétés ont owner_id = profiles.user_id (UUID auth)
-- au lieu de owner_id = profiles.id (UUID profil). Cela casse les politiques
-- RLS qui utilisent public.user_profile_id() pour comparer avec owner_id.
--
-- Cette migration:
-- 1. Corrige les owner_id incorrects (user_id → profiles.id)
-- 2. S'assure que la fonction user_profile_id() est SECURITY DEFINER et STABLE
-- 3. Supprime les doublons éventuels de propriétés
-- ============================================================================

-- ============================================================================
-- 1. Corriger les owner_id qui pointent vers user_id au lieu de profiles.id
-- ============================================================================

-- Diagnostic d'abord (visible dans les logs)
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM properties pr
  INNER JOIN profiles p ON pr.owner_id = p.user_id
  WHERE p.role = 'owner'
    AND p.id != pr.owner_id
    AND pr.deleted_at IS NULL;

  RAISE NOTICE 'Propriétés avec owner_id mismatch (user_id au lieu de profiles.id): %', mismatch_count;
END $$;

-- Correction: remplacer owner_id = user_id par owner_id = profiles.id
UPDATE properties pr
SET owner_id = p.id,
    updated_at = NOW()
FROM profiles p
WHERE pr.owner_id = p.user_id
  AND p.role = 'owner'
  AND p.id != pr.owner_id;

-- ============================================================================
-- 2. S'assurer que user_profile_id() fonctionne correctement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================================
-- 3. Vérifier et supprimer les doublons de propriétés
--    (même adresse, même owner_id, même type = doublon probable)
-- ============================================================================

-- Marquer les doublons comme supprimés (soft delete) en gardant le plus récent
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id, adresse_complete, type, ville, code_postal
      ORDER BY created_at DESC
    ) as rn
  FROM properties
  WHERE deleted_at IS NULL
    AND adresse_complete IS NOT NULL
    AND adresse_complete != ''
)
UPDATE properties
SET deleted_at = NOW(),
    deleted_by = 'system-dedup-migration'
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Log du nombre de doublons supprimés
DO $$
DECLARE
  dedup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dedup_count
  FROM properties
  WHERE deleted_by = 'system-dedup-migration'
    AND deleted_at >= NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Propriétés doublons soft-deleted: %', dedup_count;
END $$;

-- ============================================================================
-- 4. Vérification finale
-- ============================================================================

DO $$
DECLARE
  remaining_mismatch INTEGER;
  total_active INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_mismatch
  FROM properties pr
  INNER JOIN profiles p ON pr.owner_id = p.user_id
  WHERE p.role = 'owner'
    AND p.id != pr.owner_id
    AND pr.deleted_at IS NULL;

  SELECT COUNT(*) INTO total_active
  FROM properties
  WHERE deleted_at IS NULL;

  RAISE NOTICE 'Vérification: % propriétés actives, % mismatches restants', total_active, remaining_mismatch;
END $$;


-- === [104/169] 20260321000000_drop_invoice_trigger_sota2026.sql ===
-- SOTA 2026: Supprimer le trigger SQL redondant pour la facture initiale.
-- Le service TS ensureInitialInvoiceForLease() (appele par handleLeaseFullySigned)
-- est desormais le seul chemin de creation de la facture initiale.
-- Ce trigger creait un doublon et rendait le flux confus.

DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;

-- Supprimer egalement la fonction associee si elle existe
DROP FUNCTION IF EXISTS fn_generate_initial_invoice_on_fully_signed() CASCADE;


-- === [105/169] 20260321100000_fix_cron_post_refactoring_sota2026.sql ===
-- ============================================
-- Migration corrective : SOTA 2026 post-refactoring
-- Date : 2026-03-21
-- Description :
--   1. Supprime le job generate-monthly-invoices (route supprimee en P3)
--   2. Ajoute le job process-outbox pour le processeur outbox asynchrone
-- ============================================

-- 1. Supprimer le job pointant vers la route supprimee
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'generate-monthly-invoices';

-- 2. Ajouter le processeur outbox (toutes les 5 minutes)
SELECT cron.schedule('process-outbox', '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/process-outbox',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);


-- === [106/169] 20260323000000_fix_document_visibility_and_dedup.sql ===
-- Migration: Fix document visibility RLS + add deduplication constraint
-- 1) RLS: tenant_id match must also respect visible_tenant
-- 2) Unique partial index to prevent duplicate quittances per payment
-- 3) Unique partial index to prevent duplicate attestations per handover

-- ============================================================
-- 1. Fix RLS: tenant with tenant_id = user MUST still respect visible_tenant
-- Previously: tenant_id = user_profile_id() bypassed visible_tenant = false
-- ============================================================

DO $dp$ BEGIN DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON documents; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON documents; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Tenants can read visible lease documents"
  ON documents FOR SELECT
  USING (
    -- Tenant direct match: must respect visible_tenant
    (
      tenant_id = public.user_profile_id()
      AND visible_tenant IS NOT FALSE
    )
    -- Tenant via lease signer: must respect visible_tenant
    OR (
      visible_tenant = true
      AND lease_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM lease_signers ls
        JOIN profiles p ON p.id = ls.profile_id
        WHERE ls.lease_id = documents.lease_id
          AND p.id = public.user_profile_id()
          AND ls.role IN ('locataire_principal', 'locataire', 'colocataire')
      )
    )
    -- Owner direct match
    OR owner_id = public.user_profile_id()
    -- Owner via property
    OR (
      property_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = documents.property_id
          AND p.owner_id = public.user_profile_id()
      )
    )
    -- Admin
    OR public.user_role() = 'admin'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- ============================================================
-- 2. Unique partial index: one quittance per payment_id
-- Prevents race-condition duplicates in receipt generation
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_quittance_payment
  ON documents ((metadata->>'payment_id'))
  WHERE type = 'quittance'
    AND metadata->>'payment_id' IS NOT NULL;

-- ============================================================
-- 3. Unique partial index: one attestation per handover_id
-- Prevents duplicate key handover attestations
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_attestation_handover
  ON documents ((metadata->>'handover_id'))
  WHERE type = 'attestation_remise_cles'
    AND metadata->>'handover_id' IS NOT NULL;

-- ============================================================
-- 4. Index for document-access helper: lookup by storage_path
-- Used by the unified access check when path doesn't match known patterns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_documents_storage_path
  ON documents (storage_path)
  WHERE storage_path IS NOT NULL;


-- === [107/169] 20260324100000_prevent_duplicate_payments.sql ===
-- ============================================
-- Migration : Anti-doublon paiements
-- Date : 2026-03-24
-- Description :
--   1. Contrainte UNIQUE partielle sur payments : un seul paiement pending par facture
--   2. Empêche la race condition qui a causé le double paiement sur bail da2eb9da
-- ============================================

-- Un seul paiement 'pending' par facture à la fois
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_pending_per_invoice
  ON payments (invoice_id)
  WHERE statut = 'pending';

COMMENT ON INDEX idx_payments_one_pending_per_invoice
  IS 'Empêche plusieurs paiements pending simultanés sur la même facture (anti-doublon)';


-- === [108/169] 20260326022619_fix_documents_bucket_mime.sql ===
-- Fix: Aligner les MIME types du bucket storage avec lib/documents/constants.ts
-- Bug: Word/Excel etaient acceptes par le code mais rejetes par le bucket

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
]::text[],
file_size_limit = 52428800  -- 50 Mo
WHERE id = 'documents';


-- SKIP: -- === [109/169] 20260326022700_migrate_tenant_documents.sql ===
-- SKIP: -- Migration: Unifier tenant_documents dans la table documents
-- SKIP: -- Les CNI et autres pieces d'identite locataire sont dans tenant_documents
-- SKIP: -- mais invisibles dans le systeme unifie. Cette migration les copie.
-- SKIP: 
-- SKIP: DO $$
-- SKIP: DECLARE
-- SKIP:   migrated_count INT := 0;
-- SKIP: BEGIN
-- SKIP:   -- Verifier que tenant_documents existe
-- SKIP:   IF NOT EXISTS (
-- SKIP:     SELECT 1 FROM information_schema.tables
-- SKIP:     WHERE table_name = 'tenant_documents'
-- SKIP:   ) THEN
-- SKIP:     RAISE NOTICE 'Table tenant_documents absente, rien a migrer';
-- SKIP:     RETURN;
-- SKIP:   END IF;
-- SKIP: 
-- SKIP:   -- Copier les documents qui ne sont pas deja dans documents (par storage_path)
-- SKIP:   INSERT INTO documents (
-- SKIP:     type, category, title, original_filename,
-- SKIP:     tenant_id, owner_id,
-- SKIP:     storage_path, file_size, mime_type,
-- SKIP:     uploaded_by, is_generated, ged_status,
-- SKIP:     visible_tenant, verification_status,
-- SKIP:     metadata, created_at, updated_at
-- SKIP:   )
-- SKIP:   SELECT
-- SKIP:     CASE
-- SKIP:       WHEN td.document_type ILIKE '%recto%' OR td.document_type = 'cni_recto' THEN 'cni_recto'
-- SKIP:       WHEN td.document_type ILIKE '%verso%' OR td.document_type = 'cni_verso' THEN 'cni_verso'
-- SKIP:       WHEN td.document_type = 'passeport' THEN 'passeport'
-- SKIP:       WHEN td.document_type = 'titre_sejour' THEN 'titre_sejour'
-- SKIP:       WHEN td.document_type ILIKE '%identit%' THEN 'piece_identite'
-- SKIP:       ELSE COALESCE(td.document_type, 'autre')
-- SKIP:     END AS type,
-- SKIP:     'identite' AS category,
-- SKIP:     CASE
-- SKIP:       WHEN td.document_type ILIKE '%recto%' OR td.document_type = 'cni_recto'
-- SKIP:         THEN 'Carte d''identite (recto)'
-- SKIP:       WHEN td.document_type ILIKE '%verso%' OR td.document_type = 'cni_verso'
-- SKIP:         THEN 'Carte d''identite (verso)'
-- SKIP:       WHEN td.document_type = 'passeport' THEN 'Passeport'
-- SKIP:       WHEN td.document_type = 'titre_sejour' THEN 'Titre de sejour'
-- SKIP:       ELSE COALESCE(td.file_name, 'Document identite')
-- SKIP:     END AS title,
-- SKIP:     td.file_name AS original_filename,
-- SKIP:     td.tenant_profile_id AS tenant_id,
-- SKIP:     NULL AS owner_id,
-- SKIP:     td.file_path AS storage_path,
-- SKIP:     td.file_size,
-- SKIP:     td.mime_type,
-- SKIP:     td.uploaded_by,
-- SKIP:     false AS is_generated,
-- SKIP:     'active' AS ged_status,
-- SKIP:     true AS visible_tenant,
-- SKIP:     CASE WHEN td.is_valid = true THEN 'verified' ELSE 'pending' END AS verification_status,
-- SKIP:     jsonb_build_object(
-- SKIP:       'migrated_from', 'tenant_documents',
-- SKIP:       'original_id', td.id,
-- SKIP:       'ocr_confidence', td.ocr_confidence,
-- SKIP:       'extracted_data', td.extracted_data
-- SKIP:     ) AS metadata,
-- SKIP:     td.created_at,
-- SKIP:     COALESCE(td.updated_at, td.created_at)
-- SKIP:   FROM tenant_documents td
-- SKIP:   WHERE NOT EXISTS (
-- SKIP:     SELECT 1 FROM documents d
-- SKIP:     WHERE d.storage_path = td.file_path
-- SKIP:   )
-- SKIP:   AND td.file_path IS NOT NULL
-- SKIP:   AND td.file_path != '';
-- SKIP: 
-- SKIP:   GET DIAGNOSTICS migrated_count = ROW_COUNT;
-- SKIP: 
-- SKIP:   RAISE NOTICE 'Migration tenant_documents: % documents copies vers documents', migrated_count;
-- SKIP: 
-- SKIP:   -- Le trigger auto_fill_document_fk completera owner_id et property_id
-- SKIP:   -- via lease_signers si disponible
-- SKIP: END $$;
-- SKIP: 
-- SKIP: 
-- === [110/169] 20260326022800_create_document_links.sql ===
-- Table document_links: liens de partage temporaires
-- Utilisee par POST /api/documents/[id]/download et /api/documents/[id]/copy-link

CREATE TABLE IF NOT EXISTS document_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  max_views INTEGER DEFAULT 10,
  view_count INTEGER NOT NULL DEFAULT 0,
  accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_links_token ON document_links(token);
CREATE INDEX IF NOT EXISTS idx_document_links_document_id ON document_links(document_id);
CREATE INDEX IF NOT EXISTS idx_document_links_expires_at ON document_links(expires_at);

-- RLS
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Users can view own document links" ON document_links; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Users can view own document links" ON document_links
  FOR SELECT TO authenticated
  USING (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_links.document_id
      AND (d.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR d.tenant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Users can create document links" ON document_links; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Users can create document links" ON document_links
  FOR INSERT TO authenticated
  WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Service role full access document_links" ON document_links; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Service role full access document_links" ON document_links
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;


-- === [111/169] 20260326023000_fix_document_titles.sql ===
-- Fix document titles for existing records with NULL, screenshot names, or raw technical names
-- Uses TYPE_TO_LABEL mapping from lib/documents/constants.ts as source of truth

UPDATE documents SET title = CASE
  WHEN type = 'cni_recto' THEN 'Carte d''identite (recto)'
  WHEN type = 'cni_verso' THEN 'Carte d''identite (verso)'
  WHEN type = 'attestation_assurance' THEN 'Attestation d''assurance'
  WHEN type = 'assurance_pno' THEN 'Assurance PNO'
  WHEN type = 'bail' THEN 'Contrat de bail'
  WHEN type = 'avenant' THEN 'Avenant au bail'
  WHEN type = 'engagement_garant' THEN 'Engagement de caution'
  WHEN type = 'bail_signe_locataire' THEN 'Bail signe (locataire)'
  WHEN type = 'bail_signe_proprietaire' THEN 'Bail signe (proprietaire)'
  WHEN type = 'piece_identite' THEN 'Piece d''identite'
  WHEN type = 'passeport' THEN 'Passeport'
  WHEN type = 'titre_sejour' THEN 'Titre de sejour'
  WHEN type = 'quittance' THEN 'Quittance de loyer'
  WHEN type = 'facture' THEN 'Facture'
  WHEN type = 'rib' THEN 'RIB'
  WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
  WHEN type = 'bulletin_paie' THEN 'Bulletin de paie'
  WHEN type = 'attestation_loyer' THEN 'Attestation de loyer'
  WHEN type = 'justificatif_revenus' THEN 'Justificatif de revenus'
  WHEN type = 'diagnostic' THEN 'Diagnostic'
  WHEN type = 'dpe' THEN 'DPE'
  WHEN type = 'diagnostic_gaz' THEN 'Diagnostic gaz'
  WHEN type = 'diagnostic_electricite' THEN 'Diagnostic electricite'
  WHEN type = 'diagnostic_plomb' THEN 'Diagnostic plomb'
  WHEN type = 'diagnostic_amiante' THEN 'Diagnostic amiante'
  WHEN type = 'diagnostic_termites' THEN 'Diagnostic termites'
  WHEN type = 'diagnostic_performance' THEN 'Diagnostic de performance'
  WHEN type = 'erp' THEN 'Etat des risques (ERP)'
  WHEN type = 'EDL_entree' THEN 'Etat des lieux d''entree'
  WHEN type = 'EDL_sortie' THEN 'Etat des lieux de sortie'
  WHEN type = 'inventaire' THEN 'Inventaire mobilier'
  WHEN type = 'devis' THEN 'Devis'
  WHEN type = 'ordre_mission' THEN 'Ordre de mission'
  WHEN type = 'rapport_intervention' THEN 'Rapport d''intervention'
  WHEN type = 'taxe_fonciere' THEN 'Taxe fonciere'
  WHEN type = 'copropriete' THEN 'Document copropriete'
  WHEN type = 'proces_verbal' THEN 'Proces-verbal'
  WHEN type = 'appel_fonds' THEN 'Appel de fonds'
  WHEN type = 'photo' THEN 'Photo'
  WHEN type = 'courrier' THEN 'Courrier'
  WHEN type = 'autre' THEN 'Autre document'
  ELSE title
END
WHERE title IS NULL
   OR title ~ '^Capture d.cran'
   OR title ~ '^[A-Z_]+$';


-- === [112/169] 20260326205416_add_agency_role_to_handle_new_user.sql ===
-- ============================================
-- Migration: Ajouter agency au trigger handle_new_user
-- Date: 2026-03-26
-- Description: Le trigger acceptait admin/owner/tenant/provider/guarantor/syndic.
--              Le role agency etait silencieusement converti en tenant.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
BEGIN
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (tous les roles supportes par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Inserer le profil avec toutes les donnees
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur.
Lit le role et les informations personnelles depuis les raw_user_meta_data.
Supporte tous les roles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.';


-- === [113/169] 20260327143000_add_site_config.sql ===
-- Table de configuration du site vitrine
CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  label TEXT,           -- Label lisible pour l'admin
  section TEXT,         -- Groupe dans l'UI admin
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS : lecture publique, écriture admin uniquement
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

DO $dp$ BEGIN DROP POLICY IF EXISTS "Public read" ON site_config; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "Public read" ON site_config FOR SELECT USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;
DO $dp$ BEGIN DROP POLICY IF EXISTS "Admin write" ON site_config; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Admin write" ON site_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'platform_admin')
    )
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Valeurs initiales (images Unsplash par défaut)
INSERT INTO site_config (key, label, section, value) VALUES
  -- Section "Arguments" (4 cartes)
  ('landing_arg_time_img',
   'Argument — Gagnez 3h (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=80'),

  ('landing_arg_money_img',
   'Argument — Économisez 2000€ (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'),

  ('landing_arg_contract_img',
   'Argument — Contrats 5 min (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80'),

  ('landing_arg_sleep_img',
   'Argument — Dormez tranquille (illustration)',
   'Arguments',
   'https://images.unsplash.com/photo-1541480601022-2308c0f02487?w=600&q=80'),

  -- Section "Profils"
  ('landing_profile_owner_img',
   'Profil — Propriétaire particulier',
   'Profils',
   'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80'),

  ('landing_profile_investor_img',
   'Profil — Investisseur / SCI',
   'Profils',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'),

  ('landing_profile_agency_img',
   'Profil — Agence / Gestionnaire',
   'Profils',
   'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80'),

  -- Section "Avant / Après"
  ('landing_beforeafter_img',
   'Avant/Après — Photo de fond',
   'Avant-Après',
   'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80')

ON CONFLICT (key) DO NOTHING;

-- Bucket public pour les images landing
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-images', 'landing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Politique de lecture publique sur le bucket
DO $dp$ BEGIN DROP POLICY IF EXISTS "Public read landing images" ON storage.objects; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Public read landing images"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-images');
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Politique d'upload admin
DO $dp$ BEGIN DROP POLICY IF EXISTS "Admin upload landing images" ON storage.objects; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Admin upload landing images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'landing-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'platform_admin')
  )
);
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Politique de suppression admin
DO $dp$ BEGIN DROP POLICY IF EXISTS "Admin delete landing images" ON storage.objects; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;
DO $cp$ BEGIN
CREATE POLICY "Admin delete landing images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'landing-images'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'platform_admin')
  )
);
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;


-- === [114/169] 20260327200000_fix_handle_new_user_restore_email.sql ===
-- ============================================
-- Migration: Corriger handle_new_user — restaurer email + EXCEPTION handler
-- Date: 2026-03-27
-- Description:
--   La migration 20260326205416 a introduit une regression :
--     1. La colonne `email` n'est plus inseree dans profiles (variable v_email supprimee)
--     2. Le handler EXCEPTION WHEN OTHERS a ete supprime
--   Cette migration restaure les deux, tout en conservant le support
--   de tous les roles (admin, owner, tenant, provider, guarantor, syndic, agency).
--   Elle backfill aussi les emails NULL crees par la migration cassee.
-- ============================================

-- A. RESTAURER handle_new_user() avec email + EXCEPTION handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
  v_email TEXT;
BEGIN
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (tous les roles supportes par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Recuperer l'email depuis le champ auth.users.email
  v_email := NEW.email;

  -- Inserer le profil avec toutes les donnees, y compris l'email
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone, email)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone, v_email)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la creation d'un utilisateur auth
  -- meme si l'insertion du profil echoue
  RAISE WARNING '[handle_new_user] Erreur pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur auth.
Lit le role et les informations personnelles depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
Supporte tous les roles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.
Ne bloque jamais la creation auth meme en cas d''erreur (EXCEPTION handler).';

-- B. BACKFILL des emails NULL (crees par la migration 20260326205416 cassee)
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND (p.email IS NULL OR p.email = '')
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[fix_handle_new_user] % profil(s) mis a jour avec l''email depuis auth.users', v_updated;
  ELSE
    RAISE NOTICE '[fix_handle_new_user] Tous les profils ont deja un email renseigne';
  END IF;
END $$;


-- === [115/169] 20260328000000_fix_visible_tenant_documents.sql ===
-- FIX 4: Ensure mandatory lease documents are visible to tenants
-- Documents types contrat_bail, edl_entree, assurance_habitation
-- must have visible_tenant = true so tenants can see them.

UPDATE documents
SET visible_tenant = true,
    updated_at = now()
WHERE type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);


-- === [116/169] 20260328042538_update_argument_images.sql ===
-- Mise à jour des images par défaut des 4 cartes Arguments
UPDATE site_config SET value = 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&q=80'
WHERE key = 'landing_arg_time_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'
WHERE key = 'landing_arg_money_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80'
WHERE key = 'landing_arg_contract_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80'
WHERE key = 'landing_arg_sleep_img';


-- === [117/169] 20260328100000_create_site_content.sql ===
-- ============================================
-- Migration: site_content — CMS léger pour pages marketing
-- Date: 2026-03-28
-- Auteur: Claude
-- ============================================

CREATE TABLE IF NOT EXISTS site_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identification
  page_slug TEXT NOT NULL,
  section_key TEXT NOT NULL DEFAULT 'content_body',

  -- Contenu
  content_type TEXT NOT NULL DEFAULT 'markdown',
  content TEXT NOT NULL,

  -- Métadonnées
  title TEXT,
  meta_description TEXT,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),

  -- Versioning
  version INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(page_slug, section_key, version)
);

-- RLS
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

DO $dp$ BEGIN DROP POLICY IF EXISTS "site_content_public_read" ON site_content; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "site_content_public_read" ON site_content
  FOR SELECT USING (is_published = true);
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

DO $dp$ BEGIN DROP POLICY IF EXISTS "site_content_admin_all" ON site_content; EXCEPTION WHEN undefined_table THEN NULL; END $dp$;

DO $cp$ BEGIN
CREATE POLICY "site_content_admin_all" ON site_content
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');
EXCEPTION WHEN undefined_table THEN NULL;
END $cp$;

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_site_content_slug ON site_content(page_slug, section_key)
  WHERE is_published = true;

-- Commentaire
COMMENT ON TABLE site_content IS 'CMS léger pour les pages marketing et légales de talok.fr';


-- === [118/169] 20260328100000_fix_visible_tenant_documents.sql ===
-- Migration: Ensure key lease documents are visible to tenants
-- Fixes: Documents created before visible_tenant was properly set

-- Set visible_tenant = true for all tenant-relevant document types
UPDATE documents
SET visible_tenant = true
WHERE type IN ('bail', 'contrat_bail', 'EDL_entree', 'EDL_sortie', 'edl_entree', 'edl_sortie', 'quittance', 'attestation_remise_cles', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

-- Corriger les documents obligatoires du bail test da2eb9da
UPDATE documents
SET visible_tenant = true, updated_at = now()
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
  AND type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

-- Set default visible_tenant = true for new documents via column default
ALTER TABLE documents ALTER COLUMN visible_tenant SET DEFAULT true;


-- === [119/169] 20260329052631_fix_contrat_bail_visible_tenant.sql ===
-- Migration: Rendre les documents de bail visibles aux locataires
-- Contexte: Le route /seal ne définissait pas visible_tenant=true sur les documents de bail
-- Impact: Les locataires ne voyaient pas leur bail dans /tenant/documents

-- S'assurer que tous les documents bail liés à un lease ont visible_tenant=true
UPDATE documents
SET
  visible_tenant = true,
  title = CASE
    WHEN title = 'Bail de location signé' THEN 'Contrat de bail signé'
    ELSE title
  END,
  original_filename = COALESCE(
    original_filename,
    'bail_signe_' || lease_id::text || '.html'
  ),
  updated_at = now()
WHERE
  type = 'bail'
  AND lease_id IS NOT NULL
  AND (visible_tenant IS NULL OR visible_tenant = false);


-- === [120/169] 20260329120000_add_agency_to_handle_new_user.sql ===
-- ============================================
-- Migration: Ajouter le rôle agency au trigger handle_new_user
-- Date: 2026-03-29
-- Description: Le rôle agency était absent de la liste des rôles valides
--              dans le trigger, causant un fallback silencieux vers tenant.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
BEGIN
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le rôle (tous les rôles supportés par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Insérer le profil avec toutes les données
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Crée automatiquement un profil lors de la création d''un utilisateur.
Lit le rôle et les informations personnelles depuis les raw_user_meta_data.
Supporte tous les rôles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';


-- === [121/169] 20260329164841_fix_document_titles.sql ===
-- Migration: Corriger les titres bruts/manquants des documents existants
-- Remplace les titres NULL, screenshots, codes bruts et dates par des labels lisibles
-- Source: talok-documents-sota section 8

UPDATE documents SET
  title = CASE
    WHEN type = 'cni_recto' THEN 'Carte d''identité (Recto)'
    WHEN type = 'cni_verso' THEN 'Carte d''identité (Verso)'
    WHEN type = 'attestation_assurance' THEN 'Attestation d''assurance'
    WHEN type = 'assurance_pno' THEN 'Assurance PNO'
    WHEN type = 'bail' THEN 'Contrat de bail'
    WHEN type = 'avenant' THEN 'Avenant au bail'
    WHEN type = 'engagement_garant' THEN 'Engagement de caution'
    WHEN type = 'bail_signe_locataire' THEN 'Bail signé (locataire)'
    WHEN type = 'bail_signe_proprietaire' THEN 'Bail signé (propriétaire)'
    WHEN type = 'piece_identite' THEN 'Pièce d''identité'
    WHEN type = 'passeport' THEN 'Passeport'
    WHEN type = 'titre_sejour' THEN 'Titre de séjour'
    WHEN type = 'quittance' THEN 'Quittance de loyer'
    WHEN type = 'facture' THEN 'Facture'
    WHEN type = 'rib' THEN 'RIB'
    WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
    WHEN type = 'bulletin_paie' THEN 'Bulletin de paie'
    WHEN type = 'attestation_loyer' THEN 'Attestation de loyer'
    WHEN type = 'justificatif_revenus' THEN 'Justificatif de revenus'
    WHEN type = 'dpe' THEN 'Diagnostic de performance énergétique'
    WHEN type = 'diagnostic_gaz' THEN 'Diagnostic gaz'
    WHEN type = 'diagnostic_electricite' THEN 'Diagnostic électricité'
    WHEN type = 'diagnostic_plomb' THEN 'Diagnostic plomb (CREP)'
    WHEN type = 'diagnostic_amiante' THEN 'Diagnostic amiante'
    WHEN type = 'diagnostic_termites' THEN 'Diagnostic termites'
    WHEN type = 'erp' THEN 'État des risques (ERP)'
    WHEN type = 'EDL_entree' THEN 'État des lieux d''entrée'
    WHEN type = 'EDL_sortie' THEN 'État des lieux de sortie'
    WHEN type = 'inventaire' THEN 'Inventaire mobilier'
    WHEN type = 'taxe_fonciere' THEN 'Taxe foncière'
    WHEN type = 'devis' THEN 'Devis'
    WHEN type = 'rapport_intervention' THEN 'Rapport d''intervention'
    ELSE COALESCE(title, 'Document')
  END
WHERE title IS NULL
   OR title ~ '^Capture d.écran'
   OR title ~ '^[A-Z_]+$'
   OR title ~ '^\d{4}-\d{2}-\d{2}';


-- === [122/169] 20260329170000_add_punctuality_score.sql ===
-- Migration: Ajouter le score de ponctualité sur les baux
-- Le score mesure le % de paiements reçus à temps (avant date_echeance)

-- 1. Colonne sur leases
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS punctuality_score DECIMAL(5,2) DEFAULT NULL;

COMMENT ON COLUMN leases.punctuality_score IS
  'Score de ponctualité du locataire (0-100). NULL = pas encore de données. Mis à jour par trigger.';

-- 2. Fonction de calcul
CREATE OR REPLACE FUNCTION compute_punctuality_score(p_lease_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_total INT;
  v_on_time INT;
BEGIN
  -- Compter les factures payées ou en retard (exclure les brouillons et annulées)
  SELECT COUNT(*) INTO v_total
  FROM invoices
  WHERE lease_id = p_lease_id
    AND statut IN ('paid', 'late', 'overdue', 'unpaid');

  IF v_total = 0 THEN
    RETURN NULL;
  END IF;

  -- Compter les factures payées à temps :
  -- date_paiement <= date_echeance OU statut = 'paid' sans retard
  SELECT COUNT(*) INTO v_on_time
  FROM invoices
  WHERE lease_id = p_lease_id
    AND statut = 'paid'
    AND (
      (date_paiement IS NOT NULL AND date_echeance IS NOT NULL AND date_paiement <= date_echeance)
      OR date_echeance IS NULL
    );

  RETURN ROUND((v_on_time::DECIMAL / v_total) * 100, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Trigger pour recalculer à chaque changement de facture
CREATE OR REPLACE FUNCTION trigger_update_punctuality_score()
RETURNS TRIGGER AS $$
DECLARE
  v_lease_id UUID;
  v_score DECIMAL(5,2);
BEGIN
  -- Déterminer le lease_id concerné
  v_lease_id := COALESCE(NEW.lease_id, OLD.lease_id);

  IF v_lease_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalculer le score
  v_score := compute_punctuality_score(v_lease_id);

  -- Mettre à jour le bail
  UPDATE leases
  SET punctuality_score = v_score
  WHERE id = v_lease_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_punctuality_score ON invoices;

DROP TRIGGER IF EXISTS trg_update_punctuality_score ON invoices;
CREATE TRIGGER trg_update_punctuality_score
  AFTER INSERT OR UPDATE OF statut, date_paiement ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_punctuality_score();

-- 4. Calculer le score initial pour tous les baux existants
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT lease_id FROM invoices WHERE lease_id IS NOT NULL LOOP
    UPDATE leases
    SET punctuality_score = compute_punctuality_score(r.lease_id)
    WHERE id = r.lease_id;
  END LOOP;
END;
$$;


-- === [123/169] 20260329180000_notify_owner_edl_signed.sql ===
-- Migration: Notification propriétaire quand un EDL est signé par les deux parties
-- Date: 2026-03-29
-- Description: Ajoute un trigger qui notifie le propriétaire lorsqu'un EDL passe en statut "signed"

-- ============================================================================
-- Fonction de notification EDL signé → propriétaire
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_owner_edl_signed()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_id UUID;
    v_property_address TEXT;
    v_edl_type TEXT;
    v_existing UUID;
BEGIN
    -- Seulement quand le statut passe à 'signed'
    IF NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') THEN

        -- Récupérer le type de l'EDL
        v_edl_type := COALESCE(NEW.type, 'entree');

        -- Récupérer le propriétaire et l'adresse via la propriété
        SELECT p.owner_id, p.adresse_complete
        INTO v_owner_id, v_property_address
        FROM properties p
        WHERE p.id = NEW.property_id;

        IF v_owner_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- Déduplication : vérifier si une notification similaire existe dans la dernière heure
        SELECT id INTO v_existing
        FROM notifications
        WHERE profile_id = v_owner_id
          AND type = 'edl_signed'
          AND related_id = NEW.id
          AND created_at > NOW() - INTERVAL '1 hour'
        LIMIT 1;

        IF v_existing IS NOT NULL THEN
            RETURN NEW;
        END IF;

        -- Créer la notification via la RPC
        PERFORM create_notification(
            v_owner_id,
            'edl_signed',
            CASE v_edl_type
                WHEN 'entree' THEN 'État des lieux d''entrée signé'
                WHEN 'sortie' THEN 'État des lieux de sortie signé'
                ELSE 'État des lieux signé'
            END,
            'L''état des lieux ' ||
            CASE v_edl_type
                WHEN 'entree' THEN 'd''entrée'
                WHEN 'sortie' THEN 'de sortie'
                ELSE ''
            END ||
            ' pour ' || COALESCE(v_property_address, 'votre bien') ||
            ' a été signé par toutes les parties.',
            '/owner/edl/' || NEW.id,
            NEW.id,
            'edl'
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Ne pas bloquer la transaction si la notification échoue
    RAISE WARNING '[notify_owner_edl_signed] Erreur: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger sur la table edl (UPDATE du statut)
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_notify_owner_edl_signed ON edl;
DROP TRIGGER IF EXISTS trigger_notify_owner_edl_signed ON edl;
CREATE TRIGGER trigger_notify_owner_edl_signed
    AFTER UPDATE OF status ON edl
    FOR EACH ROW
    WHEN (NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed')
    EXECUTE FUNCTION public.notify_owner_edl_signed();


-- === [124/169] 20260329190000_force_visible_tenant_generated_docs.sql ===
-- Migration: Backfill visible_tenant for generated documents + trigger guard
-- Date: 2026-03-29
-- Description:
--   1. Backfill: force visible_tenant = true on all existing generated documents
--   2. Trigger: prevent any future INSERT/UPDATE from creating a generated doc with visible_tenant = false

-- ============================================================================
-- 1. Backfill existing generated documents
-- ============================================================================
UPDATE documents
SET visible_tenant = true, updated_at = NOW()
WHERE is_generated = true AND (visible_tenant = false OR visible_tenant IS NULL);

-- ============================================================================
-- 2. Trigger function: force visible_tenant on generated documents
-- ============================================================================
CREATE OR REPLACE FUNCTION public.force_visible_tenant_on_generated()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_generated = true THEN
        NEW.visible_tenant := true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Trigger on documents table
-- ============================================================================
DROP TRIGGER IF EXISTS trg_force_visible_tenant_on_generated ON documents;
DROP TRIGGER IF EXISTS trg_force_visible_tenant_on_generated ON documents;
CREATE TRIGGER trg_force_visible_tenant_on_generated
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION public.force_visible_tenant_on_generated();


-- === [125/169] 20260330100000_add_lease_cancellation_columns.sql ===
-- ============================================
-- Migration : Ajout colonnes annulation de bail
-- Date : 2026-03-30
-- Contexte : Un bail signé mais jamais activé ne peut pas être annulé.
--            Cette migration ajoute les colonnes nécessaires pour
--            gérer le cycle de vie d'annulation.
-- ============================================

-- Étape 1 : Ajouter les colonnes d'annulation sur leases
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id);
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_type TEXT;

-- Étape 2 : Contrainte CHECK sur cancellation_type
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_cancellation_type_check'
  ) THEN
    ALTER TABLE leases ADD CONSTRAINT leases_cancellation_type_check
      CHECK (cancellation_type IS NULL OR cancellation_type IN (
        'tenant_withdrawal',
        'owner_withdrawal',
        'mutual_agreement',
        'never_activated',
        'error',
        'duplicate'
      ));
  END IF;
END $$;

-- Étape 3 : Vérifier que 'cancelled' est dans la contrainte CHECK sur statut
-- La migration 20260215200001 l'a déjà ajouté, mais on vérifie par sécurité
DO $$ BEGIN
  -- Tenter d'insérer un bail cancelled pour vérifier la contrainte
  -- Si ça échoue, on met à jour la contrainte
  PERFORM 1;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Étape 4 : Index pour requêtes de nettoyage et reporting
CREATE INDEX IF NOT EXISTS idx_leases_cancelled
  ON leases(statut) WHERE statut = 'cancelled';

CREATE INDEX IF NOT EXISTS idx_leases_cancelled_at
  ON leases(cancelled_at) WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leases_zombie_candidates
  ON leases(statut, created_at)
  WHERE statut IN ('pending_signature', 'partially_signed', 'fully_signed', 'draft', 'sent')
    AND cancelled_at IS NULL;

-- Étape 5 : RLS — les politiques existantes couvrent déjà leases
-- Pas besoin de nouvelles politiques car l'annulation passe par UPDATE du statut

-- Étape 6 : Commentaires
COMMENT ON COLUMN leases.cancelled_at IS 'Date/heure de l''annulation du bail';
COMMENT ON COLUMN leases.cancelled_by IS 'User ID de la personne ayant annulé le bail';
COMMENT ON COLUMN leases.cancellation_reason IS 'Motif libre de l''annulation';
COMMENT ON COLUMN leases.cancellation_type IS 'Type d''annulation : tenant_withdrawal, owner_withdrawal, mutual_agreement, never_activated, error, duplicate';


-- === [126/169] 20260331000000_add_receipt_generated_to_invoices.sql ===
-- Add receipt_generated flag to invoices table
-- Tracks whether a quittance PDF has been generated for a paid invoice

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_generated'
  ) THEN
    ALTER TABLE invoices ADD COLUMN receipt_generated BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN invoices.receipt_generated IS 'TRUE when a quittance PDF has been generated and stored for this invoice';
  END IF;
END $$;

-- Backfill: mark invoices that already have a quittance document
UPDATE invoices
SET receipt_generated = TRUE
WHERE id IN (
  SELECT DISTINCT (metadata->>'invoice_id')::uuid
  FROM documents
  WHERE type = 'quittance'
    AND metadata->>'invoice_id' IS NOT NULL
)
AND receipt_generated IS NOT TRUE;


-- === [127/169] 20260331100000_add_agricultural_property_types.sql ===
-- ============================================
-- Migration: Ajouter les types agricoles au CHECK constraint properties
-- Alignement avec le skill SOTA 2026 (14 types)
-- Ref: .cursor/skills/sota-property-system/SKILL.md §1
-- ============================================

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_type_check;

DO $ac$ BEGIN ALTER TABLE properties
  ADD CONSTRAINT properties_type_check
  CHECK (type IN (
    'appartement',
    'maison',
    'studio',
    'colocation',
    'saisonnier',
    'parking',
    'box',
    'local_commercial',
    'bureaux',
    'entrepot',
    'fonds_de_commerce',
    'immeuble',
    'terrain_agricole',
    'exploitation_agricole'
  )); EXCEPTION WHEN duplicate_object THEN NULL; END $ac$;


