-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  TALOK — AUDIT D'INTÉGRITÉ — SCRIPT TOUT-EN-UN                           ║
-- ║  Date: 2026-02-12                                                         ║
-- ║  Combine: 20260212000000 + 20260212100000                                 ║
-- ║                                                                            ║
-- ║  INSTRUCTIONS:                                                             ║
-- ║  1. Ouvrir Supabase Dashboard > SQL Editor                                ║
-- ║  2. Coller CE FICHIER ENTIER                                              ║
-- ║  3. Cliquer "Run" (execution ~5-15 secondes)                              ║
-- ║  4. Vérifier les messages de succès dans l'onglet "Messages"              ║
-- ║                                                                            ║
-- ║  Ce script est SAFE : il crée des fonctions de diagnostic et des          ║
-- ║  contraintes de prévention. Le nettoyage est en DRY RUN par défaut.       ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ############################################################################
-- #                                                                          #
-- #  PARTIE 1/2 : AUDIT D'INTÉGRITÉ (diagnostic + nettoyage SAFE)           #
-- #  Source: 20260212000000_audit_database_integrity.sql                      #
-- #                                                                          #
-- ############################################################################


-- ============================================================================
-- PHASE 1: FONCTIONS DE DÉTECTION DES ORPHELINS
-- ============================================================================

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
  RETURN QUERY
  SELECT 'profiles'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profiles sans compte auth.users associé'::TEXT
  FROM profiles p
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);

  -- ── PROPERTIES ────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'properties'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Propriétés dont le propriétaire (profile) n''existe plus'::TEXT
  FROM properties p
  WHERE p.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = p.owner_id);

  RETURN QUERY
  SELECT 'properties'::TEXT, 'building_id'::TEXT, 'buildings'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Propriétés avec building_id pointant vers un immeuble inexistant'::TEXT
  FROM properties p
  WHERE p.building_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = p.building_id);

  RETURN QUERY
  SELECT 'properties'::TEXT, 'legal_entity_id'::TEXT, 'legal_entities'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Propriétés avec legal_entity_id pointant vers une entité inexistante'::TEXT
  FROM properties p
  WHERE p.legal_entity_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.id = p.legal_entity_id);

  -- ── UNITS ─────────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'units'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Unités de colocation dont la propriété n''existe plus'::TEXT
  FROM units u
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = u.property_id);

  -- ── LEASES ────────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'leases'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Baux dont la propriété n''existe plus'::TEXT
  FROM leases l
  WHERE l.property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = l.property_id);

  RETURN QUERY
  SELECT 'leases'::TEXT, 'unit_id'::TEXT, 'units'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux dont l''unité n''existe plus'::TEXT
  FROM leases l
  WHERE l.unit_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM units u WHERE u.id = l.unit_id);

  RETURN QUERY
  SELECT 'leases'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux dont le locataire (tenant_id) n''existe plus dans profiles'::TEXT
  FROM leases l
  WHERE l.tenant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = l.tenant_id);

  RETURN QUERY
  SELECT 'leases'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux dont le propriétaire (owner_id) n''existe plus dans profiles'::TEXT
  FROM leases l
  WHERE l.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = l.owner_id);

  RETURN QUERY
  SELECT 'leases'::TEXT, '(no_signers)'::TEXT, 'lease_signers'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux actifs/pending sans aucun signataire'::TEXT
  FROM leases l
  WHERE l.statut NOT IN ('draft', 'cancelled', 'archived', 'terminated')
    AND NOT EXISTS (SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id);

  -- ── LEASE_SIGNERS ─────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'lease_signers'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Signataires dont le bail n''existe plus'::TEXT
  FROM lease_signers ls
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);

  RETURN QUERY
  SELECT 'lease_signers'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Signataires dont le profil n''existe plus'::TEXT
  FROM lease_signers ls
  WHERE ls.profile_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = ls.profile_id);

  -- ── INVOICES ──────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'invoices'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Factures dont le bail n''existe plus'::TEXT
  FROM invoices i
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);

  RETURN QUERY
  SELECT 'invoices'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures dont le profil propriétaire n''existe plus'::TEXT
  FROM invoices i
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = i.owner_id);

  RETURN QUERY
  SELECT 'invoices'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures dont le profil locataire n''existe plus'::TEXT
  FROM invoices i
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = i.tenant_id);

  -- ── PAYMENTS ──────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'payments'::TEXT, 'invoice_id'::TEXT, 'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Paiements dont la facture n''existe plus'::TEXT
  FROM payments py
  WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);

  -- ── DOCUMENTS ─────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'documents'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Documents dont le bail n''existe plus'::TEXT
  FROM documents d
  WHERE d.lease_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);

  RETURN QUERY
  SELECT 'documents'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont la propriété n''existe plus'::TEXT
  FROM documents d
  WHERE d.property_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);

  RETURN QUERY
  SELECT 'documents'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont le profil owner n''existe plus'::TEXT
  FROM documents d
  WHERE d.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.owner_id);

  RETURN QUERY
  SELECT 'documents'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont le profil tenant n''existe plus'::TEXT
  FROM documents d
  WHERE d.tenant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.tenant_id);

  RETURN QUERY
  SELECT 'documents'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents dont le profile_id n''existe plus'::TEXT
  FROM documents d
  WHERE d.profile_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.profile_id);

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
  RETURN QUERY
  SELECT 'tickets'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Tickets dont la propriété n''existe plus'::TEXT
  FROM tickets t
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = t.property_id);

  RETURN QUERY
  SELECT 'tickets'::TEXT, 'created_by_profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Tickets dont le créateur n''existe plus'::TEXT
  FROM tickets t
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.created_by_profile_id);

  RETURN QUERY
  SELECT 'tickets'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Tickets avec lease_id pointant vers un bail inexistant'::TEXT
  FROM tickets t
  WHERE t.lease_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);

  -- ── WORK_ORDERS ───────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'work_orders'::TEXT, 'ticket_id'::TEXT, 'tickets'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Ordres de travail dont le ticket n''existe plus'::TEXT
  FROM work_orders wo
  WHERE NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = wo.ticket_id);

  RETURN QUERY
  SELECT 'work_orders'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Ordres de travail dont le prestataire n''existe plus'::TEXT
  FROM work_orders wo
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = wo.provider_id);

  -- ── CHARGES ───────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'charges'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Charges dont la propriété n''existe plus'::TEXT
  FROM charges c
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = c.property_id);

  -- ── EDL ───────────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'edl'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'États des lieux dont le bail n''existe plus'::TEXT
  FROM edl e
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id);

  RETURN QUERY
  SELECT 'edl_items'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Items d''EDL dont l''EDL parent n''existe plus'::TEXT
  FROM edl_items ei
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = ei.edl_id);

  RETURN QUERY
  SELECT 'edl_media'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Médias d''EDL dont l''EDL parent n''existe plus'::TEXT
  FROM edl_media em
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = em.edl_id);

  RETURN QUERY
  SELECT 'edl_signatures'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Signatures d''EDL dont l''EDL parent n''existe plus'::TEXT
  FROM edl_signatures es
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = es.edl_id);

  RETURN QUERY
  SELECT 'edl_meter_readings'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Relevés compteurs EDL dont l''EDL n''existe plus'::TEXT
  FROM edl_meter_readings emr
  WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = emr.edl_id);

  -- ── METERS ────────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'meters'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Compteurs dont le bail n''existe plus'::TEXT
  FROM meters m
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);

  RETURN QUERY
  SELECT 'meter_readings'::TEXT, 'meter_id'::TEXT, 'meters'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Relevés de compteur dont le compteur n''existe plus'::TEXT
  FROM meter_readings mr
  WHERE NOT EXISTS (SELECT 1 FROM meters m WHERE m.id = mr.meter_id);

  -- ── ROOMMATES ─────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'roommates'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Colocataires dont le bail n''existe plus'::TEXT
  FROM roommates r
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);

  RETURN QUERY
  SELECT 'roommates'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Colocataires dont le profil n''existe plus'::TEXT
  FROM roommates r
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = r.profile_id);

  -- ── PAYMENT_SHARES ────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'payment_shares'::TEXT, 'roommate_id'::TEXT, 'roommates'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Parts de paiement dont le colocataire n''existe plus'::TEXT
  FROM payment_shares ps
  WHERE NOT EXISTS (SELECT 1 FROM roommates r WHERE r.id = ps.roommate_id);

  RETURN QUERY
  SELECT 'payment_shares'::TEXT, 'invoice_id'::TEXT, 'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Parts de paiement dont la facture n''existe plus'::TEXT
  FROM payment_shares ps
  WHERE ps.invoice_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = ps.invoice_id);

  -- ── DEPOSIT_SHARES ────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'deposit_shares'::TEXT, 'roommate_id'::TEXT, 'roommates'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Parts de dépôt dont le colocataire n''existe plus'::TEXT
  FROM deposit_shares ds
  WHERE NOT EXISTS (SELECT 1 FROM roommates r WHERE r.id = ds.roommate_id);

  -- ── DEPOSIT_MOVEMENTS ─────────────────────────────────────────────
  RETURN QUERY
  SELECT 'deposit_movements'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Mouvements de dépôt dont le bail n''existe plus'::TEXT
  FROM deposit_movements dm
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);

  -- ── NOTIFICATIONS ─────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'notifications'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Notifications dont l''utilisateur n''existe plus'::TEXT
  FROM notifications n
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = n.user_id);

  -- ── SUBSCRIPTIONS ─────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'subscriptions'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Abonnements dont l''utilisateur n''existe plus'::TEXT
  FROM subscriptions s
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);

  -- ── OWNER_PROFILES ────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'owner_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profils propriétaire dont le profil de base n''existe plus'::TEXT
  FROM owner_profiles op
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = op.profile_id);

  -- ── TENANT_PROFILES ───────────────────────────────────────────────
  RETURN QUERY
  SELECT 'tenant_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profils locataire dont le profil de base n''existe plus'::TEXT
  FROM tenant_profiles tp
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = tp.profile_id);

  -- ── PROVIDER_PROFILES ─────────────────────────────────────────────
  RETURN QUERY
  SELECT 'provider_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Profils prestataire dont le profil de base n''existe plus'::TEXT
  FROM provider_profiles pp
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pp.profile_id);

  -- ── CONVERSATIONS ─────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'conversations'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Conversations dont le profil owner n''existe plus'::TEXT
  FROM conversations c
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = c.owner_id);

  RETURN QUERY
  SELECT 'messages'::TEXT, 'conversation_id'::TEXT, 'conversations'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Messages dont la conversation n''existe plus'::TEXT
  FROM messages m
  WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id = m.conversation_id);

  -- ── UNIFIED CONVERSATIONS ─────────────────────────────────────────
  RETURN QUERY
  SELECT 'unified_messages'::TEXT, 'conversation_id'::TEXT, 'unified_conversations'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Messages unifiés dont la conversation n''existe plus'::TEXT
  FROM unified_messages um
  WHERE NOT EXISTS (SELECT 1 FROM unified_conversations uc WHERE uc.id = um.conversation_id);

  -- ── SIGNATURE_SESSIONS ────────────────────────────────────────────
  RETURN QUERY
  SELECT 'signature_participants'::TEXT, 'session_id'::TEXT, 'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Participants de signature dont la session n''existe plus'::TEXT
  FROM signature_participants sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sp.session_id);

  RETURN QUERY
  SELECT 'signature_proofs'::TEXT, 'participant_id'::TEXT, 'signature_participants'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Preuves de signature dont le participant n''existe plus'::TEXT
  FROM signature_proofs sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_participants pa WHERE pa.id = sp.participant_id);

  RETURN QUERY
  SELECT 'signature_audit_log'::TEXT, 'session_id'::TEXT, 'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Logs d''audit de signature dont la session n''existe plus'::TEXT
  FROM signature_audit_log sal
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sal.session_id);

  -- ── LEGAL_ENTITIES ────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'legal_entities'::TEXT, 'owner_profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Entités légales dont le profil propriétaire n''existe plus'::TEXT
  FROM legal_entities le
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = le.owner_profile_id);

  RETURN QUERY
  SELECT 'entity_associates'::TEXT, 'legal_entity_id'::TEXT, 'legal_entities'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Associés dont l''entité légale n''existe plus'::TEXT
  FROM entity_associates ea
  WHERE NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.id = ea.legal_entity_id);

  -- ── PROPERTY_OWNERSHIP ────────────────────────────────────────────
  RETURN QUERY
  SELECT 'property_ownership'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Détentions de propriété dont le bien n''existe plus'::TEXT
  FROM property_ownership po
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = po.property_id);

  -- ── BUILDINGS ─────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'buildings'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Immeubles dont le propriétaire n''existe plus'::TEXT
  FROM buildings b
  WHERE b.owner_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = b.owner_id);

  RETURN QUERY
  SELECT 'building_units'::TEXT, 'building_id'::TEXT, 'buildings'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Lots d''immeuble dont l''immeuble n''existe plus'::TEXT
  FROM building_units bu
  WHERE NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = bu.building_id);

  -- ── LEASE_END_PROCESSES ───────────────────────────────────────────
  RETURN QUERY
  SELECT 'lease_end_processes'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Processus de fin de bail dont le bail n''existe plus'::TEXT
  FROM lease_end_processes lep
  WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = lep.lease_id);

  RETURN QUERY
  SELECT 'edl_inspection_items'::TEXT, 'lease_end_process_id'::TEXT, 'lease_end_processes'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Items d''inspection dont le processus de fin n''existe plus'::TEXT
  FROM edl_inspection_items eii
  WHERE NOT EXISTS (SELECT 1 FROM lease_end_processes lep WHERE lep.id = eii.lease_end_process_id);

  RETURN QUERY
  SELECT 'renovation_items'::TEXT, 'lease_end_process_id'::TEXT, 'lease_end_processes'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Items de rénovation dont le processus de fin n''existe plus'::TEXT
  FROM renovation_items ri
  WHERE NOT EXISTS (SELECT 1 FROM lease_end_processes lep WHERE lep.id = ri.lease_end_process_id);

  RETURN QUERY
  SELECT 'renovation_quotes'::TEXT, 'renovation_item_id'::TEXT, 'renovation_items'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Devis de rénovation dont l''item de rénovation n''existe plus'::TEXT
  FROM renovation_quotes rq
  WHERE NOT EXISTS (SELECT 1 FROM renovation_items ri WHERE ri.id = rq.renovation_item_id);

  -- ── PHOTOS ────────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'photos'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Photos dont la propriété n''existe plus'::TEXT
  FROM photos ph
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = ph.property_id);

  -- ── VISIT SCHEDULING ──────────────────────────────────────────────
  RETURN QUERY
  SELECT 'visit_slots'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Créneaux de visite dont la propriété n''existe plus'::TEXT
  FROM visit_slots vs
  WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = vs.property_id);

  RETURN QUERY
  SELECT 'visit_bookings'::TEXT, 'slot_id'::TEXT, 'visit_slots'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Réservations de visite dont le créneau n''existe plus'::TEXT
  FROM visit_bookings vb
  WHERE NOT EXISTS (SELECT 1 FROM visit_slots vs WHERE vs.id = vb.slot_id);

  -- ── QUOTES ────────────────────────────────────────────────────────
  RETURN QUERY
  SELECT 'quotes'::TEXT, 'ticket_id'::TEXT, 'tickets'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Devis dont le ticket n''existe plus'::TEXT
  FROM quotes q
  WHERE q.ticket_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = q.ticket_id);

  RETURN QUERY
  SELECT 'quotes'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Devis dont le prestataire n''existe plus'::TEXT
  FROM quotes q
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = q.provider_id);

  -- ── CONVERSATION_PARTICIPANTS ─────────────────────────────────────
  RETURN QUERY
  SELECT 'conversation_participants'::TEXT, 'conversation_id'::TEXT, 'unified_conversations'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Participants de conversation dont la conversation unifiée n''existe plus'::TEXT
  FROM conversation_participants cp
  WHERE NOT EXISTS (SELECT 1 FROM unified_conversations uc WHERE uc.id = cp.conversation_id);

  -- ── ORGANIZATION_BRANDING ─────────────────────────────────────────
  RETURN QUERY
  SELECT 'organization_branding'::TEXT, 'organization_id'::TEXT, 'organizations'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Branding d''organisation dont l''organisation n''existe plus'::TEXT
  FROM organization_branding ob
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ob.organization_id);

  -- ── PROVIDER_INVOICES ─────────────────────────────────────────────
  RETURN QUERY
  SELECT 'provider_invoices'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures prestataire dont le profil prestataire n''existe plus'::TEXT
  FROM provider_invoices pi
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pi.provider_id);

  -- ── PROVIDER_QUOTES ───────────────────────────────────────────────
  RETURN QUERY
  SELECT 'provider_quotes'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Devis prestataire dont le profil prestataire n''existe plus'::TEXT
  FROM provider_quotes pq
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pq.provider_id);

  -- ── SIGNATURES (legacy) ───────────────────────────────────────────
  RETURN QUERY
  SELECT 'signatures'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Signatures legacy dont le bail n''existe plus'::TEXT
  FROM signatures s
  WHERE s.lease_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = s.lease_id);

  RETURN QUERY
  SELECT 'signatures'::TEXT, 'signer_profile_id'::TEXT, 'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Signatures legacy dont le profil signataire n''existe plus'::TEXT
  FROM signatures s
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = s.signer_profile_id);

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
-- PHASE 3: DÉTECTION DES FK IMPLICITES
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
      AND c.table_name NOT LIKE '_%'
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
-- PHASE 4: VUE CONSOLIDÉE
-- ============================================================================

CREATE OR REPLACE VIEW audit_integrity_dashboard AS
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
-- PHASE 5: TABLE D'ARCHIVAGE + NETTOYAGE SAFE
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_cleanup_archive_batch ON _audit_cleanup_archive(cleanup_batch_id);
CREATE INDEX IF NOT EXISTS idx_cleanup_archive_table ON _audit_cleanup_archive(source_table);
CREATE INDEX IF NOT EXISTS idx_cleanup_archive_date ON _audit_cleanup_archive(cleaned_at);

COMMENT ON TABLE _audit_cleanup_archive IS
  'Archive des enregistrements supprimés lors du nettoyage d''intégrité. Permet de restaurer si nécessaire.';

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
  action := 'INFO';
  source_table := '(batch)';
  fk_column := '';
  records_affected := 0;
  detail := 'Batch ID: ' || v_batch_id::TEXT || ' | Mode: ' || CASE WHEN p_dry_run THEN 'DRY RUN (aucune suppression)' ELSE 'EXECUTION RÉELLE' END;
  RETURN NEXT;

  IF p_severity_filter IN ('ALL', 'CRITICAL') THEN
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'lease_signers', ls.id::TEXT, 'lease_id', to_jsonb(ls), 'Bail inexistant'
      FROM lease_signers ls
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);
      DELETE FROM lease_signers ls
      WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count FROM lease_signers ls WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);
    END IF;
    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'lease_signers'; fk_column := 'lease_id -> leases'; records_affected := v_count;
    detail := 'Signataires dont le bail n''existe plus'; RETURN NEXT;

    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'invoices', i.id::TEXT, 'lease_id', to_jsonb(i), 'Bail inexistant'
      FROM invoices i WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);
      DELETE FROM invoices i WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count FROM invoices i WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);
    END IF;
    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'invoices'; fk_column := 'lease_id -> leases'; records_affected := v_count;
    detail := 'Factures dont le bail n''existe plus'; RETURN NEXT;

    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'payments', py.id::TEXT, 'invoice_id', to_jsonb(py), 'Facture inexistante'
      FROM payments py WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
      DELETE FROM payments py WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count FROM payments py WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
    END IF;
    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'payments'; fk_column := 'invoice_id -> invoices'; records_affected := v_count;
    detail := 'Paiements dont la facture n''existe plus'; RETURN NEXT;
  END IF;

  IF p_severity_filter IN ('ALL', 'CRITICAL', 'HIGH') THEN
    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'documents', d.id::TEXT, 'lease_id', jsonb_build_object('lease_id', d.lease_id), 'Bail inexistant — lease_id mis à NULL'
      FROM documents d WHERE d.lease_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);
      UPDATE documents d SET lease_id = NULL WHERE d.lease_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count FROM documents d WHERE d.lease_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);
    END IF;
    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
    source_table := 'documents'; fk_column := 'lease_id -> leases'; records_affected := v_count;
    detail := 'Documents: lease_id mis à NULL (bail inexistant)'; RETURN NEXT;

    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'documents', d.id::TEXT, 'property_id', jsonb_build_object('property_id', d.property_id), 'Propriété inexistante — property_id mis à NULL'
      FROM documents d WHERE d.property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);
      UPDATE documents d SET property_id = NULL WHERE d.property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count FROM documents d WHERE d.property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);
    END IF;
    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
    source_table := 'documents'; fk_column := 'property_id -> properties'; records_affected := v_count;
    detail := 'Documents: property_id mis à NULL (propriété inexistante)'; RETURN NEXT;

    IF NOT p_dry_run THEN
      WITH orphan_edls AS (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id))
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'edl', e.id::TEXT, 'lease_id', to_jsonb(e), 'Bail inexistant'
      FROM edl e WHERE e.id IN (SELECT id FROM orphan_edls);
      DELETE FROM edl_items WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl_media WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl_signatures WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl_meter_readings WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
      DELETE FROM edl WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = edl.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id);
    END IF;
    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'edl (+ items, media, signatures)'; fk_column := 'lease_id -> leases'; records_affected := v_count;
    detail := 'EDL orphelins supprimés en cascade'; RETURN NEXT;

    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'roommates', r.id::TEXT, 'lease_id', to_jsonb(r), 'Bail inexistant'
      FROM roommates r WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);
      DELETE FROM roommates r WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count FROM roommates r WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);
    END IF;
    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'roommates'; fk_column := 'lease_id -> leases'; records_affected := v_count;
    detail := 'Colocataires dont le bail n''existe plus'; RETURN NEXT;

    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'deposit_movements', dm.id::TEXT, 'lease_id', to_jsonb(dm), 'Bail inexistant'
      FROM deposit_movements dm WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);
      DELETE FROM deposit_movements dm WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count FROM deposit_movements dm WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);
    END IF;
    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'deposit_movements'; fk_column := 'lease_id -> leases'; records_affected := v_count;
    detail := 'Mouvements de dépôt dont le bail n''existe plus'; RETURN NEXT;

    IF NOT p_dry_run THEN
      INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
      SELECT v_batch_id, 'meters', m.id::TEXT, 'lease_id', to_jsonb(m), 'Bail inexistant'
      FROM meters m WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);
      DELETE FROM meter_readings WHERE meter_id IN (SELECT m.id FROM meters m WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id));
      DELETE FROM meters m WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count FROM meters m WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);
    END IF;
    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'meters (+ readings)'; fk_column := 'lease_id -> leases'; records_affected := v_count;
    detail := 'Compteurs orphelins supprimés en cascade'; RETURN NEXT;

    IF NOT p_dry_run THEN
      UPDATE tickets t SET lease_id = NULL WHERE t.lease_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count FROM tickets t WHERE t.lease_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);
    END IF;
    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
    source_table := 'tickets'; fk_column := 'lease_id -> leases'; records_affected := v_count;
    detail := 'Tickets: lease_id mis à NULL (bail inexistant)'; RETURN NEXT;
  END IF;

  IF p_severity_filter = 'ALL' THEN
    IF NOT p_dry_run THEN
      DELETE FROM notifications WHERE is_read = true AND created_at < NOW() - INTERVAL '90 days';
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      SELECT COUNT(*) INTO v_count FROM notifications WHERE is_read = true AND created_at < NOW() - INTERVAL '90 days';
    END IF;
    action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
    source_table := 'notifications'; fk_column := '(age > 90 days + read)'; records_affected := v_count;
    detail := 'Notifications lues de plus de 90 jours'; RETURN NEXT;
  END IF;

  action := 'SUMMARY'; source_table := '(all)'; fk_column := ''; records_affected := 0;
  detail := 'Nettoyage terminé. Batch: ' || v_batch_id::TEXT || ' — Consultez _audit_cleanup_archive pour restaurer.';
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION safe_cleanup_orphans(BOOLEAN, TEXT) IS
  'Nettoyage SAFE des orphelins avec archivage. Par défaut en DRY RUN.';


-- ============================================================================
-- PHASE 6: RESTAURATION
-- ============================================================================

CREATE OR REPLACE FUNCTION restore_cleanup_batch(p_batch_id UUID)
RETURNS TABLE(restored_table TEXT, restored_count BIGINT) AS $$
DECLARE
  r RECORD;
  v_count BIGINT := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT a.source_table
    FROM _audit_cleanup_archive a
    WHERE a.cleanup_batch_id = p_batch_id AND a.cleanup_reason NOT LIKE '%mis à NULL%'
    ORDER BY a.source_table
  LOOP
    restored_table := r.source_table;
    SELECT COUNT(*) INTO v_count FROM _audit_cleanup_archive a
    WHERE a.cleanup_batch_id = p_batch_id AND a.source_table = r.source_table AND a.cleanup_reason NOT LIKE '%mis à NULL%';
    restored_count := v_count;
    RETURN NEXT;
  END LOOP;
  restored_table := 'Les données sont dans _audit_cleanup_archive.original_data (JSONB)';
  restored_count := 0; RETURN NEXT;
  restored_table := 'SELECT original_data FROM _audit_cleanup_archive WHERE cleanup_batch_id = ''' || p_batch_id::TEXT || '''';
  restored_count := 0; RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  RAISE NOTICE '=== PARTIE 1/2 INSTALLÉE : Audit d''intégrité (orphelins + doublons + nettoyage SAFE) ===';
END $$;


-- ############################################################################
-- #                                                                          #
-- #  PARTIE 2/2 : AUDIT V2 — FUSION, PRÉVENTION, CONTRAINTES               #
-- #  Source: 20260212100000_audit_v2_merge_and_prevention.sql                #
-- #                                                                          #
-- ############################################################################


-- ============================================================================
-- INFRASTRUCTURE : Table d'audit
-- ============================================================================

CREATE TABLE IF NOT EXISTS _audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
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

CREATE OR REPLACE FUNCTION audit_duplicate_properties()
RETURNS TABLE(
  duplicate_key TEXT, nb_doublons BIGINT, ids UUID[], owner_ids UUID[],
  premier_cree TIMESTAMPTZ, dernier_cree TIMESTAMPTZ, match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ('exact:' || p.owner_id || ':' || LOWER(TRIM(p.adresse_complete)) || ':' || p.code_postal)::TEXT,
    COUNT(*)::BIGINT, ARRAY_AGG(p.id ORDER BY p.created_at ASC), ARRAY_AGG(DISTINCT p.owner_id),
    MIN(p.created_at), MAX(p.created_at), 'EXACT'::TEXT
  FROM properties p WHERE p.deleted_at IS NULL
  GROUP BY p.owner_id, LOWER(TRIM(p.adresse_complete)), p.code_postal HAVING COUNT(*) > 1;

  RETURN QUERY
  SELECT
    ('temporal:' || p1.owner_id || ':' || p1.id || ':' || p2.id)::TEXT,
    2::BIGINT, ARRAY[p1.id, p2.id], ARRAY[p1.owner_id],
    LEAST(p1.created_at, p2.created_at), GREATEST(p1.created_at, p2.created_at), 'TEMPORAL (<5min)'::TEXT
  FROM properties p1
  JOIN properties p2 ON p1.owner_id = p2.owner_id AND p1.id < p2.id
    AND p1.deleted_at IS NULL AND p2.deleted_at IS NULL
    AND ABS(EXTRACT(EPOCH FROM (p1.created_at - p2.created_at))) < 300
    AND LOWER(TRIM(p1.ville)) = LOWER(TRIM(p2.ville)) AND p1.code_postal = p2.code_postal;

  RETURN QUERY
  SELECT
    ('fuzzy:' || p1.owner_id || ':' || p1.id || ':' || p2.id)::TEXT,
    2::BIGINT, ARRAY[p1.id, p2.id], ARRAY[p1.owner_id],
    LEAST(p1.created_at, p2.created_at), GREATEST(p1.created_at, p2.created_at), 'FUZZY (même CP+ville, type identique)'::TEXT
  FROM properties p1
  JOIN properties p2 ON p1.owner_id = p2.owner_id AND p1.id < p2.id
    AND p1.deleted_at IS NULL AND p2.deleted_at IS NULL
    AND p1.code_postal = p2.code_postal AND LOWER(TRIM(p1.ville)) = LOWER(TRIM(p2.ville))
    AND p1.type = p2.type AND p1.surface = p2.surface AND p1.nb_pieces = p2.nb_pieces
    AND LOWER(TRIM(p1.adresse_complete)) != LOWER(TRIM(p2.adresse_complete));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION audit_duplicate_profiles()
RETURNS TABLE(
  duplicate_key TEXT, nb_doublons BIGINT, ids UUID[], emails TEXT[],
  roles TEXT[], premier_cree TIMESTAMPTZ, dernier_cree TIMESTAMPTZ, match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT ('email:' || LOWER(TRIM(p.email)))::TEXT, COUNT(*)::BIGINT,
    ARRAY_AGG(p.id ORDER BY p.created_at ASC), ARRAY_AGG(DISTINCT p.email),
    ARRAY_AGG(DISTINCT p.role), MIN(p.created_at), MAX(p.created_at), 'EMAIL_EXACT'::TEXT
  FROM profiles p WHERE p.email IS NOT NULL AND TRIM(p.email) != ''
  GROUP BY LOWER(TRIM(p.email)) HAVING COUNT(*) > 1;

  RETURN QUERY
  SELECT ('identity:' || LOWER(TRIM(COALESCE(p.nom,''))) || ':' || LOWER(TRIM(COALESCE(p.prenom,''))) || ':' || COALESCE(p.date_naissance::TEXT,''))::TEXT,
    COUNT(*)::BIGINT, ARRAY_AGG(p.id ORDER BY p.created_at ASC), ARRAY_AGG(p.email),
    ARRAY_AGG(DISTINCT p.role), MIN(p.created_at), MAX(p.created_at), 'IDENTITY (nom+prénom+naissance)'::TEXT
  FROM profiles p WHERE p.nom IS NOT NULL AND p.prenom IS NOT NULL AND p.date_naissance IS NOT NULL AND TRIM(p.nom) != '' AND TRIM(p.prenom) != ''
  GROUP BY LOWER(TRIM(p.nom)), LOWER(TRIM(p.prenom)), p.date_naissance HAVING COUNT(*) > 1;

  RETURN QUERY
  SELECT ('user_id:' || p.user_id)::TEXT, COUNT(*)::BIGINT,
    ARRAY_AGG(p.id ORDER BY p.created_at ASC), ARRAY_AGG(p.email),
    ARRAY_AGG(DISTINCT p.role), MIN(p.created_at), MAX(p.created_at), 'CRITICAL: même user_id'::TEXT
  FROM profiles p GROUP BY p.user_id HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION audit_duplicate_leases()
RETURNS TABLE(
  duplicate_key TEXT, nb_doublons BIGINT, ids UUID[], statuts TEXT[],
  premier_cree TIMESTAMPTZ, dernier_cree TIMESTAMPTZ, match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT ('exact:' || l.property_id || ':' || l.date_debut)::TEXT, COUNT(*)::BIGINT,
    ARRAY_AGG(l.id ORDER BY l.created_at ASC), ARRAY_AGG(l.statut),
    MIN(l.created_at), MAX(l.created_at), 'EXACT (même property+date_debut)'::TEXT
  FROM leases l WHERE l.property_id IS NOT NULL AND l.statut NOT IN ('cancelled', 'archived')
  GROUP BY l.property_id, l.date_debut HAVING COUNT(*) > 1;

  RETURN QUERY
  SELECT ('temporal:' || l1.id || ':' || l2.id)::TEXT, 2::BIGINT,
    ARRAY[l1.id, l2.id], ARRAY[l1.statut, l2.statut],
    LEAST(l1.created_at, l2.created_at), GREATEST(l1.created_at, l2.created_at), 'TEMPORAL (même property, date +/-7j)'::TEXT
  FROM leases l1
  JOIN leases l2 ON l1.property_id = l2.property_id AND l1.id < l2.id AND l1.property_id IS NOT NULL
    AND l1.type_bail = l2.type_bail
    AND l1.statut NOT IN ('cancelled', 'archived') AND l2.statut NOT IN ('cancelled', 'archived')
    AND ABS(l1.date_debut - l2.date_debut) <= 7;

  RETURN QUERY
  SELECT ('overlap:' || l1.property_id || ':' || l1.id || ':' || l2.id)::TEXT, 2::BIGINT,
    ARRAY[l1.id, l2.id], ARRAY[l1.statut, l2.statut],
    LEAST(l1.created_at, l2.created_at), GREATEST(l1.created_at, l2.created_at), 'OVERLAP (baux actifs chevauchants)'::TEXT
  FROM leases l1
  JOIN leases l2 ON l1.property_id = l2.property_id AND l1.id < l2.id AND l1.property_id IS NOT NULL
    AND l1.statut IN ('active', 'pending_signature', 'fully_signed')
    AND l2.statut IN ('active', 'pending_signature', 'fully_signed')
    AND l1.date_debut <= COALESCE(l2.date_fin, '9999-12-31'::DATE)
    AND l2.date_debut <= COALESCE(l1.date_fin, '9999-12-31'::DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION audit_duplicate_documents()
RETURNS TABLE(
  duplicate_key TEXT, nb_doublons BIGINT, ids UUID[],
  premier_cree TIMESTAMPTZ, dernier_cree TIMESTAMPTZ, match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT ('storage:' || COALESCE(d.storage_path, d.url))::TEXT, COUNT(*)::BIGINT,
    ARRAY_AGG(d.id ORDER BY d.created_at ASC), MIN(d.created_at), MAX(d.created_at), 'STORAGE_PATH identique'::TEXT
  FROM documents d WHERE COALESCE(d.storage_path, d.url) IS NOT NULL
  GROUP BY COALESCE(d.storage_path, d.url) HAVING COUNT(*) > 1;

  RETURN QUERY
  SELECT ('temporal:' || d1.id || ':' || d2.id)::TEXT, 2::BIGINT,
    ARRAY[d1.id, d2.id], LEAST(d1.created_at, d2.created_at), GREATEST(d1.created_at, d2.created_at), 'TEMPORAL (<1min, même type+parent)'::TEXT
  FROM documents d1
  JOIN documents d2 ON d1.id < d2.id AND d1.type = d2.type
    AND COALESCE(d1.lease_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(d2.lease_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND COALESCE(d1.property_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(d2.property_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND ABS(EXTRACT(EPOCH FROM (d1.created_at - d2.created_at))) < 60;

  RETURN QUERY
  SELECT ('name:' || LOWER(TRIM(COALESCE(d.nom, d.nom_fichier, ''))) || ':' || COALESCE(d.lease_id::TEXT, d.property_id::TEXT, 'none'))::TEXT,
    COUNT(*)::BIGINT, ARRAY_AGG(d.id ORDER BY d.created_at ASC), MIN(d.created_at), MAX(d.created_at), 'NOM_FICHIER identique (même entité)'::TEXT
  FROM documents d WHERE COALESCE(d.nom, d.nom_fichier) IS NOT NULL AND TRIM(COALESCE(d.nom, d.nom_fichier, '')) != ''
  GROUP BY LOWER(TRIM(COALESCE(d.nom, d.nom_fichier, ''))), COALESCE(d.lease_id::TEXT, d.property_id::TEXT, 'none') HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION audit_duplicate_payments()
RETURNS TABLE(
  duplicate_key TEXT, nb_doublons BIGINT, ids UUID[], montants NUMERIC[],
  premier_cree TIMESTAMPTZ, dernier_cree TIMESTAMPTZ, match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT ('exact:' || py.invoice_id || ':' || py.montant)::TEXT, COUNT(*)::BIGINT,
    ARRAY_AGG(py.id ORDER BY py.created_at ASC), ARRAY_AGG(py.montant),
    MIN(py.created_at), MAX(py.created_at), 'EXACT (même invoice+montant)'::TEXT
  FROM payments py GROUP BY py.invoice_id, py.montant HAVING COUNT(*) > 1;

  RETURN QUERY
  SELECT ('temporal:' || p1.id || ':' || p2.id)::TEXT, 2::BIGINT,
    ARRAY[p1.id, p2.id], ARRAY[p1.montant, p2.montant],
    LEAST(p1.created_at, p2.created_at), GREATEST(p1.created_at, p2.created_at), 'TEMPORAL (<24h, même invoice+montant)'::TEXT
  FROM payments p1
  JOIN payments p2 ON p1.invoice_id = p2.invoice_id AND p1.id < p2.id AND p1.montant = p2.montant
    AND ABS(EXTRACT(EPOCH FROM (p1.created_at - p2.created_at))) < 86400;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION audit_duplicate_edl()
RETURNS TABLE(
  duplicate_key TEXT, nb_doublons BIGINT, ids UUID[], statuts TEXT[],
  premier_cree TIMESTAMPTZ, dernier_cree TIMESTAMPTZ, match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT ('exact:' || e.lease_id || ':' || e.type)::TEXT, COUNT(*)::BIGINT,
    ARRAY_AGG(e.id ORDER BY e.created_at ASC), ARRAY_AGG(e.status),
    MIN(e.created_at), MAX(e.created_at), 'EXACT (même bail+type)'::TEXT
  FROM edl e GROUP BY e.lease_id, e.type HAVING COUNT(*) > 1;

  RETURN QUERY
  SELECT ('temporal:' || e1.id || ':' || e2.id)::TEXT, 2::BIGINT,
    ARRAY[e1.id, e2.id], ARRAY[e1.status, e2.status],
    LEAST(e1.created_at, e2.created_at), GREATEST(e1.created_at, e2.created_at), 'TEMPORAL (<24h, même bail+type)'::TEXT
  FROM edl e1
  JOIN edl e2 ON e1.lease_id = e2.lease_id AND e1.type = e2.type AND e1.id < e2.id
    AND ABS(EXTRACT(EPOCH FROM (e1.created_at - e2.created_at))) < 86400;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION audit_duplicate_invoices()
RETURNS TABLE(
  duplicate_key TEXT, nb_doublons BIGINT, ids UUID[], montants NUMERIC[],
  statuts TEXT[], premier_cree TIMESTAMPTZ, dernier_cree TIMESTAMPTZ, match_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT ('exact:' || i.lease_id || ':' || i.periode)::TEXT, COUNT(*)::BIGINT,
    ARRAY_AGG(i.id ORDER BY i.created_at ASC), ARRAY_AGG(i.montant_total), ARRAY_AGG(i.statut),
    MIN(i.created_at), MAX(i.created_at), 'EXACT (même bail+période)'::TEXT
  FROM invoices i GROUP BY i.lease_id, i.periode HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION audit_all_duplicates_summary()
RETURNS TABLE(entity TEXT, match_type TEXT, duplicate_groups BIGINT, total_excess_records BIGINT, severity TEXT) AS $$
BEGIN
  RETURN QUERY SELECT 'properties'::TEXT, dp.match_type, COUNT(*)::BIGINT, SUM(dp.nb_doublons - 1)::BIGINT, 'HIGH'::TEXT FROM audit_duplicate_properties() dp GROUP BY dp.match_type;
  RETURN QUERY SELECT 'profiles'::TEXT, dp.match_type, COUNT(*)::BIGINT, SUM(dp.nb_doublons - 1)::BIGINT, CASE WHEN dp.match_type LIKE '%user_id%' THEN 'CRITICAL' ELSE 'HIGH' END::TEXT FROM audit_duplicate_profiles() dp GROUP BY dp.match_type;
  RETURN QUERY SELECT 'leases'::TEXT, dl.match_type, COUNT(*)::BIGINT, SUM(dl.nb_doublons - 1)::BIGINT, CASE WHEN dl.match_type LIKE '%OVERLAP%' THEN 'CRITICAL' ELSE 'HIGH' END::TEXT FROM audit_duplicate_leases() dl GROUP BY dl.match_type;
  RETURN QUERY SELECT 'documents'::TEXT, dd.match_type, COUNT(*)::BIGINT, SUM(dd.nb_doublons - 1)::BIGINT, 'MEDIUM'::TEXT FROM audit_duplicate_documents() dd GROUP BY dd.match_type;
  RETURN QUERY SELECT 'payments'::TEXT, dp.match_type, COUNT(*)::BIGINT, SUM(dp.nb_doublons - 1)::BIGINT, 'CRITICAL'::TEXT FROM audit_duplicate_payments() dp GROUP BY dp.match_type;
  RETURN QUERY SELECT 'edl'::TEXT, de.match_type, COUNT(*)::BIGINT, SUM(de.nb_doublons - 1)::BIGINT, 'MEDIUM'::TEXT FROM audit_duplicate_edl() de GROUP BY de.match_type;
  RETURN QUERY SELECT 'invoices'::TEXT, di.match_type, COUNT(*)::BIGINT, SUM(di.nb_doublons - 1)::BIGINT, 'CRITICAL'::TEXT FROM audit_duplicate_invoices() di GROUP BY di.match_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PHASE 4 : FONCTIONS DE FUSION SAFE (MERGE)
-- ============================================================================

CREATE OR REPLACE FUNCTION _count_non_null_fields(p_table TEXT, p_id UUID)
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  EXECUTE format(
    'SELECT COUNT(*) FROM (SELECT unnest(ARRAY[%s]) AS val) sub WHERE val IS NOT NULL',
    (SELECT string_agg(quote_ident(column_name) || '::TEXT', ', ')
     FROM information_schema.columns WHERE table_schema = 'public' AND table_name = p_table)
  ) USING p_id INTO v_count;
  RETURN v_count;
EXCEPTION WHEN OTHERS THEN RETURN 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION merge_duplicate_properties(p_master_id UUID, p_duplicate_id UUID, p_dry_run BOOLEAN DEFAULT TRUE)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE v_count INTEGER;
BEGIN
  IF p_master_id = p_duplicate_id THEN step := 'ERROR'; detail := 'master_id et duplicate_id sont identiques'; affected_rows := 0; RETURN NEXT; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_master_id) THEN step := 'ERROR'; detail := 'master_id introuvable'; affected_rows := 0; RETURN NEXT; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_duplicate_id) THEN step := 'ERROR'; detail := 'duplicate_id introuvable'; affected_rows := 0; RETURN NEXT; RETURN; END IF;

  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'properties', p_duplicate_id::TEXT, 'MERGE', to_jsonb(p), 'Fusion vers ' || p_master_id FROM properties p WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon dans _audit_cleanup_archive'; affected_rows := 1; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM leases WHERE property_id = p_duplicate_id;
  ELSE UPDATE leases SET property_id = p_master_id WHERE property_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'leases.property_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM units WHERE property_id = p_duplicate_id;
  ELSE UPDATE units SET property_id = p_master_id WHERE property_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'units.property_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM charges WHERE property_id = p_duplicate_id;
  ELSE UPDATE charges SET property_id = p_master_id WHERE property_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'charges.property_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM documents WHERE property_id = p_duplicate_id;
  ELSE UPDATE documents SET property_id = p_master_id WHERE property_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'documents.property_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM tickets WHERE property_id = p_duplicate_id;
  ELSE UPDATE tickets SET property_id = p_master_id WHERE property_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'tickets.property_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM photos WHERE property_id = p_duplicate_id;
  ELSE UPDATE photos SET property_id = p_master_id WHERE property_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'photos.property_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM visit_slots WHERE property_id = p_duplicate_id;
  ELSE UPDATE visit_slots SET property_id = p_master_id WHERE property_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'visit_slots.property_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM property_ownership WHERE property_id = p_duplicate_id;
  ELSE UPDATE property_ownership SET property_id = p_master_id WHERE property_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'property_ownership.property_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM conversations WHERE property_id = p_duplicate_id;
  ELSE UPDATE conversations SET property_id = p_master_id WHERE property_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'conversations.property_id'; affected_rows := v_count; RETURN NEXT;

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
    FROM properties dup WHERE properties.id = p_master_id AND dup.id = p_duplicate_id;
  END IF;
  step := '3.ENRICH'; detail := 'Champs manquants copiés vers master'; affected_rows := 1; RETURN NEXT;

  IF NOT p_dry_run THEN
    UPDATE properties SET deleted_at = NOW() WHERE id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO _audit_log (action, table_name, old_id, new_id, details) VALUES ('MERGE', 'properties', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion propriété doublon -> master');
  ELSE v_count := 1; END IF;
  step := '4.DELETE'; detail := 'Soft-delete du doublon (deleted_at = NOW())'; affected_rows := v_count; RETURN NEXT;

  step := 'DONE'; detail := CASE WHEN p_dry_run THEN 'DRY RUN terminé — aucune modification' ELSE 'Fusion exécutée' END; affected_rows := 0; RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION merge_duplicate_invoices(p_master_id UUID, p_duplicate_id UUID, p_dry_run BOOLEAN DEFAULT TRUE)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE v_count INTEGER;
BEGIN
  IF p_master_id = p_duplicate_id THEN step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0; RETURN NEXT; RETURN; END IF;

  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'invoices', p_duplicate_id::TEXT, 'MERGE', to_jsonb(i), 'Fusion vers ' || p_master_id FROM invoices i WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM payments WHERE invoice_id = p_duplicate_id;
  ELSE UPDATE payments SET invoice_id = p_master_id WHERE invoice_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'payments.invoice_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM payment_shares WHERE invoice_id = p_duplicate_id;
  ELSE UPDATE payment_shares SET invoice_id = p_master_id WHERE invoice_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'payment_shares.invoice_id'; affected_rows := v_count; RETURN NEXT;

  IF NOT p_dry_run THEN
    DELETE FROM invoices WHERE id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO _audit_log (action, table_name, old_id, new_id, details) VALUES ('MERGE', 'invoices', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion facture doublon');
  ELSE v_count := 1; END IF;
  step := '3.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count; RETURN NEXT;

  step := 'DONE'; detail := CASE WHEN p_dry_run THEN 'DRY RUN' ELSE 'Fusion exécutée' END; affected_rows := 0; RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION merge_duplicate_documents(p_master_id UUID, p_duplicate_id UUID, p_dry_run BOOLEAN DEFAULT TRUE)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE v_count INTEGER;
BEGIN
  IF p_master_id = p_duplicate_id THEN step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0; RETURN NEXT; RETURN; END IF;

  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'documents', p_duplicate_id::TEXT, 'MERGE', to_jsonb(d), 'Fusion vers ' || p_master_id FROM documents d WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM documents WHERE replaced_by = p_duplicate_id;
  ELSE UPDATE documents SET replaced_by = p_master_id WHERE replaced_by = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'documents.replaced_by'; affected_rows := v_count; RETURN NEXT;

  IF NOT p_dry_run THEN
    UPDATE documents SET
      storage_path = COALESCE(documents.storage_path, dup.storage_path), url = COALESCE(documents.url, dup.url),
      mime_type = COALESCE(documents.mime_type, dup.mime_type), size = COALESCE(documents.size, dup.size),
      preview_url = COALESCE(documents.preview_url, dup.preview_url)
    FROM documents dup WHERE documents.id = p_master_id AND dup.id = p_duplicate_id;
  END IF;
  step := '3.ENRICH'; detail := 'Champs manquants copiés'; affected_rows := 1; RETURN NEXT;

  IF NOT p_dry_run THEN
    DELETE FROM documents WHERE id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO _audit_log (action, table_name, old_id, new_id, details) VALUES ('MERGE', 'documents', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion document doublon');
  ELSE v_count := 1; END IF;
  step := '4.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count; RETURN NEXT;

  step := 'DONE'; detail := CASE WHEN p_dry_run THEN 'DRY RUN' ELSE 'Fusion exécutée' END; affected_rows := 0; RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION merge_duplicate_edl(p_master_id UUID, p_duplicate_id UUID, p_dry_run BOOLEAN DEFAULT TRUE)
RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
DECLARE v_count INTEGER;
BEGIN
  IF p_master_id = p_duplicate_id THEN step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0; RETURN NEXT; RETURN; END IF;

  IF NOT p_dry_run THEN
    INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
    SELECT gen_random_uuid(), 'edl', p_duplicate_id::TEXT, 'MERGE', to_jsonb(e), 'Fusion vers ' || p_master_id FROM edl e WHERE id = p_duplicate_id;
  END IF;
  step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM edl_items WHERE edl_id = p_duplicate_id;
  ELSE UPDATE edl_items SET edl_id = p_master_id WHERE edl_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'edl_items.edl_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM edl_media WHERE edl_id = p_duplicate_id;
  ELSE UPDATE edl_media SET edl_id = p_master_id WHERE edl_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'edl_media.edl_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM edl_signatures WHERE edl_id = p_duplicate_id;
  ELSE UPDATE edl_signatures SET edl_id = p_master_id WHERE edl_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'edl_signatures.edl_id'; affected_rows := v_count; RETURN NEXT;

  IF p_dry_run THEN SELECT COUNT(*) INTO v_count FROM edl_meter_readings WHERE edl_id = p_duplicate_id;
  ELSE UPDATE edl_meter_readings SET edl_id = p_master_id WHERE edl_id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT; END IF;
  step := '2.TRANSFER'; detail := 'edl_meter_readings.edl_id'; affected_rows := v_count; RETURN NEXT;

  IF NOT p_dry_run THEN
    DELETE FROM edl WHERE id = p_duplicate_id; GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO _audit_log (action, table_name, old_id, new_id, details) VALUES ('MERGE', 'edl', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion EDL doublon');
  ELSE v_count := 1; END IF;
  step := '3.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count; RETURN NEXT;

  step := 'DONE'; detail := CASE WHEN p_dry_run THEN 'DRY RUN' ELSE 'Fusion exécutée' END; affected_rows := 0; RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PHASE 5 : PRÉVENTION — FK, UNIQUE, TRIGGERS
-- ============================================================================

-- 5.1 FK Formelles manquantes

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_leases_tenant_id' AND table_name = 'leases') THEN
    UPDATE leases SET tenant_id = NULL WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = leases.tenant_id);
    ALTER TABLE leases ADD CONSTRAINT fk_leases_tenant_id FOREIGN KEY (tenant_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_leases_owner_id' AND table_name = 'leases') THEN
    UPDATE leases SET owner_id = NULL WHERE owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = leases.owner_id);
    ALTER TABLE leases ADD CONSTRAINT fk_leases_owner_id FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_tickets_assigned_provider_id' AND table_name = 'tickets') THEN
    UPDATE tickets SET assigned_provider_id = NULL WHERE assigned_provider_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = tickets.assigned_provider_id);
    ALTER TABLE tickets ADD CONSTRAINT fk_tickets_assigned_provider_id FOREIGN KEY (assigned_provider_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_tickets_owner_id' AND table_name = 'tickets') THEN
    UPDATE tickets SET owner_id = NULL WHERE owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = tickets.owner_id);
    ALTER TABLE tickets ADD CONSTRAINT fk_tickets_owner_id FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_documents_profile_id' AND table_name = 'documents') THEN
    UPDATE documents SET profile_id = NULL WHERE profile_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = documents.profile_id);
    ALTER TABLE documents ADD CONSTRAINT fk_documents_profile_id FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_building_units_current_lease_id' AND table_name = 'building_units') THEN
    UPDATE building_units SET current_lease_id = NULL WHERE current_lease_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leases WHERE id = building_units.current_lease_id);
    ALTER TABLE building_units ADD CONSTRAINT fk_building_units_current_lease_id FOREIGN KEY (current_lease_id) REFERENCES leases(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_work_orders_quote_id' AND table_name = 'work_orders') THEN
    UPDATE work_orders SET quote_id = NULL WHERE quote_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quotes WHERE id = work_orders.quote_id);
    ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_quote_id FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_work_orders_property_id' AND table_name = 'work_orders') THEN
    UPDATE work_orders SET property_id = NULL WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties WHERE id = work_orders.property_id);
    ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5.2 Contraintes UNIQUE

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_lease_periode') THEN
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY lease_id, periode ORDER BY CASE WHEN statut = 'paid' THEN 0 ELSE 1 END, created_at ASC) AS rn
      FROM invoices
    ) DELETE FROM invoices WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    ALTER TABLE invoices ADD CONSTRAINT uq_invoices_lease_periode UNIQUE (lease_id, periode);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_lease_signers_lease_profile') THEN
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY lease_id, profile_id ORDER BY CASE WHEN signature_status = 'signed' THEN 0 ELSE 1 END, created_at ASC) AS rn
      FROM lease_signers WHERE profile_id IS NOT NULL
    ) DELETE FROM lease_signers WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_lease_signers_lease_profile ON lease_signers (lease_id, profile_id) WHERE profile_id IS NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_edl_lease_type_active') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_edl_lease_type_active ON edl (lease_id, type) WHERE status NOT IN ('cancelled', 'disputed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_roommates_lease_profile') THEN
    WITH ranked AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY lease_id, profile_id ORDER BY created_at ASC) AS rn FROM roommates)
    DELETE FROM roommates WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_roommates_lease_profile ON roommates (lease_id, profile_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_subscriptions_user_active') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user_active ON subscriptions (user_id) WHERE status IN ('active', 'trialing');
  END IF;
END $$;

-- 5.3 Triggers anti-doublon

CREATE OR REPLACE FUNCTION prevent_duplicate_property()
RETURNS TRIGGER AS $$
DECLARE v_existing_id UUID;
BEGIN
  SELECT id INTO v_existing_id FROM properties
  WHERE owner_id = NEW.owner_id AND LOWER(TRIM(adresse_complete)) = LOWER(TRIM(NEW.adresse_complete))
    AND code_postal = NEW.code_postal AND deleted_at IS NULL
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Propriété en doublon détectée (id: %). Même adresse et code postal pour ce propriétaire.', v_existing_id
      USING HINT = 'Vérifiez si cette propriété existe déjà avant d''en créer une nouvelle.', ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_property ON properties;
CREATE TRIGGER trg_prevent_duplicate_property BEFORE INSERT ON properties FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_property();

CREATE OR REPLACE FUNCTION prevent_duplicate_payment()
RETURNS TRIGGER AS $$
DECLARE v_existing_id UUID;
BEGIN
  SELECT id INTO v_existing_id FROM payments
  WHERE invoice_id = NEW.invoice_id AND montant = NEW.montant
    AND ABS(EXTRACT(EPOCH FROM (created_at - NOW()))) < 86400
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RAISE WARNING 'Paiement potentiellement en doublon (id existant: %). Même montant + même facture en < 24h.', v_existing_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_payment ON payments;
CREATE TRIGGER trg_prevent_duplicate_payment BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_payment();


-- ============================================================================
-- FIN — CONFIRMATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  AUDIT D''INTÉGRITÉ TALOK — INSTALLATION COMPLÈTE              ║';
  RAISE NOTICE '╠══════════════════════════════════════════════════════════════════╣';
  RAISE NOTICE '║                                                                ║';
  RAISE NOTICE '║  Phase 1 : audit_orphan_records() ........... 65 checks       ║';
  RAISE NOTICE '║  Phase 2 : audit_duplicate_records() ........ 16 checks       ║';
  RAISE NOTICE '║  Phase 3 : 7 fonctions doublons avancés               ║';
  RAISE NOTICE '║  Phase 4 : 4 fonctions merge SAFE                     ║';
  RAISE NOTICE '║  Phase 5 : 8 FK + 5 UNIQUE + 2 triggers              ║';
  RAISE NOTICE '║                                                                ║';
  RAISE NOTICE '║  COMMANDES RAPIDES :                                           ║';
  RAISE NOTICE '║  SELECT * FROM audit_orphan_records() WHERE orphan_count > 0;  ║';
  RAISE NOTICE '║  SELECT * FROM audit_all_duplicates_summary();                 ║';
  RAISE NOTICE '║  SELECT * FROM safe_cleanup_orphans(true); -- DRY RUN          ║';
  RAISE NOTICE '║  SELECT * FROM audit_integrity_dashboard;                      ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════════╝';
END $$;
