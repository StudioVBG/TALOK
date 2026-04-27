/**
 * E2E — API Meters & Payments (validation, auth, anomalies).
 *
 * Refactor : credentials/auth via la fixture `ownerRequest` (APIRequestContext
 * pré-authentifié grâce au storage state). L'ancienne tentative
 * `POST /api/auth/signin` n'existe pas dans Talok (auth Supabase via formulaire).
 *
 * Les tests sans auth utilisent `request` direct.
 */

import { test, expect } from "./fixtures/auth";
import { test as rawTest, expect as rawExpect } from "@playwright/test";

const TEST_METER_ID =
  process.env.E2E_METER_ID || "00000000-0000-0000-0000-000000000001";
const INVALID_UUID = "not-a-valid-uuid";
const NON_EXISTENT_UUID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

// ============================================
// GET /api/meters/[id]/readings
// ============================================
test.describe("API Meters — Readings (GET)", () => {
  test("returns 400 for invalid UUID format", async ({ ownerRequest }) => {
    const response = await ownerRequest.get(
      `/api/meters/${INVALID_UUID}/readings`,
    );
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("invalide");
  });

  rawTest("returns 401 without authentication", async ({ request }) => {
    const response = await request.get(
      `/api/meters/${TEST_METER_ID}/readings`,
    );
    rawExpect(response.status()).toBe(401);
    const body = await response.json();
    rawExpect(body.error).toBe("Non authentifié");
  });

  test("returns 404 for non-existent meter", async ({ ownerRequest }) => {
    const response = await ownerRequest.get(
      `/api/meters/${NON_EXISTENT_UUID}/readings`,
    );
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("non trouvé");
  });

  test("returns readings for valid meter", async ({ ownerRequest }) => {
    const response = await ownerRequest.get(
      `/api/meters/${TEST_METER_ID}/readings`,
    );
    expect([200, 403, 404]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty("meter_id");
      expect(body).toHaveProperty("readings");
      expect(Array.isArray(body.readings)).toBe(true);
      expect(body).toHaveProperty("count");
    }
  });

  test("supports pagination with limit parameter", async ({ ownerRequest }) => {
    const response = await ownerRequest.get(
      `/api/meters/${TEST_METER_ID}/readings?limit=5`,
    );

    if (response.status() === 200) {
      const body = await response.json();
      expect(body.readings.length).toBeLessThanOrEqual(5);
    }
  });

  test("supports date filtering", async ({ ownerRequest }) => {
    const response = await ownerRequest.get(
      `/api/meters/${TEST_METER_ID}/readings?start_date=2025-01-01&end_date=2025-12-31`,
    );

    if (response.status() === 200) {
      const body = await response.json();
      for (const reading of body.readings) {
        const date = new Date(reading.reading_date);
        expect(date.getFullYear()).toBe(2025);
      }
    }
  });
});

// ============================================
// POST /api/meters/[id]/readings
// ============================================
test.describe("API Meters — Readings (POST)", () => {
  rawTest("returns 401 without authentication", async ({ request }) => {
    const response = await request.post(
      `/api/meters/${TEST_METER_ID}/readings`,
      {
        multipart: {
          reading_value: "12345.67",
          reading_date: "2026-01-22",
        },
      },
    );
    rawExpect(response.status()).toBe(401);
  });

  test("returns 400 for missing required fields", async ({ ownerRequest }) => {
    const response = await ownerRequest.post(
      `/api/meters/${TEST_METER_ID}/readings`,
      { multipart: {} },
    );
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("requis");
  });

  test("returns 404 for non-existent meter", async ({ ownerRequest }) => {
    const response = await ownerRequest.post(
      `/api/meters/${NON_EXISTENT_UUID}/readings`,
      {
        multipart: {
          reading_value: "12345.67",
          reading_date: "2026-01-22",
        },
      },
    );
    expect(response.status()).toBe(404);
  });

  test("accepts valid reading with value 0", async ({ ownerRequest }) => {
    const response = await ownerRequest.post(
      `/api/meters/${TEST_METER_ID}/readings`,
      {
        multipart: {
          reading_value: "0",
          reading_date: "2026-01-22",
        },
      },
    );
    expect([201, 403, 404]).toContain(response.status());
  });
});

// ============================================
// GET /api/meters/[id]/history
// ============================================
test.describe("API Meters — History", () => {
  rawTest("returns 401 without authentication", async ({ request }) => {
    const response = await request.get(
      `/api/meters/${TEST_METER_ID}/history`,
    );
    rawExpect(response.status()).toBe(401);
  });

  test("returns history for valid meter", async ({ ownerRequest }) => {
    const response = await ownerRequest.get(
      `/api/meters/${TEST_METER_ID}/history`,
    );
    expect([200, 403, 404]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty("meter");
      expect(body).toHaveProperty("readings");
      expect(body).toHaveProperty("estimates");
    }
  });

  test("supports limit parameter", async ({ ownerRequest }) => {
    const response = await ownerRequest.get(
      `/api/meters/${TEST_METER_ID}/history?limit=3`,
    );
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.readings.length).toBeLessThanOrEqual(3);
    }
  });
});

// ============================================
// POST /api/meters/[id]/anomaly
// ============================================
test.describe("API Meters — Anomaly", () => {
  test("returns 400 for invalid meter ID format", async ({ ownerRequest }) => {
    const response = await ownerRequest.post(
      `/api/meters/${INVALID_UUID}/anomaly`,
      { data: { reading_value: 99999 } },
    );
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("invalide");
  });

  rawTest("returns 401 without authentication", async ({ request }) => {
    const response = await request.post(
      `/api/meters/${TEST_METER_ID}/anomaly`,
      { data: { reading_value: 99999 } },
    );
    rawExpect(response.status()).toBe(401);
  });

  test("returns 400 for invalid body (negative reading)", async ({
    ownerRequest,
  }) => {
    const response = await ownerRequest.post(
      `/api/meters/${TEST_METER_ID}/anomaly`,
      { data: { reading_value: -100 } },
    );
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.details).toBeDefined();
  });

  test("returns 400 for description too long", async ({ ownerRequest }) => {
    const response = await ownerRequest.post(
      `/api/meters/${TEST_METER_ID}/anomaly`,
      {
        data: {
          reading_value: 12345,
          description: "x".repeat(600),
        },
      },
    );
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.details).toBeDefined();
  });

  test("accepts valid anomaly report", async ({ ownerRequest }) => {
    const response = await ownerRequest.post(
      `/api/meters/${TEST_METER_ID}/anomaly`,
      {
        data: {
          reading_value: 99999,
          expected_range: { min: 1000, max: 2000 },
          description: "Valeur anormalement élevée",
        },
      },
    );
    expect([200, 403, 404]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty("is_anomaly");
    }
  });
});

// ============================================
// API Payments — Validation
// ============================================
rawTest.describe("API Payments — Validation (sans auth requise)", () => {
  rawTest.describe("GET /api/payments/calculate-fees", () => {
    rawTest("returns 400 for missing amount parameter", async ({
      request,
    }) => {
      const response = await request.get("/api/payments/calculate-fees");
      rawExpect(response.status()).toBe(400);
      const body = await response.json();
      rawExpect(body.error).toContain("Paramètres invalides");
    });

    rawTest("returns 400 for negative amount", async ({ request }) => {
      const response = await request.get(
        "/api/payments/calculate-fees?amount=-100",
      );
      rawExpect(response.status()).toBe(400);
    });

    rawTest("returns 400 for non-numeric amount", async ({ request }) => {
      const response = await request.get(
        "/api/payments/calculate-fees?amount=abc",
      );
      rawExpect(response.status()).toBe(400);
    });

    rawTest("returns fees for valid amount", async ({ request }) => {
      const response = await request.get(
        "/api/payments/calculate-fees?amount=1000",
      );
      rawExpect(response.status()).toBe(200);
      const body = await response.json();
      rawExpect(body).toHaveProperty("amount", 1000);
      rawExpect(body).toHaveProperty("fees");
      rawExpect(body.fees).toHaveProperty("gross_amount");
      rawExpect(body.fees).toHaveProperty("stripe_fee");
      rawExpect(body.fees).toHaveProperty("net_amount");
    });

    rawTest("supports include_deposit parameter", async ({ request }) => {
      const response = await request.get(
        "/api/payments/calculate-fees?amount=1000&include_deposit=true",
      );
      rawExpect(response.status()).toBe(200);
      const body = await response.json();
      rawExpect(body).toHaveProperty("deposit_breakdown");
    });
  });

  rawTest.describe("POST /api/payments/checkout", () => {
    rawTest("returns 401 without authentication", async ({ request }) => {
      const response = await request.post("/api/payments/checkout", {
        data: { invoiceId: "00000000-0000-0000-0000-000000000001" },
      });
      rawExpect(response.status()).toBe(401);
    });

    rawTest("returns 400 or 401 for invalid invoiceId format", async ({
      request,
    }) => {
      const response = await request.post("/api/payments/checkout", {
        data: { invoiceId: "not-a-uuid" },
      });
      rawExpect([400, 401]).toContain(response.status());
    });
  });

  rawTest.describe("POST /api/payments/confirm", () => {
    rawTest("returns 401 without authentication", async ({ request }) => {
      const response = await request.post("/api/payments/confirm", {
        data: {
          paymentIntentId: "pi_test123",
          invoiceId: "00000000-0000-0000-0000-000000000001",
        },
      });
      rawExpect(response.status()).toBe(401);
    });

    rawTest("returns 400 or 401 for invalid paymentIntentId format", async ({
      request,
    }) => {
      const response = await request.post("/api/payments/confirm", {
        data: {
          paymentIntentId: "invalid_format",
          invoiceId: "00000000-0000-0000-0000-000000000001",
        },
      });
      rawExpect([400, 401]).toContain(response.status());
    });
  });
});
