import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];

    // deno-lint-ignore no-explicit-any
    const { data: mandants } = await supabase.from("mandant_accounts").select("*").eq("is_active", true) as { data: any[] | null };
    let generated = 0;
    for (const mandant of mandants ?? []) {
      try {
        // deno-lint-ignore no-explicit-any
        const { data: entries } = await supabase.from("accounting_entries").select("*, accounting_entry_lines(*)").eq("entity_id", mandant.entity_id).gte("entry_date", periodStart).lte("entry_date", periodEnd).eq("is_validated", true) as { data: any[] | null };
        let totalLoyers = 0, totalCharges = 0, totalHonoraires = 0;
        for (const e of entries ?? []) { for (const l of e.accounting_entry_lines ?? []) { if (l.account_number?.startsWith("706000")) totalLoyers += l.credit_cents ?? 0; if (l.account_number?.startsWith("6")) totalCharges += l.debit_cents ?? 0; if (l.account_number?.startsWith("706100")) totalHonoraires += l.credit_cents ?? 0; } }
        const netReverse = totalLoyers - totalCharges - totalHonoraires;
        await supabase.from("crg_reports").insert({ entity_id: mandant.entity_id, mandant_id: mandant.id, exercise_id: mandant.entity_id, period_start: periodStart, period_end: periodEnd, total_income_cents: totalLoyers, total_expenses_cents: totalCharges, commission_cents: totalHonoraires, net_owner_cents: netReverse, report_data: { loyers: totalLoyers, charges: totalCharges, honoraires: totalHonoraires, net: netReverse }, status: "generated", generated_at: new Date().toISOString() });
        generated++;
      } catch { /* per-mandant error, continue */ }
    }
    return new Response(JSON.stringify({ generated, total: (mandants ?? []).length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
