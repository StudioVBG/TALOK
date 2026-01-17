/**
 * Service pour la gestion des profils garants
 */

import { apiClient } from "@/lib/api-client";
import {
  createGuarantorProfileSchema,
  updateGuarantorProfileSchema,
  createEngagementSchema,
  type CreateGuarantorProfileInput,
  type UpdateGuarantorProfileInput,
  type CreateEngagementInput,
} from "@/lib/validations/guarantor";
import type {
  GuarantorProfile,
  GuarantorEngagement,
  GuarantorDocument,
  GuarantorDashboardData,
  GuarantorEligibilityResult,
  GuarantorDocumentType,
} from "@/lib/types/guarantor";

export class GuarantorProfilesService {
  // ============================================
  // PROFIL
  // ============================================

  /**
   * Récupérer le profil garant de l'utilisateur connecté
   */
  async getMyProfile(): Promise<GuarantorProfile | null> {
    try {
      const data = await apiClient.get<GuarantorProfile | null>("/guarantors/me");
      return data;
    } catch (error: unknown) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Récupérer un profil garant par ID
   */
  async getProfile(profileId: string): Promise<GuarantorProfile | null> {
    try {
      const data = await apiClient.get<GuarantorProfile>(`/guarantors/${profileId}`);
      return data;
    } catch (error: unknown) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Créer le profil garant de l'utilisateur connecté
   */
  async createProfile(data: CreateGuarantorProfileInput): Promise<GuarantorProfile> {
    const validatedData = createGuarantorProfileSchema.parse(data);
    const profile = await apiClient.post<GuarantorProfile>("/guarantors", validatedData);
    return profile;
  }

  /**
   * Mettre à jour le profil garant
   */
  async updateProfile(data: UpdateGuarantorProfileInput): Promise<GuarantorProfile> {
    const validatedData = updateGuarantorProfileSchema.parse(data);
    const profile = await apiClient.put<GuarantorProfile>("/guarantors/me", validatedData);
    return profile;
  }

  /**
   * Donner le consentement de caution
   */
  async giveConsent(): Promise<GuarantorProfile> {
    return this.updateProfile({
      consent_garant: true,
      consent_data_processing: true,
    });
  }

  // ============================================
  // DASHBOARD
  // ============================================

  /**
   * Récupérer les données du dashboard garant
   */
  async getDashboard(): Promise<GuarantorDashboardData | null> {
    try {
      const data = await apiClient.get<GuarantorDashboardData>("/guarantors/dashboard");
      return data;
    } catch (error: unknown) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // ============================================
  // ENGAGEMENTS
  // ============================================

  /**
   * Récupérer tous les engagements du garant
   */
  async getEngagements(): Promise<GuarantorEngagement[]> {
    const response = await apiClient.get<{ engagements: GuarantorEngagement[] }>(
      "/guarantors/engagements"
    );
    return response.engagements;
  }

  /**
   * Récupérer un engagement spécifique
   */
  async getEngagement(engagementId: string): Promise<GuarantorEngagement | null> {
    try {
      const engagement = await apiClient.get<GuarantorEngagement>(
        `/guarantors/engagements/${engagementId}`
      );
      return engagement;
    } catch (error: unknown) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Créer un nouvel engagement (appelé par le propriétaire)
   */
  async createEngagement(data: CreateEngagementInput): Promise<GuarantorEngagement> {
    const validatedData = createEngagementSchema.parse(data);
    const engagement = await apiClient.post<GuarantorEngagement>(
      "/guarantors/engagements",
      validatedData
    );
    return engagement;
  }

  /**
   * Accepter/signer un engagement
   */
  async signEngagement(engagementId: string): Promise<GuarantorEngagement> {
    const engagement = await apiClient.post<GuarantorEngagement>(
      `/guarantors/engagements/${engagementId}/sign`
    );
    return engagement;
  }

  /**
   * Refuser un engagement
   */
  async refuseEngagement(engagementId: string, reason?: string): Promise<void> {
    await apiClient.post(`/guarantors/engagements/${engagementId}/refuse`, { reason });
  }

  // ============================================
  // DOCUMENTS
  // ============================================

  /**
   * Récupérer tous les documents du garant
   */
  async getDocuments(): Promise<GuarantorDocument[]> {
    const response = await apiClient.get<{ documents: GuarantorDocument[] }>(
      "/guarantors/documents"
    );
    return response.documents;
  }

  /**
   * Uploader un document
   */
  async uploadDocument(
    file: File,
    documentType: GuarantorDocumentType
  ): Promise<GuarantorDocument> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);

    const response = await fetch("/api/guarantors/documents/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de l'upload");
    }

    return response.json();
  }

  /**
   * Supprimer un document
   */
  async deleteDocument(documentId: string): Promise<void> {
    await apiClient.delete(`/guarantors/documents/${documentId}`);
  }

  /**
   * Vérifier la complétude des documents
   */
  async checkDocumentsCompleteness(): Promise<{
    complete: boolean;
    missing: GuarantorDocumentType[];
    provided: GuarantorDocumentType[];
  }> {
    const response = await apiClient.get<{
      complete: boolean;
      missing: GuarantorDocumentType[];
      provided: GuarantorDocumentType[];
    }>("/guarantors/documents/check");
    return response;
  }

  // ============================================
  // ÉLIGIBILITÉ
  // ============================================

  /**
   * Vérifier l'éligibilité du garant pour un bail
   */
  async checkEligibility(leaseId: string): Promise<GuarantorEligibilityResult> {
    const result = await apiClient.get<GuarantorEligibilityResult>(
      `/guarantors/eligibility?leaseId=${encodeURIComponent(leaseId)}`
    );
    return result;
  }

  // ============================================
  // INCIDENTS
  // ============================================

  /**
   * Récupérer les incidents de paiement
   */
  async getPaymentIncidents(): Promise<any[]> {
    const response = await apiClient.get<{ incidents: any[] }>("/guarantors/incidents");
    return response.incidents;
  }

  // ============================================
  // ADMIN / VÉRIFICATION
  // ============================================

  /**
   * Vérifier les documents d'un garant (admin/propriétaire)
   */
  async verifyDocuments(
    guarantorProfileId: string,
    verified: boolean,
    notes?: string
  ): Promise<GuarantorProfile> {
    const profile = await apiClient.post<GuarantorProfile>(
      `/guarantors/${guarantorProfileId}/verify`,
      { verified, notes }
    );
    return profile;
  }

  /**
   * Lister tous les garants (admin)
   */
  async listAll(params?: {
    verified?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ guarantors: GuarantorProfile[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.verified !== undefined) {
      searchParams.set("verified", String(params.verified));
    }
    if (params?.page) {
      searchParams.set("page", String(params.page));
    }
    if (params?.limit) {
      searchParams.set("limit", String(params.limit));
    }

    const response = await apiClient.get<{ guarantors: GuarantorProfile[]; total: number }>(
      `/admin/guarantors?${searchParams.toString()}`
    );
    return response;
  }
}

export const guarantorProfilesService = new GuarantorProfilesService();







