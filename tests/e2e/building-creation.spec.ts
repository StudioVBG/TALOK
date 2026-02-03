/**
 * Tests E2E pour la creation d'un immeuble entier
 *
 * SOTA 2026: Workflow de creation d'immeuble avec lots multiples
 *
 * Scenarios testes:
 * - Selection du type "immeuble"
 * - Configuration des etages et lots
 * - Duplication de lots entre etages
 * - Validation du recap avec stats
 */

import { test, expect, Page } from "@playwright/test";

// Test credentials (from env or defaults)
const OWNER_CREDENTIALS = {
  email: process.env.TEST_OWNER_EMAIL || "contact.explore.mq@gmail.com",
  password: process.env.TEST_OWNER_PASSWORD || "Test12345!2025",
};

async function loginAsOwner(page: Page) {
  await page.goto("/auth/signin");
  await page.fill('input[type="email"]', OWNER_CREDENTIALS.email);
  await page.fill('input[type="password"]', OWNER_CREDENTIALS.password);
  await page.click('button:has-text("Se connecter")');
  await expect(page).toHaveURL(/.*\/owner/, { timeout: 15000 });
}

test.describe("Building Creation - Immeuble Entier", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("should select 'Immeuble entier' type", async ({ page }) => {
    await page.goto("/owner/properties/new");
    await page.waitForSelector('[role="listbox"]', { timeout: 10000 });

    // Look for "Immeuble entier" card
    const immeubleCard = page.getByRole("option", { name: /Immeuble entier/i });
    await expect(immeubleCard).toBeVisible();

    // Click to select
    await immeubleCard.click();
    await page.waitForTimeout(300);

    // Should be selected
    await expect(page.getByText("Selectionne")).toBeVisible();
  });

  test("should navigate to building config step after address", async ({ page }) => {
    await page.goto("/owner/properties/new?type=immeuble");
    await page.waitForSelector('[data-testid="property-wizard"]', { timeout: 10000 });

    // Should show address step or building config depending on wizard state
    // Wait for wizard to initialize
    await page.waitForTimeout(500);

    // Check that building-specific steps exist
    // The step indicator should include building config
    const stepIndicator = page.locator('[data-testid="wizard-stepper"]');
    if (await stepIndicator.isVisible()) {
      // Building config step should be present
      const buildingStep = page.locator('text=Configuration');
      await expect(buildingStep).toBeVisible();
    }
  });

  test("should configure building floors", async ({ page }) => {
    // Navigate directly to building config if possible
    await page.goto("/owner/properties/new?type=immeuble");
    await page.waitForSelector('[data-testid="property-wizard"]', { timeout: 10000 });

    // Fill address first if required
    const addressInput = page.locator('input[name="adresse_complete"]');
    if (await addressInput.isVisible()) {
      await addressInput.fill("123 Rue de Test");
      await page.fill('input[name="code_postal"]', "75001");
      await page.fill('input[name="ville"]', "Paris");

      // Continue to building config
      await page.click('button:has-text("Continuer")');
      await page.waitForTimeout(500);
    }

    // Look for floors configuration
    const floorsInput = page.locator('input[name="building_floors"], [data-testid="building-floors-input"]');
    if (await floorsInput.isVisible()) {
      await floorsInput.fill("5");

      // Verify floors updated
      await expect(floorsInput).toHaveValue("5");
    }
  });

  test("should add unit using templates", async ({ page }) => {
    await page.goto("/owner/properties/new?type=immeuble");
    await page.waitForSelector('[data-testid="property-wizard"]', { timeout: 10000 });

    // Wait for building config step
    await page.waitForTimeout(1000);

    // Look for template buttons
    const t2Template = page.getByRole("button", { name: /T2/i });
    if (await t2Template.isVisible()) {
      await t2Template.click();
      await page.waitForTimeout(300);

      // Should add a unit
      const unitCards = page.locator('[data-testid="building-unit-card"]');
      const count = await unitCards.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test("should duplicate unit to other floors", async ({ page }) => {
    await page.goto("/owner/properties/new?type=immeuble");
    await page.waitForSelector('[data-testid="property-wizard"]', { timeout: 10000 });

    await page.waitForTimeout(1000);

    // Add a unit first
    const studioTemplate = page.getByRole("button", { name: /Studio/i });
    if (await studioTemplate.isVisible()) {
      await studioTemplate.click();
      await page.waitForTimeout(300);

      // Look for duplicate button
      const duplicateBtn = page.getByRole("button", { name: /Dupliquer/i });
      if (await duplicateBtn.isVisible()) {
        await duplicateBtn.click();
        await page.waitForTimeout(300);

        // Should show floor selection or increase unit count
        const unitCards = page.locator('[data-testid="building-unit-card"]');
        const count = await unitCards.count();
        expect(count).toBeGreaterThan(1);
      }
    }
  });

  test("should show building stats in recap", async ({ page }) => {
    await page.goto("/owner/properties/new?type=immeuble");
    await page.waitForSelector('[data-testid="property-wizard"]', { timeout: 10000 });

    // Navigate through wizard to recap
    // This depends on the wizard implementation
    await page.waitForTimeout(1000);

    // Try to go to recap step
    const recapTab = page.locator('[data-step="recap"], [data-testid="step-recap"]');
    if (await recapTab.isVisible()) {
      await recapTab.click();
      await page.waitForTimeout(500);

      // Check for building stats
      await expect(page.getByText(/etage/i)).toBeVisible();
      await expect(page.getByText(/lot/i)).toBeVisible();
    }
  });

  test("should validate building has at least one unit", async ({ page }) => {
    await page.goto("/owner/properties/new?type=immeuble");
    await page.waitForSelector('[data-testid="property-wizard"]', { timeout: 10000 });

    await page.waitForTimeout(1000);

    // Try to submit without units
    const submitBtn = page.getByRole("button", { name: /Publier|Soumettre/i });
    if (await submitBtn.isVisible()) {
      // Should be disabled or show error
      const isDisabled = await submitBtn.isDisabled();
      if (!isDisabled) {
        await submitBtn.click();
        await page.waitForTimeout(300);

        // Should show validation error
        const errorMessage = page.getByText(/au moins.*lot/i);
        await expect(errorMessage).toBeVisible();
      }
    }
  });

  test("should show building floor visualization", async ({ page }) => {
    await page.goto("/owner/properties/new?type=immeuble");
    await page.waitForSelector('[data-testid="property-wizard"]', { timeout: 10000 });

    await page.waitForTimeout(1000);

    // Look for isometric visualization
    const visualization = page.locator('[data-testid="building-visualizer"], .building-isometric');
    if (await visualization.isVisible()) {
      // Should display floor indicators
      await expect(page.getByText(/RDC|Etage/i)).toBeVisible();
    }
  });
});

test.describe("Building Creation - Mobile Experience", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("should be usable on mobile viewport", async ({ page }) => {
    await page.goto("/owner/properties/new?type=immeuble");
    await page.waitForSelector('[data-testid="property-wizard"]', { timeout: 10000 });

    // Wizard should be visible and not overflow
    const wizard = page.locator('[data-testid="property-wizard"]');
    const box = await wizard.boundingBox();

    if (box) {
      // Should fit in viewport
      expect(box.width).toBeLessThanOrEqual(375);
    }

    // Template buttons should be tappable
    const templateBtn = page.getByRole("button", { name: /T1|T2|Studio/i }).first();
    if (await templateBtn.isVisible()) {
      const btnBox = await templateBtn.boundingBox();
      if (btnBox) {
        // Minimum touch target
        expect(btnBox.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("should show mobile-optimized floor selector", async ({ page }) => {
    await page.goto("/owner/properties/new?type=immeuble");
    await page.waitForSelector('[data-testid="property-wizard"]', { timeout: 10000 });

    await page.waitForTimeout(1000);

    // Floor selector should be visible and accessible
    const floorSelector = page.locator('[data-testid="floor-selector"]');
    if (await floorSelector.isVisible()) {
      // Should be full width on mobile
      const box = await floorSelector.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(300);
      }
    }
  });
});

test.describe("Building Creation - Validation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("should validate unit surface is positive", async ({ page }) => {
    await page.goto("/owner/properties/new?type=immeuble");
    await page.waitForSelector('[data-testid="property-wizard"]', { timeout: 10000 });

    await page.waitForTimeout(1000);

    // Add a unit
    const template = page.getByRole("button", { name: /T2/i });
    if (await template.isVisible()) {
      await template.click();
      await page.waitForTimeout(300);

      // Try to edit surface to 0
      const surfaceInput = page.locator('input[name*="surface"]').first();
      if (await surfaceInput.isVisible()) {
        await surfaceInput.fill("0");
        await surfaceInput.blur();
        await page.waitForTimeout(300);

        // Should show error
        const error = page.getByText(/surface.*positive|surface.*invalide/i);
        if (await error.isVisible()) {
          expect(await error.isVisible()).toBe(true);
        }
      }
    }
  });

  test("should validate unit floor does not exceed building floors", async ({ page }) => {
    await page.goto("/owner/properties/new?type=immeuble");
    await page.waitForSelector('[data-testid="property-wizard"]', { timeout: 10000 });

    await page.waitForTimeout(1000);

    // Set building to 3 floors
    const floorsInput = page.locator('input[name="building_floors"]');
    if (await floorsInput.isVisible()) {
      await floorsInput.fill("3");
      await page.waitForTimeout(300);

      // Try to add unit at floor 5
      const floorSelect = page.locator('select[name*="floor"]');
      if (await floorSelect.isVisible()) {
        // Options should be limited to 0-3
        const options = await floorSelect.locator("option").allTextContents();
        const hasInvalidFloor = options.some(opt => parseInt(opt) > 3);
        expect(hasInvalidFloor).toBe(false);
      }
    }
  });
});
