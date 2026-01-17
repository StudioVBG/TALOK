import { apiClient } from "@/lib/api-client";
import type { OwnerProfile, OwnerType } from "@/lib/types";

export interface CreateOwnerProfileData {
  type: OwnerType;
  siret?: string | null;
  tva?: string | null;
  iban?: string | null;
  adresse_facturation?: string | null;
  raison_sociale?: string | null;
  adresse_siege?: string | null;
  forme_juridique?: string | null;
}

export interface UpdateOwnerProfileData extends Partial<CreateOwnerProfileData> {}

export class OwnerProfilesService {
  /**
   * Récupère le profil propriétaire via l'API (contourne les RLS)
   */
  async getOwnerProfile(_profileId: string) {
    try {
      const data = await apiClient.get<OwnerProfile | null>("/me/owner-profile");
      return data;
    } catch (error: unknown) {
      // Ignorer les erreurs 404 (profil non trouvé)
      if (error.status === 404) {
        return null;
      }
      console.warn("[OwnerProfilesService] Error fetching owner profile:", error);
      return null;
    }
  }

  /**
   * Récupère le profil propriétaire de l'utilisateur connecté
   */
  async getMyOwnerProfile() {
    try {
      const data = await apiClient.get<OwnerProfile | null>("/me/owner-profile");
      return data;
    } catch (error: unknown) {
      // Ignorer les erreurs 404 (profil non trouvé)
      if (error.status === 404) {
        return null;
      }
      console.warn("[OwnerProfilesService] Error fetching my owner profile:", error);
      return null;
    }
  }

  /**
   * Met à jour le profil propriétaire de l'utilisateur connecté
   */
  async updateMyOwnerProfile(data: UpdateOwnerProfileData) {
    const profile = await apiClient.put<OwnerProfile>("/me/owner-profile", data);
    return profile;
  }

  /**
   * Crée ou met à jour le profil propriétaire via l'API (contourne les RLS)
   */
  async createOrUpdateOwnerProfile(_profileId: string, data: CreateOwnerProfileData) {
    const profile = await apiClient.put<OwnerProfile>("/me/owner-profile", data);
    return profile;
  }
}

export const ownerProfilesService = new OwnerProfilesService();

