/**
 * E2E — Parcours complet Talok (bien → locataire → bail → EDL → signature →
 * paiement) + tests de régression et performance.
 *
 * Refactor : credentials/login centralisés via la fixture `ownerPage` ;
 * tests d'API en `request` direct ; sérialisation explicite pour le parcours
 * complet (les tests partagent `propertyId` / `leaseId`).
 */

import { test as authTest, expect as authExpect } from "./fixtures/auth";
import { test, expect } from "@playwright/test";
import { routes } from "./helpers/routes";

const TEST_PROPERTY = {
  type: "appartement",
  address: "63 Rue Victor Schoelcher",
  postalCode: "97200",
  city: "Fort-de-France",
  surface: 65,
  rooms: 3,
  rent: 850,
  charges: 50,
};

const TEST_TENANT = {
  firstName: "Marie",
  lastName: "Dupont",
  email: `tenant-${Date.now()}@test.talok.fr`,
  phone: "0696123456",
};

authTest.describe("Parcours Complet : Bien → Paiement", () => {
  authTest.describe.configure({ mode: "serial" });

  let propertyId = "";
  let leaseId = "";

  authTest("1. Création d'un bien immobilier", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.dashboard);
    await page.click("text=Ajouter un bien").catch(async () => {
      await page.goto(routes.owner.propertiesNew);
    });
    await authExpect(page).toHaveURL(/\/owner\/properties\/new/);

    await page.click(`[data-value="${TEST_PROPERTY.type}"]`);
    await page.click('button:has-text("Suivant")');

    await page.fill('[name="adresse"]', TEST_PROPERTY.address);
    await page.fill('[name="code_postal"]', TEST_PROPERTY.postalCode);
    await page.fill('[name="ville"]', TEST_PROPERTY.city);
    await page.click('button:has-text("Suivant")');

    await page.fill('[name="surface"]', String(TEST_PROPERTY.surface));
    await page.fill('[name="nb_pieces"]', String(TEST_PROPERTY.rooms));
    await page.click('button:has-text("Suivant")');

    await page.fill('[name="loyer"]', String(TEST_PROPERTY.rent));
    await page.fill('[name="charges"]', String(TEST_PROPERTY.charges));
    await page.click('button:has-text("Créer le bien")');

    await authExpect(
      page.locator(".toast-success, [role='alert']"),
    ).toBeVisible({ timeout: 10_000 });

    await page.waitForURL(/\/owner\/properties\/[a-f0-9-]+/);
    propertyId = page.url().split("/").pop() ?? "";
    authExpect(propertyId).toBeTruthy();
  });

  authTest("2. Ajout d'un locataire", async ({ ownerPage: page }) => {
    authTest.skip(!propertyId, "Nécessite un bien créé");

    await page.goto(`/owner/properties/${propertyId}`);
    await page.click('button:has-text("Ajouter un locataire")');

    await page.fill('[name="prenom"]', TEST_TENANT.firstName);
    await page.fill('[name="nom"]', TEST_TENANT.lastName);
    await page.fill('[name="email"]', TEST_TENANT.email);
    await page.fill('[name="telephone"]', TEST_TENANT.phone);

    await page.click('button:has-text("Inviter")');
    await authExpect(
      page.locator(".toast-success, [role='alert']"),
    ).toBeVisible({ timeout: 10_000 });
  });

  authTest("3. Création du bail", async ({ ownerPage: page }) => {
    authTest.skip(!propertyId, "Nécessite un bien créé");

    await page.goto(`/owner/properties/${propertyId}/leases/new`);
    await page.click('[data-value="meuble"]');
    await page.click('button:has-text("Suivant")');

    const today = new Date().toISOString().split("T")[0];
    await page.fill('[name="date_debut"]', today);
    await page.click('button:has-text("Suivant")');

    const rentInput = page.locator('[name="loyer"]');
    await authExpect(rentInput).toHaveValue(String(TEST_PROPERTY.rent));

    await page.click('button:has-text("Créer le bail")');
    await authExpect(page.locator(".toast-success")).toBeVisible({
      timeout: 10_000,
    });

    await page.waitForURL(/\/owner\/leases\/[a-f0-9-]+/);
    leaseId = page.url().split("/").pop() ?? "";
    authExpect(leaseId).toBeTruthy();
  });

  authTest("4. État des lieux d'entrée", async ({ ownerPage: page }) => {
    authTest.skip(!leaseId, "Nécessite un bail créé");

    await page.goto(`/owner/leases/${leaseId}/edl/new`);
    await page.click('[data-value="entree"]');
    await page.click('button:has-text("Suivant")');

    await page.click('button:has-text("Suivant")');

    await page.click('button:has-text("Ajouter une pièce")');
    await page.fill('[name="room_name"]', "Salon");
    await page.click('[data-value="bon"]');
    await page.click('button:has-text("Valider")');

    await page.click('button:has-text("Ajouter une pièce")');
    await page.fill('[name="room_name"]', "Chambre");
    await page.click('[data-value="bon"]');
    await page.click('button:has-text("Valider")');

    await page.click('button:has-text("Suivant")');
    await page.click('button:has-text("Suivant")');
    await page.click("button:has-text(\"Créer l'état des lieux\")");

    await authExpect(page.locator(".toast-success")).toBeVisible({
      timeout: 10_000,
    });
  });

  authTest("5. Envoi pour signature", async ({ ownerPage: page }) => {
    authTest.skip(!leaseId, "Nécessite un bail créé");

    await page.goto(`/owner/leases/${leaseId}`);
    await page.click('button:has-text("Envoyer pour signature")');
    await page.click('button:has-text("Confirmer")');

    await authExpect(page.locator(".toast-success")).toBeVisible({
      timeout: 10_000,
    });
    await authExpect(
      page.locator("text=En attente de signature"),
    ).toBeVisible();
  });

  authTest("6. Vérification API meter-readings", async ({ request }) => {
    const response = await request.get(
      "/api/edl/test-invalid-id/meter-readings",
    );
    const contentType = response.headers()["content-type"];
    authExpect(contentType).toContain("application/json");
    authExpect(response.status()).toBeLessThan(500);
  });

  authTest("7. Vérification Stripe Connect API", async ({ request }) => {
    const response = await request.get("/api/stripe/connect");
    const contentType = response.headers()["content-type"];
    authExpect(contentType).toContain("application/json");
    authExpect([200, 401, 404]).toContain(response.status());
  });
});

// ============================================
// Régression
// ============================================
test.describe("Tests de Régression", () => {
  test("BUG-001: meter-readings ne retourne pas de HTML", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/edl/invalid-uuid/meter-readings",
    );

    const contentType = response.headers()["content-type"] || "";
    expect(contentType).not.toContain("text/html");
    expect(contentType).toContain("application/json");
  });

  test("BUG-005: SEPA service accepte IP dynamique", async ({ request }) => {
    const response = await request.post("/api/payments/setup-sepa", {
      data: {
        lease_id: "00000000-0000-0000-0000-000000000000",
        iban: "FR7630006000011234567890189",
        account_holder_name: "Test User",
      },
      headers: {
        "X-Forwarded-For": "203.0.113.42",
        "User-Agent": "Playwright Test",
      },
    });

    expect(response.status()).toBeLessThan(500);
  });
});

// ============================================
// Performance (authentifiée)
// ============================================
authTest.describe("Tests de Performance", () => {
  authTest("Chargement liste des biens < 3s", async ({ ownerPage: page }) => {
    const start = Date.now();
    await page.goto(routes.owner.properties);
    await page.waitForLoadState("networkidle");
    authExpect(Date.now() - start).toBeLessThan(3_000);
  });

  authTest("Chargement détail bien < 2s (si présent)", async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.properties);
    const firstProperty = page.locator('[data-testid="property-card"]').first();

    if (await firstProperty.isVisible()) {
      const start = Date.now();
      await firstProperty.click();
      await page.waitForLoadState("networkidle");
      authExpect(Date.now() - start).toBeLessThan(2_000);
    } else {
      authTest.skip();
    }
  });
});
