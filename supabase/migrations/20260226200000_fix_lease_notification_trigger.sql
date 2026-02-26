-- =====================================================
-- MIGRATION: Fix 500 sur signature EDL — trigger notifications cassé
-- Date: 2026-02-26
--
-- CAUSE RACINE:
--   Le trigger trg_notify_tenant_lease_changes (créé par 20260108400000)
--   fait un INSERT direct dans notifications avec "recipient_id" au lieu
--   de "user_id". La colonne user_id étant NOT NULL, l'INSERT échoue.
--   Ce trigger n'a pas de EXCEPTION handler, donc l'erreur remonte à
--   travers toute la chaîne :
--     UPDATE edl_signatures → check_edl_finalization → UPDATE edl →
--     auto_activate_lease_on_edl → UPDATE leases → trg_notify_tenant_lease_changes → BOOM
--
-- FIX:
--   Supprimer ce trigger. Le trigger trigger_notify_tenant_lease_updated
--   (créé par 20260108200000) couvre déjà la même fonctionnalité
--   correctement via create_notification() avec EXCEPTION handler.
-- =====================================================

BEGIN;

-- 1. Supprimer le trigger cassé
DROP TRIGGER IF EXISTS trg_notify_tenant_lease_changes ON leases;

-- 2. Supprimer la fonction associée (plus utilisée)
DROP FUNCTION IF EXISTS notify_tenant_lease_changes();

COMMIT;
