-- ============================================================================
-- Sprint 1 — Extension schéma Messages pour 4 rôles
-- owner + tenant + provider + admin (admin via RLS only, pas participant)
-- ============================================================================
-- Décisions validées Thomas :
--   - Scope v1 = owner + tenant + provider + admin
--   - Admin = pure RLS read-only (pas de colonne admin_profile_id)
--   - Option A : colonnes additionnelles (pas de junction conversation_participants)
--   - 3 conversation_type : owner_tenant | owner_provider | tenant_provider
--   - 1 user = 1 rôle (pas de multi-rôle en v1)
--
-- État prod confirmé 2026-04-19 :
--   - conversations : 14 colonnes, aucune pré-existence Sprint 1
--   - 9 indexes dont 2 UNIQUE partiels dupliqués à nettoyer
--     (idx_conversations_unique_pair + idx_conversations_unique_active_pair)
--
-- Structure : 4 blocs BEGIN/COMMIT indépendants
--   1. Schéma (colonnes, CHECK, UNIQUE, sender_role extension)
--   2. Trigger unread étendu 6 branches
--   3. RPC mark_messages_as_read étendue
--   4. RLS policies étendues
-- ============================================================================


-- ============================================================================
-- BLOC 1 — Schéma conversations + messages
-- ============================================================================

BEGIN;

-- Étape 1 : conversation_type avec DEFAULT 'owner_tenant' pour backward compat
-- Les services existants (chat.service.ts:269, :319) n'envoient pas ce champ
-- → DEFAULT s'applique, les INSERT actuels continuent de marcher.
ALTER TABLE public.conversations
  ADD COLUMN conversation_type TEXT NOT NULL DEFAULT 'owner_tenant'
    CHECK (conversation_type IN ('owner_tenant', 'owner_provider', 'tenant_provider'));

COMMENT ON COLUMN public.conversations.conversation_type IS
  'Discriminator 3 valeurs : owner_tenant | owner_provider | tenant_provider. DEFAULT owner_tenant pour backward compat.';

-- Étape 2 : provider_profile_id + provider_unread_count
ALTER TABLE public.conversations
  ADD COLUMN provider_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.conversations
  ADD COLUMN provider_unread_count INTEGER NOT NULL DEFAULT 0
    CHECK (provider_unread_count >= 0);

-- Étape 3 : relâcher NOT NULL sur owner/tenant pour accueillir les conversations
-- owner_provider (pas de tenant) et tenant_provider (pas de owner).
-- L'intégrité reste assurée par le CHECK de l'Étape 4.
ALTER TABLE public.conversations
  ALTER COLUMN owner_profile_id DROP NOT NULL;

ALTER TABLE public.conversations
  ALTER COLUMN tenant_profile_id DROP NOT NULL;

-- Étape 4 : CHECK conversation_type <-> FKs cohérents
-- Toutes les rows historiques ont conversation_type='owner_tenant' (DEFAULT Étape 1)
-- avec owner+tenant NOT NULL et provider NULL → CHECK passe sur l'existant.
ALTER TABLE public.conversations
  ADD CONSTRAINT check_conversation_type_participants CHECK (
    (conversation_type = 'owner_tenant'
      AND owner_profile_id IS NOT NULL
      AND tenant_profile_id IS NOT NULL
      AND provider_profile_id IS NULL)
    OR (conversation_type = 'owner_provider'
      AND owner_profile_id IS NOT NULL
      AND provider_profile_id IS NOT NULL
      AND tenant_profile_id IS NULL)
    OR (conversation_type = 'tenant_provider'
      AND tenant_profile_id IS NOT NULL
      AND provider_profile_id IS NOT NULL
      AND owner_profile_id IS NULL)
  );

-- Étape 5 : cleanup UNIQUE partiels dupliqués (drift prod 2026-04-19)
DROP INDEX IF EXISTS public.idx_conversations_unique_pair;
DROP INDEX IF EXISTS public.idx_conversations_unique_active_pair;

-- Étape 6 : 3 nouveaux UNIQUE partiels par type
-- owner_tenant : une seule conv active par (property, owner, tenant)
CREATE UNIQUE INDEX idx_conversations_unique_owner_tenant
  ON public.conversations (property_id, owner_profile_id, tenant_profile_id)
  WHERE status = 'active' AND conversation_type = 'owner_tenant';

-- owner_provider : une conv active par (ticket, owner, provider).
-- Scopé sur ticket_id car un ticket unique sur un bien entre mêmes parties.
CREATE UNIQUE INDEX idx_conversations_unique_owner_provider
  ON public.conversations (ticket_id, owner_profile_id, provider_profile_id)
  WHERE status = 'active' AND conversation_type = 'owner_provider' AND ticket_id IS NOT NULL;

-- tenant_provider : idem owner_provider
CREATE UNIQUE INDEX idx_conversations_unique_tenant_provider
  ON public.conversations (ticket_id, tenant_profile_id, provider_profile_id)
  WHERE status = 'active' AND conversation_type = 'tenant_provider' AND ticket_id IS NOT NULL;

-- Étape 7 : index provider_profile_id pour perf RLS (EXISTS sur messages)
CREATE INDEX idx_conversations_provider_profile_id
  ON public.conversations (provider_profile_id)
  WHERE provider_profile_id IS NOT NULL;

-- Étape 8 : étendre messages.sender_role pour accueillir 'provider'
-- Nom exact de la contrainte confirmé par Phase 0 : pattern standard Postgres
-- (table_column_check). Si absent en prod, le DROP no-op et l'ADD crée.
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_role_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_role_check
    CHECK (sender_role IN ('owner', 'tenant', 'provider'));

COMMIT;


-- ============================================================================
-- BLOC 2 — Trigger unread_count étendu (6 branches : 3 types × 2 directions)
-- ============================================================================

BEGIN;

-- Remplace la fonction existante update_conversation_on_new_message()
-- (20260416100000:10) en étendant la logique aux 3 conversation_type.
-- Conserve LEFT(content, 100) comme dans l'original (pas 200).
CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT conversation_type INTO v_type
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF v_type = 'owner_tenant' THEN
    UPDATE public.conversations
    SET
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      updated_at = NOW(),
      owner_unread_count = CASE
        WHEN NEW.sender_role = 'tenant' THEN COALESCE(owner_unread_count, 0) + 1
        ELSE owner_unread_count
      END,
      tenant_unread_count = CASE
        WHEN NEW.sender_role = 'owner' THEN COALESCE(tenant_unread_count, 0) + 1
        ELSE tenant_unread_count
      END
    WHERE id = NEW.conversation_id;

  ELSIF v_type = 'owner_provider' THEN
    UPDATE public.conversations
    SET
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      updated_at = NOW(),
      owner_unread_count = CASE
        WHEN NEW.sender_role = 'provider' THEN COALESCE(owner_unread_count, 0) + 1
        ELSE owner_unread_count
      END,
      provider_unread_count = CASE
        WHEN NEW.sender_role = 'owner' THEN COALESCE(provider_unread_count, 0) + 1
        ELSE provider_unread_count
      END
    WHERE id = NEW.conversation_id;

  ELSIF v_type = 'tenant_provider' THEN
    UPDATE public.conversations
    SET
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      updated_at = NOW(),
      tenant_unread_count = CASE
        WHEN NEW.sender_role = 'provider' THEN COALESCE(tenant_unread_count, 0) + 1
        ELSE tenant_unread_count
      END,
      provider_unread_count = CASE
        WHEN NEW.sender_role = 'tenant' THEN COALESCE(provider_unread_count, 0) + 1
        ELSE provider_unread_count
      END
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger déjà attaché via 20260416100000:37, pas besoin de le recréer.

COMMIT;


-- ============================================================================
-- BLOC 3 — RPC mark_messages_as_read étendue (3 rôles)
-- ============================================================================

BEGIN;

-- Remplace la version de 20260223200000:161 en ajoutant la branche provider.
-- Conserve la signature (p_conversation_id, p_reader_profile_id).
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(
  p_conversation_id UUID,
  p_reader_profile_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
BEGIN
  SELECT owner_profile_id, tenant_profile_id, provider_profile_id
  INTO v_conv
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Marquer read_at sur les messages non lus reçus par le lecteur
  UPDATE public.messages
  SET read_at = COALESCE(read_at, NOW())
  WHERE conversation_id = p_conversation_id
    AND sender_profile_id != p_reader_profile_id
    AND read_at IS NULL;

  -- Remettre à zéro le compteur non lu du lecteur selon sa position
  IF v_conv.owner_profile_id = p_reader_profile_id THEN
    UPDATE public.conversations
    SET owner_unread_count = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
  ELSIF v_conv.tenant_profile_id = p_reader_profile_id THEN
    UPDATE public.conversations
    SET tenant_unread_count = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
  ELSIF v_conv.provider_profile_id = p_reader_profile_id THEN
    UPDATE public.conversations
    SET provider_unread_count = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
  END IF;
END;
$$;

-- GRANT déjà posé par la migration d'origine, pas besoin de repasser.

COMMIT;


-- ============================================================================
-- BLOC 4 — RLS policies étendues (conversations + messages)
-- ============================================================================
-- Noms des policies exacts de l'existant (Phase 0 Point 3). On DROP + CREATE
-- sur ces noms pour éviter policies orphelines en prod.
-- Helpers : public.user_profile_id() et public.user_role() (pas auth.uid()).
-- ============================================================================

BEGIN;

-- --- conversations ---

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR provider_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR provider_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (
    owner_profile_id = public.user_profile_id()
    OR tenant_profile_id = public.user_profile_id()
    OR provider_profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

-- --- messages ---

DROP POLICY IF EXISTS "Users can view messages of own conversations" ON public.messages;
CREATE POLICY "Users can view messages of own conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.owner_profile_id = public.user_profile_id()
          OR c.tenant_profile_id = public.user_profile_id()
          OR c.provider_profile_id = public.user_profile_id()
        )
    )
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.messages;
CREATE POLICY "Users can insert messages in own conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_profile_id = public.user_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.owner_profile_id = public.user_profile_id()
          OR c.tenant_profile_id = public.user_profile_id()
          OR c.provider_profile_id = public.user_profile_id()
        )
    )
  );

-- La policy UPDATE "Users can update own messages" (20260309000001) reste
-- inchangée : elle ne filtre que sur sender_profile_id = user_profile_id(),
-- donc elle fonctionne déjà pour un provider qui édite ses propres messages.
-- On la reposte quand même pour étendre le EXISTS aux 3 rôles (cohérence
-- avec les autres policies, même si la clause AND EXISTS n'est pas nécessaire
-- côté sécurité vu que sender_profile_id suffit).

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  USING (
    sender_profile_id = public.user_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.owner_profile_id = public.user_profile_id()
          OR c.tenant_profile_id = public.user_profile_id()
          OR c.provider_profile_id = public.user_profile_id()
        )
    )
  )
  WITH CHECK (
    sender_profile_id = public.user_profile_id()
  );

COMMIT;
