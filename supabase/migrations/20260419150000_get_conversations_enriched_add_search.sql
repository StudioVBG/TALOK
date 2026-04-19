-- ============================================================================
-- Sprint 9 — Recherche serveur dans get_conversations_enriched
-- ============================================================================
-- Ajoute un paramètre optionnel `p_search TEXT` qui filtre les conversations
-- accessibles sur : prénom/nom des participants, titre du ticket lié, et
-- last_message_preview. Remplace le filtre client-side lossy de
-- components/chat/conversations-list.tsx.
--
-- NOTE : Postgres n'autorise pas CREATE OR REPLACE FUNCTION à changer
-- l'arité — on DROP+CREATE dans une transaction. Les callers passant 3
-- positional args continueront de marcher (p_search DEFAULT NULL).
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_conversations_enriched(int, int, text);

CREATE OR REPLACE FUNCTION public.get_conversations_enriched(
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0,
  p_type TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  conversation_type TEXT,
  property_id UUID,
  lease_id UUID,
  ticket_id UUID,
  owner_profile_id UUID,
  tenant_profile_id UUID,
  provider_profile_id UUID,
  status TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  owner_unread_count INT,
  tenant_unread_count INT,
  provider_unread_count INT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  other_party_subtitle TEXT,
  other_party_name TEXT,
  other_party_avatar_url TEXT,
  other_party_role TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_search_like TEXT;
BEGIN
  v_user_id := public.user_profile_id();
  v_user_role := public.user_role();
  v_search_like := CASE WHEN p_search IS NULL OR btrim(p_search) = '' THEN NULL
                        ELSE '%' || p_search || '%' END;

  RETURN QUERY
  WITH accessible AS (
    SELECT c.*
    FROM public.conversations c
    LEFT JOIN public.profiles po ON po.id = c.owner_profile_id
    LEFT JOIN public.profiles pt ON pt.id = c.tenant_profile_id
    LEFT JOIN public.profiles pp ON pp.id = c.provider_profile_id
    LEFT JOIN public.tickets   t  ON t.id  = c.ticket_id
    WHERE (
      c.owner_profile_id = v_user_id
      OR c.tenant_profile_id = v_user_id
      OR c.provider_profile_id = v_user_id
      OR v_user_role = 'admin'
    )
    AND (p_type IS NULL OR c.conversation_type = p_type)
    AND c.status = 'active'
    AND (
      v_search_like IS NULL
      OR c.last_message_preview ILIKE v_search_like
      OR po.prenom ILIKE v_search_like OR po.nom ILIKE v_search_like
      OR pt.prenom ILIKE v_search_like OR pt.nom ILIKE v_search_like
      OR pp.prenom ILIKE v_search_like OR pp.nom ILIKE v_search_like
      OR t.titre ILIKE v_search_like
    )
    ORDER BY c.last_message_at DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ),
  total AS (
    SELECT COUNT(*)::BIGINT AS cnt
    FROM public.conversations c
    LEFT JOIN public.profiles po ON po.id = c.owner_profile_id
    LEFT JOIN public.profiles pt ON pt.id = c.tenant_profile_id
    LEFT JOIN public.profiles pp ON pp.id = c.provider_profile_id
    LEFT JOIN public.tickets   t  ON t.id  = c.ticket_id
    WHERE (
      c.owner_profile_id = v_user_id
      OR c.tenant_profile_id = v_user_id
      OR c.provider_profile_id = v_user_id
      OR v_user_role = 'admin'
    )
    AND (p_type IS NULL OR c.conversation_type = p_type)
    AND c.status = 'active'
    AND (
      v_search_like IS NULL
      OR c.last_message_preview ILIKE v_search_like
      OR po.prenom ILIKE v_search_like OR po.nom ILIKE v_search_like
      OR pt.prenom ILIKE v_search_like OR pt.nom ILIKE v_search_like
      OR pp.prenom ILIKE v_search_like OR pp.nom ILIKE v_search_like
      OR t.titre ILIKE v_search_like
    )
  )
  SELECT
    ac.id,
    ac.conversation_type,
    ac.property_id,
    ac.lease_id,
    ac.ticket_id,
    ac.owner_profile_id,
    ac.tenant_profile_id,
    ac.provider_profile_id,
    ac.status,
    ac.last_message_at,
    ac.last_message_preview,
    ac.owner_unread_count,
    ac.tenant_unread_count,
    ac.provider_unread_count,
    ac.created_at,
    ac.updated_at,

    CASE
      WHEN ac.owner_profile_id = v_user_id THEN
        CASE ac.conversation_type
          WHEN 'owner_tenant' THEN
            COALESCE(
              (SELECT
                 'Bail ' ||
                 CASE l.statut
                   WHEN 'actif' THEN 'actif'
                   WHEN 'signed' THEN 'signé'
                   ELSE l.statut
                 END ||
                 ' · ' || COALESCE(p.adresse_complete, 'adresse inconnue')
               FROM public.leases l
               LEFT JOIN public.properties p ON p.id = l.property_id
               WHERE l.id = ac.lease_id
               LIMIT 1),
              'Locataire'
            )
          WHEN 'owner_provider' THEN
            COALESCE(
              (SELECT 'Ticket · ' || LEFT(t.titre, 40)
               FROM public.tickets t
               WHERE t.id = ac.ticket_id
               LIMIT 1),
              'Prestataire'
            )
          ELSE NULL
        END
      WHEN ac.tenant_profile_id = v_user_id THEN
        CASE ac.conversation_type
          WHEN 'owner_tenant' THEN
            COALESCE(
              (SELECT le.nom || ' · ' || COALESCE(p.adresse_complete, 'adresse inconnue')
               FROM public.legal_entities le
               JOIN public.properties p ON p.id = ac.property_id
               WHERE le.owner_profile_id = ac.owner_profile_id
               LIMIT 1),
              (SELECT 'Propriétaire · ' || COALESCE(p.adresse_complete, 'adresse inconnue')
               FROM public.properties p WHERE p.id = ac.property_id),
              'Propriétaire'
            )
          WHEN 'tenant_provider' THEN
            COALESCE(
              (SELECT 'Ticket · ' || LEFT(t.titre, 40)
               FROM public.tickets t
               WHERE t.id = ac.ticket_id
               LIMIT 1),
              'Prestataire'
            )
          ELSE NULL
        END
      WHEN ac.provider_profile_id = v_user_id THEN
        COALESCE(
          (SELECT 'Ticket · ' || LEFT(t.titre, 40)
           FROM public.tickets t
           WHERE t.id = ac.ticket_id
           LIMIT 1),
          'Client'
        )
      WHEN v_user_role = 'admin' THEN
        'Conversation ' || ac.conversation_type
      ELSE NULL
    END AS other_party_subtitle,

    CASE
      WHEN ac.owner_profile_id = v_user_id THEN
        CASE ac.conversation_type
          WHEN 'owner_tenant' THEN
            (SELECT TRIM(COALESCE(pr.prenom, '') || ' ' || COALESCE(pr.nom, ''))
             FROM public.profiles pr WHERE pr.id = ac.tenant_profile_id)
          WHEN 'owner_provider' THEN
            (SELECT TRIM(COALESCE(pr.prenom, '') || ' ' || COALESCE(pr.nom, ''))
             FROM public.profiles pr WHERE pr.id = ac.provider_profile_id)
          ELSE NULL
        END
      WHEN ac.tenant_profile_id = v_user_id THEN
        CASE ac.conversation_type
          WHEN 'owner_tenant' THEN
            (SELECT TRIM(COALESCE(pr.prenom, '') || ' ' || COALESCE(pr.nom, ''))
             FROM public.profiles pr WHERE pr.id = ac.owner_profile_id)
          WHEN 'tenant_provider' THEN
            (SELECT TRIM(COALESCE(pr.prenom, '') || ' ' || COALESCE(pr.nom, ''))
             FROM public.profiles pr WHERE pr.id = ac.provider_profile_id)
          ELSE NULL
        END
      WHEN ac.provider_profile_id = v_user_id THEN
        CASE ac.conversation_type
          WHEN 'owner_provider' THEN
            (SELECT TRIM(COALESCE(pr.prenom, '') || ' ' || COALESCE(pr.nom, ''))
             FROM public.profiles pr WHERE pr.id = ac.owner_profile_id)
          WHEN 'tenant_provider' THEN
            (SELECT TRIM(COALESCE(pr.prenom, '') || ' ' || COALESCE(pr.nom, ''))
             FROM public.profiles pr WHERE pr.id = ac.tenant_profile_id)
          ELSE NULL
        END
      ELSE 'Utilisateur'
    END AS other_party_name,

    CASE
      WHEN ac.owner_profile_id = v_user_id THEN
        CASE ac.conversation_type
          WHEN 'owner_tenant' THEN
            (SELECT pr.avatar_url FROM public.profiles pr WHERE pr.id = ac.tenant_profile_id)
          WHEN 'owner_provider' THEN
            (SELECT pr.avatar_url FROM public.profiles pr WHERE pr.id = ac.provider_profile_id)
          ELSE NULL
        END
      WHEN ac.tenant_profile_id = v_user_id THEN
        CASE ac.conversation_type
          WHEN 'owner_tenant' THEN
            (SELECT pr.avatar_url FROM public.profiles pr WHERE pr.id = ac.owner_profile_id)
          WHEN 'tenant_provider' THEN
            (SELECT pr.avatar_url FROM public.profiles pr WHERE pr.id = ac.provider_profile_id)
          ELSE NULL
        END
      WHEN ac.provider_profile_id = v_user_id THEN
        CASE ac.conversation_type
          WHEN 'owner_provider' THEN
            (SELECT pr.avatar_url FROM public.profiles pr WHERE pr.id = ac.owner_profile_id)
          WHEN 'tenant_provider' THEN
            (SELECT pr.avatar_url FROM public.profiles pr WHERE pr.id = ac.tenant_profile_id)
          ELSE NULL
        END
      ELSE NULL
    END AS other_party_avatar_url,

    CASE
      WHEN ac.owner_profile_id = v_user_id THEN
        CASE ac.conversation_type
          WHEN 'owner_tenant' THEN 'tenant'
          WHEN 'owner_provider' THEN 'provider'
          ELSE NULL
        END
      WHEN ac.tenant_profile_id = v_user_id THEN
        CASE ac.conversation_type
          WHEN 'owner_tenant' THEN 'owner'
          WHEN 'tenant_provider' THEN 'provider'
          ELSE NULL
        END
      WHEN ac.provider_profile_id = v_user_id THEN
        CASE ac.conversation_type
          WHEN 'owner_provider' THEN 'owner'
          WHEN 'tenant_provider' THEN 'tenant'
          ELSE NULL
        END
      ELSE NULL
    END AS other_party_role,

    (SELECT cnt FROM total) AS total_count
  FROM accessible ac;
END;
$$;

COMMENT ON FUNCTION public.get_conversations_enriched IS
  'Paginated enriched conversations for the caller. Sprint 3 + Sprint 9 search. Optional p_search matches against participant names, ticket title, and last_message_preview (ILIKE).';

GRANT EXECUTE ON FUNCTION public.get_conversations_enriched(INT, INT, TEXT, TEXT) TO authenticated;

COMMIT;
