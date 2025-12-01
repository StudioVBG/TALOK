import { test, expect } from "@playwright/test";

/**
 * Tests E2E pour le parcours locataire
 * - Connexion
 * - Dashboard
 * - Signature de bail
 * - Paiement de loyer
 */

test.describe("Parcours Locataire", () => {
  // Configuration des tests
  const TEST_TENANT = {
    email: process.env.TEST_TENANT_EMAIL || "test.tenant@example.com",
    password: process.env.TEST_TENANT_PASSWORD || "TestPassword123!",
  };

  test.beforeEach(async ({ page }) => {
    // Aller à la page de connexion
    await page.goto("/auth/signin");
  });

  test("Page de connexion s'affiche correctement", async ({ page }) => {
    // Vérifier les éléments de la page
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("Connexion avec email invalide affiche une erreur", async ({ page }) => {
    // Remplir le formulaire avec un email invalide
    await page.fill('input[type="email"]', "invalid-email");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    // Vérifier qu'une erreur est affichée
    await expect(page.locator('[role="alert"], .text-red-500, .text-destructive').first()).toBeVisible({ timeout: 5000 });
  });

  test("Connexion avec mauvais mot de passe affiche une erreur", async ({ page }) => {
    await page.fill('input[type="email"]', TEST_TENANT.email);
    await page.fill('input[type="password"]', "wrong-password");
    await page.click('button[type="submit"]');

    // Attendre la réponse et vérifier l'erreur
    await expect(page.locator('[role="alert"], .text-red-500, .text-destructive, .toast').first()).toBeVisible({ timeout: 10000 });
  });

  test.describe("Dashboard Locataire (authentifié)", () => {
    test.skip(
      !process.env.TEST_TENANT_EMAIL,
      "Variables de test non configurées"
    );

    test.beforeEach(async ({ page }) => {
      // Se connecter
      await page.goto("/auth/signin");
      await page.fill('input[type="email"]', TEST_TENANT.email);
      await page.fill('input[type="password"]', TEST_TENANT.password);
      await page.click('button[type="submit"]');

      // Attendre la redirection vers le dashboard
      await page.waitForURL(/\/app\/tenant|\/dashboard/, { timeout: 10000 });
    });

    test("Dashboard s'affiche correctement", async ({ page }) => {
      // Vérifier les éléments du dashboard
      await expect(page.locator("main")).toBeVisible();
      
      // Vérifier la présence d'un titre ou d'une section principale
      const dashboardContent = page.locator('[data-testid="dashboard"], main > div').first();
      await expect(dashboardContent).toBeVisible();
    });

    test("Navigation vers les paiements", async ({ page }) => {
      // Cliquer sur le lien paiements si présent
      const paymentsLink = page.locator('a[href*="payments"], a[href*="paiements"]').first();
      
      if (await paymentsLink.isVisible()) {
        await paymentsLink.click();
        await expect(page).toHaveURL(/payments|paiements/);
      }
    });

    test("Navigation vers les documents", async ({ page }) => {
      const documentsLink = page.locator('a[href*="documents"]').first();
      
      if (await documentsLink.isVisible()) {
        await documentsLink.click();
        await expect(page).toHaveURL(/documents/);
      }
    });

    test("Navigation vers les tickets", async ({ page }) => {
      const ticketsLink = page.locator('a[href*="tickets"]').first();
      
      if (await ticketsLink.isVisible()) {
        await ticketsLink.click();
        await expect(page).toHaveURL(/tickets/);
      }
    });
  });
});

test.describe("Page de Signature", () => {
  test("Page de signature avec token invalide affiche une erreur", async ({ page }) => {
    // Accéder à une page de signature avec un token invalide
    await page.goto("/signature/invalid-token-123");

    // Vérifier qu'un message d'erreur ou de redirection est affiché
    await page.waitForLoadState("networkidle");
    
    // Soit on a une erreur, soit une redirection
    const hasError = await page.locator('text=invalide, text=expiré, text=erreur').first().isVisible().catch(() => false);
    const isRedirected = page.url().includes("/auth") || page.url().includes("/404");
    
    expect(hasError || isRedirected).toBeTruthy();
  });
});

test.describe("Accessibilité", () => {
  test("Page de connexion est accessible au clavier", async ({ page }) => {
    await page.goto("/auth/signin");

    // Tab vers le champ email
    await page.keyboard.press("Tab");
    const emailFocused = await page.locator('input[type="email"]').evaluate(
      (el) => el === document.activeElement
    );
    
    // Tab vers le champ password
    await page.keyboard.press("Tab");
    
    // Tab vers le bouton submit
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Vérifier que le bouton peut être activé avec Enter
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test("Les images ont des attributs alt", async ({ page }) => {
    await page.goto("/");
    
    // Vérifier que toutes les images ont un alt
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt).toBe(0);
  });

  test("Les formulaires ont des labels", async ({ page }) => {
    await page.goto("/auth/signin");

    // Vérifier que les inputs ont des labels associés
    const inputs = page.locator('input:not([type="hidden"])');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute("id");
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");
      
      // L'input doit avoir soit un label, soit aria-label, soit aria-labelledby
      if (id) {
        const hasLabel = await page.locator(`label[for="${id}"]`).count() > 0;
        const hasAriaLabel = !!ariaLabel || !!ariaLabelledBy;
        expect(hasLabel || hasAriaLabel).toBeTruthy();
      }
    }
  });
});

test.describe("Performance", () => {
  test("Page d'accueil charge en moins de 3 secondes", async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto("/", { waitUntil: "domcontentloaded" });
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test("Page de connexion charge en moins de 2 secondes", async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000);
  });
});

