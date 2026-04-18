-- ====================================================================
-- Sprint B2 — Phase 3 DANGEREUX — Batch 3/11
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260305000001_invoice_engine_fields.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260305000001_invoice_engine_fields.sql'; END $pre$;

-- ============================================
-- Migration : Moteur de facturation locative — Champs, tables et triggers
-- Date : 2026-03-05
-- Description :
--   1. Ajout des champs manquants dans leases (grace_period_days, invoice_engine_started, first_invoice_date, late_fee_rate)
--   2. Ajout des champs manquants dans invoices (period_start, period_end, generated_at, sent_at, paid_at, stripe_payment_intent_id, notes)
--   3. Extension des statuts invoices (partial, overdue, unpaid, cancelled)
--   4. Ajout colonne tenant_id dans payments (dénormalisation pour RLS)
--   5. Création tables : payment_reminders, late_fees, receipts, tenant_credit_score
--   6. RLS sur les nouvelles tables
--   7. DB trigger sur leases.statut → 'active' → appel invoice-engine-start
-- ============================================

-- =====================
-- 1. Champs manquants leases
-- =====================

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 3;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS invoice_engine_started BOOLEAN DEFAULT false;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS first_invoice_date DATE;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS late_fee_rate DECIMAL(10,6) DEFAULT 0.002740;

COMMENT ON COLUMN leases.grace_period_days IS 'Nombre de jours de grâce avant relance (défaut: 3)';
COMMENT ON COLUMN leases.invoice_engine_started IS 'Indique si le moteur de facturation a été déclenché pour ce bail';
COMMENT ON COLUMN leases.first_invoice_date IS 'Date de la première facture à générer (calculée au prorata si bail en cours de mois)';
COMMENT ON COLUMN leases.late_fee_rate IS 'Taux journalier de pénalité de retard (défaut: taux légal / 365 ≈ 0.00274)';

-- =====================
-- 2. Champs manquants invoices
-- =====================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS period_start DATE;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS period_end DATE;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Étendre les statuts possibles des invoices
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_statut_check;
DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_statut_check
  CHECK (statut IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'unpaid', 'cancelled', 'late'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- Index pour la recherche de factures en retard
CREATE INDEX IF NOT EXISTS idx_invoices_date_echeance ON invoices(date_echeance) WHERE statut IN ('sent', 'late', 'overdue');
CREATE INDEX IF NOT EXISTS idx_invoices_period_start ON invoices(period_start);

-- =====================
-- 3. Champ tenant_id dans payments (dénormalisation pour RLS directe)
-- =====================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES profiles(id);

-- Étendre les statuts possibles des payments
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_statut_check;
DO $$ BEGIN
  ALTER TABLE payments ADD CONSTRAINT payments_statut_check
  CHECK (statut IN ('pending', 'succeeded', 'failed', 'refunded'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- =====================
-- 4. Table payment_reminders
-- =====================

CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('friendly', 'reminder', 'urgent', 'formal_notice', 'lrec', 'final')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'lrec', 'courrier')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_invoice ON payment_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_tenant ON payment_reminders(tenant_id);

COMMENT ON TABLE payment_reminders IS 'Historique des relances envoyées pour factures impayées';

-- =====================
-- 5. Table late_fees
-- =====================

CREATE TABLE IF NOT EXISTS late_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  rate DECIMAL(10, 6) NOT NULL,
  days_late INTEGER NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  waived BOOLEAN NOT NULL DEFAULT false,
  waived_reason TEXT,
  waived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_late_fees_invoice ON late_fees(invoice_id);

COMMENT ON TABLE late_fees IS 'Pénalités de retard calculées conformément à la loi du 6 juillet 1989';

-- =====================
-- 6. Table receipts (quittances de loyer)
-- =====================

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- Format YYYY-MM
  period_start DATE,
  period_end DATE,
  montant_loyer DECIMAL(10, 2) NOT NULL,
  montant_charges DECIMAL(10, 2) NOT NULL DEFAULT 0,
  montant_total DECIMAL(10, 2) NOT NULL,
  pdf_url TEXT,
  pdf_storage_path TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_lease ON receipts(lease_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_period ON receipts(period);

COMMENT ON TABLE receipts IS 'Quittances de loyer générées après paiement (art. 21 loi 6 juillet 1989)';

-- =====================
-- 7. Table tenant_credit_score
-- =====================

CREATE TABLE IF NOT EXISTS tenant_credit_score (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER, -- NULL = pas encore de données
  on_time_count INTEGER NOT NULL DEFAULT 0,
  late_count INTEGER NOT NULL DEFAULT 0,
  missed_count INTEGER NOT NULL DEFAULT 0,
  early_count INTEGER NOT NULL DEFAULT 0,
  total_payments INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_credit_score_tenant ON tenant_credit_score(tenant_id);

COMMENT ON TABLE tenant_credit_score IS 'Score de ponctualité du locataire (cache calculé après chaque paiement)';

-- =====================
-- 8. RLS Policies
-- =====================

-- payment_reminders
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view own reminders" ON payment_reminders;
CREATE POLICY "Tenants can view own reminders"
  ON payment_reminders FOR SELECT
  USING (tenant_id = public.user_profile_id());

DROP POLICY IF EXISTS "Owners can view reminders of own invoices" ON payment_reminders;
CREATE POLICY "Owners can view reminders of own invoices"
  ON payment_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payment_reminders.invoice_id
      AND i.owner_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "Admins can view all reminders" ON payment_reminders;
CREATE POLICY "Admins can view all reminders"
  ON payment_reminders FOR SELECT
  USING (public.user_role() = 'admin');

-- late_fees
ALTER TABLE late_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view late fees of accessible invoices" ON late_fees;
CREATE POLICY "Users can view late fees of accessible invoices"
  ON late_fees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = late_fees.invoice_id
      AND (
        i.owner_id = public.user_profile_id()
        OR i.tenant_id = public.user_profile_id()
        OR public.user_role() = 'admin'
      )
    )
  );

-- receipts
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view own receipts" ON receipts;
CREATE POLICY "Tenants can view own receipts"
  ON receipts FOR SELECT
  USING (tenant_id = public.user_profile_id());

DROP POLICY IF EXISTS "Owners can view receipts of own properties" ON receipts;
CREATE POLICY "Owners can view receipts of own properties"
  ON receipts FOR SELECT
  USING (owner_id = public.user_profile_id());

DROP POLICY IF EXISTS "Admins can view all receipts" ON receipts;
CREATE POLICY "Admins can view all receipts"
  ON receipts FOR SELECT
  USING (public.user_role() = 'admin');

-- tenant_credit_score
ALTER TABLE tenant_credit_score ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view own credit score" ON tenant_credit_score;
CREATE POLICY "Tenants can view own credit score"
  ON tenant_credit_score FOR SELECT
  USING (tenant_id = public.user_profile_id());

DROP POLICY IF EXISTS "Admins can view all credit scores" ON tenant_credit_score;
CREATE POLICY "Admins can view all credit scores"
  ON tenant_credit_score FOR SELECT
  USING (public.user_role() = 'admin');

-- =====================
-- 9. DB Trigger : Bail activé → démarrer le moteur de facturation
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

      -- Générer immédiatement la première facture (prorata si nécessaire)
      PERFORM generate_first_invoice(NEW.id, v_tenant_signer.profile_id, v_owner_id);

      -- Marquer le moteur comme démarré
      NEW.invoice_engine_started := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fonction pour générer la première facture avec calcul prorata
CREATE OR REPLACE FUNCTION generate_first_invoice(
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
  v_now DATE := CURRENT_DATE;
  v_jour_paiement INT;
  v_days_in_month INT;
  v_date_debut DATE;
  v_first_full_month DATE;
  v_prorata_amount DECIMAL(10,2);
  v_prorata_days INT;
  v_total_days INT;
  v_loyer DECIMAL(10,2);
  v_charges DECIMAL(10,2);
  v_prorata_charges DECIMAL(10,2);
  v_current_month TEXT;
  v_invoice_exists BOOLEAN;
BEGIN
  -- Récupérer les données du bail
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_loyer := v_lease.loyer;
  v_charges := v_lease.charges_forfaitaires;
  v_jour_paiement := COALESCE(v_lease.jour_paiement, 5);
  v_date_debut := v_lease.date_debut;

  -- Mois du début de bail
  v_current_month := TO_CHAR(v_date_debut, 'YYYY-MM');

  -- Vérifier si une facture existe déjà pour ce mois
  SELECT EXISTS(
    SELECT 1 FROM invoices WHERE lease_id = p_lease_id AND periode = v_current_month
  ) INTO v_invoice_exists;
  IF v_invoice_exists THEN RETURN; END IF;

  -- Calculer le prorata si le bail ne commence pas le 1er du mois
  v_total_days := EXTRACT(DAY FROM (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_prorata_days := v_total_days - EXTRACT(DAY FROM v_date_debut)::INT + 1;

  IF v_prorata_days < v_total_days THEN
    -- Facture prorata
    v_prorata_amount := ROUND((v_loyer * v_prorata_days / v_total_days), 2);
    v_prorata_charges := ROUND((v_charges * v_prorata_days / v_total_days), 2);

    INSERT INTO invoices (
      lease_id, owner_id, tenant_id, periode,
      montant_loyer, montant_charges, montant_total,
      date_echeance, period_start, period_end,
      invoice_number, statut, generated_at, notes
    ) VALUES (
      p_lease_id, p_owner_id, p_tenant_id, v_current_month,
      v_prorata_amount, v_prorata_charges, v_prorata_amount + v_prorata_charges,
      v_date_debut, v_date_debut, (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
      'QUI-' || REPLACE(v_current_month, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
      'sent', NOW(),
      'Facture prorata du ' || v_date_debut || ' au ' || (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE || ' (' || v_prorata_days || '/' || v_total_days || ' jours)'
    );
  ELSE
    -- Bail commence le 1er → facture complète
    v_days_in_month := v_total_days;

    INSERT INTO invoices (
      lease_id, owner_id, tenant_id, periode,
      montant_loyer, montant_charges, montant_total,
      date_echeance, period_start, period_end,
      invoice_number, statut, generated_at
    ) VALUES (
      p_lease_id, p_owner_id, p_tenant_id, v_current_month,
      v_loyer, v_charges, v_loyer + v_charges,
      (v_current_month || '-' || LPAD(LEAST(v_jour_paiement, v_days_in_month)::TEXT, 2, '0'))::DATE,
      v_date_debut, (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
      'QUI-' || REPLACE(v_current_month, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
      'sent', NOW()
    );
  END IF;

  -- Mettre à jour first_invoice_date
  UPDATE leases SET first_invoice_date = v_date_debut WHERE id = p_lease_id;
END;
$$;

-- Installer le trigger (BEFORE UPDATE pour pouvoir modifier NEW)
DROP TRIGGER IF EXISTS trg_invoice_engine_on_lease_active ON leases;
CREATE TRIGGER trg_invoice_engine_on_lease_active
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invoice_engine_on_lease_active();

COMMENT ON FUNCTION trigger_invoice_engine_on_lease_active IS 'Déclenche la génération de la première facture quand un bail passe à actif';
COMMENT ON FUNCTION generate_first_invoice IS 'Génère la première facture avec calcul prorata conforme loi 6 juillet 1989';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260305000001', 'invoice_engine_fields')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260305000001_invoice_engine_fields.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260305100001_add_missing_notification_triggers.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : of
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260305100001_add_missing_notification_triggers.sql'; END $pre$;

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
    DROP TRIGGER IF EXISTS trg_notify_owner_on_ticket_created ON tickets;
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

-- Créer le trigger seulement si trigger absent ET colonne provider_id présente
-- (patch sprint-b2: tickets.provider_id n'existe pas dans cet env, skip propre)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_provider_on_work_order'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'provider_id'
  ) THEN
    DROP TRIGGER IF EXISTS trg_notify_provider_on_work_order ON tickets;
    CREATE TRIGGER trg_notify_provider_on_work_order
      AFTER INSERT OR UPDATE OF provider_id ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION notify_provider_on_work_order();
  ELSE
    RAISE NOTICE 'trg_notify_provider_on_work_order skipped (column tickets.provider_id missing or trigger exists)';
  END IF;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260305100001', 'add_missing_notification_triggers')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260305100001_add_missing_notification_triggers.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260306100000_invoice_on_fully_signed.sql
-- Note: file on disk is 20260306100000_invoice_on_fully_signed.sql but will be renamed to 20260306100002_invoice_on_fully_signed.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260306100000_invoice_on_fully_signed.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260306100002', 'invoice_on_fully_signed')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260306100000_invoice_on_fully_signed.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260306200000_notify_tenant_digicode_changed.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260306200000_notify_tenant_digicode_changed.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260306200000', 'notify_tenant_digicode_changed')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260306200000_notify_tenant_digicode_changed.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260309000000_entity_status_and_dedup.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260309000000_entity_status_and_dedup.sql'; END $pre$;

-- ============================================
-- Migration: Ajout status sur legal_entities + anti-doublons + déduplication
-- Date: 2026-03-09
-- Description:
--   1. Ajout colonne `status` ('draft','active','archived') avec sync `is_active`
--   2. Index partiel anti-doublons pour entités sans SIRET
--   3. Fonction admin de déduplication des entités
-- ============================================

BEGIN;

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

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260309000000', 'entity_status_and_dedup')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260309000000_entity_status_and_dedup.sql'; END $post$;

COMMIT;

-- END OF BATCH 3/11 (Phase 3 DANGEREUX)
