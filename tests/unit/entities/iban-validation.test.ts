/**
 * Tests unitaires — Validation IBAN (ISO 13616)
 */

import { describe, it, expect } from "vitest";
import { isValidIban, formatIban } from "@/lib/entities/iban-validation";

// ============================================
// isValidIban
// ============================================

describe("isValidIban", () => {
  // IBAN français valides (27 caractères)
  it("valide un IBAN français correct", () => {
    // IBAN de test standard FR
    expect(isValidIban("FR7630006000011234567890189")).toBe(true);
  });

  it("valide un IBAN français avec espaces", () => {
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
  });

  it("valide un IBAN français en minuscules", () => {
    expect(isValidIban("fr7630006000011234567890189")).toBe(true);
  });

  // IBAN d'autres pays européens
  it("valide un IBAN allemand (DE)", () => {
    expect(isValidIban("DE89370400440532013000")).toBe(true);
  });

  it("valide un IBAN belge (BE)", () => {
    expect(isValidIban("BE68539007547034")).toBe(true);
  });

  it("valide un IBAN espagnol (ES)", () => {
    expect(isValidIban("ES9121000418450200051332")).toBe(true);
  });

  it("valide un IBAN italien (IT)", () => {
    expect(isValidIban("IT60X0542811101000000123456")).toBe(true);
  });

  // IBAN invalides — clé de contrôle incorrecte
  it("rejette un IBAN français avec mauvaise clé de contrôle", () => {
    // Changement d'un chiffre → clé modulo 97 invalide
    expect(isValidIban("FR7630006000011234567890180")).toBe(false);
  });

  it("rejette un IBAN allemand avec mauvaise clé", () => {
    expect(isValidIban("DE89370400440532013001")).toBe(false);
  });

  // IBAN invalides — format
  it("rejette un IBAN trop court", () => {
    expect(isValidIban("FR76300060")).toBe(false);
  });

  it("rejette un IBAN trop long (35 chars)", () => {
    expect(isValidIban("FR76300060000112345678901891234567890")).toBe(false);
  });

  it("rejette un IBAN sans code pays", () => {
    expect(isValidIban("7630006000011234567890189")).toBe(false);
  });

  it("rejette un IBAN avec code pays numérique", () => {
    expect(isValidIban("127630006000011234567890189")).toBe(false);
  });

  it("rejette une chaîne vide", () => {
    expect(isValidIban("")).toBe(false);
  });

  // Longueur par pays
  it("rejette un IBAN français de mauvaise longueur (26 au lieu de 27)", () => {
    expect(isValidIban("FR763000600001123456789018")).toBe(false);
  });

  // DOM-TOM (même format que FR, 27 caractères)
  it("valide un IBAN Guadeloupe/Martinique (FR)", () => {
    // Les IBAN DOM-TOM utilisent le code pays FR
    expect(isValidIban("FR7630006000011234567890189")).toBe(true);
  });

  it("rejette des caractères spéciaux", () => {
    expect(isValidIban("FR76-3000-6000-0112-3456-7890-189")).toBe(false);
  });
});

// ============================================
// formatIban
// ============================================

describe("formatIban", () => {
  it("formate un IBAN en groupes de 4", () => {
    expect(formatIban("FR7630006000011234567890189")).toBe(
      "FR76 3000 6000 0112 3456 7890 189"
    );
  });

  it("gère une entrée déjà formatée", () => {
    expect(formatIban("FR76 3000 6000 0112 3456 7890 189")).toBe(
      "FR76 3000 6000 0112 3456 7890 189"
    );
  });

  it("met en majuscules", () => {
    expect(formatIban("fr7630006000011234567890189")).toBe(
      "FR76 3000 6000 0112 3456 7890 189"
    );
  });
});
