-- ============================================
-- Migration: admin_stats — propertiesByRentalStatus + filtre soft-delete
-- Date: 2026-04-21
-- Contexte:
--   Le frontend lisait propertiesByType.active/rented/draft/archived,
--   clefs qui n'ont jamais existe (le RPC renvoyait des TYPES).
--   - Bien se fonder sur properties.rental_status (enum reel: vacant, ...)
--   - Filtrer properties.deleted_at IS NULL pour exclure les soft-deletes
--   - Exposer deletedProperties separement pour la tracabilite
-- ============================================

DROP FUNCTION IF EXISTS public.admin_stats();

CREATE FUNCTION public.admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_result JSONB;
BEGIN
  v_is_admin := EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = v_user_id AND role IN ('admin', 'platform_admin')
  );

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acces refuse : reserve aux administrateurs';
  END IF;

  v_result := jsonb_build_object(
    'totalUsers', (SELECT COUNT(*)::INT FROM public.profiles),
    'usersByRole', (
      SELECT jsonb_build_object(
        'admin',          COUNT(*) FILTER (WHERE role = 'admin'),
        'platform_admin', COUNT(*) FILTER (WHERE role = 'platform_admin'),
        'owner',          COUNT(*) FILTER (WHERE role = 'owner'),
        'tenant',         COUNT(*) FILTER (WHERE role = 'tenant'),
        'provider',       COUNT(*) FILTER (WHERE role = 'provider'),
        'syndic',         COUNT(*) FILTER (WHERE role = 'syndic'),
        'agency',         COUNT(*) FILTER (WHERE role = 'agency'),
        'guarantor',      COUNT(*) FILTER (WHERE role = 'guarantor'),
        'coproprietaire', COUNT(*) FILTER (WHERE role = 'coproprietaire')
      )
      FROM public.profiles
    ),
    'totalProperties', (
      SELECT COUNT(*)::INT FROM public.properties WHERE deleted_at IS NULL
    ),
    'deletedProperties', (
      SELECT COUNT(*)::INT FROM public.properties WHERE deleted_at IS NOT NULL
    ),
    'propertiesByType', COALESCE((
      SELECT jsonb_object_agg(type, cnt)
      FROM (
        SELECT COALESCE(type, 'non_defini') AS type, COUNT(*)::INT AS cnt
        FROM public.properties
        WHERE deleted_at IS NULL
        GROUP BY COALESCE(type, 'non_defini')
      ) t
    ), '{}'::jsonb),
    'propertiesByRentalStatus', COALESCE((
      SELECT jsonb_object_agg(rental_status, cnt)
      FROM (
        SELECT COALESCE(rental_status, 'non_defini') AS rental_status, COUNT(*)::INT AS cnt
        FROM public.properties
        WHERE deleted_at IS NULL
        GROUP BY COALESCE(rental_status, 'non_defini')
      ) t
    ), '{}'::jsonb),
    'totalLeases', (SELECT COUNT(*)::INT FROM public.leases),
    'activeLeases', (SELECT COUNT(*)::INT FROM public.leases WHERE statut = 'active'),
    'leasesByStatus', COALESCE((
      SELECT jsonb_object_agg(statut, cnt)
      FROM (
        SELECT COALESCE(statut, 'non_defini') AS statut, COUNT(*)::INT AS cnt
        FROM public.leases
        GROUP BY COALESCE(statut, 'non_defini')
      ) t
    ), '{}'::jsonb),
    'totalInvoices', (SELECT COUNT(*)::INT FROM public.invoices),
    'unpaidInvoices', (SELECT COUNT(*)::INT FROM public.invoices WHERE statut IN ('sent', 'late')),
    'invoicesByStatus', COALESCE((
      SELECT jsonb_object_agg(statut, cnt)
      FROM (
        SELECT COALESCE(statut, 'non_defini') AS statut, COUNT(*)::INT AS cnt
        FROM public.invoices
        GROUP BY COALESCE(statut, 'non_defini')
      ) t
    ), '{}'::jsonb),
    'totalTickets', (SELECT COUNT(*)::INT FROM public.tickets),
    'openTickets', (SELECT COUNT(*)::INT FROM public.tickets WHERE statut = 'open'),
    'ticketsByStatus', COALESCE((
      SELECT jsonb_object_agg(statut, cnt)
      FROM (
        SELECT COALESCE(statut, 'non_defini') AS statut, COUNT(*)::INT AS cnt
        FROM public.tickets
        GROUP BY COALESCE(statut, 'non_defini')
      ) t
    ), '{}'::jsonb),
    'totalDocuments', (SELECT COUNT(*)::INT FROM public.documents),
    'totalBlogPosts', (SELECT COUNT(*)::INT FROM public.blog_posts),
    'publishedBlogPosts', (SELECT COUNT(*)::INT FROM public.blog_posts WHERE is_published = TRUE),
    'recentActivity', COALESCE((
      SELECT jsonb_agg(a)
      FROM (
        SELECT 'profile' AS type,
               concat(prenom, ' ', nom) AS description,
               created_at::text AS date
        FROM public.profiles
        ORDER BY created_at DESC
        LIMIT 10
      ) a
    ), '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_stats() IS
  'Dashboard admin : compteurs dynamiques. propertiesByType + propertiesByRentalStatus (filtre soft-delete). deletedProperties expose separement.';

GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
