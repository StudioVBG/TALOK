import type { SupabaseClient } from '@supabase/supabase-js';

interface EntryOwnership {
  entity_id?: string | null;
  owner_id?: string | null;
}

export async function isEntryOwnedByProfile(
  supabase: SupabaseClient,
  entry: EntryOwnership,
  profileId: string,
): Promise<boolean> {
  if (entry.entity_id) {
    const { data } = await supabase
      .from('legal_entities')
      .select('id')
      .eq('id', entry.entity_id)
      .eq('owner_profile_id', profileId)
      .maybeSingle();
    return !!data;
  }
  return entry.owner_id === profileId;
}
