export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/broadcasts/active
 * Retourne les broadcasts actifs qui concernent l'utilisateur courant,
 * en excluant ceux déjà dismissés.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ broadcasts: [] });
  }

  // Récupère le rôle du user
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = profile?.role || null;

  // Service client pour contourner RLS sur la table broadcasts
  // (les RLS sont lisibles par tout user authenticated, mais on utilise le
  //  service client pour la performance et pour joindre les dismissals).
  const service = createServiceRoleClient();

  const nowIso = new Date().toISOString();
  let query = service
    .from("platform_broadcasts")
    .select("*")
    .eq("active", true)
    .lte("starts_at", nowIso)
    .order("created_at", { ascending: false });

  const { data: broadcasts, error } = await query;
  if (error) {
    console.error("[broadcasts/active GET]", error);
    return NextResponse.json({ broadcasts: [] });
  }

  // Filtre ends_at > now OR null + target_role match
  const nowTs = Date.now();
  const active = (broadcasts || []).filter((b) => {
    if (b.ends_at && new Date(b.ends_at).getTime() < nowTs) return false;
    if (b.target_role && b.target_role !== role) return false;
    return true;
  });

  if (active.length === 0) {
    return NextResponse.json({ broadcasts: [] });
  }

  // Exclut les dismissals
  const { data: dismissals } = await service
    .from("platform_broadcast_dismissals")
    .select("broadcast_id")
    .eq("user_id", user.id)
    .in(
      "broadcast_id",
      active.map((b) => b.id)
    );

  const dismissedIds = new Set((dismissals || []).map((d) => d.broadcast_id));
  const visible = active.filter((b) => !dismissedIds.has(b.id));

  return NextResponse.json({ broadcasts: visible });
}
