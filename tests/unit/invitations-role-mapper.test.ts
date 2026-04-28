import { describe, it, expect } from "vitest";
import {
  mapInvitationRoleToUserRole,
  getInvitationRoleLabel,
} from "@/lib/invitations/role-mapper";

describe("mapInvitationRoleToUserRole", () => {
  it("locataire_principal et colocataire mappent vers tenant", () => {
    expect(mapInvitationRoleToUserRole("locataire_principal")).toBe("tenant");
    expect(mapInvitationRoleToUserRole("colocataire")).toBe("tenant");
  });

  it("garant mappe vers guarantor", () => {
    expect(mapInvitationRoleToUserRole("garant")).toBe("guarantor");
  });
});

describe("getInvitationRoleLabel", () => {
  it("retourne le libellé UI français pour chaque rôle", () => {
    expect(getInvitationRoleLabel("locataire_principal")).toBe("Locataire principal");
    expect(getInvitationRoleLabel("colocataire")).toBe("Colocataire");
    expect(getInvitationRoleLabel("garant")).toBe("Garant");
  });
});
