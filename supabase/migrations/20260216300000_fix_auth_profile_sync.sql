-- ============================================================================
-- Migration: Fix Auth/Profile Synchronization System
-- Date: 2026-02-16
-- Description:
--   1. Update handle_new_user() trigger to include email + guarantor role
--   2. Repair desynchronized accounts (auth.users without profiles)
--   3. Backfill missing email values in profiles
--   4. Ensure INSERT RLS policy exists for self-profile creation fallback
-- ============================================================================

-- ============================================================================
-- STEP 1: Update handle_new_user() trigger function
-- Fixes:
--   - Now populates the email column (was NULL before)
--   - Validates 'guarantor' role (was missing from validation)
--   - Uses ON CONFLICT DO UPDATE for full idempotency
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
  v_email TEXT;
BEGIN
  -- Read role from user metadata, fallback to 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data ->> 'role',
    'tenant'
  );

  -- Validate role against allowed values (including guarantor)
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider', 'guarantor') THEN
    v_role := 'tenant';
  END IF;

  -- Read personal data from metadata
  v_prenom := NEW.raw_user_meta_data ->> 'prenom';
  v_nom := NEW.raw_user_meta_data ->> 'nom';
  v_telephone := NEW.raw_user_meta_data ->> 'telephone';
  v_email := NEW.email;

  -- Insert profile with all available data
  INSERT INTO public.profiles (
    user_id,
    email,
    role,
    prenom,
    nom,
    telephone,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_email,
    v_role,
    v_prenom,
    v_nom,
    v_telephone,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    role = COALESCE(EXCLUDED.role, profiles.role),
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 2: Repair desynchronized accounts
-- Create missing profiles for auth.users that have no profile
-- ============================================================================
INSERT INTO public.profiles (user_id, email, role, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(
    CASE
      WHEN au.raw_user_meta_data ->> 'role' IN ('admin', 'owner', 'tenant', 'provider', 'guarantor')
      THEN au.raw_user_meta_data ->> 'role'
      ELSE NULL
    END,
    'tenant'
  ),
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.user_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- STEP 3: Backfill missing email values in existing profiles
-- Some profiles created by the old trigger have NULL email
-- ============================================================================
UPDATE public.profiles p
SET
  email = au.email,
  updated_at = NOW()
FROM auth.users au
WHERE p.user_id = au.id
  AND (p.email IS NULL OR p.email = '')
  AND au.email IS NOT NULL
  AND au.email != '';

-- ============================================================================
-- STEP 4: Ensure INSERT RLS policy for self-profile creation fallback
-- This allows the client-side fallback to create a profile if the trigger fails
-- ============================================================================
DO $$
BEGIN
  -- Check if policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY "profiles_insert_own"
      ON profiles FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
