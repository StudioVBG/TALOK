/**
 * Tests unitaires - Redirections par rôle
 *
 * Vérifie que getRoleDashboardUrl() retourne la bonne URL pour chaque rôle.
 * Source de vérité unique utilisée par tous les layouts.
 */

import { describe, it, expect } from "vitest";
import {
  getRoleDashboardUrl,
  getRedirectIfUnauthorized,
  COPRO_ROLES,
  ADMIN_ROLES,
  SYNDIC_ROLES,
} from "@/lib/helpers/role-redirects";

describe("getRoleDashboardUrl", () => {
  it("redirige les owners vers /owner/dashboard", () => {
    expect(getRoleDashboardUrl("owner")).toBe("/owner/dashboard");
  });

  it("redirige les tenants vers /tenant/dashboard", () => {
    expect(getRoleDashboardUrl("tenant")).toBe("/tenant/dashboard");
  });

  it("redirige les admins vers /admin/dashboard", () => {
    expect(getRoleDashboardUrl("admin")).toBe("/admin/dashboard");
  });

  it("redirige les platform_admin vers /admin/dashboard", () => {
    expect(getRoleDashboardUrl("platform_admin")).toBe("/admin/dashboard");
  });

  it("redirige les providers vers /provider/dashboard", () => {
    expect(getRoleDashboardUrl("provider")).toBe("/provider/dashboard");
  });

  it("redirige les syndics vers /syndic/dashboard", () => {
    expect(getRoleDashboardUrl("syndic")).toBe("/syndic/dashboard");
  });

  it("redirige les guarantors vers /guarantor/dashboard", () => {
    expect(getRoleDashboardUrl("guarantor")).toBe("/guarantor/dashboard");
  });

  it("redirige les copropriétaires vers /copro/dashboard", () => {
    const coproRoles = [
      "coproprietaire",
      "coproprietaire_occupant",
      "coproprietaire_bailleur",
      "coproprietaire_nu",
      "usufruitier",
      "president_cs",
      "conseil_syndical",
    ];

    for (const role of coproRoles) {
      expect(getRoleDashboardUrl(role)).toBe("/copro/dashboard");
    }
  });

  it("redirige un rôle null vers /auth/signin", () => {
    expect(getRoleDashboardUrl(null)).toBe("/auth/signin");
  });

  it("redirige un rôle undefined vers /auth/signin", () => {
    expect(getRoleDashboardUrl(undefined)).toBe("/auth/signin");
  });

  it("redirige un rôle inconnu vers /", () => {
    expect(getRoleDashboardUrl("unknown_role")).toBe("/");
  });
});

describe("getRedirectIfUnauthorized", () => {
  it("retourne null si le rôle est autorisé", () => {
    expect(getRedirectIfUnauthorized("owner", ["owner", "admin"])).toBeNull();
    expect(getRedirectIfUnauthorized("admin", ["owner", "admin"])).toBeNull();
  });

  it("redirige un rôle non autorisé vers son dashboard", () => {
    expect(getRedirectIfUnauthorized("tenant", ["owner"])).toBe("/tenant/dashboard");
    expect(getRedirectIfUnauthorized("provider", ["owner", "admin"])).toBe("/provider/dashboard");
  });

  it("redirige null vers /auth/signin", () => {
    expect(getRedirectIfUnauthorized(null, ["owner"])).toBe("/auth/signin");
  });
});

describe("Role constants", () => {
  it("ADMIN_ROLES contient admin et platform_admin", () => {
    expect(ADMIN_ROLES).toContain("admin");
    expect(ADMIN_ROLES).toContain("platform_admin");
  });

  it("SYNDIC_ROLES contient syndic et admins", () => {
    expect(SYNDIC_ROLES).toContain("syndic");
    expect(SYNDIC_ROLES).toContain("admin");
    expect(SYNDIC_ROLES).toContain("platform_admin");
  });

  it("COPRO_ROLES contient tous les sous-rôles copro", () => {
    expect(COPRO_ROLES).toContain("coproprietaire");
    expect(COPRO_ROLES).toContain("president_cs");
    expect(COPRO_ROLES).toContain("syndic");
  });
});
