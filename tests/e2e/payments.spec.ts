import { test, expect } from "@playwright/test";

const TENANT_CREDENTIALS = {
  email: process.env.TEST_TENANT_EMAIL,
  password: process.env.TEST_TENANT_PASSWORD,
};

test.describe("Paiements locataire", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !TENANT_CREDENTIALS.email || !TENANT_CREDENTIALS.password,
      "Variables TEST_TENANT_EMAIL / TEST_TENANT_PASSWORD non configurees"
    );

    await page.goto("/auth/signin");
    await page.fill('input[type="email"]', TENANT_CREDENTIALS.email!);
    await page.fill('input[type="password"]', TENANT_CREDENTIALS.password!);
    await page.click('button:has-text("Se connecter")');
    await page.waitForURL(/\/tenant|\/app\/tenant|\/dashboard/, { timeout: 15000 });
  });

  test("ouvre la page paiements actuelle", async ({ page }) => {
    await page.goto("/tenant/payments");

    await expect(page.getByRole("heading", { name: "Paiements" })).toBeVisible();
    await expect(page.getByPlaceholder("Rechercher une période...")).toBeVisible();
    await expect(page.getByText("Historique")).toBeVisible();
  });

  test("accepte le retour success Stripe et nettoie l'URL", async ({ page }) => {
    await page.goto("/tenant/payments?success=true&invoice=test-invoice");

    await expect(page.getByText("Paiement en cours de synchronisation")).toBeVisible();
    await expect(page).toHaveURL(/\/tenant\/payments$/);
  });

  test("redirige les quittances vers le document center", async ({ page }) => {
    await page.goto("/tenant/receipts");
    await expect(page).toHaveURL(/\/tenant\/documents\?type=quittance/);
  });
});

