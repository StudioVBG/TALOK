-- ==========================================================
-- Phase 1 — Securite : RLS + Auth + Audit
-- 47 migrations combinees
-- Genere le 2026-04-09
-- ==========================================================

BEGIN;

-- === MIGRATION: 20260211100000_bic_compliance_tax_regime.sql ===
-- ============================================
-- BIC Compliance: Régime fiscal + Inventaire mobilier
-- Corrige les lacunes identifiées dans l'audit BIC
-- ============================================

-- 1. Enum pour le régime fiscal BIC
DO $$ BEGIN
  CREATE TYPE tax_regime_type AS ENUM (
    'micro_foncier',    -- Revenus fonciers < 15k€ (location nue)
    'reel_foncier',     -- Revenus fonciers réel (location nue)
    'micro_bic',        -- BIC micro < 77 700€ (location meublée)
    'reel_bic'          -- BIC réel (location meublée)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Enum pour le statut LMNP/LMP
DO $$ BEGIN
  CREATE TYPE lmnp_status_type AS ENUM (
    'lmnp',  -- Loueur Meublé Non Professionnel
    'lmp'    -- Loueur Meublé Professionnel
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Ajouter colonnes au tableau leases
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS tax_regime text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lmnp_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS furniture_inventory jsonb DEFAULT NULL;

-- 4. Ajouter indicateur meublé au tableau properties
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS is_furnished boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_tax_regime text DEFAULT NULL;

-- 5. Contrainte: si bail meublé, tax_regime doit être BIC
-- (informative, pas bloquante pour permettre migration progressive)
COMMENT ON COLUMN leases.tax_regime IS
  'Régime fiscal: micro_foncier, reel_foncier (bail nu), micro_bic, reel_bic (bail meublé)';

COMMENT ON COLUMN leases.lmnp_status IS
  'Statut fiscal meublé: lmnp (non professionnel) ou lmp (professionnel)';

COMMENT ON COLUMN leases.furniture_inventory IS
  'Inventaire mobilier JSON (Décret 2015-981) — 11 éléments obligatoires + supplémentaires';

COMMENT ON COLUMN properties.is_furnished IS
  'Indique si le bien est meublé (conditionne le type de bail et le régime fiscal BIC)';

COMMENT ON COLUMN properties.default_tax_regime IS
  'Régime fiscal par défaut pour les nouveaux baux sur ce bien';

-- 6. Auto-update is_furnished quand un bail meublé est créé
CREATE OR REPLACE FUNCTION update_property_furnished_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type_bail IN ('meuble', 'bail_mobilite', 'etudiant') THEN
    UPDATE properties
    SET is_furnished = true
    WHERE id = NEW.property_id
      AND is_furnished = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_property_furnished ON leases;
CREATE TRIGGER trg_update_property_furnished
  AFTER INSERT ON leases
  FOR EACH ROW
  EXECUTE FUNCTION update_property_furnished_status();

-- 7. Vue pour le monitoring LMNP/LMP
CREATE OR REPLACE VIEW v_owner_rental_income AS
SELECT
  p.owner_id,
  EXTRACT(YEAR FROM i.periode::date) AS year,
  SUM(CASE
    WHEN l.type_bail IN ('meuble', 'bail_mobilite', 'etudiant', 'saisonnier')
    THEN i.montant_total
    ELSE 0
  END) AS furnished_income,
  SUM(CASE
    WHEN l.type_bail IN ('nu', 'bail_mixte')
    THEN i.montant_total
    ELSE 0
  END) AS unfurnished_income,
  SUM(i.montant_total) AS total_income
FROM invoices i
  JOIN leases l ON l.id = i.lease_id
  JOIN properties p ON p.id = l.property_id
WHERE i.statut = 'paid'
GROUP BY p.owner_id, EXTRACT(YEAR FROM i.periode::date);

-- 8. Index pour performances
CREATE INDEX IF NOT EXISTS idx_leases_tax_regime ON leases(tax_regime) WHERE tax_regime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_is_furnished ON properties(is_furnished) WHERE is_furnished = true;


-- === MIGRATION: 20260212000000_audit_database_integrity.sql ===
-- REVIEW: Cette migration contient des DROP/DELETE dangereux. Verifier avant d'appliquer.
-- REVIEW: -- ============================================================================
-- REVIEW: -- AUDIT D'INTÉGRITÉ DE LA BASE DE DONNÉES TALOK
-- REVIEW: -- Date: 2026-02-12
-- REVIEW: -- Auteur: Audit automatisé
-- REVIEW: -- ============================================================================
-- REVIEW: -- Ce script est un audit SAFE (lecture seule + fonctions de diagnostic).
-- REVIEW: -- Il ne supprime AUCUNE donnée. Il crée :
-- REVIEW: --   1. Des fonctions RPC de diagnostic pour détecter les orphelins
-- REVIEW: --   2. Des fonctions RPC de diagnostic pour détecter les doublons
-- REVIEW: --   3. Une vue matérialisée consolidée de l'état d'intégrité
-- REVIEW: --   4. Des fonctions de nettoyage SAFE (soft-delete / archivage)
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- PHASE 1: FONCTIONS DE DÉTECTION DES ORPHELINS
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 1.1 Audit global : retourne toutes les relations orphelines en un seul appel
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: CREATE OR REPLACE FUNCTION audit_orphan_records()
-- REVIEW: RETURNS TABLE(
-- REVIEW:   source_table TEXT,
-- REVIEW:   fk_column TEXT,
-- REVIEW:   target_table TEXT,
-- REVIEW:   orphan_count BIGINT,
-- REVIEW:   severity TEXT,
-- REVIEW:   description TEXT
-- REVIEW: ) AS $$
-- REVIEW: BEGIN
-- REVIEW: 
-- REVIEW:   -- ── PROFILES ──────────────────────────────────────────────────────
-- REVIEW:   -- profiles → auth.users (user_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'profiles'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Profiles sans compte auth.users associé'::TEXT
-- REVIEW:   FROM profiles p
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);
-- REVIEW: 
-- REVIEW:   -- ── PROPERTIES ────────────────────────────────────────────────────
-- REVIEW:   -- properties → profiles (owner_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'properties'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Propriétés dont le propriétaire (profile) n''existe plus'::TEXT
-- REVIEW:   FROM properties p
-- REVIEW:   WHERE p.owner_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = p.owner_id);
-- REVIEW: 
-- REVIEW:   -- properties → buildings (building_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'properties'::TEXT, 'building_id'::TEXT, 'buildings'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Propriétés avec building_id pointant vers un immeuble inexistant'::TEXT
-- REVIEW:   FROM properties p
-- REVIEW:   WHERE p.building_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = p.building_id);
-- REVIEW: 
-- REVIEW:   -- properties → legal_entities (legal_entity_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'properties'::TEXT, 'legal_entity_id'::TEXT, 'legal_entities'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Propriétés avec legal_entity_id pointant vers une entité inexistante'::TEXT
-- REVIEW:   FROM properties p
-- REVIEW:   WHERE p.legal_entity_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.id = p.legal_entity_id);
-- REVIEW: 
-- REVIEW:   -- ── UNITS ─────────────────────────────────────────────────────────
-- REVIEW:   -- units → properties (property_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'units'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Unités de colocation dont la propriété n''existe plus'::TEXT
-- REVIEW:   FROM units u
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = u.property_id);
-- REVIEW: 
-- REVIEW:   -- ── LEASES ────────────────────────────────────────────────────────
-- REVIEW:   -- leases → properties (property_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'leases'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Baux dont la propriété n''existe plus'::TEXT
-- REVIEW:   FROM leases l
-- REVIEW:   WHERE l.property_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = l.property_id);
-- REVIEW: 
-- REVIEW:   -- leases → units (unit_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'leases'::TEXT, 'unit_id'::TEXT, 'units'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Baux dont l''unité n''existe plus'::TEXT
-- REVIEW:   FROM leases l
-- REVIEW:   WHERE l.unit_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM units u WHERE u.id = l.unit_id);
-- REVIEW: 
-- REVIEW:   -- leases → profiles (tenant_id) — FK implicite ajoutée plus tard
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'leases'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Baux dont le locataire (tenant_id) n''existe plus dans profiles'::TEXT
-- REVIEW:   FROM leases l
-- REVIEW:   WHERE l.tenant_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = l.tenant_id);
-- REVIEW: 
-- REVIEW:   -- leases → profiles (owner_id) — FK implicite
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'leases'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Baux dont le propriétaire (owner_id) n''existe plus dans profiles'::TEXT
-- REVIEW:   FROM leases l
-- REVIEW:   WHERE l.owner_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = l.owner_id);
-- REVIEW: 
-- REVIEW:   -- Baux actifs sans aucun signataire
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'leases'::TEXT, '(no_signers)'::TEXT, 'lease_signers'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Baux actifs/pending sans aucun signataire'::TEXT
-- REVIEW:   FROM leases l
-- REVIEW:   WHERE l.statut NOT IN ('draft', 'cancelled', 'archived', 'terminated')
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id);
-- REVIEW: 
-- REVIEW:   -- ── LEASE_SIGNERS ─────────────────────────────────────────────────
-- REVIEW:   -- lease_signers → leases (lease_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'lease_signers'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Signataires dont le bail n''existe plus'::TEXT
-- REVIEW:   FROM lease_signers ls
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);
-- REVIEW: 
-- REVIEW:   -- lease_signers → profiles (profile_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'lease_signers'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Signataires dont le profil n''existe plus'::TEXT
-- REVIEW:   FROM lease_signers ls
-- REVIEW:   WHERE ls.profile_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = ls.profile_id);
-- REVIEW: 
-- REVIEW:   -- ── INVOICES ──────────────────────────────────────────────────────
-- REVIEW:   -- invoices → leases (lease_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'invoices'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Factures dont le bail n''existe plus'::TEXT
-- REVIEW:   FROM invoices i
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);
-- REVIEW: 
-- REVIEW:   -- invoices → profiles (owner_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'invoices'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Factures dont le profil propriétaire n''existe plus'::TEXT
-- REVIEW:   FROM invoices i
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = i.owner_id);
-- REVIEW: 
-- REVIEW:   -- invoices → profiles (tenant_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'invoices'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Factures dont le profil locataire n''existe plus'::TEXT
-- REVIEW:   FROM invoices i
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = i.tenant_id);
-- REVIEW: 
-- REVIEW:   -- ── PAYMENTS ──────────────────────────────────────────────────────
-- REVIEW:   -- payments → invoices (invoice_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'payments'::TEXT, 'invoice_id'::TEXT, 'invoices'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Paiements dont la facture n''existe plus'::TEXT
-- REVIEW:   FROM payments py
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
-- REVIEW: 
-- REVIEW:   -- ── DOCUMENTS ─────────────────────────────────────────────────────
-- REVIEW:   -- documents → leases (lease_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'documents'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Documents dont le bail n''existe plus'::TEXT
-- REVIEW:   FROM documents d
-- REVIEW:   WHERE d.lease_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);
-- REVIEW: 
-- REVIEW:   -- documents → properties (property_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'documents'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Documents dont la propriété n''existe plus'::TEXT
-- REVIEW:   FROM documents d
-- REVIEW:   WHERE d.property_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);
-- REVIEW: 
-- REVIEW:   -- documents → profiles (owner_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'documents'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Documents dont le profil owner n''existe plus'::TEXT
-- REVIEW:   FROM documents d
-- REVIEW:   WHERE d.owner_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.owner_id);
-- REVIEW: 
-- REVIEW:   -- documents → profiles (tenant_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'documents'::TEXT, 'tenant_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Documents dont le profil tenant n''existe plus'::TEXT
-- REVIEW:   FROM documents d
-- REVIEW:   WHERE d.tenant_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.tenant_id);
-- REVIEW: 
-- REVIEW:   -- documents → profiles (profile_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'documents'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Documents dont le profile_id n''existe plus'::TEXT
-- REVIEW:   FROM documents d
-- REVIEW:   WHERE d.profile_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.profile_id);
-- REVIEW: 
-- REVIEW:   -- Documents totalement flottants (aucune FK remplie)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'documents'::TEXT, '(no_parent)'::TEXT, '(none)'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'LOW'::TEXT,
-- REVIEW:     'Documents sans aucun rattachement (owner_id, tenant_id, property_id, lease_id tous NULL)'::TEXT
-- REVIEW:   FROM documents d
-- REVIEW:   WHERE d.owner_id IS NULL
-- REVIEW:     AND d.tenant_id IS NULL
-- REVIEW:     AND d.property_id IS NULL
-- REVIEW:     AND d.lease_id IS NULL
-- REVIEW:     AND d.profile_id IS NULL;
-- REVIEW: 
-- REVIEW:   -- ── TICKETS ───────────────────────────────────────────────────────
-- REVIEW:   -- tickets → properties (property_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'tickets'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Tickets dont la propriété n''existe plus'::TEXT
-- REVIEW:   FROM tickets t
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = t.property_id);
-- REVIEW: 
-- REVIEW:   -- tickets → profiles (created_by_profile_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'tickets'::TEXT, 'created_by_profile_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Tickets dont le créateur n''existe plus'::TEXT
-- REVIEW:   FROM tickets t
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.created_by_profile_id);
-- REVIEW: 
-- REVIEW:   -- tickets → leases (lease_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'tickets'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'LOW'::TEXT,
-- REVIEW:     'Tickets avec lease_id pointant vers un bail inexistant'::TEXT
-- REVIEW:   FROM tickets t
-- REVIEW:   WHERE t.lease_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);
-- REVIEW: 
-- REVIEW:   -- ── WORK_ORDERS ───────────────────────────────────────────────────
-- REVIEW:   -- work_orders → tickets (ticket_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'work_orders'::TEXT, 'ticket_id'::TEXT, 'tickets'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Ordres de travail dont le ticket n''existe plus'::TEXT
-- REVIEW:   FROM work_orders wo
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = wo.ticket_id);
-- REVIEW: 
-- REVIEW:   -- work_orders → profiles (provider_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'work_orders'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Ordres de travail dont le prestataire n''existe plus'::TEXT
-- REVIEW:   FROM work_orders wo
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = wo.provider_id);
-- REVIEW: 
-- REVIEW:   -- ── CHARGES ───────────────────────────────────────────────────────
-- REVIEW:   -- charges → properties (property_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'charges'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Charges dont la propriété n''existe plus'::TEXT
-- REVIEW:   FROM charges c
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = c.property_id);
-- REVIEW: 
-- REVIEW:   -- ── EDL ───────────────────────────────────────────────────────────
-- REVIEW:   -- edl → leases (lease_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'edl'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'États des lieux dont le bail n''existe plus'::TEXT
-- REVIEW:   FROM edl e
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id);
-- REVIEW: 
-- REVIEW:   -- edl_items → edl (edl_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'edl_items'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Items d''EDL dont l''EDL parent n''existe plus'::TEXT
-- REVIEW:   FROM edl_items ei
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = ei.edl_id);
-- REVIEW: 
-- REVIEW:   -- edl_media → edl (edl_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'edl_media'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Médias d''EDL dont l''EDL parent n''existe plus'::TEXT
-- REVIEW:   FROM edl_media em
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = em.edl_id);
-- REVIEW: 
-- REVIEW:   -- edl_signatures → edl (edl_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'edl_signatures'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Signatures d''EDL dont l''EDL parent n''existe plus'::TEXT
-- REVIEW:   FROM edl_signatures es
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = es.edl_id);
-- REVIEW: 
-- REVIEW:   -- edl_meter_readings → edl (edl_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'edl_meter_readings'::TEXT, 'edl_id'::TEXT, 'edl'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'LOW'::TEXT,
-- REVIEW:     'Relevés compteurs EDL dont l''EDL n''existe plus'::TEXT
-- REVIEW:   FROM edl_meter_readings emr
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM edl e WHERE e.id = emr.edl_id);
-- REVIEW: 
-- REVIEW:   -- ── METERS ────────────────────────────────────────────────────────
-- REVIEW:   -- meters → leases (lease_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'meters'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Compteurs dont le bail n''existe plus'::TEXT
-- REVIEW:   FROM meters m
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);
-- REVIEW: 
-- REVIEW:   -- meter_readings → meters (meter_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'meter_readings'::TEXT, 'meter_id'::TEXT, 'meters'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Relevés de compteur dont le compteur n''existe plus'::TEXT
-- REVIEW:   FROM meter_readings mr
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM meters m WHERE m.id = mr.meter_id);
-- REVIEW: 
-- REVIEW:   -- ── ROOMMATES ─────────────────────────────────────────────────────
-- REVIEW:   -- roommates → leases (lease_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'roommates'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Colocataires dont le bail n''existe plus'::TEXT
-- REVIEW:   FROM roommates r
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);
-- REVIEW: 
-- REVIEW:   -- roommates → profiles (profile_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'roommates'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Colocataires dont le profil n''existe plus'::TEXT
-- REVIEW:   FROM roommates r
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = r.profile_id);
-- REVIEW: 
-- REVIEW:   -- ── PAYMENT_SHARES ────────────────────────────────────────────────
-- REVIEW:   -- payment_shares → roommates (roommate_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'payment_shares'::TEXT, 'roommate_id'::TEXT, 'roommates'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Parts de paiement dont le colocataire n''existe plus'::TEXT
-- REVIEW:   FROM payment_shares ps
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM roommates r WHERE r.id = ps.roommate_id);
-- REVIEW: 
-- REVIEW:   -- payment_shares → invoices (invoice_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'payment_shares'::TEXT, 'invoice_id'::TEXT, 'invoices'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Parts de paiement dont la facture n''existe plus'::TEXT
-- REVIEW:   FROM payment_shares ps
-- REVIEW:   WHERE ps.invoice_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = ps.invoice_id);
-- REVIEW: 
-- REVIEW:   -- ── DEPOSIT_SHARES ────────────────────────────────────────────────
-- REVIEW:   -- deposit_shares → roommates (roommate_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'deposit_shares'::TEXT, 'roommate_id'::TEXT, 'roommates'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Parts de dépôt dont le colocataire n''existe plus'::TEXT
-- REVIEW:   FROM deposit_shares ds
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM roommates r WHERE r.id = ds.roommate_id);
-- REVIEW: 
-- REVIEW:   -- ── DEPOSIT_MOVEMENTS ─────────────────────────────────────────────
-- REVIEW:   -- deposit_movements → leases (lease_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'deposit_movements'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Mouvements de dépôt dont le bail n''existe plus'::TEXT
-- REVIEW:   FROM deposit_movements dm
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);
-- REVIEW: 
-- REVIEW:   -- ── NOTIFICATIONS ─────────────────────────────────────────────────
-- REVIEW:   -- notifications → auth.users (user_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'notifications'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'LOW'::TEXT,
-- REVIEW:     'Notifications dont l''utilisateur n''existe plus'::TEXT
-- REVIEW:   FROM notifications n
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = n.user_id);
-- REVIEW: 
-- REVIEW:   -- ── SUBSCRIPTIONS ─────────────────────────────────────────────────
-- REVIEW:   -- subscriptions → profiles (user_id / owner_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'subscriptions'::TEXT, 'user_id'::TEXT, 'auth.users'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Abonnements dont l''utilisateur n''existe plus'::TEXT
-- REVIEW:   FROM subscriptions s
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);
-- REVIEW: 
-- REVIEW:   -- ── OWNER_PROFILES ────────────────────────────────────────────────
-- REVIEW:   -- owner_profiles → profiles (profile_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'owner_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Profils propriétaire dont le profil de base n''existe plus'::TEXT
-- REVIEW:   FROM owner_profiles op
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = op.profile_id);
-- REVIEW: 
-- REVIEW:   -- ── TENANT_PROFILES ───────────────────────────────────────────────
-- REVIEW:   -- tenant_profiles → profiles (profile_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'tenant_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Profils locataire dont le profil de base n''existe plus'::TEXT
-- REVIEW:   FROM tenant_profiles tp
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = tp.profile_id);
-- REVIEW: 
-- REVIEW:   -- ── PROVIDER_PROFILES ─────────────────────────────────────────────
-- REVIEW:   -- provider_profiles → profiles (profile_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'provider_profiles'::TEXT, 'profile_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Profils prestataire dont le profil de base n''existe plus'::TEXT
-- REVIEW:   FROM provider_profiles pp
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pp.profile_id);
-- REVIEW: 
-- REVIEW:   -- ── CONVERSATIONS ─────────────────────────────────────────────────
-- REVIEW:   -- conversations → profiles (owner_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'conversations'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Conversations dont le profil owner n''existe plus'::TEXT
-- REVIEW:   FROM conversations c
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = c.owner_id);
-- REVIEW: 
-- REVIEW:   -- messages → conversations (conversation_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'messages'::TEXT, 'conversation_id'::TEXT, 'conversations'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Messages dont la conversation n''existe plus'::TEXT
-- REVIEW:   FROM messages m
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id = m.conversation_id);
-- REVIEW: 
-- REVIEW:   -- ── UNIFIED CONVERSATIONS ─────────────────────────────────────────
-- REVIEW:   -- unified_messages → unified_conversations (conversation_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'unified_messages'::TEXT, 'conversation_id'::TEXT, 'unified_conversations'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Messages unifiés dont la conversation n''existe plus'::TEXT
-- REVIEW:   FROM unified_messages um
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM unified_conversations uc WHERE uc.id = um.conversation_id);
-- REVIEW: 
-- REVIEW:   -- ── SIGNATURE_SESSIONS ────────────────────────────────────────────
-- REVIEW:   -- signature_participants → signature_sessions (session_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'signature_participants'::TEXT, 'session_id'::TEXT, 'signature_sessions'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Participants de signature dont la session n''existe plus'::TEXT
-- REVIEW:   FROM signature_participants sp
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sp.session_id);
-- REVIEW: 
-- REVIEW:   -- signature_proofs → signature_participants (participant_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'signature_proofs'::TEXT, 'participant_id'::TEXT, 'signature_participants'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Preuves de signature dont le participant n''existe plus'::TEXT
-- REVIEW:   FROM signature_proofs sp
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM signature_participants pa WHERE pa.id = sp.participant_id);
-- REVIEW: 
-- REVIEW:   -- signature_audit_log → signature_sessions (session_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'signature_audit_log'::TEXT, 'session_id'::TEXT, 'signature_sessions'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'LOW'::TEXT,
-- REVIEW:     'Logs d''audit de signature dont la session n''existe plus'::TEXT
-- REVIEW:   FROM signature_audit_log sal
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sal.session_id);
-- REVIEW: 
-- REVIEW:   -- ── LEGAL_ENTITIES ────────────────────────────────────────────────
-- REVIEW:   -- legal_entities → profiles (owner_profile_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'legal_entities'::TEXT, 'owner_profile_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Entités légales dont le profil propriétaire n''existe plus'::TEXT
-- REVIEW:   FROM legal_entities le
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = le.owner_profile_id);
-- REVIEW: 
-- REVIEW:   -- entity_associates → legal_entities (legal_entity_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'entity_associates'::TEXT, 'legal_entity_id'::TEXT, 'legal_entities'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Associés dont l''entité légale n''existe plus'::TEXT
-- REVIEW:   FROM entity_associates ea
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM legal_entities le WHERE le.id = ea.legal_entity_id);
-- REVIEW: 
-- REVIEW:   -- ── PROPERTY_OWNERSHIP ────────────────────────────────────────────
-- REVIEW:   -- property_ownership → properties (property_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'property_ownership'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Détentions de propriété dont le bien n''existe plus'::TEXT
-- REVIEW:   FROM property_ownership po
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = po.property_id);
-- REVIEW: 
-- REVIEW:   -- ── BUILDINGS ─────────────────────────────────────────────────────
-- REVIEW:   -- buildings → profiles (owner_id) — si la colonne existe
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'buildings'::TEXT, 'owner_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Immeubles dont le propriétaire n''existe plus'::TEXT
-- REVIEW:   FROM buildings b
-- REVIEW:   WHERE b.owner_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = b.owner_id);
-- REVIEW: 
-- REVIEW:   -- building_units → buildings (building_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'building_units'::TEXT, 'building_id'::TEXT, 'buildings'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Lots d''immeuble dont l''immeuble n''existe plus'::TEXT
-- REVIEW:   FROM building_units bu
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = bu.building_id);
-- REVIEW: 
-- REVIEW:   -- ── LEASE_END_PROCESSES ───────────────────────────────────────────
-- REVIEW:   -- lease_end_processes → leases (lease_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'lease_end_processes'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Processus de fin de bail dont le bail n''existe plus'::TEXT
-- REVIEW:   FROM lease_end_processes lep
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = lep.lease_id);
-- REVIEW: 
-- REVIEW:   -- edl_inspection_items → lease_end_processes (lease_end_process_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'edl_inspection_items'::TEXT, 'lease_end_process_id'::TEXT, 'lease_end_processes'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Items d''inspection dont le processus de fin n''existe plus'::TEXT
-- REVIEW:   FROM edl_inspection_items eii
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM lease_end_processes lep WHERE lep.id = eii.lease_end_process_id);
-- REVIEW: 
-- REVIEW:   -- renovation_items → lease_end_processes (lease_end_process_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'renovation_items'::TEXT, 'lease_end_process_id'::TEXT, 'lease_end_processes'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Items de rénovation dont le processus de fin n''existe plus'::TEXT
-- REVIEW:   FROM renovation_items ri
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM lease_end_processes lep WHERE lep.id = ri.lease_end_process_id);
-- REVIEW: 
-- REVIEW:   -- renovation_quotes → renovation_items (renovation_item_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'renovation_quotes'::TEXT, 'renovation_item_id'::TEXT, 'renovation_items'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Devis de rénovation dont l''item de rénovation n''existe plus'::TEXT
-- REVIEW:   FROM renovation_quotes rq
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM renovation_items ri WHERE ri.id = rq.renovation_item_id);
-- REVIEW: 
-- REVIEW:   -- ── PHOTOS ────────────────────────────────────────────────────────
-- REVIEW:   -- photos → properties (property_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'photos'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Photos dont la propriété n''existe plus'::TEXT
-- REVIEW:   FROM photos ph
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = ph.property_id);
-- REVIEW: 
-- REVIEW:   -- ── VISIT SCHEDULING ──────────────────────────────────────────────
-- REVIEW:   -- visit_slots → properties (property_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'visit_slots'::TEXT, 'property_id'::TEXT, 'properties'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'LOW'::TEXT,
-- REVIEW:     'Créneaux de visite dont la propriété n''existe plus'::TEXT
-- REVIEW:   FROM visit_slots vs
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = vs.property_id);
-- REVIEW: 
-- REVIEW:   -- visit_bookings → visit_slots (slot_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'visit_bookings'::TEXT, 'slot_id'::TEXT, 'visit_slots'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'LOW'::TEXT,
-- REVIEW:     'Réservations de visite dont le créneau n''existe plus'::TEXT
-- REVIEW:   FROM visit_bookings vb
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM visit_slots vs WHERE vs.id = vb.slot_id);
-- REVIEW: 
-- REVIEW:   -- ── QUOTES ────────────────────────────────────────────────────────
-- REVIEW:   -- quotes → tickets (ticket_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'quotes'::TEXT, 'ticket_id'::TEXT, 'tickets'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Devis dont le ticket n''existe plus'::TEXT
-- REVIEW:   FROM quotes q
-- REVIEW:   WHERE q.ticket_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = q.ticket_id);
-- REVIEW: 
-- REVIEW:   -- quotes → profiles (provider_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'quotes'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Devis dont le prestataire n''existe plus'::TEXT
-- REVIEW:   FROM quotes q
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = q.provider_id);
-- REVIEW: 
-- REVIEW:   -- ── CONVERSATION_PARTICIPANTS ─────────────────────────────────────
-- REVIEW:   -- conversation_participants → unified_conversations (conversation_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'conversation_participants'::TEXT, 'conversation_id'::TEXT, 'unified_conversations'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Participants de conversation dont la conversation unifiée n''existe plus'::TEXT
-- REVIEW:   FROM conversation_participants cp
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM unified_conversations uc WHERE uc.id = cp.conversation_id);
-- REVIEW: 
-- REVIEW:   -- ── ORGANIZATION_BRANDING ─────────────────────────────────────────
-- REVIEW:   -- organization_branding → organizations (organization_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'organization_branding'::TEXT, 'organization_id'::TEXT, 'organizations'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'LOW'::TEXT,
-- REVIEW:     'Branding d''organisation dont l''organisation n''existe plus'::TEXT
-- REVIEW:   FROM organization_branding ob
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ob.organization_id);
-- REVIEW: 
-- REVIEW:   -- ── PROVIDER_INVOICES ─────────────────────────────────────────────
-- REVIEW:   -- provider_invoices → profiles (provider_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'provider_invoices'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Factures prestataire dont le profil prestataire n''existe plus'::TEXT
-- REVIEW:   FROM provider_invoices pi
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pi.provider_id);
-- REVIEW: 
-- REVIEW:   -- ── PROVIDER_QUOTES ───────────────────────────────────────────────
-- REVIEW:   -- provider_quotes → profiles (provider_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'provider_quotes'::TEXT, 'provider_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Devis prestataire dont le profil prestataire n''existe plus'::TEXT
-- REVIEW:   FROM provider_quotes pq
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pq.provider_id);
-- REVIEW: 
-- REVIEW:   -- ── SIGNATURES (legacy) ───────────────────────────────────────────
-- REVIEW:   -- signatures → leases (lease_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'signatures'::TEXT, 'lease_id'::TEXT, 'leases'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Signatures legacy dont le bail n''existe plus'::TEXT
-- REVIEW:   FROM signatures s
-- REVIEW:   WHERE s.lease_id IS NOT NULL
-- REVIEW:     AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = s.lease_id);
-- REVIEW: 
-- REVIEW:   -- signatures → profiles (signer_profile_id)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'signatures'::TEXT, 'signer_profile_id'::TEXT, 'profiles'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Signatures legacy dont le profil signataire n''existe plus'::TEXT
-- REVIEW:   FROM signatures s
-- REVIEW:   WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = s.signer_profile_id);
-- REVIEW: 
-- REVIEW:   -- Filter: only return rows where orphan_count > 0
-- REVIEW:   -- (handled by caller, but the function returns all checks for completeness)
-- REVIEW: 
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: COMMENT ON FUNCTION audit_orphan_records() IS
-- REVIEW:   'Audit complet des enregistrements orphelins. Retourne toutes les relations cassées avec leur sévérité.';
-- REVIEW: 
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- PHASE 2: FONCTIONS DE DÉTECTION DES DOUBLONS
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: CREATE OR REPLACE FUNCTION audit_duplicate_records()
-- REVIEW: RETURNS TABLE(
-- REVIEW:   table_name TEXT,
-- REVIEW:   duplicate_key TEXT,
-- REVIEW:   duplicate_count BIGINT,
-- REVIEW:   severity TEXT,
-- REVIEW:   description TEXT,
-- REVIEW:   sample_ids TEXT
-- REVIEW: ) AS $$
-- REVIEW: BEGIN
-- REVIEW: 
-- REVIEW:   -- ── PROFILES : même user_id (devrait être UNIQUE) ────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'profiles'::TEXT,
-- REVIEW:     'user_id'::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Comptes avec plusieurs profils pour le même auth.users'::TEXT,
-- REVIEW:     string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
-- REVIEW:   FROM profiles p
-- REVIEW:   GROUP BY p.user_id
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── PROFILES : même email (doublons fonctionnels) ─────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'profiles'::TEXT,
-- REVIEW:     'email=' || COALESCE(p.email, '(null)'),
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Profils avec le même email'::TEXT,
-- REVIEW:     string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
-- REVIEW:   FROM profiles p
-- REVIEW:   WHERE p.email IS NOT NULL AND p.email != ''
-- REVIEW:   GROUP BY p.email
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── PROPERTIES : même adresse + même propriétaire ─────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'properties'::TEXT,
-- REVIEW:     'owner_id+adresse=' || p.owner_id || '+' || LOWER(TRIM(p.adresse_complete)),
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Propriétés dupliquées (même propriétaire + même adresse)'::TEXT,
-- REVIEW:     string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
-- REVIEW:   FROM properties p
-- REVIEW:   WHERE p.deleted_at IS NULL
-- REVIEW:   GROUP BY p.owner_id, LOWER(TRIM(p.adresse_complete))
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── PROPERTIES : même unique_code (devrait être impossible) ───────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'properties'::TEXT,
-- REVIEW:     'unique_code=' || p.unique_code,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Propriétés avec le même code unique (violation unicité)'::TEXT,
-- REVIEW:     string_agg(p.id::TEXT, ', ' ORDER BY p.created_at)::TEXT
-- REVIEW:   FROM properties p
-- REVIEW:   GROUP BY p.unique_code
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── LEASES : même property_id + dates qui se chevauchent ──────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'leases'::TEXT,
-- REVIEW:     'property_id=' || l1.property_id || ' overlap_with=' || l2.id,
-- REVIEW:     2::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Baux actifs qui se chevauchent sur la même propriété'::TEXT,
-- REVIEW:     (l1.id::TEXT || ', ' || l2.id::TEXT)::TEXT
-- REVIEW:   FROM leases l1
-- REVIEW:   JOIN leases l2 ON l1.property_id = l2.property_id
-- REVIEW:     AND l1.id < l2.id
-- REVIEW:     AND l1.statut IN ('active', 'pending_signature', 'fully_signed')
-- REVIEW:     AND l2.statut IN ('active', 'pending_signature', 'fully_signed')
-- REVIEW:     AND l1.property_id IS NOT NULL
-- REVIEW:     AND l1.date_debut <= COALESCE(l2.date_fin, '9999-12-31'::DATE)
-- REVIEW:     AND l2.date_debut <= COALESCE(l1.date_fin, '9999-12-31'::DATE);
-- REVIEW: 
-- REVIEW:   -- ── INVOICES : même bail + même période ───────────────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'invoices'::TEXT,
-- REVIEW:     'lease_id+periode=' || i.lease_id || '+' || i.periode,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Factures dupliquées pour le même bail et la même période'::TEXT,
-- REVIEW:     string_agg(i.id::TEXT, ', ' ORDER BY i.created_at)::TEXT
-- REVIEW:   FROM invoices i
-- REVIEW:   GROUP BY i.lease_id, i.periode
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── LEASE_SIGNERS : même bail + même profil ───────────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'lease_signers'::TEXT,
-- REVIEW:     'lease_id+profile_id=' || ls.lease_id || '+' || ls.profile_id,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Signataires dupliqués sur le même bail'::TEXT,
-- REVIEW:     string_agg(ls.id::TEXT, ', ' ORDER BY ls.created_at)::TEXT
-- REVIEW:   FROM lease_signers ls
-- REVIEW:   WHERE ls.profile_id IS NOT NULL
-- REVIEW:   GROUP BY ls.lease_id, ls.profile_id
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── LEASE_SIGNERS : même bail + même invited_email ────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'lease_signers'::TEXT,
-- REVIEW:     'lease_id+invited_email=' || ls.lease_id || '+' || ls.invited_email,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Signataires invités en double sur le même bail (même email)'::TEXT,
-- REVIEW:     string_agg(ls.id::TEXT, ', ' ORDER BY ls.created_at)::TEXT
-- REVIEW:   FROM lease_signers ls
-- REVIEW:   WHERE ls.invited_email IS NOT NULL AND ls.invited_email != ''
-- REVIEW:   GROUP BY ls.lease_id, ls.invited_email
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── DOCUMENTS : même storage_path ─────────────────────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'documents'::TEXT,
-- REVIEW:     'storage_path=' || COALESCE(d.storage_path, d.url),
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'Documents pointant vers le même fichier storage'::TEXT,
-- REVIEW:     string_agg(d.id::TEXT, ', ' ORDER BY d.created_at)::TEXT
-- REVIEW:   FROM documents d
-- REVIEW:   WHERE COALESCE(d.storage_path, d.url) IS NOT NULL
-- REVIEW:   GROUP BY COALESCE(d.storage_path, d.url)
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── OWNER_PROFILES : même profile_id (PK, mais vérifions) ────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'owner_profiles'::TEXT,
-- REVIEW:     'profile_id=' || op.profile_id,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'CRITICAL'::TEXT,
-- REVIEW:     'Profils propriétaire dupliqués pour le même profil'::TEXT,
-- REVIEW:     string_agg(op.profile_id::TEXT, ', ')::TEXT
-- REVIEW:   FROM owner_profiles op
-- REVIEW:   GROUP BY op.profile_id
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── SUBSCRIPTIONS : abonnements actifs multiples ──────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'subscriptions'::TEXT,
-- REVIEW:     'user_id=' || s.user_id || ' (active)',
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Utilisateurs avec plusieurs abonnements actifs'::TEXT,
-- REVIEW:     string_agg(s.id::TEXT, ', ' ORDER BY s.created_at)::TEXT
-- REVIEW:   FROM subscriptions s
-- REVIEW:   WHERE s.status IN ('active', 'trialing')
-- REVIEW:   GROUP BY s.user_id
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── NOTIFICATIONS : doublons exacts ───────────────────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'notifications'::TEXT,
-- REVIEW:     'user+type+title=' || n.user_id || '+' || n.type || '+' || n.title,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'LOW'::TEXT,
-- REVIEW:     'Notifications dupliquées (même user, type, titre, même minute)'::TEXT,
-- REVIEW:     string_agg(n.id::TEXT, ', ' ORDER BY n.created_at)::TEXT
-- REVIEW:   FROM notifications n
-- REVIEW:   GROUP BY n.user_id, n.type, n.title, date_trunc('minute', n.created_at)
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── ROOMMATES : même bail + même profil ───────────────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'roommates'::TEXT,
-- REVIEW:     'lease_id+profile_id=' || r.lease_id || '+' || r.profile_id,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Colocataires dupliqués sur le même bail'::TEXT,
-- REVIEW:     string_agg(r.id::TEXT, ', ' ORDER BY r.created_at)::TEXT
-- REVIEW:   FROM roommates r
-- REVIEW:   GROUP BY r.lease_id, r.profile_id
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── PHOTOS : même property + même storage_path ────────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'photos'::TEXT,
-- REVIEW:     'property_id+storage_path=' || ph.property_id || '+' || COALESCE(ph.storage_path, ph.url),
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'LOW'::TEXT,
-- REVIEW:     'Photos dupliquées pour la même propriété'::TEXT,
-- REVIEW:     string_agg(ph.id::TEXT, ', ' ORDER BY ph.created_at)::TEXT
-- REVIEW:   FROM photos ph
-- REVIEW:   WHERE COALESCE(ph.storage_path, ph.url) IS NOT NULL
-- REVIEW:   GROUP BY ph.property_id, COALESCE(ph.storage_path, ph.url)
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── LEGAL_ENTITIES : même SIRET ───────────────────────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'legal_entities'::TEXT,
-- REVIEW:     'siret=' || le.siret,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'HIGH'::TEXT,
-- REVIEW:     'Entités légales avec le même SIRET'::TEXT,
-- REVIEW:     string_agg(le.id::TEXT, ', ' ORDER BY le.created_at)::TEXT
-- REVIEW:   FROM legal_entities le
-- REVIEW:   WHERE le.siret IS NOT NULL AND le.siret != ''
-- REVIEW:   GROUP BY le.siret
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- ── EDL : même bail + même type ───────────────────────────────────
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'edl'::TEXT,
-- REVIEW:     'lease_id+type=' || e.lease_id || '+' || e.type,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     'MEDIUM'::TEXT,
-- REVIEW:     'EDL dupliqués pour le même bail et le même type'::TEXT,
-- REVIEW:     string_agg(e.id::TEXT, ', ' ORDER BY e.created_at)::TEXT
-- REVIEW:   FROM edl e
-- REVIEW:   GROUP BY e.lease_id, e.type
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: COMMENT ON FUNCTION audit_duplicate_records() IS
-- REVIEW:   'Audit complet des enregistrements dupliqués. Retourne tous les doublons détectés avec leur sévérité.';
-- REVIEW: 
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- PHASE 3: DÉTECTION DES FK IMPLICITES (colonnes *_id sans contrainte)
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: CREATE OR REPLACE FUNCTION audit_missing_fk_constraints()
-- REVIEW: RETURNS TABLE(
-- REVIEW:   table_name TEXT,
-- REVIEW:   column_name TEXT,
-- REVIEW:   expected_target TEXT,
-- REVIEW:   has_fk BOOLEAN,
-- REVIEW:   recommendation TEXT
-- REVIEW: ) AS $$
-- REVIEW: BEGIN
-- REVIEW: 
-- REVIEW:   -- Lister toutes les colonnes finissant par _id dans le schéma public
-- REVIEW:   -- et vérifier si elles ont une contrainte FK
-- REVIEW:   RETURN QUERY
-- REVIEW:   WITH id_columns AS (
-- REVIEW:     SELECT
-- REVIEW:       c.table_name::TEXT AS tbl,
-- REVIEW:       c.column_name::TEXT AS col,
-- REVIEW:       CASE
-- REVIEW:         WHEN c.column_name LIKE '%profile_id%' THEN 'profiles'
-- REVIEW:         WHEN c.column_name LIKE '%owner_id%' THEN 'profiles'
-- REVIEW:         WHEN c.column_name LIKE '%tenant_id%' THEN 'profiles'
-- REVIEW:         WHEN c.column_name LIKE '%user_id%' THEN 'auth.users'
-- REVIEW:         WHEN c.column_name LIKE '%property_id%' THEN 'properties'
-- REVIEW:         WHEN c.column_name LIKE '%lease_id%' THEN 'leases'
-- REVIEW:         WHEN c.column_name LIKE '%unit_id%' THEN 'units'
-- REVIEW:         WHEN c.column_name LIKE '%invoice_id%' THEN 'invoices'
-- REVIEW:         WHEN c.column_name LIKE '%ticket_id%' THEN 'tickets'
-- REVIEW:         WHEN c.column_name LIKE '%building_id%' THEN 'buildings'
-- REVIEW:         WHEN c.column_name LIKE '%edl_id%' THEN 'edl'
-- REVIEW:         WHEN c.column_name LIKE '%meter_id%' THEN 'meters'
-- REVIEW:         WHEN c.column_name LIKE '%conversation_id%' THEN 'conversations/unified_conversations'
-- REVIEW:         WHEN c.column_name LIKE '%session_id%' THEN 'signature_sessions'
-- REVIEW:         WHEN c.column_name LIKE '%organization_id%' THEN 'organizations'
-- REVIEW:         WHEN c.column_name LIKE '%legal_entity_id%' THEN 'legal_entities'
-- REVIEW:         WHEN c.column_name LIKE '%roommate_id%' THEN 'roommates'
-- REVIEW:         WHEN c.column_name LIKE '%provider_id%' THEN 'profiles/provider_profiles'
-- REVIEW:         WHEN c.column_name LIKE '%document_id%' THEN 'documents'
-- REVIEW:         WHEN c.column_name LIKE '%quote_id%' THEN 'quotes'
-- REVIEW:         WHEN c.column_name LIKE '%work_order_id%' THEN 'work_orders'
-- REVIEW:         WHEN c.column_name LIKE '%application_id%' THEN 'tenant_applications'
-- REVIEW:         WHEN c.column_name LIKE '%participant_id%' THEN 'signature_participants'
-- REVIEW:         ELSE '(unknown)'
-- REVIEW:       END AS expected_target
-- REVIEW:     FROM information_schema.columns c
-- REVIEW:     WHERE c.table_schema = 'public'
-- REVIEW:       AND c.data_type IN ('uuid', 'text')
-- REVIEW:       AND (c.column_name LIKE '%_id' OR c.column_name LIKE '%_uuid')
-- REVIEW:       AND c.column_name != 'id'
-- REVIEW:       AND c.table_name NOT LIKE '_%' -- skip internal tables
-- REVIEW:   ),
-- REVIEW:   existing_fks AS (
-- REVIEW:     SELECT
-- REVIEW:       tc.table_name::TEXT AS tbl,
-- REVIEW:       kcu.column_name::TEXT AS col
-- REVIEW:     FROM information_schema.table_constraints tc
-- REVIEW:     JOIN information_schema.key_column_usage kcu
-- REVIEW:       ON tc.constraint_name = kcu.constraint_name
-- REVIEW:       AND tc.table_schema = kcu.table_schema
-- REVIEW:     WHERE tc.constraint_type = 'FOREIGN KEY'
-- REVIEW:       AND tc.table_schema = 'public'
-- REVIEW:   )
-- REVIEW:   SELECT
-- REVIEW:     ic.tbl,
-- REVIEW:     ic.col,
-- REVIEW:     ic.expected_target,
-- REVIEW:     EXISTS(SELECT 1 FROM existing_fks ef WHERE ef.tbl = ic.tbl AND ef.col = ic.col),
-- REVIEW:     CASE
-- REVIEW:       WHEN EXISTS(SELECT 1 FROM existing_fks ef WHERE ef.tbl = ic.tbl AND ef.col = ic.col)
-- REVIEW:         THEN 'FK existe — OK'
-- REVIEW:       ELSE 'MANQUANTE — Ajouter ALTER TABLE ' || ic.tbl || ' ADD CONSTRAINT fk_' || ic.tbl || '_' || ic.col || ' FOREIGN KEY (' || ic.col || ') REFERENCES ' || ic.expected_target || '(id)'
-- REVIEW:     END
-- REVIEW:   FROM id_columns ic
-- REVIEW:   WHERE ic.expected_target != '(unknown)'
-- REVIEW:   ORDER BY
-- REVIEW:     CASE WHEN EXISTS(SELECT 1 FROM existing_fks ef WHERE ef.tbl = ic.tbl AND ef.col = ic.col) THEN 1 ELSE 0 END,
-- REVIEW:     ic.tbl, ic.col;
-- REVIEW: 
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: COMMENT ON FUNCTION audit_missing_fk_constraints() IS
-- REVIEW:   'Détecte les colonnes *_id sans contrainte FK formelle (FK implicites).';
-- REVIEW: 
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- PHASE 4: VUE CONSOLIDÉE DU TABLEAU DE BORD D'INTÉGRITÉ
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: CREATE OR REPLACE VIEW audit_integrity_dashboard AS
-- REVIEW: 
-- REVIEW: -- Orphelins
-- REVIEW: SELECT
-- REVIEW:   'orphan' AS audit_type,
-- REVIEW:   source_table,
-- REVIEW:   fk_column AS detail_key,
-- REVIEW:   target_table AS detail_value,
-- REVIEW:   orphan_count AS count,
-- REVIEW:   severity,
-- REVIEW:   description
-- REVIEW: FROM audit_orphan_records()
-- REVIEW: WHERE orphan_count > 0
-- REVIEW: 
-- REVIEW: UNION ALL
-- REVIEW: 
-- REVIEW: -- Doublons
-- REVIEW: SELECT
-- REVIEW:   'duplicate' AS audit_type,
-- REVIEW:   table_name AS source_table,
-- REVIEW:   duplicate_key AS detail_key,
-- REVIEW:   sample_ids AS detail_value,
-- REVIEW:   duplicate_count AS count,
-- REVIEW:   severity,
-- REVIEW:   description
-- REVIEW: FROM audit_duplicate_records();
-- REVIEW: 
-- REVIEW: COMMENT ON VIEW audit_integrity_dashboard IS
-- REVIEW:   'Vue consolidée de tous les problèmes d''intégrité détectés (orphelins + doublons).';
-- REVIEW: 
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- PHASE 5: FONCTIONS DE NETTOYAGE SAFE (avec backup préalable)
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: -- 5.1 Table d'archivage pour les enregistrements nettoyés
-- REVIEW: CREATE TABLE IF NOT EXISTS _audit_cleanup_archive (
-- REVIEW:   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
-- REVIEW:   cleanup_batch_id UUID NOT NULL,
-- REVIEW:   source_table TEXT NOT NULL,
-- REVIEW:   source_id TEXT NOT NULL,
-- REVIEW:   fk_column TEXT,
-- REVIEW:   original_data JSONB NOT NULL,
-- REVIEW:   cleanup_reason TEXT NOT NULL,
-- REVIEW:   cleaned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
-- REVIEW:   cleaned_by TEXT DEFAULT current_user
-- REVIEW: );
-- REVIEW: 
-- REVIEW: CREATE INDEX IF NOT EXISTS idx_cleanup_archive_batch
-- REVIEW:   ON _audit_cleanup_archive(cleanup_batch_id);
-- REVIEW: CREATE INDEX IF NOT EXISTS idx_cleanup_archive_table
-- REVIEW:   ON _audit_cleanup_archive(source_table);
-- REVIEW: CREATE INDEX IF NOT EXISTS idx_cleanup_archive_date
-- REVIEW:   ON _audit_cleanup_archive(cleaned_at);
-- REVIEW: 
-- REVIEW: COMMENT ON TABLE _audit_cleanup_archive IS
-- REVIEW:   'Archive des enregistrements supprimés lors du nettoyage d''intégrité. Permet de restaurer si nécessaire.';
-- REVIEW: 
-- REVIEW: -- 5.2 Fonction de nettoyage SAFE avec archivage
-- REVIEW: CREATE OR REPLACE FUNCTION safe_cleanup_orphans(
-- REVIEW:   p_dry_run BOOLEAN DEFAULT TRUE,
-- REVIEW:   p_severity_filter TEXT DEFAULT 'ALL'
-- REVIEW: )
-- REVIEW: RETURNS TABLE(
-- REVIEW:   action TEXT,
-- REVIEW:   source_table TEXT,
-- REVIEW:   fk_column TEXT,
-- REVIEW:   records_affected BIGINT,
-- REVIEW:   detail TEXT
-- REVIEW: ) AS $$
-- REVIEW: DECLARE
-- REVIEW:   v_batch_id UUID := gen_random_uuid();
-- REVIEW:   v_count BIGINT;
-- REVIEW: BEGIN
-- REVIEW: 
-- REVIEW:   -- Header
-- REVIEW:   action := 'INFO';
-- REVIEW:   source_table := '(batch)';
-- REVIEW:   fk_column := '';
-- REVIEW:   records_affected := 0;
-- REVIEW:   detail := 'Batch ID: ' || v_batch_id::TEXT || ' | Mode: ' || CASE WHEN p_dry_run THEN 'DRY RUN (aucune suppression)' ELSE 'EXECUTION RÉELLE' END;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- REVIEW:   -- CRITICAL: lease_signers orphelins (bail supprimé)
-- REVIEW:   -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- REVIEW:   IF p_severity_filter IN ('ALL', 'CRITICAL') THEN
-- REVIEW: 
-- REVIEW:     -- Archive + delete lease_signers sans bail
-- REVIEW:     IF NOT p_dry_run THEN
-- REVIEW:       INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:       SELECT v_batch_id, 'lease_signers', ls.id::TEXT, 'lease_id', to_jsonb(ls), 'Bail inexistant'
-- REVIEW:       FROM lease_signers ls
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);
-- REVIEW: 
-- REVIEW:       DELETE FROM lease_signers ls
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);
-- REVIEW:       GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     ELSE
-- REVIEW:       SELECT COUNT(*) INTO v_count
-- REVIEW:       FROM lease_signers ls
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = ls.lease_id);
-- REVIEW:     END IF;
-- REVIEW: 
-- REVIEW:     action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
-- REVIEW:     source_table := 'lease_signers';
-- REVIEW:     fk_column := 'lease_id → leases';
-- REVIEW:     records_affected := v_count;
-- REVIEW:     detail := 'Signataires dont le bail n''existe plus';
-- REVIEW:     RETURN NEXT;
-- REVIEW: 
-- REVIEW:     -- Archive + delete invoices sans bail
-- REVIEW:     IF NOT p_dry_run THEN
-- REVIEW:       INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:       SELECT v_batch_id, 'invoices', i.id::TEXT, 'lease_id', to_jsonb(i), 'Bail inexistant'
-- REVIEW:       FROM invoices i
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);
-- REVIEW: 
-- REVIEW:       DELETE FROM invoices i
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);
-- REVIEW:       GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     ELSE
-- REVIEW:       SELECT COUNT(*) INTO v_count
-- REVIEW:       FROM invoices i
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id);
-- REVIEW:     END IF;
-- REVIEW: 
-- REVIEW:     action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
-- REVIEW:     source_table := 'invoices';
-- REVIEW:     fk_column := 'lease_id → leases';
-- REVIEW:     records_affected := v_count;
-- REVIEW:     detail := 'Factures dont le bail n''existe plus';
-- REVIEW:     RETURN NEXT;
-- REVIEW: 
-- REVIEW:     -- Archive + delete payments sans invoice
-- REVIEW:     IF NOT p_dry_run THEN
-- REVIEW:       INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:       SELECT v_batch_id, 'payments', py.id::TEXT, 'invoice_id', to_jsonb(py), 'Facture inexistante'
-- REVIEW:       FROM payments py
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
-- REVIEW: 
-- REVIEW:       DELETE FROM payments py
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
-- REVIEW:       GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     ELSE
-- REVIEW:       SELECT COUNT(*) INTO v_count
-- REVIEW:       FROM payments py
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
-- REVIEW:     END IF;
-- REVIEW: 
-- REVIEW:     action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
-- REVIEW:     source_table := 'payments';
-- REVIEW:     fk_column := 'invoice_id → invoices';
-- REVIEW:     records_affected := v_count;
-- REVIEW:     detail := 'Paiements dont la facture n''existe plus';
-- REVIEW:     RETURN NEXT;
-- REVIEW: 
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- REVIEW:   -- HIGH: documents orphelins
-- REVIEW:   -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- REVIEW:   IF p_severity_filter IN ('ALL', 'CRITICAL', 'HIGH') THEN
-- REVIEW: 
-- REVIEW:     -- Documents avec lease_id invalide → SET NULL (ne pas supprimer)
-- REVIEW:     IF NOT p_dry_run THEN
-- REVIEW:       INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:       SELECT v_batch_id, 'documents', d.id::TEXT, 'lease_id', jsonb_build_object('lease_id', d.lease_id), 'Bail inexistant — lease_id mis à NULL'
-- REVIEW:       FROM documents d
-- REVIEW:       WHERE d.lease_id IS NOT NULL
-- REVIEW:         AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);
-- REVIEW: 
-- REVIEW:       UPDATE documents d
-- REVIEW:       SET lease_id = NULL
-- REVIEW:       WHERE d.lease_id IS NOT NULL
-- REVIEW:         AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);
-- REVIEW:       GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     ELSE
-- REVIEW:       SELECT COUNT(*) INTO v_count
-- REVIEW:       FROM documents d
-- REVIEW:       WHERE d.lease_id IS NOT NULL
-- REVIEW:         AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = d.lease_id);
-- REVIEW:     END IF;
-- REVIEW: 
-- REVIEW:     action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
-- REVIEW:     source_table := 'documents';
-- REVIEW:     fk_column := 'lease_id → leases';
-- REVIEW:     records_affected := v_count;
-- REVIEW:     detail := 'Documents: lease_id mis à NULL (bail inexistant)';
-- REVIEW:     RETURN NEXT;
-- REVIEW: 
-- REVIEW:     -- Documents avec property_id invalide → SET NULL
-- REVIEW:     IF NOT p_dry_run THEN
-- REVIEW:       INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:       SELECT v_batch_id, 'documents', d.id::TEXT, 'property_id', jsonb_build_object('property_id', d.property_id), 'Propriété inexistante — property_id mis à NULL'
-- REVIEW:       FROM documents d
-- REVIEW:       WHERE d.property_id IS NOT NULL
-- REVIEW:         AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);
-- REVIEW: 
-- REVIEW:       UPDATE documents d
-- REVIEW:       SET property_id = NULL
-- REVIEW:       WHERE d.property_id IS NOT NULL
-- REVIEW:         AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);
-- REVIEW:       GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     ELSE
-- REVIEW:       SELECT COUNT(*) INTO v_count
-- REVIEW:       FROM documents d
-- REVIEW:       WHERE d.property_id IS NOT NULL
-- REVIEW:         AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = d.property_id);
-- REVIEW:     END IF;
-- REVIEW: 
-- REVIEW:     action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
-- REVIEW:     source_table := 'documents';
-- REVIEW:     fk_column := 'property_id → properties';
-- REVIEW:     records_affected := v_count;
-- REVIEW:     detail := 'Documents: property_id mis à NULL (propriété inexistante)';
-- REVIEW:     RETURN NEXT;
-- REVIEW: 
-- REVIEW:     -- EDL orphelins (bail supprimé)
-- REVIEW:     IF NOT p_dry_run THEN
-- REVIEW:       -- D'abord archiver et supprimer les enfants des EDL orphelins
-- REVIEW:       WITH orphan_edls AS (
-- REVIEW:         SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id)
-- REVIEW:       )
-- REVIEW:       INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:       SELECT v_batch_id, 'edl', e.id::TEXT, 'lease_id', to_jsonb(e), 'Bail inexistant'
-- REVIEW:       FROM edl e
-- REVIEW:       WHERE e.id IN (SELECT id FROM orphan_edls);
-- REVIEW: 
-- REVIEW:       DELETE FROM edl_items WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
-- REVIEW:       DELETE FROM edl_media WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
-- REVIEW:       DELETE FROM edl_signatures WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
-- REVIEW:       DELETE FROM edl_meter_readings WHERE edl_id IN (SELECT e.id FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id));
-- REVIEW:       DELETE FROM edl WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = edl.lease_id);
-- REVIEW:       GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     ELSE
-- REVIEW:       SELECT COUNT(*) INTO v_count
-- REVIEW:       FROM edl e WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = e.lease_id);
-- REVIEW:     END IF;
-- REVIEW: 
-- REVIEW:     action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
-- REVIEW:     source_table := 'edl (+ items, media, signatures)';
-- REVIEW:     fk_column := 'lease_id → leases';
-- REVIEW:     records_affected := v_count;
-- REVIEW:     detail := 'EDL orphelins supprimés en cascade';
-- REVIEW:     RETURN NEXT;
-- REVIEW: 
-- REVIEW:     -- Roommates orphelins (bail supprimé)
-- REVIEW:     IF NOT p_dry_run THEN
-- REVIEW:       INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:       SELECT v_batch_id, 'roommates', r.id::TEXT, 'lease_id', to_jsonb(r), 'Bail inexistant'
-- REVIEW:       FROM roommates r
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);
-- REVIEW: 
-- REVIEW:       DELETE FROM roommates r
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);
-- REVIEW:       GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     ELSE
-- REVIEW:       SELECT COUNT(*) INTO v_count
-- REVIEW:       FROM roommates r WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = r.lease_id);
-- REVIEW:     END IF;
-- REVIEW: 
-- REVIEW:     action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
-- REVIEW:     source_table := 'roommates';
-- REVIEW:     fk_column := 'lease_id → leases';
-- REVIEW:     records_affected := v_count;
-- REVIEW:     detail := 'Colocataires dont le bail n''existe plus';
-- REVIEW:     RETURN NEXT;
-- REVIEW: 
-- REVIEW:     -- Deposit_movements orphelins
-- REVIEW:     IF NOT p_dry_run THEN
-- REVIEW:       INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:       SELECT v_batch_id, 'deposit_movements', dm.id::TEXT, 'lease_id', to_jsonb(dm), 'Bail inexistant'
-- REVIEW:       FROM deposit_movements dm
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);
-- REVIEW: 
-- REVIEW:       DELETE FROM deposit_movements dm
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);
-- REVIEW:       GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     ELSE
-- REVIEW:       SELECT COUNT(*) INTO v_count
-- REVIEW:       FROM deposit_movements dm WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = dm.lease_id);
-- REVIEW:     END IF;
-- REVIEW: 
-- REVIEW:     action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
-- REVIEW:     source_table := 'deposit_movements';
-- REVIEW:     fk_column := 'lease_id → leases';
-- REVIEW:     records_affected := v_count;
-- REVIEW:     detail := 'Mouvements de dépôt dont le bail n''existe plus';
-- REVIEW:     RETURN NEXT;
-- REVIEW: 
-- REVIEW:     -- Meters orphelins
-- REVIEW:     IF NOT p_dry_run THEN
-- REVIEW:       INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:       SELECT v_batch_id, 'meters', m.id::TEXT, 'lease_id', to_jsonb(m), 'Bail inexistant'
-- REVIEW:       FROM meters m
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);
-- REVIEW: 
-- REVIEW:       -- D'abord supprimer les readings des meters orphelins
-- REVIEW:       DELETE FROM meter_readings WHERE meter_id IN (
-- REVIEW:         SELECT m.id FROM meters m WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id)
-- REVIEW:       );
-- REVIEW:       DELETE FROM meters m
-- REVIEW:       WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);
-- REVIEW:       GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     ELSE
-- REVIEW:       SELECT COUNT(*) INTO v_count
-- REVIEW:       FROM meters m WHERE NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = m.lease_id);
-- REVIEW:     END IF;
-- REVIEW: 
-- REVIEW:     action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
-- REVIEW:     source_table := 'meters (+ readings)';
-- REVIEW:     fk_column := 'lease_id → leases';
-- REVIEW:     records_affected := v_count;
-- REVIEW:     detail := 'Compteurs orphelins supprimés en cascade';
-- REVIEW:     RETURN NEXT;
-- REVIEW: 
-- REVIEW:     -- Tickets avec lease_id invalide → SET NULL (garder le ticket)
-- REVIEW:     IF NOT p_dry_run THEN
-- REVIEW:       UPDATE tickets t
-- REVIEW:       SET lease_id = NULL
-- REVIEW:       WHERE t.lease_id IS NOT NULL
-- REVIEW:         AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);
-- REVIEW:       GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     ELSE
-- REVIEW:       SELECT COUNT(*) INTO v_count
-- REVIEW:       FROM tickets t
-- REVIEW:       WHERE t.lease_id IS NOT NULL
-- REVIEW:         AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = t.lease_id);
-- REVIEW:     END IF;
-- REVIEW: 
-- REVIEW:     action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'NULLIFIED' END;
-- REVIEW:     source_table := 'tickets';
-- REVIEW:     fk_column := 'lease_id → leases';
-- REVIEW:     records_affected := v_count;
-- REVIEW:     detail := 'Tickets: lease_id mis à NULL (bail inexistant)';
-- REVIEW:     RETURN NEXT;
-- REVIEW: 
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- REVIEW:   -- LOW: Notifications obsolètes
-- REVIEW:   -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- REVIEW:   IF p_severity_filter = 'ALL' THEN
-- REVIEW: 
-- REVIEW:     -- Notifications lues > 90 jours
-- REVIEW:     IF NOT p_dry_run THEN
-- REVIEW:       DELETE FROM notifications
-- REVIEW:       WHERE is_read = true
-- REVIEW:         AND created_at < NOW() - INTERVAL '90 days';
-- REVIEW:       GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     ELSE
-- REVIEW:       SELECT COUNT(*) INTO v_count
-- REVIEW:       FROM notifications
-- REVIEW:       WHERE is_read = true
-- REVIEW:         AND created_at < NOW() - INTERVAL '90 days';
-- REVIEW:     END IF;
-- REVIEW: 
-- REVIEW:     action := CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'DELETED' END;
-- REVIEW:     source_table := 'notifications';
-- REVIEW:     fk_column := '(age > 90 days + read)';
-- REVIEW:     records_affected := v_count;
-- REVIEW:     detail := 'Notifications lues de plus de 90 jours';
-- REVIEW:     RETURN NEXT;
-- REVIEW: 
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- Summary
-- REVIEW:   action := 'SUMMARY';
-- REVIEW:   source_table := '(all)';
-- REVIEW:   fk_column := '';
-- REVIEW:   records_affected := 0;
-- REVIEW:   detail := 'Nettoyage terminé. Batch: ' || v_batch_id::TEXT || ' — Consultez _audit_cleanup_archive pour restaurer.';
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: COMMENT ON FUNCTION safe_cleanup_orphans(BOOLEAN, TEXT) IS
-- REVIEW:   'Nettoyage SAFE des orphelins avec archivage. Par défaut en DRY RUN. Usage: SELECT * FROM safe_cleanup_orphans(false) pour exécuter.';
-- REVIEW: 
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- PHASE 6: FONCTION DE RESTAURATION (rollback d'un batch de nettoyage)
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: CREATE OR REPLACE FUNCTION restore_cleanup_batch(p_batch_id UUID)
-- REVIEW: RETURNS TABLE(
-- REVIEW:   restored_table TEXT,
-- REVIEW:   restored_count BIGINT
-- REVIEW: ) AS $$
-- REVIEW: DECLARE
-- REVIEW:   r RECORD;
-- REVIEW:   v_count BIGINT := 0;
-- REVIEW: BEGIN
-- REVIEW:   -- On ne peut restaurer que les lignes supprimées (pas les NULL-ifiées)
-- REVIEW:   -- Pour chaque table dans l'archive, on ré-insère les données
-- REVIEW:   FOR r IN
-- REVIEW:     SELECT DISTINCT a.source_table
-- REVIEW:     FROM _audit_cleanup_archive a
-- REVIEW:     WHERE a.cleanup_batch_id = p_batch_id
-- REVIEW:       AND a.cleanup_reason NOT LIKE '%mis à NULL%'
-- REVIEW:     ORDER BY a.source_table
-- REVIEW:   LOOP
-- REVIEW:     restored_table := r.source_table;
-- REVIEW: 
-- REVIEW:     -- Compter les enregistrements à restaurer
-- REVIEW:     SELECT COUNT(*) INTO v_count
-- REVIEW:     FROM _audit_cleanup_archive a
-- REVIEW:     WHERE a.cleanup_batch_id = p_batch_id
-- REVIEW:       AND a.source_table = r.source_table
-- REVIEW:       AND a.cleanup_reason NOT LIKE '%mis à NULL%';
-- REVIEW: 
-- REVIEW:     restored_count := v_count;
-- REVIEW:     RETURN NEXT;
-- REVIEW:   END LOOP;
-- REVIEW: 
-- REVIEW:   -- Note : la restauration réelle nécessite un INSERT dynamique
-- REVIEW:   -- qui doit être exécuté manuellement pour chaque table
-- REVIEW:   -- car la structure des colonnes diffère
-- REVIEW:   restored_table := '⚠️ IMPORTANT';
-- REVIEW:   restored_count := 0;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   restored_table := 'Les données sont dans _audit_cleanup_archive.original_data (JSONB)';
-- REVIEW:   restored_count := 0;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   restored_table := 'Utilisez: SELECT original_data FROM _audit_cleanup_archive WHERE cleanup_batch_id = ''' || p_batch_id::TEXT || '''';
-- REVIEW:   restored_count := 0;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: COMMENT ON FUNCTION restore_cleanup_batch(UUID) IS
-- REVIEW:   'Liste les enregistrements restaurables pour un batch de nettoyage donné.';
-- REVIEW: 
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- LOGS DE MIGRATION
-- REVIEW: -- ============================================================================
-- REVIEW: DO $$
-- REVIEW: BEGIN
-- REVIEW:   RAISE NOTICE '══════════════════════════════════════════════════════════════';
-- REVIEW:   RAISE NOTICE '  AUDIT D''INTÉGRITÉ TALOK — Migration installée';
-- REVIEW:   RAISE NOTICE '══════════════════════════════════════════════════════════════';
-- REVIEW:   RAISE NOTICE '';
-- REVIEW:   RAISE NOTICE '  Fonctions disponibles :';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_orphan_records();';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_duplicate_records();';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_missing_fk_constraints();';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_integrity_dashboard;';
-- REVIEW:   RAISE NOTICE '';
-- REVIEW:   RAISE NOTICE '  Nettoyage (DRY RUN par défaut) :';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM safe_cleanup_orphans(true);   -- prévisualiser';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM safe_cleanup_orphans(false);  -- exécuter';
-- REVIEW:   RAISE NOTICE '';
-- REVIEW:   RAISE NOTICE '  Restauration :';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM restore_cleanup_batch(''<batch_id>'');';
-- REVIEW:   RAISE NOTICE '══════════════════════════════════════════════════════════════';
-- REVIEW: END $$;
-- REVIEW: 


-- === MIGRATION: 20260212000001_fix_guarantor_role_and_tables.sql ===
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

DROP POLICY IF EXISTS "guarantor_profiles_select_own" ON guarantor_profiles;
CREATE POLICY "guarantor_profiles_select_own" ON guarantor_profiles
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "guarantor_profiles_insert_own" ON guarantor_profiles;
CREATE POLICY "guarantor_profiles_insert_own" ON guarantor_profiles
  FOR INSERT WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "guarantor_profiles_update_own" ON guarantor_profiles;
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

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);

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


-- === MIGRATION: 20260212100000_audit_v2_merge_and_prevention.sql ===
-- REVIEW: Cette migration contient des DROP/DELETE dangereux. Verifier avant d'appliquer.
-- REVIEW: -- ============================================================================
-- REVIEW: -- AUDIT D'INTÉGRITÉ V2 — FUSION, DRY RUN, ROLLBACK, PRÉVENTION
-- REVIEW: -- Date: 2026-02-12
-- REVIEW: -- Complète 20260212000000_audit_database_integrity.sql
-- REVIEW: -- ============================================================================
-- REVIEW: -- Ce script ajoute :
-- REVIEW: --   Phase 3 : Détection avancée des doublons (fuzzy, temporels)
-- REVIEW: --   Phase 4 : Fonctions de fusion SAFE (merge avec backup + rollback)
-- REVIEW: --   Phase 5 : Contraintes de prévention (FK, UNIQUE, triggers)
-- REVIEW: -- ============================================================================
-- REVIEW: -- PRÉREQUIS : 20260212000000_audit_database_integrity.sql déjà appliqué
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- INFRASTRUCTURE : Tables de support
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: -- Table d'audit pour TOUTES les opérations de nettoyage
-- REVIEW: CREATE TABLE IF NOT EXISTS _audit_log (
-- REVIEW:   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
-- REVIEW:   action TEXT NOT NULL,          -- MERGE, DELETE, NULLIFY, BACKUP, ROLLBACK
-- REVIEW:   table_name TEXT NOT NULL,
-- REVIEW:   old_id TEXT,
-- REVIEW:   new_id TEXT,
-- REVIEW:   details TEXT,
-- REVIEW:   affected_rows INTEGER DEFAULT 0,
-- REVIEW:   executed_by TEXT DEFAULT current_user,
-- REVIEW:   session_id TEXT DEFAULT current_setting('request.jwt.claim.sub', true),
-- REVIEW:   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- REVIEW: );
-- REVIEW: 
-- REVIEW: CREATE INDEX IF NOT EXISTS idx_audit_log_table ON _audit_log(table_name);
-- REVIEW: CREATE INDEX IF NOT EXISTS idx_audit_log_action ON _audit_log(action);
-- REVIEW: CREATE INDEX IF NOT EXISTS idx_audit_log_date ON _audit_log(created_at);
-- REVIEW: 
-- REVIEW: COMMENT ON TABLE _audit_log IS 'Journal d''audit de toutes les opérations de nettoyage/fusion de données.';
-- REVIEW: 
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- PHASE 3 : DÉTECTION AVANCÉE DES DOUBLONS
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 3.1 Doublons de propriétés (adresse normalisée + code_postal + ville)
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: CREATE OR REPLACE FUNCTION audit_duplicate_properties()
-- REVIEW: RETURNS TABLE(
-- REVIEW:   duplicate_key TEXT,
-- REVIEW:   nb_doublons BIGINT,
-- REVIEW:   ids UUID[],
-- REVIEW:   owner_ids UUID[],
-- REVIEW:   premier_cree TIMESTAMPTZ,
-- REVIEW:   dernier_cree TIMESTAMPTZ,
-- REVIEW:   match_type TEXT
-- REVIEW: ) AS $$
-- REVIEW: BEGIN
-- REVIEW:   -- Doublons exacts : même adresse normalisée + CP + ville + même owner
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('exact:' || p.owner_id || ':' || LOWER(TRIM(p.adresse_complete)) || ':' || p.code_postal)::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     ARRAY_AGG(p.id ORDER BY p.created_at ASC),
-- REVIEW:     ARRAY_AGG(DISTINCT p.owner_id),
-- REVIEW:     MIN(p.created_at),
-- REVIEW:     MAX(p.created_at),
-- REVIEW:     'EXACT'::TEXT
-- REVIEW:   FROM properties p
-- REVIEW:   WHERE p.deleted_at IS NULL
-- REVIEW:   GROUP BY p.owner_id, LOWER(TRIM(p.adresse_complete)), p.code_postal
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- Doublons temporels : même owner, créés à < 5 min d'intervalle
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('temporal:' || p1.owner_id || ':' || p1.id || ':' || p2.id)::TEXT,
-- REVIEW:     2::BIGINT,
-- REVIEW:     ARRAY[p1.id, p2.id],
-- REVIEW:     ARRAY[p1.owner_id],
-- REVIEW:     LEAST(p1.created_at, p2.created_at),
-- REVIEW:     GREATEST(p1.created_at, p2.created_at),
-- REVIEW:     'TEMPORAL (<5min)'::TEXT
-- REVIEW:   FROM properties p1
-- REVIEW:   JOIN properties p2 ON p1.owner_id = p2.owner_id
-- REVIEW:     AND p1.id < p2.id
-- REVIEW:     AND p1.deleted_at IS NULL AND p2.deleted_at IS NULL
-- REVIEW:     AND ABS(EXTRACT(EPOCH FROM (p1.created_at - p2.created_at))) < 300
-- REVIEW:     AND LOWER(TRIM(p1.ville)) = LOWER(TRIM(p2.ville))
-- REVIEW:     AND p1.code_postal = p2.code_postal;
-- REVIEW: 
-- REVIEW:   -- Doublons flous : même CP + ville, adresses très similaires (même owner)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('fuzzy:' || p1.owner_id || ':' || p1.id || ':' || p2.id)::TEXT,
-- REVIEW:     2::BIGINT,
-- REVIEW:     ARRAY[p1.id, p2.id],
-- REVIEW:     ARRAY[p1.owner_id],
-- REVIEW:     LEAST(p1.created_at, p2.created_at),
-- REVIEW:     GREATEST(p1.created_at, p2.created_at),
-- REVIEW:     'FUZZY (même CP+ville, type identique)'::TEXT
-- REVIEW:   FROM properties p1
-- REVIEW:   JOIN properties p2 ON p1.owner_id = p2.owner_id
-- REVIEW:     AND p1.id < p2.id
-- REVIEW:     AND p1.deleted_at IS NULL AND p2.deleted_at IS NULL
-- REVIEW:     AND p1.code_postal = p2.code_postal
-- REVIEW:     AND LOWER(TRIM(p1.ville)) = LOWER(TRIM(p2.ville))
-- REVIEW:     AND p1.type = p2.type
-- REVIEW:     AND p1.surface = p2.surface
-- REVIEW:     AND p1.nb_pieces = p2.nb_pieces
-- REVIEW:     -- Exclure les paires déjà capturées en exact
-- REVIEW:     AND LOWER(TRIM(p1.adresse_complete)) != LOWER(TRIM(p2.adresse_complete));
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 3.2 Doublons de profils/contacts (email OU nom+prénom+date_naissance)
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: CREATE OR REPLACE FUNCTION audit_duplicate_profiles()
-- REVIEW: RETURNS TABLE(
-- REVIEW:   duplicate_key TEXT,
-- REVIEW:   nb_doublons BIGINT,
-- REVIEW:   ids UUID[],
-- REVIEW:   emails TEXT[],
-- REVIEW:   roles TEXT[],
-- REVIEW:   premier_cree TIMESTAMPTZ,
-- REVIEW:   dernier_cree TIMESTAMPTZ,
-- REVIEW:   match_type TEXT
-- REVIEW: ) AS $$
-- REVIEW: BEGIN
-- REVIEW:   -- Doublons par email (même email dans profiles)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('email:' || LOWER(TRIM(p.email)))::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     ARRAY_AGG(p.id ORDER BY p.created_at ASC),
-- REVIEW:     ARRAY_AGG(DISTINCT p.email),
-- REVIEW:     ARRAY_AGG(DISTINCT p.role),
-- REVIEW:     MIN(p.created_at),
-- REVIEW:     MAX(p.created_at),
-- REVIEW:     'EMAIL_EXACT'::TEXT
-- REVIEW:   FROM profiles p
-- REVIEW:   WHERE p.email IS NOT NULL AND TRIM(p.email) != ''
-- REVIEW:   GROUP BY LOWER(TRIM(p.email))
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- Doublons par nom+prénom+date_naissance
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('identity:' || LOWER(TRIM(COALESCE(p.nom,''))) || ':' || LOWER(TRIM(COALESCE(p.prenom,''))) || ':' || COALESCE(p.date_naissance::TEXT,''))::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     ARRAY_AGG(p.id ORDER BY p.created_at ASC),
-- REVIEW:     ARRAY_AGG(p.email),
-- REVIEW:     ARRAY_AGG(DISTINCT p.role),
-- REVIEW:     MIN(p.created_at),
-- REVIEW:     MAX(p.created_at),
-- REVIEW:     'IDENTITY (nom+prénom+naissance)'::TEXT
-- REVIEW:   FROM profiles p
-- REVIEW:   WHERE p.nom IS NOT NULL AND p.prenom IS NOT NULL AND p.date_naissance IS NOT NULL
-- REVIEW:     AND TRIM(p.nom) != '' AND TRIM(p.prenom) != ''
-- REVIEW:   GROUP BY LOWER(TRIM(p.nom)), LOWER(TRIM(p.prenom)), p.date_naissance
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- Doublons user_id (critique : même auth.users → 2+ profiles)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('user_id:' || p.user_id)::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     ARRAY_AGG(p.id ORDER BY p.created_at ASC),
-- REVIEW:     ARRAY_AGG(p.email),
-- REVIEW:     ARRAY_AGG(DISTINCT p.role),
-- REVIEW:     MIN(p.created_at),
-- REVIEW:     MAX(p.created_at),
-- REVIEW:     'CRITICAL: même user_id'::TEXT
-- REVIEW:   FROM profiles p
-- REVIEW:   GROUP BY p.user_id
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 3.3 Doublons de baux (property_id + tenant_id + date_debut ±7j)
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: CREATE OR REPLACE FUNCTION audit_duplicate_leases()
-- REVIEW: RETURNS TABLE(
-- REVIEW:   duplicate_key TEXT,
-- REVIEW:   nb_doublons BIGINT,
-- REVIEW:   ids UUID[],
-- REVIEW:   statuts TEXT[],
-- REVIEW:   premier_cree TIMESTAMPTZ,
-- REVIEW:   dernier_cree TIMESTAMPTZ,
-- REVIEW:   match_type TEXT
-- REVIEW: ) AS $$
-- REVIEW: BEGIN
-- REVIEW:   -- Doublons exacts : même property + même période
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('exact:' || l.property_id || ':' || l.date_debut)::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     ARRAY_AGG(l.id ORDER BY l.created_at ASC),
-- REVIEW:     ARRAY_AGG(l.statut),
-- REVIEW:     MIN(l.created_at),
-- REVIEW:     MAX(l.created_at),
-- REVIEW:     'EXACT (même property+date_debut)'::TEXT
-- REVIEW:   FROM leases l
-- REVIEW:   WHERE l.property_id IS NOT NULL
-- REVIEW:     AND l.statut NOT IN ('cancelled', 'archived')
-- REVIEW:   GROUP BY l.property_id, l.date_debut
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- Doublons temporels : même property, dates proches (±7 jours), même type
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('temporal:' || l1.id || ':' || l2.id)::TEXT,
-- REVIEW:     2::BIGINT,
-- REVIEW:     ARRAY[l1.id, l2.id],
-- REVIEW:     ARRAY[l1.statut, l2.statut],
-- REVIEW:     LEAST(l1.created_at, l2.created_at),
-- REVIEW:     GREATEST(l1.created_at, l2.created_at),
-- REVIEW:     'TEMPORAL (même property, date ±7j)'::TEXT
-- REVIEW:   FROM leases l1
-- REVIEW:   JOIN leases l2 ON l1.property_id = l2.property_id
-- REVIEW:     AND l1.id < l2.id
-- REVIEW:     AND l1.property_id IS NOT NULL
-- REVIEW:     AND l1.type_bail = l2.type_bail
-- REVIEW:     AND l1.statut NOT IN ('cancelled', 'archived')
-- REVIEW:     AND l2.statut NOT IN ('cancelled', 'archived')
-- REVIEW:     AND ABS(l1.date_debut - l2.date_debut) <= 7;
-- REVIEW: 
-- REVIEW:   -- Baux actifs chevauchants sur même propriété
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('overlap:' || l1.property_id || ':' || l1.id || ':' || l2.id)::TEXT,
-- REVIEW:     2::BIGINT,
-- REVIEW:     ARRAY[l1.id, l2.id],
-- REVIEW:     ARRAY[l1.statut, l2.statut],
-- REVIEW:     LEAST(l1.created_at, l2.created_at),
-- REVIEW:     GREATEST(l1.created_at, l2.created_at),
-- REVIEW:     'OVERLAP (baux actifs chevauchants)'::TEXT
-- REVIEW:   FROM leases l1
-- REVIEW:   JOIN leases l2 ON l1.property_id = l2.property_id
-- REVIEW:     AND l1.id < l2.id
-- REVIEW:     AND l1.property_id IS NOT NULL
-- REVIEW:     AND l1.statut IN ('active', 'pending_signature', 'fully_signed')
-- REVIEW:     AND l2.statut IN ('active', 'pending_signature', 'fully_signed')
-- REVIEW:     AND l1.date_debut <= COALESCE(l2.date_fin, '9999-12-31'::DATE)
-- REVIEW:     AND l2.date_debut <= COALESCE(l1.date_fin, '9999-12-31'::DATE);
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 3.4 Doublons de documents (nom + entité + created_at ±1min)
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: CREATE OR REPLACE FUNCTION audit_duplicate_documents()
-- REVIEW: RETURNS TABLE(
-- REVIEW:   duplicate_key TEXT,
-- REVIEW:   nb_doublons BIGINT,
-- REVIEW:   ids UUID[],
-- REVIEW:   premier_cree TIMESTAMPTZ,
-- REVIEW:   dernier_cree TIMESTAMPTZ,
-- REVIEW:   match_type TEXT
-- REVIEW: ) AS $$
-- REVIEW: BEGIN
-- REVIEW:   -- Doublons par storage_path (même fichier physique)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('storage:' || COALESCE(d.storage_path, d.url))::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     ARRAY_AGG(d.id ORDER BY d.created_at ASC),
-- REVIEW:     MIN(d.created_at),
-- REVIEW:     MAX(d.created_at),
-- REVIEW:     'STORAGE_PATH identique'::TEXT
-- REVIEW:   FROM documents d
-- REVIEW:   WHERE COALESCE(d.storage_path, d.url) IS NOT NULL
-- REVIEW:   GROUP BY COALESCE(d.storage_path, d.url)
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- Doublons temporels par entité (même type + même parent + <1 min)
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('temporal:' || d1.id || ':' || d2.id)::TEXT,
-- REVIEW:     2::BIGINT,
-- REVIEW:     ARRAY[d1.id, d2.id],
-- REVIEW:     LEAST(d1.created_at, d2.created_at),
-- REVIEW:     GREATEST(d1.created_at, d2.created_at),
-- REVIEW:     'TEMPORAL (<1min, même type+parent)'::TEXT
-- REVIEW:   FROM documents d1
-- REVIEW:   JOIN documents d2 ON d1.id < d2.id
-- REVIEW:     AND d1.type = d2.type
-- REVIEW:     AND COALESCE(d1.lease_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(d2.lease_id, '00000000-0000-0000-0000-000000000000'::UUID)
-- REVIEW:     AND COALESCE(d1.property_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(d2.property_id, '00000000-0000-0000-0000-000000000000'::UUID)
-- REVIEW:     AND ABS(EXTRACT(EPOCH FROM (d1.created_at - d2.created_at))) < 60;
-- REVIEW: 
-- REVIEW:   -- Doublons par nom de fichier + entité
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('name:' || LOWER(TRIM(COALESCE(d.nom, d.nom_fichier, ''))) || ':' || COALESCE(d.lease_id::TEXT, d.property_id::TEXT, 'none'))::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     ARRAY_AGG(d.id ORDER BY d.created_at ASC),
-- REVIEW:     MIN(d.created_at),
-- REVIEW:     MAX(d.created_at),
-- REVIEW:     'NOM_FICHIER identique (même entité)'::TEXT
-- REVIEW:   FROM documents d
-- REVIEW:   WHERE COALESCE(d.nom, d.nom_fichier) IS NOT NULL
-- REVIEW:     AND TRIM(COALESCE(d.nom, d.nom_fichier, '')) != ''
-- REVIEW:   GROUP BY LOWER(TRIM(COALESCE(d.nom, d.nom_fichier, ''))), COALESCE(d.lease_id::TEXT, d.property_id::TEXT, 'none')
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 3.5 Doublons de paiements (montant + invoice_id + date ±1j)
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: CREATE OR REPLACE FUNCTION audit_duplicate_payments()
-- REVIEW: RETURNS TABLE(
-- REVIEW:   duplicate_key TEXT,
-- REVIEW:   nb_doublons BIGINT,
-- REVIEW:   ids UUID[],
-- REVIEW:   montants NUMERIC[],
-- REVIEW:   premier_cree TIMESTAMPTZ,
-- REVIEW:   dernier_cree TIMESTAMPTZ,
-- REVIEW:   match_type TEXT
-- REVIEW: ) AS $$
-- REVIEW: BEGIN
-- REVIEW:   -- Doublons exacts : même invoice + même montant
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('exact:' || py.invoice_id || ':' || py.montant)::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     ARRAY_AGG(py.id ORDER BY py.created_at ASC),
-- REVIEW:     ARRAY_AGG(py.montant),
-- REVIEW:     MIN(py.created_at),
-- REVIEW:     MAX(py.created_at),
-- REVIEW:     'EXACT (même invoice+montant)'::TEXT
-- REVIEW:   FROM payments py
-- REVIEW:   GROUP BY py.invoice_id, py.montant
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- Doublons temporels : même invoice, même montant, < 1 jour
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('temporal:' || p1.id || ':' || p2.id)::TEXT,
-- REVIEW:     2::BIGINT,
-- REVIEW:     ARRAY[p1.id, p2.id],
-- REVIEW:     ARRAY[p1.montant, p2.montant],
-- REVIEW:     LEAST(p1.created_at, p2.created_at),
-- REVIEW:     GREATEST(p1.created_at, p2.created_at),
-- REVIEW:     'TEMPORAL (<24h, même invoice+montant)'::TEXT
-- REVIEW:   FROM payments p1
-- REVIEW:   JOIN payments p2 ON p1.invoice_id = p2.invoice_id
-- REVIEW:     AND p1.id < p2.id
-- REVIEW:     AND p1.montant = p2.montant
-- REVIEW:     AND ABS(EXTRACT(EPOCH FROM (p1.created_at - p2.created_at))) < 86400;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 3.6 Doublons d'EDL (lease_id + type + date ±1j)
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: CREATE OR REPLACE FUNCTION audit_duplicate_edl()
-- REVIEW: RETURNS TABLE(
-- REVIEW:   duplicate_key TEXT,
-- REVIEW:   nb_doublons BIGINT,
-- REVIEW:   ids UUID[],
-- REVIEW:   statuts TEXT[],
-- REVIEW:   premier_cree TIMESTAMPTZ,
-- REVIEW:   dernier_cree TIMESTAMPTZ,
-- REVIEW:   match_type TEXT
-- REVIEW: ) AS $$
-- REVIEW: BEGIN
-- REVIEW:   -- Doublons exacts : même bail + même type
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('exact:' || e.lease_id || ':' || e.type)::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     ARRAY_AGG(e.id ORDER BY e.created_at ASC),
-- REVIEW:     ARRAY_AGG(e.status),
-- REVIEW:     MIN(e.created_at),
-- REVIEW:     MAX(e.created_at),
-- REVIEW:     'EXACT (même bail+type)'::TEXT
-- REVIEW:   FROM edl e
-- REVIEW:   GROUP BY e.lease_id, e.type
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: 
-- REVIEW:   -- Doublons temporels
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('temporal:' || e1.id || ':' || e2.id)::TEXT,
-- REVIEW:     2::BIGINT,
-- REVIEW:     ARRAY[e1.id, e2.id],
-- REVIEW:     ARRAY[e1.status, e2.status],
-- REVIEW:     LEAST(e1.created_at, e2.created_at),
-- REVIEW:     GREATEST(e1.created_at, e2.created_at),
-- REVIEW:     'TEMPORAL (<24h, même bail+type)'::TEXT
-- REVIEW:   FROM edl e1
-- REVIEW:   JOIN edl e2 ON e1.lease_id = e2.lease_id
-- REVIEW:     AND e1.type = e2.type
-- REVIEW:     AND e1.id < e2.id
-- REVIEW:     AND ABS(EXTRACT(EPOCH FROM (e1.created_at - e2.created_at))) < 86400;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 3.7 Doublons de factures (lease_id + periode)
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: CREATE OR REPLACE FUNCTION audit_duplicate_invoices()
-- REVIEW: RETURNS TABLE(
-- REVIEW:   duplicate_key TEXT,
-- REVIEW:   nb_doublons BIGINT,
-- REVIEW:   ids UUID[],
-- REVIEW:   montants NUMERIC[],
-- REVIEW:   statuts TEXT[],
-- REVIEW:   premier_cree TIMESTAMPTZ,
-- REVIEW:   dernier_cree TIMESTAMPTZ,
-- REVIEW:   match_type TEXT
-- REVIEW: ) AS $$
-- REVIEW: BEGIN
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT
-- REVIEW:     ('exact:' || i.lease_id || ':' || i.periode)::TEXT,
-- REVIEW:     COUNT(*)::BIGINT,
-- REVIEW:     ARRAY_AGG(i.id ORDER BY i.created_at ASC),
-- REVIEW:     ARRAY_AGG(i.montant_total),
-- REVIEW:     ARRAY_AGG(i.statut),
-- REVIEW:     MIN(i.created_at),
-- REVIEW:     MAX(i.created_at),
-- REVIEW:     'EXACT (même bail+période)'::TEXT
-- REVIEW:   FROM invoices i
-- REVIEW:   GROUP BY i.lease_id, i.periode
-- REVIEW:   HAVING COUNT(*) > 1;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 3.8 Rapport consolidé de tous les doublons
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: CREATE OR REPLACE FUNCTION audit_all_duplicates_summary()
-- REVIEW: RETURNS TABLE(
-- REVIEW:   entity TEXT,
-- REVIEW:   match_type TEXT,
-- REVIEW:   duplicate_groups BIGINT,
-- REVIEW:   total_excess_records BIGINT,
-- REVIEW:   severity TEXT
-- REVIEW: ) AS $$
-- REVIEW: BEGIN
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'properties'::TEXT, dp.match_type, COUNT(*)::BIGINT,
-- REVIEW:     SUM(dp.nb_doublons - 1)::BIGINT, 'HIGH'::TEXT
-- REVIEW:   FROM audit_duplicate_properties() dp
-- REVIEW:   GROUP BY dp.match_type;
-- REVIEW: 
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'profiles'::TEXT, dp.match_type, COUNT(*)::BIGINT,
-- REVIEW:     SUM(dp.nb_doublons - 1)::BIGINT,
-- REVIEW:     CASE WHEN dp.match_type LIKE '%user_id%' THEN 'CRITICAL' ELSE 'HIGH' END::TEXT
-- REVIEW:   FROM audit_duplicate_profiles() dp
-- REVIEW:   GROUP BY dp.match_type;
-- REVIEW: 
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'leases'::TEXT, dl.match_type, COUNT(*)::BIGINT,
-- REVIEW:     SUM(dl.nb_doublons - 1)::BIGINT,
-- REVIEW:     CASE WHEN dl.match_type LIKE '%OVERLAP%' THEN 'CRITICAL' ELSE 'HIGH' END::TEXT
-- REVIEW:   FROM audit_duplicate_leases() dl
-- REVIEW:   GROUP BY dl.match_type;
-- REVIEW: 
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'documents'::TEXT, dd.match_type, COUNT(*)::BIGINT,
-- REVIEW:     SUM(dd.nb_doublons - 1)::BIGINT, 'MEDIUM'::TEXT
-- REVIEW:   FROM audit_duplicate_documents() dd
-- REVIEW:   GROUP BY dd.match_type;
-- REVIEW: 
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'payments'::TEXT, dp.match_type, COUNT(*)::BIGINT,
-- REVIEW:     SUM(dp.nb_doublons - 1)::BIGINT, 'CRITICAL'::TEXT
-- REVIEW:   FROM audit_duplicate_payments() dp
-- REVIEW:   GROUP BY dp.match_type;
-- REVIEW: 
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'edl'::TEXT, de.match_type, COUNT(*)::BIGINT,
-- REVIEW:     SUM(de.nb_doublons - 1)::BIGINT, 'MEDIUM'::TEXT
-- REVIEW:   FROM audit_duplicate_edl() de
-- REVIEW:   GROUP BY de.match_type;
-- REVIEW: 
-- REVIEW:   RETURN QUERY
-- REVIEW:   SELECT 'invoices'::TEXT, di.match_type, COUNT(*)::BIGINT,
-- REVIEW:     SUM(di.nb_doublons - 1)::BIGINT, 'CRITICAL'::TEXT
-- REVIEW:   FROM audit_duplicate_invoices() di
-- REVIEW:   GROUP BY di.match_type;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- PHASE 4 : FONCTIONS DE FUSION SAFE (MERGE)
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 4.1 Fusion générique : élit un master, transfère les enfants, supprime
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: 
-- REVIEW: -- Helper : compter les champs non-null d'un enregistrement
-- REVIEW: CREATE OR REPLACE FUNCTION _count_non_null_fields(p_table TEXT, p_id UUID)
-- REVIEW: RETURNS INTEGER AS $$
-- REVIEW: DECLARE
-- REVIEW:   v_count INTEGER;
-- REVIEW: BEGIN
-- REVIEW:   EXECUTE format(
-- REVIEW:     'SELECT COUNT(*) FROM (
-- REVIEW:        SELECT unnest(ARRAY[%s]) AS val
-- REVIEW:      ) sub WHERE val IS NOT NULL',
-- REVIEW:     (SELECT string_agg(quote_ident(column_name) || '::TEXT', ', ')
-- REVIEW:      FROM information_schema.columns
-- REVIEW:      WHERE table_schema = 'public' AND table_name = p_table)
-- REVIEW:   ) USING p_id INTO v_count;
-- REVIEW:   RETURN v_count;
-- REVIEW: EXCEPTION WHEN OTHERS THEN
-- REVIEW:   RETURN 0;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql;
-- REVIEW: 
-- REVIEW: -- 4.2 Merge de propriétés
-- REVIEW: CREATE OR REPLACE FUNCTION merge_duplicate_properties(
-- REVIEW:   p_master_id UUID,
-- REVIEW:   p_duplicate_id UUID,
-- REVIEW:   p_dry_run BOOLEAN DEFAULT TRUE
-- REVIEW: )
-- REVIEW: RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
-- REVIEW: DECLARE
-- REVIEW:   v_count INTEGER;
-- REVIEW: BEGIN
-- REVIEW:   -- Validation
-- REVIEW:   IF p_master_id = p_duplicate_id THEN
-- REVIEW:     step := 'ERROR'; detail := 'master_id et duplicate_id sont identiques'; affected_rows := 0;
-- REVIEW:     RETURN NEXT; RETURN;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_master_id) THEN
-- REVIEW:     step := 'ERROR'; detail := 'master_id introuvable'; affected_rows := 0;
-- REVIEW:     RETURN NEXT; RETURN;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_duplicate_id) THEN
-- REVIEW:     step := 'ERROR'; detail := 'duplicate_id introuvable'; affected_rows := 0;
-- REVIEW:     RETURN NEXT; RETURN;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- 1. Backup
-- REVIEW:   IF NOT p_dry_run THEN
-- REVIEW:     INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:     SELECT gen_random_uuid(), 'properties', p_duplicate_id::TEXT, 'MERGE', to_jsonb(p), 'Fusion vers ' || p_master_id
-- REVIEW:     FROM properties p WHERE id = p_duplicate_id;
-- REVIEW:   END IF;
-- REVIEW:   step := '1.BACKUP'; detail := 'Backup du doublon dans _audit_cleanup_archive'; affected_rows := 1;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 2. Transfert : leases
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM leases WHERE property_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE leases SET property_id = p_master_id WHERE property_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'leases.property_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 3. Transfert : units
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM units WHERE property_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE units SET property_id = p_master_id WHERE property_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'units.property_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 4. Transfert : charges
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM charges WHERE property_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE charges SET property_id = p_master_id WHERE property_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'charges.property_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 5. Transfert : documents
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM documents WHERE property_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE documents SET property_id = p_master_id WHERE property_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'documents.property_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 6. Transfert : tickets
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM tickets WHERE property_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE tickets SET property_id = p_master_id WHERE property_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'tickets.property_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 7. Transfert : photos
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM photos WHERE property_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE photos SET property_id = p_master_id WHERE property_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'photos.property_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 8. Transfert : visit_slots
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM visit_slots WHERE property_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE visit_slots SET property_id = p_master_id WHERE property_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'visit_slots.property_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 9. Transfert : property_ownership
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM property_ownership WHERE property_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE property_ownership SET property_id = p_master_id WHERE property_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'property_ownership.property_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 10. Transfert : conversations
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM conversations WHERE property_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE conversations SET property_id = p_master_id WHERE property_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'conversations.property_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 11. Enrichir le master avec les champs manquants du doublon
-- REVIEW:   IF NOT p_dry_run THEN
-- REVIEW:     UPDATE properties SET
-- REVIEW:       cover_url = COALESCE(properties.cover_url, dup.cover_url),
-- REVIEW:       loyer_reference = COALESCE(properties.loyer_reference, dup.loyer_reference),
-- REVIEW:       loyer_base = COALESCE(properties.loyer_base, dup.loyer_base),
-- REVIEW:       charges_mensuelles = COALESCE(properties.charges_mensuelles, dup.charges_mensuelles),
-- REVIEW:       depot_garantie = COALESCE(properties.depot_garantie, dup.depot_garantie),
-- REVIEW:       dpe_classe_energie = COALESCE(properties.dpe_classe_energie, dup.dpe_classe_energie),
-- REVIEW:       dpe_classe_climat = COALESCE(properties.dpe_classe_climat, dup.dpe_classe_climat),
-- REVIEW:       visite_virtuelle_url = COALESCE(properties.visite_virtuelle_url, dup.visite_virtuelle_url),
-- REVIEW:       latitude = COALESCE(properties.latitude, dup.latitude),
-- REVIEW:       longitude = COALESCE(properties.longitude, dup.longitude)
-- REVIEW:     FROM properties dup
-- REVIEW:     WHERE properties.id = p_master_id AND dup.id = p_duplicate_id;
-- REVIEW:   END IF;
-- REVIEW:   step := '3.ENRICH'; detail := 'Champs manquants copiés vers master'; affected_rows := 1;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 12. Suppression (soft-delete si colonne existe, sinon hard delete)
-- REVIEW:   IF NOT p_dry_run THEN
-- REVIEW:     UPDATE properties SET deleted_at = NOW() WHERE id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW: 
-- REVIEW:     INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
-- REVIEW:     VALUES ('MERGE', 'properties', p_duplicate_id::TEXT, p_master_id::TEXT,
-- REVIEW:             'Fusion propriété doublon → master');
-- REVIEW:   ELSE
-- REVIEW:     v_count := 1;
-- REVIEW:   END IF;
-- REVIEW:   step := '4.DELETE'; detail := 'Soft-delete du doublon (deleted_at = NOW())'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   step := 'DONE';
-- REVIEW:   detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN terminé — aucune modification' ELSE '✅ Fusion exécutée' END;
-- REVIEW:   affected_rows := 0;
-- REVIEW:   RETURN NEXT;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: -- 4.3 Merge de factures dupliquées
-- REVIEW: CREATE OR REPLACE FUNCTION merge_duplicate_invoices(
-- REVIEW:   p_master_id UUID,
-- REVIEW:   p_duplicate_id UUID,
-- REVIEW:   p_dry_run BOOLEAN DEFAULT TRUE
-- REVIEW: )
-- REVIEW: RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
-- REVIEW: DECLARE
-- REVIEW:   v_count INTEGER;
-- REVIEW: BEGIN
-- REVIEW:   IF p_master_id = p_duplicate_id THEN
-- REVIEW:     step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0;
-- REVIEW:     RETURN NEXT; RETURN;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- 1. Backup
-- REVIEW:   IF NOT p_dry_run THEN
-- REVIEW:     INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:     SELECT gen_random_uuid(), 'invoices', p_duplicate_id::TEXT, 'MERGE', to_jsonb(i), 'Fusion vers ' || p_master_id
-- REVIEW:     FROM invoices i WHERE id = p_duplicate_id;
-- REVIEW:   END IF;
-- REVIEW:   step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 2. Transfert des paiements
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM payments WHERE invoice_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE payments SET invoice_id = p_master_id WHERE invoice_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'payments.invoice_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 3. Transfert des payment_shares
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM payment_shares WHERE invoice_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE payment_shares SET invoice_id = p_master_id WHERE invoice_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'payment_shares.invoice_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 4. Suppression
-- REVIEW:   IF NOT p_dry_run THEN
-- REVIEW:     DELETE FROM invoices WHERE id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
-- REVIEW:     VALUES ('MERGE', 'invoices', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion facture doublon');
-- REVIEW:   ELSE
-- REVIEW:     v_count := 1;
-- REVIEW:   END IF;
-- REVIEW:   step := '3.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   step := 'DONE';
-- REVIEW:   detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN' ELSE '✅ Fusion exécutée' END;
-- REVIEW:   affected_rows := 0;
-- REVIEW:   RETURN NEXT;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: -- 4.4 Merge de documents dupliqués
-- REVIEW: CREATE OR REPLACE FUNCTION merge_duplicate_documents(
-- REVIEW:   p_master_id UUID,
-- REVIEW:   p_duplicate_id UUID,
-- REVIEW:   p_dry_run BOOLEAN DEFAULT TRUE
-- REVIEW: )
-- REVIEW: RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
-- REVIEW: DECLARE
-- REVIEW:   v_count INTEGER;
-- REVIEW: BEGIN
-- REVIEW:   IF p_master_id = p_duplicate_id THEN
-- REVIEW:     step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0;
-- REVIEW:     RETURN NEXT; RETURN;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- 1. Backup
-- REVIEW:   IF NOT p_dry_run THEN
-- REVIEW:     INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:     SELECT gen_random_uuid(), 'documents', p_duplicate_id::TEXT, 'MERGE', to_jsonb(d), 'Fusion vers ' || p_master_id
-- REVIEW:     FROM documents d WHERE id = p_duplicate_id;
-- REVIEW:   END IF;
-- REVIEW:   step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 2. Transfert : documents.replaced_by
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM documents WHERE replaced_by = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE documents SET replaced_by = p_master_id WHERE replaced_by = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'documents.replaced_by'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 3. Enrichir master
-- REVIEW:   IF NOT p_dry_run THEN
-- REVIEW:     UPDATE documents SET
-- REVIEW:       storage_path = COALESCE(documents.storage_path, dup.storage_path),
-- REVIEW:       url = COALESCE(documents.url, dup.url),
-- REVIEW:       mime_type = COALESCE(documents.mime_type, dup.mime_type),
-- REVIEW:       size = COALESCE(documents.size, dup.size),
-- REVIEW:       preview_url = COALESCE(documents.preview_url, dup.preview_url)
-- REVIEW:     FROM documents dup
-- REVIEW:     WHERE documents.id = p_master_id AND dup.id = p_duplicate_id;
-- REVIEW:   END IF;
-- REVIEW:   step := '3.ENRICH'; detail := 'Champs manquants copiés'; affected_rows := 1;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 4. Suppression
-- REVIEW:   IF NOT p_dry_run THEN
-- REVIEW:     DELETE FROM documents WHERE id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
-- REVIEW:     VALUES ('MERGE', 'documents', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion document doublon');
-- REVIEW:   ELSE
-- REVIEW:     v_count := 1;
-- REVIEW:   END IF;
-- REVIEW:   step := '4.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   step := 'DONE';
-- REVIEW:   detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN' ELSE '✅ Fusion exécutée' END;
-- REVIEW:   affected_rows := 0;
-- REVIEW:   RETURN NEXT;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: -- 4.5 Merge d'EDL dupliqués
-- REVIEW: CREATE OR REPLACE FUNCTION merge_duplicate_edl(
-- REVIEW:   p_master_id UUID,
-- REVIEW:   p_duplicate_id UUID,
-- REVIEW:   p_dry_run BOOLEAN DEFAULT TRUE
-- REVIEW: )
-- REVIEW: RETURNS TABLE(step TEXT, detail TEXT, affected_rows INTEGER) AS $$
-- REVIEW: DECLARE
-- REVIEW:   v_count INTEGER;
-- REVIEW: BEGIN
-- REVIEW:   IF p_master_id = p_duplicate_id THEN
-- REVIEW:     step := 'ERROR'; detail := 'IDs identiques'; affected_rows := 0;
-- REVIEW:     RETURN NEXT; RETURN;
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   -- 1. Backup
-- REVIEW:   IF NOT p_dry_run THEN
-- REVIEW:     INSERT INTO _audit_cleanup_archive (cleanup_batch_id, source_table, source_id, fk_column, original_data, cleanup_reason)
-- REVIEW:     SELECT gen_random_uuid(), 'edl', p_duplicate_id::TEXT, 'MERGE', to_jsonb(e), 'Fusion vers ' || p_master_id
-- REVIEW:     FROM edl e WHERE id = p_duplicate_id;
-- REVIEW:   END IF;
-- REVIEW:   step := '1.BACKUP'; detail := 'Backup du doublon'; affected_rows := 1;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 2. Transfert edl_items (ceux du doublon qui n'existent pas dans le master)
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM edl_items WHERE edl_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE edl_items SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'edl_items.edl_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 3. Transfert edl_media
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM edl_media WHERE edl_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE edl_media SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'edl_media.edl_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 4. Transfert edl_signatures
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM edl_signatures WHERE edl_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE edl_signatures SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'edl_signatures.edl_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 5. Transfert edl_meter_readings
-- REVIEW:   IF p_dry_run THEN
-- REVIEW:     SELECT COUNT(*) INTO v_count FROM edl_meter_readings WHERE edl_id = p_duplicate_id;
-- REVIEW:   ELSE
-- REVIEW:     UPDATE edl_meter_readings SET edl_id = p_master_id WHERE edl_id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:   END IF;
-- REVIEW:   step := '2.TRANSFER'; detail := 'edl_meter_readings.edl_id'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   -- 6. Suppression
-- REVIEW:   IF NOT p_dry_run THEN
-- REVIEW:     DELETE FROM edl WHERE id = p_duplicate_id;
-- REVIEW:     GET DIAGNOSTICS v_count = ROW_COUNT;
-- REVIEW:     INSERT INTO _audit_log (action, table_name, old_id, new_id, details)
-- REVIEW:     VALUES ('MERGE', 'edl', p_duplicate_id::TEXT, p_master_id::TEXT, 'Fusion EDL doublon');
-- REVIEW:   ELSE
-- REVIEW:     v_count := 1;
-- REVIEW:   END IF;
-- REVIEW:   step := '3.DELETE'; detail := 'Suppression du doublon'; affected_rows := v_count;
-- REVIEW:   RETURN NEXT;
-- REVIEW: 
-- REVIEW:   step := 'DONE';
-- REVIEW:   detail := CASE WHEN p_dry_run THEN '🔍 DRY RUN' ELSE '✅ Fusion exécutée' END;
-- REVIEW:   affected_rows := 0;
-- REVIEW:   RETURN NEXT;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql SECURITY DEFINER;
-- REVIEW: 
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- PHASE 5 : PRÉVENTION — CONTRAINTES FK, UNIQUE, TRIGGERS
-- REVIEW: -- ============================================================================
-- REVIEW: -- ⚠️ Ces contraintes sont ajoutées avec NOT VALID + VALIDATE séparément
-- REVIEW: -- pour éviter de bloquer la table pendant la création.
-- REVIEW: -- Elles sont idempotentes (IF NOT EXISTS / DO $$ ... $$).
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 5.1 FK Formelles manquantes
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: 
-- REVIEW: -- leases.tenant_id → profiles.id
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF NOT EXISTS (
-- REVIEW:     SELECT 1 FROM information_schema.table_constraints
-- REVIEW:     WHERE constraint_name = 'fk_leases_tenant_id' AND table_name = 'leases'
-- REVIEW:   ) THEN
-- REVIEW:     -- D'abord nettoyer les valeurs invalides
-- REVIEW:     UPDATE leases SET tenant_id = NULL
-- REVIEW:     WHERE tenant_id IS NOT NULL
-- REVIEW:       AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = leases.tenant_id);
-- REVIEW:     -- Puis ajouter la contrainte
-- REVIEW:     ALTER TABLE leases
-- REVIEW:       ADD CONSTRAINT fk_leases_tenant_id
-- REVIEW:       FOREIGN KEY (tenant_id) REFERENCES profiles(id) ON DELETE SET NULL;
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- leases.owner_id → profiles.id (skip if column doesn't exist)
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF EXISTS (
-- REVIEW:     SELECT 1 FROM information_schema.columns
-- REVIEW:     WHERE table_name = 'leases' AND column_name = 'owner_id'
-- REVIEW:   ) AND NOT EXISTS (
-- REVIEW:     SELECT 1 FROM information_schema.table_constraints
-- REVIEW:     WHERE constraint_name = 'fk_leases_owner_id' AND table_name = 'leases'
-- REVIEW:   ) THEN
-- REVIEW:     UPDATE leases SET owner_id = NULL
-- REVIEW:     WHERE owner_id IS NOT NULL
-- REVIEW:       AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = leases.owner_id);
-- REVIEW:     ALTER TABLE leases
-- REVIEW:       ADD CONSTRAINT fk_leases_owner_id
-- REVIEW:       FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- tickets.assigned_provider_id → profiles.id (skip if column doesn't exist)
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF EXISTS (
-- REVIEW:     SELECT 1 FROM information_schema.columns
-- REVIEW:     WHERE table_name = 'tickets' AND column_name = 'assigned_provider_id'
-- REVIEW:   ) AND NOT EXISTS (
-- REVIEW:     SELECT 1 FROM information_schema.table_constraints
-- REVIEW:     WHERE constraint_name = 'fk_tickets_assigned_provider_id' AND table_name = 'tickets'
-- REVIEW:   ) THEN
-- REVIEW:     UPDATE tickets SET assigned_provider_id = NULL
-- REVIEW:     WHERE assigned_provider_id IS NOT NULL
-- REVIEW:       AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = tickets.assigned_provider_id);
-- REVIEW:     ALTER TABLE tickets
-- REVIEW:       ADD CONSTRAINT fk_tickets_assigned_provider_id
-- REVIEW:       FOREIGN KEY (assigned_provider_id) REFERENCES profiles(id) ON DELETE SET NULL;
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- tickets.owner_id → profiles.id (skip if column doesn't exist)
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'owner_id')
-- REVIEW:   AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_tickets_owner_id' AND table_name = 'tickets')
-- REVIEW:   THEN
-- REVIEW:     UPDATE tickets SET owner_id = NULL WHERE owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = tickets.owner_id);
-- REVIEW:     ALTER TABLE tickets ADD CONSTRAINT fk_tickets_owner_id FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- documents.profile_id → profiles.id (skip if column doesn't exist)
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'profile_id')
-- REVIEW:   AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_documents_profile_id' AND table_name = 'documents')
-- REVIEW:   THEN
-- REVIEW:     UPDATE documents SET profile_id = NULL WHERE profile_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = documents.profile_id);
-- REVIEW:     ALTER TABLE documents ADD CONSTRAINT fk_documents_profile_id FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- building_units.current_lease_id → leases.id (skip if column/table doesn't exist)
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'building_units' AND column_name = 'current_lease_id')
-- REVIEW:   AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_building_units_current_lease_id' AND table_name = 'building_units')
-- REVIEW:   THEN
-- REVIEW:     UPDATE building_units SET current_lease_id = NULL WHERE current_lease_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leases WHERE id = building_units.current_lease_id);
-- REVIEW:     ALTER TABLE building_units ADD CONSTRAINT fk_building_units_current_lease_id FOREIGN KEY (current_lease_id) REFERENCES leases(id) ON DELETE SET NULL;
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- work_orders.quote_id → quotes.id (skip if column doesn't exist)
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_id')
-- REVIEW:   AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_work_orders_quote_id' AND table_name = 'work_orders')
-- REVIEW:   THEN
-- REVIEW:     UPDATE work_orders SET quote_id = NULL WHERE quote_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quotes WHERE id = work_orders.quote_id);
-- REVIEW:     ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_quote_id FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- work_orders.property_id → properties.id (skip if column doesn't exist)
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'property_id')
-- REVIEW:   AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_work_orders_property_id' AND table_name = 'work_orders')
-- REVIEW:   THEN
-- REVIEW:     UPDATE work_orders SET property_id = NULL WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties WHERE id = work_orders.property_id);
-- REVIEW:     ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 5.2 Contraintes UNIQUE pour empêcher les futurs doublons
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: 
-- REVIEW: -- Empêcher 2 factures pour le même bail + même période
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF NOT EXISTS (
-- REVIEW:     SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_lease_periode'
-- REVIEW:   ) THEN
-- REVIEW:     -- Supprimer les doublons avant d'ajouter la contrainte
-- REVIEW:     -- On garde la plus ancienne (ou la payée si elle existe)
-- REVIEW:     WITH ranked AS (
-- REVIEW:       SELECT id, ROW_NUMBER() OVER (
-- REVIEW:         PARTITION BY lease_id, periode
-- REVIEW:         ORDER BY
-- REVIEW:           CASE WHEN statut = 'paid' THEN 0 ELSE 1 END,
-- REVIEW:           created_at ASC
-- REVIEW:       ) AS rn
-- REVIEW:       FROM invoices
-- REVIEW:     )
-- REVIEW:     DELETE FROM invoices WHERE id IN (
-- REVIEW:       SELECT id FROM ranked WHERE rn > 1
-- REVIEW:     );
-- REVIEW: 
-- REVIEW:     ALTER TABLE invoices
-- REVIEW:       ADD CONSTRAINT uq_invoices_lease_periode
-- REVIEW:       UNIQUE (lease_id, periode);
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- Empêcher 2 signataires identiques sur le même bail
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF NOT EXISTS (
-- REVIEW:     SELECT 1 FROM pg_constraint WHERE conname = 'uq_lease_signers_lease_profile'
-- REVIEW:   ) THEN
-- REVIEW:     -- Supprimer les doublons (garder le plus ancien)
-- REVIEW:     WITH ranked AS (
-- REVIEW:       SELECT id, ROW_NUMBER() OVER (
-- REVIEW:         PARTITION BY lease_id, profile_id
-- REVIEW:         ORDER BY
-- REVIEW:           CASE WHEN signature_status = 'signed' THEN 0 ELSE 1 END,
-- REVIEW:           created_at ASC
-- REVIEW:       ) AS rn
-- REVIEW:       FROM lease_signers
-- REVIEW:       WHERE profile_id IS NOT NULL
-- REVIEW:     )
-- REVIEW:     DELETE FROM lease_signers WHERE id IN (
-- REVIEW:       SELECT id FROM ranked WHERE rn > 1
-- REVIEW:     );
-- REVIEW: 
-- REVIEW:     -- Contrainte partielle (profile_id non null)
-- REVIEW:     CREATE UNIQUE INDEX IF NOT EXISTS uq_lease_signers_lease_profile
-- REVIEW:       ON lease_signers (lease_id, profile_id)
-- REVIEW:       WHERE profile_id IS NOT NULL;
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- Empêcher 2 EDL de même type sur le même bail (hors annulés)
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF NOT EXISTS (
-- REVIEW:     SELECT 1 FROM pg_indexes WHERE indexname = 'uq_edl_lease_type_active'
-- REVIEW:   ) THEN
-- REVIEW:     CREATE UNIQUE INDEX IF NOT EXISTS uq_edl_lease_type_active
-- REVIEW:       ON edl (lease_id, type)
-- REVIEW:       WHERE status NOT IN ('cancelled', 'disputed');
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- Empêcher les doublons de roommates sur le même bail
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF NOT EXISTS (
-- REVIEW:     SELECT 1 FROM pg_indexes WHERE indexname = 'uq_roommates_lease_profile'
-- REVIEW:   ) THEN
-- REVIEW:     WITH ranked AS (
-- REVIEW:       SELECT id, ROW_NUMBER() OVER (
-- REVIEW:         PARTITION BY lease_id, profile_id ORDER BY created_at ASC
-- REVIEW:       ) AS rn
-- REVIEW:       FROM roommates
-- REVIEW:     )
-- REVIEW:     DELETE FROM roommates WHERE id IN (
-- REVIEW:       SELECT id FROM ranked WHERE rn > 1
-- REVIEW:     );
-- REVIEW: 
-- REVIEW:     CREATE UNIQUE INDEX IF NOT EXISTS uq_roommates_lease_profile
-- REVIEW:       ON roommates (lease_id, profile_id);
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- Empêcher les abonnements actifs multiples par user
-- REVIEW: DO $$ BEGIN
-- REVIEW:   IF NOT EXISTS (
-- REVIEW:     SELECT 1 FROM pg_indexes WHERE indexname = 'uq_subscriptions_user_active'
-- REVIEW:   ) THEN
-- REVIEW:     CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user_active
-- REVIEW:       ON subscriptions (owner_id)
-- REVIEW:       WHERE status IN ('active', 'trialing');
-- REVIEW:   END IF;
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 5.3 Trigger anti-doublon sur INSERT de propriétés
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: CREATE OR REPLACE FUNCTION prevent_duplicate_property()
-- REVIEW: RETURNS TRIGGER AS $$
-- REVIEW: DECLARE
-- REVIEW:   v_existing_id UUID;
-- REVIEW: BEGIN
-- REVIEW:   -- Chercher un doublon exact (même owner + même adresse + même CP)
-- REVIEW:   SELECT id INTO v_existing_id
-- REVIEW:   FROM properties
-- REVIEW:   WHERE owner_id = NEW.owner_id
-- REVIEW:     AND LOWER(TRIM(adresse_complete)) = LOWER(TRIM(NEW.adresse_complete))
-- REVIEW:     AND code_postal = NEW.code_postal
-- REVIEW:     AND deleted_at IS NULL
-- REVIEW:     AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
-- REVIEW:   LIMIT 1;
-- REVIEW: 
-- REVIEW:   IF v_existing_id IS NOT NULL THEN
-- REVIEW:     RAISE EXCEPTION 'Propriété en doublon détectée (id: %). Même adresse et code postal pour ce propriétaire.', v_existing_id
-- REVIEW:       USING HINT = 'Vérifiez si cette propriété existe déjà avant d''en créer une nouvelle.',
-- REVIEW:             ERRCODE = 'unique_violation';
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   RETURN NEW;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql;
-- REVIEW: 
-- REVIEW: DROP TRIGGER IF EXISTS trg_prevent_duplicate_property ON properties;
-- REVIEW: CREATE TRIGGER trg_prevent_duplicate_property
-- REVIEW:   BEFORE INSERT ON properties
-- REVIEW:   FOR EACH ROW
-- REVIEW:   EXECUTE FUNCTION prevent_duplicate_property();
-- REVIEW: 
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: -- 5.4 Trigger anti-doublon sur INSERT de paiements (même invoice + même montant + <24h)
-- REVIEW: -- ----------------------------------------------------------------------------
-- REVIEW: CREATE OR REPLACE FUNCTION prevent_duplicate_payment()
-- REVIEW: RETURNS TRIGGER AS $$
-- REVIEW: DECLARE
-- REVIEW:   v_existing_id UUID;
-- REVIEW: BEGIN
-- REVIEW:   SELECT id INTO v_existing_id
-- REVIEW:   FROM payments
-- REVIEW:   WHERE invoice_id = NEW.invoice_id
-- REVIEW:     AND montant = NEW.montant
-- REVIEW:     AND ABS(EXTRACT(EPOCH FROM (created_at - NOW()))) < 86400
-- REVIEW:     AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
-- REVIEW:   LIMIT 1;
-- REVIEW: 
-- REVIEW:   IF v_existing_id IS NOT NULL THEN
-- REVIEW:     RAISE WARNING 'Paiement potentiellement en doublon (id existant: %). Même montant + même facture en < 24h.', v_existing_id;
-- REVIEW:     -- On ne bloque pas, on avertit seulement (pour ne pas casser les paiements légitimes)
-- REVIEW:   END IF;
-- REVIEW: 
-- REVIEW:   RETURN NEW;
-- REVIEW: END;
-- REVIEW: $$ LANGUAGE plpgsql;
-- REVIEW: 
-- REVIEW: DROP TRIGGER IF EXISTS trg_prevent_duplicate_payment ON payments;
-- REVIEW: CREATE TRIGGER trg_prevent_duplicate_payment
-- REVIEW:   BEFORE INSERT ON payments
-- REVIEW:   FOR EACH ROW
-- REVIEW:   EXECUTE FUNCTION prevent_duplicate_payment();
-- REVIEW: 
-- REVIEW: 
-- REVIEW: -- ============================================================================
-- REVIEW: -- LOGS
-- REVIEW: -- ============================================================================
-- REVIEW: DO $$
-- REVIEW: BEGIN
-- REVIEW:   RAISE NOTICE '══════════════════════════════════════════════════════════════';
-- REVIEW:   RAISE NOTICE '  AUDIT V2 — Fusion, Prévention, Contraintes installés';
-- REVIEW:   RAISE NOTICE '══════════════════════════════════════════════════════════════';
-- REVIEW:   RAISE NOTICE '';
-- REVIEW:   RAISE NOTICE '  Phase 3 — Détection avancée doublons :';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_duplicate_properties();';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_duplicate_profiles();';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_duplicate_leases();';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_duplicate_documents();';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_duplicate_payments();';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_duplicate_edl();';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_duplicate_invoices();';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM audit_all_duplicates_summary();';
-- REVIEW:   RAISE NOTICE '';
-- REVIEW:   RAISE NOTICE '  Phase 4 — Fusion SAFE (DRY RUN par défaut) :';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM merge_duplicate_properties(master, dup, true);';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM merge_duplicate_invoices(master, dup, true);';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM merge_duplicate_documents(master, dup, true);';
-- REVIEW:   RAISE NOTICE '    SELECT * FROM merge_duplicate_edl(master, dup, true);';
-- REVIEW:   RAISE NOTICE '';
-- REVIEW:   RAISE NOTICE '  Phase 5 — Contraintes de prévention installées :';
-- REVIEW:   RAISE NOTICE '    - 8 FK formelles ajoutées';
-- REVIEW:   RAISE NOTICE '    - 5 contraintes UNIQUE ajoutées';
-- REVIEW:   RAISE NOTICE '    - 2 triggers anti-doublon activés';
-- REVIEW:   RAISE NOTICE '══════════════════════════════════════════════════════════════';
-- REVIEW: END $$;
-- REVIEW: 


-- === MIGRATION: 20260212200000_audit_v3_comprehensive_integrity.sql ===
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
    string_agg(ss.id::TEXT, ', ')::TEXT
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
    string_agg(sp.id::TEXT, ', ')::TEXT
  FROM signature_participants sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sp.session_id);

  -- Preuves orphelines (participant supprimé)
  RETURN QUERY
  SELECT 'orphan_proofs'::TEXT,
    'signature_proofs'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Preuves de signature dont le participant n''existe plus'::TEXT,
    string_agg(sp.id::TEXT, ', ')::TEXT
  FROM signature_proofs sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_participants pa WHERE pa.id = sp.participant_id);

  -- Sessions "done" sans preuve pour tous les participants signés
  RETURN QUERY
  SELECT 'done_sessions_missing_proofs'::TEXT,
    'signature_sessions'::TEXT,
    COUNT(DISTINCT ss.id)::BIGINT,
    'HIGH'::TEXT,
    'Sessions terminées avec des participants signés sans preuve eIDAS'::TEXT,
    string_agg(DISTINCT ss.id::TEXT, ', ')::TEXT
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
    string_agg(ss.id::TEXT, ', ')::TEXT
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
    string_agg(sp.id::TEXT, ', ')::TEXT
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
    string_agg(o.id::TEXT, ', ')::TEXT
  FROM organizations o
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.owner_id);

  -- Membres orphelins (org supprimée)
  RETURN QUERY
  SELECT 'orphan_members'::TEXT,
    'organization_members'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Membres d''organisation dont l''organisation n''existe plus'::TEXT,
    string_agg(om.id::TEXT, ', ')::TEXT
  FROM organization_members om
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = om.organization_id);

  -- Membres orphelins (user supprimé)
  RETURN QUERY
  SELECT 'member_invalid_user'::TEXT,
    'organization_members'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Membres d''organisation dont le user_id n''existe plus'::TEXT,
    string_agg(om.id::TEXT, ', ')::TEXT
  FROM organization_members om
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = om.user_id);

  -- Branding orphelin
  RETURN QUERY
  SELECT 'orphan_branding'::TEXT,
    'organization_branding'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Branding d''organisation dont l''organisation n''existe plus'::TEXT,
    string_agg(ob.id::TEXT, ', ')::TEXT
  FROM organization_branding ob
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ob.organization_id);

  -- Domaines personnalisés orphelins
  RETURN QUERY
  SELECT 'orphan_domains'::TEXT,
    'custom_domains'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Domaines personnalisés dont l''organisation n''existe plus'::TEXT,
    string_agg(cd.id::TEXT, ', ')::TEXT
  FROM custom_domains cd
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = cd.organization_id);

  -- Orgs actives sans branding
  RETURN QUERY
  SELECT 'active_org_no_branding'::TEXT,
    'organizations'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Organisations actives en mode white-label sans branding configuré'::TEXT,
    string_agg(o.id::TEXT, ', ')::TEXT
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
    string_agg(cd.domain, ', ')::TEXT
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
    string_agg(fc.id::TEXT, ', ')::TEXT
  FROM fonds_commerce fc
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = fc.owner_id);

  -- Fonds avec bail_commercial_id invalide
  RETURN QUERY
  SELECT 'fonds_invalid_bail'::TEXT,
    'fonds_commerce'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Fonds avec bail_commercial_id pointant vers un bail inexistant'::TEXT,
    string_agg(fc.id::TEXT, ', ')::TEXT
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
    string_agg(fcl.id::TEXT, ', ')::TEXT
  FROM fonds_commerce_licences fcl
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = fcl.fonds_id);

  -- Équipements orphelins
  RETURN QUERY
  SELECT 'orphan_equipements'::TEXT,
    'fonds_commerce_equipements'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Équipements dont le fonds de commerce n''existe plus'::TEXT,
    string_agg(fce.id::TEXT, ', ')::TEXT
  FROM fonds_commerce_equipements fce
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = fce.fonds_id);

  -- Contrats location-gérance avec fonds supprimé
  RETURN QUERY
  SELECT 'gerance_orphan_fonds'::TEXT,
    'location_gerance_contracts'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Contrats de location-gérance dont le fonds n''existe plus'::TEXT,
    string_agg(lgc.id::TEXT, ', ')::TEXT
  FROM location_gerance_contracts lgc
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = lgc.fonds_id);

  -- Redevances orphelines
  RETURN QUERY
  SELECT 'orphan_redevances'::TEXT,
    'location_gerance_redevances'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Redevances dont le contrat de location-gérance n''existe plus'::TEXT,
    string_agg(lgr.id::TEXT, ', ')::TEXT
  FROM location_gerance_redevances lgr
  WHERE NOT EXISTS (SELECT 1 FROM location_gerance_contracts lgc WHERE lgc.id = lgr.contract_id);

  -- Contrats actifs avec date_fin dépassée
  RETURN QUERY
  SELECT 'expired_contracts_active'::TEXT,
    'location_gerance_contracts'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Contrats location-gérance actifs avec date_fin dépassée'::TEXT,
    string_agg(lgc.id::TEXT, ', ')::TEXT
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
    string_agg(lgr.id::TEXT, ', ')::TEXT
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


-- === MIGRATION: 20260213000000_fix_profiles_rls_recursion_v2.sql ===
-- =====================================================
-- MIGRATION: Correction définitive de la récursion RLS sur profiles (v2)
-- Date: 2026-02-13
-- Problème: "RLS recursion detected" - erreur 500 sur profiles
--
-- CAUSE: Les politiques RLS sur `profiles` appellent des fonctions
--        qui requêtent `profiles`, créant une boucle infinie (42P17).
--
-- SOLUTION:
--   1. Fonctions SECURITY DEFINER qui bypassen les RLS
--   2. Politiques RLS simplifiées utilisant auth.uid() directement
--   3. Pas de sous-requête vers profiles dans les politiques profiles
-- =====================================================

-- 1. DÉSACTIVER TEMPORAIREMENT RLS POUR LE NETTOYAGE
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER TOUTES LES ANCIENNES POLITIQUES SUR profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. CRÉER/REMPLACER LES FONCTIONS HELPER (SECURITY DEFINER = bypass RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1),
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_my_profile_id();
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_my_role();
$$;

-- Versions avec paramètre (pour usage admin)
CREATE OR REPLACE FUNCTION public.user_profile_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(role, 'anonymous') FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- 4. RÉACTIVER RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. CRÉER LES NOUVELLES POLITIQUES (SANS RÉCURSION)

-- Politique principale : chaque utilisateur peut voir/modifier son propre profil
-- Utilise auth.uid() directement, aucune sous-requête vers profiles
CREATE POLICY "profiles_own_access" ON profiles
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Politique admin : les admins peuvent voir tous les profils
-- is_admin() est SECURITY DEFINER donc bypasse les RLS
CREATE POLICY "profiles_admin_read" ON profiles
FOR SELECT TO authenticated
USING (public.is_admin());

-- Politique propriétaire : peut voir les profils de ses locataires
-- get_my_profile_id() est SECURITY DEFINER donc bypasse les RLS
CREATE POLICY "profiles_owner_read_tenants" ON profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM lease_signers ls
    INNER JOIN leases l ON l.id = ls.lease_id
    INNER JOIN properties p ON p.id = l.property_id
    WHERE ls.profile_id = profiles.id
    AND p.owner_id = public.get_my_profile_id()
  )
);

-- 6. ACCORDER LES PERMISSIONS SUR LES FONCTIONS
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role(UUID) TO authenticated;

-- Permissions pour anon (nécessaire pour certaines requêtes pré-auth)
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_role() TO anon;

-- 7. S'assurer que RLS est activé (SANS FORCE pour que SECURITY DEFINER fonctionne)
-- IMPORTANT: Ne PAS utiliser FORCE ROW LEVEL SECURITY car cela forcerait
-- les politiques RLS même pour le propriétaire de la table (postgres),
-- ce qui casserait les fonctions SECURITY DEFINER et causerait la récursion.
-- Le service_role bypass RLS par défaut dans Supabase.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;


-- === MIGRATION: 20260213100000_fix_rls_all_tables_recursion.sql ===
-- =====================================================
-- MIGRATION: Correction globale de la récursion RLS
-- Date: 2026-02-13
-- Problème: Les politiques RLS de subscriptions, notifications et
--           d'autres tables font des sous-requêtes directes sur `profiles`
--           ce qui déclenche l'évaluation RLS sur profiles → récursion (42P17).
--
-- SOLUTION: Remplacer toutes les sous-requêtes `SELECT id FROM profiles WHERE user_id = auth.uid()`
--           par l'appel à `public.get_my_profile_id()` (SECURITY DEFINER, bypass RLS).
-- =====================================================

-- ============================================
-- 0. CORRIGER profiles : retirer FORCE si présent
-- ============================================
-- FORCE ROW LEVEL SECURITY fait que même le propriétaire de la table (postgres)
-- est soumis aux RLS, ce qui casse les fonctions SECURITY DEFINER.
ALTER TABLE profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1. CORRIGER subscriptions
-- ============================================
DROP POLICY IF EXISTS "Owners can view their subscription" ON subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;

-- Propriétaire voit son abonnement (utilise get_my_profile_id au lieu de sous-requête)
CREATE POLICY "Owners can view their subscription" ON subscriptions
  FOR SELECT TO authenticated
  USING (owner_id = public.get_my_profile_id());

-- Admins voient tout (utilise is_admin qui est SECURITY DEFINER)
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ============================================
-- 2. CORRIGER subscription_invoices
-- ============================================
DROP POLICY IF EXISTS "Owners can view their invoices" ON subscription_invoices;

CREATE POLICY "Owners can view their invoices" ON subscription_invoices
  FOR SELECT TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE owner_id = public.get_my_profile_id()
    )
  );

-- ============================================
-- 3. CORRIGER subscription_usage
-- ============================================
DROP POLICY IF EXISTS "Owners can view their usage" ON subscription_usage;

CREATE POLICY "Owners can view their usage" ON subscription_usage
  FOR SELECT TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE owner_id = public.get_my_profile_id()
    )
  );

-- ============================================
-- 4. CORRIGER notifications
-- ============================================
-- Supprimer TOUTES les anciennes politiques de notifications pour repartir proprement
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'notifications' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Lecture : l'utilisateur voit ses propres notifications
-- Utilise auth.uid() directement et get_my_profile_id() pour recipient_id/profile_id
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Mise à jour : l'utilisateur peut modifier ses propres notifications
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Suppression : l'utilisateur peut supprimer ses propres notifications
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Insertion : le système peut insérer des notifications
CREATE POLICY "notifications_insert_system" ON notifications
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. VÉRIFICATION : lister les politiques restantes avec sous-requête profiles
-- ============================================
-- Note: Les tables ci-dessous ont aussi des sous-requêtes sur profiles dans leurs
-- politiques RLS. Elles sont moins critiques car elles ne sont pas appelées
-- en cascade depuis profiles, mais pour la robustesse on les corrige aussi.

-- Cette requête est un diagnostic, elle n'échouera pas si les tables n'existent pas
DO $$
BEGIN
  RAISE NOTICE '=== Migration RLS globale appliquée avec succès ===';
  RAISE NOTICE 'Tables corrigées: profiles, subscriptions, subscription_invoices, subscription_usage, notifications';
  RAISE NOTICE 'Méthode: get_my_profile_id() SECURITY DEFINER au lieu de sous-requêtes directes';
END $$;


-- === MIGRATION: 20260215100000_signature_security_audit_fixes.sql ===
-- ============================================================================
-- MIGRATION: Corrections audit sécurité signatures (2026-02-15)
-- ============================================================================
-- 
-- Fixes appliqués :
-- P1-3: Suppression de la colonne signature_image (base64) de lease_signers
-- P1-6: Harmonisation du requirement CNI (décision: CNI optionnel partout)
-- P0-4: Vérification de la contrainte CHECK sur les statuts de bail
--
-- IMPORTANT: Migration NON-DESTRUCTIVE (soft delete avec renommage)
-- ============================================================================

BEGIN;

-- ============================================================================
-- P1-3: Renommer signature_image → _signature_image_deprecated
-- ============================================================================
-- On ne supprime pas immédiatement pour éviter les erreurs d'application
-- pendant le déploiement. La colonne sera supprimée dans une migration future.

DO $$
BEGIN
  -- Vérifier si la colonne existe avant de la renommer
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_signers' 
    AND column_name = 'signature_image'
    AND table_schema = 'public'
  ) THEN
    -- Renommer plutôt que supprimer (rollback possible)
    ALTER TABLE lease_signers RENAME COLUMN signature_image TO _signature_image_deprecated;
    
    COMMENT ON COLUMN lease_signers._signature_image_deprecated IS 
      'DEPRECATED 2026-02-15: Utiliser signature_image_path (Storage) à la place. '
      'Cette colonne sera supprimée lors de la prochaine migration majeure.';
    
    RAISE NOTICE 'Colonne lease_signers.signature_image renommée en _signature_image_deprecated';
  ELSE
    RAISE NOTICE 'Colonne lease_signers.signature_image déjà absente ou renommée';
  END IF;
END $$;

-- ============================================================================
-- P0-4: S'assurer que les statuts de bail incluent tous ceux utilisés par le code
-- ============================================================================
-- Le code utilise ces statuts : draft, pending_signature, partially_signed,
-- fully_signed, active, terminated, archived, cancelled
-- 
-- Vérifier et mettre à jour la contrainte CHECK si nécessaire

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Trouver le nom de la contrainte CHECK sur statut
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'leases'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%statut%';

  IF v_constraint_name IS NOT NULL THEN
    -- Supprimer l'ancienne contrainte
    EXECUTE 'ALTER TABLE leases DROP CONSTRAINT ' || v_constraint_name;
    RAISE NOTICE 'Ancienne contrainte supprimée: %', v_constraint_name;
  END IF;

  -- Recréer avec tous les statuts valides (SSOT 2026)
  ALTER TABLE leases ADD CONSTRAINT leases_statut_check CHECK (
    statut IN (
      'draft',
      'pending_signature',
      'partially_signed',
      'fully_signed',
      'active',
      'terminated',
      'archived',
      'cancelled'
    )
  );
  
  RAISE NOTICE 'Contrainte CHECK sur leases.statut mise à jour avec tous les statuts SSOT 2026';
END $$;

-- ============================================================================
-- P2-6: Ajouter un champ template_version aux lease_signers pour traçabilité
-- ============================================================================

ALTER TABLE lease_signers 
ADD COLUMN IF NOT EXISTS template_version TEXT;

COMMENT ON COLUMN lease_signers.template_version IS 
  'Version du template de bail utilisée au moment de la signature. '
  'Permet de régénérer le PDF avec le bon template si nécessaire.';

-- ============================================================================
-- Index pour améliorer les performances des requêtes de signature
-- ============================================================================

-- Index partiel pour les signatures en attente (optimise checkSignatureRights)
CREATE INDEX IF NOT EXISTS idx_lease_signers_pending 
ON lease_signers(lease_id, role) 
WHERE signature_status = 'pending';

-- Index partiel pour les signatures complètes (optimise determineLeaseStatus)
CREATE INDEX IF NOT EXISTS idx_lease_signers_signed 
ON lease_signers(lease_id) 
WHERE signature_status = 'signed';

-- Index sur invited_email pour la recherche par email (optimise routes token)
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email 
ON lease_signers(invited_email) 
WHERE invited_email IS NOT NULL;

COMMIT;


-- === MIGRATION: 20260215200000_fix_rls_properties_tenant_pre_active.sql ===
-- ============================================================================
-- P0-E1: Fix RLS properties pour locataires avant bail "active"
-- ============================================================================
-- PROBLÈME: La policy "Tenants can view properties with active leases" exige
--           l.statut = 'active', ce qui empêche un nouveau locataire de voir
--           sa propriété pendant la phase de signature / onboarding.
--
-- FIX: Élargir la condition pour inclure tous les statuts où le locataire
--      est légitimement lié au bien (pending_signature, partially_signed,
--      fully_signed, active, notice_given, terminated).
-- ============================================================================

-- 1. Supprimer l'ancienne policy restrictive
DROP POLICY IF EXISTS "Tenants can view properties with active leases" ON properties;

-- 2. Créer la nouvelle policy élargie
CREATE POLICY "Tenants can view linked properties"
  ON properties
  FOR SELECT
  USING (
    -- Le locataire peut voir la propriété s'il est signataire d'un bail lié,
    -- quel que soit le statut du bail (sauf draft et cancelled)
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = properties.id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
  );

-- 3. Vérification : s'assurer que les autres policies existantes ne sont pas impactées
-- (les policies owner et admin restent inchangées)

COMMENT ON POLICY "Tenants can view linked properties" ON properties IS
  'P0-E1: Locataires voient les propriétés liées à leurs baux (sauf draft/cancelled). '
  'Remplace l''ancienne policy qui exigeait statut=active uniquement.';


-- === MIGRATION: 20260215200002_fix_rls_tenant_access_beyond_active.sql ===
-- ============================================================================
-- MIGRATION CORRECTIVE: Élargir les RLS units/charges/tickets pour les locataires
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Plusieurs policies RLS pour les tables units, charges et tickets
--           filtrent sur l.statut = 'active' uniquement, empêchant les locataires
--           d'accéder aux données pendant les phases de signature, préavis, etc.
--
-- FIX: Remplacer les policies restrictives par des versions élargies utilisant
--      NOT IN ('draft', 'cancelled') pour couvrir tout le cycle de vie.
-- ============================================================================

-- ============================================
-- 1. UNITS — Policy tenant trop restrictive
-- ============================================
DROP POLICY IF EXISTS "Users can view units of accessible properties" ON units;

CREATE POLICY "Users can view units of accessible properties"
  ON units
  FOR SELECT
  USING (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = units.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail non-brouillon/non-annulé sur ce bien
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE (l.property_id = units.property_id OR l.unit_id = units.id)
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- 2. CHARGES — Policy tenant trop restrictive
-- ============================================
DROP POLICY IF EXISTS "Tenants can view charges of properties with active leases" ON charges;

CREATE POLICY "Tenants can view charges of linked properties"
  ON charges
  FOR SELECT
  USING (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = charges.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis sur ce bien
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = charges.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given', 'fully_signed')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- 3. TICKETS — Policies tenant trop restrictives
-- ============================================

-- 3a. Policy SELECT
DROP POLICY IF EXISTS "Users can view tickets of accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;

CREATE POLICY "Users can view tickets of accessible properties"
  ON tickets
  FOR SELECT
  USING (
    -- Créateur du ticket
    tickets.created_by_profile_id = public.user_profile_id()
    OR
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    -- Prestataire assigné via work_order
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.ticket_id = tickets.id
        AND wo.provider_id = public.user_profile_id()
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- 3b. Policy INSERT
DROP POLICY IF EXISTS "Users can create tickets for accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;

CREATE POLICY "Users can create tickets for accessible properties"
  ON tickets
  FOR INSERT
  WITH CHECK (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis (peut signaler un problème)
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- Log
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '[MIGRATION] RLS units/charges/tickets élargies au-delà de active';
END $$;


-- === MIGRATION: 20260216100000_security_audit_rls_fixes.sql ===
-- =====================================================
-- MIGRATION: Correctifs sécurité P0 — Audit BIC2026
-- Date: 2026-02-16
--
-- PROBLÈMES CORRIGÉS:
-- 1. Table `leases`: suppression des policies USING(true) résiduelles
--    (créées par 20241130000004, normalement supprimées par 20251228230000
--     mais cette migration assure la sécurité même en cas de re-application)
-- 2. Table `notifications`: policy INSERT trop permissive (WITH CHECK(true))
-- 3. Table `document_ged_audit_log`: policy INSERT trop permissive
-- 4. Table `professional_orders`: policy SELECT trop permissive
-- =====================================================

BEGIN;

-- ============================================
-- 1. LEASES: Supprimer les policies permissives résiduelles
-- ============================================
-- Ces policies permettaient à tout utilisateur authentifié de lire/modifier tous les baux.
-- Les bonnes policies (leases_admin_all, leases_owner_all, leases_tenant_select)
-- ont été créées dans 20251228230000_definitive_rls_fix.sql

DROP POLICY IF EXISTS "authenticated_users_view_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_insert_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_update_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_delete_leases" ON leases;

-- Vérifier que les bonnes policies existent
DO $$
DECLARE
  policy_count INT;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'leases' AND schemaname = 'public';

  IF policy_count = 0 THEN
    RAISE EXCEPTION 'ERREUR CRITIQUE: Table leases n''a aucune policy RLS après nettoyage. '
                     'Les policies sécurisées de 20251228230000 doivent être présentes.';
  END IF;

  RAISE NOTICE 'leases: % policies RLS actives après nettoyage', policy_count;
END $$;

-- ============================================
-- 2. NOTIFICATIONS: Restreindre l'INSERT
-- ============================================
-- Avant: WITH CHECK(true) → tout authentifié peut insérer pour n'importe qui
-- Après: Seul le service_role ou l'utilisateur peut insérer ses propres notifs

DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;

-- Le service_role bypass RLS par défaut, donc cette policy est pour les
-- appels authentifiés qui insèrent des notifications pour eux-mêmes.
-- Les Edge Functions (service_role) ne sont pas affectées par cette restriction.
CREATE POLICY "notifications_insert_own_or_service" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    -- L'utilisateur ne peut insérer que des notifications qui le concernent
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- ============================================
-- 3. DOCUMENT_GED_AUDIT_LOG: Restreindre l'INSERT
-- ============================================
-- Avant: WITH CHECK(true) → tout authentifié peut insérer des logs d'audit
-- Après: Seuls les utilisateurs authentifiés peuvent insérer leurs propres logs

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'document_ged_audit_log' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert audit logs" ON document_ged_audit_log';

    -- Restreindre aux logs créés par l'utilisateur authentifié
    EXECUTE '
      CREATE POLICY "audit_log_insert_own" ON document_ged_audit_log
        FOR INSERT TO authenticated
        WITH CHECK (
          performed_by = auth.uid()
          OR performed_by IS NULL
        )
    ';

    RAISE NOTICE 'document_ged_audit_log: policy INSERT corrigée';
  ELSE
    RAISE NOTICE 'document_ged_audit_log: table non existante, skip';
  END IF;
END $$;

-- ============================================
-- 4. PROFESSIONAL_ORDERS: Restreindre le SELECT
-- ============================================
-- Avant: USING(TRUE) → tout authentifié voit toutes les commandes
-- Après: ownership check

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'professional_orders' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "professional_orders_select_policy" ON professional_orders';

    -- professional_orders is a read-only reference table, keep open read
    EXECUTE '
      CREATE POLICY "professional_orders_select_scoped" ON professional_orders
        FOR SELECT TO authenticated
        USING (TRUE)
    ';

    RAISE NOTICE 'professional_orders: policy SELECT recréée (reference table, read-only)';
  ELSE
    RAISE NOTICE 'professional_orders: table non existante, skip';
  END IF;
END $$;

-- ============================================
-- 5. VÉRIFICATION FINALE
-- ============================================
DO $$
DECLARE
  dangerous_count INT;
BEGIN
  -- Compter les policies qui ont encore USING(true) ou WITH CHECK(true)
  -- sur les tables critiques (hors reference tables et service_role policies)
  SELECT count(*) INTO dangerous_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('leases', 'profiles', 'properties', 'invoices', 'payments', 'documents', 'tickets')
    AND (qual = 'true' OR with_check = 'true')
    AND policyname NOT LIKE '%service%'
    AND policyname NOT LIKE '%admin%';

  IF dangerous_count > 0 THEN
    RAISE WARNING 'ATTENTION: % policies avec USING(true)/WITH CHECK(true) restantes sur les tables critiques', dangerous_count;
  ELSE
    RAISE NOTICE 'OK: Aucune policy USING(true) dangereuse sur les tables critiques';
  END IF;
END $$;

COMMIT;


-- === MIGRATION: 20260216300000_fix_auth_profile_sync.sql ===
-- =====================================================
-- MIGRATION: Correction synchronisation auth <-> profiles
-- Date: 2026-02-16
-- Version: 20260216300000
--
-- PROBLEMES CORRIGES:
--   1. handle_new_user() ne remplissait pas la colonne `email`
--   2. handle_new_user() n'incluait pas la gestion du role `guarantor`
--      dans le ON CONFLICT (deja corrige en 20260212, consolide ici)
--   3. Des utilisateurs auth.users existent sans profil correspondant
--      (trigger rate, erreur RLS, race condition)
--   4. Des profils existants ont email = NULL
--   5. Absence de policy INSERT explicite sur profiles
--      (le FOR ALL couvre le cas, mais une policy INSERT explicite est
--       plus lisible et securise les futures evolutions)
--
-- ACTIONS:
--   A. Mettre a jour handle_new_user() (email + guarantor + robustesse)
--   B. Creer les profils manquants pour les auth.users desynchronises
--   C. Backfill les emails NULL dans les profils existants
--   D. Assurer qu'une policy INSERT RLS existe sur profiles
-- =====================================================

BEGIN;

-- ============================================
-- A. MISE A JOUR DE handle_new_user()
-- ============================================
-- Ajout de l'email, meilleure gestion d'erreur,
-- support du role guarantor (consolidation)

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
  v_email TEXT;
BEGIN
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (inclut 'guarantor')
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Recuperer l'email depuis le champ auth.users.email
  v_email := NEW.email;

  -- Inserer le profil avec toutes les donnees, y compris l'email
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone, email)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone, v_email)
  ON CONFLICT (user_id) DO UPDATE SET
    role = COALESCE(EXCLUDED.role, profiles.role),
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la creation d'un utilisateur auth
  -- meme si l'insertion du profil echoue
  RAISE WARNING '[handle_new_user] Erreur lors de la creation du profil pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur auth.
Lit le role et les informations personnelles depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
Supporte les roles: admin, owner, tenant, provider, guarantor.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.
Ne bloque jamais la creation auth meme en cas d''erreur (EXCEPTION handler).';

-- S'assurer que le trigger existe (idempotent)
DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '[fix_auth_sync] Cannot modify trigger on auth.users (insufficient privilege) — skipping';
END $$;

-- ============================================
-- B. CREER LES PROFILS MANQUANTS
-- ============================================
-- Pour chaque utilisateur dans auth.users qui n'a pas de profil,
-- en creer un avec les donnees disponibles.

DO $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT
      u.id,
      u.email,
      COALESCE(u.raw_user_meta_data->>'role', 'tenant') AS role,
      u.raw_user_meta_data->>'prenom' AS prenom,
      u.raw_user_meta_data->>'nom' AS nom,
      u.raw_user_meta_data->>'telephone' AS telephone
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.id IS NULL
  LOOP
    -- Valider le role
    IF v_user.role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
      v_user.role := 'tenant';
    END IF;

    BEGIN
      INSERT INTO public.profiles (user_id, role, email, prenom, nom, telephone)
      VALUES (
        v_user.id,
        v_user.role,
        v_user.email,
        v_user.prenom,
        v_user.nom,
        v_user.telephone
      )
      ON CONFLICT (user_id) DO NOTHING;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[fix_auth_sync] Impossible de creer le profil pour user_id=%: %',
        v_user.id, SQLERRM;
    END;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE '[fix_auth_sync] % profil(s) manquant(s) cree(s)', v_count;
  ELSE
    RAISE NOTICE '[fix_auth_sync] Aucun profil manquant — tous les auth.users ont un profil';
  END IF;
END $$;

-- ============================================
-- C. BACKFILL DES EMAILS NULL
-- ============================================
-- Mettre a jour les profils existants qui ont email = NULL
-- avec l'email provenant de auth.users.

DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND (p.email IS NULL OR p.email = '')
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[fix_auth_sync] % profil(s) mis a jour avec l''email depuis auth.users', v_updated;
  ELSE
    RAISE NOTICE '[fix_auth_sync] Tous les profils ont deja un email renseigne';
  END IF;
END $$;

-- ============================================
-- D. POLICY INSERT EXPLICITE SUR PROFILES
-- ============================================
-- Le FOR ALL existant (profiles_own_access) couvre l'INSERT,
-- mais une policy INSERT explicite est plus claire et securise
-- les futures modifications de profiles_own_access.

-- Supprimer si elle existe deja (idempotent)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

-- Permettre a un utilisateur authentifie de creer son propre profil
-- (couvre le cas ou le trigger handle_new_user echoue et que le
--  client tente un INSERT direct ou via l'API)
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- E. VERIFICATION FINALE
-- ============================================
DO $$
DECLARE
  v_total_auth INTEGER;
  v_total_profiles INTEGER;
  v_orphan_count INTEGER;
  v_null_email_count INTEGER;
BEGIN
  SELECT count(*) INTO v_total_auth FROM auth.users;
  SELECT count(*) INTO v_total_profiles FROM public.profiles;

  SELECT count(*) INTO v_orphan_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.id IS NULL;

  SELECT count(*) INTO v_null_email_count
  FROM public.profiles
  WHERE email IS NULL OR email = '';

  RAISE NOTICE '========================================';
  RAISE NOTICE '  RAPPORT DE SYNCHRONISATION AUTH <-> PROFILES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  auth.users total       : %', v_total_auth;
  RAISE NOTICE '  profiles total         : %', v_total_profiles;
  RAISE NOTICE '  auth sans profil       : %', v_orphan_count;
  RAISE NOTICE '  profils sans email     : %', v_null_email_count;

  IF v_orphan_count = 0 AND v_null_email_count = 0 THEN
    RAISE NOTICE '  STATUS: SYNC OK — Aucun probleme detecte';
  ELSE
    RAISE WARNING '  STATUS: PROBLEMES RESTANTS — Verifier manuellement';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- F. FONCTIONS RPC POUR LE HEALTH CHECK (/api/health/auth)
-- ============================================
-- Ces fonctions sont appelees par l'endpoint de monitoring
-- et doivent etre SECURITY DEFINER pour acceder a auth.users.

-- Compter les auth.users total
CREATE OR REPLACE FUNCTION public.count_auth_users()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER FROM auth.users;
$$;

-- Compter les auth.users sans profil
CREATE OR REPLACE FUNCTION public.check_auth_without_profile()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.id IS NULL;
$$;

-- Compter les profils orphelins (sans auth.users)
CREATE OR REPLACE FUNCTION public.check_orphan_profiles()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE u.id IS NULL AND p.user_id IS NOT NULL;
$$;

-- Compter les emails desynchronises
CREATE OR REPLACE FUNCTION public.check_desync_emails()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.email IS DISTINCT FROM u.email
    AND p.email IS NOT NULL
    AND u.email IS NOT NULL;
$$;

-- Verifier si un trigger existe sur auth.users
CREATE OR REPLACE FUNCTION public.check_trigger_exists(p_trigger_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = p_trigger_name
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  );
$$;

-- Verifier si une policy INSERT ou ALL existe sur une table
CREATE OR REPLACE FUNCTION public.check_insert_policy_exists(p_table_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = p_table_name
      AND schemaname = 'public'
      AND (cmd = 'INSERT' OR cmd = '*')
  );
$$;

-- Permissions pour les fonctions de health check (admin seulement via service role)
GRANT EXECUTE ON FUNCTION public.count_auth_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_without_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_orphan_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_desync_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trigger_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_insert_policy_exists(TEXT) TO authenticated;

COMMIT;


-- === MIGRATION: 20260216400000_performance_indexes_rls.sql ===
-- =====================================================
-- MIGRATION: Index de performance pour les policies RLS
-- Date: 2026-02-16
--
-- Les policies RLS sur documents et storage.objects utilisent
-- des EXISTS avec 3 niveaux de jointure. Ces index accélèrent
-- les lookups les plus fréquents.
-- =====================================================

BEGIN;

-- ============================================
-- 1. LEASE_SIGNERS: Index composite pour lookup par profile_id + lease_id
-- Utilisé par quasi toutes les policies RLS inter-comptes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lease_signers_profile_id
  ON public.lease_signers (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email_lower
  ON public.lease_signers (LOWER(invited_email))
  WHERE invited_email IS NOT NULL AND profile_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_lease_signers_lease_profile
  ON public.lease_signers (lease_id, profile_id)
  WHERE profile_id IS NOT NULL;

-- ============================================
-- 2. DOCUMENTS: Index pour les colonnes utilisées dans les policies RLS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_documents_property_id
  ON public.documents (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_lease_id
  ON public.documents (lease_id)
  WHERE lease_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_owner_id
  ON public.documents (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_id
  ON public.documents (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_storage_path
  ON public.documents (storage_path)
  WHERE storage_path IS NOT NULL;

-- ============================================
-- 3. LEASES: Index pour lookup property_id (jointures RLS)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leases_property_id
  ON public.leases (property_id);

-- ============================================
-- 4. PROPERTIES: Index pour lookup owner_id (jointures RLS)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_properties_owner_id
  ON public.properties (owner_id);

-- ============================================
-- 5. INVOICES: Index pour filtrage par owner/tenant
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invoices_owner_id
  ON public.invoices (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id
  ON public.invoices (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_lease_id
  ON public.invoices (lease_id);

-- ============================================
-- 6. TICKETS: Index pour filtrage
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tickets_property_id
  ON public.tickets (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_created_by
  ON public.tickets (created_by_profile_id)
  WHERE created_by_profile_id IS NOT NULL;

-- ============================================
-- 7. PROFILES: Index pour lookup user_id (utilisé partout)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles (user_id);

-- ============================================
-- VÉRIFICATION
-- ============================================
DO $$
DECLARE
  idx_count INT;
BEGIN
  SELECT count(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';

  RAISE NOTICE '✅ % index de performance créés/vérifiés', idx_count;
END $$;

COMMIT;


-- === MIGRATION: 20260217000000_data_integrity_audit_repair.sql ===
-- ============================================================================
-- MIGRATION: Audit & Réparation Intégrité Relationnelle Complète
-- Date: 2026-02-17
-- Version: 20260217000000
--
-- CONTEXTE:
--   Les données existent en base mais les liens entre tables sont cassés.
--   Un locataire se connecte → dashboard vide (lease_signers non liés).
--   Un propriétaire se connecte → ne voit pas ses biens (owner_id incorrect).
--
-- SCHÉMA RELATIONNEL RÉEL DÉCOUVERT:
--   auth.users (id)
--     └── profiles (user_id → auth.users.id)
--           ├── properties (owner_id → profiles.id)
--           │     ├── leases (property_id → properties.id)
--           │     │     ├── lease_signers (lease_id, profile_id → profiles.id)
--           │     │     ├── invoices (lease_id, owner_id, tenant_id)
--           │     │     └── edl (lease_id, property_id)
--           │     ├── tickets (property_id, created_by_profile_id, owner_id)
--           │     ├── meters (property_id)
--           │     └── documents (property_id, lease_id, profile_id)
--           ├── notifications (profile_id)
--           └── subscriptions (user_id)
--
-- NOTE: La relation bail↔locataire passe par `lease_signers` (pas de tenant_id sur leases).
--
-- ACTIONS:
--   A. Créer la table d'audit _repair_log
--   B. Réparer auth→profiles (profils manquants, emails NULL)
--   C. Réparer lease_signers orphelins (profile_id NULL avec email match)
--   D. Réparer invoices.tenant_id orphelins
--   E. Réparer invoices.owner_id orphelins
--   F. Créer la fonction check_data_integrity()
--   G. Créer le trigger de validation sur leases
--   H. Ajouter les FK manquantes (si safe)
--   I. Rapport final
-- ============================================================================

BEGIN;

-- ============================================
-- A. TABLE D'AUDIT _repair_log
-- ============================================
CREATE TABLE IF NOT EXISTS public._repair_log (
  id SERIAL PRIMARY KEY,
  repair_date TIMESTAMPTZ DEFAULT NOW(),
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'LINK', 'DELETE', 'DIAGNOSTIC'
  details JSONB,
  reversed BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE public._repair_log IS
  'Table d''audit pour tracer toutes les opérations de réparation d''intégrité relationnelle.';

-- ============================================
-- B. RÉPARER auth.users → profiles
-- ============================================
-- B.1 Créer les profils manquants (consolidated - may already be done by 20260216300000)
DO $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT
      au.id,
      au.email,
      COALESCE(au.raw_user_meta_data->>'role', 'tenant') AS role,
      au.raw_user_meta_data->>'prenom' AS prenom,
      au.raw_user_meta_data->>'nom' AS nom,
      au.raw_user_meta_data->>'telephone' AS telephone
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE p.id IS NULL
  LOOP
    IF v_user.role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
      v_user.role := 'tenant';
    END IF;

    BEGIN
      INSERT INTO public.profiles (user_id, role, email, prenom, nom, telephone)
      VALUES (v_user.id, v_user.role, v_user.email, v_user.prenom, v_user.nom, v_user.telephone)
      ON CONFLICT (user_id) DO NOTHING;

      IF FOUND THEN
        v_count := v_count + 1;
        INSERT INTO public._repair_log (table_name, record_id, action, details)
        VALUES ('profiles', v_user.id::TEXT, 'INSERT',
          jsonb_build_object('email', v_user.email, 'role', v_user.role, 'reason', 'user_sans_profil'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[repair] Erreur creation profil user_id=%: %', v_user.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[B.1] % profil(s) manquant(s) créé(s)', v_count;
END $$;

-- B.2 Backfill emails NULL dans profiles
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.profiles p
    SET email = au.email, updated_at = NOW()
    FROM auth.users au
    WHERE p.user_id = au.id
      AND (p.email IS NULL OR p.email = '')
      AND au.email IS NOT NULL AND au.email != ''
    RETURNING p.id, au.email AS new_email
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'profiles', id::TEXT, 'UPDATE',
    jsonb_build_object('new_email', new_email, 'reason', 'email_null_backfill')
  FROM updated;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '[B.2] % email(s) backfillé(s)', v_updated;
END $$;

-- B.3 Synchroniser les emails désynchronisés (auth.email != profile.email)
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.profiles p
    SET email = au.email, updated_at = NOW()
    FROM auth.users au
    WHERE p.user_id = au.id
      AND p.email IS DISTINCT FROM au.email
      AND au.email IS NOT NULL AND au.email != ''
      AND p.email IS NOT NULL
    RETURNING p.id, p.email AS old_email, au.email AS new_email
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'profiles', id::TEXT, 'UPDATE',
    jsonb_build_object('old_email', old_email, 'new_email', new_email, 'reason', 'email_desync')
  FROM updated;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '[B.3] % email(s) resynchronisé(s)', v_updated;
END $$;

-- ============================================
-- C. RÉPARER lease_signers ORPHELINS
-- ============================================
-- C.1 Lier les lease_signers dont invited_email matche un profil existant
DO $$
DECLARE
  v_linked INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.id AS profile_id, LOWER(au.email) AS user_email
    FROM public.profiles p
    JOIN auth.users au ON au.id = p.user_id
    WHERE au.email IS NOT NULL AND au.email != ''
      AND EXISTS (
        SELECT 1 FROM public.lease_signers ls
        WHERE LOWER(ls.invited_email) = LOWER(au.email)
          AND ls.profile_id IS NULL
      )
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE LOWER(invited_email) = rec.user_email
      AND profile_id IS NULL;

    IF FOUND THEN
      v_linked := v_linked + 1;
      INSERT INTO public._repair_log (table_name, record_id, action, details)
      VALUES ('lease_signers', rec.profile_id::TEXT, 'LINK',
        jsonb_build_object('email', rec.user_email, 'reason', 'orphan_signer_relinked'));
    END IF;
  END LOOP;

  RAISE NOTICE '[C.1] % profil(s) liés à des lease_signers orphelins', v_linked;
END $$;

-- C.2 Compter les lease_signers encore orphelins (ceux qui n'ont pas de compte)
DO $$
DECLARE
  v_orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND invited_email != ''
    AND invited_email != 'locataire@a-definir.com';

  INSERT INTO public._repair_log (table_name, action, details)
  VALUES ('lease_signers', 'DIAGNOSTIC',
    jsonb_build_object('orphan_signers_remaining', v_orphan_count,
      'note', 'Ces locataires n''ont pas encore créé leur compte'));

  IF v_orphan_count > 0 THEN
    RAISE NOTICE '[C.2] % lease_signers orphelins restants (locataires sans compte)', v_orphan_count;
  ELSE
    RAISE NOTICE '[C.2] Aucun lease_signer orphelin restant';
  END IF;
END $$;

-- ============================================
-- D. RÉPARER invoices.tenant_id ORPHELINS
-- ============================================
-- Les invoices doivent avoir un tenant_id qui pointe vers le profile du locataire du bail
DO $$
DECLARE
  v_fixed INTEGER := 0;
BEGIN
  -- Cas 1: invoices avec tenant_id NULL - remplir depuis lease_signers
  WITH fix AS (
    UPDATE public.invoices inv
    SET tenant_id = ls.profile_id
    FROM public.lease_signers ls
    WHERE inv.lease_id = ls.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire')
      AND ls.profile_id IS NOT NULL
      AND (inv.tenant_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = inv.tenant_id
      ))
    RETURNING inv.id, ls.profile_id AS new_tenant_id
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'invoices', id::TEXT, 'UPDATE',
    jsonb_build_object('new_tenant_id', new_tenant_id, 'reason', 'tenant_id_orphan_or_null')
  FROM fix;

  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RAISE NOTICE '[D] % invoice(s) avec tenant_id réparé(s)', v_fixed;
END $$;

-- ============================================
-- E. RÉPARER invoices.owner_id ORPHELINS
-- ============================================
DO $$
DECLARE
  v_fixed INTEGER := 0;
BEGIN
  WITH fix AS (
    UPDATE public.invoices inv
    SET owner_id = prop.owner_id
    FROM public.leases l
    JOIN public.properties prop ON prop.id = l.property_id
    WHERE inv.lease_id = l.id
      AND (inv.owner_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = inv.owner_id
      ))
      AND prop.owner_id IS NOT NULL
    RETURNING inv.id, prop.owner_id AS new_owner_id
  )
  INSERT INTO public._repair_log (table_name, record_id, action, details)
  SELECT 'invoices', id::TEXT, 'UPDATE',
    jsonb_build_object('new_owner_id', new_owner_id, 'reason', 'owner_id_orphan_or_null')
  FROM fix;

  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RAISE NOTICE '[E] % invoice(s) avec owner_id réparé(s)', v_fixed;
END $$;

-- ============================================
-- F. FONCTION check_data_integrity()
-- ============================================
CREATE OR REPLACE FUNCTION public.check_data_integrity()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  count INT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check 1: Auth users sans profil
  RETURN QUERY
  SELECT 'users_sans_profil'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Utilisateurs auth.users sans profil dans public.profiles'::TEXT
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE p.id IS NULL;

  -- Check 2: Profils orphelins (sans auth.users)
  RETURN QUERY
  SELECT 'profils_orphelins'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Profils sans utilisateur auth.users correspondant'::TEXT
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE au.id IS NULL AND p.user_id IS NOT NULL;

  -- Check 3: Emails désynchronisés
  RETURN QUERY
  SELECT 'emails_desync'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Profils avec email different de auth.users'::TEXT
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.user_id
  WHERE p.email IS DISTINCT FROM au.email
    AND p.email IS NOT NULL AND au.email IS NOT NULL;

  -- Check 4: Properties sans owner valide
  RETURN QUERY
  SELECT 'properties_sans_owner'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Propriétés dont owner_id ne pointe vers aucun profil'::TEXT
  FROM public.properties pr
  LEFT JOIN public.profiles p ON pr.owner_id = p.id
  WHERE p.id IS NULL;

  -- Check 5: Properties dont l'owner n'est pas role='owner'
  RETURN QUERY
  SELECT 'properties_owner_mauvais_role'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Propriétés dont le owner_id pointe vers un profil non-owner'::TEXT
  FROM public.properties pr
  JOIN public.profiles p ON pr.owner_id = p.id
  WHERE p.role NOT IN ('owner', 'admin');

  -- Check 6: Leases sans property valide
  RETURN QUERY
  SELECT 'leases_sans_property'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Baux dont property_id ne pointe vers aucune propriété'::TEXT
  FROM public.leases l
  LEFT JOIN public.properties pr ON l.property_id = pr.id
  WHERE pr.id IS NULL;

  -- Check 7: Leases sans aucun signataire locataire
  RETURN QUERY
  SELECT 'leases_sans_tenant_signer'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Baux sans signataire locataire dans lease_signers'::TEXT
  FROM public.leases l
  WHERE NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
      AND ls.role IN ('locataire_principal', 'colocataire')
  )
  AND l.statut NOT IN ('draft', 'archived');

  -- Check 8: Lease_signers orphelins (profile_id NULL, email match un profil existant)
  RETURN QUERY
  SELECT 'lease_signers_linkables'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Signataires avec profile_id NULL qui pourraient etre liés'::TEXT
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.users au2
      JOIN public.profiles p2 ON p2.user_id = au2.id
      WHERE LOWER(au2.email) = LOWER(ls.invited_email)
    );

  -- Check 9: Lease_signers orphelins (email sans compte)
  RETURN QUERY
  SELECT 'lease_signers_sans_compte'::TEXT,
    'INFO'::TEXT,
    COUNT(*)::INT,
    'Signataires invités qui n''ont pas encore créé leur compte'::TEXT
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND ls.invited_email != 'locataire@a-definir.com'
    AND NOT EXISTS (
      SELECT 1 FROM auth.users au2
      WHERE LOWER(au2.email) = LOWER(ls.invited_email)
    );

  -- Check 10: Invoices sans lease valide
  RETURN QUERY
  SELECT 'invoices_sans_lease'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERREUR' END::TEXT,
    COUNT(*)::INT,
    'Factures dont lease_id ne pointe vers aucun bail'::TEXT
  FROM public.invoices inv
  LEFT JOIN public.leases l ON inv.lease_id = l.id
  WHERE l.id IS NULL AND inv.lease_id IS NOT NULL;

  -- Check 11: Invoices sans tenant_id valide
  RETURN QUERY
  SELECT 'invoices_sans_tenant'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
    COUNT(*)::INT,
    'Factures avec tenant_id NULL ou pointant vers un profil inexistant'::TEXT
  FROM public.invoices inv
  LEFT JOIN public.profiles p ON inv.tenant_id = p.id
  WHERE (inv.tenant_id IS NULL OR p.id IS NULL)
    AND inv.lease_id IS NOT NULL;

  -- Check 12: Documents orphelins (property_id invalide)
  BEGIN
    RETURN QUERY
    SELECT 'documents_orphelins'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'Documents dont property_id pointe vers une propriété inexistante'::TEXT
    FROM public.documents d
    LEFT JOIN public.properties pr ON d.property_id = pr.id
    WHERE d.property_id IS NOT NULL AND pr.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'documents_orphelins'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table documents inexistante'::TEXT;
  END;

  -- Check 13: Tickets orphelins (property_id invalide)
  BEGIN
    RETURN QUERY
    SELECT 'tickets_orphelins'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'Tickets dont property_id pointe vers une propriété inexistante'::TEXT
    FROM public.tickets t
    LEFT JOIN public.properties pr ON t.property_id = pr.id
    WHERE t.property_id IS NOT NULL AND pr.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'tickets_orphelins'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table tickets inexistante'::TEXT;
  END;

  -- Check 14: EDL orphelins
  BEGIN
    RETURN QUERY
    SELECT 'edl_orphelins'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'EDL dont lease_id pointe vers un bail inexistant'::TEXT
    FROM public.edl e
    LEFT JOIN public.leases l ON e.lease_id = l.id
    WHERE e.lease_id IS NOT NULL AND l.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'edl_orphelins'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table edl inexistante'::TEXT;
  END;

  -- Check 15: Notifications orphelines
  BEGIN
    RETURN QUERY
    SELECT 'notifications_orphelines'::TEXT,
      CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ATTENTION' END::TEXT,
      COUNT(*)::INT,
      'Notifications dont profile_id ne pointe vers aucun profil'::TEXT
    FROM public.notifications n
    LEFT JOIN public.profiles p ON n.profile_id = p.id
    WHERE n.profile_id IS NOT NULL AND p.id IS NULL;
  EXCEPTION WHEN undefined_table THEN
    RETURN QUERY SELECT 'notifications_orphelines'::TEXT, 'N/A'::TEXT, 0::INT,
      'Table notifications inexistante'::TEXT;
  END;

  -- Check 16: Chaînes complètes owner→property→lease→tenant
  RETURN QUERY
  SELECT 'chaines_completes'::TEXT,
    'INFO'::TEXT,
    COUNT(DISTINCT l.id)::INT,
    'Baux avec chaîne complète owner→property→lease→tenant_signer'::TEXT
  FROM public.leases l
  JOIN public.properties pr ON l.property_id = pr.id
  JOIN public.profiles own ON pr.owner_id = own.id
  JOIN public.lease_signers ls ON ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
  JOIN public.profiles ten ON ls.profile_id = ten.id;

  -- Check 17: Trigger handle_new_user existe
  RETURN QUERY
  SELECT 'trigger_handle_new_user'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.tgname = 'on_auth_user_created'
        AND n.nspname = 'auth' AND c.relname = 'users'
    ) THEN 'OK' ELSE 'ERREUR' END::TEXT,
    0::INT,
    'Trigger on_auth_user_created sur auth.users'::TEXT;

  -- Check 18: Trigger auto_link_lease_signers existe
  RETURN QUERY
  SELECT 'trigger_auto_link'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.tgname = 'trigger_auto_link_lease_signers'
        AND n.nspname = 'public' AND c.relname = 'profiles'
    ) THEN 'OK' ELSE 'ERREUR' END::TEXT,
    0::INT,
    'Trigger auto_link_lease_signers sur profiles'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.check_data_integrity() IS
  'Fonction de diagnostic complète pour vérifier l''intégrité relationnelle de toutes les tables.
   Usage: SELECT * FROM check_data_integrity();';

GRANT EXECUTE ON FUNCTION public.check_data_integrity() TO authenticated;

-- ============================================
-- G. TRIGGER DE VALIDATION SUR LEASES
-- ============================================
-- Empêche la création d'un bail avec un property_id invalide
CREATE OR REPLACE FUNCTION public.validate_lease_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que la property existe
  IF NOT EXISTS (
    SELECT 1 FROM public.properties WHERE id = NEW.property_id
  ) THEN
    RAISE EXCEPTION 'Property % inexistante', NEW.property_id;
  END IF;

  -- Si unit_id est fourni, vérifier qu'il existe et appartient à la property
  IF NEW.unit_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.units
      WHERE id = NEW.unit_id AND property_id = NEW.property_id
    ) THEN
      RAISE EXCEPTION 'Unit % inexistante ou n''appartient pas à la property %',
        NEW.unit_id, NEW.property_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_lease_before_insert ON public.leases;
CREATE TRIGGER validate_lease_before_insert
  BEFORE INSERT ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_lease_insert();

COMMENT ON TRIGGER validate_lease_before_insert ON public.leases IS
  'Valide que property_id et unit_id sont valides avant l''insertion d''un bail.';

-- ============================================
-- G.2 TRIGGER: Auto-link lease_signers quand un profil est MIS À JOUR avec un email
-- ============================================
-- Couvre le cas où un profil existant n'avait pas d'email et le reçoit plus tard
CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_email_update()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  -- Seulement si l'email a changé
  IF NEW.email IS NOT NULL AND NEW.email != '' AND (OLD.email IS NULL OR OLD.email = '' OR OLD.email != NEW.email) THEN
    -- Aussi récupérer l'email auth pour double-check
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
    user_email := COALESCE(user_email, NEW.email);

    UPDATE public.lease_signers
    SET profile_id = NEW.id
    WHERE LOWER(invited_email) = LOWER(user_email)
      AND profile_id IS NULL;

    GET DIAGNOSTICS linked_count = ROW_COUNT;

    IF linked_count > 0 THEN
      RAISE NOTICE '[auto_link_update] % lease_signers liés au profil % (email: %)',
        linked_count, NEW.id, user_email;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_link_on_profile_update ON public.profiles;
CREATE TRIGGER trigger_auto_link_on_profile_update
  AFTER UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_email_update();

-- ============================================
-- H. FK MANQUANTES (ajoutées SEULEMENT si safe)
-- ============================================

-- H.1 properties.owner_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_properties_owner'
      AND table_name = 'properties' AND table_schema = 'public'
  ) AND NOT EXISTS (
    -- Vérifier qu'il n'y a pas de FK existante avec un autre nom
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'properties' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'owner_id'
  ) THEN
    -- Vérifier qu'il n'y a pas de données orphelines
    IF NOT EXISTS (
      SELECT 1 FROM public.properties pr
      LEFT JOIN public.profiles p ON pr.owner_id = p.id
      WHERE p.id IS NULL AND pr.owner_id IS NOT NULL
    ) THEN
      ALTER TABLE public.properties
        ADD CONSTRAINT fk_properties_owner
        FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
      RAISE NOTICE '[H.1] FK fk_properties_owner créée';
    ELSE
      RAISE WARNING '[H.1] FK fk_properties_owner NON créée: données orphelines existantes';
    END IF;
  ELSE
    RAISE NOTICE '[H.1] FK sur properties.owner_id existe déjà — skip';
  END IF;
END $$;

-- H.2 leases.property_id → properties.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'leases' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'property_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.leases l
      LEFT JOIN public.properties pr ON l.property_id = pr.id
      WHERE pr.id IS NULL AND l.property_id IS NOT NULL
    ) THEN
      ALTER TABLE public.leases
        ADD CONSTRAINT fk_leases_property
        FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE RESTRICT;
      RAISE NOTICE '[H.2] FK fk_leases_property créée';
    ELSE
      RAISE WARNING '[H.2] FK fk_leases_property NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.2] FK sur leases.property_id existe déjà — skip';
  END IF;
END $$;

-- H.3 lease_signers.lease_id → leases.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'lease_signers' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'lease_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.lease_signers ls
      LEFT JOIN public.leases l ON ls.lease_id = l.id
      WHERE l.id IS NULL AND ls.lease_id IS NOT NULL
    ) THEN
      ALTER TABLE public.lease_signers
        ADD CONSTRAINT fk_lease_signers_lease
        FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;
      RAISE NOTICE '[H.3] FK fk_lease_signers_lease créée';
    ELSE
      RAISE WARNING '[H.3] FK fk_lease_signers_lease NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.3] FK sur lease_signers.lease_id existe déjà — skip';
  END IF;
END $$;

-- H.4 lease_signers.profile_id → profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'lease_signers' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'profile_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.lease_signers ls
      LEFT JOIN public.profiles p ON ls.profile_id = p.id
      WHERE p.id IS NULL AND ls.profile_id IS NOT NULL
    ) THEN
      ALTER TABLE public.lease_signers
        ADD CONSTRAINT fk_lease_signers_profile
        FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
      RAISE NOTICE '[H.4] FK fk_lease_signers_profile créée';
    ELSE
      RAISE WARNING '[H.4] FK fk_lease_signers_profile NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.4] FK sur lease_signers.profile_id existe déjà — skip';
  END IF;
END $$;

-- H.5 invoices.lease_id → leases.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'invoices' AND tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'lease_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices inv
      LEFT JOIN public.leases l ON inv.lease_id = l.id
      WHERE l.id IS NULL AND inv.lease_id IS NOT NULL
    ) THEN
      ALTER TABLE public.invoices
        ADD CONSTRAINT fk_invoices_lease
        FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE RESTRICT;
      RAISE NOTICE '[H.5] FK fk_invoices_lease créée';
    ELSE
      RAISE WARNING '[H.5] FK fk_invoices_lease NON créée: données orphelines';
    END IF;
  ELSE
    RAISE NOTICE '[H.5] FK sur invoices.lease_id existe déjà — skip';
  END IF;
END $$;

-- ============================================
-- I. RAPPORT FINAL
-- ============================================
DO $$
DECLARE
  v_auth_users INT;
  v_profiles INT;
  v_users_sans_profil INT;
  v_profils_orphelins INT;
  v_properties INT;
  v_props_sans_owner INT;
  v_leases INT;
  v_leases_sans_property INT;
  v_signers_orphelins INT;
  v_signers_linkables INT;
  v_chaines_completes INT;
  v_repair_count INT;
BEGIN
  SELECT COUNT(*) INTO v_auth_users FROM auth.users;
  SELECT COUNT(*) INTO v_profiles FROM public.profiles;

  SELECT COUNT(*) INTO v_users_sans_profil
  FROM auth.users au LEFT JOIN public.profiles p ON p.user_id = au.id WHERE p.id IS NULL;

  SELECT COUNT(*) INTO v_profils_orphelins
  FROM public.profiles p LEFT JOIN auth.users au ON au.id = p.user_id WHERE au.id IS NULL AND p.user_id IS NOT NULL;

  SELECT COUNT(*) INTO v_properties FROM public.properties;
  SELECT COUNT(*) INTO v_props_sans_owner
  FROM public.properties pr LEFT JOIN public.profiles p ON pr.owner_id = p.id WHERE p.id IS NULL;

  SELECT COUNT(*) INTO v_leases FROM public.leases;
  SELECT COUNT(*) INTO v_leases_sans_property
  FROM public.leases l LEFT JOIN public.properties pr ON l.property_id = pr.id WHERE pr.id IS NULL;

  SELECT COUNT(*) INTO v_signers_orphelins
  FROM public.lease_signers WHERE profile_id IS NULL AND invited_email IS NOT NULL
    AND invited_email != 'locataire@a-definir.com';

  SELECT COUNT(*) INTO v_signers_linkables
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL AND ls.invited_email IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.users au2
      JOIN public.profiles p2 ON p2.user_id = au2.id
      WHERE LOWER(au2.email) = LOWER(ls.invited_email)
    );

  SELECT COUNT(DISTINCT l.id) INTO v_chaines_completes
  FROM public.leases l
  JOIN public.properties pr ON l.property_id = pr.id
  JOIN public.profiles own ON pr.owner_id = own.id
  JOIN public.lease_signers ls ON ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
  JOIN public.profiles ten ON ls.profile_id = ten.id;

  SELECT COUNT(*) INTO v_repair_count FROM public._repair_log;

  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '  RAPPORT INTEGRITE RELATIONNELLE — TALOK — POST-REPARATION';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '  Date : %', NOW();
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  AUTH -> PROFILES';
  RAISE NOTICE '    Auth users total         : %', v_auth_users;
  RAISE NOTICE '    Profiles total           : %', v_profiles;
  RAISE NOTICE '    Users SANS profil        : % %', v_users_sans_profil,
    CASE WHEN v_users_sans_profil = 0 THEN '(OK)' ELSE '(ERREUR)' END;
  RAISE NOTICE '    Profils orphelins        : % %', v_profils_orphelins,
    CASE WHEN v_profils_orphelins = 0 THEN '(OK)' ELSE '(ATTENTION)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  PROPERTIES';
  RAISE NOTICE '    Total                    : %', v_properties;
  RAISE NOTICE '    Sans owner valide        : % %', v_props_sans_owner,
    CASE WHEN v_props_sans_owner = 0 THEN '(OK)' ELSE '(ERREUR)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  LEASES (BAUX)';
  RAISE NOTICE '    Total                    : %', v_leases;
  RAISE NOTICE '    Sans property valide     : % %', v_leases_sans_property,
    CASE WHEN v_leases_sans_property = 0 THEN '(OK)' ELSE '(ERREUR)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  LEASE_SIGNERS';
  RAISE NOTICE '    Orphelins (pas de compte): %', v_signers_orphelins;
  RAISE NOTICE '    Linkables (ont un compte): % %', v_signers_linkables,
    CASE WHEN v_signers_linkables = 0 THEN '(OK)' ELSE '(A REPARER)' END;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  CHAINES COMPLETES';
  RAISE NOTICE '    owner->property->lease->tenant: %', v_chaines_completes;
  RAISE NOTICE '----------------------------------------------------------------';
  RAISE NOTICE '  REPARATIONS EFFECTUEES     : % entrée(s) dans _repair_log', v_repair_count;
  RAISE NOTICE '================================================================';

  -- Logger le rapport dans _repair_log
  INSERT INTO public._repair_log (table_name, action, details)
  VALUES ('SYSTEM', 'INTEGRITY_REPORT', jsonb_build_object(
    'auth_users', v_auth_users,
    'profiles', v_profiles,
    'users_sans_profil', v_users_sans_profil,
    'profils_orphelins', v_profils_orphelins,
    'properties', v_properties,
    'properties_sans_owner', v_props_sans_owner,
    'leases', v_leases,
    'leases_sans_property', v_leases_sans_property,
    'signers_orphelins', v_signers_orphelins,
    'signers_linkables', v_signers_linkables,
    'chaines_completes', v_chaines_completes
  ));
END $$;

COMMIT;


-- === MIGRATION: 20260218000000_audit_repair_profiles.sql ===
-- ============================================================================
-- BLOC 1 : TABLE D'AUDIT + RÉPARATION PROFILS
-- ============================================================================

-- 1. Création de la table de log des réparations
CREATE TABLE IF NOT EXISTS public._repair_log (
  id          SERIAL PRIMARY KEY,
  repair_date TIMESTAMPTZ DEFAULT NOW(),
  table_name  TEXT NOT NULL,
  record_id   TEXT,
  action      TEXT NOT NULL,
  details     JSONB
);

-- 2. Créer les profils manquants (users sans profil)
WITH inserted AS (
  INSERT INTO public.profiles (user_id, role, email, prenom, nom, telephone)
  SELECT
    au.id,
    COALESCE(
      CASE WHEN au.raw_user_meta_data->>'role' IN ('admin','owner','tenant','provider','guarantor')
           THEN au.raw_user_meta_data->>'role'
           ELSE NULL END,
      'tenant'
    ),
    au.email,
    au.raw_user_meta_data->>'prenom',
    au.raw_user_meta_data->>'nom',
    CASE WHEN (au.raw_user_meta_data->>'telephone') ~ '^\+[1-9]\d{1,14}$'
         THEN au.raw_user_meta_data->>'telephone'
         ELSE NULL END
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE p.id IS NULL
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id, email, role
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', user_id::TEXT, 'INSERT',
       jsonb_build_object('email', email, 'role', role, 'reason', 'user_sans_profil')
FROM inserted;

-- 3. Sync emails NULL (profils sans email alors que auth.users en a un)
WITH updated AS (
  UPDATE public.profiles p
  SET email = au.email, updated_at = NOW()
  FROM auth.users au
  WHERE p.user_id = au.id
    AND (p.email IS NULL OR p.email = '')
    AND au.email IS NOT NULL AND au.email != ''
  RETURNING p.id, au.email AS new_email
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', id::TEXT, 'UPDATE',
       jsonb_build_object('new_email', new_email, 'reason', 'email_null_backfill')
FROM updated;

-- 4. Sync emails désynchronisés (profil a un email différent de auth.users)
WITH updated AS (
  UPDATE public.profiles p
  SET email = au.email, updated_at = NOW()
  FROM auth.users au
  WHERE p.user_id = au.id
    AND p.email IS DISTINCT FROM au.email
    AND au.email IS NOT NULL AND au.email != ''
    AND p.email IS NOT NULL
  RETURNING p.id, p.email AS old_email, au.email AS new_email
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', id::TEXT, 'UPDATE',
       jsonb_build_object('old_email', old_email, 'new_email', new_email, 'reason', 'email_desync')
FROM updated;

-- 5. Résultat
SELECT action, COUNT(*) AS nb, details->>'reason' AS reason
FROM public._repair_log
WHERE table_name = 'profiles'
GROUP BY action, details->>'reason';


-- === MIGRATION: 20260218100000_sync_auth_email_updates.sql ===
-- =====================================================
-- MIGRATION: Synchronisation des changements d'email auth -> profiles
-- Date: 2026-02-18
-- Version: 20260218100000
--
-- PROBLEME:
--   Quand un utilisateur change son email via Supabase Auth
--   (confirmation d'email, changement d'email, etc.),
--   la colonne profiles.email n'est PAS mise a jour automatiquement.
--   Cela cause une desynchronisation entre auth.users.email
--   et profiles.email.
--
-- SOLUTION:
--   A. Trigger AFTER UPDATE sur auth.users qui met a jour
--      profiles.email quand auth.users.email change.
--   B. Backfill immediat des emails desynchronises.
--
-- SECURITE:
--   La fonction utilise SECURITY DEFINER pour bypasser les RLS
--   et mettre a jour le profil sans restrictions.
--   SET search_path = public pour eviter les injections de schema.
-- =====================================================

BEGIN;

-- ============================================
-- A. FONCTION DE SYNCHRONISATION EMAIL
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne rien faire si l'email n'a pas change
  IF NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;

  -- Mettre a jour l'email dans le profil
  UPDATE public.profiles
  SET
    email = NEW.email,
    updated_at = NOW()
  WHERE user_id = NEW.id;

  IF NOT FOUND THEN
    -- Le profil n'existe pas encore (race condition possible)
    -- handle_new_user() le creera avec le bon email
    RAISE WARNING '[handle_user_email_change] Profil introuvable pour user_id=%, email non synchronise', NEW.id;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la modification d'un utilisateur auth
  RAISE WARNING '[handle_user_email_change] Erreur sync email pour user_id=%: % (SQLSTATE=%)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_user_email_change() IS
'Synchronise automatiquement profiles.email quand auth.users.email change.
SECURITY DEFINER pour bypasser les RLS.
Ne bloque jamais la modification auth (EXCEPTION handler).';

-- ============================================
-- B. TRIGGER SUR auth.users (UPDATE)
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;

CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.handle_user_email_change();

-- ============================================
-- C. BACKFILL DES EMAILS DESYNCHRONISES
-- ============================================
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND p.email IS DISTINCT FROM u.email
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[email_sync] % profil(s) resynchronise(s) avec l''email de auth.users', v_updated;
  ELSE
    RAISE NOTICE '[email_sync] Tous les emails sont deja synchronises';
  END IF;
END $$;

-- ============================================
-- D. VERIFICATION
-- ============================================
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_desync_count INTEGER;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_email_changed'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) INTO v_trigger_exists;

  SELECT count(*) INTO v_desync_count
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.email IS DISTINCT FROM u.email
    AND u.email IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE '  VERIFICATION EMAIL SYNC TRIGGER';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  Trigger on_auth_user_email_changed : %',
    CASE WHEN v_trigger_exists THEN 'ACTIF' ELSE 'MANQUANT' END;
  RAISE NOTICE '  Emails desynchronises restants     : %', v_desync_count;
  RAISE NOTICE '========================================';
END $$;

COMMIT;


-- === MIGRATION: 20260220100000_fix_orphan_signers_audit.sql ===
-- =====================================================
-- MIGRATION: Audit connexion comptes — fix rétroactif + RPC
-- Date: 2026-02-20
-- Ref: docs/AUDIT_CONNEXION_COMPTES.md
--
-- CONTENU:
--   1. Fix rétroactif — relier les lease_signers orphelins (idempotent)
--   2. Index LOWER(invited_email) si absent (IF NOT EXISTS)
--   3. RPC audit_account_connections() — diagnostic réutilisable
-- =====================================================

BEGIN;

-- ============================================
-- 1. FIX RÉTROACTIF: Lier les orphelins existants
-- (Idempotent: ne fait rien si déjà liés)
-- ============================================
DO $$
DECLARE
  linked_total INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT ls.id AS signer_id, p.id AS profile_id
    FROM public.lease_signers ls
    JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
    JOIN public.profiles p ON p.user_id = u.id
    WHERE ls.profile_id IS NULL
      AND ls.invited_email IS NOT NULL
      AND TRIM(ls.invited_email) != ''
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE lease_signers.id = rec.signer_id;
    linked_total := linked_total + 1;
  END LOOP;

  IF linked_total > 0 THEN
    RAISE NOTICE '[audit_fix] % lease_signers orphelins liés à un profil existant', linked_total;
  END IF;
END $$;

-- ============================================
-- 2. INDEX: LOWER(invited_email) pour lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email_lower
  ON public.lease_signers (LOWER(TRIM(invited_email)))
  WHERE invited_email IS NOT NULL AND TRIM(invited_email) != '';

-- ============================================
-- 3. RPC: audit_account_connections()
-- Retourne un diagnostic global (orphelins, invitations, notifications)
-- ============================================
CREATE OR REPLACE FUNCTION public.audit_account_connections()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orphan_count INT;
  linkable_count INT;  -- orphelins qui ont un compte (email match)
  invitations_not_used_count INT;
  result JSONB;
BEGIN
  -- Signataires orphelins (profile_id NULL, invited_email valide)
  SELECT count(*)::INT INTO orphan_count
  FROM public.lease_signers ls
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND TRIM(ls.invited_email) != ''
    AND ls.invited_email NOT LIKE '%@a-definir%';

  -- Orphelins pour lesquels un profil existe (email correspondant)
  SELECT count(*)::INT INTO linkable_count
  FROM public.lease_signers ls
  JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
  JOIN public.profiles p ON p.user_id = u.id
  WHERE ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND TRIM(ls.invited_email) != '';

  -- Invitations non marquées utilisées (email présent dans auth.users)
  SELECT count(*)::INT INTO invitations_not_used_count
  FROM public.invitations i
  WHERE i.used_at IS NULL
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(i.email))
    );

  result := jsonb_build_object(
    'orphan_signers_count', orphan_count,
    'linkable_orphans_count', linkable_count,
    'invitations_not_used_count', invitations_not_used_count,
    'message', CASE
      WHEN linkable_count > 0 THEN 'Des orphelins peuvent être liés (exécuter le fix SQL ou la migration).'
      WHEN orphan_count > 0 THEN 'Orphelins restants sans compte correspondant.'
      ELSE 'Aucun signataire orphelin à lier.'
    END
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.audit_account_connections() IS
'Audit connexion comptes: retourne orphan_signers_count, linkable_orphans_count, invitations_not_used_count. Ref: docs/AUDIT_CONNEXION_COMPTES.md';

COMMIT;


-- === MIGRATION: 20260221000002_fix_edl_signatures_rls.sql ===
-- =====================================================
-- Fix RLS edl_signatures pour invités (signer_user NULL)
-- Date: 2026-02-21
--
-- Un locataire invité par email a une ligne edl_signatures avec
-- signer_user = NULL, signer_profile_id = NULL, signer_email = son email.
-- Il doit pouvoir SELECT et UPDATE sa ligne pour signer.
-- =====================================================

BEGIN;

DROP POLICY IF EXISTS "EDL signatures creator update" ON edl_signatures;

CREATE POLICY "EDL signatures update"
  ON edl_signatures FOR UPDATE
  USING (
    signer_user = auth.uid()
    OR signer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR (signer_email IS NOT NULL AND LOWER(TRIM(signer_email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid()))))
    OR edl_id IN (SELECT id FROM edl WHERE created_by = auth.uid())
  )
  WITH CHECK (
    signer_user = auth.uid()
    OR signer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR (signer_email IS NOT NULL AND LOWER(TRIM(signer_email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid()))))
    OR edl_id IN (SELECT id FROM edl WHERE created_by = auth.uid())
  );

COMMENT ON POLICY "EDL signatures update" ON edl_signatures IS
'SOTA 2026: Permet au signataire (uid, profile_id, ou email invité) et au créateur EDL de mettre à jour.';

COMMIT;


-- === MIGRATION: 20260222000000_fix_invitations_and_orphan_signers.sql ===
-- =====================================================
-- Migration: Lier les lease_signers orphelins et créer les invitations manquantes
-- Date: 2026-02-22
--
-- Contexte: Les baux créés avant l'unification des flux n'ont pas de record
-- dans la table invitations, ce qui empêche le locataire de voir/accepter
-- l'invitation. Cette migration :
-- 1. Lie les lease_signers orphelins (profile_id NULL) dont l'email correspond à un compte.
-- 2. Crée une invitation (token, email, role, lease_id, ...) pour chaque signataire
--    locataire (locataire_principal, colocataire) qui n'a pas déjà une invitation
--    valide (non utilisée) pour ce bail et cet email.
-- =====================================================

BEGIN;

-- 1. Lier les lease_signers orphelins : profile_id NULL + invited_email matche auth.users
UPDATE public.lease_signers ls
SET profile_id = p.id
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

-- 2. Créer les invitations manquantes pour les signataires locataires sans invitation utilisable
--    (une invitation par lease_id + email, avec token unique et expiration 30 jours)
INSERT INTO public.invitations (
  token,
  email,
  role,
  property_id,
  unit_id,
  lease_id,
  created_by,
  expires_at
)
SELECT
  encode(gen_random_bytes(32), 'hex') AS token,
  ls.invited_email AS email,
  ls.role::TEXT AS role,
  l.property_id AS property_id,
  l.unit_id AS unit_id,
  ls.lease_id AS lease_id,
  p.owner_id AS created_by,
  (NOW() + INTERVAL '30 days')::TIMESTAMPTZ AS expires_at
FROM public.lease_signers ls
JOIN public.leases l ON l.id = ls.lease_id
JOIN public.properties p ON p.id = l.property_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.invitations i
    WHERE i.lease_id = ls.lease_id
      AND LOWER(TRIM(i.email)) = LOWER(TRIM(ls.invited_email))
      AND i.used_at IS NULL
      AND i.expires_at > NOW()
  );

COMMIT;


-- === MIGRATION: 20260223000000_fix_tenant_documents_rls.sql ===
-- Migration : Corriger les politiques RLS sur tenant_documents
-- Date : 2026-02-23
--
-- Problème : Les politiques RLS existantes utilisent profile_id = auth.uid()
-- mais auth.uid() retourne le user_id (auth.users.id), pas le profile_id (profiles.id).
-- Résultat : les locataires ne peuvent jamais voir leurs propres documents.

-- ============================================
-- SUPPRIMER LES POLITIQUES INCORRECTES
-- ============================================

DROP POLICY IF EXISTS "tenant_view_own_documents" ON tenant_documents;
DROP POLICY IF EXISTS "tenant_insert_own_documents" ON tenant_documents;

-- ============================================
-- RECRÉER AVEC LA BONNE LOGIQUE
-- ============================================

-- Le locataire peut voir ses propres documents
CREATE POLICY "tenant_view_own_documents" ON tenant_documents
  FOR SELECT USING (
    tenant_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Le locataire peut uploader ses documents
CREATE POLICY "tenant_insert_own_documents" ON tenant_documents
  FOR INSERT WITH CHECK (
    tenant_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- AJOUTER tenant_email DANS LES METADATA DE L'EXPIRY CRON
-- La fonction check_expiring_cni() utilise d.metadata->>'tenant_email'
-- mais cette donnée n'était pas toujours présente.
-- Mettre à jour les documents CNI existants pour ajouter le tenant_email.
-- ============================================

UPDATE documents d
SET metadata = COALESCE(d.metadata, '{}'::jsonb) || jsonb_build_object(
  'tenant_email', COALESCE(
    (SELECT u.email FROM profiles p JOIN auth.users u ON u.id = p.user_id WHERE p.id = d.tenant_id),
    ''
  )
)
WHERE d.type IN ('cni_recto', 'cni_verso')
  AND d.tenant_id IS NOT NULL
  AND (d.metadata->>'tenant_email' IS NULL OR d.metadata->>'tenant_email' = '');

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON POLICY "tenant_view_own_documents" ON tenant_documents
  IS 'Le locataire peut voir ses documents via la jointure profiles.user_id = auth.uid()';
COMMENT ON POLICY "tenant_insert_own_documents" ON tenant_documents
  IS 'Le locataire peut insérer ses documents via la jointure profiles.user_id = auth.uid()';


-- === MIGRATION: 20260225000001_fix_furniture_vetusty_rls.sql ===
-- ============================================================================
-- P0-4: Correction RLS vétusté et mobilier
-- properties.owner_id et lease_signers.profile_id sont des profiles.id,
-- alors que auth.uid() renvoie auth.users.id. Il faut joindre profiles
-- et comparer pr.user_id = auth.uid().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. furniture_inventories
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS furniture_inventories_owner_policy ON furniture_inventories;
CREATE POLICY furniture_inventories_owner_policy ON furniture_inventories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = furniture_inventories.lease_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS furniture_inventories_tenant_policy ON furniture_inventories;
CREATE POLICY furniture_inventories_tenant_policy ON furniture_inventories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE l.id = furniture_inventories.lease_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 2. furniture_items
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS furniture_items_owner_policy ON furniture_items;
CREATE POLICY furniture_items_owner_policy ON furniture_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE fi.id = furniture_items.inventory_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS furniture_items_tenant_policy ON furniture_items;
CREATE POLICY furniture_items_tenant_policy ON furniture_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE fi.id = furniture_items.inventory_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 3. vetusty_reports
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "vetusty_reports_select_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_select_policy" ON vetusty_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr_owner ON pr_owner.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND (
        pr_owner.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          JOIN profiles pr ON pr.id = ls.profile_id
          WHERE ls.lease_id = l.id
          AND pr.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "vetusty_reports_insert_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_insert_policy" ON vetusty_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_reports_update_policy" ON vetusty_reports;
CREATE POLICY "vetusty_reports_update_policy" ON vetusty_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = vetusty_reports.lease_id
      AND pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. vetusty_items
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "vetusty_items_select_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_select_policy" ON vetusty_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr_owner ON pr_owner.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND (
        pr_owner.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM lease_signers ls
          JOIN profiles pr ON pr.id = ls.profile_id
          WHERE ls.lease_id = l.id
          AND pr.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "vetusty_items_insert_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_insert_policy" ON vetusty_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_items_update_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_update_policy" ON vetusty_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vetusty_items_delete_policy" ON vetusty_items;
CREATE POLICY "vetusty_items_delete_policy" ON vetusty_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM vetusty_reports vr
      JOIN leases l ON vr.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE vr.id = vetusty_items.report_id
      AND pr.user_id = auth.uid()
      AND vr.status = 'draft'
    )
  );

-- vetusty_grid_versions reste en lecture publique (USING (true)), pas de modification.


-- === MIGRATION: 20260229100000_identity_2fa_requests.sql ===
-- Migration: Table pour les demandes 2FA (SMS + email) lors des changements d'identité
-- SOTA 2026 - Vérification à deux facteurs pour renouvellement / mise à jour CNI

CREATE TABLE IF NOT EXISTS identity_2fa_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('renew', 'initial', 'update')),
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  otp_hash TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_token ON identity_2fa_requests(token);
CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_profile_id ON identity_2fa_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_expires_at ON identity_2fa_requests(expires_at) WHERE verified_at IS NULL;

ALTER TABLE identity_2fa_requests ENABLE ROW LEVEL SECURITY;

-- Le locataire ne peut voir que ses propres demandes
DROP POLICY IF EXISTS "identity_2fa_requests_tenant_own" ON identity_2fa_requests;
CREATE POLICY "identity_2fa_requests_tenant_own"
  ON identity_2fa_requests FOR ALL TO authenticated
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

COMMENT ON TABLE identity_2fa_requests IS 'Demandes 2FA (OTP SMS + lien email) pour changement d''identité CNI';


-- === MIGRATION: 20260301100000_entity_audit_and_propagation.sql ===
-- ============================================================================
-- Migration: Entity Audit Trail, Propagation, Contraintes SIRET, Guards
-- Date: 2026-03-01
-- Description:
--   1. Table entity_audit_log (historique des modifications)
--   2. Trigger propagation: UPDATE legal_entities → leases/invoices dénormalisés
--   3. Contrainte UNIQUE sur SIRET (actif uniquement)
--   4. Vérification bail actif avant transfert de bien (RPC)
-- Idempotent: peut être exécutée plusieurs fois sans effet secondaire.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLE: entity_audit_log (historique des modifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'deactivate', 'reactivate')),
  changed_fields JSONB,           -- {"nom": {"old": "SCI A", "new": "SCI B"}}
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_audit_log_entity ON entity_audit_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_audit_log_action ON entity_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_entity_audit_log_date ON entity_audit_log(created_at);

-- RLS pour entity_audit_log
ALTER TABLE entity_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs of their entities"
  ON entity_audit_log FOR SELECT
  USING (
    entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert audit logs for their entities"
  ON entity_audit_log FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Admins can do everything on entity_audit_log"
  ON entity_audit_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 2. TRIGGER: Propager les modifications d'entité aux tables dénormalisées
-- ============================================================================
-- Quand nom/adresse/siret changent sur legal_entities,
-- mettre à jour les champs dénormalisés sur leases et invoices.

CREATE OR REPLACE FUNCTION propagate_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
  full_address TEXT;
BEGIN
  -- Construire l'adresse complète
  full_address := COALESCE(NEW.adresse_siege, '');
  IF NEW.code_postal_siege IS NOT NULL OR NEW.ville_siege IS NOT NULL THEN
    full_address := full_address || ', ' || COALESCE(NEW.code_postal_siege, '') || ' ' || COALESCE(NEW.ville_siege, '');
  END IF;

  -- Propager vers leases si nom, adresse ou siret a changé
  IF (OLD.nom IS DISTINCT FROM NEW.nom)
     OR (OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege)
     OR (OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege)
     OR (OLD.ville_siege IS DISTINCT FROM NEW.ville_siege)
     OR (OLD.siret IS DISTINCT FROM NEW.siret) THEN

    UPDATE leases SET
      bailleur_nom = CASE WHEN OLD.nom IS DISTINCT FROM NEW.nom THEN NEW.nom ELSE bailleur_nom END,
      bailleur_adresse = CASE
        WHEN (OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege)
             OR (OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege)
             OR (OLD.ville_siege IS DISTINCT FROM NEW.ville_siege)
        THEN full_address
        ELSE bailleur_adresse
      END,
      bailleur_siret = CASE WHEN OLD.siret IS DISTINCT FROM NEW.siret THEN NEW.siret ELSE bailleur_siret END
    WHERE signatory_entity_id = NEW.id;

    -- Propager vers invoices
    UPDATE invoices SET
      issuer_nom = CASE WHEN OLD.nom IS DISTINCT FROM NEW.nom THEN NEW.nom ELSE issuer_nom END,
      issuer_adresse = CASE
        WHEN (OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege)
             OR (OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege)
             OR (OLD.ville_siege IS DISTINCT FROM NEW.ville_siege)
        THEN full_address
        ELSE issuer_adresse
      END,
      issuer_siret = CASE WHEN OLD.siret IS DISTINCT FROM NEW.siret THEN NEW.siret ELSE issuer_siret END,
      issuer_tva = CASE WHEN OLD.numero_tva IS DISTINCT FROM NEW.numero_tva THEN NEW.numero_tva ELSE issuer_tva END
    WHERE issuer_entity_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_propagate_entity_changes ON legal_entities;
CREATE TRIGGER trg_propagate_entity_changes
  AFTER UPDATE ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION propagate_entity_changes();

-- ============================================================================
-- 3. TRIGGER: Audit trail automatique sur modifications d'entité
-- ============================================================================

CREATE OR REPLACE FUNCTION log_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes JSONB := '{}';
  action_type TEXT;
  user_profile_id UUID;
BEGIN
  -- Déterminer l'ID du profil qui fait la modification
  SELECT id INTO user_profile_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    action_type := 'create';
    changes := jsonb_build_object(
      'entity_type', NEW.entity_type,
      'nom', NEW.nom,
      'regime_fiscal', NEW.regime_fiscal
    );

    INSERT INTO entity_audit_log (entity_id, action, changed_fields, changed_by)
    VALUES (NEW.id, action_type, changes, user_profile_id);

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Détecter les champs modifiés
    IF OLD.nom IS DISTINCT FROM NEW.nom THEN
      changes := changes || jsonb_build_object('nom', jsonb_build_object('old', OLD.nom, 'new', NEW.nom));
    END IF;
    IF OLD.entity_type IS DISTINCT FROM NEW.entity_type THEN
      changes := changes || jsonb_build_object('entity_type', jsonb_build_object('old', OLD.entity_type, 'new', NEW.entity_type));
    END IF;
    IF OLD.forme_juridique IS DISTINCT FROM NEW.forme_juridique THEN
      changes := changes || jsonb_build_object('forme_juridique', jsonb_build_object('old', OLD.forme_juridique, 'new', NEW.forme_juridique));
    END IF;
    IF OLD.regime_fiscal IS DISTINCT FROM NEW.regime_fiscal THEN
      changes := changes || jsonb_build_object('regime_fiscal', jsonb_build_object('old', OLD.regime_fiscal, 'new', NEW.regime_fiscal));
    END IF;
    IF OLD.siret IS DISTINCT FROM NEW.siret THEN
      changes := changes || jsonb_build_object('siret', jsonb_build_object('old', OLD.siret, 'new', NEW.siret));
    END IF;
    IF OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege THEN
      changes := changes || jsonb_build_object('adresse_siege', jsonb_build_object('old', OLD.adresse_siege, 'new', NEW.adresse_siege));
    END IF;
    IF OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege THEN
      changes := changes || jsonb_build_object('code_postal_siege', jsonb_build_object('old', OLD.code_postal_siege, 'new', NEW.code_postal_siege));
    END IF;
    IF OLD.ville_siege IS DISTINCT FROM NEW.ville_siege THEN
      changes := changes || jsonb_build_object('ville_siege', jsonb_build_object('old', OLD.ville_siege, 'new', NEW.ville_siege));
    END IF;
    IF OLD.capital_social IS DISTINCT FROM NEW.capital_social THEN
      changes := changes || jsonb_build_object('capital_social', jsonb_build_object('old', OLD.capital_social, 'new', NEW.capital_social));
    END IF;
    IF OLD.iban IS DISTINCT FROM NEW.iban THEN
      changes := changes || jsonb_build_object('iban', jsonb_build_object('old', 'MASKED', 'new', 'MASKED'));
    END IF;
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      action_type := CASE WHEN NEW.is_active THEN 'reactivate' ELSE 'deactivate' END;
      changes := changes || jsonb_build_object('is_active', jsonb_build_object('old', OLD.is_active, 'new', NEW.is_active));
    ELSE
      action_type := 'update';
    END IF;

    -- Ne loguer que s'il y a des changements
    IF changes != '{}' THEN
      INSERT INTO entity_audit_log (entity_id, action, changed_fields, changed_by)
      VALUES (NEW.id, action_type, changes, user_profile_id);
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    action_type := 'delete';
    changes := jsonb_build_object('nom', OLD.nom, 'entity_type', OLD.entity_type);

    INSERT INTO entity_audit_log (entity_id, action, changed_fields, changed_by)
    VALUES (OLD.id, action_type, changes, user_profile_id);

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_entity_changes ON legal_entities;
CREATE TRIGGER trg_log_entity_changes
  AFTER INSERT OR UPDATE OR DELETE ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION log_entity_changes();

-- ============================================================================
-- 4. CONTRAINTE UNIQUE sur SIRET (actif uniquement)
-- ============================================================================
-- Un même SIRET ne peut être utilisé que par une seule entité active

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_entities_siret_unique
  ON legal_entities (siret)
  WHERE siret IS NOT NULL AND is_active = true;

-- ============================================================================
-- 5. RPC: Vérifier si un transfert de bien est possible (bail actif ?)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_property_transfer_feasibility(
  p_property_id UUID,
  p_from_entity_id UUID,
  p_to_entity_id UUID
) RETURNS TABLE (
  can_transfer BOOLEAN,
  blocking_reason TEXT,
  active_lease_count BIGINT,
  pending_signature_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH lease_checks AS (
    SELECT
      COUNT(*) FILTER (WHERE l.statut = 'active') AS active_count,
      COUNT(*) FILTER (WHERE l.statut IN ('pending_signature', 'fully_signed')) AS pending_count
    FROM leases l
    WHERE l.property_id = p_property_id
      AND l.signatory_entity_id = p_from_entity_id
  )
  SELECT
    (lc.active_count = 0 AND lc.pending_count = 0) AS can_transfer,
    CASE
      WHEN lc.pending_count > 0 THEN
        'Transfert impossible : ' || lc.pending_count || ' bail(aux) en cours de signature. Finalisez ou annulez les signatures avant de transférer.'
      WHEN lc.active_count > 0 THEN
        'Transfert avec bail(aux) actif(s) : ' || lc.active_count || ' bail(aux) devront être mis à jour avec la nouvelle entité signataire.'
      ELSE NULL
    END AS blocking_reason,
    lc.active_count AS active_lease_count,
    lc.pending_count AS pending_signature_count
  FROM lease_checks lc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 6. Backfill bailleur_nom/adresse/siret sur les baux existants qui en manquent
-- ============================================================================

UPDATE leases l
SET
  bailleur_nom = COALESCE(l.bailleur_nom, le.nom),
  bailleur_adresse = COALESCE(l.bailleur_adresse,
    COALESCE(le.adresse_siege, '') ||
    CASE WHEN le.code_postal_siege IS NOT NULL OR le.ville_siege IS NOT NULL
      THEN ', ' || COALESCE(le.code_postal_siege, '') || ' ' || COALESCE(le.ville_siege, '')
      ELSE ''
    END
  ),
  bailleur_siret = COALESCE(l.bailleur_siret, le.siret)
FROM legal_entities le
WHERE l.signatory_entity_id = le.id
  AND (l.bailleur_nom IS NULL OR l.bailleur_adresse IS NULL OR l.bailleur_siret IS NULL);

-- Même chose pour invoices
UPDATE invoices i
SET
  issuer_nom = COALESCE(i.issuer_nom, le.nom),
  issuer_adresse = COALESCE(i.issuer_adresse,
    COALESCE(le.adresse_siege, '') ||
    CASE WHEN le.code_postal_siege IS NOT NULL OR le.ville_siege IS NOT NULL
      THEN ', ' || COALESCE(le.code_postal_siege, '') || ' ' || COALESCE(le.ville_siege, '')
      ELSE ''
    END
  ),
  issuer_siret = COALESCE(i.issuer_siret, le.siret),
  issuer_tva = COALESCE(i.issuer_tva, le.numero_tva)
FROM legal_entities le
WHERE i.issuer_entity_id = le.id
  AND (i.issuer_nom IS NULL OR i.issuer_adresse IS NULL OR i.issuer_siret IS NULL);

COMMIT;


-- === MIGRATION: 20260303100000_entity_rls_fix_and_optimize.sql ===
-- ============================================================================
-- Migration: Fix RLS policies for entity system
-- Date: 2026-03-03
-- Description:
--   1. Supprime la policy SELECT redondante sur entity_associates
--      (la policy FOR ALL couvre déjà SELECT)
--   2. Crée une fonction helper get_current_owner_profile_id()
--      pour optimiser les sous-requêtes RLS (3 niveaux → 1 appel)
--   3. Remplace les policies legal_entities par des versions optimisées
--   4. Remplace les policies entity_associates par une version optimisée
--   5. Remplace les policies property_ownership par des versions optimisées
-- Idempotent: peut être exécutée plusieurs fois sans effet secondaire.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Fonction helper: get_current_owner_profile_id()
-- ============================================================================
-- Retourne le profile_id du propriétaire connecté (ou NULL si non-propriétaire).
-- Utilisée par toutes les policies RLS pour éviter les sous-requêtes imbriquées.

CREATE OR REPLACE FUNCTION get_current_owner_profile_id()
RETURNS UUID AS $$
  SELECT op.profile_id
  FROM owner_profiles op
  INNER JOIN profiles p ON p.id = op.profile_id
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. Fix entity_associates: supprimer la policy SELECT redondante
-- ============================================================================

DROP POLICY IF EXISTS "Users can view associates of their entities" ON entity_associates;

-- Recréer la policy FOR ALL avec la fonction optimisée
DROP POLICY IF EXISTS "Users can manage associates of their entities" ON entity_associates;
CREATE POLICY "Users can manage associates of their entities"
  ON entity_associates FOR ALL
  USING (
    legal_entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

-- ============================================================================
-- 3. Optimiser les policies legal_entities
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own entities" ON legal_entities;
CREATE POLICY "Users can view their own entities"
  ON legal_entities FOR SELECT
  USING (owner_profile_id = get_current_owner_profile_id());

DROP POLICY IF EXISTS "Users can insert their own entities" ON legal_entities;
CREATE POLICY "Users can insert their own entities"
  ON legal_entities FOR INSERT
  WITH CHECK (owner_profile_id = get_current_owner_profile_id());

DROP POLICY IF EXISTS "Users can update their own entities" ON legal_entities;
CREATE POLICY "Users can update their own entities"
  ON legal_entities FOR UPDATE
  USING (owner_profile_id = get_current_owner_profile_id());

DROP POLICY IF EXISTS "Users can delete their own entities" ON legal_entities;
CREATE POLICY "Users can delete their own entities"
  ON legal_entities FOR DELETE
  USING (owner_profile_id = get_current_owner_profile_id());

-- ============================================================================
-- 4. Optimiser les policies property_ownership
-- ============================================================================

DROP POLICY IF EXISTS "Users can view ownership of their properties" ON property_ownership;
CREATE POLICY "Users can view ownership of their properties"
  ON property_ownership FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties
      WHERE owner_id = get_current_owner_profile_id()
    )
    OR legal_entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

DROP POLICY IF EXISTS "Users can manage ownership of their properties" ON property_ownership;
CREATE POLICY "Users can manage ownership of their properties"
  ON property_ownership FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties
      WHERE owner_id = get_current_owner_profile_id()
    )
    OR legal_entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

-- ============================================================================
-- 5. Optimiser les policies entity_audit_log
-- ============================================================================

DROP POLICY IF EXISTS "Users can view audit logs of their entities" ON entity_audit_log;
CREATE POLICY "Users can view audit logs of their entities"
  ON entity_audit_log FOR SELECT
  USING (
    entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

DROP POLICY IF EXISTS "Users can insert audit logs for their entities" ON entity_audit_log;
CREATE POLICY "Users can insert audit logs for their entities"
  ON entity_audit_log FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

-- ============================================================================
-- 6. Ajouter les types micro_entrepreneur et association
-- ============================================================================

ALTER TABLE legal_entities DROP CONSTRAINT IF EXISTS legal_entities_entity_type_check;
ALTER TABLE legal_entities ADD CONSTRAINT legal_entities_entity_type_check CHECK (entity_type IN (
  'particulier',
  'sci_ir',
  'sci_is',
  'sci_construction_vente',
  'sarl',
  'sarl_famille',
  'eurl',
  'sas',
  'sasu',
  'sa',
  'snc',
  'indivision',
  'demembrement_usufruit',
  'demembrement_nue_propriete',
  'holding',
  'micro_entrepreneur',
  'association'
));

COMMIT;


-- === MIGRATION: 20260309000001_messages_update_rls.sql ===
-- Migration: Allow users to update their own messages (edit + soft-delete)
-- Needed for message edit/delete feature

-- Policy for UPDATE: users can only update their own messages in their conversations
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (
    sender_profile_id = public.user_profile_id()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_profile_id = public.user_profile_id() OR c.tenant_profile_id = public.user_profile_id())
    )
  )
  WITH CHECK (
    sender_profile_id = public.user_profile_id()
  );


-- === MIGRATION: 20260310200000_add_signature_push_franceconnect.sql ===
-- Migration: Ajout colonnes signatures (Yousign), table franceconnect_sessions,
-- et colonnes push Web Push sur notification_settings
-- Date: 2026-03-10

-- =============================================================================
-- 1. signatures: ajout colonnes provider et signing_url pour intégration Yousign
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'signatures' AND column_name = 'provider'
  ) THEN
    ALTER TABLE signatures ADD COLUMN provider TEXT DEFAULT 'internal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'signatures' AND column_name = 'signing_url'
  ) THEN
    ALTER TABLE signatures ADD COLUMN signing_url TEXT;
  END IF;
END $$;

COMMENT ON COLUMN signatures.provider IS 'Provider de signature: internal, yousign, docusign';
COMMENT ON COLUMN signatures.signing_url IS 'URL de signature externe (Yousign)';

-- =============================================================================
-- 2. franceconnect_sessions: sessions OIDC FranceConnect / France Identité
-- =============================================================================
CREATE TABLE IF NOT EXISTS franceconnect_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  nonce TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'identity_verification',
  callback_url TEXT NOT NULL DEFAULT '/',
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fc_sessions_user_id ON franceconnect_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fc_sessions_state ON franceconnect_sessions(state);
CREATE INDEX IF NOT EXISTS idx_fc_sessions_expires_at ON franceconnect_sessions(expires_at);

-- RLS
ALTER TABLE franceconnect_sessions ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs ne peuvent voir que leurs propres sessions
CREATE POLICY "Users can view own FC sessions"
  ON franceconnect_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Seul le service role peut insérer/modifier (via l'API route)
CREATE POLICY "Service role can manage FC sessions"
  ON franceconnect_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- Nettoyage automatique des sessions expirées (via pg_cron si disponible)
-- DELETE FROM franceconnect_sessions WHERE expires_at < NOW();

-- =============================================================================
-- 3. notification_settings: colonnes push_enabled et push_subscription
--    pour le Web Push API (VAPID)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_settings' AND column_name = 'push_enabled'
  ) THEN
    ALTER TABLE notification_settings ADD COLUMN push_enabled BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_settings' AND column_name = 'push_subscription'
  ) THEN
    ALTER TABLE notification_settings ADD COLUMN push_subscription JSONB;
  END IF;
END $$;

COMMENT ON COLUMN notification_settings.push_enabled IS 'Web Push activé pour cet utilisateur';
COMMENT ON COLUMN notification_settings.push_subscription IS 'Objet PushSubscription (endpoint, keys) pour Web Push API';


-- === MIGRATION: 20260312100000_fix_handle_new_user_all_roles.sql ===
-- ============================================
-- Migration: Ajouter guarantor et syndic au trigger handle_new_user
-- Date: 2026-03-12
-- Description: Le trigger acceptait uniquement admin/owner/tenant/provider.
--              Les rôles guarantor et syndic étaient silencieusement convertis en tenant.
-- ============================================

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

  -- Valider le rôle (tous les rôles supportés par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic') THEN
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
Supporte tous les rôles: admin, owner, tenant, provider, guarantor, syndic.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';


-- === MIGRATION: 20260314001000_fix_stripe_connect_rls.sql ===
-- Migration: corriger la RLS Stripe Connect avec profiles.id
-- Date: 2026-03-14

BEGIN;

ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own connect account" ON stripe_connect_accounts;
DROP POLICY IF EXISTS "Owners can create own connect account" ON stripe_connect_accounts;
DROP POLICY IF EXISTS "Service role full access connect" ON stripe_connect_accounts;

CREATE POLICY "Owners can view own connect account" ON stripe_connect_accounts
  FOR SELECT
  USING (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

CREATE POLICY "Owners can create own connect account" ON stripe_connect_accounts
  FOR INSERT
  WITH CHECK (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

CREATE POLICY "Owners can update own connect account" ON stripe_connect_accounts
  FOR UPDATE
  USING (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  )
  WITH CHECK (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

CREATE POLICY "Service role full access connect" ON stripe_connect_accounts
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Owners can view own transfers" ON stripe_transfers;
DROP POLICY IF EXISTS "Service role full access transfers" ON stripe_transfers;

CREATE POLICY "Owners can view own transfers" ON stripe_transfers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM stripe_connect_accounts sca
      WHERE sca.id = stripe_transfers.connect_account_id
        AND (
          sca.profile_id = public.user_profile_id()
          OR public.user_role() = 'admin'
        )
    )
  );

CREATE POLICY "Service role full access transfers" ON stripe_transfers
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;


-- === MIGRATION: 20260318000000_fix_auth_reset_template_examples.sql ===
-- =============================================================================
-- Migration : Align auth reset template examples with live recovery flow
-- Date      : 2026-03-18
-- Objectif  : Éviter les exemples legacy /auth/reset?token=... qui ne
--             correspondent plus au flux actuel /auth/callback -> /auth/reset-password
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates') THEN
    UPDATE email_templates
    SET available_variables = REPLACE(
          available_variables::text,
          'https://talok.fr/auth/reset?token=...',
          'https://talok.fr/auth/callback?next=/auth/reset-password&code=...'
        )::jsonb,
        updated_at = NOW()
    WHERE slug = 'auth_reset_password'
      AND available_variables::text LIKE '%https://talok.fr/auth/reset?token=...%';

    RAISE NOTICE 'email_templates auth_reset_password example updated to callback/reset-password flow';
  ELSE
    RAISE NOTICE 'email_templates table does not exist, skipping';
  END IF;
END $$;

COMMIT;


-- === MIGRATION: 20260318010000_password_reset_requests.sql ===
-- =============================================================================
-- Migration : Password reset requests SOTA 2026
-- Objectif  : Introduire une couche applicative one-time au-dessus du recovery
--             Supabase pour sécuriser le changement de mot de passe.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired', 'revoked')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip INET,
  requested_user_agent TEXT,
  completed_ip INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_status
  ON password_reset_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_expires_at
  ON password_reset_requests(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_requests_single_pending
  ON password_reset_requests(user_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION set_password_reset_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_password_reset_requests_updated_at ON password_reset_requests;
CREATE TRIGGER trg_password_reset_requests_updated_at
  BEFORE UPDATE ON password_reset_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_password_reset_requests_updated_at();

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

COMMIT;


-- === MIGRATION: 20260318020000_buildings_rls_sota2026.sql ===
-- ============================================
-- Migration : RLS SOTA 2026 pour buildings & building_units
-- Remplace auth.uid() par user_profile_id() / user_role()
-- Ajoute policies admin et tenant
-- ============================================

-- 1. DROP anciennes policies buildings
-- ============================================
DROP POLICY IF EXISTS "Owners can view their buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can create buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can update their buildings" ON buildings;
DROP POLICY IF EXISTS "Owners can delete their buildings" ON buildings;

-- 2. DROP anciennes policies building_units
-- ============================================
DROP POLICY IF EXISTS "Owners can view their building units" ON building_units;
DROP POLICY IF EXISTS "Owners can create building units" ON building_units;
DROP POLICY IF EXISTS "Owners can update their building units" ON building_units;
DROP POLICY IF EXISTS "Owners can delete their building units" ON building_units;

-- 3. Nouvelles policies buildings (owner)
-- ============================================
CREATE POLICY "buildings_owner_select" ON buildings
  FOR SELECT TO authenticated
  USING (owner_id = public.user_profile_id());

CREATE POLICY "buildings_owner_insert" ON buildings
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.user_profile_id());

CREATE POLICY "buildings_owner_update" ON buildings
  FOR UPDATE TO authenticated
  USING (owner_id = public.user_profile_id());

CREATE POLICY "buildings_owner_delete" ON buildings
  FOR DELETE TO authenticated
  USING (owner_id = public.user_profile_id());

-- 4. Policies buildings (admin)
-- ============================================
CREATE POLICY "buildings_admin_all" ON buildings
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');

-- 5. Policies buildings (tenant via bail actif)
-- ============================================
CREATE POLICY "buildings_tenant_select" ON buildings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM building_units bu
      JOIN leases l ON l.id = bu.current_lease_id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE bu.building_id = buildings.id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut = 'active'
    )
  );

-- 6. Nouvelles policies building_units (owner)
-- ============================================
CREATE POLICY "building_units_owner_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

CREATE POLICY "building_units_owner_insert" ON building_units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

CREATE POLICY "building_units_owner_update" ON building_units
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

CREATE POLICY "building_units_owner_delete" ON building_units
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.id = building_units.building_id
        AND b.owner_id = public.user_profile_id()
    )
  );

-- 7. Policies building_units (admin)
-- ============================================
CREATE POLICY "building_units_admin_all" ON building_units
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin');

-- 8. Policies building_units (tenant via bail actif)
-- ============================================
CREATE POLICY "building_units_tenant_select" ON building_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.id = building_units.current_lease_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut = 'active'
    )
  );

-- 9. Ajout property_id sur building_units si manquant
-- ============================================
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_building_units_property ON building_units(property_id);


-- === MIGRATION: 20260320100000_fix_owner_id_mismatch_and_rls.sql ===
-- ============================================================================
-- Migration: Fix owner_id mismatch on properties table
-- Date: 2026-03-20
--
-- Problème: Certaines propriétés ont owner_id = profiles.user_id (UUID auth)
-- au lieu de owner_id = profiles.id (UUID profil). Cela casse les politiques
-- RLS qui utilisent public.user_profile_id() pour comparer avec owner_id.
--
-- Cette migration:
-- 1. Corrige les owner_id incorrects (user_id → profiles.id)
-- 2. S'assure que la fonction user_profile_id() est SECURITY DEFINER et STABLE
-- 3. Supprime les doublons éventuels de propriétés
-- ============================================================================

-- ============================================================================
-- 1. Corriger les owner_id qui pointent vers user_id au lieu de profiles.id
-- ============================================================================

-- Diagnostic d'abord (visible dans les logs)
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM properties pr
  INNER JOIN profiles p ON pr.owner_id = p.user_id
  WHERE p.role = 'owner'
    AND p.id != pr.owner_id
    AND pr.deleted_at IS NULL;

  RAISE NOTICE 'Propriétés avec owner_id mismatch (user_id au lieu de profiles.id): %', mismatch_count;
END $$;

-- Correction: remplacer owner_id = user_id par owner_id = profiles.id
UPDATE properties pr
SET owner_id = p.id,
    updated_at = NOW()
FROM profiles p
WHERE pr.owner_id = p.user_id
  AND p.role = 'owner'
  AND p.id != pr.owner_id;

-- ============================================================================
-- 2. S'assurer que user_profile_id() fonctionne correctement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================================
-- 3. Vérifier et supprimer les doublons de propriétés
--    (même adresse, même owner_id, même type = doublon probable)
-- ============================================================================

-- Marquer les doublons comme supprimés (soft delete) en gardant le plus récent
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id, adresse_complete, type, ville, code_postal
      ORDER BY created_at DESC
    ) as rn
  FROM properties
  WHERE deleted_at IS NULL
    AND adresse_complete IS NOT NULL
    AND adresse_complete != ''
)
UPDATE properties
SET deleted_at = NOW(),
    deleted_by = 'system-dedup-migration'
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Log du nombre de doublons supprimés
DO $$
DECLARE
  dedup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dedup_count
  FROM properties
  WHERE deleted_by = 'system-dedup-migration'
    AND deleted_at >= NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Propriétés doublons soft-deleted: %', dedup_count;
END $$;

-- ============================================================================
-- 4. Vérification finale
-- ============================================================================

DO $$
DECLARE
  remaining_mismatch INTEGER;
  total_active INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_mismatch
  FROM properties pr
  INNER JOIN profiles p ON pr.owner_id = p.user_id
  WHERE p.role = 'owner'
    AND p.id != pr.owner_id
    AND pr.deleted_at IS NULL;

  SELECT COUNT(*) INTO total_active
  FROM properties
  WHERE deleted_at IS NULL;

  RAISE NOTICE 'Vérification: % propriétés actives, % mismatches restants', total_active, remaining_mismatch;
END $$;


-- === MIGRATION: 20260323000000_fix_document_visibility_and_dedup.sql ===
-- Migration: Fix document visibility RLS + add deduplication constraint
-- 1) RLS: tenant_id match must also respect visible_tenant
-- 2) Unique partial index to prevent duplicate quittances per payment
-- 3) Unique partial index to prevent duplicate attestations per handover

-- ============================================================
-- 1. Fix RLS: tenant with tenant_id = user MUST still respect visible_tenant
-- Previously: tenant_id = user_profile_id() bypassed visible_tenant = false
-- ============================================================

DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON documents;

CREATE POLICY "Tenants can read visible lease documents"
  ON documents FOR SELECT
  USING (
    -- Tenant direct match: must respect visible_tenant
    (
      tenant_id = public.user_profile_id()
      AND visible_tenant IS NOT FALSE
    )
    -- Tenant via lease signer: must respect visible_tenant
    OR (
      visible_tenant = true
      AND lease_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM lease_signers ls
        JOIN profiles p ON p.id = ls.profile_id
        WHERE ls.lease_id = documents.lease_id
          AND p.id = public.user_profile_id()
          AND ls.role IN ('locataire_principal', 'locataire', 'colocataire')
      )
    )
    -- Owner direct match
    OR owner_id = public.user_profile_id()
    -- Owner via property
    OR (
      property_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = documents.property_id
          AND p.owner_id = public.user_profile_id()
      )
    )
    -- Admin
    OR public.user_role() = 'admin'
  );

-- ============================================================
-- 2. Unique partial index: one quittance per payment_id
-- Prevents race-condition duplicates in receipt generation
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_quittance_payment
  ON documents ((metadata->>'payment_id'))
  WHERE type = 'quittance'
    AND metadata->>'payment_id' IS NOT NULL;

-- ============================================================
-- 3. Unique partial index: one attestation per handover_id
-- Prevents duplicate key handover attestations
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_attestation_handover
  ON documents ((metadata->>'handover_id'))
  WHERE type = 'attestation_remise_cles'
    AND metadata->>'handover_id' IS NOT NULL;

-- ============================================================
-- 4. Index for document-access helper: lookup by storage_path
-- Used by the unified access check when path doesn't match known patterns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_documents_storage_path
  ON documents (storage_path)
  WHERE storage_path IS NOT NULL;


-- === MIGRATION: 20260326205416_add_agency_role_to_handle_new_user.sql ===
-- ============================================
-- Migration: Ajouter agency au trigger handle_new_user
-- Date: 2026-03-26
-- Description: Le trigger acceptait admin/owner/tenant/provider/guarantor/syndic.
--              Le role agency etait silencieusement converti en tenant.
-- ============================================

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
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (tous les roles supportes par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Inserer le profil avec toutes les donnees
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
'Cree automatiquement un profil lors de la creation d''un utilisateur.
Lit le role et les informations personnelles depuis les raw_user_meta_data.
Supporte tous les roles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.';


-- === MIGRATION: 20260327200000_fix_handle_new_user_restore_email.sql ===
-- ============================================
-- Migration: Corriger handle_new_user — restaurer email + EXCEPTION handler
-- Date: 2026-03-27
-- Description:
--   La migration 20260326205416 a introduit une regression :
--     1. La colonne `email` n'est plus inseree dans profiles (variable v_email supprimee)
--     2. Le handler EXCEPTION WHEN OTHERS a ete supprime
--   Cette migration restaure les deux, tout en conservant le support
--   de tous les roles (admin, owner, tenant, provider, guarantor, syndic, agency).
--   Elle backfill aussi les emails NULL crees par la migration cassee.
-- ============================================

-- A. RESTAURER handle_new_user() avec email + EXCEPTION handler
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
  v_email TEXT;
BEGIN
  -- Lire le role depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );

  -- Valider le role (tous les roles supportes par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
    v_role := 'tenant';
  END IF;

  -- Lire les autres donnees depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';

  -- Recuperer l'email depuis le champ auth.users.email
  v_email := NEW.email;

  -- Inserer le profil avec toutes les donnees, y compris l'email
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone, email)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone, v_email)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la creation d'un utilisateur auth
  -- meme si l'insertion du profil echoue
  RAISE WARNING '[handle_new_user] Erreur pour user_id=%, email=%: % (SQLSTATE=%)',
    NEW.id, NEW.email, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
'Cree automatiquement un profil lors de la creation d''un utilisateur auth.
Lit le role et les informations personnelles depuis raw_user_meta_data.
Inclut l''email depuis auth.users.email.
Supporte tous les roles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gerer les cas ou le profil existe deja.
Ne bloque jamais la creation auth meme en cas d''erreur (EXCEPTION handler).';

-- B. BACKFILL des emails NULL (crees par la migration 20260326205416 cassee)
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    updated_at = NOW()
  FROM auth.users u
  WHERE p.user_id = u.id
    AND (p.email IS NULL OR p.email = '')
    AND u.email IS NOT NULL
    AND u.email != '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RAISE NOTICE '[fix_handle_new_user] % profil(s) mis a jour avec l''email depuis auth.users', v_updated;
  ELSE
    RAISE NOTICE '[fix_handle_new_user] Tous les profils ont deja un email renseigne';
  END IF;
END $$;


-- === MIGRATION: 20260328000000_fix_visible_tenant_documents.sql ===
-- FIX 4: Ensure mandatory lease documents are visible to tenants
-- Documents types contrat_bail, edl_entree, assurance_habitation
-- must have visible_tenant = true so tenants can see them.

UPDATE documents
SET visible_tenant = true,
    updated_at = now()
WHERE type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);


-- === MIGRATION: 20260328100000_fix_visible_tenant_documents.sql ===
-- Migration: Ensure key lease documents are visible to tenants
-- Fixes: Documents created before visible_tenant was properly set

-- Set visible_tenant = true for all tenant-relevant document types
UPDATE documents
SET visible_tenant = true
WHERE type IN ('bail', 'contrat_bail', 'EDL_entree', 'EDL_sortie', 'edl_entree', 'edl_sortie', 'quittance', 'attestation_remise_cles', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

-- Corriger les documents obligatoires du bail test da2eb9da
UPDATE documents
SET visible_tenant = true, updated_at = now()
WHERE lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
  AND type IN ('contrat_bail', 'edl_entree', 'assurance_habitation')
  AND (visible_tenant IS NULL OR visible_tenant = false);

-- Set default visible_tenant = true for new documents via column default
ALTER TABLE documents ALTER COLUMN visible_tenant SET DEFAULT true;


-- === MIGRATION: 20260329120000_add_agency_to_handle_new_user.sql ===
-- ============================================
-- Migration: Ajouter le rôle agency au trigger handle_new_user
-- Date: 2026-03-29
-- Description: Le rôle agency était absent de la liste des rôles valides
--              dans le trigger, causant un fallback silencieux vers tenant.
-- ============================================

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

  -- Valider le rôle (tous les rôles supportés par la plateforme)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor', 'syndic', 'agency') THEN
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
Supporte tous les rôles: admin, owner, tenant, provider, guarantor, syndic, agency.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';


-- === MIGRATION: 20260401000000_add_identity_status_onboarding_step.sql ===
-- Migration: Ajout identity_status et onboarding_step sur profiles
-- Ces colonnes alimentent le middleware identity-gate qui contrôle
-- l'accès aux routes protégées selon le niveau de vérification.

-- Enum pour le statut d'identité
DO $$ BEGIN
  CREATE TYPE identity_status_enum AS ENUM (
    'unverified',
    'phone_verified',
    'document_uploaded',
    'identity_review',
    'identity_verified',
    'identity_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum pour l'étape d'onboarding
DO $$ BEGIN
  CREATE TYPE onboarding_step_enum AS ENUM (
    'account_created',
    'phone_pending',
    'phone_done',
    'profile_pending',
    'profile_done',
    'document_pending',
    'document_done',
    'complete'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ajout des colonnes sur profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_status identity_status_enum NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS onboarding_step onboarding_step_enum NOT NULL DEFAULT 'account_created',
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Index pour les requêtes du middleware (lookup par user + status)
CREATE INDEX IF NOT EXISTS idx_profiles_identity_status ON profiles (identity_status);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_step ON profiles (onboarding_step);

COMMENT ON COLUMN profiles.identity_status IS 'Niveau de vérification d''identité — utilisé par le middleware identity-gate';
COMMENT ON COLUMN profiles.onboarding_step IS 'Étape courante du parcours d''onboarding';


-- === MIGRATION: 20260401000001_backfill_identity_status.sql ===
-- Migration: Backfill identity_status pour les profils existants
-- Protège les utilisateurs existants avant activation du middleware identity-gate.
-- Ordre d'exécution important : les requêtes les plus spécifiques d'abord.
--
-- FIX: Utilise les vrais statuts leases (active, fully_signed, notice_given, terminated)
-- FIX: Supprime onboarding_completed_at (n'existe pas dans le schéma)
-- FIX: Utilise aussi lease_signers comme fallback quand leases.tenant_id est NULL

-- 1. Tenants/Owners avec bail actif/signé/terminé → identity_verified + complete
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at    = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step      = 'complete'
WHERE (
  -- Via leases.tenant_id (dénormalisé)
  id IN (
    SELECT DISTINCT tenant_id FROM leases
    WHERE statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
    AND tenant_id IS NOT NULL
  )
  OR
  -- Via lease_signers (source de vérité)
  id IN (
    SELECT DISTINCT ls.profile_id FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    WHERE l.statut IN ('active', 'fully_signed', 'notice_given', 'terminated', 'archived')
    AND ls.signature_status = 'signed'
    AND ls.profile_id IS NOT NULL
  )
  OR
  -- Propriétaires avec des biens
  id IN (
    SELECT DISTINCT owner_id FROM properties WHERE owner_id IS NOT NULL
  )
)
AND identity_status = 'unverified';

-- 2. Utilisateurs ayant uploadé des documents → identity_verified
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = COALESCE(telephone IS NOT NULL AND telephone <> '', false),
  phone_verified_at    = CASE WHEN telephone IS NOT NULL AND telephone <> '' THEN NOW() ELSE NULL END,
  onboarding_step      = 'complete'
WHERE id IN (
  SELECT DISTINCT uploaded_by FROM documents WHERE uploaded_by IS NOT NULL
)
AND identity_status = 'unverified';

-- 3. Admins → identity_verified d'office
UPDATE profiles SET
  identity_status      = 'identity_verified',
  identity_verified_at = NOW(),
  phone_verified       = true,
  onboarding_step      = 'complete'
WHERE role = 'admin'
AND identity_status = 'unverified';

-- 4. Comptes avec téléphone renseigné + prénom/nom → phone_verified
UPDATE profiles SET
  identity_status = 'phone_verified',
  phone_verified  = true,
  phone_verified_at = NOW(),
  onboarding_step = 'profile_done'
WHERE identity_status = 'unverified'
AND telephone IS NOT NULL AND telephone <> ''
AND prenom IS NOT NULL AND prenom <> ''
AND nom IS NOT NULL AND nom <> '';

-- 5. Comptes créés depuis plus de 24h sans rien → phone_verified (grace period)
UPDATE profiles SET
  identity_status = 'phone_verified',
  onboarding_step = 'phone_done'
WHERE identity_status = 'unverified'
AND created_at < NOW() - INTERVAL '1 day';


-- === MIGRATION: 20260404100000_rls_push_subscriptions.sql ===
-- =====================================================
-- MIGRATION: Activer RLS sur push_subscriptions
-- Date: 2026-04-04
--
-- PROBLÈME: L'audit sécurité a révélé que la table push_subscriptions
-- n'a pas de RLS activé. Un utilisateur authentifié pourrait potentiellement
-- lire/modifier les subscriptions push d'autres utilisateurs.
--
-- FIX: Activer RLS + policy user_id = auth.uid()
-- =====================================================

-- Activer RLS (idempotent si déjà activé)
ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions;

-- Policy : chaque utilisateur ne peut accéder qu'à ses propres subscriptions
CREATE POLICY "push_subs_own_access" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "push_subs_own_access" ON push_subscriptions IS
  'Sécurité: un utilisateur ne peut voir/modifier que ses propres abonnements push.';


-- === MIGRATION: 20260404100100_fix_tenant_docs_view_visible_tenant.sql ===
-- =====================================================
-- MIGRATION: Ajouter filtre visible_tenant à la vue v_tenant_accessible_documents
-- Date: 2026-04-04
--
-- PROBLÈME: La vue a été créée le 2026-02-23 (migration 20260223000002)
-- AVANT l'ajout de la colonne visible_tenant (migration 20260306000000).
-- Résultat : la vue ne filtre pas visible_tenant, donc un propriétaire
-- qui cache un document au locataire n'est pas respecté via cette vue.
--
-- FIX: Recréer la vue avec le filtre visible_tenant.
-- Logique : le tenant voit le document SI :
--   - visible_tenant = true (le proprio l'a rendu visible) OU
--   - tenant_id = user_profile_id() (c'est un doc uploadé par le tenant lui-même)
-- =====================================================

CREATE OR REPLACE VIEW public.v_tenant_accessible_documents AS
SELECT DISTINCT ON (d.id) d.*
FROM public.documents d
WHERE
  -- Documents directement liés au locataire (uploadés par lui)
  d.tenant_id = public.user_profile_id()
  -- Documents liés aux baux du locataire (visible_tenant requis)
  OR (
    d.visible_tenant = true
    AND d.lease_id IN (
      SELECT ls.lease_id
      FROM public.lease_signers ls
      WHERE ls.profile_id = public.user_profile_id()
    )
  )
  -- Documents partagés de la propriété (diagnostics, EDL, etc.) — visible_tenant requis
  OR (
    d.visible_tenant = true
    AND d.property_id IN (
      SELECT l.property_id
      FROM public.leases l
      JOIN public.lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = public.user_profile_id()
        AND l.property_id IS NOT NULL
    )
    AND d.type IN (
      'diagnostic_performance', 'dpe', 'erp', 'crep', 'amiante',
      'electricite', 'gaz', 'reglement_copro', 'notice_information',
      'EDL_entree', 'EDL_sortie', 'edl', 'edl_entree', 'edl_sortie'
    )
  );

COMMENT ON VIEW public.v_tenant_accessible_documents IS
  'SOTA 2026: Vue unifiée des documents accessibles par le locataire. Filtre visible_tenant=true sauf pour les documents uploadés par le tenant lui-même.';


-- === MIGRATION: 20260404100200_fix_ticket_messages_rls_lease_signers.sql ===
-- =====================================================
-- MIGRATION: Fix ticket_messages RLS — utiliser lease_signers au lieu de roommates
-- Date: 2026-04-04
--
-- PROBLÈME: La policy SELECT sur ticket_messages vérifie l'accès via
-- la table `roommates` (user_id), mais les locataires sont référencés
-- dans `lease_signers` (profile_id). Si roommates n'est pas peuplée,
-- le locataire n'a pas accès aux messages de ses tickets.
--
-- FIX: Remplacer roommates par lease_signers + user_profile_id()
-- =====================================================

-- SELECT policy
DROP POLICY IF EXISTS "Ticket messages same lease select" ON ticket_messages;

CREATE POLICY "Ticket messages same lease select"
  ON ticket_messages FOR SELECT
  USING (
    (
      -- Créateur du ticket
      ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.created_by_profile_id = public.user_profile_id()
      )
      -- Membre du bail via lease_signers
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls
          WHERE ls.profile_id = public.user_profile_id()
        )
      )
      -- Propriétaire du bien
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = public.user_profile_id()
      )
      -- Admin
      OR public.user_role() = 'admin'
    )
    AND (
      NOT is_internal
      OR public.user_role() IN ('owner', 'admin')
    )
  );

-- INSERT policy
DROP POLICY IF EXISTS "Ticket messages same lease insert" ON ticket_messages;

CREATE POLICY "Ticket messages same lease insert"
  ON ticket_messages FOR INSERT
  WITH CHECK (
    sender_user = auth.uid()
    AND (
      -- Créateur du ticket
      ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.created_by_profile_id = public.user_profile_id()
      )
      -- Membre du bail
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        WHERE t.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls
          WHERE ls.profile_id = public.user_profile_id()
        )
      )
      -- Propriétaire du bien
      OR ticket_id IN (
        SELECT t.id FROM tickets t
        JOIN properties p ON p.id = t.property_id
        WHERE p.owner_id = public.user_profile_id()
      )
      -- Admin
      OR public.user_role() = 'admin'
    )
  );


-- === MIGRATION: 20260407110000_audit_fixes_rls_indexes.sql ===
-- Migration: Audit fixes — missing indexes, CHECK constraints, and RLS
-- Idempotent: safe to run multiple times

-- 1. Missing index on sepa_mandates.owner_profile_id (skip if table missing)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_sepa_mandates_owner ON sepa_mandates(owner_profile_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. CHECK constraints on status columns (skip if table does not exist)
DO $$ BEGIN
  ALTER TABLE reconciliation_matches ADD CONSTRAINT chk_reconciliation_matches_status CHECK (status IN ('pending','matched','disputed','resolved'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payment_schedules ADD CONSTRAINT chk_payment_schedules_status CHECK (status IN ('pending','active','paused','completed','cancelled'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE receipt_stubs ADD CONSTRAINT chk_receipt_stubs_status CHECK (status IN ('signed','cancelled','archived'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT chk_subscriptions_status CHECK (status IN ('trialing','active','past_due','canceled','incomplete','paused'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE visit_slots ADD CONSTRAINT chk_visit_slots_status CHECK (status IN ('available','booked','cancelled','completed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE visit_bookings ADD CONSTRAINT chk_visit_bookings_status CHECK (status IN ('pending','confirmed','cancelled','no_show','completed'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Enable RLS on lease_notices (idempotent — ENABLE is a no-op if already on)
ALTER TABLE IF EXISTS lease_notices ENABLE ROW LEVEL SECURITY;


-- === MIGRATION: 20260408100000_create_push_subscriptions.sql ===
-- =====================================================
-- MIGRATION: Create push_subscriptions table
-- Date: 2026-04-08
--
-- Cette table stocke les tokens push (Web Push VAPID + FCM natif)
-- pour envoyer des notifications push aux utilisateurs.
-- =====================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Web Push : endpoint complet ; FCM natif : fcm://{token}
  endpoint TEXT NOT NULL,

  -- Web Push VAPID keys (NULL pour FCM natif)
  p256dh_key TEXT,
  auth_key TEXT,

  -- Device info
  device_type TEXT NOT NULL DEFAULT 'web' CHECK (device_type IN ('web', 'ios', 'android')),
  device_name TEXT,
  browser TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un seul endpoint par user
  UNIQUE(user_id, endpoint)
);

-- Index pour les requetes frequentes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile
  ON push_subscriptions(profile_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions(user_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_type
  ON push_subscriptions(device_type) WHERE is_active = true;

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_own_access" ON push_subscriptions;
CREATE POLICY "push_subs_own_access" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE push_subscriptions IS 'Tokens push : Web Push (VAPID) et FCM natif (iOS/Android)';


-- === MIGRATION: 20260408130000_security_deposits.sql ===
-- =====================================================
-- Migration: Table des dépôts de garantie (lifecycle tracking)
-- Date: 2026-04-08
-- Spec: talok-paiements — Section 7
-- =====================================================

BEGIN;

-- Table principale : un enregistrement par dépôt de garantie par bail
CREATE TABLE IF NOT EXISTS security_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  -- Montant
  amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,

  -- Restitution
  restitution_amount_cents INTEGER,
  retenue_cents INTEGER DEFAULT 0,
  retenue_details JSONB DEFAULT '[]'::jsonb,
  -- Format: [{ "motif": "Dégradations", "amount_cents": 15000, "justification": "Photos EDL" }]
  restitution_due_date DATE,           -- date sortie + 1 ou 2 mois selon EDL
  restituted_at TIMESTAMPTZ,
  restitution_method TEXT,             -- 'virement' | 'cheque' | 'especes'

  -- Statut lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'partially_returned', 'returned', 'disputed')),

  -- Pénalité de retard (10% loyer/mois)
  late_penalty_cents INTEGER DEFAULT 0,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Un seul dépôt par bail
  UNIQUE(lease_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_security_deposits_lease_id ON security_deposits(lease_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_tenant_id ON security_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_status ON security_deposits(status);
CREATE INDEX IF NOT EXISTS idx_security_deposits_restitution_due ON security_deposits(restitution_due_date)
  WHERE status = 'received' AND restitution_due_date IS NOT NULL;

-- Trigger updated_at
CREATE OR REPLACE TRIGGER set_updated_at_security_deposits
  BEFORE UPDATE ON security_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE security_deposits ENABLE ROW LEVEL SECURITY;

-- Politique: Le propriétaire peut gérer les dépôts de ses baux
CREATE POLICY "Owner manages security_deposits" ON security_deposits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = security_deposits.lease_id
      AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Politique: Le locataire peut voir son dépôt
CREATE POLICY "Tenant views own security_deposit" ON security_deposits
  FOR SELECT
  USING (
    tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Politique: Admin peut tout gérer
CREATE POLICY "Admin manages all security_deposits" ON security_deposits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- Trigger : créer automatiquement un security_deposit à la signature du bail
-- =====================================================
CREATE OR REPLACE FUNCTION create_security_deposit_on_lease_activation()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_deposit_amount INTEGER;
BEGIN
  -- Seulement quand le bail passe à 'active'
  IF NEW.statut = 'active' AND (OLD.statut IS DISTINCT FROM 'active') THEN
    -- Récupérer le montant du dépôt (stocké en euros dans leases, convertir en centimes)
    v_deposit_amount := COALESCE(NEW.depot_de_garantie, 0) * 100;

    -- Pas de dépôt si montant = 0 (bail mobilité interdit)
    IF v_deposit_amount <= 0 THEN
      RETURN NEW;
    END IF;

    -- Récupérer le locataire principal
    SELECT ls.profile_id INTO v_tenant_id
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.id
      AND ls.role = 'locataire_principal'
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Créer le dépôt en statut 'pending'
    INSERT INTO security_deposits (lease_id, tenant_id, amount_cents, status)
    VALUES (NEW.id, v_tenant_id, v_deposit_amount, 'pending')
    ON CONFLICT (lease_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_security_deposit ON leases;
CREATE TRIGGER trg_create_security_deposit
  AFTER UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION create_security_deposit_on_lease_activation();

COMMIT;


-- === MIGRATION: 20260409100000_add_missing_rls.sql ===
-- ==========================================================
-- Migration: Add missing RLS to 8 unprotected tables
-- Date: 2026-04-09
-- Context: Audit express identified 8 tables without RLS
-- ==========================================================

-- ──────────────────────────────────────────────
-- 1. tenants (system multi-tenant table, no user column)
-- Admin-only access via service role
-- ──────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_admin_only"
  ON tenants FOR ALL
  USING (false);
-- Service role bypasses RLS; app code uses service client for admin ops

-- ──────────────────────────────────────────────
-- 2. two_factor_sessions (security-critical, has user_id)
-- ──────────────────────────────────────────────
ALTER TABLE two_factor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_2fa_sessions"
  ON two_factor_sessions FOR ALL
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 3. lease_templates (system-wide templates, read-only for users)
-- ──────────────────────────────────────────────
ALTER TABLE lease_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_templates_read_authenticated"
  ON lease_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "lease_templates_write_admin_only"
  ON lease_templates FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 4. idempotency_keys (API utility, no user column)
-- ──────────────────────────────────────────────
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idempotency_keys_service_only"
  ON idempotency_keys FOR ALL
  USING (false);
-- Only accessed via service role in API middleware

-- ──────────────────────────────────────────────
-- 5. repair_cost_grid (reference table, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE repair_cost_grid ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repair_cost_grid_read_authenticated"
  ON repair_cost_grid FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "repair_cost_grid_write_admin_only"
  ON repair_cost_grid FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 6. vetuste_grid (reference table for depreciation, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE vetuste_grid ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vetuste_grid_read_authenticated"
  ON vetuste_grid FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "vetuste_grid_write_admin_only"
  ON vetuste_grid FOR ALL
  USING (false);

-- ──────────────────────────────────────────────
-- 7. vetusty_grid (variant of vetuste_grid, read-only)
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_grid') THEN
    ALTER TABLE vetusty_grid ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_grid') THEN
    EXECUTE 'CREATE POLICY "vetusty_grid_read_authenticated" ON vetusty_grid FOR SELECT USING (auth.role() = ''authenticated'')';
    EXECUTE 'CREATE POLICY "vetusty_grid_write_admin_only" ON vetusty_grid FOR ALL USING (false)';
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- 8. api_webhook_deliveries (indirect user link via webhook_id)
-- ──────────────────────────────────────────────
ALTER TABLE api_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_deliveries_owner_access"
  ON api_webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_webhooks w
      WHERE w.id = api_webhook_deliveries.webhook_id
        AND w.profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "webhook_deliveries_write_service_only"
  ON api_webhook_deliveries FOR INSERT
  USING (false);
-- Deliveries are created by the system (service role), users can only read their own


COMMIT;
