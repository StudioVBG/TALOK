/**
 * Edge Function: Weekly Missing Documents Reminder
 * Triggered by cron (Monday 9am) — sends email to owners with entries missing receipts
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const APP_URL = Deno.env.get("APP_URL") ?? "https://talok.fr";

    // Find entries older than 7 days without linked document
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: entries, error: entriesErr } = await supabase
      .from("accounting_entries")
      .select(
        "id, entity_id, entry_date, label, entry_number, accounting_entry_lines(debit_cents, credit_cents)",
      )
      .is("source", null) // Manual entries without source
      .lt("created_at", sevenDaysAgo)
      .eq("is_validated", true)
      .limit(500);

    if (entriesErr || !entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ message: "No missing documents found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check which entries have no linked document_analyses
    const entryIds = entries.map((e: { id: string }) => e.id);
    const { data: linkedAnalyses } = await supabase
      .from("document_analyses")
      .select("entry_id")
      .in("entry_id", entryIds);

    const linkedEntryIds = new Set(
      (linkedAnalyses ?? []).map((a: { entry_id: string }) => a.entry_id),
    );

    const missingEntries = entries.filter(
      (e: { id: string }) => !linkedEntryIds.has(e.id),
    );

    if (missingEntries.length === 0) {
      return new Response(
        JSON.stringify({ message: "All entries have documents", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Group by entity
    const byEntity = new Map<string, typeof missingEntries>();
    for (const entry of missingEntries) {
      const list = byEntity.get(entry.entity_id) ?? [];
      list.push(entry);
      byEntity.set(entry.entity_id, list);
    }

    let emailsSent = 0;

    for (const [entityId, entityEntries] of byEntity.entries()) {
      // Get owner email via entity_members → profiles
      const { data: members } = await supabase
        .from("entity_members")
        .select("user_id, profiles(prenom, nom)")
        .eq("entity_id", entityId)
        .eq("role", "admin")
        .limit(1);

      if (!members || members.length === 0) continue;

      const member = members[0];
      // deno-lint-ignore no-explicit-any
      const profileData = member.profiles as any;
      const userName = profileData
        ? `${profileData.prenom ?? ""} ${profileData.nom ?? ""}`.trim()
        : "Proprietaire";

      const { data: authUser } = await supabase.auth.admin.getUserById(
        member.user_id,
      );
      const email = authUser?.user?.email;
      if (!email) continue;

      // Build entry list for email
      const entryList = entityEntries.slice(0, 10).map(
        // deno-lint-ignore no-explicit-any
        (e: any) => {
          const totalCents =
            e.accounting_entry_lines?.reduce(
              // deno-lint-ignore no-explicit-any
              (sum: number, l: any) => sum + (l.debit_cents ?? 0),
              0,
            ) ?? 0;
          return {
            label: e.label ?? e.entry_number,
            date: e.entry_date,
            amount: `${(totalCents / 100).toFixed(2).replace(".", ",")} EUR`,
          };
        },
      );

      if (RESEND_API_KEY) {
        try {
          const entriesHtml = entryList
            .map(
              (e: { date: string; label: string; amount: string }) =>
                `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${e.date}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${e.label}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${e.amount}</td></tr>`,
            )
            .join("");

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Talok <notifications@talok.fr>",
              to: [email],
              subject: `${entityEntries.length} charge${entityEntries.length > 1 ? "s" : ""} sans justificatif`,
              html: `<div style="font-family:'Manrope',sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2 style="color:#1B2A6B">Justificatifs manquants</h2><p>Bonjour ${userName},</p><p>Vous avez <strong>${entityEntries.length}</strong> ecriture(s) sans justificatif depuis plus de 7 jours :</p><table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px"><thead><tr style="background:#f8f9fa"><th style="padding:8px;text-align:left">Date</th><th style="padding:8px;text-align:left">Libelle</th><th style="padding:8px;text-align:right">Montant</th></tr></thead><tbody>${entriesHtml}</tbody></table><a href="${APP_URL}/owner/accounting/entries?filter=no-receipt" style="display:inline-block;background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">Voir les ecritures</a><p style="margin-top:24px;font-size:12px;color:#999">Talok — Gestion locative simplifiee</p></div>`,
            }),
          });
          emailsSent++;
        } catch {
          // Non-blocking
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${emailsSent} reminder emails`,
        totalMissing: missingEntries.length,
        emailsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
