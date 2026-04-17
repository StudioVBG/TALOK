import { describe, test, expect } from 'vitest';
import { translateTwilioError, TWILIO_ERROR_MESSAGES_FR } from '@/lib/sms/errors';

describe('translateTwilioError', () => {
  test.each([
    [21211, true],
    [21610, true],
    [21614, true],
    [30003, true],
    [30004, true],
    [30005, true],
    [30006, true],
    [30007, true],
    [60200, true],
    [60202, true],
    [60203, true],
    [60212, true],
    [60223, true],
  ])('code %i is user-facing', (code, userFacing) => {
    const t = translateTwilioError(code);
    expect(t.userFacing).toBe(userFacing);
    expect(t.code).toBe(code);
    expect(t.message).toBe(TWILIO_ERROR_MESSAGES_FR[code]);
  });

  test.each([20003, 20404, 20422, 21608])(
    'code %i is known but NOT user-facing (infra)',
    (code) => {
      const t = translateTwilioError(code);
      expect(t.userFacing).toBe(false);
      expect(t.message).toBe(TWILIO_ERROR_MESSAGES_FR[code]);
    }
  );

  test('unknown code returns generic non-user-facing message', () => {
    const t = translateTwilioError(99999);
    expect(t.userFacing).toBe(false);
    expect(t.code).toBe(99999);
    expect(t.message).toMatch(/Échec d'envoi/);
  });

  test('null code returns generic', () => {
    const t = translateTwilioError(null);
    expect(t.code).toBeNull();
    expect(t.userFacing).toBe(false);
  });

  test('accepts string code', () => {
    const t = translateTwilioError('21211');
    expect(t.code).toBe(21211);
    expect(t.userFacing).toBe(true);
  });

  test('at least 20 codes mapped', () => {
    expect(Object.keys(TWILIO_ERROR_MESSAGES_FR).length).toBeGreaterThanOrEqual(20);
  });

  test('never returns raw English Twilio message', () => {
    for (const msg of Object.values(TWILIO_ERROR_MESSAGES_FR)) {
      // Cheap heuristic: French messages do not contain "Invalid parameter"
      expect(msg).not.toMatch(/Invalid parameter/);
    }
  });
});
