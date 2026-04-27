/**
 * E2E — Module comptabilité (parcours owner)
 *
 * Scope volontairement étroit : on valide que les pages comptables clés
 * chargent sans erreur pour un owner authentifié, et que les actions
 * d'export FEC sont accessibles. Les flux qui dépendent de données
 * existantes en base (créer/payer une facture, générer un CRG, etc.) sont
 * laissés à des suites dédiées qui géreront leur propre seeding.
 *
 * N'utilise plus d'identifiants en dur : les credentials owner sont chargés
 * via la fixture `ownerPage` (storage state préchauffé par global-setup).
 */

import { test, expect } from "./fixtures/auth";
import { routes } from "./helpers/routes";

test.describe("Comptabilité owner — pages principales", () => {
  test("Dashboard comptabilité charge", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.accounting.root);
    await expect(page).toHaveURL(/\/owner\/accounting/);
    // Le dashboard ne doit pas dégrader vers une 500
    await expect(page.locator("text=/erreur serveur|500/i")).toHaveCount(0);
  });

  test("Balance générale s'affiche", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.accounting.balance);
    await expect(
      page.getByRole("heading", { name: /Balance générale/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Grand livre s'affiche", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.accounting.grandLivre);
    await expect(
      page.getByRole("heading", { name: /Grand livre/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Page Écritures comptables s'affiche", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.accounting.entries);
    await expect(
      page.getByRole("heading", { name: /Écritures comptables|Ecritures comptables/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Page Exports comptables s'affiche et expose le panneau FEC", async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.accounting.exports);
    await expect(
      page.getByRole("heading", { name: /Exports comptables/i }),
    ).toBeVisible({ timeout: 15_000 });
    // Mention FEC quelque part sur la page
    await expect(page.getByText(/FEC/).first()).toBeVisible();
  });

  test("Page Déclarations fiscales s'affiche", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.accounting.declarations);
    await expect(
      page.getByRole("heading", { name: /declaration fiscale/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Plan comptable s'affiche", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.accounting.chart);
    await expect(page).toHaveURL(/\/owner\/accounting\/chart/);
  });

  test("Page Exercices s'affiche", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.accounting.exercises);
    await expect(page).toHaveURL(/\/owner\/accounting\/exercises/);
  });
});

test.describe("Comptabilité owner — santé runtime", () => {
  test("Pas d'erreur JS critique sur le dashboard accounting", async ({
    ownerPage: page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(routes.owner.accounting.root);
    await page.waitForLoadState("networkidle");

    const critical = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("analytics") &&
        !e.includes("extension"),
    );
    expect(critical).toHaveLength(0);
  });
});
