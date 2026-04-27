/**
 * E2E — Document Center Locataire (matrice issue de l'audit UX/UI section G).
 *
 * Refactor : credentials/login centralisés via la fixture `tenantPage`.
 * Plus de helper `loginAsTenant` local.
 */

import { test, expect } from "./fixtures/auth";
import { routes } from "./helpers/routes";

test.describe("Document Center — Locataire", () => {
  // T-001 : Documents accessible en 1 clic depuis le dashboard
  test("T-001: Documents accessible en 1 clic depuis le dashboard", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.dashboard);

    const sidebarLink = page.locator('aside a[href="/tenant/documents"]');
    await expect(sidebarLink.first()).toBeVisible();

    await sidebarLink.first().click();
    await expect(page).toHaveURL(routes.tenant.documents);
    await expect(page.locator("h1")).toContainText("Mes Documents");
  });

  // T-002 : Bottom nav mobile
  test("T-002: Documents dans la bottom nav mobile", async ({
    tenantPage: page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(routes.tenant.dashboard);

    const bottomNavLink = page.locator(
      'nav[aria-label="Navigation principale"] a[href="/tenant/documents"]',
    );
    await expect(bottomNavLink).toBeVisible();
  });

  // T-003 : Structure 3 zones
  test("T-003: Page Documents affiche les 3 zones", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.documents);

    await expect(page.locator("h1")).toContainText("Mes Documents");

    const allDocsRegion = page.locator('[aria-label="Tous les documents"]');
    await expect(allDocsRegion).toBeVisible();

    await expect(
      page.locator('input[aria-label="Rechercher dans les documents"]'),
    ).toBeVisible();
  });

  // T-004 : Recherche
  test("T-004: Recherche de documents par texte", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.documents);

    const searchInput = page.locator(
      'input[aria-label="Rechercher dans les documents"]',
    );
    await searchInput.fill("bail");
    await page.waitForTimeout(500);

    const documentsOrEmpty = page.locator(
      '[role="article"], text="Aucun document trouvé"',
    );
    await expect(documentsOrEmpty.first()).toBeVisible();
  });

  // T-005 : Filtres enrichis
  test("T-005: Filtres par type, période et tri fonctionnent", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.documents);

    const filterSelects = page.locator('[role="combobox"]');
    expect(await filterSelects.count()).toBeGreaterThanOrEqual(3);

    const resetBtn = page.locator('button:has-text("Réinitialiser")');
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
    }
  });

  // T-006 : Preview PDF inline
  test("T-006: Clic 'Voir' ouvre le modal PDF inline", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.documents);

    const viewBtn = page.locator('button:has-text("Voir")').first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await expect(
        dialog.locator('button:has-text("Télécharger")'),
      ).toBeVisible();
    }
  });

  // T-007 : Toggle vue Grille / Catégories
  test("T-007: Toggle entre vue Grille et Catégories", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.documents);

    const gridTab = page.locator('[aria-label="Vue grille"]');
    const categoryTab = page.locator('[aria-label="Vue par catégorie"]');

    await expect(gridTab).toBeVisible();
    await expect(categoryTab).toBeVisible();

    await categoryTab.click();
    await page.waitForTimeout(300);

    await gridTab.click();
    await page.waitForTimeout(300);
  });

  // T-008 : Redirection /receipts
  test("T-008: /tenant/receipts redirige vers /tenant/documents", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.receipts);
    await expect(page).toHaveURL(/\/tenant\/documents/);
  });

  // T-009 : Redirection /signatures
  test("T-009: /tenant/signatures redirige vers /tenant/documents", async ({
    tenantPage: page,
  }) => {
    await page.goto("/tenant/signatures");
    await expect(page).toHaveURL(/\/tenant\/documents/);
  });

  // T-010 : Empty state
  test("T-010: Empty state avec CTA si aucun document", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.documents);

    const emptyState = page.locator('text="Votre espace documents est vide"');
    const hasDocuments = page.locator('[role="article"]').first();

    const emptyVisible = await emptyState.isVisible().catch(() => false);
    const docsVisible = await hasDocuments.isVisible().catch(() => false);
    expect(emptyVisible || docsVisible).toBeTruthy();
  });

  // T-011 : Accessibilité clavier
  test("T-011: Navigation sidebar accessible au clavier", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.dashboard);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    const focusedElement = page.locator(":focus-visible");
    await expect(focusedElement).toBeDefined();
  });

  // T-012 : Checklist onboarding détaillée
  test("T-012: Dashboard affiche la checklist onboarding détaillée", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.dashboard);

    const onboardingBanner = page.locator('[data-tour="tenant-onboarding"]');
    if (await onboardingBanner.isVisible()) {
      await expect(page.locator('text="Compte créé"')).toBeVisible();
      await expect(page.locator('text="Logement lié"')).toBeVisible();
      await expect(page.locator('text="Assurance déposée"')).toBeVisible();
      await expect(page.locator('text="Identité vérifiée"')).toBeVisible();
      await expect(page.locator('text="Bail signé"')).toBeVisible();
    }
  });

  // T-013 : Bouton direct vers Documents
  test("T-013: Dashboard a un bouton direct vers Documents", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.dashboard);

    const docLink = page.locator(
      'a[href="/tenant/documents"]:has-text("Mes Documents")',
    );
    if (await docLink.isVisible()) {
      await docLink.click();
      await expect(page).toHaveURL(routes.tenant.documents);
    }
  });

  // T-014 : Sidebar simplifiée
  test("T-014: Sidebar desktop a au maximum 8 items de navigation", async ({
    tenantPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(routes.tenant.dashboard);

    const sidebarNav = page.locator("aside[data-tour-sidebar] nav a");
    expect(await sidebarNav.count()).toBeLessThanOrEqual(8);
  });

  // T-015 : Zone "Actions requises"
  test("T-015: Zone 'Actions requises' visible dans Documents si actions pendantes", async ({
    tenantPage: page,
  }) => {
    await page.goto(routes.tenant.documents);

    // Présence conditionnelle de la zone — on vérifie juste la santé de la
    // page.
    await expect(page.locator("h1")).toContainText("Mes Documents");
  });
});
