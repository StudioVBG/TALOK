-- ============================================================================
-- AUDIT D'INTÉGRITÉ V3 — VÉRIFICATIONS ÉTENDUES & QUALITÉ DES DONNÉES
-- Date: 2026-02-12
-- Complète 20260212000000 + 20260212100000
-- ============================================================================
-- Ce script ajoute :
--   Phase 6 : Intégrité signatures (sessions, participants, preuves)
--   Phase 7 : Intégrité organisations & white-label
--   Phase 8 : Intégrité commercial (fonds de commerce, location-gérance)
--   Phase 9 : Qualité des données (champs obligatoires, cohérence métier)
--   Phase 10 : Rapport d'audit unifié (score global)
-- ============================================================================
-- PRÉREQUIS : 20260212000000 + 20260212100000 déjà appliqués
-- ============================================================================


-- ============================================================================
-- PHASE 6 : INTÉGRITÉ DES SIGNATURES
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_signature_integrity()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT,
  sample_ids TEXT
) AS $$
BEGIN

  -- Sessions sans participants
  RETURN QUERY
  SELECT 'sessions_without_participants'::TEXT,
    'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Sessions de signature actives sans aucun participant'::TEXT,
    string_agg(ss.id::TEXT, ', ' ORDER BY ss.created_at LIMIT 5)::TEXT
  FROM signature_sessions ss
  WHERE ss.status IN ('pending', 'ongoing')
    AND NOT EXISTS (SELECT 1 FROM signature_participants sp WHERE sp.session_id = ss.id);

  -- Participants orphelins (session supprimée)
  RETURN QUERY
  SELECT 'orphan_participants'::TEXT,
    'signature_participants'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Participants dont la session de signature n''existe plus'::TEXT,
    string_agg(sp.id::TEXT, ', ' ORDER BY sp.created_at LIMIT 5)::TEXT
  FROM signature_participants sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sp.session_id);

  -- Preuves orphelines (participant supprimé)
  RETURN QUERY
  SELECT 'orphan_proofs'::TEXT,
    'signature_proofs'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Preuves de signature dont le participant n''existe plus'::TEXT,
    string_agg(sp.id::TEXT, ', ' ORDER BY sp.created_at LIMIT 5)::TEXT
  FROM signature_proofs sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_participants pa WHERE pa.id = sp.participant_id);

  -- Sessions "done" sans preuve pour tous les participants signés
  RETURN QUERY
  SELECT 'done_sessions_missing_proofs'::TEXT,
    'signature_sessions'::TEXT,
    COUNT(DISTINCT ss.id)::BIGINT,
    'HIGH'::TEXT,
    'Sessions terminées avec des participants signés sans preuve eIDAS'::TEXT,
    string_agg(DISTINCT ss.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM signature_sessions ss
  JOIN signature_participants sp ON sp.session_id = ss.id
  WHERE ss.status = 'done'
    AND sp.status = 'signed'
    AND NOT EXISTS (
      SELECT 1 FROM signature_proofs pr WHERE pr.participant_id = sp.id
    );

  -- Sessions expirées non marquées
  RETURN QUERY
  SELECT 'expired_sessions_not_marked'::TEXT,
    'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Sessions avec deadline dépassée mais statut non-expiré'::TEXT,
    string_agg(ss.id::TEXT, ', ' ORDER BY ss.deadline LIMIT 5)::TEXT
  FROM signature_sessions ss
  WHERE ss.deadline < NOW()
    AND ss.status IN ('pending', 'ongoing');

  -- Audit log orphelin
  RETURN QUERY
  SELECT 'orphan_audit_log'::TEXT,
    'signature_audit_log'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Logs d''audit dont la session n''existe plus'::TEXT,
    NULL::TEXT
  FROM signature_audit_log sal
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sal.session_id);

  -- Participants avec profile_id invalide
  RETURN QUERY
  SELECT 'participant_invalid_profile'::TEXT,
    'signature_participants'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Participants avec un profile_id pointant vers un profil inexistant'::TEXT,
    string_agg(sp.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM signature_participants sp
  WHERE sp.profile_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = sp.profile_id);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_signature_integrity() IS
  'Vérifie l''intégrité du système de signatures (sessions, participants, preuves eIDAS).';


-- ============================================================================
-- PHASE 7 : INTÉGRITÉ ORGANISATIONS & WHITE-LABEL
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_organization_integrity()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT,
  sample_ids TEXT
) AS $$
BEGIN

  -- Organisations sans owner
  RETURN QUERY
  SELECT 'org_without_owner'::TEXT,
    'organizations'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Organisations dont le propriétaire (auth.users) n''existe plus'::TEXT,
    string_agg(o.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM organizations o
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.owner_id);

  -- Membres orphelins (org supprimée)
  RETURN QUERY
  SELECT 'orphan_members'::TEXT,
    'organization_members'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Membres d''organisation dont l''organisation n''existe plus'::TEXT,
    string_agg(om.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM organization_members om
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = om.organization_id);

  -- Membres orphelins (user supprimé)
  RETURN QUERY
  SELECT 'member_invalid_user'::TEXT,
    'organization_members'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Membres d''organisation dont le user_id n''existe plus'::TEXT,
    string_agg(om.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM organization_members om
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = om.user_id);

  -- Branding orphelin
  RETURN QUERY
  SELECT 'orphan_branding'::TEXT,
    'organization_branding'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Branding d''organisation dont l''organisation n''existe plus'::TEXT,
    string_agg(ob.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM organization_branding ob
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ob.organization_id);

  -- Domaines personnalisés orphelins
  RETURN QUERY
  SELECT 'orphan_domains'::TEXT,
    'custom_domains'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Domaines personnalisés dont l''organisation n''existe plus'::TEXT,
    string_agg(cd.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM custom_domains cd
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = cd.organization_id);

  -- Orgs actives sans branding
  RETURN QUERY
  SELECT 'active_org_no_branding'::TEXT,
    'organizations'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Organisations actives en mode white-label sans branding configuré'::TEXT,
    string_agg(o.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM organizations o
  WHERE o.is_active = true
    AND o.white_label_level != 'none'
    AND NOT EXISTS (SELECT 1 FROM organization_branding ob WHERE ob.organization_id = o.id);

  -- Domaines actifs avec SSL expiré
  RETURN QUERY
  SELECT 'expired_ssl'::TEXT,
    'custom_domains'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Domaines actifs avec certificat SSL expiré'::TEXT,
    string_agg(cd.domain, ', ' LIMIT 5)::TEXT
  FROM custom_domains cd
  WHERE cd.is_active = true
    AND cd.verified = true
    AND cd.ssl_expires_at IS NOT NULL
    AND cd.ssl_expires_at < NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_organization_integrity() IS
  'Vérifie l''intégrité du système multi-tenant et white-label.';


-- ============================================================================
-- PHASE 8 : INTÉGRITÉ COMMERCIAL (FONDS DE COMMERCE, LOCATION-GÉRANCE)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_commercial_integrity()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT,
  sample_ids TEXT
) AS $$
BEGIN

  -- Fonds de commerce sans owner
  RETURN QUERY
  SELECT 'fonds_without_owner'::TEXT,
    'fonds_commerce'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Fonds de commerce dont le propriétaire n''existe plus'::TEXT,
    string_agg(fc.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM fonds_commerce fc
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = fc.owner_id);

  -- Fonds avec bail_commercial_id invalide
  RETURN QUERY
  SELECT 'fonds_invalid_bail'::TEXT,
    'fonds_commerce'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Fonds avec bail_commercial_id pointant vers un bail inexistant'::TEXT,
    string_agg(fc.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM fonds_commerce fc
  WHERE fc.bail_commercial_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = fc.bail_commercial_id);

  -- Licences orphelines
  RETURN QUERY
  SELECT 'orphan_licences'::TEXT,
    'fonds_commerce_licences'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Licences dont le fonds de commerce n''existe plus'::TEXT,
    string_agg(fcl.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM fonds_commerce_licences fcl
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = fcl.fonds_id);

  -- Équipements orphelins
  RETURN QUERY
  SELECT 'orphan_equipements'::TEXT,
    'fonds_commerce_equipements'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Équipements dont le fonds de commerce n''existe plus'::TEXT,
    string_agg(fce.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM fonds_commerce_equipements fce
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = fce.fonds_id);

  -- Contrats location-gérance avec fonds supprimé
  RETURN QUERY
  SELECT 'gerance_orphan_fonds'::TEXT,
    'location_gerance_contracts'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Contrats de location-gérance dont le fonds n''existe plus'::TEXT,
    string_agg(lgc.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM location_gerance_contracts lgc
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = lgc.fonds_id);

  -- Redevances orphelines
  RETURN QUERY
  SELECT 'orphan_redevances'::TEXT,
    'location_gerance_redevances'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Redevances dont le contrat de location-gérance n''existe plus'::TEXT,
    string_agg(lgr.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM location_gerance_redevances lgr
  WHERE NOT EXISTS (SELECT 1 FROM location_gerance_contracts lgc WHERE lgc.id = lgr.contract_id);

  -- Contrats actifs avec date_fin dépassée
  RETURN QUERY
  SELECT 'expired_contracts_active'::TEXT,
    'location_gerance_contracts'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Contrats location-gérance actifs avec date_fin dépassée'::TEXT,
    string_agg(lgc.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM location_gerance_contracts lgc
  WHERE lgc.status = 'active'
    AND lgc.date_fin IS NOT NULL
    AND lgc.date_fin < CURRENT_DATE;

  -- Redevances impayées > 90 jours
  RETURN QUERY
  SELECT 'overdue_redevances'::TEXT,
    'location_gerance_redevances'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Redevances impayées depuis plus de 90 jours'::TEXT,
    string_agg(lgr.id::TEXT, ', ' LIMIT 5)::TEXT
  FROM location_gerance_redevances lgr
  WHERE lgr.statut IN ('pending', 'late')
    AND lgr.date_echeance < CURRENT_DATE - INTERVAL '90 days';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_commercial_integrity() IS
  'Vérifie l''intégrité des fonds de commerce et contrats de location-gérance.';


-- ============================================================================
-- PHASE 9 : QUALITÉ DES DONNÉES & COHÉRENCE MÉTIER
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_data_quality()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT
) AS $$
BEGIN

  -- ── PROFILS ──────────────────────────────────────────────────────────

  -- Profils sans email
  RETURN QUERY
  SELECT 'profile_missing_email'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Profils sans adresse email'::TEXT
  FROM profiles p
  WHERE (p.email IS NULL OR TRIM(p.email) = '');

  -- Profils sans nom
  RETURN QUERY
  SELECT 'profile_missing_name'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Profils sans nom renseigné'::TEXT
  FROM profiles p
  WHERE (p.nom IS NULL OR TRIM(p.nom) = '');

  -- Profils owner sans owner_profiles
  RETURN QUERY
  SELECT 'owner_without_owner_profile'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Profils avec role=owner sans enregistrement owner_profiles associé'::TEXT
  FROM profiles p
  WHERE p.role = 'owner'
    AND NOT EXISTS (SELECT 1 FROM owner_profiles op WHERE op.profile_id = p.id);

  -- Profils tenant sans tenant_profiles
  RETURN QUERY
  SELECT 'tenant_without_tenant_profile'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Profils avec role=tenant sans enregistrement tenant_profiles associé'::TEXT
  FROM profiles p
  WHERE p.role = 'tenant'
    AND NOT EXISTS (SELECT 1 FROM tenant_profiles tp WHERE tp.profile_id = p.id);

  -- ── PROPRIÉTÉS ───────────────────────────────────────────────────────

  -- Propriétés sans adresse
  RETURN QUERY
  SELECT 'property_missing_address'::TEXT,
    'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Propriétés sans adresse complète'::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
    AND (p.adresse_complete IS NULL OR TRIM(p.adresse_complete) = '');

  -- Propriétés sans code postal
  RETURN QUERY
  SELECT 'property_missing_postal_code'::TEXT,
    'properties'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Propriétés sans code postal'::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
    AND (p.code_postal IS NULL OR TRIM(p.code_postal) = '');

  -- Propriétés avec surface <= 0
  RETURN QUERY
  SELECT 'property_invalid_surface'::TEXT,
    'properties'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Propriétés avec surface <= 0 ou NULL'::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
    AND (p.surface IS NULL OR p.surface <= 0);

  -- ── BAUX ─────────────────────────────────────────────────────────────

  -- Baux actifs sans owner_id ET sans tenant_id
  RETURN QUERY
  SELECT 'lease_no_parties'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Baux actifs sans propriétaire NI locataire'::TEXT
  FROM leases l
  WHERE l.statut NOT IN ('draft', 'cancelled', 'archived')
    AND l.owner_id IS NULL
    AND l.tenant_id IS NULL;

  -- Baux avec date_fin < date_debut
  RETURN QUERY
  SELECT 'lease_invalid_dates'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Baux avec date_fin antérieure à date_debut'::TEXT
  FROM leases l
  WHERE l.date_fin IS NOT NULL
    AND l.date_fin < l.date_debut;

  -- Baux actifs avec loyer <= 0
  RETURN QUERY
  SELECT 'lease_invalid_rent'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux actifs avec loyer <= 0 ou NULL'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND (l.loyer IS NULL OR l.loyer <= 0);

  -- Baux terminés mais toujours marqués actifs (date_fin dépassée > 30j)
  RETURN QUERY
  SELECT 'lease_should_be_terminated'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Baux actifs avec date_fin dépassée de plus de 30 jours'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND l.date_fin IS NOT NULL
    AND l.date_fin < CURRENT_DATE - INTERVAL '30 days';

  -- ── FACTURES ─────────────────────────────────────────────────────────

  -- Factures avec montant négatif
  RETURN QUERY
  SELECT 'invoice_negative_amount'::TEXT,
    'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures avec montant_total négatif'::TEXT
  FROM invoices i
  WHERE i.montant_total < 0;

  -- Factures "paid" sans aucun paiement
  RETURN QUERY
  SELECT 'invoice_paid_no_payment'::TEXT,
    'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures marquées payées sans aucun enregistrement de paiement'::TEXT
  FROM invoices i
  WHERE i.statut = 'paid'
    AND NOT EXISTS (SELECT 1 FROM payments py WHERE py.invoice_id = i.id);

  -- Factures envoyées mais bail terminé/annulé
  RETURN QUERY
  SELECT 'invoice_on_terminated_lease'::TEXT,
    'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Factures non-payées sur des baux terminés ou annulés'::TEXT
  FROM invoices i
  JOIN leases l ON l.id = i.lease_id
  WHERE i.statut NOT IN ('paid', 'cancelled')
    AND l.statut IN ('terminated', 'cancelled', 'archived');

  -- ── DOCUMENTS ────────────────────────────────────────────────────────

  -- Documents expirés non marqués
  RETURN QUERY
  SELECT 'document_expired_not_flagged'::TEXT,
    'documents'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents avec valid_until dépassé mais statut toujours actif'::TEXT
  FROM documents d
  WHERE d.valid_until IS NOT NULL
    AND d.valid_until < CURRENT_DATE
    AND d.ged_status = 'active';

  -- Documents obligatoires manquants pour baux actifs
  RETURN QUERY
  SELECT 'lease_missing_mandatory_docs'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux actifs sans document de type bail attaché'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND NOT EXISTS (
      SELECT 1 FROM documents d
      WHERE d.lease_id = l.id AND d.type = 'bail'
    );

  -- ── DÉPÔTS DE GARANTIE ──────────────────────────────────────────────

  -- Baux actifs sans mouvement de dépôt
  RETURN QUERY
  SELECT 'lease_missing_deposit'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Baux actifs avec dépôt de garantie > 0 mais sans mouvement de dépôt'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND l.depot_de_garantie IS NOT NULL
    AND l.depot_de_garantie > 0
    AND NOT EXISTS (SELECT 1 FROM deposit_movements dm WHERE dm.lease_id = l.id);

  -- ── ENTITÉS LÉGALES ─────────────────────────────────────────────────

  -- Entités actives sans gérant
  RETURN QUERY
  SELECT 'entity_no_manager'::TEXT,
    'legal_entities'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Entités légales actives de type société sans gérant désigné'::TEXT
  FROM legal_entities le
  WHERE le.is_active = true
    AND le.entity_type NOT IN ('particulier', 'indivision')
    AND NOT EXISTS (
      SELECT 1 FROM entity_associates ea
      WHERE ea.legal_entity_id = le.id AND ea.is_gerant = true AND ea.is_current = true
    );

  -- Détention totale != 100% par propriété
  RETURN QUERY
  SELECT 'ownership_not_100_percent'::TEXT,
    'property_ownership'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Propriétés dont la somme des pourcentages de détention != 100%'::TEXT
  FROM (
    SELECT po.property_id, SUM(po.pourcentage_detention) AS total
    FROM property_ownership po
    WHERE po.is_current = true
    GROUP BY po.property_id
    HAVING ABS(SUM(po.pourcentage_detention) - 100) > 0.01
  ) sub;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_data_quality() IS
  'Vérifie la qualité et la cohérence métier des données (champs manquants, incohérences).';


-- ============================================================================
-- PHASE 10 : RAPPORT UNIFIÉ + SCORE DE SANTÉ
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_full_report()
RETURNS TABLE(
  category TEXT,
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT
) AS $$
BEGIN

  -- Orphelins (V1)
  RETURN QUERY
  SELECT 'ORPHANS'::TEXT, aor.fk_column, aor.source_table, aor.orphan_count, aor.severity, aor.description
  FROM audit_orphan_records() aor
  WHERE aor.orphan_count > 0;

  -- Doublons (V1)
  RETURN QUERY
  SELECT 'DUPLICATES'::TEXT, adr.duplicate_key, adr.table_name, adr.duplicate_count, adr.severity, adr.description
  FROM audit_duplicate_records() adr;

  -- Signatures (V3)
  RETURN QUERY
  SELECT 'SIGNATURES'::TEXT, asi.check_name, asi.source_table, asi.issue_count, asi.severity, asi.description
  FROM audit_signature_integrity() asi
  WHERE asi.issue_count > 0;

  -- Organisations (V3)
  RETURN QUERY
  SELECT 'ORGANIZATIONS'::TEXT, aoi.check_name, aoi.source_table, aoi.issue_count, aoi.severity, aoi.description
  FROM audit_organization_integrity() aoi
  WHERE aoi.issue_count > 0;

  -- Commercial (V3)
  RETURN QUERY
  SELECT 'COMMERCIAL'::TEXT, aci.check_name, aci.source_table, aci.issue_count, aci.severity, aci.description
  FROM audit_commercial_integrity() aci
  WHERE aci.issue_count > 0;

  -- Qualité (V3)
  RETURN QUERY
  SELECT 'DATA_QUALITY'::TEXT, adq.check_name, adq.source_table, adq.issue_count, adq.severity, adq.description
  FROM audit_data_quality() adq
  WHERE adq.issue_count > 0;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_full_report() IS
  'Rapport d''audit complet combinant toutes les vérifications (orphelins, doublons, signatures, orga, commercial, qualité).';


-- Score de santé global (0-100)
CREATE OR REPLACE FUNCTION audit_health_score()
RETURNS TABLE(
  total_checks INTEGER,
  passed_checks INTEGER,
  critical_issues INTEGER,
  high_issues INTEGER,
  medium_issues INTEGER,
  low_issues INTEGER,
  health_score NUMERIC(5,2),
  grade TEXT
) AS $$
DECLARE
  v_total INTEGER := 0;
  v_passed INTEGER := 0;
  v_critical INTEGER := 0;
  v_high INTEGER := 0;
  v_medium INTEGER := 0;
  v_low INTEGER := 0;
  v_score NUMERIC(5,2);
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM audit_full_report() LOOP
    v_total := v_total + 1;
    CASE r.severity
      WHEN 'CRITICAL' THEN v_critical := v_critical + 1;
      WHEN 'HIGH' THEN v_high := v_high + 1;
      WHEN 'MEDIUM' THEN v_medium := v_medium + 1;
      WHEN 'LOW' THEN v_low := v_low + 1;
      ELSE NULL;
    END CASE;
  END LOOP;

  -- Compter le total attendu de checks (orphelins + doublons + signatures + orga + commercial + qualité)
  -- On considère les catégories, pas les résultats
  v_total := v_total + 20; -- base checks that can pass silently
  v_passed := v_total - (v_critical + v_high + v_medium + v_low);

  -- Score : chaque sévérité a un poids
  -- CRITICAL = -10, HIGH = -5, MEDIUM = -2, LOW = -0.5
  v_score := GREATEST(0, LEAST(100,
    100.0
    - (v_critical * 10.0)
    - (v_high * 5.0)
    - (v_medium * 2.0)
    - (v_low * 0.5)
  ));

  total_checks := v_total;
  passed_checks := v_passed;
  critical_issues := v_critical;
  high_issues := v_high;
  medium_issues := v_medium;
  low_issues := v_low;
  health_score := v_score;
  grade := CASE
    WHEN v_score >= 95 THEN 'A+'
    WHEN v_score >= 90 THEN 'A'
    WHEN v_score >= 80 THEN 'B'
    WHEN v_score >= 70 THEN 'C'
    WHEN v_score >= 50 THEN 'D'
    ELSE 'F'
  END;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_health_score() IS
  'Retourne un score de santé global de la base (0-100) avec une note A+ à F.';


-- ============================================================================
-- LOGS DE MIGRATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  AUDIT V3 — Vérifications étendues installées';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 6 — Intégrité signatures :';
  RAISE NOTICE '    SELECT * FROM audit_signature_integrity();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 7 — Intégrité organisations :';
  RAISE NOTICE '    SELECT * FROM audit_organization_integrity();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 8 — Intégrité commercial :';
  RAISE NOTICE '    SELECT * FROM audit_commercial_integrity();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 9 — Qualité des données :';
  RAISE NOTICE '    SELECT * FROM audit_data_quality();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 10 — Rapport unifié + Score :';
  RAISE NOTICE '    SELECT * FROM audit_full_report();';
  RAISE NOTICE '    SELECT * FROM audit_health_score();';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $$;
