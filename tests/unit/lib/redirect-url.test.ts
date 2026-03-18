import { describe, expect, it } from "vitest";
import {
  getAuthCallbackUrl,
  getBaseUrl,
  getPasswordRecoveryCallbackUrl,
  getResetPasswordUrl,
} from "@/lib/utils/redirect-url";

describe("redirect-url helpers", () => {
  it("normalise une base configurée par erreur avec /auth", () => {
    expect(getBaseUrl("https://talok.fr/auth")).toBe("https://talok.fr");
    expect(getBaseUrl("https://talok.fr/auth/")).toBe("https://talok.fr");
  });

  it("construit un callback auth propre sans doubler /auth", () => {
    expect(getAuthCallbackUrl("https://talok.fr/auth")).toBe(
      "https://talok.fr/auth/callback"
    );
  });

  it("construit le callback de recovery attendu", () => {
    expect(getPasswordRecoveryCallbackUrl("https://talok.fr/auth", "request-id-123")).toBe(
      "https://talok.fr/auth/callback?flow=pw-reset&rid=request-id-123"
    );
  });

  it("construit la page finale de reset attendue", () => {
    expect(getResetPasswordUrl("talok.fr/auth")).toBe(
      "https://talok.fr/auth/reset-password"
    );
  });
});
