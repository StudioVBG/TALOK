-- =====================================================
-- MIGRATION: Analytics Prestataire SOTA 2025
-- Dashboard enrichi avec KPIs avancés
-- =====================================================

-- D'abord, ajouter les colonnes manquantes à work_orders si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'accepted_at') THEN
    ALTER TABLE work_orders ADD COLUMN accepted_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'scheduled_start_at') THEN
    ALTER TABLE work_orders ADD COLUMN scheduled_start_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'actual_start_at') THEN
    ALTER TABLE work_orders ADD COLUMN actual_start_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'actual_end_at') THEN
    ALTER TABLE work_orders ADD COLUMN actual_end_at TIMESTAMPTZ;
  END IF;
END$$;

-- =====================================================
-- 1. FONCTION: Dashboard Analytics Prestataire Simplifié
-- =====================================================

CREATE OR REPLACE FUNCTION provider_analytics_dashboard(
  p_user_id UUID,
  p_period_start DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_period_end DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  -- Récupérer le profil prestataire
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id AND role = 'provider';
  
  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Assembler le résultat simplifié
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'period', jsonb_build_object(
      'start', p_period_start,
      'end', p_period_end
    ),
    'financial', (
      SELECT jsonb_build_object(
        'revenue_period', COALESCE(SUM(CASE WHEN statut = 'done' AND date_intervention_reelle BETWEEN p_period_start AND p_period_end THEN cout_final ELSE 0 END), 0),
        'revenue_pending', COALESCE(SUM(CASE WHEN statut IN ('assigned', 'scheduled') THEN cout_estime ELSE 0 END), 0),
        'invoices_count', COUNT(CASE WHEN statut = 'done' AND date_intervention_reelle BETWEEN p_period_start AND p_period_end THEN 1 END)
      )
      FROM work_orders
      WHERE provider_id = v_profile_id
    ),
    'missions', (
      SELECT jsonb_build_object(
        'total_assigned', COUNT(CASE WHEN created_at::DATE BETWEEN p_period_start AND p_period_end THEN 1 END),
        'completed', COUNT(CASE WHEN statut = 'done' AND date_intervention_reelle BETWEEN p_period_start AND p_period_end THEN 1 END),
        'cancelled', COUNT(CASE WHEN statut = 'cancelled' AND created_at::DATE BETWEEN p_period_start AND p_period_end THEN 1 END),
        'in_progress', COUNT(CASE WHEN statut IN ('assigned', 'scheduled') THEN 1 END)
      )
      FROM work_orders
      WHERE provider_id = v_profile_id
    ),
    'generated_at', NOW()
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- 2. INDEX pour les performances
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_work_orders_date_intervention 
  ON work_orders(date_intervention_reelle);

CREATE INDEX IF NOT EXISTS idx_work_orders_provider_status 
  ON work_orders(provider_id, statut);

-- =====================================================
-- 3. COMMENTAIRES
-- =====================================================

COMMENT ON FUNCTION provider_analytics_dashboard IS 'Dashboard analytics pour un prestataire avec KPIs financiers et missions';
