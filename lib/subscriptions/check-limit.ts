/**
 * checkLimit() — Vérification unifiée des limites avec add-ons
 *
 * Calcule la limite effective d'une ressource en tenant compte du plan
 * de base ET des add-ons actifs (packs signatures, stockage +20 Go).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_LIMITS } from './plan-limits';
import type { PlanSlug } from './plans';

export type LimitResource = 'signatures' | 'storage' | 'properties' | 'users';

export interface LimitResult {
  allowed: boolean;
  current: number;
  maxBase: number;
  maxWithAddons: number;
  addonsActive: number;
  upgradeNeeded: boolean;
}

export async function checkLimit(
  supabase: SupabaseClient,
  profileId: string,
  plan: PlanSlug,
  resource: LimitResource
): Promise<LimitResult> {
  const limits = PLAN_LIMITS[plan];

  const [current, { addonBonus, addonsActive }] = await Promise.all([
    getCurrentUsage(supabase, profileId, resource),
    getAddonBonus(supabase, profileId, resource),
  ]);

  const maxBase = getBaseLimit(limits, resource);
  // Unlimited plans (-1) stay unlimited regardless of addons
  const maxWithAddons = maxBase === -1 ? -1 : maxBase + addonBonus;
  const allowed = maxWithAddons === -1 || current < maxWithAddons;
  const upgradeNeeded = !allowed && addonBonus === 0;

  return { allowed, current, maxBase, maxWithAddons, addonsActive, upgradeNeeded };
}

function getBaseLimit(
  limits: (typeof PLAN_LIMITS)[PlanSlug],
  resource: LimitResource
): number {
  switch (resource) {
    case 'signatures':
      return limits.maxSignaturesPerMonth;
    case 'storage':
      return limits.maxStorageMB;
    case 'properties':
      return limits.maxProperties;
    case 'users':
      return limits.maxUsers;
  }
}

async function getAddonBonus(
  supabase: SupabaseClient,
  profileId: string,
  resource: LimitResource
): Promise<{ addonBonus: number; addonsActive: number }> {
  if (resource === 'signatures') {
    const { data: packs } = await supabase
      .from('subscription_addons')
      .select('quantity, consumed_count')
      .eq('profile_id', profileId)
      .eq('addon_type', 'signature_pack')
      .eq('status', 'active');

    const list = packs || [];
    const addonBonus = list.reduce(
      (sum: number, p: any) => sum + (p.quantity - p.consumed_count),
      0
    );
    return { addonBonus, addonsActive: list.length };
  }

  if (resource === 'storage') {
    const { count } = await supabase
      .from('subscription_addons')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('addon_type', 'storage_20gb')
      .eq('status', 'active');

    const active = count || 0;
    return { addonBonus: active * 20480, addonsActive: active }; // 20 Go = 20480 Mo
  }

  return { addonBonus: 0, addonsActive: 0 };
}

async function getCurrentUsage(
  supabase: SupabaseClient,
  profileId: string,
  resource: LimitResource
): Promise<number> {
  switch (resource) {
    case 'signatures': {
      // Use existing subscription_usage via the RPC
      const { data } = await supabase
        .rpc('get_signature_usage_by_owner', { p_owner_id: profileId })
        .single();
      return (data as any)?.signatures_used || 0;
    }
    case 'storage': {
      const { data } = await supabase
        .from('subscriptions')
        .select('documents_size_mb')
        .eq('owner_id', profileId)
        .single();
      return (data as any)?.documents_size_mb || 0;
    }
    case 'properties': {
      const { count } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', profileId)
        .neq('status', 'archived')
        .neq('type', 'immeuble');
      return count || 0;
    }
    case 'users': {
      // Count users linked to this owner's entities
      const { count } = await supabase
        .from('entity_members')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId);
      return count || 1;
    }
  }
}
