import { describe, test, expect, vi } from 'vitest';
import twilio from 'twilio';
import { validateTwilioWebhook, formDataToObject } from '@/lib/sms/webhook';

describe('validateTwilioWebhook (fail-closed)', () => {
  test('returns false when authToken is missing', () => {
    expect(
      validateTwilioWebhook({
        url: 'https://example.com/api/webhooks/twilio',
        params: { MessageSid: 'SM1' },
        signature: 'sig',
        authToken: undefined,
      })
    ).toBe(false);
  });

  test('returns false when signature is missing', () => {
    expect(
      validateTwilioWebhook({
        url: 'https://example.com/api/webhooks/twilio',
        params: { MessageSid: 'SM1' },
        signature: null,
        authToken: 'any-token',
      })
    ).toBe(false);
  });

  test('returns true for a valid signature computed via the SDK', () => {
    const authToken = 'my-secret-token';
    const url = 'https://talok.fr/api/webhooks/twilio';
    const params = { MessageSid: 'SM123', MessageStatus: 'delivered' };
    // Compute the same way twilio.validateRequest expects.
    const signature = computeTwilioSignature(authToken, url, params);

    expect(
      validateTwilioWebhook({ url, params, signature, authToken })
    ).toBe(true);
  });

  test('returns false for a tampered signature', () => {
    const authToken = 'my-secret-token';
    const url = 'https://talok.fr/api/webhooks/twilio';
    const params = { MessageSid: 'SM123' };
    const tampered = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    expect(
      validateTwilioWebhook({ url, params, signature: tampered, authToken })
    ).toBe(false);
  });

  test('returns false when SDK throws internally', () => {
    const spy = vi.spyOn(twilio, 'validateRequest').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(
      validateTwilioWebhook({
        url: 'https://example.com',
        params: {},
        signature: 'x',
        authToken: 'y',
      })
    ).toBe(false);
    spy.mockRestore();
  });
});

describe('formDataToObject', () => {
  test('parses URL-encoded body', () => {
    const body = 'MessageSid=SM123&MessageStatus=delivered&To=%2B596696123456';
    expect(formDataToObject(body)).toEqual({
      MessageSid: 'SM123',
      MessageStatus: 'delivered',
      To: '+596696123456',
    });
  });

  test('keeps first occurrence on duplicate keys', () => {
    expect(formDataToObject('a=1&a=2')).toEqual({ a: '1' });
  });

  test('returns empty object for empty body', () => {
    expect(formDataToObject('')).toEqual({});
  });
});

/**
 * Compute a valid Twilio signature for testing.
 * Mirrors twilio-node's internal algorithm: HMAC-SHA1(url + sorted key+value).
 */
function computeTwilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('node:crypto');
  const sorted = Object.keys(params)
    .sort()
    .map((k) => k + params[k])
    .join('');
  return crypto.createHmac('sha1', authToken).update(url + sorted).digest('base64');
}
