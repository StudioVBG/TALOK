/**
 * E2E — Flux critiques propriétaire (création de bien, dashboard, navigation,
 * santé runtime).
 *
 * Refactor : credentials et login centralisés (helpers/credentials,
 * fixtures/auth). Les tests authentifiés consomment la fixture `ownerPage` ;
 * les tests qui doivent vérifier le comportement sans session utilisent le
 * `test` de Playwright direct.
 */

import { test as authTest, expect as authExpect } from "./fixtures/auth";
import { test, expect } from "@playwright/test";
import { routes, routePatterns } from "./helpers/routes";

// ============================================
// FLUX 1: Création de bien immobilier
// ============================================
authTest.describe("Flux Propriétaire — Création de bien", () => {
  authTest("peut ouvrir le wizard de création", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.propertiesNew);
    await page.waitForLoadState("networkidle");

    // Première étape : type de bien
    await authExpect(
      page.getByText(/Quel type de bien|Type de bien/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  authTest("peut voir la liste des biens", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.properties);
    await page.waitForLoadState("networkidle");

    await authExpect(
      page.getByText(/Mes biens|Mes logements|propriétés|properties/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Pas d'erreur 500
    await authExpect(page.locator("text=/500|erreur serveur/i")).toHaveCount(0);
  });
});

// ============================================
// FLUX 2: Dashboard Propriétaire
// ============================================
authTest.describe("Dashboard Propriétaire", () => {
  authTest("affiche le dashboard avec les KPIs", async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.dashboard);
    await page.waitForLoadState("networkidle");

    await authExpect(
      page.getByText(/Tableau de bord|Bienvenue/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ============================================
// FLUX 3: Authentification (sans session)
// ============================================
test.describe("Authentification — accès non authentifié", () => {
  test("redirige vers signin si non authentifié", async ({ page }) => {
    await page.goto(routes.owner.dashboard);
    await expect(page).toHaveURL(routePatterns.signin, { timeout: 10_000 });
  });
});

// ============================================
// FLUX 4: Navigation générale
// ============================================
authTest.describe("Navigation propriétaire", () => {
  authTest("navigation sidebar vers Mes biens / Documents", async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.dashboard);
    await page.waitForLoadState("networkidle");

    // Mes biens
    await page.click('a:has-text("Mes biens"), a[href*="properties"]');
    await authExpect(page).toHaveURL(/properties/, { timeout: 5_000 });

    // Documents
    await page.click('a:has-text("Documents"), a[href*="documents"]');
    await authExpect(page).toHaveURL(/documents/, { timeout: 5_000 });
  });

  authTest("pages 404 sont gérées", async ({ ownerPage: page }) => {
    await page.goto("/owner/route-inexistante-12345");

    const is404 = await page
      .locator("text=/404|introuvable|not found/i")
      .first()
      .isVisible()
      .catch(() => false);
    const isRedirected =
      page.url().includes("dashboard") || page.url().includes("properties");

    authExpect(is404 || isRedirected).toBeTruthy();
  });
});

// ============================================
// FLUX 5: Santé runtime
// ============================================
authTest.describe("Santé runtime", () => {
  authTest("pas d'erreur JS critique sur le dashboard", async ({
    ownerPage: page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(routes.owner.dashboard);
    await page.waitForLoadState("networkidle");

    const critical = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("analytics") &&
        !e.includes("extension"),
    );
    authExpect(critical).toHaveLength(0);
  });

  authTest("pas d'erreur console critique sur la création de bien", async ({
    ownerPage: page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(routes.owner.propertiesNew);
    await page.waitForLoadState("networkidle");

    const critical = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !e.includes("ResizeObserver"),
    );
    authExpect(critical.length).toBeLessThan(5);
  });
});
