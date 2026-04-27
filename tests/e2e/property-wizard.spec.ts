/**
 * E2E — Wizard de création de logement (avancement automatique, étapes
 * dynamiques selon le type de bien).
 *
 * Refactor : credentials/login centralisés via la fixture `ownerPage`.
 */

import { test, expect } from "./fixtures/auth";
import { routes } from "./helpers/routes";

test.describe("Wizard de création de logement", () => {
  test("avance automatique et étapes dynamiques pour un parking", async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.propertiesNew);
    await page.waitForSelector('[data-testid="property-wizard"]');

    const stepTitle = page.locator('[data-testid="wizard-step-title"]');
    await expect(stepTitle).toHaveText(/Type de bien/i);

    // Par défaut (appartement) l'étape Pièces & photos est visible
    await expect(
      page.locator('[data-testid="wizard-step-pieces"]'),
    ).toBeVisible();

    // Sélectionner Parking déclenche automatiquement l'étape suivante
    await page.selectOption('[data-testid="field-type_bien"]', "parking");

    await expect(stepTitle).toHaveText(/Adresse/i);
    await expect(
      page.locator('[data-testid="wizard-step-adresse"][data-active="true"]'),
    ).toBeVisible();

    // L'étape Pièces & photos disparaît pour le parking
    await expect(
      page.locator('[data-testid="wizard-step-pieces"]'),
    ).toHaveCount(0);
  });
});
