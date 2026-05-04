-- Migration: Fix 2FA recovery code helpers — qualify pgcrypto calls
-- Date: 2026-05-04
-- Description:
--   La migration 20260504130000 a créé hash_2fa_recovery_codes() et
--   verify_2fa_recovery_code() avec `SET search_path = public`. Or pgcrypto
--   est installé dans le schéma `extensions` chez Supabase, donc crypt() et
--   gen_salt() sont introuvables → POST /api/auth/2fa/setup renvoie 500
--   ("function gen_salt(unknown, integer) does not exist").
--
--   Fix : schema-qualifier les appels (extensions.crypt, extensions.gen_salt)
--   et étendre search_path à `public, extensions` en ceinture+bretelles.
--   Pas de changement de signature, le code applicatif reste identique.

-- =============================================================================
-- 1) hash_2fa_recovery_codes — utilisé par /api/auth/2fa/setup
-- =============================================================================
CREATE OR REPLACE FUNCTION hash_2fa_recovery_codes(p_codes TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
      'code_hash', extensions.crypt(v_code, extensions.gen_salt('bf', 12)),
      'used',      false,
      'used_at',   null
    );
  END LOOP;
  RETURN v_result;
END $$;

REVOKE ALL    ON FUNCTION hash_2fa_recovery_codes(TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION hash_2fa_recovery_codes(TEXT[]) TO service_role;

-- =============================================================================
-- 2) verify_2fa_recovery_code — utilisé à la connexion 2FA
-- =============================================================================
CREATE OR REPLACE FUNCTION verify_2fa_recovery_code(
  p_user_id UUID,
  p_code    TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
       AND extensions.crypt(p_code, v_code_obj->>'code_hash') = v_code_obj->>'code_hash'
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
