import { apiClient } from "@/lib/api-client";
import { safeValidatePropertyData } from "@/lib/validations/property-validator";
import type {
  ParkingDetails,
  Photo,
  Property,
  PropertyHeating,
  PropertyType,
  PropertyUsage,
  Room,
  PhotoTag,
} from "@/lib/types";

export interface CreatePropertyData {
  type: PropertyType;
  usage_principal: PropertyUsage;
  sous_usage?: string | null;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement: string;
  surface: number;
  nb_pieces: number;
  etage?: number | null;
  ascenseur: boolean;
  energie?: string | null;
  ges?: string | null;
  erp_type?: string | null;
  erp_categorie?: string | null;
  erp_accessibilite?: boolean;
  plan_url?: string | null;
  has_irve?: boolean;
  places_parking?: number;
  parking_badge_count?: number;
  commercial_previous_activity?: string | null;
  loyer_base: number;
  charges_mensuelles: number;
  depot_garantie: number;
  zone_encadrement?: boolean;
  loyer_reference_majoré?: number | null;
  complement_loyer?: number | null;
  complement_justification?: string | null;
  dpe_classe_energie?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  dpe_classe_climat?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  dpe_consommation?: number | null;
  dpe_emissions?: number | null;
  dpe_estimation_conso_min?: number | null;
  dpe_estimation_conso_max?: number | null;
  permis_louer_requis?: boolean;
  permis_louer_numero?: string | null;
  permis_louer_date?: string | null;
  parking_details?: ParkingDetails | null;
}

export interface UpdatePropertyData extends Partial<CreatePropertyData> {}

export interface CreatePropertyDraftPayload {
  type_bien: PropertyType;
  usage_principal: PropertyUsage;
}

export interface PropertyGeneralUpdatePayload {
  adresse_complete?: string;
  code_postal?: string;
  ville?: string;
  departement?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  surface_habitable_m2?: number | null;
  nb_pieces?: number | null;
  nb_chambres?: number | null;
  etage?: number | null;
  ascenseur?: boolean | null;
  meuble?: boolean | null;
  loyer_hc?: number | null;
  charges_mensuelles?: number | null;
  depot_garantie?: number | null;
  encadrement_loyers?: boolean | null;
  zone_encadrement?: boolean | null;
}

export interface PropertyHeatingUpdatePayload {
  chauffage_type: PropertyHeating["chauffage_type"];
  chauffage_energie: PropertyHeating["chauffage_energie"];
  eau_chaude_type: PropertyHeating["eau_chaude_type"];
  clim_presence: PropertyHeating["clim_presence"];
  clim_type: PropertyHeating["clim_type"];
}

export interface RoomPayload {
  type_piece: Room["type_piece"];
  label_affiche: string;
  surface_m2?: number | null;
  chauffage_present: boolean;
  chauffage_type_emetteur?: Room["chauffage_type_emetteur"];
  clim_presente: boolean;
}

export interface PhotoUploadRequest {
  room_id?: string | null;
  file_name: string;
  mime_type: string;
  tag?: PhotoTag;
}

export interface PhotoUpdatePayload {
  room_id?: string | null;
  is_main?: boolean;
  tag?: PhotoTag;
  ordre?: number;
}

export interface PropertyShareLink {
  id: string;
  property_id: string;
  token: string;
  shareUrl: string;
  pdfUrl: string;
  expires_at: string;
  created_at: string;
  created_by?: string | null;
  revoked_at?: string | null;
  revoked_by?: string | null;
  revoke_reason?: string | null;
}

export interface AdminDecisionPayload {
  note?: string;
  reason?: string;
}

export class PropertiesService {

  async getProperties(): Promise<Property[]> {
    const response = await apiClient.get<{ properties: Property[] }>("/properties");
    return response.properties;
  }

  async getPropertyById(id: string): Promise<Property> {
    const response = await apiClient.get<{ property: Property }>(`/properties/${id}`);
    return response.property;
  }

  async getPropertiesByOwner(ownerId: string): Promise<Property[]> {
    // Filtrer côté client pour l'instant (peut être optimisé avec un paramètre de requête)
    const properties = await this.getProperties();
    return properties.filter((p) => p.owner_id === ownerId);
  }

  // Déprécié: Utiliser createDraftPropertyInit pour V3
  async createProperty(data: CreatePropertyData): Promise<Property> {
    // Utiliser le validator avec détection automatique V3 vs Legacy
    const validationResult = safeValidatePropertyData(data);
    if (!validationResult.success) {
      throw new Error(`Validation failed: ${validationResult.error.errors.map((e) => e.message).join(", ")}`);
    }
    const validatedData = validationResult.data;
    const response = await apiClient.post<{ property: Property }>("/properties", validatedData);
    return response.property;
  }

  // Déprécié: Utiliser createDraftPropertyInit
  async createDraftProperty(payload: CreatePropertyDraftPayload): Promise<Property> {
    // Utilise la route V2 (POST /api/properties)
    const response = await apiClient.post<{ property: Property }>("/properties", payload);
    return response.property;
  }

  // NOUVEAU: Création V3 via /api/properties/init
  async createDraftPropertyInit(type: string): Promise<{ propertyId: string; status: string }> {
    return apiClient.post<{ propertyId: string; status: string }>("/properties/init", { type });
  }

  async updateProperty(id: string, data: UpdatePropertyData): Promise<Property> {
    const response = await apiClient.put<{ property: Property }>(`/properties/${id}`, data);
    return response.property;
  }

  // Mise à jour tolérante (PATCH /api/properties/:id)
  async updatePropertyGeneral(id: string, data: PropertyGeneralUpdatePayload | Partial<CreatePropertyData>): Promise<Property> {
    const response = await apiClient.patch<{ property: Property }>(`/properties/${id}`, data);
    return response.property;
  }

  async deleteProperty(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(`/properties/${id}`);
  }

  async getPropertyHeating(id: string): Promise<PropertyHeating> {
    const response = await apiClient.get<{ heating: PropertyHeating }>(`/properties/${id}/heating`);
    return response.heating;
  }

  async updatePropertyHeating(
    id: string,
    payload: PropertyHeatingUpdatePayload
  ): Promise<PropertyHeating> {
    const response = await apiClient.patch<{ heating: PropertyHeating }>(
      `/properties/${id}/heating`,
      payload
    );
    return response.heating;
  }

  async listRooms(propertyId: string): Promise<Room[]> {
    const response = await apiClient.get<{ rooms: Room[] }>(`/properties/${propertyId}/rooms`);
    return response.rooms;
  }

  async createRoom(propertyId: string, payload: RoomPayload): Promise<Room> {
    const response = await apiClient.post<{ room: Room }>(
      `/properties/${propertyId}/rooms`,
      payload
    );
    return response.room;
  }

  async updateRoom(
    propertyId: string,
    roomId: string,
    payload: Partial<RoomPayload>
  ): Promise<Room> {
    const response = await apiClient.patch<{ room: Room }>(
      `/properties/${propertyId}/rooms/${roomId}`,
      payload
    );
    return response.room;
  }

  async deleteRoom(propertyId: string, roomId: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(`/properties/${propertyId}/rooms/${roomId}`);
  }

  async listPhotos(propertyId: string): Promise<Photo[]> {
    const response = await apiClient.get<{ photos: Photo[] }>(`/properties/${propertyId}/photos`);
    return response.photos;
  }

  async requestPhotoUploadUrl(
    propertyId: string,
    payload: PhotoUploadRequest
  ): Promise<{ upload_url: string; photo: Photo }> {
    return apiClient.post<{ upload_url: string; photo: Photo }>(
      `/properties/${propertyId}/photos/upload-url`,
      payload
    );
  }

  async updatePhoto(photoId: string, payload: PhotoUpdatePayload): Promise<Photo> {
    const response = await apiClient.patch<{ photo: Photo }>(`/photos/${photoId}`, payload);
    return response.photo;
  }

  async deletePhoto(photoId: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(`/photos/${photoId}`);
  }

  async submitProperty(id: string): Promise<Property> {
    const response = await apiClient.post<{ property: Property }>(`/properties/${id}/submit`);
    return response.property;
  }

  async listAdminPendingProperties(status = "en_attente"): Promise<Property[]> {
    const response = await apiClient.get<{ properties: Property[] }>(
      `/admin/properties?status=${encodeURIComponent(status)}`
    );
    return response.properties;
  }

  async approveProperty(propertyId: string, payload?: AdminDecisionPayload): Promise<Property> {
    const response = await apiClient.post<{ property: Property }>(
      `/admin/properties/${propertyId}/approve`,
      payload ?? {}
    );
    return response.property;
  }

  async rejectProperty(
    propertyId: string,
    payload: AdminDecisionPayload & { reason: string }
  ): Promise<Property> {
    const response = await apiClient.post<{ property: Property }>(
      `/admin/properties/${propertyId}/reject`,
      payload
    );
    return response.property;
  }

  async createShareLink(propertyId: string, expiresInHours = 48): Promise<PropertyShareLink> {
    const response = await apiClient.post<{ share: PropertyShareLink }>(
      `/properties/${propertyId}/share`,
      { expiresInHours }
    );
    return response.share;
  }

  async listShareLinks(propertyId: string): Promise<PropertyShareLink[]> {
    const response = await apiClient.get<{ shares: PropertyShareLink[] }>(`/properties/${propertyId}/share`);
    return response.shares;
  }

  async revokeShareLink(token: string, reason?: string): Promise<void> {
    await apiClient.post(`/properties/share/${token}/revoke`, { reason });
  }

  async getPropertyByUniqueCode(code: string): Promise<Property> {
    // Utiliser la route publique pour valider le code
    const response = await apiClient.post<{ property: { id: string }; code_valid: boolean }>(
      "/public/code/verify",
      { code }
    );
    if (!response.code_valid || !response.property) {
      throw new Error("Code invalide");
    }
    // Récupérer la propriété complète
    return this.getPropertyById(response.property.id);
  }
}

export const propertiesService = new PropertiesService();
