import { describe, it, expect } from "vitest";
import {
  getReminderLevel,
  getReminderEmailContent,
  detectLateInvoices,
  type LateInvoice,
} from "@/lib/services/payment-reminder.service";

describe("payment-reminder.service", () => {
  describe("getReminderLevel", () => {
    it("retourne 'amiable' pour 5-14 jours de retard", () => {
      expect(getReminderLevel(5)).toBe("amiable");
      expect(getReminderLevel(10)).toBe("amiable");
      expect(getReminderLevel(14)).toBe("amiable");
    });

    it("retourne 'formelle' pour 15-29 jours de retard", () => {
      expect(getReminderLevel(15)).toBe("formelle");
      expect(getReminderLevel(20)).toBe("formelle");
      expect(getReminderLevel(29)).toBe("formelle");
    });

    it("retourne 'mise_en_demeure' pour 30+ jours de retard", () => {
      expect(getReminderLevel(30)).toBe("mise_en_demeure");
      expect(getReminderLevel(60)).toBe("mise_en_demeure");
      expect(getReminderLevel(90)).toBe("mise_en_demeure");
    });
  });

  describe("getReminderEmailContent", () => {
    const baseInvoice: LateInvoice = {
      id: "inv-1",
      lease_id: "lease-1",
      montant: 750,
      due_date: "2026-01-01",
      days_late: 10,
      reminder_level: "amiable",
      tenant_name: "Jean Dupont",
      tenant_email: "jean@example.com",
      property_address: "12 Rue de la Paix, Paris",
      lease_type: "nu",
    };

    it("génère un email amiable avec le bon sujet", () => {
      const { subject, body } = getReminderEmailContent("amiable", baseInvoice);
      expect(subject).toContain("Rappel");
      expect(subject).toContain("12 Rue de la Paix");
      expect(body).toContain("Jean Dupont");
      expect(body).toContain("750");
      expect(body).not.toContain("MISE EN DEMEURE");
    });

    it("génère un email formel avec le bon sujet", () => {
      const { subject, body } = getReminderEmailContent("formelle", {
        ...baseInvoice,
        days_late: 20,
      });
      expect(subject).toContain("Relance");
      expect(body).toContain("20 jours de retard");
      expect(body).toContain("délai de 8 jours");
    });

    it("génère une mise en demeure avec les références légales", () => {
      const { subject, body } = getReminderEmailContent("mise_en_demeure", {
        ...baseInvoice,
        days_late: 45,
      });
      expect(subject).toContain("MISE EN DEMEURE");
      expect(body).toContain("article 24");
      expect(body).toContain("loi n°89-462");
      expect(body).toContain("45 jours de retard");
    });
  });

  describe("detectLateInvoices", () => {
    const now = new Date("2026-02-12");

    const invoices = [
      { id: "inv-1", lease_id: "l1", montant: 800, due_date: "2026-02-01", statut: "sent" },
      { id: "inv-2", lease_id: "l1", montant: 800, due_date: "2026-01-15", statut: "late" },
      { id: "inv-3", lease_id: "l2", montant: 500, due_date: "2025-12-01", statut: "draft" },
      { id: "inv-4", lease_id: "l1", montant: 800, due_date: "2026-02-01", statut: "paid" },
      { id: "inv-5", lease_id: "l1", montant: 800, due_date: "2026-02-10", statut: "sent" },
    ];

    const leases = [
      { id: "l1", type_bail: "nu", property: { adresse_complete: "12 Rue de la Paix" } },
      { id: "l2", type_bail: "meuble", property: { adresse_complete: "5 Avenue des Champs" } },
    ];

    const signersMap: Record<string, any[]> = {
      l1: [{ role: "locataire_principal", profile: { prenom: "Jean", nom: "Dupont", email: "jean@example.com" } }],
      l2: [{ role: "locataire_principal", profile: { prenom: "Marie", nom: "Martin", email: "marie@example.com" } }],
    };

    it("détecte les factures en retard de plus de 5 jours", () => {
      const result = detectLateInvoices(invoices, leases, signersMap, now);
      // inv-1: 11 jours → amiable ✓
      // inv-2: 28 jours → formelle ✓
      // inv-3: 73 jours → mise_en_demeure ✓
      // inv-4: payée → exclu
      // inv-5: 2 jours → exclu (< 5 jours)
      expect(result.length).toBe(3);
    });

    it("exclut les factures payées", () => {
      const result = detectLateInvoices(invoices, leases, signersMap, now);
      expect(result.find(i => i.id === "inv-4")).toBeUndefined();
    });

    it("exclut les factures avec moins de 5 jours de retard", () => {
      const result = detectLateInvoices(invoices, leases, signersMap, now);
      expect(result.find(i => i.id === "inv-5")).toBeUndefined();
    });

    it("trie par jours de retard décroissant", () => {
      const result = detectLateInvoices(invoices, leases, signersMap, now);
      expect(result[0].id).toBe("inv-3"); // 73 jours
      expect(result[1].id).toBe("inv-2"); // 28 jours
      expect(result[2].id).toBe("inv-1"); // 11 jours
    });

    it("assigne le bon niveau de relance", () => {
      const result = detectLateInvoices(invoices, leases, signersMap, now);
      expect(result.find(i => i.id === "inv-3")?.reminder_level).toBe("mise_en_demeure");
      expect(result.find(i => i.id === "inv-2")?.reminder_level).toBe("formelle");
      expect(result.find(i => i.id === "inv-1")?.reminder_level).toBe("amiable");
    });

    it("récupère les informations du locataire", () => {
      const result = detectLateInvoices(invoices, leases, signersMap, now);
      const inv1 = result.find(i => i.id === "inv-1");
      expect(inv1?.tenant_name).toBe("Jean Dupont");
      expect(inv1?.tenant_email).toBe("jean@example.com");
    });

    it("récupère l'adresse de la propriété", () => {
      const result = detectLateInvoices(invoices, leases, signersMap, now);
      const inv3 = result.find(i => i.id === "inv-3");
      expect(inv3?.property_address).toBe("5 Avenue des Champs");
    });

    it("retourne un tableau vide si pas de factures en retard", () => {
      const paidInvoices = [
        { id: "inv-1", lease_id: "l1", montant: 800, due_date: "2026-02-01", statut: "paid" },
      ];
      const result = detectLateInvoices(paidInvoices, leases, signersMap, now);
      expect(result.length).toBe(0);
    });

    it("gère gracieusement les données manquantes", () => {
      const result = detectLateInvoices(
        [{ id: "inv-x", lease_id: "l99", montant: 100, due_date: "2026-01-01", statut: "sent" }],
        [],
        {},
        now
      );
      expect(result.length).toBe(1);
      expect(result[0].tenant_name).toBe("Locataire");
      expect(result[0].property_address).toBe("Adresse inconnue");
    });
  });
});
