import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";

export interface Meter {
  id: string;
  lease_id: string;
  property_id?: string | null;
  type: "electricity" | "gas" | "water";
  provider?: string | null;
  provider_meter_id?: string | null;
  is_connected: boolean;
  meter_number?: string | null;
  unit: "kwh" | "m3" | "l";
  created_at: string;
  updated_at: string;
}

export interface MeterReading {
  id: string;
  meter_id: string;
  reading_value: number;
  unit: "kwh" | "m3" | "l";
  reading_date: string;
  photo_url?: string | null;
  source: "api" | "manual" | "ocr";
  confidence?: number | null;
  ocr_provider?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface ConsumptionEstimate {
  id: string;
  meter_id: string;
  period_start: string;
  period_end: string;
  estimated_consumption: number;
  estimated_cost?: number | null;
  method?: "linear" | "average" | "ml_model" | null;
  created_at: string;
}

export class MetersService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Récupérer les compteurs d'un bail
   */
  async getMeters(leaseId: string): Promise<Meter[]> {
    const { data, error } = await this.supabase
      .from("meters")
      .select("*")
      .eq("lease_id", leaseId)
      .order("type", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Récupérer un compteur
   */
  async getMeter(id: string): Promise<Meter | null> {
    const { data, error } = await this.supabase
      .from("meters")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return data;
  }

  /**
   * Récupérer les relevés d'un compteur
   */
  async getMeterReadings(
    meterId: string,
    limit: number = 12
  ): Promise<MeterReading[]> {
    const { data, error } = await this.supabase
      .from("meter_readings")
      .select("*")
      .eq("meter_id", meterId)
      .order("reading_date", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Ajouter un relevé manuel
   */
  async addReading(
    meterId: string,
    readingValue: number,
    readingDate: string,
    photoFile?: File
  ): Promise<MeterReading> {
    const formData = new FormData();
    formData.append("reading_value", readingValue.toString());
    formData.append("reading_date", readingDate);
    if (photoFile) {
      formData.append("photo", photoFile);
    }

    const response = await apiClient.uploadFile<{ reading: MeterReading }>(
      `/meters/${meterId}/readings`,
      formData
    );
    return response.reading;
  }

  /**
   * Ajouter un relevé manuel (méthode de compatibilité)
   */
  async addManualReading(
    meterId: string,
    readingValue: number,
    readingDate: string,
    photoFile?: File
  ): Promise<MeterReading> {
    return this.addReading(meterId, readingValue, readingDate, photoFile);
  }

  /**
   * Déclencher l'OCR sur une photo de compteur
   */
  async analyzePhoto(
    meterId: string,
    photoFile: File
  ): Promise<MeterReading> {
    const formData = new FormData();
    formData.append("photo", photoFile);

    const response = await apiClient.uploadFile<{ reading: MeterReading }>(
      `/meters/${meterId}/photo-ocr`,
      formData
    );
    return response.reading;
  }

  /**
   * Déclencher l'OCR sur une photo de compteur (méthode de compatibilité)
   */
  async analyzeMeterPhoto(
    meterId: string,
    photoFile: File
  ): Promise<MeterReading> {
    return this.analyzePhoto(meterId, photoFile);
  }

  /**
   * Récupérer les estimations de consommation
   */
  async getConsumptionEstimates(
    meterId: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<ConsumptionEstimate[]> {
    let query = this.supabase
      .from("consumption_estimates")
      .select("*")
      .eq("meter_id", meterId)
      .order("period_start", { ascending: false });

    if (periodStart) {
      query = query.gte("period_start", periodStart);
    }
    if (periodEnd) {
      query = query.lte("period_end", periodEnd);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }
}

export const metersService = new MetersService();

