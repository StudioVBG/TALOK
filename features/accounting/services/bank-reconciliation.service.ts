/**
 * Service de rapprochement bancaire
 *
 * Permet de réconcilier les écritures comptables avec les relevés bancaires
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  reference?: string;
  bank_reference?: string;
  matched?: boolean;
  matched_entry_id?: string;
}

export interface ReconciliationResult {
  id: string;
  bank_account: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  bank_transactions: number;
  matched_transactions: number;
  unmatched_transactions: number;
  discrepancy: number;
  status: "draft" | "in_progress" | "completed" | "validated";
  created_at: string;
}

export interface MatchSuggestion {
  bank_transaction_id: string;
  accounting_entry_id: string;
  confidence: number; // 0-100
  match_type: "exact" | "amount" | "date" | "reference";
}

export class BankReconciliationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Crée une nouvelle session de rapprochement
   */
  async createReconciliation(params: {
    bankAccount: string;
    periodStart: string;
    periodEnd: string;
    openingBalance: number;
  }): Promise<ReconciliationResult> {
    const { data, error } = await this.supabase
      .from("bank_reconciliations")
      .insert({
        bank_account: params.bankAccount,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        opening_balance: params.openingBalance,
        closing_balance: params.openingBalance, // Sera mis à jour
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      throw new Error("Erreur lors de la création du rapprochement");
    }

    return data;
  }

  /**
   * Importe les transactions bancaires (depuis CSV ou API bancaire)
   */
  async importBankTransactions(
    reconciliationId: string,
    transactions: Omit<BankTransaction, "id" | "matched" | "matched_entry_id">[]
  ): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    for (const tx of transactions) {
      try {
        const { error } = await this.supabase
          .from("bank_transactions")
          .insert({
            reconciliation_id: reconciliationId,
            transaction_date: tx.date,
            description: tx.description,
            amount: tx.amount,
            transaction_type: tx.type,
            reference: tx.reference,
            bank_reference: tx.bank_reference,
            matched: false,
          });

        if (error) {
          errors.push(`Ligne ${imported + 1}: ${error.message}`);
        } else {
          imported++;
        }
      } catch (e: any) {
        errors.push(`Ligne ${imported + 1}: ${e.message}`);
      }
    }

    // Mettre à jour le compteur
    await this.updateReconciliationStats(reconciliationId);

    return { imported, errors };
  }

  /**
   * Récupère les écritures comptables non rapprochées pour la période
   */
  async getUnmatchedEntries(
    periodStart: string,
    periodEnd: string
  ): Promise<any[]> {
    const { data } = await this.supabase
      .from("accounting_entries")
      .select("*")
      .gte("entry_date", periodStart)
      .lte("entry_date", periodEnd)
      .or("reconciled.is.null,reconciled.eq.false")
      .in("journal_code", ["BM", "BQ"]) // Journaux banque seulement
      .order("entry_date", { ascending: true });

    return data || [];
  }

  /**
   * Suggère des correspondances automatiques
   */
  async suggestMatches(reconciliationId: string): Promise<MatchSuggestion[]> {
    // Récupérer les transactions non rapprochées
    const { data: transactions } = await this.supabase
      .from("bank_transactions")
      .select("*")
      .eq("reconciliation_id", reconciliationId)
      .eq("matched", false);

    // Récupérer le rapprochement pour les dates
    const { data: reconciliation } = await this.supabase
      .from("bank_reconciliations")
      .select("*")
      .eq("id", reconciliationId)
      .single();

    if (!reconciliation) {
      return [];
    }

    // Récupérer les écritures non rapprochées
    const entries = await this.getUnmatchedEntries(
      reconciliation.period_start,
      reconciliation.period_end
    );

    const suggestions: MatchSuggestion[] = [];

    for (const tx of transactions || []) {
      for (const entry of entries) {
        const confidence = this.calculateMatchConfidence(tx, entry);

        if (confidence >= 70) {
          suggestions.push({
            bank_transaction_id: tx.id,
            accounting_entry_id: entry.id,
            confidence,
            match_type: this.getMatchType(tx, entry),
          });
        }
      }
    }

    // Trier par confiance décroissante
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calcule le score de correspondance entre une transaction et une écriture
   */
  private calculateMatchConfidence(transaction: any, entry: any): number {
    let score = 0;

    // Correspondance de montant (40 points max)
    const txAmount = Math.abs(transaction.amount);
    const entryAmount = entry.debit > 0 ? entry.debit : entry.credit;

    if (Math.abs(txAmount - entryAmount) < 0.01) {
      score += 40; // Montant exact
    } else if (Math.abs(txAmount - entryAmount) < 1) {
      score += 30; // Différence < 1€
    } else if (Math.abs(txAmount - entryAmount) < 10) {
      score += 15; // Différence < 10€
    }

    // Correspondance de date (30 points max)
    const txDate = new Date(transaction.transaction_date);
    const entryDate = new Date(entry.entry_date);
    const daysDiff = Math.abs(
      (txDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 0) {
      score += 30;
    } else if (daysDiff <= 1) {
      score += 25;
    } else if (daysDiff <= 3) {
      score += 15;
    } else if (daysDiff <= 7) {
      score += 5;
    }

    // Correspondance de référence (30 points max)
    if (transaction.reference && entry.piece_ref) {
      if (transaction.reference === entry.piece_ref) {
        score += 30;
      } else if (
        transaction.reference.includes(entry.piece_ref) ||
        entry.piece_ref.includes(transaction.reference)
      ) {
        score += 20;
      }
    }

    // Correspondance de type (bonus 5 points)
    const txIsCredit = transaction.transaction_type === "credit";
    const entryIsCredit = entry.credit > 0;
    if (txIsCredit === entryIsCredit) {
      score += 5;
    }

    return Math.min(100, score);
  }

  /**
   * Détermine le type de correspondance
   */
  private getMatchType(transaction: any, entry: any): MatchSuggestion["match_type"] {
    const txAmount = Math.abs(transaction.amount);
    const entryAmount = entry.debit > 0 ? entry.debit : entry.credit;

    if (
      transaction.reference &&
      entry.piece_ref &&
      transaction.reference === entry.piece_ref
    ) {
      return "reference";
    }

    if (Math.abs(txAmount - entryAmount) < 0.01) {
      const txDate = new Date(transaction.transaction_date);
      const entryDate = new Date(entry.entry_date);
      if (txDate.getTime() === entryDate.getTime()) {
        return "exact";
      }
      return "amount";
    }

    return "date";
  }

  /**
   * Valide une correspondance manuellement
   */
  async confirmMatch(
    bankTransactionId: string,
    accountingEntryId: string
  ): Promise<boolean> {
    try {
      // Marquer la transaction bancaire comme rapprochée
      await this.supabase
        .from("bank_transactions")
        .update({
          matched: true,
          matched_entry_id: accountingEntryId,
          matched_at: new Date().toISOString(),
        })
        .eq("id", bankTransactionId);

      // Marquer l'écriture comptable comme rapprochée
      await this.supabase
        .from("accounting_entries")
        .update({
          reconciled: true,
          reconciled_at: new Date().toISOString(),
        })
        .eq("id", accountingEntryId);

      return true;
    } catch (error) {
      console.error("[BankReconciliation] Erreur confirmation:", error);
      return false;
    }
  }

  /**
   * Annule une correspondance
   */
  async unmatch(bankTransactionId: string): Promise<boolean> {
    try {
      // Récupérer l'ID de l'écriture liée
      const { data: tx } = await this.supabase
        .from("bank_transactions")
        .select("matched_entry_id")
        .eq("id", bankTransactionId)
        .single();

      if (tx?.matched_entry_id) {
        // Réinitialiser l'écriture
        await this.supabase
          .from("accounting_entries")
          .update({
            reconciled: false,
            reconciled_at: null,
          })
          .eq("id", tx.matched_entry_id);
      }

      // Réinitialiser la transaction
      await this.supabase
        .from("bank_transactions")
        .update({
          matched: false,
          matched_entry_id: null,
          matched_at: null,
        })
        .eq("id", bankTransactionId);

      return true;
    } catch (error) {
      console.error("[BankReconciliation] Erreur unmatch:", error);
      return false;
    }
  }

  /**
   * Met à jour les statistiques du rapprochement
   */
  private async updateReconciliationStats(reconciliationId: string): Promise<void> {
    const { data: transactions } = await this.supabase
      .from("bank_transactions")
      .select("matched, amount, transaction_type")
      .eq("reconciliation_id", reconciliationId);

    if (!transactions) return;

    const stats = {
      bank_transactions: transactions.length,
      matched_transactions: transactions.filter((t) => t.matched).length,
      unmatched_transactions: transactions.filter((t) => !t.matched).length,
    };

    // Calculer le solde de clôture
    const { data: reconciliation } = await this.supabase
      .from("bank_reconciliations")
      .select("opening_balance")
      .eq("id", reconciliationId)
      .single();

    let closingBalance = reconciliation?.opening_balance || 0;
    for (const tx of transactions) {
      if (tx.transaction_type === "credit") {
        closingBalance += tx.amount;
      } else {
        closingBalance -= tx.amount;
      }
    }

    await this.supabase
      .from("bank_reconciliations")
      .update({
        ...stats,
        closing_balance: Math.round(closingBalance * 100) / 100,
        status:
          stats.unmatched_transactions === 0 ? "completed" : "in_progress",
      })
      .eq("id", reconciliationId);
  }

  /**
   * Valide définitivement un rapprochement
   */
  async validateReconciliation(reconciliationId: string): Promise<boolean> {
    const { data: reconciliation } = await this.supabase
      .from("bank_reconciliations")
      .select("*")
      .eq("id", reconciliationId)
      .single();

    if (!reconciliation) {
      throw new Error("Rapprochement non trouvé");
    }

    if (reconciliation.unmatched_transactions > 0) {
      throw new Error(
        `${reconciliation.unmatched_transactions} transaction(s) non rapprochée(s)`
      );
    }

    await this.supabase
      .from("bank_reconciliations")
      .update({
        status: "validated",
        validated_at: new Date().toISOString(),
      })
      .eq("id", reconciliationId);

    return true;
  }

  /**
   * Récupère l'historique des rapprochements
   */
  async getReconciliationHistory(bankAccount?: string): Promise<ReconciliationResult[]> {
    let query = this.supabase
      .from("bank_reconciliations")
      .select("*")
      .order("period_start", { ascending: false });

    if (bankAccount) {
      query = query.eq("bank_account", bankAccount);
    }

    const { data } = await query;
    return data || [];
  }
}
