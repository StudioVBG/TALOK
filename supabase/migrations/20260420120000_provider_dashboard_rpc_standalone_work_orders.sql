-- =====================================================
-- Migration: RPC provider_dashboard — tolérance work_orders standalone
-- Date: 2026-04-20
-- Version: pure SQL (pas de PL/pgSQL, pas de variable) pour être
--          compatible avec tous les exécuteurs SQL (Supabase MCP,
--          Studio, psql, CLI).
-- Idempotent: CREATE OR REPLACE, safe à rejouer.
-- =====================================================

CREATE OR REPLACE FUNCTION public.provider_dashboard(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $func$
  WITH me AS (
    SELECT id AS profile_id
    FROM public.profiles
    WHERE user_id = p_user_id
      AND role = 'provider'
    LIMIT 1
  ),
  stats AS (
    SELECT jsonb_build_object(
      'total_interventions',        COUNT(*),
      'completed_interventions',    COUNT(*) FILTER (WHERE wo.statut = 'done'),
      'pending_interventions',      COUNT(*) FILTER (WHERE wo.statut IN ('assigned', 'scheduled')),
      'in_progress_interventions',  COUNT(*) FILTER (WHERE wo.statut = 'in_progress'),
      'total_revenue', COALESCE(
        SUM(COALESCE(wo.cout_final, wo.cout_estime, 0)) FILTER (WHERE wo.statut = 'done'),
        0
      ),
      'avg_rating', (
        SELECT ROUND(AVG(rating_overall)::NUMERIC, 1)
        FROM public.provider_reviews pr
        WHERE pr.provider_profile_id = (SELECT profile_id FROM me)
          AND pr.is_published = true
      ),
      'total_reviews', (
        SELECT COUNT(*)
        FROM public.provider_reviews pr
        WHERE pr.provider_profile_id = (SELECT profile_id FROM me)
          AND pr.is_published = true
      )
    ) AS obj
    FROM public.work_orders wo
    WHERE wo.provider_id = (SELECT profile_id FROM me)
  ),
  pending AS (
    SELECT COALESCE(
      jsonb_agg(order_data ORDER BY (order_data->>'created_at') DESC),
      '[]'::jsonb
    ) AS arr
    FROM (
      SELECT jsonb_build_object(
        'id',                        wo.id,
        'ticket_id',                 wo.ticket_id,
        'statut',                    wo.statut,
        'cout_estime',               wo.cout_estime,
        'date_intervention_prevue',  wo.date_intervention_prevue,
        'created_at',                wo.created_at,
        'ticket', jsonb_build_object(
          'titre',    COALESCE(t.titre, wo.title, 'Intervention'),
          'priorite', COALESCE(t.priorite, wo.urgency, 'normale')
        ),
        'property', jsonb_build_object(
          'adresse', COALESCE(p.adresse_complete, ''),
          'ville',   COALESCE(p.ville, '')
        )
      ) AS order_data
      FROM public.work_orders wo
      LEFT JOIN public.tickets t     ON t.id = wo.ticket_id
      LEFT JOIN public.properties p  ON p.id = COALESCE(wo.property_id, t.property_id)
      WHERE wo.provider_id = (SELECT profile_id FROM me)
        AND wo.statut IN ('assigned', 'scheduled', 'in_progress')
      ORDER BY wo.created_at DESC
      LIMIT 10
    ) sub
  ),
  reviews AS (
    SELECT COALESCE(
      jsonb_agg(review_data ORDER BY (review_data->>'created_at') DESC),
      '[]'::jsonb
    ) AS arr
    FROM (
      SELECT jsonb_build_object(
        'id',             pr.id,
        'rating_overall', pr.rating_overall,
        'comment',        pr.comment,
        'created_at',     pr.created_at,
        'reviewer', jsonb_build_object(
          'prenom', prof.prenom,
          'nom',    CASE
                      WHEN prof.nom IS NULL OR prof.nom = '' THEN ''
                      ELSE LEFT(prof.nom, 1) || '.'
                    END
        )
      ) AS review_data
      FROM public.provider_reviews pr
      JOIN public.profiles prof ON prof.id = pr.reviewer_profile_id
      WHERE pr.provider_profile_id = (SELECT profile_id FROM me)
        AND pr.is_published = true
      ORDER BY pr.created_at DESC
      LIMIT 5
    ) sub
  )
  SELECT
    CASE
      WHEN (SELECT profile_id FROM me) IS NULL THEN NULL
      ELSE jsonb_build_object(
        'profile_id',     (SELECT profile_id FROM me),
        'stats',          COALESCE((SELECT obj FROM stats), jsonb_build_object(
                            'total_interventions', 0,
                            'completed_interventions', 0,
                            'pending_interventions', 0,
                            'in_progress_interventions', 0,
                            'total_revenue', 0,
                            'avg_rating', NULL,
                            'total_reviews', 0
                          )),
        'pending_orders', COALESCE((SELECT arr FROM pending), '[]'::jsonb),
        'recent_reviews', COALESCE((SELECT arr FROM reviews), '[]'::jsonb)
      )
    END;
$func$;

COMMENT ON FUNCTION public.provider_dashboard(UUID) IS
  'Dashboard principal du prestataire. LEFT JOIN tickets + properties via COALESCE(wo.property_id, t.property_id) pour tolérer les work_orders standalone. Pure SQL (pas PL/pgSQL) pour compatibilité avec tous les exécuteurs.';
