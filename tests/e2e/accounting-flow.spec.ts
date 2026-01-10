/**
 * Tests E2E - Parcours comptabilité complet
 *
 * Teste le flux complet:
 * 1. Paiement de loyer → Écritures comptables
 * 2. Génération CRG
 * 3. Régularisation des charges
 * 4. Export FEC
 */

import { test, expect } from "@playwright/test";

test.describe("Comptabilité - Parcours complet", () => {
  test.describe.configure({ mode: "serial" });

  let invoiceId: string;
  let leaseId: string;

  test.beforeEach(async ({ page }) => {
    // Connexion en tant que propriétaire
    await page.goto("/login");
    await page.fill('[name="email"]', "owner@test.com");
    await page.fill('[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/owner/dashboard");
  });

  test("1. Créer et payer une facture génère des écritures comptables", async ({
    page,
  }) => {
    // Aller sur la page des factures
    await page.goto("/owner/money");
    await page.waitForSelector('[data-testid="invoices-list"]');

    // Cliquer sur la première facture en attente
    const firstInvoice = page.locator('[data-testid="invoice-card"]').first();
    await firstInvoice.click();

    // Récupérer l'ID de la facture
    const url = page.url();
    invoiceId = url.split("/").pop() || "";

    // Marquer comme payée
    await page.click('[data-testid="mark-paid-button"]');

    // Remplir le formulaire de paiement
    await page.fill('[name="amount"]', "1280");
    await page.selectOption('[name="payment_method"]', "virement");
    await page.click('[data-testid="confirm-payment"]');

    // Vérifier le message de succès
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast-success"]')).toContainText(
      "Facture marquée comme payée"
    );

    // Vérifier que le statut a changé
    await expect(page.locator('[data-testid="invoice-status"]')).toContainText(
      "Payée"
    );
  });

  test("2. Générer un Compte Rendu de Gestion", async ({ page }) => {
    // Aller sur la page comptabilité
    await page.goto("/owner/accounting");

    // Sélectionner la période
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const startDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
    const endDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-28`;

    await page.fill('[name="start_date"]', startDate);
    await page.fill('[name="end_date"]', endDate);

    // Générer le CRG
    await page.click('[data-testid="generate-crg"]');

    // Attendre le chargement
    await page.waitForSelector('[data-testid="crg-summary"]');

    // Vérifier les éléments du CRG
    await expect(page.locator('[data-testid="crg-encaissements"]')).toBeVisible();
    await expect(page.locator('[data-testid="crg-debits"]')).toBeVisible();
    await expect(page.locator('[data-testid="crg-solde"]')).toBeVisible();

    // Télécharger le PDF
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('[data-testid="export-crg-pdf"]'),
    ]);

    expect(download.suggestedFilename()).toMatch(/CRG.*\.pdf/);
  });

  test("3. Créer une régularisation des charges", async ({ page }) => {
    // Aller sur la page du bail
    await page.goto("/owner/leases");
    await page.click('[data-testid="lease-card"]');

    // Récupérer l'ID du bail
    leaseId = page.url().split("/").pop() || "";

    // Aller sur l'onglet régularisation
    await page.click('[data-testid="tab-regularisation"]');

    // Créer une nouvelle régularisation
    await page.click('[data-testid="new-regularisation"]');

    // Sélectionner l'année précédente
    const lastYear = new Date().getFullYear() - 1;
    await page.selectOption('[name="year"]', lastYear.toString());

    // Calculer
    await page.click('[data-testid="calculate-regularisation"]');

    // Attendre le résultat
    await page.waitForSelector('[data-testid="regularisation-result"]');

    // Vérifier le calcul
    await expect(
      page.locator('[data-testid="provisions-versees"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="charges-reelles"]')
    ).toBeVisible();
    await expect(page.locator('[data-testid="solde"]')).toBeVisible();

    // Appliquer la régularisation
    await page.click('[data-testid="apply-regularisation"]');

    // Vérifier le succès
    await expect(page.locator('[data-testid="toast-success"]')).toContainText(
      "Régularisation appliquée"
    );
  });

  test("4. Consulter la balance des mandants (admin)", async ({ page }) => {
    // Se déconnecter et se reconnecter en admin
    await page.goto("/logout");
    await page.goto("/login");
    await page.fill('[name="email"]', "admin@talok.fr");
    await page.fill('[name="password"]', "adminpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/agency/dashboard");

    // Aller sur la balance
    await page.goto("/agency/accounting/balance");

    // Attendre le chargement
    await page.waitForSelector('[data-testid="balance-mandants"]');

    // Vérifier les comptes
    await expect(
      page.locator('[data-testid="comptes-proprietaires"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="comptes-locataires"]')
    ).toBeVisible();

    // Vérifier l'équilibre
    await expect(
      page.locator('[data-testid="verification-equilibre"]')
    ).toBeVisible();
  });

  test("5. Exporter le FEC (admin)", async ({ page }) => {
    // Se reconnecter en admin si nécessaire
    await page.goto("/agency/accounting/export");

    // Sélectionner l'année
    const currentYear = new Date().getFullYear();
    await page.selectOption('[name="year"]', currentYear.toString());

    // Exporter
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('[data-testid="export-fec"]'),
    ]);

    // Vérifier le nom du fichier
    expect(download.suggestedFilename()).toMatch(/FEC.*\.csv/);
  });

  test("6. Consulter le récapitulatif fiscal", async ({ page }) => {
    // Aller sur le récap fiscal (en tant que propriétaire)
    await page.goto("/logout");
    await page.goto("/login");
    await page.fill('[name="email"]', "owner@test.com");
    await page.fill('[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/owner/dashboard");

    await page.goto("/owner/accounting/fiscal");

    // Sélectionner l'année précédente
    const lastYear = new Date().getFullYear() - 1;
    await page.selectOption('[name="year"]', lastYear.toString());
    await page.click('[data-testid="generate-fiscal"]');

    // Attendre le chargement
    await page.waitForSelector('[data-testid="fiscal-summary"]');

    // Vérifier les sections
    await expect(page.locator('[data-testid="revenus-bruts"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="charges-deductibles"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="revenu-foncier-net"]')
    ).toBeVisible();

    // Exporter en PDF
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('[data-testid="export-fiscal-pdf"]'),
    ]);

    expect(download.suggestedFilename()).toMatch(/recap_fiscal.*\.pdf/);
  });
});

test.describe("Comptabilité - Calculs honoraires", () => {
  test("Calculateur honoraires avec TVA métropole", async ({ page }) => {
    await page.goto("/owner/accounting/calculator");

    // Remplir le formulaire
    await page.fill('[name="loyer"]', "1000");
    await page.selectOption('[name="taux"]', "0.07");
    await page.fill('[name="code_postal"]', "75001");

    // Vérifier les résultats
    await expect(page.locator('[data-testid="montant-ht"]')).toContainText("70");
    await expect(page.locator('[data-testid="tva-montant"]')).toContainText("14");
    await expect(page.locator('[data-testid="total-ttc"]')).toContainText("84");
    await expect(page.locator('[data-testid="net-proprietaire"]')).toContainText(
      "916"
    );
  });

  test("Calculateur honoraires avec TVA DROM (Martinique)", async ({ page }) => {
    await page.goto("/owner/accounting/calculator");

    // Remplir le formulaire
    await page.fill('[name="loyer"]', "1000");
    await page.selectOption('[name="taux"]', "0.07");
    await page.fill('[name="code_postal"]', "97200");

    // Vérifier les résultats (TVA 8.5%)
    await expect(page.locator('[data-testid="montant-ht"]')).toContainText("70");
    await expect(page.locator('[data-testid="tva-taux"]')).toContainText("8.5%");
    await expect(page.locator('[data-testid="tva-montant"]')).toContainText(
      "5.95"
    );
    await expect(page.locator('[data-testid="total-ttc"]')).toContainText(
      "75.95"
    );
  });

  test("Calculateur honoraires Guyane (TVA 0%)", async ({ page }) => {
    await page.goto("/owner/accounting/calculator");

    await page.fill('[name="loyer"]', "1000");
    await page.fill('[name="code_postal"]', "97300");

    // Vérifier que la TVA est à 0%
    await expect(page.locator('[data-testid="tva-taux"]')).toContainText("0%");
    await expect(page.locator('[data-testid="tva-montant"]')).toContainText("0");
    await expect(page.locator('[data-testid="total-ttc"]')).toContainText("70");
  });
});

test.describe("Comptabilité - Dépôts de garantie", () => {
  test("Enregistrer un encaissement de dépôt", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', "owner@test.com");
    await page.fill('[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/owner/dashboard");

    await page.goto("/owner/leases");
    await page.click('[data-testid="lease-card"]');
    await page.click('[data-testid="tab-deposit"]');

    // Enregistrer l'encaissement
    await page.click('[data-testid="record-deposit"]');
    await page.selectOption('[name="operation_type"]', "encaissement");
    await page.fill('[name="amount"]', "1500");
    await page.click('[data-testid="confirm-deposit"]');

    // Vérifier le succès
    await expect(page.locator('[data-testid="deposit-balance"]')).toContainText(
      "1 500"
    );
  });

  test("Effectuer une restitution de dépôt", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', "owner@test.com");
    await page.fill('[name="password"]', "password123");
    await page.click('button[type="submit"]');

    await page.goto("/owner/leases");
    await page.click('[data-testid="lease-card"]');
    await page.click('[data-testid="tab-deposit"]');

    // Effectuer la restitution
    await page.click('[data-testid="record-deposit"]');
    await page.selectOption('[name="operation_type"]', "restitution");
    await page.fill('[name="amount"]', "1500");
    await page.fill('[name="description"]', "Restitution fin de bail");
    await page.click('[data-testid="confirm-deposit"]');

    // Vérifier
    await expect(page.locator('[data-testid="deposit-status"]')).toContainText(
      "Restitué"
    );
  });
});
