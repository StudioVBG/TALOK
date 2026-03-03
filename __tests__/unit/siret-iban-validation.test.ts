import { describe, it, expect } from "vitest";
import {
  isValidSiren,
  isValidSiret,
  siretToSiren,
  formatSiret,
  formatSiren,
  isValidIban,
  formatIban,
  maskIban,
} from "@/lib/entities/siret-validation";

// ============================================
// SIREN VALIDATION
// ============================================

describe("isValidSiren", () => {
  it("valide un SIREN correct (Luhn)", () => {
    // SIREN de test connu valide
    expect(isValidSiren("732829320")).toBe(true);
  });

  it("rejette un SIREN avec clé Luhn incorrecte", () => {
    expect(isValidSiren("123456789")).toBe(false);
  });

  it("rejette un SIREN trop court", () => {
    expect(isValidSiren("12345678")).toBe(false);
  });

  it("rejette un SIREN trop long", () => {
    expect(isValidSiren("1234567890")).toBe(false);
  });

  it("rejette un SIREN avec des lettres", () => {
    expect(isValidSiren("12345678A")).toBe(false);
  });

  it("accepte le SIREN de La Poste (exception)", () => {
    expect(isValidSiren("356000000")).toBe(true);
  });

  it("gère les espaces en entrée", () => {
    expect(isValidSiren("732 829 320")).toBe(true);
  });

  it("rejette une chaîne vide", () => {
    expect(isValidSiren("")).toBe(false);
  });
});

// ============================================
// SIRET VALIDATION
// ============================================

describe("isValidSiret", () => {
  it("valide un SIRET correct (Luhn)", () => {
    // SIRET de test connu valide (SIREN 732829320 + NIC)
    expect(isValidSiret("73282932000074")).toBe(true);
  });

  it("rejette un SIRET avec clé Luhn incorrecte", () => {
    expect(isValidSiret("12345678901234")).toBe(false);
  });

  it("rejette un SIRET trop court", () => {
    expect(isValidSiret("1234567890123")).toBe(false);
  });

  it("rejette un SIRET trop long", () => {
    expect(isValidSiret("123456789012345")).toBe(false);
  });

  it("rejette un SIRET dont le SIREN est invalide", () => {
    // SIREN invalide + NIC valide
    expect(isValidSiret("12345678900000")).toBe(false);
  });

  it("gère les espaces en entrée", () => {
    expect(isValidSiret("732 829 320 00074")).toBe(true);
  });

  it("rejette une chaîne vide", () => {
    expect(isValidSiret("")).toBe(false);
  });
});

// ============================================
// SIRET TO SIREN
// ============================================

describe("siretToSiren", () => {
  it("extrait le SIREN d'un SIRET", () => {
    expect(siretToSiren("73282932000074")).toBe("732829320");
  });

  it("gère les espaces", () => {
    expect(siretToSiren("732 829 320 00074")).toBe("732829320");
  });

  it("retourne null si trop court", () => {
    expect(siretToSiren("12345")).toBeNull();
  });
});

// ============================================
// FORMATTING
// ============================================

describe("formatSiret", () => {
  it("formate un SIRET en groupes", () => {
    expect(formatSiret("73282932000074")).toBe("732 829 320 00074");
  });
});

describe("formatSiren", () => {
  it("formate un SIREN en groupes de 3", () => {
    expect(formatSiren("732829320")).toBe("732 829 320");
  });
});

// ============================================
// IBAN VALIDATION (ISO 7064 / MOD-97-10)
// ============================================

describe("isValidIban", () => {
  it("valide un IBAN français correct", () => {
    // IBAN de test standard FR
    expect(isValidIban("FR7630006000011234567890189")).toBe(true);
  });

  it("valide un IBAN français avec espaces", () => {
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
  });

  it("valide un IBAN allemand correct", () => {
    expect(isValidIban("DE89370400440532013000")).toBe(true);
  });

  it("valide un IBAN britannique correct", () => {
    expect(isValidIban("GB29NWBK60161331926819")).toBe(true);
  });

  it("rejette un IBAN avec clé de contrôle incorrecte", () => {
    // FR76 modifié en FR77 — clé de contrôle incorrecte
    expect(isValidIban("FR7730006000011234567890189")).toBe(false);
  });

  it("rejette un IBAN trop court", () => {
    expect(isValidIban("FR7630006")).toBe(false);
  });

  it("rejette un IBAN trop long (35+ chars)", () => {
    expect(isValidIban("FR76300060000112345678901891234567890")).toBe(false);
  });

  it("rejette un IBAN avec des caractères spéciaux", () => {
    expect(isValidIban("FR76-3000-6000-0112")).toBe(false);
  });

  it("rejette un IBAN sans code pays", () => {
    expect(isValidIban("7630006000011234567890189")).toBe(false);
  });

  it("rejette une chaîne vide", () => {
    expect(isValidIban("")).toBe(false);
  });

  it("est insensible à la casse", () => {
    expect(isValidIban("fr7630006000011234567890189")).toBe(true);
  });
});

// ============================================
// IBAN FORMATTING & MASKING
// ============================================

describe("formatIban", () => {
  it("formate un IBAN en groupes de 4", () => {
    expect(formatIban("FR7630006000011234567890189")).toBe(
      "FR76 3000 6000 0112 3456 7890 189"
    );
  });
});

describe("maskIban", () => {
  it("masque un IBAN en gardant préfixe et suffixe", () => {
    const masked = maskIban("FR7630006000011234567890189");
    expect(masked).toContain("FR76");
    expect(masked).toContain("189");
    expect(masked).toContain("••••");
    // Le préfixe (4 chars) + suffix (3 chars) doivent être visibles
    expect(masked.replace(/[• ]/g, "")).toBe("FR76189");
  });

  it("retourne des bullets pour un IBAN très court", () => {
    expect(maskIban("FR76")).toBe("••••");
  });
});
