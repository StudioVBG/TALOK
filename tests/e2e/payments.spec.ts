/**
 * E2E — Paiements locataire.
 *
 * Refactor : credentials/login centralisés via la fixture `tenantPage`.
 */

import { test, expect } from "./fixtures/auth";
import { routes } from "./helpers/routes";

test.describe("Paiements locataire", () => {
  test("ouvre la page paiements actuelle", async ({ tenantPage: page }) => {
    await page.goto(routes.tenant.payments);

    await expect(page.getByRole("heading", { name: "Paiements" })).toBeVisible();
    await expect(
      page.getByPlaceholder("Rechercher une période..."),
    ).toBeVisible();
    await expect(page.getByText("Historique")).toBeVisible();
  });

  test("accepte le retour success Stripe et nettoie l'URL", async ({
    tenantPage: page,
  }) => {
    await page.goto(`${routes.tenant.payments}?success=true&invoice=test-invoice`);

    await expect(
      page.getByText("Paiement en cours de synchronisation"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/tenant\/payments$/);
  });

  test("redirige les quittances vers le document center", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.receipts);
    await expect(page).toHaveURL(/\/tenant\/documents\?type=quittance/);
  });
});
