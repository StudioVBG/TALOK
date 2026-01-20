import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";

export interface Signature {
  id: string;
  draft_id?: string | null;
  lease_id?: string | null;
  signer_user: string;
  signer_profile_id: string;
  level: "SES" | "AES" | "QES";
  otp_verified: boolean;
  otp_code?: string | null;
  otp_expires_at?: string | null;
  ip_inet?: string | null;
  user_agent?: string | null;
  signed_at?: string | null;
  signature_image_path?: string | null;
  evidence_pdf_url?: string | null;
  doc_hash: string;
  provider_ref?: string | null;
  provider_data?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface LeaseDraft {
  id: string;
  application_id?: string | null;
  lease_id?: string | null;
  template_id?: string | null;
  version: number;
  variables: Record<string, any>;
  pdf_url?: string | null;
  pdf_hash?: string | null;
  created_at: string;
  updated_at: string;
}

export class LeaseSignaturesService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Récupérer le draft d'un bail
   */
  async getDraft(leaseId: string): Promise<LeaseDraft | null> {
    const { data, error } = await this.supabase
      .from("lease_drafts")
      .select("*")
      .eq("lease_id", leaseId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return data;
  }

  /**
   * Récupérer les signatures d'un bail
   */
  async getSignatures(leaseId: string): Promise<Signature[]> {
    const { data, error } = await this.supabase
      .from("signatures")
      .select("*")
      .eq("lease_id", leaseId)
      .order("signed_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Signer un bail
   */
  async signLease(
    leaseId: string,
    level: "SES" | "AES" | "QES" = "SES",
    signatureImage?: string,
    otpCode?: string
  ): Promise<Signature> {
    const response = await apiClient.post<{ signature: Signature }>(
      `/leases/${leaseId}/sign`,
      {
        level,
        signature_image: signatureImage,
        otp_code: otpCode,
      }
    );
    return response.signature;
  }

  /**
   * Vérifier si tous les signataires ont signé
   */
  async areAllSignaturesComplete(leaseId: string): Promise<boolean> {
    const { data: signers, error } = await this.supabase
      .from("lease_signers")
      .select("signature_status")
      .eq("lease_id", leaseId);

    if (error) throw error;

    return signers?.every((s) => s.signature_status === "signed") || false;
  }
}

export const leaseSignaturesService = new LeaseSignaturesService();

