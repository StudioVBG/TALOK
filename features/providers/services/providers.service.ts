/**
 * Providers Service — SOTA 2026
 * Server-side service for provider CRUD, address book, and search.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Provider, OwnerProvider } from '@/lib/types/providers';
import type {
  CreateProviderInput,
  UpdateProviderInput,
  AddToAddressBookInput,
  SearchProvidersInput,
} from '@/lib/validations/providers';

// ============================================
// Provider CRUD
// ============================================

/** List providers for an owner: personal address book + marketplace */
export async function listProviders(
  supabase: SupabaseClient,
  ownerId: string,
  opts?: { limit?: number; offset?: number }
) {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  // Get provider IDs in owner's address book
  const { data: ownerLinks } = await supabase
    .from('owner_providers')
    .select('provider_id, nickname, notes, is_favorite')
    .eq('owner_id', ownerId);

  const linkedIds = (ownerLinks ?? []).map((l) => l.provider_id);

  // Fetch providers: added_by_owner + marketplace
  const { data: providers, error, count } = await supabase
    .from('providers')
    .select('*', { count: 'exact' })
    .or(
      `added_by_owner_id.eq.${ownerId},is_marketplace.eq.true${
        linkedIds.length > 0 ? `,id.in.(${linkedIds.join(',')})` : ''
      }`
    )
    .eq('status', 'active')
    .order('avg_rating', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // Merge address book metadata
  const linkMap = new Map(
    (ownerLinks ?? []).map((l) => [l.provider_id, l])
  );

  const enriched = (providers ?? []).map((p) => ({
    ...p,
    _addressBook: linkMap.get(p.id) ?? null,
  }));

  return { providers: enriched, total: count ?? 0 };
}

/** Get a single provider by ID */
export async function getProvider(
  supabase: SupabaseClient,
  providerId: string
): Promise<Provider> {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('id', providerId)
    .single();

  if (error) throw error;
  return data as Provider;
}

/** Create a provider (owner adds to their personal directory) */
export async function createProvider(
  supabase: SupabaseClient,
  ownerId: string,
  input: CreateProviderInput
): Promise<Provider> {
  const { data, error } = await supabase
    .from('providers')
    .insert({
      ...input,
      added_by_owner_id: ownerId,
      is_marketplace: false,
      is_verified: false,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;

  // Auto-add to owner's address book
  await supabase.from('owner_providers').insert({
    owner_id: ownerId,
    provider_id: data.id,
    is_favorite: false,
  });

  return data as Provider;
}

/** Update a provider */
export async function updateProvider(
  supabase: SupabaseClient,
  providerId: string,
  input: UpdateProviderInput
): Promise<Provider> {
  const { data, error } = await supabase
    .from('providers')
    .update(input)
    .eq('id', providerId)
    .select()
    .single();

  if (error) throw error;
  return data as Provider;
}

// ============================================
// Address Book
// ============================================

/** Add a provider to owner's address book */
export async function addToAddressBook(
  supabase: SupabaseClient,
  ownerId: string,
  input: AddToAddressBookInput
): Promise<OwnerProvider> {
  const { data, error } = await supabase
    .from('owner_providers')
    .upsert(
      {
        owner_id: ownerId,
        provider_id: input.provider_id,
        nickname: input.nickname,
        notes: input.notes,
        is_favorite: input.is_favorite ?? false,
      },
      { onConflict: 'owner_id,provider_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as OwnerProvider;
}

/** Remove a provider from address book */
export async function removeFromAddressBook(
  supabase: SupabaseClient,
  ownerId: string,
  providerId: string
) {
  const { error } = await supabase
    .from('owner_providers')
    .delete()
    .eq('owner_id', ownerId)
    .eq('provider_id', providerId);

  if (error) throw error;
}

/** Toggle favorite status */
export async function toggleFavorite(
  supabase: SupabaseClient,
  ownerId: string,
  providerId: string
) {
  // Get current state
  const { data: existing } = await supabase
    .from('owner_providers')
    .select('id, is_favorite')
    .eq('owner_id', ownerId)
    .eq('provider_id', providerId)
    .single();

  if (existing) {
    await supabase
      .from('owner_providers')
      .update({ is_favorite: !existing.is_favorite })
      .eq('id', existing.id);
    return !existing.is_favorite;
  }

  // Auto-add to address book as favorite
  await supabase.from('owner_providers').insert({
    owner_id: ownerId,
    provider_id: providerId,
    is_favorite: true,
  });
  return true;
}

// ============================================
// Search (marketplace)
// ============================================

/** Search marketplace providers */
export async function searchProviders(
  supabase: SupabaseClient,
  input: SearchProvidersInput
) {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;

  let query = supabase
    .from('providers')
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .eq('is_marketplace', true);

  if (input.category) {
    query = query.contains('trade_categories', [input.category]);
  }

  if (input.department) {
    query = query.eq('department', input.department);
  }

  if (input.emergency_only) {
    query = query.eq('emergency_available', true);
  }

  if (input.verified_only) {
    query = query.eq('is_verified', true);
  }

  if (input.min_rating && input.min_rating > 0) {
    query = query.gte('avg_rating', input.min_rating);
  }

  if (input.q) {
    query = query.or(
      `company_name.ilike.%${input.q}%,contact_name.ilike.%${input.q}%,description.ilike.%${input.q}%`
    );
  }

  query = query
    .order('is_verified', { ascending: false })
    .order('avg_rating', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { providers: data ?? [], total: count ?? 0 };
}

// ============================================
// Reviews
// ============================================

/** Get reviews for a provider */
export async function getProviderReviews(
  supabase: SupabaseClient,
  providerProfileId: string,
  opts?: { limit?: number; offset?: number }
) {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  const { data, error, count } = await supabase
    .from('provider_reviews')
    .select(
      `
      *,
      reviewer:reviewer_profile_id(prenom, nom)
    `,
      { count: 'exact' }
    )
    .eq('provider_profile_id', providerProfileId)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { reviews: data ?? [], total: count ?? 0 };
}
