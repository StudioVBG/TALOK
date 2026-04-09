export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/emails/resend.service";
import { insuranceExpiry30jEmail, insuranceExpiry7jEmail } from "@/lib/insurance/email-templates";

/**
 * GET /api/insurance/check-expiring
 * Cron job : verifie les assurances expirant bientot et envoie des alertes
 * Appele par un cron Vercel ou Supabase Edge Function
 */
export async function GET(request: Request) {
  try {
    // Verifier le token cron
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Configuration manquante" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const today = new Date();
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    // Assurances expirant dans 30 jours (pas encore notifiees)
    const { data: expiring30j } = await supabase
      .from("insurance_policies")
      .select("*, profiles(first_name, last_name, email)")
      .lte("end_date", in30Days.toISOString().split("T")[0])
      .gt("end_date", in7Days.toISOString().split("T")[0])
      .eq("reminder_sent_30j", false);

    // Assurances expirant dans 7 jours (pas encore notifiees)
    const { data: expiring7j } = await supabase
      .from("insurance_policies")
      .select("*, profiles(first_name, last_name, email)")
      .lte("end_date", in7Days.toISOString().split("T")[0])
      .gt("end_date", today.toISOString().split("T")[0])
      .eq("reminder_sent_7j", false);

    let sent30j = 0;
    let sent7j = 0;

    // Envoyer les alertes J-30
    for (const policy of expiring30j || []) {
      const profile = (policy as any).profiles;
      if (!profile?.email) continue;

      try {
        const { subject, html } = insuranceExpiry30jEmail({
          userName: profile.first_name || "",
          insuranceType: policy.insurance_type,
          insurerName: policy.insurer_name,
          endDate: policy.end_date,
          policyNumber: policy.policy_number || "",
        });

        await sendEmail({ to: profile.email, subject, html });

        await supabase
          .from("insurance_policies")
          .update({ reminder_sent_30j: true })
          .eq("id", policy.id);

        sent30j++;
      } catch (emailErr) {
        console.error(`Email J-30 failed for policy ${policy.id}:`, emailErr);
      }
    }

    // Envoyer les alertes J-7
    for (const policy of expiring7j || []) {
      const profile = (policy as any).profiles;
      if (!profile?.email) continue;

      try {
        const { subject, html } = insuranceExpiry7jEmail({
          userName: profile.first_name || "",
          insuranceType: policy.insurance_type,
          insurerName: policy.insurer_name,
          endDate: policy.end_date,
          policyNumber: policy.policy_number || "",
        });

        await sendEmail({ to: profile.email, subject, html });

        await supabase
          .from("insurance_policies")
          .update({ reminder_sent_7j: true })
          .eq("id", policy.id);

        sent7j++;
      } catch (emailErr) {
        console.error(`Email J-7 failed for policy ${policy.id}:`, emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      sent_30j: sent30j,
      sent_7j: sent7j,
      total_checked: (expiring30j?.length || 0) + (expiring7j?.length || 0),
    });
  } catch (err) {
    console.error("check-expiring error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
