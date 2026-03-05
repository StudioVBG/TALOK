export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

/**
 * POST /api/admin/api-costs - Mettre à jour les coûts API
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.accounting.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();
    const user = auth.user;

    const body = await request.json();
    const { provider_id, costs } = body; // costs: { feature: cost_per_call }

    if (!provider_id || !costs) {
      return NextResponse.json(
        { error: "provider_id et costs requis" },
        { status: 400 }
      );
    }

    // Mettre à jour les coûts dans la table api_providers
    const { data: provider, error } = await supabase
      .from("api_providers")
      .update({
        cost_per_call: costs,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", provider_id)
      .select()
      .single();

    if (error) throw error;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "API.CostsUpdated",
      payload: {
        provider_id,
        costs,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "api_costs_updated",
      entity_type: "api_provider",
      entity_id: provider_id,
      metadata: { costs },
    } as any);

    return NextResponse.json({ provider });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

