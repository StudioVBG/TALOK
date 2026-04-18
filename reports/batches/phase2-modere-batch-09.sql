-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 9/15
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
-- Migration: 20260329164841_fix_document_titles.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260329164841_fix_document_titles.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260329164841', 'fix_document_titles')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260329164841_fix_document_titles.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260331000000_add_receipt_generated_to_invoices.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260331000000_add_receipt_generated_to_invoices.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260331000000', 'add_receipt_generated_to_invoices')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260331000000_add_receipt_generated_to_invoices.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260331100000_fix_document_titles_bruts.sql
-- Note: file on disk is 20260331100000_fix_document_titles_bruts.sql but will be renamed to 20260331100001_fix_document_titles_bruts.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260331100000_fix_document_titles_bruts.sql'; END $pre$;

-- B7: Corriger les titres bruts des anciens documents
-- Remplacer les noms de fichiers (ex: "Capture_d_ecran_2024-03-15.png")
-- par des titres lisibles selon le type de document

UPDATE documents SET title = CASE
  WHEN type = 'cni_recto' THEN 'Carte d''Identité (Recto)'
  WHEN type = 'cni_verso' THEN 'Carte d''Identité (Verso)'
  WHEN type = 'assurance_habitation' THEN 'Attestation d''assurance habitation'
  WHEN type = 'contrat_bail' THEN 'Contrat de bail'
  WHEN type = 'quittance_loyer' THEN 'Quittance de loyer'
  WHEN type = 'bulletin_salaire' THEN 'Bulletin de salaire'
  WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
  WHEN type = 'justificatif_domicile' THEN 'Justificatif de domicile'
  WHEN type = 'rib' THEN 'Relevé d''Identité Bancaire'
  WHEN type = 'kbis' THEN 'Extrait KBIS'
  WHEN type = 'attestation_assurance_rc' THEN 'Attestation assurance RC Pro'
  WHEN type = 'dpe' THEN 'Diagnostic de Performance Énergétique'
  WHEN type = 'edl_entree' THEN 'État des lieux d''entrée'
  WHEN type = 'edl_sortie' THEN 'État des lieux de sortie'
  WHEN type = 'mandat_gestion' THEN 'Mandat de gestion'
  WHEN type = 'reglement_copropriete' THEN 'Règlement de copropriété'
  ELSE title
END
WHERE (
  title IS NULL
  OR title ~ '^Capture d.écran'
  OR title ~ '^capture'
  OR title ~ '^Screenshot'
  OR title ~ '^IMG_'
  OR title ~ '^[A-Z_]{4,}$'
  OR title ~ '^\d{4}-\d{2}-\d{2}'
  OR title ~ '\.(png|jpg|jpeg|pdf|webp)$'
)
AND type IS NOT NULL;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260331100001', 'fix_document_titles_bruts')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260331100000_fix_document_titles_bruts.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260331120000_add_signed_pdf_generated_to_leases.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260331120000_add_signed_pdf_generated_to_leases.sql'; END $pre$;

-- Migration: Ajouter colonne signed_pdf_generated à la table leases
-- Permet de tracker quels baux ont déjà un PDF signé généré

ALTER TABLE leases
ADD COLUMN IF NOT EXISTS signed_pdf_generated BOOLEAN DEFAULT FALSE;

-- Backfill : baux qui ont déjà un document bail généré
UPDATE leases l
SET signed_pdf_generated = TRUE
WHERE EXISTS (
  SELECT 1 FROM documents d
  WHERE d.lease_id = l.id
    AND d.type = 'bail'
    AND d.is_generated = TRUE
);

-- Index pour requêtes de diagnostic
CREATE INDEX IF NOT EXISTS idx_leases_signed_pdf_generated
ON leases (signed_pdf_generated)
WHERE signed_pdf_generated = FALSE;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260331120000', 'add_signed_pdf_generated_to_leases')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260331120000_add_signed_pdf_generated_to_leases.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260401000001_add_initial_payment_confirmed_to_leases.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260401000001_add_initial_payment_confirmed_to_leases.sql'; END $pre$;

-- Migration: Ajouter initial_payment_confirmed sur leases
-- Permet au webhook Stripe de marquer le paiement initial comme confirmé
-- et d'éviter la désynchronisation entre l'UI et l'API key-handover.

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS initial_payment_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_payment_date timestamptz,
  ADD COLUMN IF NOT EXISTS initial_payment_stripe_pi text;

-- Rétro-remplissage : marquer comme confirmé les baux dont la facture initiale est soldée
UPDATE leases l
SET initial_payment_confirmed = true,
    initial_payment_date = i.date_paiement
FROM invoices i
WHERE i.lease_id = l.id
  AND i.statut = 'paid'
  AND (
    i.metadata->>'type' = 'initial_invoice'
    OR i.type = 'initial_invoice'
  )
  AND l.initial_payment_confirmed = false;

-- Index partiel pour les requêtes fréquentes sur les baux non confirmés
CREATE INDEX IF NOT EXISTS idx_leases_initial_payment_pending
  ON leases (id)
  WHERE initial_payment_confirmed = false;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260401000001', 'add_initial_payment_confirmed_to_leases')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260401000001_add_initial_payment_confirmed_to_leases.sql'; END $post$;

COMMIT;

-- END OF BATCH 9/15 (Phase 2 MODERE)
