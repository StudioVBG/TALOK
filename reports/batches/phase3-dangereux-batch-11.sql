-- ====================================================================
-- Sprint B2 — Phase 3 DANGEREUX — Batch 11/11
-- 1 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260417100000_drop_phone_otp_codes_refs.sql
-- Risk: DANGEREUX
-- Why: DROP TABLE : phone_otp_codes
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260417100000_drop_phone_otp_codes_refs.sql'; END $pre$;

-- Migration: Drop phone_otp_codes + enrich sms_messages (2026-04-17)
--
-- Sprint 0 (SMS unification + Twilio Verify):
--   - phone_otp_codes: table orpheline (aucune migration ne la créait).
--     Référencée uniquement par lib/identity/identity-verification.service.ts
--     (supprimée dans le même sprint). On drop pour nettoyer les
--     environnements où elle aurait été créée à la main.
--   - sms_messages: ajout de `territory` (analytics DROM) et
--     `verify_sid` (lien vers les verifications Twilio Verify).

-- ============================================================
-- 1. Drop phone_otp_codes (dead table)
-- ============================================================

DROP TABLE IF EXISTS public.phone_otp_codes CASCADE;

-- ============================================================
-- 2. sms_messages: add territory + verify_sid columns
-- ============================================================

ALTER TABLE public.sms_messages
  ADD COLUMN IF NOT EXISTS territory text,
  ADD COLUMN IF NOT EXISTS verify_sid text;

COMMENT ON COLUMN public.sms_messages.territory
  IS 'Code ISO du territoire (FR, MQ, GP, GF, RE, YT, PM, ...) déduit du numéro';
COMMENT ON COLUMN public.sms_messages.verify_sid
  IS 'SID de vérification Twilio Verify (VE...) pour les envois OTP';

CREATE INDEX IF NOT EXISTS sms_messages_territory_idx
  ON public.sms_messages (territory)
  WHERE territory IS NOT NULL;

CREATE INDEX IF NOT EXISTS sms_messages_verify_sid_idx
  ON public.sms_messages (verify_sid)
  WHERE verify_sid IS NOT NULL;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260417100000', 'drop_phone_otp_codes_refs')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260417100000_drop_phone_otp_codes_refs.sql'; END $post$;

COMMIT;

-- END OF BATCH 11/11 (Phase 3 DANGEREUX)
