import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Mock the properties service
vi.mock("@/features/properties/services/properties.service", () => ({
  propertiesService: {
    createDraft: vi.fn().mockResolvedValue({ id: "draft-123", etat: "draft" }),
    update: vi.fn().mockResolvedValue({ id: "draft-123" }),
    getById: vi.fn().mockResolvedValue({ id: "property-123", adresse_complete: "123 Rue Test" }),
  },
}));

// Import after mocking
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";

describe("Wizard Store - SOTA 2026", () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => usePropertyWizardStore());
    act(() => {
      result.current.reset();
    });
  });

  describe("Initial State", () => {
    it("should have correct initial values", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      expect(result.current.propertyId).toBeNull();
      expect(result.current.buildingId).toBeNull();
      expect(result.current.currentStep).toBe("type_bien");
      expect(result.current.mode).toBe("full");
      expect(result.current.syncStatus).toBe("idle");
      expect(result.current.formData.etat).toBe("draft");
      expect(result.current.rooms).toEqual([]);
      expect(result.current.photos).toEqual([]);
    });

    it("should have default building configuration", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      expect(result.current.formData.building_floors).toBe(4);
      expect(result.current.formData.building_units).toEqual([]);
      expect(result.current.formData.has_ascenseur).toBe(false);
    });
  });

  describe("reset()", () => {
    it("should reset all state to initial values", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      // Modify state
      act(() => {
        result.current.updateFormData({ adresse_complete: "123 Rue Test" });
        result.current.setStep("address");
      });

      // Verify state changed
      expect(result.current.formData.adresse_complete).toBe("123 Rue Test");
      expect(result.current.currentStep).toBe("address");

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify reset
      expect(result.current.formData.adresse_complete).toBeUndefined();
      expect(result.current.currentStep).toBe("type_bien");
    });
  });

  describe("updateFormData()", () => {
    it("should update form data fields", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.updateFormData({
          adresse_complete: "123 Rue de Paris",
          code_postal: "75001",
          ville: "Paris",
        });
      });

      expect(result.current.formData.adresse_complete).toBe("123 Rue de Paris");
      expect(result.current.formData.code_postal).toBe("75001");
      expect(result.current.formData.ville).toBe("Paris");
    });

    it("should preserve existing data when updating", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.updateFormData({ adresse_complete: "123 Rue Test" });
      });

      act(() => {
        result.current.updateFormData({ code_postal: "75001" });
      });

      expect(result.current.formData.adresse_complete).toBe("123 Rue Test");
      expect(result.current.formData.code_postal).toBe("75001");
    });

    it("should update numeric fields correctly", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.updateFormData({
          surface_habitable_m2: 45,
          loyer_hc: 1000,
          charges_mensuelles: 100,
        });
      });

      expect(result.current.formData.surface_habitable_m2).toBe(45);
      expect(result.current.formData.loyer_hc).toBe(1000);
      expect(result.current.formData.charges_mensuelles).toBe(100);
    });

    it("should update DPE fields", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.updateFormData({
          dpe_classe_energie: "D",
          dpe_classe_climat: "C",
          dpe_consommation: 150,
        });
      });

      expect(result.current.formData.dpe_classe_energie).toBe("D");
      expect(result.current.formData.dpe_classe_climat).toBe("C");
      expect(result.current.formData.dpe_consommation).toBe(150);
    });
  });

  describe("Step Navigation", () => {
    it("should set step directly", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.setStep("address");
      });

      expect(result.current.currentStep).toBe("address");
    });

    it("should navigate to next step", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      // Set type first (required for step order)
      act(() => {
        result.current.updateFormData({ type: "appartement" });
      });

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe("address");
    });

    it("should navigate to previous step", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.setStep("details");
      });

      act(() => {
        result.current.prevStep();
      });

      expect(result.current.currentStep).toBe("address");
    });

    it("should not go before first step", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      expect(result.current.currentStep).toBe("type_bien");

      act(() => {
        result.current.prevStep();
      });

      expect(result.current.currentStep).toBe("type_bien");
    });
  });

  describe("Mode Selection", () => {
    it("should set wizard mode", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.setMode("fast");
      });

      expect(result.current.mode).toBe("fast");

      act(() => {
        result.current.setMode("full");
      });

      expect(result.current.mode).toBe("full");
    });
  });

  describe("Room Management", () => {
    it("should add a room", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.addRoom({
          type_piece: "chambre",
          surface_m2: 15,
          label: "Chambre 1",
        });
      });

      expect(result.current.rooms).toHaveLength(1);
      expect(result.current.rooms[0].type_piece).toBe("chambre");
      expect(result.current.rooms[0].surface_m2).toBe(15);
    });

    it("should generate unique IDs for rooms", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.addRoom({ type_piece: "chambre" });
        result.current.addRoom({ type_piece: "sejour" });
      });

      expect(result.current.rooms).toHaveLength(2);
      expect(result.current.rooms[0].id).not.toBe(result.current.rooms[1].id);
    });

    it("should update a room", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.addRoom({ type_piece: "chambre", surface_m2: 10 });
      });

      const roomId = result.current.rooms[0].id;

      act(() => {
        result.current.updateRoom(roomId, { surface_m2: 15 });
      });

      expect(result.current.rooms[0].surface_m2).toBe(15);
    });

    it("should remove a room", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.addRoom({ type_piece: "chambre" });
        result.current.addRoom({ type_piece: "sejour" });
      });

      expect(result.current.rooms).toHaveLength(2);

      const roomId = result.current.rooms[0].id;

      act(() => {
        result.current.removeRoom(roomId);
      });

      expect(result.current.rooms).toHaveLength(1);
      expect(result.current.rooms[0].type_piece).toBe("sejour");
    });
  });

  describe("Photos Management", () => {
    it("should set photos", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      const photos = [
        { id: "1", url: "https://example.com/photo1.jpg" },
        { id: "2", url: "https://example.com/photo2.jpg" },
      ];

      act(() => {
        result.current.setPhotos(photos as any);
      });

      expect(result.current.photos).toHaveLength(2);
    });
  });

  describe("Building-Specific Fields", () => {
    it("should update building floors", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.updateFormData({ building_floors: 6 });
      });

      expect(result.current.formData.building_floors).toBe(6);
    });

    it("should update building common facilities", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.updateFormData({
          has_ascenseur: true,
          has_gardien: true,
          has_interphone: true,
        });
      });

      expect(result.current.formData.has_ascenseur).toBe(true);
      expect(result.current.formData.has_gardien).toBe(true);
      expect(result.current.formData.has_interphone).toBe(true);
    });

    it("should update building units array", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      const units = [
        { id: "unit-1", floor: 0, position: "A", type: "appartement", surface: 45 },
        { id: "unit-2", floor: 1, position: "A", type: "appartement", surface: 45 },
      ];

      act(() => {
        result.current.updateFormData({ building_units: units as any });
      });

      expect(result.current.formData.building_units).toHaveLength(2);
      expect(result.current.formData.building_units?.[0].floor).toBe(0);
    });
  });

  describe("Undo/Redo", () => {
    it("should track if undo is available", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      expect(result.current.canUndo()).toBe(false);
    });

    it("should track if redo is available", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      expect(result.current.canRedo()).toBe(false);
    });

    it("should clear history on reset", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.updateFormData({ adresse_complete: "Test" });
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.canUndo()).toBe(false);
      expect(result.current.canRedo()).toBe(false);
    });
  });

  describe("Pending Photo Imports", () => {
    it("should set pending photo URLs", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      const urls = [
        "https://example.com/photo1.jpg",
        "https://example.com/photo2.jpg",
      ];

      act(() => {
        result.current.setPendingPhotoUrls(urls);
      });

      expect(result.current.pendingPhotoUrls).toEqual(urls);
    });

    it("should track photo import status", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      expect(result.current.photoImportStatus).toBe("idle");
      expect(result.current.photoImportProgress).toEqual({ imported: 0, total: 0 });
    });
  });

  describe("Type-specific Step Order", () => {
    it("should use building steps for immeuble type", () => {
      const { result } = renderHook(() => usePropertyWizardStore());

      act(() => {
        result.current.updateFormData({ type: "immeuble" });
        result.current.setStep("type_bien");
      });

      // Navigate through building-specific steps
      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe("address");

      act(() => {
        result.current.nextStep();
      });

      // Buildings skip directly to building_config after address
      expect(result.current.currentStep).toBe("building_config");
    });
  });
});
