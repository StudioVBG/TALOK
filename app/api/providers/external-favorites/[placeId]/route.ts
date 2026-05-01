export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// API: Mise à jour / suppression d'un favori externe
// PATCH  /api/providers/external-favorites/[placeId]  → notes
// DELETE /api/providers/external-favorites/[placeId]
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";

async function getProfileId(): Promise<
  | { ok: true; profileId: string; supabase: Awaited<ReturnType<typeof createRouteHandlerClient>> }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Profil non trouvé" }, { status: 404 }),
    };
  }

  return { ok: true, profileId: profile.id, supabase };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await params;
  if (!placeId) {
    return NextResponse.json({ error: "placeId manquant" }, { status: 400 });
  }

  let body: { notes?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }

  const ctx = await getProfileId();
  if (!ctx.ok) return ctx.response;

  const { data, error } = await (ctx.supabase as any)
    .from("provider_external_favorites")
    .update({ notes: body.notes ?? null })
    .eq("owner_profile_id", ctx.profileId)
    .eq("place_id", placeId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[external-favorites] PATCH error:", error);
    return NextResponse.json({ error: "Erreur de mise à jour" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Favori introuvable" }, { status: 404 });
  }

  return NextResponse.json({ favorite: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await params;
  if (!placeId) {
    return NextResponse.json({ error: "placeId manquant" }, { status: 400 });
  }

  const ctx = await getProfileId();
  if (!ctx.ok) return ctx.response;

  const { error } = await (ctx.supabase as any)
    .from("provider_external_favorites")
    .delete()
    .eq("owner_profile_id", ctx.profileId)
    .eq("place_id", placeId);

  if (error) {
    console.error("[external-favorites] DELETE error:", error);
    return NextResponse.json({ error: "Erreur de suppression" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
