import { apiClient } from "@/lib/api-client";
import type { ColocationExpenseRow } from "@/lib/supabase/database.types";
import type { ColocationBalanceEntry } from "../types";

export class ColocationExpensesService {
  async getExpenses(propertyId: string): Promise<ColocationExpenseRow[]> {
    const response = await apiClient.get<{ expenses: ColocationExpenseRow[] }>(
      `/colocation/expenses?property_id=${propertyId}`
    );
    return response.expenses;
  }

  async createExpense(data: {
    property_id: string;
    paid_by_member_id: string;
    title: string;
    amount_cents: number;
    category?: string;
    split_type?: string;
    split_details?: Record<string, number>;
    receipt_document_id?: string;
    date?: string;
  }): Promise<ColocationExpenseRow> {
    const response = await apiClient.post<{ expense: ColocationExpenseRow }>(
      "/colocation/expenses",
      data
    );
    return response.expense;
  }

  async getBalances(propertyId: string): Promise<ColocationBalanceEntry[]> {
    const response = await apiClient.get<{ balances: ColocationBalanceEntry[] }>(
      `/colocation/expenses/balances?property_id=${propertyId}`
    );
    return response.balances;
  }

  async settleExpenses(data: {
    property_id: string;
    expense_ids?: string[];
    payer_id: string;
    debtor_id: string;
  }): Promise<{ settled: number }> {
    const response = await apiClient.post<{ settled: number }>(
      "/colocation/expenses/settle",
      data
    );
    return response;
  }
}

export const colocationExpensesService = new ColocationExpensesService();
