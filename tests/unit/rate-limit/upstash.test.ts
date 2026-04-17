import { describe, test, expect, beforeEach, vi } from 'vitest';

const incrMock = vi.fn();
const expireMock = vi.fn();

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      incr: incrMock,
      expire: expireMock,
    }),
  },
}));

describe('applyRateLimit (Upstash)', () => {
  beforeEach(() => {
    incrMock.mockReset();
    expireMock.mockReset();
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
    vi.resetModules();
  });

  test('allows when count <= limit', async () => {
    incrMock.mockResolvedValueOnce(1);
    const { applyRateLimit } = await import('@/lib/rate-limit/upstash');
    const res = await applyRateLimit({ key: 'sms:user:u1', limit: 5, windowSec: 60 });
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(4);
    expect(res.retryAfterSec).toBeNull();
    expect(expireMock).toHaveBeenCalledTimes(1); // first hit → set TTL
  });

  test('blocks when count > limit and returns retryAfterSec', async () => {
    incrMock.mockResolvedValueOnce(6);
    const { applyRateLimit } = await import('@/lib/rate-limit/upstash');
    const res = await applyRateLimit({ key: 'sms:user:u1', limit: 5, windowSec: 60 });
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.retryAfterSec).toBeGreaterThan(0);
    expect(res.retryAfterSec).toBeLessThanOrEqual(60);
  });

  test('fail-open when Redis throws', async () => {
    incrMock.mockRejectedValueOnce(new Error('boom'));
    const { applyRateLimit } = await import('@/lib/rate-limit/upstash');
    const res = await applyRateLimit({ key: 'sms:user:u1', limit: 5, windowSec: 60 });
    expect(res.allowed).toBe(true);
  });

  test('fail-open when env missing', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
    const { applyRateLimit } = await import('@/lib/rate-limit/upstash');
    const res = await applyRateLimit({ key: 'sms:user:u1', limit: 5, windowSec: 60 });
    expect(res.allowed).toBe(true);
    expect(incrMock).not.toHaveBeenCalled();
  });
});

describe('rateLimitHeaders', () => {
  test('includes Retry-After when blocked', async () => {
    const { rateLimitHeaders } = await import('@/lib/rate-limit/upstash');
    const headers = rateLimitHeaders({
      allowed: false,
      remaining: 0,
      resetAt: 1000,
      retryAfterSec: 42,
    });
    expect(headers['Retry-After']).toBe('42');
    expect(headers['X-RateLimit-Reset']).toBe('1000');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
  });

  test('omits Retry-After when allowed', async () => {
    const { rateLimitHeaders } = await import('@/lib/rate-limit/upstash');
    const headers = rateLimitHeaders({
      allowed: true,
      remaining: 4,
      resetAt: 1000,
      retryAfterSec: null,
    });
    expect(headers['Retry-After']).toBeUndefined();
  });
});

describe('extractClientIp', () => {
  test('uses first IP from x-forwarded-for', async () => {
    const { extractClientIp } = await import('@/lib/rate-limit/upstash');
    const req = new Request('http://x', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(extractClientIp(req)).toBe('1.2.3.4');
  });

  test('falls back to x-real-ip', async () => {
    const { extractClientIp } = await import('@/lib/rate-limit/upstash');
    const req = new Request('http://x', { headers: { 'x-real-ip': '9.9.9.9' } });
    expect(extractClientIp(req)).toBe('9.9.9.9');
  });

  test('returns "unknown" when nothing set', async () => {
    const { extractClientIp } = await import('@/lib/rate-limit/upstash');
    const req = new Request('http://x');
    expect(extractClientIp(req)).toBe('unknown');
  });
});
