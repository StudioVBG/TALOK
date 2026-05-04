import { describe, expect, it } from "vitest";
import { shortFormeJuridique } from "@/lib/siret/nature-juridique";
import { computeTvaIntra } from "@/lib/siret/tva";

describe("computeTvaIntra", () => {
  it("calcule la clé TVA pour des SIREN connus", () => {
    // Cas vérifiables : Société Générale (552120222), Renault (441639465)
    expect(computeTvaIntra("552120222")).toBe("FR27552120222");
    expect(computeTvaIntra("441639465")).toBe("FR63441639465");
  });

  it("padde la clé sur 2 chiffres si nécessaire", () => {
    // SIREN choisi pour produire une clé < 10
    const tva = computeTvaIntra("000000001");
    expect(tva).toMatch(/^FR\d{2}000000001$/);
    expect(tva.slice(2, 4)).toMatch(/^\d{2}$/);
  });

  it("rejette un SIREN non numérique ou de mauvaise longueur", () => {
    expect(() => computeTvaIntra("12345")).toThrow();
    expect(() => computeTvaIntra("ABC123456")).toThrow();
  });

  it("ignore les espaces dans le SIREN", () => {
    expect(computeTvaIntra("552 120 222")).toBe("FR27552120222");
  });
});

describe("shortFormeJuridique", () => {
  it("mappe les codes INSEE courants en forme courte", () => {
    expect(shortFormeJuridique("5710", null)).toBe("SAS");
    expect(shortFormeJuridique("5720", null)).toBe("SASU");
    expect(shortFormeJuridique("5410", null)).toBe("SARL");
    expect(shortFormeJuridique("5430", null)).toBe("EURL");
    expect(shortFormeJuridique("1000", null)).toBe("EI");
  });

  it("retombe sur le libellé fourni si le code est inconnu", () => {
    expect(shortFormeJuridique("9999", "Forme exotique")).toBe(
      "Forme exotique",
    );
  });

  it("renvoie null si ni code ni libellé", () => {
    expect(shortFormeJuridique(null, null)).toBeNull();
    expect(shortFormeJuridique(undefined, undefined)).toBeNull();
  });
});
