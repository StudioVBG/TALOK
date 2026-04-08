/**
 * Edge Function: Deficit Foncier Update
 * Triggered during exercise closing — calculates and tracks deficits
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFICIT_FONCIER_CAP_CENTS = 1070000; // 10 700 EUR

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { entityId, exerciseId, exerciseYear } = await req.json();
    if (!entityId || !exerciseId || !exerciseYear) {
      return new Response(JSON.stringify({ error: "entityId, exerciseId, exerciseYear required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get balance: revenue (class 7) and expenses (class 6)
    // deno-lint-ignore no-explicit-any
    const { data: lines } = await supabase
      .from("accounting_entry_lines")
      .select("account_number, debit_cents, credit_cents, accounting_entries!inner(entity_id, exercise_id, is_validated)")
      .eq("accounting_entries.entity_id", entityId)
      .eq("accounting_entries.exercise_id", exerciseId)
      .eq("accounting_entries.is_validated", true) as { data: any[] | null };

    let revenueCents = 0;
    let expensesCents = 0;
    let interestsCents = 0;

    for (const line of lines ?? []) {
      const acc = line.account_number as string;
      if (acc.startsWith("7")) revenueCents += (line.credit_cents ?? 0) - (line.debit_cents ?? 0);
      if (acc.startsWith("6")) expensesCents += (line.debit_cents ?? 0) - (line.credit_cents ?? 0);
      if (acc.startsWith("661")) interestsCents += (line.debit_cents ?? 0);
    }

    const result = revenueCents - expensesCents;
    let deficitCreated = false;
    let deficitsUsed = 0;

    if (result < 0) {
      // Deficit: separate interest from other charges
      const deficitTotal = Math.abs(result);
      const deficitHorsInterets = deficitTotal - interestsCents;
      const imputableSurRevenuGlobal = Math.min(Math.max(0, deficitHorsInterets), DEFICIT_FONCIER_CAP_CENTS);
      const reportable = deficitTotal - imputableSurRevenuGlobal;

      if (reportable > 0) {
        await supabase.from("deficit_tracking").insert({
          entity_id: entityId,
          exercise_id: exerciseId,
          deficit_type: "foncier",
          origin_year: exerciseYear,
          initial_amount_cents: reportable,
          used_amount_cents: 0,
          expires_year: exerciseYear + 10,
        });
        deficitCreated = true;
      }
    } else if (result > 0) {
      // Positive result: use previous deficits FIFO
      // deno-lint-ignore no-explicit-any
      const { data: deficits } = await supabase
        .from("deficit_tracking")
        .select("*")
        .eq("entity_id", entityId)
        .gt("expires_year", exerciseYear)
        .order("origin_year", { ascending: true }) as { data: any[] | null };

      let remaining = result;
      for (const deficit of deficits ?? []) {
        if (remaining <= 0) break;
        const available = deficit.initial_amount_cents - deficit.used_amount_cents;
        if (available <= 0) continue;
        const toUse = Math.min(available, remaining);
        await supabase.from("deficit_tracking")
          .update({ used_amount_cents: deficit.used_amount_cents + toUse })
          .eq("id", deficit.id);
        remaining -= toUse;
        deficitsUsed += toUse;
      }
    }

    return new Response(JSON.stringify({
      result, revenueCents, expensesCents, interestsCents,
      deficitCreated, deficitsUsed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
