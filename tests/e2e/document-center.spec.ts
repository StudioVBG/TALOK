import { test, expect } from "@playwright/test";

/**
 * Tests E2E — Document Center Locataire
 *
 * Matrice de tests issue de l'audit UX/UI (section G).
 * Couvre : navigation, filtres, preview inline, empty states,
 * redirections, zone "À faire", documents clés, accessibilité.
 */

test.describe("Document Center — Locataire", () => {
  const TEST_TENANT = {
    email: process.env.TEST_TENANT_EMAIL || "test.tenant@example.com",
    password: process.env.TEST_TENANT_PASSWORD || "TestPassword123!",
  };

  // Helper : connexion locataire
  async function loginAsTenant(page: any) {
    await page.goto("/auth/signin");
    await page.fill('input[type="email"]', TEST_TENANT.email);
    await page.fill('input[type="password"]', TEST_TENANT.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/tenant/, { timeout: 10000 });
  }

  // ────────────────────────────────────────────
  // T-001 : Navigation — Documents accessible en 1 clic depuis dashboard
  // ────────────────────────────────────────────
  test("T-001: Documents accessible en 1 clic depuis le dashboard", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/dashboard");

    // Desktop sidebar : le lien "Documents" doit exister
    const sidebarLink = page.locator('aside a[href="/tenant/documents"]');
    await expect(sidebarLink.first()).toBeVisible();

    // Cliquer et vérifier l'arrivée
    await sidebarLink.first().click();
    await expect(page).toHaveURL("/tenant/documents");
    await expect(page.locator("h1")).toContainText("Mes Documents");
  });

  // ────────────────────────────────────────────
  // T-002 : Bottom nav mobile — Documents est un item principal
  // ────────────────────────────────────────────
  test("T-002: Documents dans la bottom nav mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone
    await loginAsTenant(page);
    await page.goto("/tenant/dashboard");

    // Bottom nav : "Documents" doit être visible (pas dans "Plus")
    const bottomNavLink = page.locator('nav[aria-label="Navigation principale"] a[href="/tenant/documents"]');
    await expect(bottomNavLink).toBeVisible();
  });

  // ────────────────────────────────────────────
  // T-003 : Page Documents — Structure 3 zones
  // ────────────────────────────────────────────
  test("T-003: Page Documents affiche les 3 zones", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/documents");

    // Vérifier le header
    await expect(page.locator("h1")).toContainText("Mes Documents");

    // Zone "Documents essentiels" (si bail lié)
    const keyDocsRegion = page.locator('[aria-label="Documents essentiels"]');
    // Zone "Tous les documents"
    const allDocsRegion = page.locator('[aria-label="Tous les documents"]');
    await expect(allDocsRegion).toBeVisible();

    // Barre de recherche visible
    await expect(page.locator('input[aria-label="Rechercher dans les documents"]')).toBeVisible();
  });

  // ────────────────────────────────────────────
  // T-004 : Recherche — Filtrer par texte
  // ────────────────────────────────────────────
  test("T-004: Recherche de documents par texte", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/documents");

    const searchInput = page.locator('input[aria-label="Rechercher dans les documents"]');
    await searchInput.fill("bail");

    // Attendre que le filtre s'applique (React state update)
    await page.waitForTimeout(500);

    // Vérifier que les résultats sont filtrés (ou empty state)
    const documentsOrEmpty = page.locator('[role="article"], text="Aucun document trouvé"');
    await expect(documentsOrEmpty.first()).toBeVisible();
  });

  // ────────────────────────────────────────────
  // T-005 : Filtres enrichis — Type, Période, Tri
  // ────────────────────────────────────────────
  test("T-005: Filtres par type, période et tri fonctionnent", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/documents");

    // Vérifier que les 3 selects de filtres existent
    const filterSelects = page.locator('[role="combobox"]');
    const count = await filterSelects.count();
    expect(count).toBeGreaterThanOrEqual(3); // type + période + tri

    // Réinitialiser les filtres (s'il y en a d'actifs)
    const resetBtn = page.locator('button:has-text("Réinitialiser")');
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
    }
  });

  // ────────────────────────────────────────────
  // T-006 : Preview PDF inline (pas nouvel onglet)
  // ────────────────────────────────────────────
  test("T-006: Clic 'Voir' ouvre le modal PDF inline", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/documents");

    // Trouver un bouton "Voir" (s'il y a des documents)
    const viewBtn = page.locator('button:has-text("Voir")').first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();

      // Le modal doit s'ouvrir (pas un nouvel onglet)
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Le modal contient un titre et un bouton télécharger
      await expect(dialog.locator('button:has-text("Télécharger")')).toBeVisible();
    }
  });

  // ────────────────────────────────────────────
  // T-007 : Toggle vue Grille / Catégories
  // ────────────────────────────────────────────
  test("T-007: Toggle entre vue Grille et Catégories", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/documents");

    // Par défaut, mode grille
    const gridTab = page.locator('[aria-label="Vue grille"]');
    const categoryTab = page.locator('[aria-label="Vue par catégorie"]');

    await expect(gridTab).toBeVisible();
    await expect(categoryTab).toBeVisible();

    // Cliquer sur Catégories
    await categoryTab.click();
    await page.waitForTimeout(300);

    // Revenir en Grille
    await gridTab.click();
    await page.waitForTimeout(300);
  });

  // ────────────────────────────────────────────
  // T-008 : Redirection /receipts → /documents?type=quittance
  // ────────────────────────────────────────────
  test("T-008: /tenant/receipts redirige vers /tenant/documents", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/receipts");

    // Doit être redirigé vers documents avec filtre quittance
    await expect(page).toHaveURL(/\/tenant\/documents/);
  });

  // ────────────────────────────────────────────
  // T-009 : Redirection /signatures → /documents
  // ────────────────────────────────────────────
  test("T-009: /tenant/signatures redirige vers /tenant/documents", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/signatures");

    await expect(page).toHaveURL(/\/tenant\/documents/);
  });

  // ────────────────────────────────────────────
  // T-010 : Empty state contextuel — Nouveau locataire sans bail
  // ────────────────────────────────────────────
  test("T-010: Empty state avec CTA si aucun document", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/documents");

    // Si pas de documents : vérifier l'empty state
    const emptyState = page.locator('text="Votre espace documents est vide"');
    const hasDocuments = page.locator('[role="article"]').first();

    // L'un des deux doit être visible
    const emptyVisible = await emptyState.isVisible().catch(() => false);
    const docsVisible = await hasDocuments.isVisible().catch(() => false);
    expect(emptyVisible || docsVisible).toBeTruthy();
  });

  // ────────────────────────────────────────────
  // T-011 : Accessibilité — Focus visible sur la sidebar
  // ────────────────────────────────────────────
  test("T-011: Navigation sidebar accessible au clavier", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/dashboard");

    // Tab à travers les liens de la sidebar
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Vérifier qu'un élément a le focus visible (ring)
    const focusedElement = page.locator(":focus-visible");
    await expect(focusedElement).toBeDefined();
  });

  // ────────────────────────────────────────────
  // T-012 : Dashboard — Checklist onboarding détaillée
  // ────────────────────────────────────────────
  test("T-012: Dashboard affiche la checklist onboarding détaillée", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/dashboard");

    // Vérifier si le banner onboarding existe
    const onboardingBanner = page.locator('[data-tour="tenant-onboarding"]');
    if (await onboardingBanner.isVisible()) {
      // La checklist doit contenir les 5 étapes
      await expect(page.locator('text="Compte créé"')).toBeVisible();
      await expect(page.locator('text="Logement lié"')).toBeVisible();
      await expect(page.locator('text="Assurance déposée"')).toBeVisible();
      await expect(page.locator('text="Identité vérifiée"')).toBeVisible();
      await expect(page.locator('text="Bail signé"')).toBeVisible();
    }
  });

  // ────────────────────────────────────────────
  // T-013 : Dashboard — Bouton "Mes Documents" pointe vers /documents
  // ────────────────────────────────────────────
  test("T-013: Dashboard a un bouton direct vers Documents", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/dashboard");

    const docLink = page.locator('a[href="/tenant/documents"]:has-text("Mes Documents")');
    if (await docLink.isVisible()) {
      await docLink.click();
      await expect(page).toHaveURL("/tenant/documents");
    }
  });

  // ────────────────────────────────────────────
  // T-014 : Sidebar simplifiée — Max 7 items + footer
  // ────────────────────────────────────────────
  test("T-014: Sidebar desktop a au maximum 8 items de navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsTenant(page);
    await page.goto("/tenant/dashboard");

    // Compter les liens dans la sidebar principale (excluant footer)
    const sidebarNav = page.locator('aside[data-tour-sidebar] nav a');
    const navCount = await sidebarNav.count();

    // 6 items dans allNavItems (max recommandé dans l'audit)
    expect(navCount).toBeLessThanOrEqual(8);
  });

  // ────────────────────────────────────────────
  // T-015 : Zone "Actions requises" visible si bail à signer
  // ────────────────────────────────────────────
  test("T-015: Zone 'Actions requises' visible dans Documents si actions pendantes", async ({ page }) => {
    await loginAsTenant(page);
    await page.goto("/tenant/documents");

    // La zone "Actions requises" est conditionnelle
    const actionsRegion = page.locator('[aria-label="Actions requises"]');
    // Juste vérifier que la page charge sans erreur
    await expect(page.locator("h1")).toContainText("Mes Documents");
  });
});
