import { apiClient } from "@/lib/api-client";
import type { ColocationMemberRow } from "@/lib/supabase/database.types";
import type { ColocationMemberWithDetails } from "../types";

export class ColocationMembersService {
  async getMembers(propertyId: string): Promise<ColocationMemberWithDetails[]> {
    const response = await apiClient.get<{ members: ColocationMemberWithDetails[] }>(
      `/colocation/members?property_id=${propertyId}`
    );
    return response.members;
  }

  async addMember(data: {
    property_id: string;
    room_id?: string;
    lease_id: string;
    tenant_profile_id: string;
    move_in_date: string;
    rent_share_cents: number;
    charges_share_cents?: number;
    deposit_cents?: number;
    pays_individually?: boolean;
  }): Promise<ColocationMemberRow> {
    const response = await apiClient.post<{ member: ColocationMemberRow }>(
      "/colocation/members",
      data
    );
    return response.member;
  }

  async declareDeparture(
    memberId: string,
    data: { notice_effective_date: string }
  ): Promise<ColocationMemberRow> {
    const response = await apiClient.post<{ member: ColocationMemberRow }>(
      `/colocation/members/${memberId}/departure`,
      data
    );
    return response.member;
  }

  async replaceMember(
    memberId: string,
    data: {
      new_tenant_profile_id: string;
      new_move_in_date: string;
      new_rent_share_cents?: number;
      new_charges_share_cents?: number;
      new_deposit_cents?: number;
    }
  ): Promise<{ departing: ColocationMemberRow; replacement: ColocationMemberRow }> {
    const response = await apiClient.post<{
      departing: ColocationMemberRow;
      replacement: ColocationMemberRow;
    }>(`/colocation/members/${memberId}/replace`, data);
    return response;
  }
}

export const colocationMembersService = new ColocationMembersService();
