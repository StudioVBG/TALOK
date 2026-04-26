/**
 * Injection d'une charge_entry à partir d'un work_order clôturé.
 *
 * Règle métier : un work_order dont `is_tenant_chargeable=true` et qui a
 * un `charge_category_code` valide doit apparaître dans les charges
 * récupérables du locataire pour l'exercice en cours. Le calcul de la
 * régularisation annuelle (lib/charges/engine.ts) agrège ensuite toutes
 * les charge_entries de la `fiscal_year` pour la propriété.
 *
 * L'injection est idempotente : un work_order ne produit qu'une seule
 * charge_entry (garanti par l'unique index sur source_work_order_id).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalChargeCategory } from "./charges-classification";

export type InjectionResult =
  | { ok: true; charge_entry_id: string; amount_cents: number; created: boolean }
  | { ok: false; code: InjectionSkipCode; message: string };

export type InjectionSkipCode =
  | "NOT_CHARGEABLE"
  | "NO_CATEGORY"
  | "CATEGORY_NOT_FOUND"
  | "WORK_ORDER_NOT_FOUND"
  | "NO_PAYMENTS"
  | "ALREADY_INJECTED";

/**
 * Tente d'injecter une charge_entry pour le work_order donné.
 * Retourne un résultat détaillé (pas d'exception pour les cas attendus).
 */
export async function injectChargeEntryForWorkOrder(
  supabase: SupabaseClient<any>,
  workOrderId: string
): Promise<InjectionResult> {
  // 1. Charger le work_order + ses colonnes de classification
  const { data: wo } = await supabase
    .from("work_orders")
    .select(
      "id, property_id, title, is_tenant_chargeable, charge_category_code, work_completed_at, created_at"
    )
    .eq("id", workOrderId)
    .maybeSingle();

  if (!wo) {
    return {
      ok: false,
      code: "WORK_ORDER_NOT_FOUND",
      message: "Intervention introuvable",
    };
  }

  const workOrder = wo as {
    id: string;
    property_id: string;
    title: string | null;
    is_tenant_chargeable: boolean | null;
    charge_category_code: CanonicalChargeCategory | null;
    work_completed_at: string | null;
    created_at: string;
  };

  if (workOrder.is_tenant_chargeable !== true) {
    return {
      ok: false,
      code: "NOT_CHARGEABLE",
      message: "Cette intervention n'est pas à la charge du locataire",
    };
  }

  if (!workOrder.charge_category_code) {
    return {
      ok: false,
      code: "NO_CATEGORY",
      message: "Aucune catégorie de charge affectée à cette intervention",
    };
  }

  // 2. Idempotence : si une entry existe déjà pour ce work_order, on la renvoie
  const { data: existing } = await supabase
    .from("charge_entries")
    .select("id, amount_cents")
    .eq("source_work_order_id", workOrderId)
    .maybeSingle();

  if (existing) {
    const existingRow = existing as { id: string; amount_cents: number };
    return {
      ok: true,
      charge_entry_id: existingRow.id,
      amount_cents: existingRow.amount_cents,
      created: false,
    };
  }

  // 3. Résoudre la catégorie canonique (category_id UUID)
  const { data: category } = await supabase
    .from("charge_categories")
    .select("id")
    .eq("code", workOrder.charge_category_code)
    .maybeSingle();

  if (!category) {
    return {
      ok: false,
      code: "CATEGORY_NOT_FOUND",
      message: `Catégorie de charge '${workOrder.charge_category_code}' introuvable`,
    };
  }

  const categoryRow = category as { id: string };

  // 4. Calculer le montant total payé (somme des work_order_payments succeeded)
  const { data: payments } = await supabase
    .from("work_order_payments")
    .select("gross_amount, status, payment_type")
    .eq("work_order_id", workOrderId)
    .eq("status", "succeeded")
    .in("payment_type", ["deposit", "balance", "full"]);

  const rows = (payments || []) as Array<{ gross_amount: string | number }>;
  const totalEuros = rows.reduce(
    (sum, p) => sum + Number(p.gross_amount || 0),
    0
  );
  const amountCents = Math.round(totalEuros * 100);

  if (amountCents <= 0) {
    return {
      ok: false,
      code: "NO_PAYMENTS",
      message:
        "Aucun paiement encaissé pour cette intervention — impossible de déterminer le montant récupérable.",
    };
  }

  // 5. Déterminer la date effective (work_completed_at sinon created_at)
  const effectiveDate = workOrder.work_completed_at ?? workOrder.created_at;
  const dateOnly = effectiveDate.slice(0, 10); // YYYY-MM-DD
  const fiscalYear = Number(effectiveDate.slice(0, 4));

  // 6. Insertion
  const label = workOrder.title
    ? `Intervention : ${workOrder.title}`
    : "Intervention prestataire";

  const { data: inserted, error } = await supabase
    .from("charge_entries")
    .insert({
      property_id: workOrder.property_id,
      category_id: categoryRow.id,
      label,
      amount_cents: amountCents,
      date: dateOnly,
      is_recoverable: true,
      fiscal_year: fiscalYear,
      source_work_order_id: workOrderId,
    })
    .select("id")
    .single();

  if (error) {
    // Contournement rare : course entre deux injections simultanées
    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("charge_entries")
        .select("id, amount_cents")
        .eq("source_work_order_id", workOrderId)
        .maybeSingle();
      if (raced) {
        const row = raced as { id: string; amount_cents: number };
        return {
          ok: true,
          charge_entry_id: row.id,
          amount_cents: row.amount_cents,
          created: false,
        };
      }
    }
    throw error;
  }

  const row = inserted as { id: string };
  return {
    ok: true,
    charge_entry_id: row.id,
    amount_cents: amountCents,
    created: true,
  };
}
