-- =====================================================
-- Migration : Index de performance
-- Date : 2024-12-01
-- Description : Ajoute des index pour optimiser les requêtes fréquentes
-- =====================================================

-- =====================================================
-- INDEX POUR LA TABLE PROFILES
-- =====================================================

-- Index sur le rôle (filtrage fréquent)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Index sur user_id (jointures fréquentes)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Index composite pour les recherches admin
CREATE INDEX IF NOT EXISTS idx_profiles_role_created_at ON profiles(role, created_at DESC);

-- =====================================================
-- INDEX POUR LA TABLE PROPERTIES
-- =====================================================

-- Index sur owner_id (filtrage principal)
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);

-- Index sur le type de bien
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);

-- Index sur la ville (recherche géographique)
CREATE INDEX IF NOT EXISTS idx_properties_ville ON properties(ville);

-- Index sur le code postal
CREATE INDEX IF NOT EXISTS idx_properties_code_postal ON properties(code_postal);

-- Index composite propriétaire + type
CREATE INDEX IF NOT EXISTS idx_properties_owner_type ON properties(owner_id, type);

-- Index pour la recherche full-text sur l'adresse
CREATE INDEX IF NOT EXISTS idx_properties_adresse_gin ON properties 
  USING GIN (to_tsvector('french', coalesce(adresse_complete, '') || ' ' || coalesce(ville, '')));

-- =====================================================
-- INDEX POUR LA TABLE LEASES
-- =====================================================

-- Index sur property_id
CREATE INDEX IF NOT EXISTS idx_leases_property_id ON leases(property_id);

-- Index sur le statut (filtrage très fréquent)
CREATE INDEX IF NOT EXISTS idx_leases_statut ON leases(statut);

-- Index sur le type de bail
CREATE INDEX IF NOT EXISTS idx_leases_type_bail ON leases(type_bail);

-- Index composite pour les baux actifs par propriété
CREATE INDEX IF NOT EXISTS idx_leases_property_statut ON leases(property_id, statut);

-- Index sur les dates pour les rappels
CREATE INDEX IF NOT EXISTS idx_leases_date_debut ON leases(date_debut);
CREATE INDEX IF NOT EXISTS idx_leases_date_fin ON leases(date_fin) WHERE date_fin IS NOT NULL;

-- =====================================================
-- INDEX POUR LA TABLE LEASE_SIGNERS
-- =====================================================

-- Index sur lease_id
CREATE INDEX IF NOT EXISTS idx_lease_signers_lease_id ON lease_signers(lease_id);

-- Index sur profile_id
CREATE INDEX IF NOT EXISTS idx_lease_signers_profile_id ON lease_signers(profile_id);

-- Index sur le statut de signature
CREATE INDEX IF NOT EXISTS idx_lease_signers_signature_status ON lease_signers(signature_status);

-- Index composite pour trouver les signatures en attente
CREATE INDEX IF NOT EXISTS idx_lease_signers_pending ON lease_signers(profile_id, signature_status) 
  WHERE signature_status = 'pending';

-- =====================================================
-- INDEX POUR LA TABLE INVOICES
-- =====================================================

-- Index sur lease_id
CREATE INDEX IF NOT EXISTS idx_invoices_lease_id ON invoices(lease_id);

-- Index sur owner_id
CREATE INDEX IF NOT EXISTS idx_invoices_owner_id ON invoices(owner_id);

-- Index sur tenant_id  
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);

-- Index sur le statut
CREATE INDEX IF NOT EXISTS idx_invoices_statut ON invoices(statut);

-- Index sur la période
CREATE INDEX IF NOT EXISTS idx_invoices_periode ON invoices(periode);

-- Index composite pour les factures impayées
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid ON invoices(owner_id, statut) 
  WHERE statut IN ('sent', 'late');

-- =====================================================
-- INDEX POUR LA TABLE PAYMENTS
-- =====================================================

-- Index sur invoice_id
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);

-- Index sur le statut
CREATE INDEX IF NOT EXISTS idx_payments_statut ON payments(statut);

-- Index sur la date de paiement
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date_paiement DESC);

-- =====================================================
-- INDEX POUR LA TABLE TICKETS
-- =====================================================

-- Index sur property_id
CREATE INDEX IF NOT EXISTS idx_tickets_property_id ON tickets(property_id);

-- Index sur le statut
CREATE INDEX IF NOT EXISTS idx_tickets_statut ON tickets(statut);

-- Index sur la priorité
CREATE INDEX IF NOT EXISTS idx_tickets_priorite ON tickets(priorite);

-- Index sur le créateur
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by_profile_id);

-- Index composite pour les tickets ouverts par priorité
CREATE INDEX IF NOT EXISTS idx_tickets_open_priority ON tickets(property_id, priorite, statut) 
  WHERE statut IN ('open', 'in_progress');

-- =====================================================
-- INDEX POUR LA TABLE DOCUMENTS
-- =====================================================

-- Index sur le type de document
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

-- Index sur property_id
CREATE INDEX IF NOT EXISTS idx_documents_property_id ON documents(property_id);

-- Index sur lease_id
CREATE INDEX IF NOT EXISTS idx_documents_lease_id ON documents(lease_id);

-- Index sur owner_id
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);

-- =====================================================
-- INDEX POUR LA TABLE NOTIFICATIONS
-- =====================================================

-- Index sur user_id
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Index sur read_at pour les non-lues
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, created_at DESC) 
  WHERE read_at IS NULL;

-- =====================================================
-- INDEX POUR LA TABLE AUDIT_LOG
-- =====================================================

-- Index sur l'action
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Index sur la table cible
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);

-- Index sur l'utilisateur
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

-- Index sur la date
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON INDEX idx_profiles_role IS 'Optimise les filtres par rôle (admin, owner, tenant, provider)';
COMMENT ON INDEX idx_properties_owner_id IS 'Optimise le chargement des biens par propriétaire';
COMMENT ON INDEX idx_leases_property_statut IS 'Optimise la recherche de baux actifs par propriété';
COMMENT ON INDEX idx_invoices_unpaid IS 'Optimise le calcul des impayés par propriétaire';
COMMENT ON INDEX idx_tickets_open_priority IS 'Optimise l''affichage des tickets ouverts triés par priorité';


