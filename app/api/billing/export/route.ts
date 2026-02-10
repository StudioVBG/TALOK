import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Export RGPD Art. 20 — Portabilite des donnees
 * Retourne toutes les donnees de facturation de l'utilisateur au format JSON
 */
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    // Fetch all billing data
    const [subscriptionResult, invoicesResult, usageResult] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("subscription_invoices")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscription_usage")
        .select("*")
        .eq("user_id", user.id),
    ]);

    const exportData = {
      export_date: new Date().toISOString(),
      user_id: user.id,
      user_email: user.email,
      subscription: subscriptionResult.data || null,
      invoices: invoicesResult.data || [],
      usage: usageResult.data || [],
      rgpd_notice: "Export effectue conformement a l'Article 20 du RGPD (droit a la portabilite des donnees).",
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="talok-export-${date}.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
