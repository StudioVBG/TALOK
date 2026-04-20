-- =====================================================
-- Migration: RPC provider_dashboard — tolérance work_orders standalone
-- Date: 2026-04-20
--
-- CONTEXTE:
-- Depuis 20260408120000_providers_module_sota.sql, work_orders.ticket_id
-- est NULLABLE (création directe depuis le module prestataire sans ticket
-- d'amont). Les colonnes work_orders.property_id / owner_id ont été
-- ajoutées pour couvrir ces cas standalone.
--
-- La RPC provider_dashboard() (20251205700000_provider_missing_tables.sql
-- puis 20251206750000_fix_all_missing_tables.sql) utilise encore des
-- JOIN INNER sur tickets et properties :
--
--     FROM work_orders wo
--     JOIN tickets t ON t.id = wo.ticket_id
--     JOIN properties p ON p.id = t.property_id
--
-- Résultat: tout work_order standalone (ticket_id NULL) est invisible sur
-- le dashboard prestataire.
--
-- FIX:
-- - LEFT JOIN tickets + LEFT JOIN properties via COALESCE(wo.property_id,
--   t.property_id) pour couvrir les deux chemins.
-- - COALESCE sur titre/priorite pour tomber sur work_orders.title/urgency
--   (ajoutées par 20260408120000) quand le ticket est absent.
-- - Aucune modification de schéma, signature de la fonction inchangée,
--   SECURITY DEFINER conservée.
--
-- Idempotent: CREATE OR REPLACE, safe à rejouer.
-- =====================================================

CREATE OR REPLACE FUNCTION public.provider_dashboard(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_stats JSONB;
  v_pending_orders JSONB;
  v_recent_reviews JSONB;
BEGIN
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id AND role = 'provider';

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Stats globales (inchangé — tolérance sur WOs sans ticket est implicite
  -- puisqu'on agrège uniquement sur work_orders)
  SELECT jsonb_build_object(
    'total_interventions', COUNT(*),
    'completed_interventions', COUNT(*) FILTER (WHERE statut = 'done'),
    'pending_interventions', COUNT(*) FILTER (WHERE statut IN ('assigned', 'scheduled')),
    'in_progress_interventions', COUNT(*) FILTER (WHERE statut = 'in_progress'),
    'total_revenue', COALESCE(
      SUM(COALESCE(cout_final, cout_estime, 0)) FILTER (WHERE statut = 'done'),
      0
    ),
    'avg_rating', (
      SELECT ROUND(AVG(rating_overall)::NUMERIC, 1)
      FROM provider_reviews
      WHERE provider_profile_id = v_profile_id AND is_published = true
    ),
    'total_reviews', (
      SELECT COUNT(*) FROM provider_reviews
      WHERE provider_profile_id = v_profile_id AND is_published = true
    )
  ) INTO v_stats
  FROM work_orders
  WHERE provider_id = v_profile_id;

  -- Interventions en attente — LEFT JOIN pour inclure les WOs standalone
  SELECT COALESCE(jsonb_agg(order_data ORDER BY order_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_pending_orders
  FROM (
    SELECT jsonb_build_object(
      'id', wo.id,
      'ticket_id', wo.ticket_id,
      'statut', wo.statut,
      'cout_estime', wo.cout_estime,
      'date_intervention_prevue', wo.date_intervention_prevue,
      'created_at', wo.created_at,
      'ticket', jsonb_build_object(
        'titre', COALESCE(t.titre, wo.title, 'Intervention'),
        'priorite', COALESCE(t.priorite, wo.urgency, 'normale')
      ),
      'property', jsonb_build_object(
        'adresse', COALESCE(p.adresse_complete, ''),
        'ville', COALESCE(p.ville, '')
      )
    ) as order_data
    FROM work_orders wo
    LEFT JOIN tickets t ON t.id = wo.ticket_id
    LEFT JOIN properties p ON p.id = COALESCE(wo.property_id, t.property_id)
    WHERE wo.provider_id = v_profile_id
      AND wo.statut IN ('assigned', 'scheduled', 'in_progress')
    ORDER BY wo.created_at DESC
    LIMIT 10
  ) sub;

  -- Avis récents (inchangé)
  SELECT COALESCE(jsonb_agg(review_data ORDER BY review_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_recent_reviews
  FROM (
    SELECT jsonb_build_object(
      'id', pr.id,
      'rating_overall', pr.rating_overall,
      'comment', pr.comment,
      'created_at', pr.created_at,
      'reviewer', jsonb_build_object(
        'prenom', prof.prenom,
        'nom', CASE
          WHEN prof.nom IS NULL OR prof.nom = '' THEN ''
          ELSE LEFT(prof.nom, 1) || '.'
        END
      )
    ) as review_data
    FROM provider_reviews pr
    JOIN profiles prof ON prof.id = pr.reviewer_profile_id
    WHERE pr.provider_profile_id = v_profile_id
      AND pr.is_published = true
    ORDER BY pr.created_at DESC
    LIMIT 5
  ) sub;

  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'stats', v_stats,
    'pending_orders', v_pending_orders,
    'recent_reviews', v_recent_reviews
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.provider_dashboard(UUID) IS
  'Dashboard principal du prestataire. LEFT JOIN tickets + properties via '
  'COALESCE(wo.property_id, t.property_id) pour tolérer les work_orders '
  'standalone (sans ticket). Fallback titre/priorité sur work_orders.title / '
  'work_orders.urgency quand aucun ticket attaché.';
