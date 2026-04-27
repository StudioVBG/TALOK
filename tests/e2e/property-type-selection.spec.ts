/**
 * E2E — Étape 1 du wizard de création de bien (sélection du type).
 *
 * Refactor : utilise la fixture `ownerPage` pour entrer dans la zone
 * authentifiée (le wizard est sous `/owner/properties/new`).
 *
 * Objectifs mesurables :
 * - Time to select type ≤ 7s desktop / ≤ 10s mobile
 * - ≤ 1 click to select, ≤ 0.5 screen scroll
 * - Keyboard-ready: arrows navigate grid, Enter validates
 * - A11y AA: focus ring visible, role listbox + aria-pressed
 */

import { test, expect } from "./fixtures/auth";
import { routes } from "./helpers/routes";

test.describe("Property Type Selection — Step 1", () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto(routes.owner.propertiesNew);
    await ownerPage.waitForSelector('[role="listbox"]', { timeout: 10_000 });
  });

  test("affiche la barre de filtres avec pills et search", async ({
    ownerPage: page,
  }) => {
    await expect(page.getByRole("tab", { name: "Tous" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Habitation" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Parking & Box" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Commercial" })).toBeVisible();

    const searchInput = page.getByPlaceholder("Rechercher un type de bien...");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute("type", "search");
  });

  test("filtre les types par groupe", async ({ ownerPage: page }) => {
    await page.getByRole("tab", { name: "Habitation" }).click();
    await page.waitForTimeout(200);

    await expect(page.getByText("Appartement")).toBeVisible();
    await expect(page.getByText("Maison")).toBeVisible();
    await expect(page.getByText("Studio")).toBeVisible();
    await expect(page.getByText("Colocation")).toBeVisible();
    await expect(page.getByText("Place de parking")).not.toBeVisible();
  });

  test("filtre les types par recherche", async ({ ownerPage: page }) => {
    const searchInput = page.getByPlaceholder("Rechercher un type de bien...");
    await searchInput.fill("appartement");
    await page.waitForTimeout(150);

    await expect(page.getByText("Appartement")).toBeVisible();
    await expect(page.getByText("Maison")).not.toBeVisible();
  });

  test("affiche un état vide quand aucun résultat", async ({
    ownerPage: page,
  }) => {
    const searchInput = page.getByPlaceholder("Rechercher un type de bien...");
    await searchInput.fill("xyz123");
    await page.waitForTimeout(150);

    await expect(page.getByText("Aucun type de bien trouvé")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Effacer le filtre" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Effacer le filtre" }).click();
    await expect(page.getByText("Appartement")).toBeVisible();
  });

  test("sélectionne un type en un clic", async ({ ownerPage: page }) => {
    const startTime = Date.now();
    await page.getByRole("option", { name: /Appartement/i }).click();
    expect(Date.now() - startTime).toBeLessThan(7_000);

    await expect(page.getByText("Sélectionné")).toBeVisible();
    const card = page.getByRole("option", { name: /Appartement.*sélectionné/i });
    await expect(card).toHaveAttribute("aria-pressed", "true");
  });

  test("navigation au clavier (flèches)", async ({ ownerPage: page }) => {
    const grid = page.getByRole("listbox");
    await grid.focus();

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(100);

    const firstCard = page.getByRole("option").first();
    await expect(firstCard).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);

    const cards = page.getByRole("option");
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("sélection avec la touche Entrée", async ({ ownerPage: page }) => {
    const grid = page.getByRole("listbox");
    await grid.focus();

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(100);

    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    await expect(page.getByText("Sélectionné")).toBeVisible();
  });

  test("focus rings accessibles", async ({ ownerPage: page }) => {
    const card = page.getByRole("option").first();
    await card.focus();
    await expect(card).toHaveClass(/focus-visible:ring/);
  });

  test("touch target d'au moins 44px", async ({ ownerPage: page }) => {
    const card = page.getByRole("option").first();
    const box = await card.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("passe à l'étape suivante après sélection", async ({
    ownerPage: page,
  }) => {
    await page.getByRole("option", { name: /Appartement/i }).click();
    await page.waitForTimeout(500);

    const continueButton = page.getByRole("button", { name: "Continuer" });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await page.waitForTimeout(500);
  });

  test("footer sticky sur viewport mobile", async ({ ownerPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.evaluate(() => window.scrollTo(0, 1000));

    const footer = page.getByRole("button", { name: "Continuer" });
    await expect(footer).toBeVisible();
  });

  test("respecte la préférence reduced motion", async ({
    ownerPage: page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.waitForSelector('[role="listbox"]');

    const card = page.getByRole("option").first();
    await card.hover();
    // Le composant utilise useReducedMotion : pas d'assertion directe sur les
    // animations, mais la page reste fonctionnelle.
    await expect(card).toBeVisible();
  });
});
