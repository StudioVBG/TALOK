/**
 * Wrapper transactionnel pour Supabase.
 *
 * Supabase JS ne supporte pas nativement les transactions.
 * Ce module fournit un wrapper via RPC qui exécute une séquence
 * d'opérations au sein d'une transaction PostgreSQL.
 *
 * Pour les cas complexes, on utilise une fonction RPC côté DB.
 * Pour les cas simples, on utilise un pattern "saga" avec compensations.
 *
 * @module lib/utils/db-transaction
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface TransactionStep<T = any> {
  /** Nom de l'étape (pour les logs) */
  name: string;
  /** Exécution de l'étape */
  execute: (client: SupabaseClient) => Promise<T>;
  /** Compensation en cas d'échec des étapes suivantes (rollback partiel) */
  compensate?: (client: SupabaseClient, result: T) => Promise<void>;
}

export interface TransactionResult<T = any> {
  success: boolean;
  /** Résultats de chaque étape */
  results: T[];
  /** Erreur si échec */
  error?: string;
  /** Étape qui a échoué */
  failedStep?: string;
  /** Compensation exécutée ? */
  compensated: boolean;
}

/**
 * Exécute une séquence d'étapes avec compensation en cas d'échec.
 * 
 * Pattern "Saga" : si une étape échoue, les compensations de toutes
 * les étapes précédentes sont exécutées en ordre inverse.
 *
 * @example
 * ```ts
 * const result = await executeSaga(serviceClient, [
 *   {
 *     name: "update_signer",
 *     execute: async (client) => {
 *       const { error } = await client.from("lease_signers").update({...}).eq("id", signerId);
 *       if (error) throw error;
 *       return signerId;
 *     },
 *     compensate: async (client, signerId) => {
 *       await client.from("lease_signers").update({ signature_status: "pending" }).eq("id", signerId);
 *     },
 *   },
 *   {
 *     name: "update_lease_status",
 *     execute: async (client) => {
 *       const { error } = await client.from("leases").update({ statut: "fully_signed" }).eq("id", leaseId);
 *       if (error) throw error;
 *     },
 *   },
 * ]);
 * ```
 */
export async function executeSaga<T = any>(
  client: SupabaseClient,
  steps: TransactionStep<T>[]
): Promise<TransactionResult<T>> {
  const completedSteps: { step: TransactionStep<T>; result: T }[] = [];

  try {
    for (const step of steps) {
      const result = await step.execute(client);
      completedSteps.push({ step, result });
    }

    return {
      success: true,
      results: completedSteps.map((s) => s.result),
      compensated: false,
    };
  } catch (error) {
    const failedStep = steps[completedSteps.length]?.name || "unknown";
    console.error(`[Saga] Étape "${failedStep}" échouée:`, error);

    // Exécuter les compensations en ordre inverse
    let compensated = false;
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const { step, result } = completedSteps[i];
      if (step.compensate) {
        try {
          await step.compensate(client, result);
          compensated = true;
          console.log(`[Saga] Compensation "${step.name}" exécutée`);
        } catch (compError) {
          console.error(`[Saga] Compensation "${step.name}" échouée:`, compError);
        }
      }
    }

    return {
      success: false,
      results: completedSteps.map((s) => s.result),
      error: error instanceof Error ? error.message : String(error),
      failedStep,
      compensated,
    };
  }
}
