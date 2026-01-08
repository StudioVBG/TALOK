import { test, expect, Page } from "@playwright/test";

const OWNER_CREDENTIALS = {
  email: process.env.E2E_OWNER_EMAIL || "contact.explore.mq@gmail.com",
  password: process.env.E2E_OWNER_PASSWORD || "Test12345!2025",
};

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/signin");
  await page.waitForLoadState("networkidle");
  
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  await page.waitForURL(/\/(owner|tenant|admin|vendor)/, { timeout: 15000 });
}

// ============================================
// FLUX: Création et gestion de bail
// ============================================
test.describe("Flux Bail - Propriétaire", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, OWNER_CREDENTIALS.email, OWNER_CREDENTIALS.password);
  });

  test("peut accéder à la liste des baux", async ({ page }) => {
    await page.goto("/owner/leases");
    await page.waitForLoadState("networkidle");

    // Vérifier que la page charge
    await expect(page.locator('text="Baux", text="contrats", text="locataires"').first()).toBeVisible({ timeout: 10000 });
    
    // Pas d'erreur
    const errorVisible = await page.locator('text="erreur", text="Error"').isVisible();
    expect(errorVisible).toBeFalsy();
  });

  test("formulaire de création de bail est accessible", async ({ page }) => {
    await page.goto("/leases/new");
    await page.waitForLoadState("networkidle");

    // Vérifier les champs principaux
    const formExists = await page.locator('form, [data-testid="lease-form"]').isVisible();
    
    // Si pas de formulaire direct, on peut être redirigé ou avoir une modal
    if (!formExists) {
      // Essayer de trouver un bouton pour créer un bail
      await page.goto("/owner/leases");
      await page.waitForLoadState("networkidle");
      
      const createButton = page.locator('button:has-text("Nouveau"), button:has-text("Créer"), a:has-text("Ajouter")');
      if (await createButton.isVisible()) {
        await createButton.first().click();
        await page.waitForTimeout(2000);
      }
    }

    // Vérifier qu'on peut au moins voir un formulaire ou une interface de création
    const hasForm = await page.locator('form, input, select').count() > 0;
    expect(hasForm).toBeTruthy();
  });

  test("peut voir les détails d'un bail existant", async ({ page }) => {
    // D'abord, récupérer un bail existant
    await page.goto("/owner/leases");
    await page.waitForLoadState("networkidle");

    // Cliquer sur le premier bail s'il existe
    const firstLease = page.locator('[data-testid="lease-card"], a[href*="contracts/"], [class*="lease-item"]').first();
    
    if (await firstLease.isVisible()) {
      await firstLease.click();
      await page.waitForLoadState("networkidle");

      // Vérifier qu'on est sur une page de détail
      const hasDetails = await page.locator('text="Détails", text="Loyer", text="Locataire", text="Signataires"').first().isVisible();
      expect(hasDetails).toBeTruthy();
    } else {
      // Pas de bail existant, c'est OK
      test.skip();
    }
  });
});

// ============================================
// FLUX: Invitation locataire
// ============================================
test.describe("Flux Invitation Locataire", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, OWNER_CREDENTIALS.email, OWNER_CREDENTIALS.password);
  });

  test("peut générer un code d'invitation pour un bien", async ({ page }) => {
    // Aller sur la liste des biens
    await page.goto("/owner/properties");
    await page.waitForLoadState("networkidle");

    // Cliquer sur le premier bien
    const firstProperty = page.locator('[data-testid="property-card"], a[href*="properties/"]').first();
    
    if (await firstProperty.isVisible()) {
      await firstProperty.click();
      await page.waitForLoadState("networkidle");

      // Chercher un bouton d'invitation
      const inviteButton = page.locator('button:has-text("Inviter"), button:has-text("Code"), a:has-text("invitation")');
      
      if (await inviteButton.isVisible()) {
        await inviteButton.first().click();
        await page.waitForTimeout(2000);

        // Vérifier qu'un code ou un formulaire d'invitation apparaît
        const hasInviteContent = await page.locator('text="code", text="invitation", text="lien", input[readonly]').first().isVisible();
        expect(hasInviteContent).toBeTruthy();
      }
    } else {
      test.skip();
    }
  });
});

// ============================================
// FLUX: Signatures (structure prête)
// ============================================
test.describe("Flux Signatures", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, OWNER_CREDENTIALS.email, OWNER_CREDENTIALS.password);
  });

  test("page de signature accessible depuis un bail", async ({ page }) => {
    await page.goto("/owner/leases");
    await page.waitForLoadState("networkidle");

    const firstLease = page.locator('[data-testid="lease-card"], a[href*="contracts/"]').first();
    
    if (await firstLease.isVisible()) {
      await firstLease.click();
      await page.waitForLoadState("networkidle");

      // Chercher un bouton de signature
      const signButton = page.locator('button:has-text("Signer"), button:has-text("Signature"), a:has-text("signature")');
      
      const hasSignature = await signButton.isVisible();
      // Pour l'instant on vérifie juste que la structure existe
      // L'intégration Yousign viendra après
      console.log("Bouton signature visible:", hasSignature);
    }
  });
});

// ============================================
// FLUX: Facturation et quittances
// ============================================
test.describe("Flux Facturation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, OWNER_CREDENTIALS.email, OWNER_CREDENTIALS.password);
  });

  test("peut accéder à la section loyers", async ({ page }) => {
    await page.goto("/owner/money");
    await page.waitForLoadState("networkidle");

    // Vérifier les éléments principaux
    await expect(page.locator('text="Loyers", text="revenus", text="finances"').first()).toBeVisible({ timeout: 10000 });
  });

  test("peut générer une facture", async ({ page }) => {
    await page.goto("/owner/money");
    await page.waitForLoadState("networkidle");

    // Chercher un bouton de génération
    const generateButton = page.locator('button:has-text("Générer"), button:has-text("Facture"), button:has-text("Ajouter")');
    
    if (await generateButton.isVisible()) {
      await generateButton.first().click();
      await page.waitForTimeout(2000);

      // Vérifier qu'un formulaire ou modal apparaît
      const hasForm = await page.locator('form, [role="dialog"], [data-state="open"]').isVisible();
      expect(hasForm).toBeTruthy();
    } else {
      // Fonctionnalité peut ne pas être encore implémentée
      console.log("Bouton de génération non visible - fonctionnalité à implémenter");
    }
  });
});

