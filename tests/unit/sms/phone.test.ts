import { describe, test, expect } from 'vitest';
import {
  normalizePhoneE164,
  detectTerritory,
  maskPhone,
  isNormalizablePhone,
} from '@/lib/sms/phone';

describe('normalizePhoneE164', () => {
  test.each([
    // DROM mobile (saisie locale)
    ['0696123456', '+596696123456'], // Martinique
    ['0697123456', '+596697123456'], // Martinique
    ['0690123456', '+590690123456'], // Guadeloupe
    ['0691123456', '+590691123456'], // Guadeloupe
    ['0694123456', '+594694123456'], // Guyane
    ['0692123456', '+262692123456'], // Réunion
    ['0693123456', '+262693123456'], // Réunion
    ['0639123456', '+262639123456'], // Mayotte
    // France métropole mobile
    ['0612345678', '+33612345678'],
    ['0712345678', '+33712345678'],
    // Déjà E.164
    ['+33612345678', '+33612345678'],
    ['+596696123456', '+596696123456'],
    ['+262692123456', '+262692123456'],
    // Séparateurs usuels
    ['06 96 12 34 56', '+596696123456'],
    ['06-96-12-34-56', '+596696123456'],
    ['06.96.12.34.56', '+596696123456'],
    ['(0696) 12-34-56', '+596696123456'],
  ])('%s → %s', (input: string, expected: string) => {
    expect(normalizePhoneE164(input)).toBe(expected);
  });

  test.each([
    [''],
    ['123'],
    ['abc'],
    ['+00'],
    ['+000'],
    ['0000'],
  ])('%s throws', (bad: string) => {
    expect(() => normalizePhoneE164(bad)).toThrow();
  });

  test('null-ish inputs throw', () => {
    // @ts-expect-error runtime input
    expect(() => normalizePhoneE164(null)).toThrow();
    // @ts-expect-error runtime input
    expect(() => normalizePhoneE164(undefined)).toThrow();
  });
});

describe('detectTerritory', () => {
  test('detects FR', () => {
    expect(detectTerritory('+33612345678')).toBe('FR');
  });
  test('detects MQ', () => {
    expect(detectTerritory('+596696123456')).toBe('MQ');
  });
  test('detects GP / BL / MF (shared +590)', () => {
    expect(['GP', 'BL', 'MF']).toContain(detectTerritory('+590690123456'));
  });
  test('detects GF', () => {
    expect(detectTerritory('+594694123456')).toBe('GF');
  });
  test('detects RE / YT (shared +262)', () => {
    expect(['RE', 'YT']).toContain(detectTerritory('+262692123456'));
  });
  test('returns null for out-of-scope countries', () => {
    // US number
    expect(detectTerritory('+14155552671')).toBeNull();
  });
  test('returns null for garbage', () => {
    expect(detectTerritory('nope')).toBeNull();
  });
});

describe('maskPhone', () => {
  test('masks correctly', () => {
    expect(maskPhone('+596696123456')).toBe('+596696***456');
    expect(maskPhone('+33612345678')).toBe('+336123***678');
  });
  test('returns *** for invalid input', () => {
    expect(maskPhone('')).toBe('***');
    expect(maskPhone('abc')).toBe('***');
  });
});

describe('isNormalizablePhone', () => {
  test('true for valid', () => {
    expect(isNormalizablePhone('0696123456')).toBe(true);
    expect(isNormalizablePhone('+33612345678')).toBe(true);
  });
  test('false for invalid', () => {
    expect(isNormalizablePhone('')).toBe(false);
    expect(isNormalizablePhone('abc')).toBe(false);
  });
});
