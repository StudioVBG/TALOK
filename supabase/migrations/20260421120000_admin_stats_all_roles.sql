-- ============================================
-- Migration: Harmoniser admin_stats avec tous les roles
-- Date: 2026-04-21
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
    'totalProperties', (SELECT COUNT(*)::INT FROM public.properties),
    'propertiesByType', (
      SELECT jsonb_build_object(
        'appartement', COUNT(*) FILTER (WHERE type = 'appartement'),
        'maison',      COUNT(*) FILTER (WHERE type = 'maison'),
        'colocation',  COUNT(*) FILTER (WHERE type = 'colocation'),
        'saisonnier',  COUNT(*) FILTER (WHERE type = 'saisonnier')
      )
      FROM public.properties
    ),
    'totalLeases', (SELECT COUNT(*)::INT FROM public.leases),
    'activeLeases', (SELECT COUNT(*)::INT FROM public.leases WHERE statut = 'active'),
    'leasesByStatus', (
      SELECT jsonb_build_object(
        'draft',             COUNT(*) FILTER (WHERE statut = 'draft'),
        'pending_signature', COUNT(*) FILTER (WHERE statut = 'pending_signature'),
        'active',            COUNT(*) FILTER (WHERE statut = 'active'),
        'terminated',        COUNT(*) FILTER (WHERE statut = 'terminated')
      )
      FROM public.leases
    ),
    'totalInvoices', (SELECT COUNT(*)::INT FROM public.invoices),
    'unpaidInvoices', (SELECT COUNT(*)::INT FROM public.invoices WHERE statut IN ('sent', 'late')),
    'invoicesByStatus', (
      SELECT jsonb_build_object(
        'draft', COUNT(*) FILTER (WHERE statut = 'draft'),
        'sent',  COUNT(*) FILTER (WHERE statut = 'sent'),
        'paid',  COUNT(*) FILTER (WHERE statut = 'paid'),
        'late',  COUNT(*) FILTER (WHERE statut = 'late')
      )
      FROM public.invoices
    ),
    'totalTickets', (SELECT COUNT(*)::INT FROM public.tickets),
    'openTickets', (SELECT COUNT(*)::INT FROM public.tickets WHERE statut = 'open'),
    'ticketsByStatus', (
      SELECT jsonb_build_object(
        'open',        COUNT(*) FILTER (WHERE statut = 'open'),
        'in_progress', COUNT(*) FILTER (WHERE statut = 'in_progress'),
        'resolved',    COUNT(*) FILTER (WHERE statut = 'resolved'),
        'closed',      COUNT(*) FILTER (WHERE statut = 'closed')
      )
      FROM public.tickets
    ),
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
  'Dashboard admin : compteurs par role (admin, platform_admin, owner, tenant, provider, syndic, agency, guarantor, coproprietaire), proprietes, baux, factures, tickets, documents. Accepte admin et platform_admin.';

GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
