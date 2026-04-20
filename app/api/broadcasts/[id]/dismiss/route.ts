export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/broadcasts/[id]/dismiss
 * Marque un broadcast comme dismissé pour l'utilisateur courant.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from("platform_broadcast_dismissals")
    .upsert(
      { broadcast_id: id, user_id: user.id },
      { onConflict: "broadcast_id,user_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("[broadcasts/dismiss POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
