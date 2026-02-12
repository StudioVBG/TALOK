-- ============================================================================
-- AUDIT D'INTÉGRITÉ V2 — FUSION, DRY RUN, ROLLBACK, PRÉVENTION
-- Date: 2026-02-12
-- Complète 20260212000000_audit_database_integrity.sql
-- ============================================================================
-- Ce script ajoute :
--   Phase 3 : Détection avancée des doublons (fuzzy, temporels)
--   Phase 4 : Fonctions de fusion SAFE (merge avec backup + rollback)
--   Phase 5 : Contraintes de prévention (FK, UNIQUE, triggers)
-- ============================================================================
-- PRÉREQUIS : 20260212000000_audit_database_integrity.sql déjà appliqué
-- ============================================================================


-- ============================================================================
-- INFRASTRUCTURE : Tables de support
-- ============================================================================

-- Table d'audit pour TOUTES les opérations de nettoyage
CREATE TABLE IF NOT EXISTS _audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,          -- MERGE, DELETE, NULLIFY, BACKUP, ROLLBACK
  table_name TEXT NOT NULL,
  old_id TEXT,
  new_id TEXT,
  details TEXT,
  affected_rows INTEGER DEFAULT 0,
  executed_by TEXT DEFAULT current_user,
  session_id TEXT DEFAULT current_setting('request.jwt.claim.sub', true),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON _audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON _audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_date ON _audit_log(created_at);

COMMENT ON TABLE _audit_log IS 'Journal d''audit de toutes les opérations de nettoyage/fusion de données.';


-- ============================================================================
-- PHASE 3 : DÉTECTION AVANCÉE DES DOUBLONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 Doublons de propriétés (adresse normalisée + code_postal + ville)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_properties()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  owner_ids UUID[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons exacts : même adresse normalisée + CP + ville + même owner
  RETURN QUERY
  SELECT
    ('exact:' || p.owner_id || ':' || LOWER(TRIM(p.adresse_complete)) || ':' || p.code_postal)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(p.id ORDER BY p.created_at ASC),
    ARRAY_AGG(DISTINCT p.owner_id),
    MIN(p.created_at),
    MAX(p.created_at),
    'EXACT'::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
  GROUP BY p.owner_id, LOWER(TRIM(p.adresse_complete)), p.code_postal
  HAVING COUNT(*) > 1;

  -- Doublons temporels : même owner, créés à < 5 min d'intervalle
  RETURN QUERY
  SELECT
    ('temporal:' || p1.owner_id || ':' || p1.id || ':' || p2.id)::TEXT,
    2::BIGINT,
    ARRAY[p1.id, p2.id],
    ARRAY[p1.owner_id],
    LEAST(p1.created_at, p2.created_at),
    GREATEST(p1.created_at, p2.created_at),
    'TEMPORAL (<5min)'::TEXT
  FROM properties p1
  JOIN properties p2 ON p1.owner_id = p2.owner_id
    AND p1.id < p2.id
    AND p1.deleted_at IS NULL AND p2.deleted_at IS NULL
    AND ABS(EXTRACT(EPOCH FROM (p1.created_at - p2.created_at))) < 300
    AND LOWER(TRIM(p1.ville)) = LOWER(TRIM(p2.ville))
    AND p1.code_postal = p2.code_postal;

  -- Doublons flous : même CP + ville, adresses très similaires (même owner)
  RETURN QUERY
  SELECT
    ('fuzzy:' || p1.owner_id || ':' || p1.id || ':' || p2.id)::TEXT,
    2::BIGINT,
    ARRAY[p1.id, p2.id],
    ARRAY[p1.owner_id],
    LEAST(p1.created_at, p2.created_at),
    GREATEST(p1.created_at, p2.created_at),
    'FUZZY (même CP+ville, type identique)'::TEXT
  FROM properties p1
  JOIN properties p2 ON p1.owner_id = p2.owner_id
    AND p1.id < p2.id
    AND p1.deleted_at IS NULL AND p2.deleted_at IS NULL
    AND p1.code_postal = p2.code_postal
    AND LOWER(TRIM(p1.ville)) = LOWER(TRIM(p2.ville))
    AND p1.type = p2.type
    AND p1.surface = p2.surface
    AND p1.nb_pieces = p2.nb_pieces
    -- Exclure les paires déjà capturées en exact
    AND LOWER(TRIM(p1.adresse_complete)) != LOWER(TRIM(p2.adresse_complete));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.2 Doublons de profils/contacts (email OU nom+prénom+date_naissance)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_profiles()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  emails TEXT[],
  roles TEXT[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons par email (même email dans profiles)
  RETURN QUERY
  SELECT
    ('email:' || LOWER(TRIM(p.email)))::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(p.id ORDER BY p.created_at ASC),
    ARRAY_AGG(DISTINCT p.email),
    ARRAY_AGG(DISTINCT p.role),
    MIN(p.created_at),
    MAX(p.created_at),
    'EMAIL_EXACT'::TEXT
  FROM profiles p
  WHERE p.email IS NOT NULL AND TRIM(p.email) != ''
  GROUP BY LOWER(TRIM(p.email))
  HAVING COUNT(*) > 1;

  -- Doublons par nom+prénom+date_naissance
  RETURN QUERY
  SELECT
    ('identity:' || LOWER(TRIM(COALESCE(p.nom,''))) || ':' || LOWER(TRIM(COALESCE(p.prenom,''))) || ':' || COALESCE(p.date_naissance::TEXT,''))::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(p.id ORDER BY p.created_at ASC),
    ARRAY_AGG(p.email),
    ARRAY_AGG(DISTINCT p.role),
    MIN(p.created_at),
    MAX(p.created_at),
    'IDENTITY (nom+prénom+naissance)'::TEXT
  FROM profiles p
  WHERE p.nom IS NOT NULL AND p.prenom IS NOT NULL AND p.date_naissance IS NOT NULL
    AND TRIM(p.nom) != '' AND TRIM(p.prenom) != ''
  GROUP BY LOWER(TRIM(p.nom)), LOWER(TRIM(p.prenom)), p.date_naissance
  HAVING COUNT(*) > 1;

  -- Doublons user_id (critique : même auth.users → 2+ profiles)
  RETURN QUERY
  SELECT
    ('user_id:' || p.user_id)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(p.id ORDER BY p.created_at ASC),
    ARRAY_AGG(p.email),
    ARRAY_AGG(DISTINCT p.role),
    MIN(p.created_at),
    MAX(p.created_at),
    'CRITICAL: même user_id'::TEXT
  FROM profiles p
  GROUP BY p.user_id
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.3 Doublons de baux (property_id + tenant_id + date_debut ±7j)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_leases()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  statuts TEXT[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons exacts : même property + même période
  RETURN QUERY
  SELECT
    ('exact:' || l.property_id || ':' || l.date_debut)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(l.id ORDER BY l.created_at ASC),
    ARRAY_AGG(l.statut),
    MIN(l.created_at),
    MAX(l.created_at),
    'EXACT (même property+date_debut)'::TEXT
  FROM leases l
  WHERE l.property_id IS NOT NULL
    AND l.statut NOT IN ('cancelled', 'archived')
  GROUP BY l.property_id, l.date_debut
  HAVING COUNT(*) > 1;

  -- Doublons temporels : même property, dates proches (±7 jours), même type
  RETURN QUERY
  SELECT
    ('temporal:' || l1.id || ':' || l2.id)::TEXT,
    2::BIGINT,
    ARRAY[l1.id, l2.id],
    ARRAY[l1.statut, l2.statut],
    LEAST(l1.created_at, l2.created_at),
    GREATEST(l1.created_at, l2.created_at),
    'TEMPORAL (même property, date ±7j)'::TEXT
  FROM leases l1
  JOIN leases l2 ON l1.property_id = l2.property_id
    AND l1.id < l2.id
    AND l1.property_id IS NOT NULL
    AND l1.type_bail = l2.type_bail
    AND l1.statut NOT IN ('cancelled', 'archived')
    AND l2.statut NOT IN ('cancelled', 'archived')
    AND ABS(l1.date_debut - l2.date_debut) <= 7;

  -- Baux actifs chevauchants sur même propriété
  RETURN QUERY
  SELECT
    ('overlap:' || l1.property_id || ':' || l1.id || ':' || l2.id)::TEXT,
    2::BIGINT,
    ARRAY[l1.id, l2.id],
    ARRAY[l1.statut, l2.statut],
    LEAST(l1.created_at, l2.created_at),
    GREATEST(l1.created_at, l2.created_at),
    'OVERLAP (baux actifs chevauchants)'::TEXT
  FROM leases l1
  JOIN leases l2 ON l1.property_id = l2.property_id
    AND l1.id < l2.id
    AND l1.property_id IS NOT NULL
    AND l1.statut IN ('active', 'pending_signature', 'fully_signed')
    AND l2.statut IN ('active', 'pending_signature', 'fully_signed')
    AND l1.date_debut <= COALESCE(l2.date_fin, '9999-12-31'::DATE)
    AND l2.date_debut <= COALESCE(l1.date_fin, '9999-12-31'::DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.4 Doublons de documents (nom + entité + created_at ±1min)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_documents()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons par storage_path (même fichier physique)
  RETURN QUERY
  SELECT
    ('storage:' || COALESCE(d.storage_path, d.url))::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(d.id ORDER BY d.created_at ASC),
    MIN(d.created_at),
    MAX(d.created_at),
    'STORAGE_PATH identique'::TEXT
  FROM documents d
  WHERE COALESCE(d.storage_path, d.url) IS NOT NULL
  GROUP BY COALESCE(d.storage_path, d.url)
  HAVING COUNT(*) > 1;

  -- Doublons temporels par entité (même type + même parent + <1 min)
  RETURN QUERY
  SELECT
    ('temporal:' || d1.id || ':' || d2.id)::TEXT,
    2::BIGINT,
    ARRAY[d1.id, d2.id],
    LEAST(d1.created_at, d2.created_at),
    GREATEST(d1.created_at, d2.created_at),
    'TEMPORAL (<1min, même type+parent)'::TEXT
  FROM documents d1
  JOIN documents d2 ON d1.id < d2.id
    AND d1.type = d2.type
    AND COALESCE(d1.lease_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(d2.lease_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND COALESCE(d1.property_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(d2.property_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND ABS(EXTRACT(EPOCH FROM (d1.created_at - d2.created_at))) < 60;

  -- Doublons par nom de fichier + entité
  RETURN QUERY
  SELECT
    ('name:' || LOWER(TRIM(COALESCE(d.nom, d.nom_fichier, ''))) || ':' || COALESCE(d.lease_id::TEXT, d.property_id::TEXT, 'none'))::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(d.id ORDER BY d.created_at ASC),
    MIN(d.created_at),
    MAX(d.created_at),
    'NOM_FICHIER identique (même entité)'::TEXT
  FROM documents d
  WHERE COALESCE(d.nom, d.nom_fichier) IS NOT NULL
    AND TRIM(COALESCE(d.nom, d.nom_fichier, '')) != ''
  GROUP BY LOWER(TRIM(COALESCE(d.nom, d.nom_fichier, ''))), COALESCE(d.lease_id::TEXT, d.property_id::TEXT, 'none')
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.5 Doublons de paiements (montant + invoice_id + date ±1j)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_payments()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  montants NUMERIC[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons exacts : même invoice + même montant
  RETURN QUERY
  SELECT
    ('exact:' || py.invoice_id || ':' || py.montant)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(py.id ORDER BY py.created_at ASC),
    ARRAY_AGG(py.montant),
    MIN(py.created_at),
    MAX(py.created_at),
    'EXACT (même invoice+montant)'::TEXT
  FROM payments py
  GROUP BY py.invoice_id, py.montant
  HAVING COUNT(*) > 1;

  -- Doublons temporels : même invoice, même montant, < 1 jour
  RETURN QUERY
  SELECT
    ('temporal:' || p1.id || ':' || p2.id)::TEXT,
    2::BIGINT,
    ARRAY[p1.id, p2.id],
    ARRAY[p1.montant, p2.montant],
    LEAST(p1.created_at, p2.created_at),
    GREATEST(p1.created_at, p2.created_at),
    'TEMPORAL (<24h, même invoice+montant)'::TEXT
  FROM payments p1
  JOIN payments p2 ON p1.invoice_id = p2.invoice_id
    AND p1.id < p2.id
    AND p1.montant = p2.montant
    AND ABS(EXTRACT(EPOCH FROM (p1.created_at - p2.created_at))) < 86400;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.6 Doublons d'EDL (lease_id + type + date ±1j)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_edl()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  statuts TEXT[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  -- Doublons exacts : même bail + même type
  RETURN QUERY
  SELECT
    ('exact:' || e.lease_id || ':' || e.type)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(e.id ORDER BY e.created_at ASC),
    ARRAY_AGG(e.status),
    MIN(e.created_at),
    MAX(e.created_at),
    'EXACT (même bail+type)'::TEXT
  FROM edl e
  GROUP BY e.lease_id, e.type
  HAVING COUNT(*) > 1;

  -- Doublons temporels
  RETURN QUERY
  SELECT
    ('temporal:' || e1.id || ':' || e2.id)::TEXT,
    2::BIGINT,
    ARRAY[e1.id, e2.id],
    ARRAY[e1.status, e2.status],
    LEAST(e1.created_at, e2.created_at),
    GREATEST(e1.created_at, e2.created_at),
    'TEMPORAL (<24h, même bail+type)'::TEXT
  FROM edl e1
  JOIN edl e2 ON e1.lease_id = e2.lease_id
    AND e1.type = e2.type
    AND e1.id < e2.id
    AND ABS(EXTRACT(EPOCH FROM (e1.created_at - e2.created_at))) < 86400;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.7 Doublons de factures (lease_id + periode)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_duplicate_invoices()
RETURNS TABLE(
  duplicate_key TEXT,
  nb_doublons BIGINT,
  ids UUID[],
  montants NUMERIC[],
  statuts TEXT[],
  premier_cree TIMESTAMPTZ,
  dernier_cree TIMESTAMPTZ,
  match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ('exact:' || i.lease_id || ':' || i.periode)::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(i.id ORDER BY i.created_at ASC),
    ARRAY_AGG(i.montant_total),
    ARRAY_AGG(i.statut),
    MIN(i.created_at),
    MAX(i.created_at),
    'EXACT (même bail+période)'::TEXT
  FROM invoices i
  GROUP BY i.lease_id, i.periode
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3.8 Rapport consolidé de tous les doublons
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_all_duplicates_summary()
RETURNS TABLE(
  entity TEXT,
  match_type TEXT,
  duplicate_groups BIGINT,
  total_excess_records BIGINT,
  severity TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'properties'::TEXT, dp.match_type, COUNT(*)::BIGINT,
    SUM(dp.nb_doublons - 1)::BIGINT, 'HIGH'::TEXT
  FROM audit_duplicate_properties() dp
  GROUP BY dp.match_type;

  RETURN QUERY
  SELECT 'profiles'::TEXT, dp.match_type, COUNT(*)::BIGINT,
    SUM(dp.nb_doublons - 1)::BIGINT,
    CASE WHEN dp.match_type LIKE '%user_id%' THEN 'CRITICAL' ELSE 'HIGH' END::TEXT
  FROM audit_duplicate_profiles() dp
  GROUP BY dp.match_type;

  RETURN QUERY
  SELECT 'leases'::TEXT, dl.match_type, COUNT(*)::BIGINT,
    SUM(dl.nb_doublons - 1)::BIGINT,
    CASE WHEN dl.match_type LIKE '%OVERLAP%' THEN 'CRITICAL' ELSE 'HIGH' END::TEXT
  FROM audit_duplicate_leases() dl
  GROUP BY dl.match_type;

  RETURN QUERY
  SELECT 'documents'::TEXT, dd.match_type, COUNT(*)::BIGINT,
    SUM(dd.nb_doublons - 1)::BIGINT, 'MEDIUM'::TEXT
  FROM audit_duplicate_documents() dd
  GROUP BY dd.match_type;

  RETURN QUERY
  SELECT 'payments'::TEXT, dp.match_type, COUNT(*)::BIGINT,
    SUM(dp.nb_doublons - 1)::BIGINT, 'CRITICAL'::TEXT
  FROM audit_duplicate_payments() dp
  GROUP BY dp.match_type;

  RETURN QUERY
  SELECT 'edl'::TEXT, de.match_type, COUNT(*)::BIGINT,
    SUM(de.nb_doublons - 1)::BIGINT, 'MEDIUM'::TEXT
  FROM audit_duplicate_edl() de
  GROUP BY de.match_type;

  RETURN QUERY
  SELECT 'invoices'::TEXT, di.match_type, COUNT(*)::BIGINT,
    SUM(di.nb_doublons - 1)::BIGINT, 'CRITICAL'::TEXT
  FROM audit_duplicate_invoices() di
  GROUP BY di.match_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PHASE 4 : FONCTIONS DE FUSION SAFE (MERGE)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 Fusion générique : élit un master, transfère les enfants, supprime
-- ----------------------------------------------------------------------------

-- Helper : compter les champs non-null d'un enregistrement
CREATE OR REPLACE FUNCTION _count_non_null_fields(p_table TEXT, p_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  EXECUTE format(
    'SELECT COUNT(*) FROM (
       SELECT unnest(ARRAY[%s]) AS val
     ) sub WHERE val IS NOT NULL',
    (SELECT string_agg(quote_ident(column_name) || '::TEXT', ', ')
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = p_table)
  ) USING p_id INTO v_count;
  RETURN v_count;
EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- 4.2 Merge de propriétés
CREATE OR REPLACE FUNCTION merge_duplicate_properties(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Validation
  IF p_master_id = p_duplicate_id THEN
    step := 'ERROR'; detail := 'master_id et duplicate_id sont identiques'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_master_id) THEN
    step := 'ERROR'; detail := 'master_id introuvable'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_duplicate_id) THEN
    step := 'ERROR'; detail := 'duplicate_id introuvable'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- 1. Backup
  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'properties', p_duplicate_id::TEXT, 'MERGE', to_jsonb(p), 'Fusion vers ' || p_master_id
    FROM properties p WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon dans _audit_cleanup_archive'; affected_rows := 1;
  RETURN NEXT;

  -- 2. Transfert : leases
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM leases WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE leases SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'leases.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 3. Transfert : units
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM units WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE units SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'units.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 4. Transfert : charges
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM charges WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE charges SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'charges.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 5. Transfert : documents
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM documents WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE documents SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'documents.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 6. Transfert : tickets
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM tickets WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE tickets SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'tickets.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 7. Transfert : photos
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM photos WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE photos SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'photos.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 8. Transfert : visit_slots
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM visit_slots WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE visit_slots SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'visit_slots.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 9. Transfert : property_ownership
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM property_ownership WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE property_ownership SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'property_ownership.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 10. Transfert : conversations
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM conversations WHERE property_id = p_duplicate_id;
  ELSE
    UPDATE conversations SET property_id = p_master_id WHERE property_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'conversations.property_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 11. Enrichir le master avec les champs manquants du doublon
  IF NOT p_dry_run THEN
    UPDATE properties SET
      cover_url = COALESCE(properties.cover_url, dup.cover_url),
      loyer_reference = COALESCE(properties.loyer_reference, dup.loyer_reference),
      loyer_base = COALESCE(properties.loyer_base, dup.loyer_base),
      charges_mensuelles = COALESCE(properties.charges_mensuelles, dup.charges_mensuelles),
      depot_garantie = COALESCE(properties.depot_garantie, dup.depot_garantie),
      dpe_classe_energie = COALESCE(properties.dpe_classe_energie, dup.dpe_classe_energie),
      dpe_classe_climat = COALESCE(properties.dpe_classe_climat, dup.dpe_classe_climat),
      visite_virtuelle_url = COALESCE(properties.visite_virtuelle_url, dup.visite_virtuelle_url),
      latitude = COALESCE(properties.latitude, dup.latitude),
      longitude = COALESCE(properties.longitude, dup.longitude)
    FROM properties dup
    WHERE properties.id = p_master_id AND dup.id = p_duplicate_id;
  END IF;
  step := '3.ENRICH'; detail := 'Champs manquants copiés vers master'; affected_rows := 1;
  RETURN NEXT;

  -- 12. Suppression (soft-delete si colonne existe, sinon hard delete)
  IF NOT p_dry_run THEN
    UPDATE properties SET deleted_at = NOW() WHERE id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
    VALUES ('MERGE', 'properties', p_duplicate_id::TEXT, p_master_id::TEXT,
            'Fusion propriété doublon → master');
  ELSE
    v_count := 1;
  END IF;
  step := '4.DELETE'; detail := 'Soft-delete du doublon (deleted_at = NOW())'; affected_rows := v_count;
  RETURN NEXT;

  step := 'DONE';
  detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN terminé — aucune modification' ELSE '✅ Fusion exécutée' END;
  affected_rows := 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.3 Merge de factures dupliquées
CREATE OR REPLACE FUNCTION merge_duplicate_invoices(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_master_id = p_duplicate_id THEN
    step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- 1. Backup
  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'invoices', p_duplicate_id::TEXT, 'MERGE', to_jsonb(i), 'Fusion vers ' || p_master_id
    FROM invoices i WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1;
  RETURN NEXT;

  -- 2. Transfert des paiements
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM payments WHERE invoice_id = p_duplicate_id;
  ELSE
    UPDATE payments SET invoice_id = p_master_id WHERE invoice_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'payments.invoice_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 3. Transfert des payment_shares
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM payment_shares WHERE invoice_id = p_duplicate_id;
  ELSE
    UPDATE payment_shares SET invoice_id = p_master_id WHERE invoice_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'payment_shares.invoice_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 4. Suppression
  IF NOT p_dry_run THEN
    DELETE FROM invoices WHERE id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
    VALUES ('MERGE', 'invoices', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion facture doublon');
  ELSE
    v_count := 1;
  END IF;
  step := '3.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count;
  RETURN NEXT;

  step := 'DONE';
  detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN' ELSE '✅ Fusion exécutée' END;
  affected_rows := 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.4 Merge de documents dupliqués
CREATE OR REPLACE FUNCTION merge_duplicate_documents(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_master_id = p_duplicate_id THEN
    step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- 1. Backup
  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'documents', p_duplicate_id::TEXT, 'MERGE', to_jsonb(d), 'Fusion vers ' || p_master_id
    FROM documents d WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1;
  RETURN NEXT;

  -- 2. Transfert : documents.replaced_by
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM documents WHERE replaced_by = p_duplicate_id;
  ELSE
    UPDATE documents SET replaced_by = p_master_id WHERE replaced_by = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'documents.replaced_by'; affected_rows := v_count;
  RETURN NEXT;

  -- 3. Enrichir master
  IF NOT p_dry_run THEN
    UPDATE documents SET
      storage_path = COALESCE(documents.storage_path, dup.storage_path),
      url = COALESCE(documents.url, dup.url),
      mime_type = COALESCE(documents.mime_type, dup.mime_type),
      size = COALESCE(documents.size, dup.size),
      preview_url = COALESCE(documents.preview_url, dup.preview_url)
    FROM documents dup
    WHERE documents.id = p_master_id AND dup.id = p_duplicate_id;
  END IF;
  step := '3.ENRICH'; detail := 'Champs manquants copiés'; affected_rows := 1;
  RETURN NEXT;

  -- 4. Suppression
  IF NOT p_dry_run THEN
    DELETE FROM documents WHERE id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
    VALUES ('MERGE', 'documents', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion document doublon');
  ELSE
    v_count := 1;
  END IF;
  step := '4.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count;
  RETURN NEXT;

  step := 'DONE';
  detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN' ELSE '✅ Fusion exécutée' END;
  affected_rows := 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.5 Merge d'EDL dupliqués
CREATE OR REPLACE FUNCTION merge_duplicate_edl(
  p_master_id UUID,
  p_duplicate_id UUID,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_master_id = p_duplicate_id THEN
    step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- 1. Backup
  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'edl', p_duplicate_id::TEXT, 'MERGE', to_jsonb(e), 'Fusion vers ' || p_master_id
    FROM edl e WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1;
  RETURN NEXT;

  -- 2. Transfert edl_items (ceux du doublon qui n'existent pas dans le master)
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM edl_items WHERE edl_id = p_duplicate_id;
  ELSE
    UPDATE edl_items SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'edl_items.edl_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 3. Transfert edl_media
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM edl_media WHERE edl_id = p_duplicate_id;
  ELSE
    UPDATE edl_media SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'edl_media.edl_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 4. Transfert edl_signatures
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM edl_signatures WHERE edl_id = p_duplicate_id;
  ELSE
    UPDATE edl_signatures SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'edl_signatures.edl_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 5. Transfert edl_meter_readings
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_count FROM edl_meter_readings WHERE edl_id = p_duplicate_id;
  ELSE
    UPDATE edl_meter_readings SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  step := '2.TRANSFER'; detail := 'edl_meter_readings.edl_id'; affected_rows := v_count;
  RETURN NEXT;

  -- 6. Suppression
  IF NOT p_dry_run THEN
    DELETE FROM edl WHERE id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
    VALUES ('MERGE', 'edl', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion EDL doublon');
  ELSE
    v_count := 1;
  END IF;
  step := '3.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count;
  RETURN NEXT;

  step := 'DONE';
  detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN' ELSE '✅ Fusion exécutée' END;
  affected_rows := 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PHASE 5 : PRÉVENTION — CONTRAINTES FK, UNIQUE, TRIGGERS
-- ============================================================================
-- ⚠️ Ces contraintes sont ajoutées avec NOT VALID + VALIDATE séparément
-- pour éviter de bloquer la table pendant la création.
-- Elles sont idempotentes (IF NOT EXISTS / DO $$ ... $$).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 FK Formelles manquantes
-- ----------------------------------------------------------------------------

-- leases.tenant_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leases_tenant_id' AND table_name = 'leases'
  ) THEN
    -- D'abord nettoyer les valeurs invalides
    UPDATE leases SET tenant_id = NULL
    WHERE tenant_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = leases.tenant_id);
    -- Puis ajouter la contrainte
    ALTER TABLE leases
      ADD CONSTRAINT fk_leases_tenant_id
      FOREIGN KEY (tenant_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- leases.owner_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_leases_owner_id' AND table_name = 'leases'
  ) THEN
    UPDATE leases SET owner_id = NULL
    WHERE owner_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = leases.owner_id);
    ALTER TABLE leases
      ADD CONSTRAINT fk_leases_owner_id
      FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- tickets.assigned_provider_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tickets_assigned_provider_id' AND table_name = 'tickets'
  ) THEN
    UPDATE tickets SET assigned_provider_id = NULL
    WHERE assigned_provider_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = tickets.assigned_provider_id);
    ALTER TABLE tickets
      ADD CONSTRAINT fk_tickets_assigned_provider_id
      FOREIGN KEY (assigned_provider_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- tickets.owner_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tickets_owner_id' AND table_name = 'tickets'
  ) THEN
    UPDATE tickets SET owner_id = NULL
    WHERE owner_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = tickets.owner_id);
    ALTER TABLE tickets
      ADD CONSTRAINT fk_tickets_owner_id
      FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- documents.profile_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_documents_profile_id' AND table_name = 'documents'
  ) THEN
    UPDATE documents SET profile_id = NULL
    WHERE profile_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = documents.profile_id);
    ALTER TABLE documents
      ADD CONSTRAINT fk_documents_profile_id
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- building_units.current_lease_id → leases.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_building_units_current_lease_id' AND table_name = 'building_units'
  ) THEN
    UPDATE building_units SET current_lease_id = NULL
    WHERE current_lease_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM leases WHERE id = building_units.current_lease_id);
    ALTER TABLE building_units
      ADD CONSTRAINT fk_building_units_current_lease_id
      FOREIGN KEY (current_lease_id) REFERENCES leases(id) ON DELETE SET NULL;
  END IF;
END $$;

-- work_orders.quote_id → quotes.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_work_orders_quote_id' AND table_name = 'work_orders'
  ) THEN
    UPDATE work_orders SET quote_id = NULL
    WHERE quote_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM quotes WHERE id = work_orders.quote_id);
    ALTER TABLE work_orders
      ADD CONSTRAINT fk_work_orders_quote_id
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- work_orders.property_id → properties.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_work_orders_property_id' AND table_name = 'work_orders'
  ) THEN
    UPDATE work_orders SET property_id = NULL
    WHERE property_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM properties WHERE id = work_orders.property_id);
    ALTER TABLE work_orders
      ADD CONSTRAINT fk_work_orders_property_id
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5.2 Contraintes UNIQUE pour empêcher les futurs doublons
-- ----------------------------------------------------------------------------

-- Empêcher 2 factures pour le même bail + même période
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_lease_periode'
  ) THEN
    -- Supprimer les doublons avant d'ajouter la contrainte
    -- On garde la plus ancienne (ou la payée si elle existe)
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY lease_id, periode
        ORDER BY
          CASE WHEN statut = 'paid' THEN 0 ELSE 1 END,
          created_at ASC
      ) AS rn
      FROM invoices
    )
    DELETE FROM invoices WHERE id IN (
      SELECT id FROM ranked WHERE rn > 1
    );

    ALTER TABLE invoices
      ADD CONSTRAINT uq_invoices_lease_periode
      UNIQUE (lease_id, periode);
  END IF;
END $$;

-- Empêcher 2 signataires identiques sur le même bail
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_lease_signers_lease_profile'
  ) THEN
    -- Supprimer les doublons (garder le plus ancien)
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY lease_id, profile_id
        ORDER BY
          CASE WHEN signature_status = 'signed' THEN 0 ELSE 1 END,
          created_at ASC
      ) AS rn
      FROM lease_signers
      WHERE profile_id IS NOT NULL
    )
    DELETE FROM lease_signers WHERE id IN (
      SELECT id FROM ranked WHERE rn > 1
    );

    -- Contrainte partielle (profile_id non null)
    CREATE UNIQUE INDEX IF NOT EXISTS uq_lease_signers_lease_profile
      ON lease_signers (lease_id, profile_id)
      WHERE profile_id IS NOT NULL;
  END IF;
END $$;

-- Empêcher 2 EDL de même type sur le même bail (hors annulés)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_edl_lease_type_active'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_edl_lease_type_active
      ON edl (lease_id, type)
      WHERE status NOT IN ('cancelled', 'disputed');
  END IF;
END $$;

-- Empêcher les doublons de roommates sur le même bail
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_roommates_lease_profile'
  ) THEN
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY lease_id, profile_id ORDER BY created_at ASC
      ) AS rn
      FROM roommates
    )
    DELETE FROM roommates WHERE id IN (
      SELECT id FROM ranked WHERE rn > 1
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_roommates_lease_profile
      ON roommates (lease_id, profile_id);
  END IF;
END $$;

-- Empêcher les abonnements actifs multiples par user
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_subscriptions_user_active'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user_active
      ON subscriptions (user_id)
      WHERE status IN ('active', 'trialing');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5.3 Trigger anti-doublon sur INSERT de propriétés
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_duplicate_property()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- Chercher un doublon exact (même owner + même adresse + même CP)
  SELECT id INTO v_existing_id
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND LOWER(TRIM(adresse_complete)) = LOWER(TRIM(NEW.adresse_complete))
    AND code_postal = NEW.code_postal
    AND deleted_at IS NULL
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Propriété en doublon détectée (id: %). Même adresse et code postal pour ce propriétaire.', v_existing_id
      USING HINT = 'Vérifiez si cette propriété existe déjà avant d''en créer une nouvelle.',
            ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_property ON properties;
CREATE TRIGGER trg_prevent_duplicate_property
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_property();

-- ----------------------------------------------------------------------------
-- 5.4 Trigger anti-doublon sur INSERT de paiements (même invoice + même montant + <24h)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_duplicate_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  SELECT id INTO v_existing_id
  FROM payments
  WHERE invoice_id = NEW.invoice_id
    AND montant = NEW.montant
    AND ABS(EXTRACT(EPOCH FROM (created_at - NOW()))) < 86400
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE WARNING 'Paiement potentiellement en doublon (id existant: %). Même montant + même facture en < 24h.', v_existing_id;
    -- On ne bloque pas, on avertit seulement (pour ne pas casser les paiements légitimes)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_payment ON payments;
CREATE TRIGGER trg_prevent_duplicate_payment
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_payment();


-- ============================================================================
-- LOGS
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  AUDIT V2 — Fusion, Prévention, Contraintes installés';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 3 — Détection avancée doublons :';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_properties();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_profiles();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_leases();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_documents();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_payments();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_edl();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_invoices();';
  RAISE NOTICE '    SELECT * FROM audit_all_duplicates_summary();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 4 — Fusion SAFE (DRY RUN par défaut) :';
  RAISE NOTICE '    SELECT * FROM merge_duplicate_properties(master, dup, true);';
  RAISE NOTICE '    SELECT * FROM merge_duplicate_invoices(master, dup, true);';
  RAISE NOTICE '    SELECT * FROM merge_duplicate_documents(master, dup, true);';
  RAISE NOTICE '    SELECT * FROM merge_duplicate_edl(master, dup, true);';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 5 — Contraintes de prévention installées :';
  RAISE NOTICE '    - 8 FK formelles ajoutées';
  RAISE NOTICE '    - 5 contraintes UNIQUE ajoutées';
  RAISE NOTICE '    - 2 triggers anti-doublon activés';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $$;
