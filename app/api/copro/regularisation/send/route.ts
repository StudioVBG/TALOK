export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireCoproFeature } from "@/lib/helpers/copro-feature-gate";

export async function POST(request: Request) {
  try {
    // S1-2 : auth + feature gate copro_module
    const access = await requireCoproFeature();
    if (access instanceof NextResponse) return access;

    const supabase = await createClient();
    const body = await request.json();
    const { regularisation_id, tenant_ids } = body;

    if (!regularisation_id) {
      return NextResponse.json(
        { error: "regularisation_id requis" },
        { status: 400 }
      );
    }

    const notificationPromises = (tenant_ids || []).map((tenantId: string) =>
      supabase.rpc("create_notification", {
        p_profile_id: tenantId,
        p_type: "regularisation",
        p_title: "Régularisation de charges",
        p_message: "Une régularisation de charges a été effectuée pour votre logement.",
        p_link: `/tenant/charges`,
      })
    );

    await Promise.allSettled(notificationPromises);

    return NextResponse.json({ success: true, sent_to: tenant_ids?.length || 0 });
  } catch (error) {
    console.error("[Regularisation] Send error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
