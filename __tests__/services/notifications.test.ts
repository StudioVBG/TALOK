/**
 * Tests unitaires pour le module Notifications
 */

import { describe, it, expect } from "vitest";
import {
  generateNotificationContent,
  formatPhoneNumber,
  NOTIFICATION_TEMPLATES,
} from "@/lib/services/notification.service";

describe("Module Notifications", () => {
  describe("generateNotificationContent", () => {
    it("devrait générer un rappel de paiement", () => {
      const content = generateNotificationContent("payment_reminder", {
        amount: "800€",
        dueDate: "15 janvier 2024",
      });

      expect(content.title).toBe("Rappel de paiement");
      expect(content.body).toContain("800€");
      expect(content.body).toContain("15 janvier 2024");
    });

    it("devrait générer une notification de paiement reçu", () => {
      const content = generateNotificationContent("payment_received", {
        amount: "900€",
      });

      expect(content.title).toBe("Paiement reçu");
      expect(content.body).toContain("900€");
    });

    it("devrait générer une alerte de retard", () => {
      const content = generateNotificationContent("payment_late", {
        amount: "850€",
        daysLate: 5,
      });

      expect(content.title).toBe("Loyer en retard");
      expect(content.body).toContain("850€");
      expect(content.body).toContain("5 jour");
    });

    it("devrait générer une notification de ticket", () => {
      const content = generateNotificationContent("ticket_created", {
        ticketTitle: "Fuite d'eau",
        property: "12 rue de Paris",
      });

      expect(content.title).toBe("Nouveau ticket créé");
      expect(content.body).toContain("Fuite d'eau");
      expect(content.body).toContain("12 rue de Paris");
    });

    it("devrait générer une notification de bail expirant", () => {
      const content = generateNotificationContent("lease_expiring", {
        property: "Appartement 3B",
        daysLeft: 30,
      });

      expect(content.title).toBe("Bail bientôt expiré");
      expect(content.body).toContain("30 jours");
    });
  });

  describe("formatPhoneNumber", () => {
    it("devrait formater un numéro français commençant par 0", () => {
      const result = formatPhoneNumber("0612345678");
      expect(result).toBe("+33612345678");
    });

    it("devrait conserver un numéro avec indicatif", () => {
      const result = formatPhoneNumber("+33612345678");
      expect(result).toBe("+33612345678");
    });

    it("devrait supprimer les espaces", () => {
      const result = formatPhoneNumber("06 12 34 56 78");
      expect(result).toBe("+33612345678");
    });

    it("devrait supprimer les tirets", () => {
      const result = formatPhoneNumber("06-12-34-56-78");
      expect(result).toBe("+33612345678");
    });

    it("devrait supprimer les points", () => {
      const result = formatPhoneNumber("06.12.34.56.78");
      expect(result).toBe("+33612345678");
    });

    it("devrait ajouter + si absent", () => {
      const result = formatPhoneNumber("33612345678");
      expect(result).toBe("+33612345678");
    });
  });

  describe("Templates SMS", () => {
    it("devrait avoir tous les templates requis", () => {
      const requiredTemplates = [
        "payment_reminder",
        "payment_received",
        "payment_late",
        "ticket_created",
        "ticket_updated",
        "document_available",
        "lease_expiring",
        "lease_signed",
        "edl_scheduled",
        "intervention_scheduled",
      ];

      requiredTemplates.forEach((template) => {
        expect(NOTIFICATION_TEMPLATES).toHaveProperty(template);
      });
    });

    it("devrait respecter la limite SMS (160 caractères par segment)", () => {
      // Vérifier que les templates de base ne dépassent pas trop
      const template = NOTIFICATION_TEMPLATES.payment_reminder;
      const message = template.body({ amount: "1000€", dueDate: "15/01/2024" });

      // Un SMS peut avoir plusieurs segments, mais le template de base devrait être raisonnable
      expect(message.length).toBeLessThan(320); // Max 2 segments
    });
  });
});

describe("Préférences de notification", () => {
  describe("Heures de silence", () => {
    it("devrait identifier si l'heure actuelle est dans les heures de silence", () => {
      const isInQuietHours = (
        currentTime: string,
        quietStart: string,
        quietEnd: string
      ): boolean => {
        const current = currentTime;
        
        // Si quietStart > quietEnd, on traverse minuit
        if (quietStart > quietEnd) {
          return current >= quietStart || current < quietEnd;
        }
        
        return current >= quietStart && current < quietEnd;
      };

      // 23:00 est dans les heures de silence (22:00 - 07:00)
      expect(isInQuietHours("23:00", "22:00", "07:00")).toBe(true);

      // 10:00 n'est pas dans les heures de silence
      expect(isInQuietHours("10:00", "22:00", "07:00")).toBe(false);

      // 03:00 est dans les heures de silence (après minuit)
      expect(isInQuietHours("03:00", "22:00", "07:00")).toBe(true);

      // 21:00 n'est pas dans les heures de silence
      expect(isInQuietHours("21:00", "22:00", "07:00")).toBe(false);
    });
  });

  describe("Priorité des notifications", () => {
    it("devrait permettre les notifications urgentes pendant les heures de silence", () => {
      const shouldSendNow = (
        priority: string,
        isInQuietHours: boolean,
        quietHoursEnabled: boolean
      ): boolean => {
        if (priority === "urgent") return true;
        if (!quietHoursEnabled) return true;
        if (isInQuietHours) return false;
        return true;
      };

      expect(shouldSendNow("urgent", true, true)).toBe(true);
      expect(shouldSendNow("high", true, true)).toBe(false);
      expect(shouldSendNow("normal", true, false)).toBe(true);
    });
  });
});
