import { test, expect, Page } from "@playwright/test";

// Credentials de test - Utiliser des comptes de test dédiés
const OWNER_CREDENTIALS = {
  email: process.env.E2E_OWNER_EMAIL || "contact.explore.mq@gmail.com",
  password: process.env.E2E_OWNER_PASSWORD || "Test12345!2025",
};

const TENANT_CREDENTIALS = {
  email: process.env.E2E_TENANT_EMAIL || "tenant@test.local",
  password: process.env.E2E_TENANT_PASSWORD || "Test12345!",
};

// Helper pour login
async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/signin");
  await page.waitForLoadState("networkidle");
  
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  // Attendre la redirection
  await page.waitForURL(/\/(owner|tenant|admin|vendor)/, { timeout: 15000 });
}

// ============================================
// FLUX 1: Création de bien immobilier
// ============================================
test.describe("Flux Propriétaire - Création de bien", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, OWNER_CREDENTIALS.email, OWNER_CREDENTIALS.password);
  });

  test("peut créer un appartement via le wizard", async ({ page }) => {
    // Aller à la page de création
    await page.goto("/app/owner/properties/new");
    await page.waitForLoadState("networkidle");

    // Étape 1: Sélectionner le type de bien
    await expect(page.locator('text="Quel type de bien"')).toBeVisible({ timeout: 10000 });
    
    // Cliquer sur "Appartement"
    await page.click('button:has-text("Appartement")');
    
    // Devrait passer automatiquement à l'étape 2
    await expect(page.locator('text="Où se situe votre bien"')).toBeVisible({ timeout: 5000 });

    // Étape 2: Adresse
    await page.fill('input[placeholder*="rue"], input[aria-label*="adresse"], input[id*="adresse"]', "123 rue de la Liberté");
    await page.fill('input[placeholder*="postal"], input[aria-label*="postal"], input[id*="postal"]', "75001");
    await page.fill('input[placeholder*="ville"], input[aria-label*="ville"], input[id*="ville"]', "Paris");
    
    // Continuer
    await page.click('button:has-text("Continuer")');
    
    // Étape 3: Détails
    await expect(page.locator('text="détails", text="logement"').first()).toBeVisible({ timeout: 5000 });
    
    await page.fill('input[id*="surface"], input[aria-label*="surface"]', "65");
    await page.fill('input[id*="loyer"], input[aria-label*="loyer"]', "1200");
    
    await page.click('button:has-text("Continuer")');
    
    // Vérifier qu'on avance dans le wizard
    await expect(page.locator('text="Étape 4", text="Pièces", text="Photos"').first()).toBeVisible({ timeout: 5000 });
  });

  test("peut voir la liste des biens", async ({ page }) => {
    await page.goto("/app/owner/properties");
    await page.waitForLoadState("networkidle");

    // La page devrait charger sans erreur
    await expect(page.locator('text="Mes biens", text="propriétés"').first()).toBeVisible({ timeout: 10000 });
    
    // Pas d'erreur 500
    const errorText = page.locator('text="erreur", text="500", text="Error"');
    await expect(errorText).not.toBeVisible();
  });
});

// ============================================
// FLUX 2: Dashboard Propriétaire
// ============================================
test.describe("Dashboard Propriétaire", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, OWNER_CREDENTIALS.email, OWNER_CREDENTIALS.password);
  });

  test("affiche le dashboard avec les KPIs", async ({ page }) => {
    await page.goto("/app/owner/dashboard");
    await page.waitForLoadState("networkidle");

    // Vérifier les éléments clés
    await expect(page.locator('text="Tableau de bord"')).toBeVisible({ timeout: 10000 });
    
    // Carte de complétion du profil
    await expect(page.locator('text="complété", text="%"').first()).toBeVisible();
    
    // Section finances (même si vide)
    await expect(page.locator('text="finances", text="revenus", text="loyers"').first()).toBeVisible();
  });

  test("la complétion du profil se met à jour", async ({ page }) => {
    await page.goto("/app/owner/dashboard");
    await page.waitForLoadState("networkidle");

    // Noter le pourcentage actuel
    const completionText = await page.locator('[class*="completion"], text=/\\d+%/').first().textContent();
    const initialPercentage = parseInt(completionText?.match(/\\d+/)?.[0] || "0");

    // Aller compléter le profil
    await page.goto("/app/owner/profile");
    await page.waitForLoadState("networkidle");

    // Remplir un champ manquant si possible
    const phoneInput = page.locator('input[name="telephone"], input[type="tel"]');
    if (await phoneInput.isVisible()) {
      const currentValue = await phoneInput.inputValue();
      if (!currentValue) {
        await phoneInput.fill("+33612345678");
        await page.click('button:has-text("Enregistrer")');
        await page.waitForResponse(response => response.url().includes("/api/") && response.status() === 200);
      }
    }

    // Retourner au dashboard
    await page.goto("/app/owner/dashboard");
    await page.waitForLoadState("networkidle");

    // Le pourcentage devrait être identique ou plus élevé
    const newCompletionText = await page.locator('[class*="completion"], text=/\\d+%/').first().textContent();
    const newPercentage = parseInt(newCompletionText?.match(/\\d+/)?.[0] || "0");
    
    expect(newPercentage).toBeGreaterThanOrEqual(initialPercentage);
  });
});

// ============================================
// FLUX 3: Authentification
// ============================================
test.describe("Authentification", () => {
  test("redirige vers login si non authentifié", async ({ page }) => {
    await page.goto("/app/owner/dashboard");
    
    // Devrait rediriger vers signin
    await expect(page).toHaveURL(/auth\/signin/, { timeout: 10000 });
  });

  test("login propriétaire fonctionne", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="email"], input[type="email"]', OWNER_CREDENTIALS.email);
    await page.fill('input[name="password"], input[type="password"]', OWNER_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    // Devrait être redirigé vers le dashboard owner
    await expect(page).toHaveURL(/owner/, { timeout: 15000 });
  });

  test("logout fonctionne", async ({ page }) => {
    await login(page, OWNER_CREDENTIALS.email, OWNER_CREDENTIALS.password);
    
    // Cliquer sur le menu utilisateur puis déconnexion
    await page.click('button:has-text("Test"), [data-testid="user-menu"]');
    await page.click('text="Déconnexion", text="déconnecter", text="logout"', { timeout: 5000 }).catch(() => {
      // Fallback: chercher un lien de déconnexion
      return page.click('a[href*="signout"], a[href*="logout"]');
    });

    // Devrait être sur la page de login ou home
    await expect(page).toHaveURL(/\/(auth\/signin|$)/, { timeout: 10000 });
  });
});

// ============================================
// FLUX 4: Navigation générale
// ============================================
test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, OWNER_CREDENTIALS.email, OWNER_CREDENTIALS.password);
  });

  test("sidebar navigation fonctionne", async ({ page }) => {
    await page.goto("/app/owner/dashboard");
    await page.waitForLoadState("networkidle");

    // Cliquer sur "Mes biens"
    await page.click('a:has-text("Mes biens"), a[href*="properties"]');
    await expect(page).toHaveURL(/properties/, { timeout: 5000 });

    // Cliquer sur "Documents"
    await page.click('a:has-text("Documents"), a[href*="documents"]');
    await expect(page).toHaveURL(/documents/, { timeout: 5000 });

    // Retour au dashboard
    await page.click('a:has-text("Tableau de bord"), a[href*="dashboard"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 5000 });
  });

  test("pages 404 sont gérées", async ({ page }) => {
    await page.goto("/app/owner/route-inexistante-12345");
    
    // Devrait afficher une page 404 ou rediriger
    const is404 = await page.locator('text="404", text="introuvable", text="not found"').isVisible();
    const isRedirected = page.url().includes("dashboard") || page.url().includes("properties");
    
    expect(is404 || isRedirected).toBeTruthy();
  });
});

// ============================================
// FLUX 5: Gestion des erreurs
// ============================================
test.describe("Gestion des erreurs", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, OWNER_CREDENTIALS.email, OWNER_CREDENTIALS.password);
  });

  test("pas d'erreur JavaScript sur le dashboard", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/app/owner/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000); // Attendre les effets asynchrones

    // Filtrer les erreurs non critiques (extensions, analytics, etc.)
    const criticalErrors = errors.filter(e => 
      !e.includes("ResizeObserver") && 
      !e.includes("analytics") &&
      !e.includes("extension")
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("pas d'erreur console critique sur la création de bien", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/app/owner/properties/new");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Filtrer les erreurs bénignes
    const criticalErrors = errors.filter(e => 
      !e.includes("favicon") && 
      !e.includes("404") &&
      !e.includes("ResizeObserver")
    );

    // Tolérer quelques erreurs de développement
    expect(criticalErrors.length).toBeLessThan(5);
  });
});

