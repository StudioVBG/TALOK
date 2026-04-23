/**
 * Edge Function: Amortization Compute
 *
 * Triggered during exercise closing.
 * Computes annual depreciation for all active schedules,
 * inserts amortization lines, and creates accounting entries.
 *
 * Deploy: supabase functions deploy amortization-compute
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Account mapping per component type
const CREDIT_ACCOUNTS: Record<string, string> = {
  gros_oeuvre: "281100",
  facade: "281200",
  installations_generales: "281300",
  agencements: "281400",
  equipements: "281500",
};

const DEBIT_ACCOUNT = "681000"; // Dotations amortissements

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { entityId, exerciseId, exerciseYear, userId } = await req.json();

    if (!entityId || !exerciseId || !exerciseYear) {
      return new Response(
        JSON.stringify({ error: "entityId, exerciseId, exerciseYear requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Service role client for full access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // accounting_entries.created_by is UUID NOT NULL REFERENCES auth.users(id).
    // Use the explicit caller userId, otherwise fall back to the entity owner's
    // auth.users.id resolved via legal_entities.owner_profile_id -> profiles.user_id.
    let actorUserId: string | null = userId ?? null;
    if (!actorUserId) {
      const { data: entity } = await supabase
        .from("legal_entities")
        .select("owner_profile_id")
        .eq("id", entityId)
        .maybeSingle();
      const ownerProfileId = (entity as { owner_profile_id?: string } | null)?.owner_profile_id;
      if (ownerProfileId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", ownerProfileId)
          .maybeSingle();
        actorUserId = (profile as { user_id?: string } | null)?.user_id ?? null;
      }
    }
    if (!actorUserId) {
      return new Response(
        JSON.stringify({ error: "actor_unresolved" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch all active amortization schedules for entity
    const { data: schedules, error: schedError } = await supabase
      .from("amortization_schedules")
      .select("*")
      .eq("entity_id", entityId)
      .eq("is_active", true);

    if (schedError) {
      throw new Error(`Erreur recuperation plans: ${schedError.message}`);
    }

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Aucun plan actif", linesCreated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let totalLinesCreated = 0;
    let totalEntriesCreated = 0;

    for (const schedule of schedules) {
      const depreciableAmount = schedule.total_amount_cents;
      const durationYears = schedule.duration_years;

      if (durationYears <= 0 || depreciableAmount <= 0) continue;

      const annualFull = Math.round(depreciableAmount / durationYears);

      // Get acquisition date info for prorata
      const acqDate = new Date(schedule.acquisition_date);
      const acqYear = acqDate.getFullYear();
      const acqMonth = acqDate.getMonth();

      // Calculate amount for this specific year
      let annualAmount: number;
      let isProrata = false;

      // Get current cumulated from existing lines
      const { data: existingLines } = await supabase
        .from("amortization_lines")
        .select("cumulated_amount_cents")
        .eq("schedule_id", schedule.id)
        .order("exercise_year", { ascending: false })
        .limit(1);

      const currentCumulated =
        existingLines && existingLines.length > 0
          ? existingLines[0].cumulated_amount_cents
          : 0;

      // Check if line already exists for this year
      const { count: existingCount } = await supabase
        .from("amortization_lines")
        .select("id", { count: "exact", head: true })
        .eq("schedule_id", schedule.id)
        .eq("exercise_year", exerciseYear);

      if (existingCount && existingCount > 0) continue; // Already computed

      if (exerciseYear === acqYear) {
        // First year: prorata temporis
        const monthsRemaining = 12 - acqMonth;
        annualAmount = Math.round(annualFull * monthsRemaining / 12);
        isProrata = monthsRemaining < 12;
      } else if (currentCumulated + annualFull >= depreciableAmount) {
        // Last year: remainder
        annualAmount = depreciableAmount - currentCumulated;
      } else {
        annualAmount = annualFull;
      }

      if (annualAmount <= 0) continue;

      const newCumulated = currentCumulated + annualAmount;
      const netBookValue = Math.max(0, depreciableAmount - newCumulated);
      const isComplete = netBookValue <= 0;

      // Insert amortization line
      const { error: lineError } = await supabase
        .from("amortization_lines")
        .insert({
          schedule_id: schedule.id,
          exercise_year: exerciseYear,
          annual_amount_cents: annualAmount,
          cumulated_amount_cents: newCumulated,
          net_book_value_cents: netBookValue,
          is_prorata: isProrata,
        });

      if (lineError) {
        console.error(`Erreur insertion ligne: ${lineError.message}`);
        continue;
      }

      totalLinesCreated++;

      // Create accounting entry: D:681000 / C:281xxx
      const creditAccount =
        CREDIT_ACCOUNTS[schedule.component] ?? "281100";

      // Get next entry number
      const { data: entryNumber, error: seqError } = await supabase.rpc(
        "fn_next_entry_number",
        {
          p_entity_id: entityId,
          p_exercise_id: exerciseId,
          p_journal_code: "OD",
        },
      );

      if (seqError) {
        console.error(`Erreur numero ecriture: ${seqError.message}`);
        continue;
      }

      const entryDate = `${exerciseYear}-12-31`;

      // Insert entry
      const { data: entry, error: entryError } = await supabase
        .from("accounting_entries")
        .insert({
          entity_id: entityId,
          exercise_id: exerciseId,
          journal_code: "OD",
          entry_number: entryNumber,
          entry_date: entryDate,
          label: `Dotation amortissement ${schedule.component} ${exerciseYear}`,
          source: "auto:amortization",
          is_validated: true,
          created_by: actorUserId,
        })
        .select("id")
        .single();

      if (entryError) {
        console.error(`Erreur creation ecriture: ${entryError.message}`);
        continue;
      }

      // Insert entry lines
      const { error: linesError } = await supabase
        .from("accounting_entry_lines")
        .insert([
          {
            entry_id: entry.id,
            account_number: DEBIT_ACCOUNT,
            label: `Dotation ${schedule.component}`,
            debit_cents: annualAmount,
            credit_cents: 0,
          },
          {
            entry_id: entry.id,
            account_number: creditAccount,
            label: `Amort. ${schedule.component}`,
            debit_cents: 0,
            credit_cents: annualAmount,
          },
        ]);

      if (linesError) {
        console.error(`Erreur lignes ecriture: ${linesError.message}`);
        continue;
      }

      totalEntriesCreated++;

      // If complete, deactivate schedule
      if (isComplete) {
        await supabase
          .from("amortization_schedules")
          .update({ is_active: false })
          .eq("id", schedule.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        linesCreated: totalLinesCreated,
        entriesCreated: totalEntriesCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[amortization-compute] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
