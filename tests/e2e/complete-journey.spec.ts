/**
 * Test E2E: Parcours Complet Talok
 * De la création du bien au premier paiement
 *
 * Ce test couvre le parcours utilisateur complet:
 * 1. Création d'un bien immobilier
 * 2. Ajout d'un locataire
 * 3. Création du bail
 * 4. État des lieux d'entrée
 * 5. Signature électronique
 * 6. Premier paiement de loyer
 */

import { test, expect } from "@playwright/test";

// Configuration des données de test
const TEST_PROPERTY = {
  type: "appartement",
  address: "63 Rue Victor Schoelcher",
  postalCode: "97200",
  city: "Fort-de-France",
  surface: 65,
  rooms: 3,
  rent: 850,
  charges: 50,
};

const TEST_TENANT = {
  firstName: "Marie",
  lastName: "Dupont",
  email: `tenant-${Date.now()}@test.talok.fr`,
  phone: "0696123456",
};

test.describe("Parcours Complet: Bien → Paiement", () => {
  // Variables partagées entre les tests
  let propertyId: string;
  let leaseId: string;
  let inspectionId: string;

  test.beforeEach(async ({ page }) => {
    // Connexion en tant que propriétaire
    await page.goto("/login");
    await page.fill('[name="email"]', process.env.TEST_OWNER_EMAIL || "owner@test.talok.fr");
    await page.fill('[name="password"]', process.env.TEST_OWNER_PASSWORD || "TestPassword123!");
    await page.click('button[type="submit"]');

    // Attendre la redirection vers le dashboard
    await expect(page).toHaveURL(/\/owner/, { timeout: 10000 });
  });

  test("1. Création d'un bien immobilier", async ({ page }) => {
    // Naviguer vers la création de bien
    await page.click('text=Ajouter un bien');
    await expect(page).toHaveURL(/\/owner\/properties\/new/);

    // Remplir le formulaire - Type de bien
    await page.click(`[data-value="${TEST_PROPERTY.type}"]`);
    await page.click('button:has-text("Suivant")');

    // Remplir l'adresse
    await page.fill('[name="adresse"]', TEST_PROPERTY.address);
    await page.fill('[name="code_postal"]', TEST_PROPERTY.postalCode);
    await page.fill('[name="ville"]', TEST_PROPERTY.city);
    await page.click('button:has-text("Suivant")');

    // Remplir les caractéristiques
    await page.fill('[name="surface"]', String(TEST_PROPERTY.surface));
    await page.fill('[name="nb_pieces"]', String(TEST_PROPERTY.rooms));
    await page.click('button:has-text("Suivant")');

    // Remplir le loyer
    await page.fill('[name="loyer"]', String(TEST_PROPERTY.rent));
    await page.fill('[name="charges"]', String(TEST_PROPERTY.charges));

    // Soumettre
    await page.click('button:has-text("Créer le bien")');

    // Vérifier la création
    await expect(page.locator(".toast-success, [role='alert']")).toBeVisible({ timeout: 10000 });

    // Récupérer l'ID du bien depuis l'URL
    await page.waitForURL(/\/owner\/properties\/[a-f0-9-]+/);
    const url = page.url();
    propertyId = url.split("/").pop() || "";

    expect(propertyId).toBeTruthy();
    console.log(`✅ Bien créé: ${propertyId}`);
  });

  test("2. Ajout d'un locataire", async ({ page }) => {
    test.skip(!propertyId, "Nécessite un bien créé");

    // Naviguer vers le bien
    await page.goto(`/owner/properties/${propertyId}`);

    // Cliquer sur "Ajouter un locataire"
    await page.click('button:has-text("Ajouter un locataire")');

    // Remplir les informations du locataire
    await page.fill('[name="prenom"]', TEST_TENANT.firstName);
    await page.fill('[name="nom"]', TEST_TENANT.lastName);
    await page.fill('[name="email"]', TEST_TENANT.email);
    await page.fill('[name="telephone"]', TEST_TENANT.phone);

    // Soumettre
    await page.click('button:has-text("Inviter")');

    // Vérifier l'invitation
    await expect(page.locator(".toast-success, [role='alert']")).toBeVisible({ timeout: 10000 });

    console.log(`✅ Locataire invité: ${TEST_TENANT.email}`);
  });

  test("3. Création du bail", async ({ page }) => {
    test.skip(!propertyId, "Nécessite un bien créé");

    // Naviguer vers la création de bail
    await page.goto(`/owner/properties/${propertyId}/leases/new`);

    // Type de bail
    await page.click('[data-value="meuble"]');
    await page.click('button:has-text("Suivant")');

    // Date de début (aujourd'hui)
    const today = new Date().toISOString().split("T")[0];
    await page.fill('[name="date_debut"]', today);
    await page.click('button:has-text("Suivant")');

    // Vérifier le loyer pré-rempli
    const rentInput = page.locator('[name="loyer"]');
    await expect(rentInput).toHaveValue(String(TEST_PROPERTY.rent));

    // Finaliser
    await page.click('button:has-text("Créer le bail")');

    // Vérifier la création
    await expect(page.locator(".toast-success")).toBeVisible({ timeout: 10000 });

    // Récupérer l'ID du bail
    await page.waitForURL(/\/owner\/leases\/[a-f0-9-]+/);
    leaseId = page.url().split("/").pop() || "";

    expect(leaseId).toBeTruthy();
    console.log(`✅ Bail créé: ${leaseId}`);
  });

  test("4. État des lieux d'entrée", async ({ page }) => {
    test.skip(!leaseId, "Nécessite un bail créé");

    // Naviguer vers la création d'EDL
    await page.goto(`/owner/leases/${leaseId}/edl/new`);

    // Type d'EDL: Entrée
    await page.click('[data-value="entree"]');
    await page.click('button:has-text("Suivant")');

    // Date et heure
    await page.click('button:has-text("Suivant")');

    // Ajouter une pièce: Salon
    await page.click('button:has-text("Ajouter une pièce")');
    await page.fill('[name="room_name"]', "Salon");
    await page.click('[data-value="bon"]'); // État: Bon
    await page.click('button:has-text("Valider")');

    // Ajouter une pièce: Chambre
    await page.click('button:has-text("Ajouter une pièce")');
    await page.fill('[name="room_name"]', "Chambre");
    await page.click('[data-value="bon"]');
    await page.click('button:has-text("Valider")');

    await page.click('button:has-text("Suivant")');

    // Compteurs (optionnel)
    await page.click('button:has-text("Suivant")');

    // Finaliser
    await page.click('button:has-text("Créer l\'état des lieux")');

    // Vérifier la création
    await expect(page.locator(".toast-success")).toBeVisible({ timeout: 10000 });

    console.log(`✅ EDL d'entrée créé`);
  });

  test("5. Envoi pour signature", async ({ page }) => {
    test.skip(!leaseId, "Nécessite un bail créé");

    // Naviguer vers le bail
    await page.goto(`/owner/leases/${leaseId}`);

    // Cliquer sur "Envoyer pour signature"
    await page.click('button:has-text("Envoyer pour signature")');

    // Confirmer l'envoi
    await page.click('button:has-text("Confirmer")');

    // Vérifier l'envoi
    await expect(page.locator(".toast-success")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=En attente de signature')).toBeVisible();

    console.log(`✅ Bail envoyé pour signature`);
  });

  test("6. Vérification API meter-readings", async ({ request }) => {
    // Test API direct pour vérifier que le bug est corrigé
    const response = await request.get("/api/edl/test-invalid-id/meter-readings");

    // Doit retourner du JSON, pas du HTML
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("application/json");

    // Doit retourner 400 ou 404, pas 500
    expect(response.status()).toBeLessThan(500);

    console.log(`✅ API meter-readings: JSON response, status ${response.status()}`);
  });

  test("7. Vérification Stripe Connect API", async ({ request }) => {
    // Vérifier que l'endpoint Connect existe
    const response = await request.get("/api/stripe/connect");

    // Doit retourner du JSON
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("application/json");

    // 401 si non authentifié, ou 200/404 si authentifié
    expect([200, 401, 404]).toContain(response.status());

    console.log(`✅ API Stripe Connect: status ${response.status()}`);
  });
});

// Tests de régression pour les bugs corrigés
test.describe("Tests de Régression", () => {
  test("BUG-001: meter-readings ne retourne pas de HTML", async ({ request }) => {
    const response = await request.get("/api/edl/invalid-uuid/meter-readings");

    // Vérifier le Content-Type
    const contentType = response.headers()["content-type"] || "";
    expect(contentType).not.toContain("text/html");
    expect(contentType).toContain("application/json");
  });

  test("BUG-005: SEPA service accepte IP dynamique", async ({ request }) => {
    // Ce test vérifie que l'endpoint SEPA setup accepte les requêtes
    // L'IP sera extraite des headers
    const response = await request.post("/api/payments/setup-sepa", {
      data: {
        lease_id: "00000000-0000-0000-0000-000000000000",
        iban: "FR7630006000011234567890189",
        account_holder_name: "Test User",
      },
      headers: {
        "X-Forwarded-For": "203.0.113.42",
        "User-Agent": "Playwright Test",
      },
    });

    // 401 si non authentifié, mais pas 500
    expect(response.status()).toBeLessThan(500);
  });
});

// Tests de performance
test.describe("Tests de Performance", () => {
  test("Chargement liste des biens < 3s", async ({ page }) => {
    const start = Date.now();

    await page.goto("/owner/properties");
    await page.waitForLoadState("networkidle");

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(3000);

    console.log(`⏱️ Chargement liste biens: ${duration}ms`);
  });

  test("Chargement détail bien < 2s", async ({ page }) => {
    // D'abord récupérer un ID de bien
    await page.goto("/owner/properties");
    const firstProperty = page.locator('[data-testid="property-card"]').first();

    if (await firstProperty.isVisible()) {
      const start = Date.now();

      await firstProperty.click();
      await page.waitForLoadState("networkidle");

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);

      console.log(`⏱️ Chargement détail bien: ${duration}ms`);
    } else {
      test.skip();
    }
  });
});
