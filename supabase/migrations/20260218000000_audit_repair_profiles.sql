-- ============================================================================
-- BLOC 1 : TABLE D'AUDIT + RÉPARATION PROFILS
-- Exécuter dans Supabase SQL Editor
-- ============================================================================

-- Table de log des réparations
CREATE TABLE IF NOT EXISTS public._repair_log (
  id          SERIAL PRIMARY KEY,
  repair_date TIMESTAMPTZ DEFAULT NOW(),
  table_name  TEXT NOT NULL,
  record_id   TEXT,
  action      TEXT NOT NULL,
  details     JSONB
);

-- Créer les profils manquants (users sans profil)
WITH inserted AS (
  INSERT INTO public.profiles (user_id, role, email, prenom, nom, telephone)
  SELECT
    au.id,
    COALESCE(au.raw_user_meta_data->>'role', 'tenant'),
    au.email,
    au.raw_user_meta_data->>'prenom',
    au.raw_user_meta_data->>'nom',
    au.raw_user_meta_data->>'telephone'
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE p.id IS NULL
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id, email, role
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', user_id::TEXT, 'INSERT',
       jsonb_build_object('email', email, 'role', role, 'reason', 'user_sans_profil')
FROM inserted;

-- Sync emails NULL (profils sans email alors que auth.users en a un)
WITH updated AS (
  UPDATE public.profiles p
  SET email = au.email, updated_at = NOW()
  FROM auth.users au
  WHERE p.user_id = au.id
    AND (p.email IS NULL OR p.email = '')
    AND au.email IS NOT NULL AND au.email != ''
  RETURNING p.id, au.email AS new_email
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', id::TEXT, 'UPDATE',
       jsonb_build_object('new_email', new_email, 'reason', 'email_null_backfill')
FROM updated;

-- Sync emails désynchronisés (profil a un email différent de auth.users)
WITH updated AS (
  UPDATE public.profiles p
  SET email = au.email, updated_at = NOW()
  FROM auth.users au
  WHERE p.user_id = au.id
    AND p.email IS DISTINCT FROM au.email
    AND au.email IS NOT NULL AND au.email != ''
    AND p.email IS NOT NULL
  RETURNING p.id, p.email AS old_email, au.email AS new_email
)
INSERT INTO public._repair_log (table_name, record_id, action, details)
SELECT 'profiles', id::TEXT, 'UPDATE',
       jsonb_build_object('old_email', old_email, 'new_email', new_email, 'reason', 'email_desync')
FROM updated;

-- Résultat bloc 1
SELECT action, COUNT(*) AS nb, details->>'reason' AS reason
FROM public._repair_log
WHERE table_name = 'profiles'
GROUP BY action, details->>'reason';
