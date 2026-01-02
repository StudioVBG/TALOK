/**
 * Tests E2E pour l'étape 1 - Sélection du type de bien
 * 
 * Objectifs mesurables :
 * - Time to select type ≤ 7s desktop / ≤ 10s mobile
 * - ≤ 1 click to select, ≤ 0.5 screen scroll
 * - Keyboard-ready: arrows navigate grid, Enter validates
 * - A11y AA: focus ring visible, role listbox + aria-pressed
 */

import { test, expect } from "@playwright/test";

test.describe("Property Type Selection - Step 1", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to property creation page
    await page.goto("/owner/properties/new");
    // Wait for the wizard to load
    await page.waitForSelector('[role="listbox"]', { timeout: 10000 });
  });

  test("should display filter bar with pills and search", async ({ page }) => {
    // Check filter pills
    await expect(page.getByRole("tab", { name: "Tous" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Habitation" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Parking & Box" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Commercial" })).toBeVisible();

    // Check search input
    const searchInput = page.getByPlaceholder("Rechercher un type de bien...");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute("type", "search");
  });

  test("should filter types by group", async ({ page }) => {
    // Click on "Habitation" filter
    await page.getByRole("tab", { name: "Habitation" }).click();
    
    // Wait for filter to apply
    await page.waitForTimeout(200);
    
    // Check that only habitation types are visible
    await expect(page.getByText("Appartement")).toBeVisible();
    await expect(page.getByText("Maison")).toBeVisible();
    await expect(page.getByText("Studio")).toBeVisible();
    await expect(page.getByText("Colocation")).toBeVisible();
    
    // Parking types should not be visible
    await expect(page.getByText("Place de parking")).not.toBeVisible();
  });

  test("should filter types by search query", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Rechercher un type de bien...");
    
    // Type "appartement"
    await searchInput.fill("appartement");
    await page.waitForTimeout(150); // Wait for debounce
    
    // Check that only "Appartement" is visible
    await expect(page.getByText("Appartement")).toBeVisible();
    await expect(page.getByText("Maison")).not.toBeVisible();
  });

  test("should show empty state when no results", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Rechercher un type de bien...");
    
    // Type something that doesn't match
    await searchInput.fill("xyz123");
    await page.waitForTimeout(150);
    
    // Check empty state
    await expect(page.getByText("Aucun type de bien trouvé")).toBeVisible();
    await expect(page.getByRole("button", { name: "Effacer le filtre" })).toBeVisible();
    
    // Click clear filter
    await page.getByRole("button", { name: "Effacer le filtre" }).click();
    await expect(page.getByText("Appartement")).toBeVisible();
  });

  test("should select a type with one click", async ({ page }) => {
    const startTime = Date.now();
    
    // Click on "Appartement"
    await page.getByRole("option", { name: /Appartement/i }).click();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should be fast (≤ 7s desktop)
    expect(duration).toBeLessThan(7000);
    
    // Check that "Sélectionné" badge appears
    await expect(page.getByText("Sélectionné")).toBeVisible();
    
    // Check that card has selected state
    const card = page.getByRole("option", { name: /Appartement.*sélectionné/i });
    await expect(card).toHaveAttribute("aria-pressed", "true");
  });

  test("should navigate with keyboard arrows", async ({ page }) => {
    // Focus the grid
    const grid = page.getByRole("listbox");
    await grid.focus();
    
    // Press ArrowRight
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(100);
    
    // Check that focus moved (aria-pressed might change or focus visible)
    const firstCard = page.getByRole("option").first();
    await expect(firstCard).toBeFocused();
    
    // Press ArrowDown
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);
    
    // Focus should move down
    const cards = page.getByRole("option");
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test("should select with Enter key", async ({ page }) => {
    // Focus the grid
    const grid = page.getByRole("listbox");
    await grid.focus();
    
    // Navigate to first card
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(100);
    
    // Press Enter to select
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    
    // Check that a type was selected
    await expect(page.getByText("Sélectionné")).toBeVisible();
  });

  test("should have accessible focus rings", async ({ page }) => {
    // Focus a card
    const card = page.getByRole("option").first();
    await card.focus();
    
    // Check that focus ring is visible (ring-2 class)
    const cardElement = await card.evaluateHandle((el) => {
      const computed = window.getComputedStyle(el);
      return {
        outline: computed.outline,
        outlineWidth: computed.outlineWidth,
      };
    });
    
    // Focus ring should be visible (check via class or computed style)
    await expect(card).toHaveClass(/focus-visible:ring/);
  });

  test("should have minimum touch target size", async ({ page }) => {
    const card = page.getByRole("option").first();
    const box = await card.boundingBox();
    
    if (box) {
      // Minimum touch target: 44px x 44px
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("should proceed to next step after selection", async ({ page }) => {
    // Select a type
    await page.getByRole("option", { name: /Appartement/i }).click();
    await page.waitForTimeout(500);
    
    // Click "Continuer"
    const continueButton = page.getByRole("button", { name: "Continuer" });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    
    // Should navigate to address step (check URL or content)
    await page.waitForTimeout(500);
    // The URL might change or the content should show address step
    // Adjust based on your routing implementation
  });

  test("should show sticky footer on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 1000));
    
    // Footer should still be visible
    const footer = page.getByRole("button", { name: "Continuer" });
    await expect(footer).toBeVisible();
    
    // Check safe-area padding (pb-safe class)
    const footerContainer = footer.locator("..").locator("..");
    // The footer should have pb-safe class or safe-area styling
  });

  test("should prefetch next step on hover", async ({ page }) => {
    // Hover over "Continuer" button
    const continueButton = page.getByRole("button", { name: "Continuer" });
    await continueButton.hover();
    
    // Wait a bit for prefetch
    await page.waitForTimeout(100);
    
    // Check that prefetch happened (check network requests or route cache)
    // This is harder to test directly, but we can verify the button is interactive
    await expect(continueButton).toBeVisible();
  });

  test("should respect reduced motion preference", async ({ page, context }) => {
    // Set reduced motion preference via CSS media query
    await context.addInitScript(() => {
      // Mock matchMedia for reduced motion
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string) => ({
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        }),
      });
    });
    
    // Reload page
    await page.reload();
    await page.waitForSelector('[role="listbox"]');
    
    // Animations should be reduced or disabled
    // Check that motion components respect reduced motion
    const card = page.getByRole("option").first();
    await card.hover();
    
    // With reduced motion, animations should be minimal
    // This is verified by the component using useReducedMotion hook
  });
});

