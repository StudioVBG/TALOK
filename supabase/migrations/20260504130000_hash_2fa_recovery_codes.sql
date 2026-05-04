-- Migration: Hash des recovery codes 2FA avec bcrypt (pgcrypto)
-- Date: 2026-05-04
-- Description:
--   Avant : user_2fa.recovery_codes = [{ code: "ABCD-1234-XYZ9", used: false, ... }]
--           => codes lisibles en clair si la DB est compromise.
--   Après : user_2fa.recovery_codes = [{ code_hash: "$2a$12$...", used: false, ... }]
--           => bcrypt(code, salt 12) via pgcrypto. Vérification uniquement via
--              la fonction verify_2fa_recovery_code() exposée au service_role.
--   Backup : table _backup_user_2fa_recovery_codes_20260504 conservée pour rollback.

-- =============================================================================
-- 0) Extension nécessaire
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1) Backup avant transformation (rollback possible pendant 30 jours)
-- =============================================================================
CREATE TABLE IF NOT EXISTS _backup_user_2fa_recovery_codes_20260504 AS
SELECT id, user_id, recovery_codes, NOW() AS backed_up_at
FROM user_2fa
WHERE recovery_codes IS NOT NULL
  AND jsonb_array_length(recovery_codes) > 0;

COMMENT ON TABLE _backup_user_2fa_recovery_codes_20260504 IS
  'Backup pre-hash des recovery codes. À DROP après 30j si rien ne casse.';

-- =============================================================================
-- 2) Hash en place : parcourir chaque ligne, hasher chaque code en clair.
--    Idempotent : skip silencieusement les codes déjà hashés (clé code_hash).
-- =============================================================================
DO $$
DECLARE
  rec RECORD;
  new_codes JSONB;
  code_obj JSONB;
  hashed TEXT;
BEGIN
  FOR rec IN
    SELECT id, recovery_codes
    FROM user_2fa
    WHERE recovery_codes IS NOT NULL
      AND jsonb_array_length(recovery_codes) > 0
  LOOP
    new_codes := '[]'::jsonb;
    FOR code_obj IN SELECT * FROM jsonb_array_elements(rec.recovery_codes)
    LOOP
      IF code_obj ? 'code_hash' THEN
        new_codes := new_codes || code_obj;
      ELSIF code_obj ? 'code' AND (code_obj->>'code') IS NOT NULL THEN
        hashed := crypt(code_obj->>'code', gen_salt('bf', 12));
        new_codes := new_codes || jsonb_build_object(
          'code_hash', hashed,
          'used',      COALESCE((code_obj->>'used')::boolean, false),
          'used_at',   code_obj->'used_at'
        );
      ELSE
        new_codes := new_codes || code_obj;
      END IF;
    END LOOP;
    UPDATE user_2fa
       SET recovery_codes = new_codes,
           updated_at     = NOW()
     WHERE id = rec.id;
  END LOOP;
END $$;

COMMENT ON COLUMN user_2fa.recovery_codes IS
  'Array JSON de { code_hash, used, used_at }. bcrypt(code, salt 12) via pgcrypto. NE JAMAIS stocker en clair.';

-- =============================================================================
-- 3) Helper : hasher un batch de codes en clair pour insertion (setup 2FA)
-- =============================================================================
CREATE OR REPLACE FUNCTION hash_2fa_recovery_codes(p_codes TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
  v_code   TEXT;
BEGIN
  IF p_codes IS NULL OR array_length(p_codes, 1) IS NULL THEN
    RETURN v_result;
  END IF;
  FOREACH v_code IN ARRAY p_codes
  LOOP
    v_result := v_result || jsonb_build_object(
      'code_hash', crypt(v_code, gen_salt('bf', 12)),
      'used',      false,
      'used_at',   null
    );
  END LOOP;
  RETURN v_result;
END $$;

REVOKE ALL    ON FUNCTION hash_2fa_recovery_codes(TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION hash_2fa_recovery_codes(TEXT[]) TO service_role;

COMMENT ON FUNCTION hash_2fa_recovery_codes(TEXT[]) IS
  'Hashe un batch de recovery codes via bcrypt (cost 12). Service_role only.';

-- =============================================================================
-- 4) Vérification d'un recovery code — service_role only
--    Marque le code comme used si match ; renvoie TRUE/FALSE.
-- =============================================================================
CREATE OR REPLACE FUNCTION verify_2fa_recovery_code(
  p_user_id UUID,
  p_code    TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codes     JSONB;
  v_code_obj  JSONB;
  v_new_codes JSONB := '[]'::jsonb;
  v_matched   BOOLEAN := FALSE;
BEGIN
  SELECT recovery_codes INTO v_codes
  FROM user_2fa
  WHERE user_id = p_user_id
    AND enabled = true;

  IF v_codes IS NULL OR jsonb_array_length(v_codes) = 0 THEN
    RETURN FALSE;
  END IF;

  FOR v_code_obj IN SELECT * FROM jsonb_array_elements(v_codes)
  LOOP
    IF NOT v_matched
       AND COALESCE((v_code_obj->>'used')::boolean, false) = FALSE
       AND v_code_obj ? 'code_hash'
       AND crypt(p_code, v_code_obj->>'code_hash') = v_code_obj->>'code_hash'
    THEN
      v_matched := TRUE;
      v_new_codes := v_new_codes || jsonb_build_object(
        'code_hash', v_code_obj->>'code_hash',
        'used',      true,
        'used_at',   to_jsonb(NOW())
      );
    ELSE
      v_new_codes := v_new_codes || v_code_obj;
    END IF;
  END LOOP;

  IF v_matched THEN
    UPDATE user_2fa
       SET recovery_codes = v_new_codes,
           updated_at     = NOW()
     WHERE user_id = p_user_id;
  END IF;

  RETURN v_matched;
END $$;

REVOKE ALL    ON FUNCTION verify_2fa_recovery_code(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION verify_2fa_recovery_code(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION verify_2fa_recovery_code(UUID, TEXT) IS
  'Vérifie un recovery code en temps constant via crypt(). Marque used=true en cas de succès. Service_role only.';

-- =============================================================================
-- 5) Vue de monitoring : admins sans 2FA active
-- =============================================================================
CREATE OR REPLACE VIEW v_admins_without_2fa AS
SELECT
  p.user_id,
  p.email,
  p.role,
  p.created_at
FROM profiles p
LEFT JOIN user_2fa u2 ON u2.user_id = p.user_id AND u2.enabled = true
WHERE p.role = 'admin'
  AND u2.id IS NULL;

COMMENT ON VIEW v_admins_without_2fa IS
  'Liste des comptes admin sans 2FA active. Cible: 0 lignes. Forcer activation via /admin/security.';

REVOKE ALL ON v_admins_without_2fa FROM PUBLIC, anon, authenticated;
GRANT SELECT ON v_admins_without_2fa TO service_role;
