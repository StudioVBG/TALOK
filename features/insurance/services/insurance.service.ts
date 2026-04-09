/**
 * Service client-side pour les appels API assurances
 */

import { apiClient } from "@/lib/api-client";
import type { InsurancePolicy, InsurancePolicyWithExpiry, InsurancePolicyInsert, InsurancePolicyUpdate } from "@/lib/insurance/types";

interface InsuranceListResponse {
  data: InsurancePolicyWithExpiry[];
  total: number;
}

interface InsuranceSingleResponse {
  data: InsurancePolicy;
}

class InsuranceService {
  async list(filters?: {
    property_id?: string;
    lease_id?: string;
    type?: string;
  }): Promise<InsurancePolicyWithExpiry[]> {
    const params = new URLSearchParams();
    if (filters?.property_id) params.set("property_id", filters.property_id);
    if (filters?.lease_id) params.set("lease_id", filters.lease_id);
    if (filters?.type) params.set("type", filters.type);
    const qs = params.toString();
    const response = await apiClient.get<InsuranceListResponse>(
      `/insurance${qs ? `?${qs}` : ""}`
    );
    return response.data;
  }

  async getById(id: string): Promise<InsurancePolicy> {
    const response = await apiClient.get<InsuranceSingleResponse>(`/insurance/${id}`);
    return response.data;
  }

  async create(data: InsurancePolicyInsert): Promise<InsurancePolicy> {
    const response = await apiClient.post<InsuranceSingleResponse>("/insurance", data);
    return response.data;
  }

  async update(id: string, data: InsurancePolicyUpdate): Promise<InsurancePolicy> {
    const response = await apiClient.put<InsuranceSingleResponse>(`/insurance/${id}`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/insurance/${id}`);
  }
}

export const insuranceService = new InsuranceService();
