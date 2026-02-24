/**
 * Tests unitaires pour resolveTenantDisplay et resolveTenantFullName
 */

import { describe, it, expect } from "vitest";
import {
  resolveTenantDisplay,
  resolveTenantFullName,
  type SignerLike,
} from "@/lib/helpers/resolve-tenant-display";

describe("resolveTenantDisplay", () => {
  it("retourne le placeholder pour signer null", () => {
    const result = resolveTenantDisplay(null);
    expect(result.nom).toBe("[En attente de locataire]");
    expect(result.isPlaceholder).toBe(true);
    expect(result.isLinked).toBe(false);
  });

  it("retourne le placeholder pour signer undefined", () => {
    const result = resolveTenantDisplay(undefined);
    expect(result.isPlaceholder).toBe(true);
  });

  it("utilise le profil complet quand profile a prenom et nom", () => {
    const signer: SignerLike = {
      profile: {
        prenom: "Jean",
        nom: "Dupont",
        email: "jean@example.com",
        telephone: "0612345678",
      },
      invited_email: "invited@example.com",
      invited_name: "Invité",
    };
    const result = resolveTenantDisplay(signer);
    expect(result.prenom).toBe("Jean");
    expect(result.nom).toBe("Dupont");
    expect(result.email).toBe("jean@example.com");
    expect(result.telephone).toBe("0612345678");
    expect(result.isLinked).toBe(true);
    expect(result.isPlaceholder).toBe(false);
  });

  it("utilise invited_name quand profile n'a pas de nom", () => {
    const signer: SignerLike = {
      profile: null,
      invited_name: "Marie Martin",
      invited_email: "marie@example.com",
    };
    const result = resolveTenantDisplay(signer);
    expect(result.prenom).toBe("Marie");
    expect(result.nom).toBe("Martin");
    expect(result.email).toBe("marie@example.com");
    expect(result.isLinked).toBe(false);
    expect(result.isPlaceholder).toBe(false);
  });

  it("utilise invited_email pour le nom quand seul l'email est fourni (vrai email)", () => {
    const signer: SignerLike = {
      profile: null,
      invited_email: "paul.dupuis@example.com",
    };
    const result = resolveTenantDisplay(signer);
    expect(result.nom).toBe("paul dupuis");
    expect(result.email).toBe("paul.dupuis@example.com");
    expect(result.isLinked).toBe(false);
    expect(result.isPlaceholder).toBe(false);
  });

  it("retourne le placeholder pour un email placeholder (@a-definir)", () => {
    const signer: SignerLike = {
      profile: null,
      invited_email: "locataire@a-definir",
    };
    const result = resolveTenantDisplay(signer);
    expect(result.nom).toBe("[En attente de locataire]");
    expect(result.isPlaceholder).toBe(true);
  });

  it("retourne le placeholder pour un email placeholder (a-definir.com)", () => {
    const signer: SignerLike = {
      profile: null,
      invited_email: "x@a-definir.com",
    };
    const result = resolveTenantDisplay(signer);
    expect(result.isPlaceholder).toBe(true);
  });
});

describe("resolveTenantFullName", () => {
  it("retourne 'Prénom Nom' pour un profil complet", () => {
    const signer: SignerLike = {
      profile: { prenom: "Jean", nom: "Dupont" },
    };
    expect(resolveTenantFullName(signer)).toBe("Jean Dupont");
  });

  it("retourne le nom seul si pas de prénom", () => {
    const signer: SignerLike = {
      profile: { nom: "Dupont" },
    };
    expect(resolveTenantFullName(signer)).toBe("Dupont");
  });

  it("retourne le placeholder pour signer null", () => {
    expect(resolveTenantFullName(null)).toBe("[En attente de locataire]");
  });
});
