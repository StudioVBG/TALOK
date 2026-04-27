/**
 * Auto-exercise helper
 *
 * Finds or creates the current accounting exercise for an entity.
 * Respects the entity's configured fiscal year (premier_exercice_debut/fin
 * + date_cloture_exercice) so non-calendar exercises (e.g. 01/07 → 30/06)
 * are honoured. Auto-seeds chart of accounts and journals on first exercise
 * creation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { initializeChartOfAccounts } from "@/lib/accounting/chart-amort-ocr";
import { initializeJournals } from "@/lib/accounting/engine";

interface FiscalConfig {
  premier_exercice_debut: string | null;
  premier_exercice_fin: string | null;
  date_cloture_exercice: string | null;
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addYears(d: Date, years: number): Date {
  const next = new Date(d);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

/**
 * Compute the next accounting period for an entity.
 *
 * - If a previous exercise exists, the new period starts the day after its
 *   end_date and spans one year minus one day.
 * - Otherwise, defaults are taken from the entity's fiscal config. When today
 *   is past the configured first-exercise end, the period is projected
 *   forward by one-year increments anchored on date_cloture_exercice.
 */
export function computeNextPeriod(
  config: FiscalConfig,
  latestEndDate: string | null,
  referenceDate: Date = new Date(),
): { start: string; end: string } {
  if (latestEndDate) {
    const start = addDays(parseIsoDate(latestEndDate), 1);
    const end = addDays(addYears(start, 1), -1);
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }

  const debut = config.premier_exercice_debut;
  const fin = config.premier_exercice_fin;

  if (debut && fin) {
    const finDate = parseIsoDate(fin);
    // Today still falls within the configured first exercise → use it as-is.
    if (referenceDate.getTime() <= finDate.getTime()) {
      return { start: debut, end: fin };
    }
    // Project forward in 1-year increments until end >= today.
    let start = parseIsoDate(debut);
    let end = finDate;
    while (referenceDate.getTime() > end.getTime()) {
      start = addYears(start, 1);
      end = addYears(end, 1);
    }
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }

  const year = referenceDate.getUTCFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/**
 * Get the current open exercise covering today, or create one aligned on the
 * entity's fiscal-year configuration.
 *
 * On first exercise creation, auto-seeds chart of accounts (PCG) and journals.
 */
export async function getOrCreateCurrentExercise(
  supabase: SupabaseClient,
  entityId: string,
) {
  const today = toIsoDate(new Date());

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

  // 2. Compute the period that should cover today, honouring the entity's
  //    configured fiscal year and chaining from the most recent exercise.
  const [{ data: entity }, { data: latest }] = await Promise.all([
    (supabase as any)
      .from("legal_entities")
      .select("premier_exercice_debut, premier_exercice_fin, date_cloture_exercice")
      .eq("id", entityId)
      .maybeSingle(),
    (supabase as any)
      .from("accounting_exercises")
      .select("end_date")
      .eq("entity_id", entityId)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const period = computeNextPeriod(
    {
      premier_exercice_debut: entity?.premier_exercice_debut ?? null,
      premier_exercice_fin: entity?.premier_exercice_fin ?? null,
      date_cloture_exercice: entity?.date_cloture_exercice ?? null,
    },
    latest?.end_date ?? null,
  );

  const { data: newExercise, error } = await supabase
    .from("accounting_exercises")
    .insert({
      entity_id: entityId,
      start_date: period.start,
      end_date: period.end,
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
