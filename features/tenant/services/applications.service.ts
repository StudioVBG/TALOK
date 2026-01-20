import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";

export interface TenantApplication {
  id: string;
  unit_id?: string | null;
  property_id?: string | null;
  tenant_user: string;
  tenant_profile_id: string;
  status:
    | "started"
    | "docs_pending"
    | "review"
    | "ready_to_sign"
    | "signed"
    | "rejected";
  extracted_json?: Record<string, any> | null;
  confidence?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationFile {
  id: string;
  application_id: string;
  kind: "identity" | "income" | "address" | "guarantee" | "other";
  storage_path: string;
  sha256: string;
  file_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  uploaded_at: string;
  analyzed_at?: string | null;
  ocr_provider?: string | null;
  ocr_result?: Record<string, any> | null;
  confidence?: number | null;
}

export interface ExtractedField {
  id: string;
  application_id: string;
  file_id?: string | null;
  field_name: string;
  field_value?: string | null;
  confidence?: number | null;
  source?: string | null;
  extracted_at: string;
}

export interface CreateApplicationData {
  unit_id?: string;
  property_id?: string;
  code?: string; // Code d'invitation ou code logement
}

export class ApplicationsService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Récupérer une application
   */
  async getApplication(id: string): Promise<TenantApplication | null> {
    const { data, error } = await this.supabase
      .from("tenant_applications")
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
   * Créer une application (lien avec logement via code)
   */
  async createApplication(
    data: CreateApplicationData
  ): Promise<TenantApplication> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    // Récupérer le profil
    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new Error("Profil non trouvé");

    // Si un code est fourni, résoudre le property_id ou unit_id
    let propertyId = data.property_id;
    let unitId = data.unit_id;

    if (data.code && !propertyId && !unitId) {
      const { data: property } = await this.supabase
        .from("properties")
        .select("id")
        .eq("unique_code", data.code)
        .single();

      if (property) {
        propertyId = property.id;
      }
    }

    const { data: application, error } = await this.supabase
      .from("tenant_applications")
      .insert({
        tenant_user: user.id,
        tenant_profile_id: profile.id,
        property_id: propertyId,
        unit_id: unitId,
        status: "started",
      })
      .select()
      .single();

    if (error) throw error;
    return application;
  }

  /**
   * Mettre à jour le statut d'une application
   */
  async updateApplicationStatus(
    id: string,
    status: TenantApplication["status"],
    rejectionReason?: string
  ): Promise<TenantApplication> {
    const updates: any = { status };
    if (rejectionReason) {
      updates.rejection_reason = rejectionReason;
    }

    const { data, error } = await this.supabase
      .from("tenant_applications")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les fichiers d'une application
   */
  async getApplicationFiles(
    applicationId: string
  ): Promise<ApplicationFile[]> {
    const { data, error } = await this.supabase
      .from("application_files")
      .select("*")
      .eq("application_id", applicationId)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Uploader un fichier pour une application
   */
  async uploadFile(
    applicationId: string,
    file: File,
    kind: ApplicationFile["kind"]
  ): Promise<ApplicationFile> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);

    const response = await apiClient.uploadFile<{ file: ApplicationFile }>(
      `/applications/${applicationId}/files`,
      formData
    );
    return response.file;
  }

  /**
   * Récupérer les champs extraits
   */
  async getExtractedFields(
    applicationId: string
  ): Promise<ExtractedField[]> {
    const { data, error } = await this.supabase
      .from("extracted_fields")
      .select("*")
      .eq("application_id", applicationId)
      .order("extracted_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Déclencher l'analyse OCR/IDP (appelle une route API qui déclenche le job)
   */
  async analyzeApplication(applicationId: string): Promise<void> {
    await apiClient.post(`/applications/${applicationId}/analyze`);
  }
}

export const applicationsService = new ApplicationsService();

