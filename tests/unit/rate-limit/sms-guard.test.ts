import { describe, test, expect, beforeEach, vi } from 'vitest';

const applyRateLimitMock = vi.fn();

vi.mock('@/lib/rate-limit/upstash', () => ({
  applyRateLimit: applyRateLimitMock,
}));

vi.mock('@/lib/sms/monitoring', () => ({
  trackSmsEvent: vi.fn(),
}));

// Helper to build a RateLimitResult
function ok() {
  return {
    allowed: true,
    remaining: 4,
    resetAt: Math.floor(Date.now() / 1000) + 60,
    retryAfterSec: null,
  };
}
function ko(retryAfterSec = 42) {
  return {
    allowed: false,
    remaining: 0,
    resetAt: Math.floor(Date.now() / 1000) + retryAfterSec,
    retryAfterSec,
  };
}

describe('checkSmsRateLimit (cumulative stages)', () => {
  beforeEach(() => {
    applyRateLimitMock.mockReset();
  });

  test('allowed when all 5 stages pass', async () => {
    applyRateLimitMock.mockResolvedValue(ok());
    const { checkSmsRateLimit } = await import('@/lib/rate-limit/sms-guard');
    const res = await checkSmsRateLimit({
      userId: 'u1',
      destinationE164: '+596696123456',
      ip: '10.0.0.1',
    });
    expect(res).toEqual({ allowed: true });
    expect(applyRateLimitMock).toHaveBeenCalledTimes(5);
  });

  test('first violation wins (perUser)', async () => {
    applyRateLimitMock.mockResolvedValueOnce(ko(12));
    const { checkSmsRateLimit } = await import('@/lib/rate-limit/sms-guard');
    const res = await checkSmsRateLimit({
      userId: 'u1',
      destinationE164: '+596696123456',
      ip: '10.0.0.1',
    });
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.reasonKey).toBe('user');
      expect(res.retryAfterSec).toBe(12);
    }
    // Only first stage is called
    expect(applyRateLimitMock).toHaveBeenCalledTimes(1);
  });

  test('stages run in order: user → user_daily → destination', async () => {
    applyRateLimitMock
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ko(30));
    const { checkSmsRateLimit } = await import('@/lib/rate-limit/sms-guard');
    const res = await checkSmsRateLimit({
      userId: 'u1',
      destinationE164: '+596696123456',
      ip: '10.0.0.1',
    });
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.reasonKey).toBe('destination');
      expect(res.reason).toContain('numéro');
    }
    expect(applyRateLimitMock).toHaveBeenCalledTimes(3);
  });

  test('two different destinations for same user do not share counter', async () => {
    // The guard just passes keys to applyRateLimit; ensure dest key changes.
    applyRateLimitMock.mockResolvedValue(ok());
    const { checkSmsRateLimit } = await import('@/lib/rate-limit/sms-guard');
    await checkSmsRateLimit({
      userId: 'u1',
      destinationE164: '+596696111111',
      ip: '1.2.3.4',
    });
    await checkSmsRateLimit({
      userId: 'u1',
      destinationE164: '+596696222222',
      ip: '1.2.3.4',
    });
    const destKeys = applyRateLimitMock.mock.calls
      .map((c: any) => c[0].key as string)
      .filter((k) => k.startsWith('sms:dest:'));
    expect(new Set(destKeys).size).toBe(2);
  });
});

describe('checkOtpVerifyRateLimit', () => {
  beforeEach(() => applyRateLimitMock.mockReset());

  test('allowed within threshold', async () => {
    applyRateLimitMock.mockResolvedValue(ok());
    const { checkOtpVerifyRateLimit } = await import('@/lib/rate-limit/sms-guard');
    expect((await checkOtpVerifyRateLimit('u1')).allowed).toBe(true);
  });

  test('returns retryAfterSec when limit exceeded', async () => {
    applyRateLimitMock.mockResolvedValue(ko(600));
    const { checkOtpVerifyRateLimit } = await import('@/lib/rate-limit/sms-guard');
    const res = await checkOtpVerifyRateLimit('u1');
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.retryAfterSec).toBe(600);
      expect(res.reason).toContain('tentatives');
    }
  });
});
