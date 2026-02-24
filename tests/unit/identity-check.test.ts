import { describe, it, expect } from "vitest";
import { isIdentityVerified } from "@/lib/helpers/identity-check";

describe("isIdentityVerified", () => {
  it("retourne false si le profil est null", () => {
    expect(isIdentityVerified(null)).toBe(false);
  });

  it("retourne true si kyc_status est verified", () => {
    expect(isIdentityVerified({ kyc_status: "verified" })).toBe(true);
  });

  it("retourne true si cni_verified_at et cni_number sont renseignés", () => {
    expect(
      isIdentityVerified({
        cni_verified_at: "2026-01-01T00:00:00Z",
        cni_number: "123456789",
      })
    ).toBe(true);
  });

  it("retourne false si cni_verified_at est présent mais cni_number vide", () => {
    expect(
      isIdentityVerified({
        cni_verified_at: "2026-01-01T00:00:00Z",
        cni_number: "",
      })
    ).toBe(false);
    expect(
      isIdentityVerified({
        cni_verified_at: "2026-01-01T00:00:00Z",
        cni_number: null,
      })
    ).toBe(false);
  });

  it("retourne false si kyc_status est pending", () => {
    expect(isIdentityVerified({ kyc_status: "pending" })).toBe(false);
  });

  it("retourne false si tous les champs sont vides", () => {
    expect(isIdentityVerified({})).toBe(false);
  });
});
