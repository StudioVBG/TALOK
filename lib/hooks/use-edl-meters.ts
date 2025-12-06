"use client";

/**
 * Hook React pour gérer les relevés de compteurs dans l'EDL
 * 
 * Fournit:
 * - Récupération des compteurs et relevés existants
 * - Création de nouveaux relevés avec OCR
 * - Validation/correction des relevés
 * - Suppression des relevés
 */

import { useState, useCallback, useEffect } from "react";
import type {
  MeterInfo,
  EDLMeterReading,
  CreateEDLMeterReadingResponse,
} from "@/lib/types/edl-meters";

// ============================================
// TYPES
// ============================================

interface UseEDLMetersOptions {
  edlId: string;
  autoFetch?: boolean;
}

interface UseEDLMetersReturn {
  // État
  meters: MeterInfo[];
  readings: EDLMeterReading[];
  isLoading: boolean;
  error: string | null;
  allMetersRecorded: boolean;
  missingMeters: MeterInfo[];
  
  // Actions
  fetchReadings: () => Promise<void>;
  createReading: (meterId: string, photo: File, manualValue?: number) => Promise<CreateEDLMeterReadingResponse>;
  validateReading: (readingId: string, correctedValue: number, comment?: string) => Promise<EDLMeterReading>;
  deleteReading: (readingId: string) => Promise<void>;
  
  // Helpers
  getReadingByMeterId: (meterId: string) => EDLMeterReading | undefined;
  getMeterById: (meterId: string) => MeterInfo | undefined;
}

// ============================================
// HOOK
// ============================================

export function useEDLMeters({ edlId, autoFetch = true }: UseEDLMetersOptions): UseEDLMetersReturn {
  const [meters, setMeters] = useState<MeterInfo[]>([]);
  const [readings, setReadings] = useState<EDLMeterReading[]>([]);
  const [missingMeters, setMissingMeters] = useState<MeterInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // FETCH
  // ============================================

  const fetchReadings = useCallback(async () => {
    if (!edlId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/edl/${edlId}/meter-readings`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors du chargement");
      }
      
      // Extraire les compteurs des readings
      const metersFromReadings = data.readings.map((r: any) => r.meter);
      const allMeters = [...metersFromReadings, ...data.missing_meters];
      const uniqueMeters = Array.from(
        new Map(allMeters.map((m: MeterInfo) => [m.id, m])).values()
      );
      
      setMeters(uniqueMeters as MeterInfo[]);
      setReadings(data.readings);
      setMissingMeters(data.missing_meters);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [edlId]);

  // Auto-fetch au montage
  useEffect(() => {
    if (autoFetch && edlId) {
      fetchReadings();
    }
  }, [autoFetch, edlId, fetchReadings]);

  // ============================================
  // CREATE
  // ============================================

  const createReading = useCallback(async (
    meterId: string, 
    photo: File, 
    manualValue?: number
  ): Promise<CreateEDLMeterReadingResponse> => {
    const formData = new FormData();
    formData.append("meter_id", meterId);
    formData.append("photo", photo);
    if (manualValue !== undefined) {
      formData.append("manual_value", manualValue.toString());
    }

    const response = await fetch(`/api/edl/${edlId}/meter-readings`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erreur lors de la création");
    }

    // Mettre à jour l'état local
    setReadings((prev) => {
      const existing = prev.findIndex((r) => r.meter_id === meterId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = data.reading;
        return updated;
      }
      return [...prev, data.reading];
    });

    setMissingMeters((prev) => prev.filter((m) => m.id !== meterId));

    return data;
  }, [edlId]);

  // ============================================
  // VALIDATE
  // ============================================

  const validateReading = useCallback(async (
    readingId: string,
    correctedValue: number,
    comment?: string
  ): Promise<EDLMeterReading> => {
    const response = await fetch(`/api/edl/${edlId}/meter-readings/${readingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corrected_value: correctedValue, comment }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erreur lors de la validation");
    }

    // Mettre à jour l'état local
    setReadings((prev) =>
      prev.map((r) => (r.id === readingId ? data.reading : r))
    );

    return data.reading;
  }, [edlId]);

  // ============================================
  // DELETE
  // ============================================

  const deleteReading = useCallback(async (readingId: string): Promise<void> => {
    // Trouver le relevé pour récupérer le meter_id
    const reading = readings.find((r) => r.id === readingId);
    
    const response = await fetch(`/api/edl/${edlId}/meter-readings/${readingId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Erreur lors de la suppression");
    }

    // Mettre à jour l'état local
    setReadings((prev) => prev.filter((r) => r.id !== readingId));

    // Remettre le compteur dans les manquants
    if (reading) {
      const meter = meters.find((m) => m.id === reading.meter_id);
      if (meter) {
        setMissingMeters((prev) => [...prev, meter]);
      }
    }
  }, [edlId, readings, meters]);

  // ============================================
  // HELPERS
  // ============================================

  const getReadingByMeterId = useCallback(
    (meterId: string) => readings.find((r) => r.meter_id === meterId),
    [readings]
  );

  const getMeterById = useCallback(
    (meterId: string) => meters.find((m) => m.id === meterId),
    [meters]
  );

  const allMetersRecorded = missingMeters.length === 0 && meters.length > 0;

  // ============================================
  // RETURN
  // ============================================

  return {
    meters,
    readings,
    isLoading,
    error,
    allMetersRecorded,
    missingMeters,
    fetchReadings,
    createReading,
    validateReading,
    deleteReading,
    getReadingByMeterId,
    getMeterById,
  };
}

