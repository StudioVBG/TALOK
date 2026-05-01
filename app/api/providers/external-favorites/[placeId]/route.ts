export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// API: Suppression d'un favori externe
// DELETE /api/providers/external-favorites/[placeId]
// =====================================================

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await params;
  if (!placeId) {
    return NextResponse.json({ error: "placeId manquant" }, { status: 400 });
  }

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
  }

  const { error } = await (supabase as any)
    .from("provider_external_favorites")
    .delete()
    .eq("owner_profile_id", profile.id)
    .eq("place_id", placeId);

  if (error) {
    console.error("[external-favorites] DELETE error:", error);
    return NextResponse.json({ error: "Erreur de suppression" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
