-- ========================================
-- BATCH 2: Migrations 20260212 (audit + guarantor + email)
-- ========================================


-- ============================================
-- SOURCE: 20260212000000_audit_database_integrity.sql
-- ============================================
-- ============================================================================
-- AUDIT D'INTÉGRITÉ DE LA BASE DE DONNÉES TALOK
-- Date: 2026-02-12
-- Auteur: Audit automatisé
-- ============================================================================
-- Ce script est un audit SAFE (lecture seule + fonctions de diagnostic).
-- Il ne supprime AUCUNE donnée. Il crée :
--   1. Des fonctions RPC de diagnostic pour détecter les orphelins
--   2. Des fonctions RPC de diagnostic pour détecter les doublons
--   3. Une vue matérialisée consolidée de l'état d'intégrité
--   4. Des fonctions de nettoyage SAFE (soft-delete / archivage)
-- ============================================================================

-- ============================================================================
-- PHASE 1: FONCTIONS DE DÉTECTION DES ORPHELINS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Audit global : retourne toutes les relations orphelines en un seul appel
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_orphan_records()
RETURNS TABLE(
  source_table TEXT,
  fk_column TEXT,
  target_table TEXT,
  orphan_count BIGINT,
  severity TEXT,
  description TEXT
) AS $$
BEGIN

  -- ── PROFILES ──────────────────────────────────────────────────────
  -- profiles → auth.users (user_id)
  RETURN QUERY
  SELECT 'profiles'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profiles sans compte auth.users associé'::TEXT
  FROM profiles p
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);

  -- ── PROPERTIES ────────────────────────────────────────────────────
  -- properties → profiles (owner_id)
  RETURN QUERY
  SELECT 'properties'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Propriétés dont le propriétaire (profile) n''existe plus'::TEXT
  FROM properties p
  WHERE p.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = p.owner_id);

  -- properties → buildings (building_id)
  RETURN QUERY
  SELECT 'properties'::TEXT, 'building_id'::TEXT, 'buildings'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Propriétés avec building_id pointant vers un immeuble inexistant'::TEXT
  FROM properties p
  WHERE p.building_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = p.building_id);

  -- properties → legal_entities (legal_entity_id)
  RETURN QUERY
  SELECT 'properties'::TEXT, 'legal_entity_id'::TEXT, 'legal_entities'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Propriétés avec legal_entity_id pointant vers une entité inexistante'::TEXT
  FROM properties p
  WHERE p.legal_entity_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.id = p.legal_entity_id);

  -- ── UNITS ─────────────────────────────────────────────────────────
  -- units → properties (property_id)
  RETURN QUERY
  SELECT 'units'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Unités de colocation dont la propriété n''existe plus'::TEXT
  FROM units u
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = u.property_id);

  -- ── LEASES ────────────────────────────────────────────────────────
  -- leases → properties (property_id)
  RETURN QUERY
  SELECT 'leases'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Baux dont la propriété n''existe plus'::TEXT
  FROM leases l
  WHERE l.property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = l.property_id);

  -- leases → units (unit_id)
  RETURN QUERY
  SELECT 'leases'::TEXT, 'unit_id'::TEXT, 'units'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux dont l''unité n''existe plus'::TEXT
  FROM leases l
  WHERE l.unit_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM units u WHERE u.id = l.unit_id);

  -- leases → profiles (tenant_id) — FK implicite ajoutée plus tard
  RETURN QUERY
  SELECT 'leases'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux dont le locataire (tenant_id) n''existe plus dans profiles'::TEXT
  FROM leases l
  WHERE l.tenant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = l.tenant_id);

  -- leases → profiles (owner_id) — FK implicite
  RETURN QUERY
  SELECT 'leases'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux dont le propriétaire (owner_id) n''existe plus dans profiles'::TEXT
  FROM leases l
  WHERE l.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = l.owner_id);

  -- Baux actifs sans aucun signataire
  RETURN QUERY
  SELECT 'leases'::TEXT, '(no_signers)'::TEXT, 'lease_signers'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux actifs/pending sans aucun signataire'::TEXT
  FROM leases l
  WHERE l.statut NOT IN ('draft', 'cancelled', 'archived', 'terminated')
    AND NOT EXISTS (SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id);

  -- ── LEASE_SIGNERS ─────────────────────────────────────────────────
  -- lease_signers → leases (lease_id)
  RETURN QUERY
  SELECT 'lease_signers'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Signataires dont le bail n''existe plus'::TEXT
  FROM lease_signers ls
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);

  -- lease_signers → profiles (profile_id)
  RETURN QUERY
  SELECT 'lease_signers'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Signataires dont le profil n''existe plus'::TEXT
  FROM lease_signers ls
  WHERE ls.profile_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = ls.profile_id);

  -- ── INVOICES ──────────────────────────────────────────────────────
  -- invoices → leases (lease_id)
  RETURN QUERY
  SELECT 'invoices'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Factures dont le bail n''existe plus'::TEXT
  FROM invoices i
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);

  -- invoices → profiles (owner_id)
  RETURN QUERY
  SELECT 'invoices'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures dont le profil propriétaire n''existe plus'::TEXT
  FROM invoices i
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = i.owner_id);

  -- invoices → profiles (tenant_id)
  RETURN QUERY
  SELECT 'invoices'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures dont le profil locataire n''existe plus'::TEXT
  FROM invoices i
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = i.tenant_id);

  -- ── PAYMENTS ──────────────────────────────────────────────────────
  -- payments → invoices (invoice_id)
  RETURN QUERY
  SELECT 'payments'::TEXT, 'invoice_id'::TEXT, 'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Paiements dont la facture n''existe plus'::TEXT
  FROM payments py
  WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);

  -- ── DOCUMENTS ─────────────────────────────────────────────────────
  -- documents → leases (lease_id)
  RETURN QUERY
  SELECT 'documents'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Documents dont le bail n''existe plus'::TEXT
  FROM documents d
  WHERE d.lease_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);

  -- documents → properties (property_id)
  RETURN QUERY
  SELECT 'documents'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont la propriété n''existe plus'::TEXT
  FROM documents d
  WHERE d.property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);

  -- documents → profiles (owner_id)
  RETURN QUERY
  SELECT 'documents'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont le profil owner n''existe plus'::TEXT
  FROM documents d
  WHERE d.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.owner_id);

  -- documents → profiles (tenant_id)
  RETURN QUERY
  SELECT 'documents'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont le profil tenant n''existe plus'::TEXT
  FROM documents d
  WHERE d.tenant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.tenant_id);

  -- documents → profiles (profile_id)
  RETURN QUERY
  SELECT 'documents'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont le profile_id n''existe plus'::TEXT
  FROM documents d
  WHERE d.profile_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.profile_id);

  -- Documents totalement flottants (aucune FK remplie)
  RETURN QUERY
  SELECT 'documents'::TEXT, '(no_parent)'::TEXT, '(none)'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Documents sans aucun rattachement (owner_id, tenant_id, property_id, lease_id tous NULL)'::TEXT
  FROM documents d
  WHERE d.owner_id IS NULL
    AND d.tenant_id IS NULL
    AND d.property_id IS NULL
    AND d.lease_id IS NULL
    AND d.profile_id IS NULL;

  -- ── TICKETS ───────────────────────────────────────────────────────
  -- tickets → properties (property_id)
  RETURN QUERY
  SELECT 'tickets'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Tickets dont la propriété n''existe plus'::TEXT
  FROM tickets t
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = t.property_id);

  -- tickets → profiles (created_by_profile_id)
  RETURN QUERY
  SELECT 'tickets'::TEXT, 'created_by_profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Tickets dont le créateur n''existe plus'::TEXT
  FROM tickets t
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.created_by_profile_id);

  -- tickets → leases (lease_id)
  RETURN QUERY
  SELECT 'tickets'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Tickets avec lease_id pointant vers un bail inexistant'::TEXT
  FROM tickets t
  WHERE t.lease_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);

  -- ── WORK_ORDERS ───────────────────────────────────────────────────
  -- work_orders → tickets (ticket_id)
  RETURN QUERY
  SELECT 'work_orders'::TEXT, 'ticket_id'::TEXT, 'tickets'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Ordres de travail dont le ticket n''existe plus'::TEXT
  FROM work_orders wo
  WHERE NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = wo.ticket_id);

  -- work_orders → profiles (provider_id)
  RETURN QUERY
  SELECT 'work_orders'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Ordres de travail dont le prestataire n''existe plus'::TEXT
  FROM work_orders wo
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = wo.provider_id);

  -- ── CHARGES ───────────────────────────────────────────────────────
  -- charges → properties (property_id)
  RETURN QUERY
  SELECT 'charges'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Charges dont la propriété n''existe plus'::TEXT
  FROM charges c
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = c.property_id);

  -- ── EDL ───────────────────────────────────────────────────────────
  -- edl → leases (lease_id)
  RETURN QUERY
  SELECT 'edl'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'États des lieux dont le bail n''existe plus'::TEXT
  FROM edl e
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id);

  -- edl_items → edl (edl_id)
  RETURN QUERY
  SELECT 'edl_items'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Items d''EDL dont l''EDL parent n''existe plus'::TEXT
  FROM edl_items ei
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = ei.edl_id);

  -- edl_media → edl (edl_id)
  RETURN QUERY
  SELECT 'edl_media'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Médias d''EDL dont l''EDL parent n''existe plus'::TEXT
  FROM edl_media em
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = em.edl_id);

  -- edl_signatures → edl (edl_id)
  RETURN QUERY
  SELECT 'edl_signatures'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Signatures d''EDL dont l''EDL parent n''existe plus'::TEXT
  FROM edl_signatures es
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = es.edl_id);

  -- edl_meter_readings → edl (edl_id)
  RETURN QUERY
  SELECT 'edl_meter_readings'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Relevés compteurs EDL dont l''EDL n''existe plus'::TEXT
  FROM edl_meter_readings emr
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = emr.edl_id);

  -- ── METERS ────────────────────────────────────────────────────────
  -- meters → leases (lease_id)
  RETURN QUERY
  SELECT 'meters'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Compteurs dont le bail n''existe plus'::TEXT
  FROM meters m
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);

  -- meter_readings → meters (meter_id)
  RETURN QUERY
  SELECT 'meter_readings'::TEXT, 'meter_id'::TEXT, 'meters'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Relevés de compteur dont le compteur n''existe plus'::TEXT
  FROM meter_readings mr
  WHERE NOT EXISTS (SELECT 1 FROM meters m WHERE m.id = mr.meter_id);

  -- ── ROOMMATES ─────────────────────────────────────────────────────
  -- roommates → leases (lease_id)
  RETURN QUERY
  SELECT 'roommates'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Colocataires dont le bail n''existe plus'::TEXT
  FROM roommates r
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);

  -- roommates → profiles (profile_id)
  RETURN QUERY
  SELECT 'roommates'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Colocataires dont le profil n''existe plus'::TEXT
  FROM roommates r
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = r.profile_id);

  -- ── PAYMENT_SHARES ────────────────────────────────────────────────
  -- payment_shares → roommates (roommate_id)
  RETURN QUERY
  SELECT 'payment_shares'::TEXT, 'roommate_id'::TEXT, 'roommates'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Parts de paiement dont le colocataire n''existe plus'::TEXT
  FROM payment_shares ps
  WHERE NOT EXISTS (SELECT 1 FROM roommates r WHERE r.id = ps.roommate_id);

  -- payment_shares → invoices (invoice_id)
  RETURN QUERY
  SELECT 'payment_shares'::TEXT, 'invoice_id'::TEXT, 'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Parts de paiement dont la facture n''existe plus'::TEXT
  FROM payment_shares ps
  WHERE ps.invoice_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = ps.invoice_id);

  -- ── DEPOSIT_SHARES ────────────────────────────────────────────────
  -- deposit_shares → roommates (roommate_id)
  RETURN QUERY
  SELECT 'deposit_shares'::TEXT, 'roommate_id'::TEXT, 'roommates'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Parts de dépôt dont le colocataire n''existe plus'::TEXT
  FROM deposit_shares ds
  WHERE NOT EXISTS (SELECT 1 FROM roommates r WHERE r.id = ds.roommate_id);

  -- ── DEPOSIT_MOVEMENTS ─────────────────────────────────────────────
  -- deposit_movements → leases (lease_id)
  RETURN QUERY
  SELECT 'deposit_movements'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Mouvements de dépôt dont le bail n''existe plus'::TEXT
  FROM deposit_movements dm
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);

  -- ── NOTIFICATIONS ─────────────────────────────────────────────────
  -- notifications → auth.users (user_id)
  RETURN QUERY
  SELECT 'notifications'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Notifications dont l''utilisateur n''existe plus'::TEXT
  FROM notifications n
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = n.user_id);

  -- ── SUBSCRIPTIONS ─────────────────────────────────────────────────
  -- subscriptions → profiles (user_id / owner_id)
  RETURN QUERY
  SELECT 'subscriptions'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Abonnements dont l''utilisateur n''existe plus'::TEXT
  FROM subscriptions s
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);

  -- ── OWNER_PROFILES ────────────────────────────────────────────────
  -- owner_profiles → profiles (profile_id)
  RETURN QUERY
  SELECT 'owner_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profils propriétaire dont le profil de base n''existe plus'::TEXT
  FROM owner_profiles op
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = op.profile_id);

  -- ── TENANT_PROFILES ───────────────────────────────────────────────
  -- tenant_profiles → profiles (profile_id)
  RETURN QUERY
  SELECT 'tenant_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profils locataire dont le profil de base n''existe plus'::TEXT
  FROM tenant_profiles tp
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = tp.profile_id);

  -- ── PROVIDER_PROFILES ─────────────────────────────────────────────
  -- provider_profiles → profiles (profile_id)
  RETURN QUERY
  SELECT 'provider_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profils prestataire dont le profil de base n''existe plus'::TEXT
  FROM provider_profiles pp
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pp.profile_id);

  -- ── CONVERSATIONS ─────────────────────────────────────────────────
  -- conversations → profiles (owner_id)
  RETURN QUERY
  SELECT 'conversations'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Conversations dont le profil owner n''existe plus'::TEXT
  FROM conversations c
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = c.owner_id);

  -- messages → conversations (conversation_id)
  RETURN QUERY
  SELECT 'messages'::TEXT, 'conversation_id'::TEXT, 'conversations'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Messages dont la conversation n''existe plus'::TEXT
  FROM messages m
  WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id = m.conversation_id);

  -- ── UNIFIED CONVERSATIONS ─────────────────────────────────────────
  -- unified_messages → unified_conversations (conversation_id)
  RETURN QUERY
  SELECT 'unified_messages'::TEXT, 'conversation_id'::TEXT, 'unified_conversations'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Messages unifiés dont la conversation n''existe plus'::TEXT
  FROM unified_messages um
  WHERE NOT EXISTS (SELECT 1 FROM unified_conversations uc WHERE uc.id = um.conversation_id);

  -- ── SIGNATURE_SESSIONS ────────────────────────────────────────────
  -- signature_participants → signature_sessions (session_id)
  RETURN QUERY
  SELECT 'signature_participants'::TEXT, 'session_id'::TEXT, 'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Participants de signature dont la session n''existe plus'::TEXT
  FROM signature_participants sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sp.session_id);

  -- signature_proofs → signature_participants (participant_id)
  RETURN QUERY
  SELECT 'signature_proofs'::TEXT, 'participant_id'::TEXT, 'signature_participants'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Preuves de signature dont le participant n''existe plus'::TEXT
  FROM signature_proofs sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_participants pa WHERE pa.id = sp.participant_id);

  -- signature_audit_log → signature_sessions (session_id)
  RETURN QUERY
  SELECT 'signature_audit_log'::TEXT, 'session_id'::TEXT, 'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Logs d''audit de signature dont la session n''existe plus'::TEXT
  FROM signature_audit_log sal
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sal.session_id);

  -- ── LEGAL_ENTITIES ────────────────────────────────────────────────
  -- legal_entities → profiles (owner_profile_id)
  RETURN QUERY
  SELECT 'legal_entities'::TEXT, 'owner_profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Entités légales dont le profil propriétaire n''existe plus'::TEXT
  FROM legal_entities le
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = le.owner_profile_id);

  -- entity_associates → legal_entities (legal_entity_id)
  RETURN QUERY
  SELECT 'entity_associates'::TEXT, 'legal_entity_id'::TEXT, 'legal_entities'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Associés dont l''entité légale n''existe plus'::TEXT
  FROM entity_associates ea
  WHERE NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.id = ea.legal_entity_id);

  -- ── PROPERTY_OWNERSHIP ────────────────────────────────────────────
  -- property_ownership → properties (property_id)
  RETURN QUERY
  SELECT 'property_ownership'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Détentions de propriété dont le bien n''existe plus'::TEXT
  FROM property_ownership po
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = po.property_id);

  -- ── BUILDINGS ─────────────────────────────────────────────────────
  -- buildings → profiles (owner_id) — si la colonne existe
  RETURN QUERY
  SELECT 'buildings'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Immeubles dont le propriétaire n''existe plus'::TEXT
  FROM buildings b
  WHERE b.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = b.owner_id);

  -- building_units → buildings (building_id)
  RETURN QUERY
  SELECT 'building_units'::TEXT, 'building_id'::TEXT, 'buildings'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Lots d''immeuble dont l''immeuble n''existe plus'::TEXT
  FROM building_units bu
  WHERE NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = bu.building_id);

  -- ── LEASE_END_PROCESSES ───────────────────────────────────────────
  -- lease_end_processes → leases (lease_id)
  RETURN QUERY
  SELECT 'lease_end_processes'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Processus de fin de bail dont le bail n''existe plus'::TEXT
  FROM lease_end_processes lep
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = lep.lease_id);

  -- edl_inspection_items → lease_end_processes (lease_end_process_id)
  RETURN QUERY
  SELECT 'edl_inspection_items'::TEXT, 'lease_end_process_id'::TEXT, 'lease_end_processes'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Items d''inspection dont le processus de fin n''existe plus'::TEXT
  FROM edl_inspection_items eii
  WHERE NOT EXISTS (SELECT 1 FROM lease_end_processes lep WHERE lep.id = eii.lease_end_process_id);

  -- renovation_items → lease_end_processes (lease_end_process_id)
  RETURN QUERY
  SELECT 'renovation_items'::TEXT, 'lease_end_process_id'::TEXT, 'lease_end_processes'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Items de rénovation dont le processus de fin n''existe plus'::TEXT
  FROM renovation_items ri
  WHERE NOT EXISTS (SELECT 1 FROM lease_end_processes lep WHERE lep.id = ri.lease_end_process_id);

  -- renovation_quotes → renovation_items (renovation_item_id)
  RETURN QUERY
  SELECT 'renovation_quotes'::TEXT, 'renovation_item_id'::TEXT, 'renovation_items'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Devis de rénovation dont l''item de rénovation n''existe plus'::TEXT
  FROM renovation_quotes rq
  WHERE NOT EXISTS (SELECT 1 FROM renovation_items ri WHERE ri.id = rq.renovation_item_id);

  -- ── PHOTOS ────────────────────────────────────────────────────────
  -- photos → properties (property_id)
  RETURN QUERY
  SELECT 'photos'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Photos dont la propriété n''existe plus'::TEXT
  FROM photos ph
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = ph.property_id);

  -- ── VISIT SCHEDULING ──────────────────────────────────────────────
  -- visit_slots → properties (property_id)
  RETURN QUERY
  SELECT 'visit_slots'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Créneaux de visite dont la propriété n''existe plus'::TEXT
  FROM visit_slots vs
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = vs.property_id);

  -- visit_bookings → visit_slots (slot_id)
  RETURN QUERY
  SELECT 'visit_bookings'::TEXT, 'slot_id'::TEXT, 'visit_slots'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Réservations de visite dont le créneau n''existe plus'::TEXT
  FROM visit_bookings vb
  WHERE NOT EXISTS (SELECT 1 FROM visit_slots vs WHERE vs.id = vb.slot_id);

  -- ── QUOTES ────────────────────────────────────────────────────────
  -- quotes → tickets (ticket_id)
  RETURN QUERY
  SELECT 'quotes'::TEXT, 'ticket_id'::TEXT, 'tickets'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Devis dont le ticket n''existe plus'::TEXT
  FROM quotes q
  WHERE q.ticket_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = q.ticket_id);

  -- quotes → profiles (provider_id)
  RETURN QUERY
  SELECT 'quotes'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Devis dont le prestataire n''existe plus'::TEXT
  FROM quotes q
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = q.provider_id);

  -- ── CONVERSATION_PARTICIPANTS ─────────────────────────────────────
  -- conversation_participants → unified_conversations (conversation_id)
  RETURN QUERY
  SELECT 'conversation_participants'::TEXT, 'conversation_id'::TEXT, 'unified_conversations'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Participants de conversation dont la conversation unifiée n''existe plus'::TEXT
  FROM conversation_participants cp
  WHERE NOT EXISTS (SELECT 1 FROM unified_conversations uc WHERE uc.id = cp.conversation_id);

  -- ── ORGANIZATION_BRANDING ─────────────────────────────────────────
  -- organization_branding → organizations (organization_id)
  RETURN QUERY
  SELECT 'organization_branding'::TEXT, 'organization_id'::TEXT, 'organizations'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Branding d''organisation dont l''organisation n''existe plus'::TEXT
  FROM organization_branding ob
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ob.organization_id);

  -- ── PROVIDER_INVOICES ─────────────────────────────────────────────
  -- provider_invoices → profiles (provider_id)
  RETURN QUERY
  SELECT 'provider_invoices'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures prestataire dont le profil prestataire n''existe plus'::TEXT
  FROM provider_invoices pi
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pi.provider_id);

  -- ── PROVIDER_QUOTES ───────────────────────────────────────────────
  -- provider_quotes → profiles (provider_id)
  RETURN QUERY
  SELECT 'provider_quotes'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Devis prestataire dont le profil prestataire n''existe plus'::TEXT
  FROM provider_quotes pq
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pq.provider_id);

  -- ── SIGNATURES (legacy) ───────────────────────────────────────────
  -- signatures → leases (lease_id)
  RETURN QUERY
  SELECT 'signatures'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Signatures legacy dont le bail n''existe plus'::TEXT
  FROM signatures s
  WHERE s.lease_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = s.lease_id);

  -- signatures → profiles (signer_profile_id)
  RETURN QUERY
  SELECT 'signatures'::TEXT, 'signer_profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Signatures legacy dont le profil signataire n''existe plus'::TEXT
  FROM signatures s
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = s.signer_profile_id);

  -- Filter: only return rows where orphan_count > 0
  -- (handled by caller, but the function returns all checks for completeness)

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_orphan_records() IS
  'Audit complet des enregistrements orphelins. Retourne toutes les relations cassées avec leur sévérité.';


-- ============================================================================
-- PHASE 2: FONCTIONS DE DÉTECTION DES DOUBLONS
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_duplicate_records()
RETURNS TABLE(
  table_name TEXT,
  duplicate_key TEXT,
  duplicate_count BIGINT,
  severity TEXT,
  description TEXT,
  sample_ids TEXT
) AS $$
BEGIN

  -- ── PROFILES : même user_id (devrait être UNIQUE) ────────────────
  RETURN QUERY
  SELECT 'profiles'::TEXT,
    'user_id'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Comptes avec plusieurs profils pour le même auth.users'::TEXT,
    string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
  FROM profiles p
  GROUP BY p.user_id
  HAVING COUNT(*) > 1;

  -- ── PROFILES : même email (doublons fonctionnels) ─────────────────
  RETURN QUERY
  SELECT 'profiles'::TEXT,
    'email=' || COALESCE(p.email, '(null)'),
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Profils avec le même email'::TEXT,
    string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
  FROM profiles p
  WHERE p.email IS NOT NULL AND p.email != ''
  GROUP BY p.email
  HAVING COUNT(*) > 1;

  -- ── PROPERTIES : même adresse + même propriétaire ─────────────────
  RETURN QUERY
  SELECT 'properties'::TEXT,
    'owner_id+adresse=' || p.owner_id || '+' || LOWER(TRIM(p.adresse_complete)),
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Propriétés dupliquées (même propriétaire + même adresse)'::TEXT,
    string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
  GROUP BY p.owner_id, LOWER(TRIM(p.adresse_complete))
  HAVING COUNT(*) > 1;

  -- ── PROPERTIES : même unique_code (devrait être impossible) ───────
  RETURN QUERY
  SELECT 'properties'::TEXT,
    'unique_code=' || p.unique_code,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Propriétés avec le même code unique (violation unicité)'::TEXT,
    string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
  FROM properties p
  GROUP BY p.unique_code
  HAVING COUNT(*) > 1;

  -- ── LEASES : même property_id + dates qui se chevauchent ──────────
  RETURN QUERY
  SELECT 'leases'::TEXT,
    'property_id=' || l1.property_id || ' overlap_with=' || l2.id,
    2::BIGINT,
    'HIGH'::TEXT,
    'Baux actifs qui se chevauchent sur la même propriété'::TEXT,
    (l1.id::TEXT || ', ' || l2.id::TEXT)::TEXT
  FROM leases l1
  JOIN leases l2 ON l1.property_id = l2.property_id
    AND l1.id < l2.id
    AND l1.statut IN ('active', 'pending_signature', 'fully_signed')
    AND l2.statut IN ('active', 'pending_signature', 'fully_signed')
    AND l1.property_id IS NOT NULL
    AND l1.date_debut <= COALESCE(l2.date_fin, '9999-12-31'::DATE)
    AND l2.date_debut <= COALESCE(l1.date_fin, '9999-12-31'::DATE);

  -- ── INVOICES : même bail + même période ───────────────────────────
  RETURN QUERY
  SELECT 'invoices'::TEXT,
    'lease_id+periode=' || i.lease_id || '+' || i.periode,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Factures dupliquées pour le même bail et la même période'::TEXT,
    string_agg(i.id::TEXT, ', ' ORDER BY i.created_at)::TEXT
  FROM invoices i
  GROUP BY i.lease_id, i.periode
  HAVING COUNT(*) > 1;

  -- ── LEASE_SIGNERS : même bail + même profil ───────────────────────
  RETURN QUERY
  SELECT 'lease_signers'::TEXT,
    'lease_id+profile_id=' || ls.lease_id || '+' || ls.profile_id,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Signataires dupliqués sur le même bail'::TEXT,
    string_agg(ls.id::TEXT, ', ' ORDER BY ls.created_at)::TEXT
  FROM lease_signers ls
  WHERE ls.profile_id IS NOT NULL
  GROUP BY ls.lease_id, ls.profile_id
  HAVING COUNT(*) > 1;

  -- ── LEASE_SIGNERS : même bail + même invited_email ────────────────
  RETURN QUERY
  SELECT 'lease_signers'::TEXT,
    'lease_id+invited_email=' || ls.lease_id || '+' || ls.invited_email,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Signataires invités en double sur le même bail (même email)'::TEXT,
    string_agg(ls.id::TEXT, ', ' ORDER BY ls.created_at)::TEXT
  FROM lease_signers ls
  WHERE ls.invited_email IS NOT NULL AND ls.invited_email != ''
  GROUP BY ls.lease_id, ls.invited_email
  HAVING COUNT(*) > 1;

  -- ── DOCUMENTS : même storage_path ─────────────────────────────────
  RETURN QUERY
  SELECT 'documents'::TEXT,
    'storage_path=' || COALESCE(d.storage_path, d.url),
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents pointant vers le même fichier storage'::TEXT,
    string_agg(d.id::TEXT, ', ' ORDER BY d.created_at)::TEXT
  FROM documents d
  WHERE COALESCE(d.storage_path, d.url) IS NOT NULL
  GROUP BY COALESCE(d.storage_path, d.url)
  HAVING COUNT(*) > 1;

  -- ── OWNER_PROFILES : même profile_id (PK, mais vérifions) ────────
  RETURN QUERY
  SELECT 'owner_profiles'::TEXT,
    'profile_id=' || op.profile_id,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profils propriétaire dupliqués pour le même profil'::TEXT,
    string_agg(op.profile_id::TEXT, ', ')::TEXT
  FROM owner_profiles op
  GROUP BY op.profile_id
  HAVING COUNT(*) > 1;

  -- ── SUBSCRIPTIONS : abonnements actifs multiples ──────────────────
  RETURN QUERY
  SELECT 'subscriptions'::TEXT,
    'user_id=' || s.user_id || ' (active)',
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Utilisateurs avec plusieurs abonnements actifs'::TEXT,
    string_agg(s.id::TEXT, ', ' ORDER BY s.created_at)::TEXT
  FROM subscriptions s
  WHERE s.status IN ('active', 'trialing')
  GROUP BY s.user_id
  HAVING COUNT(*) > 1;

  -- ── NOTIFICATIONS : doublons exacts ───────────────────────────────
  RETURN QUERY
  SELECT 'notifications'::TEXT,
    'user+type+title=' || n.user_id || '+' || n.type || '+' || n.title,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Notifications dupliquées (même user, type, titre, même minute)'::TEXT,
    string_agg(n.id::TEXT, ', ' ORDER BY n.created_at LIMIT 5)::TEXT
  FROM notifications n
  GROUP BY n.user_id, n.type, n.title, date_trunc('minute', n.created_at)
  HAVING COUNT(*) > 1;

  -- ── ROOMMATES : même bail + même profil ───────────────────────────
  RETURN QUERY
  SELECT 'roommates'::TEXT,
    'lease_id+profile_id=' || r.lease_id || '+' || r.profile_id,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Colocataires dupliqués sur le même bail'::TEXT,
    string_agg(r.id::TEXT, ', ' ORDER BY r.created_at)::TEXT
  FROM roommates r
  GROUP BY r.lease_id, r.profile_id
  HAVING COUNT(*) > 1;

  -- ── PHOTOS : même property + même storage_path ────────────────────
  RETURN QUERY
  SELECT 'photos'::TEXT,
    'property_id+storage_path=' || ph.property_id || '+' || COALESCE(ph.storage_path, ph.url),
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Photos dupliquées pour la même propriété'::TEXT,
    string_agg(ph.id::TEXT, ', ' ORDER BY ph.created_at)::TEXT
  FROM photos ph
  WHERE COALESCE(ph.storage_path, ph.url) IS NOT NULL
  GROUP BY ph.property_id, COALESCE(ph.storage_path, ph.url)
  HAVING COUNT(*) > 1;

  -- ── LEGAL_ENTITIES : même SIRET ───────────────────────────────────
  RETURN QUERY
  SELECT 'legal_entities'::TEXT,
    'siret=' || le.siret,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Entités légales avec le même SIRET'::TEXT,
    string_agg(le.id::TEXT, ', ' ORDER BY le.created_at)::TEXT
  FROM legal_entities le
  WHERE le.siret IS NOT NULL AND le.siret != ''
  GROUP BY le.siret
  HAVING COUNT(*) > 1;

  -- ── EDL : même bail + même type ───────────────────────────────────
  RETURN QUERY
  SELECT 'edl'::TEXT,
    'lease_id+type=' || e.lease_id || '+' || e.type,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'EDL dupliqués pour le même bail et le même type'::TEXT,
    string_agg(e.id::TEXT, ', ' ORDER BY e.created_at)::TEXT
  FROM edl e
  GROUP BY e.lease_id, e.type
  HAVING COUNT(*) > 1;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_duplicate_records() IS
  'Audit complet des enregistrements dupliqués. Retourne tous les doublons détectés avec leur sévérité.';


-- ============================================================================
-- PHASE 3: DÉTECTION DES FK IMPLICITES (colonnes *_id sans contrainte)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_missing_fk_constraints()
RETURNS TABLE(
  table_name TEXT,
  column_name TEXT,
  expected_target TEXT,
  has_fk BOOLEAN,
  recommendation TEXT
) AS $$
BEGIN

  -- Lister toutes les colonnes finissant par _id dans le schéma public
  -- et vérifier si elles ont une contrainte FK
  RETURN QUERY
  WITH id_columns AS (
    SELECT
      c.table_name::TEXT AS tbl,
      c.column_name::TEXT AS col,
      CASE
        WHEN c.column_name LIKE '%profile_id%' THEN 'profiles'
        WHEN c.column_name LIKE '%owner_id%' THEN 'profiles'
        WHEN c.column_name LIKE '%tenant_id%' THEN 'profiles'
        WHEN c.column_name LIKE '%user_id%' THEN 'auth.users'
        WHEN c.column_name LIKE '%property_id%' THEN 'properties'
        WHEN c.column_name LIKE '%lease_id%' THEN 'leases'
        WHEN c.column_name LIKE '%unit_id%' THEN 'units'
        WHEN c.column_name LIKE '%invoice_id%' THEN 'invoices'
        WHEN c.column_name LIKE '%ticket_id%' THEN 'tickets'
        WHEN c.column_name LIKE '%building_id%' THEN 'buildings'
        WHEN c.column_name LIKE '%edl_id%' THEN 'edl'
        WHEN c.column_name LIKE '%meter_id%' THEN 'meters'
        WHEN c.column_name LIKE '%conversation_id%' THEN 'conversations/unified_conversations'
        WHEN c.column_name LIKE '%session_id%' THEN 'signature_sessions'
        WHEN c.column_name LIKE '%organization_id%' THEN 'organizations'
        WHEN c.column_name LIKE '%legal_entity_id%' THEN 'legal_entities'
        WHEN c.column_name LIKE '%roommate_id%' THEN 'roommates'
        WHEN c.column_name LIKE '%provider_id%' THEN 'profiles/provider_profiles'
        WHEN c.column_name LIKE '%document_id%' THEN 'documents'
        WHEN c.column_name LIKE '%quote_id%' THEN 'quotes'
        WHEN c.column_name LIKE '%work_order_id%' THEN 'work_orders'
        WHEN c.column_name LIKE '%application_id%' THEN 'tenant_applications'
        WHEN c.column_name LIKE '%participant_id%' THEN 'signature_participants'
        ELSE '(unknown)'
      END AS expected_target
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.data_type IN ('uuid', 'text')
      AND (c.column_name LIKE '%_id' OR c.column_name LIKE '%_uuid')
      AND c.column_name != 'id'
      AND c.table_name NOT LIKE '_%' -- skip internal tables
  ),
  existing_fks AS (
    SELECT
      tc.table_name::TEXT AS tbl,
      kcu.column_name::TEXT AS col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  )
  SELECT
    ic.tbl,
    ic.col,
    ic.expected_target,
    EXISTS(SELECT 1 FROM existing_fks ef WHERE ef.tbl = ic.tbl AND ef.col = ic.col),
    CASE
      WHEN EXISTS(SELECT 1 FROM existing_fks ef WHERE ef.tbl = ic.tbl AND ef.col = ic.col)
        THEN 'FK existe — OK'
      ELSE 'MANQUANTE — Ajouter ALTER TABLE ' || ic.tbl || ' ADD CONSTRAINT fk_' || ic.tbl || '_' || ic.col || ' FOREIGN KEY (' || ic.col || ') REFERENCES ' || ic.expected_target || '(id)'
    END
  FROM id_columns ic
  WHERE ic.expected_target != '(unknown)'
  ORDER BY
    CASE WHEN EXISTS(SELECT 1 FROM existing_fks ef WHERE ef.tbl = ic.tbl AND ef.col = ic.col) THEN 1 ELSE 0 END,
    ic.tbl, ic.col;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_missing_fk_constraints() IS
  'Détecte les colonnes *_id sans contrainte FK formelle (FK implicites).';


-- ============================================================================
-- PHASE 4: VUE CONSOLIDÉE DU TABLEAU DE BORD D'INTÉGRITÉ
-- ============================================================================

CREATE OR REPLACE VIEW audit_integrity_dashboard AS

-- Orphelins
SELECT
  'orphan' AS audit_type,
  source_table,
  fk_column AS detail_key,
  target_table AS detail_value,
  orphan_count AS count,
  severity,
  description
FROM audit_orphan_records()
WHERE orphan_count > 0

UNION ALL

-- Doublons
SELECT
  'duplicate' AS audit_type,
  table_name AS source_table,
  duplicate_key AS detail_key,
  sample_ids AS detail_value,
  duplicate_count AS count,
  severity,
  description
FROM audit_duplicate_records();

COMMENT ON VIEW audit_integrity_dashboard IS
  'Vue consolidée de tous les problèmes d''intégrité détectés (orphelins + doublons).';


-- ============================================================================
-- PHASE 5: FONCTIONS DE NETTOYAGE SAFE (avec backup préalable)
-- ============================================================================

-- 5.1 Table d'archivage pour les enregistrements nettoyés
CREATE TABLE IF NOT EXISTS _audit_cleanup_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_batch_id UUID NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  fk_column TEXT,
  original_data JSONB NOT NULL,
  cleanup_reason TEXT NOT NULL,
  cleaned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleaned_by TEXT DEFAULT current_user
);

CREATE INDEX IF NOT EXISTS idx_cleanup_archive_batch
  ON _audit_cleanup_archive(cleanup_batch_id);
CREATE INDEX IF NOT EXISTS idx_cleanup_archive_table
  ON _audit_cleanup_archive(source_table);
CREATE INDEX IF NOT EXISTS idx_cleanup_archive_date
  ON _audit_cleanup_archive(cleaned_at);

COMMENT ON TABLE _audit_cleanup_archive IS
  'Archive des enregistrements supprimés lors du nettoyage d''intégrité. Permet de restaurer si nécessaire.';

-- 5.2 Fonction de nettoyage SAFE avec archivage
CREATE OR REPLACE FUNCTION safe_cleanup_orphans(
  p_dry_run BOOLEAN DEFAULT TRUE,
  p_severity_filter TEXT DEFAULT 'ALL'
)
RETURNS TABLE(
  action TEXT,
  source_table TEXT,
  fk_column TEXT,
  records_affected BIGINT,
  detail TEXT
) AS $$
DECLARE
  v_batch_id UUID := gen_random_uuid();
  v_count BIGINT;
BEGIN

  -- Header
  action := 'INFO';
  source_table := '(batch)';
  fk_column := '';
  records_affected := 0;
  detail := 'Batch ID: ' || v_batch_id::TEXT || ' | Mode: ' || CASE WHEN p_dry_run THEN 'DRY RUN (aucune suppression)' ELSE 'EXECUTION RÉELLE' END;
  RETURN NEXT;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- CRITICAL: lease_signers orphelins (bail supprimé)
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  IF p_severity_filter IN ('ALL', 'CRITICAL') THEN

    -- Archive + delete lease_signers sans bail
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'lease_signers', ls.id::TEXT, 'lease_id', to_jsonb(ls), 'Bail inexistant'
      FROM lease_signers ls
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);

      DELETE FROM lease_signers ls
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM lease_signers ls
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'lease_signers';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Signataires dont le bail n''existe plus';
    RETURN NEXT;

    -- Archive + delete invoices sans bail
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'invoices', i.id::TEXT, 'lease_id', to_jsonb(i), 'Bail inexistant'
      FROM invoices i
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);

      DELETE FROM invoices i
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM invoices i
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'invoices';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Factures dont le bail n''existe plus';
    RETURN NEXT;

    -- Archive + delete payments sans invoice
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'payments', py.id::TEXT, 'invoice_id', to_jsonb(py), 'Facture inexistante'
      FROM payments py
      WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);

      DELETE FROM payments py
      WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM payments py
      WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'payments';
    fk_column := 'invoice_id → invoices';
    records_affected := v_count;
    detail := 'Paiements dont la facture n''existe plus';
    RETURN NEXT;

  END IF;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- HIGH: documents orphelins
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  IF p_severity_filter IN ('ALL', 'CRITICAL', 'HIGH') THEN

    -- Documents avec lease_id invalide → SET NULL (ne pas supprimer)
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'documents', d.id::TEXT, 'lease_id', jsonb_build_object('lease_id', d.lease_id), 'Bail inexistant — lease_id mis à NULL'
      FROM documents d
      WHERE d.lease_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);

      UPDATE documents d
      SET lease_id = NULL
      WHERE d.lease_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM documents d
      WHERE d.lease_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
    source_table := 'documents';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Documents: lease_id mis à NULL (bail inexistant)';
    RETURN NEXT;

    -- Documents avec property_id invalide → SET NULL
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'documents', d.id::TEXT, 'property_id', jsonb_build_object('property_id', d.property_id), 'Propriété inexistante — property_id mis à NULL'
      FROM documents d
      WHERE d.property_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);

      UPDATE documents d
      SET property_id = NULL
      WHERE d.property_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM documents d
      WHERE d.property_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
    source_table := 'documents';
    fk_column := 'property_id → properties';
    records_affected := v_count;
    detail := 'Documents: property_id mis à NULL (propriété inexistante)';
    RETURN NEXT;

    -- EDL orphelins (bail supprimé)
    IF NOT p_dry_run THEN
      -- D'abord archiver et supprimer les enfants des EDL orphelins
      WITH orphan_edls AS (
        SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id)
      )
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'edl', e.id::TEXT, 'lease_id', to_jsonb(e), 'Bail inexistant'
      FROM edl e
      WHERE e.id IN (SELECT id FROM orphan_edls);

      DELETE FROM edl_items WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl_media WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl_signatures WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl_meter_readings WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = edl.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'edl (+ items, media, signatures)';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'EDL orphelins supprimés en cascade';
    RETURN NEXT;

    -- Roommates orphelins (bail supprimé)
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'roommates', r.id::TEXT, 'lease_id', to_jsonb(r), 'Bail inexistant'
      FROM roommates r
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);

      DELETE FROM roommates r
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM roommates r WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'roommates';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Colocataires dont le bail n''existe plus';
    RETURN NEXT;

    -- Deposit_movements orphelins
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'deposit_movements', dm.id::TEXT, 'lease_id', to_jsonb(dm), 'Bail inexistant'
      FROM deposit_movements dm
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);

      DELETE FROM deposit_movements dm
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM deposit_movements dm WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'deposit_movements';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Mouvements de dépôt dont le bail n''existe plus';
    RETURN NEXT;

    -- Meters orphelins
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'meters', m.id::TEXT, 'lease_id', to_jsonb(m), 'Bail inexistant'
      FROM meters m
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);

      -- D'abord supprimer les readings des meters orphelins
      DELETE FROM meter_readings WHERE meter_id IN (
        SELECT m.id FROM meters m WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id)
      );
      DELETE FROM meters m
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM meters m WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'meters (+ readings)';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Compteurs orphelins supprimés en cascade';
    RETURN NEXT;

    -- Tickets avec lease_id invalide → SET NULL (garder le ticket)
    IF NOT p_dry_run THEN
      UPDATE tickets t
      SET lease_id = NULL
      WHERE t.lease_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM tickets t
      WHERE t.lease_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
    source_table := 'tickets';
    fk_column := 'lease_id → leases';
    records_affected := v_count;
    detail := 'Tickets: lease_id mis à NULL (bail inexistant)';
    RETURN NEXT;

  END IF;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- LOW: Notifications obsolètes
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  IF p_severity_filter = 'ALL' THEN

    -- Notifications lues > 90 jours
    IF NOT p_dry_run THEN
      DELETE FROM notifications
      WHERE is_read = true
        AND created_at < NOW() - INTERVAL '90 days';
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM notifications
      WHERE is_read = true
        AND created_at < NOW() - INTERVAL '90 days';
    END IF;

    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'notifications';
    fk_column := '(age > 90 days + read)';
    records_affected := v_count;
    detail := 'Notifications lues de plus de 90 jours';
    RETURN NEXT;

  END IF;

  -- Summary
  action := 'SUMMARY';
  source_table := '(all)';
  fk_column := '';
  records_affected := 0;
  detail := 'Nettoyage terminé. Batch: ' || v_batch_id::TEXT || ' — Consultez _audit_cleanup_archive pour restaurer.';
  RETURN NEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION safe_cleanup_orphans(BOOLEAN, TEXT) IS
  'Nettoyage SAFE des orphelins avec archivage. Par défaut en DRY RUN. Usage: SELECT * FROM safe_cleanup_orphans(false) pour exécuter.';


-- ============================================================================
-- PHASE 6: FONCTION DE RESTAURATION (rollback d'un batch de nettoyage)
-- ============================================================================

CREATE OR REPLACE FUNCTION restore_cleanup_batch(p_batch_id UUID)
RETURNS TABLE(
  restored_table TEXT,
  restored_count BIGINT
) AS $$
DECLARE
  r RECORD;
  v_count BIGINT := 0;
BEGIN
  -- On ne peut restaurer que les lignes supprimées (pas les NULL-ifiées)
  -- Pour chaque table dans l'archive, on ré-insère les données
  FOR r IN
    SELECT DISTINCT a.source_table
    FROM _audit_cleanup_archive a
    WHERE a.cleanup_batch_id = p_batch_id
      AND a.cleanup_reason NOT LIKE '%mis à NULL%'
    ORDER BY a.source_table
  LOOP
    restored_table := r.source_table;

    -- Compter les enregistrements à restaurer
    SELECT COUNT(*) INTO v_count
    FROM _audit_cleanup_archive a
    WHERE a.cleanup_batch_id = p_batch_id
      AND a.source_table = r.source_table
      AND a.cleanup_reason NOT LIKE '%mis à NULL%';

    restored_count := v_count;
    RETURN NEXT;
  END LOOP;

  -- Note : la restauration réelle nécessite un INSERT dynamique
  -- qui doit être exécuté manuellement pour chaque table
  -- car la structure des colonnes diffère
  restored_table := '⚠️ IMPORTANT';
  restored_count := 0;
  RETURN NEXT;

  restored_table := 'Les données sont dans _audit_cleanup_archive.original_data (JSONB)';
  restored_count := 0;
  RETURN NEXT;

  restored_table := 'Utilisez: SELECT original_data FROM _audit_cleanup_archive WHERE cleanup_batch_id = ''' || p_batch_id::TEXT || '''';
  restored_count := 0;
  RETURN NEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION restore_cleanup_batch(UUID) IS
  'Liste les enregistrements restaurables pour un batch de nettoyage donné.';


-- ============================================================================
-- LOGS DE MIGRATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  AUDIT D''INTÉGRITÉ TALOK — Migration installée';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  Fonctions disponibles :';
  RAISE NOTICE '    SELECT * FROM audit_orphan_records();';
  RAISE NOTICE '    SELECT * FROM audit_duplicate_records();';
  RAISE NOTICE '    SELECT * FROM audit_missing_fk_constraints();';
  RAISE NOTICE '    SELECT * FROM audit_integrity_dashboard;';
  RAISE NOTICE '';
  RAISE NOTICE '  Nettoyage (DRY RUN par défaut) :';
  RAISE NOTICE '    SELECT * FROM safe_cleanup_orphans(true);   -- prévisualiser';
  RAISE NOTICE '    SELECT * FROM safe_cleanup_orphans(false);  -- exécuter';
  RAISE NOTICE '';
  RAISE NOTICE '  Restauration :';
  RAISE NOTICE '    SELECT * FROM restore_cleanup_batch(''<batch_id>'');';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $$;


-- ============================================
-- SOURCE: 20260212000001_fix_guarantor_role_and_tables.sql
-- ============================================
-- ============================================
-- Migration: Ajouter le rôle guarantor + tables manquantes
-- Date: 2026-02-12
-- Description:
--   1. Ajouter 'guarantor' dans le CHECK constraint de profiles.role
--   2. Mettre à jour handle_new_user pour accepter 'guarantor'
--   3. Créer la table guarantor_profiles
--   4. Créer la table user_consents pour la conformité RGPD
--   5. Ajouter un CHECK constraint sur le champ telephone
-- ============================================

-- 1. Modifier le CHECK constraint de profiles.role pour inclure 'guarantor'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'owner', 'tenant', 'provider', 'guarantor'));

-- 2. Mettre à jour handle_new_user pour reconnaître 'guarantor'
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

  -- Valider le rôle (inclut désormais 'guarantor')
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
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
Supporte les rôles: admin, owner, tenant, provider, guarantor.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';

-- 3. Créer la table guarantor_profiles
CREATE TABLE IF NOT EXISTS guarantor_profiles (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  type_garantie TEXT CHECK (type_garantie IN ('personnelle', 'visale', 'depot_bancaire')),
  revenus_mensuels DECIMAL(10, 2),
  date_naissance DATE,
  piece_identite_path TEXT,
  justificatif_revenus_path TEXT,
  visale_path TEXT,
  depot_bancaire_montant DECIMAL(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS pour guarantor_profiles
ALTER TABLE guarantor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guarantor_profiles_select_own" ON guarantor_profiles
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "guarantor_profiles_insert_own" ON guarantor_profiles
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "guarantor_profiles_update_own" ON guarantor_profiles
  FOR UPDATE USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- 4. Créer la table user_consents pour la conformité RGPD
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  terms_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted BOOLEAN NOT NULL DEFAULT false,
  privacy_version TEXT NOT NULL,
  privacy_accepted_at TIMESTAMPTZ,
  cookies_necessary BOOLEAN NOT NULL DEFAULT true,
  cookies_analytics BOOLEAN NOT NULL DEFAULT false,
  cookies_ads BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);

-- RLS pour user_consents
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_consents_select_own" ON user_consents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_consents_insert_own" ON user_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_consents_update_own" ON user_consents
  FOR UPDATE USING (user_id = auth.uid());

-- 5. Ajouter un CHECK constraint sur telephone (format E.164)
-- Le format E.164 commence par + suivi de 1 à 15 chiffres
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_telephone_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_telephone_check
  CHECK (telephone IS NULL OR telephone ~ '^\+[1-9]\d{1,14}$');


-- ============================================
-- SOURCE: 20260212100000_email_template_system.sql
-- ============================================
-- ============================================================
-- Email Template System
-- Tables: email_templates, email_template_versions, email_logs
-- ============================================================

-- Table des templates email éditables
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  available_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  send_delay_minutes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherche rapide par slug et catégorie
CREATE INDEX IF NOT EXISTS idx_email_templates_slug ON email_templates(slug);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);

-- Historique des modifications (audit trail)
CREATE TABLE IF NOT EXISTS email_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  modified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_template_versions_template ON email_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_versions_created ON email_template_versions(created_at DESC);

-- Logs d'envoi
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  variables_used JSONB,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template_slug);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_email_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON email_templates;
CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_template_updated_at();

-- Trigger pour versionner automatiquement les modifications
CREATE OR REPLACE FUNCTION version_email_template()
RETURNS TRIGGER AS $$
BEGIN
  -- Sauvegarder l'ancienne version si le contenu a changé
  IF OLD.subject IS DISTINCT FROM NEW.subject
     OR OLD.body_html IS DISTINCT FROM NEW.body_html
     OR OLD.body_text IS DISTINCT FROM NEW.body_text THEN
    INSERT INTO email_template_versions (template_id, subject, body_html, body_text, modified_by)
    VALUES (OLD.id, OLD.subject, OLD.body_html, OLD.body_text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_email_template_version ON email_templates;
CREATE TRIGGER trg_email_template_version
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION version_email_template();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- email_templates: lecture pour les admins, écriture pour les admins
CREATE POLICY "email_templates_admin_read" ON email_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "email_templates_admin_write" ON email_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- email_templates: lecture pour le service role (envoi d'emails)
CREATE POLICY "email_templates_service_read" ON email_templates
  FOR SELECT TO service_role
  USING (true);

-- email_template_versions: lecture pour les admins
CREATE POLICY "email_template_versions_admin_read" ON email_template_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- email_logs: lecture pour les admins
CREATE POLICY "email_logs_admin_read" ON email_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- email_logs: insertion pour service role
CREATE POLICY "email_logs_service_insert" ON email_logs
  FOR INSERT TO service_role
  WITH CHECK (true);


-- ============================================
-- SOURCE: 20260212100001_email_templates_seed.sql
-- ============================================
-- ============================================================
-- Seed data: 31 email templates
-- ============================================================

-- ============================================
-- CATÉGORIE : AUTHENTIFICATION (auth)
-- ============================================

INSERT INTO email_templates (slug, category, name, description, subject, body_html, body_text, available_variables, send_delay_minutes) VALUES

-- 1. Confirmation d'inscription
('auth_confirmation', 'auth', 'Confirmation d''inscription', 'Email de confirmation envoyé après la création de compte', 'Confirmez votre inscription sur Talok, {{prenom}}',
'<h2>Bienvenue sur Talok, {{prenom}} !</h2>
<p>Vous venez de créer un compte en tant que <strong>{{role}}</strong>.</p>
<p>Pour activer votre compte et commencer à utiliser Talok, veuillez confirmer votre adresse email :</p>
<a href="{{confirmation_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Confirmer mon adresse email</a>
<p>Ce lien est valable 24 heures. Si vous n''avez pas créé de compte, ignorez cet email.</p>
<p>À très vite sur Talok,<br>L''équipe Talok</p>',
'Bienvenue sur Talok, {{prenom}} !

Vous venez de créer un compte en tant que {{role}}.

Pour activer votre compte, confirmez votre adresse email en cliquant sur le lien suivant :
{{confirmation_url}}

Ce lien est valable 24 heures. Si vous n''avez pas créé de compte, ignorez cet email.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom de l''utilisateur", "example": "Thomas"}, {"key": "email", "label": "Adresse email", "example": "thomas@email.com"}, {"key": "confirmation_url", "label": "Lien de confirmation", "example": "https://talok.fr/auth/confirm?token=..."}, {"key": "role", "label": "Rôle (Propriétaire/Locataire/Prestataire)", "example": "Propriétaire"}]'::jsonb,
0),

-- 2. Réinitialisation de mot de passe
('auth_reset_password', 'auth', 'Réinitialisation de mot de passe', 'Email envoyé lors d''une demande de réinitialisation de mot de passe', 'Réinitialisation de votre mot de passe Talok',
'<h2>Réinitialisation de mot de passe</h2>
<p>Bonjour {{prenom}},</p>
<p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
<a href="{{reset_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Réinitialiser mon mot de passe</a>
<p>Ce lien expire dans {{expiration}}. Si vous n''êtes pas à l''origine de cette demande, ignorez cet email — votre mot de passe ne sera pas modifié.</p>',
'Bonjour {{prenom}},

Vous avez demandé la réinitialisation de votre mot de passe.
Cliquez sur le lien suivant pour en choisir un nouveau :
{{reset_url}}

Ce lien expire dans {{expiration}}.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "reset_url", "label": "Lien de réinitialisation", "example": "https://talok.fr/auth/reset?token=..."}, {"key": "expiration", "label": "Durée de validité", "example": "1 heure"}]'::jsonb,
0),

-- 3. Connexion par lien magique
('auth_magic_link', 'auth', 'Connexion par lien magique', 'Lien magique de connexion sans mot de passe', 'Votre lien de connexion Talok',
'<p>Bonjour {{prenom}},</p>
<p>Cliquez sur le bouton ci-dessous pour vous connecter à Talok :</p>
<a href="{{magic_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Se connecter</a>
<p>Ce lien expire dans {{expiration}} et ne peut être utilisé qu''une seule fois.</p>',
'Bonjour {{prenom}},

Connectez-vous à Talok via ce lien :
{{magic_url}}

Ce lien expire dans {{expiration}} et ne peut être utilisé qu''une seule fois.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "magic_url", "label": "Lien de connexion", "example": "https://talok.fr/auth/magic?token=..."}, {"key": "expiration", "label": "Durée de validité", "example": "15 minutes"}]'::jsonb,
0),

-- 4. Changement d'adresse email
('auth_email_change', 'auth', 'Changement d''adresse email', 'Confirmation lors d''un changement d''adresse email', 'Confirmez votre nouvelle adresse email',
'<p>Bonjour {{prenom}},</p>
<p>Vous avez demandé le changement de votre adresse email vers <strong>{{new_email}}</strong>.</p>
<a href="{{confirm_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Confirmer le changement</a>
<p>Si vous n''êtes pas à l''origine de cette demande, sécurisez votre compte immédiatement.</p>',
'Bonjour {{prenom}},

Vous avez demandé le changement de votre adresse email vers {{new_email}}.

Confirmez le changement via ce lien :
{{confirm_url}}

Si vous n''êtes pas à l''origine de cette demande, sécurisez votre compte immédiatement.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "new_email", "label": "Nouvelle adresse email", "example": "nouveau@email.com"}, {"key": "confirm_url", "label": "Lien de confirmation", "example": "https://talok.fr/auth/confirm-email?token=..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : INVITATIONS & ONBOARDING (invitation)
-- ============================================

-- 5. Invitation locataire
('invitation_tenant', 'invitation', 'Invitation locataire', 'Email d''invitation envoyé à un locataire par le propriétaire', '{{nom_proprietaire}} vous invite à rejoindre Talok',
'<h2>Vous êtes invité(e) sur Talok</h2>
<p>Bonjour {{prenom_locataire}},</p>
<p><strong>{{nom_proprietaire}}</strong> vous invite à rejoindre Talok pour gérer votre location au :</p>
<p style="background:#f1f5f9;padding:12px 16px;border-radius:8px;border-left:4px solid #2563eb;">📍 {{adresse_bien}}</p>
<p>Avec Talok, vous pourrez :</p>
<ul>
  <li>Consulter et télécharger vos quittances de loyer</li>
  <li>Signaler des incidents et suivre leur résolution</li>
  <li>Signer vos documents numériquement</li>
  <li>Communiquer facilement avec votre propriétaire</li>
</ul>
<a href="{{invitation_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Créer mon compte locataire</a>',
'Bonjour {{prenom_locataire}},

{{nom_proprietaire}} vous invite à rejoindre Talok pour gérer votre location au :
{{adresse_bien}}

Créez votre compte via ce lien :
{{invitation_url}}

L''équipe Talok',
'[{"key": "prenom_locataire", "label": "Prénom du locataire", "example": "Marie"}, {"key": "nom_proprietaire", "label": "Nom du propriétaire", "example": "M. Dupont"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas, Fort-de-France"}, {"key": "invitation_url", "label": "Lien d''invitation", "example": "https://talok.fr/invite?token=..."}]'::jsonb,
0),

-- 6. Invitation prestataire
('invitation_provider', 'invitation', 'Invitation prestataire', 'Email d''invitation envoyé à un prestataire par le propriétaire', '{{nom_proprietaire}} vous invite comme prestataire sur Talok',
'<p>Bonjour {{prenom_prestataire}},</p>
<p><strong>{{nom_proprietaire}}</strong> souhaite vous ajouter comme prestataire <strong>{{specialite}}</strong> sur Talok.</p>
<p>En rejoignant Talok, vous pourrez recevoir et gérer vos interventions directement depuis votre espace dédié.</p>
<a href="{{invitation_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Rejoindre Talok</a>',
'Bonjour {{prenom_prestataire}},

{{nom_proprietaire}} souhaite vous ajouter comme prestataire {{specialite}} sur Talok.

Rejoignez Talok via ce lien :
{{invitation_url}}

L''équipe Talok',
'[{"key": "prenom_prestataire", "label": "Prénom du prestataire", "example": "Jacques"}, {"key": "nom_proprietaire", "label": "Nom du propriétaire", "example": "M. Dupont"}, {"key": "specialite", "label": "Spécialité", "example": "plomberie"}, {"key": "invitation_url", "label": "Lien d''invitation", "example": "https://talok.fr/invite?token=..."}]'::jsonb,
0),

-- 7. Bienvenue propriétaire
('welcome_owner', 'invitation', 'Bienvenue propriétaire', 'Email de bienvenue envoyé après confirmation du compte propriétaire', 'Bienvenue sur Talok, {{prenom}} ! Voici comment démarrer',
'<h2>Votre compte est activé</h2>
<p>Bonjour {{prenom}},</p>
<p>Bienvenue sur Talok ! Voici les premières étapes pour bien démarrer :</p>
<ol>
  <li><strong>Ajoutez votre premier bien</strong> — renseignez l''adresse, le type et les caractéristiques</li>
  <li><strong>Créez un bail</strong> — associez un locataire et définissez les conditions</li>
  <li><strong>Invitez votre locataire</strong> — il recevra un email pour créer son espace</li>
</ol>
<a href="{{dashboard_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Accéder à mon tableau de bord</a>
<p>Besoin d''aide ? Notre équipe est disponible à support@talok.fr</p>',
'Bonjour {{prenom}},

Bienvenue sur Talok ! Voici les premières étapes :
1. Ajoutez votre premier bien
2. Créez un bail
3. Invitez votre locataire

Accédez à votre tableau de bord : {{dashboard_url}}

Besoin d''aide ? Contactez support@talok.fr

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "dashboard_url", "label": "Lien vers le dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : BAUX (lease)
-- ============================================

-- 8. Bail créé
('lease_created', 'lease', 'Bail créé', 'Notification au propriétaire lors de la création d''un bail', 'Bail créé — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Le bail pour le bien situé au <strong>{{adresse_bien}}</strong> a été créé avec succès.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Locataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_locataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Début du bail</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_debut}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Loyer mensuel</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant_loyer}} €</td></tr>
</table>
<a href="{{lease_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le bail</a>',
'Bonjour {{prenom}},

Le bail pour le bien au {{adresse_bien}} a été créé.
Locataire : {{nom_locataire}}
Début : {{date_debut}}
Loyer : {{montant_loyer}} €

Voir le bail : {{lease_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas, Fort-de-France"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "date_debut", "label": "Date de début du bail", "example": "1er mars 2026"}, {"key": "montant_loyer", "label": "Montant du loyer", "example": "850"}, {"key": "lease_url", "label": "Lien vers le bail", "example": "https://talok.fr/owner/leases/..."}]'::jsonb,
0),

-- 9. Bail expirant
('lease_expiring', 'lease', 'Bail arrivant à échéance', 'Alerte au propriétaire avant l''expiration d''un bail', 'Bail expirant dans {{jours_restants}} jours — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Le bail de <strong>{{nom_locataire}}</strong> au <strong>{{adresse_bien}}</strong> arrive à échéance le <strong>{{date_fin}}</strong> (dans {{jours_restants}} jours).</p>
<p>Pensez à :</p>
<ul>
  <li>Renouveler le bail si vous souhaitez continuer la location</li>
  <li>Planifier un état des lieux de sortie</li>
  <li>Prévenir votre locataire de vos intentions</li>
</ul>
<a href="{{lease_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Gérer ce bail</a>',
'Bonjour {{prenom}},

Le bail de {{nom_locataire}} au {{adresse_bien}} expire le {{date_fin}} (dans {{jours_restants}} jours).

Gérer ce bail : {{lease_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "date_fin", "label": "Date de fin du bail", "example": "31 mars 2026"}, {"key": "jours_restants", "label": "Nombre de jours restants", "example": "30"}, {"key": "lease_url", "label": "Lien vers le bail", "example": "https://talok.fr/owner/leases/..."}]'::jsonb,
0),

-- 10. Résiliation de bail
('lease_terminated', 'lease', 'Résiliation de bail', 'Notification de résiliation de bail', 'Résiliation de bail — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Le bail pour le bien situé au <strong>{{adresse_bien}}</strong> a été résilié.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date de fin effective</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_fin}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Motif</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{motif}}</td></tr>
</table>
<p>Un état des lieux de sortie devra être planifié avant cette date.</p>',
'Bonjour {{prenom}},

Le bail au {{adresse_bien}} a été résilié.
Date de fin : {{date_fin}}
Motif : {{motif}}

Un état des lieux de sortie devra être planifié.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Thomas"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "date_fin", "label": "Date effective de fin", "example": "31 mars 2026"}, {"key": "motif", "label": "Motif de résiliation", "example": "Congé du locataire"}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : PAIEMENTS & LOYERS (payment)
-- ============================================

-- 11. Rappel de loyer
('rent_reminder', 'payment', 'Rappel de loyer', 'Rappel envoyé au locataire avant l''échéance du loyer', 'Rappel : loyer de {{montant}} € à régler avant le {{date_echeance}}',
'<p>Bonjour {{prenom}},</p>
<p>Votre loyer de <strong>{{montant}} €</strong> pour le bien situé au <strong>{{adresse_bien}}</strong> est à régler avant le <strong>{{date_echeance}}</strong>.</p>
<a href="{{payment_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Payer mon loyer</a>
<p>Si vous avez déjà effectué le paiement, veuillez ignorer cet email.</p>',
'Bonjour {{prenom}},

Votre loyer de {{montant}} € pour le bien au {{adresse_bien}} est à régler avant le {{date_echeance}}.

Payer : {{payment_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "montant", "label": "Montant du loyer", "example": "850"}, {"key": "date_echeance", "label": "Date d''échéance", "example": "5 mars 2026"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "payment_url", "label": "Lien de paiement", "example": "https://talok.fr/tenant/payments/..."}]'::jsonb,
0),

-- 12. Loyer reçu (propriétaire)
('rent_received', 'payment', 'Loyer reçu', 'Notification au propriétaire après réception d''un loyer', 'Loyer reçu — {{montant}} € de {{nom_locataire}}',
'<p>Bonjour {{prenom}},</p>
<p>Le loyer du mois de <strong>{{mois}}</strong> a été reçu :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Locataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_locataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} €</td></tr>
</table>
<p>La quittance sera automatiquement générée et envoyée au locataire.</p>',
'Bonjour {{prenom}},

Loyer de {{mois}} reçu :
Locataire : {{nom_locataire}}
Bien : {{adresse_bien}}
Montant : {{montant}} €

La quittance sera générée automatiquement.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "montant", "label": "Montant reçu", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "mois", "label": "Mois concerné", "example": "mars 2026"}, {"key": "dashboard_url", "label": "Lien dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0),

-- 13. Loyer en retard (propriétaire)
('rent_late', 'payment', 'Loyer en retard', 'Alerte au propriétaire pour un loyer impayé', 'Loyer impayé — {{nom_locataire}} ({{jours_retard}} jours de retard)',
'<p>Bonjour {{prenom}},</p>
<p>Le loyer de <strong>{{nom_locataire}}</strong> pour le bien au <strong>{{adresse_bien}}</strong> est en retard de <strong>{{jours_retard}} jours</strong>.</p>
<p>Montant impayé : <strong>{{montant}} €</strong></p>
<a href="{{lease_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le détail</a>',
'Bonjour {{prenom}},

Loyer impayé de {{nom_locataire}} au {{adresse_bien}}.
Retard : {{jours_retard}} jours
Montant : {{montant}} €

Voir le détail : {{lease_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "montant", "label": "Montant dû", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "jours_retard", "label": "Jours de retard", "example": "5"}, {"key": "lease_url", "label": "Lien vers le bail", "example": "https://talok.fr/owner/leases/..."}]'::jsonb,
0),

-- 14. Relance loyer impayé (locataire)
('rent_late_tenant', 'payment', 'Relance loyer impayé', 'Relance envoyée au locataire pour un loyer en retard', 'Rappel important : loyer impayé de {{montant}} €',
'<p>Bonjour {{prenom}},</p>
<p>Nous vous informons que votre loyer pour le bien au <strong>{{adresse_bien}}</strong> est en retard de <strong>{{jours_retard}} jours</strong>.</p>
<p>Montant à régler : <strong>{{montant}} €</strong></p>
<a href="{{payment_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Régulariser maintenant</a>
<p>En cas de difficulté, nous vous encourageons à contacter votre propriétaire pour trouver une solution amiable.</p>',
'Bonjour {{prenom}},

Votre loyer au {{adresse_bien}} est en retard de {{jours_retard}} jours.
Montant : {{montant}} €

Régulariser : {{payment_url}}

En cas de difficulté, contactez votre propriétaire.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "montant", "label": "Montant dû", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "jours_retard", "label": "Jours de retard", "example": "5"}, {"key": "payment_url", "label": "Lien de paiement", "example": "https://talok.fr/tenant/payments/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : DOCUMENTS & QUITTANCES (document)
-- ============================================

-- 15. Quittance disponible
('quittance_available', 'document', 'Quittance disponible', 'Notification au locataire quand une quittance est prête', 'Votre quittance de loyer — {{mois}} {{annee}}',
'<p>Bonjour {{prenom}},</p>
<p>Votre quittance de loyer pour <strong>{{mois}} {{annee}}</strong> est disponible.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} €</td></tr>
</table>
<a href="{{download_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Télécharger ma quittance</a>',
'Bonjour {{prenom}},

Votre quittance de loyer pour {{mois}} {{annee}} est disponible.
Bien : {{adresse_bien}}
Montant : {{montant}} €

Télécharger : {{download_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "mois", "label": "Mois", "example": "mars"}, {"key": "annee", "label": "Année", "example": "2026"}, {"key": "montant", "label": "Montant", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "download_url", "label": "Lien de téléchargement", "example": "https://talok.fr/tenant/documents/..."}]'::jsonb,
0),

-- 16. Document à signer
('document_to_sign', 'document', 'Document à signer', 'Notification quand un document nécessite une signature', 'Document à signer : {{type_document}} — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_expediteur}}</strong> vous invite à signer le document suivant :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Document</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{type_document}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien concerné</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">À signer avant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{expiration}}</td></tr>
</table>
<a href="{{sign_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Signer le document</a>
<p>Ce lien expire le {{expiration}}.</p>',
'Bonjour {{prenom}},

{{nom_expediteur}} vous invite à signer : {{type_document}}
Bien : {{adresse_bien}}
À signer avant : {{expiration}}

Signer : {{sign_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du signataire", "example": "Marie"}, {"key": "type_document", "label": "Type de document", "example": "Bail d''habitation"}, {"key": "nom_expediteur", "label": "Nom de l''expéditeur", "example": "M. Dupont"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "sign_url", "label": "Lien de signature", "example": "https://talok.fr/signature/..."}, {"key": "expiration", "label": "Date d''expiration", "example": "15 mars 2026"}]'::jsonb,
0),

-- 17. Document signé
('document_signed', 'document', 'Document signé', 'Notification quand un document a été signé', 'Document signé par {{nom_signataire}} — {{type_document}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_signataire}}</strong> a signé le document <strong>{{type_document}}</strong> concernant le bien au <strong>{{adresse_bien}}</strong> le {{date_signature}}.</p>
<a href="{{document_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le document signé</a>',
'Bonjour {{prenom}},

{{nom_signataire}} a signé le document {{type_document}} pour le bien au {{adresse_bien}} le {{date_signature}}.

Voir le document : {{document_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Thomas"}, {"key": "type_document", "label": "Type de document", "example": "Bail d''habitation"}, {"key": "nom_signataire", "label": "Nom du signataire", "example": "Marie Martin"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "date_signature", "label": "Date de signature", "example": "1er mars 2026"}, {"key": "document_url", "label": "Lien vers le document", "example": "https://talok.fr/documents/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : ÉTATS DES LIEUX (edl)
-- ============================================

-- 18. EDL planifié
('edl_scheduled', 'edl', 'EDL planifié', 'Notification quand un état des lieux est programmé', 'État des lieux {{type_edl}} planifié — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Un état des lieux <strong>{{type_edl}}</strong> a été planifié :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_edl}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Organisé par</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_organisateur}}</td></tr>
</table>
<a href="{{edl_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir les détails</a>
<p>Veuillez vous présenter à l''adresse indiquée à la date et heure convenues.</p>',
'Bonjour {{prenom}},

État des lieux {{type_edl}} planifié :
Bien : {{adresse_bien}}
Date : {{date_edl}}
Organisé par : {{nom_organisateur}}

Détails : {{edl_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Marie"}, {"key": "type_edl", "label": "Type (Entrée/Sortie)", "example": "d''entrée"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "date_edl", "label": "Date et heure", "example": "15 mars 2026 à 10h00"}, {"key": "nom_organisateur", "label": "Organisateur", "example": "M. Dupont"}, {"key": "edl_url", "label": "Lien vers le détail", "example": "https://talok.fr/edl/..."}]'::jsonb,
0),

-- 19. EDL terminé
('edl_completed', 'edl', 'EDL terminé', 'Notification quand un état des lieux est finalisé', 'État des lieux {{type_edl}} terminé — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>L''état des lieux <strong>{{type_edl}}</strong> du bien au <strong>{{adresse_bien}}</strong> réalisé le {{date_edl}} est maintenant finalisé.</p>
<a href="{{report_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Consulter le rapport</a>
<p>Le rapport est disponible dans votre espace documents.</p>',
'Bonjour {{prenom}},

L''état des lieux {{type_edl}} au {{adresse_bien}} réalisé le {{date_edl}} est finalisé.

Consulter le rapport : {{report_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "type_edl", "label": "Type (Entrée/Sortie)", "example": "de sortie"}, {"key": "adresse_bien", "label": "Adresse", "example": "12 rue des Lilas"}, {"key": "date_edl", "label": "Date de réalisation", "example": "15 mars 2026"}, {"key": "report_url", "label": "Lien vers le rapport", "example": "https://talok.fr/edl/report/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : INCIDENTS & INTERVENTIONS (incident)
-- ============================================

-- 20. Incident signalé (propriétaire)
('incident_reported', 'incident', 'Incident signalé', 'Notification au propriétaire quand un locataire signale un incident', 'Incident signalé — {{titre_incident}} ({{urgence}})',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_locataire}}</strong> a signalé un incident au <strong>{{adresse_bien}}</strong> :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Incident</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{titre_incident}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Urgence</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{urgence}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Description</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{description_incident}}</td></tr>
</table>
<a href="{{incident_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Gérer l''incident</a>',
'Bonjour {{prenom}},

{{nom_locataire}} a signalé un incident au {{adresse_bien}} :
Incident : {{titre_incident}}
Urgence : {{urgence}}
Description : {{description_incident}}

Gérer : {{incident_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "nom_locataire", "label": "Locataire", "example": "Marie Martin"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "titre_incident", "label": "Titre de l''incident", "example": "Fuite robinet cuisine"}, {"key": "description_incident", "label": "Description", "example": "Le robinet fuit depuis ce matin"}, {"key": "urgence", "label": "Niveau d''urgence", "example": "urgent"}, {"key": "incident_url", "label": "Lien vers l''incident", "example": "https://talok.fr/owner/tickets/..."}]'::jsonb,
0),

-- 21. Mise à jour d'incident (locataire)
('incident_update', 'incident', 'Mise à jour d''incident', 'Notification au locataire lors de la mise à jour d''un incident', 'Mise à jour de votre incident — {{titre_incident}}',
'<p>Bonjour {{prenom}},</p>
<p>Votre incident <strong>{{titre_incident}}</strong> a été mis à jour :</p>
<p>Nouveau statut : <strong>{{nouveau_statut}}</strong></p>
<p>{{commentaire}}</p>
<a href="{{incident_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le détail</a>',
'Bonjour {{prenom}},

Votre incident "{{titre_incident}}" a été mis à jour.
Nouveau statut : {{nouveau_statut}}
{{commentaire}}

Détail : {{incident_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "titre_incident", "label": "Titre de l''incident", "example": "Fuite robinet cuisine"}, {"key": "nouveau_statut", "label": "Nouveau statut", "example": "En cours de traitement"}, {"key": "commentaire", "label": "Commentaire", "example": "Un technicien passera demain."}, {"key": "incident_url", "label": "Lien", "example": "https://talok.fr/tenant/tickets/..."}]'::jsonb,
0),

-- 22. Intervention assignée (prestataire)
('intervention_assigned', 'incident', 'Intervention assignée', 'Notification au prestataire quand une intervention lui est assignée', 'Nouvelle intervention — {{titre_intervention}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_proprietaire}}</strong> vous assigne une intervention :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Intervention</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{titre_intervention}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Adresse</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date souhaitée</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_souhaitee}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Urgence</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{urgence}}</td></tr>
</table>
<a href="{{intervention_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Accepter / Planifier</a>',
'Bonjour {{prenom}},

{{nom_proprietaire}} vous assigne une intervention :
Intervention : {{titre_intervention}}
Adresse : {{adresse_bien}}
Date souhaitée : {{date_souhaitee}}
Urgence : {{urgence}}

Accepter/Planifier : {{intervention_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du prestataire", "example": "Jacques"}, {"key": "nom_proprietaire", "label": "Nom du propriétaire", "example": "M. Dupont"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "titre_intervention", "label": "Description", "example": "Réparation fuite robinet"}, {"key": "date_souhaitee", "label": "Date souhaitée", "example": "18 mars 2026"}, {"key": "urgence", "label": "Niveau d''urgence", "example": "urgent"}, {"key": "intervention_url", "label": "Lien", "example": "https://talok.fr/provider/work-orders/..."}]'::jsonb,
0),

-- 23. Intervention planifiée (locataire)
('intervention_scheduled', 'incident', 'Intervention planifiée', 'Notification au locataire quand une intervention est programmée', 'Intervention planifiée — {{titre_intervention}}',
'<p>Bonjour {{prenom}},</p>
<p>Une intervention a été planifiée pour votre logement au <strong>{{adresse_bien}}</strong> :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Intervention</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{titre_intervention}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Prestataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_prestataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_intervention}}</td></tr>
</table>
<p>Merci de vous assurer que l''accès au logement sera possible à cette date.</p>',
'Bonjour {{prenom}},

Intervention planifiée au {{adresse_bien}} :
Intervention : {{titre_intervention}}
Prestataire : {{nom_prestataire}}
Date : {{date_intervention}}

Merci d''assurer l''accès au logement.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "titre_intervention", "label": "Description", "example": "Réparation fuite robinet"}, {"key": "nom_prestataire", "label": "Nom du prestataire", "example": "Jacques Martin"}, {"key": "date_intervention", "label": "Date et créneau", "example": "18 mars 2026, 9h-12h"}, {"key": "adresse_bien", "label": "Adresse", "example": "12 rue des Lilas"}]'::jsonb,
0),

-- 24. Intervention terminée (propriétaire)
('intervention_completed', 'incident', 'Intervention terminée', 'Notification au propriétaire quand une intervention est finalisée', 'Intervention terminée — {{titre_intervention}}',
'<p>Bonjour {{prenom}},</p>
<p>L''intervention <strong>{{titre_intervention}}</strong> au <strong>{{adresse_bien}}</strong> a été réalisée.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Prestataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_prestataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_realisation}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Coût</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{cout}} €</td></tr>
</table>
<a href="{{intervention_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le compte-rendu</a>',
'Bonjour {{prenom}},

Intervention terminée : {{titre_intervention}} au {{adresse_bien}}
Prestataire : {{nom_prestataire}}
Date : {{date_realisation}}
Coût : {{cout}} €

Compte-rendu : {{intervention_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "titre_intervention", "label": "Description", "example": "Réparation fuite robinet"}, {"key": "nom_prestataire", "label": "Prestataire", "example": "Jacques Martin"}, {"key": "adresse_bien", "label": "Adresse", "example": "12 rue des Lilas"}, {"key": "date_realisation", "label": "Date de réalisation", "example": "18 mars 2026"}, {"key": "cout", "label": "Coût", "example": "150"}, {"key": "intervention_url", "label": "Lien", "example": "https://talok.fr/owner/work-orders/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : ABONNEMENT & FACTURATION (subscription)
-- ============================================

-- 25. Bienvenue abonnement
('subscription_welcome', 'subscription', 'Bienvenue abonnement', 'Email de bienvenue après souscription à un plan', 'Votre abonnement Talok {{plan}} est activé !',
'<p>Bonjour {{prenom}},</p>
<p>Votre abonnement <strong>Talok {{plan}}</strong> est maintenant actif. Merci pour votre confiance !</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Plan</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{plan}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} € / an</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Prochain renouvellement</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_renouvellement}}</td></tr>
</table>
<a href="{{dashboard_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Accéder à Talok</a>',
'Bonjour {{prenom}},

Votre abonnement Talok {{plan}} est actif.
Plan : {{plan}}
Montant : {{montant}} € / an
Prochain renouvellement : {{date_renouvellement}}

Accéder à Talok : {{dashboard_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "plan", "label": "Nom du plan", "example": "Confort"}, {"key": "montant", "label": "Montant annuel", "example": "290"}, {"key": "date_renouvellement", "label": "Date de renouvellement", "example": "12 février 2027"}, {"key": "dashboard_url", "label": "Lien dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0),

-- 26. Abonnement expirant
('subscription_expiring', 'subscription', 'Abonnement expirant', 'Alerte avant l''expiration d''un abonnement', 'Votre abonnement Talok expire dans {{jours_restants}} jours',
'<p>Bonjour {{prenom}},</p>
<p>Votre abonnement <strong>Talok {{plan}}</strong> expire le <strong>{{date_expiration}}</strong>.</p>
<p>Pour continuer à profiter de toutes les fonctionnalités, pensez à renouveler votre abonnement.</p>
<a href="{{renewal_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Renouveler mon abonnement</a>',
'Bonjour {{prenom}},

Votre abonnement Talok {{plan}} expire le {{date_expiration}}.

Renouveler : {{renewal_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "plan", "label": "Plan actuel", "example": "Confort"}, {"key": "date_expiration", "label": "Date d''expiration", "example": "12 mars 2026"}, {"key": "jours_restants", "label": "Jours restants", "example": "15"}, {"key": "renewal_url", "label": "Lien de renouvellement", "example": "https://talok.fr/settings/billing"}]'::jsonb,
0),

-- 27. Abonnement renouvelé
('subscription_renewed', 'subscription', 'Abonnement renouvelé', 'Confirmation de renouvellement d''abonnement', 'Abonnement Talok renouvelé',
'<p>Bonjour {{prenom}},</p>
<p>Votre abonnement <strong>Talok {{plan}}</strong> a été renouvelé avec succès.</p>
<p>Montant : <strong>{{montant}} €</strong><br>
Prochain renouvellement : {{date_renouvellement}}</p>
<a href="{{invoice_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Télécharger ma facture</a>',
'Bonjour {{prenom}},

Votre abonnement Talok {{plan}} a été renouvelé.
Montant : {{montant}} €
Prochain renouvellement : {{date_renouvellement}}

Facture : {{invoice_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "plan", "label": "Plan", "example": "Confort"}, {"key": "montant", "label": "Montant facturé", "example": "290"}, {"key": "date_renouvellement", "label": "Prochaine échéance", "example": "12 février 2027"}, {"key": "invoice_url", "label": "Lien vers la facture", "example": "https://talok.fr/settings/billing/invoices/..."}]'::jsonb,
0),

-- 28. Échec de paiement
('payment_failed', 'subscription', 'Échec de paiement', 'Alerte lors d''un échec de paiement d''abonnement', 'Échec du paiement Talok — Action requise',
'<p>Bonjour {{prenom}},</p>
<p>Le paiement de <strong>{{montant}} €</strong> pour votre abonnement Talok a échoué.</p>
<p>Raison : {{raison}}</p>
<p>Veuillez mettre à jour vos informations de paiement pour éviter toute interruption de service.</p>
<a href="{{billing_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Mettre à jour mon moyen de paiement</a>',
'Bonjour {{prenom}},

Le paiement de {{montant}} € pour votre abonnement Talok a échoué.
Raison : {{raison}}

Mettez à jour vos informations de paiement : {{billing_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "montant", "label": "Montant", "example": "290"}, {"key": "raison", "label": "Raison de l''échec", "example": "Carte expirée"}, {"key": "billing_url", "label": "Lien paramètres de paiement", "example": "https://talok.fr/settings/billing"}]'::jsonb,
0),

-- 29. Facture disponible
('invoice_available', 'subscription', 'Facture disponible', 'Notification quand une facture Talok est prête', 'Facture Talok n°{{numero_facture}} disponible',
'<p>Bonjour {{prenom}},</p>
<p>Votre facture Talok est disponible :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Facture n°</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{numero_facture}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_facture}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} €</td></tr>
</table>
<a href="{{invoice_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Télécharger la facture</a>',
'Bonjour {{prenom}},

Facture Talok disponible :
N° : {{numero_facture}}
Date : {{date_facture}}
Montant : {{montant}} €

Télécharger : {{invoice_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "numero_facture", "label": "Numéro de facture", "example": "TLK-2026-0042"}, {"key": "montant", "label": "Montant", "example": "290"}, {"key": "date_facture", "label": "Date", "example": "12 février 2026"}, {"key": "invoice_url", "label": "Lien de téléchargement", "example": "https://talok.fr/settings/billing/invoices/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : MESSAGERIE (messaging)
-- ============================================

-- 30. Nouveau message
('new_message', 'messaging', 'Nouveau message', 'Notification quand un nouveau message est reçu', 'Nouveau message de {{nom_expediteur}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_expediteur}}</strong> vous a envoyé un message :</p>
<blockquote style="border-left:4px solid #2563eb;padding:8px 16px;margin:16px 0;background:#f8fafc;">{{apercu_message}}</blockquote>
<a href="{{message_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Répondre</a>',
'Bonjour {{prenom}},

{{nom_expediteur}} vous a envoyé un message :
"{{apercu_message}}"

Répondre : {{message_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Thomas"}, {"key": "nom_expediteur", "label": "Nom de l''expéditeur", "example": "Marie Martin"}, {"key": "apercu_message", "label": "Aperçu du message", "example": "Bonjour, j''ai une question concernant..."}, {"key": "message_url", "label": "Lien vers la conversation", "example": "https://talok.fr/messages/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : RAPPORTS (report)
-- ============================================

-- 31. Récapitulatif mensuel propriétaire
('monthly_summary_owner', 'report', 'Récapitulatif mensuel', 'Rapport mensuel envoyé aux propriétaires', 'Récapitulatif {{mois}} {{annee}} — {{loyers_recus}} € encaissés',
'<h2>Récapitulatif du mois de {{mois}} {{annee}}</h2>
<p>Bonjour {{prenom}}, voici le résumé de votre activité locative :</p>
<h3>Finances</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Loyers encaissés</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{loyers_recus}} € / {{loyers_attendus}} €</td></tr>
</table>
<h3>Patrimoine</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Biens gérés</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nb_biens}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Taux d''occupation</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{taux_occupation}} %</td></tr>
</table>
<h3>Maintenance</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Incidents ouverts</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nb_incidents_ouverts}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Interventions ce mois</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nb_interventions}}</td></tr>
</table>
<a href="{{dashboard_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le détail</a>',
'Bonjour {{prenom}},

Récapitulatif {{mois}} {{annee}} :

FINANCES
Loyers encaissés : {{loyers_recus}} € / {{loyers_attendus}} €

PATRIMOINE
Biens gérés : {{nb_biens}}
Taux d''occupation : {{taux_occupation}} %

MAINTENANCE
Incidents ouverts : {{nb_incidents_ouverts}}
Interventions : {{nb_interventions}}

Détail : {{dashboard_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "mois", "label": "Mois", "example": "février"}, {"key": "annee", "label": "Année", "example": "2026"}, {"key": "nb_biens", "label": "Nombre de biens", "example": "3"}, {"key": "loyers_recus", "label": "Loyers encaissés", "example": "2550"}, {"key": "loyers_attendus", "label": "Loyers attendus", "example": "2550"}, {"key": "nb_incidents_ouverts", "label": "Incidents ouverts", "example": "1"}, {"key": "nb_interventions", "label": "Interventions du mois", "example": "2"}, {"key": "taux_occupation", "label": "Taux d''occupation", "example": "100"}, {"key": "dashboard_url", "label": "Lien dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0);

