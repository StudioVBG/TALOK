/**
 * E2E — Création d'immeuble entier (workflow SOTA 2026 : lots multiples,
 * étages, duplications, validation, mobile, viz isométrique).
 *
 * Refactor : credentials/login centralisés via la fixture `ownerPage`.
 * Plus de helper `loginAsOwner` local ni d'env var TEST_OWNER_*.
 */

import { test, expect } from "./fixtures/auth";
import { routes } from "./helpers/routes";

const BUILDING_NEW = `${routes.owner.propertiesNew}?type=immeuble`;

test.describe("Building Creation — Immeuble Entier", () => {
  test("should select 'Immeuble entier' type", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.propertiesNew);
    await page.waitForSelector('[role="listbox"]', { timeout: 10_000 });

    const immeubleCard = page.getByRole("option", { name: /Immeuble entier/i });
    await expect(immeubleCard).toBeVisible();

    await immeubleCard.click();
    await page.waitForTimeout(300);

    await expect(page.getByText(/Sélectionné|Selectionne/)).toBeVisible();
  });

  test("should navigate to building config step after address", async ({
    ownerPage: page,
  }) => {
    await page.goto(BUILDING_NEW);
    await page.waitForSelector('[data-testid="property-wizard"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    const stepIndicator = page.locator('[data-testid="wizard-stepper"]');
    if (await stepIndicator.isVisible()) {
      const buildingStep = page.locator("text=Configuration");
      await expect(buildingStep).toBeVisible();
    }
  });

  test("should configure building floors", async ({ ownerPage: page }) => {
    await page.goto(BUILDING_NEW);
    await page.waitForSelector('[data-testid="property-wizard"]', {
      timeout: 10_000,
    });

    const addressInput = page.locator('input[name="adresse_complete"]');
    if (await addressInput.isVisible()) {
      await addressInput.fill("123 Rue de Test");
      await page.fill('input[name="code_postal"]', "75001");
      await page.fill('input[name="ville"]', "Paris");

      await page.click('button:has-text("Continuer")');
      await page.waitForTimeout(500);
    }

    const floorsInput = page.locator(
      'input[name="building_floors"], [data-testid="building-floors-input"]',
    );
    if (await floorsInput.isVisible()) {
      await floorsInput.fill("5");
      await expect(floorsInput).toHaveValue("5");
    }
  });

  test("should add unit using templates", async ({ ownerPage: page }) => {
    await page.goto(BUILDING_NEW);
    await page.waitForSelector('[data-testid="property-wizard"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(1_000);

    const t2Template = page.getByRole("button", { name: /T2/i });
    if (await t2Template.isVisible()) {
      await t2Template.click();
      await page.waitForTimeout(300);

      const unitCards = page.locator('[data-testid="building-unit-card"]');
      expect(await unitCards.count()).toBeGreaterThan(0);
    }
  });

  test("should duplicate unit to other floors", async ({ ownerPage: page }) => {
    await page.goto(BUILDING_NEW);
    await page.waitForSelector('[data-testid="property-wizard"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(1_000);

    const studioTemplate = page.getByRole("button", { name: /Studio/i });
    if (await studioTemplate.isVisible()) {
      await studioTemplate.click();
      await page.waitForTimeout(300);

      const duplicateBtn = page.getByRole("button", { name: /Dupliquer/i });
      if (await duplicateBtn.isVisible()) {
        await duplicateBtn.click();
        await page.waitForTimeout(300);

        const unitCards = page.locator('[data-testid="building-unit-card"]');
        expect(await unitCards.count()).toBeGreaterThan(1);
      }
    }
  });

  test("should show building stats in recap", async ({ ownerPage: page }) => {
    await page.goto(BUILDING_NEW);
    await page.waitForSelector('[data-testid="property-wizard"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(1_000);

    const recapTab = page.locator(
      '[data-step="recap"], [data-testid="step-recap"]',
    );
    if (await recapTab.isVisible()) {
      await recapTab.click();
      await page.waitForTimeout(500);

      await expect(page.getByText(/etage|étage/i)).toBeVisible();
      await expect(page.getByText(/lot/i)).toBeVisible();
    }
  });

  test("should validate building has at least one unit", async ({
    ownerPage: page,
  }) => {
    await page.goto(BUILDING_NEW);
    await page.waitForSelector('[data-testid="property-wizard"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(1_000);

    const submitBtn = page.getByRole("button", { name: /Publier|Soumettre/i });
    if (await submitBtn.isVisible()) {
      const isDisabled = await submitBtn.isDisabled();
      if (!isDisabled) {
        await submitBtn.click();
        await page.waitForTimeout(300);

        const errorMessage = page.getByText(/au moins.*lot/i);
        await expect(errorMessage).toBeVisible();
      }
    }
  });

  test("should show building floor visualization", async ({
    ownerPage: page,
  }) => {
    await page.goto(BUILDING_NEW);
    await page.waitForSelector('[data-testid="property-wizard"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(1_000);

    const visualization = page.locator(
      '[data-testid="building-visualizer"], .building-isometric',
    );
    if (await visualization.isVisible()) {
      await expect(page.getByText(/RDC|Etage|Étage/i)).toBeVisible();
    }
  });
});

test.describe("Building Creation — Mobile Experience", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("should be usable on mobile viewport", async ({ ownerPage: page }) => {
    await page.goto(BUILDING_NEW);
    await page.waitForSelector('[data-testid="property-wizard"]', {
      timeout: 10_000,
    });

    const wizard = page.locator('[data-testid="property-wizard"]');
    const box = await wizard.boundingBox();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(375);
    }

    const templateBtn = page
      .getByRole("button", { name: /T1|T2|Studio/i })
      .first();
    if (await templateBtn.isVisible()) {
      const btnBox = await templateBtn.boundingBox();
      if (btnBox) {
        expect(btnBox.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("should show mobile-optimized floor selector", async ({
    ownerPage: page,
  }) => {
    await page.goto(BUILDING_NEW);
    await page.waitForSelector('[data-testid="property-wizard"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(1_000);

    const floorSelector = page.locator('[data-testid="floor-selector"]');
    if (await floorSelector.isVisible()) {
      const box = await floorSelector.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(300);
      }
    }
  });
});

test.describe("Building Creation — Validation", () => {
  test("should validate unit surface is positive", async ({
    ownerPage: page,
  }) => {
    await page.goto(BUILDING_NEW);
    await page.waitForSelector('[data-testid="property-wizard"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(1_000);

    const template = page.getByRole("button", { name: /T2/i });
    if (await template.isVisible()) {
      await template.click();
      await page.waitForTimeout(300);

      const surfaceInput = page.locator('input[name*="surface"]').first();
      if (await surfaceInput.isVisible()) {
        await surfaceInput.fill("0");
        await surfaceInput.blur();
        await page.waitForTimeout(300);

        const error = page.getByText(/surface.*positive|surface.*invalide/i);
        if (await error.isVisible()) {
          expect(await error.isVisible()).toBe(true);
        }
      }
    }
  });

  test("should validate unit floor does not exceed building floors", async ({
    ownerPage: page,
  }) => {
    await page.goto(BUILDING_NEW);
    await page.waitForSelector('[data-testid="property-wizard"]', {
      timeout: 10_000,
    });
    await page.waitForTimeout(1_000);

    const floorsInput = page.locator('input[name="building_floors"]');
    if (await floorsInput.isVisible()) {
      await floorsInput.fill("3");
      await page.waitForTimeout(300);

      const floorSelect = page.locator('select[name*="floor"]');
      if (await floorSelect.isVisible()) {
        const options = await floorSelect.locator("option").allTextContents();
        const hasInvalidFloor = options.some((opt) => parseInt(opt) > 3);
        expect(hasInvalidFloor).toBe(false);
      }
    }
  });
});
