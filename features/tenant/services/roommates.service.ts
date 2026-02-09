import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";

export interface Roommate {
  id: string;
  lease_id: string;
  user_id: string | null;
  profile_id: string | null;
  role: "principal" | "tenant" | "occupant" | "guarantor";
  first_name: string | null;
  last_name: string | null;
  weight: number;
  joined_on: string;
  left_on?: string | null;
  invited_email?: string | null;
  invitation_status?: "pending" | "accepted" | "declined";
  room_label?: string | null;
  has_guarantor?: boolean;
  guarantor_email?: string | null;
  guarantor_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRoommateData {
  lease_id: string;
  user_id: string;
  profile_id: string;
  role: "principal" | "tenant" | "occupant" | "guarantor";
  first_name: string;
  last_name: string;
  weight?: number;
}

export class RoommatesService {
  private supabase = createClient();

  /**
   * Liste des colocataires d'un bail
   */
  async getRoommates(leaseId: string): Promise<Roommate[]> {
    const response = await apiClient.get<{ roommates: Roommate[] }>(
      `/leases/${leaseId}/roommates`
    );
    return response.roommates;
  }

  /**
   * Détails d'un colocataire
   */
  async getRoommate(id: string): Promise<Roommate | null> {
    const { data, error } = await this.supabase
      .from("roommates")
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
   * Créer un colocataire
   */
  async createRoommate(data: CreateRoommateData): Promise<Roommate> {
    const { data: roommate, error } = await this.supabase
      .from("roommates")
      .insert({
        ...data,
        weight: data.weight || 1.0,
      })
      .select()
      .single();

    if (error) throw error;
    return roommate;
  }

  /**
   * Mettre à jour un colocataire
   */
  async updateRoommate(
    id: string,
    updates: Partial<CreateRoommateData>
  ): Promise<Roommate> {
    const { data, error } = await this.supabase
      .from("roommates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Retirer un colocataire (soft delete)
   */
  async removeRoommate(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("roommates")
      .update({ left_on: new Date().toISOString().split("T")[0] })
      .eq("id", id);

    if (error) throw error;
  }
}

export const roommatesService = new RoommatesService();

