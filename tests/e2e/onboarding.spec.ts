/**
 * E2E — Onboarding (parcours complet d'inscription).
 *
 * Refactor : utilise le catalogue de routes. Les emails de test sont
 * générés à la volée pour chaque run (pas d'env var nécessaire).
 */

import { test, expect } from "@playwright/test";
import { routes } from "./helpers/routes";

const TEST_PASSWORD = "Test12345!2025";
const fresh = (prefix: string) => `${prefix}-${Date.now()}@example.com`;

test.describe("Onboarding Propriétaire", () => {
  test("Parcours complet d'inscription propriétaire", async ({ page }) => {
    const email = fresh("test-owner");

    await page.goto(routes.signup.role);
    await page.click('button:has-text("Choisir Propriétaire")');
    await expect(page).toHaveURL(/\/signup\/account.*role=owner/, {
      timeout: 10_000,
    });

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/signup\/verify-email/, {
      timeout: 10_000,
    });
  });
});

test.describe("Onboarding Locataire", () => {
  test("Parcours complet d'inscription locataire", async ({ page }) => {
    const email = fresh("test-tenant");

    await page.goto(routes.signup.role);
    await page.click('button:has-text("Choisir Locataire")');
    await expect(page).toHaveURL(/\/signup\/account.*role=tenant/, {
      timeout: 10_000,
    });

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/signup\/verify-email/, {
      timeout: 10_000,
    });
  });
});
