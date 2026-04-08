import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");
    const { data: profile } = await supabase.from("profiles").select("id, role").eq("user_id", user.id).single();
    if (!profile) throw new ApiError(403, "Profil non trouve");
    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    if (!entityId) throw new ApiError(400, "entityId requis");

    const { data: entity } = await supabase.from("legal_entities").select("carte_g_numero, carte_g_expiry, caisse_garantie").eq("id", entityId).single();
    const { count: separateAccounts } = await supabase.from("bank_connections").select("id", { count: "exact", head: true }).eq("entity_id", entityId).eq("account_type", "checking");
    const { data: lateReversals } = await supabase.from("accounting_entries").select("id").eq("entity_id", entityId).eq("source", "auto:agency_commission").is("reference", null).limit(5);
    const { count: crgCount } = await supabase.from("crg_reports").select("id", { count: "exact", head: true }).eq("entity_id", entityId);
    // TRACFIN: check movements > 10000€
    const { data: tracfinAlerts } = await supabase.from("bank_transactions").select("id, amount_cents, transaction_date, label").gt("amount_cents", 1000000).limit(10);

    const checks = [
      { name: "Carte G valide", status: !!(entity?.carte_g_numero && entity?.carte_g_expiry && new Date(entity.carte_g_expiry) > new Date()), detail: entity?.carte_g_expiry ? `Expire le ${entity.carte_g_expiry}` : "Non renseignee" },
      { name: "Compte mandant separe", status: (separateAccounts ?? 0) >= 2, detail: `${separateAccounts ?? 0} compte(s) bancaire(s)` },
      { name: "Reversements dans les delais", status: !lateReversals || lateReversals.length === 0, detail: lateReversals?.length ? `${lateReversals.length} reversement(s) en retard` : "OK" },
      { name: "CRG a jour", status: (crgCount ?? 0) > 0, detail: `${crgCount ?? 0} CRG genere(s)` },
      { name: "Caisse de garantie", status: !!entity?.caisse_garantie, detail: entity?.caisse_garantie ?? "Non renseignee" },
    ];
    const score = checks.filter(c => c.status).length;

    return NextResponse.json({ success: true, data: { checks, score, total: 5, alerts: tracfinAlerts ?? [] } });
  } catch (error) { return handleApiError(error); }
}
