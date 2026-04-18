import { describe, test, expect, beforeEach, vi } from 'vitest';

type QueryResult = { data: any; error?: null; count?: number | null };

// Stateful mock of the service client — each `from(table)` returns a
// chainable builder that the test pre-seeds via `seed`.
const tables: Record<string, QueryResult> = {};
function seed(table: string, result: QueryResult) {
  tables[table] = result;
}

function mockBuilder(table: string) {
  const builder: any = {};
  const res = () => tables[table] ?? { data: null };
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.gte = () => builder;
  builder.lte = () => builder;
  builder.maybeSingle = async () => res();
  builder.single = async () => res();
  // select().eq().maybeSingle / gte / lte chain — support awaited query
  builder.then = (resolve: any) => resolve(res());
  return builder;
}

vi.mock('@/lib/supabase/service-client', () => ({
  getServiceClient: () => ({
    from: (table: string) => mockBuilder(table),
  }),
}));

describe('getMonthlyUsage', () => {
  beforeEach(() => {
    for (const k of Object.keys(tables)) delete tables[k];
  });

  test('reads count from sms_usage when available', async () => {
    seed('sms_usage', { data: { count: 7 }, error: null });
    const { getMonthlyUsage } = await import('@/lib/sms/usage');
    const res = await getMonthlyUsage('profile-1', '2026-04');
    expect(res.count).toBe(7);
    expect(res.month).toBe('2026-04');
  });

  test('falls back to sms_messages count when sms_usage is empty', async () => {
    seed('sms_usage', { data: null });
    seed('sms_messages', { data: null, count: 12 });
    const { getMonthlyUsage } = await import('@/lib/sms/usage');
    const res = await getMonthlyUsage('profile-1', '2026-04');
    expect(res.count).toBe(12);
  });

  test('zero when both sources are empty', async () => {
    seed('sms_usage', { data: null });
    seed('sms_messages', { data: null, count: null });
    const { getMonthlyUsage } = await import('@/lib/sms/usage');
    const res = await getMonthlyUsage('profile-1', '2026-04');
    expect(res.count).toBe(0);
  });
});

describe('getSmsQuotaStatus + assertSmsQuota', () => {
  beforeEach(() => {
    for (const k of Object.keys(tables)) delete tables[k];
  });

  test('gratuit plan (quota=0) blocks with no addon', async () => {
    seed('subscriptions', { data: { plan_slug: 'gratuit' } });
    seed('sms_usage', { data: { count: 0 } });
    seed('subscription_addons', { data: null });
    const { getSmsQuotaStatus } = await import('@/lib/sms/usage');
    const status = await getSmsQuotaStatus('profile-1');
    expect(status.plan).toBe('gratuit');
    expect(status.limit).toBe(0);
    expect(status.blocked).toBe(true);
  });

  test('addon actif bypass le blocage sur plan gratuit', async () => {
    seed('subscriptions', { data: { plan_slug: 'gratuit' } });
    seed('sms_usage', { data: { count: 0 } });
    seed('subscription_addons', { data: { id: 'addon-1' } });
    const { getSmsQuotaStatus } = await import('@/lib/sms/usage');
    const status = await getSmsQuotaStatus('profile-1');
    expect(status.blocked).toBe(false);
    expect(status.hasMeteredAddon).toBe(true);
  });

  test('starter (quota=20) pas encore atteint', async () => {
    seed('subscriptions', { data: { plan_slug: 'starter' } });
    seed('sms_usage', { data: { count: 15 } });
    seed('subscription_addons', { data: null });
    const { getSmsQuotaStatus } = await import('@/lib/sms/usage');
    const status = await getSmsQuotaStatus('profile-1');
    expect(status.blocked).toBe(false);
    expect(status.remaining).toBe(5);
  });

  test('starter au-delà du quota → blocked', async () => {
    seed('subscriptions', { data: { plan_slug: 'starter' } });
    seed('sms_usage', { data: { count: 20 } });
    seed('subscription_addons', { data: null });
    const { getSmsQuotaStatus } = await import('@/lib/sms/usage');
    const status = await getSmsQuotaStatus('profile-1');
    expect(status.blocked).toBe(true);
    expect(status.remaining).toBe(0);
  });

  test('assertSmsQuota throws typed error when blocked', async () => {
    seed('subscriptions', { data: { plan_slug: 'gratuit' } });
    seed('sms_usage', { data: { count: 0 } });
    seed('subscription_addons', { data: null });
    const { assertSmsQuota, SmsQuotaExceededError } = await import('@/lib/sms/usage');
    await expect(assertSmsQuota('profile-1')).rejects.toBeInstanceOf(SmsQuotaExceededError);
  });

  test('assertSmsQuota resolves when under quota', async () => {
    seed('subscriptions', { data: { plan_slug: 'confort' } });
    seed('sms_usage', { data: { count: 50 } });
    seed('subscription_addons', { data: null });
    const { assertSmsQuota } = await import('@/lib/sms/usage');
    await expect(assertSmsQuota('profile-1')).resolves.toBeUndefined();
  });
});
