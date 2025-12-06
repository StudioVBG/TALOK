-- ============================================
-- Migration: Colocation Avancée - SOTA 2025
-- Gestion complète des colocations avec recalcul des parts
-- ============================================

-- ============================================
-- 1. CONFIGURATION COLOCATION SUR LE BAIL
-- ============================================

-- Ajouter la configuration colocation au bail
ALTER TABLE leases ADD COLUMN IF NOT EXISTS coloc_config JSONB DEFAULT NULL;
-- Structure: {
--   nb_places: number,
--   bail_type: 'unique' | 'individuel',
--   solidarite: boolean,
--   solidarite_duration_months: number (max 6),
--   split_mode: 'equal' | 'custom' | 'by_room',
--   solidarite_end_date: date
-- }

COMMENT ON COLUMN leases.coloc_config IS 'Configuration colocation: nb_places, type bail, solidarité, mode de split';

-- ============================================
-- 2. TABLE: DEPOSIT_SHARES (Parts de dépôt de garantie)
-- ============================================

CREATE TABLE IF NOT EXISTS deposit_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  roommate_id UUID NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  
  -- Montants
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'partial', 'paid', 'refund_pending', 'refunded', 'retained')),
  
  -- Restitution
  refund_amount NUMERIC(10,2) DEFAULT NULL,
  retention_amount NUMERIC(10,2) DEFAULT NULL,
  retention_reason TEXT,
  refunded_at TIMESTAMPTZ,
  
  -- Dates
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(lease_id, roommate_id)
);

CREATE INDEX idx_deposit_shares_lease_id ON deposit_shares(lease_id);
CREATE INDEX idx_deposit_shares_roommate_id ON deposit_shares(roommate_id);
CREATE INDEX idx_deposit_shares_status ON deposit_shares(status);

COMMENT ON TABLE deposit_shares IS 'Parts de dépôt de garantie par colocataire';

-- ============================================
-- 3. TABLE: PAYMENT_ADJUSTMENTS (Ajustements de paiement)
-- ============================================

CREATE TABLE IF NOT EXISTS payment_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- Premier jour du mois (YYYY-MM-01)
  roommate_id UUID NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  
  -- Montants
  original_amount NUMERIC(10,2) NOT NULL,
  adjusted_amount NUMERIC(10,2) NOT NULL,
  difference NUMERIC(10,2) GENERATED ALWAYS AS (adjusted_amount - original_amount) STORED,
  
  -- Raison du changement
  reason TEXT NOT NULL CHECK (reason IN (
    'new_roommate',      -- Nouveau colocataire arrivé
    'roommate_left',     -- Colocataire parti
    'weight_change',     -- Changement de répartition
    'rent_revision',     -- Révision du loyer
    'prorata_entry',     -- Prorata entrée en cours de mois
    'prorata_exit',      -- Prorata sortie en cours de mois
    'manual'             -- Ajustement manuel
  )),
  triggered_by_roommate_id UUID REFERENCES roommates(id), -- Qui a causé le changement
  
  -- Traitement du crédit/débit
  credit_type TEXT CHECK (credit_type IN (
    'next_month',    -- Reporté sur le mois suivant
    'refund',        -- Remboursement
    'redistribute',  -- Redistribué aux autres
    'pending'        -- En attente de décision
  )),
  credit_applied BOOLEAN DEFAULT false,
  credit_applied_to_month DATE,
  
  -- Notes
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_adjustments_lease_id ON payment_adjustments(lease_id);
CREATE INDEX idx_payment_adjustments_month ON payment_adjustments(month);
CREATE INDEX idx_payment_adjustments_roommate_id ON payment_adjustments(roommate_id);
CREATE INDEX idx_payment_adjustments_reason ON payment_adjustments(reason);

COMMENT ON TABLE payment_adjustments IS 'Historique des ajustements de parts de paiement';

-- ============================================
-- 4. TABLE: PAYMENT_CREDITS (Crédits de paiement)
-- ============================================

CREATE TABLE IF NOT EXISTS payment_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roommate_id UUID NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  
  -- Montant (positif = crédit, négatif = débit)
  amount NUMERIC(10,2) NOT NULL,
  
  -- Origine
  reason TEXT NOT NULL,
  adjustment_id UUID REFERENCES payment_adjustments(id),
  source_month DATE, -- Mois d'où provient le crédit
  
  -- Utilisation
  status TEXT NOT NULL DEFAULT 'available' 
    CHECK (status IN ('available', 'applied', 'refunded', 'expired', 'cancelled')),
  applied_to_month DATE,
  applied_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  expires_at DATE, -- Date d'expiration du crédit
  
  -- Traçabilité
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_credits_roommate_id ON payment_credits(roommate_id);
CREATE INDEX idx_payment_credits_lease_id ON payment_credits(lease_id);
CREATE INDEX idx_payment_credits_status ON payment_credits(status);

COMMENT ON TABLE payment_credits IS 'Crédits de paiement (trop-perçus, avoirs)';

-- ============================================
-- 5. TABLE: ROOMMATE_HISTORY (Historique des changements)
-- ============================================

CREATE TABLE IF NOT EXISTS roommate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  roommate_id UUID NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  
  -- Type d'événement
  event_type TEXT NOT NULL CHECK (event_type IN (
    'joined',           -- Arrivée
    'left',             -- Départ
    'weight_changed',   -- Changement de part
    'role_changed',     -- Changement de rôle
    'guarantor_added',  -- Garant ajouté
    'guarantor_removed' -- Garant retiré
  )),
  
  -- Valeurs avant/après
  old_value JSONB,
  new_value JSONB,
  
  -- Contexte
  effective_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roommate_history_lease_id ON roommate_history(lease_id);
CREATE INDEX idx_roommate_history_roommate_id ON roommate_history(roommate_id);
CREATE INDEX idx_roommate_history_event_type ON roommate_history(event_type);
CREATE INDEX idx_roommate_history_effective_date ON roommate_history(effective_date);

COMMENT ON TABLE roommate_history IS 'Historique complet des changements de colocataires (audit trail)';

-- ============================================
-- 6. AJOUTER CHAMPS MANQUANTS À ROOMMATES
-- ============================================

-- Lien vers la chambre (pour baux individuels ou répartition par chambre)
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);

-- Garants multiples (JSON array de profile_ids)
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS guarantor_ids UUID[] DEFAULT '{}';

-- Date effective pour le calcul des parts
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS effective_from DATE;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS effective_until DATE;

-- Email d'invitation (avant création du compte)
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS invited_email TEXT;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'pending'
  CHECK (invitation_status IN ('pending', 'sent', 'accepted', 'declined', 'expired'));

COMMENT ON COLUMN roommates.room_id IS 'Chambre attribuée au colocataire';
COMMENT ON COLUMN roommates.guarantor_ids IS 'Liste des garants (profile_ids)';
COMMENT ON COLUMN roommates.invited_email IS 'Email utilisé pour l''invitation';

-- ============================================
-- 7. FONCTION: RECALCUL DES PARTS AVEC PRORATA
-- ============================================

CREATE OR REPLACE FUNCTION recalculate_payment_shares(
  p_lease_id UUID,
  p_month DATE,
  p_trigger_type TEXT DEFAULT 'manual',
  p_triggered_by UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_lease RECORD;
  v_total_rent NUMERIC;
  v_days_in_month INTEGER;
  v_roommate RECORD;
  v_old_share RECORD;
  v_new_amount NUMERIC;
  v_total_weight NUMERIC;
  v_prorata_days INTEGER;
  v_result JSONB := '{"adjustments": [], "created": [], "updated": []}'::JSONB;
BEGIN
  -- Récupérer le bail et le loyer total
  SELECT l.*, 
         COALESCE(l.loyer, 0) + COALESCE(l.charges_forfaitaires, 0) as total_rent
  INTO v_lease
  FROM leases l 
  WHERE l.id = p_lease_id;
  
  IF v_lease IS NULL THEN
    RAISE EXCEPTION 'Bail non trouvé: %', p_lease_id;
  END IF;
  
  v_total_rent := v_lease.total_rent;
  
  -- Nombre de jours dans le mois
  v_days_in_month := EXTRACT(DAY FROM (
    (p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day'
  ))::INTEGER;
  
  -- Calculer le poids total des colocataires actifs ce mois
  SELECT COALESCE(SUM(
    r.weight * (
      LEAST(
        COALESCE(r.left_on, (p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day'),
        (p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day'
      ) - 
      GREATEST(r.joined_on, p_month) + 1
    )::NUMERIC / v_days_in_month
  ), 0)
  INTO v_total_weight
  FROM roommates r
  WHERE r.lease_id = p_lease_id
    AND r.joined_on <= ((p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day')
    AND (r.left_on IS NULL OR r.left_on >= p_month)
    AND r.role IN ('principal', 'tenant');
  
  -- Si aucun colocataire, ne rien faire
  IF v_total_weight = 0 THEN
    RETURN v_result;
  END IF;
  
  -- Pour chaque colocataire actif pendant ce mois
  FOR v_roommate IN
    SELECT r.*,
           GREATEST(r.joined_on, p_month) as period_start,
           LEAST(
             COALESCE(r.left_on, (p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day'),
             (p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day'
           ) as period_end
    FROM roommates r
    WHERE r.lease_id = p_lease_id
      AND r.joined_on <= ((p_month + INTERVAL '1 month')::DATE - INTERVAL '1 day')
      AND (r.left_on IS NULL OR r.left_on >= p_month)
      AND r.role IN ('principal', 'tenant')
  LOOP
    -- Calculer le prorata de jours
    v_prorata_days := (v_roommate.period_end - v_roommate.period_start + 1)::INTEGER;
    
    -- Calculer le nouveau montant dû
    v_new_amount := ROUND(
      v_total_rent * v_roommate.weight * v_prorata_days::NUMERIC / v_days_in_month,
      2
    );
    
    -- Récupérer l'ancienne part si elle existe
    SELECT * INTO v_old_share
    FROM payment_shares
    WHERE lease_id = p_lease_id 
      AND month = p_month 
      AND roommate_id = v_roommate.id;
    
    -- Créer ou mettre à jour la part
    IF v_old_share IS NULL THEN
      -- Créer nouvelle part
      INSERT INTO payment_shares (lease_id, month, roommate_id, due_amount)
      VALUES (p_lease_id, p_month, v_roommate.id, v_new_amount);
      
      v_result := jsonb_set(
        v_result, 
        '{created}', 
        v_result->'created' || jsonb_build_object(
          'roommate_id', v_roommate.id,
          'amount', v_new_amount
        )
      );
    ELSE
      -- Mettre à jour si le montant a changé
      IF v_old_share.due_amount != v_new_amount THEN
        UPDATE payment_shares 
        SET due_amount = v_new_amount, updated_at = NOW()
        WHERE id = v_old_share.id;
        
        -- Créer un ajustement
        INSERT INTO payment_adjustments (
          lease_id, month, roommate_id,
          original_amount, adjusted_amount,
          reason, triggered_by_roommate_id, created_by,
          credit_type
        ) VALUES (
          p_lease_id, p_month, v_roommate.id,
          v_old_share.due_amount, v_new_amount,
          p_trigger_type, p_triggered_by, p_created_by,
          CASE 
            WHEN v_old_share.amount_paid > v_new_amount THEN 'pending'
            ELSE NULL
          END
        );
        
        -- Si trop payé, créer un crédit
        IF v_old_share.amount_paid > v_new_amount THEN
          INSERT INTO payment_credits (
            roommate_id, lease_id, amount, reason,
            source_month, created_by
          ) VALUES (
            v_roommate.id, p_lease_id, 
            v_old_share.amount_paid - v_new_amount,
            'Ajustement ' || p_trigger_type || ' - ' || to_char(p_month, 'MM/YYYY'),
            p_month, p_created_by
          );
        END IF;
        
        v_result := jsonb_set(
          v_result, 
          '{adjustments}', 
          v_result->'adjustments' || jsonb_build_object(
            'roommate_id', v_roommate.id,
            'old_amount', v_old_share.due_amount,
            'new_amount', v_new_amount,
            'difference', v_new_amount - v_old_share.due_amount
          )
        );
      END IF;
    END IF;
  END LOOP;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_payment_shares IS 'Recalcule les parts de paiement avec prorata temporis';

-- ============================================
-- 8. FONCTION: CALCULER LES PARTS POUR UN NOUVEAU MOIS
-- ============================================

CREATE OR REPLACE FUNCTION generate_monthly_shares(
  p_lease_id UUID,
  p_month DATE
) RETURNS JSONB AS $$
BEGIN
  RETURN recalculate_payment_shares(p_lease_id, p_month, 'manual', NULL, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. TRIGGER: HISTORIQUE DES CHANGEMENTS DE ROOMMATES
-- ============================================

CREATE OR REPLACE FUNCTION log_roommate_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO roommate_history (
      lease_id, roommate_id, event_type, 
      new_value, effective_date
    ) VALUES (
      NEW.lease_id, NEW.id, 'joined',
      jsonb_build_object(
        'role', NEW.role,
        'weight', NEW.weight,
        'joined_on', NEW.joined_on
      ),
      NEW.joined_on
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Départ
    IF OLD.left_on IS NULL AND NEW.left_on IS NOT NULL THEN
      INSERT INTO roommate_history (
        lease_id, roommate_id, event_type,
        old_value, new_value, effective_date
      ) VALUES (
        NEW.lease_id, NEW.id, 'left',
        jsonb_build_object('left_on', OLD.left_on),
        jsonb_build_object('left_on', NEW.left_on),
        NEW.left_on
      );
    END IF;
    
    -- Changement de poids
    IF OLD.weight != NEW.weight THEN
      INSERT INTO roommate_history (
        lease_id, roommate_id, event_type,
        old_value, new_value, effective_date
      ) VALUES (
        NEW.lease_id, NEW.id, 'weight_changed',
        jsonb_build_object('weight', OLD.weight),
        jsonb_build_object('weight', NEW.weight),
        CURRENT_DATE
      );
    END IF;
    
    -- Changement de rôle
    IF OLD.role != NEW.role THEN
      INSERT INTO roommate_history (
        lease_id, roommate_id, event_type,
        old_value, new_value, effective_date
      ) VALUES (
        NEW.lease_id, NEW.id, 'role_changed',
        jsonb_build_object('role', OLD.role),
        jsonb_build_object('role', NEW.role),
        CURRENT_DATE
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS roommate_history_trigger ON roommates;
CREATE TRIGGER roommate_history_trigger
  AFTER INSERT OR UPDATE ON roommates
  FOR EACH ROW
  EXECUTE FUNCTION log_roommate_changes();

-- ============================================
-- 10. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE deposit_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommate_history ENABLE ROW LEVEL SECURITY;

-- Policies pour deposit_shares
CREATE POLICY "Owners can manage deposit shares"
  ON deposit_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE l.id = deposit_shares.lease_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY "Roommates can view their deposit share"
  ON deposit_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roommates r
      WHERE r.id = deposit_shares.roommate_id
        AND r.user_id = auth.uid()
    )
  );

-- Policies pour payment_adjustments
CREATE POLICY "Owners can manage payment adjustments"
  ON payment_adjustments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE l.id = payment_adjustments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY "Roommates can view their adjustments"
  ON payment_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roommates r
      WHERE r.id = payment_adjustments.roommate_id
        AND r.user_id = auth.uid()
    )
  );

-- Policies pour payment_credits
CREATE POLICY "Owners can manage payment credits"
  ON payment_credits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE l.id = payment_credits.lease_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY "Roommates can view their credits"
  ON payment_credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roommates r
      WHERE r.id = payment_credits.roommate_id
        AND r.user_id = auth.uid()
    )
  );

-- Policies pour roommate_history
CREATE POLICY "Owners can view roommate history"
  ON roommate_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE l.id = roommate_history.lease_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY "Roommates can view history of their lease"
  ON roommate_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roommates r
      WHERE r.lease_id = roommate_history.lease_id
        AND r.user_id = auth.uid()
    )
  );

-- ============================================
-- 11. TRIGGERS UPDATED_AT
-- ============================================

CREATE TRIGGER update_deposit_shares_updated_at 
  BEFORE UPDATE ON deposit_shares 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_credits_updated_at 
  BEFORE UPDATE ON payment_credits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================

COMMENT ON SCHEMA public IS 'Migration colocation avancée appliquée - SOTA 2025';

