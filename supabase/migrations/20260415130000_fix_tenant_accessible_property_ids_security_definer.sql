-- Fix récursion infinie RLS : tenant_accessible_property_ids doit être SECURITY DEFINER
-- pour bypasser RLS sur leases lors de l'évaluation de la policy properties
CREATE OR REPLACE FUNCTION public.tenant_accessible_property_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT l.property_id
  FROM public.leases l
  JOIN public.lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = public.user_profile_id()
    AND l.statut NOT IN ('draft', 'cancelled');
$$;
