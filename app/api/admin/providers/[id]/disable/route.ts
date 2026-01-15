export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/providers/[id]/disable - Désactiver un fournisseur API
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut désactiver un fournisseur" },
        { status: 403 }
      );
    }

    // Désactiver le provider
    const { data: provider, error } = await supabase
      .from("api_providers")
      .update({
        is_active: false,
        disabled_at: new Date().toISOString(),
        disabled_by: user.id,
      } as any)
      .eq("id", params.id as any)
      .select()
      .single();

    if (error) throw error;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "provider_disabled",
      entity_type: "api_provider",
      entity_id: params.id,
    } as any);

    return NextResponse.json({ provider });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

