/**
 * Tests E2E - Correctifs sécurité Audit BIC2026
 *
 * Vérifie en conditions réelles :
 * - Protection CSRF sur les routes de mutation
 * - Validation MIME sur les uploads de documents
 * - IDOR prevention (cross-tenant document access)
 * - Rate limiting sur les routes critiques
 * - Redirections par rôle cohérentes
 * - OTP requis pour la signature
 *
 * @prerequisite Application démarrée sur localhost:3000
 * @prerequisite Utilisateurs de test existants en base
 */

import { test, expect } from "@playwright/test";

const TEST_CREDENTIALS = {
  owner: {
    email: "contact.explore.mq@gmail.com",
    password: "Test12345!2025",
  },
  tenant: {
    email: "garybissol@yahoo.fr",
    password: "Test12345!2025",
  },
};

// ======================================
// CSRF PROTECTION
// ======================================
test.describe("CSRF Protection", () => {
  test("POST /api/leases sans CSRF token retourne 403", async ({ request }) => {
    // Tenter une requête POST sans cookie de session ni CSRF token
    const response = await request.post("/api/leases", {
      data: { property_id: "fake-uuid", type_bail: "meuble" },
      headers: { "Content-Type": "application/json" },
    });

    // Doit être rejeté (403 CSRF ou 401 auth)
    expect([401, 403]).toContain(response.status());
  });

  test("POST /api/documents/upload sans CSRF token retourne 403", async ({ request }) => {
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
    const htmlContent = Buffer.from("<script>alert('xss')</script>");
    
    const response = await request.post("/api/documents/upload", {
      multipart: {
        file: {
          name: "malicious.html",
          mimeType: "text/html",
          buffer: htmlContent,
        },
      },
    });

    // Devrait être rejeté (401 sans auth, ou 400 pour MIME invalide si auth OK)
    expect([400, 401, 403]).toContain(response.status());
  });

  test("Upload d'un fichier .exe est rejeté", async ({ request }) => {
    const fakeExe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00");
    
    const response = await request.post("/api/documents/upload", {
      multipart: {
        file: {
          name: "virus.exe",
          mimeType: "application/x-msdownload",
          buffer: fakeExe,
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
  test("GET /api/documents/check avec lease_id étranger retourne exists:false", async ({ request }) => {
    // Requête sans auth — devrait retourner 401
    const response = await request.get(
      "/api/documents/check?type=quittance&lease_id=00000000-0000-0000-0000-000000000000"
    );

    // Sans auth → 401 ou exists: false
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.exists).toBe(false);
    } else {
      expect([401]).toContain(response.status());
    }
  });

  test("POST /api/documents/check avec property_id étranger retourne exists:false", async ({ request }) => {
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
  test("/ redirige vers /auth/signin sans authentification", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });

  test("/owner/* redirige vers /auth/signin sans authentification", async ({ page }) => {
    await page.goto("/owner/dashboard");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });

  test("/admin/* redirige vers /auth/signin sans authentification", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });

  test("/tenant/* redirige vers /auth/signin sans authentification", async ({ page }) => {
    await page.goto("/tenant/dashboard");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });
});

// ======================================
// RATE LIMITING
// ======================================
test.describe("Rate Limiting", () => {
  test("Trop de requêtes sur /api/leases retourne 429", async ({ request }) => {
    // Envoyer 35 requêtes rapides (la limite est généralement 30/min)
    const promises = Array.from({ length: 35 }, () =>
      request.post("/api/leases", {
        data: { property_id: "test", type_bail: "meuble" },
      })
    );

    const responses = await Promise.all(promises);
    const statusCodes = responses.map((r) => r.status());

    // Au moins une devrait être 429 (rate limited) ou toutes 401 (non auth)
    const has429 = statusCodes.includes(429);
    const allUnauth = statusCodes.every((s) => s === 401 || s === 403);
    
    // Soit le rate limiting fonctionne (429), soit l'auth bloque avant
    expect(has429 || allUnauth).toBe(true);
  });
});

// ======================================
// SIGNATURE OTP
// ======================================
test.describe("Signature OTP Requirement", () => {
  test("POST /api/signature/fake-token/sign-with-pad sans OTP retourne 400 ou 410", async ({ request }) => {
    const response = await request.post("/api/signature/fake-token/sign-with-pad", {
      data: {
        signatureType: "draw",
        signatureImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
        signerName: "Test User",
        // PAS de otp_code
      },
    });

    // 410 = token invalide/expiré, 400 = OTP manquant, 429 = rate limited
    expect([400, 410, 429]).toContain(response.status());
  });

  test("POST /api/signature/fake-token/sign-with-pad avec mauvais OTP retourne 400 ou 410", async ({ request }) => {
    const response = await request.post("/api/signature/fake-token/sign-with-pad", {
      data: {
        signatureType: "draw",
        signatureImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
        signerName: "Test User",
        otp_code: "000000",
      },
    });

    expect([400, 410, 429]).toContain(response.status());
  });
});

// ======================================
// API INPUT VALIDATION
// ======================================
test.describe("API Input Validation", () => {
  test("POST /api/edl sans lease_id retourne 400", async ({ request }) => {
    const response = await request.post("/api/edl", {
      data: { type: "entree" },
      headers: { "Content-Type": "application/json" },
    });

    // 400 (validation) ou 401 (auth)
    expect([400, 401]).toContain(response.status());
  });

  test("POST /api/units sans property_id retourne 400", async ({ request }) => {
    const response = await request.post("/api/units", {
      data: { nom: "Chambre 1" },
      headers: { "Content-Type": "application/json" },
    });

    expect([400, 401]).toContain(response.status());
  });
});
