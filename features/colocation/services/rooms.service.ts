import { apiClient } from "@/lib/api-client";
import type { ColocationRoomRow } from "@/lib/supabase/database.types";
import type { ColocationRoomWithOccupant } from "../types";

export class ColocationRoomsService {
  async getRooms(propertyId: string): Promise<ColocationRoomWithOccupant[]> {
    const response = await apiClient.get<{ rooms: ColocationRoomWithOccupant[] }>(
      `/colocation/rooms?property_id=${propertyId}`
    );
    return response.rooms;
  }

  async createRoom(data: {
    property_id: string;
    room_number: string;
    room_label?: string;
    surface_m2?: number;
    rent_share_cents: number;
    charges_share_cents?: number;
    is_furnished?: boolean;
    description?: string;
    photos?: Array<{ url: string; caption?: string }>;
  }): Promise<ColocationRoomRow> {
    const response = await apiClient.post<{ room: ColocationRoomRow }>(
      "/colocation/rooms",
      data
    );
    return response.room;
  }

  async updateRoom(
    id: string,
    data: Partial<{
      room_number: string;
      room_label: string;
      surface_m2: number;
      rent_share_cents: number;
      charges_share_cents: number;
      is_furnished: boolean;
      description: string;
      photos: Array<{ url: string; caption?: string }>;
      is_available: boolean;
    }>
  ): Promise<ColocationRoomRow> {
    const response = await apiClient.patch<{ room: ColocationRoomRow }>(
      `/colocation/rooms/${id}`,
      data
    );
    return response.room;
  }

  async deleteRoom(id: string): Promise<void> {
    await apiClient.delete(`/colocation/rooms/${id}`);
  }
}

export const colocationRoomsService = new ColocationRoomsService();
