/**
 * Auto-exercise helper
 *
 * Finds or creates the current accounting exercise for an entity.
 * Auto-seeds chart of accounts and journals on first exercise creation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { initializeChartOfAccounts } from "@/lib/accounting/chart-amort-ocr";
import { initializeJournals } from "@/lib/accounting/engine";

/**
 * Get the current open exercise covering today, or create a calendar-year exercise.
 * On first exercise creation, auto-seeds chart of accounts (PCG) and journals.
 */
export async function getOrCreateCurrentExercise(
  supabase: SupabaseClient,
  entityId: string,
) {
  const today = new Date().toISOString().split("T")[0];

  // 1. Find open exercise covering today
  const { data: exercise } = await supabase
    .from("accounting_exercises")
    .select("*")
    .eq("entity_id", entityId)
    .eq("status", "open")
    .lte("start_date", today)
    .gte("end_date", today)
    .single();

  if (exercise) return exercise;

  // 2. Create calendar-year exercise (Jan 1 - Dec 31)
  const year = new Date().getFullYear();
  const { data: newExercise, error } = await supabase
    .from("accounting_exercises")
    .insert({
      entity_id: entityId,
      start_date: `${year}-01-01`,
      end_date: `${year}-12-31`,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create exercise: ${error.message}`);
  }

  // 3. Auto-seed chart if this is the first exercise (no accounts yet)
  const { count } = await supabase
    .from("chart_of_accounts")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", entityId);

  if (!count || count === 0) {
    await initializeChartOfAccounts(supabase, entityId, "pcg");
    await initializeJournals(supabase, entityId);
  }

  return newExercise;
}
