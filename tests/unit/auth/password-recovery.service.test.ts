import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PASSWORD_RESET_TTL_MS,
  createPasswordResetCookieToken,
  isPasswordResetRequestExpired,
  verifyPasswordResetCookieToken,
} from "@/lib/auth/password-recovery.service";

describe("password-recovery.service", () => {
  beforeEach(() => {
    process.env.PASSWORD_RESET_COOKIE_SECRET = "test-password-reset-cookie-secret-1234567890";
  });

  it("signe et vérifie un cookie de recovery valide", () => {
    const expiresAt = Date.now() + PASSWORD_RESET_TTL_MS;
    const token = createPasswordResetCookieToken({
      requestId: "request-id",
      userId: "user-id",
      expiresAt,
    });

    expect(verifyPasswordResetCookieToken(token)).toEqual({
      requestId: "request-id",
      userId: "user-id",
      expiresAt,
    });
  });

  it("rejette un cookie altéré", () => {
    const expiresAt = Date.now() + PASSWORD_RESET_TTL_MS;
    const token = createPasswordResetCookieToken({
      requestId: "request-id",
      userId: "user-id",
      expiresAt,
    });

    const tampered = `x${token.slice(1)}`;
    expect(verifyPasswordResetCookieToken(tampered)).toBeNull();
  });

  it("détecte une demande expirée", () => {
    expect(isPasswordResetRequestExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isPasswordResetRequestExpired(new Date(Date.now() + 60_000).toISOString())).toBe(false);
  });
});
