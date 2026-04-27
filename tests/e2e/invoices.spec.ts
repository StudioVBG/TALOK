/**
 * E2E — Facturation (création et listing pour différents mois).
 *
 * Refactor : credentials/login centralisés via la fixture `ownerPage`.
 * Les périodes utilisent l'année courante au lieu de dates figées 2025.
 */

import { test, expect } from "./fixtures/auth";
import { routes } from "./helpers/routes";

const now = new Date();
const periodOf = (monthOffset: number) => {
  const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const CURRENT_MONTH = periodOf(0);
const PREVIOUS_MONTH = periodOf(-1);

test.describe("Facturation", () => {
  test("Liste des factures s'affiche", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.invoices);
    await expect(page).toHaveURL(/\/owner\/invoices/);
  });

  test(`Créer une facture pour ${CURRENT_MONTH}`, async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.invoices);
    await page.click('button:has-text("Créer"), a[href*="invoices/new"]');

    const leaseSelect = page.locator('select[name="lease_id"]');
    if ((await leaseSelect.count()) > 0) {
      await leaseSelect.selectOption({ index: 0 });
      await page.fill('input[name="periode"]', CURRENT_MONTH);
      await page.fill('input[name="montant_loyer"]', "1200");
      await page.fill('input[name="montant_charges"]', "150");
      await page.click('button[type="submit"]');

      await expect(page.locator(`text="${CURRENT_MONTH}"`)).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test(`Filtre les factures par période (${PREVIOUS_MONTH})`, async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.invoices);

    const filterInput = page.locator(
      'input[placeholder*="période" i], input[name="periode"]',
    );
    if ((await filterInput.count()) > 0) {
      await filterInput.fill(PREVIOUS_MONTH);
      await page.keyboard.press("Enter");

      const invoices = page.locator('[data-testid="invoice-card"]');
      const count = await invoices.count();
      for (let i = 0; i < count; i++) {
        await expect(invoices.nth(i).locator(`text="${PREVIOUS_MONTH}"`))
          .toBeVisible();
      }
    }
  });

  test("Pagination des factures", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.invoices);

    const pagination = page.locator(
      '[role="navigation"][aria-label="pagination"]',
    );
    if ((await pagination.count()) > 0) {
      await expect(pagination).toBeVisible();

      const nextButton = pagination.locator('button:has-text("Suivant")');
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await expect(page).toHaveURL(/page=2/);
      }
    }
  });
});
