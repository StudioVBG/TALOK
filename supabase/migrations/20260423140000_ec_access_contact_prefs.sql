-- ec_access: add contact phone + EC relationship preferences
--
-- Rationale: Talok used to store only (name, email, access_level) for each
-- expert-comptable grant. The exports page now needs:
--   - a phone number so the owner has one source of truth for their EC,
--   - a flag to auto-send the accounting pack on exercise closing,
--   - an explicit "read-only access" toggle decoupled from access_level
--     (owners want to keep the grant active but demote it to read-only
--     without revoking + re-inviting).

ALTER TABLE public.ec_access
  ADD COLUMN IF NOT EXISTS ec_phone TEXT,
  ADD COLUMN IF NOT EXISTS auto_send_on_closing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_only_access BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.ec_access.ec_phone IS
  'Phone number of the expert-comptable — informational only, not used for auth.';

COMMENT ON COLUMN public.ec_access.auto_send_on_closing IS
  'When true, closing an exercise emails the accounting pack (FEC + balance + grand-livre + journal) to this EC automatically.';

COMMENT ON COLUMN public.ec_access.read_only_access IS
  'When true, the EC can view data but cannot annotate or validate entries regardless of access_level. Defaults to true so existing grants stay safe until the owner opts in to write access.';
