-- =====================================================
-- P0 ACCOUNTING SECURITY & INTEGRITY FIXES
-- =====================================================
-- Corrige les bugs critiques de l'audit du 26/04/2026 :
--   B1. ec_annotations RLS WITH CHECK trop restrictif
--   B2. accounting_audit_log INSERT exposee aux users
--   B7. FK manquante document_analyses.document_id -> documents(id)
--   B8. FK manquante amortization_schedules.property_id -> properties(id)
--   B9. Index composite manquant audit_log(entity_id, created_at)
--
-- IMPORTANT: les FK et CHECK sont ajoutees en NOT VALID puis validees
-- separement. Cela evite l'AccessExclusiveLock long sur les tables
-- parentes (documents, properties) qui produisait des deadlocks
-- contre les requetes applicatives en cours.
-- =====================================================

SET lock_timeout = '10s';

-- =====================================================
-- B1. ec_annotations : permettre aux entity_members de modifier
--     les annotations EC tout en preservant l'integrite cote EC.
-- =====================================================

DROP POLICY IF EXISTS "ec_annotations_access" ON ec_annotations;

CREATE POLICY "ec_annotations_select" ON ec_annotations
  FOR SELECT TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
    OR ec_user_id = auth.uid()
  );

CREATE POLICY "ec_annotations_insert" ON ec_annotations
  FOR INSERT TO authenticated
  WITH CHECK (
    ec_user_id = auth.uid()
    AND entity_id IN (
      SELECT entity_id FROM ec_access
      WHERE ec_user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "ec_annotations_update" ON ec_annotations
  FOR UPDATE TO authenticated
  USING (
    ec_user_id = auth.uid()
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    ec_user_id = auth.uid()
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ec_annotations_delete" ON ec_annotations
  FOR DELETE TO authenticated
  USING (
    ec_user_id = auth.uid()
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- B2. accounting_audit_log : retirer la possibilite d'INSERT
--     directe par n'importe quel user authentifie. Seuls les
--     triggers SECURITY DEFINER et le service role peuvent
--     ecrire l'audit trail.
-- =====================================================

DROP POLICY IF EXISTS "audit_log_system_insert" ON accounting_audit_log;

ALTER FUNCTION fn_audit_entry_changes() SECURITY DEFINER;

-- =====================================================
-- B9. Index composite pour requetes audit par periode
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_audit_entity_date
  ON accounting_audit_log(entity_id, created_at DESC);

-- =====================================================
-- B7. FK manquante : document_analyses.document_id -> documents(id)
--     ON DELETE CASCADE car une analyse OCR n'a aucun sens
--     sans son document source.
--
--     NOT VALID pour eviter le scan complet sous AccessExclusiveLock.
-- =====================================================

DELETE FROM document_analyses
WHERE document_id NOT IN (SELECT id FROM documents);

ALTER TABLE document_analyses
  DROP CONSTRAINT IF EXISTS document_analyses_document_id_fkey;

ALTER TABLE document_analyses
  ADD CONSTRAINT document_analyses_document_id_fkey
  FOREIGN KEY (document_id)
  REFERENCES documents(id)
  ON DELETE CASCADE
  NOT VALID;

-- VALIDATE acquiert un lock plus leger (ShareUpdateExclusive)
-- compatible avec les SELECT/INSERT applicatifs.
SET lock_timeout = '60s';
ALTER TABLE document_analyses
  VALIDATE CONSTRAINT document_analyses_document_id_fkey;
SET lock_timeout = '10s';

CREATE INDEX IF NOT EXISTS idx_doc_analyses_document
  ON document_analyses(document_id);

-- =====================================================
-- B8. FK manquante : amortization_schedules.property_id -> properties(id)
--     ON DELETE RESTRICT car un plan d'amortissement contient
--     un historique fiscal qui ne doit pas disparaitre avec le bien.
-- =====================================================

ALTER TABLE amortization_schedules
  DROP CONSTRAINT IF EXISTS amortization_schedules_property_id_fkey;

ALTER TABLE amortization_schedules
  ADD CONSTRAINT amortization_schedules_property_id_fkey
  FOREIGN KEY (property_id)
  REFERENCES properties(id)
  ON DELETE RESTRICT
  NOT VALID;

SET lock_timeout = '60s';
ALTER TABLE amortization_schedules
  VALIDATE CONSTRAINT amortization_schedules_property_id_fkey;
SET lock_timeout = '10s';

CREATE INDEX IF NOT EXISTS idx_amort_sched_property
  ON amortization_schedules(property_id);

-- =====================================================
-- B-extra. CHECK constraint stricte sur entry_lines
--     Empeche debit ET credit > 0 sur la meme ligne.
--     NOT VALID + VALIDATE pour eviter le scan complet bloquant.
-- =====================================================

ALTER TABLE accounting_entry_lines
  DROP CONSTRAINT IF EXISTS check_single_side;

ALTER TABLE accounting_entry_lines
  ADD CONSTRAINT check_single_side CHECK (
    (debit_cents = 0 AND credit_cents > 0)
    OR (debit_cents > 0 AND credit_cents = 0)
    OR (debit_cents = 0 AND credit_cents = 0)
  ) NOT VALID;

SET lock_timeout = '60s';
ALTER TABLE accounting_entry_lines
  VALIDATE CONSTRAINT check_single_side;

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON CONSTRAINT document_analyses_document_id_fkey ON document_analyses
  IS 'P0-B7: FK ajoutee 2026-04-26 (audit comptable)';

COMMENT ON CONSTRAINT amortization_schedules_property_id_fkey ON amortization_schedules
  IS 'P0-B8: FK ajoutee 2026-04-26 (audit comptable)';

COMMENT ON CONSTRAINT check_single_side ON accounting_entry_lines
  IS 'P0: garantit qu''une ligne ne peut etre simultanement debit et credit';
