-- =====================================================
-- MIGRATION: Aligner les policies admin sur les tables d'invitation
-- Date: 2026-04-28
--
-- Les policies admin existantes sur les tables d'invitation ne testent
-- que `role='admin'`. Le rôle `platform_admin` (cf. lib/types,
-- profiles_role_check) doit aussi avoir un accès complet pour le
-- monitoring et le support.
-- =====================================================

BEGIN;

-- ============================================
-- guarantor_invitations
-- ============================================

DROP POLICY IF EXISTS "guarantor_invitations_admin_all" ON public.guarantor_invitations;
CREATE POLICY "guarantor_invitations_admin_all" ON public.guarantor_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'platform_admin')
    )
  );

-- ============================================
-- copro_invites (créée par 20260428210000)
-- ============================================

DROP POLICY IF EXISTS "copro_invites_admin_all" ON public.copro_invites;
CREATE POLICY "copro_invites_admin_all" ON public.copro_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'platform_admin')
    )
  );

-- ============================================
-- invitations (bail) — pas de policy admin existante
-- Ajouter pour cohérence avec les autres tables.
-- ============================================

DROP POLICY IF EXISTS "invitations_admin_all" ON public.invitations;
CREATE POLICY "invitations_admin_all" ON public.invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'platform_admin')
    )
  );

COMMIT;
