/**
 * E2E — Authentification.
 *
 * Ce spec teste explicitement le flux de login : il NE DOIT PAS utiliser les
 * fixtures `ownerPage` / `tenantPage` / `adminPage` (qui supposent justement
 * que l'utilisateur est déjà authentifié via storage state). À la place, il
 * réalise le login interactif via `helpers/login.ts` ou directement.
 *
 * Credentials : centralisés dans `helpers/credentials.ts`. Aucune valeur
 * en dur dans ce fichier.
 */

import { test, expect } from "@playwright/test";
import { getCredentials } from "./helpers/credentials";
import { routes, routePatterns } from "./helpers/routes";
import { login } from "./helpers/login";

test.describe("Authentification", () => {
  test("Connexion owner — redirige vers l'espace propriétaire", async ({
    page,
  }) => {
    await login(page, "owner");
    await expect(page).toHaveURL(routePatterns.ownerArea);
  });

  test("Connexion tenant — redirige vers l'espace locataire", async ({
    page,
  }) => {
    await login(page, "tenant");
    await expect(page).toHaveURL(routePatterns.tenantArea);
  });

  test("Connexion admin — redirige vers l'espace admin", async ({ page }) => {
    await login(page, "admin");
    await expect(page).toHaveURL(routePatterns.adminArea);
  });

  test("Mauvais mot de passe — affiche un message d'erreur", async ({
    page,
  }) => {
    const { email } = getCredentials("owner");
    await page.goto(routes.auth.signin);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("wrong-password-on-purpose");
    await page.locator('button[type="submit"]').click();

    await expect(
      page.locator("text=/erreur|invalid|incorrect|identifiants/i").first(),
    ).toBeVisible({ timeout: 10_000 });
    // On reste sur la page de login
    await expect(page).toHaveURL(routePatterns.signin);
  });

  test("Accès non authentifié — redirige vers signin", async ({ page }) => {
    await page.goto(routes.owner.dashboard);
    await expect(page).toHaveURL(routePatterns.signin, { timeout: 10_000 });
  });
});
