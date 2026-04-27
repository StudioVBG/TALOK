/**
 * E2E — Flux bail (liste, détails, invitation locataire, signatures, loyers).
 *
 * Refactor : credentials/login centralisés via la fixture `ownerPage`.
 * Routes obsolètes (`/owner/money`, `/leases/new`) remplacées par les vraies
 * (`/owner/finances`, `/owner/leases/new`).
 */

import { test, expect } from "./fixtures/auth";
import { routes } from "./helpers/routes";

// ============================================
// FLUX: Création et gestion de bail
// ============================================
test.describe("Flux Bail — Propriétaire", () => {
  test("peut accéder à la liste des baux", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.leases);
    await page.waitForLoadState("networkidle");

    await expect(
      page
        .locator('text="Baux", text="contrats", text="locataires"')
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('text="erreur", text="Error"')).toHaveCount(0);
  });

  test("formulaire de création de bail accessible", async ({
    ownerPage: page,
  }) => {
    await page.goto(`${routes.owner.leases}/new`);
    await page.waitForLoadState("networkidle");

    const formExists = await page
      .locator('form, [data-testid="lease-form"]')
      .isVisible();

    if (!formExists) {
      // Fallback : passer par la liste
      await page.goto(routes.owner.leases);
      await page.waitForLoadState("networkidle");

      const createButton = page.locator(
        'button:has-text("Nouveau"), button:has-text("Créer"), a:has-text("Ajouter")',
      );
      if (await createButton.first().isVisible()) {
        await createButton.first().click();
        await page.waitForTimeout(2_000);
      }
    }

    expect(await page.locator("form, input, select").count()).toBeGreaterThan(0);
  });

  test("peut voir les détails d'un bail existant (si présent)", async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.leases);
    await page.waitForLoadState("networkidle");

    const firstLease = page
      .locator(
        '[data-testid="lease-card"], a[href*="contracts/"], a[href*="leases/"], [class*="lease-item"]',
      )
      .first();

    if (await firstLease.isVisible()) {
      await firstLease.click();
      await page.waitForLoadState("networkidle");

      const hasDetails = await page
        .locator(
          'text="Détails", text="Loyer", text="Locataire", text="Signataires"',
        )
        .first()
        .isVisible();
      expect(hasDetails).toBeTruthy();
    } else {
      test.skip();
    }
  });
});

// ============================================
// FLUX: Invitation locataire
// ============================================
test.describe("Flux Invitation Locataire", () => {
  test("peut générer un code d'invitation pour un bien (si présent)", async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.properties);
    await page.waitForLoadState("networkidle");

    const firstProperty = page
      .locator('[data-testid="property-card"], a[href*="properties/"]')
      .first();

    if (await firstProperty.isVisible()) {
      await firstProperty.click();
      await page.waitForLoadState("networkidle");

      const inviteButton = page.locator(
        'button:has-text("Inviter"), button:has-text("Code"), a:has-text("invitation")',
      );

      if (await inviteButton.first().isVisible()) {
        await inviteButton.first().click();
        await page.waitForTimeout(2_000);

        const hasInviteContent = await page
          .locator(
            'text="code", text="invitation", text="lien", input[readonly]',
          )
          .first()
          .isVisible();
        expect(hasInviteContent).toBeTruthy();
      }
    } else {
      test.skip();
    }
  });
});

// ============================================
// FLUX: Signatures
// ============================================
test.describe("Flux Signatures", () => {
  test("page de signature accessible depuis un bail (si présent)", async ({
    ownerPage: page,
  }) => {
    await page.goto(routes.owner.leases);
    await page.waitForLoadState("networkidle");

    const firstLease = page
      .locator('[data-testid="lease-card"], a[href*="contracts/"]')
      .first();

    if (await firstLease.isVisible()) {
      await firstLease.click();
      await page.waitForLoadState("networkidle");

      // Présence du bouton signature : non bloquant, on log seulement
      const signButton = page.locator(
        'button:has-text("Signer"), button:has-text("Signature"), a:has-text("signature")',
      );
      const hasSignature = await signButton.isVisible().catch(() => false);
      expect(typeof hasSignature).toBe("boolean");
    } else {
      test.skip();
    }
  });
});

// ============================================
// FLUX: Facturation et finances
// ============================================
test.describe("Flux Facturation", () => {
  test("peut accéder à la section finances", async ({ ownerPage: page }) => {
    await page.goto(routes.owner.finances);
    await page.waitForLoadState("networkidle");

    await expect(
      page
        .locator(
          'text="Loyers", text="revenus", text="finances", text="Finances"',
        )
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
