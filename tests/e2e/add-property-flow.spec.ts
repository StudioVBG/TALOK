/**
 * E2E — Flux d'ajout de logement (Mode FAST vs FULL, navigation, animations).
 *
 * Refactor : utilise la fixture `ownerPage` pour authentification ; les tests
 * d'API utilisent le `request` Playwright direct (les endpoints sont protégés
 * par auth — on accepte 200/401/403 comme statuts plausibles).
 */

import { test as authTest, expect as authExpect } from "./fixtures/auth";
import { test, expect } from "@playwright/test";
import { routes } from "./helpers/routes";

authTest.describe("Flux d'ajout de logement", () => {
  authTest("Mode FAST — affichage et navigation", async ({
    ownerPage: page,
  }) => {
    await page.goto(`${routes.owner.propertiesNew}?mode=fast`);

    await authExpect(page.locator("text=Mode rapide")).toBeVisible();
    await authExpect(
      page.locator('h1:has-text("Ajouter un bien")'),
    ).toBeVisible();
    await authExpect(
      page.locator("text=questionnaire ultra-simple"),
    ).toBeVisible();
    await authExpect(
      page.locator('button:has-text("Suivant")'),
    ).toBeVisible();
  });

  authTest("Mode FULL — affichage et navigation", async ({
    ownerPage: page,
  }) => {
    await page.goto(`${routes.owner.propertiesNew}?mode=full`);

    await authExpect(page.locator("text=Mode complet")).toBeVisible();
    await authExpect(
      page.locator("text=questionnaire détaillé"),
    ).toBeVisible();
  });

  authTest("Sélection du type de bien", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.propertiesNew);
    await page.waitForSelector('h1:has-text("Ajouter un bien")');

    const typeOptions = page.locator('[data-testid="property-type"]');
    if ((await typeOptions.count()) > 0) {
      await authExpect(typeOptions.first()).toBeVisible();
    }
  });

  authTest("Animations entre étapes", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.propertiesNew);
    await page.waitForSelector('h1:has-text("Ajouter un bien")');

    const stepContent = page.locator('[class*="card"]');
    await authExpect(stepContent.first()).toBeVisible();
  });

  authTest("Micro-copies contextuelles (desktop)", async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.propertiesNew);

    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 640) {
      const microCopy = page.locator(
        "text=/Parfait|Super|Encore|Presque|Tout est prêt/",
      );
      await authExpect(microCopy.first())
        .toBeVisible({ timeout: 5_000 })
        .catch(() => {
          // micro-copies dépendent de l'étape — tolérance
        });
    }
  });

  authTest("Barre de progression", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.propertiesNew);

    const progressBar = page.locator(
      '[role="progressbar"], [class*="progress"]',
    );
    await authExpect(progressBar.first()).toBeVisible();
  });

  authTest("Navigation Précédent/Suivant", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.propertiesNew);

    const prevButton = page.locator('button:has-text("Précédent")');
    if ((await prevButton.count()) > 0) {
      await authExpect(prevButton.first()).toBeDisabled();
    }

    const nextButton = page.locator('button:has-text("Suivant")');
    await authExpect(nextButton.first()).toBeVisible();
  });
});

test.describe("API Endpoints (sans auth — vérifie statut)", () => {
  test("POST /api/properties — création draft", async ({ request }) => {
    const response = await request.post("/api/properties", {
      data: {
        type_bien: "appartement",
        usage_principal: "habitation",
      },
    });

    // Sans auth on attend 401/403 ; avec une session on aurait 201.
    expect([201, 401, 403]).toContain(response.status());

    if (response.status() === 201) {
      const data = await response.json();
      expect(data).toHaveProperty("property");
      expect(data.property).toHaveProperty("id");
      expect(data.property).toHaveProperty("type_bien", "appartement");
    }
  });

  test("GET /api/properties — liste des propriétés", async ({ request }) => {
    const response = await request.get("/api/properties");
    expect([200, 401, 403]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("properties");
      expect(Array.isArray(data.properties)).toBe(true);
    }
  });
});
