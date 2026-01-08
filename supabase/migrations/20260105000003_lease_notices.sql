-- Migration: Table des congés locataires
-- Date: 2026-01-05
-- Description: Permet aux locataires de donner congé avec gestion du préavis

-- ============================================================================
-- 1. Table lease_notices - Enregistrement des congés
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lease_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    tenant_profile_id UUID NOT NULL REFERENCES profiles(id),
    
    -- Dates
    notice_date DATE NOT NULL,               -- Date d'envoi du congé
    effective_end_date DATE NOT NULL,        -- Date de fin effective du bail
    notice_period_days INTEGER NOT NULL,     -- Durée du préavis en jours
    
    -- Préavis réduit
    is_reduced_notice BOOLEAN DEFAULT FALSE,
    reduced_notice_reason TEXT,              -- Motif légal pour préavis réduit
    
    -- Informations complémentaires
    forwarding_address TEXT,                 -- Nouvelle adresse du locataire
    notes TEXT,                              -- Commentaires additionnels
    
    -- Statut du congé
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed', 'cancelled')),
    acknowledged_at TIMESTAMPTZ,             -- Date d'accusé réception par le propriétaire
    acknowledged_by UUID REFERENCES auth.users(id),
    
    -- Documents générés
    notice_letter_path TEXT,                 -- Chemin vers la lettre de congé PDF
    
    -- Métadonnées
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_lease_notices_lease_id ON lease_notices(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_notices_tenant ON lease_notices(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_lease_notices_status ON lease_notices(status);
CREATE INDEX IF NOT EXISTS idx_lease_notices_end_date ON lease_notices(effective_end_date);

-- ============================================================================
-- 2. Mise à jour du statut possible des baux
-- ============================================================================
-- Ajouter le statut "notice_given" si pas déjà présent dans la contrainte
DO $$
BEGIN
    -- Vérifier si la contrainte existe et la mettre à jour
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'leases_statut_check' 
        AND conrelid = 'leases'::regclass
    ) THEN
        ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;
    END IF;
    
    -- Ajouter la nouvelle contrainte avec tous les statuts
    ALTER TABLE leases ADD CONSTRAINT leases_statut_check 
        CHECK (statut IN (
            'draft', 
            'sent', 
            'pending_signature', 
            'partially_signed',
            'pending_owner_signature',
            'fully_signed', 
            'active', 
            'notice_given',     -- NOUVEAU: Congé donné
            'amended', 
            'terminated', 
            'archived'
        ));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Contrainte statut déjà à jour ou autre erreur: %', SQLERRM;
END $$;

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================
ALTER TABLE lease_notices ENABLE ROW LEVEL SECURITY;

-- Locataire peut voir ses propres congés
CREATE POLICY "Tenant can view own notices" ON lease_notices
    FOR SELECT
    USING (
        tenant_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Locataire peut créer un congé pour son bail
CREATE POLICY "Tenant can create notice" ON lease_notices
    FOR INSERT
    WITH CHECK (
        tenant_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM lease_signers ls
            WHERE ls.lease_id = lease_notices.lease_id
            AND ls.profile_id = lease_notices.tenant_profile_id
            AND ls.role IN ('locataire_principal', 'colocataire')
        )
    );

-- Propriétaire peut voir les congés de ses baux
CREATE POLICY "Owner can view notices" ON lease_notices
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN properties p ON l.property_id = p.id
            JOIN profiles pr ON p.owner_id = pr.id
            WHERE l.id = lease_notices.lease_id
            AND pr.user_id = auth.uid()
        )
    );

-- Propriétaire peut mettre à jour le statut (acknowledged)
CREATE POLICY "Owner can update notice status" ON lease_notices
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN properties p ON l.property_id = p.id
            JOIN profiles pr ON p.owner_id = pr.id
            WHERE l.id = lease_notices.lease_id
            AND pr.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN properties p ON l.property_id = p.id
            JOIN profiles pr ON p.owner_id = pr.id
            WHERE l.id = lease_notices.lease_id
            AND pr.user_id = auth.uid()
        )
    );

-- Admin a accès complet
CREATE POLICY "Admin full access notices" ON lease_notices
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- 4. Trigger pour updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_lease_notices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_lease_notices_updated_at ON lease_notices;
CREATE TRIGGER tr_lease_notices_updated_at
    BEFORE UPDATE ON lease_notices
    FOR EACH ROW
    EXECUTE FUNCTION update_lease_notices_updated_at();

-- ============================================================================
-- 5. Vue pour les congés à venir (utile pour le propriétaire)
-- ============================================================================
CREATE OR REPLACE VIEW v_upcoming_lease_notices AS
SELECT 
    ln.id as notice_id,
    ln.lease_id,
    ln.notice_date,
    ln.effective_end_date,
    ln.notice_period_days,
    ln.is_reduced_notice,
    ln.reduced_notice_reason,
    ln.status,
    ln.forwarding_address,
    l.type_bail,
    l.loyer,
    p.adresse_complete,
    p.ville,
    p.owner_id,
    tp.prenom as tenant_prenom,
    tp.nom as tenant_nom,
    tp.email as tenant_email,
    (ln.effective_end_date - CURRENT_DATE) as days_until_end
FROM lease_notices ln
JOIN leases l ON ln.lease_id = l.id
JOIN properties p ON l.property_id = p.id
JOIN profiles tp ON ln.tenant_profile_id = tp.id
WHERE ln.status != 'cancelled'
AND ln.effective_end_date >= CURRENT_DATE
ORDER BY ln.effective_end_date ASC;

-- Confirmation
SELECT 'Migration lease_notices appliquée avec succès' AS status;

