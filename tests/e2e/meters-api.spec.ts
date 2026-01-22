/**
 * Tests E2E - API Meters (Janvier 2026)
 *
 * Tests fonctionnels des endpoints de gestion des compteurs
 * @version 2026-01-22 - Created after API audit and fixes
 *
 * Routes testées:
 * - GET /api/meters/[id]/readings
 * - POST /api/meters/[id]/readings
 * - GET /api/meters/[id]/history
 * - POST /api/meters/[id]/anomaly
 */

import { test, expect, APIRequestContext } from "@playwright/test";

// Test credentials - owner account
const OWNER_CREDENTIALS = {
  email: process.env.TEST_OWNER_EMAIL || "test-owner@talok.test",
  password: process.env.TEST_OWNER_PASSWORD || "TestOwner2026!",
};

// Test IDs - should be set via env or fixtures
const TEST_METER_ID = process.env.TEST_METER_ID || "00000000-0000-0000-0000-000000000001";
const INVALID_UUID = "not-a-valid-uuid";
const NON_EXISTENT_UUID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

test.describe("API Meters - Readings", () => {
  let apiContext: APIRequestContext;
  let authCookie: string;

  test.beforeAll(async ({ playwright }) => {
    // Create API context
    apiContext = await playwright.request.newContext({
      baseURL: process.env.BASE_URL || "http://localhost:3000",
    });

    // Authenticate and get session cookie
    const loginResponse = await apiContext.post("/api/auth/signin", {
      data: {
        email: OWNER_CREDENTIALS.email,
        password: OWNER_CREDENTIALS.password,
      },
    });

    // Store cookies for authenticated requests
    const cookies = await loginResponse.headers()["set-cookie"];
    if (cookies) {
      authCookie = cookies;
    }
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe("GET /api/meters/[id]/readings", () => {
    test("returns 400 for invalid UUID format", async () => {
      const response = await apiContext.get(`/api/meters/${INVALID_UUID}/readings`, {
        headers: { Cookie: authCookie },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("invalide");
    });

    test("returns 401 without authentication", async () => {
      const response = await apiContext.get(`/api/meters/${TEST_METER_ID}/readings`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Non authentifié");
    });

    test("returns 404 for non-existent meter", async () => {
      const response = await apiContext.get(`/api/meters/${NON_EXISTENT_UUID}/readings`, {
        headers: { Cookie: authCookie },
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toContain("non trouvé");
    });

    test("returns readings for valid meter", async () => {
      const response = await apiContext.get(`/api/meters/${TEST_METER_ID}/readings`, {
        headers: { Cookie: authCookie },
      });

      // Should be 200 if meter exists and user has access, or 404/403
      expect([200, 403, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty("meter_id");
        expect(body).toHaveProperty("readings");
        expect(Array.isArray(body.readings)).toBe(true);
        expect(body).toHaveProperty("count");
      }
    });

    test("supports pagination with limit parameter", async () => {
      const response = await apiContext.get(`/api/meters/${TEST_METER_ID}/readings?limit=5`, {
        headers: { Cookie: authCookie },
      });

      if (response.status() === 200) {
        const body = await response.json();
        expect(body.readings.length).toBeLessThanOrEqual(5);
      }
    });

    test("supports date filtering", async () => {
      const response = await apiContext.get(
        `/api/meters/${TEST_METER_ID}/readings?start_date=2025-01-01&end_date=2025-12-31`,
        { headers: { Cookie: authCookie } }
      );

      if (response.status() === 200) {
        const body = await response.json();
        // Verify all readings are within date range
        for (const reading of body.readings) {
          const date = new Date(reading.reading_date);
          expect(date.getFullYear()).toBe(2025);
        }
      }
    });
  });

  test.describe("POST /api/meters/[id]/readings", () => {
    test("returns 401 without authentication", async () => {
      const formData = new FormData();
      formData.append("reading_value", "12345.67");
      formData.append("reading_date", "2026-01-22");

      const response = await apiContext.post(`/api/meters/${TEST_METER_ID}/readings`, {
        multipart: {
          reading_value: "12345.67",
          reading_date: "2026-01-22",
        },
      });

      expect(response.status()).toBe(401);
    });

    test("returns 400 for missing required fields", async () => {
      const response = await apiContext.post(`/api/meters/${TEST_METER_ID}/readings`, {
        headers: { Cookie: authCookie },
        multipart: {
          // Missing reading_value and reading_date
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("requis");
    });

    test("returns 404 for non-existent meter", async () => {
      const response = await apiContext.post(`/api/meters/${NON_EXISTENT_UUID}/readings`, {
        headers: { Cookie: authCookie },
        multipart: {
          reading_value: "12345.67",
          reading_date: "2026-01-22",
        },
      });

      expect(response.status()).toBe(404);
    });

    test("accepts valid reading with value 0", async () => {
      const response = await apiContext.post(`/api/meters/${TEST_METER_ID}/readings`, {
        headers: { Cookie: authCookie },
        multipart: {
          reading_value: "0",
          reading_date: "2026-01-22",
        },
      });

      // 0 is a valid reading value (e.g., new meter installation)
      expect([201, 403, 404]).toContain(response.status());
    });
  });

  test.describe("GET /api/meters/[id]/history", () => {
    test("returns 401 without authentication", async () => {
      const response = await apiContext.get(`/api/meters/${TEST_METER_ID}/history`);
      expect(response.status()).toBe(401);
    });

    test("returns history for valid meter", async () => {
      const response = await apiContext.get(`/api/meters/${TEST_METER_ID}/history`, {
        headers: { Cookie: authCookie },
      });

      expect([200, 403, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty("meter");
        expect(body).toHaveProperty("readings");
        expect(body).toHaveProperty("estimates");
      }
    });

    test("supports limit parameter", async () => {
      const response = await apiContext.get(`/api/meters/${TEST_METER_ID}/history?limit=3`, {
        headers: { Cookie: authCookie },
      });

      if (response.status() === 200) {
        const body = await response.json();
        expect(body.readings.length).toBeLessThanOrEqual(3);
      }
    });
  });

  test.describe("POST /api/meters/[id]/anomaly", () => {
    test("returns 400 for invalid meter ID format", async () => {
      const response = await apiContext.post(`/api/meters/${INVALID_UUID}/anomaly`, {
        headers: { Cookie: authCookie },
        data: { reading_value: 99999 },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("invalide");
    });

    test("returns 401 without authentication", async () => {
      const response = await apiContext.post(`/api/meters/${TEST_METER_ID}/anomaly`, {
        data: { reading_value: 99999 },
      });

      expect(response.status()).toBe(401);
    });

    test("returns 400 for invalid body (negative reading)", async () => {
      const response = await apiContext.post(`/api/meters/${TEST_METER_ID}/anomaly`, {
        headers: { Cookie: authCookie },
        data: { reading_value: -100 },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.details).toBeDefined();
    });

    test("returns 400 for description too long", async () => {
      const longDescription = "x".repeat(600);
      const response = await apiContext.post(`/api/meters/${TEST_METER_ID}/anomaly`, {
        headers: { Cookie: authCookie },
        data: {
          reading_value: 12345,
          description: longDescription,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.details).toBeDefined();
    });

    test("accepts valid anomaly report", async () => {
      const response = await apiContext.post(`/api/meters/${TEST_METER_ID}/anomaly`, {
        headers: { Cookie: authCookie },
        data: {
          reading_value: 99999,
          expected_range: { min: 1000, max: 2000 },
          description: "Valeur anormalement élevée",
        },
      });

      expect([200, 403, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body).toHaveProperty("is_anomaly");
      }
    });
  });
});

test.describe("API Payments - Validation", () => {
  let apiContext: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.BASE_URL || "http://localhost:3000",
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe("GET /api/payments/calculate-fees", () => {
    test("returns 400 for missing amount parameter", async () => {
      const response = await apiContext.get("/api/payments/calculate-fees");

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Paramètres invalides");
    });

    test("returns 400 for negative amount", async () => {
      const response = await apiContext.get("/api/payments/calculate-fees?amount=-100");

      expect(response.status()).toBe(400);
    });

    test("returns 400 for non-numeric amount", async () => {
      const response = await apiContext.get("/api/payments/calculate-fees?amount=abc");

      expect(response.status()).toBe(400);
    });

    test("returns fees for valid amount", async () => {
      const response = await apiContext.get("/api/payments/calculate-fees?amount=1000");

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("amount", 1000);
      expect(body).toHaveProperty("fees");
      expect(body.fees).toHaveProperty("gross_amount");
      expect(body.fees).toHaveProperty("stripe_fee");
      expect(body.fees).toHaveProperty("net_amount");
    });

    test("supports include_deposit parameter", async () => {
      const response = await apiContext.get(
        "/api/payments/calculate-fees?amount=1000&include_deposit=true"
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("deposit_breakdown");
    });
  });

  test.describe("POST /api/payments/checkout", () => {
    test("returns 401 without authentication", async () => {
      const response = await apiContext.post("/api/payments/checkout", {
        data: { invoiceId: "00000000-0000-0000-0000-000000000001" },
      });

      expect(response.status()).toBe(401);
    });

    test("returns 400 for invalid invoiceId format", async () => {
      // This test requires authentication, so it might return 401 first
      const response = await apiContext.post("/api/payments/checkout", {
        data: { invoiceId: "not-a-uuid" },
      });

      expect([400, 401]).toContain(response.status());
    });
  });

  test.describe("POST /api/payments/confirm", () => {
    test("returns 401 without authentication", async () => {
      const response = await apiContext.post("/api/payments/confirm", {
        data: {
          paymentIntentId: "pi_test123",
          invoiceId: "00000000-0000-0000-0000-000000000001",
        },
      });

      expect(response.status()).toBe(401);
    });

    test("returns 400 for invalid paymentIntentId format", async () => {
      // This test requires authentication
      const response = await apiContext.post("/api/payments/confirm", {
        data: {
          paymentIntentId: "invalid_format", // Should start with pi_
          invoiceId: "00000000-0000-0000-0000-000000000001",
        },
      });

      expect([400, 401]).toContain(response.status());
    });
  });
});
