import { describe, it, expect } from "vitest";
import {
  isIdentityVerified,
  isIdentityValidForSignature,
  isCniExpiredOrExpiringSoon,
} from "@/lib/helpers/identity-check";

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

describe("isIdentityValidForSignature", () => {
  it("retourne false si le profil est null", () => {
    expect(isIdentityValidForSignature(null)).toBe(false);
  });

  it("retourne false si identité non vérifiée même avec date valide", () => {
    expect(
      isIdentityValidForSignature({
        kyc_status: "pending",
        cni_number: null,
        cni_expiry_date: "2030-12-31",
      })
    ).toBe(false);
  });

  it("retourne true si identité vérifiée et requireNotExpired false", () => {
    expect(
      isIdentityValidForSignature(
        { kyc_status: "verified", cni_expiry_date: null },
        { requireNotExpired: false }
      )
    ).toBe(true);
  });

  it("retourne false si identité vérifiée mais cni_expiry_date manquant et requireNotExpired true", () => {
    expect(
      isIdentityValidForSignature(
        { kyc_status: "verified", cni_expiry_date: null },
        { requireNotExpired: true }
      )
    ).toBe(false);
    expect(
      isIdentityValidForSignature(
        { kyc_status: "verified", cni_expiry_date: "" },
        { requireNotExpired: true }
      )
    ).toBe(false);
  });

  it("retourne true si identité vérifiée et date expiration dans le futur", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(
      isIdentityValidForSignature({
        kyc_status: "verified",
        cni_expiry_date: future.toISOString().slice(0, 10),
      })
    ).toBe(true);
  });

  it("retourne false si identité vérifiée mais CNI expirée", () => {
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    expect(
      isIdentityValidForSignature({
        kyc_status: "verified",
        cni_expiry_date: past.toISOString().slice(0, 10),
      })
    ).toBe(false);
  });

  it("retourne false si identité vérifiée mais date expiration aujourd'hui (grace 0)", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(
      isIdentityValidForSignature(
        { kyc_status: "verified", cni_expiry_date: today },
        { expiryGraceDays: 0 }
      )
    ).toBe(false);
  });

  it("respecte expiryGraceDays : refus si expire dans moins de X jours", () => {
    const in20Days = new Date();
    in20Days.setDate(in20Days.getDate() + 20);
    const dateStr = in20Days.toISOString().slice(0, 10);
    expect(
      isIdentityValidForSignature(
        { kyc_status: "verified", cni_expiry_date: dateStr },
        { requireNotExpired: true, expiryGraceDays: 30 }
      )
    ).toBe(false);
    const in40Days = new Date();
    in40Days.setDate(in40Days.getDate() + 40);
    const dateStr40 = in40Days.toISOString().slice(0, 10);
    expect(
      isIdentityValidForSignature(
        { kyc_status: "verified", cni_expiry_date: dateStr40 },
        { requireNotExpired: true, expiryGraceDays: 30 }
      )
    ).toBe(true);
  });
});

describe("isCniExpiredOrExpiringSoon", () => {
  it("retourne false si profil null ou sans cni_expiry_date", () => {
    expect(isCniExpiredOrExpiringSoon(null)).toBe(false);
    expect(isCniExpiredOrExpiringSoon({})).toBe(false);
    expect(isCniExpiredOrExpiringSoon({ cni_expiry_date: null })).toBe(false);
    expect(isCniExpiredOrExpiringSoon({ cni_expiry_date: "" })).toBe(false);
  });

  it("retourne true si date expiration dans le passé", () => {
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    expect(
      isCniExpiredOrExpiringSoon({
        cni_expiry_date: past.toISOString().slice(0, 10),
      })
    ).toBe(true);
  });

  it("retourne false si date expiration loin dans le futur", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 2);
    expect(
      isCniExpiredOrExpiringSoon({
        cni_expiry_date: future.toISOString().slice(0, 10),
      })
    ).toBe(false);
  });
});
