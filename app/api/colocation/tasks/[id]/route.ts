export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { updateTaskSchema } from "@/features/colocation/types";

/**
 * PATCH /api/colocation/tasks/[id]
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: task, error: updateError } = await supabase
      .from("colocation_tasks")
      .update(parsed.data)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return NextResponse.json({ task });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/colocation/tasks/[id] (complete task)
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouve" }, { status: 404 });
    }

    const { data: task, error: updateError } = await supabase
      .from("colocation_tasks")
      .update({
        completed_at: new Date().toISOString(),
        completed_by: profile.id,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return NextResponse.json({ task });
  } catch (err) {
    return handleApiError(err);
  }
}
