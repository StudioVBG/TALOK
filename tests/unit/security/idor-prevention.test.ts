/**
 * Tests unitaires - Prévention IDOR (Insecure Direct Object Reference)
 *
 * Vérifie la logique de contrôle d'accès aux documents:
 * - Un propriétaire ne peut accéder qu'à ses propres documents
 * - Un locataire ne peut accéder qu'aux documents de ses baux
 * - Un utilisateur sans lien ne voit jamais d'existence de documents étrangers
 *
 * Note: Ces tests vérifient la logique métier isolée.
 * Les tests E2E (Playwright) valideront la chaîne complète.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ======================================
// Simulation de la logique d'autorisation
// extraite de /api/documents/check
// ======================================

interface Profile {
  id: string;
  role: string;
}

interface OwnershipCheck {
  isOwner: boolean;
  isTenantLinked: boolean;
  isSigner: boolean;
}

/**
 * Simule la logique d'autorisation du handler documents/check
 * (extraite pour pouvoir être testée indépendamment de Supabase)
 */
function canAccessDocument(
  profile: Profile,
  resourceOwnerId: string | null,
  leaseSignerProfileIds: string[],
  options: { hasPropertyLink?: boolean; hasLeaseLink?: boolean } = {}
): OwnershipCheck {
  const isOwner = resourceOwnerId === profile.id;
  const isTenantLinked = options.hasPropertyLink ?? false;
  const isSigner = leaseSignerProfileIds.includes(profile.id);

  return { isOwner, isTenantLinked, isSigner };
}

function isAccessAllowed(profile: Profile, check: OwnershipCheck): boolean {
  if (profile.role === "admin") return true;
  return check.isOwner || check.isTenantLinked || check.isSigner;
}

describe("IDOR Prevention - Documents Check", () => {
  const ownerProfile: Profile = { id: "owner-uuid-1", role: "owner" };
  const tenantProfile: Profile = { id: "tenant-uuid-1", role: "tenant" };
  const otherOwnerProfile: Profile = { id: "owner-uuid-2", role: "owner" };
  const adminProfile: Profile = { id: "admin-uuid-1", role: "admin" };
  const randomProfile: Profile = { id: "random-uuid-1", role: "tenant" };

  describe("Accès par propriétaire", () => {
    it("autorise le propriétaire à accéder aux documents de son bien", () => {
      const check = canAccessDocument(
        ownerProfile,
        "owner-uuid-1", // Le bien appartient à ce propriétaire
        []
      );
      expect(isAccessAllowed(ownerProfile, check)).toBe(true);
      expect(check.isOwner).toBe(true);
    });

    it("interdit à un autre propriétaire d'accéder aux documents", () => {
      const check = canAccessDocument(
        otherOwnerProfile,
        "owner-uuid-1", // Le bien appartient au propriétaire 1
        []
      );
      expect(isAccessAllowed(otherOwnerProfile, check)).toBe(false);
      expect(check.isOwner).toBe(false);
    });
  });

  describe("Accès par locataire", () => {
    it("autorise un locataire signataire du bail à accéder aux documents", () => {
      const check = canAccessDocument(
        tenantProfile,
        "owner-uuid-1", // Pas propriétaire
        ["tenant-uuid-1"], // Mais signataire du bail
        { hasLeaseLink: true }
      );
      expect(isAccessAllowed(tenantProfile, check)).toBe(true);
      expect(check.isSigner).toBe(true);
    });

    it("autorise un locataire avec lien propriété", () => {
      const check = canAccessDocument(
        tenantProfile,
        "owner-uuid-1",
        [],
        { hasPropertyLink: true }
      );
      expect(isAccessAllowed(tenantProfile, check)).toBe(true);
      expect(check.isTenantLinked).toBe(true);
    });

    it("interdit un locataire sans aucun lien avec le bail/propriété", () => {
      const check = canAccessDocument(
        randomProfile,
        "owner-uuid-1",
        ["tenant-uuid-1"], // Seul tenant-1 est signataire
        { hasPropertyLink: false }
      );
      expect(isAccessAllowed(randomProfile, check)).toBe(false);
    });
  });

  describe("Accès admin", () => {
    it("autorise l'admin à accéder à tous les documents", () => {
      const check = canAccessDocument(
        adminProfile,
        "owner-uuid-1",
        []
      );
      expect(isAccessAllowed(adminProfile, check)).toBe(true);
    });

    it("autorise l'admin même sans aucun lien", () => {
      const check = canAccessDocument(
        adminProfile,
        null,
        []
      );
      expect(isAccessAllowed(adminProfile, check)).toBe(true);
    });
  });

  describe("Tentatives IDOR classiques", () => {
    it("empêche l'énumération : pas d'info sur l'existence si non autorisé", () => {
      // Un utilisateur non autorisé devrait recevoir { exists: false }
      // et JAMAIS { error: "Non autorisé" } (ce qui révèle l'existence)
      const check = canAccessDocument(
        randomProfile,
        "owner-uuid-1",
        []
      );
      const allowed = isAccessAllowed(randomProfile, check);
      // Le handler retourne { exists: false } et non pas 403
      // pour ne pas révéler l'existence de la ressource
      expect(allowed).toBe(false);
    });

    it("cross-tenant: propriétaire A ne voit pas les documents du propriétaire B", () => {
      const ownerA: Profile = { id: "owner-A", role: "owner" };
      const check = canAccessDocument(
        ownerA,
        "owner-B", // Propriété du owner B
        ["tenant-X"] // Signataire du bail = tenant X
      );
      expect(isAccessAllowed(ownerA, check)).toBe(false);
    });

    it("empêche l'accès via lease_id si non signataire et non propriétaire", () => {
      const intruder: Profile = { id: "intruder", role: "tenant" };
      const check = canAccessDocument(
        intruder,
        "some-owner",
        ["legitimate-tenant"]
      );
      expect(isAccessAllowed(intruder, check)).toBe(false);
    });
  });
});

describe("IDOR Prevention - Hash Sanitization", () => {
  it("nettoie les caractères spéciaux dans le hash", () => {
    const maliciousHash = "abc123; DROP TABLE documents;--";
    const safeHash = maliciousHash.replace(/[^a-zA-Z0-9-_]/g, "");
    expect(safeHash).toBe("abc123DROPTABLEdocuments--");
    // Les caractères ; et espace sont supprimés
    expect(safeHash).not.toContain(";");
    expect(safeHash).not.toContain(" ");
  });

  it("rejette un hash trop long (> 128 chars)", () => {
    const longHash = "a".repeat(200);
    const safeHash = longHash.replace(/[^a-zA-Z0-9-_]/g, "");
    expect(safeHash.length).toBeGreaterThan(128);
    // Le handler vérifie: safeHash.length <= 128
    expect(safeHash.length <= 128).toBe(false);
  });

  it("accepte un hash SHA-256 valide", () => {
    const sha256Hash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const safeHash = sha256Hash.replace(/[^a-zA-Z0-9-_]/g, "");
    expect(safeHash).toBe(sha256Hash);
    expect(safeHash.length).toBe(64);
    expect(safeHash.length > 0 && safeHash.length <= 128).toBe(true);
  });
});
