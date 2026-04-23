/**
 * Resolve a real `auth.users.id` UUID to use as the actor (`created_by`)
 * when an automatic accounting entry is posted from a background context
 * (Stripe webhook, cron, backfill without an explicit user).
 *
 * `accounting_entries.created_by` is `UUID NOT NULL REFERENCES auth.users(id)`,
 * so passing a placeholder string like "system" causes
 * `invalid input syntax for type uuid` and the insert is rejected.
 *
 * The owner of the legal entity is the right semantic actor: the entry is
 * being booked into their books on their behalf.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveSystemActorForEntity(
  supabase: SupabaseClient,
  entityId: string,
): Promise<string | null> {
  const { data: entity } = await (supabase as any)
    .from("legal_entities")
    .select("owner_profile_id")
    .eq("id", entityId)
    .maybeSingle();

  const ownerProfileId = (entity as { owner_profile_id?: string } | null)?.owner_profile_id;
  if (!ownerProfileId) return null;

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("user_id")
    .eq("id", ownerProfileId)
    .maybeSingle();

  return (profile as { user_id?: string } | null)?.user_id ?? null;
}
