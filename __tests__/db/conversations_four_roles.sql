-- ============================================================================
-- Tests d'intégration SQL — Sprint 1 extension conversations 4 rôles
-- ============================================================================
-- À exécuter via psql après `npx supabase db reset` :
--   psql postgresql://postgres:postgres@localhost:54322/postgres \
--     -f __tests__/db/conversations_four_roles.sql
--
-- Chaque test RAISE NOTICE en succès ou RAISE EXCEPTION en échec. L'exécution
-- s'interrompt au premier échec, donc un run propre = tous les tests passent.
--
-- UUIDs hardcodés (règle projet : pas de :param ni $1 en SQL Editor).
-- Bypass FK via session_replication_role pour ne pas avoir à créer les
-- auth.users — ce qui permet d'exécuter sans service role.
-- ============================================================================

BEGIN;

SET session_replication_role = replica;

-- Setup : 3 profiles de test + 1 property + 1 ticket
INSERT INTO public.profiles (id, user_id, role, prenom, nom) VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'owner',    'Owner',    'Test'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'tenant',   'Tenant',   'Test'),
  ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'provider', 'Provider', 'Test');

INSERT INTO public.properties (id, owner_id, adresse_complete, ville, code_postal, pays, type_bien)
VALUES ('44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111',
        '1 Rue de Test', 'Paris', '75001', 'France', 'appartement');

INSERT INTO public.tickets (id, property_id, titre, statut)
VALUES ('55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444',
        'Ticket Test', 'open');

SET session_replication_role = origin;


-- ============================================================================
-- Test 1 : CHECK rejette provider sur owner_tenant
-- ============================================================================
DO $$
BEGIN
  BEGIN
    INSERT INTO public.conversations (
      id, conversation_type,
      property_id, owner_profile_id, tenant_profile_id, provider_profile_id
    ) VALUES (
      'aaaaaaaa-0001-0000-0000-000000000000', 'owner_tenant',
      '44444444-4444-4444-4444-444444444444',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333'
    );
    RAISE EXCEPTION 'TEST 1 FAILED : CHECK aurait dû rejeter provider sur owner_tenant';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 1 OK : CHECK rejette provider non-NULL sur owner_tenant';
  END;
END $$;


-- ============================================================================
-- Test 2 : CHECK rejette tenant sur owner_provider
-- ============================================================================
DO $$
BEGIN
  BEGIN
    INSERT INTO public.conversations (
      id, conversation_type,
      owner_profile_id, tenant_profile_id, provider_profile_id, ticket_id
    ) VALUES (
      'aaaaaaaa-0002-0000-0000-000000000000', 'owner_provider',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      '55555555-5555-5555-5555-555555555555'
    );
    RAISE EXCEPTION 'TEST 2 FAILED : CHECK aurait dû rejeter tenant sur owner_provider';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 2 OK : CHECK rejette tenant non-NULL sur owner_provider';
  END;
END $$;


-- ============================================================================
-- Test 3 : CHECK rejette owner sur tenant_provider
-- ============================================================================
DO $$
BEGIN
  BEGIN
    INSERT INTO public.conversations (
      id, conversation_type,
      owner_profile_id, tenant_profile_id, provider_profile_id, ticket_id
    ) VALUES (
      'aaaaaaaa-0003-0000-0000-000000000000', 'tenant_provider',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      '55555555-5555-5555-5555-555555555555'
    );
    RAISE EXCEPTION 'TEST 3 FAILED : CHECK aurait dû rejeter owner sur tenant_provider';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 3 OK : CHECK rejette owner non-NULL sur tenant_provider';
  END;
END $$;


-- ============================================================================
-- Test 4 : Insert owner_tenant valide (provider=NULL)
-- ============================================================================
INSERT INTO public.conversations (
  id, conversation_type,
  property_id, owner_profile_id, tenant_profile_id
) VALUES (
  'aaaaaaaa-0004-0000-0000-000000000000', 'owner_tenant',
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = 'aaaaaaaa-0004-0000-0000-000000000000') THEN
    RAISE EXCEPTION 'TEST 4 FAILED : conversation owner_tenant non insérée';
  END IF;
  RAISE NOTICE 'TEST 4 OK : owner_tenant insert accepte provider_profile_id=NULL';
END $$;


-- ============================================================================
-- Test 5 : Insert owner_provider valide (tenant=NULL)
-- ============================================================================
INSERT INTO public.conversations (
  id, conversation_type,
  owner_profile_id, provider_profile_id, ticket_id
) VALUES (
  'aaaaaaaa-0005-0000-0000-000000000000', 'owner_provider',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '55555555-5555-5555-5555-555555555555'
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = 'aaaaaaaa-0005-0000-0000-000000000000') THEN
    RAISE EXCEPTION 'TEST 5 FAILED : conversation owner_provider non insérée';
  END IF;
  RAISE NOTICE 'TEST 5 OK : owner_provider insert accepte tenant_profile_id=NULL';
END $$;


-- ============================================================================
-- Test 6 : UNIQUE partiel owner_tenant rejette doublon actif
-- ============================================================================
DO $$
BEGIN
  BEGIN
    INSERT INTO public.conversations (
      id, conversation_type, status,
      property_id, owner_profile_id, tenant_profile_id
    ) VALUES (
      'aaaaaaaa-0006-0000-0000-000000000000', 'owner_tenant', 'active',
      '44444444-4444-4444-4444-444444444444',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222'
    );
    RAISE EXCEPTION 'TEST 6 FAILED : UNIQUE aurait dû rejeter le doublon owner_tenant';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 6 OK : UNIQUE partiel rejette doublon active+owner_tenant+(property,owner,tenant)';
  END;
END $$;


-- ============================================================================
-- Test 7 : Trigger unread incrémente provider_unread_count sur owner→provider
-- ============================================================================
INSERT INTO public.messages (
  id, conversation_id, sender_profile_id, sender_role, content
) VALUES (
  'bbbbbbbb-0001-0000-0000-000000000000',
  'aaaaaaaa-0005-0000-0000-000000000000',  -- owner_provider conv du Test 5
  '11111111-1111-1111-1111-111111111111',  -- owner
  'owner',
  'Hello provider'
);
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT provider_unread_count INTO v_count
  FROM public.conversations
  WHERE id = 'aaaaaaaa-0005-0000-0000-000000000000';
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 7 FAILED : provider_unread_count attendu=1, obtenu=%', v_count;
  END IF;
  RAISE NOTICE 'TEST 7 OK : trigger incrémente provider_unread_count à 1 sur owner→provider';
END $$;


-- ============================================================================
-- Test 8 : mark_messages_as_read reset le bon unread pour provider
-- ============================================================================
SELECT public.mark_messages_as_read(
  'aaaaaaaa-0005-0000-0000-000000000000',
  '33333333-3333-3333-3333-333333333333'  -- provider
);
DO $$
DECLARE
  v_count INTEGER;
  v_read_at TIMESTAMPTZ;
BEGIN
  SELECT provider_unread_count INTO v_count
  FROM public.conversations
  WHERE id = 'aaaaaaaa-0005-0000-0000-000000000000';
  IF v_count != 0 THEN
    RAISE EXCEPTION 'TEST 8 FAILED : provider_unread_count attendu=0 après mark, obtenu=%', v_count;
  END IF;

  SELECT read_at INTO v_read_at
  FROM public.messages
  WHERE id = 'bbbbbbbb-0001-0000-0000-000000000000';
  IF v_read_at IS NULL THEN
    RAISE EXCEPTION 'TEST 8 FAILED : read_at aurait dû être set sur le message';
  END IF;

  RAISE NOTICE 'TEST 8 OK : mark_messages_as_read reset provider_unread_count et set read_at';
END $$;


-- ============================================================================
-- Cleanup
-- ============================================================================
SET session_replication_role = replica;

DELETE FROM public.messages WHERE id = 'bbbbbbbb-0001-0000-0000-000000000000';
DELETE FROM public.conversations WHERE id IN (
  'aaaaaaaa-0004-0000-0000-000000000000',
  'aaaaaaaa-0005-0000-0000-000000000000'
);
DELETE FROM public.tickets WHERE id = '55555555-5555-5555-5555-555555555555';
DELETE FROM public.properties WHERE id = '44444444-4444-4444-4444-444444444444';
DELETE FROM public.profiles WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

SET session_replication_role = origin;

COMMIT;
