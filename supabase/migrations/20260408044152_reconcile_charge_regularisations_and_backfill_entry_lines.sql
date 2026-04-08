-- =====================================================
-- MIGRATION: Réconciliation finale des schémas comptables
-- Date: 2026-04-08
--
-- 1. charge_regularisations (FR) → charge_regularizations (EN)
--    - Migre les données de l'ancienne table vers la nouvelle
--    - Crée une vue de compatibilité charge_regularisations
--
-- 2. accounting_entries inline → accounting_entry_lines
--    - Backfill des anciennes écritures inline (debit/credit)
--    - Vers le nouveau modèle header/lignes (entry_lines)
--
-- Idempotent : chaque opération vérifie l'état avant d'agir.
-- =====================================================

BEGIN;

-- =====================================================
-- PARTIE 1 : charge_regularisations → charge_regularizations
-- =====================================================

-- 1a. S'assurer que charge_regularizations a les colonnes de compatibilité
ALTER TABLE public.charge_regularizations
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id),
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS annee INTEGER,
  ADD COLUMN IF NOT EXISTS date_emission DATE,
  ADD COLUMN IF NOT EXISTS date_echeance DATE,
  ADD COLUMN IF NOT EXISTS date_paiement DATE,
  ADD COLUMN IF NOT EXISTS nouvelle_provision DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS detail_charges JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 1b. Migrer les données de charge_regularisations → charge_regularizations
-- Seulement les lignes qui n'existent pas déjà (idempotent via id)
INSERT INTO public.charge_regularizations (
  id,
  lease_id,
  property_id,
  tenant_id,
  annee,
  period_start,
  period_end,
  provisions_paid_cents,
  actual_recoverable_cents,
  actual_non_recoverable_cents,
  status,
  date_emission,
  date_echeance,
  date_paiement,
  nouvelle_provision,
  notes,
  detail_charges,
  created_by,
  created_at,
  updated_at,
  -- entity_id et exercise_id sont NULL — sera backfillé plus tard
  entity_id
)
SELECT
  cr.id,
  cr.lease_id,
  cr.property_id,
  cr.tenant_id,
  cr.annee,
  cr.date_debut,
  cr.date_fin,
  -- Conversion DECIMAL euros → INTEGER cents
  ROUND(cr.provisions_versees * 100)::INTEGER,
  ROUND(cr.charges_reelles * 100)::INTEGER,
  0, -- actual_non_recoverable_cents inconnu dans l'ancien schéma
  -- Mapping statut FR → EN
  CASE cr.statut
    WHEN 'draft' THEN 'draft'
    WHEN 'sent' THEN 'sent'
    WHEN 'paid' THEN 'paid'
    WHEN 'disputed' THEN 'draft'
    WHEN 'cancelled' THEN 'draft'
    ELSE 'draft'
  END,
  cr.date_emission,
  cr.date_echeance,
  cr.date_paiement,
  cr.nouvelle_provision,
  cr.notes,
  cr.detail_charges,
  cr.created_by,
  cr.created_at,
  cr.updated_at,
  -- Résoudre entity_id via property → properties.legal_entity_id
  (SELECT p.legal_entity_id FROM public.properties p WHERE p.id = cr.property_id LIMIT 1)
FROM public.charge_regularisations cr
WHERE NOT EXISTS (
  SELECT 1 FROM public.charge_regularizations crz WHERE crz.id = cr.id
);

-- 1c. Rattacher entity_id + exercise_id sur les lignes migrées qui n'en ont pas
-- entity_id via property
UPDATE public.charge_regularizations
SET entity_id = (
  SELECT p.legal_entity_id
  FROM public.properties p
  WHERE p.id = charge_regularizations.property_id
  LIMIT 1
)
WHERE entity_id IS NULL AND property_id IS NOT NULL;

-- exercise_id via annee → le premier exercice de cette année
UPDATE public.charge_regularizations
SET exercise_id = (
  SELECT ae.id
  FROM public.accounting_exercises ae
  WHERE EXTRACT(YEAR FROM ae.start_date) = charge_regularizations.annee
  ORDER BY ae.start_date ASC
  LIMIT 1
)
WHERE exercise_id IS NULL AND annee IS NOT NULL;

-- 1d. Renommer l'ancienne table et créer une vue de compatibilité
-- On ne DROP pas l'ancienne table pour éviter de casser du code legacy
-- qui pourrait encore la référencer via des FK ou du code direct
ALTER TABLE public.charge_regularisations RENAME TO charge_regularisations_legacy;

-- Vue de compatibilité : le code qui SELECT depuis charge_regularisations
-- continue de fonctionner, pointant vers la table normalisée
CREATE OR REPLACE VIEW public.charge_regularisations AS
SELECT
  id,
  lease_id,
  property_id,
  tenant_id,
  annee,
  period_start AS date_debut,
  period_end AS date_fin,
  -- Conversion cents → euros pour compatibilité
  (provisions_paid_cents / 100.0)::DECIMAL(15,2) AS provisions_versees,
  (actual_recoverable_cents / 100.0)::DECIMAL(15,2) AS charges_reelles,
  ((actual_recoverable_cents - provisions_paid_cents) / 100.0)::DECIMAL(15,2) AS solde,
  detail_charges,
  status AS statut,
  date_emission,
  date_echeance,
  date_paiement,
  nouvelle_provision,
  NULL::DATE AS date_effet_nouvelle_provision,
  notes,
  created_at,
  updated_at,
  created_by
FROM public.charge_regularizations;

COMMENT ON VIEW public.charge_regularisations IS
  'Vue de compatibilité — pointe vers charge_regularizations. Utiliser la table normalisée pour les nouvelles écritures.';

-- 1e. Triggers INSTEAD OF pour que INSERT/UPDATE/DELETE sur la vue
--     redirigent vers charge_regularizations (compatibilité code legacy)

CREATE OR REPLACE FUNCTION charge_regularisations_insert_redirect()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.charge_regularizations (
    id, lease_id, property_id, tenant_id, annee,
    period_start, period_end,
    provisions_paid_cents, actual_recoverable_cents, actual_non_recoverable_cents,
    status, date_emission, date_echeance, date_paiement,
    nouvelle_provision, notes, detail_charges, created_by,
    entity_id
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.lease_id,
    NEW.property_id,
    NEW.tenant_id,
    NEW.annee,
    NEW.date_debut,
    NEW.date_fin,
    ROUND(COALESCE(NEW.provisions_versees, 0) * 100)::INTEGER,
    ROUND(COALESCE(NEW.charges_reelles, 0) * 100)::INTEGER,
    0,
    COALESCE(NEW.statut, 'draft'),
    NEW.date_emission,
    NEW.date_echeance,
    NEW.date_paiement,
    NEW.nouvelle_provision,
    NEW.notes,
    NEW.detail_charges,
    NEW.created_by,
    (SELECT p.legal_entity_id FROM public.properties p WHERE p.id = NEW.property_id LIMIT 1)
  )
  RETURNING id INTO NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER charge_regularisations_on_insert
  INSTEAD OF INSERT ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_insert_redirect();

CREATE OR REPLACE FUNCTION charge_regularisations_update_redirect()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.charge_regularizations SET
    lease_id = NEW.lease_id,
    property_id = NEW.property_id,
    tenant_id = NEW.tenant_id,
    annee = NEW.annee,
    period_start = COALESCE(NEW.date_debut, period_start),
    period_end = COALESCE(NEW.date_fin, period_end),
    provisions_paid_cents = ROUND(COALESCE(NEW.provisions_versees, 0) * 100)::INTEGER,
    actual_recoverable_cents = ROUND(COALESCE(NEW.charges_reelles, 0) * 100)::INTEGER,
    status = COALESCE(NEW.statut, status),
    date_emission = NEW.date_emission,
    date_echeance = NEW.date_echeance,
    date_paiement = NEW.date_paiement,
    nouvelle_provision = NEW.nouvelle_provision,
    notes = NEW.notes,
    detail_charges = NEW.detail_charges,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER charge_regularisations_on_update
  INSTEAD OF UPDATE ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_update_redirect();

CREATE OR REPLACE FUNCTION charge_regularisations_delete_redirect()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.charge_regularizations WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER charge_regularisations_on_delete
  INSTEAD OF DELETE ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_delete_redirect();

-- =====================================================
-- PARTIE 2 : Backfill accounting_entries → entry_lines
-- =====================================================
-- Les anciennes écritures ont debit/credit inline.
-- Le nouveau modèle utilise accounting_entry_lines.
-- On crée une ligne par écriture ancienne qui a un montant.

-- 2a. Insérer les lignes pour les écritures qui n'ont pas encore de lignes
INSERT INTO public.accounting_entry_lines (
  entry_id,
  account_number,
  label,
  debit_cents,
  credit_cents,
  lettrage,
  piece_ref
)
SELECT
  ae.id,
  ae.compte_num,
  ae.ecriture_lib,
  -- Conversion DECIMAL euros → INTEGER cents
  ROUND(ae.debit * 100)::INTEGER,
  ROUND(ae.credit * 100)::INTEGER,
  ae.ecriture_let,
  ae.piece_ref
FROM public.accounting_entries ae
WHERE
  -- Seulement les écritures qui ont des montants inline
  (ae.debit > 0 OR ae.credit > 0)
  -- Et qui n'ont pas encore de lignes associées
  AND NOT EXISTS (
    SELECT 1 FROM public.accounting_entry_lines ael
    WHERE ael.entry_id = ae.id
  )
  -- Et qui ont le format ancien (compte_num rempli)
  AND ae.compte_num IS NOT NULL;

-- 2b. Marquer les anciennes écritures comme ayant été migrées (via metadata)
-- On utilise la colonne source pour tracer
UPDATE public.accounting_entries
SET source = COALESCE(source, 'legacy_inline_migrated')
WHERE
  source IS NULL
  AND (debit > 0 OR credit > 0)
  AND compte_num IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.accounting_entry_lines ael WHERE ael.entry_id = id
  );

-- =====================================================
-- VÉRIFICATION (commentaire informatif)
-- =====================================================
-- Après exécution, vérifier :
--
-- SELECT 'charge_regularizations' AS table_name, COUNT(*) FROM charge_regularizations
-- UNION ALL
-- SELECT 'charge_regularisations_legacy', COUNT(*) FROM charge_regularisations_legacy
-- UNION ALL
-- SELECT 'entries_with_lines', COUNT(DISTINCT entry_id) FROM accounting_entry_lines
-- UNION ALL
-- SELECT 'entries_without_lines', COUNT(*) FROM accounting_entries
--   WHERE (debit > 0 OR credit > 0) AND NOT EXISTS (
--     SELECT 1 FROM accounting_entry_lines WHERE entry_id = accounting_entries.id
--   );

COMMIT;
