/**
 * Edge Function: CRG Generate (Cron 1st of month)
 *
 * Generates Compte Rendu de Gestion for all active mandants.
 * For each mandant: generates CRG for the previous month/quarter, sends by email.
 *
 * Deploy: supabase functions deploy crg-generate
 * Schedule: 0 8 1 * * (1st of each month at 8:00 UTC)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Inline CRG generation (Edge Functions can't import from lib/)
// ---------------------------------------------------------------------------

interface CRGSummary {
  mandantId: string;
  mandantName: string;
  periodStart: string;
  periodEnd: string;
  totalLoyersCents: number;
  totalHonorairesCents: number;
  netReverseCents: number;
}

async function generateCRGForMandant(
  supabase: ReturnType<typeof createClient>,
  mandant: Record<string, unknown>,
  periodStart: string,
  periodEnd: string,
): Promise<CRGSummary> {
  const entityId = mandant.entity_id as string;
  const accountNumber = mandant.sub_account_number as string;
  const mandantName = mandant.mandant_name as string;
  const mandantId = mandant.id as string;

  // Fetch loyer entries for the period
  const { data: loyerLines } = await supabase
    .from("accounting_entry_lines")
    .select(
      "credit_cents, accounting_entries!inner(entity_id, entry_date, source)",
    )
    .eq("accounting_entries.entity_id", entityId)
    .eq("accounting_entries.source", "auto:agency_loyer_mandant")
    .gte("accounting_entries.entry_date", periodStart)
    .lte("accounting_entries.entry_date", periodEnd)
    .eq("account_number", "706000");

  const totalLoyersCents = (loyerLines ?? []).reduce(
    (sum: number, l: Record<string, unknown>) =>
      sum + ((l.credit_cents as number) || 0),
    0,
  );

  // Fetch commission entries
  const { data: commissionLines } = await supabase
    .from("accounting_entry_lines")
    .select(
      "credit_cents, accounting_entries!inner(entity_id, entry_date, source)",
    )
    .eq("accounting_entries.entity_id", entityId)
    .eq("accounting_entries.source", "auto:agency_commission")
    .gte("accounting_entries.entry_date", periodStart)
    .lte("accounting_entries.entry_date", periodEnd)
    .eq("account_number", "706100");

  const totalHonorairesCents = (commissionLines ?? []).reduce(
    (sum: number, l: Record<string, unknown>) =>
      sum + ((l.credit_cents as number) || 0),
    0,
  );

  // Fetch charge entries
  const { data: chargeLines } = await supabase
    .from("accounting_entry_lines")
    .select(
      "debit_cents, accounting_entries!inner(entity_id, entry_date, source)",
    )
    .eq("accounting_entries.entity_id", entityId)
    .like("accounting_entries.source", "auto:supplier%")
    .gte("accounting_entries.entry_date", periodStart)
    .lte("accounting_entries.entry_date", periodEnd)
    .like("account_number", "6%");

  const totalChargesCents = (chargeLines ?? []).reduce(
    (sum: number, l: Record<string, unknown>) =>
      sum + ((l.debit_cents as number) || 0),
    0,
  );

  // Fetch reversement entries
  const { data: reversementLines } = await supabase
    .from("accounting_entry_lines")
    .select(
      "credit_cents, accounting_entries!inner(entity_id, entry_date, source)",
    )
    .eq("accounting_entries.entity_id", entityId)
    .eq("accounting_entries.source", "auto:agency_reversement")
    .gte("accounting_entries.entry_date", periodStart)
    .lte("accounting_entries.entry_date", periodEnd)
    .eq("account_number", accountNumber);

  const alreadyReversedCents = (reversementLines ?? []).reduce(
    (sum: number, l: Record<string, unknown>) =>
      sum + ((l.credit_cents as number) || 0),
    0,
  );

  const netReverseCents =
    totalLoyersCents - totalChargesCents - totalHonorairesCents;
  const remainingToReverseCents = Math.max(
    0,
    netReverseCents - alreadyReversedCents,
  );

  const now = new Date().toISOString();

  // Insert CRG report
  const { data: crgReport, error: crgError } = await supabase
    .from("crg_reports")
    .insert({
      mandant_id: mandantId,
      entity_id: entityId,
      period_start: periodStart,
      period_end: periodEnd,
      generated_at: now,
      status: "generated",
      total_loyers_cents: totalLoyersCents,
      total_charges_cents: totalChargesCents,
      total_honoraires_cents: totalHonorairesCents,
      total_travaux_cents: 0,
      net_reverse_cents: netReverseCents,
      already_reversed_cents: alreadyReversedCents,
      remaining_to_reverse_cents: remainingToReverseCents,
      impayes_count: 0,
      data: {
        section4_summary: {
          totalLoyersCents,
          totalChargesCents,
          totalHonorairesCents,
          totalTravauxCents: 0,
          netReverseCents,
          alreadyReversedCents,
          remainingToReverseCents,
        },
      },
    })
    .select()
    .single();

  if (crgError) {
    throw new Error(`CRG insert failed for mandant ${mandantId}: ${crgError.message}`);
  }

  // Try to send email notification to mandant owner
  try {
    const { data: ownerEntity } = await supabase
      .from("legal_entities")
      .select("id, name")
      .eq("id", mandant.owner_entity_id)
      .single();

    if (ownerEntity) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("id, user_id, email")
        .eq("legal_entity_id", ownerEntity.id)
        .limit(1)
        .single();

      if (ownerProfile?.user_id) {
        await supabase.from("notifications").insert({
          user_id: ownerProfile.user_id,
          type: "crg_generated",
          title: "Compte Rendu de Gestion disponible",
          body: `Votre CRG pour la periode du ${periodStart} au ${periodEnd} est disponible. Net a reverser: ${(netReverseCents / 100).toFixed(2)} EUR`,
          metadata: {
            crg_id: crgReport.id,
            mandant_id: mandantId,
            period_start: periodStart,
            period_end: periodEnd,
            net_reverse_cents: netReverseCents,
          },
        });

        // Mark as sent
        await supabase
          .from("crg_reports")
          .update({
            status: "sent",
            sent_at: now,
            sent_to: ownerProfile.email,
          })
          .eq("id", crgReport.id);
      }
    }
  } catch (emailErr) {
    console.warn(
      `[CRG Generate] Email notification failed for mandant ${mandantId}:`,
      emailErr,
    );
    // Non-blocking — CRG is still generated
  }

  return {
    mandantId,
    mandantName,
    periodStart,
    periodEnd,
    totalLoyersCents,
    totalHonorairesCents,
    netReverseCents,
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    console.log(`[CRG Generate] Running for ${today}`);

    // -----------------------------------------------------------------------
    // 1. Determine period: previous month
    // -----------------------------------------------------------------------

    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodStart = previousMonth.toISOString().slice(0, 10);
    const periodEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
    const periodEnd = periodEndDate.toISOString().slice(0, 10);

    console.log(`[CRG Generate] Period: ${periodStart} to ${periodEnd}`);

    // -----------------------------------------------------------------------
    // 2. Find all active mandants
    // -----------------------------------------------------------------------

    const { data: mandants, error: mandantError } = await supabase
      .from("mandant_accounts")
      .select("*")
      .eq("is_active", true);

    if (mandantError) throw mandantError;

    if (!mandants || mandants.length === 0) {
      console.log("[CRG Generate] No active mandants found");
      return new Response(
        JSON.stringify({ success: true, generated: 0, period: { periodStart, periodEnd } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[CRG Generate] Found ${mandants.length} active mandants`);

    // -----------------------------------------------------------------------
    // 3. Generate CRG for each mandant (try/catch per mandant)
    // -----------------------------------------------------------------------

    let generated = 0;
    const results: CRGSummary[] = [];
    const errors: Array<{ mandantId: string; error: string }> = [];

    for (const mandant of mandants) {
      try {
        // Check if CRG already exists for this period
        const { data: existing } = await supabase
          .from("crg_reports")
          .select("id")
          .eq("mandant_id", mandant.id)
          .eq("period_start", periodStart)
          .eq("period_end", periodEnd)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(
            `[CRG Generate] CRG already exists for mandant ${mandant.id}, skipping`,
          );
          continue;
        }

        const summary = await generateCRGForMandant(
          supabase,
          mandant,
          periodStart,
          periodEnd,
        );

        results.push(summary);
        generated++;

        console.log(
          `[CRG Generate] Mandant ${mandant.mandant_name}: loyers=${summary.totalLoyersCents}, net=${summary.netReverseCents}`,
        );
      } catch (mandantErr: unknown) {
        const errorMessage =
          mandantErr instanceof Error ? mandantErr.message : "Erreur inconnue";
        console.error(
          `[CRG Generate] Error for mandant ${mandant.id}:`,
          mandantErr,
        );
        errors.push({ mandantId: mandant.id, error: errorMessage });
      }
    }

    // -----------------------------------------------------------------------
    // 4. Audit log
    // -----------------------------------------------------------------------

    await supabase.from("audit_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      action: "crg_generate_cron",
      entity_type: "system",
      entity_id: today,
      metadata: {
        date: today,
        period_start: periodStart,
        period_end: periodEnd,
        mandants_checked: mandants.length,
        generated,
        errors: errors.length,
      },
    } as Record<string, unknown>);

    console.log(
      `[CRG Generate] Completed: ${generated}/${mandants.length} generated, ${errors.length} errors`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        period: { periodStart, periodEnd },
        mandantsChecked: mandants.length,
        generated,
        results,
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[CRG Generate] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la generation des CRG",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
