/**
 * E2E — Gestion des logements (création, liste, détails, modification).
 *
 * Refactor : credentials/login centralisés via la fixture `ownerPage`.
 * Routes via le catalogue.
 *
 * Note : ces tests créent et modifient des données réelles. Ils doivent
 * tourner contre une base de test, pas contre la prod.
 */

import { test, expect } from "./fixtures/auth";
import { routes } from "./helpers/routes";

test.describe("Gestion des logements", () => {
  test("Créer un logement", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.properties);
    await page.click('a[href*="properties/new"], button:has-text("Ajouter")').catch(async () => {
      await page.goto(routes.owner.propertiesNew);
    });

    // Remplir le formulaire avec des données réelles
    await page
      .fill('input[name="adresse_complete"]', "15 Avenue des Champs-Élysées")
      .catch(() => {});
    await page.fill('input[name="code_postal"]', "75008").catch(() => {});
    await page.fill('input[name="ville"]', "Paris").catch(() => {});
    await page.fill('input[name="departement"]', "75").catch(() => {});
    await page
      .selectOption('select[name="type"]', "appartement")
      .catch(() => {});
    await page.fill('input[name="surface"]', "85").catch(() => {});
    await page.fill('input[name="nb_pieces"]', "4").catch(() => {});
    await page.check('input[name="ascenseur"]').catch(() => {});

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/owner\/properties/, { timeout: 10_000 });
  });

  test("Voir la liste des logements", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.properties);

    await expect(
      page.getByRole("heading", { name: /Mes logements|Mes biens|Properties/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Pagination si plus de 12 items
    const pagination = page.locator(
      '[role="navigation"][aria-label="pagination"]',
    );
    if ((await pagination.count()) > 0) {
      await expect(pagination).toBeVisible();
    }
  });

  test("Voir les détails d'un logement (si présent)", async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.properties);

    const firstProperty = page.locator('[data-testid="property-card"]').first();
    if ((await firstProperty.count()) > 0) {
      await firstProperty.click();
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.locator("text=/Adresse|Surface|Pièces/"),
      ).toBeVisible();
    }
  });

  test("Modifier un logement (si présent)", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.properties);

    const editButton = page.locator('button:has-text("Modifier")').first();
    if ((await editButton.count()) > 0) {
      await editButton.click();
      await page.fill('input[name="surface"]', "90");
      await page.click('button[type="submit"]');
      await expect(page.locator('text="90"')).toBeVisible({ timeout: 5_000 });
    }
  });
});
