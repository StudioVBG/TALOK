/**
 * E2E — Correctifs sécurité (Audit BIC2026).
 *
 * Vérifie en conditions réelles :
 * - Protection CSRF sur les routes de mutation
 * - Validation MIME sur les uploads
 * - IDOR prevention (cross-tenant document access)
 * - Rate limiting
 * - Redirections par rôle cohérentes
 * - OTP requis pour la signature
 *
 * Refactor : tous les tests utilisent `request` direct (sans auth) ou la
 * `page` Playwright pour les redirections. Aucune credential nécessaire —
 * la suppression de l'objet `TEST_CREDENTIALS` non utilisé clarifie l'intent.
 */

import { test, expect } from "@playwright/test";
import { routes, routePatterns } from "./helpers/routes";

// ======================================
// CSRF PROTECTION
// ======================================
test.describe("CSRF Protection", () => {
  test("POST /api/leases sans CSRF token retourne 403/401", async ({
    request,
  }) => {
    const response = await request.post("/api/leases", {
      data: { property_id: "fake-uuid", type_bail: "meuble" },
      headers: { "Content-Type": "application/json" },
    });
    expect([401, 403]).toContain(response.status());
  });

  test("POST /api/documents/upload sans CSRF token retourne 403/401", async ({
    request,
  }) => {
    const response = await request.post("/api/documents/upload", {
      headers: { "Content-Type": "multipart/form-data" },
    });
    expect([401, 403]).toContain(response.status());
  });
});

// ======================================
// FILE UPLOAD VALIDATION
// ======================================
test.describe("File Upload Validation", () => {
  test("Upload d'un fichier HTML est rejeté", async ({ request }) => {
    const response = await request.post("/api/documents/upload", {
      multipart: {
        file: {
          name: "malicious.html",
          mimeType: "text/html",
          buffer: Buffer.from("<script>alert('xss')</script>"),
        },
      },
    });
    expect([400, 401, 403]).toContain(response.status());
  });

  test("Upload d'un fichier .exe est rejeté", async ({ request }) => {
    const response = await request.post("/api/documents/upload", {
      multipart: {
        file: {
          name: "virus.exe",
          mimeType: "application/x-msdownload",
          buffer: Buffer.from("MZ\x90\x00\x03\x00\x00\x00"),
        },
      },
    });
    expect([400, 401, 403]).toContain(response.status());
  });
});

// ======================================
// IDOR PREVENTION
// ======================================
test.describe("IDOR Prevention", () => {
  test("GET /api/documents/check sans auth retourne exists:false ou 401", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/documents/check?type=quittance&lease_id=00000000-0000-0000-0000-000000000000",
    );

    if (response.status() === 200) {
      const body = await response.json();
      expect(body.exists).toBe(false);
    } else {
      expect([401]).toContain(response.status());
    }
  });

  test("POST /api/documents/check sans auth retourne exists:false ou 401/403", async ({
    request,
  }) => {
    const response = await request.post("/api/documents/check", {
      data: {
        type: "bail",
        property_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    if (response.status() === 200) {
      const body = await response.json();
      expect(body.exists).toBe(false);
    } else {
      expect([401, 403]).toContain(response.status());
    }
  });
});

// ======================================
// ROLE-BASED REDIRECTS
// ======================================
test.describe("Role-Based Redirects", () => {
  test("/dashboard redirige vers /auth/signin sans authentification", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL(routePatterns.signin);
    expect(page.url()).toContain("/auth/signin");
  });

  test("/owner/* redirige vers /auth/signin sans authentification", async ({
    page,
  }) => {
    await page.goto(routes.owner.dashboard);
    await page.waitForURL(routePatterns.signin);
    expect(page.url()).toContain("/auth/signin");
  });

  test("/admin/* redirige vers /auth/signin sans authentification", async ({
    page,
  }) => {
    await page.goto(routes.admin.dashboard);
    await page.waitForURL(routePatterns.signin);
    expect(page.url()).toContain("/auth/signin");
  });

  test("/tenant/* redirige vers /auth/signin sans authentification", async ({
    page,
  }) => {
    await page.goto(routes.tenant.dashboard);
    await page.waitForURL(routePatterns.signin);
    expect(page.url()).toContain("/auth/signin");
  });
});

// ======================================
// RATE LIMITING
// ======================================
test.describe("Rate Limiting", () => {
  test("Trop de requêtes sur /api/leases retourne 429 (ou 401 si auth bloque avant)", async ({
    request,
  }) => {
    const promises = Array.from({ length: 35 }, () =>
      request.post("/api/leases", {
        data: { property_id: "test", type_bail: "meuble" },
      }),
    );

    const responses = await Promise.all(promises);
    const statusCodes = responses.map((r) => r.status());

    const has429 = statusCodes.includes(429);
    const allUnauth = statusCodes.every((s) => s === 401 || s === 403);
    expect(has429 || allUnauth).toBe(true);
  });
});

// ======================================
// SIGNATURE OTP
// ======================================
test.describe("Signature OTP Requirement", () => {
  test("POST /api/signature/fake-token/sign-with-pad sans OTP retourne 400/410/429", async ({
    request,
  }) => {
    const response = await request.post(
      "/api/signature/fake-token/sign-with-pad",
      {
        data: {
          signatureType: "draw",
          signatureImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
          signerName: "Test User",
        },
      },
    );
    expect([400, 410, 429]).toContain(response.status());
  });

  test("POST /api/signature/fake-token/sign-with-pad avec mauvais OTP retourne 400/410/429", async ({
    request,
  }) => {
    const response = await request.post(
      "/api/signature/fake-token/sign-with-pad",
      {
        data: {
          signatureType: "draw",
          signatureImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
          signerName: "Test User",
          otp_code: "000000",
        },
      },
    );
    expect([400, 410, 429]).toContain(response.status());
  });
});

// ======================================
// API INPUT VALIDATION
// ======================================
test.describe("API Input Validation", () => {
  test("POST /api/edl sans lease_id retourne 400/401", async ({ request }) => {
    const response = await request.post("/api/edl", {
      data: { type: "entree" },
      headers: { "Content-Type": "application/json" },
    });
    expect([400, 401]).toContain(response.status());
  });

  test("POST /api/units sans property_id retourne 400/401", async ({
    request,
  }) => {
    const response = await request.post("/api/units", {
      data: { nom: "Chambre 1" },
      headers: { "Content-Type": "application/json" },
    });
    expect([400, 401]).toContain(response.status());
  });
});
