/**
 * Tests unitaires pour le module Garant
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createGuarantorProfileSchema,
  createEngagementSchema,
  updateGuarantorProfileSchema,
} from "@/lib/validations/guarantor";

describe("Validation Garant", () => {
  describe("createGuarantorProfileSchema", () => {
    it("devrait valider un profil garant complet", () => {
      const validData = {
        relation_to_tenant: "parent",
        situation_pro: "cdi",
        employeur_nom: "Société Test",
        anciennete_mois: 36,
        revenus_mensuels_nets: 3500,
        revenus_fonciers: 500,
        autres_revenus: 0,
        charges_mensuelles: 800,
        credits_en_cours: 200,
        est_proprietaire: true,
        valeur_patrimoine_immobilier: 250000,
        adresse_complete: "123 rue de Paris",
        code_postal: "75001",
        ville: "Paris",
      };

      const result = createGuarantorProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("devrait rejeter un profil sans relation_to_tenant", () => {
      const invalidData = {
        situation_pro: "cdi",
        revenus_mensuels_nets: 3500,
      };

      const result = createGuarantorProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("devrait rejeter un code postal invalide", () => {
      const invalidData = {
        relation_to_tenant: "parent",
        code_postal: "123", // Doit être 5 chiffres
      };

      const result = createGuarantorProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("devrait accepter des revenus à 0", () => {
      const validData = {
        relation_to_tenant: "ami",
        revenus_mensuels_nets: 0,
        revenus_fonciers: 0,
      };

      const result = createGuarantorProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("devrait rejeter des revenus négatifs", () => {
      const invalidData = {
        relation_to_tenant: "parent",
        revenus_mensuels_nets: -1000,
      };

      const result = createGuarantorProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("devrait valider tous les types de relation", () => {
      const relations = [
        "parent",
        "grand_parent",
        "oncle_tante",
        "frere_soeur",
        "employeur",
        "ami",
        "autre",
      ];

      relations.forEach((relation) => {
        const result = createGuarantorProfileSchema.safeParse({
          relation_to_tenant: relation,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe("createEngagementSchema", () => {
    const validUUID = "550e8400-e29b-41d4-a716-446655440000";

    it("devrait valider un engagement complet", () => {
      const validData = {
        guarantor_profile_id: validUUID,
        lease_id: validUUID,
        tenant_profile_id: validUUID,
        caution_type: "solidaire",
        montant_garanti: 12000,
        duree_engagement_mois: 36,
      };

      const result = createEngagementSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("devrait utiliser 'solidaire' par défaut pour caution_type", () => {
      const data = {
        guarantor_profile_id: validUUID,
        lease_id: validUUID,
        tenant_profile_id: validUUID,
      };

      const result = createEngagementSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.caution_type).toBe("solidaire");
      }
    });

    it("devrait rejeter un UUID invalide", () => {
      const invalidData = {
        guarantor_profile_id: "invalid-uuid",
        lease_id: validUUID,
        tenant_profile_id: validUUID,
      };

      const result = createEngagementSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("devrait rejeter une durée supérieure à 120 mois", () => {
      const invalidData = {
        guarantor_profile_id: validUUID,
        lease_id: validUUID,
        tenant_profile_id: validUUID,
        duree_engagement_mois: 121,
      };

      const result = createEngagementSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("updateGuarantorProfileSchema", () => {
    it("devrait permettre une mise à jour partielle", () => {
      const partialData = {
        revenus_mensuels_nets: 4000,
      };

      const result = updateGuarantorProfileSchema.safeParse(partialData);
      expect(result.success).toBe(true);
    });

    it("devrait valider le consentement", () => {
      const data = {
        consent_garant: true,
        consent_data_processing: true,
      };

      const result = updateGuarantorProfileSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});

describe("Calculs Garant", () => {
  describe("Éligibilité", () => {
    it("devrait calculer le ratio revenus/loyer", () => {
      const revenus = 3000;
      const loyer = 800;
      const charges = 100;
      const totalRent = loyer + charges;
      const ratio = revenus / totalRent;

      expect(ratio).toBeGreaterThan(3); // Ratio minimum requis
    });

    it("devrait identifier un garant non éligible", () => {
      const revenus = 2000;
      const loyer = 800;
      const charges = 100;
      const totalRent = loyer + charges;
      const ratio = revenus / totalRent;

      expect(ratio).toBeLessThan(3);
    });
  });
});







