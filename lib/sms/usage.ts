/**
 * Suivi de l'usage SMS mensuel et du plafond par plan.
 *
 * Source de vérité : table `sms_usage` (compteur atomique via RPC
 * `increment_sms_usage` déclenché par `sendTrackedSMS`). On y ajoute
 * un fallback `COUNT(*) sur sms_messages` au cas où l'usage n'a pas
 * été tracké (appel direct à sendSMS sans passer par sms-billing).
 */

import { getServiceClient } from '@/lib/supabase/service-client';
import { PLAN_LIMITS } from '@/lib/subscriptions/plan-limits';
import type { PlanSlug } from '@/lib/subscriptions/plans';

export interface MonthlyUsage {
  count: number;
  month: string; // 'YYYY-MM'
  limit: number;
  hasMeteredAddon: boolean;
  plan: PlanSlug;
}

/** Format 'YYYY-MM' pour la date courante (UTC). */
export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Lit l'usage SMS mensuel pour un profil.
 * Fallback sur `sms_messages` si aucun enregistrement dans `sms_usage`.
 */
export async function getMonthlyUsage(profileId: string, month?: string): Promise<{ count: number; month: string }> {
  const targetMonth = month ?? currentMonthKey();
  const supabase = getServiceClient();

  const { data: usageRow } = await (supabase as any)
    .from('sms_usage')
    .select('count')
    .eq('profile_id', profileId)
    .eq('month', targetMonth)
    .maybeSingle();

  if (usageRow?.count != null) {
    return { count: Number(usageRow.count) || 0, month: targetMonth };
  }

  // Fallback : compter les messages du mois côté sms_messages.
  const [year, monthPart] = targetMonth.split('-');
  const start = `${year}-${monthPart}-01T00:00:00Z`;
  const { count } = await (supabase as any)
    .from('sms_messages')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .gte('created_at', start)
    .lte('created_at', endOfMonthIso(Number(year), Number(monthPart)));

  return { count: count ?? 0, month: targetMonth };
}

function endOfMonthIso(year: number, month: number): string {
  // month: 1-12. Last day = day 0 of next month.
  const last = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  return last.toISOString();
}

/**
 * Vérifie qu'un add-on SMS metered est actif pour ce profil.
 * Si oui → bypass du plafond (le metered prend le relais).
 */
export async function hasActiveSmsAddon(profileId: string): Promise<boolean> {
  const supabase = getServiceClient();
  const { data } = await (supabase as any)
    .from('subscription_addons')
    .select('id')
    .eq('profile_id', profileId)
    .eq('addon_type', 'sms')
    .eq('status', 'active')
    .maybeSingle();
  return Boolean(data?.id);
}

/**
 * Récupère le plan slug courant d'un propriétaire. Fallback 'gratuit'.
 */
export async function getCurrentPlanSlug(profileId: string): Promise<PlanSlug> {
  const supabase = getServiceClient();
  const { data } = await (supabase as any)
    .from('subscriptions')
    .select('plan_slug')
    .eq('owner_id', profileId)
    .maybeSingle();
  return ((data?.plan_slug as PlanSlug | undefined) ?? 'gratuit');
}

/**
 * Résume quota + usage pour un profil.
 * `remaining` peut être négatif si usage > limit (jamais bloquant ici,
 * juste informatif pour l'UI).
 */
export async function getSmsQuotaStatus(profileId: string): Promise<MonthlyUsage & {
  remaining: number;
  blocked: boolean;
}> {
  const [plan, usage, hasAddon] = await Promise.all([
    getCurrentPlanSlug(profileId),
    getMonthlyUsage(profileId),
    hasActiveSmsAddon(profileId),
  ]);

  const limit = PLAN_LIMITS[plan].maxSmsPerMonth;
  const unlimited = limit === -1;
  const remaining = unlimited ? Number.POSITIVE_INFINITY : limit - usage.count;

  const blocked = !hasAddon && !unlimited && usage.count >= limit;
  return {
    plan,
    hasMeteredAddon: hasAddon,
    limit,
    count: usage.count,
    month: usage.month,
    remaining,
    blocked,
  };
}

/**
 * Erreur typée pour permettre aux routes de mapper vers status 402.
 */
export class SmsQuotaExceededError extends Error {
  readonly code = 'sms_quota_exceeded' as const;
  readonly current: number;
  readonly limit: number;
  readonly plan: PlanSlug;
  constructor(params: { current: number; limit: number; plan: PlanSlug }) {
    super(
      `Plafond SMS atteint (${params.current}/${params.limit} ce mois-ci). ` +
        `Passez à un plan supérieur ou activez le pack SMS illimité.`
    );
    this.name = 'SmsQuotaExceededError';
    this.current = params.current;
    this.limit = params.limit;
    this.plan = params.plan;
  }
}

/**
 * Throw SmsQuotaExceededError si le profil a dépassé son quota mensuel
 * ET n'a pas d'add-on metered actif.
 */
export async function assertSmsQuota(profileId: string): Promise<void> {
  const status = await getSmsQuotaStatus(profileId);
  if (status.blocked) {
    throw new SmsQuotaExceededError({
      current: status.count,
      limit: status.limit,
      plan: status.plan,
    });
  }
}
