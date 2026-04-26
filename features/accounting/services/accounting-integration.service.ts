/**
 * Service d'intégration comptable — version assainie 2026-04.
 *
 * Historique : ce service gérait à la fois les soldes mandants
 * (mandant_accounts), les opérations de dépôt de garantie
 * (deposit_operations) ET la création d'écritures comptables. Les méthodes
 * d'écriture (recordRentPayment, recordOwnerPayout, recordWorkOrderPayment,
 * reverseEntry...) écrivaient des lignes uni-côté (debit OU credit) qui
 * cassaient la partie double et faisaient diverger les totaux.
 *
 * Aujourd'hui, ce service ne fait plus que :
 *   - tracer les opérations métier sur dépôts dans `deposit_operations`
 *   - maintenir les soldes mandants dans `mandant_accounts`
 *
 * La comptabilité (double-entry) passe exclusivement par
 * `lib/accounting/engine.ts → createAutoEntry` et ses bridges
 * (receipt-entry, deposit-entry, invoice-entry, subscription-entry).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  generateCompteProprietaire,
  generateCompteLocataire,
} from "../constants/plan-comptable";

export class AccountingIntegrationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Met à jour le solde d'un compte mandant (Hoguet : suivi indépendant
   * de la double-entry, requis pour reporter par locataire / propriétaire).
   */
  async updateMandantBalance(
    profileId: string,
    accountType: "owner" | "tenant",
    amount: number,
  ): Promise<boolean> {
    const accountNum =
      accountType === "owner"
        ? generateCompteProprietaire(profileId)
        : generateCompteLocataire(profileId);

    const { data: existing } = await this.supabase
      .from("mandant_accounts")
      .select("id, balance")
      .eq("profile_id", profileId)
      .eq("account_type", accountType)
      .single();

    if (existing) {
      const { error } = await this.supabase
        .from("mandant_accounts")
        .update({
          balance: existing.balance + amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) {
        console.error("[AccountingIntegration] Erreur màj solde:", error);
        return false;
      }
    } else {
      const { error } = await this.supabase.from("mandant_accounts").insert({
        profile_id: profileId,
        account_type: accountType,
        account_num: accountNum,
        balance: amount,
      });
      if (error) {
        console.error("[AccountingIntegration] Erreur création compte:", error);
        return false;
      }
    }

    return true;
  }

  /**
   * Trace une opération sur dépôt de garantie dans `deposit_operations`.
   *
   * IMPORTANT : NE crée PAS d'écriture comptable. La double-écriture
   * équilibrée doit être posée par le bridge engine
   * (`lib/accounting/deposit-entry.ts → ensureDepositReceivedEntry /
   * ensureDepositRefundedEntry`) à plomber dans la route deposits.
   */
  async recordDepositOperation(params: {
    tenantId: string;
    leaseId: string;
    operationType: "encaissement" | "restitution" | "retenue";
    amount: number;
    date: string;
    description?: string;
  }): Promise<{ success: boolean }> {
    const defaultDescription =
      params.operationType === "encaissement"
        ? "Dépôt de garantie initial"
        : params.operationType === "restitution"
          ? "Restitution dépôt de garantie"
          : "Retenue sur dépôt de garantie";

    const { error } = await this.supabase.from("deposit_operations").insert({
      lease_id: params.leaseId,
      tenant_id: params.tenantId,
      operation_type: params.operationType,
      amount: params.amount,
      operation_date: params.date,
      description: params.description || defaultDescription,
    });

    if (error) {
      console.error("[AccountingIntegration] Erreur dépôt garantie:", error);
      return { success: false };
    }
    return { success: true };
  }

  /**
   * Récupère le solde d'un compte mandant.
   */
  async getMandantBalance(
    profileId: string,
    accountType: "owner" | "tenant",
  ): Promise<number> {
    const { data } = await this.supabase
      .from("mandant_accounts")
      .select("balance")
      .eq("profile_id", profileId)
      .eq("account_type", accountType)
      .single();

    return data?.balance || 0;
  }
}
