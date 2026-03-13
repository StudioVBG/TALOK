export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: providerId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Accès réservé aux propriétaires" }, { status: 403 });
    }

    const { data: existing } = await (supabase as any)
      .from("provider_favorites")
      .select("id")
      .eq("owner_profile_id", profile.id)
      .eq("provider_profile_id", providerId)
      .maybeSingle();

    if (existing) {
      const { error } = await (supabase as any)
        .from("provider_favorites")
        .delete()
        .eq("id", (existing as { id: string }).id);

      if (error) {
        console.error("[Favorite] Delete error:", error);
        return NextResponse.json({ error: "Erreur de suppression" }, { status: 500 });
      }

      return NextResponse.json({ success: true, is_favorite: false });
    }

    const { error } = await (supabase as any).from("provider_favorites").insert({
      owner_profile_id: profile.id,
      provider_profile_id: providerId,
    });

    if (error) {
      console.error("[Favorite] Insert error:", error);
      return NextResponse.json({ error: "Erreur d'ajout" }, { status: 500 });
    }

    return NextResponse.json({ success: true, is_favorite: true });
  } catch (error) {
    console.error("[Favorite] Unexpected error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
