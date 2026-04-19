-- ============================================================================
-- Tests d'intégration — RPC get_conversations_enriched (Sprint 3)
-- ============================================================================
-- À exécuter via psql après `npx supabase db reset` :
--   psql postgresql://postgres:postgres@localhost:54322/postgres \
--     -f __tests__/db/conversations_enriched_rpc.sql
--
-- Le RPC utilise public.user_profile_id() et public.user_role() via
-- SECURITY DEFINER, qui lisent auth.uid(). Pour tester sans faux auth, on
-- injecte directement set_config('request.jwt.claims', ...) avec le user_id
-- que l'on veut simuler (pattern Supabase standard pour tests RLS).
-- ============================================================================

BEGIN;

SET session_replication_role = replica;

-- Profiles : 1 owner, 1 tenant, 1 provider
INSERT INTO public.profiles (id, user_id, role, prenom, nom) VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'owner',    'Owner',    'Un'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'tenant',   'Tenant',   'Deux'),
  ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'provider', 'Provider', 'Trois');

INSERT INTO public.owner_profiles (profile_id, type)
VALUES ('11111111-1111-1111-1111-111111111111', 'societe');

INSERT INTO public.legal_entities (
  id, owner_profile_id, entity_type, nom
) VALUES (
  '77777777-7777-7777-7777-777777777777',
  '11111111-1111-1111-1111-111111111111',
  'sci_ir',
  'SCI Atomgiste'
);

INSERT INTO public.properties (id, owner_id, adresse_complete, ville, code_postal, pays, type_bien)
VALUES ('44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111',
        '1 Rue de Test', 'Paris', '75001', 'France', 'appartement');

INSERT INTO public.leases (id, property_id, statut, date_debut, date_fin, loyer_hc, charges, depot_garantie)
VALUES ('66666666-6666-6666-6666-666666666666',
        '44444444-4444-4444-4444-444444444444',
        'actif',
        '2026-01-01', '2027-01-01',
        1000, 100, 1000);

INSERT INTO public.tickets (id, property_id, created_by_profile_id, titre, description)
VALUES ('55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111',
        'Fuite robinet cuisine',
        'La cuisine prend l''eau.');

-- Conversations : 1 owner_tenant + 1 owner_provider + 1 tenant_provider
INSERT INTO public.conversations (
  id, conversation_type, status, property_id, lease_id,
  owner_profile_id, tenant_profile_id
) VALUES (
  'aaaaaaaa-0001-0000-0000-000000000000', 'owner_tenant', 'active',
  '44444444-4444-4444-4444-444444444444',
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

INSERT INTO public.conversations (
  id, conversation_type, status, property_id, ticket_id,
  owner_profile_id, provider_profile_id
) VALUES (
  'aaaaaaaa-0002-0000-0000-000000000000', 'owner_provider', 'active',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333'
);

INSERT INTO public.conversations (
  id, conversation_type, status, property_id, ticket_id,
  tenant_profile_id, provider_profile_id
) VALUES (
  'aaaaaaaa-0003-0000-0000-000000000000', 'tenant_provider', 'active',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

SET session_replication_role = origin;


-- ============================================================================
-- Helper : simuler l'identité du viewer via request.jwt.claims
-- On set le sub (auth.uid), les helpers public.user_profile_id() et
-- public.user_role() lisent auth.uid() + profiles pour déduire.
-- ============================================================================

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
-- Test 1 : Viewer owner, conv owner_tenant → sous-titre bail, role tenant
-- ============================================================================
SELECT pg_temp.set_viewer('11111111-1111-1111-1111-111111111111');

DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r
  FROM public.get_conversations_enriched(25, 0, 'owner_tenant')
  WHERE id = 'aaaaaaaa-0001-0000-0000-000000000000';

  IF r.other_party_role != 'tenant' THEN
    RAISE EXCEPTION 'TEST 1 FAILED : attendu role=tenant, obtenu %', r.other_party_role;
  END IF;
  IF r.other_party_subtitle NOT LIKE 'Bail actif · 1 Rue de Test%' THEN
    RAISE EXCEPTION 'TEST 1 FAILED : sous-titre inattendu "%"', r.other_party_subtitle;
  END IF;
  RAISE NOTICE 'TEST 1 OK : viewer=owner, conv=owner_tenant, sous-titre bail, role=tenant';
END $$;


-- ============================================================================
-- Test 2 : Viewer owner, conv owner_provider → sous-titre ticket, role provider
-- ============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r
  FROM public.get_conversations_enriched(25, 0, 'owner_provider')
  WHERE id = 'aaaaaaaa-0002-0000-0000-000000000000';

  IF r.other_party_role != 'provider' THEN
    RAISE EXCEPTION 'TEST 2 FAILED : attendu role=provider, obtenu %', r.other_party_role;
  END IF;
  IF r.other_party_subtitle NOT LIKE 'Ticket · Fuite robinet%' THEN
    RAISE EXCEPTION 'TEST 2 FAILED : sous-titre inattendu "%"', r.other_party_subtitle;
  END IF;
  RAISE NOTICE 'TEST 2 OK : viewer=owner, conv=owner_provider, sous-titre ticket, role=provider';
END $$;


-- ============================================================================
-- Test 3 : Viewer tenant, conv owner_tenant → sous-titre SCI, role owner
-- ============================================================================
SELECT pg_temp.set_viewer('22222222-2222-2222-2222-222222222222');

DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r
  FROM public.get_conversations_enriched(25, 0, 'owner_tenant')
  WHERE id = 'aaaaaaaa-0001-0000-0000-000000000000';

  IF r.other_party_role != 'owner' THEN
    RAISE EXCEPTION 'TEST 3 FAILED : attendu role=owner, obtenu %', r.other_party_role;
  END IF;
  IF r.other_party_subtitle NOT LIKE 'SCI Atomgiste · 1 Rue de Test%' THEN
    RAISE EXCEPTION 'TEST 3 FAILED : sous-titre inattendu "%"', r.other_party_subtitle;
  END IF;
  RAISE NOTICE 'TEST 3 OK : viewer=tenant, conv=owner_tenant, sous-titre SCI, role=owner';
END $$;


-- ============================================================================
-- Test 4 : Viewer provider, conv owner_provider → sous-titre ticket, role owner
-- ============================================================================
SELECT pg_temp.set_viewer('33333333-3333-3333-3333-333333333333');

DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r
  FROM public.get_conversations_enriched(25, 0, 'owner_provider')
  WHERE id = 'aaaaaaaa-0002-0000-0000-000000000000';

  IF r.other_party_role != 'owner' THEN
    RAISE EXCEPTION 'TEST 4 FAILED : attendu role=owner, obtenu %', r.other_party_role;
  END IF;
  IF r.other_party_subtitle NOT LIKE 'Ticket · Fuite robinet%' THEN
    RAISE EXCEPTION 'TEST 4 FAILED : sous-titre inattendu "%"', r.other_party_subtitle;
  END IF;
  RAISE NOTICE 'TEST 4 OK : viewer=provider, conv=owner_provider, role=owner';
END $$;


-- ============================================================================
-- Test 5 : Filter p_type='owner_provider' → 1 résultat, total_count = 1
-- (même pour un viewer qui a 2 conv au total)
-- ============================================================================
SELECT pg_temp.set_viewer('11111111-1111-1111-1111-111111111111');

DO $$
DECLARE
  v_count INT;
  r RECORD;
BEGIN
  SELECT COUNT(*), MIN(total_count) INTO v_count, r
  FROM public.get_conversations_enriched(25, 0, 'owner_provider');

  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 5 FAILED : attendu 1 row, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 5 OK : filter owner_provider retourne 1 conv pour owner';
END $$;


-- ============================================================================
-- Test 6 : Filter NULL (defaut) → toutes les conv accessibles (2 pour owner)
-- ============================================================================
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.get_conversations_enriched(25, 0, NULL);

  IF v_count != 2 THEN
    RAISE EXCEPTION 'TEST 6 FAILED : attendu 2 rows (owner_tenant + owner_provider), obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 6 OK : sans filter, retourne les 2 conv accessibles à owner';
END $$;


-- ============================================================================
-- Test 7 : total_count correct (>= rows retournées)
-- ============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r
  FROM public.get_conversations_enriched(1, 0, NULL)
  LIMIT 1;

  IF r.total_count != 2 THEN
    RAISE EXCEPTION 'TEST 7 FAILED : attendu total_count=2, obtenu %', r.total_count;
  END IF;
  RAISE NOTICE 'TEST 7 OK : total_count = 2 même avec limit=1';
END $$;


-- ============================================================================
-- Test 8 : Pagination offset
-- ============================================================================
DO $$
DECLARE
  v_page1 TEXT;
  v_page2 TEXT;
BEGIN
  SELECT id::text INTO v_page1
  FROM public.get_conversations_enriched(1, 0, NULL)
  LIMIT 1;

  SELECT id::text INTO v_page2
  FROM public.get_conversations_enriched(1, 1, NULL)
  LIMIT 1;

  IF v_page1 = v_page2 THEN
    RAISE EXCEPTION 'TEST 8 FAILED : offset 0 et 1 retournent la même conv "%"', v_page1;
  END IF;
  RAISE NOTICE 'TEST 8 OK : offset 0 et offset 1 retournent des conv distinctes';
END $$;


-- ============================================================================
-- Test 9 : p_search matches participant prenom (owner viewer, cherche "Tenant")
-- Le fixture a tenant prenom='Tenant' → doit matcher la conv owner_tenant.
-- ============================================================================
SELECT pg_temp.set_viewer('11111111-1111-1111-1111-111111111111');

DO $$
DECLARE
  v_count INT;
  v_id TEXT;
BEGIN
  SELECT COUNT(*)::INT, MIN(id::text) INTO v_count, v_id
  FROM public.get_conversations_enriched(25, 0, NULL, 'Tenant');

  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 9 FAILED : attendu 1 match pour "Tenant", obtenu %', v_count;
  END IF;
  IF v_id != 'aaaaaaaa-0001-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'TEST 9 FAILED : attendu conv owner_tenant, obtenu %', v_id;
  END IF;
  RAISE NOTICE 'TEST 9 OK : search "Tenant" matche la conv owner_tenant';
END $$;


-- ============================================================================
-- Test 10 : p_search matches ticket titre (owner viewer, cherche "Fuite")
-- Fixture ticket titre='Fuite robinet cuisine' → owner_provider conv matche.
-- ============================================================================
DO $$
DECLARE
  v_count INT;
  v_id TEXT;
BEGIN
  SELECT COUNT(*)::INT, MIN(id::text) INTO v_count, v_id
  FROM public.get_conversations_enriched(25, 0, NULL, 'Fuite');

  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 10 FAILED : attendu 1 match pour "Fuite", obtenu %', v_count;
  END IF;
  IF v_id != 'aaaaaaaa-0002-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'TEST 10 FAILED : attendu conv owner_provider, obtenu %', v_id;
  END IF;
  RAISE NOTICE 'TEST 10 OK : search "Fuite" matche la conv owner_provider via ticket titre';
END $$;


-- ============================================================================
-- Test 11 : p_search no match → 0 rows, total_count = 0
-- ============================================================================
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_count
  FROM public.get_conversations_enriched(25, 0, NULL, 'ZZZ_nothing_matches_ZZZ');

  IF v_count != 0 THEN
    RAISE EXCEPTION 'TEST 11 FAILED : attendu 0 match, obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 11 OK : search qui ne matche rien retourne 0 rows';
END $$;


-- ============================================================================
-- Test 12 : p_search vide/whitespace traité comme NULL (pas de filtre)
-- ============================================================================
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_count
  FROM public.get_conversations_enriched(25, 0, NULL, '   ');

  IF v_count != 2 THEN
    RAISE EXCEPTION 'TEST 12 FAILED : attendu 2 rows (pas de filtre), obtenu %', v_count;
  END IF;
  RAISE NOTICE 'TEST 12 OK : search vide équivaut à pas de filtre';
END $$;


-- ============================================================================
-- Cleanup
-- ============================================================================
SET session_replication_role = replica;

DELETE FROM public.conversations WHERE id IN (
  'aaaaaaaa-0001-0000-0000-000000000000',
  'aaaaaaaa-0002-0000-0000-000000000000',
  'aaaaaaaa-0003-0000-0000-000000000000'
);
DELETE FROM public.tickets WHERE id = '55555555-5555-5555-5555-555555555555';
DELETE FROM public.leases WHERE id = '66666666-6666-6666-6666-666666666666';
DELETE FROM public.properties WHERE id = '44444444-4444-4444-4444-444444444444';
DELETE FROM public.legal_entities WHERE id = '77777777-7777-7777-7777-777777777777';
DELETE FROM public.owner_profiles WHERE profile_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM public.profiles WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

SET session_replication_role = origin;

COMMIT;
