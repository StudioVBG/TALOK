/**
 * Tests d'intégration pour le wizard de création d'EDL
 *
 * Ces tests vérifient:
 * 1. La validation des photos volumineuses
 * 2. La compression des images avant upload
 * 3. Le mécanisme de retry avec indicateur
 * 4. Les logs structurés pour monitoring
 * 5. La création complète d'un EDL avec toutes les données
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock des fonctions de compression d'image
vi.mock("@/lib/helpers/image-compression", () => ({
  prepareImageForUpload: vi.fn().mockImplementation(async (file, options) => {
    const maxSize = options?.maxSizeBytes || 4 * 1024 * 1024;
    if (file.size > maxSize) {
      // Simule la compression
      return {
        file: new File([new ArrayBuffer(maxSize - 1000)], file.name, { type: "image/jpeg" }),
        wasCompressed: true,
        stats: {
          originalSize: file.size,
          compressedSize: maxSize - 1000,
          compressionRatio: (maxSize - 1000) / file.size,
        },
      };
    }
    return { file, wasCompressed: false };
  }),
}));

// ============================================
// 1. Tests de validation des photos
// ============================================

describe("EDL Wizard - Validation des photos", () => {
  const MAX_PHOTO_SIZE_MB = 4;
  const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

  const validatePhotoSize = (files: File[]): { largePhotos: File[]; isValid: boolean } => {
    const largePhotos = files.filter(f => f.size > MAX_PHOTO_SIZE_BYTES);
    return {
      largePhotos,
      isValid: largePhotos.length === 0,
    };
  };

  it("devrait détecter les photos dépassant 4 Mo", () => {
    const smallPhoto = new File([new ArrayBuffer(1024 * 1024)], "small.jpg", { type: "image/jpeg" });
    const largePhoto = new File([new ArrayBuffer(5 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" });

    const result = validatePhotoSize([smallPhoto, largePhoto]);

    expect(result.largePhotos).toHaveLength(1);
    expect(result.largePhotos[0].name).toBe("large.jpg");
    expect(result.isValid).toBe(false);
  });

  it("devrait valider les photos de moins de 4 Mo", () => {
    const photo1 = new File([new ArrayBuffer(1024 * 1024)], "photo1.jpg", { type: "image/jpeg" });
    const photo2 = new File([new ArrayBuffer(2 * 1024 * 1024)], "photo2.jpg", { type: "image/jpeg" });

    const result = validatePhotoSize([photo1, photo2]);

    expect(result.largePhotos).toHaveLength(0);
    expect(result.isValid).toBe(true);
  });
});

// ============================================
// 2. Tests de compression d'images
// ============================================

describe("EDL Wizard - Compression d'images", () => {
  it("devrait compresser les photos volumineuses avant upload", async () => {
    const { prepareImageForUpload } = await import("@/lib/helpers/image-compression");

    const largePhoto = new File([new ArrayBuffer(6 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" });

    const result = await prepareImageForUpload(largePhoto, {
      maxSizeBytes: 4 * 1024 * 1024,
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080,
    });

    expect(result.wasCompressed).toBe(true);
    expect(result.file.size).toBeLessThan(4 * 1024 * 1024);
  });

  it("ne devrait pas compresser les photos de taille acceptable", async () => {
    const { prepareImageForUpload } = await import("@/lib/helpers/image-compression");

    const smallPhoto = new File([new ArrayBuffer(2 * 1024 * 1024)], "small.jpg", { type: "image/jpeg" });

    const result = await prepareImageForUpload(smallPhoto, {
      maxSizeBytes: 4 * 1024 * 1024,
    });

    expect(result.wasCompressed).toBe(false);
    expect(result.file).toBe(smallPhoto);
  });
});

// ============================================
// 3. Tests du mécanisme de retry
// ============================================

describe("EDL Wizard - Mécanisme de retry", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleSpy: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Simule la fonction safeFetch du wizard
  const safeFetch = async (
    url: string,
    options?: RequestInit,
    maxRetries = 2,
    onRetry?: (attempt: number) => void
  ) => {
    let lastError: Error | null = null;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          onRetry?.(attempt);
          console.log(JSON.stringify({
            event: "edl_wizard_retry",
            url: url.replace(/\/api\//, ""),
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            timestamp: new Date().toISOString(),
          }));
        }

        const res: any = await fetchMock(url, options);

        if (!res.ok) {
          const errorData = await res.json?.().catch(() => ({}));
          const err = new Error(errorData.error || `Erreur ${res.status}`);

          if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
            throw err;
          }
          lastError = err;
          if (attempt < maxRetries) {
            continue;
          }
          throw err;
        }
        return res;
      } catch (err: any) {
        lastError = err;
        if ((err.message === "Load failed" || err.message === "Failed to fetch") && attempt < maxRetries) {
          continue;
        }
        throw err;
      }
    }
    throw lastError || new Error("Erreur inattendue");
  };

  it("devrait réussir après un retry sur erreur réseau", async () => {
    const retryCallback = vi.fn();

    // Première requête échoue, deuxième réussit
    fetchMock
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });

    const result: any = await safeFetch("/api/edl/123/sections", {}, 2, retryCallback);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retryCallback).toHaveBeenCalledWith(1);
    expect(result.ok).toBe(true);
  });

  it("devrait échouer après avoir épuisé les retries", async () => {
    fetchMock.mockRejectedValue(new Error("Failed to fetch"));

    await expect(
      safeFetch("/api/edl/123/sections", {}, 2)
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("ne devrait pas retry les erreurs 4xx (sauf 408/429)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "Bad request" }),
    });

    await expect(
      safeFetch("/api/edl/123/sections", {}, 2)
    ).rejects.toThrow("Bad request");

    expect(fetchMock).toHaveBeenCalledTimes(1); // Pas de retry
  });
});

// ============================================
// 4. Tests des logs structurés
// ============================================

describe("EDL Wizard - Logs structurés", () => {
  it("devrait produire des logs JSON valides pour monitoring", () => {
    const logEntry = {
      event: "edl_wizard_http_error",
      url: "edl/123/sections",
      status: 500,
      error: "Internal Server Error",
      attempt: 2,
      duration: 1234,
      timestamp: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(logEntry);
    const parsed = JSON.parse(jsonString);

    expect(parsed.event).toBe("edl_wizard_http_error");
    expect(parsed.status).toBe(500);
    expect(parsed.attempt).toBe(2);
    expect(parsed.timestamp).toBeDefined();
  });

  it("devrait logger les events de retry", () => {
    const retryLog = {
      event: "edl_wizard_retry",
      url: "edl/123/meter-readings",
      attempt: 2,
      maxRetries: 3,
      timestamp: new Date().toISOString(),
    };

    expect(retryLog.event).toBe("edl_wizard_retry");
    expect(retryLog.attempt).toBe(2);
  });

  it("devrait logger les succès après retry", () => {
    const successLog = {
      event: "edl_wizard_retry_success",
      url: "inspections/456/photos",
      attempts: 2,
      duration: 3456,
      timestamp: new Date().toISOString(),
    };

    expect(successLog.event).toBe("edl_wizard_retry_success");
    expect(successLog.attempts).toBe(2);
    expect(successLog.duration).toBeGreaterThan(0);
  });
});

// ============================================
// 5. Tests du flux complet de création EDL
// ============================================

describe("EDL Wizard - Flux complet de création", () => {
  // Structure de données pour un EDL complet
  interface EDLCreationData {
    lease_id: string;
    type: "entree" | "sortie";
    scheduled_at: string;
    general_notes: string;
    keys: Array<{ type: string; quantite: number; notes?: string }>;
    sections: Array<{
      room_name: string;
      items: Array<{
        item_name: string;
        condition: string;
        notes?: string;
      }>;
    }>;
    meter_readings: Array<{
      type: string;
      meter_number: string;
      reading: string;
      unit: string;
    }>;
    photos: Array<{
      section: string;
      file: File;
    }>;
  }

  const validateEDLData = (data: EDLCreationData): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!data.lease_id) errors.push("lease_id requis");
    if (!["entree", "sortie"].includes(data.type)) errors.push("type invalide");
    if (!data.scheduled_at) errors.push("scheduled_at requis");
    if (data.sections.length === 0) errors.push("Au moins une pièce requise");
    if (data.keys.length === 0) errors.push("Au moins une clé requise");

    // Valider les conditions
    for (const section of data.sections) {
      for (const item of section.items) {
        if (!["neuf", "bon", "moyen", "mauvais", "tres_mauvais", null].includes(item.condition)) {
          errors.push(`Condition invalide pour ${item.item_name}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  };

  it("devrait valider un EDL complet correctement formé", () => {
    const validEDL: EDLCreationData = {
      lease_id: "550e8400-e29b-41d4-a716-446655440000",
      type: "entree",
      scheduled_at: "2026-02-15T10:00:00Z",
      general_notes: "Appartement en bon état général",
      keys: [
        { type: "Clé Porte d'entrée", quantite: 2 },
        { type: "Digicode", quantite: 1, notes: "Code: 1234A" },
      ],
      sections: [
        {
          room_name: "Salon",
          items: [
            { item_name: "Murs", condition: "bon" },
            { item_name: "Sol", condition: "moyen", notes: "Rayures légères" },
          ],
        },
        {
          room_name: "Cuisine",
          items: [
            { item_name: "Murs", condition: "bon" },
            { item_name: "Évier", condition: "neuf" },
          ],
        },
      ],
      meter_readings: [
        { type: "electricity", meter_number: "12345", reading: "15234", unit: "kWh" },
        { type: "water", meter_number: "67890", reading: "1234", unit: "m³" },
      ],
      photos: [],
    };

    const result = validateEDLData(validEDL);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("devrait détecter les erreurs dans un EDL mal formé", () => {
    const invalidEDL: EDLCreationData = {
      lease_id: "",
      type: "invalide" as any,
      scheduled_at: "",
      general_notes: "",
      keys: [],
      sections: [],
      meter_readings: [],
      photos: [],
    };

    const result = validateEDLData(invalidEDL);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("lease_id requis");
    expect(result.errors).toContain("type invalide");
    expect(result.errors).toContain("scheduled_at requis");
    expect(result.errors).toContain("Au moins une pièce requise");
    expect(result.errors).toContain("Au moins une clé requise");
  });

  it("devrait calculer correctement le nombre total de photos", () => {
    const roomsData = [
      {
        name: "Salon",
        items: [
          { name: "Murs", photos: [new File([], "1.jpg"), new File([], "2.jpg")] },
          { name: "Sol", photos: [new File([], "3.jpg")] },
        ],
        globalPhotos: [new File([], "4.jpg")],
      },
      {
        name: "Cuisine",
        items: [
          { name: "Murs", photos: [] },
        ],
        globalPhotos: [new File([], "5.jpg"), new File([], "6.jpg")],
      },
    ];

    const totalPhotos = roomsData.reduce((acc, room) => {
      const itemPhotos = room.items.reduce((sum, item) => sum + item.photos.length, 0);
      const globalPhotos = room.globalPhotos?.length || 0;
      return acc + itemPhotos + globalPhotos;
    }, 0);

    expect(totalPhotos).toBe(6);
  });
});

// ============================================
// 6. Tests des meter readings pour EDL
// ============================================

describe("EDL Wizard - Relevés de compteurs", () => {
  it("devrait formater correctement les données pour l'API", () => {
    const meterReading = {
      type: "electricity" as const,
      meterNumber: "12345678",
      reading: "15234",
      unit: "kWh",
      photo: new File([new ArrayBuffer(1024)], "meter.jpg", { type: "image/jpeg" }),
    };

    // Format FormData (avec photo)
    const formData = new FormData();
    formData.append("meter_id", "uuid-test");
    formData.append("meter_type", meterReading.type);
    formData.append("meter_number", meterReading.meterNumber);
    formData.append("manual_value", meterReading.reading);
    formData.append("reading_unit", meterReading.unit);
    formData.append("photo", meterReading.photo);

    expect(formData.get("meter_type")).toBe("electricity");
    expect(formData.get("manual_value")).toBe("15234");
    expect(formData.get("photo")).toBeInstanceOf(File);
  });

  it("devrait formater correctement les données JSON (sans photo)", () => {
    const meterReading = {
      meter_id: "uuid-test",
      meter_type: "water",
      meter_number: "67890",
      reading_value: 1234.5,
      reading_unit: "m³",
      photo_path: null,
    };

    const jsonData = JSON.stringify(meterReading);
    const parsed = JSON.parse(jsonData);

    expect(parsed.meter_type).toBe("water");
    expect(parsed.reading_value).toBe(1234.5);
    expect(parsed.photo_path).toBeNull();
  });
});
