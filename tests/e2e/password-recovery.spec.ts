/**
 * E2E — Hardening du parcours password recovery.
 *
 * Refactor : routes via le catalogue.
 */

import { test, expect } from "@playwright/test";
import { routes } from "./helpers/routes";

test.describe("Password recovery hardening", () => {
  test("La page de recovery dédiée refuse un accès direct sans contexte", async ({
    page,
  }) => {
    await page.goto(routes.recovery.password("00000000-0000-0000-0000-000000000000"));

    await expect(
      page.getByText(/invalide, expiré ou déjà utilisé/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Demander un nouveau lien/i }),
    ).toBeVisible();
  });

  test("L'ancienne route publique /auth/reset-password devient une page d'information", async ({
    page,
  }) => {
    await page.goto(routes.auth.resetPassword);

    await expect(
      page.getByText(
        /n'est plus utilisée pour modifier directement le mot de passe/i,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Demander un nouveau lien sécurisé/i }),
    ).toBeVisible();
  });
});
