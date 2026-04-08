import { apiClient } from "@/lib/api-client";
import type { ColocationRuleRow } from "@/lib/supabase/database.types";

export class ColocationRulesService {
  async getRules(propertyId: string): Promise<ColocationRuleRow[]> {
    const response = await apiClient.get<{ rules: ColocationRuleRow[] }>(
      `/colocation/rules?property_id=${propertyId}`
    );
    return response.rules;
  }

  async createRule(data: {
    property_id: string;
    title: string;
    category?: string;
    description: string;
    sort_order?: number;
  }): Promise<ColocationRuleRow> {
    const response = await apiClient.post<{ rule: ColocationRuleRow }>(
      "/colocation/rules",
      data
    );
    return response.rule;
  }

  async updateRule(
    id: string,
    data: Partial<{
      title: string;
      category: string;
      description: string;
      is_active: boolean;
      sort_order: number;
    }>
  ): Promise<ColocationRuleRow> {
    const response = await apiClient.patch<{ rule: ColocationRuleRow }>(
      `/colocation/rules/${id}`,
      data
    );
    return response.rule;
  }

  async deleteRule(id: string): Promise<void> {
    await apiClient.delete(`/colocation/rules/${id}`);
  }
}

export const colocationRulesService = new ColocationRulesService();
