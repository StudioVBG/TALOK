/**
 * Tests E2E - Authentification
 * 
 * Sources:
 * - Playwright Testing: https://playwright.dev/docs/intro
 * - Supabase Auth: https://supabase.com/docs/guides/auth
 * - Next.js Testing: https://nextjs.org/docs/app/building-your-application/testing
 * 
 * Dates de test: Octobre et Novembre 2025
 */

import { test, expect } from "@playwright/test";

const TEST_CREDENTIALS = {
  admin: {
    email: "support@talok.fr",
    password: "Test12345!2025",
  },
  owner: {
    email: "contact.explore.mq@gmail.com",
    password: "Test12345!2025",
  },
  tenant: {
    email: "garybissol@yahoo.fr",
    password: "Test12345!2025",
  },
};

test.describe("Authentification", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Connexion Admin - Test réel", async ({ page }) => {
    // Aller directement à la page de connexion
    await page.goto("/auth/signin");
    await expect(page).toHaveURL(/.*\/auth\/signin/);

    // Remplir le formulaire avec les vraies credentials
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);

    // Soumettre
    await page.click('button:has-text("Se connecter")');

    // Vérifier la redirection vers le dashboard admin
    await expect(page).toHaveURL(/.*\/admin\/dashboard/, { timeout: 10000 });

    // Vérifier que l'utilisateur est connecté
    await expect(page.locator('text="Administrateur"')).toBeVisible();
  });

  test("Connexion Propriétaire - Test réel", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page).toHaveURL(/.*\/auth\/signin/);

    await page.fill('input[type="email"]', TEST_CREDENTIALS.owner.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.owner.password);
    await page.click('button:has-text("Se connecter")');

    // Vérifier la redirection
    await expect(page).toHaveURL(/.*\/app\/owner/, { timeout: 10000 });
    await expect(page.locator('text="Propriétaire"')).toBeVisible();
  });

  test("Connexion Locataire - Test réel", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page).toHaveURL(/.*\/auth\/signin/);

    await page.fill('input[type="email"]', TEST_CREDENTIALS.tenant.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.tenant.password);
    await page.click('button:has-text("Se connecter")');

    // Vérifier la redirection
    await expect(page).toHaveURL(/.*\/app\/tenant/, { timeout: 10000 });
    await expect(page.locator('text="Locataire"')).toBeVisible();
  });

  test("Déconnexion - Test réel", async ({ page }) => {
    // Se connecter d'abord
    await page.goto("/auth/signin");
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button:has-text("Se connecter")');
    await expect(page).toHaveURL(/.*\/admin\/dashboard/, { timeout: 10000 });

    // Déconnexion
    await page.click('button:has([data-testid="user-menu"])');
    await page.click('text="Déconnexion"');

    // Vérifier la redirection vers la page d'accueil
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.locator('text="Se connecter"')).toBeVisible();
  });

  test("Erreur de connexion avec mauvais mot de passe", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', "MauvaisMotDePasse123!");
    await page.click('button:has-text("Se connecter")');

    // Vérifier le message d'erreur
    await expect(page.locator('text=/erreur|invalid|incorrect/i')).toBeVisible({ timeout: 5000 });
  });
});

