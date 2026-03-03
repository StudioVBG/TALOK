/**
 * Tests unitaires — Validation SIRET/SIREN (algorithme de Luhn)
 */

import { describe, it, expect } from "vitest";
import {
  isValidSiret,
  isValidSiren,
  siretToSiren,
  formatSiret,
  formatSiren,
} from "@/lib/entities/siret-validation";

// ============================================
// SIREN
// ============================================

describe("isValidSiren", () => {
  it("valide un SIREN correct", () => {
    // 732829320 est un SIREN valide (Luhn OK)
    expect(isValidSiren("732829320")).toBe(true);
  });

  it("rejette un SIREN avec mauvaise clé de contrôle", () => {
    expect(isValidSiren("732829321")).toBe(false);
  });

  it("rejette un SIREN trop court", () => {
    expect(isValidSiren("7328293")).toBe(false);
  });

  it("rejette un SIREN trop long", () => {
    expect(isValidSiren("7328293200")).toBe(false);
  });

  it("rejette un SIREN contenant des lettres", () => {
    expect(isValidSiren("73282932A")).toBe(false);
  });

  it("gère les espaces dans le SIREN", () => {
    expect(isValidSiren("732 829 320")).toBe(true);
  });

  it("gère le cas spécial La Poste (SIREN 356000000)", () => {
    expect(isValidSiren("356000000")).toBe(true);
  });

  it("rejette une chaîne vide", () => {
    expect(isValidSiren("")).toBe(false);
  });
});

// ============================================
// SIRET
// ============================================

describe("isValidSiret", () => {
  it("valide un SIRET correct", () => {
    // 73282932000074 est un SIRET valide (Luhn OK sur SIREN et SIRET complet)
    expect(isValidSiret("73282932000074")).toBe(true);
  });

  it("rejette un SIRET avec mauvaise clé de contrôle", () => {
    expect(isValidSiret("73282932000075")).toBe(false);
  });

  it("rejette un SIRET trop court", () => {
    expect(isValidSiret("7328293200007")).toBe(false);
  });

  it("rejette un SIRET trop long", () => {
    expect(isValidSiret("732829320000740")).toBe(false);
  });

  it("rejette un SIRET dont le SIREN est invalide", () => {
    // SIREN 732829321 est invalide → le SIRET est invalide
    expect(isValidSiret("73282932100074")).toBe(false);
  });

  it("gère les espaces dans le SIRET", () => {
    expect(isValidSiret("732 829 320 00074")).toBe(true);
  });

  it("gère le cas spécial La Poste", () => {
    // SIRET La Poste : SIREN 356000000 + NIC, somme des chiffres % 5 === 0
    // 3+5+6+0+0+0+0+0+0+0+0+0+0+1 = 15, 15 % 5 = 0 → valide
    expect(isValidSiret("35600000000001")).toBe(true);
  });

  it("rejette un SIRET La Poste invalide", () => {
    // 3+5+6+0+0+0+0+0+0+0+0+0+4+8 = 26, 26 % 5 = 1 → invalide
    expect(isValidSiret("35600000000048")).toBe(false);
  });

  it("rejette une chaîne vide", () => {
    expect(isValidSiret("")).toBe(false);
  });

  it("rejette des caractères alphabétiques", () => {
    expect(isValidSiret("7328293200007A")).toBe(false);
  });
});

// ============================================
// siretToSiren
// ============================================

describe("siretToSiren", () => {
  it("extrait le SIREN (9 premiers chiffres) d'un SIRET", () => {
    expect(siretToSiren("73282932000074")).toBe("732829320");
  });

  it("retourne null si trop court", () => {
    expect(siretToSiren("12345678")).toBe(null);
  });

  it("gère les espaces", () => {
    expect(siretToSiren("732 829 320 00074")).toBe("732829320");
  });
});

// ============================================
// formatSiret / formatSiren
// ============================================

describe("formatSiret", () => {
  it("formate un SIRET : 123 456 789 01234", () => {
    expect(formatSiret("73282932000074")).toBe("732 829 320 00074");
  });

  it("gère une entrée déjà formatée", () => {
    expect(formatSiret("732 829 320 00074")).toBe("732 829 320 00074");
  });
});

describe("formatSiren", () => {
  it("formate un SIREN : 123 456 789", () => {
    expect(formatSiren("732829320")).toBe("732 829 320");
  });

  it("gère une entrée déjà formatée", () => {
    expect(formatSiren("732 829 320")).toBe("732 829 320");
  });
});
