/**
 * E2E — Parcours locataire (page de connexion, dashboard, navigation,
 * accessibilité, performance).
 *
 * Refactor : credentials/login centralisés. Les tests authentifiés consomment
 * la fixture `tenantPage` ; les tests publics ou de la page de login
 * utilisent le `test` Playwright direct.
 */

import { test as authTest, expect as authExpect } from "./fixtures/auth";
import { test, expect } from "@playwright/test";
import { routes } from "./helpers/routes";

// ============================================
// Page de connexion
// ============================================
test.describe("Page de connexion", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(routes.auth.signin);
  });

  test("Page de connexion s'affiche correctement", async ({ page }) => {
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("Connexion avec email invalide affiche une erreur", async ({ page }) => {
    await page.locator("#email").fill("invalid-email");
    await page.locator("#password").fill("password123");
    await page.locator('button[type="submit"]').click();

    await expect(
      page
        .locator('[role="alert"], .text-red-500, .text-destructive')
        .first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ============================================
// Dashboard Locataire (authentifié via fixture)
// ============================================
authTest.describe("Dashboard Locataire", () => {
  authTest("Dashboard s'affiche correctement", async ({ tenantPage: page }) => {
    await page.goto(routes.tenant.dashboard);
    await authExpect(page.locator("main")).toBeVisible();

    const dashboardContent = page
      .locator('[data-testid="dashboard"], main > div')
      .first();
    await authExpect(dashboardContent).toBeVisible();
  });

  authTest("Navigation vers les paiements", async ({ tenantPage: page }) => {
    await page.goto(routes.tenant.dashboard);
    const paymentsLink = page
      .locator('a[href*="payments"], a[href*="paiements"]')
      .first();

    if (await paymentsLink.isVisible()) {
      await paymentsLink.click();
      await authExpect(page).toHaveURL(/payments|paiements/);
    }
  });

  authTest(
    "Retour Stripe succès sur les paiements nettoie l'URL",
    async ({ tenantPage: page }) => {
      await page.goto(`${routes.tenant.payments}?success=true&invoice=test-invoice`);

      await authExpect(
        page.getByText("Paiement en cours de synchronisation"),
      ).toBeVisible();
      await authExpect(page).toHaveURL(/\/tenant\/payments$/);
    },
  );

  authTest("Navigation vers les documents", async ({ tenantPage: page }) => {
    await page.goto(routes.tenant.dashboard);
    const documentsLink = page.locator('a[href*="documents"]').first();

    if (await documentsLink.isVisible()) {
      await documentsLink.click();
      await authExpect(page).toHaveURL(/documents/);
    }
  });
});

// ============================================
// Page de signature (publique)
// ============================================
test.describe("Page de Signature", () => {
  test("Token invalide affiche une erreur ou redirige", async ({ page }) => {
    await page.goto(routes.signature.page("invalid-token-123"));
    await page.waitForLoadState("networkidle");

    const hasError = await page
      .locator("text=/invalide|expiré|erreur/i")
      .first()
      .isVisible()
      .catch(() => false);
    const isRedirected =
      page.url().includes("/auth") || page.url().includes("/404");

    expect(hasError || isRedirected).toBeTruthy();
  });
});

// ============================================
// Accessibilité (publique)
// ============================================
test.describe("Accessibilité", () => {
  test("Page de connexion est accessible au clavier", async ({ page }) => {
    await page.goto(routes.auth.signin);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test("Les images ont des attributs alt", async ({ page }) => {
    await page.goto(routes.home);
    const imagesWithoutAlt = await page.locator("img:not([alt])").count();
    expect(imagesWithoutAlt).toBe(0);
  });

  test("Les formulaires ont des labels", async ({ page }) => {
    await page.goto(routes.auth.signin);

    const inputs = page.locator('input:not([type="hidden"])');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute("id");
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");

      if (id) {
        const hasLabel = (await page.locator(`label[for="${id}"]`).count()) > 0;
        const hasAriaLabel = !!ariaLabel || !!ariaLabelledBy;
        expect(hasLabel || hasAriaLabel).toBeTruthy();
      }
    }
  });
});

// ============================================
// Performance (publique)
// ============================================
test.describe("Performance", () => {
  test("Page d'accueil charge en moins de 3 secondes", async ({ page }) => {
    const startTime = Date.now();
    await page.goto(routes.home, { waitUntil: "domcontentloaded" });
    expect(Date.now() - startTime).toBeLessThan(3_000);
  });

  test("Page de connexion charge en moins de 2 secondes", async ({ page }) => {
    const startTime = Date.now();
    await page.goto(routes.auth.signin, { waitUntil: "domcontentloaded" });
    expect(Date.now() - startTime).toBeLessThan(2_000);
  });
});
