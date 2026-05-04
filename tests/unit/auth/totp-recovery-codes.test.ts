import { describe, expect, it } from "vitest";
import {
  generatePlainRecoveryCodes,
  countRemainingRecoveryCodes,
} from "@/lib/auth/totp";

describe("generatePlainRecoveryCodes", () => {
  it("genere le nombre demande de codes", () => {
    expect(generatePlainRecoveryCodes(10)).toHaveLength(10);
    expect(generatePlainRecoveryCodes(5)).toHaveLength(5);
    expect(generatePlainRecoveryCodes()).toHaveLength(10); // default
  });

  it("retourne des chaines au format XXXX-XXXX-XXXX (12 chars + 2 tirets)", () => {
    const codes = generatePlainRecoveryCodes(20);
    for (const code of codes) {
      expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    }
  });

  it("genere des codes uniques (entropie cryptographique)", () => {
    const codes = generatePlainRecoveryCodes(100);
    const unique = new Set(codes);
    // Tres improbable d'avoir un duplicat sur 100 codes 12-hex (~48 bits d'entropie)
    expect(unique.size).toBe(codes.length);
  });

  it("retourne un tableau de strings (jamais d'objets {code, used})", () => {
    // L'ancien generateRecoveryCodes retournait des objets — le nouveau
    // helper ne renvoie QUE des strings pour eviter qu'un dev ne stocke
    // accidentellement les codes en clair.
    const codes = generatePlainRecoveryCodes(3);
    for (const c of codes) {
      expect(typeof c).toBe("string");
    }
  });
});

describe("countRemainingRecoveryCodes", () => {
  it("compte les codes non utilises (nouveau format hashe)", () => {
    const codes = [
      { code_hash: "$2a$12$abc", used: false },
      { code_hash: "$2a$12$def", used: true, used_at: "2026-01-01T00:00:00Z" },
      { code_hash: "$2a$12$ghi", used: false },
    ];
    expect(countRemainingRecoveryCodes(codes)).toBe(2);
  });

  it("compte les codes non utilises (ancien format en clair pour retrocompat)", () => {
    const codes = [
      { code: "AAAA-BBBB-CCCC", used: false },
      { code: "DDDD-EEEE-FFFF", used: true },
    ];
    expect(countRemainingRecoveryCodes(codes)).toBe(1);
  });

  it("retourne 0 sur null, undefined, tableau vide", () => {
    expect(countRemainingRecoveryCodes(null)).toBe(0);
    expect(countRemainingRecoveryCodes(undefined)).toBe(0);
    expect(countRemainingRecoveryCodes([])).toBe(0);
  });

  it("retourne 0 si l'entree n'est pas un tableau", () => {
    // Defensif : si la DB renvoie un format inattendu (ex: objet vide), on
    // ne crash pas, on dit juste "0 restant".
    expect(countRemainingRecoveryCodes("oops" as any)).toBe(0);
    expect(countRemainingRecoveryCodes(42 as any)).toBe(0);
  });

  it("traite les entrees sans champ used comme non utilisees", () => {
    const codes = [
      { code_hash: "$2a$12$abc" }, // pas de champ "used"
      { code_hash: "$2a$12$def", used: true },
    ];
    expect(countRemainingRecoveryCodes(codes)).toBe(1);
  });
});
