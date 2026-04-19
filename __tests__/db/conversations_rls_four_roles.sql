-- ============================================================================
-- Tests RLS conversations + messages — 4 rôles (Sprint 5)
-- ============================================================================
-- Vérifie que les policies Sprint 1 + extensions Sprint 5 admin bloquent
-- correctement chaque rôle :
--
--   - owner     : SELECT/INSERT/UPDATE seulement sur ses conv (owner_profile_id)
--   - tenant    : idem (tenant_profile_id)
--   - provider  : idem (provider_profile_id)
--   - admin     : SELECT toutes les conv (clause user_role()='admin'), pas
--                 d'INSERT/UPDATE de messages (sender_profile_id check)
--
-- À exécuter via psql après `npx supabase db reset` :
--   psql postgresql://postgres:postgres@localhost:54322/postgres \
--     -f __tests__/db/conversations_rls_four_roles.sql
-- ============================================================================

BEGIN;

SET session_replication_role = replica;

-- 4 profiles : owner, tenant, provider, admin + 1 outsider
INSERT INTO public.profiles (id, user_id, role, prenom, nom) VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'owner',    'Owner',    'Test'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'tenant',   'Tenant',   'Test'),
  ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'provider', 'Provider', 'Test'),
  ('44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'admin',    'Admin',    'Talok'),
  ('55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 'tenant',   'Outside',  'User');

INSERT INTO public.properties (id, owner_id, adresse_complete, ville, code_postal, pays, type_bien)
VALUES ('66666666-6666-6666-6666-666666666666',
        '11111111-1111-1111-1111-111111111111',
        '1 Rue de Test', 'Paris', '75001', 'France', 'appartement');

INSERT INTO public.tickets (id, property_id, created_by_profile_id, titre, description)
VALUES ('77777777-7777-7777-7777-777777777777',
        '66666666-6666-6666-6666-666666666666',
        '11111111-1111-1111-1111-111111111111',
        'Test ticket', 'desc');

-- 1 conv owner_tenant + 1 conv owner_provider
INSERT INTO public.conversations (
  id, conversation_type, status, property_id,
  owner_profile_id, tenant_profile_id
) VALUES (
  'aaaaaaaa-0001-0000-0000-000000000000', 'owner_tenant', 'active',
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

INSERT INTO public.conversations (
  id, conversation_type, status, property_id, ticket_id,
  owner_profile_id, provider_profile_id
) VALUES (
  'aaaaaaaa-0002-0000-0000-000000000000', 'owner_provider', 'active',
  '66666666-6666-6666-6666-666666666666',
  '77777777-7777-7777-7777-777777777777',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333'
);

-- 2 messages (1 par conv) pour tester SELECT messages
INSERT INTO public.messages (id, conversation_id, sender_profile_id, sender_role, content)
VALUES ('bbbbbbbb-0001-0000-0000-000000000000',
        'aaaaaaaa-0001-0000-0000-000000000000',
        '11111111-1111-1111-1111-111111111111',
        'owner', 'Hello tenant');

INSERT INTO public.messages (id, conversation_id, sender_profile_id, sender_role, content)
VALUES ('bbbbbbbb-0002-0000-0000-000000000000',
        'aaaaaaaa-0002-0000-0000-000000000000',
        '11111111-1111-1111-1111-111111111111',
        'owner', 'Hello provider');

SET session_replication_role = origin;


-- Helper : simule auth.uid() via request.jwt.claims
CREATE OR REPLACE FUNCTION pg_temp.set_viewer(p_user_id UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;


-- ============================================================================
-- Test 1 : owner voit ses 2 conv (owner_tenant + owner_provider)
-- ============================================================================
SELECT pg_temp.set_viewer('11111111-1111-1111-1111-111111111111');
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.conversations
  WHERE id IN (
    'aaaaaaaa-0001-0000-0000-000000000000',
    'aaaaaaaa-0002-0000-0000-000000000000'
  );
  IF v_count != 2 THEN
    RAISE EXCEPTION 'TEST 1 FAILED : owner attendu 2 conv, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 1 OK : owner voit ses 2 conv';
END $$;


-- ============================================================================
-- Test 2 : tenant voit seulement la conv owner_tenant
-- ============================================================================
SELECT pg_temp.set_viewer('22222222-2222-2222-2222-222222222222');
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.conversations
  WHERE id IN (
    'aaaaaaaa-0001-0000-0000-000000000000',
    'aaaaaaaa-0002-0000-0000-000000000000'
  );
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 2 FAILED : tenant attendu 1 conv, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 2 OK : tenant voit seulement owner_tenant (1 conv)';
END $$;


-- ============================================================================
-- Test 3 : provider voit seulement la conv owner_provider
-- ============================================================================
SELECT pg_temp.set_viewer('33333333-3333-3333-3333-333333333333');
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.conversations
  WHERE id IN (
    'aaaaaaaa-0001-0000-0000-000000000000',
    'aaaaaaaa-0002-0000-0000-000000000000'
  );
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 3 FAILED : provider attendu 1 conv, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 3 OK : provider voit seulement owner_provider (1 conv)';
END $$;


-- ============================================================================
-- Test 4 : admin voit les 2 conv (clause user_role()='admin')
-- ============================================================================
SELECT pg_temp.set_viewer('44444444-4444-4444-4444-444444444444');
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.conversations
  WHERE id IN (
    'aaaaaaaa-0001-0000-0000-000000000000',
    'aaaaaaaa-0002-0000-0000-000000000000'
  );
  IF v_count != 2 THEN
    RAISE EXCEPTION 'TEST 4 FAILED : admin attendu 2 conv, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 4 OK : admin voit toutes les conv (2)';
END $$;


-- ============================================================================
-- Test 5 : outsider tenant (pas participant) ne voit aucune conv
-- ============================================================================
SELECT pg_temp.set_viewer('55555555-5555-5555-5555-555555555555');
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.conversations
  WHERE id IN (
    'aaaaaaaa-0001-0000-0000-000000000000',
    'aaaaaaaa-0002-0000-0000-000000000000'
  );
  IF v_count != 0 THEN
    RAISE EXCEPTION 'TEST 5 FAILED : outsider attendu 0 conv, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 5 OK : outsider voit 0 conv';
END $$;


-- ============================================================================
-- Test 6 : provider peut SELECT ses messages mais PAS ceux des autres conv
-- ============================================================================
SELECT pg_temp.set_viewer('33333333-3333-3333-3333-333333333333');
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.messages
  WHERE id IN (
    'bbbbbbbb-0001-0000-0000-000000000000',
    'bbbbbbbb-0002-0000-0000-000000000000'
  );
  -- provider est dans owner_provider (conv 0002), pas dans owner_tenant (0001)
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 6 FAILED : provider attendu 1 message visible, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 6 OK : provider voit 1 message (le sien)';
END $$;


-- ============================================================================
-- Test 7 : admin peut SELECT TOUS les messages
-- ============================================================================
SELECT pg_temp.set_viewer('44444444-4444-4444-4444-444444444444');
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.messages
  WHERE id IN (
    'bbbbbbbb-0001-0000-0000-000000000000',
    'bbbbbbbb-0002-0000-0000-000000000000'
  );
  IF v_count != 2 THEN
    RAISE EXCEPTION 'TEST 7 FAILED : admin attendu 2 messages, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 7 OK : admin voit les 2 messages';
END $$;


-- ============================================================================
-- Test 8 : admin NE PEUT PAS INSERT un message (sender_profile_id check)
-- ============================================================================
DO $$
BEGIN
  BEGIN
    INSERT INTO public.messages (
      id, conversation_id, sender_profile_id, sender_role, content
    ) VALUES (
      'bbbbbbbb-9999-0000-0000-000000000000',
      'aaaaaaaa-0001-0000-0000-000000000000',
      '44444444-4444-4444-4444-444444444444',  -- admin id
      'owner', 'Admin tente d''envoyer'
    );
    RAISE EXCEPTION 'TEST 8 FAILED : admin n''aurait pas dû pouvoir INSERT';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'TEST 8 OK : admin bloqué sur INSERT message (RLS)';
  END;
END $$;


-- ============================================================================
-- Cleanup
-- ============================================================================
SET session_replication_role = replica;

DELETE FROM public.messages WHERE id IN (
  'bbbbbbbb-0001-0000-0000-000000000000',
  'bbbbbbbb-0002-0000-0000-000000000000'
);
DELETE FROM public.conversations WHERE id IN (
  'aaaaaaaa-0001-0000-0000-000000000000',
  'aaaaaaaa-0002-0000-0000-000000000000'
);
DELETE FROM public.tickets WHERE id = '77777777-7777-7777-7777-777777777777';
DELETE FROM public.properties WHERE id = '66666666-6666-6666-6666-666666666666';
DELETE FROM public.profiles WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
);

SET session_replication_role = origin;

COMMIT;
