/**
 * Service pour les relevés de compteurs EDL
 * 
 * Encapsule les appels API côté client pour:
 * - Récupérer les relevés d'un EDL
 * - Créer un nouveau relevé avec OCR
 * - Valider/corriger un relevé
 * - Supprimer un relevé
 * - Comparer les consommations entre EDL entrée/sortie
 */

import type {
  MeterInfo,
  EDLMeterReading,
  EDLMeterReadingWithDetails,
  MeterConsumption,
  CreateEDLMeterReadingResponse,
  GetEDLMeterReadingsResponse,
  CompareMeterConsumptionResponse,
} from "@/lib/types/edl-meters";

class EDLMetersService {
  /**
   * Récupérer tous les relevés d'un EDL avec les compteurs manquants
   */
  async getReadings(edlId: string): Promise<GetEDLMeterReadingsResponse> {
    const response = await fetch(`/api/edl/${edlId}/meter-readings`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Erreur lors du chargement des relevés");
    }
    
    return data;
  }

  /**
   * Créer un nouveau relevé avec OCR automatique
   */
  async createReading(
    edlId: string,
    meterId: string,
    photo: File,
    manualValue?: number,
    comment?: string
  ): Promise<CreateEDLMeterReadingResponse> {
    const formData = new FormData();
    formData.append("meter_id", meterId);
    formData.append("photo", photo);
    
    if (manualValue !== undefined) {
      formData.append("manual_value", manualValue.toString());
    }
    
    if (comment) {
      formData.append("comment", comment);
    }

    const response = await fetch(`/api/edl/${edlId}/meter-readings`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      // Cas spécial: OCR a échoué mais photo uploadée
      if (response.status === 422 && data.photo_path) {
        throw new OCRFailedError(
          data.error || "Impossible de lire la valeur automatiquement",
          data.ocr,
          data.photo_path
        );
      }
      throw new Error(data.error || "Erreur lors de la création du relevé");
    }

    return data;
  }

  /**
   * Récupérer les détails d'un relevé spécifique
   */
  async getReading(edlId: string, readingId: string): Promise<EDLMeterReadingWithDetails> {
    const response = await fetch(`/api/edl/${edlId}/meter-readings/${readingId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Erreur lors du chargement du relevé");
    }
    
    return data.reading;
  }

  /**
   * Valider ou corriger un relevé existant
   */
  async validateReading(
    edlId: string,
    readingId: string,
    correctedValue: number,
    comment?: string
  ): Promise<EDLMeterReading> {
    const response = await fetch(`/api/edl/${edlId}/meter-readings/${readingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        corrected_value: correctedValue,
        comment,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erreur lors de la validation du relevé");
    }

    return data.reading;
  }

  /**
   * Supprimer un relevé (propriétaire uniquement, EDL non signé)
   */
  async deleteReading(edlId: string, readingId: string): Promise<void> {
    const response = await fetch(`/api/edl/${edlId}/meter-readings/${readingId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Erreur lors de la suppression du relevé");
    }
  }

  /**
   * Comparer les consommations entre l'EDL d'entrée et l'EDL de sortie
   * Utile pour la fin de bail
   */
  async compareConsumptions(leaseId: string): Promise<CompareMeterConsumptionResponse> {
    const response = await fetch(`/api/leases/${leaseId}/meter-consumption`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Erreur lors de la comparaison des consommations");
    }
    
    return data;
  }

  /**
   * Vérifier si tous les compteurs sont relevés pour un EDL
   */
  async checkCompleteness(edlId: string): Promise<{ complete: boolean; missing: MeterInfo[] }> {
    const data = await this.getReadings(edlId);
    return {
      complete: data.all_meters_recorded,
      missing: data.missing_meters,
    };
  }

  /**
   * Obtenir l'URL signée d'une photo de relevé
   */
  async getPhotoUrl(edlId: string, readingId: string): Promise<string | null> {
    const reading = await this.getReading(edlId, readingId);
    return (reading as any).photo_url || null;
  }
}

/**
 * Erreur personnalisée quand l'OCR échoue mais la photo est uploadée
 */
export class OCRFailedError extends Error {
  constructor(
    message: string,
    public ocr: {
      detected_value: number | null;
      confidence: number;
      needs_validation: boolean;
      raw_text: string;
      processing_time_ms: number;
    },
    public photoPath: string
  ) {
    super(message);
    this.name = "OCRFailedError";
  }
}

// Export singleton
export const edlMetersService = new EDLMetersService();

// Export classe pour tests
export { EDLMetersService };

