/**
 * Tests unitaires — Utilitaires de formulaire d'entités juridiques
 */

import { describe, it, expect } from "vitest";
import {
  isRegimeFiscalLocked,
  getDefaultRegimeFiscal,
} from "@/lib/entities/entity-form-utils";

// ============================================
// isRegimeFiscalLocked
// ============================================

describe("isRegimeFiscalLocked", () => {
  it("verrouille le régime fiscal pour SCI IS", () => {
    expect(isRegimeFiscalLocked("sci_is")).toBe(true);
  });

  it("verrouille le régime fiscal pour SAS", () => {
    expect(isRegimeFiscalLocked("sas")).toBe(true);
  });

  it("verrouille le régime fiscal pour SASU", () => {
    expect(isRegimeFiscalLocked("sasu")).toBe(true);
  });

  it("verrouille le régime fiscal pour SA", () => {
    expect(isRegimeFiscalLocked("sa")).toBe(true);
  });

  it("ne verrouille PAS pour SCI IR", () => {
    expect(isRegimeFiscalLocked("sci_ir")).toBe(false);
  });

  it("ne verrouille PAS pour SARL", () => {
    expect(isRegimeFiscalLocked("sarl")).toBe(false);
  });

  it("ne verrouille PAS pour EURL", () => {
    expect(isRegimeFiscalLocked("eurl")).toBe(false);
  });

  it("ne verrouille PAS pour particulier", () => {
    expect(isRegimeFiscalLocked("particulier")).toBe(false);
  });

  it("ne verrouille PAS pour indivision", () => {
    expect(isRegimeFiscalLocked("indivision")).toBe(false);
  });

  it("ne verrouille PAS pour un type inconnu", () => {
    expect(isRegimeFiscalLocked("unknown")).toBe(false);
  });
});

// ============================================
// getDefaultRegimeFiscal
// ============================================

describe("getDefaultRegimeFiscal", () => {
  it("retourne 'is' pour SCI IS", () => {
    expect(getDefaultRegimeFiscal("sci_is")).toBe("is");
  });

  it("retourne 'is' pour SAS", () => {
    expect(getDefaultRegimeFiscal("sas")).toBe("is");
  });

  it("retourne 'is' pour SASU", () => {
    expect(getDefaultRegimeFiscal("sasu")).toBe("is");
  });

  it("retourne 'is' pour SA", () => {
    expect(getDefaultRegimeFiscal("sa")).toBe("is");
  });

  it("retourne 'ir' pour SCI IR", () => {
    expect(getDefaultRegimeFiscal("sci_ir")).toBe("ir");
  });

  it("retourne 'ir' pour SARL", () => {
    expect(getDefaultRegimeFiscal("sarl")).toBe("ir");
  });

  it("retourne 'ir' pour EURL", () => {
    expect(getDefaultRegimeFiscal("eurl")).toBe("ir");
  });

  it("retourne 'ir' pour particulier", () => {
    expect(getDefaultRegimeFiscal("particulier")).toBe("ir");
  });

  it("retourne 'ir' pour indivision", () => {
    expect(getDefaultRegimeFiscal("indivision")).toBe("ir");
  });

  it("retourne 'ir' pour un type inconnu (défaut)", () => {
    expect(getDefaultRegimeFiscal("unknown")).toBe("ir");
  });
});
