import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RateLimitResult } from "@/lib/rate-limit/upstash";

// Mock le module upstash sous-jacent.
vi.mock("@/lib/rate-limit/upstash", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit/upstash")>(
    "@/lib/rate-limit/upstash"
  );
  return {
    ...actual,
    applyRateLimit: vi.fn(),
    extractClientIp: vi.fn(() => "1.2.3.4"),
  };
});

import { applyRateLimit } from "@/lib/rate-limit/upstash";
import { checkGooglePlacesQuota } from "@/lib/rate-limit/google-places";

const mockedApply = vi.mocked(applyRateLimit);

const allowedResult: RateLimitResult = {
  allowed: true,
  remaining: 10,
  resetAt: Math.floor(Date.now() / 1000) + 3600,
  retryAfterSec: null,
};

const blockedResult: RateLimitResult = {
  allowed: false,
  remaining: 0,
  resetAt: Math.floor(Date.now() / 1000) + 3600,
  retryAfterSec: 1234,
};

function buildRequest(): Request {
  return new Request("https://talok.fr/api/test", {
    headers: { "x-forwarded-for": "1.2.3.4" },
  });
}

describe("checkGooglePlacesQuota", () => {
  beforeEach(() => {
    mockedApply.mockReset();
  });

  it("applique 3 limites pour un user authentifie : user_hour, user_day, ip_hour", async () => {
    mockedApply.mockResolvedValue(allowedResult);

    const result = await checkGooglePlacesQuota({
      scope: "nearby",
      userId: "user-uuid-123",
      request: buildRequest(),
    });

    expect(result.allowed).toBe(true);
    expect(mockedApply).toHaveBeenCalledTimes(3);

    // Verifier les cles utilisees (granularite scope:user|ip)
    const calls = mockedApply.mock.calls.map((c) => c[0]);
    expect(calls[0].key).toContain("gplaces:nearby:user:user-uuid-123:h");
    expect(calls[1].key).toContain("gplaces:nearby:user:user-uuid-123:d");
    expect(calls[2].key).toContain("gplaces:nearby:ip:1.2.3.4:h");
  });

  it("n'applique que la limite IP pour un appel anonyme (userId null)", async () => {
    mockedApply.mockResolvedValue(allowedResult);

    const result = await checkGooglePlacesQuota({
      scope: "geocode",
      userId: null,
      request: buildRequest(),
    });

    expect(result.allowed).toBe(true);
    expect(mockedApply).toHaveBeenCalledTimes(1);
    expect(mockedApply.mock.calls[0][0].key).toContain("gplaces:geocode:ip:1.2.3.4:h");
  });

  it("court-circuite et retourne le hit de la premiere limite atteinte", async () => {
    // user_hour bloque, user_day et ip_hour ne devraient JAMAIS etre appeles.
    mockedApply.mockResolvedValueOnce(blockedResult);

    const result = await checkGooglePlacesQuota({
      scope: "nearby",
      userId: "user-uuid-123",
      request: buildRequest(),
    });

    expect(result.allowed).toBe(false);
    expect(result.hit?.dimension).toBe("user_hour");
    expect(mockedApply).toHaveBeenCalledTimes(1); // pas de 2eme/3eme appel

    // Headers HTTP standards remplis
    expect(result.headers["Retry-After"]).toBe("1234");
    expect(result.headers["X-RateLimit-Remaining"]).toBe("0");
  });

  it("isole les compteurs par scope (nearby vs geocode vs place_details)", async () => {
    mockedApply.mockResolvedValue(allowedResult);
    const req = buildRequest();

    await checkGooglePlacesQuota({ scope: "nearby", userId: "u1", request: req });
    await checkGooglePlacesQuota({ scope: "geocode", userId: "u1", request: req });
    await checkGooglePlacesQuota({ scope: "place_details", userId: "u1", request: req });

    const keys = mockedApply.mock.calls.map((c) => c[0].key);
    expect(keys.some((k) => k.startsWith("gplaces:nearby:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("gplaces:geocode:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("gplaces:place_details:"))).toBe(true);
  });

  it("isole les compteurs par utilisateur", async () => {
    mockedApply.mockResolvedValue(allowedResult);

    await checkGooglePlacesQuota({ scope: "nearby", userId: "alice", request: buildRequest() });
    await checkGooglePlacesQuota({ scope: "nearby", userId: "bob", request: buildRequest() });

    const userKeys = mockedApply.mock.calls
      .map((c) => c[0].key)
      .filter((k) => k.includes(":user:"));
    expect(userKeys.some((k) => k.includes(":user:alice:"))).toBe(true);
    expect(userKeys.some((k) => k.includes(":user:bob:"))).toBe(true);
  });
});
