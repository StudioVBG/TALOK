import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockVerificationsCreate = vi.fn();
const mockVerificationChecksCreate = vi.fn();

vi.mock('@/lib/sms/client', () => ({
  getTwilioClient: vi.fn(async () => ({
    verify: {
      v2: {
        services: () => ({
          verifications: { create: mockVerificationsCreate },
          verificationChecks: { create: mockVerificationChecksCreate },
        }),
      },
    },
  })),
  getVerifyServiceSid: vi.fn(() => 'VAtest000000000000000000000000000000'),
}));

describe('startVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VAtest000000000000000000000000000000';
  });

  test('normalizes DROM phone and calls Verify', async () => {
    mockVerificationsCreate.mockResolvedValueOnce({
      sid: 'VE123',
      status: 'pending',
    });

    const { startVerification } = await import('@/lib/sms/verify');
    const result = await startVerification('0696123456');

    expect(result).toEqual({
      success: true,
      status: 'pending',
      sid: 'VE123',
      e164: '+596696123456',
    });
    expect(mockVerificationsCreate).toHaveBeenCalledWith({
      to: '+596696123456',
      channel: 'sms',
      locale: 'fr',
    });
  });

  test('returns error when Twilio rejects (e.g. invalid number)', async () => {
    mockVerificationsCreate.mockRejectedValueOnce({ code: 60200, message: 'Invalid parameter: To' });
    const { startVerification } = await import('@/lib/sms/verify');
    const result = await startVerification('+33612345678');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('60200');
  });

  test('throws on invalid phone before hitting Twilio', async () => {
    const { startVerification } = await import('@/lib/sms/verify');
    await expect(startVerification('abc')).rejects.toThrow();
  });
});

describe('checkVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VAtest000000000000000000000000000000';
  });

  test('returns approved=true on approved status', async () => {
    mockVerificationChecksCreate.mockResolvedValueOnce({ status: 'approved' });
    const { checkVerification } = await import('@/lib/sms/verify');
    const result = await checkVerification('0696123456', '123456');
    expect(result).toEqual({ success: true, approved: true, status: 'approved' });
  });

  test('returns approved=false on pending status', async () => {
    mockVerificationChecksCreate.mockResolvedValueOnce({ status: 'pending' });
    const { checkVerification } = await import('@/lib/sms/verify');
    const result = await checkVerification('0696123456', '000000');
    expect(result).toEqual({ success: true, approved: false, status: 'pending' });
  });

  test('returns error when Twilio throws (e.g. verification expired)', async () => {
    mockVerificationChecksCreate.mockRejectedValueOnce({ code: 20404, message: 'Not found' });
    const { checkVerification } = await import('@/lib/sms/verify');
    const result = await checkVerification('0696123456', '123456');
    expect(result.success).toBe(false);
    expect(result.approved).toBe(false);
    expect(result.errorCode).toBe('20404');
  });
});
