-- ============================================================================
-- SCRIPT DE ROLLBACK — Restauration après nettoyage
-- ============================================================================
-- Ce script permet de restaurer les données supprimées par safe_cleanup_orphans()
-- ou par les fonctions merge_duplicate_*.
--
-- PRÉREQUIS : connaître le batch_id (retourné par safe_cleanup_orphans)
-- ============================================================================

-- ============================================================================
-- 1. LISTER TOUS LES BATCHES DE NETTOYAGE
-- ============================================================================

\echo '══════════════════════════════════════════════════════════════'
\echo '  ROLLBACK — Batches de nettoyage disponibles'
\echo '══════════════════════════════════════════════════════════════'

SELECT
  cleanup_batch_id,
  MIN(cleaned_at) AS debut,
  MAX(cleaned_at) AS fin,
  COUNT(*) AS nb_enregistrements,
  COUNT(DISTINCT source_table) AS nb_tables,
  string_agg(DISTINCT source_table, ', ' ORDER BY source_table) AS tables_touchees,
  cleaned_by
FROM _audit_cleanup_archive
GROUP BY cleanup_batch_id, cleaned_by
ORDER BY MIN(cleaned_at) DESC;


-- ============================================================================
-- 2. DÉTAIL D'UN BATCH (remplacer le UUID)
-- ============================================================================
-- Décommenter et remplacer '<BATCH_ID>' par l'UUID du batch à restaurer :

-- \echo '── Détail du batch ──'
-- SELECT
--   source_table,
--   source_id,
--   fk_column,
--   cleanup_reason,
--   cleaned_at,
--   jsonb_pretty(original_data) AS data_preview
-- FROM _audit_cleanup_archive
-- WHERE cleanup_batch_id = '<BATCH_ID>'
-- ORDER BY source_table, cleaned_at;


-- ============================================================================
-- 3. FONCTIONS DE ROLLBACK PAR TABLE
-- ============================================================================

-- 3.1 Rollback lease_signers
-- Restaure les signataires supprimés d'un batch donné

CREATE OR REPLACE FUNCTION rollback_lease_signers(p_batch_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT original_data
    FROM _audit_cleanup_archive
    WHERE cleanup_batch_id = p_batch_id
      AND source_table = 'lease_signers'
  LOOP
    INSERT INTO lease_signers
    SELECT * FROM jsonb_populate_record(NULL::lease_signers, r.original_data)
    ON CONFLICT (id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO _audit_log (action, table_name, old_id, new_id, details, affected_rows)
  VALUES ('ROLLBACK', 'lease_signers', p_batch_id::TEXT, NULL, 'Restauration batch', v_count);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.2 Rollback invoices
CREATE OR REPLACE FUNCTION rollback_invoices(p_batch_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT original_data
    FROM _audit_cleanup_archive
    WHERE cleanup_batch_id = p_batch_id
      AND source_table = 'invoices'
  LOOP
    INSERT INTO invoices
    SELECT * FROM jsonb_populate_record(NULL::invoices, r.original_data)
    ON CONFLICT (id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO _audit_log (action, table_name, old_id, new_id, details, affected_rows)
  VALUES ('ROLLBACK', 'invoices', p_batch_id::TEXT, NULL, 'Restauration batch', v_count);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.3 Rollback payments
CREATE OR REPLACE FUNCTION rollback_payments(p_batch_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT original_data
    FROM _audit_cleanup_archive
    WHERE cleanup_batch_id = p_batch_id
      AND source_table = 'payments'
  LOOP
    INSERT INTO payments
    SELECT * FROM jsonb_populate_record(NULL::payments, r.original_data)
    ON CONFLICT (id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO _audit_log (action, table_name, old_id, new_id, details, affected_rows)
  VALUES ('ROLLBACK', 'payments', p_batch_id::TEXT, NULL, 'Restauration batch', v_count);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.4 Rollback roommates
CREATE OR REPLACE FUNCTION rollback_roommates(p_batch_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT original_data
    FROM _audit_cleanup_archive
    WHERE cleanup_batch_id = p_batch_id
      AND source_table = 'roommates'
  LOOP
    INSERT INTO roommates
    SELECT * FROM jsonb_populate_record(NULL::roommates, r.original_data)
    ON CONFLICT (id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO _audit_log (action, table_name, old_id, new_id, details, affected_rows)
  VALUES ('ROLLBACK', 'roommates', p_batch_id::TEXT, NULL, 'Restauration batch', v_count);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.5 Rollback edl
CREATE OR REPLACE FUNCTION rollback_edl(p_batch_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT original_data
    FROM _audit_cleanup_archive
    WHERE cleanup_batch_id = p_batch_id
      AND source_table = 'edl'
  LOOP
    INSERT INTO edl
    SELECT * FROM jsonb_populate_record(NULL::edl, r.original_data)
    ON CONFLICT (id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO _audit_log (action, table_name, old_id, new_id, details, affected_rows)
  VALUES ('ROLLBACK', 'edl', p_batch_id::TEXT, NULL, 'Restauration batch', v_count);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.6 Rollback meters
CREATE OR REPLACE FUNCTION rollback_meters(p_batch_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT original_data
    FROM _audit_cleanup_archive
    WHERE cleanup_batch_id = p_batch_id
      AND source_table = 'meters'
  LOOP
    INSERT INTO meters
    SELECT * FROM jsonb_populate_record(NULL::meters, r.original_data)
    ON CONFLICT (id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO _audit_log (action, table_name, old_id, new_id, details, affected_rows)
  VALUES ('ROLLBACK', 'meters', p_batch_id::TEXT, NULL, 'Restauration batch', v_count);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.7 Rollback deposit_movements
CREATE OR REPLACE FUNCTION rollback_deposit_movements(p_batch_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT original_data
    FROM _audit_cleanup_archive
    WHERE cleanup_batch_id = p_batch_id
      AND source_table = 'deposit_movements'
  LOOP
    INSERT INTO deposit_movements
    SELECT * FROM jsonb_populate_record(NULL::deposit_movements, r.original_data)
    ON CONFLICT (id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO _audit_log (action, table_name, old_id, new_id, details, affected_rows)
  VALUES ('ROLLBACK', 'deposit_movements', p_batch_id::TEXT, NULL, 'Restauration batch', v_count);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.8 Rollback documents (restaurer les FK nullifiées)
CREATE OR REPLACE FUNCTION rollback_documents_nullified(p_batch_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT source_id, original_data, fk_column
    FROM _audit_cleanup_archive
    WHERE cleanup_batch_id = p_batch_id
      AND source_table = 'documents'
      AND cleanup_reason LIKE '%mis à NULL%'
  LOOP
    IF r.fk_column = 'lease_id' THEN
      UPDATE documents
      SET lease_id = (r.original_data->>'lease_id')::UUID
      WHERE id = r.source_id::UUID;
    ELSIF r.fk_column = 'property_id' THEN
      UPDATE documents
      SET property_id = (r.original_data->>'property_id')::UUID
      WHERE id = r.source_id::UUID;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO _audit_log (action, table_name, old_id, new_id, details, affected_rows)
  VALUES ('ROLLBACK', 'documents', p_batch_id::TEXT, NULL, 'Restauration FK nullifiées', v_count);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 4. ROLLBACK COMPLET D'UN BATCH
-- ============================================================================

CREATE OR REPLACE FUNCTION rollback_full_batch(p_batch_id UUID)
RETURNS TABLE(
  table_restored TEXT,
  records_restored INTEGER
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Ordre inverse du nettoyage (racines d'abord, feuilles ensuite)

  -- Documents (FK nullifiées)
  SELECT rollback_documents_nullified(p_batch_id) INTO v_count;
  table_restored := 'documents (FK restaurées)';
  records_restored := v_count;
  RETURN NEXT;

  -- EDL
  SELECT rollback_edl(p_batch_id) INTO v_count;
  table_restored := 'edl';
  records_restored := v_count;
  RETURN NEXT;

  -- Meters
  SELECT rollback_meters(p_batch_id) INTO v_count;
  table_restored := 'meters';
  records_restored := v_count;
  RETURN NEXT;

  -- Roommates
  SELECT rollback_roommates(p_batch_id) INTO v_count;
  table_restored := 'roommates';
  records_restored := v_count;
  RETURN NEXT;

  -- Deposit movements
  SELECT rollback_deposit_movements(p_batch_id) INTO v_count;
  table_restored := 'deposit_movements';
  records_restored := v_count;
  RETURN NEXT;

  -- Payments
  SELECT rollback_payments(p_batch_id) INTO v_count;
  table_restored := 'payments';
  records_restored := v_count;
  RETURN NEXT;

  -- Invoices
  SELECT rollback_invoices(p_batch_id) INTO v_count;
  table_restored := 'invoices';
  records_restored := v_count;
  RETURN NEXT;

  -- Lease signers
  SELECT rollback_lease_signers(p_batch_id) INTO v_count;
  table_restored := 'lease_signers';
  records_restored := v_count;
  RETURN NEXT;

  -- Log du rollback complet
  INSERT INTO _audit_log (action, table_name, old_id, details)
  VALUES ('ROLLBACK_FULL', '(all)', p_batch_id::TEXT, 'Rollback complet du batch');

  table_restored := '✅ ROLLBACK COMPLET';
  records_restored := 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 5. ROLLBACK D'UNE FUSION (MERGE)
-- ============================================================================

-- Annuler un merge de propriétés
CREATE OR REPLACE FUNCTION rollback_merge_property(p_duplicate_id UUID)
RETURNS TABLE(step TEXT, detail TEXT) AS $$
DECLARE
  r RECORD;
  v_master_id UUID;
BEGIN
  -- Retrouver le merge dans l'audit log
  SELECT new_id::UUID INTO v_master_id
  FROM _audit_log
  WHERE action = 'MERGE' AND table_name = 'properties' AND old_id = p_duplicate_id::TEXT
  ORDER BY created_at DESC LIMIT 1;

  IF v_master_id IS NULL THEN
    step := 'ERROR';
    detail := 'Aucun merge trouvé pour cet id dans _audit_log';
    RETURN NEXT; RETURN;
  END IF;

  -- Retrouver les données archivées
  SELECT original_data INTO r
  FROM _audit_cleanup_archive
  WHERE source_table = 'properties' AND source_id = p_duplicate_id::TEXT
    AND cleanup_reason LIKE 'Fusion vers%'
  ORDER BY cleaned_at DESC LIMIT 1;

  IF r IS NULL THEN
    step := 'ERROR';
    detail := 'Données archivées introuvables dans _audit_cleanup_archive';
    RETURN NEXT; RETURN;
  END IF;

  -- 1. Restaurer la propriété (annuler le soft-delete)
  UPDATE properties SET deleted_at = NULL WHERE id = p_duplicate_id;
  step := '1.RESTORE'; detail := 'Propriété ' || p_duplicate_id || ' restaurée (deleted_at = NULL)';
  RETURN NEXT;

  -- 2. Re-transférer les relations qui étaient à l'origine sur le doublon
  -- (Note : cela ne peut pas être automatique sans stocker les relations d'origine)
  step := '2.WARNING';
  detail := 'Les relations enfants (leases, documents, etc.) restent sur le master ' || v_master_id || '. Transférez manuellement si nécessaire.';
  RETURN NEXT;

  -- 3. Log
  INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
  VALUES ('ROLLBACK_MERGE', 'properties', v_master_id::TEXT, p_duplicate_id::TEXT, 'Annulation merge');

  step := 'DONE'; detail := 'Rollback du merge terminé';
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
\echo ''
\echo '══════════════════════════════════════════════════════════════'
\echo '  FONCTIONS DE ROLLBACK INSTALLÉES'
\echo '══════════════════════════════════════════════════════════════'
\echo ''
\echo '  Rollback d''un batch complet :'
\echo '    SELECT * FROM rollback_full_batch(''<batch_id>'');'
\echo ''
\echo '  Rollback par table :'
\echo '    SELECT rollback_lease_signers(''<batch_id>'');'
\echo '    SELECT rollback_invoices(''<batch_id>'');'
\echo '    SELECT rollback_payments(''<batch_id>'');'
\echo '    SELECT rollback_roommates(''<batch_id>'');'
\echo '    SELECT rollback_edl(''<batch_id>'');'
\echo '    SELECT rollback_meters(''<batch_id>'');'
\echo '    SELECT rollback_deposit_movements(''<batch_id>'');'
\echo '    SELECT rollback_documents_nullified(''<batch_id>'');'
\echo ''
\echo '  Rollback d''un merge :'
\echo '    SELECT * FROM rollback_merge_property(''<duplicate_id>'');'
\echo '══════════════════════════════════════════════════════════════'
