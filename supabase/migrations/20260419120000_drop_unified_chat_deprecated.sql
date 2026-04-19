-- ============================================================================
-- Cleanup schéma unified_chat déprécié
-- ============================================================================
-- Contexte :
--   - Service lib/services/unified-chat.service.ts supprimé sur la branche
--     claude/audit-enriched-messages-HklvX (commit f0a035a, 2026-04-19).
--   - Routes app/api/unified-chat/** supprimées sur cette branche
--     (chore/cleanup-unified-chat-dead-code, commit 8af7a29, 2026-04-19).
--   - Tables confirmées vides en prod (SELECT COUNT = 0 le 2026-04-19) :
--       unified_conversations, unified_messages, conversation_participants
--   - Audit code mort : zéro caller dans app/, lib/, components/, __tests__/
--     pour les tables comme pour les RPCs.
--
-- Verdict Phase 0.1 sur les RPCs :
--   - mark_conversation_as_read(uuid, uuid)  → SAFE_DROP
--   - get_total_unread_count(uuid)           → SAFE_DROP
--   Aucune définition trouvée dans supabase/migrations/ (probablement créées
--   ad-hoc en prod). Aucun appel dans le code canonique : chat.service.ts
--   utilise mark_messages_as_read (RPC distincte, conservée).
--   Seuls 2 scripts diagnostiques (scripts/check-unified-tables.ts,
--   scripts/final-check.ts) référencent ces RPCs — non bloquant, ils
--   logueront simplement "function not found" après application.
--
-- Le schéma canonique conversations/messages reste intact et inchangé.
-- ============================================================================

BEGIN;

-- 1. Drop tables (feuilles d'abord, puis racine).
--    CASCADE accepté car tables orphelines confirmées : aucune FK du
--    schéma canonique n'a été identifiée vers ces tables.
DROP TABLE IF EXISTS public.unified_messages CASCADE;
DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.unified_conversations CASCADE;

-- 2. Drop RPCs orphelines (verdict SAFE_DROP).
--    Signatures inférées des appels morts :
--      - check-unified-tables.ts:58  → (p_conversation_id uuid, p_profile_id uuid)
--      - check-unified-tables.ts:59  → (p_profile_id uuid)
DROP FUNCTION IF EXISTS public.mark_conversation_as_read(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_total_unread_count(uuid);

COMMIT;
