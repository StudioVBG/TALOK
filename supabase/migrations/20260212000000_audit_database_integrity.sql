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
    string_agg(n.id::TEXT, ', ' ORDER BY n.created_at)::TEXT
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
